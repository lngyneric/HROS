import { prisma } from "../../db/prisma.js";

const prismaCompat = prisma as typeof prisma & Record<string, any>;

export async function listAuditEvents(
  input: {
    limit?: number;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    invocationId?: string;
    operation?: string;
  } = {},
  client: any = prismaCompat
) {
  return client.auditEvent.findMany({
    where: {
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.invocationId ? { invocationId: input.invocationId } : {}),
      ...(input.operation ? { operation: input.operation } : {})
    },
    orderBy: { eventTime: "desc" },
    take: input.limit ?? 50,
    select: {
      id: true,
      eventTime: true,
      actorType: true,
      actorId: true,
      entityType: true,
      entityId: true,
      operation: true,
      reason: true,
      requestId: true,
      channel: true,
      invocationId: true,
      traceId: true,
      beforeJson: true,
      afterJson: true
    }
  });
}
