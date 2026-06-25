import { prisma } from "../../db/prisma.js";

const prismaCompat = prisma as typeof prisma & Record<string, any>;

export type FinalizeCliInvocationInput = {
  invocationId: string;
  success: boolean;
  businessObjectType: string;
  businessObjectId: string;
  outputPayloadJson: Record<string, unknown>;
  resultSummary?: string;
  errorCode?: string;
  errorMessage?: string;
  errorStack?: string;
  completedAt?: Date;
};

export async function finalizeCliInvocation(
  input: FinalizeCliInvocationInput,
  client: any = prismaCompat
) {
  const completedAt = input.completedAt ?? new Date();

  await client.actionResult.upsert({
    where: {
      invocationId: input.invocationId
    },
    create: {
      invocationId: input.invocationId,
      success: input.success,
      businessObjectType: input.businessObjectType,
      businessObjectId: input.businessObjectId,
      outputPayloadJson: input.outputPayloadJson,
      resultSummary: input.resultSummary,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      errorStack: input.errorStack,
      completedAt
    },
    update: {
      success: input.success,
      businessObjectType: input.businessObjectType,
      businessObjectId: input.businessObjectId,
      outputPayloadJson: input.outputPayloadJson,
      resultSummary: input.resultSummary,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      errorStack: input.errorStack,
      completedAt
    }
  });

  return client.actionInvocation.update({
    where: { id: input.invocationId },
    data: {
      status: input.success ? "SUCCEEDED" : "FAILED",
      finishedAt: completedAt
    },
    include: {
      result: true
    }
  });
}
