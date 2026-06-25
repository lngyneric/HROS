import { getStoredToken, setAuthToken, setStoredToken } from "@/lib/api-client";

export function getSessionToken() {
  return getStoredToken();
}

export function restoreSession() {
  const token = getStoredToken();
  setAuthToken(token);
  return token;
}

export function persistSession(token: string) {
  setStoredToken(token);
  setAuthToken(token);
  return token;
}

export function clearSession() {
  setStoredToken(null);
  setAuthToken(null);
}
