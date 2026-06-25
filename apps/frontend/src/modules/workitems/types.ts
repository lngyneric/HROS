import type { ActionEnvelope, CaseEmployee, CaseItem } from "@/modules/onboarding/types";

export type { ActionEnvelope };

export type OnboardingTransitionTarget = "HR_REVIEW" | "MANAGER_CONFIRM" | "COMPLETED" | "CANCELLED";

export type OffboardingTransitionTarget = "HR_REVIEW" | "MANAGER_CONFIRM" | "FINANCE_CONFIRM" | "ARCHIVED" | "CANCELLED";

export type WorklistCaseBase = {
  id: string;
  status: string;
  isLocked?: boolean;
  createdAt: string;
  employee?: CaseEmployee;
  items?: CaseItem[];
};

export type OnboardingWorkItemCase = WorklistCaseBase;

export type OffboardingWorkItemCase = WorklistCaseBase & {
  plannedLastDay?: string | null;
  resignationReason?: string | null;
};
