import {
  beginCliCommandExecution,
  blockCliCommand,
  completeCliCommand,
  failCliCommand,
  resolveEmployeeId,
  type CliContext
} from "../context.js";
import { getFlagString } from "../parser.js";
import { createOffboardingDraft, submitOffboardingDraft } from "../../modules/offboarding/offboarding.actions.js";
import type { ActionEnvelope } from "../../modules/actions/action.types.js";
import type { RoleCode } from "@prisma/client";

function combineActionEnvelopes(...envelopes: ActionEnvelope[]): ActionEnvelope {
  return {
    events: envelopes.flatMap((envelope) => envelope.events),
    result: envelopes[envelopes.length - 1]!.result
  };
}

export async function runOffboardingCreateCommand(context: CliContext) {
  const employeeId = resolveEmployeeId(context);
  const plannedLastDay = getFlagString(context.parsed.flags, "planned-last-day", "plannedLastDay");
  const resignationReason = getFlagString(context.parsed.flags, "resignation-reason", "resignationReason");
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "offboarding.create",
    inputPayloadJson: {
      employeeId,
      plannedLastDay: plannedLastDay ?? null,
      resignationReason: resignationReason ?? null
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
    const draft = await createOffboardingDraft({
      actorUserId: context.actor.id,
      actorType: context.actionActorType,
      employeeId,
      plannedLastDay,
      resignationReason,
      requestId: `${execution.invocation.requestId}:draft`,
      idempotencyKey: `${execution.invocation.idempotencyKey}:draft`
    });
    const workflowInstanceId = String(draft.result.businessObjectId);
    const submit = await submitOffboardingDraft({
      workflowInstanceId,
      actorUserId: context.actor.id,
      actorType: context.actionActorType,
      actorRole: context.actor.role as RoleCode,
      requestId: `${execution.invocation.requestId}:submit`,
      idempotencyKey: `${execution.invocation.idempotencyKey}:submit`
    });

    return completeCliCommand(execution, combineActionEnvelopes(draft, submit));
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
