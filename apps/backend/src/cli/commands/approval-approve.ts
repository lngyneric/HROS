import { RoleCode } from "@prisma/client";
import {
  beginCliCommandExecution,
  completeCliQueryCommand,
  failCliCommand,
  requireFlagString,
  type CliContext
} from "../context.js";
import { approveApprovalRequest } from "../approval/approval-service.js";
import { createCliEvent } from "../output.js";
import { getFlagString } from "../parser.js";

export async function runApprovalApproveCommand(context: CliContext) {
  const approvalRequestId = requireFlagString(context.parsed.flags, "approval-request-id", "approvalRequestId");
  const decisionReason = getFlagString(context.parsed.flags, "reason");
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "approval.approve",
    actionName: "批准审批请求",
    domainType: "AUDIT",
    allowCreateActionDefinition: true,
    inputPayloadJson: {
      approvalRequestId,
      decision: "APPROVED",
      ...(decisionReason ? { decisionReason } : {})
    }
  });

  try {
    const approval = await approveApprovalRequest({
      approvalRequestId,
      actorId: context.actor.id,
      actorRole: context.actor.role as RoleCode,
      decisionReason
    });

    return completeCliQueryCommand(execution, {
      businessObjectType: "approval_request",
      businessObjectId: approval.id,
      result: approval,
      resultSummary: "approval request approved",
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
