import type { FieldClassification } from "../field-policy/classification.js";
import { prisma } from "../db/prisma.js";

const prismaCompat = prisma as typeof prisma & Record<string, any>;

type WriteAuditEventParams = {
  actorType: string;
  actorId: string;
  entityType: string;
  entityId: string;
  operation: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  reason?: string;
  requestId?: string;
  channel?: string;
  invocationId?: string;
  traceId?: string;
};

export async function writeAuditEvent(params: WriteAuditEventParams, client: any = prismaCompat) {
  return client.auditEvent.create({
    data: {
      actorType: params.actorType,
      actorId: params.actorId,
      entityType: params.entityType,
      entityId: params.entityId,
      operation: params.operation,
      beforeJson: (params.beforeJson ?? undefined) as Record<string, unknown> | undefined,
      afterJson: (params.afterJson ?? undefined) as Record<string, unknown> | undefined,
      reason: params.reason,
      requestId: params.requestId,
      channel: params.channel,
      invocationId: params.invocationId,
      traceId: params.traceId
    }
  });
}

type WriteCliAuditEventParams = Omit<WriteAuditEventParams, "channel"> & {
  invocationId: string;
  traceId: string;
};

export async function writeCliAuditEvent(
  params: WriteCliAuditEventParams,
  client: any = prismaCompat
) {
  return writeAuditEvent(
    {
      ...params,
      channel: "cli"
    },
    client
  );
}

export async function writeAudit(params: {
  actorUserId: string;
  action: "READ_SENSITIVE" | "EXPORT" | "UPDATE" | "LOCK" | "UNLOCK" | "TRANSITION";
  resourceType: string;
  resourceId: string;
  fieldClassification: FieldClassification;
  metadata: Record<string, any>;
}) {
  await writeAuditEvent({
    actorType: "user",
    actorId: params.actorUserId,
    entityType: params.resourceType,
    entityId: params.resourceId,
    operation: params.action,
    afterJson: {
      fieldClassification: params.fieldClassification,
      metadata: params.metadata
    }
  });
}
