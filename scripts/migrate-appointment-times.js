/**
 * Normalizes legacy appointment.time values to canonical 24h "HH:mm"
 * and resolves duplicates before the unique index is applied.
 *
 * Run: node scripts/migrate-appointment-times.js
 */

const fs = require("fs");
const path = require("path");

function loadEnvFile(filename) {
  const envPath = path.join(__dirname, "..", filename);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function toCanonicalTime(timeStr) {
  if (!timeStr?.trim()) return "09:00";

  const trimmed = timeStr.trim();

  const hybrid = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (hybrid && Number(hybrid[1]) > 12) {
    return toCanonicalTime(`${hybrid[1]}:${hybrid[2]}`);
  }

  const twentyFourHour = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = twentyFourHour[2];
    if (hours >= 0 && hours <= 23) {
      return `${String(hours).padStart(2, "0")}:${minutes}`;
    }
  }

  const twelveHour = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = twelveHour[2] ?? "00";
    const period = twelveHour[3].toLowerCase();
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  return trimmed;
}

async function main() {
  const appointments = await prisma.appointment.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${appointments.length} appointments to inspect.`);

  let updated = 0;
  let cancelled = 0;

  const slotKeys = new Map();

  const statusPriority = { CONFIRMED: 0, PENDING: 1, COMPLETED: 2, CANCELLED: 3 };

  for (const appointment of appointments) {
    const canonicalTime = toCanonicalTime(appointment.time);
    const slotKey = `${appointment.doctorId}|${appointment.date.toISOString()}|${canonicalTime}`;

    const existingId = slotKeys.get(slotKey);
    if (existingId) {
      const existing = appointments.find((a) => a.id === existingId);
      const keepCurrent =
        existing &&
        (statusPriority[appointment.status] ?? 9) <
          (statusPriority[existing.status] ?? 9);

      if (keepCurrent) {
        await prisma.appointment.update({
          where: { id: existingId },
          data: { status: "CANCELLED" },
        });
        slotKeys.set(slotKey, appointment.id);
        cancelled++;
        console.log(`Cancelled duplicate ${existingId} (replaced by ${appointment.id})`);
      } else {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: "CANCELLED" },
        });
        cancelled++;
        console.log(
          `Cancelled duplicate ${appointment.id} (${appointment.time} -> slot already taken)`,
        );
      }
      continue;
    }

    slotKeys.set(slotKey, appointment.id);

    if (appointment.time !== canonicalTime) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { time: canonicalTime },
      });
      updated++;
      console.log(`Updated ${appointment.id}: "${appointment.time}" -> "${canonicalTime}"`);
    }
  }

  console.log(`Done. Normalized: ${updated}, duplicates cancelled: ${cancelled}`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
