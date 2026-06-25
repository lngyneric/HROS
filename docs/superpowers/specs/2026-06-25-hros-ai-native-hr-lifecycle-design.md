# HROS AI Native HR 生命周期系统设计规格

## 1. 背景与目标

HROS 的目标不是做一个传统意义上的“员工资料系统”，而是建设一套 **AI Native 的 HR 信息生命周期系统**。系统需要同时满足以下约束：

- 以员工生命周期为主线，覆盖预入职、入职、在职资料变更、离职、归档与后续分析。
- 既能被人类用户操作，也能被 AI 通过 CLI 或其他自动化入口稳定调用。
- 每个动作都必须可观测、可审计、可回放，而不是只看到最终状态。
- 业务真相数据与流程状态、动作执行、审计事件必须解耦。
- 敏感数据需要与普通业务数据隔离管理。

当前仓库中，`HR信息生命周期管理系统` 目录已经沉淀了业务流程文档、阶段化数据文件与部分入离职处理脚本；`apps/backend` 与 `apps/frontend` 提供了入离职 MVP 的初步应用结构。由此可推断，下一阶段的核心设计任务不是继续堆叠页面，而是先形成可扩展的数据库骨架与 AI 可执行动作模型。

## 2. 设计原则

### 2.1 主数据、流程、动作、审计四层解耦

- 员工、组织、岗位、雇佣关系属于主数据层。
- 入职、资料变更、离职、复职属于流程层。
- CLI/AI 的单次调用属于动作层。
- 所有状态流转与数据改动都必须进入审计层。

### 2.2 员工主档是事实中心，但不是流程引擎

员工主档应回答“这个人是谁、现在在哪、当前处于什么总体状态”，而不承载具体审批过程。流程进度、任务责任人、审批记录与执行产物必须独立建模。

### 2.3 AI 只能调用动作，不直接改真相表

AI 发起的是 `action invocation`，动作经过策略校验、权限判断、流程约束后，才对主数据或流程实例产生影响。这样可以保证幂等、审批、回滚和审计。

### 2.4 敏感数据物理或逻辑隔离

身份证件、银行账户、薪酬、私密附件等字段不能与普通员工主档混放。应单独 schema、单独授权、单独审计。

### 2.5 所有执行过程都必须能被看见

系统不仅要保存最终结果，还要保存执行步骤。无论是人工操作还是 AI 调用，都应该产出结构化事件流，用于 UI 展示、CLI 输出、回放与问题定位。

## 3. 总体架构

### 3.1 分层结构

建议采用以下 schema 分层：

```text
core
workflow
action
audit
private
meta
```

职责如下：

- `core`：员工、组织、岗位、雇佣关系、任职关系等稳定主数据。
- `workflow`：入职、变更、离职、复职等流程模板、流程实例、阶段、任务、任务产物。
- `action`：AI/CLI 原子动作定义、调用记录、结果、审批、幂等与补偿。
- `audit`：统一审计事件、流程事件、安全事件。
- `private`：高敏个人信息、薪酬、文档、凭据。
- `meta`：字典、模板、自定义字段、扩展属性。

### 3.2 对应用与 CLI 的影响

- 后端服务负责把 `action` 转换成领域变更和流程推进。
- CLI 不直接绑定数据库表，而是绑定动作定义。
- 前端以流程实例、任务清单和事件流为主要展示对象，而不是直接操作底层记录。

## 4. 数据库骨架

## 4.1 主数据层

### `core.employee_master`

员工主档。仅存放稳定身份与当前总体状态。

建议字段：

- `id`
- `employee_no`
- `full_name`
- `preferred_name`
- `gender`
- `birth_date`
- `work_email`
- `personal_email`
- `mobile_phone`
- `hire_date`
- `current_status`
- `created_at`
- `updated_at`

约束：

- `employee_no` 唯一。
- `work_email` 唯一但可为空。
- `current_status` 只表示总体状态，如 `preboarding`、`active`、`suspended`、`offboarded`、`archived`，不能表示阶段审批细节。

### `core.org_unit`

组织单元。

建议字段：

- `id`
- `org_code`
- `org_name`
- `parent_org_id`
- `org_type`
- `effective_from`
- `effective_to`

### `core.position`

岗位定义。

建议字段：

- `id`
- `position_code`
- `position_name`
- `job_family`
- `job_level`
- `effective_from`
- `effective_to`

### `core.employment_relationship`

员工与公司的雇佣关系。

建议字段：

- `id`
- `employee_id`
- `employment_type`
- `legal_entity`
- `contract_type`
- `start_date`
- `end_date`
- `probation_end_date`
- `termination_date`
- `termination_reason_code`

说明：

- 一个员工可存在多段雇佣关系历史。
- 离职信息属于雇佣关系的一部分，但“离职流程”本身不在这张表里。

### `core.job_assignment`

员工任职与组织归属。

建议字段：

- `id`
- `employee_id`
- `position_id`
- `org_unit_id`
- `manager_employee_id`
- `assignment_type`
- `effective_from`
- `effective_to`
- `is_primary`

说明：

- 调岗、升职、汇报线调整都以新增记录的方式表示。
- 避免只更新当前岗位导致历史丢失。

## 4.2 敏感数据层

### `private.employee_identity_private`

- `employee_id`
- `id_type`
- `id_number_encrypted`
- `nationality`
- `hukou_type`
- `address_encrypted`

### `private.employee_compensation_private`

- `employee_id`
- `bank_account_encrypted`
- `base_salary_encrypted`
- `payroll_group`
- `tax_identifier_encrypted`

### `private.employee_document_private`

- `id`
- `employee_id`
- `document_type`
- `file_uri`
- `file_hash`
- `access_level`

要求：

- 敏感字段至少应用层加密，最好支持列级加密。
- 所有访问必须落审计。
- 默认业务查询不允许直接联查敏感表。

## 4.3 流程层

### `workflow.workflow_template`

定义流程模板。

- `id`
- `template_code`
- `template_name`
- `domain_type`
- `version`
- `is_active`

### `workflow.workflow_stage`

定义模板内阶段。

- `id`
- `template_id`
- `stage_code`
- `stage_name`
- `stage_order`

### `workflow.workflow_task_template`

定义模板内任务。

- `id`
- `template_id`
- `stage_id`
- `task_code`
- `task_name`
- `task_type`
- `required_role`
- `is_required`
- `depends_on_task_id`

### `workflow.workflow_instance`

某个员工或业务对象的一次真实流程实例。

- `id`
- `template_id`
- `employee_id`
- `business_object_type`
- `business_object_id`
- `status`
- `started_at`
- `completed_at`
- `initiated_by`

### `workflow.workflow_task`

流程实例中的真实任务。

- `id`
- `workflow_instance_id`
- `task_template_id`
- `task_code`
- `status`
- `assignee_type`
- `assignee_id`
- `due_at`
- `started_at`
- `completed_at`
- `result_summary`
- `artifact_count`

### `workflow.task_artifact`

任务产物。

- `id`
- `task_id`
- `artifact_type`
- `artifact_uri`
- `artifact_payload_jsonb`

## 4.4 动作层

### `action.action_definition`

定义可被人类、CLI、AI 调用的动作。

- `id`
- `action_code`
- `action_name`
- `domain_type`
- `input_schema_json`
- `output_schema_json`
- `requires_approval`
- `is_idempotent`

示例：

- `onboarding.create`
- `onboarding.submit`
- `onboarding.approve_hr`
- `employee.change_org`
- `offboarding.archive`

### `action.action_invocation`

记录每次动作调用。

- `id`
- `action_definition_id`
- `request_id`
- `idempotency_key`
- `actor_type`
- `actor_id`
- `channel`
- `input_payload_jsonb`
- `status`
- `started_at`
- `finished_at`

### `action.action_result`

记录动作结果。

- `id`
- `invocation_id`
- `success`
- `business_object_type`
- `business_object_id`
- `output_payload_jsonb`
- `error_code`
- `error_message`

### `action.approval_request`

- `id`
- `invocation_id`
- `approver_role`
- `approver_id`
- `approval_status`
- `decision_at`
- `decision_reason`

### `action.compensation_action`

面向补偿或回滚动作。

- `id`
- `source_invocation_id`
- `compensating_action_code`
- `status`
- `payload_jsonb`
- `executed_at`

## 4.5 审计层

### `audit.audit_event`

- `id`
- `event_time`
- `actor_type`
- `actor_id`
- `entity_type`
- `entity_id`
- `operation`
- `before_jsonb`
- `after_jsonb`
- `reason`
- `request_id`

### `audit.workflow_event`

- `id`
- `workflow_instance_id`
- `task_id`
- `event_type`
- `event_payload_jsonb`
- `occurred_at`

### `audit.security_event`

- `id`
- `actor_id`
- `event_type`
- `target_resource`
- `risk_level`
- `details_jsonb`
- `occurred_at`

## 4.6 元数据层

### `meta.custom_field_definition`

- `id`
- `entity_type`
- `field_code`
- `field_name`
- `data_type`
- `is_required`
- `validation_rule`

### `meta.entity_extension`

- `id`
- `entity_type`
- `entity_id`
- `extension_jsonb`

### `meta.code_dictionary`

- `id`
- `dictionary_type`
- `code`
- `label`
- `is_active`

原则：

- 核心合规字段必须结构化。
- 只有边缘字段、租户个性字段才允许走扩展表或 JSONB。

## 5. ER 关系说明

## 5.1 主体关系

```text
employee_master
  ├─ employment_relationship
  ├─ job_assignment
  ├─ private_identity
  └─ workflow_instance
       ├─ workflow_task
       │   └─ task_artifact
       └─ workflow_event

action_definition
  └─ action_invocation
       ├─ action_result
       ├─ approval_request
       └─ compensation_action

audit_event
```

## 5.2 关键关系约束

- `employee_master 1:n employment_relationship`
- `employee_master 1:n job_assignment`
- `employee_master 1:n workflow_instance`
- `workflow_instance 1:n workflow_task`
- `workflow_task 1:n task_artifact`
- `action_definition 1:n action_invocation`
- `action_invocation 1:1 action_result`
- `action_invocation 1:n approval_request`

## 5.3 时态建模要求

以下实体必须支持历史记录：

- `org_unit`
- `position`
- `employment_relationship`
- `job_assignment`

最低要求：

- `effective_from`
- `effective_to`

这保证系统可以回答：

- 某员工在某日期属于哪个部门
- 某员工某次流程发起时的直属经理是谁
- 某次离职流程发生时，员工适用的合同是什么

## 6. CLI 设计与数据库映射

## 6.1 设计目标

CLI 需要同时满足：

- 人类可读可执行
- AI 易于调用和组合
- 每个命令职责单一
- 执行过程结构化输出
- 与数据库动作层一一映射

## 6.2 推荐命令分层

建议采用双层架构，但第一阶段先落地原子动作层。

### 原子动作层

示例：

- `hros onboarding create`
- `hros onboarding submit`
- `hros onboarding approve-hr`
- `hros onboarding approve-manager`
- `hros offboarding create`
- `hros offboarding archive`
- `hros employee change-org`
- `hros employee change-manager`
- `hros workflow task-complete`

### 编排层

后续预留：

- `hros workflow run onboarding-standard`
- `hros workflow run offboarding-standard`

## 6.3 命令到数据库的映射

### `hros onboarding create`

写入：

- `action.action_invocation`
- `workflow.workflow_instance`
- 初始 `workflow.workflow_task`
- `audit.workflow_event`

### `hros onboarding submit`

写入：

- `action.action_invocation`
- 更新 `workflow.workflow_instance.status`
- 更新当前任务
- 产生下一责任任务
- 写入 `audit.workflow_event`

### `hros onboarding approve-hr`

写入：

- `action.action_invocation`
- `action.approval_request`
- 更新 `workflow.workflow_task.status`
- 触发下一阶段任务
- 写入 `audit.audit_event`

### `hros offboarding archive`

写入：

- `action.action_invocation`
- 更新 `core.employment_relationship.termination_date`
- 更新 `core.employee_master.current_status`
- 写入归档产物到 `workflow.task_artifact`
- 记录 `audit.audit_event` 与 `audit.workflow_event`

## 6.4 命令输出契约

每个命令至少输出两类内容：

### 结构化事件流

用于 AI 与 UI 消费。

建议字段：

- `event_type`
- `timestamp`
- `invocation_id`
- `step_code`
- `status`
- `summary`
- `payload`

示例事件：

- `command_received`
- `input_validated`
- `policy_checked`
- `approval_requested`
- `state_transition_applied`
- `artifact_written`
- `command_succeeded`
- `command_failed`

### 最终结果对象

- `success`
- `business_object_type`
- `business_object_id`
- `workflow_instance_id`
- `next_actions`
- `artifacts`

## 7. 权限与策略设计

## 7.1 角色模型

第一批建议角色：

- `employee_self`
- `manager`
- `hr_specialist`
- `hrbp`
- `finance`
- `it_operator`
- `system_admin`
- `ai_service_actor`

## 7.2 权限判断

权限不能只看角色，还要看数据范围与对象关系。

必须支持：

- 本人可见
- 直属下属可见
- 所属组织可见
- 指定流程参与者可见
- 敏感表额外授权

## 7.3 数据库与应用双重防线

推荐：

- 应用层做对象级权限判断
- PostgreSQL 层对高敏数据逐步引入 RLS

原因：

- 只靠应用层容易漏
- 只靠数据库层不利于表达复杂业务语义

## 8. 错误处理与恢复策略

## 8.1 错误分类

### 输入错误

- 缺字段
- 格式错误
- 非法枚举

处理：

- 不落业务真相表
- 返回标准错误码
- 输出 `input_validated: failed`

### 策略错误

- 无权限
- 非法状态跃迁
- 缺前置审批

处理：

- 只记录动作调用与安全事件
- 不推进流程

### 执行错误

- 数据库写失败
- 外部集成失败
- 归档产物写入失败

处理：

- 动作结果标记失败
- 必要时创建补偿动作
- 输出可回放事件

## 8.2 幂等与重试

所有可重复触发的外部入口动作必须支持 `idempotency_key`。

要求：

- 同一个 key 重复调用不得生成重复业务实例
- 幂等命中时应返回已有结果摘要

## 8.3 补偿机制

对涉及多步副作用的动作，如：

- 开通账号
- 撤销权限
- 设备回收
- 外部系统建档

需要预留 `compensation_action`，而不是靠人工修复数据库。

## 9. 测试设计

## 9.1 数据库测试

- 主键、唯一约束、外键约束
- 时态数据重叠校验
- 状态枚举合法性
- 敏感数据访问边界

## 9.2 流程测试

- 入职创建到完成闭环
- 离职创建到归档闭环
- 非法状态跳转拦截
- 缺失审批无法推进

## 9.3 CLI 测试

- 命令输入校验
- 命令输出结构稳定性
- 幂等调用
- 失败重试
- 事件流顺序正确性

## 9.4 审计测试

- 任一主数据改动均产生审计事件
- 任一流程推进均产生流程事件
- 任一敏感表访问均产生安全或审计事件

## 10. 一期实现范围

第一阶段只实现支撑当前 HROS 最有价值闭环的最小集合：

### 数据库

- `core.employee_master`
- `core.org_unit`
- `core.position`
- `core.employment_relationship`
- `core.job_assignment`
- `private.employee_identity_private`
- `workflow.workflow_template`
- `workflow.workflow_stage`
- `workflow.workflow_task_template`
- `workflow.workflow_instance`
- `workflow.workflow_task`
- `workflow.task_artifact`
- `action.action_definition`
- `action.action_invocation`
- `action.action_result`
- `audit.audit_event`
- `audit.workflow_event`

### CLI

- `hros onboarding create`
- `hros onboarding submit`
- `hros onboarding approve-hr`
- `hros onboarding approve-manager`
- `hros offboarding create`
- `hros offboarding approve-hr`
- `hros offboarding approve-manager`
- `hros offboarding approve-finance`
- `hros offboarding archive`

## 11. 明确不做

第一阶段不做：

- 全量薪酬子系统
- 全量招聘 ATS
- 全量培训体系
- 复杂多租户字段工厂
- 任意脚本直连数据库写业务真相表

这些能力在未来可挂接，但不应阻塞数据库骨架和动作模型定型。

## 12. 成功标准

本设计完成后，系统应能支持以下判断：

- 员工当前主状态明确且历史可追溯
- 流程实例与主数据解耦
- CLI 命令可被 AI 稳定调用
- 每次调用都有结构化事件流
- 每次业务改动都有审计
- 敏感数据不与普通资料混放
- 一期即可跑通入离职闭环

## 13. 后续计划入口

下一步应基于本设计输出实施计划，至少拆成：

- 数据库 schema 与 Prisma 建模计划
- 动作定义与 CLI 命令计划
- 后端服务与策略层计划
- 流程事件流与审计落地计划
