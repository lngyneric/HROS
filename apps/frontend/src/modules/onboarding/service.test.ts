import { afterEach, describe, expect, it, vi } from "vitest";
import { createOnboardingDraft, listOnboardingCases, submitOnboardingCase } from "./service";

describe("onboarding service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads onboarding cases from the existing api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "onb-1",
          status: "DRAFT",
          isLocked: false,
          createdAt: "2026-06-25T00:00:00.000Z"
        }
      ]
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await listOnboardingCases();

    expect(result[0]?.id).toBe("onb-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding-cases", {
      method: "GET",
      headers: {},
      body: undefined
    });
  });

  it("creates an onboarding draft and returns the action envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [{ eventType: "command_succeeded", status: "ok", summary: "ok", timestamp: "2026-06-25T00:00:00.000Z", payload: {} }],
        result: {
          success: true,
          businessObjectType: "workflow_instance",
          businessObjectId: "wf-1",
          nextActions: ["onboarding.submit"],
          artifacts: []
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await createOnboardingDraft();

    expect(result.result.businessObjectId).toBe("wf-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding-cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  });

  it("submits the selected onboarding draft through the existing endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "onb-1",
        status: "SUBMITTED",
        isLocked: true,
        createdAt: "2026-06-25T00:00:00.000Z"
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await submitOnboardingCase("onb-1");

    expect(result.status).toBe("SUBMITTED");
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding-cases/onb-1/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  });
});
