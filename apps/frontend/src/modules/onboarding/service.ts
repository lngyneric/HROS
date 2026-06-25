import { apiFetch } from "@/lib/api-client";
import type { ActionEnvelope, OnboardingCase } from "./types";

export function listOnboardingCases() {
  return apiFetch<OnboardingCase[]>("GET", "/api/onboarding-cases");
}

export function createOnboardingDraft() {
  return apiFetch<ActionEnvelope>("POST", "/api/onboarding-cases", {});
}

export function submitOnboardingCase(id: string) {
  return apiFetch<OnboardingCase>("POST", `/api/onboarding-cases/${id}/submit`, {});
}
