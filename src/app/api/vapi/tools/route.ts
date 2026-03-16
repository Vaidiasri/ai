import { NextRequest, NextResponse } from "next/server";
import { getAvailableDoctors } from "@/lib/actions/doctors";
import { bookAppointment } from "@/lib/actions/appointments";
import { sendAppointmentConfirmationEmail } from "@/lib/services/email";
import { parseVapiDate, normalizeVapiTime } from "@/lib/utils/vapi-utils";

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
    console.log("FULL VAPI MESSAGE:", JSON.stringify(message, null, 2));
    console.log("VAPI HEADERS:", JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));

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
          console.log("[VAPI] Tool Called: get_doctors");
          const doctors = await getAvailableDoctors();
          result = doctors.map(d => ({
            id: d.id,
            name: d.name,
            speciality: d.speciality,
            phone: d.phone,
            isActive: d.isActive
          }));
          console.log(`[VAPI] Found ${doctors.length} doctors.`);
        } else if (name === "book_appointment") {
          console.log("[VAPI] Tool Called: book_appointment");
          
          // Hunt for userId in every possible location
          const userId = 
            message?.variableValues?.userId || 
            message?.metadata?.userId || 
            message?.customer?.metadata?.userId ||
            body?.metadata?.userId ||
            "";

          console.log(`[VAPI] Resolved userId: [${userId}] (Found via search)`);
          
          if (!userId) {
            console.warn("[VAPI] CRITICAL: No userId found in any payload location.");
            result = { 
              error: "Login required", 
              message: "system_error: userId_missing. Please ensure the user is logged in.",
              debug: { payload_keys: Object.keys(message || {}) }
            };
          } else {
            console.log("[VAPI] Raw Arguments:", JSON.stringify(args, null, 2));

            let doctorId = args.doctorId || args.doctor_id || args.doctor;
            
            // If doctorId looks like a name, try to find the ID
            if (doctorId && (typeof doctorId === 'string') && (doctorId.includes(" ") || !doctorId.includes("-"))) {
              console.log(`[VAPI] doctorId looks like a name: "${doctorId}". Attempting to resolve ID...`);
              const doctors = await getAvailableDoctors();
              const found = doctors.find(d => 
                d.name.toLowerCase().includes(doctorId.toLowerCase()) || 
                doctorId.toLowerCase().includes(d.name.toLowerCase())
              );
              if (found) {
                console.log(`[VAPI] Resolved "${doctorId}" to ID: ${found.id}`);
                doctorId = found.id;
              }
            }

            const rawDate = args.date || args.appointmentDate || args.day;
            const rawTime = args.time || args.appointmentTime || args.slot;
            
            const parsedDate = parseVapiDate(rawDate);
            const parsedTime = normalizeVapiTime(rawTime);

            console.log(`[VAPI] Normalized Input -> Date: ${parsedDate}, Time: ${parsedTime}`);

            const appointment = await bookAppointment({
              ...args,
              doctorId,
              date: parsedDate,
              time: parsedTime,
              reason: args.reason || "Voice assistant booking"
            }, userId);
            
            console.log(`[VAPI] Success! Appointment created: ${appointment.id}`);
            result = { success: true, appointmentId: appointment.id, message: "Appointment booked successfully" };
          }
        } else {
          result = { error: `Tool ${name} not found` };
        }
      } catch (err: any) {
        console.error(`Error executing ${name}:`, err);
        console.error(`Error Stack:`, err.stack);
        result = { error: err.message || "Failed to execute tool" };
      }

      results.push({
        toolCallId: id,
        result: typeof result === 'string' ? result : JSON.stringify(result)
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
