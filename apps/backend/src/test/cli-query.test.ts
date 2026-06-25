import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { writeCliAuditEvent } from "../audit/audit.js";
import { createCliInvocation } from "../cli/invocation/create-cli-invocation.js";
import { finalizeCliInvocation } from "../cli/invocation/finalize-cli-invocation.js";
import { runCli } from "../cli/main.js";
import { prisma } from "../db/prisma.js";

async function createFixtureInvocation() {
  const suffix = randomUUID();
  const traceId = `trace-cli-query-${suffix}`;
  const businessObjectId = `workflow-cli-query-${suffix}`;

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

  const finalized = await finalizeCliInvocation({
    invocationId: invocation.id,
    success: true,
    businessObjectType: "workflow_instance",
    businessObjectId,
    outputPayloadJson: {
      workflowInstanceId: businessObjectId
    },
    resultSummary: "fixture invocation ready"
  });

  const auditEvent = await writeCliAuditEvent({
    invocationId: invocation.id,
    traceId,
    actorType: "human",
    actorId: "seed-admin",
    entityType: "workflow_instance",
    entityId: businessObjectId,
    operation: "READ",
    afterJson: {
      workflowInstanceId: businessObjectId,
      containsPii: true
    },
    requestId: invocation.requestId
  });

  return {
    invocationId: invocation.id,
    resultId: finalized.result?.id ?? null,
    auditEventId: auditEvent.id,
    businessObjectId
  };
}

async function cleanupInvocation(invocationId: string | undefined) {
  if (!invocationId) {
    return;
  }

  await prisma.securityEvent.deleteMany({
    where: { invocationId }
  });
  await prisma.auditEvent.deleteMany({
    where: { invocationId }
  });
  await prisma.actionResult.deleteMany({
    where: { invocationId }
  });
  await prisma.actionInvocation.deleteMany({
    where: { id: invocationId }
  });
}

describe("cli query commands", () => {
  it("lists action invocations in structured JSON output", async () => {
    const fixture = await createFixtureInvocation();
    let queryInvocationId: string | undefined;

    try {
      const result = await runCli([
        "action",
        "list",
        "--actor-id",
        "seed-admin",
        "--limit",
        "10",
        "--output",
        "json"
      ]);

      queryInvocationId = result.invocationId;

      expect(result.status).toBe("succeeded");
      expect(result.events[0]?.eventType).toBe("command_received");
      expect(result.result).toMatchObject({
        items: expect.any(Array),
        limit: 10
      });
      expect(
        (result.result.items as Array<{ id: string }>).some((item) => item.id === fixture.invocationId)
      ).toBe(true);
    } finally {
      await cleanupInvocation(queryInvocationId);
      await prisma.auditEvent.deleteMany({
        where: { id: fixture.auditEventId }
      });
      await cleanupInvocation(fixture.invocationId);
    }
  });

  it("gets a single invocation and logs sensitive reads", async () => {
    const fixture = await createFixtureInvocation();
    let queryInvocationId: string | undefined;

    try {
      const result = await runCli([
        "action",
        "get",
        "--actor-id",
        "seed-admin",
        "--id",
        fixture.invocationId,
        "--output",
        "json"
      ]);

      queryInvocationId = result.invocationId;

      expect(result.status).toBe("succeeded");
      expect(result.result).toMatchObject({
        item: {
          id: fixture.invocationId
        }
      });
      expect(result.events.some((event) => event.eventType === "security_event_written")).toBe(true);

      const securityEvent = await prisma.securityEvent.findFirstOrThrow({
        where: {
          invocationId: queryInvocationId
        },
        orderBy: {
          occurredAt: "desc"
        }
      });

      expect(securityEvent.eventType).toBe("READ_SENSITIVE_DATA");
      expect(securityEvent.targetResource).toBe(`action_invocation:${fixture.invocationId}`);
    } finally {
      await cleanupInvocation(queryInvocationId);
      await prisma.auditEvent.deleteMany({
        where: { id: fixture.auditEventId }
      });
      await cleanupInvocation(fixture.invocationId);
    }
  });

  it("lists audit events and logs sensitive reads when filters narrow to a target entity", async () => {
    const fixture = await createFixtureInvocation();
    let queryInvocationId: string | undefined;

    try {
      const result = await runCli([
        "audit",
        "list",
        "--actor-id",
        "seed-admin",
        "--entity-type",
        "workflow_instance",
        "--entity-id",
        fixture.businessObjectId,
        "--output",
        "json"
      ]);

      queryInvocationId = result.invocationId;

      expect(result.status).toBe("succeeded");
      expect(result.result).toMatchObject({
        items: expect.any(Array)
      });
      expect(
        (result.result.items as Array<{ id: string }>).some((item) => item.id === fixture.auditEventId)
      ).toBe(true);
      expect(result.events.some((event) => event.eventType === "security_event_written")).toBe(true);

      const securityEvent = await prisma.securityEvent.findFirstOrThrow({
        where: {
          invocationId: queryInvocationId
        },
        orderBy: {
          occurredAt: "desc"
        }
      });

      expect(securityEvent.eventType).toBe("READ_SENSITIVE_DATA");
      expect(securityEvent.targetResource).toBe(
        `audit_events:workflow_instance:${fixture.businessObjectId}`
      );
    } finally {
      await cleanupInvocation(queryInvocationId);
      await prisma.auditEvent.deleteMany({
        where: { id: fixture.auditEventId }
      });
      await cleanupInvocation(fixture.invocationId);
    }
  });

  it("returns the current actor profile for auth whoami", async () => {
    let queryInvocationId: string | undefined;

    try {
      const result = await runCli([
        "auth",
        "whoami",
        "--actor-id",
        "seed-admin",
        "--output",
        "json"
      ]);

      queryInvocationId = result.invocationId;

      expect(result.status).toBe("succeeded");
      expect(result.result).toMatchObject({
        actor: {
          id: "seed-admin",
          role: "ADMIN",
          displayName: "Admin"
        }
      });
      expect(result.events.some((event) => event.eventType === "query_completed")).toBe(true);
    } finally {
      await cleanupInvocation(queryInvocationId);
    }
  });
});
