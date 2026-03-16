import { NextRequest, NextResponse } from "next/server";
import { getAvailableDoctors } from "@/lib/actions/doctors";
import { bookAppointment } from "@/lib/actions/appointments";

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

    if (!rawBody) {
      console.log("Empty body received");
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    // The original message?.type check is now integrated into the new tool call extraction
    const { toolCalls, toolCallList } = message || {};
    const calls = toolCalls || toolCallList || [];

    console.log("Extracted Tool Calls:", JSON.stringify(calls, null, 2));

    const results = [];

    for (const toolCall of calls) {
      const { name, args, id } = toolCall.function; // Keep 'id' from original structure
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
          
          const appointment = await bookAppointment({
            doctorId: args.doctorId,
            date: args.date, // Pass as string, action handles conversion
            time: args.time,
            reason: args.reason || "Voice assistant booking"
          }, userId);
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
