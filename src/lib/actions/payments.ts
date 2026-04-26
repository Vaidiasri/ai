"use server";

import { stripe } from "@/lib/stripe";

/**
 * Agile Payment Abstraction.
 * In development, use Mock. In production (if configured), use Stripe.
 */
export async function createPaymentSession({
  appointmentId,
  customerEmail,
  amountInCents,
  doctorName,
}: {
  appointmentId: string;
  customerEmail: string;
  amountInCents: number;
  doctorName: string;
}) {
  const isMock = process.env.USE_MOCK_PAYMENTS === "true";

  if (isMock) {
    // Generate a Mock Checkout URL
    const url = new URL("/mock-checkout", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    url.searchParams.set("appointmentId", appointmentId);
    url.searchParams.set("amount", (amountInCents / 100).toString());
    url.searchParams.set("doctor", doctorName);
    
    return { url: url.toString(), isMock: true };
  }

  // Real Stripe Implementation (Falls back to this if USE_MOCK_PAYMENTS is false)
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Dental Appointment - ${doctorName}`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    metadata: { appointmentId },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/appointments?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/appointments?canceled=true`,
  });

  return { url: session.url!, isMock: false };
}
