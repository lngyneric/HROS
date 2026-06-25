# HROS CLI 审计 MVP Schema Patch

## 目标

这份 patch 只解决一件事：

- 让 HROS 的 CLI 审计达到 **MVP 可上线** 标准

具体要求：

- CLI 调用必须留下结构化主记录
- 风险必须前置评估，不允许只做事后补救
- 审批、越权、阻断、补偿都要有明确落表
- 关键字段必须是结构化字段，不能只塞进 JSON

---

## 1. Patch 范围

本 patch 包含 4 类变更：

1. 扩展现有枚举
2. 给现有审计相关表补字段
3. 新增安全事件表
4. 新增补偿动作表

---

## 2. 新增 / 扩展枚举

### 2.1 扩展 `WorkflowDomainType`

当前：

```prisma
enum WorkflowDomainType {
  ONBOARDING
  OFFBOARDING
}
```

修改为：

```prisma
enum WorkflowDomainType {
  ONBOARDING
  OFFBOARDING
  EMPLOYEE
  WORKFLOW
  AUDIT
  SYSTEM
}
```

用途：

- 支撑 `employee.change-org`
- 支撑 `employee.change-manager`
- 支撑系统级 CLI 动作

### 2.2 新增 `RiskLevel`

```prisma
enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

用途：

- CLI 风险前置评估
- 安全告警与审批判定

### 2.3 新增 `SecurityEventType`

```prisma
enum SecurityEventType {
  FORBIDDEN_ACCESS_ATTEMPT
  READ_SENSITIVE_DATA
  EXPORT_SENSITIVE_DATA
  APPROVAL_BYPASS_ATTEMPT
  HIGH_RISK_COMMAND_BLOCKED
  SUSPICIOUS_REPEATED_RETRY
}
```

### 2.4 新增 `SecurityResolutionStatus`

```prisma
enum SecurityResolutionStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
  FALSE_POSITIVE
}
```

### 2.5 新增 `CompensationStatus`

```prisma
enum CompensationStatus {
  PENDING
  SUCCEEDED
  FAILED
  CANCELLED
}
```

---

## 3. 现有表字段补强

## 3.1 `ActionInvocation`

当前表已经有：

- `requestId`
- `idempotencyKey`
- `actorType`
- `actorId`
- `channel`
- `inputPayloadJson`
- `status`
- `startedAt`
- `finishedAt`

但还不够表达 CLI 审计和前置风险控制。

### 需要补的字段

```prisma
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

  commandName        String?
  rawCommand         String?
  argsJson           Json?
  traceId            String?
  clientVersion      String?
  runtimeEnv         String?
  hostname           String?
  operatorIp         String?
  isDryRun           Boolean                @default(false)
  isInteractive      Boolean                @default(false)
  outputFormat       String?
  riskLevel          RiskLevel?
  requiresApproval   Boolean                @default(false)
  blockingReason     String?

  actionDefinition   ActionDefinition       @relation(fields: [actionDefinitionId], references: [id])
  result             ActionResult?
  approvals          ApprovalRequest[]
  securityEvents     SecurityEvent[]
  compensations      CompensationAction[]   @relation("SourceInvocationCompensations")
}
```

### 这些字段为什么必须是显式字段

- `commandName`
- `rawCommand`
- `traceId`
- `riskLevel`
- `requiresApproval`
- `blockingReason`

这些不能只放 JSON，因为后续必须支持：

- 精确检索
- 高风险命令监控
- 审批统计
- CLI 会话追踪

---

## 3.2 `ActionResult`

当前已有：

- `success`
- `businessObjectType`
- `businessObjectId`
- `outputPayloadJson`
- `errorCode`
- `errorMessage`

### 建议补的字段

```prisma
model ActionResult {
  id                 String   @id @default(uuid())
  invocationId       String   @unique
  success            Boolean
  businessObjectType String
  businessObjectId   String
  outputPayloadJson  Json
  errorCode          String?
  errorMessage       String?

  completedAt        DateTime @default(now())
  resultSummary      String?
  errorStack         String?

  invocation         ActionInvocation @relation(fields: [invocationId], references: [id])
}
```

用途：

- `completedAt`：明确动作结果最终完成时间
- `resultSummary`：便于 CLI / UI 做摘要展示
- `errorStack`：保留排障证据，生产环境可脱敏

---

## 3.3 `ApprovalRequest`

当前已有：

- `approverRole`
- `approverId`
- `approvalStatus`
- `decisionAt`
- `decisionReason`

### 需要补的字段

```prisma
model ApprovalRequest {
  id             String         @id @default(uuid())
  invocationId   String
  approverRole   RoleCode
  approverId     String
  approvalStatus ApprovalStatus
  decisionAt     DateTime?
  decisionReason String?

  approvalType   String?
  requestedAt    DateTime       @default(now())

  invocation     ActionInvocation @relation(fields: [invocationId], references: [id])
}
```

用途：

- `approvalType`：区分归档审批、敏感读取审批、主数据变更审批
- `requestedAt`：没有这个字段就无法严格定义“审批在执行前发生”

---

## 3.4 `AuditEvent`

当前已有：

- `actorType`
- `actorId`
- `entityType`
- `entityId`
- `operation`
- `beforeJson`
- `afterJson`
- `reason`
- `requestId`

### 需要补的字段

```prisma
model AuditEvent {
  id           String   @id @default(uuid())
  eventTime    DateTime @default(now())
  actorType    String
  actorId      String
  entityType   String
  entityId     String
  operation    String
  beforeJson   Json?
  afterJson    Json?
  reason       String?
  requestId    String?

  channel      String?
  invocationId String?
  traceId      String?

  invocation   ActionInvocation? @relation(fields: [invocationId], references: [id])
}
```

用途：

- 明确区分 CLI / UI / API / Agent 来源
- 允许直接从一次 CLI 调用追踪到所有业务改动

---

## 3.5 `WorkflowEvent`

当前已有：

- `workflowInstanceId`
- `taskId`
- `eventType`
- `eventPayloadJson`
- `occurredAt`

### 需要补的字段

```prisma
model WorkflowEvent {
  id                 String   @id @default(uuid())
  workflowInstanceId String
  taskId             String?
  eventType          String
  eventPayloadJson   Json
  occurredAt         DateTime @default(now())

  invocationId       String?
  requestId          String?
  traceId            String?

  workflowInstance   WorkflowInstance @relation(fields: [workflowInstanceId], references: [id])
  invocation         ActionInvocation? @relation(fields: [invocationId], references: [id])
}
```

用途：

- 让一次 CLI 执行与事件流可直接 join
- 不再依赖时间戳模糊比对

---

## 4. 新增安全事件表

CLI 审计 MVP 必须包含 `SecurityEvent`。

```prisma
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

### 必须落此表的场景

- 越权尝试
- 高风险命令被阻断
- 审批绕过尝试
- 敏感数据读取
- 敏感数据导出
- 重复失败重试

---

## 5. 新增补偿动作表

CLI 审计 MVP 建议同步上线 `CompensationAction`。

```prisma
model CompensationAction {
  id                    String             @id @default(uuid())
  sourceInvocationId    String
  compensatingActionCode String
  payloadJson           Json
  status                CompensationStatus
  executedAt            DateTime?
  resultJson            Json?

  sourceInvocation      ActionInvocation   @relation("SourceInvocationCompensations", fields: [sourceInvocationId], references: [id])
}
```

用途：

- 多步骤命令失败后的补偿
- 外部系统部分成功后的回滚
- 防止人工修库成为默认方案

---

## 6. Prisma Patch 版本

下面给出一版整合后的 Prisma patch 片段，便于直接迁入 `schema.prisma`。

```prisma
enum WorkflowDomainType {
  ONBOARDING
  OFFBOARDING
  EMPLOYEE
  WORKFLOW
  AUDIT
  SYSTEM
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum SecurityEventType {
  FORBIDDEN_ACCESS_ATTEMPT
  READ_SENSITIVE_DATA
  EXPORT_SENSITIVE_DATA
  APPROVAL_BYPASS_ATTEMPT
  HIGH_RISK_COMMAND_BLOCKED
  SUSPICIOUS_REPEATED_RETRY
}

enum SecurityResolutionStatus {
  OPEN
  ACKNOWLEDGED
  RESOLVED
  FALSE_POSITIVE
}

enum CompensationStatus {
  PENDING
  SUCCEEDED
  FAILED
  CANCELLED
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

  commandName        String?
  rawCommand         String?
  argsJson           Json?
  traceId            String?
  clientVersion      String?
  runtimeEnv         String?
  hostname           String?
  operatorIp         String?
  isDryRun           Boolean                @default(false)
  isInteractive      Boolean                @default(false)
  outputFormat       String?
  riskLevel          RiskLevel?
  requiresApproval   Boolean                @default(false)
  blockingReason     String?

  actionDefinition   ActionDefinition       @relation(fields: [actionDefinitionId], references: [id])
  result             ActionResult?
  approvals          ApprovalRequest[]
  securityEvents     SecurityEvent[]
  compensations      CompensationAction[]   @relation("SourceInvocationCompensations")
  workflowEvents     WorkflowEvent[]
  auditEvents        AuditEvent[]
}

model ActionResult {
  id                 String   @id @default(uuid())
  invocationId       String   @unique
  success            Boolean
  businessObjectType String
  businessObjectId   String
  outputPayloadJson  Json
  errorCode          String?
  errorMessage       String?
  completedAt        DateTime @default(now())
  resultSummary      String?
  errorStack         String?

  invocation         ActionInvocation @relation(fields: [invocationId], references: [id])
}

model ApprovalRequest {
  id             String         @id @default(uuid())
  invocationId   String
  approverRole   RoleCode
  approverId     String
  approvalStatus ApprovalStatus
  decisionAt     DateTime?
  decisionReason String?
  approvalType   String?
  requestedAt    DateTime       @default(now())

  invocation     ActionInvocation @relation(fields: [invocationId], references: [id])
}

model AuditEvent {
  id           String   @id @default(uuid())
  eventTime    DateTime @default(now())
  actorType    String
  actorId      String
  entityType   String
  entityId     String
  operation    String
  beforeJson   Json?
  afterJson    Json?
  reason       String?
  requestId    String?
  channel      String?
  invocationId String?
  traceId      String?

  invocation   ActionInvocation? @relation(fields: [invocationId], references: [id])
}

model WorkflowEvent {
  id                 String   @id @default(uuid())
  workflowInstanceId String
  taskId             String?
  eventType          String
  eventPayloadJson   Json
  occurredAt         DateTime @default(now())
  invocationId       String?
  requestId          String?
  traceId            String?

  workflowInstance   WorkflowInstance @relation(fields: [workflowInstanceId], references: [id])
  invocation         ActionInvocation? @relation(fields: [invocationId], references: [id])
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

model CompensationAction {
  id                     String             @id @default(uuid())
  sourceInvocationId     String
  compensatingActionCode String
  payloadJson            Json
  status                 CompensationStatus
  executedAt             DateTime?
  resultJson             Json?

  sourceInvocation       ActionInvocation   @relation("SourceInvocationCompensations", fields: [sourceInvocationId], references: [id])
}
```

---

## 7. 上线门槛

这版 patch 上线后，CLI MVP 才算达到可上线条件：

- 高风险命令必须能在执行前落 `riskLevel`
- 被阻断命令必须能落 `ActionInvocation + SecurityEvent`
- 需要审批的命令必须能落 `ApprovalRequest`
- 成功或失败必须都能落 `ActionResult`
- 流程变更必须能通过 `invocationId` 关联到 `WorkflowEvent`
- 数据变更必须能通过 `invocationId` 关联到 `AuditEvent`

---

## 8. 下一步

这份是 **schema patch**，还没包含 migration 顺序与数据兼容策略。

如果继续往下走，下一步应该直接出：

1. Prisma migration 设计
2. 字段是否允许 `nullable` 的上线策略
3. CLI 风险前置判定规则
4. 高风险命令的审批/拦截矩阵
