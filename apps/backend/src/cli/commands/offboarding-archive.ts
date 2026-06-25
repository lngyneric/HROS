import { archiveOffboardingCase } from "../../modules/offboarding/offboarding.actions.js";
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

export async function runOffboardingArchiveCommand(context: CliContext) {
  const workflowInstanceId = resolveWorkflowInstanceId(context);
  const targetResource = buildWorkflowTargetResource(workflowInstanceId);
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "offboarding.archive",
    inputPayloadJson: {
      workflowInstanceId,
      targetResource
    }
  });

  if (!execution.risk.canProceed && execution.risk.blockingReason !== "approval_required") {
    return blockCliCommand(execution, {
      targetResource,
      code: execution.risk.blockingReason ?? "approval_required",
      message: "offboarding archive 需要审批后才能继续",
      implementationStatus: "blocked"
    });
  }

  const blockedResponse = await requireApprovalToProceed(execution, {
    targetResource,
    message: "offboarding archive 需要审批后才能继续",
    implementationStatus: "blocked"
  });

  if (blockedResponse) {
    return blockedResponse;
  }

  try {
    const action = await archiveOffboardingCase({
      workflowInstanceId,
      actorUserId: context.actor.id,
      actorType: context.actionActorType,
      requestId: `${execution.invocation.requestId}:action`,
      idempotencyKey: `${execution.invocation.idempotencyKey}:action`
    });

    return completeCliCommand(execution, action);
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
