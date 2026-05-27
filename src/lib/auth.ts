import { auth, currentUser } from "@clerk/nextjs/server";

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Authentication required");
  }
  return userId;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) {
    throw new Error("Authentication required");
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const userEmail = user.emailAddresses[0]?.emailAddress;

  if (!adminEmail || userEmail !== adminEmail) {
    throw new Error("Admin access required");
  }

  return user;
}

export function verifyVapiWebhookSecret(req: Request): boolean {
  const secret =
    process.env.VAPI_WEBHOOK_SECRET?.trim() ||
    process.env.VAPI_PRIVATE_KEY?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[VAPI] No VAPI_WEBHOOK_SECRET configured — allowing request in development only.",
      );
      return true;
    }
    return false;
  }

  const header =
    req.headers.get("x-vapi-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return header === secret;
}
