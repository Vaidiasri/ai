// Spec 0004: one patient turn. Auth and session checks, an atomic turn claim,
// then streamText on the primary model with one retry on the backup.
// Never logs message content: only {sessionId, event, provider, endReason}.
import { groq } from "@ai-sdk/groq";
import { auth } from "@clerk/nextjs/server";
import type { AgentLanguage } from "@prisma/client";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  type ModelMessage,
  streamText,
  type TextStreamPart,
  type ToolSet,
  toUIMessageStream,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { BACKUP_MODEL, PRIMARY_MODEL } from "@/lib/agent/models";
import {
  FALLBACK_REPLY,
  sanitizeMessages,
  systemPrompt,
} from "@/lib/agent/policy";
import { buildTools } from "@/lib/agent/tools";
import {
  AGENT_LIMITS,
  claimTurn,
  endSession,
  findOwnSession,
  setProvider,
} from "@/lib/services/agent-session";
import { forClinic } from "@/lib/tenancy";
import { getNext5Days } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  sessionId: z.string().min(1).max(100),
  language: z.enum(["EN", "HI"]),
  messages: z.array(z.unknown()).min(1).max(200),
});

type Part = TextStreamPart<ToolSet>;

// Test hook (spec 0004 test plan): AGENT_TEST_MODELS="bad-id,bad-id" swaps
// the model ids to force fallbacks. Ignored in production.
function models() {
  const override = process.env.AGENT_TEST_MODELS;
  if (override && process.env.NODE_ENV !== "production")
    return override.split(",");
  return [PRIMARY_MODEL, BACKUP_MODEL];
}

// The first part that shows output or runs a tool. Before it, a failure is
// safe to retry: nothing reached the patient and no tool ran.
const COMMITS = new Set<Part["type"]>(["text-delta", "tool-call"]);

type Run = { reader: ReadableStreamDefaultReader<Part>; head: Part[] };

// Buffers a model's parts up to the first commit. Null when it failed before
// that.
async function open(stream: ReadableStream<Part>): Promise<Run | null> {
  const reader = stream.getReader();
  const head: Part[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || value.type === "error" || value.type === "abort") {
        reader.cancel().catch(() => {});
        return null;
      }
      head.push(value);
      if (COMMITS.has(value.type)) return { reader, head };
    }
  } catch {
    return null;
  }
}

// Replays the buffered head, then the rest. An error part or a thrown read
// closes the stream quietly and flags it, so the route adds the fixed reply.
function replay({ reader, head }: Run, flag: { failed: boolean }) {
  return new ReadableStream<Part>({
    start(controller) {
      for (const part of head) controller.enqueue(part);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) return controller.close();
        if (value.type === "error" || value.type === "abort") {
          flag.failed = true;
          reader.cancel().catch(() => {});
          return controller.close();
        }
        controller.enqueue(value);
      } catch {
        flag.failed = true;
        controller.close();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });
  const { sessionId, language } = body.data;

  // Sanitize before claiming, so a bad body never spends a turn.
  const messages: ModelMessage[] = sanitizeMessages(body.data.messages);
  if (messages.at(-1)?.role !== "user")
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });

  const session = await findOwnSession(sessionId, clerkId);
  if (!session)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ended = async (endReason: "TIME_LIMIT" | "MESSAGE_LIMIT") => {
    const { count } = await endSession(session, endReason);
    if (count) console.log("[agent] session end", { sessionId, endReason });
    return NextResponse.json({ endReason }, { status: 409 });
  };
  if (session.endedAt)
    return NextResponse.json({ endReason: session.endReason }, { status: 409 });

  const now = new Date();
  const elapsed = (now.getTime() - session.startedAt.getTime()) / 1000;
  const voice = session.channel === "VOICE";
  if (voice && elapsed >= AGENT_LIMITS.voiceSeconds) return ended("TIME_LIMIT");
  if (!(await claimTurn(session, language))) return ended("MESSAGE_LIMIT");

  const call = {
    instructions: systemPrompt({
      language,
      now,
      bookableDates: getNext5Days(),
      wrapUp: voice && elapsed >= AGENT_LIMITS.warnAtSeconds,
    }),
    messages,
    tools: buildTools({
      clinicId: session.clinicId,
      db: forClinic(session.clinicId),
      clerkId,
      sessionId,
    }),
    stopWhen: isStepCount(4),
    maxRetries: 0,
    maxOutputTokens: 400,
    abortSignal: req.signal,
    timeout: { firstChunkMs: 10_000, totalMs: 25_000 },
    // The default handler logs provider errors, which can carry the request
    // body (patient text). The fallback below handles them.
    onError: () => {},
  };

  const stream = createUIMessageStream({
    async execute({ writer }) {
      writer.write({ type: "start" });
      const flag = { failed: false };
      let provider: string | null = null;

      for (const modelId of models()) {
        if (req.signal.aborted) return;
        const run = await open(
          streamText({
            ...call,
            model: groq(modelId),
            // Keeps hidden reasoning from eating the 400 token reply budget.
            providerOptions: {
              groq: {
                reasoningEffort: modelId.startsWith("openai/gpt-oss")
                  ? "low"
                  : "none",
              },
            },
          }).stream,
        );
        if (!run) continue;
        provider = modelId;
        // Read in order (not writer.merge) so the fixed reply lands last.
        const ui = toUIMessageStream({
          stream: replay(run, flag),
          sendReasoning: false,
          sendStart: false,
          sendFinish: false,
        }).getReader();
        for (;;) {
          const { done, value } = await ui.read();
          if (done) break;
          writer.write(value);
        }
        break;
      }
      if (req.signal.aborted) return;

      if (provider) await setProvider(session, provider);
      if (!provider || flag.failed) {
        writer.write({ type: "text-start", id: "fallback" });
        writer.write({
          type: "text-delta",
          id: "fallback",
          delta: FALLBACK_REPLY[language as AgentLanguage],
        });
        writer.write({ type: "text-end", id: "fallback" });
        await endSession(session, "PROVIDER_ERROR");
        console.log("[agent] session end", {
          sessionId,
          provider,
          endReason: "PROVIDER_ERROR",
        });
      }
      writer.write({ type: "finish" });
    },
    onError() {
      console.error("[agent] chat error", { sessionId });
      return "Something went wrong. Please book with the booking form: /appointments";
    },
  });
  return createUIMessageStreamResponse({ stream });
}
