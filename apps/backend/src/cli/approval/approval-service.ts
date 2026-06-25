import { ApprovalStatus, Prisma, RoleCode } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { extractApprovalTargetResources } from "./approval-resolver.js";

const approvalInclude = {
  invocation: {
    select: {
      id: true,
      commandName: true,
      traceId: true,
      requestId: true,
      actorId: true,
      inputPayloadJson: true
    }
  }
} satisfies Prisma.ApprovalRequestInclude;

type ApprovalRequestWithInvocation = Prisma.ApprovalRequestGetPayload<{
  include: typeof approvalInclude;
}>;

function canManageApproval(input: {
  actorId: string;
  actorRole: RoleCode;
  approval: Pick<ApprovalRequestWithInvocation, "approverId" | "approverRole">;
}) {
  return (
    input.actorRole === "ADMIN" ||
    input.approval.approverId === input.actorId ||
    input.approval.approverRole === input.actorRole
  );
}

export function toApprovalRequestView(record: ApprovalRequestWithInvocation) {
  const targetResources = extractApprovalTargetResources(record.invocation.inputPayloadJson);

  return {
    id: record.id,
    invocationId: record.invocationId,
    approvalType: record.approvalType,
    approvalStatus: record.approvalStatus,
    approverId: record.approverId,
    approverRole: record.approverRole,
    requestedAt: record.requestedAt.toISOString(),
    decisionAt: record.decisionAt?.toISOString() ?? null,
    decisionReason: record.decisionReason ?? null,
    targetResource: targetResources[0] ?? null,
    targetResources,
    commandName: record.invocation.commandName ?? null,
    traceId: record.invocation.traceId ?? null,
    requestId: record.invocation.requestId ?? null,
    requestedBy: record.invocation.actorId
  };
}

export async function listApprovalRequests(input: {
  actorId: string;
  actorRole: RoleCode;
  limit?: number;
  approvalStatuses?: ApprovalStatus[];
}) {
  const where: Prisma.ApprovalRequestWhereInput =
    input.actorRole === "ADMIN"
      ? {}
      : {
          OR: [{ approverId: input.actorId }, { approverRole: input.actorRole }]
        };

  if (input.approvalStatuses?.length) {
    where.approvalStatus = {
      in: input.approvalStatuses
    };
  }

  const items = await prisma.approvalRequest.findMany({
    where,
    include: approvalInclude,
    orderBy: [{ requestedAt: "desc" }],
    take: input.limit ?? 50
  });

  return items.map(toApprovalRequestView);
}

async function decideApprovalRequest(input: {
  approvalRequestId: string;
  actorId: string;
  actorRole: RoleCode;
  approvalStatus: Extract<ApprovalStatus, "APPROVED" | "REJECTED">;
  decisionReason?: string;
}) {
  const record = await prisma.approvalRequest.findUnique({
    where: { id: input.approvalRequestId },
    include: approvalInclude
  });

  if (!record) {
    throw new Error(`approval_request_not_found:${input.approvalRequestId}`);
  }

  if (!canManageApproval({ actorId: input.actorId, actorRole: input.actorRole, approval: record })) {
    throw new Error(`approval_forbidden:${input.approvalRequestId}`);
  }

  if (record.approvalStatus !== "PENDING") {
    throw new Error(`approval_not_pending:${input.approvalRequestId}`);
  }

  const updated = await prisma.approvalRequest.update({
    where: { id: record.id },
    data: {
      approverId: input.actorId,
      approverRole: input.actorRole,
      approvalStatus: input.approvalStatus,
      decisionAt: new Date(),
      decisionReason:
        input.decisionReason ??
        (input.approvalStatus === "APPROVED" ? "approved_via_cli" : "rejected_via_cli")
    },
    include: approvalInclude
  });

  return toApprovalRequestView(updated);
}

export async function approveApprovalRequest(input: {
  approvalRequestId: string;
  actorId: string;
  actorRole: RoleCode;
  decisionReason?: string;
}) {
  return decideApprovalRequest({
    ...input,
    approvalStatus: "APPROVED"
  });
}

export async function rejectApprovalRequest(input: {
  approvalRequestId: string;
  actorId: string;
  actorRole: RoleCode;
  decisionReason?: string;
}) {
  return decideApprovalRequest({
    ...input,
    approvalStatus: "REJECTED"
  });
}

async function findApprovalRequestByTarget(input: {
  approvalType: string;
  targetResource: string;
  approvalStatuses: ApprovalStatus[];
}) {
  const items = await prisma.approvalRequest.findMany({
    where: {
      approvalType: input.approvalType,
      approvalStatus: {
        in: input.approvalStatuses
      }
    },
    include: approvalInclude,
    orderBy: [{ decisionAt: "desc" }, { requestedAt: "desc" }],
    take: 50
  });

  return (
    items.find((item) => extractApprovalTargetResources(item.invocation.inputPayloadJson).includes(input.targetResource)) ??
    null
  );
}

async function resolveDefaultApprovalApprover() {
  const approver = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: {
      id: "asc"
    }
  });

  if (!approver) {
    throw new Error("approval_approver_not_found");
  }

  return approver;
}

export async function resolveExecutionApproval(input: {
  invocationId: string;
  approvalType: string;
  targetResource: string;
}) {
  const approved = await findApprovalRequestByTarget({
    approvalType: input.approvalType,
    targetResource: input.targetResource,
    approvalStatuses: ["APPROVED"]
  });

  if (approved) {
    return {
      status: "approved" as const,
      approval: toApprovalRequestView(approved),
      created: false
    };
  }

  const pending = await findApprovalRequestByTarget({
    approvalType: input.approvalType,
    targetResource: input.targetResource,
    approvalStatuses: ["PENDING"]
  });

  if (pending) {
    return {
      status: "pending" as const,
      approval: toApprovalRequestView(pending),
      created: false
    };
  }

  const approver = await resolveDefaultApprovalApprover();
  const created = await prisma.approvalRequest.create({
    data: {
      invocationId: input.invocationId,
      approverRole: approver.role,
      approverId: approver.id,
      approvalStatus: "PENDING",
      approvalType: input.approvalType
    },
    include: approvalInclude
  });

  return {
    status: "pending" as const,
    approval: toApprovalRequestView(created),
    created: true
  };
}
