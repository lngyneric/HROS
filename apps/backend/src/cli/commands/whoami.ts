import {
  beginCliCommandExecution,
  completeCliQueryCommand,
  failCliCommand,
  type CliContext
} from "../context.js";
import { createCliEvent } from "../output.js";

function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function runWhoAmICommand(context: CliContext) {
  const execution = await beginCliCommandExecution({
    context,
    actionCode: "system.auth_whoami",
    actionName: "查询当前登录身份",
    domainType: "SYSTEM",
    allowCreateActionDefinition: true,
    inputPayloadJson: {
      actorId: context.actor.id
    }
  });

  try {
    return completeCliQueryCommand(execution, {
      businessObjectType: "actor_profile",
      businessObjectId: context.actor.id,
      result: {
        actor: toPlainJson({
          id: context.actor.id,
          role: context.actor.role,
          displayName: context.actor.displayName,
          employeeId: context.actor.employeeId
        })
      },
      resultSummary: "whoami query completed",
      extraEvents: [
        createCliEvent("query_completed", "ok", {
          queryName: "auth_whoami",
          actorId: context.actor.id
        })
      ]
    });
  } catch (error) {
    return failCliCommand(execution, error);
  }
}
