import { describe, expect, it } from "vitest";
import { getStoredToken, setStoredToken } from "./api-client";

describe("api-client token storage", () => {
  it("persists and clears the hros token", () => {
    setStoredToken("token-123");
    expect(getStoredToken()).toBe("token-123");

    setStoredToken(null);
    expect(getStoredToken()).toBeNull();
  });
});
