import { apiFetch } from "@/lib/api-client";
import type {
  ActionEnvelope,
  OffboardingTransitionTarget,
  OffboardingWorkItemCase,
  OnboardingTransitionTarget,
  OnboardingWorkItemCase
} from "./types";

const MANUAL_LOCK_REASON = "manual";

export function listHrOnboardingCases() {
  return apiFetch<OnboardingWorkItemCase[]>("GET", "/api/onboarding-cases");
}

export function listHrOffboardingCases() {
  return apiFetch<OffboardingWorkItemCase[]>("GET", "/api/offboarding-cases");
}

export function listManagerOnboardingCases() {
  return apiFetch<OnboardingWorkItemCase[]>("GET", "/api/onboarding-cases");
}

export function listManagerOffboardingCases() {
  return apiFetch<OffboardingWorkItemCase[]>("GET", "/api/offboarding-cases");
}

export function listFinanceOffboardingCases() {
  return apiFetch<OffboardingWorkItemCase[]>("GET", "/api/offboarding-cases");
}

export function transitionOnboardingCase(id: string, to: OnboardingTransitionTarget) {
  return apiFetch<ActionEnvelope>("POST", `/api/onboarding-cases/${id}/transition`, { to });
}

export function transitionOffboardingCase(id: string, to: OffboardingTransitionTarget) {
  return apiFetch<ActionEnvelope>("POST", `/api/offboarding-cases/${id}/transition`, { to });
}

export function unlockOnboardingCase(id: string) {
  return apiFetch<ActionEnvelope>("POST", `/api/onboarding-cases/${id}/unlock`, {});
}

export function lockOnboardingCase(id: string) {
  return apiFetch<ActionEnvelope>("POST", `/api/onboarding-cases/${id}/lock`, {
    reason: MANUAL_LOCK_REASON
  });
}

export function unlockOffboardingCase(id: string) {
  return apiFetch<ActionEnvelope>("POST", `/api/offboarding-cases/${id}/unlock`, {});
}

export function lockOffboardingCase(id: string) {
  return apiFetch<ActionEnvelope>("POST", `/api/offboarding-cases/${id}/lock`, {
    reason: MANUAL_LOCK_REASON
  });
}
