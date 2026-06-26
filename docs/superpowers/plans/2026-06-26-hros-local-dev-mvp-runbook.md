# HROS Local Dev MVP Runbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the HROS MVP easier to run locally by fixing the root dev workflow, clarifying the PostgreSQL-based startup path, and verifying the local dev servers start successfully.

**Architecture:** Keep the existing workspace structure intact. Add a lightweight root-level developer runbook and a shell-based root dev script that launches backend and frontend together without introducing new npm dependencies. Update documentation to make PostgreSQL the explicit local source of truth and validate the result by starting both servers locally.

**Tech Stack:** npm workspaces, shell script, Vite, Express, Prisma, PostgreSQL

---

## File Structure

- Create: `README.md`
- Create: `scripts/dev.sh`
- Create: `apps/backend/src/test/root-dev-runbook.test.ts`
- Modify: `package.json`
- Modify: `apps/backend/README.md`

## Task 1: Add Root Local Runbook

**Files:**
- Create: `README.md`
- Modify: `apps/backend/README.md`
- Test: `apps/backend/src/test/root-dev-runbook.test.ts`

- [ ] **Step 1: Write the failing documentation test**

Create `apps/backend/src/test/root-dev-runbook.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("root local dev runbook", () => {
  it("documents the PostgreSQL-based MVP startup path", () => {
    const rootReadme = readFileSync(resolve(process.cwd(), "..", "..", "README.md"), "utf8");
    expect(rootReadme).toContain("docker compose up -d db");
    expect(rootReadme).toContain("npm run dev");
    expect(rootReadme).toContain("http://localhost:5173");
    expect(rootReadme).toContain("http://localhost:3003");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/backend exec vitest run src/test/root-dev-runbook.test.ts
```

Expected: FAIL because `README.md` does not exist at the repository root yet.

- [ ] **Step 3: Write the minimal runbook**

Create `README.md` with:

```md
# HROS

## MVP 本地运行

### 1. 安装依赖

```bash
npm install --cache ./.npm-cache
```

### 2. 启动 PostgreSQL

```bash
docker compose up -d db
cp apps/backend/.env.example apps/backend/.env
npm -w apps/backend run prisma:migrate -- --name ai_native_core
npm -w apps/backend run prisma:seed
npm -w apps/backend run prisma:generate
```

### 3. 启动前后端

```bash
npm run dev
```

前端：`http://localhost:5173`

后端：`http://localhost:3003`
```

Update `apps/backend/README.md` so the root README is the preferred entry and PostgreSQL is explicitly the only supported local dev path.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm -w apps/backend exec vitest run src/test/root-dev-runbook.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md apps/backend/README.md apps/backend/src/test/root-dev-runbook.test.ts
git commit -m "docs: add root local MVP runbook"
```

## Task 2: Add Root Dev Launcher

**Files:**
- Create: `scripts/dev.sh`
- Modify: `package.json`

- [ ] **Step 1: Write the failing script expectation**

Run:

```bash
npm run dev -- --help
```

Expected: Current behavior only starts backend and does not represent a full-stack MVP launcher.

- [ ] **Step 2: Implement the launcher**

Create `scripts/dev.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}

trap cleanup EXIT INT TERM

npm run dev:db
npm run dev:backend &
BACKEND_PID=$!
npm run dev:frontend &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
```

Update root `package.json`:

```json
{
  "scripts": {
    "dev:db": "docker compose up -d db",
    "dev:backend": "npm -w apps/backend run dev",
    "dev:frontend": "npm -w apps/frontend run dev -- --host 0.0.0.0 --port 5173",
    "dev": "bash ./scripts/dev.sh"
  }
}
```

- [ ] **Step 3: Verify the launcher script exists and is executable**

Run:

```bash
chmod +x scripts/dev.sh
test -x scripts/dev.sh && echo OK
```

Expected: `OK`

- [ ] **Step 4: Verify package scripts**

Run:

```bash
npm run dev:db
```

Expected: PostgreSQL container starts or stays running.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/dev.sh
git commit -m "chore: add root full-stack dev launcher"
```

## Task 3: Run Local MVP Dev And Verify

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Start the local MVP**

Run:

```bash
npm run dev
```

Expected:
- PostgreSQL is available on `5432`
- backend listens on `3003`
- frontend listens on `5173`

- [ ] **Step 2: Verify backend**

Run:

```bash
curl -s http://localhost:3003/health
```

Expected: HTTP 200 response with health payload.

- [ ] **Step 3: Verify frontend**

Run:

```bash
curl -I http://localhost:5173
```

Expected: HTTP 200 or redirect response from Vite dev server.

- [ ] **Step 4: Update README with the exact validated command**

Ensure `README.md` includes:

```md
### 一键开发启动

```bash
npm run dev
```
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: validate local MVP startup flow"
```

## Self-Review

### Spec coverage

- 修正本地运行入口：Task 2
- 统一 PostgreSQL 说明：Task 1
- 增加根 README 最短启动路径：Task 1
- 本地实际运行 dev 并验证：Task 3

### Placeholder scan

- No `TBD`
- No `TODO`
- No deferred implementation placeholders

### Type consistency

- Root startup path is consistently `npm run dev`
- Local database path is consistently PostgreSQL via `docker compose up -d db`

