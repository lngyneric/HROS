import type { CliRiskPolicyRule } from "./risk.types.js";

export const CLI_RISK_POLICY = {
  "hros action list": {
    riskLevel: "LOW",
    requiresApproval: false
  },
  "hros action get": {
    riskLevel: "MEDIUM",
    requiresApproval: false
  },
  "hros approval list": {
    riskLevel: "LOW",
    requiresApproval: false
  },
  "hros approval approve": {
    riskLevel: "MEDIUM",
    requiresApproval: false
  },
  "hros approval reject": {
    riskLevel: "MEDIUM",
    requiresApproval: false
  },
  "hros audit list": {
    riskLevel: "MEDIUM",
    requiresApproval: false
  },
  "hros auth whoami": {
    riskLevel: "LOW",
    requiresApproval: false
  },
  "hros onboarding create": {
    riskLevel: "LOW",
    requiresApproval: false
  },
  "hros onboarding submit": {
    riskLevel: "LOW",
    requiresApproval: false
  },
  "hros onboarding approve-hr": {
    riskLevel: "MEDIUM",
    requiresApproval: false
  },
  "hros onboarding approve-manager": {
    riskLevel: "MEDIUM",
    requiresApproval: false
  },
  "hros offboarding create": {
    riskLevel: "LOW",
    requiresApproval: false
  },
  "hros offboarding submit": {
    riskLevel: "LOW",
    requiresApproval: false
  },
  "hros offboarding approve-hr": {
    riskLevel: "MEDIUM",
    requiresApproval: false
  },
  "hros offboarding approve-manager": {
    riskLevel: "MEDIUM",
    requiresApproval: false
  },
  "hros offboarding approve-finance": {
    riskLevel: "HIGH",
    requiresApproval: true,
    approvalType: "OFFBOARDING_FINANCE_APPROVAL",
    blockingReason: "approval_required"
  },
  "hros offboarding archive": {
    riskLevel: "HIGH",
    requiresApproval: true,
    approvalType: "OFFBOARDING_ARCHIVE_APPROVAL",
    blockingReason: "approval_required"
  },
  "hros employee change-org": {
    riskLevel: "HIGH",
    requiresApproval: true,
    approvalType: "EMPLOYEE_ORG_CHANGE_APPROVAL",
    blockingReason: "approval_required"
  },
  "hros employee change-manager": {
    riskLevel: "HIGH",
    requiresApproval: true,
    approvalType: "EMPLOYEE_MANAGER_CHANGE_APPROVAL",
    blockingReason: "approval_required"
  }
} as const satisfies Record<string, CliRiskPolicyRule>;
