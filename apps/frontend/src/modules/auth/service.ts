import { apiFetch } from "@/lib/api-client";
import { clearSession, persistSession } from "./session";
import type { CurrentUser, LoginInput, LoginResponse, RoleHomePath } from "./types";

export async function login(input: LoginInput) {
  const result = await apiFetch<LoginResponse>("POST", "/api/auth/login", input);
  persistSession(result.token);
  return result;
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("GET", "/api/auth/me");
}

export function logout() {
  clearSession();
}

export function getRoleHomePath(role: string): RoleHomePath {
  return role === "EMPLOYEE_SELF"
    ? "/self"
    : role === "MANAGER"
      ? "/manager"
      : role === "PAYROLL_FINANCE"
        ? "/finance"
        : "/hr";
}
