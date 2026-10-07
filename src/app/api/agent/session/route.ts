// Spec 0004 AC-1, AC-2, AC-11: start an agent session for a clinic.
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { startSession } from "@/lib/services/agent-session";

export const runtime = "nodejs";

const Body = z.object({
  clinicSlug: z.string().min(1).max(100),
  channel: z.enum(["VOICE", "TEXT"]),
  language: z.enum(["EN", "HI"]),
});

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 422 });

  const result = await startSession(clerkId, body.data);
  switch (result.status) {
    case "unauthorized":
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    case "clinic_unavailable":
      return NextResponse.json(
        { error: "CLINIC_UNAVAILABLE" },
        { status: 404 },
      );
    case "limit":
      return NextResponse.json(
        { error: "DAILY_LIMIT", resetsAt: result.resetsAt.toISOString() },
        { status: 429 },
      );
    case "ok":
      console.log("[agent] session start", { sessionId: result.sessionId });
      return NextResponse.json({
        sessionId: result.sessionId,
        limits: result.limits,
      });
  }
}
