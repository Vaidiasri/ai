import { type Gender, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forClinic } from "@/lib/tenancy";

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
  clinicId: string;
  phone: string;
  clinicName: string;
  branchName: string;
  distance: number | null;
}

export interface PublicDoctor {
  id: string;
  name: string;
  speciality: string;
  bio: string | null;
  imageUrl: string;
  gender: Gender;
  clinicId: string;
  clinicName: string;
  branchName: string;
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
    clinicName: row.clinicName,
    branchName: row.branchName,
    distance:
      row.distance == null ? null : Math.round(Number(row.distance) * 10) / 10,
  };
  if (includePhone) doctor.phone = row.phone;
  return doctor;
}

// clinicId must come from clinicBySlug, so a suspended clinic never gets here.
export async function findAvailableDoctors(
  clinicId: string,
  { latitude, longitude, speciality, radius = 50 }: DoctorSearch,
  { includePhone }: { includePhone: boolean },
): Promise<PublicDoctor[]> {
  if (latitude != null && longitude != null) {
    const radiusInDegrees = radius / 111;
    // Allowlisted raw query: filters d."clinicId" itself (spec 0003). Bounding
    // box first, exact distance in the outer query. LEAST guards acos against
    // float drift above 1 when the caller stands on the branch.
    const rows = await prisma.$queryRaw<DoctorRow[]>`
      SELECT * FROM (
        SELECT d.id, d.name, s.name AS speciality, d.bio, d."imageUrl", d.gender, d."clinicId", d.phone,
          c.name AS "clinicName", b.name AS "branchName",
          (6371 * acos(LEAST(1.0, cos(radians(${latitude})) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(b.latitude))))) AS distance
        FROM doctors d
        JOIN branches b ON b.id = d."branchId" AND b."clinicId" = d."clinicId"
        JOIN clinics c ON c.id = d."clinicId"
        JOIN specialties s ON s.id = d."specialtyId"
        WHERE d."clinicId" = ${clinicId}
          AND c.status = 'ACTIVE'
          AND b.latitude BETWEEN ${latitude - radiusInDegrees} AND ${latitude + radiusInDegrees}
          AND b.longitude BETWEEN ${longitude - radiusInDegrees} AND ${longitude + radiusInDegrees}
          ${speciality ? Prisma.sql`AND s.name ILIKE ${`%${speciality}%`}` : Prisma.empty}
          AND d."isActive" = true
      ) nearby
      WHERE distance < ${radius}
      ORDER BY distance ASC
    `;
    return rows.map((row) => toPublicDoctor(row, includePhone));
  }

  const doctors = await forClinic(clinicId).doctor.findMany({
    where: {
      isActive: true,
      ...(speciality && {
        specialty: { name: { contains: speciality, mode: "insensitive" } },
      }),
    },
    select: {
      id: true,
      name: true,
      bio: true,
      imageUrl: true,
      gender: true,
      clinicId: true,
      phone: true,
      specialty: { select: { name: true } },
      clinic: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return doctors.map(({ specialty, clinic, branch, ...d }) =>
    toPublicDoctor(
      {
        ...d,
        speciality: specialty.name,
        clinicName: clinic.name,
        branchName: branch.name,
        distance: null,
      },
      includePhone,
    ),
  );
}
