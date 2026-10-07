// Allowlisted (spec 0004): findOwnSession and the user lookup are the only
// unscoped reads. Every other session read and write goes through forClinic.
import type {
  AgentChannel,
  AgentEndReason,
  AgentLanguage,
  AgentSession,
} from "@prisma/client";
import { syncUser } from "@/lib/actions/users";
import { prisma } from "@/lib/prisma";
import { clinicBySlug, forClinic } from "@/lib/tenancy";

export const AGENT_LIMITS = {
  perDay: 5,
  maxTurns: 40,
  voiceSeconds: 600,
  warnAtSeconds: 540,
  maxUploads: 60,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDayStart(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

async function userIdForClerk(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (user) return user.id;
  const synced = await syncUser();
  return synced?.clerkId === clerkId ? synced.id : null;
}

type StartInput = {
  clinicSlug: string;
  channel: AgentChannel;
  language: AgentLanguage;
};

export async function startSession(clerkId: string, input: StartInput) {
  const userId = await userIdForClerk(clerkId);
  if (!userId) return { status: "unauthorized" } as const;

  const found = await clinicBySlug(input.clinicSlug);
  if (!found) return { status: "clinic_unavailable" } as const;
  const { clinic, db } = found;

  const now = new Date();
  const dayStart = utcDayStart(now);
  const resetsAt = new Date(dayStart.getTime() + DAY_MS);
  // ponytail: count then create is not atomic, so two starts in the same
  // instant could both pass at 4. Lock the user row if that ever matters.
  const usedToday = await db.agentSession.count({
    where: { userId, startedAt: { gte: dayStart } },
  });
  if (usedToday >= AGENT_LIMITS.perDay)
    return { status: "limit", resetsAt } as const;

  await db.agentSession.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: now, endReason: "ABANDONED" },
  });
  const session = await db.agentSession.create({
    data: {
      clinicId: clinic.id,
      userId,
      channel: input.channel,
      language: input.language,
    },
  });

  const { maxTurns, voiceSeconds, warnAtSeconds, perDay } = AGENT_LIMITS;
  return {
    status: "ok",
    sessionId: session.id,
    limits: {
      perDay,
      remainingToday: perDay - usedToday - 1,
      maxTurns,
      voiceSeconds,
      warnAtSeconds,
    },
  } as const;
}

// Ownership check: another user's session id reads as not found.
export function findOwnSession(sessionId: string, clerkId: string) {
  return prisma.agentSession.findFirst({
    where: { id: sessionId, user: { clerkId } },
  });
}

// Atomic turn claim (AC-7); also saves the reply language the patient picked
// for this turn (AC-3). False when the session ended or used all its turns.
export async function claimTurn(
  session: Pick<AgentSession, "id" | "clinicId">,
  language: AgentLanguage,
) {
  const { count } = await forClinic(session.clinicId).agentSession.updateMany({
    where: {
      id: session.id,
      endedAt: null,
      turnCount: { lt: AGENT_LIMITS.maxTurns },
    },
    data: { turnCount: { increment: 1 }, language },
  });
  return count > 0;
}

// Guarded upload claim (AC-7): only an open VOICE session under 60 uploads.
export async function claimUpload(
  session: Pick<AgentSession, "id" | "clinicId">,
) {
  const { count } = await forClinic(session.clinicId).agentSession.updateMany({
    where: {
      id: session.id,
      endedAt: null,
      channel: "VOICE",
      transcribeCount: { lt: AGENT_LIMITS.maxUploads },
    },
    data: { transcribeCount: { increment: 1 } },
  });
  return count > 0;
}

export function setProvider(
  session: Pick<AgentSession, "id" | "clinicId">,
  provider: string,
) {
  return forClinic(session.clinicId).agentSession.updateMany({
    where: { id: session.id },
    data: { provider },
  });
}

// First ending wins; later ones are no ops.
export function endSession(
  session: Pick<AgentSession, "id" | "clinicId">,
  reason: AgentEndReason,
) {
  return forClinic(session.clinicId).agentSession.updateMany({
    where: { id: session.id, endedAt: null },
    data: { endedAt: new Date(), endReason: reason },
  });
}
