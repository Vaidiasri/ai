// Spec 0004 AC-9, AC-11: end the caller's own session. Idempotent. Reads the
// body as text because navigator.sendBeacon may send it as text/plain.
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AGENT_LIMITS,
  endSession,
  findOwnSession,
} from "@/lib/services/agent-session";

export const runtime = "nodejs";

const Body = z.object({
  sessionId: z.string().min(1).max(100),
  reason: z.enum(["COMPLETED", "ABANDONED"]),
});

function parse(text: string) {
  try {
    return Body.safeParse(JSON.parse(text));
  } catch {
    return Body.safeParse(null);
  }
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = parse(await req.text());
  if (!body.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });

  const session = await findOwnSession(body.data.sessionId, clerkId);
  if (!session)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The server owns the voice time cap (AC-7): past it, the end is TIME_LIMIT
  // whatever the client sent.
  const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
  const endReason =
    session.channel === "VOICE" && elapsed >= AGENT_LIMITS.voiceSeconds
      ? "TIME_LIMIT"
      : body.data.reason;
  const { count } = await endSession(session, endReason);
  if (count)
    console.log("[agent] session end", { sessionId: session.id, endReason });
  return new Response(null, { status: 204 });
}
