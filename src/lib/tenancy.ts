// Tenancy (spec 0003): the only place that builds clinic scoped data access.
// Clinic owned models are read and written through forClinic(); only the
// unscoped allowlist in the spec may import @/lib/prisma directly.
import { auth } from "@clerk/nextjs/server";
import { type ClinicRole, Prisma, type User } from "@prisma/client";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const DEMO_CLINIC_SLUG = "demo";

export const CLINIC_OWNED_MODELS = new Set<string>([
  "Branch",
  "ClinicMember",
  "ClinicSpecialty",
  "Doctor",
  "ClinicPatient",
  "Appointment",
  "AgentSession",
]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

type Row = Record<string, unknown>;

function refuse(clinicId: string, reason: string): never {
  console.warn("[tenancy] refused", { clinicId, reason });
  throw new Error(`Tenancy: ${reason}`);
}

// A different explicit clinicId is a bug or an attack; never silently rewrite it.
function withClinic(row: Row | undefined, clinicId: string, model: string): Row {
  const r = row ?? {};
  if ("clinic" in r) refuse(clinicId, `${model}: use the clinicId scalar, not a clinic relation`);
  if (r.clinicId !== undefined && r.clinicId !== clinicId) {
    refuse(clinicId, `${model}: clinicId does not match the scoped clinic`);
  }
  return { ...r, clinicId };
}

// Pure args rewrite, exported for unit tests. Top level where keys are ANDed by
// Prisma, so adding clinicId narrows every query, unique ones included.
export function scopeArgs(model: string, operation: string, args: Row, clinicId: string): Row {
  if (!CLINIC_OWNED_MODELS.has(model)) return args;
  const a: Row = { ...args };

  if (WHERE_OPS.has(operation)) {
    a.where = withClinic(a.where as Row, clinicId, model);
    if ((operation === "update" || operation === "updateMany") && a.data) {
      const data = a.data as Row;
      if (data.clinicId !== undefined && data.clinicId !== clinicId) {
        refuse(clinicId, `${model}: cannot move a row to another clinic`);
      }
    }
    return a;
  }
  if (CREATE_OPS.has(operation)) {
    a.data = Array.isArray(a.data)
      ? a.data.map((d: Row) => withClinic(d, clinicId, model))
      : withClinic(a.data as Row, clinicId, model);
    return a;
  }
  if (operation === "upsert") {
    a.where = withClinic(a.where as Row, clinicId, model);
    a.create = withClinic(a.create as Row, clinicId, model);
    const update = (a.update ?? {}) as Row;
    if (update.clinicId !== undefined && update.clinicId !== clinicId) {
      refuse(clinicId, `${model}: cannot move a row to another clinic`);
    }
    return a;
  }
  // Fail closed: a Prisma operation added later must be reviewed before use.
  refuse(clinicId, `${model}.${operation} is not allowed on a clinic owned model`);
}

export function forClinic(clinicId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, (args ?? {}) as Row, clinicId));
        },
      },
    },
  });
}

export type ClinicDb = ReturnType<typeof forClinic>;

// Public resolver: null for unknown or suspended, so suspension applies to
// every patient path that resolves its clinic here.
export async function clinicBySlug(slug: string) {
  const clinic = await prisma.clinic.findUnique({ where: { slug } });
  if (!clinic || clinic.status !== "ACTIVE") return null;
  return { clinic, db: forClinic(clinic.id) };
}

export async function requireClinicMember(roles?: ClinicRole[]) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Authentication required");

  const memberships = await prisma.clinicMember.findMany({
    where: { user: { clerkId } },
    select: { clinicId: true, role: true, clinic: { select: { status: true } } },
  });
  // The cookie holds a clinicId; Feature 8's switcher sets it.
  const wanted = (await cookies()).get("clinic")?.value;
  const member =
    memberships.find((m) => m.clinicId === wanted) ??
    (memberships.length === 1 ? memberships[0] : undefined);

  if (!member) {
    refuse(wanted ?? "none", memberships.length ? "choose a clinic" : "not a clinic member");
  }
  if (member.clinic.status !== "ACTIVE") refuse(member.clinicId, "clinic not available");
  if (roles && !roles.includes(member.role)) refuse(member.clinicId, "role not allowed");

  return { clinicId: member.clinicId, role: member.role, db: forClinic(member.clinicId) };
}

export function clinicPatientName(user: Pick<User, "firstName" | "lastName" | "email">) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email.split("@")[0] || user.email;
}

// Kept outside the booking slot P2002 handling: a parallel first booking that
// loses the insert race just reads the winner's row.
export async function getOrCreateClinicPatient(
  db: ClinicDb,
  clinicId: string,
  user: Pick<User, "id" | "firstName" | "lastName" | "email" | "phone">,
) {
  const where = { clinicId_userId: { clinicId, userId: user.id } };
  try {
    return await db.clinicPatient.upsert({
      where,
      update: {},
      create: { clinicId, userId: user.id, name: clinicPatientName(user), phone: user.phone },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return db.clinicPatient.findUniqueOrThrow({ where });
    }
    throw e;
  }
}
