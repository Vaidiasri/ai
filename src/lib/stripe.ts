import Stripe from "stripe";

const isMock = process.env.USE_MOCK_PAYMENTS === "true";
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!isMock && !stripeKey) {
  throw new Error("STRIPE_SECRET_KEY is not defined. Please set it in .env.local or set USE_MOCK_PAYMENTS=true.");
}

// In Mock mode, we provide a placeholder key to avoid constructor errors, 
// even though we won't actually call Stripe APIs.
export const stripe = new Stripe(stripeKey || "sk_test_mock_placeholder", {
  apiVersion: "2025-10-27" as any, // Using latest or casting to avoid version conflicts
  typescript: true,
});
