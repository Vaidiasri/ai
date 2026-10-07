// Allowlisted (spec 0003): a patient's own rows across every active clinic,
// filtered by the login on ClinicPatient. Suspended clinics are hidden.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APPOINTMENT_INCLUDE, transformAppointment } from "@/lib/services/appointment-booking";

const own = (clerkId: string): Prisma.AppointmentWhereInput => ({
  clinicPatient: { user: { clerkId } },
  clinic: { status: "ACTIVE" },
});

export async function appointmentsForUser(clerkId: string) {
  const appointments = await prisma.appointment.findMany({
    where: own(clerkId),
    include: { ...APPOINTMENT_INCLUDE, clinic: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  return appointments.map(transformAppointment);
}

export async function appointmentStatsForUser(clerkId: string) {
  const [totalAppointments, completedAppointments] = await Promise.all([
    prisma.appointment.count({ where: own(clerkId) }),
    prisma.appointment.count({ where: { ...own(clerkId), status: "COMPLETED" } }),
  ]);
  return { totalAppointments, completedAppointments };
}
