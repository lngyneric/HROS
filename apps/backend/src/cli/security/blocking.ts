import type { CliRiskEvaluation } from "../risk/risk.types.js";
import { writeSecurityEvent } from "./security-event.js";

export function isExecutionBlocked(risk: Pick<CliRiskEvaluation, "canProceed">) {
  return !risk.canProceed;
}

export async function recordBlockedCommandSecurityEvent(input: {
  invocationId: string;
  actorId: string;
  commandName: string;
  targetResource: string;
  risk: Pick<CliRiskEvaluation, "riskLevel" | "blockingReason" | "approvalType">;
  detailsJson?: Record<string, unknown>;
}) {
  return writeSecurityEvent({
    invocationId: input.invocationId,
    actorId: input.actorId,
    eventType: "HIGH_RISK_COMMAND_BLOCKED",
    targetResource: input.targetResource,
    riskLevel: input.risk.riskLevel,
    detailsJson: {
      commandName: input.commandName,
      blockingReason: input.risk.blockingReason,
      approvalType: input.risk.approvalType,
      ...(input.detailsJson ?? {})
    }
  });
}
