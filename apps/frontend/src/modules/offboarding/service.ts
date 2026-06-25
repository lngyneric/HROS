import { apiFetch } from "@/lib/api-client";
import type { CreateOffboardingDraftInput, OffboardingCase } from "./types";

const DEFAULT_CREATE_INPUT: CreateOffboardingDraftInput = {
  resignationReason: "个人原因"
};

export function listOffboardingCases() {
  return apiFetch<OffboardingCase[]>("GET", "/api/offboarding-cases");
}

export function createOffboardingDraft(input: CreateOffboardingDraftInput = DEFAULT_CREATE_INPUT) {
  return apiFetch<OffboardingCase>("POST", "/api/offboarding-cases", {
    ...DEFAULT_CREATE_INPUT,
    ...input
  });
}

export function submitOffboardingCase(id: string) {
  return apiFetch<OffboardingCase>("POST", `/api/offboarding-cases/${id}/submit`, {});
}
