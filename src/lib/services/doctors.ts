import { type Gender, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface DoctorSearch {
  latitude?: number;
  longitude?: number;
  speciality?: string;
  radius?: number;
}

interface DoctorRow {
  id: string;
  name: string;
  speciality: string;
  bio: string | null;
  imageUrl: string;
  gender: Gender;
  clinicId: string | null;
  phone: string;
  clinicName: string | null;
  isPartner: boolean | null;
  distance: number | null;
}

export interface PublicDoctor {
  id: string;
  name: string;
  speciality: string;
  bio: string | null;
  imageUrl: string;
  gender: Gender;
  clinicId: string | null;
  clinicName: string | null;
  isPartner: boolean;
  distance: number | null;
  phone?: string;
}

// The only shape the public doctor list may return (spec 0002): never email,
// phone only for signed in callers.
export function toPublicDoctor(
  row: DoctorRow,
  includePhone: boolean,
): PublicDoctor {
  const doctor: PublicDoctor = {
    id: row.id,
    name: row.name,
    speciality: row.speciality,
    bio: row.bio,
    imageUrl: row.imageUrl,
    gender: row.gender,
    clinicId: row.clinicId,
    clinicName: row.clinicName ?? null,
    isPartner: row.isPartner ?? false,
    distance:
      row.distance == null ? null : Math.round(Number(row.distance) * 10) / 10,
  };
  if (includePhone) doctor.phone = row.phone;
  return doctor;
}

export async function findAvailableDoctors(
  { latitude, longitude, speciality, radius = 50 }: DoctorSearch,
  { includePhone }: { includePhone: boolean },
): Promise<PublicDoctor[]> {
  if (latitude != null && longitude != null) {
    const radiusInDegrees = radius / 111;
    // Bounding box first, exact distance in the outer query. LEAST guards acos
    // against float drift above 1 when the caller stands on the clinic.
    const rows = await prisma.$queryRaw<DoctorRow[]>`
      SELECT * FROM (
        SELECT d.id, d.name, d.speciality, d.bio, d."imageUrl", d.gender, d."clinicId", d.phone,
          c.name AS "clinicName", c."isPartner",
          (6371 * acos(LEAST(1.0, cos(radians(${latitude})) * cos(radians(c.latitude)) * cos(radians(c.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(c.latitude))))) AS distance
        FROM doctors d
        JOIN clinics c ON d."clinicId" = c.id
        WHERE c.latitude BETWEEN ${latitude - radiusInDegrees} AND ${latitude + radiusInDegrees}
          AND c.longitude BETWEEN ${longitude - radiusInDegrees} AND ${longitude + radiusInDegrees}
          ${speciality ? Prisma.sql`AND d.speciality ILIKE ${`%${speciality}%`}` : Prisma.empty}
          AND d."isActive" = true
      ) nearby
      WHERE distance < ${radius}
      ORDER BY distance ASC
    `;
    return rows.map((row) => toPublicDoctor(row, includePhone));
  }

  const doctors = await prisma.doctor.findMany({
    where: {
      isActive: true,
      ...(speciality && {
        speciality: { contains: speciality, mode: "insensitive" },
      }),
    },
    select: {
      id: true,
      name: true,
      speciality: true,
      bio: true,
      imageUrl: true,
      gender: true,
      clinicId: true,
      phone: true,
      clinic: { select: { name: true, isPartner: true } },
    },
    orderBy: { name: "asc" },
  });

  return doctors.map(({ clinic, ...d }) =>
    toPublicDoctor(
      {
        ...d,
        clinicName: clinic?.name ?? null,
        isPartner: clinic?.isPartner ?? false,
        distance: null,
      },
      includePhone,
    ),
  );
}
