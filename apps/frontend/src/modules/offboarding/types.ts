import type { ActionEnvelope, ActionEvent } from "@/modules/onboarding/types";

export type { ActionEnvelope, ActionEvent };

export type CaseItem = {
  id: string;
  itemType: string;
  title: string;
  description: string | null;
  itemStatus: string;
};

export type CaseEmployee = {
  id: string;
  employeeNo?: string;
  name?: string;
  fullName?: string;
  status?: string;
};

export type ArchiveSnapshot = {
  id: string;
  snapshotVersion?: string;
};

export type CreateOffboardingDraftInput = {
  employeeId?: string;
  plannedLastDay?: string;
  resignationReason?: string;
};

export type OffboardingCase = {
  id: string;
  status: string;
  isLocked: boolean;
  createdAt: string;
  plannedLastDay: string | null;
  resignationReason?: string | null;
  employeeId?: string;
  employee?: CaseEmployee;
  items?: CaseItem[];
  archives?: ArchiveSnapshot[];
};
