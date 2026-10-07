// Allowlisted (spec 0003 AC-10): deletes clinics suspended over 30 days ago.
// Children go with them through the clinicId cascades.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/vapi-auth";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const presented = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(presented, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count } = await prisma.clinic.deleteMany({
    where: { status: "SUSPENDED", suspendedAt: { lt: new Date(Date.now() - RETENTION_MS) } },
  });
  console.log("[cron] purge-clinics", { purged: count });
  return NextResponse.json({ purged: count });
}
