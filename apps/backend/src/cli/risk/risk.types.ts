export type CliRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CliBlockingReason = "approval_required" | "unknown_command_risk" | null;

export type CliRiskEvaluationInput = {
  commandName: string;
  actorRole: string;
  args: Record<string, unknown>;
};

export type CliRiskPolicyRule = {
  riskLevel: CliRiskLevel;
  requiresApproval: boolean;
  approvalType?: string;
  blockingReason?: Exclude<CliBlockingReason, null>;
};

export type CliRiskEvaluation = {
  commandName: string;
  actorRole: string;
  riskLevel: CliRiskLevel;
  requiresApproval: boolean;
  canProceed: boolean;
  blockingReason: CliBlockingReason;
  approvalType: string | null;
};
