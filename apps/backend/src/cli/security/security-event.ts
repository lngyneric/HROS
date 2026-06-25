import { prisma } from "../../db/prisma.js";

const prismaCompat = prisma as typeof prisma & Record<string, any>;

export type WriteSecurityEventInput = {
  invocationId: string;
  actorId: string;
  eventType:
    | "FORBIDDEN_ACCESS_ATTEMPT"
    | "READ_SENSITIVE_DATA"
    | "EXPORT_SENSITIVE_DATA"
    | "APPROVAL_BYPASS_ATTEMPT"
    | "HIGH_RISK_COMMAND_BLOCKED"
    | "SUSPICIOUS_REPEATED_RETRY";
  targetResource: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  detailsJson: Record<string, unknown>;
};

export async function writeSecurityEvent(input: WriteSecurityEventInput, client: any = prismaCompat) {
  return client.securityEvent.create({
    data: {
      invocationId: input.invocationId,
      actorId: input.actorId,
      eventType: input.eventType,
      targetResource: input.targetResource,
      riskLevel: input.riskLevel,
      detailsJson: input.detailsJson
    }
  });
}
