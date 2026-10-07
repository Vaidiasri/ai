"use server";

// Allowlisted (spec 0003): platform admin works on clinics, never on patient
// or appointment fields (AC-8). Counts only.
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEMO_CLINIC_SLUG } from "@/lib/tenancy";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export async function listClinics() {
  await requireAdmin();
  return prisma.clinic.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      suspendedAt: true,
      _count: { select: { branches: true, doctors: true, patients: true, appointments: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createClinic(input: {
  name: string;
  slug: string;
  ownerEmail: string;
  branch: { name: string; address: string; city: string; latitude: number; longitude: number };
}) {
  await requireAdmin();
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG.test(slug)) throw new Error("Slug must be lowercase letters, digits and dashes");
  if (!input.name.trim()) throw new Error("Name is required");

  const owner = await prisma.user.findFirst({
    where: { email: { equals: input.ownerEmail.trim(), mode: "insensitive" } },
    select: { id: true },
  });
  if (!owner) throw new Error("No user has signed up with that owner email");

  try {
    // One statement, so the clinic, its first branch and the owner land together.
    const clinic = await prisma.clinic.create({
      data: {
        slug,
        name: input.name.trim(),
        branches: { create: input.branch },
        members: { create: { userId: owner.id, role: "OWNER" } },
      },
      select: { id: true, slug: true, name: true, status: true },
    });
    revalidatePath("/admin");
    return clinic;
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") throw new Error("That slug is taken");
    throw error;
  }
}

async function setStatus(clinicId: string, to: "ACTIVE" | "SUSPENDED") {
  await requireAdmin();
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { slug: true, status: true },
  });
  if (!clinic) throw new Error("Clinic not found");
  if (to === "SUSPENDED" && clinic.slug === DEMO_CLINIC_SLUG) {
    throw new Error("The Demo clinic cannot be suspended");
  }
  if (clinic.status === to) throw new Error(`Clinic is already ${to.toLowerCase()}`);

  const updated = await prisma.clinic.update({
    where: { id: clinicId },
    data: { status: to, suspendedAt: to === "SUSPENDED" ? new Date() : null },
    select: { id: true, status: true, suspendedAt: true },
  });
  revalidatePath("/admin");
  return updated;
}

export async function suspendClinic(clinicId: string) {
  return setStatus(clinicId, "SUSPENDED");
}

export async function restoreClinic(clinicId: string) {
  return setStatus(clinicId, "ACTIVE");
}
