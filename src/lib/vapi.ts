import Vapi from "@vapi-ai/web";

const rawKey = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const apiKey = rawKey ? rawKey.trim() : "";

export const isVapiConfigured =
  Boolean(apiKey) && apiKey !== "missing_key" && apiKey.length > 10;

export const vapi = new Vapi(isVapiConfigured ? apiKey : "missing_key");
