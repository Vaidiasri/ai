import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/security/audit";
import type Stripe from "stripe";

/**
 * STRIPE WEBHOOK HANDLER (HARDENED)
 * Features:
 * 1. Signature Verification (Security)
 * 2. Idempotency Check (StripeEvent table)
 * 3. Database Transactions (Atomic updates)
 * 4. Forensic Audit Logging
 */
export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("stripe-signature") as string;

  if (!signature) {
    return new NextResponse("Missing stripe-signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`[STRIPE_VERIFICATION_FAILED] ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const eventId = event.id;

  // --- 1. IDEMPOTENCY CHECK ---
  const existingEvent = await prisma.stripeEvent.findUnique({
    where: { id: eventId },
  });

  if (existingEvent?.processed) {
    await createAuditLog("STRIPE_WEBHOOK_IDEMPOTENCY_BLOCK", {
      actorId: "SYSTEM",
      targetId: eventId,
      metadata: { eventType: event.type },
    });
    return new NextResponse("Already processed", { status: 200 });
  }

  // --- 2. TRANSACTIONAL PROCESSING ---
  try {
    await prisma.$transaction(async (tx) => {
      // A. Mark event as processed to prevent race conditions/double processing
      await tx.stripeEvent.upsert({
        where: { id: eventId },
        create: { id: eventId, processed: true },
        update: { processed: true },
      });

      // B. Handle Business Logic
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const appointmentId = session.metadata?.appointmentId;

          if (appointmentId) {
            await tx.appointment.update({
              where: { id: appointmentId },
              data: { status: "CONFIRMED" },
            });

            await createAuditLog("STRIPE_WEBHOOK_SUCCESS", {
              actorId: "SYSTEM",
              targetId: appointmentId,
              metadata: { 
                eventType: event.type, 
                sessionId: session.id,
                amount: session.amount_total 
              },
            });
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const intent = event.data.object as Stripe.PaymentIntent;
          await createAuditLog("STRIPE_WEBHOOK_FAILURE", {
            actorId: "SYSTEM",
            targetId: intent.id,
            metadata: { eventType: event.type, error: intent.last_payment_error?.message },
          });
          break;
        }

        default:
          console.log(`[STRIPE_INFO] Unhandled event type: ${event.type}`);
      }
    }, {
      timeout: 10000, // 10s timeout for safety
    });

    return new NextResponse("Webhook processed successfully", { status: 200 });
  } catch (error) {
    console.error("[STRIPE_WEBHOOK_TRANSACTION_CRITICAL_FAILURE]", error);
    
    await createAuditLog("SECURITY_BREACH", {
      actorId: "SYSTEM",
      targetId: eventId,
      metadata: { 
        context: "STRIPE_WEBHOOK_TRANSACTION_FAILED",
        error: String(error) 
      },
    });

    return new NextResponse("Internal Server Error during webhook processing", { status: 500 });
  }
}
