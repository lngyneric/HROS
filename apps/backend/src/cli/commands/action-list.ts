import {
  beginCliCommandExecution,
  completeCliQueryCommand,
  failCliCommand,
  type CliContext,
  CliUsageError
} from "../context.js";
import { createCliEvent } from "../output.js";
import { getFlagString } from "../parser.js";
import { listActionInvocations } from "../query/action-query.js";

function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveLimit(context: CliContext) {
  const rawLimit = getFlagString(context.parsed.flags, "limit");

  if (!rawLimit) {
    return 50;
  }

  const limit = Number.parseInt(rawLimit, 10);

  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    throw new CliUsageError("invalid_limit", "limit 必须是 1 到 100 之间的整数");
  }

  return limit;
}

export async function runActionListCommand(context: CliContext) {
  const limit = resolveLimit(context);
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "audit.action_list",
    actionName: "查询动作执行列表",
    domainType: "AUDIT",
    allowCreateActionDefinition: true,
    inputPayloadJson: {
      limit
    }
  });

  try {
    const items = toPlainJson(await listActionInvocations({ limit }));

    return completeCliQueryCommand(execution, {
      businessObjectType: "action_invocation_list",
      businessObjectId: `limit:${limit}`,
      result: {
        items,
        limit
      },
      resultSummary: "action list query completed",
      extraEvents: [
        createCliEvent("query_completed", "ok", {
          queryName: "action_list",
          count: items.length,
          limit
        })
      ]
    });
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
