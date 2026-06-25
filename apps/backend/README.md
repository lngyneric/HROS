# HROS Backend（AI Native 入离职底座）

## 本地运行（PostgreSQL）

在仓库根目录执行。

### 1) 安装依赖

```bash
npm install --cache ./.npm-cache
```

### 2) 准备 PostgreSQL 并初始化数据库

```bash
docker compose up -d db
cp apps/backend/.env.example apps/backend/.env
npm -w apps/backend run prisma:migrate -- --name ai_native_core
npm -w apps/backend run prisma:seed
npm -w apps/backend run prisma:generate
```

### 3) 启动后端

```bash
npm -w apps/backend run dev
```

后端地址：`http://localhost:3003`

### 4) 启动前端

另开一个终端：

```bash
npm -w apps/frontend run dev -- --host 0.0.0.0 --port 5173
```

前端地址：`http://localhost:5173`

## 测试账号

密码统一：`password12345`

- employee@hros.local（员工自助）
- manager@hros.local（部门经理）
- hr@hros.local（HR 专员）
- hrbp@hros.local（HRBP）
- finance@hros.local（薪资财务）
- admin@hros.local（管理员）

## CLI MVP

### 登录上下文

CLI 当前不使用独立凭证文件，也没有单独的登录流程。本地测试与手工验证通过 `--actor-id` 直接绑定数据库中的种子用户，例如：

- `seed-employee`
- `seed-manager`
- `seed-hr`
- `seed-finance`
- `seed-admin`

可先执行：

```bash
npm -w apps/backend run cli -- auth whoami --actor-id seed-admin --output json
```

### 命令入口

统一入口：

```bash
npm -w apps/backend run cli -- <group> <command> [flags]
```

### Phase 2 当前命令范围

1. 查询与审计
   - `action list`
   - `action get`
   - `audit list`
   - `auth whoami`

2. 独立审批命令
   - `approval list`
   - `approval approve`
   - `approval reject`

3. 入职流程命令（已接入真实动作服务）
   - `onboarding create`
   - `onboarding submit`
   - `onboarding approve-hr`
   - `onboarding approve-manager`

4. 离职流程命令（已接入真实动作服务）
   - `offboarding create`
   - `offboarding approve-hr`
   - `offboarding approve-manager`
   - `offboarding approve-finance`
   - `offboarding archive`

当前实现说明：

- `onboarding create -> submit -> approve-hr -> approve-manager` 可形成完整 CLI 闭环。
- `offboarding create` 当前会先创建 draft，再在同一条命令里自动执行 submit；CLI 中没有单独注册 `offboarding submit` 命令。
- `offboarding approve-finance` 和 `offboarding archive` 都是高风险命令，首次执行会返回 `approval_required` 并生成 `ApprovalRequest`；在对应审批单被批准后，重新执行原命令才会继续执行业务动作。
- 审批解析依赖 `approvalType + targetResource`，其中工作流目标资源统一写为 `workflow:<workflowInstanceId>`。

### 常用示例

```bash
npm -w apps/backend run cli -- onboarding create --actor-id seed-employee --employee-id self --output json
npm -w apps/backend run cli -- onboarding submit --actor-id seed-employee --workflow-instance-id <workflow-id> --output json
npm -w apps/backend run cli -- approval list --actor-id seed-admin --output json
npm -w apps/backend run cli -- approval approve --actor-id seed-admin --approval-request-id <approval-request-id> --output json
npm -w apps/backend run cli -- offboarding archive --actor-id seed-finance --workflow-instance-id <workflow-id> --output json
npm -w apps/backend run cli -- action list --actor-id seed-admin --limit 10 --output json
npm -w apps/backend run cli -- action get --actor-id seed-admin --id <invocation-id> --output json
npm -w apps/backend run cli -- audit list --actor-id seed-admin --entity-type workflow_instance --entity-id <workflow-id> --output json
```

### 输出契约

所有命令默认输出 JSON。统一输出结构包含：

- `status`：`succeeded` / `blocked` / `failed`
- `invocationId`
- `traceId`
- `events`
- `result`

典型事件流包括：

- `command_received`
- `policy_checked`
- `invocation_created`
- 领域事件或 `query_completed`
- `security_event_written`
- `command_blocked`
- `invocation_finalized`

被审批门控的阻断结果会在 `result` 中额外包含：

- `approvalType`
- `approvalRequestId`
- `approvalStatus`
- `targetResource`
- `securityEventId`

### 风险控制与安全审计

- 所有命令都会先做参数解析、执行人解析和风险评估。
- 高风险命令不会直接执行，而是通过显式审批流继续推进。
- `offboarding approve-finance` 对应审批类型 `OFFBOARDING_FINANCE_APPROVAL`。
- `offboarding archive` 对应审批类型 `OFFBOARDING_ARCHIVE_APPROVAL`。
- `approval list` 默认返回最近 50 条审批记录；管理员可查看全部，其他角色仅能看到自己可处理的审批。
- `approval approve` / `approval reject` 只允许管理员或匹配审批人的角色处理待审批记录。
- 对于 `action get`、带敏感过滤条件的 `audit list` 等查询命令，会记录 `READ_SENSITIVE_DATA` 安全事件。
- CLI 调用统一写入 `ActionInvocation`，结束时写入 `ActionResult`；阻断命令还会写入 `ApprovalRequest` 与 `SecurityEvent`，真实业务动作会继续写入 `WorkflowEvent` 与 `AuditEvent`。

## 手工验证路径

当前手工验证优先覆盖 CLI Phase 2 的创建、审批、归档闭环，并校验 `events` / `result` 输出结构以及关键工作流状态变更。

### PostgreSQL 准备

```bash
docker compose up -d db
cp apps/backend/.env.example apps/backend/.env
npm -w apps/backend run prisma:migrate -- --name ai_native_core
npm -w apps/backend run prisma:seed
```

### 入职闭环

1. 以员工身份执行 `onboarding create` 创建流程。
2. 使用上一步返回的 `workflowInstanceId` 依次执行 `onboarding submit`、`onboarding approve-hr`、`onboarding approve-manager`。
3. 每次响应都应返回统一 CLI 包装结构，并包含 `invocationId`、`traceId`、`events`、`result`。
4. 最终 `WorkflowInstance.status` 应变为 `COMPLETED`，数据库中应写入对应的 `ActionInvocation`、`ActionResult`、`WorkflowEvent` 与 `AuditEvent`。

### 离职审批与归档闭环

1. 以员工身份执行 `offboarding create`；该命令会创建离职流程并自动提交。
2. 依次执行 `offboarding approve-hr`、`offboarding approve-manager`。
3. 首次执行 `offboarding approve-finance` 应返回 `blocked`，`result.code` 为 `approval_required`，并生成审批单。
4. 以管理员执行 `approval approve --approval-request-id <id>` 后，再次执行 `offboarding approve-finance`，流程应推进到 `FINANCE_CONFIRM`。
5. 首次执行 `offboarding archive` 也应返回 `blocked` 并生成新的审批单；审批通过后再次执行该命令，流程应归档成功。
6. 归档成功后，`WorkflowInstance.status` 应变为 `ARCHIVED`，员工状态变更为 `OFFBOARDED`，并写入 `TaskArtifact`、`WorkflowEvent`、`ActionInvocation`、`ActionResult` 与 `AuditEvent`。
