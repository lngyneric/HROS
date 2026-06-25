import type { FieldClassification } from "./classification.js";

function canSee(role: string, c: FieldClassification) {
  if (c === "PUBLIC") return true;
  if (c === "PERSONAL") return true;
  if (c === "SENSITIVE") return role === "ADMIN" || role === "HRBP" || role === "HR_SPECIALIST" || role === "PAYROLL_FINANCE";
  if (c === "HIGHLY_SENSITIVE") return role === "ADMIN" || role === "HR_SPECIALIST" || role === "PAYROLL_FINANCE";
  return false;
}

export function filterByPolicy<T extends Record<string, any>>(obj: T, policy: Record<string, FieldClassification>, role: string): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const c = policy[k];
    if (!c || canSee(role, c)) out[k] = v;
  }
  return out as Partial<T>;
}

