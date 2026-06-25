# HR 入离职业务线（MVP）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从 0 构建一个可运行的 HR 系统 MVP，以“入离职”作为第一条业务线，支持角色/字段分级/数据范围/审计/归档与线性状态机（含锁定/解锁）。

**Architecture:** Monorepo（Node/React）+ SQLite（当前实现）/PostgreSQL（可选）。后端提供 JWT + RBAC + Scope 过滤 + 字段分级过滤，并实现入离职工单线性状态机；前端提供最小工作台与自助入口；数据库用 Prisma 管理 schema 与迁移。

**Tech Stack:** Node.js + TypeScript + Express + Prisma + SQLite/PostgreSQL + Vitest/Supertest；React + TypeScript + Vite + Ant Design + React Router。

---

## 0. 文件结构（将被创建）

**Repo Root:** `/Users/cherrych/Documents/trae_projects/HROS`

- Create: `package.json`（npm workspaces）
- Create: `docker-compose.yml`（可选：若环境有 Docker 可切换到 Postgres；当前实现为 SQLite）
- Create: `apps/backend/`（Express + Prisma）
  - Create: `apps/backend/package.json`
  - Create: `apps/backend/tsconfig.json`
  - Create: `apps/backend/prisma/schema.prisma`
  - Create: `apps/backend/src/main.ts`
  - Create: `apps/backend/src/app.ts`
  - Create: `apps/backend/src/config/env.ts`
  - Create: `apps/backend/src/db/prisma.ts`
  - Create: `apps/backend/src/db/seed.ts`
  - Create: `apps/backend/src/auth/*`
  - Create: `apps/backend/src/rbac/*`
  - Create: `apps/backend/src/scope/*`
  - Create: `apps/backend/src/field-policy/*`
  - Create: `apps/backend/src/audit/*`
  - Create: `apps/backend/src/modules/employees/*`
  - Create: `apps/backend/src/modules/onboarding/*`
  - Create: `apps/backend/src/modules/offboarding/*`
  - Create: `apps/backend/src/modules/stats/*`
  - Create: `apps/backend/src/test/*`
- Create: `apps/frontend/`（Vite + React + Antd）
  - Create: `apps/frontend/package.json`
  - Create: `apps/frontend/vite.config.ts`
  - Create: `apps/frontend/src/main.tsx`
  - Create: `apps/frontend/src/app/App.tsx`
  - Create: `apps/frontend/src/app/routes.tsx`
  - Create: `apps/frontend/src/shared/api/client.ts`
  - Create: `apps/frontend/src/shared/auth/*`
  - Create: `apps/frontend/src/pages/*`（按角色入口最小页面）
- Create: `docs/superpowers/specs/2026-04-21-hr-onboarding-offboarding-mvp-design.md`（已存在）

---

## Task 1: Monorepo 与数据库环境初始化

**Files:**
- Create: `/Users/cherrych/Documents/trae_projects/HROS/package.json`
- Create: `/Users/cherrych/Documents/trae_projects/HROS/docker-compose.yml`
- Create: `/Users/cherrych/Documents/trae_projects/HROS/.gitignore`

- [ ] **Step 1: 创建根 package.json（workspaces）**

```json
{
  "name": "hros",
  "private": true,
  "workspaces": [
    "apps/backend",
    "apps/frontend"
  ],
  "scripts": {
    "dev:db": "docker compose up -d db",
    "dev:backend": "npm -w apps/backend run dev",
    "dev:frontend": "npm -w apps/frontend run dev",
    "dev": "npm run dev:db && npm run dev:backend",
    "test:backend": "npm -w apps/backend test"
  }
}
```

- [ ] **Step 2: 创建 docker-compose.yml（Postgres）**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: hros
      POSTGRES_USER: hros
      POSTGRES_PASSWORD: hros_password
    ports:
      - "5432:5432"
    volumes:
      - hros_pg:/var/lib/postgresql/data
volumes:
  hros_pg:
```

- [ ] **Step 3: 创建 .gitignore**

```gitignore
node_modules
dist
.env
.env.*
.DS_Store
coverage
*.log
```

- [ ] **Step 4: 启动数据库并验证**

Run: `npm run dev:db`

Expected: SQLite 模式下输出提示即可；若启用 Docker/Postgres，则需要容器启动成功。

- [ ] **Step 5: Commit**

```bash
git add package.json docker-compose.yml .gitignore
git commit -m "chore: init monorepo and postgres"
```

---

## Task 2: 后端工程骨架（Express + Prisma + 测试框架）

**Files:**
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/package.json`
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/tsconfig.json`
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/.env.example`
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/src/main.ts`
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/src/app.ts`
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/src/config/env.ts`
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/src/db/prisma.ts`
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/src/test/health.test.ts`

- [ ] **Step 1: 创建 apps/backend/package.json**

```json
{
  "name": "@hros/backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "tsx src/db/seed.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "bcryptjs": "^2.4.3",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.10.2",
    "prisma": "^6.0.0",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 安装依赖**

Run: `npm install`
Expected: 在根目录安装完成，无报错。

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 创建 .env.example**

```bash
PORT=3003
DATABASE_URL="postgresql://hros:hros_password@localhost:5432/hros?schema=public"
JWT_SECRET="change_me"
```

- [ ] **Step 5: 创建 env 读取**

`src/config/env.ts`

```ts
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3003),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16)
});

export type Env = z.infer<typeof EnvSchema>;

export function getEnv(): Env {
  return EnvSchema.parse(process.env);
}
```

- [ ] **Step 6: Prisma client 初始化**

`src/db/prisma.ts`

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

- [ ] **Step 7: 创建 Express app 与 main**

`src/app.ts`

```ts
import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
```

`src/main.ts`

```ts
import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";

const env = getEnv();
const app = createApp();

app.listen(env.PORT, () => {
  process.stdout.write(`backend listening on ${env.PORT}\n`);
});
```

- [ ] **Step 8: 写一个健康检查测试（先红后绿）**

`src/test/health.test.ts`

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 9: 运行测试**

Run: `npm -w apps/backend test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): scaffold express app and test runner"
```

---

## Task 3: 数据库 Schema（角色/范围/审计/员工/入离职/归档）

**Files:**
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/prisma/schema.prisma`

- [ ] **Step 1: 创建 Prisma schema**

`prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum RoleCode {
  ADMIN
  HRBP
  HR_SPECIALIST
  MANAGER
  EMPLOYEE_SELF
  PAYROLL_FINANCE
}

enum DataScope {
  ALL
  ORG_TREE
  DEPT_TREE
  SELF
}

enum FieldClassification {
  PUBLIC
  PERSONAL
  SENSITIVE
  HIGHLY_SENSITIVE
}

enum EmployeeStatus {
  PRE_ONBOARDING
  ACTIVE
  RESIGNED
}

enum CaseType {
  ONBOARDING
  OFFBOARDING
}

enum OnboardingStatus {
  DRAFT
  SUBMITTED
  HR_REVIEW
  MANAGER_CONFIRM
  COMPLETED
  CANCELLED
}

enum OffboardingStatus {
  DRAFT
  SUBMITTED
  HR_REVIEW
  MANAGER_CONFIRM
  FINANCE_CONFIRM
  ARCHIVED
  CANCELLED
}

enum AuditAction {
  READ_SENSITIVE
  EXPORT
  UPDATE
  LOCK
  UNLOCK
  TRANSITION
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  displayName  String
  role         RoleCode
  dataScope    DataScope
  employeeId   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  employee     Employee? @relation(fields: [employeeId], references: [id])
  scopes       OrgScope[]
}

model OrgUnit {
  id        String   @id @default(uuid())
  name      String
  parentId  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  parent    OrgUnit? @relation("OrgUnitTree", fields: [parentId], references: [id])
  children  OrgUnit[] @relation("OrgUnitTree")
  employments Employment[]
}

model Position {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  employments Employment[]
}

model Employee {
  id           String   @id @default(uuid())
  employeeNo   String   @unique
  name         String
  status       EmployeeStatus
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  sensitive    EmployeeSensitive?
  employments  Employment[]
  onboardingCases OnboardingCase[]
  offboardingCases OffboardingCase[]
}

model EmployeeSensitive {
  employeeId  String @id
  idNumber    String?
  phone       String?
  address     String?
  bankAccount String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  employee Employee @relation(fields: [employeeId], references: [id])
}

model Employment {
  id          String   @id @default(uuid())
  employeeId  String
  orgUnitId   String
  positionId  String
  managerEmployeeId String?
  effectiveFrom DateTime @default(now())
  effectiveTo   DateTime?

  employee Employee @relation(fields: [employeeId], references: [id])
  orgUnit  OrgUnit  @relation(fields: [orgUnitId], references: [id])
  position Position @relation(fields: [positionId], references: [id])
  manager  Employee? @relation("ManagerRelation", fields: [managerEmployeeId], references: [id])
}

model OrgScope {
  id       String @id @default(uuid())
  userId   String
  orgUnitId String

  user     User   @relation(fields: [userId], references: [id])
  orgUnit  OrgUnit @relation(fields: [orgUnitId], references: [id])

  @@unique([userId, orgUnitId])
}

model OnboardingCase {
  id          String @id @default(uuid())
  employeeId  String
  requesterUserId String
  status      OnboardingStatus
  isLocked    Boolean @default(false)
  lockedReason String?
  lockedAt    DateTime?
  lockedByUserId String?
  lastUnlockedAt DateTime?
  lastUnlockedByUserId String?
  unlockReason String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  employee Employee @relation(fields: [employeeId], references: [id])
  requester User @relation(fields: [requesterUserId], references: [id])
  items     CaseItem[]
}

model OffboardingCase {
  id          String @id @default(uuid())
  employeeId  String
  requesterUserId String
  status      OffboardingStatus
  plannedLastDay DateTime?
  resignationReason String?
  financeSettlementStatus String?
  isLocked    Boolean @default(false)
  lockedReason String?
  lockedAt    DateTime?
  lockedByUserId String?
  lastUnlockedAt DateTime?
  lastUnlockedByUserId String?
  unlockReason String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  employee Employee @relation(fields: [employeeId], references: [id])
  requester User @relation(fields: [requesterUserId], references: [id])
  items     CaseItem[]
  archives  ArchiveSnapshot[]
}

model CaseItem {
  id        String @id @default(uuid())
  caseType  CaseType
  onboardingCaseId String?
  offboardingCaseId String?
  itemType  String
  title     String
  description String?
  itemStatus String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  onboardingCase OnboardingCase? @relation(fields: [onboardingCaseId], references: [id])
  offboardingCase OffboardingCase? @relation(fields: [offboardingCaseId], references: [id])
}

model ArchiveSnapshot {
  id              String @id @default(uuid())
  employeeId      String
  offboardingCaseId String
  archivedAt      DateTime @default(now())
  snapshotVersion String
  snapshotPayload Json

  employee Employee @relation(fields: [employeeId], references: [id])
  offboardingCase OffboardingCase @relation(fields: [offboardingCaseId], references: [id])
}

model AuditLog {
  id                 String @id @default(uuid())
  actorUserId         String
  action              AuditAction
  resourceType        String
  resourceId          String
  fieldClassification FieldClassification
  metadata            Json
  createdAt           DateTime @default(now())

  actor User @relation(fields: [actorUserId], references: [id])
}
```

- [ ] **Step 2: 生成 client 与迁移**

Run:
- `cp apps/backend/.env.example apps/backend/.env`
- `npm -w apps/backend run prisma:migrate -- --name init`
- `npm -w apps/backend run prisma:generate`

Expected: 迁移成功，生成 Prisma Client。

- [ ] **Step 3: Commit**

```bash
git add apps/backend/prisma
git commit -m "feat(db): add prisma schema for onboarding/offboarding mvp"
```

---

## Task 4: Seed 数据（6 角色 + 组织树 + 示例员工）

**Files:**
- Create: `/Users/cherrych/Documents/trae_projects/HROS/apps/backend/src/db/seed.ts`

- [ ] **Step 1: 编写 seed.ts**

```ts
import bcrypt from "bcryptjs";
import { prisma } from "./prisma.js";

async function main() {
  const passwordHash = await bcrypt.hash("password12345", 10);

  const rootOrg = await prisma.orgUnit.create({
    data: { name: "公司", parentId: null }
  });

  const hrOrg = await prisma.orgUnit.create({
    data: { name: "人力资源部", parentId: rootOrg.id }
  });

  const salesOrg = await prisma.orgUnit.create({
    data: { name: "销售本部", parentId: rootOrg.id }
  });

  const hrbpUser = await prisma.user.create({
    data: {
      email: "hrbp@hros.local",
      passwordHash,
      displayName: "HRBP",
      role: "HRBP",
      dataScope: "ORG_TREE",
      scopes: { create: [{ orgUnitId: rootOrg.id }] }
    }
  });

  await prisma.user.create({
    data: {
      email: "admin@hros.local",
      passwordHash,
      displayName: "Admin",
      role: "ADMIN",
      dataScope: "ALL"
    }
  });

  await prisma.user.create({
    data: {
      email: "hr@hros.local",
      passwordHash,
      displayName: "HR专员",
      role: "HR_SPECIALIST",
      dataScope: "ORG_TREE",
      scopes: { create: [{ orgUnitId: hrOrg.id }] }
    }
  });

  const managerEmployee = await prisma.employee.create({
    data: { employeeNo: "E0001", name: "部门经理", status: "ACTIVE" }
  });

  const managerUser = await prisma.user.create({
    data: {
      email: "manager@hros.local",
      passwordHash,
      displayName: "部门经理",
      role: "MANAGER",
      dataScope: "DEPT_TREE",
      employeeId: managerEmployee.id
    }
  });

  await prisma.position.createMany({
    data: [{ name: "部门经理" }, { name: "员工" }]
  });

  const managerPosition = await prisma.position.findFirstOrThrow({ where: { name: "部门经理" } });

  await prisma.employment.create({
    data: {
      employeeId: managerEmployee.id,
      orgUnitId: salesOrg.id,
      positionId: managerPosition.id
    }
  });

  const employee = await prisma.employee.create({
    data: { employeeNo: "E0002", name: "员工A", status: "PRE_ONBOARDING" }
  });

  await prisma.user.create({
    data: {
      email: "employee@hros.local",
      passwordHash,
      displayName: "员工自助",
      role: "EMPLOYEE_SELF",
      dataScope: "SELF",
      employeeId: employee.id
    }
  });

  await prisma.user.create({
    data: {
      email: "finance@hros.local",
      passwordHash,
      displayName: "薪资财务",
      role: "PAYROLL_FINANCE",
      dataScope: "ALL"
    }
  });

  process.stdout.write(`seeded: hrbp=${hrbpUser.id} manager=${managerUser.id}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    await prisma.$disconnect();
    throw e;
  });
```

- [ ] **Step 2: 运行 seed**

Run: `npm -w apps/backend run prisma:seed`
Expected: 输出 seeded 日志，无报错。

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/db/seed.ts
git commit -m "chore(db): add seed data for roles and org"
```

---

## Task 5: 认证（JWT）与当前用户上下文

**Files:**
- Create: `apps/backend/src/auth/jwt.ts`
- Create: `apps/backend/src/auth/password.ts`
- Create: `apps/backend/src/auth/auth.middleware.ts`
- Create: `apps/backend/src/auth/auth.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/src/test/auth.test.ts`

- [ ] **Step 1: password 工具**

`src/auth/password.ts`

```ts
import bcrypt from "bcryptjs";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 2: JWT 工具**

`src/auth/jwt.ts`

```ts
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

const env = getEnv();

export type JwtPayload = {
  userId: string;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null || typeof (decoded as any).userId !== "string") {
    throw new Error("invalid token");
  }
  return { userId: (decoded as any).userId };
}
```

- [ ] **Step 3: auth middleware（注入 req.user）**

`src/auth/auth.middleware.ts`

```ts
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma.js";
import { verifyToken } from "./jwt.js";

export type AuthedUser = {
  id: string;
  role: string;
  dataScope: string;
  employeeId: string | null;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    const token = header.slice("Bearer ".length);
    const { userId } = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    req.user = { id: user.id, role: user.role, dataScope: user.dataScope, employeeId: user.employeeId };
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}
```

- [ ] **Step 4: auth routes（login/me）**

`src/auth/auth.routes.ts`

```ts
import type { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { verifyPassword } from "./password.js";
import { signToken } from "./jwt.js";
import { requireAuth } from "./auth.middleware.js";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export function mountAuthRoutes(router: Router) {
  router.post("/api/auth/login", async (req, res) => {
    const body = LoginSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "bad_request" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    const ok = await verifyPassword(body.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    res.json({ token: signToken({ userId: user.id }) });
  });

  router.get("/api/auth/me", requireAuth, async (req, res) => {
    res.json({ id: req.user!.id, role: req.user!.role, dataScope: req.user!.dataScope, employeeId: req.user!.employeeId });
  });
}
```

- [ ] **Step 5: 挂载到 app**

Modify `src/app.ts`：

```ts
import express from "express";
import { mountAuthRoutes } from "./auth/auth.routes.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  mountAuthRoutes(app);

  return app;
}
```

- [ ] **Step 6: 写 auth 测试**

`src/test/auth.test.ts`

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("auth", () => {
  it("rejects invalid credentials", async () => {
    const res = await request(createApp()).post("/api/auth/login").send({ email: "nope@hros.local", password: "x" });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 7: 运行测试**

Run: `npm -w apps/backend test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/auth apps/backend/src/app.ts apps/backend/src/test/auth.test.ts
git commit -m "feat(auth): add jwt login and auth middleware"
```

---

## Task 6: RBAC + Scope 过滤 + 字段分级过滤（后端核心横切）

**Files:**
- Create: `apps/backend/src/rbac/requireRole.ts`
- Create: `apps/backend/src/scope/scope.ts`
- Create: `apps/backend/src/field-policy/classification.ts`
- Create: `apps/backend/src/field-policy/filter.ts`
- Create: `apps/backend/src/audit/audit.ts`
- Create: `apps/backend/src/audit/audit.middleware.ts`

- [ ] **Step 1: RBAC middleware**

`src/rbac/requireRole.ts`

```ts
import type { NextFunction, Request, Response } from "express";

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
```

- [ ] **Step 2: Scope 计算（MVP：只做 OrgScope roots + 递归 CTE 查询可见 orgUnitIds）**

`src/scope/scope.ts`

```ts
import { prisma } from "../db/prisma.js";

export async function getVisibleOrgUnitIds(userId: string, dataScope: string, employeeId: string | null): Promise<string[] | "ALL"> {
  if (dataScope === "ALL") return "ALL";

  if (dataScope === "SELF") return [];

  if (dataScope === "ORG_TREE") {
    const roots = await prisma.orgScope.findMany({ where: { userId } });
    const ids = new Set<string>();
    for (const r of roots) {
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `WITH RECURSIVE t AS (
           SELECT id FROM "OrgUnit" WHERE id = $1
           UNION ALL
           SELECT o.id FROM "OrgUnit" o JOIN t ON o."parentId" = t.id
         ) SELECT id FROM t`,
        r.orgUnitId
      );
      rows.forEach((x) => ids.add(x.id));
    }
    return [...ids];
  }

  if (dataScope === "DEPT_TREE") {
    if (!employeeId) return [];
    const emp = await prisma.employment.findFirst({ where: { employeeId, effectiveTo: null } });
    if (!emp) return [];
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `WITH RECURSIVE t AS (
         SELECT id FROM "OrgUnit" WHERE id = $1
         UNION ALL
         SELECT o.id FROM "OrgUnit" o JOIN t ON o."parentId" = t.id
       ) SELECT id FROM t`,
      emp.orgUnitId
    );
    return rows.map((x) => x.id);
  }

  return [];
}
```

- [ ] **Step 3: 字段分级定义（MVP 固定映射）**

`src/field-policy/classification.ts`

```ts
export type FieldClassification = "PUBLIC" | "PERSONAL" | "SENSITIVE" | "HIGHLY_SENSITIVE";

export const EmployeeFieldPolicy: Record<string, FieldClassification> = {
  id: "PUBLIC",
  employeeNo: "PERSONAL",
  name: "PERSONAL",
  status: "PUBLIC"
};

export const EmployeeSensitiveFieldPolicy: Record<string, FieldClassification> = {
  idNumber: "HIGHLY_SENSITIVE",
  phone: "SENSITIVE",
  address: "SENSITIVE",
  bankAccount: "HIGHLY_SENSITIVE"
};
```

- [ ] **Step 4: 字段过滤（按角色与分级）**

`src/field-policy/filter.ts`

```ts
import type { FieldClassification } from "./classification.js";

function canSee(role: string, c: FieldClassification) {
  if (c === "PUBLIC") return true;
  if (c === "PERSONAL") return true;
  if (c === "SENSITIVE") return role === "ADMIN" || role === "HRBP" || role === "HR_SPECIALIST" || role === "PAYROLL_FINANCE";
  if (c === "HIGHLY_SENSITIVE") return role === "ADMIN" || role === "HR_SPECIALIST" || role === "PAYROLL_FINANCE";
  return false;
}

export function filterByPolicy<T extends Record<string, any>>(obj: T, policy: Record<string, FieldClassification>, role: string): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const c = policy[k];
    if (!c || canSee(role, c)) out[k] = v;
  }
  return out as Partial<T>;
}
```

- [ ] **Step 5: 审计写入（函数）**

`src/audit/audit.ts`

```ts
import type { FieldClassification } from "../field-policy/classification.js";
import { prisma } from "../db/prisma.js";

export async function writeAudit(params: {
  actorUserId: string;
  action: "READ_SENSITIVE" | "EXPORT" | "UPDATE" | "LOCK" | "UNLOCK" | "TRANSITION";
  resourceType: string;
  resourceId: string;
  fieldClassification: FieldClassification;
  metadata: Record<string, any>;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      fieldClassification: params.fieldClassification,
      metadata: params.metadata
    }
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/rbac apps/backend/src/scope apps/backend/src/field-policy apps/backend/src/audit
git commit -m "feat(core): add rbac scope and field classification helpers"
```

---

## Task 7: 员工 API（范围过滤 + 字段过滤 + 审计）

**Files:**
- Create: `apps/backend/src/modules/employees/employees.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/src/test/employees.test.ts`

- [ ] **Step 1: 员工路由（最小：list/get）**

`src/modules/employees/employees.routes.ts`

```ts
import type { Router } from "express";
import { requireAuth } from "../../auth/auth.middleware.js";
import { prisma } from "../../db/prisma.js";
import { getVisibleOrgUnitIds } from "../../scope/scope.js";
import { EmployeeFieldPolicy, EmployeeSensitiveFieldPolicy } from "../../field-policy/classification.js";
import { filterByPolicy } from "../../field-policy/filter.js";
import { writeAudit } from "../../audit/audit.js";

export function mountEmployeeRoutes(router: Router) {
  router.get("/api/employees", requireAuth, async (req, res) => {
    const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);

    if (req.user!.dataScope === "SELF") {
      if (!req.user!.employeeId) {
        res.json([]);
        return;
      }
      const emp = await prisma.employee.findUnique({ where: { id: req.user!.employeeId } });
      res.json(emp ? [filterByPolicy(emp, EmployeeFieldPolicy, req.user!.role)] : []);
      return;
    }

    const employees = await prisma.employee.findMany({
      where: visible === "ALL" ? {} : { employments: { some: { orgUnitId: { in: visible }, effectiveTo: null } } }
    });
    res.json(employees.map((e) => filterByPolicy(e, EmployeeFieldPolicy, req.user!.role)));
  });

  router.get("/api/employees/:id", requireAuth, async (req, res) => {
    const emp = await prisma.employee.findUnique({ where: { id: req.params.id }, include: { sensitive: true, employments: true } });
    if (!emp) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (req.user!.dataScope === "SELF" && req.user!.employeeId !== emp.id) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const visible = await getVisibleOrgUnitIds(req.user!.id, req.user!.dataScope, req.user!.employeeId);
    if (visible !== "ALL" && req.user!.dataScope !== "SELF") {
      const current = emp.employments.find((x) => x.effectiveTo === null);
      if (current && !visible.includes(current.orgUnitId)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
    }

    const payload: any = {
      ...filterByPolicy(emp, EmployeeFieldPolicy, req.user!.role),
      sensitive: emp.sensitive ? filterByPolicy(emp.sensitive, EmployeeSensitiveFieldPolicy, req.user!.role) : null
    };

    if (payload.sensitive && Object.keys(payload.sensitive).length > 0) {
      await writeAudit({
        actorUserId: req.user!.id,
        action: "READ_SENSITIVE",
        resourceType: "Employee",
        resourceId: emp.id,
        fieldClassification: "SENSITIVE",
        metadata: { fields: Object.keys(payload.sensitive) }
      });
    }

    res.json(payload);
  });
}
```

- [ ] **Step 2: 挂载路由**

Modify `src/app.ts`，增加：

```ts
import { mountEmployeeRoutes } from "./modules/employees/employees.routes.js";

mountEmployeeRoutes(app);
```

- [ ] **Step 3: 写 1 个字段过滤测试（员工自助看不到他人）**

`src/test/employees.test.ts`

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("employees", () => {
  it("rejects unauth", async () => {
    const res = await request(createApp()).get("/api/employees");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/modules/employees apps/backend/src/app.ts apps/backend/src/test/employees.test.ts
git commit -m "feat(employees): add scoped employee endpoints with field filtering"
```

---

## Task 8: 入职工单 API（线性状态机 + 锁定/解锁）

**Files:**
- Create: `apps/backend/src/modules/onboarding/onboarding.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/src/test/onboarding.test.ts`

- [ ] **Step 1: 实现入职工单路由（create/submit/transition/lock/unlock/patch）**

说明：此任务实现必须严格遵循设计稿中状态机与锁定规则（draft 可编辑；submitted+ 默认锁定；HR 专员可 unlock；completed/cancelled 不可解锁）。

- [ ] **Step 2: 为状态迁移写单元测试（非法迁移应失败）**

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/onboarding apps/backend/src/app.ts apps/backend/src/test/onboarding.test.ts
git commit -m "feat(onboarding): add linear case workflow with lock/unlock"
```

---

## Task 9: 离职工单 API（线性状态机 + 锁定/解锁 + 归档快照）

**Files:**
- Create: `apps/backend/src/modules/offboarding/offboarding.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/src/test/offboarding.test.ts`

- [ ] **Step 1: 实现离职工单路由（create/submit/transition/lock/unlock/archive）**

说明：archive 仅允许在 finance_confirm 后执行；archive 写入 ArchiveSnapshot（snapshot_payload）并将员工状态切换为 RESIGNED（同事务）。

- [ ] **Step 2: 写归档测试（archive 后不可修改，且统计口径不再计入在职）**

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/modules/offboarding apps/backend/src/app.ts apps/backend/src/test/offboarding.test.ts
git commit -m "feat(offboarding): add linear case workflow and immutable archive snapshot"
```

---

## Task 10: 入离职统计 API（范围过滤）

**Files:**
- Create: `apps/backend/src/modules/stats/stats.routes.ts`
- Modify: `apps/backend/src/app.ts`
- Test: `apps/backend/src/test/stats.test.ts`

- [ ] **Step 1: 实现 stats 路由**

要求：
- headcount：仅统计 ACTIVE（在职）
- distribution：按部门/职位（仅 ACTIVE），并继承范围过滤

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/modules/stats apps/backend/src/app.ts apps/backend/src/test/stats.test.ts
git commit -m "feat(stats): add scoped headcount and distribution endpoints"
```

---

## Task 11: 前端工程骨架（Vite + React + Antd）与最小页面

**Files:**
- Create: `apps/frontend/package.json`
- Create: `apps/frontend/vite.config.ts`
- Create: `apps/frontend/src/main.tsx`
- Create: `apps/frontend/src/app/App.tsx`
- Create: `apps/frontend/src/app/routes.tsx`
- Create: `apps/frontend/src/shared/api/client.ts`
- Create: `apps/frontend/src/shared/auth/session.ts`
- Create: `apps/frontend/src/pages/LoginPage.tsx`
- Create: `apps/frontend/src/pages/SelfOnboardingPage.tsx`
- Create: `apps/frontend/src/pages/HrWorklistPage.tsx`
- Create: `apps/frontend/src/pages/ManagerConfirmPage.tsx`

- [ ] **Step 1: 初始化前端依赖与运行脚本**

- [ ] **Step 2: 实现 Login（调用 /api/auth/login，保存 token）**

- [ ] **Step 3: 根据 /api/auth/me 的 role 分流到不同入口页**

- [ ] **Step 4: 最小页面**

要求：
- 员工自助：查看本人入职工单、提交、上传材料（MVP 可先不做真实上传，先做文本 item）
- HR：入职/离职工单列表与状态推进
- 经理：待确认列表与确认按钮

- [ ] **Step 5: Commit**

```bash
git add apps/frontend
git commit -m "feat(frontend): add minimal role-based pages for onboarding/offboarding"
```

---

## Task 12: 端到端手工验证脚本（Runbook）

**Files:**
- Create: `apps/backend/README.md`

- [ ] **Step 1: 编写本地运行说明**

必须包含：
- 启动 db、迁移、seed、启动后端、启动前端的完整命令
- 6 个测试账号与密码
- 一条“员工自助发起入职→HR审核→经理确认→完成”的验证步骤
- 一条“员工自助发起离职→HR审核→经理确认→财务确认→归档”的验证步骤

- [ ] **Step 2: Commit**

```bash
git add apps/backend/README.md
git commit -m "docs: add runbook for onboarding/offboarding mvp"
```

---

## 自检清单（执行者必做）

- [ ] 所有接口返回均执行“范围过滤 → 字段过滤”
- [ ] Sensitive/HighlySensitive 的读取/解锁/归档写入审计
- [ ] archived/completed/cancelled 状态强制不可解锁、不可修改
- [ ] 归档快照不可变（只写入不更新），并有独立查询入口（后续可加）
