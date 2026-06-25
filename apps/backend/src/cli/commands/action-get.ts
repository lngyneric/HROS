import {
  beginCliCommandExecution,
  completeCliQueryCommand,
  failCliCommand,
  recordSensitiveReadSecurityEvent,
  requireFlagString,
  type CliContext,
  CliUsageError
} from "../context.js";
import { createCliEvent } from "../output.js";
import { getActionInvocation } from "../query/action-query.js";

function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function runActionGetCommand(context: CliContext) {
  const invocationId = requireFlagString(context.parsed.flags, "id");
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "audit.action_get",
    actionName: "查询动作执行详情",
    domainType: "AUDIT",
    allowCreateActionDefinition: true,
    inputPayloadJson: {
      invocationId
    }
  });

  try {
    const item = await getActionInvocation(invocationId);

    if (!item) {
      throw new CliUsageError("action_invocation_not_found", `未找到动作执行记录 ${invocationId}`);
    }

    const securityEvent = await recordSensitiveReadSecurityEvent(execution, {
      targetResource: `action_invocation:${invocationId}`,
      detailsJson: {
        queryName: "action_get",
        targetInvocationId: invocationId
      }
    });

    return completeCliQueryCommand(execution, {
      businessObjectType: "action_invocation",
      businessObjectId: invocationId,
      result: {
        item: toPlainJson(item)
      },
      resultSummary: "action get query completed",
      extraEvents: [
        createCliEvent("security_event_written", "ok", {
          securityEventId: securityEvent.id,
          eventType: securityEvent.eventType,
          targetResource: securityEvent.targetResource
        }),
        createCliEvent("query_completed", "ok", {
          queryName: "action_get",
          itemId: invocationId
        })
      ]
    });
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
