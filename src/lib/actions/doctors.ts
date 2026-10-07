"use server";

import { auth } from "@clerk/nextjs/server";
import type { Gender } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { type DoctorSearch, findAvailableDoctors } from "@/lib/services/doctors";
import { type ClinicDb, clinicBySlug, DEMO_CLINIC_SLUG, requireClinicMember } from "@/lib/tenancy";
import { generateAvatar } from "../utils";

export async function getDoctors() {
  try {
    const { db } = await requireClinicMember(["OWNER"]);
    const doctors = await db.doctor.findMany({
      include: {
        specialty: { select: { name: true } },
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return doctors.map(({ specialty, _count, ...doctor }) => ({
      ...doctor,
      speciality: specialty.name,
      appointmentCount: _count.appointments,
    }));
  } catch (error) {
    console.log("Error fetching doctors:", error);
    throw new Error("Failed to fetch doctors");
  }
}

interface CreateDoctorInput {
  name: string;
  email: string;
  phone: string;
  speciality: string;
  gender: Gender;
  isActive: boolean;
}

// App rule (spec 0003): a doctor's specialty must be one the clinic offers.
async function clinicSpecialtyId(db: ClinicDb, name: string) {
  const offered = await db.clinicSpecialty.findMany({
    select: { specialtyId: true, specialty: { select: { name: true } } },
  });
  const match = offered.find(
    (o) => o.specialty.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (!match) {
    const names = offered.map((o) => o.specialty.name).join(", ");
    throw new Error(`Speciality must be one of this clinic's: ${names}`);
  }
  return match.specialtyId;
}

function doctorError(error: unknown, fallback: string): Error {
  const code = (error as { code?: string })?.code;
  if (code === "P2002") return new Error("A doctor with this email already exists");
  if (code === "P2025") return new Error("Doctor not found");
  return new Error(fallback);
}

export async function createDoctor(input: CreateDoctorInput) {
  const { db, clinicId } = await requireClinicMember(["OWNER"]);
  if (!input.name || !input.email) throw new Error("Name and email are required");

  const { speciality, ...fields } = input;
  const specialtyId = await clinicSpecialtyId(db, speciality);
  // ponytail: new doctors join the oldest branch; a branch picker comes with
  // multi branch onboarding (Feature 7).
  const branch = await db.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) throw new Error("This clinic has no branch yet");

  try {
    const doctor = await db.doctor.create({
      data: {
        ...fields,
        clinicId,
        branchId: branch.id,
        specialtyId,
        imageUrl: generateAvatar(input.name, input.gender),
      },
    });

    revalidatePath("/admin");

    return doctor;
  } catch (error) {
    console.error("Error creating doctor:", error);
    throw doctorError(error, "Failed to create doctor");
  }
}

interface UpdateDoctorInput extends Partial<CreateDoctorInput> {
  id: string;
}

export async function updateDoctor(input: UpdateDoctorInput) {
  const { db } = await requireClinicMember(["OWNER"]);
  if (!input.name || !input.email) throw new Error("Name and email are required");

  const specialtyId =
    input.speciality === undefined ? undefined : await clinicSpecialtyId(db, input.speciality);

  try {
    return await db.doctor.update({
      where: { id: input.id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        specialtyId,
        gender: input.gender,
        isActive: input.isActive,
      },
    });
  } catch (error) {
    console.error("Error updating doctor:", error);
    throw doctorError(error, "Failed to update doctor");
  }
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === "your_key_here") {
    console.warn("GOOGLE_MAPS_API_KEY is missing or invalid. Geocoding disabled.");
    if (location.includes("244715")) return { lat: 29.7891, lng: 78.5284 };
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        location
      )}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].geometry.location;
    }
    console.warn("Geocoding failed for location:", location, "Status:", data.status);
    return null;
  } catch (error) {
    console.error("Error calling Google Geocoding API:", error);
    return null;
  }
}

export async function getAvailableDoctors(params: DoctorSearch = {}) {
  try {
    const { userId } = await auth();
    const scope = await clinicBySlug(DEMO_CLINIC_SLUG);
    if (!scope) return [];
    return await findAvailableDoctors(scope.clinic.id, params, { includePhone: !!userId });
  } catch (error) {
    console.error("Error fetching available doctors:", error);
    throw new Error("Failed to fetch available doctors");
  }
}
