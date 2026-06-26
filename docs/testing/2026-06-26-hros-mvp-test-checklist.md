# HROS MVP 测试清单

## 对照范围

本清单基于以下功能边界整理：

- 根目录 `README.md` 中的“当前 MVP 已包含 / 当前尚未包含”
- `apps/backend/README.md` 中的 CLI Phase 2 命令范围与手工验证路径
- `docs/superpowers/specs/2026-06-26-hros-approval-center-skill-compliance-design.md` 中已确认但**尚未实现**的审批中心 / skill 界面整合 / 报表范围

## 一、测试前准备

- [ ] 已安装 Node、npm、Docker
- [ ] PostgreSQL 容器已启动：`docker compose up -d db`
- [ ] 已复制环境变量文件：`cp apps/backend/.env.example apps/backend/.env`
- [ ] 已执行数据库初始化：
  - [ ] `npm -w apps/backend run prisma:migrate -- --name ai_native_core`
  - [ ] `npm -w apps/backend run prisma:seed`
  - [ ] `npm -w apps/backend run prisma:generate`
- [ ] 已执行依赖安装：`npm install --cache ./.npm-cache`
- [ ] 已启动一键开发环境：`npm run dev`
- [ ] 前端可访问：`http://localhost:5173`
- [ ] 后端健康检查可访问：`http://localhost:3003/api/health`

## 二、账号与登录

### 2.1 测试账号可用性

- [ ] `employee@hros.local / password12345` 可登录
- [ ] `manager@hros.local / password12345` 可登录
- [ ] `hr@hros.local / password12345` 可登录
- [ ] `hrbp@hros.local / password12345` 可登录
- [ ] `finance@hros.local / password12345` 可登录
- [ ] `admin@hros.local / password12345` 可登录

### 2.2 登录页行为

- [ ] 打开 `/login` 页面能正常渲染
- [ ] 输入正确账号密码后可进入系统
- [ ] 输入错误密码后有明确失败提示
- [ ] 已登录状态下刷新页面不会立刻丢失会话
- [ ] 未登录直接访问业务页会被导向登录页

## 三、前端页面基础可用性

### 3.1 路由可访问

- [ ] `/self` 可访问
- [ ] `/hr` 可访问
- [ ] `/manager` 可访问
- [ ] `/finance` 可访问

### 3.2 基础布局

- [ ] 顶部 / 页面框架正常渲染
- [ ] 页面无空白屏
- [ ] 页面无明显控制台致命错误
- [ ] 页面刷新后路由状态稳定

## 四、员工自助流程

### 4.1 入职办理（界面）

- [ ] 员工进入 `/self` 能看到入职办理区域
- [ ] “创建草稿”可成功创建一条入职草稿
- [ ] 列表中可看到新创建的工单
- [ ] “提交最新草稿”后状态发生正确变化
- [ ] 最近操作事件区域能正常显示或为空态正确

### 4.2 离职办理（界面）

- [ ] 员工进入 `/self` 能看到离职办理区域
- [ ] 可创建离职草稿
- [ ] 可看到计划离职日或对应记录
- [ ] 无离职记录时空状态正确

## 五、角色工作台

### 5.1 HR 工作台

- [ ] `/hr` 页面能加载待处理项
- [ ] 数据请求成功时列表正常显示
- [ ] 无待处理项时空状态正确

### 5.2 经理工作台

- [ ] `/manager` 页面能加载待处理项
- [ ] 数据请求成功时列表正常显示
- [ ] 无待处理项时空状态正确

### 5.3 财务工作台

- [ ] `/finance` 页面能加载待处理项
- [ ] 数据请求成功时列表正常显示
- [ ] 无待处理项时空状态正确

## 六、CLI 基础能力

### 6.1 CLI 入口与身份

- [ ] `npm -w apps/backend run cli -- auth whoami --actor-id seed-admin --output json` 返回成功
- [ ] 输出包含 `status`
- [ ] 输出包含 `invocationId`
- [ ] 输出包含 `traceId`
- [ ] 输出包含 `events`
- [ ] 输出包含 `result`

### 6.2 查询与审计命令

- [ ] `action list` 返回成功
- [ ] `action get` 可查询指定 invocation
- [ ] `audit list` 返回成功
- [ ] 敏感查询触发时会写 `READ_SENSITIVE_DATA`

## 七、CLI 入职闭环

### 7.1 创建与提交

- [ ] `onboarding create` 返回成功
- [ ] `result.businessObjectId` 可获得 `workflowInstanceId`
- [ ] `onboarding submit` 返回成功
- [ ] `events` 中包含状态推进相关事件

### 7.2 审批流转

- [ ] `onboarding approve-hr` 返回成功
- [ ] `onboarding approve-manager` 返回成功
- [ ] 最终工作流状态为 `COMPLETED`
- [ ] 数据库写入 `ActionInvocation`
- [ ] 数据库写入 `ActionResult`
- [ ] 数据库写入 `WorkflowEvent`
- [ ] 数据库写入 `AuditEvent`

## 八、CLI 离职闭环

### 8.1 创建与前置推进

- [ ] `offboarding create` 返回成功
- [ ] 该命令已自动完成 create + submit
- [ ] `offboarding approve-hr` 返回成功
- [ ] `offboarding approve-manager` 返回成功

### 8.2 财务审批门禁

- [ ] 首次执行 `offboarding approve-finance` 返回 `blocked`
- [ ] `result.code = approval_required`
- [ ] 生成 `ApprovalRequest`
- [ ] 生成 `SecurityEvent`

### 8.3 财务审批通过后执行

- [ ] 管理员执行 `approval approve --approval-request-id <id>` 成功
- [ ] 再次执行 `offboarding approve-finance` 返回成功
- [ ] 工作流推进到财务确认后的正确状态

### 8.4 归档门禁与归档执行

- [ ] 首次执行 `offboarding archive` 返回 `blocked`
- [ ] 返回中包含 `approvalType`
- [ ] 返回中包含 `approvalRequestId`
- [ ] 审批通过后再次执行 `offboarding archive` 返回成功
- [ ] 最终工作流状态为 `ARCHIVED`
- [ ] 员工状态变更为 `OFFBOARDED`
- [ ] 写入 `TaskArtifact`
- [ ] 写入 `WorkflowEvent`
- [ ] 写入 `AuditEvent`

## 九、独立审批命令

### 9.1 审批列表

- [ ] `approval list` 返回成功
- [ ] 管理员可看到全部审批记录
- [ ] 非管理员仅能看到自己可处理的审批

### 9.2 审批操作

- [ ] `approval approve` 可批准 `PENDING` 审批
- [ ] `approval reject` 可拒绝 `PENDING` 审批
- [ ] 已批准审批不能重复批准
- [ ] 已拒绝审批不能重复处理
- [ ] 无权限角色不能处理不属于自己的审批

## 十、审计与安全记录

### 10.1 高风险阻断链路

- [ ] 高风险命令首次执行时写入 `SecurityEvent`
- [ ] 高风险命令首次执行时写入 `ApprovalRequest`
- [ ] CLI 阻断结果包含 `securityEventId`
- [ ] CLI 阻断结果包含 `approvalRequestId`

### 10.2 审计链路一致性

- [ ] 每次 CLI 命令都有 `ActionInvocation`
- [ ] 成功命令有 `ActionResult`
- [ ] 真实业务动作写入 `WorkflowEvent`
- [ ] 真实业务动作写入 `AuditEvent`
- [ ] `traceId` 能串联查询结果与业务执行记录

## 十一、本期明确不测（尚未实现）

以下功能在当前功能清单中属于**已确认方向但尚未实现**，本期不列入通过标准：

- [ ] 审批中心页面 `/approvals`
- [ ] skill 一等来源的界面整合
- [ ] 审批与合规报表页面
- [ ] skill 来源审批的前端展示
- [ ] 审批前确认与审批后记录的独立界面查询

说明：这些功能应在对应实现落地后，单独生成下一期测试清单。

## 十二、建议通过标准

若以下条件全部满足，可认为当前 MVP 测试通过：

- [ ] 本地环境可启动
- [ ] 登录与基础页面可用
- [ ] `/self / hr / manager / finance` 可访问
- [ ] CLI 基础查询命令可用
- [ ] 入职 CLI 闭环可完成
- [ ] 离职 CLI 审批/归档闭环可完成
- [ ] 高风险命令审批前不会直接执行
- [ ] 审计与安全记录链路完整

