import { ApprovalStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

function isPlainObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function extractApprovalTargetResources(inputPayloadJson: Prisma.JsonValue | null): string[] {
  if (!isPlainObject(inputPayloadJson)) {
    return [];
  }

  const resources = new Set<string>();
  const explicitTarget = inputPayloadJson.targetResource;
  const workflowInstanceId = inputPayloadJson.workflowInstanceId;
  const businessObjectType = inputPayloadJson.businessObjectType;
  const businessObjectId = inputPayloadJson.businessObjectId;

  if (typeof explicitTarget === "string" && explicitTarget.length > 0) {
    resources.add(explicitTarget);
  }

  if (typeof workflowInstanceId === "string" && workflowInstanceId.length > 0) {
    resources.add(`workflow:${workflowInstanceId}`);
  }

  if (
    typeof businessObjectType === "string" &&
    businessObjectType.length > 0 &&
    typeof businessObjectId === "string" &&
    businessObjectId.length > 0
  ) {
    resources.add(`${businessObjectType}:${businessObjectId}`);
  }

  return [...resources];
}

export async function resolveApprovalRequest(input: {
  approvalType: string;
  targetResource: string;
  approvalStatuses?: ApprovalStatus[];
  limit?: number;
}) {
  const items = await prisma.approvalRequest.findMany({
    where: {
      approvalType: input.approvalType,
      approvalStatus: {
        in: input.approvalStatuses ?? ["APPROVED"]
      }
    },
    include: {
      invocation: {
        select: {
          id: true,
          commandName: true,
          inputPayloadJson: true,
          traceId: true
        }
      }
    },
    orderBy: [{ decisionAt: "desc" }, { requestedAt: "desc" }],
    take: input.limit ?? 50
  });

  return (
    items.find((item) =>
      extractApprovalTargetResources(item.invocation.inputPayloadJson).includes(input.targetResource)
    ) ?? null
  );
}
