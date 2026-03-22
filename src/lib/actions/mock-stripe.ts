"use server";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/security/audit";

/**
 * MOCK STRIPE WEBHOOK TRIGGER
 * This action simulates a successful Stripe webhook.
 * In a real app, this would be an HTTP POST from Stripe to /api/webhooks/stripe.
 */
export async function triggerMockPayment(appointmentId: string) {
  console.log(`[MOCK_STRIPE] Triggering payment success for: ${appointmentId}`);

  try {
    // We use a transaction to match the hardened logic in the real webhook
    return await prisma.$transaction(async (tx) => {
      // 1. Simulate StripeEvent idempotency
      const mockEventId = `mock_evt_${Date.now()}`;
      await tx.stripeEvent.create({
        data: { id: mockEventId, processed: true }
      });

      // 2. Update Appointment
      const appointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: "CONFIRMED" },
      });

      // 3. Log the success
      await createAuditLog("STRIPE_WEBHOOK_SUCCESS", {
        actorId: "MOCK_GATEWAY",
        targetId: appointmentId,
        metadata: { 
          context: "SIMULATED_PAYMENT",
          mockEventId 
        },
      });

      return appointment;
    });

    // --- 4. Send Email After Successful Payment ---
    // In a real scenario, this would be handled in the webhook as well.
    const appointmentWithUser = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { user: true, doctor: true }
    });

    const userEmail = appointmentWithUser?.user?.email;
    const doctorName = appointmentWithUser?.doctor?.name;
    const appointmentDate = appointmentWithUser?.date;
    const appointmentTime = appointmentWithUser?.time;
    const appointmentReason = appointmentWithUser?.reason;

    if (!userEmail || !doctorName || !appointmentDate || !appointmentTime) {
      console.warn(`[MOCK_STRIPE] Skipping email: Data missing for ${appointmentId}`);
      return null;
    }

    const { sendAppointmentConfirmationEmail } = await import("@/lib/services/email");
    const { format } = await import("date-fns");
    
    sendAppointmentConfirmationEmail({
      userEmail: userEmail as string,
      doctorName: doctorName as string,
      appointmentDate: format(appointmentDate as Date, "EEEE, MMMM d, yyyy"),
      appointmentTime: appointmentTime as string,
      appointmentType: (appointmentReason as string) || "Consultation"
    }).catch(err => console.error("[MOCK_STRIPE] Email failed:", err));

    return null;
  } catch (error) {
    console.error("[MOCK_STRIPE_ERROR]", error);
    throw new Error("Failed to process mock payment");
  }
}
