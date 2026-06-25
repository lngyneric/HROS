# 入离职业务线（MVP，线性状态机）可运行 HR 系统设计稿

## 1. 背景与现状

本仓库当前以“目录 + 文档 + JSON 数据资产”为主，已具备入离职相关的较完整数据样例与一条可重复的数据处理流水线（清洗→归档→统计）的思路沉淀，但缺少可部署的应用工程（前端/后端/API/数据库迁移/权限与审计）。

本设计稿目标是以“入离职”为第一条业务线，将仓库的信息资产落地为一个可运行、可审计、可扩展的 HR 系统 MVP，并将 Ontology（本体）作为“口径与约束”的单一事实来源，贯穿数据模型、接口、权限与审计。

## 2. 目标与非目标

### 2.1 目标（MVP）

- 打通端到端闭环：待入职 → 在职 → 离职归档。
- 支持 6 类角色：管理员、HRBP、HR 专员、部门经理、员工自助（ESS）、薪资财务。
- 支持字段分级最小集合：Public / Personal / Sensitive / HighlySensitive，并在 API 层实施字段过滤。
- 支持数据范围：All / OrgTree / DepartmentTree / Self，并在所有查询与报表中生效。
- 支持线性状态机（非可配置工作流），并提供“锁定/解锁”机制以满足 MVP 期间的审批状态修改需求。
- 支持审计：敏感字段读取/导出/关键字段变更可追溯。
- 支持归档：离职后生成不可变归档快照（ArchiveSnapshot），并与统计口径解耦（离职不计入在职）。

### 2.2 非目标（明确不做或后置）

- 不做可配置/可编排工作流（条件分支、并行节点、动态表单引擎）。
- 不做完整薪资核算全流程（本期仅定义薪资财务在入离职域的确认节点与敏感访问审计）。
- 不做复杂的跨模块联动（招聘→入职、培训→发展计划等后续按模块扩展）。

## 3. 概念与本体（Ontology）最小骨架

本设计以“本体 = 口径与约束”作为基础能力，MVP 仅要求本体在工程中以配置/结构化文档存在（可先 JSON/YAML），后续可迁移为 RDF/OWL。

### 3.1 核心概念（Classes）

- Actor：系统内主体（User、EmployeeSelf）。
- Role：管理员 / HRBP / HR 专员 / 部门经理 / 员工自助 / 薪资财务。
- OrgUnit：部门（树结构）。
- Position：职位。
- Employment：任职关系（员工↔部门↔职位↔直属上级）。
- Employee：员工主档（非敏感与一般个人信息）。
- EmployeeSensitive：敏感信息（拆表或加密字段）。
- OnboardingCase：入职工单。
- OffboardingCase：离职工单。
- CaseItem：工单子项（材料、确认、交接事项）。
- ArchiveSnapshot：离职归档快照（不可变）。
- AuditLog：审计记录。
- FieldPolicy：字段分级与可见性策略。
- ScopePolicy：数据范围与组织授权策略。

### 3.2 核心关系（Relations）

- hasRole(User → Role)
- hasScope(User → ScopePolicy)
- employedAs(Employee → Employment)
- belongsTo(Employment → OrgUnit)
- reportsTo(Employment → Employee)
- hasItem(Case → CaseItem)
- archivedAs(OffboardingCase → ArchiveSnapshot)
- governs(FieldPolicy/ScopePolicy → API/Resource)

## 4. 角色、数据范围与字段分级

### 4.1 数据范围（Data Scope）

- All：全量组织范围。
- OrgTree：管理员配置的“负责组织范围”，以部门树表达。
- DepartmentTree：以部门经理所在部门为根的部门树。
- Self：仅本人数据（员工自助）。

范围判定必须先于字段过滤执行。

### 4.2 字段分级（Field Classification）

- Public：组织、职位、流程状态等不涉及个人隐私字段。
- Personal：姓名、工号、部门职位、工作邮箱等一般个人信息。
- Sensitive：住址、手机号、证件照片/扫描件、个人邮箱等。
- HighlySensitive：身份证号、银行账号、薪资结果、医疗等。

HighlySensitive 默认仅“管理员 + 明确授权的 HR 专员/薪资财务”可见，并强制审计。

### 4.3 角色访问原则（摘要）

- 管理员：All + 全字段（仍建议敏感访问全审计）。
- HRBP：OrgTree + Personal/Sensitive（可配置），HighlySensitive 默认不可见或需额外授权。
- HR 专员：按职能范围 + OrgTree，Sensitive 默认可见可改；HighlySensitive 需额外授权与审计。
- 部门经理：DepartmentTree + Personal；敏感字段默认不可见。
- 薪资财务：All（仅薪资/结算相关最小字段集）+ HighlySensitive（强审计）；非必要字段不可见。
- 员工自助：Self + Personal（可写白名单）+ 个人流程数据；敏感字段默认不可见或只读。

## 5. 入离职线性状态机与锁定/解锁

### 5.1 OnboardingCase 状态机

状态：

- draft：草稿（员工自助可编辑，未提交）。
- submitted：已提交（默认锁定）。
- hr_review：HR 审核中（默认锁定）。
- manager_confirm：部门经理确认中（默认锁定）。
- completed：完成（不可修改）。
- cancelled：取消（不可修改）。

### 5.2 OffboardingCase 状态机

状态：

- draft：草稿（员工自助可编辑，未提交）。
- submitted：已提交（默认锁定）。
- hr_review：HR 审核中（默认锁定）。
- manager_confirm：部门经理交接确认中（默认锁定）。
- finance_confirm：薪资财务结算确认中（默认锁定）。
- archived：已归档（不可修改）。
- cancelled：取消（不可修改）。

### 5.3 锁定/解锁（MVP 用于“审批状态修改”）

#### 5.3.1 设计目的

在不引入“退回/驳回/重提”等复杂工作流语义前提下，通过锁定/解锁来允许“在审批过程中对工单内容进行有限修订”。

#### 5.3.2 字段与规则

- 每个 Case 必须包含：
  - is_locked：布尔值
  - locked_reason：枚举（submitted / hr_review / manager_confirm / finance_confirm / manual）
  - locked_at / locked_by
  - last_unlocked_at / last_unlocked_by / unlock_reason

默认规则：

- draft：is_locked=false
- 进入 submitted 及之后的任意审批态：is_locked=true
- completed/archived/cancelled：强制 is_locked=true 且禁止解锁

解锁规则（MVP）：

- 允许 HR 专员在 submitted/hr_review/manager_confirm/finance_confirm 状态下执行 unlock，使 is_locked=false，但不改变 status。
- 解锁只允许编辑“白名单字段集”（例如材料补充、备注、非关键个人字段），关键字段（如员工编号、组织任职关系、离职日期、结算结果）仍需通过专用 API 或角色权限变更。
- 任意解锁/再锁定动作必须写入 AuditLog。

## 6. 数据模型（建议表与关键字段）

为便于审计、范围控制与后续扩展，建议将“员工主档”“敏感信息”“流程工单”“归档快照”分表，避免单表混合导致权限无法落地。

### 6.1 employees（员工主档）

- id（UUID）
- employee_number（工号/雇员编号，唯一）
- name（Personal）
- status（待入职/在职/离职）
- created_at / updated_at

### 6.2 employee_employments（任职关系）

- id
- employee_id
- org_unit_id（部门）
- position_id（职位）
- manager_employee_id（直属上级）
- effective_from / effective_to

### 6.3 employee_sensitive（敏感信息）

- employee_id（PK/FK）
- id_number（HighlySensitive，可加密）
- phone（Sensitive，可加密）
- address（Sensitive，可加密）
- bank_account（HighlySensitive，可加密）
- attachments（证件扫描件引用，HighlySensitive）

### 6.4 onboarding_cases / offboarding_cases（工单主表）

共同字段：

- id
- employee_id（目标员工）
- requester_user_id（发起人：员工自助或 HR）
- status（见状态机）
- is_locked / locked_reason / locked_at / locked_by / last_unlocked_at / last_unlocked_by / unlock_reason
- current_assignee_role（HR / manager / finance）
- submitted_at / completed_at / cancelled_at
- created_at / updated_at

offboarding_cases 额外字段：

- planned_last_day（离职日期，Sensitive）
- resignation_reason（Sensitive）
- finance_settlement_status（Public）

### 6.5 case_items（工单子项）

- id
- case_type（onboarding/offboarding）
- case_id
- item_type（material / confirmation / handover / note）
- title / description
- item_status（pending/submitted/approved/rejected等可后置，MVP 可用 pending/done）
- evidence_attachment_ids
- created_at / updated_at

### 6.6 archive_snapshots（不可变归档快照）

- id
- employee_id
- offboarding_case_id
- archived_at
- snapshot_version
- snapshot_payload（JSONB：脱敏/加密后的快照）
- checksum（用于防篡改校验，可选）

### 6.7 audit_logs（审计）

- id
- actor_user_id
- action（read_sensitive / export / update / lock / unlock / transition）
- resource_type / resource_id
- field_classification（Public/Personal/Sensitive/HighlySensitive）
- metadata（JSONB：原因、字段列表、来源 IP 等）
- created_at

## 7. API 设计（资源与约束）

MVP 原则：每个写操作必须检查（数据范围 + 状态机 + 锁定状态 + 字段白名单），并产生审计。

### 7.1 认证与用户

- POST /auth/login
- GET /auth/me

### 7.2 员工

- GET /employees（范围过滤 + 字段过滤）
- GET /employees/:id（范围过滤 + 字段过滤）
- POST /employees（仅 HR/管理员）
- PATCH /employees/:id（字段白名单 + 审计）
- POST /employees/:id/transition（待入职↔在职↔离职，受限）

### 7.3 入职工单

- POST /onboarding-cases（员工自助/HR）
- POST /onboarding-cases/:id/submit
- POST /onboarding-cases/:id/transition（hr_review → manager_confirm → completed）
- POST /onboarding-cases/:id/lock
- POST /onboarding-cases/:id/unlock
- PATCH /onboarding-cases/:id（仅允许 is_locked=false 且字段白名单）

### 7.4 离职工单与归档

- POST /offboarding-cases
- POST /offboarding-cases/:id/submit
- POST /offboarding-cases/:id/transition（hr_review → manager_confirm → finance_confirm → archived）
- POST /offboarding-cases/:id/lock
- POST /offboarding-cases/:id/unlock
- POST /offboarding-cases/:id/archive（仅 finance_confirm 后允许；写入 archive_snapshots）

### 7.5 统计

- GET /stats/headcount（范围过滤）
- GET /stats/distribution/departments（范围过滤）
- GET /stats/distribution/positions（范围过滤）

## 8. UI（MVP 页面清单）

- 员工自助：我的入职（列表/详情/提交材料）、我的离职（发起/进度）、我的档案（白名单字段维护）。
- HR 专员：入职工单处理台、离职工单处理台、员工档案列表/详情、归档查询、数据质量与异常清单。
- 部门经理：待确认列表（入职确认/交接确认）与详情页（仅 Personal + 流程信息）。
- 薪资财务：待确认列表（结算确认）、离职归档详情（强审计）。
- 管理员：用户/角色/范围/字段策略配置、审计检索。

## 9. 数据迁移与对齐策略（从仓库资产到可运行系统）

MVP 采用“先落地运行，再逐步对齐/补齐”策略：

- 将现有 JSON 样例数据作为导入源，导入 employees / employments / cases，并保留原始源文件指针或 checksum 便于追溯。
- 现有“清洗→归档→统计”的逻辑，在服务化后改为：
  - 清洗：导入时校验/标准化（部门、职位、必填字段）
  - 归档：离职完成时写 archive_snapshots（不可变）
  - 统计：基于 DB 实时聚合或定时物化

## 10. 风险与控制

- 敏感合规风险：必须实现字段分级 + 审计，否则薪资财务/员工自助会引入高风险访问路径。
- 口径漂移风险：本体/数据字典必须成为所有模块与报表的单一事实来源，禁止“页面字段 ≠ API 字段 ≠ DB 字段”。
- 状态与锁定混乱风险：严格限定可解锁状态与可编辑字段白名单，并对 unlock/lock 全量审计。

## 11. 后续扩展（与模块化路线衔接）

- 招聘→入职：将 Offer 转换为待入职 Employee + OnboardingCase。
- 薪资：补齐核算批次、薪资条与发放；将 finance_confirm 扩展为核算链路入口。
- 可配置审批流：在状态机稳定后引入工作流引擎或流程编排层，并保持与本体一致的节点/权限/字段可见性规则。

