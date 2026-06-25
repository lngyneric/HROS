import { RoleCode } from "@prisma/client";
import {
  beginCliCommandExecution,
  completeCliQueryCommand,
  failCliCommand,
  requireFlagString,
  type CliContext
} from "../context.js";
import { rejectApprovalRequest } from "../approval/approval-service.js";
import { createCliEvent } from "../output.js";
import { getFlagString } from "../parser.js";

export async function runApprovalRejectCommand(context: CliContext) {
  const approvalRequestId = requireFlagString(context.parsed.flags, "approval-request-id", "approvalRequestId");
  const decisionReason = getFlagString(context.parsed.flags, "reason");
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "approval.reject",
    actionName: "拒绝审批请求",
    domainType: "AUDIT",
    allowCreateActionDefinition: true,
    inputPayloadJson: {
      approvalRequestId,
      decision: "REJECTED",
      ...(decisionReason ? { decisionReason } : {})
    }
  });

  try {
    const approval = await rejectApprovalRequest({
      approvalRequestId,
      actorId: context.actor.id,
      actorRole: context.actor.role as RoleCode,
      decisionReason
    });

    return completeCliQueryCommand(execution, {
      businessObjectType: "approval_request",
      businessObjectId: approval.id,
      result: approval,
      resultSummary: "approval request rejected",
      extraEvents: [
        createCliEvent("approval_request_updated", "ok", {
          approvalRequestId: approval.id,
          approvalStatus: approval.approvalStatus,
          approvalType: approval.approvalType,
          targetResource: approval.targetResource
        })
      ]
    });
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
