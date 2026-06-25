import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { writeCliAuditEvent } from "../audit/audit.js";
import {
  makeIdempotencyKey,
  makeRequestId,
  makeTraceId
} from "../cli/invocation/cli-trace.js";
import { createCliInvocation } from "../cli/invocation/create-cli-invocation.js";
import { finalizeCliInvocation } from "../cli/invocation/finalize-cli-invocation.js";
import { prisma } from "../db/prisma.js";

describe("cli invocation lifecycle", () => {
  it("creates a running invocation with CLI context fields and finalizes it with an action result", async () => {
    const suffix = randomUUID();
    const traceId = makeTraceId();
    const businessObjectId = `workflow-cli-invocation-${suffix}`;

    let invocationId: string | undefined;
    let auditEventId: string | undefined;
    let resultId: string | undefined;

    try {
      const invocation = await createCliInvocation({
        actionCode: "onboarding.create",
        actorId: "seed-admin",
        actorType: "human",
        commandName: "hros onboarding create",
        rawCommand: "hros onboarding create --employee-id emp_001",
        argsJson: { employeeId: "emp_001" },
        inputPayloadJson: { employeeId: "emp_001" },
        traceId,
        clientVersion: "0.1.0",
        runtimeEnv: "test",
        hostname: "local-dev",
        operatorIp: "127.0.0.1",
        isDryRun: false,
        isInteractive: false,
        outputFormat: "json",
        riskLevel: "LOW",
        requiresApproval: false,
        blockingReason: null
      });

      invocationId = invocation.id;

      expect(invocation.channel).toBe("cli");
      expect(invocation.status).toBe("RUNNING");
      expect(invocation.commandName).toBe("hros onboarding create");
      expect(invocation.traceId).toBe(traceId);
      expect(invocation.requestId).toMatch(/^req_/);
      expect(invocation.idempotencyKey).toContain("hros onboarding create");

      const finalized = await finalizeCliInvocation({
        invocationId: invocation.id,
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId,
        outputPayloadJson: {
          workflowInstanceId: businessObjectId
        },
        resultSummary: "cli command completed"
      });

      resultId = finalized.result?.id;

      expect(finalized.status).toBe("SUCCEEDED");
      expect(finalized.finishedAt).toBeTruthy();
      expect(finalized.result?.success).toBe(true);
      expect(finalized.result?.businessObjectId).toBe(businessObjectId);
      expect(finalized.result?.resultSummary).toBe("cli command completed");
      expect(finalized.result?.completedAt).toBeTruthy();

      const auditEvent = await writeCliAuditEvent({
        invocationId: invocation.id,
        traceId,
        actorType: "human",
        actorId: "seed-admin",
        entityType: "WorkflowInstance",
        entityId: businessObjectId,
        operation: "CREATE",
        afterJson: {
          workflowInstanceId: businessObjectId
        },
        requestId: invocation.requestId
      });

      auditEventId = auditEvent.id;

      const storedAuditEvent = await prisma.auditEvent.findUniqueOrThrow({
        where: { id: auditEvent.id }
      });

      expect(storedAuditEvent.channel).toBe("cli");
      expect(storedAuditEvent.invocationId).toBe(invocation.id);
      expect(storedAuditEvent.traceId).toBe(traceId);
      expect(storedAuditEvent.requestId).toBe(invocation.requestId);
    } finally {
      if (auditEventId) {
        await prisma.auditEvent.delete({ where: { id: auditEventId } });
      }
      if (resultId) {
        await prisma.actionResult.delete({ where: { id: resultId } });
      }
      if (invocationId) {
        await prisma.actionInvocation.delete({ where: { id: invocationId } });
      }
    }
  });

  it("creates trace identifiers and deterministic idempotency keys", () => {
    expect(makeTraceId()).toMatch(/^trace_/);
    expect(makeRequestId()).toMatch(/^req_/);
    expect(
      makeIdempotencyKey("hros onboarding create", {
        employeeId: "emp_001",
        dryRun: false
      })
    ).toBe('hros onboarding create:{"dryRun":false,"employeeId":"emp_001"}');
  });
});
