// Spec 0003 isolation check (AC-1, AC-2) against a real database. Writes two
// temporary clinics and deletes them after. Skipped in `npm test`; run with
// `npm run check:isolation`, which loads .env.local. Point it at a dev database.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const run = process.env.npm_lifecycle_event === "check:isolation";

describe.runIf(run)("tenancy isolation (database)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const { forClinic } = await import("./tenancy");
  const tag = `iso-${Date.now()}`;
  const ids = {} as Record<"a" | "b", { clinic: string; doctor: string; appt: string }>;
  let specialtyId = "";

  async function seed(key: "a" | "b") {
    const clinic = await prisma.clinic.create({ data: { slug: `${tag}-${key}`, name: key } });
    const db = forClinic(clinic.id);
    const branch = await db.branch.create({
      data: { clinicId: clinic.id, name: "Main", address: "x", city: "x", latitude: 0, longitude: 0 },
    });
    const doctor = await db.doctor.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        specialtyId,
        name: `Dr ${key}`,
        email: `${tag}-${key}@example.com`,
        phone: "0",
        imageUrl: "",
        gender: "MALE",
      },
    });
    const patient = await db.clinicPatient.create({ data: { clinicId: clinic.id, name: `P ${key}` } });
    const appt = await db.appointment.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        doctorId: doctor.id,
        clinicPatientId: patient.id,
        date: new Date("2030-01-01T00:00:00Z"),
        time: "10:00",
      },
    });
    ids[key] = { clinic: clinic.id, doctor: doctor.id, appt: appt.id };
    return { branch, patient };
  }

  let aRefs: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    specialtyId = (await prisma.specialty.create({ data: { slug: tag, name: tag } })).id;
    aRefs = await seed("a");
    await seed("b");
  }, 60000);

  afterAll(async () => {
    await prisma.clinic.deleteMany({ where: { slug: { startsWith: tag } } });
    await prisma.specialty.deleteMany({ where: { slug: tag } });
    await prisma.$disconnect();
  }, 60000);

  it("AC-1: clinic A cannot read or change clinic B rows", async () => {
    const a = forClinic(ids.a.clinic);
    expect((await a.appointment.findMany()).map((r) => r.id)).toEqual([ids.a.appt]);
    expect(await a.appointment.findUnique({ where: { id: ids.b.appt } })).toBeNull();
    expect(await a.doctor.count({ where: { id: ids.b.doctor } })).toBe(0);
    await expect(
      a.appointment.update({ where: { id: ids.b.appt }, data: { status: "CANCELLED" } }),
    ).rejects.toMatchObject({ code: "P2025" });
    expect((await a.appointment.deleteMany({ where: { id: ids.b.appt } })).count).toBe(0);
  });

  it("AC-1: scoping holds inside an interactive transaction", async () => {
    const rows = await forClinic(ids.a.clinic).$transaction((tx) => tx.appointment.findMany());
    expect(rows.map((r) => r.id)).toEqual([ids.a.appt]);
  });

  it("AC-2: the database rejects an appointment pairing clinic A with clinic B's doctor", async () => {
    await expect(
      prisma.appointment.create({
        data: {
          clinicId: ids.a.clinic,
          branchId: aRefs.branch.id,
          clinicPatientId: aRefs.patient.id,
          doctorId: ids.b.doctor,
          date: new Date("2030-01-02T00:00:00Z"),
          time: "11:00",
        },
      }),
    ).rejects.toThrow();
  });
});
