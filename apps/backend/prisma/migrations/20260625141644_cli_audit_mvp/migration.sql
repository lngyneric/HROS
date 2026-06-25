-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('FORBIDDEN_ACCESS_ATTEMPT', 'READ_SENSITIVE_DATA', 'EXPORT_SENSITIVE_DATA', 'APPROVAL_BYPASS_ATTEMPT', 'HIGH_RISK_COMMAND_BLOCKED', 'SUSPICIOUS_REPEATED_RETRY');

-- CreateEnum
CREATE TYPE "SecurityResolutionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "CompensationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkflowDomainType" ADD VALUE 'EMPLOYEE';
ALTER TYPE "WorkflowDomainType" ADD VALUE 'WORKFLOW';
ALTER TYPE "WorkflowDomainType" ADD VALUE 'AUDIT';
ALTER TYPE "WorkflowDomainType" ADD VALUE 'SYSTEM';

-- AlterTable
ALTER TABLE "ActionInvocation" ADD COLUMN     "argsJson" JSONB,
ADD COLUMN     "blockingReason" TEXT,
ADD COLUMN     "clientVersion" TEXT,
ADD COLUMN     "commandName" TEXT,
ADD COLUMN     "hostname" TEXT,
ADD COLUMN     "isDryRun" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInteractive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "operatorIp" TEXT,
ADD COLUMN     "outputFormat" TEXT,
ADD COLUMN     "rawCommand" TEXT,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskLevel" "RiskLevel",
ADD COLUMN     "runtimeEnv" TEXT,
ADD COLUMN     "traceId" TEXT;

-- AlterTable
ALTER TABLE "ActionResult" ADD COLUMN     "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "errorStack" TEXT,
ADD COLUMN     "resultSummary" TEXT;

-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "approvalType" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "channel" TEXT,
ADD COLUMN     "invocationId" TEXT,
ADD COLUMN     "traceId" TEXT;

-- AlterTable
ALTER TABLE "WorkflowEvent" ADD COLUMN     "invocationId" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "traceId" TEXT;

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "invocationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" "SecurityEventType" NOT NULL,
    "targetResource" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "detailsJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionStatus" "SecurityResolutionStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompensationAction" (
    "id" TEXT NOT NULL,
    "sourceInvocationId" TEXT NOT NULL,
    "compensatingActionCode" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "CompensationStatus" NOT NULL,
    "executedAt" TIMESTAMP(3),
    "resultJson" JSONB,

    CONSTRAINT "CompensationAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_invocationId_fkey" FOREIGN KEY ("invocationId") REFERENCES "ActionInvocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_invocationId_fkey" FOREIGN KEY ("invocationId") REFERENCES "ActionInvocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_invocationId_fkey" FOREIGN KEY ("invocationId") REFERENCES "ActionInvocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompensationAction" ADD CONSTRAINT "CompensationAction_sourceInvocationId_fkey" FOREIGN KEY ("sourceInvocationId") REFERENCES "ActionInvocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
