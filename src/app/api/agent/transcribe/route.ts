// Spec 0004: one voice upload to text. Same auth and session checks as chat,
// then Groq Whisper. Never logs the audio or the transcript.
import { groq } from "@ai-sdk/groq";
import { auth } from "@clerk/nextjs/server";
import { transcribe } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AGENT_LIMITS,
  claimUpload,
  endSession,
  findOwnSession,
} from "@/lib/services/agent-session";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["audio/wav", "audio/x-wav", "audio/webm", "audio/ogg"];

const Fields = z.object({
  sessionId: z.string().min(1).max(100),
  language: z.enum(["EN", "HI"]),
});

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (Number(req.headers.get("content-length")) > MAX_BYTES + 64 * 1024)
    return NextResponse.json({ error: "Too large" }, { status: 413 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const fields = Fields.safeParse({
    sessionId: form?.get("sessionId"),
    language: form?.get("language"),
  });
  if (!fields.success || !(audio instanceof Blob))
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  if (audio.size > MAX_BYTES)
    return NextResponse.json({ error: "Too large" }, { status: 413 });
  const type = audio.type.split(";")[0];
  if (!audio.size || !TYPES.includes(type))
    return NextResponse.json({ error: "Invalid audio" }, { status: 422 });
  const { sessionId, language } = fields.data;

  const session = await findOwnSession(sessionId, clerkId);
  if (!session)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.endedAt)
    return NextResponse.json({ endReason: session.endReason }, { status: 409 });
  if (session.channel !== "VOICE")
    return NextResponse.json({ error: "Not a voice session" }, { status: 422 });

  const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
  if (elapsed >= AGENT_LIMITS.voiceSeconds) {
    const { count } = await endSession(session, "TIME_LIMIT");
    if (count)
      console.log("[agent] session end", {
        sessionId,
        endReason: "TIME_LIMIT",
      });
    return NextResponse.json({ endReason: "TIME_LIMIT" }, { status: 409 });
  }
  if (!(await claimUpload(session)))
    return NextResponse.json({ error: "UPLOAD_LIMIT" }, { status: 409 });

  try {
    const { text } = await transcribe({
      model: groq.transcription("whisper-large-v3-turbo"),
      audio: new Uint8Array(await audio.arrayBuffer()),
      providerOptions: {
        groq: { language: language === "HI" ? "hi" : "en", temperature: 0 },
      },
      maxRetries: 1,
      abortSignal: req.signal,
    });
    return NextResponse.json({ text: text.trim() });
  } catch {
    console.error("[agent] transcribe error", { sessionId });
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 502 },
    );
  }
}
