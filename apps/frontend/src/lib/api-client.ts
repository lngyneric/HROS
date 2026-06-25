export type HttpMethod = "GET" | "POST" | "PATCH";

const API_BASE = "";
const TOKEN_KEY = "hros_token";

let token: string | null = null;

export function setAuthToken(nextToken: string | null) {
  token = nextToken;
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(nextToken: string | null) {
  if (nextToken) {
    localStorage.setItem(TOKEN_KEY, nextToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiFetch<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(API_BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((json as { error?: string }).error || `HTTP ${response.status}`);
  }

  return json as T;
}
