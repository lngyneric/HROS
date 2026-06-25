import { describe, expect, it } from "vitest";
import { runCli } from "../cli/main.js";

describe("cli onboarding", () => {
  it("returns structured events and result metadata for onboarding create", async () => {
    const result = await runCli([
      "onboarding",
      "create",
      "--actor-id",
      "seed-employee",
      "--employee-id",
      "self",
      "--output",
      "json"
    ]);

    expect(result.status).toBe("succeeded");
    expect(result.invocationId).toEqual(expect.any(String));
    expect(result.traceId).toEqual(expect.any(String));
    expect(result.events[0]?.eventType).toBe("command_received");
    expect(result.events.some((event) => event.eventType === "policy_checked")).toBe(true);
    expect(result.result).toMatchObject({
      success: true,
      businessObjectType: "workflow_instance"
    });
    expect(result.result.businessObjectId).toEqual(expect.any(String));
  });
});
