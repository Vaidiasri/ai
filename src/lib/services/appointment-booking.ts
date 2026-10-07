import { format } from "date-fns";
import { sendAppointmentConfirmationEmail } from "@/lib/services/email";
import { clinicBySlug, DEMO_CLINIC_SLUG, getOrCreateClinicPatient } from "@/lib/tenancy";
import {
  formatStoredAppointmentDate,
  formatTimeForDisplay,
  parseAppointmentDate,
  toCanonicalTime,
} from "@/lib/utils/time";

export interface BookAppointmentInput {
  doctorId: string;
  date: string;
  time: string;
  reason?: string;
}

// Shared include and output shape for every appointment read (spec 0003:
// patient name from ClinicPatient, email only when linked to a login).
export const APPOINTMENT_INCLUDE = {
  clinicPatient: { select: { name: true, user: { select: { email: true } } } },
  doctor: { select: { name: true, imageUrl: true } },
} as const;

export function transformAppointment(appointment: {
  id: string;
  clinicPatientId: string;
  doctorId: string;
  date: Date;
  time: string;
  duration: number;
  status: string;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  clinicPatient: { name: string; user: { email: string } | null };
  doctor: { name: string; imageUrl: string };
  clinic?: { name: string };
}) {
  return {
    id: String(appointment.id),
    clinicPatientId: String(appointment.clinicPatientId),
    doctorId: String(appointment.doctorId),
    patientName: appointment.clinicPatient.name,
    patientEmail: appointment.clinicPatient.user?.email ?? "",
    doctorName: String(appointment.doctor.name || ""),
    doctorImageUrl: String(appointment.doctor.imageUrl || ""),
    clinicName: appointment.clinic?.name ?? "",
    date: formatStoredAppointmentDate(appointment.date),
    time: String(appointment.time),
    duration: Number(appointment.duration),
    status: String(appointment.status),
    reason: String(appointment.reason || "General consultation"),
    notes: String(appointment.notes || ""),
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}

export const CLINIC_UNAVAILABLE = "This clinic is not available right now.";

// Interim pin until Feature 10 adds /c/<slug>: every patient path books Demo.
export async function demoClinic() {
  const scope = await clinicBySlug(DEMO_CLINIC_SLUG);
  if (!scope) throw new Error(CLINIC_UNAVAILABLE);
  return scope;
}

const BLOCKING_STATUSES = ["CONFIRMED", "COMPLETED", "PENDING"] as const;

/**
 * Core booking logic — only call from authenticated server actions
 * or the Vapi webhook after secret verification.
 */
export async function createAppointmentForClerkUser(
  clerkId: string,
  input: BookAppointmentInput,
) {
  if (!clerkId?.startsWith("user_")) {
    throw new Error("Invalid user identity");
  }

  if (!input.doctorId || !input.date || !input.time) {
    throw new Error("Missing required fields: doctorId, date, or time");
  }

  const normalizedDate = parseAppointmentDate(input.date);
  const normalizedTime = toCanonicalTime(input.time);

  const { clinic, db } = await demoClinic();
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) {
    throw new Error("User record not found in database");
  }
  const doctor = await db.doctor.findUnique({
    where: { id: input.doctorId },
    select: { branchId: true },
  });
  if (!doctor) {
    throw new Error("Doctor not found");
  }
  const patient = await getOrCreateClinicPatient(db, clinic.id, user);

  const appointmentDate = new Date(`${normalizedDate}T12:00:00.000Z`);

  try {
    const appointment = await db.appointment.create({
      data: {
        clinicId: clinic.id,
        branchId: doctor.branchId,
        clinicPatientId: patient.id,
        doctorId: input.doctorId,
        date: appointmentDate,
        time: normalizedTime,
        reason: input.reason || "General consultation",
        status: "CONFIRMED",
      },
      include: APPOINTMENT_INCLUDE,
    });

    const result = transformAppointment(appointment);

    if (result.patientEmail) {
      const formattedDateForEmail = format(
        new Date(`${result.date}T12:00:00.000Z`),
        "EEEE, MMMM d, yyyy",
      );

      sendAppointmentConfirmationEmail({
        userEmail: result.patientEmail,
        doctorName: result.doctorName,
        appointmentDate: formattedDateForEmail,
        appointmentTime: formatTimeForDisplay(result.time),
        appointmentType: result.reason,
      }).catch((err) =>
        console.error("[APPOINTMENT_BOOKING] Email failed:", err),
      );
    }

    return result;
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002") {
      throw new Error("This time slot is already booked for this doctor.");
    }
    throw error;
  }
}

export async function getBookedTimeSlotsForDoctor(doctorId: string, date: string) {
  const normalizedDate = parseAppointmentDate(date);
  const appointmentDate = new Date(`${normalizedDate}T12:00:00.000Z`);

  const scope = await clinicBySlug(DEMO_CLINIC_SLUG);
  if (!scope) return [];
  const appointments = await scope.db.appointment.findMany({
    where: {
      doctorId,
      date: appointmentDate,
      status: { in: [...BLOCKING_STATUSES] },
    },
    select: { time: true },
  });

  return appointments.map((a) => a.time);
}
