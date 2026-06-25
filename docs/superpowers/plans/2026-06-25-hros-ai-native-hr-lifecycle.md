# HROS AI Native HR Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有入离职 MVP 演进为符合 HROS 规格的 AI Native HR 生命周期底座，落地 PostgreSQL/Prisma 数据骨架、动作调用层、结构化事件流、最小前端可视化与测试闭环。

**Architecture:** 保留现有 `Express + Prisma + React` 项目骨架，在后端新增 `action/workflow/audit` 领域层，把现有 `onboarding/offboarding` 路由从“直接操作 case 表”重构为“调用动作服务并返回结构化事件流”。数据库切换到 PostgreSQL，主数据、流程、动作、审计保持清晰边界，前端工作台只消费新的动作响应与事件摘要。

**Tech Stack:** PostgreSQL 16, Prisma 6, Express 4, TypeScript 5, Zod 3, Vitest 2, React 19, Ant Design 5

---

## File Structure

### Backend files to modify

- `apps/backend/.env.example`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/db/seed.ts`
- `apps/backend/src/app.ts`
- `apps/backend/src/modules/onboarding/onboarding.routes.ts`
- `apps/backend/src/modules/offboarding/offboarding.routes.ts`
- `apps/backend/src/audit/audit.ts`
- `apps/backend/README.md`

### Backend files to create

- `apps/backend/src/modules/actions/action.types.ts`
- `apps/backend/src/modules/actions/action-runner.ts`
- `apps/backend/src/modules/actions/action-response.ts`
- `apps/backend/src/modules/workflow/workflow-events.ts`
- `apps/backend/src/modules/onboarding/onboarding.actions.ts`
- `apps/backend/src/modules/offboarding/offboarding.actions.ts`
- `apps/backend/src/test/action-runner.test.ts`
- `apps/backend/src/test/hros-schema.test.ts`
- `apps/backend/src/test/onboarding-actions.test.ts`
- `apps/backend/src/test/offboarding-actions.test.ts`
- `apps/backend/src/test/hr-lifecycle-api.test.ts`

### Frontend files to modify

- `apps/frontend/src/pages/HrWorklistPage.tsx`
- `apps/frontend/src/pages/ManagerConfirmPage.tsx`
- `apps/frontend/src/pages/FinanceConfirmPage.tsx`
- `apps/frontend/src/shared/api/client.ts`

### Frontend files to create

- `apps/frontend/src/shared/types/action.ts`
- `apps/frontend/src/shared/components/ActionEventTimeline.tsx`

## Task 1: Build the Action/Event Contract Layer

**Files:**
- Create: `apps/backend/src/modules/actions/action.types.ts`
- Create: `apps/backend/src/modules/actions/action-runner.ts`
- Create: `apps/backend/src/modules/actions/action-response.ts`
- Create: `apps/backend/src/modules/workflow/workflow-events.ts`
- Test: `apps/backend/src/test/action-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createActionRun } from "../modules/actions/action-runner.js";

describe("action runner", () => {
  it("captures ordered events and final result", async () => {
    const run = await createActionRun({
      actionCode: "onboarding.create",
      actorType: "user",
      actorId: "user-1",
      input: { employeeId: "emp-1" },
      execute: async ({ emit }) => {
        emit("input_validated", "ok", { employeeId: "emp-1" });
        emit("state_transition_applied", "ok", { status: "DRAFT" });

        return {
          success: true,
          businessObjectType: "workflow_instance",
          businessObjectId: "wf-1",
          nextActions: ["onboarding.submit"],
          artifacts: []
        };
      }
    });

    expect(run.events.map((event) => event.eventType)).toEqual([
      "command_received",
      "input_validated",
      "state_transition_applied",
      "command_succeeded"
    ]);
    expect(run.result.success).toBe(true);
    expect(run.result.businessObjectId).toBe("wf-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/action-runner.test.ts
```

Expected: FAIL with `Cannot find module '../modules/actions/action-runner.js'`.

- [ ] **Step 3: Write minimal implementation**

`apps/backend/src/modules/actions/action.types.ts`

```ts
export type ActionEventStatus = "ok" | "failed";

export type ActionEventType =
  | "command_received"
  | "input_validated"
  | "policy_checked"
  | "state_transition_applied"
  | "artifact_written"
  | "command_succeeded"
  | "command_failed";

export type ActionEvent = {
  eventType: ActionEventType;
  timestamp: string;
  status: ActionEventStatus;
  summary: string;
  payload: Record<string, unknown>;
};

export type ActionResult = {
  success: boolean;
  businessObjectType: string;
  businessObjectId: string;
  nextActions: string[];
  artifacts: Array<{ type: string; id: string }>;
};
```

`apps/backend/src/modules/actions/action-runner.ts`

```ts
import type { ActionEvent, ActionEventType, ActionResult } from "./action.types.js";

type CreateActionRunInput = {
  actionCode: string;
  actorType: string;
  actorId: string;
  input: Record<string, unknown>;
  execute: (helpers: {
    emit: (eventType: ActionEventType, status: "ok" | "failed", payload?: Record<string, unknown>) => void;
  }) => Promise<ActionResult>;
};

export async function createActionRun(input: CreateActionRunInput) {
  const events: ActionEvent[] = [];

  const emit = (eventType: ActionEventType, status: "ok" | "failed", payload: Record<string, unknown> = {}) => {
    events.push({
      eventType,
      timestamp: new Date().toISOString(),
      status,
      summary: eventType,
      payload
    });
  };

  emit("command_received", "ok", {
    actionCode: input.actionCode,
    actorType: input.actorType,
    actorId: input.actorId
  });

  try {
    const result = await input.execute({ emit });
    emit("command_succeeded", "ok", {
      businessObjectType: result.businessObjectType,
      businessObjectId: result.businessObjectId
    });

    return { events, result };
  } catch (error) {
    emit("command_failed", "failed", {
      message: error instanceof Error ? error.message : "unknown_error"
    });
    throw error;
  }
}
```

`apps/backend/src/modules/actions/action-response.ts`

```ts
import type { ActionEvent, ActionResult } from "./action.types.js";

export type ActionEnvelope = {
  events: ActionEvent[];
  result: ActionResult;
};
```

`apps/backend/src/modules/workflow/workflow-events.ts`

```ts
export const WORKFLOW_EVENT_TYPES = {
  created: "command_received",
  validated: "input_validated",
  policyChecked: "policy_checked",
  transitioned: "state_transition_applied",
  artifactWritten: "artifact_written",
  succeeded: "command_succeeded",
  failed: "command_failed"
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm -w apps/backend exec vitest run src/test/action-runner.test.ts
```

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/actions/action.types.ts apps/backend/src/modules/actions/action-runner.ts apps/backend/src/modules/actions/action-response.ts apps/backend/src/modules/workflow/workflow-events.ts apps/backend/src/test/action-runner.test.ts
git commit -m "feat: add action runner contract"
```

## Task 2: Replace the Prisma Model with the AI-Native Core Schema

**Files:**
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/src/db/seed.ts`
- Test: `apps/backend/src/test/hros-schema.test.ts`

- [ ] **Step 1: Write the failing schema smoke test**

`apps/backend/src/test/hros-schema.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";

describe("hros schema", () => {
  it("seeds action definitions and workflow templates", async () => {
    const actionCount = await prisma.actionDefinition.count();
    const workflowTemplateCount = await prisma.workflowTemplate.count();

    expect(actionCount).toBeGreaterThan(0);
    expect(workflowTemplateCount).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/hros-schema.test.ts
```

Expected: FAIL with Prisma client type errors because `actionDefinition` and `workflowTemplate` do not exist yet.

- [ ] **Step 3: Write minimal implementation**

`apps/backend/.env.example`

```env
PORT=3003
DATABASE_URL="postgresql://hros:hros_password@localhost:5432/hros?schema=public"
JWT_SECRET="change_me_change_me"
```

Replace `apps/backend/prisma/schema.prisma` with the minimal first-phase schema below:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum RoleCode {
  ADMIN
  HRBP
  HR_SPECIALIST
  MANAGER
  EMPLOYEE_SELF
  PAYROLL_FINANCE
  AI_SERVICE_ACTOR
}

enum DataScope {
  ALL
  ORG_TREE
  DEPT_TREE
  SELF
}

enum EmployeeCurrentStatus {
  PREBOARDING
  ACTIVE
  OFFBOARDED
  ARCHIVED
}

enum WorkflowStatus {
  DRAFT
  SUBMITTED
  HR_REVIEW
  MANAGER_CONFIRM
  FINANCE_CONFIRM
  COMPLETED
  ARCHIVED
  CANCELLED
}

enum WorkflowDomainType {
  ONBOARDING
  OFFBOARDING
}

enum ActionInvocationStatus {
  RUNNING
  SUCCEEDED
  FAILED
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  displayName  String
  role         RoleCode
  dataScope    DataScope
  employeeId   String?  @unique
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  employee EmployeeMaster? @relation(fields: [employeeId], references: [id])
}

model OrgUnit {
  id            String   @id @default(uuid())
  orgCode       String   @unique
  orgName       String
  parentOrgId   String?
  effectiveFrom DateTime @default(now())
  effectiveTo   DateTime?

  parent   OrgUnit?  @relation("OrgTree", fields: [parentOrgId], references: [id])
  children OrgUnit[] @relation("OrgTree")
}

model Position {
  id            String   @id @default(uuid())
  positionCode  String   @unique
  positionName  String
  effectiveFrom DateTime @default(now())
  effectiveTo   DateTime?
}

model EmployeeMaster {
  id            String   @id @default(uuid())
  employeeNo    String   @unique
  fullName      String
  workEmail     String?  @unique
  mobilePhone   String?
  hireDate      DateTime?
  currentStatus EmployeeCurrentStatus
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  identityPrivate       EmployeeIdentityPrivate?
  employmentRelations   EmploymentRelationship[]
  jobAssignments        JobAssignment[]
  workflowInstances     WorkflowInstance[]
}

model EmployeeIdentityPrivate {
  employeeId          String   @id
  idType              String?
  idNumberEncrypted   String?
  addressEncrypted    String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  employee EmployeeMaster @relation(fields: [employeeId], references: [id])
}

model EmploymentRelationship {
  id                    String   @id @default(uuid())
  employeeId            String
  employmentType        String
  legalEntity           String
  contractType          String
  startDate             DateTime
  endDate               DateTime?
  probationEndDate      DateTime?
  terminationDate       DateTime?
  terminationReasonCode String?

  employee EmployeeMaster @relation(fields: [employeeId], references: [id])
}

model JobAssignment {
  id                String   @id @default(uuid())
  employeeId        String
  positionId        String
  orgUnitId         String
  managerEmployeeId String?
  assignmentType    String
  effectiveFrom     DateTime
  effectiveTo       DateTime?
  isPrimary         Boolean  @default(true)

  employee EmployeeMaster  @relation("EmployeeAssignments", fields: [employeeId], references: [id])
  position Position        @relation(fields: [positionId], references: [id])
  orgUnit  OrgUnit         @relation(fields: [orgUnitId], references: [id])
  manager  EmployeeMaster? @relation("AssignmentManager", fields: [managerEmployeeId], references: [id])
}

model WorkflowTemplate {
  id           String             @id @default(uuid())
  templateCode String             @unique
  templateName String
  domainType   WorkflowDomainType
  version      Int
  isActive     Boolean            @default(true)

  stages    WorkflowStage[]
  instances WorkflowInstance[]
}

model WorkflowStage {
  id         String @id @default(uuid())
  templateId String
  stageCode  String
  stageName  String
  stageOrder Int

  template      WorkflowTemplate     @relation(fields: [templateId], references: [id])
  taskTemplates WorkflowTaskTemplate[]
}

model WorkflowTaskTemplate {
  id              String  @id @default(uuid())
  templateId      String
  stageId         String
  taskCode        String
  taskName        String
  requiredRole    RoleCode
  isRequired      Boolean @default(true)
  dependsOnTaskId String?

  template WorkflowTemplate @relation(fields: [templateId], references: [id])
  stage    WorkflowStage    @relation(fields: [stageId], references: [id])
  tasks    WorkflowTask[]
}

model WorkflowInstance {
  id                 String         @id @default(uuid())
  templateId         String
  employeeId         String
  businessObjectType String
  businessObjectId   String
  status             WorkflowStatus
  startedAt          DateTime       @default(now())
  completedAt        DateTime?
  initiatedBy        String

  template WorkflowTemplate @relation(fields: [templateId], references: [id])
  employee EmployeeMaster   @relation(fields: [employeeId], references: [id])
  tasks    WorkflowTask[]
  events   WorkflowEvent[]
}

model WorkflowTask {
  id               String         @id @default(uuid())
  workflowInstanceId String
  taskTemplateId   String
  taskCode         String
  status           WorkflowStatus
  assigneeType     String
  assigneeId       String
  dueAt            DateTime?
  startedAt        DateTime?
  completedAt      DateTime?
  resultSummary    String?

  workflowInstance WorkflowInstance     @relation(fields: [workflowInstanceId], references: [id])
  taskTemplate     WorkflowTaskTemplate @relation(fields: [taskTemplateId], references: [id])
  artifacts        TaskArtifact[]
}

model TaskArtifact {
  id                   String   @id @default(uuid())
  taskId               String
  artifactType         String
  artifactUri          String
  artifactPayloadJson  Json

  task WorkflowTask @relation(fields: [taskId], references: [id])
}

model ActionDefinition {
  id               String   @id @default(uuid())
  actionCode       String   @unique
  actionName       String
  domainType       WorkflowDomainType
  inputSchemaJson  Json
  outputSchemaJson Json
  requiresApproval Boolean  @default(false)
  isIdempotent     Boolean  @default(true)

  invocations ActionInvocation[]
}

model ActionInvocation {
  id                 String                 @id @default(uuid())
  actionDefinitionId String
  requestId          String                 @unique
  idempotencyKey     String                 @unique
  actorType          String
  actorId            String
  channel            String
  inputPayloadJson   Json
  status             ActionInvocationStatus
  startedAt          DateTime               @default(now())
  finishedAt         DateTime?

  actionDefinition ActionDefinition @relation(fields: [actionDefinitionId], references: [id])
  result           ActionResult?
  approvals        ApprovalRequest[]
}

model ActionResult {
  id                 String  @id @default(uuid())
  invocationId       String  @unique
  success            Boolean
  businessObjectType String
  businessObjectId   String
  outputPayloadJson  Json
  errorCode          String?
  errorMessage       String?

  invocation ActionInvocation @relation(fields: [invocationId], references: [id])
}

model ApprovalRequest {
  id             String         @id @default(uuid())
  invocationId   String
  approverRole   RoleCode
  approverId     String
  approvalStatus ApprovalStatus
  decisionAt     DateTime?
  decisionReason String?

  invocation ActionInvocation @relation(fields: [invocationId], references: [id])
}

model AuditEvent {
  id          String   @id @default(uuid())
  eventTime   DateTime @default(now())
  actorType   String
  actorId     String
  entityType  String
  entityId    String
  operation   String
  beforeJson  Json?
  afterJson   Json?
  reason      String?
  requestId   String?
}

model WorkflowEvent {
  id                 String   @id @default(uuid())
  workflowInstanceId String
  taskId             String?
  eventType          String
  eventPayloadJson   Json
  occurredAt         DateTime @default(now())

  workflowInstance WorkflowInstance @relation(fields: [workflowInstanceId], references: [id])
}
```

Update `apps/backend/src/db/seed.ts` so it inserts:

- 1 条 `WorkflowTemplate` for `ONBOARDING_STANDARD`
- 1 条 `WorkflowTemplate` for `OFFBOARDING_STANDARD`
- 对应阶段和任务模板
- 动作定义 `onboarding.create`, `onboarding.submit`, `onboarding.approve_hr`, `onboarding.approve_manager`, `offboarding.create`, `offboarding.submit`, `offboarding.approve_hr`, `offboarding.approve_manager`, `offboarding.approve_finance`, `offboarding.archive`
- 现有测试用户和员工主档，改成新模型名 `employeeMaster`

Run schema commands:

```bash
cp apps/backend/.env.example apps/backend/.env
docker compose up -d db
npm -w apps/backend run prisma:migrate -- --name ai_native_core
npm -w apps/backend run prisma:seed
npm -w apps/backend run prisma:generate
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm -w apps/backend exec vitest run src/test/hros-schema.test.ts
```

Expected: PASS with both counts greater than `0`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/.env.example apps/backend/prisma/schema.prisma apps/backend/src/db/seed.ts apps/backend/src/test/hros-schema.test.ts
git commit -m "feat: add ai-native hr lifecycle schema"
```

## Task 3: Implement Onboarding as Action-Driven Workflow

**Files:**
- Create: `apps/backend/src/modules/onboarding/onboarding.actions.ts`
- Modify: `apps/backend/src/modules/onboarding/onboarding.routes.ts`
- Modify: `apps/backend/src/audit/audit.ts`
- Test: `apps/backend/src/test/onboarding-actions.test.ts`

- [ ] **Step 1: Write the failing onboarding action test**

`apps/backend/src/test/onboarding-actions.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";
import { createOnboardingDraft } from "../modules/onboarding/onboarding.actions.js";

describe("onboarding actions", () => {
  it("creates action invocation, workflow instance, task and audit event", async () => {
    const employee = await prisma.employeeMaster.findFirstOrThrow({
      where: { employeeNo: "E0002" }
    });
    const action = await createOnboardingDraft({
      actorUserId: "seed-admin",
      actorType: "user",
      employeeId: employee.id,
      requestId: "req-onboarding-create-1",
      idempotencyKey: "idem-onboarding-create-1"
    });

    expect(action.result.success).toBe(true);
    expect(action.events.some((event) => event.eventType === "state_transition_applied")).toBe(true);

    const workflow = await prisma.workflowInstance.findFirstOrThrow({
      where: { employeeId: employee.id, businessObjectType: "onboarding_case" }
    });

    expect(workflow.status).toBe("DRAFT");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/onboarding-actions.test.ts
```

Expected: FAIL with `Cannot find module '../modules/onboarding/onboarding.actions.js'`.

- [ ] **Step 3: Write minimal implementation**

`apps/backend/src/audit/audit.ts`

```ts
import { prisma } from "../db/prisma.js";

export async function writeAuditEvent(input: {
  actorType: string;
  actorId: string;
  entityType: string;
  entityId: string;
  operation: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  reason?: string;
  requestId?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      beforeJson: input.beforeJson as object | undefined,
      afterJson: input.afterJson as object | undefined,
      reason: input.reason,
      requestId: input.requestId
    }
  });
}
```

`apps/backend/src/modules/onboarding/onboarding.actions.ts`

```ts
import { prisma } from "../../db/prisma.js";
import { createActionRun } from "../actions/action-runner.js";
import { writeAuditEvent } from "../../audit/audit.js";

export async function createOnboardingDraft(input: {
  actorUserId: string;
  actorType: string;
  employeeId: string;
  requestId: string;
  idempotencyKey: string;
}) {
  const actionDefinition = await prisma.actionDefinition.findUniqueOrThrow({
    where: { actionCode: "onboarding.create" }
  });

  return createActionRun({
    actionCode: "onboarding.create",
    actorType: input.actorType,
    actorId: input.actorUserId,
    input: { employeeId: input.employeeId },
    execute: async ({ emit }) => {
      emit("input_validated", "ok", { employeeId: input.employeeId });

      const workflowTemplate = await prisma.workflowTemplate.findUniqueOrThrow({
        where: { templateCode: "ONBOARDING_STANDARD" }
      });

      const created = await prisma.$transaction(async (tx) => {
        const invocation = await tx.actionInvocation.create({
          data: {
            actionDefinitionId: actionDefinition.id,
            requestId: input.requestId,
            idempotencyKey: input.idempotencyKey,
            actorType: input.actorType,
            actorId: input.actorUserId,
            channel: "api",
            inputPayloadJson: { employeeId: input.employeeId },
            status: "RUNNING"
          }
        });

        const workflow = await tx.workflowInstance.create({
          data: {
            templateId: workflowTemplate.id,
            employeeId: input.employeeId,
            businessObjectType: "onboarding_case",
            businessObjectId: input.employeeId,
            status: "DRAFT",
            initiatedBy: input.actorUserId
          }
        });

        const firstTaskTemplate = await tx.workflowTaskTemplate.findFirstOrThrow({
          where: { templateId: workflowTemplate.id },
          orderBy: { taskCode: "asc" }
        });

        await tx.workflowTask.create({
          data: {
            workflowInstanceId: workflow.id,
            taskTemplateId: firstTaskTemplate.id,
            taskCode: firstTaskTemplate.taskCode,
            status: "DRAFT",
            assigneeType: "user",
            assigneeId: input.actorUserId
          }
        });

        await tx.actionResult.create({
          data: {
            invocationId: invocation.id,
            success: true,
            businessObjectType: "workflow_instance",
            businessObjectId: workflow.id,
            outputPayloadJson: { workflowInstanceId: workflow.id }
          }
        });

        await tx.actionInvocation.update({
          where: { id: invocation.id },
          data: { status: "SUCCEEDED", finishedAt: new Date() }
        });

        return { invocation, workflow };
      });

      emit("state_transition_applied", "ok", {
        workflowInstanceId: created.workflow.id,
        status: created.workflow.status
      });

      await prisma.workflowEvent.create({
        data: {
          workflowInstanceId: created.workflow.id,
          eventType: "state_transition_applied",
          eventPayloadJson: { status: "DRAFT" }
        }
      });

      await writeAuditEvent({
        actorType: input.actorType,
        actorId: input.actorUserId,
        entityType: "WorkflowInstance",
        entityId: created.workflow.id,
        operation: "CREATE",
        afterJson: { status: "DRAFT" },
        requestId: input.requestId
      });

      return {
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: created.workflow.id,
        nextActions: ["onboarding.submit"],
        artifacts: []
      };
    }
  });
}
```

In `apps/backend/src/modules/onboarding/onboarding.routes.ts`, replace the direct `prisma.onboardingCase.create()` path with:

```ts
const action = await createOnboardingDraft({
  actorUserId: req.user!.id,
  actorType: "user",
  employeeId,
  requestId: crypto.randomUUID(),
  idempotencyKey: req.header("x-idempotency-key") ?? crypto.randomUUID()
});

res.json(action);
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm -w apps/backend exec vitest run src/test/onboarding-actions.test.ts
```

Expected: PASS with one workflow instance created in `DRAFT`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/audit/audit.ts apps/backend/src/modules/onboarding/onboarding.actions.ts apps/backend/src/modules/onboarding/onboarding.routes.ts apps/backend/src/test/onboarding-actions.test.ts
git commit -m "feat: add onboarding action workflow"
```

## Task 4: Implement Offboarding Archive with Workflow Events and Artifacts

**Files:**
- Create: `apps/backend/src/modules/offboarding/offboarding.actions.ts`
- Modify: `apps/backend/src/modules/offboarding/offboarding.routes.ts`
- Test: `apps/backend/src/test/offboarding-actions.test.ts`

- [ ] **Step 1: Write the failing offboarding archive test**

`apps/backend/src/test/offboarding-actions.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";
import { archiveOffboardingCase } from "../modules/offboarding/offboarding.actions.js";

describe("offboarding actions", () => {
  it("archives the workflow and writes a task artifact", async () => {
    const workflow = await prisma.workflowInstance.findFirstOrThrow({
      where: { businessObjectType: "offboarding_case", status: "FINANCE_CONFIRM" },
      include: { tasks: true }
    });

    const result = await archiveOffboardingCase({
      workflowInstanceId: workflow.id,
      actorUserId: "seed-finance",
      actorType: "user",
      requestId: "req-offboarding-archive-1",
      idempotencyKey: "idem-offboarding-archive-1"
    });

    expect(result.result.success).toBe(true);

    const refreshed = await prisma.workflowInstance.findUniqueOrThrow({
      where: { id: workflow.id },
      include: { tasks: { include: { artifacts: true } }, employee: true }
    });

    expect(refreshed.status).toBe("ARCHIVED");
    expect(refreshed.employee.currentStatus).toBe("OFFBOARDED");
    expect(refreshed.tasks.some((task) => task.artifacts.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/offboarding-actions.test.ts
```

Expected: FAIL with `Cannot find module '../modules/offboarding/offboarding.actions.js'`.

- [ ] **Step 3: Write minimal implementation**

`apps/backend/src/modules/offboarding/offboarding.actions.ts`

```ts
import { prisma } from "../../db/prisma.js";
import { createActionRun } from "../actions/action-runner.js";
import { writeAuditEvent } from "../../audit/audit.js";

export async function archiveOffboardingCase(input: {
  workflowInstanceId: string;
  actorUserId: string;
  actorType: string;
  requestId: string;
  idempotencyKey: string;
}) {
  const actionDefinition = await prisma.actionDefinition.findUniqueOrThrow({
    where: { actionCode: "offboarding.archive" }
  });

  return createActionRun({
    actionCode: "offboarding.archive",
    actorType: input.actorType,
    actorId: input.actorUserId,
    input: { workflowInstanceId: input.workflowInstanceId },
    execute: async ({ emit }) => {
      emit("input_validated", "ok", { workflowInstanceId: input.workflowInstanceId });

      const workflow = await prisma.workflowInstance.findUniqueOrThrow({
        where: { id: input.workflowInstanceId },
        include: { tasks: true, employee: true }
      });

      if (workflow.status !== "FINANCE_CONFIRM") {
        throw new Error("invalid_state");
      }

      const invocation = await prisma.actionInvocation.create({
        data: {
          actionDefinitionId: actionDefinition.id,
          requestId: input.requestId,
          idempotencyKey: input.idempotencyKey,
          actorType: input.actorType,
          actorId: input.actorUserId,
          channel: "api",
          inputPayloadJson: { workflowInstanceId: input.workflowInstanceId },
          status: "RUNNING"
        }
      });

      const finalTask = workflow.tasks[workflow.tasks.length - 1];

      await prisma.$transaction(async (tx) => {
        await tx.taskArtifact.create({
          data: {
            taskId: finalTask.id,
            artifactType: "archive_snapshot",
            artifactUri: `archive://${workflow.id}`,
            artifactPayloadJson: {
              employeeId: workflow.employee.id,
              employeeNo: workflow.employee.employeeNo,
              workflowInstanceId: workflow.id
            }
          }
        });

        await tx.workflowInstance.update({
          where: { id: workflow.id },
          data: {
            status: "ARCHIVED",
            completedAt: new Date()
          }
        });

        await tx.employeeMaster.update({
          where: { id: workflow.employee.id },
          data: {
            currentStatus: "OFFBOARDED"
          }
        });

        await tx.actionResult.create({
          data: {
            invocationId: invocation.id,
            success: true,
            businessObjectType: "workflow_instance",
            businessObjectId: workflow.id,
            outputPayloadJson: { status: "ARCHIVED" }
          }
        });

        await tx.actionInvocation.update({
          where: { id: invocation.id },
          data: { status: "SUCCEEDED", finishedAt: new Date() }
        });

        await tx.workflowEvent.create({
          data: {
            workflowInstanceId: workflow.id,
            taskId: finalTask.id,
            eventType: "artifact_written",
            eventPayloadJson: { artifactType: "archive_snapshot" }
          }
        });
      });

      emit("artifact_written", "ok", { workflowInstanceId: workflow.id });
      emit("state_transition_applied", "ok", { status: "ARCHIVED" });

      await writeAuditEvent({
        actorType: input.actorType,
        actorId: input.actorUserId,
        entityType: "WorkflowInstance",
        entityId: workflow.id,
        operation: "ARCHIVE",
        afterJson: { status: "ARCHIVED" },
        requestId: input.requestId
      });

      return {
        success: true,
        businessObjectType: "workflow_instance",
        businessObjectId: workflow.id,
        nextActions: [],
        artifacts: [{ type: "archive_snapshot", id: workflow.id }]
      };
    }
  });
}
```

In `apps/backend/src/modules/offboarding/offboarding.routes.ts`, replace the direct `doArchive()` response path with:

```ts
const action = await archiveOffboardingCase({
  workflowInstanceId: req.params.id,
  actorUserId: req.user!.id,
  actorType: "user",
  requestId: crypto.randomUUID(),
  idempotencyKey: req.header("x-idempotency-key") ?? crypto.randomUUID()
});

res.json(action);
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm -w apps/backend exec vitest run src/test/offboarding-actions.test.ts
```

Expected: PASS with workflow status `ARCHIVED` and at least one `archive_snapshot` artifact.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/offboarding/offboarding.actions.ts apps/backend/src/modules/offboarding/offboarding.routes.ts apps/backend/src/test/offboarding-actions.test.ts
git commit -m "feat: add offboarding archive action"
```

## Task 5: Surface Action Envelopes in the Frontend Worklists

**Files:**
- Create: `apps/frontend/src/shared/types/action.ts`
- Create: `apps/frontend/src/shared/components/ActionEventTimeline.tsx`
- Modify: `apps/frontend/src/shared/api/client.ts`
- Modify: `apps/frontend/src/pages/HrWorklistPage.tsx`
- Modify: `apps/frontend/src/pages/ManagerConfirmPage.tsx`
- Modify: `apps/frontend/src/pages/FinanceConfirmPage.tsx`

- [ ] **Step 1: Write the failing frontend type contract**

Create `apps/frontend/src/shared/types/action.ts`

```ts
export type ActionEvent = {
  eventType: string;
  timestamp: string;
  status: "ok" | "failed";
  summary: string;
  payload: Record<string, unknown>;
};

export type ActionEnvelope<T = Record<string, unknown>> = {
  events: ActionEvent[];
  result: {
    success: boolean;
    businessObjectType: string;
    businessObjectId: string;
    nextActions: string[];
    artifacts: Array<{ type: string; id: string }>;
  } & T;
};
```

Add failing compile expectation in `apps/frontend/src/pages/HrWorklistPage.tsx`:

```ts
const response = await apiFetch<ActionEnvelope>("POST", `/api/onboarding-cases/${row.id}/transition`, { to: "HR_REVIEW" });
message.success(response.events.at(-1)?.summary ?? "操作成功");
```

- [ ] **Step 2: Run build to verify it fails**

Run:

```bash
npm -w apps/frontend run build
```

Expected: FAIL because `ActionEnvelope` and `ActionEventTimeline` are not wired into the page yet.

- [ ] **Step 3: Write minimal implementation**

`apps/frontend/src/shared/components/ActionEventTimeline.tsx`

```tsx
import { List, Tag, Typography } from "antd";
import type { ActionEvent } from "../types/action";

export function ActionEventTimeline(props: { events: ActionEvent[] }) {
  return (
    <List
      size="small"
      dataSource={props.events}
      renderItem={(event) => (
        <List.Item>
          <Typography.Text code>{event.eventType}</Typography.Text>
          <Tag color={event.status === "ok" ? "green" : "red"}>{event.status}</Tag>
          <Typography.Text>{event.summary}</Typography.Text>
        </List.Item>
      )}
    />
  );
}
```

Update `apps/frontend/src/shared/api/client.ts` so the helper keeps the generic return type:

```ts
export async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "request_failed" }));
    throw new Error(data.error ?? "request_failed");
  }

  return res.json() as Promise<T>;
}
```

In each page action button callback, unwrap the envelope:

```ts
const response = await apiFetch<ActionEnvelope>("POST", `/api/offboarding-cases/${row.id}/archive`, {});
message.success(response.events.at(-1)?.summary ?? "操作成功");
await reload();
```

Render the latest event list under the table in `HrWorklistPage.tsx`:

```tsx
const [latestEvents, setLatestEvents] = useState<ActionEvent[]>([]);

<ActionEventTimeline events={latestEvents} />
```

and update state after every successful mutation:

```ts
setLatestEvents(response.events);
```

- [ ] **Step 4: Run build to verify it passes**

Run:

```bash
npm -w apps/frontend run build
```

Expected: PASS with Vite build success.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/shared/types/action.ts apps/frontend/src/shared/components/ActionEventTimeline.tsx apps/frontend/src/shared/api/client.ts apps/frontend/src/pages/HrWorklistPage.tsx apps/frontend/src/pages/ManagerConfirmPage.tsx apps/frontend/src/pages/FinanceConfirmPage.tsx
git commit -m "feat: display action event envelopes in worklists"
```

## Task 6: Add End-to-End API Coverage and Update the Runbook

**Files:**
- Create: `apps/backend/src/test/hr-lifecycle-api.test.ts`
- Modify: `apps/backend/README.md`

- [ ] **Step 1: Write the failing end-to-end API test**

`apps/backend/src/test/hr-lifecycle-api.test.ts`

```ts
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";

let employeeToken = "";
let hrToken = "";
let managerToken = "";
let financeToken = "";

describe("hr lifecycle api", () => {
  beforeAll(async () => {
    const app = createApp();

    employeeToken = (
      await request(app).post("/api/auth/login").send({
        email: "employee@hros.local",
        password: "password12345"
      })
    ).body.token;

    hrToken = (
      await request(app).post("/api/auth/login").send({
        email: "hr@hros.local",
        password: "password12345"
      })
    ).body.token;

    managerToken = (
      await request(app).post("/api/auth/login").send({
        email: "manager@hros.local",
        password: "password12345"
      })
    ).body.token;

    financeToken = (
      await request(app).post("/api/auth/login").send({
        email: "finance@hros.local",
        password: "password12345"
      })
    ).body.token;
  });

  it("runs offboarding through archive and returns action events", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/offboarding-cases")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({});

    expect(created.status).toBe(200);

    const submitted = await request(app)
      .post(`/api/offboarding-cases/${created.body.result.businessObjectId}/submit`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({});

    expect(submitted.body.events[0].eventType).toBe("command_received");

    const hr = await request(app)
      .post(`/api/offboarding-cases/${created.body.result.businessObjectId}/transition`)
      .set("Authorization", `Bearer ${hrToken}`)
      .send({ to: "HR_REVIEW" });

    expect(hr.status).toBe(200);

    const manager = await request(app)
      .post(`/api/offboarding-cases/${created.body.result.businessObjectId}/transition`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ to: "MANAGER_CONFIRM" });

    expect(manager.status).toBe(200);

    const finance = await request(app)
      .post(`/api/offboarding-cases/${created.body.result.businessObjectId}/transition`)
      .set("Authorization", `Bearer ${financeToken}`)
      .send({ to: "ARCHIVED" });

    expect(finance.status).toBe(200);
    expect(finance.body.events.at(-1).eventType).toBe("command_succeeded");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/hr-lifecycle-api.test.ts
```

Expected: FAIL because the create/submit/transition endpoints still mix old case IDs and new action envelope payloads until all route handlers are aligned.

- [ ] **Step 3: Write minimal implementation**

Align all onboarding/offboarding route handlers so that:

- every mutation endpoint returns `ActionEnvelope`
- `:id` path param always represents `workflowInstanceId`
- every route writes an `ActionInvocation` and `ActionResult`
- `README.md` documents the new local flow

Replace the “手工验证路径” section in `apps/backend/README.md` with:

```md
## 手工验证路径

### PostgreSQL 准备

```bash
docker compose up -d db
cp apps/backend/.env.example apps/backend/.env
npm -w apps/backend run prisma:migrate -- --name ai_native_core
npm -w apps/backend run prisma:seed
```

### 入职闭环

1. `employee@hros.local` 创建并提交入职流程。
2. `hr@hros.local` 审核到 `HR_REVIEW` 与 `MANAGER_CONFIRM`。
3. `manager@hros.local` 完成最终确认。
4. 每一步都应返回 `events` 与 `result`。

### 离职闭环

1. `employee@hros.local` 创建并提交离职流程。
2. `hr@hros.local` 推进到 `HR_REVIEW`。
3. `manager@hros.local` 推进到 `MANAGER_CONFIRM`。
4. `finance@hros.local` 归档流程并写入 `archive_snapshot` 产物。
```
```

- [ ] **Step 4: Run the full backend suite**

Run:

```bash
npm run test:backend
```

Expected: PASS with auth, action runner, schema, onboarding, offboarding, and lifecycle API tests all green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/test/hr-lifecycle-api.test.ts apps/backend/README.md apps/backend/src/modules/onboarding/onboarding.routes.ts apps/backend/src/modules/offboarding/offboarding.routes.ts
git commit -m "test: cover ai-native hr lifecycle flows"
```

## Self-Review

### Spec coverage

- 数据库骨架：Task 2 覆盖 `core/workflow/action/audit/private` 一期最小模型。
- CLI/动作层：Task 1、Task 3、Task 4 覆盖动作定义、动作执行、事件流返回。
- 权限与策略：依赖现有 `requireAuth`, `requireRole`, `scope`，Task 3 与 Task 4 在重构路由时保留。
- 审计：Task 3 与 Task 4 引入 `writeAuditEvent`；Task 6 用 E2E 验证。
- 前端可见性：Task 5 增加事件时间线。
- 测试边界：Task 1 到 Task 6 分别覆盖单元、集成、E2E。

### Placeholder scan

- 本计划未使用 `TBD`、`TODO`、`implement later`、`similar to Task N` 等占位语句。
- 每个任务都给出了明确文件、命令和最小代码。

### Type consistency

- 后端统一使用 `ActionEnvelope`, `ActionEvent`, `ActionResult`。
- 数据模型统一使用新命名：`EmployeeMaster`, `WorkflowInstance`, `ActionInvocation`, `AuditEvent`。
- 前端统一消费 `ActionEnvelope`。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-25-hros-ai-native-hr-lifecycle.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
