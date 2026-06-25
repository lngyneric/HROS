import os from "node:os";
import type { WorkflowDomainType } from "@prisma/client";
import type { ActionEnvelope } from "../modules/actions/action.types.js";
import { resolveExecutionApproval } from "./approval/approval-service.js";
import { deriveApprovalPolicy } from "./approval/approval-policy.js";
import { createCliInvocation } from "./invocation/create-cli-invocation.js";
import { finalizeCliInvocation } from "./invocation/finalize-cli-invocation.js";
import { makeIdempotencyKey, makeTraceId } from "./invocation/cli-trace.js";
import { cliBlocked, cliSucceeded, createCliEvent, type CliCommandResponse, type CliOutputEvent } from "./output.js";
import { getFlagBoolean, getFlagString, type ParsedCliCommand } from "./parser.js";
import { evaluateRisk } from "./risk/risk-evaluator.js";
import type { CliRiskEvaluation } from "./risk/risk.types.js";
import { recordBlockedCommandSecurityEvent } from "./security/blocking.js";
import { writeSecurityEvent } from "./security/security-event.js";
import { prisma } from "../db/prisma.js";

type CliActor = {
  id: string;
  role: string;
  displayName: string;
  employeeId: string | null;
};

export type CliContext = {
  parsed: ParsedCliCommand;
  actor: CliActor;
  actorType: "human";
  actionActorType: "user";
  traceId: string;
  clientVersion: string;
  runtimeEnv: string;
  hostname: string;
  operatorIp: string;
  isDryRun: boolean;
  isInteractive: boolean;
  outputFormat: string;
};

export type CliCommandExecution = {
  context: CliContext;
  actionCode: string;
  inputPayloadJson: Record<string, unknown>;
  risk: CliRiskEvaluation;
  invocation: Awaited<ReturnType<typeof createCliInvocation>>;
  events: CliOutputEvent[];
};

export class CliUsageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CliUsageError";
    this.code = code;
  }
}

export async function createCliContext(parsed: ParsedCliCommand): Promise<CliContext> {
  const actorId = requireFlagString(parsed.flags, "actor-id", "actorId");
  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    include: {
      employee: true
    }
  });

  if (!actor) {
    throw new CliUsageError("actor_not_found", `未找到执行人 ${actorId}`);
  }

  return {
    parsed,
    actor: {
      id: actor.id,
      role: actor.role,
      displayName: actor.displayName,
      employeeId: actor.employeeId ?? null
    },
    actorType: "human",
    actionActorType: "user",
    traceId: makeTraceId(),
    clientVersion: process.env.npm_package_version ?? "0.1.0",
    runtimeEnv: process.env.NODE_ENV ?? "development",
    hostname: os.hostname(),
    operatorIp: "127.0.0.1",
    isDryRun: getFlagBoolean(parsed.flags, "dry-run", "dryRun"),
    isInteractive: false,
    outputFormat: getFlagString(parsed.flags, "output") ?? "json"
  };
}

export function requireFlagString(
  flags: ParsedCliCommand["flags"],
  ...names: string[]
): string {
  const value = getFlagString(flags, ...names);

  if (!value) {
    throw new CliUsageError("missing_required_flag", `缺少必填参数: ${names[0]}`);
  }

  return value;
}

export function resolveEmployeeId(context: CliContext): string {
  const employeeId = requireFlagString(context.parsed.flags, "employee-id", "employeeId");

  if (employeeId === "self") {
    if (!context.actor.employeeId) {
      throw new CliUsageError("actor_employee_not_bound", `执行人 ${context.actor.id} 未绑定员工档案`);
    }

    return context.actor.employeeId;
  }

  return employeeId;
}

export function resolveWorkflowInstanceId(context: CliContext): string {
  return requireFlagString(
    context.parsed.flags,
    "workflow-instance-id",
    "workflowInstanceId",
    "workflow-id",
    "workflowId"
  );
}

export function buildWorkflowTargetResource(workflowInstanceId: string): string {
  return `workflow:${workflowInstanceId}`;
}

export async function beginCliCommandExecution(input: {
  context: CliContext;
  actionCode: string;
  actionName?: string;
  domainType?: WorkflowDomainType;
  allowCreateActionDefinition?: boolean;
  inputPayloadJson: Record<string, unknown>;
}): Promise<CliCommandExecution> {
  const risk = evaluateRisk({
    commandName: input.context.parsed.commandName,
    actorRole: input.context.actor.role,
    args: input.inputPayloadJson
  });
  const approval = deriveApprovalPolicy(risk);

  const invocation = await createCliInvocation({
    actionCode: input.actionCode,
    actionName: input.actionName,
    domainType: input.domainType,
    allowCreateActionDefinition: input.allowCreateActionDefinition,
    actorId: input.context.actor.id,
    actorType: input.context.actorType,
    commandName: input.context.parsed.commandName,
    rawCommand: input.context.parsed.rawCommand,
    argsJson: input.context.parsed.flags,
    inputPayloadJson: input.inputPayloadJson,
    traceId: input.context.traceId,
    clientVersion: input.context.clientVersion,
    runtimeEnv: input.context.runtimeEnv,
    hostname: input.context.hostname,
    operatorIp: input.context.operatorIp,
    isDryRun: input.context.isDryRun,
    isInteractive: input.context.isInteractive,
    outputFormat: input.context.outputFormat,
    idempotencyKey: makeIdempotencyKey(input.context.parsed.commandName, {
      ...input.inputPayloadJson,
      traceId: input.context.traceId
    }),
    riskLevel: risk.riskLevel,
    requiresApproval: approval.requiresApproval,
    blockingReason: approval.blockingReason
  });

  const events: CliOutputEvent[] = [
    createCliEvent("command_received", "ok", {
      commandName: input.context.parsed.commandName,
      actorId: input.context.actor.id,
      actorRole: input.context.actor.role,
      args: input.inputPayloadJson
    }),
    createCliEvent(risk.canProceed ? "policy_checked" : "policy_checked", risk.canProceed ? "ok" : "failed", {
      riskLevel: risk.riskLevel,
      requiresApproval: risk.requiresApproval,
      canProceed: risk.canProceed,
      blockingReason: risk.blockingReason,
      approvalType: risk.approvalType
    }),
    createCliEvent("invocation_created", "ok", {
      invocationId: invocation.id,
      requestId: invocation.requestId,
      traceId: invocation.traceId
    })
  ];

  return {
    context: input.context,
    actionCode: input.actionCode,
    inputPayloadJson: input.inputPayloadJson,
    risk,
    invocation,
    events
  };
}

export async function recordSensitiveReadSecurityEvent(
  execution: CliCommandExecution,
  input: {
    targetResource: string;
    detailsJson: Record<string, unknown>;
  }
) {
  return writeSecurityEvent({
    invocationId: execution.invocation.id,
    actorId: execution.context.actor.id,
    eventType: "READ_SENSITIVE_DATA",
    targetResource: input.targetResource,
    riskLevel: execution.risk.riskLevel,
    detailsJson: {
      commandName: execution.context.parsed.commandName,
      actorRole: execution.context.actor.role,
      ...input.detailsJson
    }
  });
}

export async function completeCliCommand(
  execution: CliCommandExecution,
  envelope: ActionEnvelope
): Promise<CliCommandResponse> {
  const finalized = await finalizeCliInvocation({
    invocationId: execution.invocation.id,
    success: envelope.result.success,
    businessObjectType: envelope.result.businessObjectType,
    businessObjectId: envelope.result.businessObjectId,
    outputPayloadJson: {
      result: envelope.result
    },
    resultSummary: `${execution.actionCode} completed`
  });

  const actionEvents =
    envelope.events[0]?.eventType === "command_received" ? envelope.events.slice(1) : envelope.events;

  return cliSucceeded({
    invocationId: finalized.id,
    traceId: finalized.traceId ?? execution.context.traceId,
    events: [
      ...execution.events,
      ...actionEvents,
      createCliEvent("invocation_finalized", "ok", {
        invocationId: finalized.id,
        status: finalized.status
      })
    ],
    result: {
      ...envelope.result
    }
  });
}

export async function completeCliQueryCommand(
  execution: CliCommandExecution,
  input: {
    businessObjectType: string;
    businessObjectId: string;
    result: Record<string, unknown>;
    resultSummary: string;
    extraEvents?: CliOutputEvent[];
  }
): Promise<CliCommandResponse> {
  const finalized = await finalizeCliInvocation({
    invocationId: execution.invocation.id,
    success: true,
    businessObjectType: input.businessObjectType,
    businessObjectId: input.businessObjectId,
    outputPayloadJson: input.result,
    resultSummary: input.resultSummary
  });

  return cliSucceeded({
    invocationId: finalized.id,
    traceId: finalized.traceId ?? execution.context.traceId,
    events: [
      ...execution.events,
      ...(input.extraEvents ?? []),
      createCliEvent("invocation_finalized", "ok", {
        invocationId: finalized.id,
        status: finalized.status
      })
    ],
    result: input.result
  });
}

export async function failCliCommand(
  execution: CliCommandExecution,
  error: unknown
): Promise<CliCommandResponse> {
  const message = error instanceof Error ? error.message : "unknown_cli_command_error";
  const finalized = await finalizeCliInvocation({
    invocationId: execution.invocation.id,
    success: false,
    businessObjectType: "cli_command",
    businessObjectId: execution.invocation.id,
    outputPayloadJson: {
      success: false,
      code: "command_execution_failed",
      message
    },
    resultSummary: message,
    errorCode: "command_execution_failed",
    errorMessage: message,
    errorStack: error instanceof Error ? error.stack : undefined
  });

  return {
    status: "failed",
    invocationId: finalized.id,
    traceId: finalized.traceId ?? execution.context.traceId,
    events: [
      ...execution.events,
      createCliEvent("command_failed", "failed", {
        code: "command_execution_failed",
        message
      }),
      createCliEvent("invocation_finalized", "ok", {
        invocationId: finalized.id,
        status: finalized.status
      })
    ],
    result: {
      success: false,
      code: "command_execution_failed",
      message
    }
  };
}

async function markApprovedExecution(execution: CliCommandExecution) {
  const policyCheckedEvent = execution.events.find((event) => event.eventType === "policy_checked");

  if (policyCheckedEvent) {
    policyCheckedEvent.status = "ok";
    policyCheckedEvent.payload = {
      ...policyCheckedEvent.payload,
      canProceed: true,
      blockingReason: null
    };
  }

  execution.risk.canProceed = true;
  execution.risk.blockingReason = null;

  await prisma.actionInvocation.update({
    where: { id: execution.invocation.id },
    data: {
      requiresApproval: false,
      blockingReason: null
    }
  });
}

export async function requireApprovalToProceed(
  execution: CliCommandExecution,
  input: {
    targetResource: string;
    message: string;
    implementationStatus?: "blocked" | "not_implemented";
  }
): Promise<CliCommandResponse | null> {
  if (execution.risk.canProceed) {
    return null;
  }

  if (execution.risk.blockingReason !== "approval_required" || !execution.risk.approvalType) {
    return blockCliCommand(execution, {
      targetResource: input.targetResource,
      code: execution.risk.blockingReason ?? "approval_required",
      message: input.message,
      implementationStatus: input.implementationStatus
    });
  }

  const approval = await resolveExecutionApproval({
    invocationId: execution.invocation.id,
    approvalType: execution.risk.approvalType,
    targetResource: input.targetResource
  });

  if (approval.status !== "approved") {
    return blockCliCommand(execution, {
      targetResource: input.targetResource,
      code: execution.risk.blockingReason ?? "approval_required",
      message: input.message,
      implementationStatus: input.implementationStatus,
      approvalRequestId: approval.approval.id,
      approvalStatus: approval.approval.approvalStatus
    });
  }

  await markApprovedExecution(execution);
  return null;
}

export async function blockCliCommand(
  execution: CliCommandExecution,
  input: {
    targetResource: string;
    code: string;
    message: string;
    implementationStatus?: "blocked" | "not_implemented";
    approvalRequestId?: string;
    approvalStatus?: string | null;
  }
): Promise<CliCommandResponse> {
  const detailsJson = {
    commandName: execution.context.parsed.commandName,
    blockingReason: execution.risk.blockingReason ?? input.code,
    approvalType: execution.risk.approvalType,
    implementationStatus: input.implementationStatus ?? "blocked"
  };

  const securityEvent =
    execution.risk.requiresApproval || execution.risk.riskLevel === "HIGH" || execution.risk.riskLevel === "CRITICAL"
      ? await recordBlockedCommandSecurityEvent({
          invocationId: execution.invocation.id,
          actorId: execution.context.actor.id,
          commandName: execution.context.parsed.commandName,
          targetResource: input.targetResource,
          risk: execution.risk,
          detailsJson
        })
      : await writeSecurityEvent({
          invocationId: execution.invocation.id,
          actorId: execution.context.actor.id,
          eventType: "FORBIDDEN_ACCESS_ATTEMPT",
          targetResource: input.targetResource,
          riskLevel: execution.risk.riskLevel,
          detailsJson
        });

  const finalized = await finalizeCliInvocation({
    invocationId: execution.invocation.id,
    success: false,
    businessObjectType: "cli_command",
    businessObjectId: execution.invocation.id,
    outputPayloadJson: {
      success: false,
      code: input.code,
      message: input.message,
      approvalType: execution.risk.approvalType,
      approvalRequestId: input.approvalRequestId ?? null,
      approvalStatus: input.approvalStatus ?? null,
      securityEventId: securityEvent.id,
      targetResource: input.targetResource,
      implementationStatus: input.implementationStatus ?? "blocked"
    },
    resultSummary: input.message,
    errorCode: input.code,
    errorMessage: input.message
  });

  return cliBlocked({
    invocationId: finalized.id,
    traceId: finalized.traceId ?? execution.context.traceId,
    events: [
      ...execution.events,
      createCliEvent("security_event_written", "ok", {
        securityEventId: securityEvent.id,
        eventType: securityEvent.eventType,
        targetResource: securityEvent.targetResource
      }),
      createCliEvent("command_blocked", "failed", {
        code: input.code,
        message: input.message,
        approvalRequestId: input.approvalRequestId ?? null,
        approvalStatus: input.approvalStatus ?? null,
        implementationStatus: input.implementationStatus ?? "blocked"
      }),
      createCliEvent("invocation_finalized", "ok", {
        invocationId: finalized.id,
        status: finalized.status
      })
    ],
    result: {
      success: false,
      code: input.code,
      message: input.message,
      approvalType: execution.risk.approvalType,
      approvalRequestId: input.approvalRequestId ?? null,
      approvalStatus: input.approvalStatus ?? null,
      securityEventId: securityEvent.id,
      targetResource: input.targetResource,
      implementationStatus: input.implementationStatus ?? "blocked"
    }
  });
}
