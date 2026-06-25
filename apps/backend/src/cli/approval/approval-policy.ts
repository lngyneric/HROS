import type { CliRiskEvaluation } from "../risk/risk.types.js";

export type CliApprovalPolicy = {
  requiresApproval: boolean;
  approvalType: string | null;
  blockingReason: string | null;
};

export function deriveApprovalPolicy(
  risk: Pick<CliRiskEvaluation, "requiresApproval" | "approvalType" | "blockingReason">
): CliApprovalPolicy {
  if (!risk.requiresApproval) {
    return {
      requiresApproval: false,
      approvalType: null,
      blockingReason: null
    };
  }

  return {
    requiresApproval: true,
    approvalType: risk.approvalType ?? "MANUAL_REVIEW",
    blockingReason: risk.blockingReason ?? "approval_required"
  };
}
