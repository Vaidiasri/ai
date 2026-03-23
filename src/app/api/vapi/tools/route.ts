import { NextRequest, NextResponse } from "next/server";
import { getAvailableDoctors } from "@/lib/actions/doctors";
import { bookAppointment } from "@/lib/actions/appointments";
import { sendAppointmentConfirmationEmail } from "@/lib/services/email";
import { parseVapiDate, normalizeVapiTime } from "@/lib/utils/vapi-utils";
import { prisma } from "@/lib/prisma";

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
          const { latitude, longitude, speciality, location } = args;
          console.log("[VAPI] get_doctors args:", { latitude, longitude, speciality, location });
          
          try {
            // If a location string is provided, search Google Places for REAL doctors
            if (location) {
              const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
              if (GOOGLE_KEY) {
                const query = `${speciality || "dentist"} near ${location}`;
                console.log("[VAPI] Searching Google Places:", query);
                
                const placesRes = await fetch(
                  `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`
                );
                const placesData = await placesRes.json();
                console.log("[VAPI] Google Places status:", placesData.status);
                
                if (placesData.status === "OK" && placesData.results) {
                  result = placesData.results.slice(0, 5).map((place: any) => ({
                    id: `google_${place.place_id}`,
                    name: place.name,
                    speciality: speciality || "General Dentistry",
                    clinicName: place.formatted_address || "External Clinic",
                    isPartner: false,
                    distance: place.rating ? `Rating: ${place.rating}/5` : 'N/A'
                  }));
                  console.log(`[VAPI] Found ${result.length} real-world doctors from Google.`);
                } else {
                  console.warn("[VAPI] Google Places returned no results. Status:", placesData.status, placesData.error_message);
                  result = [];
                }
              } else {
                console.warn("[VAPI] GOOGLE_MAPS_API_KEY missing, cannot search for real doctors.");
                result = [];
              }
            } else {
              // Fallback: no location → fetch from local DB
              const doctors = await getAvailableDoctors({ 
                latitude: latitude ? parseFloat(latitude) : undefined, 
                longitude: longitude ? parseFloat(longitude) : undefined, 
                speciality 
              });
              result = doctors.map(d => ({
                id: d.id,
                name: d.name,
                speciality: d.speciality,
                clinicName: d.clinicName,
                isPartner: d.isPartner,
                distance: d.distance ? String(d.distance) : 'N/A'
              }));
              console.log(`[VAPI] Found ${doctors.length} doctors from local DB.`);
            }
          } catch (doctorErr: any) {
            console.error("[VAPI] get_doctors INNER ERROR:", doctorErr.message);
            console.error("[VAPI] get_doctors STACK:", doctorErr.stack);
            result = { error: "Doctor search failed: " + doctorErr.message };
          }
        } else if (name === "get_current_user") {
          console.log("[VAPI] Tool Called: get_current_user");
          let userId = 
            message?.variableValues?.userId || 
            message?.metadata?.userId || 
            message?.customer?.metadata?.userId ||
            body?.metadata?.userId ||
            "";
          
          if (!userId && rawBody) {
             const clerkIdMatch = rawBody.match(/"userId"\s*:\s*"(user_[a-zA-Z0-9]+)"/i);
             if (clerkIdMatch) {
               userId = clerkIdMatch[1];
               console.log(`[VAPI] get_current_user -> Found userId via REGEX HUNT: [${userId}]`);
             }
          }

          if (userId) {
            const user = await prisma.user.findUnique({ where: { clerkId: userId } });
            result = { 
              userId, 
              name: user ? `${user.firstName} ${user.lastName}` : "Unknown (not in DB)",
              isLoggedIn: true 
            };
          } else {
            result = { 
              userId: null, 
              isLoggedIn: false, 
              error: "No userId detected in Vapi payload",
              debug: { body_keys: Object.keys(body || {}), message_keys: Object.keys(message || {}) }
            };
          }
          console.log("[VAPI] get_current_user result:", result);
        } else if (name === "book_appointment") {
          console.log("[VAPI] Tool Called: book_appointment");
          
          // Hunt for userId in every possible location with source tracing
          let userId = "";
          let source = "none";

          if (message?.variableValues?.userId) {
            userId = message.variableValues.userId;
            source = "message.variableValues.userId";
          } else if (message?.metadata?.userId) {
            userId = message.metadata.userId;
            source = "message.metadata.userId";
          } else if (message?.customer?.metadata?.userId) {
            userId = message.customer.metadata.userId;
            source = "message.customer.metadata.userId";
          } else if (body?.metadata?.userId) {
            userId = body.metadata.userId;
            source = "body.metadata.userId";
          }

          // Super-hunt: Scan the entire raw body if structured hunt fails
          if (!userId && rawBody) {
            const clerkIdMatch = rawBody.match(/"userId"\s*:\s*"(user_[a-zA-Z0-9]+)"/i);
            if (clerkIdMatch) {
              userId = clerkIdMatch[1];
              source = "REGEX_HUNT (rawBody)";
              console.log(`[VAPI] Found userId via REGEX HUNT: [${userId}]`);
            }
          }

          console.log(`[VAPI] RESOLVED userId: [${userId}] FROM SOURCE: [${source}]`);
          
          if (!userId) {
            console.warn("[VAPI] CRITICAL: No userId found in any payload location or via regex hunt.");
            console.log("[VAPI] DEBUG - Raw Body keys:", Object.keys(body || {}));
            console.log("[VAPI] DEBUG - Message keys:", Object.keys(message || {}));
            
            result = { 
              error: "Login required", 
              message: "system_error: userId_missing. Please refresh the page and ensure you are logged in.",
              debug: { 
                payload_missing_id: true,
                checked_at: new Date().toISOString()
              }
            };
          } else {
            console.log("[VAPI] RESOLVED userId:", userId);
            const user = await prisma.user.findUnique({ where: { clerkId: userId } });
            if (user) {
               console.log(`[VAPI] IDENTIFIED USER: ${user.firstName} ${user.lastName} <${user.email}>`);
            } else {
               console.warn(`[VAPI] WARNING: Resolved userId [${userId}] NOT FOUND in Prisma DB.`);
            }

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
        } else if (name === "send_test_email") {
          console.log("[VAPI] Tool Called: send_test_email");
          const email = args.email || args.userEmail;
          if (!email) {
            result = { error: "Email address is required" };
          } else {
            const emailRes = await sendAppointmentConfirmationEmail({
              userEmail: email,
              doctorName: "Diagnostic Test",
              appointmentDate: new Date().toLocaleDateString(),
              appointmentTime: new Date().toLocaleTimeString(),
              appointmentType: "System Diagnostic Test"
            });
            result = { 
              success: emailRes.success, 
              message: emailRes.success ? "Test email sent" : "Test email failed",
              details: emailRes.error ? JSON.stringify(emailRes.error) : "Check Resend dashboard"
            };
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
