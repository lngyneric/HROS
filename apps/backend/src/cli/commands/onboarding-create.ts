import { createOnboardingDraft } from "../../modules/onboarding/onboarding.actions.js";
import {
  beginCliCommandExecution,
  blockCliCommand,
  completeCliCommand,
  failCliCommand,
  resolveEmployeeId,
  type CliContext
} from "../context.js";

export async function runOnboardingCreateCommand(context: CliContext) {
  const employeeId = resolveEmployeeId(context);
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "onboarding.create",
    inputPayloadJson: {
      employeeId
    }
  });

  if (!execution.risk.canProceed) {
    return blockCliCommand(execution, {
      targetResource: `employee:${employeeId}`,
      code: execution.risk.blockingReason ?? "approval_required",
      message: "命令因风险策略被阻断"
    });
  }

  try {
    const action = await createOnboardingDraft({
      actorUserId: context.actor.id,
      actorType: context.actionActorType,
      employeeId,
      requestId: `${execution.invocation.requestId}:action`,
      idempotencyKey: `${execution.invocation.idempotencyKey}:action`
    });

    return completeCliCommand(execution, action);
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
