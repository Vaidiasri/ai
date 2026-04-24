"use client";

import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { vapi } from "@/lib/vapi";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { getAvailableDoctors } from "@/lib/actions/doctors";
import { bookAppointment } from "@/lib/actions/appointments";

function VapiWidget() {
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [callEnded, setCallEnded] = useState(false);

  // Payment states
  const [showPayment, setShowPayment] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success">("idle");
  const [debugTool, setDebugTool] = useState<string>("");
  const [debugOutput, setDebugOutput] = useState<string>("");

  const { user, isLoaded } = useUser();
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // auto-scroll for messages
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop =
        messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // setup event listeners for VAPI
  useEffect(() => {
    const handleCallStart = () => {
      console.log("Call started");
      setConnecting(false);
      setCallActive(true);
      setCallEnded(false);
    };

    const handleCallEnd = () => {
      console.log("Call ended");
      setCallActive(false);
      setConnecting(false);
      setIsSpeaking(false);
      setCallEnded(true);
    };

    const handleSpeechStart = () => {
      console.log("AI started Speaking");
      setIsSpeaking(true);
    };

    const handleSpeechEnd = () => {
      console.log("AI stopped Speaking");
      setIsSpeaking(false);
    };

    const handleMessage = async (message: any) => {
      // DEBUG: Log ALL messages from Vapi
      console.log(`[VAPI MESSAGE: ${message.type}]`, message);

      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { content: message.transcript, role: message.role };
        setMessages((prev) => [...prev, newMessage]);
      } else if (message.type === "tool-calls" || message.type === "function-call") {
        console.log("------------------- TOOL/FUNCTION CALL DETECTED -------------------");
        console.log("Full Message Object:", JSON.stringify(message, null, 2));
        
        // Vapi sends tool calls in various formats across versions/configs
        const { toolCalls, toolCallList, toolWithToolCallList, functionCall } = message;
        let calls = toolCalls || toolCallList || toolWithToolCallList || [];
        
        if (calls.length === 0 && functionCall) {
          calls = [{ toolCall: functionCall, function: functionCall }];
        }

        console.log(`Processing ${calls.length} calls...`);
        
        for (const item of calls) {
          const toolCall = item.toolCall || item; 
          const { id: toolCallId, function: fn } = toolCall;
          const name = fn?.name || toolCall.name || (typeof toolCall === 'string' ? toolCall : "");
          let args = fn?.arguments || toolCall.arguments || toolCall.args || {};
          
          if (typeof args === "string") {
            try { args = JSON.parse(args); } catch (e) {}
          }

          console.log(`>>> EXECUTING [${name}] ON CLIENT`, { toolCallId, args });
          setDebugTool(`${name}(${JSON.stringify(args)})`);

          if (name === "get_doctors") {
            try {
              console.log("Searching DB for doctors...");
              const doctors = await getAvailableDoctors(args);
              console.log("Database result:", doctors);
              
              const output = JSON.stringify(doctors);
              
              setDebugOutput(`Found ${doctors.length} doctors.`);
              console.log("Sending check-out (add-message) back to Vapi...");
              vapi.send({
                type: 'add-message',
                message: {
                  role: 'tool',
                  content: output,
                  tool_call_id: toolCallId,
                }
              } as any);
            } catch (err: any) {
              console.error("Tool execution failed:", err);
              setDebugOutput("Error: " + err.message);
              vapi.send({
                type: 'add-message',
                message: {
                  role: 'tool',
                  content: JSON.stringify({ error: "Internal error fetching doctors." }),
                  tool_call_id: toolCallId,
                }
              } as any);
            }
          } else if (name === "initiate_payment") {
            setPaymentDetails(args);
            setShowPayment(true);
            setDebugOutput("Payment link displayed.");
          } else if (name === "book_appointment") {
            try {
              const result = await bookAppointment(args, user?.id);
              vapi.send({
                type: 'add-message',
                message: {
                  role: 'tool',
                  content: JSON.stringify({ success: true, bookingId: result.id }),
                  tool_call_id: toolCallId,
                }
              } as any);
            } catch (err: any) {
              vapi.send({
                type: 'add-message',
                message: {
                  role: 'tool',
                  content: JSON.stringify({ error: "Booking failed." }),
                  tool_call_id: toolCallId,
                }
              } as any);
            }
          }
        }
      }
    };

    const handleError = (error: any) => {
      console.error("Vapi Session Error:", error);
      console.log("Error details:", {
        message: error?.message,
        reason: error?.reason,
        details: error?.details
      });
      setConnecting(false);
      setCallActive(false);
    };

    vapi
      .on("call-start", handleCallStart)
      .on("call-end", handleCallEnd)
      .on("speech-start", handleSpeechStart)
      .on("speech-end", handleSpeechEnd)
      .on("message", handleMessage)
      .on("error", handleError);

    // cleanup event listeners on unmount
    return () => {
      vapi
        .off("call-start", handleCallStart)
        .off("call-end", handleCallEnd)
        .off("speech-start", handleSpeechStart)
        .off("speech-end", handleSpeechEnd)
        .off("message", handleMessage)
        .off("error", handleError);
    };
  }, []);

  const toggleCall = async () => {
    if (callActive) vapi.stop();
    else {
      try {
        setConnecting(true);
        setMessages([]);
        setCallEnded(false);
        setShowPayment(false);
        setPaymentStatus("idle");

        const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID?.trim();
        console.log("Starting Vapi Call with Assistant ID:", assistantId);

        console.log("Starting Vapi Call with User:", user?.id);

        await vapi.start(assistantId!, {
          variableValues: {
            name: (user?.firstName || "").trim() || "there",
            userId: user?.id || "",
          }
        });
      } catch (error) {
        console.log("Failed to start call", error);
        setConnecting(false);
      }
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentStatus("processing");
    
    // Simulate payment delay
    setTimeout(() => {
      setPaymentStatus("success");
      
      // Tell Vapi that payment was successful so it can book
      vapi.send({
        type: "add-message",
        message: {
          role: "system",
          content: "Payment successful. You may now book the appointment."
        }
      });

      // Close modal after a short delay
      setTimeout(() => {
        setShowPayment(false);
        setPaymentStatus("idle");
      }, 2000);
    }, 2000);
  };

  if (!isLoaded) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 flex flex-col overflow-hidden pb-20">
      {/* TITLE */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold font-mono">
          <span>Talk to Your </span>
          <span className="text-primary uppercase">AI Dental Assistant</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Have a voice conversation with our AI assistant for dental advice and
          guidance
        </p>
      </div>

      {/* VIDEO CALL AREA */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* AI ASSISTANT CARD */}

        <Card className="bg-card/90 backdrop-blur-sm border border-border overflow-hidden relative">
          <div className="aspect-video flex flex-col items-center justify-center p-6 relative">
            {/* AI VOICE ANIMATION */}
            <div
              className={`absolute inset-0 ${
                isSpeaking ? "opacity-30" : "opacity-0"
              } transition-opacity duration-300`}
            >
              {/* voice wave animation when speaking */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-center items-center h-20">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`mx-1 h-16 w-1 bg-primary rounded-full ${
                      isSpeaking ? "animate-sound-wave" : ""
                    }`}
                    style={{
                      animationDelay: `${i * 0.1}s`,
                      height: isSpeaking ? `${Math.random() * 50 + 20}%` : "5%",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* AI LOGO */}
            <div className="relative size-32 mb-4">
              <div
                className={`absolute inset-0 bg-primary opacity-10 rounded-full blur-lg ${
                  isSpeaking ? "animate-pulse" : ""
                }`}
              />

              <div className="relative w-full h-full rounded-full bg-card flex items-center justify-center border border-border overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-primary/5"></div>
                <Image
                  src="/logo.png"
                  alt="AI Dental Assistant"
                  width={80}
                  height={80}
                  className="w-20 h-20 object-contain"
                />
              </div>
            </div>

            <h2 className="text-xl font-bold text-foreground">DentWise AI</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Dental Assistant
            </p>

            {/* SPEAKING INDICATOR */}
            <div
              className={`mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border ${
                isSpeaking ? "border-primary" : ""
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isSpeaking ? "bg-primary animate-pulse" : "bg-muted"
                }`}
              />

              <span className="text-xs text-muted-foreground">
                {isSpeaking
                  ? "Speaking..."
                  : callActive
                    ? "Listening..."
                    : callEnded
                      ? "Call ended"
                      : "Waiting..."}
              </span>
            </div>
          </div>
        </Card>

        {/* USER CARD */}
        <Card
          className={`bg-card/90 backdrop-blur-sm border overflow-hidden relative`}
        >
          <div className="aspect-video flex flex-col items-center justify-center p-6 relative">
            {/* User Image */}
            <div className="relative size-32 mb-4">
              <Image
                src={user?.imageUrl!}
                alt="User"
                width={128}
                height={128}
                className="size-full object-cover rounded-full"
              />
            </div>

            <h2 className="text-xl font-bold text-foreground">You</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {user
                ? (user.firstName + " " + (user.lastName || "")).trim()
                : "Guest"}
            </p>

            {/* User Ready Text */}
            <div
              className={`mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-card border`}
            >
              <div className={`w-2 h-2 rounded-full bg-muted`} />
              <span className="text-xs text-muted-foreground">Ready</span>
            </div>
          </div>
        </Card>
      </div>

      {/* MESSAGE CONTAINER */}
      {messages.length > 0 && (
        <div
          ref={messageContainerRef}
          className="w-full bg-card/90 backdrop-blur-sm border border-border rounded-xl p-4 mb-8 h-64 overflow-y-auto transition-all duration-300 scroll-smooth"
        >
          <div className="space-y-3">
            {messages.map((msg, index) => (
              <div
                key={index}
                className="message-item animate-in fade-in duration-300"
              >
                <div className="font-semibold text-xs text-muted-foreground mb-1">
                  {msg.role === "assistant" ? "DentWise AI" : "You"}:
                </div>
                <p className="text-foreground">{msg.content}</p>
              </div>
            ))}

            {callEnded && (
              <div className="message-item animate-in fade-in duration-300">
                <div className="font-semibold text-xs text-primary mb-1">
                  System:
                </div>
                <p className="text-foreground">
                  Call ended. Thank you for using DentWise AI!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CALL CONTROLS */}
      <div className="w-full flex justify-center gap-4">
        <Button
          className={`w-44 text-xl rounded-3xl ${
            callActive
              ? "bg-destructive hover:bg-destructive/90"
              : callEnded
                ? "bg-red-500 hover:bg-red-700"
                : "bg-primary hover:bg-primary/90"
          } text-white relative`}
          onClick={toggleCall}
          disabled={connecting || callEnded || showPayment}
        >
          {connecting && (
            <span className="absolute inset-0 rounded-full animate-ping bg-primary/50 opacity-75"></span>
          )}

          <span>
            {callActive
              ? "End Call"
              : connecting
                ? "Connecting..."
                : callEnded
                  ? "Call Ended"
                  : "Start Call"}
          </span>
        </Button>
      </div>

      {/* PAYMENT MODAL */}
      {showPayment && paymentDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <Card className="w-full max-w-md p-6 bg-card border shadow-2xl animate-in zoom-in-95 duration-200 rounded-3xl">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <rect width="20" height="14" x="2" y="5" rx="2" />
                  <line x1="2" x2="22" y1="10" y2="10" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold font-mono text-foreground">Complete Payment</h2>
              <p className="text-muted-foreground mt-2">
                Consultation Fee for {paymentDetails.type || "Medical"} Appointment
              </p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-6 space-y-3 font-mono text-sm shadow-inner tracking-wide">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-foreground font-mono tracking-tight text-lg">${paymentDetails.amount ? paymentDetails.amount.toFixed(2) : "50.00"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium text-foreground">{paymentDetails.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time:</span>
                <span className="font-medium text-foreground">{paymentDetails.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium text-foreground">{paymentDetails.type}</span>
              </div>
            </div>

            <Button
              className="w-full text-lg py-6 rounded-2xl transition-all shadow-md hover:shadow-lg font-mono font-bold tracking-wider"
              onClick={handlePaymentSuccess}
              disabled={paymentStatus !== "idle"}
              variant={paymentStatus === "success" ? "secondary" : "default"}
            >
              {paymentStatus === "idle" && "PAY WITH CARD NOW"}
              {paymentStatus === "processing" && "PROCESSING SECURELY..."}
              {paymentStatus === "success" && "PAYMENT SUCCESSFUL!"}
            </Button>
          </Card>
        </div>
      )}

      {/* Debug Info */}
      {(debugTool || debugOutput) && (
        <div className="mt-4 p-3 bg-black/80 rounded-2xl text-[11px] font-mono text-white border border-white/10 shadow-xl backdrop-blur-md">
          <div className="flex justify-between border-b border-white/10 mb-2 pb-1 font-bold tracking-widest text-primary">
            <span>VAPI DEBUGGER</span>
            <button onClick={() => { setDebugTool(""); setDebugOutput(""); }} className="hover:text-red-400 transition-colors uppercase">Clear</button>
          </div>
          <div className="mb-1"><span className="text-primary/70 mr-1 opacity-70">IDENTITY:</span> <span className="bg-white/5 px-1 rounded">{user?.firstName || "N/A"} ({user?.id?.slice(-4)})</span></div>
          <div className="mb-2"><span className="text-primary/70 mr-1 opacity-70">INTERCEPTED:</span> <span className="bg-white/5 px-1 rounded">{debugTool || "Waiting..."}</span></div>
          <div className="break-words font-mono whitespace-pre-wrap"><span className="text-primary/70 mr-1 opacity-70">OUTPUT:</span> <span className="text-green-300">{debugOutput || "None"}</span></div>
        </div>
      )}
    </div>
  );
}

export default VapiWidget;
