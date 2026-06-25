import { prisma } from "../../db/prisma.js";

const prismaCompat = prisma as typeof prisma & Record<string, any>;

export async function listActionInvocations(
  input: {
    limit?: number;
    actorId?: string;
  } = {},
  client: any = prismaCompat
) {
  return client.actionInvocation.findMany({
    where: input.actorId ? { actorId: input.actorId } : undefined,
    orderBy: { startedAt: "desc" },
    take: input.limit ?? 50,
    select: {
      id: true,
      requestId: true,
      actorType: true,
      actorId: true,
      channel: true,
      status: true,
      commandName: true,
      traceId: true,
      riskLevel: true,
      requiresApproval: true,
      startedAt: true,
      finishedAt: true,
      actionDefinition: {
        select: {
          actionCode: true,
          actionName: true
        }
      },
      result: {
        select: {
          success: true,
          businessObjectType: true,
          businessObjectId: true,
          errorCode: true,
          completedAt: true
        }
      }
    }
  });
}

export async function getActionInvocation(id: string, client: any = prismaCompat) {
  return client.actionInvocation.findUnique({
    where: { id },
    select: {
      id: true,
      actionDefinitionId: true,
      requestId: true,
      idempotencyKey: true,
      actorType: true,
      actorId: true,
      channel: true,
      inputPayloadJson: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      commandName: true,
      rawCommand: true,
      argsJson: true,
      traceId: true,
      clientVersion: true,
      runtimeEnv: true,
      hostname: true,
      operatorIp: true,
      isDryRun: true,
      isInteractive: true,
      outputFormat: true,
      riskLevel: true,
      requiresApproval: true,
      blockingReason: true,
      actionDefinition: {
        select: {
          actionCode: true,
          actionName: true,
          domainType: true
        }
      },
      result: true,
      approvals: {
        orderBy: { requestedAt: "desc" }
      },
      securityEvents: {
        orderBy: { occurredAt: "desc" }
      },
      workflowEvents: {
        orderBy: { occurredAt: "desc" }
      },
      auditEvents: {
        orderBy: { eventTime: "desc" }
      }
    }
  });
}
