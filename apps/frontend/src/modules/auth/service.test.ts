import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredToken, setAuthToken, setStoredToken } from "@/lib/api-client";
import { getCurrentUser, login, logout } from "./service";

describe("auth service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    setAuthToken(null);
  });

  it("posts credentials and persists the token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: "token-123" })
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await login({
      email: "employee@hros.local",
      password: "password12345"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "employee@hros.local",
          password: "password12345"
        })
      })
    );
    expect(result.token).toBe("token-123");
    expect(getStoredToken()).toBe("token-123");
  });

  it("loads the current user with the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "user-1",
        role: "EMPLOYEE_SELF",
        dataScope: "SELF",
        employeeId: "emp-1"
      })
    });

    vi.stubGlobal("fetch", fetchMock);
    setStoredToken("token-abc");
    setAuthToken("token-abc");

    const result = await getCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-abc"
        })
      })
    );
    expect(result.role).toBe("EMPLOYEE_SELF");
  });

  it("clears the persisted session on logout", () => {
    setStoredToken("token-abc");
    setAuthToken("token-abc");

    logout();

    expect(getStoredToken()).toBeNull();
  });
});
