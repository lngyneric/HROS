import type { WorkflowDomainType } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import type { CliRiskLevel } from "../risk/risk.types.js";
import { makeIdempotencyKey, makeRequestId, makeTraceId } from "./cli-trace.js";

const prismaCompat = prisma as typeof prisma & Record<string, any>;

export type CreateCliInvocationInput = {
  actionCode: string;
  actionName?: string;
  domainType?: WorkflowDomainType;
  allowCreateActionDefinition?: boolean;
  actorId: string;
  actorType: string;
  commandName: string;
  rawCommand: string;
  argsJson: Record<string, unknown>;
  inputPayloadJson: Record<string, unknown>;
  traceId?: string;
  requestId?: string;
  idempotencyKey?: string;
  clientVersion?: string;
  runtimeEnv?: string;
  hostname?: string;
  operatorIp?: string;
  isDryRun?: boolean;
  isInteractive?: boolean;
  outputFormat?: string;
  riskLevel: CliRiskLevel;
  requiresApproval: boolean;
  blockingReason: string | null;
};

function inferDomainType(actionCode: string): WorkflowDomainType {
  if (actionCode.startsWith("audit.")) {
    return "AUDIT";
  }

  if (actionCode.startsWith("system.") || actionCode.startsWith("auth.")) {
    return "SYSTEM";
  }

  if (actionCode.startsWith("employee.")) {
    return "EMPLOYEE";
  }

  if (actionCode.startsWith("workflow.")) {
    return "WORKFLOW";
  }

  if (actionCode.startsWith("offboarding.")) {
    return "OFFBOARDING";
  }

  return "ONBOARDING";
}

export async function createCliInvocation(
  input: CreateCliInvocationInput,
  client: any = prismaCompat
) {
  let actionDefinition = await client.actionDefinition.findUnique({
    where: { actionCode: input.actionCode }
  });

  if (!actionDefinition) {
    if (!input.allowCreateActionDefinition) {
      throw new Error(`未找到动作定义: ${input.actionCode}`);
    }

    actionDefinition = await client.actionDefinition.upsert({
      where: { actionCode: input.actionCode },
      update: {},
      create: {
        actionCode: input.actionCode,
        actionName: input.actionName ?? input.commandName,
        domainType: input.domainType ?? inferDomainType(input.actionCode),
        inputSchemaJson: {
          type: "object",
          additionalProperties: true
        },
        outputSchemaJson: {
          type: "object",
          additionalProperties: true
        },
        requiresApproval: input.requiresApproval,
        isIdempotent: true
      }
    });
  }

  const traceId = input.traceId ?? makeTraceId();

  return client.actionInvocation.create({
    data: {
      actionDefinitionId: actionDefinition.id,
      requestId: input.requestId ?? makeRequestId(),
      idempotencyKey: input.idempotencyKey ?? makeIdempotencyKey(input.commandName, input.argsJson),
      actorType: input.actorType,
      actorId: input.actorId,
      channel: "cli",
      inputPayloadJson: input.inputPayloadJson,
      status: "RUNNING",
      commandName: input.commandName,
      rawCommand: input.rawCommand,
      argsJson: input.argsJson,
      traceId,
      clientVersion: input.clientVersion ?? null,
      runtimeEnv: input.runtimeEnv ?? null,
      hostname: input.hostname ?? null,
      operatorIp: input.operatorIp ?? null,
      isDryRun: input.isDryRun ?? false,
      isInteractive: input.isInteractive ?? false,
      outputFormat: input.outputFormat ?? "json",
      riskLevel: input.riskLevel,
      requiresApproval: input.requiresApproval,
      blockingReason: input.blockingReason
    }
  });
}
