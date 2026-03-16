import { NextRequest, NextResponse } from "next/server";
import { getAvailableDoctors } from "@/lib/actions/doctors";
import { bookAppointment } from "@/lib/actions/appointments";
import { sendAppointmentConfirmationEmail } from "@/lib/services/email";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    console.log("Vapi Raw Request Body:", rawBody);
    
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("Failed to parse Vapi request body as JSON:", rawBody);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Vapi sends tool calls in a specific format
    const { message } = body;
    
    // New logging and tool call extraction logic
    console.log("------------------- VAPI REQUEST START -------------------");
    console.log("Headers:", JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
    console.log("Raw Body:", rawBody); // Use rawBody which was already read

    // Explicitly handle ping requests from Vapi dashboard validation
    if (message?.type === "ping") {
      console.log("Ping received, responding with 200 OK");
      return NextResponse.json({ message: "Pong", results: [] });
    }

    if (!rawBody) {
      console.log("Empty body received");
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    // The original message?.type check is now integrated into the new tool call extraction
    const { toolCalls, toolCallList, toolWithToolCallList } = message || {};
    const calls = toolCalls || toolCallList || toolWithToolCallList || [];

    console.log("Extracted Tool Calls:", JSON.stringify(calls, null, 2));

    const results = [];

    for (const toolCall of calls) {
      // Vapi sometimes puts `id` at the root of `toolCall` instead of inside `function`
      const id = toolCall.id || toolCall.function?.id;
      const { name, arguments: argsJson, args: fallbackArgs } = toolCall.function || {}; 
      
      // Parse arguments if they are a string, otherwise use raw args
      let args = fallbackArgs || {};
      if (typeof argsJson === 'string') {
        try { args = JSON.parse(argsJson); } catch (e) { }
      } else if (argsJson) {
        args = argsJson;
      }

      console.log(`Executing tool: ${name} with args:`, args);

      let result; // Declare result here to be used in the push
      try {
        if (name === "get_doctors") {
          const doctors = await getAvailableDoctors();
          console.log(`Found ${doctors.length} doctors`);
          result = doctors.map(d => ({
            id: d.id,
            name: d.name,
            speciality: d.speciality,
            phone: d.phone,
            isActive: d.isActive
          }));
        } else if (name === "book_appointment") {
          // Extract userId from Vapi variableValues if available
          const userId = message?.variableValues?.userId || "";
          console.log("Booking appointment with userId:", userId);
          
          if (!userId) {
            console.warn("No userId provided in Vapi variableValues. This booking may fail if not handled by standard Auth.");
          }

          const appointment = await bookAppointment({
            ...args,
            date: args.date, // Pass as string, action handles conversion
            reason: args.reason || "Voice assistant booking"
          }, userId);
          
          // Trigger email notification
          if (appointment.patientEmail) {
            console.log(`Sending confirmation email to ${appointment.patientEmail}`);
            sendAppointmentConfirmationEmail({
              userEmail: appointment.patientEmail,
              doctorName: appointment.doctorName,
              appointmentDate: appointment.date,
              appointmentTime: appointment.time,
              appointmentType: appointment.reason
            }).catch(err => console.error("Failed to send Vapi confirmation email:", err));
          }

          result = { success: true, appointmentId: appointment.id, message: "Appointment booked successfully" };
        } else {
          result = { error: `Tool ${name} not found` };
        }
      } catch (err: any) {
        console.error(`Error executing ${name}:`, err);
        result = { error: err.message || "Failed to execute tool" };
      }

      results.push({
        toolCallId: id,
        result: JSON.stringify(result)
      });
    }

    console.log("Vapi sending response:", JSON.stringify({ results }, null, 2));
    const response = NextResponse.json({
      message: "Tool executed",
      results: results
    });

    // Add headers to bypass localtunnel reminder and allow Vapi
    response.headers.set("Bypass-Tunnel-Reminder", "true");
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Bypass-Tunnel-Reminder, Authorization");

    return response;
  } catch (error: any) {
    console.error("Vapi Tool API Error:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error.message,
      results: [] // Vapi expects a results array even on error sometimes
    }, { status: 500 });
  }
}

// Add GET handler for easy health checks
export async function GET() {
  return NextResponse.json({ 
    status: "healthy", 
    time: new Date().toISOString(),
    message: "Vapi Tools Bridge is active"
  });
}

// Add OPTIONS handler for CORS preflight
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Bypass-Tunnel-Reminder, Authorization");
  return response;
}
