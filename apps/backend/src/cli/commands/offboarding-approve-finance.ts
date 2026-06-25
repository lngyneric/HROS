import type { RoleCode } from "@prisma/client";
import { approveOffboardingByFinance } from "../../modules/offboarding/offboarding.actions.js";
import {
  beginCliCommandExecution,
  buildWorkflowTargetResource,
  blockCliCommand,
  completeCliCommand,
  failCliCommand,
  requireApprovalToProceed,
  resolveWorkflowInstanceId,
  type CliContext
} from "../context.js";

export async function runOffboardingApproveFinanceCommand(context: CliContext) {
  const workflowInstanceId = resolveWorkflowInstanceId(context);
  const targetResource = buildWorkflowTargetResource(workflowInstanceId);
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "offboarding.approve_finance",
    inputPayloadJson: {
      workflowInstanceId,
      targetResource
    }
  });

  if (!execution.risk.canProceed && execution.risk.blockingReason !== "approval_required") {
    return blockCliCommand(execution, {
      targetResource,
      code: execution.risk.blockingReason ?? "approval_required",
      message: "命令因风险策略被阻断"
    });
  }

  const blockedResponse = await requireApprovalToProceed(execution, {
    targetResource,
    message: "offboarding approve-finance 需要审批后才能继续"
  });

  if (blockedResponse) {
    return blockedResponse;
  }

  try {
    const action = await approveOffboardingByFinance({
      workflowInstanceId,
      actorUserId: context.actor.id,
      actorType: context.actionActorType,
      actorRole: context.actor.role as RoleCode,
      requestId: `${execution.invocation.requestId}:action`,
      idempotencyKey: `${execution.invocation.idempotencyKey}:action`
    });

    return completeCliCommand(execution, action);
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
