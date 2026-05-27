import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { sendAppointmentConfirmationEmail } from "@/lib/services/email";
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

function transformAppointment(appointment: {
  id: string;
  userId: string;
  doctorId: string;
  date: Date;
  time: string;
  duration: number;
  status: string;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { firstName: string | null; lastName: string | null; email: string };
  doctor: { name: string; imageUrl: string };
}) {
  return {
    id: String(appointment.id),
    userId: String(appointment.userId),
    doctorId: String(appointment.doctorId),
    patientName: String(
      `${appointment.user.firstName || ""} ${appointment.user.lastName || ""}`.trim(),
    ),
    patientEmail: String(appointment.user.email || ""),
    doctorName: String(appointment.doctor.name || ""),
    doctorImageUrl: String(appointment.doctor.imageUrl || ""),
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

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    throw new Error("User record not found in database");
  }

  const appointmentDate = new Date(`${normalizedDate}T12:00:00.000Z`);

  try {
    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        doctorId: input.doctorId,
        date: appointmentDate,
        time: normalizedTime,
        reason: input.reason || "General consultation",
        status: "CONFIRMED",
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        doctor: { select: { id: true, name: true, imageUrl: true } },
      },
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

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      date: appointmentDate,
      status: { in: [...BLOCKING_STATUSES] },
    },
    select: { time: true },
  });

  return appointments.map((a) => a.time);
}
