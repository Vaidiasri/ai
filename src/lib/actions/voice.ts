"use server";

import { requireAuth } from "@/lib/auth";
import { signCallToken } from "@/lib/vapi-auth";

// Signed proof of who started the call; the webhook trusts nothing else (spec 0002 AC-6).
export async function getVoiceCallToken(): Promise<string | null> {
  const clerkId = await requireAuth();
  const secret = process.env.VAPI_CALL_TOKEN_SECRET?.trim();
  if (!secret) {
    console.error(
      "[VAPI] VAPI_CALL_TOKEN_SECRET not set; starting call without a call token",
    );
    return null;
  }
  return signCallToken(clerkId, secret);
}
