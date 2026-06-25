import { CLI_RISK_POLICY } from "./risk-policy.js";
import type { CliRiskEvaluation, CliRiskEvaluationInput } from "./risk.types.js";

function normalizeCommandName(commandName: string) {
  return commandName.trim().replace(/\s+/g, " ").toLowerCase();
}

export function evaluateRisk(input: CliRiskEvaluationInput): CliRiskEvaluation {
  const normalizedCommandName = normalizeCommandName(input.commandName);
  const matched = CLI_RISK_POLICY[normalizedCommandName as keyof typeof CLI_RISK_POLICY];

  if (!matched) {
    return {
      commandName: normalizedCommandName,
      actorRole: input.actorRole,
      riskLevel: "CRITICAL",
      requiresApproval: true,
      canProceed: false,
      blockingReason: "unknown_command_risk",
      approvalType: "UNKNOWN_COMMAND"
    };
  }

  return {
    commandName: normalizedCommandName,
    actorRole: input.actorRole,
    riskLevel: matched.riskLevel,
    requiresApproval: matched.requiresApproval,
    canProceed: !matched.requiresApproval,
    blockingReason: matched.requiresApproval ? (matched.blockingReason ?? "approval_required") : null,
    approvalType: "approvalType" in matched ? matched.approvalType ?? null : null
  };
}
