// Proves the partial slot index (spec 0001, AC-5): one active booking per
// doctor/date/time, and a cancelled slot can be booked again.
// Runs in one transaction that is always rolled back, so nothing persists.
// Usage: node --env-file=.env.local scripts/check-slot-index.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ROLLBACK = new Error("rollback");

async function expectDuplicateBlocked(tx, data) {
  // A failed statement aborts a Postgres transaction, so isolate it in a savepoint.
  await tx.$executeRaw`SAVEPOINT dup`;
  try {
    await tx.appointment.create({ data });
  } catch (e) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT dup`;
    if (e.code === "P2002") return;
    throw e;
  }
  throw new Error("second active booking for the same slot was allowed");
}

async function main() {
  const tag = `slotcheck-${Date.now()}`;
  await prisma
    .$transaction(
      async (tx) => {
        const clinic = await tx.clinic.create({
          data: { slug: tag, name: "Slot Check" },
        });
        const branch = await tx.branch.create({
          data: {
            clinicId: clinic.id,
            name: "Main",
            address: "x",
            city: "x",
            latitude: 0,
            longitude: 0,
          },
        });
        const specialty = await tx.specialty.create({
          data: { slug: tag, name: "test" },
        });
        const patient = await tx.clinicPatient.create({
          data: { clinicId: clinic.id, name: "Slot Check" },
        });
        const doctor = await tx.doctor.create({
          data: {
            clinicId: clinic.id,
            branchId: branch.id,
            specialtyId: specialty.id,
            name: "Slot Check",
            email: `${tag}@example.com`,
            phone: "0",
            imageUrl: "",
            gender: "MALE",
          },
        });
        const slot = {
          clinicId: clinic.id,
          branchId: branch.id,
          clinicPatientId: patient.id,
          doctorId: doctor.id,
          date: new Date("2030-01-01T00:00:00Z"),
          time: "10:00",
        };

        const first = await tx.appointment.create({ data: slot });
        await expectDuplicateBlocked(tx, slot);
        console.log("ok: second active booking rejected (P2002)");

        await tx.appointment.update({
          where: { id: first.id },
          data: { status: "CANCELLED" },
        });
        await tx.appointment.create({ data: slot });
        console.log("ok: slot rebooked after cancel");

        throw ROLLBACK;
      },
      // pooler round trips can exceed the 5s default
      { timeout: 30000, maxWait: 10000 },
    )
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
  console.log("slot index check passed (rolled back)");
}

main()
  .catch((e) => {
    console.error("slot index check FAILED:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
