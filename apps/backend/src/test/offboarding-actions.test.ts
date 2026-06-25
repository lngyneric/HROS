import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";
import { archiveOffboardingCase } from "../modules/offboarding/offboarding.actions.js";

describe("offboarding actions", () => {
  it("archives the workflow, writes artifacts, workflow events and audit records", async () => {
    const suffix = randomUUID();
    const employee = await prisma.employeeMaster.create({
      data: {
        employeeNo: `OFF-${suffix}`,
        fullName: "离职测试员工",
        workEmail: `offboarding-${suffix}@hros.local`,
        currentStatus: "ACTIVE"
      }
    });

    const workflowTemplate = await prisma.workflowTemplate.findUniqueOrThrow({
      where: { templateCode: "OFFBOARDING_STANDARD" }
    });
    const financeTaskTemplate = await prisma.workflowTaskTemplate.findFirstOrThrow({
      where: {
        templateId: workflowTemplate.id,
        taskCode: "offboarding.approve_finance"
      }
    });

    const workflow = await prisma.workflowInstance.create({
      data: {
        templateId: workflowTemplate.id,
        employeeId: employee.id,
        businessObjectType: "offboarding_case",
        businessObjectId: `offboarding-case-${suffix}`,
        status: "FINANCE_CONFIRM",
        initiatedBy: "seed-finance"
      }
    });

    await prisma.workflowTask.create({
      data: {
        workflowInstanceId: workflow.id,
        taskTemplateId: financeTaskTemplate.id,
        taskCode: financeTaskTemplate.taskCode,
        status: "FINANCE_CONFIRM",
        assigneeType: "user",
        assigneeId: "seed-finance"
      }
    });

    const requestId = `req-offboarding-archive-${suffix}`;
    const idempotencyKey = `idem-offboarding-archive-${suffix}`;

    const action = await archiveOffboardingCase({
      workflowInstanceId: workflow.id,
      actorUserId: "seed-finance",
      actorType: "user",
      requestId,
      idempotencyKey
    });

    expect(action.result.success).toBe(true);
    expect(action.result.businessObjectId).toBe(workflow.id);
    expect(action.result.artifacts).toHaveLength(1);
    expect(action.result.artifacts[0]?.type).toBe("archive_snapshot");
    expect(action.events.some((event) => event.eventType === "artifact_written")).toBe(true);
    expect(action.events.some((event) => event.eventType === "state_transition_applied")).toBe(true);

    const invocation = await prisma.actionInvocation.findUniqueOrThrow({
      where: { requestId },
      include: { result: true }
    });

    expect(invocation.status).toBe("SUCCEEDED");
    expect(invocation.result?.success).toBe(true);

    const refreshed = await prisma.workflowInstance.findUniqueOrThrow({
      where: { id: workflow.id },
      include: {
        tasks: {
          include: {
            artifacts: true
          },
          orderBy: {
            taskCode: "asc"
          }
        },
        employee: true,
        events: true
      }
    });

    expect(refreshed.status).toBe("ARCHIVED");
    expect(refreshed.employee.currentStatus).toBe("OFFBOARDED");
    expect(refreshed.tasks.some((task) => task.taskCode === "offboarding.archive")).toBe(true);
    expect(refreshed.tasks.some((task) => task.artifacts.length > 0)).toBe(true);
    expect(refreshed.events.some((event) => event.eventType === "artifact_written")).toBe(true);
    expect(refreshed.events.some((event) => event.eventType === "state_transition_applied")).toBe(true);

    const archiveTask = refreshed.tasks.find((task) => task.taskCode === "offboarding.archive");
    expect(archiveTask?.artifacts[0]?.artifactType).toBe("archive_snapshot");

    const auditEvent = await prisma.auditEvent.findFirstOrThrow({
      where: {
        requestId,
        entityType: "WorkflowInstance",
        entityId: workflow.id,
        operation: "ARCHIVE"
      }
    });

    expect(auditEvent.actorId).toBe("seed-finance");
  });
});
