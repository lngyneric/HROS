import { describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";
import { runCli } from "../cli/main.js";

async function cleanupCliInvocation(invocationId: string | undefined) {
  if (!invocationId) {
    return;
  }

  await prisma.approvalRequest.deleteMany({
    where: { invocationId }
  });
  await prisma.securityEvent.deleteMany({
    where: { invocationId }
  });
  await prisma.auditEvent.deleteMany({
    where: { invocationId }
  });
  await prisma.workflowEvent.deleteMany({
    where: { invocationId }
  });
  await prisma.actionResult.deleteMany({
    where: { invocationId }
  });
  await prisma.actionInvocation.deleteMany({
    where: { id: invocationId }
  });
}

describe("cli onboarding transitions", () => {
  it("submits and advances onboarding workflow via CLI", async () => {
    let createInvocationId: string | undefined;
    let submitInvocationId: string | undefined;
    let approveHrInvocationId: string | undefined;
    let approveManagerInvocationId: string | undefined;
    let workflowId: string | undefined;

    try {
      const createResult = await runCli([
        "onboarding",
        "create",
        "--actor-id",
        "seed-employee",
        "--employee-id",
        "self",
        "--output",
        "json"
      ]);
      createInvocationId = createResult.invocationId;

      expect(createResult.status).toBe("succeeded");
      workflowId = String(createResult.result.businessObjectId);

      const submitResult = await runCli([
        "onboarding",
        "submit",
        "--actor-id",
        "seed-employee",
        "--workflow-instance-id",
        workflowId,
        "--output",
        "json"
      ]);
      submitInvocationId = submitResult.invocationId;

      expect(submitResult.status).toBe("succeeded");
      expect(submitResult.invocationId).toEqual(expect.any(String));
      expect(submitResult.traceId).toEqual(expect.any(String));
      expect(submitResult.result).toMatchObject({
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflowId
      });

      const approveHrResult = await runCli([
        "onboarding",
        "approve-hr",
        "--actor-id",
        "seed-hr",
        "--workflow-instance-id",
        workflowId,
        "--output",
        "json"
      ]);
      approveHrInvocationId = approveHrResult.invocationId;

      expect(approveHrResult.status).toBe("succeeded");
      expect(approveHrResult.result).toMatchObject({
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflowId
      });

      const approveManagerResult = await runCli([
        "onboarding",
        "approve-manager",
        "--actor-id",
        "seed-manager",
        "--workflow-instance-id",
        workflowId,
        "--output",
        "json"
      ]);
      approveManagerInvocationId = approveManagerResult.invocationId;

      expect(approveManagerResult.status).toBe("succeeded");
      expect(approveManagerResult.result).toMatchObject({
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflowId
      });

      const workflow = await prisma.workflowInstance.findUniqueOrThrow({
        where: { id: workflowId },
        include: {
          tasks: {
            orderBy: { taskCode: "asc" }
          },
          events: {
            orderBy: { occurredAt: "asc" }
          }
        }
      });

      expect(workflow.businessObjectType).toBe("onboarding_case");
      expect(workflow.status).toBe("COMPLETED");
      expect(workflow.tasks.map((task) => task.taskCode)).toEqual([
        "onboarding.approve_hr",
        "onboarding.approve_manager",
        "onboarding.submit"
      ]);
      expect(workflow.events.filter((event) => event.eventType === "state_transition_applied")).toHaveLength(4);
    } finally {
      await cleanupCliInvocation(approveManagerInvocationId);
      await cleanupCliInvocation(approveHrInvocationId);
      await cleanupCliInvocation(submitInvocationId);
      await cleanupCliInvocation(createInvocationId);

      if (workflowId) {
        const workflowInvocationIds = (
          await prisma.actionResult.findMany({
            where: {
              businessObjectType: "workflow_instance",
              businessObjectId: workflowId
            },
            select: {
              invocationId: true
            }
          })
        ).map((item) => item.invocationId);

        await prisma.taskArtifact.deleteMany({
          where: {
            task: {
              workflowInstanceId: workflowId
            }
          }
        });
        await prisma.workflowEvent.deleteMany({
          where: { workflowInstanceId: workflowId }
        });
        await prisma.workflowTask.deleteMany({
          where: { workflowInstanceId: workflowId }
        });
        await prisma.auditEvent.deleteMany({
          where: {
            entityType: "WorkflowInstance",
            entityId: workflowId
          }
        });
        if (workflowInvocationIds.length > 0) {
          await prisma.actionResult.deleteMany({
            where: {
              invocationId: {
                in: workflowInvocationIds
              }
            }
          });
          await prisma.actionInvocation.deleteMany({
            where: {
              id: {
                in: workflowInvocationIds
              }
            }
          });
        }
        await prisma.workflowInstance.deleteMany({
          where: { id: workflowId }
        });
      }
    }
  });
});

describe("cli offboarding transitions", () => {
  it("requires approval before finance approve and archive execute via CLI", async () => {
    let createInvocationId: string | undefined;
    let approveHrInvocationId: string | undefined;
    let approveManagerInvocationId: string | undefined;
    let financeBlockedInvocationId: string | undefined;
    let financeApprovalInvocationId: string | undefined;
    let approveFinanceInvocationId: string | undefined;
    let archiveBlockedInvocationId: string | undefined;
    let archiveApprovalInvocationId: string | undefined;
    let archiveInvocationId: string | undefined;
    let financeApprovalRequestId: string | undefined;
    let archiveApprovalRequestId: string | undefined;
    let workflowId: string | undefined;

    try {
      const createResult = await runCli([
        "offboarding",
        "create",
        "--actor-id",
        "seed-employee",
        "--employee-id",
        "self",
        "--planned-last-day",
        "2026-07-01",
        "--resignation-reason",
        "personal",
        "--output",
        "json"
      ]);
      createInvocationId = createResult.invocationId;

      expect(createResult.status).toBe("succeeded");
      workflowId = String(createResult.result.businessObjectId);

      const approveHrResult = await runCli([
        "offboarding",
        "approve-hr",
        "--actor-id",
        "seed-hr",
        "--workflow-instance-id",
        workflowId,
        "--output",
        "json"
      ]);
      approveHrInvocationId = approveHrResult.invocationId;

      expect(approveHrResult.status).toBe("succeeded");
      expect(approveHrResult.result).toMatchObject({
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflowId
      });

      const approveManagerResult = await runCli([
        "offboarding",
        "approve-manager",
        "--actor-id",
        "seed-manager",
        "--workflow-instance-id",
        workflowId,
        "--output",
        "json"
      ]);
      approveManagerInvocationId = approveManagerResult.invocationId;

      expect(approveManagerResult.status).toBe("succeeded");
      expect(approveManagerResult.result).toMatchObject({
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflowId
      });

      const financeAttempt = await runCli([
        "offboarding",
        "approve-finance",
        "--actor-id",
        "seed-finance",
        "--workflow-instance-id",
        workflowId,
        "--output",
        "json"
      ]);
      financeBlockedInvocationId = financeAttempt.invocationId;
      financeApprovalRequestId = String(financeAttempt.result.approvalRequestId ?? "");

      expect(financeAttempt.status).toBe("blocked");
      expect(financeAttempt.result).toMatchObject({
        success: false,
        code: "approval_required",
        approvalType: "OFFBOARDING_FINANCE_APPROVAL",
        approvalStatus: "PENDING",
        targetResource: `workflow:${workflowId}`
      });
      expect(financeAttempt.result.approvalRequestId).toEqual(expect.any(String));

      const workflowAfterFinanceBlock = await prisma.workflowInstance.findUniqueOrThrow({
        where: { id: workflowId }
      });

      expect(workflowAfterFinanceBlock.status).toBe("MANAGER_CONFIRM");

      const financeApprovalResult = await runCli([
        "approval",
        "approve",
        "--actor-id",
        "seed-admin",
        "--approval-request-id",
        financeApprovalRequestId,
        "--output",
        "json"
      ]);
      financeApprovalInvocationId = financeApprovalResult.invocationId;

      expect(financeApprovalResult.status).toBe("succeeded");
      expect(financeApprovalResult.result).toMatchObject({
        id: financeApprovalRequestId,
        approvalStatus: "APPROVED",
        approvalType: "OFFBOARDING_FINANCE_APPROVAL"
      });

      const approveFinanceResult = await runCli([
        "offboarding",
        "approve-finance",
        "--actor-id",
        "seed-finance",
        "--workflow-instance-id",
        workflowId,
        "--output",
        "json"
      ]);
      approveFinanceInvocationId = approveFinanceResult.invocationId;

      expect(approveFinanceResult.status).toBe("succeeded");
      expect(approveFinanceResult.invocationId).toEqual(expect.any(String));
      expect(approveFinanceResult.traceId).toEqual(expect.any(String));
      expect(approveFinanceResult.result).toMatchObject({
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflowId
      });

      const archiveAttempt = await runCli([
        "offboarding",
        "archive",
        "--actor-id",
        "seed-finance",
        "--workflow-instance-id",
        workflowId,
        "--output",
        "json"
      ]);
      archiveBlockedInvocationId = archiveAttempt.invocationId;
      archiveApprovalRequestId = String(archiveAttempt.result.approvalRequestId ?? "");

      expect(archiveAttempt.status).toBe("blocked");
      expect(archiveAttempt.result).toMatchObject({
        success: false,
        code: "approval_required",
        approvalType: "OFFBOARDING_ARCHIVE_APPROVAL",
        approvalStatus: "PENDING",
        targetResource: `workflow:${workflowId}`
      });
      expect(archiveAttempt.result.approvalRequestId).toEqual(expect.any(String));

      const workflowAfterArchiveBlock = await prisma.workflowInstance.findUniqueOrThrow({
        where: { id: workflowId }
      });

      expect(workflowAfterArchiveBlock.status).toBe("FINANCE_CONFIRM");

      const archiveApprovalResult = await runCli([
        "approval",
        "approve",
        "--actor-id",
        "seed-admin",
        "--approval-request-id",
        archiveApprovalRequestId,
        "--output",
        "json"
      ]);
      archiveApprovalInvocationId = archiveApprovalResult.invocationId;

      expect(archiveApprovalResult.status).toBe("succeeded");
      expect(archiveApprovalResult.result).toMatchObject({
        id: archiveApprovalRequestId,
        approvalStatus: "APPROVED",
        approvalType: "OFFBOARDING_ARCHIVE_APPROVAL"
      });

      const archiveResult = await runCli([
        "offboarding",
        "archive",
        "--actor-id",
        "seed-finance",
        "--workflow-instance-id",
        workflowId,
        "--output",
        "json"
      ]);
      archiveInvocationId = archiveResult.invocationId;

      expect(archiveResult.status).toBe("succeeded");
      expect(archiveResult.result).toMatchObject({
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflowId
      });

      const workflow = await prisma.workflowInstance.findUniqueOrThrow({
        where: { id: workflowId },
        include: {
          tasks: {
            orderBy: { taskCode: "asc" }
          },
          events: {
            orderBy: { occurredAt: "asc" }
          }
        }
      });

      expect(workflow.businessObjectType).toBe("offboarding_case");
      expect(workflow.status).toBe("ARCHIVED");
      expect(workflow.tasks.map((task) => task.taskCode)).toEqual([
        "offboarding.approve_finance",
        "offboarding.approve_hr",
        "offboarding.approve_manager",
        "offboarding.archive",
        "offboarding.submit"
      ]);
      expect(workflow.events.filter((event) => event.eventType === "state_transition_applied")).toHaveLength(6);
    } finally {
      if (archiveApprovalRequestId) {
        await prisma.approvalRequest.deleteMany({
          where: { id: archiveApprovalRequestId }
        });
      }
      if (financeApprovalRequestId) {
        await prisma.approvalRequest.deleteMany({
          where: { id: financeApprovalRequestId }
        });
      }
      await cleanupCliInvocation(archiveInvocationId);
      await cleanupCliInvocation(archiveApprovalInvocationId);
      await cleanupCliInvocation(archiveBlockedInvocationId);
      await cleanupCliInvocation(approveFinanceInvocationId);
      await cleanupCliInvocation(financeApprovalInvocationId);
      await cleanupCliInvocation(financeBlockedInvocationId);
      await cleanupCliInvocation(approveManagerInvocationId);
      await cleanupCliInvocation(approveHrInvocationId);
      await cleanupCliInvocation(createInvocationId);

      if (workflowId) {
        const workflowInvocationIds = (
          await prisma.actionResult.findMany({
            where: {
              businessObjectType: "workflow_instance",
              businessObjectId: workflowId
            },
            select: {
              invocationId: true
            }
          })
        ).map((item) => item.invocationId);

        await prisma.taskArtifact.deleteMany({
          where: {
            task: {
              workflowInstanceId: workflowId
            }
          }
        });
        await prisma.workflowEvent.deleteMany({
          where: { workflowInstanceId: workflowId }
        });
        await prisma.workflowTask.deleteMany({
          where: { workflowInstanceId: workflowId }
        });
        await prisma.auditEvent.deleteMany({
          where: {
            entityType: "WorkflowInstance",
            entityId: workflowId
          }
        });
        if (workflowInvocationIds.length > 0) {
          await prisma.actionResult.deleteMany({
            where: {
              invocationId: {
                in: workflowInvocationIds
              }
            }
          });
          await prisma.actionInvocation.deleteMany({
            where: {
              id: {
                in: workflowInvocationIds
              }
            }
          });
        }
        await prisma.workflowInstance.deleteMany({
          where: { id: workflowId }
        });
      }
    }
  });
});
