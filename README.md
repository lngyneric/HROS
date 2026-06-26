# HROS

AI Native 入离职生命周期管理 MVP。

## MVP 本地运行

当前本地开发与验证以 **PostgreSQL** 为唯一支持路径，SQLite 不是当前 MVP 的运行方式。

### 1. 安装依赖

```bash
npm install --cache ./.npm-cache
```

### 2. 启动 PostgreSQL 并初始化数据库

```bash
docker compose up -d db
cp apps/backend/.env.example apps/backend/.env
npm -w apps/backend run prisma:migrate -- --name ai_native_core
npm -w apps/backend run prisma:seed
npm -w apps/backend run prisma:generate
```

### 3. 一键开发启动

```bash
npm run dev
```

启动后地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3003`

## 测试账号

密码统一：`password12345`

- `employee@hros.local`
- `manager@hros.local`
- `hr@hros.local`
- `hrbp@hros.local`
- `finance@hros.local`
- `admin@hros.local`

## CLI 最短验证

```bash
npm -w apps/backend run cli -- auth whoami --actor-id seed-admin --output json
npm -w apps/backend run cli -- onboarding create --actor-id seed-employee --employee-id self --output json
```

## 当前 MVP 已包含

- 前端基础页面：`/login`、`/self`、`/hr`、`/manager`、`/finance`
- CLI Phase 2 审批与审计闭环
- 高风险命令审批后执行

## 当前尚未包含

- 审批中心 `/approvals`
- skill 一等来源的界面整合
- 审批与合规报表页面

更多后端本地运行、CLI 命令和手工验证说明见：

- `apps/backend/README.md`
