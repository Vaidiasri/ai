// Allowlisted (spec 0003 AC-10): deletes clinics suspended over 30 days ago.
// Children go with them through the clinicId cascades. Spec 0004 AC-13: also
// deletes agent sessions started over 90 days ago, in every clinic.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/vapi-auth";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * DAY_MS;
const AGENT_SESSION_RETENTION_MS = 90 * DAY_MS;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const presented = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(presented, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await prisma.clinic.deleteMany({
    where: {
      status: "SUSPENDED",
      suspendedAt: { lt: new Date(Date.now() - RETENTION_MS) },
    },
  });
  const sessions = await prisma.agentSession.deleteMany({
    where: {
      startedAt: { lt: new Date(Date.now() - AGENT_SESSION_RETENTION_MS) },
    },
  });
  console.log("[cron] purge-clinics", {
    purged: count,
    agentSessions: sessions.count,
  });
  return NextResponse.json({ purged: count, agentSessions: sessions.count });
}
