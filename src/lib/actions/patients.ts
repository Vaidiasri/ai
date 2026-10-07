"use server";

import { requireClinicMember } from "@/lib/tenancy";

// Spec 0003 AC-6: a login is linked to a patient record only by staff, never
// automatically. No UI yet (staff screens are Features 8 and 18).
export async function linkPatientToUser(input: { clinicPatientId: string; userId: string }) {
  const { db } = await requireClinicMember(["OWNER", "RECEPTIONIST"]);

  const patient = await db.clinicPatient.findUnique({
    where: { id: input.clinicPatientId },
    select: { userId: true },
  });
  if (!patient) throw new Error("Patient not found in this clinic");
  if (patient.userId && patient.userId !== input.userId) {
    throw new Error("This patient is already linked to another login");
  }

  try {
    return await db.clinicPatient.update({
      where: { id: input.clinicPatientId },
      data: { userId: input.userId },
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") throw new Error("This user is already linked to a patient here");
    if (code === "P2003") throw new Error("User not found");
    throw error;
  }
}
