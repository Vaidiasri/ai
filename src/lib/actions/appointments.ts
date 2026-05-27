"use server";

import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAdmin, requireAuth } from "@/lib/auth";
import {
  createAppointmentForClerkUser,
  getBookedTimeSlotsForDoctor,
  type BookAppointmentInput,
} from "@/lib/services/appointment-booking";
import { formatStoredAppointmentDate } from "@/lib/utils/time";

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

export async function getAppointments() {
  try {
    await requireAdmin();

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
    const clerkId = await requireAuth();

    const user = await prisma.user.findUnique({ where: { clerkId } });
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
    const clerkId = await requireAuth();

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return { totalAppointments: 0, completedAppointments: 0 };

    const [totalCount, completedCount] = await Promise.all([
      prisma.appointment.count({ where: { userId: user.id } }),
      prisma.appointment.count({
        where: { userId: user.id, status: "COMPLETED" },
      }),
    ]);

    return { totalAppointments: totalCount, completedAppointments: completedCount };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return { totalAppointments: 0, completedAppointments: 0 };
  }
}

export async function getBookedTimeSlots(doctorId: string, date: string) {
  try {
    await requireAuth();
    return getBookedTimeSlotsForDoctor(doctorId, date);
  } catch (error) {
    console.error("Error fetching slots:", error);
    return [];
  }
}

export async function bookAppointment(input: BookAppointmentInput) {
  try {
    const clerkId = await requireAuth();
    return await createAppointmentForClerkUser(clerkId, input);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred while booking";
    console.error("[APPOINTMENTS_ACTION] Error in bookAppointment:", error);
    throw new Error(message);
  }
}

export async function updateAppointmentStatus(input: {
  id: string;
  status: AppointmentStatus;
}) {
  try {
    await requireAdmin();

    const appointment = await prisma.appointment.update({
      where: { id: input.id },
      data: { status: input.status },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        doctor: { select: { name: true, imageUrl: true } },
      },
    });

    return transformAppointment(appointment);
  } catch (error) {
    console.error("Error updating status:", error);
    throw new Error("Failed to update status");
  }
}
