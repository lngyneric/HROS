import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";

describe("cli audit schema", () => {
  it("supports CLI invocation context and security events", async () => {
    const suffix = randomUUID();
    const requestId = `req-cli-schema-test-${suffix}`;
    const idempotencyKey = `idem-cli-schema-test-${suffix}`;
    const traceId = `trace-cli-schema-test-${suffix}`;
    const actionCode = `audit.list.${suffix}`;

    const actionDefinition = await prisma.actionDefinition.findUniqueOrThrow({
      where: { actionCode: "onboarding.create" }
    });
    const employee = await prisma.employeeMaster.findFirstOrThrow({
      where: { employeeNo: "E0002" }
    });
    const workflowTemplate = await prisma.workflowTemplate.findUniqueOrThrow({
      where: { templateCode: "ONBOARDING_STANDARD" }
    });

    let cliActionDefinitionId: string | undefined;
    let invocationId: string | undefined;
    let workflowId: string | undefined;
    let resultId: string | undefined;
    let approvalId: string | undefined;
    let auditEventId: string | undefined;
    let workflowEventId: string | undefined;
    let securityEventId: string | undefined;
    let compensationId: string | undefined;

    try {
      const cliActionDefinition = await prisma.actionDefinition.create({
        data: {
          actionCode,
          actionName: "审计查询",
          domainType: "AUDIT",
          inputSchemaJson: {
            type: "object",
            properties: {
              actorId: { type: "string" }
            },
            additionalProperties: false
          },
          outputSchemaJson: {
            type: "object",
            properties: {
              success: { type: "boolean" }
            },
            additionalProperties: true
          }
        }
      });
      cliActionDefinitionId = cliActionDefinition.id;

      const invocation = await prisma.actionInvocation.create({
        data: {
          actionDefinitionId: actionDefinition.id,
          requestId,
          idempotencyKey,
          actorType: "human",
          actorId: "seed-admin",
          channel: "cli",
          inputPayloadJson: { employeeId: employee.id },
          status: "RUNNING",
          commandName: "hros onboarding create",
          rawCommand: `hros onboarding create --employee-id ${employee.id}`,
          argsJson: { employeeId: employee.id },
          traceId,
          clientVersion: "0.1.0",
          runtimeEnv: "test",
          hostname: "local-dev",
          operatorIp: "127.0.0.1",
          isDryRun: false,
          isInteractive: false,
          outputFormat: "json",
          riskLevel: "LOW",
          requiresApproval: true,
          blockingReason: "approval_required"
        }
      });
      invocationId = invocation.id;

      const workflow = await prisma.workflowInstance.create({
        data: {
          templateId: workflowTemplate.id,
          employeeId: employee.id,
          businessObjectType: "onboarding_case",
          businessObjectId: `workflow-cli-schema-${suffix}`,
          status: "DRAFT",
          initiatedBy: "seed-admin"
        }
      });
      workflowId = workflow.id;

      const [result, approval, auditEvent, workflowEvent, securityEvent, compensation] = await Promise.all([
        prisma.actionResult.create({
          data: {
            invocationId: invocation.id,
            success: false,
            businessObjectType: "workflow_instance",
            businessObjectId: workflow.id,
            outputPayloadJson: { workflowInstanceId: workflow.id },
            errorCode: "approval_required",
            errorMessage: "approval required before execution",
            completedAt: new Date("2026-06-25T09:00:00.000Z"),
            resultSummary: "command blocked pending approval",
            errorStack: "Error: approval required"
          }
        }),
        prisma.approvalRequest.create({
          data: {
            invocationId: invocation.id,
            approverRole: "HR_SPECIALIST",
            approverId: "seed-hr",
            approvalStatus: "PENDING",
            approvalType: "ONBOARDING_CREATE_APPROVAL",
            requestedAt: new Date("2026-06-25T09:00:00.000Z")
          }
        }),
        prisma.auditEvent.create({
          data: {
            actorType: "human",
            actorId: "seed-admin",
            entityType: "WorkflowInstance",
            entityId: workflow.id,
            operation: "CREATE",
            beforeJson: undefined,
            afterJson: { workflowInstanceId: workflow.id },
            reason: "cli_schema_test",
            requestId,
            channel: "cli",
            invocationId: invocation.id,
            traceId
          }
        }),
        prisma.workflowEvent.create({
          data: {
            workflowInstanceId: workflow.id,
            eventType: "command_received",
            eventPayloadJson: { commandName: "hros onboarding create" },
            invocationId: invocation.id,
            requestId,
            traceId
          }
        }),
        prisma.securityEvent.create({
          data: {
            invocationId: invocation.id,
            actorId: "seed-admin",
            eventType: "HIGH_RISK_COMMAND_BLOCKED",
            targetResource: workflow.id,
            riskLevel: "HIGH",
            detailsJson: {
              reason: "approval_required"
            }
          }
        }),
        prisma.compensationAction.create({
          data: {
            sourceInvocationId: invocation.id,
            compensatingActionCode: "audit.rollback",
            payloadJson: { workflowInstanceId: workflow.id },
            status: "PENDING"
          }
        })
      ]);

      resultId = result.id;
      approvalId = approval.id;
      auditEventId = auditEvent.id;
      workflowEventId = workflowEvent.id;
      securityEventId = securityEvent.id;
      compensationId = compensation.id;

      const hydratedInvocation = await prisma.actionInvocation.findUniqueOrThrow({
        where: { id: invocation.id },
        include: {
          result: true,
          approvals: true,
          securityEvents: true,
          compensations: true,
          auditEvents: true,
          workflowEvents: true
        }
      });

      expect(cliActionDefinition.domainType).toBe("AUDIT");
      expect(hydratedInvocation.commandName).toBe("hros onboarding create");
      expect(hydratedInvocation.traceId).toBe(traceId);
      expect(hydratedInvocation.riskLevel).toBe("LOW");
      expect(hydratedInvocation.requiresApproval).toBe(true);
      expect(hydratedInvocation.blockingReason).toBe("approval_required");
      expect(hydratedInvocation.result?.completedAt.toISOString()).toBe("2026-06-25T09:00:00.000Z");
      expect(hydratedInvocation.result?.resultSummary).toBe("command blocked pending approval");
      expect(hydratedInvocation.result?.errorStack).toBe("Error: approval required");
      expect(hydratedInvocation.approvals[0]?.approvalType).toBe("ONBOARDING_CREATE_APPROVAL");
      expect(hydratedInvocation.approvals[0]?.requestedAt.toISOString()).toBe("2026-06-25T09:00:00.000Z");
      expect(hydratedInvocation.auditEvents[0]?.channel).toBe("cli");
      expect(hydratedInvocation.auditEvents[0]?.traceId).toBe(traceId);
      expect(hydratedInvocation.workflowEvents[0]?.requestId).toBe(requestId);
      expect(hydratedInvocation.securityEvents[0]?.eventType).toBe("HIGH_RISK_COMMAND_BLOCKED");
      expect(hydratedInvocation.securityEvents[0]?.resolutionStatus).toBe("OPEN");
      expect(hydratedInvocation.compensations[0]?.status).toBe("PENDING");
    } finally {
      if (compensationId) {
        await prisma.compensationAction.delete({ where: { id: compensationId } });
      }
      if (securityEventId) {
        await prisma.securityEvent.delete({ where: { id: securityEventId } });
      }
      if (workflowEventId) {
        await prisma.workflowEvent.delete({ where: { id: workflowEventId } });
      }
      if (auditEventId) {
        await prisma.auditEvent.delete({ where: { id: auditEventId } });
      }
      if (approvalId) {
        await prisma.approvalRequest.delete({ where: { id: approvalId } });
      }
      if (resultId) {
        await prisma.actionResult.delete({ where: { id: resultId } });
      }
      if (workflowId) {
        await prisma.workflowInstance.delete({ where: { id: workflowId } });
      }
      if (invocationId) {
        await prisma.actionInvocation.delete({ where: { id: invocationId } });
      }
      if (cliActionDefinitionId) {
        await prisma.actionDefinition.delete({ where: { id: cliActionDefinitionId } });
      }
    }
  });
});
