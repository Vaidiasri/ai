import { NextRequest, NextResponse } from "next/server";
import { getAvailableDoctors } from "@/lib/actions/doctors";
import { bookAppointment } from "@/lib/actions/appointments";
import { sendAppointmentConfirmationEmail } from "@/lib/services/email";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("Failed to parse Vapi request body as JSON:", rawBody);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Vapi sends tool calls in a specific format
    const { message } = body;
    
    console.log("------------------- VAPI REQUEST START -------------------");
    if (process.env.NODE_ENV === 'development') {
      console.log("Raw Body:", rawBody);
    }

    // Explicitly handle ping requests from Vapi dashboard validation
    if (message?.type === "ping") {
      console.log("Ping received, responding with 200 OK");
      return NextResponse.json({ message: "Pong", results: [] });
    }

    if (!rawBody) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    const { toolCalls, toolCallList, toolWithToolCallList } = message || {};
    const calls = toolCalls || toolCallList || toolWithToolCallList || [];

    const results = [];

    for (const toolCall of calls) {
      const id = toolCall.id || toolCall.function?.id;
      const { name, arguments: argsJson, args: fallbackArgs } = toolCall.function || {}; 
      
      let args = fallbackArgs || {};
      if (typeof argsJson === 'string') {
        try { args = JSON.parse(argsJson); } catch (e) { }
      } else if (argsJson) {
        args = argsJson;
      }

      console.log(`Executing tool: ${name} with args:`, args);

      let result;
      try {
        if (name === "get_doctors") {
          const doctors = await getAvailableDoctors();
          result = doctors.map(d => ({
            id: d.id,
            name: d.name,
            speciality: d.speciality,
            phone: d.phone,
            isActive: d.isActive
          }));
        } else if (name === "book_appointment") {
          const userId = message?.variableValues?.userId || "";
          
          if (!userId) {
            console.warn("No userId provided in Vapi variableValues.");
          }

          const appointment = await bookAppointment({
            ...args,
            date: args.date,
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

    const response = NextResponse.json({
      message: "Tool executed",
      results: results
    });

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
      results: []
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "healthy", 
    time: new Date().toISOString(),
    message: "Vapi Tools Bridge is active"
  });
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Bypass-Tunnel-Reminder, Authorization");
  return response;
}
