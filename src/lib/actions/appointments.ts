"use server";

import { auth } from "@clerk/nextjs/server";
import type { AppointmentStatus } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "../prisma";
import { sendAppointmentConfirmationEmail } from "../services/email";
import { parseVapiDate, normalizeVapiTime } from "../utils/vapi-utils";

/**
 * Transforms a Prisma appointment into a flat, serializable object.
 * Next.js 15 Server Actions MUST return serializable data.
 */
function transformAppointment(appointment: any) {
  return {
    id: String(appointment.id),
    userId: String(appointment.userId),
    doctorId: String(appointment.doctorId),
    patientName: String(`${appointment.user.firstName || ""} ${appointment.user.lastName || ""}`.trim()),
    patientEmail: String(appointment.user.email || ""),
    doctorName: String(appointment.doctor.name || ""),
    doctorImageUrl: String(appointment.doctor.imageUrl || ""),
    date: appointment.date.toISOString().split("T")[0],
    time: String(appointment.time),
    duration: Number(appointment.duration),
    status: String(appointment.status),
    reason: String(appointment.reason || "General consultation"),
    notes: String(appointment.notes || ""),
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}

export async function getAppointments() {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        doctor: { select: { name: true, imageUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return appointments.map(transformAppointment);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    throw new Error("Failed to fetch appointments");
  }
}

export async function getUserAppointments() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("You must be logged in to view appointments");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return [];

    const appointments = await prisma.appointment.findMany({
      where: { userId: user.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        doctor: { select: { name: true, imageUrl: true } },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });

    return appointments.map(transformAppointment);
  } catch (error) {
    console.error("Error fetching user appointments:", error);
    throw new Error("Failed to fetch user appointments");
  }
}

export async function getUserAppointmentStats() {
  try {
    const { userId } = await auth();
    if (!userId) return { totalAppointments: 0, completedAppointments: 0 };

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return { totalAppointments: 0, completedAppointments: 0 };

    const [totalCount, completedCount] = await Promise.all([
      prisma.appointment.count({ where: { userId: user.id } }),
      prisma.appointment.count({ where: { userId: user.id, status: "COMPLETED" } }),
    ]);

    return { totalAppointments: totalCount, completedAppointments: completedCount };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return { totalAppointments: 0, completedAppointments: 0 };
  }
}

export async function getBookedTimeSlots(doctorId: string, date: string) {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        date: new Date(date),
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
      select: { time: true },
    });
    return appointments.map((a) => a.time);
  } catch (error) {
    console.error("Error fetching slots:", error);
    return [];
  }
}

interface BookAppointmentInput {
  doctorId: string;
  date: string;
  time: string;
  reason?: string;
}

export async function bookAppointment(input: BookAppointmentInput, overrideUserId?: string) {
  try {
    let finalUserId: string | null = null;
    
    if (overrideUserId) {
      finalUserId = overrideUserId;
    } else {
      const { userId } = await auth();
      finalUserId = userId;
    }

    if (!finalUserId) throw new Error("Authentication required");

    if (!input.doctorId || !input.date || !input.time) {
      throw new Error("Missing required fields: doctorId, date, or time");
    }

    const normalizedDate = parseVapiDate(input.date);
    const normalizedTime = normalizeVapiTime(input.time);

    const user = await prisma.user.findUnique({ where: { clerkId: finalUserId } });
    if (!user) throw new Error("User record not found in database");

    // --- DUPLICATE CHECK ---
    const existing = await prisma.appointment.findFirst({
      where: {
        doctorId: input.doctorId,
        date: new Date(normalizedDate),
        time: normalizedTime,
        status: "CONFIRMED"
      }
    });

    if (existing) {
      throw new Error("This time slot is already booked for this doctor.");
    }

    // --- CREATE ---
    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        doctorId: input.doctorId,
        date: new Date(normalizedDate),
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

    // --- EMAIL (Silent failure) ---
    if (result.patientEmail) {
      // Professional formatting for email: e.g. "Friday, March 20, 2026"
      const formattedDateForEmail = format(new Date(result.date), "EEEE, MMMM d, yyyy");
      
      sendAppointmentConfirmationEmail({
        userEmail: result.patientEmail,
        doctorName: result.doctorName,
        appointmentDate: formattedDateForEmail,
        appointmentTime: result.time,
        appointmentType: result.reason
      }).catch(err => console.error("[APPOINTMENTS_ACTION] Email failed:", err));
    }

    return result;
  } catch (error: any) {
    console.error("[APPOINTMENTS_ACTION] Error in bookAppointment:", error);
    throw new Error(error.message || "An unexpected error occurred while booking");
  }
}

export async function updateAppointmentStatus(input: { id: string; status: AppointmentStatus }) {
  try {
    return await prisma.appointment.update({
      where: { id: input.id },
      data: { status: input.status },
    });
  } catch (error) {
    console.error("Error updating status:", error);
    throw new Error("Failed to update status");
  }
}
