import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const CALL_TOKEN_TTL_MS = 30 * 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest();

// Hashing first makes both sides the same length, so timingSafeEqual never throws
// and a length mismatch leaks nothing.
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

// Spec 0002 AC-3 to AC-5: required in every environment, never falls back to
// VAPI_PRIVATE_KEY, never logs the presented value.
export function verifyVapiWebhookSecret(req: Request): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error(
      "[VAPI] VAPI_WEBHOOK_SECRET not set; rejecting webhook request.",
    );
    return false;
  }

  const presented = (
    req.headers.get("x-vapi-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  ).trim();

  if (!presented) {
    console.warn("[VAPI] webhook rejected: missing secret header");
    return false;
  }
  if (!safeEqual(presented, secret)) {
    console.warn("[VAPI] webhook rejected: wrong secret");
    return false;
  }
  return true;
}

const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

// Format: v1.<clerkId>.<exp unix seconds>.<base64url hmac>
export function signCallToken(
  clerkId: string,
  secret: string,
  nowMs = Date.now(),
): string {
  const exp = Math.floor((nowMs + CALL_TOKEN_TTL_MS) / 1000);
  const payload = `v1.${clerkId}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

export type CallTokenResult =
  | { ok: true; clerkId: string }
  | { ok: false; reason: "missing" | "expired" | "invalid" | "unconfigured" };

export function verifyCallToken(
  token: unknown,
  secret: string | undefined,
  nowMs = Date.now(),
): CallTokenResult {
  if (typeof token !== "string" || token.trim() === "") {
    return { ok: false, reason: "missing" };
  }
  const key = secret?.trim();
  if (!key) return { ok: false, reason: "unconfigured" };

  const parts = token.trim().split(".");
  if (parts.length !== 4) return { ok: false, reason: "invalid" };
  const [version, clerkId, exp, sig] = parts;
  if (version !== "v1" || !clerkId.startsWith("user_") || !/^\d+$/.test(exp)) {
    return { ok: false, reason: "invalid" };
  }
  // signature before expiry, so a forged token never learns whether it is expired
  if (!safeEqual(sig, sign(`${version}.${clerkId}.${exp}`, key))) {
    return { ok: false, reason: "invalid" };
  }
  if (Number(exp) * 1000 <= nowMs) return { ok: false, reason: "expired" };
  return { ok: true, clerkId };
}
