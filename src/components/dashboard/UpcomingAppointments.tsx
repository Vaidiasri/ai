import { format, isAfter, isSameDay, parseISO } from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { getUserAppointments } from "@/lib/actions/appointments";
import { formatTimeForDisplay } from "@/lib/utils/time";

async function UpcomingAppointments() {
  const appointments = await getUserAppointments();
  const today = new Date();
  const upcoming = appointments.filter((appointment) => {
    const date = parseISO(appointment.date);
    return (
      appointment.status === "CONFIRMED" && (isSameDay(date, today) || isAfter(date, today))
    );
  });

  if (upcoming.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Your Upcoming Appointments</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {upcoming.map((appointment) => (
          <div key={appointment.id} className="bg-card border rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <img
                src={appointment.doctorImageUrl}
                alt={appointment.doctorName}
                className="size-10 rounded-full"
              />
              <div>
                <p className="font-medium text-sm">{appointment.doctorName}</p>
                <p className="text-muted-foreground text-xs">{appointment.reason}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <CalendarIcon className="size-4" />
                {format(parseISO(appointment.date), "MMM d, yyyy")}
              </p>
              <p className="flex items-center gap-2">
                <ClockIcon className="size-4" />
                {formatTimeForDisplay(appointment.time)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default UpcomingAppointments;
