import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";
import { createOnboardingDraft } from "../modules/onboarding/onboarding.actions.js";

describe("onboarding actions", () => {
  it("creates action invocation, workflow instance, task and audit event", async () => {
    const employee = await prisma.employeeMaster.findFirstOrThrow({
      where: { employeeNo: "E0002" }
    });

    const requestId = `req-onboarding-create-${randomUUID()}`;
    const idempotencyKey = `idem-onboarding-create-${randomUUID()}`;

    const action = await createOnboardingDraft({
      actorUserId: "seed-admin",
      actorType: "user",
      employeeId: employee.id,
      requestId,
      idempotencyKey
    });

    expect(action.result.success).toBe(true);
    expect(action.events.some((event) => event.eventType === "state_transition_applied")).toBe(true);

    const invocation = await prisma.actionInvocation.findUniqueOrThrow({
      where: { requestId },
      include: { result: true }
    });

    expect(invocation.status).toBe("SUCCEEDED");
    expect(invocation.result?.success).toBe(true);

    const workflow = await prisma.workflowInstance.findFirstOrThrow({
      where: {
        employeeId: employee.id,
        businessObjectType: "onboarding_case",
        businessObjectId: invocation.result!.businessObjectId
      },
      include: {
        tasks: true,
        events: true
      }
    });

    expect(workflow.status).toBe("DRAFT");
    expect(workflow.tasks).toHaveLength(1);
    expect(workflow.tasks[0]?.taskCode).toBe("onboarding.submit");
    expect(workflow.events.some((event) => event.eventType === "state_transition_applied")).toBe(true);

    const auditEvent = await prisma.auditEvent.findFirstOrThrow({
      where: {
        requestId,
        entityType: "WorkflowInstance",
        entityId: workflow.id,
        operation: "CREATE"
      }
    });

    expect(auditEvent.actorId).toBe("seed-admin");
  });
});
