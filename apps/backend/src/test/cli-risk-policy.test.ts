import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { deriveApprovalPolicy } from "../cli/approval/approval-policy.js";
import { isExecutionBlocked } from "../cli/security/blocking.js";
import { evaluateRisk } from "../cli/risk/risk-evaluator.js";
import { prisma } from "../db/prisma.js";
import { writeSecurityEvent } from "../cli/security/security-event.js";

describe("cli risk evaluator", () => {
  it("explicitly marks offboarding archive as HIGH risk and approval-gated", () => {
    const result = evaluateRisk({
      commandName: "hros offboarding archive",
      actorRole: "PAYROLL_FINANCE",
      args: { workflowInstanceId: "wf-1" }
    });

    expect(result.riskLevel).toBe("HIGH");
    expect(result.requiresApproval).toBe(true);
    expect(result.canProceed).toBe(false);
    expect(result.blockingReason).toBe("approval_required");
    expect(result.approvalType).toBe("OFFBOARDING_ARCHIVE_APPROVAL");
    expect(isExecutionBlocked(result)).toBe(true);
  });

  it("blocks unknown commands as CRITICAL risk", () => {
    const result = evaluateRisk({
      commandName: "hros payroll delete-everything",
      actorRole: "ADMIN",
      args: {}
    });

    expect(result.riskLevel).toBe("CRITICAL");
    expect(result.requiresApproval).toBe(true);
    expect(result.canProceed).toBe(false);
    expect(result.blockingReason).toBe("unknown_command_risk");
    expect(result.approvalType).toBe("UNKNOWN_COMMAND");
    expect(isExecutionBlocked(result)).toBe(true);
  });

  it("translates approval metadata from risk evaluation", () => {
    const risk = evaluateRisk({
      commandName: "hros offboarding approve-finance",
      actorRole: "PAYROLL_FINANCE",
      args: { workflowInstanceId: "wf-2" }
    });

    expect(deriveApprovalPolicy(risk)).toEqual({
      requiresApproval: true,
      approvalType: "OFFBOARDING_FINANCE_APPROVAL",
      blockingReason: "approval_required"
    });
  });

  it("persists security events through the helper", async () => {
    const suffix = randomUUID();
    const requestId = `req-cli-risk-${suffix}`;
    const idempotencyKey = `idem-cli-risk-${suffix}`;
    const traceId = `trace-cli-risk-${suffix}`;

    const actionDefinition = await prisma.actionDefinition.findUniqueOrThrow({
      where: { actionCode: "onboarding.create" }
    });

    let invocationId: string | undefined;
    let securityEventId: string | undefined;

    try {
      const invocation = await prisma.actionInvocation.create({
        data: {
          actionDefinitionId: actionDefinition.id,
          requestId,
          idempotencyKey,
          actorType: "human",
          actorId: "seed-admin",
          channel: "cli",
          inputPayloadJson: { employeeId: "self" },
          status: "RUNNING",
          commandName: "hros offboarding archive",
          rawCommand: "hros offboarding archive --workflow-instance-id wf-risk",
          argsJson: { workflowInstanceId: "wf-risk" },
          traceId,
          clientVersion: "0.1.0",
          runtimeEnv: "test",
          hostname: "local-dev",
          operatorIp: "127.0.0.1",
          isDryRun: false,
          isInteractive: false,
          outputFormat: "json",
          riskLevel: "HIGH",
          requiresApproval: true,
          blockingReason: "approval_required"
        }
      });

      invocationId = invocation.id;

      const securityEvent = await writeSecurityEvent({
        invocationId: invocation.id,
        actorId: "seed-admin",
        eventType: "HIGH_RISK_COMMAND_BLOCKED",
        targetResource: "workflow:wf-risk",
        riskLevel: "HIGH",
        detailsJson: {
          commandName: "hros offboarding archive",
          blockingReason: "approval_required"
        }
      });

      securityEventId = securityEvent.id;

      const storedEvent = await prisma.securityEvent.findUniqueOrThrow({
        where: { id: securityEvent.id }
      });

      expect(storedEvent.actorId).toBe("seed-admin");
      expect(storedEvent.eventType).toBe("HIGH_RISK_COMMAND_BLOCKED");
      expect(storedEvent.targetResource).toBe("workflow:wf-risk");
      expect(storedEvent.riskLevel).toBe("HIGH");
      expect(storedEvent.resolutionStatus).toBe("OPEN");
      expect(storedEvent.detailsJson).toMatchObject({
        commandName: "hros offboarding archive",
        blockingReason: "approval_required"
      });
    } finally {
      if (securityEventId) {
        await prisma.securityEvent.delete({ where: { id: securityEventId } });
      }
      if (invocationId) {
        await prisma.actionInvocation.delete({ where: { id: invocationId } });
      }
    }
  });
});
