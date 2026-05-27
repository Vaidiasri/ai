import { NextRequest, NextResponse } from "next/server";
import { verifyVapiWebhookSecret } from "@/lib/auth";
import { getAvailableDoctors } from "@/lib/actions/doctors";
import { createAppointmentForClerkUser } from "@/lib/services/appointment-booking";
import { parseAppointmentDate, toCanonicalTime } from "@/lib/utils/time";
import { prisma } from "@/lib/prisma";

function corsHeaders() {
  return {
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-vapi-secret",
  };
}

function resolveClerkUserId(message: Record<string, unknown> | undefined): string | null {
  const variableValues = message?.variableValues as Record<string, unknown> | undefined;
  const metadata = message?.metadata as Record<string, unknown> | undefined;
  const customer = message?.customer as { metadata?: Record<string, unknown> } | undefined;

  const candidates = [
    variableValues?.userId,
    metadata?.userId,
    customer?.metadata?.userId,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.startsWith("user_")) {
      return value;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const message = body.message as Record<string, unknown> | undefined;

    if (message?.type === "ping") {
      return NextResponse.json({ message: "Pong", results: [] });
    }

    if (!verifyVapiWebhookSecret(req)) {
      return NextResponse.json(
        { error: "Unauthorized", results: [] },
        { status: 401 },
      );
    }

    const toolCalls = (message?.toolCalls ||
      message?.toolCallList ||
      message?.toolWithToolCallList ||
      []) as Array<{
      id?: string;
      function?: {
        id?: string;
        name?: string;
        arguments?: string | Record<string, unknown>;
        args?: Record<string, unknown>;
      };
    }>;

    const results: { toolCallId: string | undefined; result: string }[] = [];

    for (const toolCall of toolCalls) {
      const id = toolCall.id || toolCall.function?.id;
      const name = toolCall.function?.name;
      const argsJson = toolCall.function?.arguments;
      const fallbackArgs = toolCall.function?.args;

      let args: Record<string, unknown> = fallbackArgs || {};
      if (typeof argsJson === "string") {
        try {
          args = JSON.parse(argsJson) as Record<string, unknown>;
        } catch {
          args = {};
        }
      } else if (argsJson && typeof argsJson === "object") {
        args = argsJson as Record<string, unknown>;
      }

      let result: string;

      try {
        if (name === "get_doctors") {
          const doctors = await getAvailableDoctors({
            latitude: args.latitude != null ? Number(args.latitude) : undefined,
            longitude: args.longitude != null ? Number(args.longitude) : undefined,
            speciality: typeof args.speciality === "string" ? args.speciality : undefined,
          });

          if (doctors.length > 0) {
            const docs = doctors
              .map(
                (d) =>
                  `${d.name} (${d.speciality}) at ${d.clinicName}${d.distance ? ` - Distance: ${d.distance}` : ""}`,
              )
              .join(" | ");
            result = `Found these local clinics: ${docs}`;
          } else {
            result = "No matching doctors found in our database currently.";
          }
        } else if (name === "get_current_user") {
          const userId = resolveClerkUserId(message);

          if (userId) {
            const user = await prisma.user.findUnique({ where: { clerkId: userId } });
            result = JSON.stringify({
              userId,
              name: user
                ? `${user.firstName} ${user.lastName}`.trim()
                : "Unknown (not in DB)",
              isLoggedIn: true,
            });
          } else {
            result = JSON.stringify({
              userId: null,
              isLoggedIn: false,
              error: "No userId in call metadata. User must be logged in on the voice page.",
            });
          }
        } else if (name === "book_appointment") {
          const userId = resolveClerkUserId(message);

          if (!userId) {
            result = JSON.stringify({
              error: "Login required",
              message: "Please refresh the page and ensure you are logged in.",
            });
          } else {
            let doctorId = String(
              args.doctorId || args.doctor_id || args.doctor || "",
            );

            if (
              doctorId &&
              (doctorId.includes(" ") || !doctorId.includes("-"))
            ) {
              const doctors = await getAvailableDoctors();
              const found = doctors.find(
                (d) =>
                  d.name.toLowerCase().includes(doctorId.toLowerCase()) ||
                  doctorId.toLowerCase().includes(d.name.toLowerCase()),
              );
              if (found) doctorId = found.id;
            }

            const rawDate = String(
              args.date || args.appointmentDate || args.day || "",
            );
            const rawTime = String(
              args.time || args.appointmentTime || args.slot || "",
            );

            const appointment = await createAppointmentForClerkUser(userId, {
              doctorId,
              date: parseAppointmentDate(rawDate),
              time: toCanonicalTime(rawTime),
              reason:
                typeof args.type === "string"
                  ? `${args.type} Appointment${args.reason ? ` - ${args.reason}` : ""}`
                  : typeof args.reason === "string"
                    ? args.reason
                    : "Voice assistant booking",
            });

            result = `Success! Appointment booked successfully. Appointment ID: ${appointment.id}`;
          }
        } else {
          result = `Error: Tool ${name} not found`;
        }
      } catch (err: unknown) {
        const messageText =
          err instanceof Error ? err.message : "Failed to execute tool";
        result = JSON.stringify({ error: messageText });
      }

      results.push({
        toolCallId: id,
        result,
      });
    }

    const response = NextResponse.json({ results });
    Object.entries(corsHeaders()).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error("Vapi Tool API Error:", error);
    return NextResponse.json(
      { error: "Internal server error", results: [] },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    time: new Date().toISOString(),
  });
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
