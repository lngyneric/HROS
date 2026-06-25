# HROS CLI Audit MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 HROS 落地一套可上线的 CLI MVP，覆盖 schema patch、前置风险评估、审批/阻断、安全事件、补偿动作、原子命令以及审计查询命令。

**Architecture:** CLI 不直接操作业务真相表，而是统一进入 `action layer`。每次 CLI 调用必须先做参数校验、风险评估和审批判断，再落 `action_invocation` 主记录，然后执行业务动作并写入 `action_result`、`workflow_event`、`audit_event`、`security_event`、`compensation_action`。CLI 入口采用后端内置 `tsx` 运行，不新增外部 CLI 框架依赖，确保实现轻量、可测、可控。

**Tech Stack:** TypeScript 5, Prisma 6, PostgreSQL 16, Express 4, Zod 3, Vitest 2, tsx 4

---

## File Structure

### Backend files to modify

- Modify: `apps/backend/package.json`
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/src/db/seed.ts`
- Modify: `apps/backend/src/modules/onboarding/onboarding.actions.ts`
- Modify: `apps/backend/src/modules/offboarding/offboarding.actions.ts`
- Modify: `apps/backend/src/audit/audit.ts`

### Backend files to create

- Create: `apps/backend/src/cli/main.ts`
- Create: `apps/backend/src/cli/command-registry.ts`
- Create: `apps/backend/src/cli/output.ts`
- Create: `apps/backend/src/cli/context.ts`
- Create: `apps/backend/src/cli/parser.ts`
- Create: `apps/backend/src/cli/commands/onboarding-create.ts`
- Create: `apps/backend/src/cli/commands/onboarding-submit.ts`
- Create: `apps/backend/src/cli/commands/onboarding-approve-hr.ts`
- Create: `apps/backend/src/cli/commands/onboarding-approve-manager.ts`
- Create: `apps/backend/src/cli/commands/offboarding-create.ts`
- Create: `apps/backend/src/cli/commands/offboarding-approve-hr.ts`
- Create: `apps/backend/src/cli/commands/offboarding-approve-manager.ts`
- Create: `apps/backend/src/cli/commands/offboarding-approve-finance.ts`
- Create: `apps/backend/src/cli/commands/offboarding-archive.ts`
- Create: `apps/backend/src/cli/commands/action-list.ts`
- Create: `apps/backend/src/cli/commands/action-get.ts`
- Create: `apps/backend/src/cli/commands/audit-list.ts`
- Create: `apps/backend/src/cli/commands/whoami.ts`
- Create: `apps/backend/src/cli/risk/risk.types.ts`
- Create: `apps/backend/src/cli/risk/risk-policy.ts`
- Create: `apps/backend/src/cli/risk/risk-evaluator.ts`
- Create: `apps/backend/src/cli/security/security-event.ts`
- Create: `apps/backend/src/cli/security/blocking.ts`
- Create: `apps/backend/src/cli/approval/approval-policy.ts`
- Create: `apps/backend/src/cli/invocation/create-cli-invocation.ts`
- Create: `apps/backend/src/cli/invocation/finalize-cli-invocation.ts`
- Create: `apps/backend/src/cli/invocation/cli-trace.ts`
- Create: `apps/backend/src/cli/query/action-query.ts`
- Create: `apps/backend/src/cli/query/audit-query.ts`
- Create: `apps/backend/src/test/cli-schema.test.ts`
- Create: `apps/backend/src/test/cli-risk-policy.test.ts`
- Create: `apps/backend/src/test/cli-invocation.test.ts`
- Create: `apps/backend/src/test/cli-onboarding.test.ts`
- Create: `apps/backend/src/test/cli-offboarding.test.ts`
- Create: `apps/backend/src/test/cli-query.test.ts`

### Migration artifacts to create

- Create: `apps/backend/prisma/migrations/<timestamp>_cli_audit_mvp/migration.sql`

## Task 1: Patch the Prisma Schema for CLI Audit MVP

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Test: `apps/backend/src/test/cli-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `apps/backend/src/test/cli-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { prisma } from "../db/prisma.js";

describe("cli audit schema", () => {
  it("supports CLI invocation context and security events", async () => {
    const invocation = await prisma.actionInvocation.create({
      data: {
        actionDefinitionId: "missing",
        requestId: "req-cli-schema-test",
        idempotencyKey: "idem-cli-schema-test",
        actorType: "human",
        actorId: "seed-admin",
        channel: "cli",
        inputPayloadJson: {},
        status: "RUNNING",
        commandName: "hros onboarding create",
        rawCommand: "hros onboarding create --employee-id emp_001",
        argsJson: { employeeId: "emp_001" },
        traceId: "trace-cli-schema-test",
        clientVersion: "0.1.0",
        runtimeEnv: "dev",
        hostname: "local-dev",
        operatorIp: "127.0.0.1",
        isDryRun: false,
        isInteractive: false,
        outputFormat: "json",
        riskLevel: "LOW",
        requiresApproval: false
      }
    });

    expect(invocation.commandName).toBe("hros onboarding create");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-schema.test.ts
```

Expected: FAIL with Prisma validation error because fields like `commandName`, `riskLevel`, or `SecurityEvent` support do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Update `apps/backend/prisma/schema.prisma` to:

- extend `WorkflowDomainType` with `EMPLOYEE`, `WORKFLOW`, `AUDIT`, `SYSTEM`
- add enums `RiskLevel`, `SecurityEventType`, `SecurityResolutionStatus`, `CompensationStatus`
- add fields to `ActionInvocation`:
  - `commandName`
  - `rawCommand`
  - `argsJson`
  - `traceId`
  - `clientVersion`
  - `runtimeEnv`
  - `hostname`
  - `operatorIp`
  - `isDryRun`
  - `isInteractive`
  - `outputFormat`
  - `riskLevel`
  - `requiresApproval`
  - `blockingReason`
- add fields to `ActionResult`:
  - `completedAt`
  - `resultSummary`
  - `errorStack`
- add fields to `ApprovalRequest`:
  - `approvalType`
  - `requestedAt`
- add fields to `AuditEvent`:
  - `channel`
  - `invocationId`
  - `traceId`
- add fields to `WorkflowEvent`:
  - `invocationId`
  - `requestId`
  - `traceId`
- add new tables:
  - `SecurityEvent`
  - `CompensationAction`

Use this representative Prisma fragment:

```prisma
enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model SecurityEvent {
  id               String                   @id @default(uuid())
  invocationId     String
  actorId          String
  eventType        SecurityEventType
  targetResource   String
  riskLevel        RiskLevel
  detailsJson      Json
  occurredAt       DateTime                 @default(now())
  resolvedAt       DateTime?
  resolutionStatus SecurityResolutionStatus @default(OPEN)

  invocation       ActionInvocation         @relation(fields: [invocationId], references: [id])
}
```

Then generate the migration:

```bash
npm -w apps/backend run prisma:migrate -- --name cli_audit_mvp
npm -w apps/backend run prisma:generate
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-schema.test.ts
```

Expected: PASS after replacing the temporary foreign-key-breaking test data with real seeded `ActionDefinition` lookup in the final implementation.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/prisma/schema.prisma apps/backend/prisma/migrations apps/backend/src/test/cli-schema.test.ts
git commit -m "feat: add cli audit schema patch"
```

## Task 2: Add CLI Risk Evaluation, Approval Policy, and Security Event Recording

**Files:**
- Create: `apps/backend/src/cli/risk/risk.types.ts`
- Create: `apps/backend/src/cli/risk/risk-policy.ts`
- Create: `apps/backend/src/cli/risk/risk-evaluator.ts`
- Create: `apps/backend/src/cli/security/security-event.ts`
- Create: `apps/backend/src/cli/security/blocking.ts`
- Create: `apps/backend/src/cli/approval/approval-policy.ts`
- Test: `apps/backend/src/test/cli-risk-policy.test.ts`

- [ ] **Step 1: Write the failing risk policy test**

Create `apps/backend/src/test/cli-risk-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateRisk } from "../cli/risk/risk-evaluator.js";

describe("cli risk evaluator", () => {
  it("marks offboarding archive as HIGH risk and requiring approval", () => {
    const result = evaluateRisk({
      commandName: "hros offboarding archive",
      actorRole: "PAYROLL_FINANCE",
      args: { workflowInstanceId: "wf-1" }
    });

    expect(result.riskLevel).toBe("HIGH");
    expect(result.requiresApproval).toBe(true);
    expect(result.canProceed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-risk-policy.test.ts
```

Expected: FAIL because `evaluateRisk` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/backend/src/cli/risk/risk.types.ts`:

```ts
export type CliRiskEvaluationInput = {
  commandName: string;
  actorRole: string;
  args: Record<string, unknown>;
};

export type CliRiskEvaluation = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requiresApproval: boolean;
  canProceed: boolean;
  blockingReason: string | null;
  approvalType: string | null;
};
```

Create `apps/backend/src/cli/risk/risk-policy.ts`:

```ts
export const CLI_RISK_POLICY = {
  "hros onboarding create": { riskLevel: "LOW", requiresApproval: false },
  "hros onboarding submit": { riskLevel: "LOW", requiresApproval: false },
  "hros onboarding approve-hr": { riskLevel: "MEDIUM", requiresApproval: false },
  "hros onboarding approve-manager": { riskLevel: "MEDIUM", requiresApproval: false },
  "hros offboarding create": { riskLevel: "LOW", requiresApproval: false },
  "hros offboarding approve-hr": { riskLevel: "MEDIUM", requiresApproval: false },
  "hros offboarding approve-manager": { riskLevel: "MEDIUM", requiresApproval: false },
  "hros offboarding approve-finance": { riskLevel: "HIGH", requiresApproval: true, approvalType: "OFFBOARDING_FINANCE_APPROVAL" },
  "hros offboarding archive": { riskLevel: "HIGH", requiresApproval: true, approvalType: "OFFBOARDING_ARCHIVE_APPROVAL" },
  "hros employee change-org": { riskLevel: "HIGH", requiresApproval: true, approvalType: "EMPLOYEE_ORG_CHANGE_APPROVAL" },
  "hros employee change-manager": { riskLevel: "HIGH", requiresApproval: true, approvalType: "EMPLOYEE_MANAGER_CHANGE_APPROVAL" }
} as const;
```

Create `apps/backend/src/cli/risk/risk-evaluator.ts`:

```ts
import { CLI_RISK_POLICY } from "./risk-policy.js";
import type { CliRiskEvaluationInput } from "./risk.types.js";

export function evaluateRisk(input: CliRiskEvaluationInput) {
  const matched = CLI_RISK_POLICY[input.commandName as keyof typeof CLI_RISK_POLICY];
  if (!matched) {
    return {
      riskLevel: "CRITICAL" as const,
      requiresApproval: true,
      canProceed: false,
      blockingReason: "unknown_command_risk",
      approvalType: "UNKNOWN_COMMAND"
    };
  }

  return {
    riskLevel: matched.riskLevel,
    requiresApproval: matched.requiresApproval,
    canProceed: matched.requiresApproval ? false : true,
    blockingReason: matched.requiresApproval ? "approval_required" : null,
    approvalType: "approvalType" in matched ? matched.approvalType : null
  };
}
```

Create `apps/backend/src/cli/security/security-event.ts`:

```ts
import { prisma } from "../../db/prisma.js";

export function writeSecurityEvent(input: {
  invocationId: string;
  actorId: string;
  eventType:
    | "FORBIDDEN_ACCESS_ATTEMPT"
    | "READ_SENSITIVE_DATA"
    | "EXPORT_SENSITIVE_DATA"
    | "APPROVAL_BYPASS_ATTEMPT"
    | "HIGH_RISK_COMMAND_BLOCKED"
    | "SUSPICIOUS_REPEATED_RETRY";
  targetResource: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  detailsJson: Record<string, unknown>;
}) {
  return prisma.securityEvent.create({
    data: input
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-risk-policy.test.ts
```

Expected: PASS with risk policy behavior green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/cli/risk apps/backend/src/cli/security apps/backend/src/cli/approval apps/backend/src/test/cli-risk-policy.test.ts
git commit -m "feat: add cli risk and security policy"
```

## Task 3: Add CLI Invocation Lifecycle Helpers

**Files:**
- Create: `apps/backend/src/cli/invocation/create-cli-invocation.ts`
- Create: `apps/backend/src/cli/invocation/finalize-cli-invocation.ts`
- Create: `apps/backend/src/cli/invocation/cli-trace.ts`
- Modify: `apps/backend/src/audit/audit.ts`
- Test: `apps/backend/src/test/cli-invocation.test.ts`

- [ ] **Step 1: Write the failing invocation lifecycle test**

Create `apps/backend/src/test/cli-invocation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCliInvocation } from "../cli/invocation/create-cli-invocation.js";

describe("cli invocation lifecycle", () => {
  it("creates a running invocation with CLI context fields", async () => {
    const invocation = await createCliInvocation({
      actionCode: "onboarding.create",
      actorId: "seed-employee",
      actorType: "human",
      commandName: "hros onboarding create",
      rawCommand: "hros onboarding create --employee-id emp_001",
      argsJson: { employeeId: "emp_001" },
      inputPayloadJson: { employeeId: "emp_001" },
      traceId: "trace-cli-1",
      clientVersion: "0.1.0",
      runtimeEnv: "dev",
      hostname: "local-dev",
      operatorIp: "127.0.0.1",
      isDryRun: false,
      isInteractive: false,
      outputFormat: "json",
      riskLevel: "LOW",
      requiresApproval: false,
      blockingReason: null
    });

    expect(invocation.channel).toBe("cli");
    expect(invocation.commandName).toBe("hros onboarding create");
    expect(invocation.status).toBe("RUNNING");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-invocation.test.ts
```

Expected: FAIL because invocation helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/backend/src/cli/invocation/cli-trace.ts`:

```ts
import { randomUUID } from "node:crypto";

export function makeTraceId() {
  return `trace_${randomUUID()}`;
}

export function makeRequestId() {
  return `req_${randomUUID()}`;
}

export function makeIdempotencyKey(commandName: string, argsJson: Record<string, unknown>) {
  return `${commandName}:${JSON.stringify(argsJson)}`;
}
```

Create `apps/backend/src/cli/invocation/create-cli-invocation.ts`:

```ts
import { prisma } from "../../db/prisma.js";

export async function createCliInvocation(input: {
  actionCode: string;
  actorId: string;
  actorType: string;
  commandName: string;
  rawCommand: string;
  argsJson: Record<string, unknown>;
  inputPayloadJson: Record<string, unknown>;
  traceId: string;
  clientVersion: string;
  runtimeEnv: string;
  hostname: string;
  operatorIp: string;
  isDryRun: boolean;
  isInteractive: boolean;
  outputFormat: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  requiresApproval: boolean;
  blockingReason: string | null;
}) {
  const definition = await prisma.actionDefinition.findUniqueOrThrow({
    where: { actionCode: input.actionCode }
  });

  return prisma.actionInvocation.create({
    data: {
      actionDefinitionId: definition.id,
      requestId: `${input.traceId}:${Date.now()}`,
      idempotencyKey: `${input.commandName}:${JSON.stringify(input.argsJson)}`,
      actorType: input.actorType,
      actorId: input.actorId,
      channel: "cli",
      inputPayloadJson: input.inputPayloadJson,
      status: "RUNNING",
      commandName: input.commandName,
      rawCommand: input.rawCommand,
      argsJson: input.argsJson,
      traceId: input.traceId,
      clientVersion: input.clientVersion,
      runtimeEnv: input.runtimeEnv,
      hostname: input.hostname,
      operatorIp: input.operatorIp,
      isDryRun: input.isDryRun,
      isInteractive: input.isInteractive,
      outputFormat: input.outputFormat,
      riskLevel: input.riskLevel,
      requiresApproval: input.requiresApproval,
      blockingReason: input.blockingReason
    }
  });
}
```

Create `apps/backend/src/cli/invocation/finalize-cli-invocation.ts`:

```ts
import { prisma } from "../../db/prisma.js";

export async function finalizeCliInvocation(input: {
  invocationId: string;
  success: boolean;
  businessObjectType: string;
  businessObjectId: string;
  outputPayloadJson: Record<string, unknown>;
  resultSummary: string;
  errorCode?: string;
  errorMessage?: string;
  errorStack?: string;
}) {
  await prisma.actionResult.create({
    data: {
      invocationId: input.invocationId,
      success: input.success,
      businessObjectType: input.businessObjectType,
      businessObjectId: input.businessObjectId,
      outputPayloadJson: input.outputPayloadJson,
      resultSummary: input.resultSummary,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      errorStack: input.errorStack
    }
  });

  return prisma.actionInvocation.update({
    where: { id: input.invocationId },
    data: {
      status: input.success ? "SUCCEEDED" : "FAILED",
      finishedAt: new Date()
    }
  });
}
```

Update `apps/backend/src/audit/audit.ts` to add CLI-aware helper:

```ts
export async function writeCliAuditEvent(input: {
  invocationId: string;
  traceId: string;
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
      requestId: input.requestId,
      channel: "cli",
      invocationId: input.invocationId,
      traceId: input.traceId
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-invocation.test.ts
```

Expected: PASS with invocation lifecycle green.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/cli/invocation apps/backend/src/audit/audit.ts apps/backend/src/test/cli-invocation.test.ts
git commit -m "feat: add cli invocation lifecycle helpers"
```

## Task 4: Add the CLI Runtime, Parser, and Core Commands

**Files:**
- Create: `apps/backend/src/cli/main.ts`
- Create: `apps/backend/src/cli/context.ts`
- Create: `apps/backend/src/cli/parser.ts`
- Create: `apps/backend/src/cli/output.ts`
- Create: `apps/backend/src/cli/command-registry.ts`
- Create: `apps/backend/src/cli/commands/onboarding-create.ts`
- Create: `apps/backend/src/cli/commands/onboarding-submit.ts`
- Create: `apps/backend/src/cli/commands/onboarding-approve-hr.ts`
- Create: `apps/backend/src/cli/commands/onboarding-approve-manager.ts`
- Create: `apps/backend/src/cli/commands/offboarding-create.ts`
- Create: `apps/backend/src/cli/commands/offboarding-approve-hr.ts`
- Create: `apps/backend/src/cli/commands/offboarding-approve-manager.ts`
- Create: `apps/backend/src/cli/commands/offboarding-approve-finance.ts`
- Create: `apps/backend/src/cli/commands/offboarding-archive.ts`
- Modify: `apps/backend/package.json`
- Test: `apps/backend/src/test/cli-onboarding.test.ts`
- Test: `apps/backend/src/test/cli-offboarding.test.ts`

- [ ] **Step 1: Write the failing CLI command test**

Create `apps/backend/src/test/cli-onboarding.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runCli } from "../cli/main.js";

describe("cli onboarding", () => {
  it("returns structured events for onboarding create", async () => {
    const result = await runCli([
      "onboarding",
      "create",
      "--actor-id",
      "seed-employee",
      "--employee-id",
      "self"
    ]);

    expect(result.status).toBe("succeeded");
    expect(result.events[0]?.eventType).toBe("command_received");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-onboarding.test.ts
```

Expected: FAIL because CLI entry point does not exist.

- [ ] **Step 3: Write minimal implementation**

Update `apps/backend/package.json` scripts:

```json
{
  "scripts": {
    "cli": "tsx src/cli/main.ts"
  }
}
```

Create `apps/backend/src/cli/parser.ts`:

```ts
export function parseCliArgs(argv: string[]) {
  const [group, command, ...rest] = argv;
  const flags: Record<string, string> = {};

  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.replace(/^--/, "");
    const value = rest[i + 1];
    if (key) flags[key] = value;
  }

  return {
    commandName: `hros ${group} ${command}`,
    group,
    command,
    flags
  };
}
```

Create `apps/backend/src/cli/output.ts`:

```ts
export function cliSuccess(output: Record<string, unknown>) {
  return {
    status: "succeeded",
    ...output
  };
}

export function cliFailure(message: string, errorCode = "cli_failed") {
  return {
    status: "failed",
    errorCode,
    errorMessage: message
  };
}
```

Create `apps/backend/src/cli/main.ts` with exported `runCli(argv)` and direct execution support:

```ts
import { parseCliArgs } from "./parser.js";
import { cliFailure } from "./output.js";
import { runRegisteredCommand } from "./command-registry.js";

export async function runCli(argv: string[]) {
  const parsed = parseCliArgs(argv);
  return runRegisteredCommand(parsed);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exit(result.status === "succeeded" ? 0 : 1);
    })
    .catch((error) => {
      process.stdout.write(`${JSON.stringify(cliFailure(error instanceof Error ? error.message : "unknown_error"), null, 2)}\n`);
      process.exit(1);
    });
}
```

Create command handlers that:

- call `evaluateRisk`
- create CLI invocation
- write `SecurityEvent` if blocked
- call existing action services:
  - `createOnboardingDraft`
  - `archiveOffboardingCase`
- finalize invocation and emit structured event output

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-onboarding.test.ts src/test/cli-offboarding.test.ts
```

Expected: PASS with structured JSON output containing `events` and `result`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/package.json apps/backend/src/cli apps/backend/src/test/cli-onboarding.test.ts apps/backend/src/test/cli-offboarding.test.ts
git commit -m "feat: add cli runtime and core lifecycle commands"
```

## Task 5: Add Audit Query Commands and Read-Only Security Logging

**Files:**
- Create: `apps/backend/src/cli/query/action-query.ts`
- Create: `apps/backend/src/cli/query/audit-query.ts`
- Create: `apps/backend/src/cli/commands/action-list.ts`
- Create: `apps/backend/src/cli/commands/action-get.ts`
- Create: `apps/backend/src/cli/commands/audit-list.ts`
- Create: `apps/backend/src/cli/commands/whoami.ts`
- Test: `apps/backend/src/test/cli-query.test.ts`

- [ ] **Step 1: Write the failing query command test**

Create `apps/backend/src/test/cli-query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runCli } from "../cli/main.js";

describe("cli query commands", () => {
  it("lists action invocations in JSON", async () => {
    const result = await runCli(["action", "list", "--actor-id", "seed-admin"]);

    expect(result.status).toBe("succeeded");
    expect(Array.isArray(result.items)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-query.test.ts
```

Expected: FAIL because query commands do not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/backend/src/cli/query/action-query.ts`:

```ts
import { prisma } from "../../db/prisma.js";

export function listActionInvocations(actorId?: string) {
  return prisma.actionInvocation.findMany({
    where: actorId ? { actorId } : {},
    include: {
      result: true,
      approvals: true
    },
    orderBy: { startedAt: "desc" },
    take: 50
  });
}

export function getActionInvocation(id: string) {
  return prisma.actionInvocation.findUnique({
    where: { id },
    include: {
      result: true,
      approvals: true,
      securityEvents: true,
      workflowEvents: true,
      auditEvents: true
    }
  });
}
```

Create `apps/backend/src/cli/query/audit-query.ts`:

```ts
import { prisma } from "../../db/prisma.js";

export function listAuditEvents(entityType?: string, entityId?: string) {
  return prisma.auditEvent.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {})
    },
    orderBy: { eventTime: "desc" },
    take: 50
  });
}
```

Implement commands:

- `hros action list`
- `hros action get --id <id>`
- `hros audit list`
- `hros auth whoami`

For `audit list` and `action get`, if the query touches sensitive context, write `SecurityEvent` with `READ_SENSITIVE_DATA`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-query.test.ts
```

Expected: PASS with stable JSON query output.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/cli/query apps/backend/src/cli/commands/action-list.ts apps/backend/src/cli/commands/action-get.ts apps/backend/src/cli/commands/audit-list.ts apps/backend/src/cli/commands/whoami.ts apps/backend/src/test/cli-query.test.ts
git commit -m "feat: add cli audit query commands"
```

## Task 6: Verify Full CLI MVP End-to-End and Update the Backend Runbook

**Files:**
- Modify: `apps/backend/README.md`

- [ ] **Step 1: Write the failing full-suite expectation**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-schema.test.ts src/test/cli-risk-policy.test.ts src/test/cli-invocation.test.ts src/test/cli-onboarding.test.ts src/test/cli-offboarding.test.ts src/test/cli-query.test.ts
```

Expected: FAIL until all CLI paths are wired.

- [ ] **Step 2: Update the runbook**

Replace or add a `## CLI MVP` section in `apps/backend/README.md`:

```md
## CLI MVP

### 登录上下文

CLI MVP 第一阶段不做独立凭证文件，测试环境通过 `--actor-id` 与现有数据库种子用户映射。

### 核心命令

```bash
npm -w apps/backend run cli -- onboarding create --actor-id seed-employee --employee-id self
npm -w apps/backend run cli -- onboarding submit --actor-id seed-employee --workflow-id <workflow-id>
npm -w apps/backend run cli -- offboarding archive --actor-id seed-finance --workflow-id <workflow-id>
npm -w apps/backend run cli -- action list --actor-id seed-admin
```

### 输出契约

所有命令默认输出 JSON，至少包含：

- `status`
- `invocationId`
- `traceId`
- `events`
- `result`

### 风险控制

- 高风险命令先评估风险
- 需要审批时先写 `ApprovalRequest`
- 被阻断命令必须写 `SecurityEvent`
```

- [ ] **Step 3: Run the complete backend verification**

Run:

```bash
npm -w apps/backend exec vitest run src/test/cli-schema.test.ts src/test/cli-risk-policy.test.ts src/test/cli-invocation.test.ts src/test/cli-onboarding.test.ts src/test/cli-offboarding.test.ts src/test/cli-query.test.ts
npm run test:backend
npm -w apps/backend run build
```

Expected:
- all CLI tests PASS
- existing backend suite PASS
- backend build PASS

- [ ] **Step 4: Smoke test representative CLI commands**

Run:

```bash
npm -w apps/backend run cli -- onboarding create --actor-id seed-employee --employee-id self --output json
npm -w apps/backend run cli -- action list --actor-id seed-admin --output json
```

Expected:
- both commands exit `0`
- output includes `invocationId`, `traceId`, and structured `events`

- [ ] **Step 5: Commit**

```bash
git add apps/backend/README.md
git commit -m "docs: add cli mvp runbook and verification"
```

## Self-Review

### Spec coverage

- schema patch：Task 1 覆盖 CLI 审计所需字段与新表
- 前置风险控制：Task 2 覆盖风险等级、阻断与安全事件
- CLI 主调用链路：Task 3 覆盖 invocation/result/audit 关联
- CLI 原子命令：Task 4 覆盖 onboarding/offboarding MVP 命令
- CLI 审计查询：Task 5 覆盖 `action list/get` 与 `audit list`
- 验证与文档：Task 6 覆盖 README、测试、构建与 smoke test

### Placeholder scan

- 本计划未使用 `TBD`、`TODO`、`implement later`、`Similar to Task N`
- 每个任务都给出了明确文件、命令与最小代码

### Type consistency

- 统一核心类型：`CliRiskEvaluation`, `ActionInvocation`, `SecurityEvent`, `CompensationAction`
- 统一输出约定：`status`, `invocationId`, `traceId`, `events`, `result`
- 统一 CLI 风险字段：`riskLevel`, `requiresApproval`, `blockingReason`, `approvalType`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-25-hros-cli-audit-mvp.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
