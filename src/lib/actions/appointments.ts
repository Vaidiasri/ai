"use server";

import type { AppointmentStatus } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import {
  APPOINTMENT_INCLUDE,
  type BookAppointmentInput,
  createAppointmentForClerkUser,
  getBookedTimeSlotsForDoctor,
  transformAppointment,
} from "@/lib/services/appointment-booking";
import { appointmentStatsForUser, appointmentsForUser } from "@/lib/services/patient-self";
import { requireClinicMember } from "@/lib/tenancy";

export async function getAppointments() {
  try {
    const { db } = await requireClinicMember(["OWNER"]);

    const appointments = await db.appointment.findMany({
      include: APPOINTMENT_INCLUDE,
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

    return await appointmentsForUser(clerkId);
  } catch (error) {
    console.error("Error fetching user appointments:", error);
    throw new Error("Failed to fetch user appointments");
  }
}

export async function getUserAppointmentStats() {
  try {
    const clerkId = await requireAuth();

    return await appointmentStatsForUser(clerkId);
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
    const { db } = await requireClinicMember(["OWNER"]);

    const appointment = await db.appointment.update({
      where: { id: input.id },
      data: { status: input.status },
      include: APPOINTMENT_INCLUDE,
    });

    return transformAppointment(appointment);
  } catch (error) {
    console.error("Error updating status:", error);
    throw new Error("Failed to update status");
  }
}
