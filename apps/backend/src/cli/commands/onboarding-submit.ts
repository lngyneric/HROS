import type { RoleCode } from "@prisma/client";
import { submitOnboardingDraft } from "../../modules/onboarding/onboarding.actions.js";
import {
  beginCliCommandExecution,
  blockCliCommand,
  completeCliCommand,
  failCliCommand,
  resolveWorkflowInstanceId,
  type CliContext
} from "../context.js";

export async function runOnboardingSubmitCommand(context: CliContext) {
  const workflowInstanceId = resolveWorkflowInstanceId(context);
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "onboarding.submit",
    inputPayloadJson: {
      workflowInstanceId
    }
  });

  if (!execution.risk.canProceed) {
    return blockCliCommand(execution, {
      targetResource: `workflow:${workflowInstanceId}`,
      code: execution.risk.blockingReason ?? "approval_required",
      message: "命令因风险策略被阻断"
    });
  }

  try {
    const action = await submitOnboardingDraft({
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
