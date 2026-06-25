import { afterEach, describe, expect, it, vi } from "vitest";
import { createOffboardingDraft, listOffboardingCases, submitOffboardingCase } from "./service";

describe("offboarding service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads offboarding cases from the existing api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "off-1",
          status: "DRAFT",
          isLocked: false,
          createdAt: "2026-06-25T00:00:00.000Z",
          plannedLastDay: null
        }
      ]
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await listOffboardingCases();

    expect(result[0]?.id).toBe("off-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/offboarding-cases", {
      method: "GET",
      headers: {},
      body: undefined
    });
  });

  it("creates an offboarding draft with the preserved default reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "off-1",
        status: "DRAFT",
        isLocked: false,
        createdAt: "2026-06-25T00:00:00.000Z",
        plannedLastDay: null,
        resignationReason: "个人原因"
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await createOffboardingDraft();

    expect(result.resignationReason).toBe("个人原因");
    expect(fetchMock).toHaveBeenCalledWith("/api/offboarding-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resignationReason: "个人原因" })
    });
  });

  it("submits the selected offboarding draft through the existing endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "off-1",
        status: "SUBMITTED",
        isLocked: true,
        createdAt: "2026-06-25T00:00:00.000Z",
        plannedLastDay: null
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await submitOffboardingCase("off-1");

    expect(result.status).toBe("SUBMITTED");
    expect(fetchMock).toHaveBeenCalledWith("/api/offboarding-cases/off-1/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  });
});
