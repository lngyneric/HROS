# HROS CLI Phase 2 Approval And Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 HROS CLI 从“create + query + risk/blocking”推进到“独立审批命令 + submit/approve/archive 可执行闭环”，并兼容未来 skill 定义流程的审批模式。

**Architecture:** 高风险命令继续先落 `ActionInvocation`，但不再停留在阻断返回；而是统一生成 `ApprovalRequest`，由独立审批命令显式批准或拒绝。业务命令执行前通过 `approvalType + target resource + actor role` 解析可复用的审批决议，再进入真实 action service。命令执行结果继续写入 `ActionResult / WorkflowEvent / AuditEvent / SecurityEvent`，确保 CLI、API 和后续 skill 流程共享同一审计骨架。

**Tech Stack:** TypeScript 5, Prisma 6, PostgreSQL 16, Express 4, Zod 3, Vitest 2, tsx 4

---

## File Structure

### Backend files to modify

- Modify: `apps/backend/package.json`
- Modify: `apps/backend/src/cli/command-registry.ts`
- Modify: `apps/backend/src/cli/context.ts`
- Modify: `apps/backend/src/cli/risk/risk-policy.ts`
- Modify: `apps/backend/src/cli/query/action-query.ts`
- Modify: `apps/backend/src/db/seed.ts`
- Modify: `apps/backend/src/modules/onboarding/onboarding.actions.ts`
- Modify: `apps/backend/src/modules/offboarding/offboarding.actions.ts`

### Backend files to create

- Create: `apps/backend/src/cli/approval/approval-service.ts`
- Create: `apps/backend/src/cli/approval/approval-resolver.ts`
- Create: `apps/backend/src/cli/commands/approval-list.ts`
- Create: `apps/backend/src/cli/commands/approval-approve.ts`
- Create: `apps/backend/src/cli/commands/approval-reject.ts`
- Create: `apps/backend/src/cli/commands/onboarding-submit.ts`
- Create: `apps/backend/src/cli/commands/onboarding-approve-hr.ts`
- Create: `apps/backend/src/cli/commands/onboarding-approve-manager.ts`
- Create: `apps/backend/src/cli/commands/offboarding-create.ts`
- Create: `apps/backend/src/cli/commands/offboarding-approve-hr.ts`
- Create: `apps/backend/src/cli/commands/offboarding-approve-manager.ts`
- Create: `apps/backend/src/cli/commands/offboarding-approve-finance.ts`
- Create: `apps/backend/src/cli/commands/offboarding-archive.ts`
- Create: `apps/backend/src/test/cli-approval.test.ts`
- Create: `apps/backend/src/test/cli-transitions.test.ts`

## Task 1: Add Independent Approval Commands and Approval Resolution

**Files:**
- Create: `apps/backend/src/cli/approval/approval-service.ts`
- Create: `apps/backend/src/cli/approval/approval-resolver.ts`
- Create: `apps/backend/src/cli/commands/approval-list.ts`
- Create: `apps/backend/src/cli/commands/approval-approve.ts`
- Create: `apps/backend/src/cli/commands/approval-reject.ts`
- Modify: `apps/backend/src/cli/command-registry.ts`
- Test: `apps/backend/src/test/cli-approval.test.ts`

- [ ] **Step 1: Write the failing approval command test**

Create `apps/backend/src/test/cli-approval.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runCli } from "../cli/main.js";

describe("cli approval commands", () => {
  it("approves a pending request with a dedicated command", async () => {
    const listResult = await runCli(["approval", "list", "--actor-id", "seed-admin"]);
    expect(listResult.status).toBe("succeeded");

    const pendingId = listResult.result.items.find((item: any) => item.approvalStatus === "PENDING")?.id;
    expect(pendingId).toBeTruthy();

    const approveResult = await runCli([
      "approval",
      "approve",
      "--actor-id",
      "seed-admin",
      "--approval-request-id",
      pendingId
    ]);

    expect(approveResult.status).toBe("succeeded");
    expect(approveResult.result.approvalStatus).toBe("APPROVED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-approval.test.ts
```

Expected: FAIL because approval commands do not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/backend/src/cli/approval/approval-service.ts`:

```ts
import { prisma } from "../../db/prisma.js";

export function listApprovalRequests() {
  return prisma.approvalRequest.findMany({
    orderBy: { requestedAt: "desc" },
    take: 50
  });
}

export async function approveApprovalRequest(input: {
  approvalRequestId: string;
  approverId: string;
}) {
  const record = await prisma.approvalRequest.findUniqueOrThrow({
    where: { id: input.approvalRequestId }
  });

  if (record.approvalStatus !== "PENDING") {
    throw new Error("approval_not_pending");
  }

  return prisma.approvalRequest.update({
    where: { id: record.id },
    data: {
      approverId: input.approverId,
      approvalStatus: "APPROVED",
      decisionAt: new Date(),
      decisionReason: "approved_via_cli"
    }
  });
}
```

Create `apps/backend/src/cli/approval/approval-resolver.ts`:

```ts
import { prisma } from "../../db/prisma.js";

export async function resolveApprovedRequest(input: {
  approvalType: string;
  targetResource: string;
}) {
  return prisma.approvalRequest.findFirst({
    where: {
      approvalType: input.approvalType,
      approvalStatus: "APPROVED",
      invocation: {
        inputPayloadJson: {
          path: ["targetResource"],
          equals: input.targetResource
        }
      }
    },
    orderBy: { decisionAt: "desc" }
  });
}
```

Implement CLI commands:

- `hros approval list`
- `hros approval approve`
- `hros approval reject`

And register them in `command-registry.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-approval.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/cli/approval apps/backend/src/cli/commands/approval-list.ts apps/backend/src/cli/commands/approval-approve.ts apps/backend/src/cli/commands/approval-reject.ts apps/backend/src/cli/command-registry.ts apps/backend/src/test/cli-approval.test.ts
git commit -m "feat: add independent cli approval commands"
```

## Task 2: Add Real Onboarding Submit And Approval Command Execution

**Files:**
- Modify: `apps/backend/src/modules/onboarding/onboarding.actions.ts`
- Modify: `apps/backend/src/cli/commands/onboarding-submit.ts`
- Modify: `apps/backend/src/cli/commands/onboarding-approve-hr.ts`
- Modify: `apps/backend/src/cli/commands/onboarding-approve-manager.ts`
- Test: `apps/backend/src/test/cli-transitions.test.ts`

- [ ] **Step 1: Write the failing onboarding transition test**

Create `apps/backend/src/test/cli-transitions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runCli } from "../cli/main.js";

describe("cli onboarding transitions", () => {
  it("submits and advances onboarding workflow via CLI", async () => {
    const createResult = await runCli([
      "onboarding",
      "create",
      "--actor-id",
      "seed-employee",
      "--employee-id",
      "self"
    ]);

    const workflowId = createResult.result.businessObjectId;

    const submitResult = await runCli([
      "onboarding",
      "submit",
      "--actor-id",
      "seed-employee",
      "--workflow-instance-id",
      workflowId
    ]);

    expect(submitResult.status).toBe("succeeded");
    expect(submitResult.result.businessObjectId).toBe(workflowId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-transitions.test.ts -t "submits and advances onboarding workflow via CLI"
```

Expected: FAIL because onboarding submit still returns `not_implemented`.

- [ ] **Step 3: Write minimal implementation**

Add reusable onboarding actions in `apps/backend/src/modules/onboarding/onboarding.actions.ts`:

- `submitOnboardingDraft`
- `approveOnboardingByHr`
- `approveOnboardingByManager`

Each action must:

- validate current workflow status
- create / update `ActionInvocation`
- write `WorkflowEvent`
- write `ActionResult`
- write `AuditEvent`

Representative transition snippet:

```ts
await tx.workflowInstance.update({
  where: { id: workflow.id },
  data: {
    status: "SUBMITTED"
  }
});
```

Then wire CLI commands to these services instead of `blockCliCommand`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-transitions.test.ts -t "submits and advances onboarding workflow via CLI"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/onboarding/onboarding.actions.ts apps/backend/src/cli/commands/onboarding-submit.ts apps/backend/src/cli/commands/onboarding-approve-hr.ts apps/backend/src/cli/commands/onboarding-approve-manager.ts apps/backend/src/test/cli-transitions.test.ts
git commit -m "feat: execute onboarding submit and approvals via cli"
```

## Task 3: Add Real Offboarding Submit And Approval Command Execution

**Files:**
- Modify: `apps/backend/src/modules/offboarding/offboarding.actions.ts`
- Modify: `apps/backend/src/cli/commands/offboarding-create.ts`
- Modify: `apps/backend/src/cli/commands/offboarding-approve-hr.ts`
- Modify: `apps/backend/src/cli/commands/offboarding-approve-manager.ts`
- Modify: `apps/backend/src/cli/commands/offboarding-approve-finance.ts`
- Test: `apps/backend/src/test/cli-transitions.test.ts`

- [ ] **Step 1: Write the failing offboarding transition test**

Add to `apps/backend/src/test/cli-transitions.test.ts`:

```ts
it("advances offboarding workflow to finance confirm via CLI", async () => {
  const createResult = await runCli([
    "offboarding",
    "create",
    "--actor-id",
    "seed-employee",
    "--employee-id",
    "self",
    "--planned-last-day",
    "2026-07-01",
    "--resignation-reason",
    "personal"
  ]);

  const workflowId = createResult.result.businessObjectId;

  const hrResult = await runCli(["offboarding", "approve-hr", "--actor-id", "seed-hr", "--workflow-instance-id", workflowId]);
  expect(hrResult.status).toBe("succeeded");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-transitions.test.ts -t "advances offboarding workflow to finance confirm via CLI"
```

Expected: FAIL because offboarding commands still return blocked/not implemented.

- [ ] **Step 3: Write minimal implementation**

Add reusable offboarding actions in `apps/backend/src/modules/offboarding/offboarding.actions.ts`:

- `createOffboardingDraft`
- `submitOffboardingDraft`
- `approveOffboardingByHr`
- `approveOffboardingByManager`
- `approveOffboardingByFinance`

Each action must:

- validate current workflow status
- transition workflow status (`DRAFT -> SUBMITTED -> HR_REVIEW -> MANAGER_CONFIRM -> FINANCE_CONFIRM`)
- write `WorkflowEvent`
- write `ActionResult`
- write `AuditEvent`

Then wire the corresponding CLI commands to these services.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-transitions.test.ts -t "advances offboarding workflow to finance confirm via CLI"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/offboarding/offboarding.actions.ts apps/backend/src/cli/commands/offboarding-create.ts apps/backend/src/cli/commands/offboarding-approve-hr.ts apps/backend/src/cli/commands/offboarding-approve-manager.ts apps/backend/src/cli/commands/offboarding-approve-finance.ts apps/backend/src/test/cli-transitions.test.ts
git commit -m "feat: execute offboarding transitions via cli"
```

## Task 4: Enforce Approval-Gated Archive Execution And Skill-Compatible Approval Types

**Files:**
- Modify: `apps/backend/src/cli/commands/offboarding-archive.ts`
- Modify: `apps/backend/src/cli/context.ts`
- Modify: `apps/backend/src/cli/risk/risk-policy.ts`
- Modify: `apps/backend/src/cli/approval/approval-service.ts`
- Test: `apps/backend/src/test/cli-approval.test.ts`
- Test: `apps/backend/src/test/cli-transitions.test.ts`

- [ ] **Step 1: Write the failing archive approval test**

Add to `apps/backend/src/test/cli-approval.test.ts`:

```ts
it("requires explicit approval before offboarding archive executes", async () => {
  const archiveAttempt = await runCli([
    "offboarding",
    "archive",
    "--actor-id",
    "seed-finance",
    "--workflow-instance-id",
    "wf-target"
  ]);

  expect(archiveAttempt.status).toBe("blocked");
  expect(archiveAttempt.result.approvalType).toBe("OFFBOARDING_ARCHIVE_APPROVAL");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-approval.test.ts -t "requires explicit approval before offboarding archive executes"
```

Expected: FAIL or incomplete because archive currently blocks but does not resume from an approved request.

- [ ] **Step 3: Write minimal implementation**

Update approval resolution so archive can continue only when there is an approved matching request.

Add a reusable `targetResource` convention in `context.ts`:

```ts
const targetResource = `workflow:${workflowInstanceId}`;
```

Store the target resource in the CLI invocation input payload when blocked, then resolve it from `approvalType + targetResource`.

Keep approval type handling generic so future skill-defined flow commands can register approval types like:

- `SKILL_DEFINED_TRANSITION_APPROVAL`
- `SKILL_DEFINED_ARCHIVE_APPROVAL`

without changing the approval command shape.

Then change `offboarding-archive.ts` so it:

- blocks and creates `ApprovalRequest` when no approved request exists
- executes `archiveOffboardingCase` when matching approved request exists

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-approval.test.ts src/test/cli-transitions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/cli/commands/offboarding-archive.ts apps/backend/src/cli/context.ts apps/backend/src/cli/risk/risk-policy.ts apps/backend/src/cli/approval/approval-service.ts apps/backend/src/test/cli-approval.test.ts apps/backend/src/test/cli-transitions.test.ts
git commit -m "feat: gate archive execution behind cli approvals"
```

## Task 5: Verify End-To-End CLI Phase 2 And Update Runbook

**Files:**
- Modify: `apps/backend/README.md`

- [ ] **Step 1: Write the failing full-suite expectation**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-approval.test.ts src/test/cli-transitions.test.ts
```

Expected: FAIL until all phase 2 paths are wired.

- [ ] **Step 2: Update the runbook**

Update `apps/backend/README.md` `CLI MVP` section to reflect Phase 2:

- `approval list`
- `approval approve`
- `approval reject`
- `onboarding submit`
- `onboarding approve-hr`
- `onboarding approve-manager`
- `offboarding create`
- `offboarding approve-hr`
- `offboarding approve-manager`
- `offboarding approve-finance`
- `offboarding archive` with approval prerequisite

Add representative examples:

```bash
npm -w apps/backend run cli -- approval list --actor-id seed-admin
npm -w apps/backend run cli -- approval approve --actor-id seed-admin --approval-request-id <id>
npm -w apps/backend run cli -- offboarding archive --actor-id seed-finance --workflow-instance-id <workflow-id>
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-schema.test.ts src/test/cli-risk-policy.test.ts src/test/cli-invocation.test.ts src/test/cli-onboarding.test.ts src/test/cli-offboarding.test.ts src/test/cli-query.test.ts src/test/cli-approval.test.ts src/test/cli-transitions.test.ts
npm run test:backend
npm -w apps/backend run build
```

Expected:
- CLI tests PASS
- backend suite PASS
- build PASS

- [ ] **Step 4: Run representative smoke tests**

Run:

```bash
npm -w apps/backend run cli -- onboarding create --actor-id seed-employee --employee-id self --output json
npm -w apps/backend run cli -- onboarding submit --actor-id seed-employee --workflow-instance-id <workflow-id> --output json
npm -w apps/backend run cli -- approval list --actor-id seed-admin --output json
```

Expected:
- commands exit `0`
- outputs contain `invocationId`, `traceId`, `events`, `result`

- [ ] **Step 5: Commit**

```bash
git add apps/backend/README.md
git commit -m "docs: update cli phase 2 runbook"
```

## Self-Review

### Spec coverage

- 独立审批命令：Task 1
- onboarding submit / approve 闭环：Task 2
- offboarding submit / approve 闭环：Task 3
- 审批后 archive 执行闭环：Task 4
- 运行说明与全链路验证：Task 5

### Placeholder scan

- 本计划未使用 `TBD`、`TODO`、`implement later`、`Similar to Task N`
- 每个任务均提供了文件、命令与最小实现方向

### Type consistency

- 审批主类型统一：`approvalType`, `approvalStatus`, `targetResource`
- CLI 输出继续统一：`status`, `invocationId`, `traceId`, `events`, `result`
- 技能兼容扩展统一通过 `approvalType` 表达，而不是命令名硬编码

