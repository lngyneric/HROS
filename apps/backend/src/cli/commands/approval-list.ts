import { RoleCode } from "@prisma/client";
import {
  beginCliCommandExecution,
  completeCliQueryCommand,
  failCliCommand,
  type CliContext,
  CliUsageError
} from "../context.js";
import { createCliEvent } from "../output.js";
import { getFlagString } from "../parser.js";
import { listApprovalRequests } from "../approval/approval-service.js";

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

export async function runApprovalListCommand(context: CliContext) {
  const limit = resolveLimit(context);
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "approval.list",
    actionName: "查询审批请求列表",
    domainType: "AUDIT",
    allowCreateActionDefinition: true,
    inputPayloadJson: {
      limit
    }
  });

  try {
    const items = await listApprovalRequests({
      actorId: context.actor.id,
      actorRole: context.actor.role as RoleCode,
      limit
    });

    return completeCliQueryCommand(execution, {
      businessObjectType: "approval_request_list",
      businessObjectId: `limit:${limit}`,
      result: {
        items,
        limit
      },
      resultSummary: "approval list query completed",
      extraEvents: [
        createCliEvent("query_completed", "ok", {
          queryName: "approval_list",
          count: items.length,
          limit
        })
      ]
    });
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
