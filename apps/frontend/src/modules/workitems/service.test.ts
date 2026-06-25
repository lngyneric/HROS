import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listFinanceOffboardingCases,
  listHrOffboardingCases,
  listHrOnboardingCases,
  listManagerOffboardingCases,
  listManagerOnboardingCases,
  lockOffboardingCase,
  lockOnboardingCase,
  transitionOffboardingCase,
  transitionOnboardingCase,
  unlockOffboardingCase,
  unlockOnboardingCase
} from "./service";

describe("workitems service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads hr onboarding workitems from the existing api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "case-1", status: "SUBMITTED" }]
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await listHrOnboardingCases();

    expect(result[0]?.status).toBe("SUBMITTED");
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding-cases", {
      method: "GET",
      headers: {},
      body: undefined
    });
  });

  it("loads hr offboarding workitems from the existing api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "off-1", status: "HR_REVIEW" }]
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await listHrOffboardingCases();

    expect(result[0]?.status).toBe("HR_REVIEW");
    expect(fetchMock).toHaveBeenCalledWith("/api/offboarding-cases", {
      method: "GET",
      headers: {},
      body: undefined
    });
  });

  it("loads manager onboarding workitems from the existing api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "case-2", status: "MANAGER_CONFIRM" }]
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await listManagerOnboardingCases();

    expect(result[0]?.status).toBe("MANAGER_CONFIRM");
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding-cases", {
      method: "GET",
      headers: {},
      body: undefined
    });
  });

  it("loads manager offboarding workitems from the existing api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "off-2", status: "MANAGER_CONFIRM" }]
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await listManagerOffboardingCases();

    expect(result[0]?.status).toBe("MANAGER_CONFIRM");
    expect(fetchMock).toHaveBeenCalledWith("/api/offboarding-cases", {
      method: "GET",
      headers: {},
      body: undefined
    });
  });

  it("loads finance offboarding workitems from the existing api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "off-3", status: "FINANCE_CONFIRM" }]
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await listFinanceOffboardingCases();

    expect(result[0]?.status).toBe("FINANCE_CONFIRM");
    expect(fetchMock).toHaveBeenCalledWith("/api/offboarding-cases", {
      method: "GET",
      headers: {},
      body: undefined
    });
  });

  it("transitions onboarding cases through the existing endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [],
        result: {
          success: true,
          businessObjectType: "workflow_instance",
          businessObjectId: "case-1",
          nextActions: [],
          artifacts: []
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    await transitionOnboardingCase("case-1", "MANAGER_CONFIRM");

    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding-cases/case-1/transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "MANAGER_CONFIRM" })
    });
  });

  it("transitions offboarding cases through the existing endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [],
        result: {
          success: true,
          businessObjectType: "workflow_instance",
          businessObjectId: "off-1",
          nextActions: [],
          artifacts: []
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    await transitionOffboardingCase("off-1", "FINANCE_CONFIRM");

    expect(fetchMock).toHaveBeenCalledWith("/api/offboarding-cases/off-1/transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "FINANCE_CONFIRM" })
    });
  });

  it("unlocks onboarding cases through the existing endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [],
        result: {
          success: true,
          businessObjectType: "workflow_instance",
          businessObjectId: "case-1",
          nextActions: [],
          artifacts: []
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    await unlockOnboardingCase("case-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding-cases/case-1/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  });

  it("locks onboarding cases through the existing endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [],
        result: {
          success: true,
          businessObjectType: "workflow_instance",
          businessObjectId: "case-1",
          nextActions: [],
          artifacts: []
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    await lockOnboardingCase("case-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding-cases/case-1/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "manual" })
    });
  });

  it("unlocks offboarding cases through the existing endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [],
        result: {
          success: true,
          businessObjectType: "workflow_instance",
          businessObjectId: "off-1",
          nextActions: [],
          artifacts: []
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    await unlockOffboardingCase("off-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/offboarding-cases/off-1/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
  });

  it("locks offboarding cases through the existing endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [],
        result: {
          success: true,
          businessObjectType: "workflow_instance",
          businessObjectId: "off-1",
          nextActions: [],
          artifacts: []
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    await lockOffboardingCase("off-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/offboarding-cases/off-1/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "manual" })
    });
  });
});
