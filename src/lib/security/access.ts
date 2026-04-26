import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

/**
 * Checks if the current authenticated user is an Admin.
 * Criteria: Email matches ADMIN_EMAIL or clerk metadata role is 'admin'.
 */
export async function isAdmin(): Promise<boolean> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return false;

  // 1. Check Clerk Metadata Role
  const role = (sessionClaims?.metadata as any)?.role;
  if (role === "admin") return true;

  // 2. Check Database User Email against ADMIN_EMAIL
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { email: true },
  });

  return user?.email === process.env.ADMIN_EMAIL;
}

/**
 * Validates if the actor has access to a specific resource.
 * Prevents IDOR (Insecure Direct Object Reference).
 */
export async function isParticipant(resourceId: string, resourceType: "appointment" | "user"): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  // Admins bypass participant checks
  if (await isAdmin()) return true;

  try {
    if (resourceType === "appointment") {
      const appointment = await prisma.appointment.findUnique({
        where: { id: resourceId },
        include: { user: { select: { clerkId: true } } },
      });
      return appointment?.user.clerkId === userId;
    }

    if (resourceType === "user") {
      const user = await prisma.user.findUnique({
        where: { id: resourceId },
        select: { clerkId: true },
      });
      return user?.clerkId === userId;
    }

    return false;
  } catch (error) {
    console.error(`[ACCESS_CONTROL_ERROR] ${resourceType}:${resourceId}`, error);
    return false;
  }
}

/**
 * Guard utility for Server Actions.
 * Throws a forbidden error if the check fails.
 */
export async function guard(check: Promise<boolean>, message = "Forbidden: Unauthorized access") {
  const isAllowed = await check;
  if (!isAllowed) {
    throw new Error(message);
  }
}
