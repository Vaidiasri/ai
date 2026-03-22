import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

/**
 * Valid Audit Actions for the system.
 * Use these to maintain consistency in forensics.
 */
export type AuditAction = 
  | "AUTH_SUCCESS"
  | "AUTH_FAILURE"
  | "CREATE_APPOINTMENT"
  | "UPDATE_APPOINTMENT"
  | "DELETE_APPOINTMENT"
  | "VIEW_EHR"
  | "VIEW_APPOINTMENTS"
  | "JOIN_VIDEO"
  | "STRIPE_WEBHOOK_SUCCESS"
  | "STRIPE_WEBHOOK_IDEMPOTENCY_BLOCK"
  | "STRIPE_WEBHOOK_FAILURE"
  | "SECURITY_BREACH"
  | "ENCRYPTION_ERROR"
  | "DECRYPTION_ERROR";

interface AuditOptions {
  actorId: string;    // Clerk ID or "SYSTEM"
  targetId?: string;   // ID of the target resource (e.g., appointmentId)
  metadata?: Record<string, any>;
}

/**
 * Creates a forensic-grade audit log.
 * Captures environment metadata (IP, UserAgent) automatically.
 * Fail-safe: Logging failure does not crash the main application flow.
 */
export async function createAuditLog(action: AuditAction, options: AuditOptions) {
  let ip = "unknown";
  let userAgent = "unknown";

  try {
    const headerList = await headers();
    ip = headerList.get("x-forwarded-for")?.split(",")[0] || headerList.get("x-real-ip") || "unknown";
    userAgent = headerList.get("user-agent") || "unknown";
  } catch (e) {
    // Headers might not be available in all contexts (e.g., background cron)
  }

  try {
    return await prisma.auditLog.create({
      data: {
        action,
        actorId: options.actorId,
        targetId: options.targetId,
        metadata: {
          ip,
          userAgent,
          ...options.metadata,
        },
      },
    });
  } catch (error) {
    console.error(`[AUDIT_LOG_FAILURE] Action: ${action}`, error);
    // In a "scaled" future, this could be pushed to a fallback queue (SQS/Redis)
  }
}
