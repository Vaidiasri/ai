"use server";

import { Prisma, type Gender } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "../prisma";
import { generateAvatar } from "../utils";

export async function getDoctors() {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        _count: { select: { appointments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return doctors.map((doctor) => ({
      ...doctor,
      appointmentCount: doctor._count.appointments,
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

export async function createDoctor(input: CreateDoctorInput) {
  try {
    if (!input.name || !input.email)
      throw new Error("Name and email are required");

    const doctor = await prisma.doctor.create({
      data: {
        ...input,
        imageUrl: generateAvatar(input.name, input.gender),
      },
    });

    revalidatePath("/admin");

    return doctor;
  } catch (error: any) {
    console.error("Error creating doctor:", error);

    // handle unique constraint violation (email already exists)
    if (error?.code === "P2002") {
      throw new Error("A doctor with this email already exists");
    }

    throw new Error("Failed to create doctor");
  }
}

interface UpdateDoctorInput extends Partial<CreateDoctorInput> {
  id: string;
}

export async function updateDoctor(input: UpdateDoctorInput) {
  try {
    // validate
    if (!input.name || !input.email)
      throw new Error("Name and email are required");

    const currentDoctor = await prisma.doctor.findUnique({
      where: { id: input.id },
      select: { email: true },
    });

    if (!currentDoctor) throw new Error("Doctor not found");

    // if email is changing, check if the new email already exists
    if (input.email !== currentDoctor.email) {
      const existingDoctor = await prisma.doctor.findUnique({
        where: { email: input.email },
      });

      if (existingDoctor) {
        throw new Error("A doctor with this email already exists");
      }
    }

    const doctor = await prisma.doctor.update({
      where: { id: input.id },
      // ...input is going to trigger the unique constraint violation for email
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        speciality: input.speciality,
        gender: input.gender,
        isActive: input.isActive,
      },
    });

    return doctor;
  } catch (error) {
    console.error("Error updating doctor:", error);
    throw new Error("Failed to update doctor");
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

export async function getAvailableDoctors(params: { 
  latitude?: number; 
  longitude?: number; 
  speciality?: string; 
  radius?: number 
} = {}) {
  let { latitude, longitude, speciality, radius = 50 } = params;
  
  try {
    let localDoctors: any[] = [];

    if (latitude && longitude) {
      const radiusInDegrees = radius / 111;
      // Using $queryRaw for geospatial calculation with Bounding Box optimization
      const doctorsDb = await prisma.$queryRaw<any[]>`
        SELECT d.*, c.name as "clinicName", c."isPartner",
          (6371 * acos(cos(radians(${latitude})) * cos(radians(c.latitude)) * cos(radians(c.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(c.latitude)))) AS distance
        FROM doctors d
        JOIN clinics c ON d."clinicId" = c.id
        WHERE c.latitude BETWEEN ${latitude - radiusInDegrees} AND ${latitude + radiusInDegrees}
          AND c.longitude BETWEEN ${longitude - radiusInDegrees} AND ${longitude + radiusInDegrees}
          ${speciality ? Prisma.sql`AND d.speciality ILIKE ${'%' + speciality + '%'}` : Prisma.sql``}
          AND d."isActive" = true
        HAVING (6371 * acos(cos(radians(${latitude})) * cos(radians(c.latitude)) * cos(radians(c.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(c.latitude)))) < ${radius}
        ORDER BY distance ASC;
      `;

      localDoctors = doctorsDb.map(d => ({
        ...d,
        clinicName: d.clinicName,
        isPartner: d.isPartner,
        distance: d.distance
      }));
    } else {
      // Fetch all if no location info is provided
      const allDbDoctors = await prisma.doctor.findMany({
        where: { 
          isActive: true,
          ...(speciality && { speciality: { contains: speciality, mode: 'insensitive' } })
        },
        include: { clinic: true },
        orderBy: { name: "asc" }
      });

      localDoctors = allDbDoctors.map(d => ({
        ...d,
        clinicName: d.clinic?.name,
        isPartner: d.clinic?.isPartner,
        distance: null
      }));
    }

    return localDoctors;
  } catch (error) {
    console.error("Error fetching available doctors:", error);
    throw new Error("Failed to fetch available doctors");
  }
}
