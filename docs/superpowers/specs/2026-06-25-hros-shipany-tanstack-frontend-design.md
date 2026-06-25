# HROS ShipAny + TanStack 前端重构设计规格

## 1. 背景

当前 HROS 前端位于 `apps/frontend`，使用 `Vite + React + react-router-dom + antd`。现状存在几个明显问题：

- 前端目录偏平，页面、状态、接口封装与布局壳层耦合较重。
- 认证、角色跳转、页面加载逻辑分散在 `App.tsx` 与各页面内部，不利于扩展。
- 数据获取主要依赖页面内部的 `useEffect + useState`，缺少统一的服务层与查询缓存层。
- 当前使用 `antd@5 + react@19`，已经出现兼容性运行时问题，影响登录与页面稳定性。
- 现有前端虽然已经能工作，但不适合作为后续 HROS 生命周期系统持续扩展的长期骨架。

用户上传的 `fastclaw-frontpage` 包中包含两类资产：

- 一个可安装的工作区 skill：`fastclaw-frontpage`
- 一套基于 `ShipAny + TanStack` 风格的完整前端模板结构

用户希望采用 **方案 B**：

- 安装上传包中的 skill
- 对 HROS 前端做整体替换式重构
- 但保留现有 HROS 后端 API，不重构后端接口体系

因此本设计的核心目标不是“复制一个模板站点”，而是把 HROS 前端升级成：

- `ShipAny` 风格目录组织
- `TanStack Router + TanStack Query` 的现代前端架构
- 可持续承接 HROS 的认证、入职、离职、待办、审计视图等业务模块

## 2. 目标与非目标

### 2.1 目标

本次设计需要达成以下目标：

- 将上传包中的 `fastclaw-frontpage` 安装为工作区 skill
- 将 HROS 前端从 `react-router-dom + antd 页面式组织` 迁移到 `ShipAny + TanStack` 风格骨架
- 保留现有 HROS 后端 API，不要求同步改造服务端接口
- 将前端按业务模块重新拆分，形成长期可维护的边界
- 统一认证、会话恢复、角色路由、请求层和查询缓存层
- 为后续继续扩展员工、审计、统计等模块预留清晰结构

### 2.2 非目标

本次设计明确不做以下事情：

- 不重写 HROS 后端 Express API
- 不把当前 HROS 前端改造成营销落地页或纯官网站点
- 不完整复制上传模板中的全部博客、支付、CMS、后台设置等模块
- 不一次性迁移所有模板能力，只提取 HROS 当前真正需要的前端基础架构
- 不要求在本次设计中完成所有页面视觉精修

## 3. 方案选择

用户确认采用 **方案 B：骨架替换，业务页迁移**。

该方案定义为：

- 前端整体切换到 `TanStack Router + TanStack Query + ShipAny 风格目录`
- HROS 的业务页面、接口模型与业务语义继续沿用
- 上传模板作为结构与组件参考，而不是原样照搬

选择该方案的原因：

- 能满足“整体替换前端架构”的目标
- 比整包硬替换更可控
- 保持与现有 HROS 后端兼容
- 更适合当前已经有登录、员工自助、HR、经理、财务等业务页面的 HROS 项目

## 4. 总体架构

## 4.1 核心原则

本次前端重构遵循以下原则：

- **后端接口不变**：前端通过适配层消费现有 HROS API
- **架构先行**：先替换路由、查询、目录结构，再迁业务页面
- **模块边界清晰**：认证、入职、离职、工作台分模块管理
- **避免继续扩大 antd 依赖**：逐步迁出当前 `antd + react19` 高风险组合
- **模板为参考，不是目标产品**：HROS 仍然是 HROS，不是 FastClaw 落地页

## 4.2 重构后前端层次

重构后的前端分为五层：

### 路由层

负责页面装配、认证守卫、角色路由和页面入口。

技术选择：

- `@tanstack/react-router`

### 查询层

负责异步请求、缓存、失效、重取与状态同步。

技术选择：

- `@tanstack/react-query`

### 业务模块层

负责各业务域的：

- 类型定义
- API service
- query options
- mutation 封装
- 页面视图逻辑拼装

### 组件层

分为两类：

- `components/ui`：基础 UI 组件
- `components/layout`：壳层布局与导航组件

### 基础设施层

包括：

- `api-client`
- `query-client`
- `session / auth helpers`
- `utils`
- 全局样式

## 5. 目录设计

## 5.1 目标目录

建议 `apps/frontend/src` 重构为：

```text
src/
├── routes/
│   ├── __root.tsx
│   ├── login.tsx
│   ├── self.tsx
│   ├── hr.tsx
│   ├── manager.tsx
│   └── finance.tsx
├── modules/
│   ├── auth/
│   │   ├── service.ts
│   │   ├── session.ts
│   │   ├── queries.ts
│   │   └── types.ts
│   ├── onboarding/
│   │   ├── service.ts
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   ├── types.ts
│   │   └── views/
│   ├── offboarding/
│   │   ├── service.ts
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   ├── types.ts
│   │   └── views/
│   └── workitems/
│       ├── service.ts
│       ├── queries.ts
│       ├── types.ts
│       └── views/
├── components/
│   ├── ui/
│   ├── layout/
│   └── auth/
├── lib/
│   ├── api-client.ts
│   ├── query-client.ts
│   └── utils.ts
├── hooks/
├── styles/
├── router.tsx
└── main.tsx
```

## 5.2 与现有结构的映射

当前：

- `pages/LoginPage.tsx`
- `pages/SelfOnboardingPage.tsx`
- `pages/HrWorklistPage.tsx`
- `pages/ManagerConfirmPage.tsx`
- `pages/FinanceConfirmPage.tsx`
- `shared/api/client.ts`
- `shared/auth/session.ts`

迁移后：

- 登录逻辑迁入 `modules/auth`
- 认证与会话恢复迁入 `routes/__root.tsx + modules/auth`
- 原 `SelfOnboardingPage` 拆分到 `modules/onboarding/views` 和 `modules/offboarding/views`
- 原 HR / Manager / Finance 页面迁入 `modules/workitems/views`
- `shared/api/client.ts` 迁移为 `lib/api-client.ts`

## 6. Skill 安装设计

## 6.1 安装目标

上传包中包含 `fastclaw-frontpage/SKILL.md`。需要将其安装为工作区 skill，使其后续可被调用。

目标路径：

```text
.trae/skills/fastclaw-frontpage/SKILL.md
```

## 6.2 定位

该 skill 的定位不是直接重构 HROS 控制台，而是：

- 作为工作区可用 skill 正式安装
- 作为后续创建首页、门户页、宣传页时的生成器
- 当前前端重构过程中，作为结构与目录参考来源

## 6.3 风险说明

该 skill 的原始用途是“生成 frontpage / landing page”，因此：

- 不应直接拿来替代 HROS 的业务后台
- 应把它视作模板参考与工作区资产，而不是业务控制台规范本身

## 7. 路由设计

## 7.1 根路由

新增 `routes/__root.tsx`，统一处理：

- QueryClientProvider
- 全局会话恢复
- 当前用户信息加载
- 根布局壳层
- 未登录跳转
- 已登录用户按角色跳转

这会替代当前 `App.tsx` 中分散的认证恢复逻辑。

## 7.2 页面路由

第一阶段仅保留与 HROS 业务直接相关的路由：

- `login`
- `self`
- `hr`
- `manager`
- `finance`

角色路由规则：

- `EMPLOYEE_SELF -> /self`
- `MANAGER -> /manager`
- `PAYROLL_FINANCE -> /finance`
- 其余角色默认进入 `/hr`

## 7.3 路由守卫

根路由需要具备两类守卫：

- 未登录用户仅可访问 `login`
- 已登录用户访问 `/` 时，按角色自动重定向

这套逻辑从原有 `RoleRedirect + App.tsx` 迁移到更稳定的 TanStack Router 模式中。

## 8. 数据层设计

## 8.1 API Client

`lib/api-client.ts` 负责：

- token 读写
- Authorization 注入
- 统一 JSON 解析
- 统一错误抛出
- 与现有 HROS API 保持兼容

## 8.2 Query Client

`lib/query-client.ts` 负责：

- 创建全局 QueryClient
- 定义默认缓存策略
- 约束 mutation 后的失效刷新行为

建议默认策略：

- 列表页适度缓存
- 登录态信息可短缓存但要支持失效
- 关键动作完成后显式 `invalidateQueries`

## 8.3 模块化服务层

每个业务模块下拆分：

- `types.ts`
- `service.ts`
- `queries.ts`
- `mutations.ts`

例如：

- `modules/auth/service.ts`：登录、`me`
- `modules/onboarding/service.ts`：创建草稿、提交、列表查询
- `modules/offboarding/service.ts`：创建、提交、归档、归档事件
- `modules/workitems/service.ts`：HR / 经理 / 财务工作台视图聚合

## 9. UI 设计

## 9.1 总体策略

UI 层采用“逐步脱离 antd”的策略：

- 不继续把 `antd` 作为主要组件体系扩展
- 优先引入上传模板中的 `components/ui/*`
- 用模板中的布局与基础组件替代当前高风险按钮、卡片、表格壳层

## 9.2 第一阶段需要的组件

第一阶段只迁移 HROS 必需的 UI：

- 登录表单
- 页面壳层布局
- 顶栏/侧栏或顶部导航
- 基础按钮
- 基础表格/列表容器
- 事件流展示组件
- 表单输入组件

不需要一开始迁移模板中的全部博客、支付、富文本等组件。

## 9.3 视觉策略

视觉层不做营销站风格复制，而是保持：

- 管理后台的清晰度
- HROS 的角色工作台导向
- 结构化信息展示

## 10. 业务模块设计

## 10.1 Auth

职责：

- 登录
- 当前用户
- token 持久化
- 登出
- 登录后角色跳转

输出：

- `useCurrentUser`
- `loginMutation`
- `logout`
- `getDefaultHomePath(role)`

## 10.2 Onboarding

职责：

- 查询员工自助入职工单
- 创建入职草稿
- 提交入职流程
- 展示动作事件流

与后端对齐：

- 兼容 `ActionEnvelope`
- 后续支持工作流动作化接口

## 10.3 Offboarding

职责：

- 查询离职工单
- 创建离职草稿
- 提交流程
- 财务归档
- 展示归档产物和事件流

## 10.4 Workitems

职责：

- 为 HR、Manager、Finance 角色提供工作台视图
- 聚合待办工单
- 统一封装各角色页面查询

## 11. 迁移步骤

## 11.1 第一步：安装 skill

工作内容：

- 把上传包中的 `fastclaw-frontpage/SKILL.md` 安装到工作区 skill 目录

结果：

- skill 可在工作区后续使用

## 11.2 第二步：搭建新前端骨架

工作内容：

- 引入 `TanStack Router`
- 引入 `TanStack Query`
- 新增 `router.tsx`
- 新增 `routes/__root.tsx`
- 新增 `lib/query-client.ts`
- 新增 `lib/api-client.ts`

结果：

- 前端具备新的路由与查询基础设施

## 11.3 第三步：迁移认证与登录

工作内容：

- 迁移登录页到新路由
- 迁移 token 与 `me` 加载逻辑
- 统一角色跳转
- 脱离当前 `antd + react19` 下不稳定登录实现

结果：

- 登录与会话恢复稳定工作

## 11.4 第四步：迁移业务页面

工作内容：

- 迁移 `self`
- 迁移 `hr`
- 迁移 `manager`
- 迁移 `finance`

方式：

- 页面视觉壳层换新
- 数据获取迁到 Query
- 页面逻辑迁到模块层

## 11.5 第五步：清理旧骨架

工作内容：

- 删除旧 `react-router-dom` 路由结构
- 清理旧 `pages/*` 残留
- 逐步移除不再使用的 `antd` 依赖

## 12. 风险与应对

## 12.1 React 19 与 antd 兼容问题

风险：

- 当前运行时已经出现错误

应对：

- 新架构不再继续依赖 `antd` 作为核心交互层
- 登录与基础布局优先迁移

## 12.2 旧页面响应结构与新模块化层并存

风险：

- 迁移期间会出现旧页面与新模块混用

应对：

- 通过 `modules/*/service.ts` 做统一接口适配
- 逐页切换，不混乱复制

## 12.3 模板过大、HROS 实际只需部分能力

风险：

- 如果整包照搬，会带来大量无关模块

应对：

- 明确只抽取 HROS 当前需要的骨架能力
- 不迁博客、支付、CMS、后台设置等无关内容

## 13. 验收标准

本次重构完成后，应满足：

- `fastclaw-frontpage` 已安装为工作区 skill
- 前端已切换到 `TanStack Router + TanStack Query`
- 登录、会话恢复、角色跳转正常
- `self / hr / manager / finance` 页面可访问
- 前端继续使用现有 HROS 后端 API
- 旧 `antd` 兼容问题不再阻塞登录与主流程访问
- 目录边界清晰，可继续扩展员工、审计、统计模块

## 14. 后续计划入口

基于本设计，下一步应输出实施计划，至少拆为：

- skill 安装任务
- 前端骨架搭建任务
- 登录与根路由迁移任务
- HROS 四个业务页面迁移任务
- 旧骨架清理任务
