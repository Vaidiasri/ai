// Spec 0004: the agent's booking tools. Clinic, user and session come from the
// session row and the Clerk caller, never from model output.
import { tool } from "ai";
import { z } from "zod";
import {
  CLINIC_UNAVAILABLE,
  createAppointmentForClerkUser,
  getBookedTimeSlotsForDoctor,
} from "@/lib/services/appointment-booking";
import { findAvailableDoctors } from "@/lib/services/doctors";
import type { ClinicDb } from "@/lib/tenancy";
import { getAvailableTimeSlots, getNext5Days } from "@/lib/utils";
import { formatStoredAppointmentDate } from "@/lib/utils/time";

export type ToolScope = {
  clinicId: string;
  db: ClinicDb;
  clerkId: string;
  sessionId: string;
};

const SLOT_TAKEN = "This time slot is already booked for this doctor.";

const DoctorDay = z.object({
  doctorId: z.string().min(1).max(100),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("YYYY-MM-DD, one of the bookable dates"),
});

export function buildTools({ clinicId, db, clerkId, sessionId }: ToolScope) {
  // ponytail: per request lock; parallel tool calls in one step run in turn,
  // so the appointmentId read and the booking are one critical section. Lock
  // the session row (SELECT ... FOR UPDATE) if one session ever sends chat
  // requests at the same time (the client never does).
  let chain: Promise<unknown> = Promise.resolve();

  function run<I, R>(name: string, fn: (input: I) => Promise<R>) {
    return (input: I) => {
      const next = chain.then(async () => {
        await db.agentSession.updateMany({
          where: { id: sessionId },
          data: { toolCallCount: { increment: 1 } },
        });
        try {
          return await fn(input);
        } catch (e) {
          const message = e instanceof Error ? e.message : "";
          if (message === SLOT_TAKEN)
            return { error: "that time was just taken" };
          if (message === CLINIC_UNAVAILABLE) return { error: message };
          console.error("[agent] tool error", { sessionId, event: name });
          return { error: "booking failed, please use the booking form" };
        }
      });
      chain = next.catch(() => {});
      return next;
    };
  }

  const activeDoctor = (id: string) =>
    db.doctor.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });

  return {
    list_doctors: tool({
      description:
        "List this clinic's doctors, optionally filtered by specialty.",
      inputSchema: z.object({ specialty: z.string().max(100).optional() }),
      execute: run("list_doctors", async ({ specialty }) => {
        const doctors = await findAvailableDoctors(
          clinicId,
          { speciality: specialty },
          { includePhone: false },
        );
        return doctors
          .slice(0, 10)
          .map(({ id, name, speciality, branchName }) => ({
            id,
            name,
            speciality,
            branchName,
          }));
      }),
    }),

    get_free_slots: tool({
      description: "Free HH:mm times for one doctor on one bookable date.",
      inputSchema: DoctorDay,
      execute: run("get_free_slots", async ({ doctorId, date }) => {
        if (!(await activeDoctor(doctorId)))
          return { error: "doctor not found" };
        if (!getNext5Days().includes(date))
          return { error: "date not bookable" };
        const booked = new Set(
          await getBookedTimeSlotsForDoctor(doctorId, date, clinicId),
        );
        return getAvailableTimeSlots().filter((t) => !booked.has(t));
      }),
    }),

    book_appointment: tool({
      description:
        "Book one appointment for the patient. Only after they confirm doctor, date and time.",
      inputSchema: DoctorDay.extend({
        time: z
          .string()
          .regex(/^\d{2}:\d{2}$/)
          .describe("HH:mm from get_free_slots"),
        reason: z.string().max(200).optional(),
      }),
      execute: run("book_appointment", async (input) => {
        if (!(await activeDoctor(input.doctorId)))
          return { error: "doctor not found" };
        // Same grid the slot tool offers, so the model cannot book off it.
        if (!getNext5Days().includes(input.date))
          return { error: "date not bookable" };
        if (!getAvailableTimeSlots().includes(input.time))
          return { error: "time not bookable" };

        const session = await db.agentSession.findUnique({
          where: { id: sessionId },
          select: {
            appointment: {
              select: {
                date: true,
                time: true,
                doctor: { select: { name: true } },
              },
            },
          },
        });
        const prior = session?.appointment;
        if (prior)
          return {
            error: "already booked",
            booking: {
              doctorName: prior.doctor.name,
              date: formatStoredAppointmentDate(prior.date),
              time: prior.time,
            },
          };

        const booked = await createAppointmentForClerkUser(
          clerkId,
          input,
          clinicId,
        );
        const { count } = await db.agentSession.updateMany({
          where: { id: sessionId, appointmentId: null },
          data: { appointmentId: booked.id },
        });
        if (!count) return { error: "already booked" };
        return {
          doctorName: booked.doctorName,
          date: booked.date,
          time: booked.time,
        };
      }),
    }),
  };
}
