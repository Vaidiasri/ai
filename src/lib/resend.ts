import { Resend } from "resend";

// Add fallback to prevent crash during Next.js build
const resend = new Resend(process.env.RESEND_API_KEY || "dummy_key");

export default resend;
