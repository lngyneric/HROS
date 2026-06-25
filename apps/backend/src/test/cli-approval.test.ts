import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ApprovalStatus } from "@prisma/client";
import { runCli } from "../cli/main.js";
import { resolveApprovalRequest } from "../cli/approval/approval-resolver.js";
import { createCliInvocation } from "../cli/invocation/create-cli-invocation.js";
import { prisma } from "../db/prisma.js";

async function createApprovalFixture(input?: {
  approvalType?: string;
  approvalStatus?: ApprovalStatus;
  approverId?: string;
  approverRole?: "ADMIN" | "HR_SPECIALIST" | "MANAGER" | "PAYROLL_FINANCE";
  targetResource?: string;
}) {
  const suffix = randomUUID();
  const targetResource = input?.targetResource ?? `workflow:cli-approval-${suffix}`;
  const invocation = await createCliInvocation({
    actionCode: "offboarding.archive",
    actorId: "seed-finance",
    actorType: "human",
    commandName: "hros offboarding archive",
    rawCommand: `hros offboarding archive --workflow-instance-id cli-approval-${suffix}`,
    argsJson: {
      workflowInstanceId: `cli-approval-${suffix}`
    },
    inputPayloadJson: {
      workflowInstanceId: `cli-approval-${suffix}`,
      targetResource
    },
    traceId: `trace-cli-approval-${suffix}`,
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
  });

  const approval = await prisma.approvalRequest.create({
    data: {
      invocationId: invocation.id,
      approverRole: input?.approverRole ?? "ADMIN",
      approverId: input?.approverId ?? "seed-admin",
      approvalStatus: input?.approvalStatus ?? "PENDING",
      approvalType: input?.approvalType ?? "OFFBOARDING_ARCHIVE_APPROVAL"
    }
  });

  return {
    invocationId: invocation.id,
    approvalId: approval.id,
    targetResource
  };
}

async function cleanupApprovalFixture(input: {
  invocationId?: string;
  approvalId?: string;
}) {
  if (input.approvalId) {
    await prisma.approvalRequest.deleteMany({
      where: { id: input.approvalId }
    });
  }

  if (input.invocationId) {
    await prisma.actionResult.deleteMany({
      where: { invocationId: input.invocationId }
    });
    await prisma.securityEvent.deleteMany({
      where: { invocationId: input.invocationId }
    });
    await prisma.auditEvent.deleteMany({
      where: { invocationId: input.invocationId }
    });
    await prisma.workflowEvent.deleteMany({
      where: { invocationId: input.invocationId }
    });
    await prisma.actionInvocation.deleteMany({
      where: { id: input.invocationId }
    });
  }
}

describe("cli approval commands", () => {
  it("requires explicit approval before offboarding archive executes", async () => {
    const workflowInstanceId = `wf-cli-archive-${randomUUID()}`;
    let blockedInvocationId: string | undefined;
    let approvalRequestId: string | undefined;

    try {
      const result = await runCli([
        "offboarding",
        "archive",
        "--actor-id",
        "seed-finance",
        "--workflow-instance-id",
        workflowInstanceId,
        "--output",
        "json"
      ]);
      blockedInvocationId = result.invocationId;
      approvalRequestId = String(result.result.approvalRequestId ?? "");

      expect(result.status).toBe("blocked");
      expect(result.result).toMatchObject({
        success: false,
        code: "approval_required",
        approvalType: "OFFBOARDING_ARCHIVE_APPROVAL",
        approvalStatus: "PENDING",
        targetResource: `workflow:${workflowInstanceId}`
      });
      expect(result.result.approvalRequestId).toEqual(expect.any(String));

      const pendingApproval = await prisma.approvalRequest.findUniqueOrThrow({
        where: { id: approvalRequestId }
      });

      expect(pendingApproval.approvalStatus).toBe("PENDING");
      expect(pendingApproval.approvalType).toBe("OFFBOARDING_ARCHIVE_APPROVAL");
      expect(pendingApproval.invocationId).toBe(blockedInvocationId);
    } finally {
      await cleanupApprovalFixture({
        approvalId: approvalRequestId,
        invocationId: blockedInvocationId
      });
    }
  });

  it("lists pending approval requests with the dedicated command", async () => {
    const fixture = await createApprovalFixture();
    let queryInvocationId: string | undefined;

    try {
      const result = await runCli(["approval", "list", "--actor-id", "seed-admin", "--output", "json"]);
      queryInvocationId = result.invocationId;

      expect(result.status).toBe("succeeded");
      expect(result.invocationId).toEqual(expect.any(String));
      expect(result.traceId).toEqual(expect.any(String));
      expect(result.result).toMatchObject({
        items: expect.any(Array),
        limit: 50
      });
      expect(
        (result.result.items as Array<{ id: string; approvalStatus: string }>).some(
          (item) => item.id === fixture.approvalId && item.approvalStatus === "PENDING"
        )
      ).toBe(true);
    } finally {
      await cleanupApprovalFixture({
        approvalId: fixture.approvalId,
        invocationId: fixture.invocationId
      });
      await cleanupApprovalFixture({
        invocationId: queryInvocationId
      });
    }
  });

  it("approves a pending request with a dedicated command", async () => {
    const fixture = await createApprovalFixture();
    let listInvocationId: string | undefined;
    let approveInvocationId: string | undefined;

    try {
      const listResult = await runCli(["approval", "list", "--actor-id", "seed-admin", "--output", "json"]);
      listInvocationId = listResult.invocationId;

      expect(listResult.status).toBe("succeeded");

      const pendingId = (
        listResult.result.items as Array<{ id: string; approvalStatus: string }>
      ).find((item) => item.id === fixture.approvalId && item.approvalStatus === "PENDING")?.id;

      expect(pendingId).toBe(fixture.approvalId);

      const approveResult = await runCli([
        "approval",
        "approve",
        "--actor-id",
        "seed-admin",
        "--approval-request-id",
        pendingId!,
        "--output",
        "json"
      ]);
      approveInvocationId = approveResult.invocationId;

      expect(approveResult.status).toBe("succeeded");
      expect(approveResult.result).toMatchObject({
        id: fixture.approvalId,
        approvalStatus: "APPROVED",
        approvalType: "OFFBOARDING_ARCHIVE_APPROVAL"
      });
    } finally {
      await cleanupApprovalFixture({
        approvalId: fixture.approvalId,
        invocationId: fixture.invocationId
      });
      await cleanupApprovalFixture({
        invocationId: listInvocationId
      });
      await cleanupApprovalFixture({
        invocationId: approveInvocationId
      });
    }
  });

  it("rejects a pending request with a dedicated command", async () => {
    const fixture = await createApprovalFixture();
    let rejectInvocationId: string | undefined;

    try {
      const result = await runCli([
        "approval",
        "reject",
        "--actor-id",
        "seed-admin",
        "--approval-request-id",
        fixture.approvalId,
        "--reason",
        "insufficient_controls",
        "--output",
        "json"
      ]);
      rejectInvocationId = result.invocationId;

      expect(result.status).toBe("succeeded");
      expect(result.result).toMatchObject({
        id: fixture.approvalId,
        approvalStatus: "REJECTED",
        decisionReason: "insufficient_controls"
      });
    } finally {
      await cleanupApprovalFixture({
        approvalId: fixture.approvalId,
        invocationId: fixture.invocationId
      });
      await cleanupApprovalFixture({
        invocationId: rejectInvocationId
      });
    }
  });

  it("resolves approval decisions generically by approval type and target resource", async () => {
    const fixture = await createApprovalFixture({
      approvalType: "SKILL_DEFINED_ARCHIVE_APPROVAL",
      approvalStatus: "APPROVED",
      targetResource: "skill-run:archive-001"
    });

    try {
      const resolved = await resolveApprovalRequest({
        approvalType: "SKILL_DEFINED_ARCHIVE_APPROVAL",
        targetResource: "skill-run:archive-001",
        approvalStatuses: ["APPROVED"]
      });

      expect(resolved?.id).toBe(fixture.approvalId);
      expect(resolved?.approvalStatus).toBe("APPROVED");
      expect(resolved?.approvalType).toBe("SKILL_DEFINED_ARCHIVE_APPROVAL");
    } finally {
      await cleanupApprovalFixture({
        approvalId: fixture.approvalId,
        invocationId: fixture.invocationId
      });
    }
  });
});
