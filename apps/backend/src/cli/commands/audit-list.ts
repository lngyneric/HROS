import {
  beginCliCommandExecution,
  completeCliQueryCommand,
  failCliCommand,
  recordSensitiveReadSecurityEvent,
  type CliContext,
  CliUsageError
} from "../context.js";
import { createCliEvent } from "../output.js";
import { getFlagString } from "../parser.js";
import { listAuditEvents } from "../query/audit-query.js";

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

export async function runAuditListCommand(context: CliContext) {
  const limit = resolveLimit(context);
  const filters = {
    entityType: getFlagString(context.parsed.flags, "entity-type", "entityType"),
    entityId: getFlagString(context.parsed.flags, "entity-id", "entityId"),
    actorId: getFlagString(context.parsed.flags, "event-actor-id", "eventActorId"),
    invocationId: getFlagString(context.parsed.flags, "invocation-id", "invocationId"),
    operation: getFlagString(context.parsed.flags, "operation")
  };
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "audit.audit_list",
    actionName: "查询审计事件列表",
    domainType: "AUDIT",
    allowCreateActionDefinition: true,
    inputPayloadJson: {
      ...filters,
      limit
    }
  });

  try {
    const items = toPlainJson(
      await listAuditEvents({
        ...filters,
        limit
      })
    );

    const extraEvents = [];
    const touchesSensitiveContext = Boolean(filters.entityId || filters.invocationId || filters.actorId);

    if (touchesSensitiveContext) {
      const targetResource = filters.entityId
        ? `audit_events:${filters.entityType ?? "unknown"}:${filters.entityId}`
        : filters.invocationId
          ? `audit_events:invocation:${filters.invocationId}`
          : `audit_events:actor:${filters.actorId}`;
      const securityEvent = await recordSensitiveReadSecurityEvent(execution, {
        targetResource,
        detailsJson: {
          queryName: "audit_list",
          filters
        }
      });

      extraEvents.push(
        createCliEvent("security_event_written", "ok", {
          securityEventId: securityEvent.id,
          eventType: securityEvent.eventType,
          targetResource: securityEvent.targetResource
        })
      );
    }

    extraEvents.push(
      createCliEvent("query_completed", "ok", {
        queryName: "audit_list",
        count: items.length,
        limit,
        filters
      })
    );

    return completeCliQueryCommand(execution, {
      businessObjectType: "audit_event_list",
      businessObjectId: filters.entityId ?? filters.invocationId ?? filters.actorId ?? `limit:${limit}`,
      result: {
        items,
        filters,
        limit
      },
      resultSummary: "audit list query completed",
      extraEvents
    });
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
