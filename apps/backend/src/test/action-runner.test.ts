import { describe, expect, it } from "vitest";
import { createActionRun } from "../modules/actions/action-runner.js";

describe("action runner", () => {
  it("captures ordered events and final result", async () => {
    const run = await createActionRun({
      actionCode: "onboarding.create",
      actorType: "user",
      actorId: "user-1",
      input: { employeeId: "emp-1" },
      execute: async ({ emit }) => {
        emit("input_validated", "ok", { employeeId: "emp-1" });
        emit("state_transition_applied", "ok", { status: "DRAFT" });

        return {
          success: true,
          businessObjectType: "workflow_instance",
          businessObjectId: "wf-1",
          nextActions: ["onboarding.submit"],
          artifacts: []
        };
      }
    });

    expect(run.events.map((event) => event.eventType)).toEqual([
      "command_received",
      "input_validated",
      "state_transition_applied",
      "command_succeeded"
    ]);
    expect(run.result.success).toBe(true);
    expect(run.result.businessObjectId).toBe("wf-1");
  });
});
