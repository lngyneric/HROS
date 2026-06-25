# HROS 审批中心与 Skill 合规整合设计

## 背景

HROS 当前已经具备以下能力：

- 新版前端已完成 `login / self / hr / manager / finance` 的 TanStack 路由迁移
- CLI 已完成两阶段落地，具备：
  - `ActionInvocation / ActionResult / WorkflowEvent / AuditEvent / SecurityEvent / ApprovalRequest` 审计骨架
  - 独立审批命令：`approval list / approval approve / approval reject`
  - onboarding/offboarding 的部分真实流转
  - 高风险命令审批后再执行的闭环

当前系统缺口不在“审批能力不存在”，而在“审批入口分散、界面缺失、skill 无统一接入、合规展示与报表不足”。

因此本设计的目标不是再发明一套审批机制，而是把现有审批与审计能力整合成 HROS 的统一审批中心，并把 skill 纳入同一条合规链路。

---

## 目标

本项目需要同时实现 4 件事：

1. 新增一个独立的 HROS 审批中心页面
2. 让 CLI、界面、API、skill 成为同一审批中心的统一来源
3. 强化合规链路，明确“审批前确认”和“审批后记录”
4. 提供必要的审批/合规报表查询，而不是只做单条审批处理

---

## 非目标

本阶段明确不做以下内容：

- 自动审批策略引擎
- 多级串行审批编排器
- 审批中心的大屏 BI 仪表盘
- 自定义报表设计器
- skill 独立审批中心
- 批量审批 / 批量拒绝
- 审批后自动执行原命令
- 通用低代码工作流设计器

这些内容都可能在后续迭代中有价值，但不属于当前最小可上线范围。

---

## 核心原则

### 1. 审批中心是一等入口

审批中心不是 CLI 的附属页面，也不是某个角色工作台的小挂件，而是 HROS 的独立模块。

建议新增独立路由：

- `/approvals`

它统一承接：

- CLI 发起的审批请求
- 界面发起的审批请求
- API 发起的审批请求
- skill 发起的审批请求

### 2. Skill 不是特权通道

skill 必须和 `ui / cli / api` 一样，走同一套：

- 风险评估
- 审批前确认
- `ApprovalRequest`
- 审批中心批准/拒绝
- 审批后记录
- 审计与报表

skill 可以是来源，但不能绕过审批中心。

### 3. 风控前置，不能事后补救

任何高风险动作都必须在真正执行业务之前完成：

- 风险评估
- 审批前确认
- 审批请求创建

批准前不得执行业务动作。

### 4. 审计字段优先于日志

需要支撑审批、合规和报表的数据，必须落结构化字段或结构化查询结果，不能只依赖日志。

---

## 信息架构

### 路由结构

建议新增以下前端路由：

- `/approvals`
  - 审批中心首页
- `/approvals/:id`
  - 可选。第一版不一定单独做详情页，优先采用右侧详情面板；但路由预留有利于后续深链接

### 模块边界

建议新增独立模块：

- `modules/approvals`
  - 负责审批请求列表、详情、批准、拒绝、报表查询
- `modules/compliance`
  - 负责审批前确认、审批后记录、合规摘要与报表聚合

如果第一版希望减少文件数量，可以先只做 `modules/approvals`，但代码组织上应明确区分：

- 审批处理逻辑
- 合规记录与报表逻辑

---

## 页面设计

## 页面布局

审批中心采用 **A. 双栏效率型**：

- 左栏：审批队列
- 右栏：当前审批详情与操作

这个布局适合“处理效率优先”的目标，也便于后续逐步增加审计字段与 skill 来源信息。

### 左栏结构

左栏从上到下分 3 层：

1. 页面标题与轻量统计卡
2. 筛选区域
3. 审批队列列表

#### 顶部统计卡

第一版显示：

- 待我处理
- 全部待审批
- 高风险审批
- skill 来源审批

统计卡是快速导航，不承担复杂分析职责。

#### 筛选区域

第一版建议保留这些筛选：

- `待我处理`
- `全部`
- `已批准`
- `已拒绝`
- `高风险`

可选补充：

- 来源筛选：`UI / CLI / API / Skill`
- 角色筛选：`HR / 财务 / 经理 / 管理员`

#### 队列列表项字段

每条审批项展示最小决策信息：

- `approvalStatus`
- `riskLevel`
- `approvalType`
- `sourceChannel`
- `commandName`
- `targetResource`
- `requestedBy`
- `requestedAt`
- `approverRole`
- `traceId` 的短标识

#### 列表排序

默认排序规则：

1. `PENDING` 优先
2. `HIGH / CRITICAL` 风险优先
3. 最新请求优先

### 右栏结构

右栏采用从判断到审计的阅读顺序：

1. 审批摘要
2. 业务对象
3. 来源与上下文
4. 事件流
5. 审计摘要
6. 操作区

#### 审批摘要

显示：

- 审批类型
- 当前状态
- 风险等级
- 当前可处理角色
- 是否允许当前用户操作

#### 业务对象

显示：

- `businessObjectType`
- `businessObjectId`
- `targetResource`

#### 来源与上下文

显示：

- `sourceChannel`
- `commandName`
- `invocationId`
- `traceId`
- `requestId`
- `requestedBy`
- `requestedAt`

如果来源为 `skill`，额外显示：

- `skillName`
- `skillActionCode`

#### 事件流

显示核心事件，不直接 dump 原始 JSON：

- command received
- policy checked
- pre-approval confirmation recorded
- approval requested
- approved / rejected
- action executed
- post-approval record written

#### 审计摘要

展示关键 before/after 差异，而不是原样输出大块 JSON。

#### 操作区

第一版只保留：

- `批准`
- `拒绝`

交互规则：

- 只有 `PENDING` 可操作
- `APPROVED / REJECTED` 全部只读
- `拒绝` 必须填写原因
- `批准` 默认一键通过

---

## 权限模型

### 角色可见性

- `ADMIN`
  - 可查看所有审批
  - 可批准/拒绝所有审批
- `HR`
  - 仅查看分配给 HR 的审批
  - 仅处理 HR 角色审批
- `PAYROLL_FINANCE`
  - 仅查看分配给财务的审批
  - 仅处理财务角色审批
- `MANAGER`
  - 仅查看分配给经理的审批
  - 仅处理经理角色审批

### 权限计算原则

前端不自行推断权限，后端直接返回：

- 用户可见哪些审批
- 当前审批 `canAct` 是否为 `true`
- 如果不可操作，原因是什么

这保证权限控制仍然是后端主导。

---

## 审批状态机

审批请求状态维持简单状态机：

- `PENDING`
- `APPROVED`
- `REJECTED`

状态规则：

- 仅 `PENDING` 可批准/拒绝
- `APPROVED / REJECTED` 不可重复处理
- 若原始高风险命令已被批准，后续业务命令可以继续执行
- 审批通过不自动触发原命令，仍采用“重新执行原命令”的策略

### 高风险命令链路

统一链路为：

```text
高风险动作首次执行
-> 风险评估
-> 审批前确认
-> 生成 ApprovalRequest(PENDING)
-> 审批中心批准 / 拒绝
-> 若批准，原命令可再次执行
-> 执行业务动作
-> 审批后记录
```

---

## Skill 一等来源模型

### 来源扩展

现有审批与审计来源统一扩展为：

- `ui`
- `cli`
- `api`
- `skill`

### Skill 需要新增的上下文

当来源为 `skill` 时，审批详情和报表需要额外可见：

- `skillName`
- `skillActionCode`
- `complianceReason`
- `preApprovalConfirmationId`
- `postApprovalExecutionStatus`

### Skill 进入审批中心的方式

skill 发起高风险动作时：

1. 先完成风险评估
2. 写审批前确认记录
3. 生成 `ApprovalRequest`
4. 在审批中心作为普通审批项展示
5. 审批后继续执行或终止

这样 skill 不需要独立审批 UI，而是复用统一入口。

---

## 合规设计

## 审批前确认

任何高风险请求在生成 `ApprovalRequest` 之前，都必须写一条“审批前确认”记录。

建议至少包含：

- `sourceChannel`
- `skillName`（若来源是 skill）
- `actionCode / commandName`
- `businessObjectType`
- `businessObjectId`
- `targetResource`
- `riskLevel`
- `requestedBy`
- `complianceReason`
- `expectedImpact`
- `traceId`
- `invocationId`

这条记录的目标是确认：

- 谁想做这件事
- 为什么想做
- 会影响什么对象
- 风险判断是什么

## 审批后记录

无论审批是批准还是拒绝，都必须写“审批后记录”。

建议至少包含：

- `approvalRequestId`
- `approvalStatus`
- `approvedBy / rejectedBy`
- `decisionAt`
- `decisionReason`
- `executionStatus`
- `postApprovalExecutionStatus`
- `traceId`
- `invocationId`

如果审批通过后原命令被重跑并执行成功，还要能体现：

- 是否已执行
- 执行结果
- 执行影响对象

### 合规目标

合规链路要能够回答：

- 哪个渠道发起了这次高风险请求
- 审批前是否完成确认
- 谁批准/拒绝了它
- 批准后是否执行了原动作
- 审批后记录是否完整

---

## API 设计边界

第一版建议新增最小 API：

- `GET /api/approvals`
- `GET /api/approvals/:id`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `GET /api/approval-reports/overview`
- `GET /api/approval-reports/sources`
- `GET /api/approval-reports/compliance`

### 列表返回字段

审批列表项建议返回：

- `id`
- `approvalType`
- `approvalStatus`
- `riskLevel`
- `sourceChannel`
- `commandName`
- `targetResource`
- `requestedBy`
- `requestedAt`
- `approverRole`
- `traceId`
- `canAct`

### 详情返回字段

审批详情建议返回：

- 列表全部字段
- `businessObjectType`
- `businessObjectId`
- `invocationId`
- `requestId`
- `events`
- `auditSummary`
- `decisionReason`
- `skillName`
- `skillActionCode`
- `preApprovalConfirmation`
- `postApprovalRecord`

### 批准 / 拒绝接口规则

- `approve`：
  - 仅允许 `PENDING`
  - 返回更新后的审批详情
- `reject`：
  - 仅允许 `PENDING`
  - 必须带 `decisionReason`
  - 返回更新后的审批详情

---

## 报表设计

本阶段只做必要报表，不做重 BI。

### 1. 审批总览

展示：

- 待审批总数
- 已批准总数
- 已拒绝总数
- 高风险审批数
- skill 来源审批数

### 2. 来源分布

展示来源维度：

- UI
- CLI
- API
- Skill

目的：

- 观察 skill 是否已经成为主要审批入口
- 对比 CLI/UI 的审批负载差异

### 3. 审批效率

展示：

- 平均审批时长
- 各角色平均审批时长
- 高风险审批平均时长

### 4. 合规追踪

展示：

- 审批前确认缺失数
- 审批后记录缺失数
- 已批准但未执行数
- 已拒绝后仍有执行尝试的异常数

这类报表是本项目的关键价值之一，因为它直接支撑“不是事后补救，而是可追踪、可审计、可证明”。

---

## 前端实现边界

第一版前端只做：

- `/approvals` 路由
- 左栏审批列表
- 右栏详情面板
- 批准弹窗
- 拒绝弹窗
- 基础筛选
- 统计卡
- 空状态 / 加载状态 / 无权限状态
- 必要报表区域或二级 Tab

第一版明确不做：

- 批量审批
- 复杂高级筛选
- 导出
- 自动轮询刷新
- 审批后自动执行原命令
- skill 独立审批专区

---

## 测试策略

### 后端接口测试

覆盖：

- 审批列表权限过滤
- 审批详情查询
- 批准
- 拒绝
- 拒绝理由校验
- 非 `PENDING` 状态不可重复处理
- skill 来源审批详情字段返回

### 前端页面测试

覆盖：

- `/approvals` 列表渲染
- 左栏切换右栏详情
- `canAct=false` 时按钮禁用
- 批准弹窗确认
- 拒绝弹窗原因校验
- 空状态 / 加载状态 / 无权限状态

### 联调测试

最少覆盖两条主链路：

1. `CLI 高风险命令 -> 生成 ApprovalRequest -> 审批中心批准 -> 重跑原命令 -> 执行成功`
2. `Skill 高风险动作 -> 生成 ApprovalRequest -> 审批中心拒绝 -> 原动作不可继续执行`

---

## 实施顺序

建议按以下顺序落地：

1. 后端审批 API
2. skill 一等来源与合规记录模型
3. 前端审批中心骨架
4. 前端批准/拒绝交互
5. 报表查询接口与前端展示
6. CLI / skill / UI 联调

这样可以先稳定后端语义，再接页面，最后验证完整闭环。

---

## 验收标准

当以下条件都满足时，第一版可认为上线可用：

- `/approvals` 可访问
- 角色权限正确
- 审批列表和详情可读
- `PENDING` 审批可批准/拒绝
- 拒绝必须填写原因
- 批准/拒绝后状态立即更新
- CLI / UI / Skill 使用统一审批数据源
- skill 审批能展示来源和合规上下文
- 审批前确认与审批后记录可查询
- 必要报表可展示

---

## 方案总结

本设计将 HROS 审批中心定义为：

- CLI、UI、API、skill 的统一审批入口
- 高风险动作的统一风控外壳
- 审计与合规的统一可视入口
- skill 一等来源的统一接入层

如果按这个方案落地，HROS 不会形成“CLI 一套、界面一套、skill 一套”的分裂结构，而会形成一条统一的审批与合规主干。
