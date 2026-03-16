import Vapi from "@vapi-ai/web";

// Add fallback to prevent crash during Next.js build
const rawKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const apiKey = rawKey ? rawKey.trim() : "";

export const vapi = new Vapi(apiKey || "missing_key");
