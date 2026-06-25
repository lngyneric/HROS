-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'HRBP', 'HR_SPECIALIST', 'MANAGER', 'EMPLOYEE_SELF', 'PAYROLL_FINANCE', 'AI_SERVICE_ACTOR');

-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('ALL', 'ORG_TREE', 'DEPT_TREE', 'SELF');

-- CreateEnum
CREATE TYPE "EmployeeCurrentStatus" AS ENUM ('PREBOARDING', 'ACTIVE', 'OFFBOARDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'HR_REVIEW', 'MANAGER_CONFIRM', 'FINANCE_CONFIRM', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkflowDomainType" AS ENUM ('ONBOARDING', 'OFFBOARDING');

-- CreateEnum
CREATE TYPE "ActionInvocationStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "RoleCode" NOT NULL,
    "dataScope" "DataScope" NOT NULL,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "orgCode" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "parentOrgId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "positionCode" TEXT NOT NULL,
    "positionName" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMaster" (
    "id" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "workEmail" TEXT,
    "mobilePhone" TEXT,
    "hireDate" TIMESTAMP(3),
    "currentStatus" "EmployeeCurrentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeIdentityPrivate" (
    "employeeId" TEXT NOT NULL,
    "idType" TEXT,
    "idNumberEncrypted" TEXT,
    "addressEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeIdentityPrivate_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "EmploymentRelationship" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "legalEntity" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "probationEndDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "terminationReasonCode" TEXT,

    CONSTRAINT "EmploymentRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "managerEmployeeId" TEXT,
    "assignmentType" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "domainType" "WorkflowDomainType" NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStage" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "stageCode" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "stageOrder" INTEGER NOT NULL,

    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTaskTemplate" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "requiredRole" "RoleCode" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "dependsOnTaskId" TEXT,

    CONSTRAINT "WorkflowTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "businessObjectType" TEXT NOT NULL,
    "businessObjectId" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "initiatedBy" TEXT NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTask" (
    "id" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "taskTemplateId" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL,
    "assigneeType" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resultSummary" TEXT,

    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskArtifact" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactUri" TEXT NOT NULL,
    "artifactPayloadJson" JSONB NOT NULL,

    CONSTRAINT "TaskArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionDefinition" (
    "id" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "actionName" TEXT NOT NULL,
    "domainType" "WorkflowDomainType" NOT NULL,
    "inputSchemaJson" JSONB NOT NULL,
    "outputSchemaJson" JSONB NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isIdempotent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ActionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionInvocation" (
    "id" TEXT NOT NULL,
    "actionDefinitionId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "inputPayloadJson" JSONB NOT NULL,
    "status" "ActionInvocationStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ActionInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionResult" (
    "id" TEXT NOT NULL,
    "invocationId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "businessObjectType" TEXT NOT NULL,
    "businessObjectId" TEXT NOT NULL,
    "outputPayloadJson" JSONB NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "ActionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "invocationId" TEXT NOT NULL,
    "approverRole" "RoleCode" NOT NULL,
    "approverId" TEXT NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL,
    "decisionAt" TIMESTAMP(3),
    "decisionReason" TEXT,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" TEXT,
    "requestId" TEXT,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "workflowInstanceId" TEXT NOT NULL,
    "taskId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventPayloadJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_orgCode_key" ON "OrgUnit"("orgCode");

-- CreateIndex
CREATE UNIQUE INDEX "Position_positionCode_key" ON "Position"("positionCode");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMaster_employeeNo_key" ON "EmployeeMaster"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMaster_workEmail_key" ON "EmployeeMaster"("workEmail");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplate_templateCode_key" ON "WorkflowTemplate"("templateCode");

-- CreateIndex
CREATE UNIQUE INDEX "ActionDefinition_actionCode_key" ON "ActionDefinition"("actionCode");

-- CreateIndex
CREATE UNIQUE INDEX "ActionInvocation_requestId_key" ON "ActionInvocation"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionInvocation_idempotencyKey_key" ON "ActionInvocation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ActionResult_invocationId_key" ON "ActionResult"("invocationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentOrgId_fkey" FOREIGN KEY ("parentOrgId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeIdentityPrivate" ADD CONSTRAINT "EmployeeIdentityPrivate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentRelationship" ADD CONSTRAINT "EmploymentRelationship_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_managerEmployeeId_fkey" FOREIGN KEY ("managerEmployeeId") REFERENCES "EmployeeMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStage" ADD CONSTRAINT "WorkflowStage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTaskTemplate" ADD CONSTRAINT "WorkflowTaskTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTaskTemplate" ADD CONSTRAINT "WorkflowTaskTemplate_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "WorkflowStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_taskTemplateId_fkey" FOREIGN KEY ("taskTemplateId") REFERENCES "WorkflowTaskTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskArtifact" ADD CONSTRAINT "TaskArtifact_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkflowTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionInvocation" ADD CONSTRAINT "ActionInvocation_actionDefinitionId_fkey" FOREIGN KEY ("actionDefinitionId") REFERENCES "ActionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionResult" ADD CONSTRAINT "ActionResult_invocationId_fkey" FOREIGN KEY ("invocationId") REFERENCES "ActionInvocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_invocationId_fkey" FOREIGN KEY ("invocationId") REFERENCES "ActionInvocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
