# HROS ShipAny + TanStack Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 HROS 前端整体迁移为 `ShipAny + TanStack Router + TanStack Query` 架构，并安装上传包中的 `fastclaw-frontpage` skill，同时继续复用现有 HROS 后端 API。

**Architecture:** 前端保留 `Vite + React` 作为运行底座，但把当前 `react-router-dom + antd 页面式结构` 替换为 `TanStack Router + Query + 模块化 service` 架构。上传包中的模板只作为目录组织、基础组件和技能安装来源；HROS 业务模块 `auth / onboarding / offboarding / workitems` 继续消费现有 Express API，不改后端契约。

**Tech Stack:** React 19, Vite 6, TypeScript 5, `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `vitest`, `@testing-library/react`, `jsdom`

---

## File Structure

### Install / workspace files

- Create: `.trae/skills/fastclaw-frontpage/SKILL.md`

### Frontend files to modify

- Modify: `apps/frontend/package.json`
- Modify: `apps/frontend/src/main.tsx`
- Modify: `apps/frontend/vite.config.ts`
- Modify: `apps/frontend/tsconfig.json`

### Frontend files to create

- Create: `apps/frontend/src/router.tsx`
- Create: `apps/frontend/src/routes/__root.tsx`
- Create: `apps/frontend/src/routes/login.tsx`
- Create: `apps/frontend/src/routes/self.tsx`
- Create: `apps/frontend/src/routes/hr.tsx`
- Create: `apps/frontend/src/routes/manager.tsx`
- Create: `apps/frontend/src/routes/finance.tsx`
- Create: `apps/frontend/src/lib/query-client.ts`
- Create: `apps/frontend/src/lib/api-client.ts`
- Create: `apps/frontend/src/lib/utils.ts`
- Create: `apps/frontend/src/modules/auth/types.ts`
- Create: `apps/frontend/src/modules/auth/session.ts`
- Create: `apps/frontend/src/modules/auth/service.ts`
- Create: `apps/frontend/src/modules/auth/queries.ts`
- Create: `apps/frontend/src/modules/auth/login-form.tsx`
- Create: `apps/frontend/src/modules/onboarding/types.ts`
- Create: `apps/frontend/src/modules/onboarding/service.ts`
- Create: `apps/frontend/src/modules/onboarding/queries.ts`
- Create: `apps/frontend/src/modules/onboarding/mutations.ts`
- Create: `apps/frontend/src/modules/onboarding/views/self-onboarding-view.tsx`
- Create: `apps/frontend/src/modules/offboarding/types.ts`
- Create: `apps/frontend/src/modules/offboarding/service.ts`
- Create: `apps/frontend/src/modules/offboarding/queries.ts`
- Create: `apps/frontend/src/modules/offboarding/mutations.ts`
- Create: `apps/frontend/src/modules/offboarding/views/self-offboarding-view.tsx`
- Create: `apps/frontend/src/modules/workitems/types.ts`
- Create: `apps/frontend/src/modules/workitems/service.ts`
- Create: `apps/frontend/src/modules/workitems/queries.ts`
- Create: `apps/frontend/src/modules/workitems/views/hr-worklist-view.tsx`
- Create: `apps/frontend/src/modules/workitems/views/manager-worklist-view.tsx`
- Create: `apps/frontend/src/modules/workitems/views/finance-worklist-view.tsx`
- Create: `apps/frontend/src/components/layout/app-shell.tsx`
- Create: `apps/frontend/src/components/layout/page-header.tsx`
- Create: `apps/frontend/src/components/ui/button.tsx`
- Create: `apps/frontend/src/components/ui/card.tsx`
- Create: `apps/frontend/src/components/ui/table.tsx`
- Create: `apps/frontend/src/components/ui/empty-state.tsx`
- Create: `apps/frontend/src/components/ui/action-event-timeline.tsx`
- Create: `apps/frontend/src/styles/globals.css`

### Frontend files to remove after migration

- Delete: `apps/frontend/src/app/App.tsx`
- Delete: `apps/frontend/src/app/routes.tsx`
- Delete: `apps/frontend/src/pages/LoginPage.tsx`
- Delete: `apps/frontend/src/pages/SelfOnboardingPage.tsx`
- Delete: `apps/frontend/src/pages/HrWorklistPage.tsx`
- Delete: `apps/frontend/src/pages/ManagerConfirmPage.tsx`
- Delete: `apps/frontend/src/pages/FinanceConfirmPage.tsx`
- Delete: `apps/frontend/src/shared/api/client.ts`
- Delete: `apps/frontend/src/shared/auth/session.ts`
- Delete: `apps/frontend/src/shared/components/ActionEventTimeline.tsx`

### Test files to create

- Create: `apps/frontend/src/lib/api-client.test.ts`
- Create: `apps/frontend/src/modules/auth/service.test.ts`
- Create: `apps/frontend/src/modules/auth/login-form.test.tsx`
- Create: `apps/frontend/src/routes/__root.test.tsx`
- Create: `apps/frontend/src/modules/onboarding/service.test.ts`
- Create: `apps/frontend/src/modules/offboarding/service.test.ts`
- Create: `apps/frontend/src/modules/workitems/service.test.ts`

## Task 1: Install the Uploaded Skill and Add Frontend Test Infrastructure

**Files:**
- Create: `.trae/skills/fastclaw-frontpage/SKILL.md`
- Modify: `apps/frontend/package.json`
- Modify: `apps/frontend/tsconfig.json`
- Modify: `apps/frontend/vite.config.ts`
- Test: `apps/frontend/src/lib/api-client.test.ts`

- [ ] **Step 1: Write the failing frontend smoke test**

Create `apps/frontend/src/lib/api-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getStoredToken, setStoredToken } from "./api-client";

describe("api-client token storage", () => {
  it("persists and clears the hros token", () => {
    setStoredToken("token-123");
    expect(getStoredToken()).toBe("token-123");

    setStoredToken(null);
    expect(getStoredToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/frontend exec vitest run src/lib/api-client.test.ts
```

Expected: FAIL with `Cannot find module './api-client'` or `vitest: command not found`.

- [ ] **Step 3: Write minimal implementation**

Create the skill from the uploaded package:

`.trae/skills/fastclaw-frontpage/SKILL.md`

```md
---
name: fastclaw-frontpage
description: "Generate a complete fastclaw frontpage (landing page) using the shipany-tanstack template. Use whenever the user wants to create a new landing page, frontpage, homepage, or marketing page for a fastclaw project."
runAs: inline
---

# FastClaw Frontpage Generator

Generate a complete frontpage for a fastclaw project using the bundled shipany-tanstack template.
```

Update `apps/frontend/package.json` to add the new runtime and test dependencies:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.66.9",
    "@tanstack/react-query-devtools": "^5.66.9",
    "@tanstack/react-router": "^1.95.1",
    "@tanstack/react-router-devtools": "^1.95.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

Create the first minimal `apps/frontend/src/lib/api-client.ts`:

```ts
const TOKEN_KEY = "hros_token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}
```

Update `apps/frontend/vite.config.ts`:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
```

Update `apps/frontend/tsconfig.json` to include path alias and vitest types:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["vite/client", "vitest/globals"]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm -w apps/frontend install
npm -w apps/frontend exec vitest run src/lib/api-client.test.ts
```

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add .trae/skills/fastclaw-frontpage/SKILL.md apps/frontend/package.json apps/frontend/tsconfig.json apps/frontend/vite.config.ts apps/frontend/src/lib/api-client.ts apps/frontend/src/lib/api-client.test.ts
git commit -m "feat: install fastclaw skill and frontend test stack"
```

## Task 2: Build the TanStack Router and Query Skeleton

**Files:**
- Create: `apps/frontend/src/lib/query-client.ts`
- Create: `apps/frontend/src/router.tsx`
- Create: `apps/frontend/src/routes/__root.tsx`
- Modify: `apps/frontend/src/main.tsx`
- Create: `apps/frontend/src/styles/globals.css`
- Test: `apps/frontend/src/routes/__root.test.tsx`

- [ ] **Step 1: Write the failing root route test**

Create `apps/frontend/src/routes/__root.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RootLoading } from "./__root";

describe("root loading view", () => {
  it("renders the loading shell", () => {
    render(<RootLoading />);
    expect(screen.getByText("加载中")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/frontend exec vitest run src/routes/__root.test.tsx
```

Expected: FAIL with `Cannot find module './__root'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/frontend/src/lib/query-client.ts`:

```ts
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false
      }
    }
  });
}

let browserClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}
```

Create `apps/frontend/src/routes/__root.tsx`:

```tsx
import { createRootRoute, Outlet } from "@tanstack/react-router";

export function RootLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <span>加载中</span>
    </div>
  );
}

function RootRouteComponent() {
  return <Outlet />;
}

export const Route = createRootRoute({
  component: RootRouteComponent
});
```

Create `apps/frontend/src/router.tsx`:

```tsx
import { createRouter, createRoute, createRootRoute, Outlet } from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: () => <Outlet />
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => <div>login</div>
});

const routeTree = rootRoute.addChildren([loginRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

Replace `apps/frontend/src/main.tsx` with:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { getQueryClient } from "./lib/query-client";
import { router } from "./router";
import "./styles/globals.css";

const queryClient = getQueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

Create `apps/frontend/src/styles/globals.css`:

```css
:root {
  color-scheme: light;
  font-family: Inter, system-ui, sans-serif;
  background: #f6f8fb;
  color: #0f172a;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}
```

- [ ] **Step 4: Run test and build to verify it passes**

Run:

```bash
npm -w apps/frontend exec vitest run src/routes/__root.test.tsx
npm -w apps/frontend run build
```

Expected:
- test PASS
- Vite build PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/query-client.ts apps/frontend/src/router.tsx apps/frontend/src/routes/__root.tsx apps/frontend/src/main.tsx apps/frontend/src/styles/globals.css apps/frontend/src/routes/__root.test.tsx
git commit -m "feat: add tanstack router and query skeleton"
```

## Task 3: Migrate Auth, Session Recovery, and Login Route

**Files:**
- Create: `apps/frontend/src/modules/auth/types.ts`
- Create: `apps/frontend/src/modules/auth/session.ts`
- Create: `apps/frontend/src/modules/auth/service.ts`
- Create: `apps/frontend/src/modules/auth/queries.ts`
- Create: `apps/frontend/src/modules/auth/login-form.tsx`
- Create: `apps/frontend/src/routes/login.tsx`
- Modify: `apps/frontend/src/routes/__root.tsx`
- Test: `apps/frontend/src/modules/auth/service.test.ts`
- Test: `apps/frontend/src/modules/auth/login-form.test.tsx`

- [ ] **Step 1: Write the failing auth service test**

Create `apps/frontend/src/modules/auth/service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { login } from "./service";

describe("auth service", () => {
  it("posts credentials and returns a token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "token-123" })
      })
    );

    const result = await login({
      email: "employee@hros.local",
      password: "password12345"
    });

    expect(result.token).toBe("token-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/frontend exec vitest run src/modules/auth/service.test.ts
```

Expected: FAIL with `Cannot find module './service'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/frontend/src/modules/auth/types.ts`:

```ts
export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
};

export type CurrentUser = {
  id: string;
  role: string;
  dataScope: string;
  employeeId: string | null;
};
```

Create `apps/frontend/src/modules/auth/session.ts`:

```ts
const TOKEN_KEY = "hros_token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}
```

Replace `apps/frontend/src/lib/api-client.ts` with:

```ts
export type HttpMethod = "GET" | "POST" | "PATCH";

const API_BASE = "";
let token: string | null = null;

export function setAuthToken(nextToken: string | null) {
  token = nextToken;
}

export function getStoredToken() {
  return localStorage.getItem("hros_token");
}

export function setStoredToken(nextToken: string | null) {
  if (nextToken) {
    localStorage.setItem("hros_token", nextToken);
  } else {
    localStorage.removeItem("hros_token");
  }
}

export async function apiFetch<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json as T;
}
```

Create `apps/frontend/src/modules/auth/service.ts`:

```ts
import { apiFetch, setAuthToken, setStoredToken } from "@/lib/api-client";
import type { CurrentUser, LoginInput, LoginResponse } from "./types";

export async function login(input: LoginInput) {
  const result = await apiFetch<LoginResponse>("POST", "/api/auth/login", input);
  setStoredToken(result.token);
  setAuthToken(result.token);
  return result;
}

export async function getCurrentUser() {
  return apiFetch<CurrentUser>("GET", "/api/auth/me");
}

export function logout() {
  setStoredToken(null);
  setAuthToken(null);
}

export function getRoleHomePath(role: string) {
  return role === "EMPLOYEE_SELF"
    ? "/self"
    : role === "MANAGER"
      ? "/manager"
      : role === "PAYROLL_FINANCE"
        ? "/finance"
        : "/hr";
}
```

Create `apps/frontend/src/modules/auth/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { getCurrentUser } from "./service";

export const currentUserQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: getCurrentUser,
  retry: false
});
```

Create `apps/frontend/src/modules/auth/login-form.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentUser, getRoleHomePath, login } from "./service";

export function LoginForm() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        try {
          setSubmitting(true);
          setErrorMessage("");
          await login({
            email: String(formData.get("email") || ""),
            password: String(formData.get("password") || "")
          });
          const me = await getCurrentUser();
          await navigate({ to: getRoleHomePath(me.role) });
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "登录失败");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <input name="email" defaultValue="employee@hros.local" />
      <input name="password" type="password" defaultValue="password12345" />
      <button type="submit" disabled={submitting}>
        登录
      </button>
      {errorMessage ? <p>{errorMessage}</p> : null}
    </form>
  );
}
```

Create `apps/frontend/src/routes/login.tsx`:

```tsx
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { LoginForm } from "@/modules/auth/login-form";

function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div>
        <h1>HROS 登录</h1>
        <LoginForm />
      </div>
    </div>
  );
}

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage
});
```

Update `apps/frontend/src/routes/__root.tsx` to fetch current user from query client and gate routes:

```tsx
import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { currentUserQuery } from "@/modules/auth/queries";
import { getRoleHomePath } from "@/modules/auth/service";
import { getStoredToken, setAuthToken } from "@/lib/api-client";

export function RootLoading() {
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>加载中</div>;
}

function RootRouteComponent() {
  const navigate = useNavigate();
  const token = getStoredToken();

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const meQuery = useQuery({
    ...currentUserQuery,
    enabled: Boolean(token)
  });

  useEffect(() => {
    if (meQuery.data) {
      navigate({ to: getRoleHomePath(meQuery.data.role), replace: true });
    }
  }, [meQuery.data, navigate]);

  if (token && meQuery.isLoading) return <RootLoading />;
  return <Outlet />;
}

export const Route = createRootRoute({
  component: RootRouteComponent
});
```

- [ ] **Step 4: Run tests and build to verify it passes**

Run:

```bash
npm -w apps/frontend exec vitest run src/modules/auth/service.test.ts src/modules/auth/login-form.test.tsx
npm -w apps/frontend run build
```

Expected:
- auth tests PASS
- build PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/api-client.ts apps/frontend/src/modules/auth apps/frontend/src/routes/login.tsx apps/frontend/src/routes/__root.tsx
git commit -m "feat: migrate auth to tanstack router"
```

## Task 4: Migrate the Self-Service Onboarding and Offboarding Views

**Files:**
- Create: `apps/frontend/src/modules/onboarding/types.ts`
- Create: `apps/frontend/src/modules/onboarding/service.ts`
- Create: `apps/frontend/src/modules/onboarding/queries.ts`
- Create: `apps/frontend/src/modules/onboarding/mutations.ts`
- Create: `apps/frontend/src/modules/onboarding/views/self-onboarding-view.tsx`
- Create: `apps/frontend/src/modules/offboarding/types.ts`
- Create: `apps/frontend/src/modules/offboarding/service.ts`
- Create: `apps/frontend/src/modules/offboarding/queries.ts`
- Create: `apps/frontend/src/modules/offboarding/mutations.ts`
- Create: `apps/frontend/src/modules/offboarding/views/self-offboarding-view.tsx`
- Create: `apps/frontend/src/routes/self.tsx`
- Create: `apps/frontend/src/components/ui/action-event-timeline.tsx`
- Test: `apps/frontend/src/modules/onboarding/service.test.ts`
- Test: `apps/frontend/src/modules/offboarding/service.test.ts`

- [ ] **Step 1: Write the failing onboarding service test**

Create `apps/frontend/src/modules/onboarding/service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createOnboardingDraft } from "./service";

describe("onboarding service", () => {
  it("returns an action envelope from draft creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          events: [{ eventType: "command_succeeded", status: "ok", summary: "ok", timestamp: "2026-06-25T00:00:00.000Z", payload: {} }],
          result: { success: true, businessObjectType: "workflow_instance", businessObjectId: "wf-1", nextActions: [], artifacts: [] }
        })
      })
    );

    const result = await createOnboardingDraft();
    expect(result.result.businessObjectId).toBe("wf-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/frontend exec vitest run src/modules/onboarding/service.test.ts
```

Expected: FAIL because onboarding service files do not exist.

- [ ] **Step 3: Write minimal implementation**

Create shared types in `apps/frontend/src/modules/onboarding/types.ts`:

```ts
export type ActionEvent = {
  eventType: string;
  timestamp: string;
  status: "ok" | "failed";
  summary: string;
  payload: Record<string, unknown>;
};

export type ActionEnvelope<T = Record<string, unknown>> = {
  events: ActionEvent[];
  result: {
    success: boolean;
    businessObjectType: string;
    businessObjectId: string;
    nextActions: string[];
    artifacts: Array<{ type: string; id: string }>;
  } & T;
};

export type OnboardingCase = {
  id: string;
  status: string;
  createdAt: string;
};
```

Create `apps/frontend/src/modules/onboarding/service.ts`:

```ts
import { apiFetch } from "@/lib/api-client";
import type { ActionEnvelope, OnboardingCase } from "./types";

export function listOnboardingCases() {
  return apiFetch<OnboardingCase[]>("GET", "/api/onboarding-cases");
}

export function createOnboardingDraft() {
  return apiFetch<ActionEnvelope>("POST", "/api/onboarding-cases", {});
}

export function submitOnboardingCase(id: string) {
  return apiFetch<ActionEnvelope>("POST", `/api/onboarding-cases/${id}/submit`, {});
}
```

Create `apps/frontend/src/modules/onboarding/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { listOnboardingCases } from "./service";

export const onboardingListQuery = queryOptions({
  queryKey: ["onboarding", "list"],
  queryFn: listOnboardingCases
});
```

Create `apps/frontend/src/modules/onboarding/mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOnboardingDraft, submitOnboardingCase } from "./service";

export function useCreateOnboardingDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOnboardingDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding", "list"] });
    }
  });
}

export function useSubmitOnboardingCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitOnboardingCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding", "list"] });
    }
  });
}
```

Create `apps/frontend/src/modules/offboarding/service.ts` with the same pattern:

```ts
import { apiFetch } from "@/lib/api-client";
import type { ActionEnvelope } from "@/modules/onboarding/types";

export type OffboardingCase = {
  id: string;
  status: string;
  createdAt: string;
  plannedLastDay: string | null;
};

export function listOffboardingCases() {
  return apiFetch<OffboardingCase[]>("GET", "/api/offboarding-cases");
}

export function createOffboardingDraft() {
  return apiFetch<ActionEnvelope>("POST", "/api/offboarding-cases", { resignationReason: "个人原因" });
}

export function submitOffboardingCase(id: string) {
  return apiFetch<ActionEnvelope>("POST", `/api/offboarding-cases/${id}/submit`, {});
}
```

Create `apps/frontend/src/components/ui/action-event-timeline.tsx`:

```tsx
import type { ActionEvent } from "@/modules/onboarding/types";

export function ActionEventTimeline(props: { events: ActionEvent[] }) {
  if (props.events.length === 0) return <p>暂无最近操作事件</p>;

  return (
    <ul>
      {props.events.map((event) => (
        <li key={`${event.eventType}-${event.timestamp}`}>
          <strong>{event.eventType}</strong> · {event.status} · {event.summary}
        </li>
      ))}
    </ul>
  );
}
```

Create `apps/frontend/src/modules/onboarding/views/self-onboarding-view.tsx` and `.../self-offboarding-view.tsx` with query + mutation driven UI.

Create `apps/frontend/src/routes/self.tsx`:

```tsx
import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "@/router";
import { SelfOnboardingView } from "@/modules/onboarding/views/self-onboarding-view";
import { SelfOffboardingView } from "@/modules/offboarding/views/self-offboarding-view";

function SelfPage() {
  return (
    <div>
      <h1>员工自助</h1>
      <SelfOnboardingView />
      <SelfOffboardingView />
    </div>
  );
}

export const selfRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/self",
  component: SelfPage
});
```

- [ ] **Step 4: Run tests and build to verify it passes**

Run:

```bash
npm -w apps/frontend exec vitest run src/modules/onboarding/service.test.ts src/modules/offboarding/service.test.ts
npm -w apps/frontend run build
```

Expected:
- service tests PASS
- build PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/modules/onboarding apps/frontend/src/modules/offboarding apps/frontend/src/routes/self.tsx apps/frontend/src/components/ui/action-event-timeline.tsx
git commit -m "feat: migrate self-service onboarding and offboarding"
```

## Task 5: Migrate HR, Manager, and Finance Worklists

**Files:**
- Create: `apps/frontend/src/modules/workitems/types.ts`
- Create: `apps/frontend/src/modules/workitems/service.ts`
- Create: `apps/frontend/src/modules/workitems/queries.ts`
- Create: `apps/frontend/src/modules/workitems/views/hr-worklist-view.tsx`
- Create: `apps/frontend/src/modules/workitems/views/manager-worklist-view.tsx`
- Create: `apps/frontend/src/modules/workitems/views/finance-worklist-view.tsx`
- Create: `apps/frontend/src/routes/hr.tsx`
- Create: `apps/frontend/src/routes/manager.tsx`
- Create: `apps/frontend/src/routes/finance.tsx`
- Create: `apps/frontend/src/components/layout/app-shell.tsx`
- Create: `apps/frontend/src/components/layout/page-header.tsx`
- Test: `apps/frontend/src/modules/workitems/service.test.ts`

- [ ] **Step 1: Write the failing workitems service test**

Create `apps/frontend/src/modules/workitems/service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { listHrOnboardingCases } from "./service";

describe("workitems service", () => {
  it("loads hr onboarding workitems from the existing api", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "case-1", status: "SUBMITTED" }]
      })
    );

    const result = await listHrOnboardingCases();
    expect(result[0].status).toBe("SUBMITTED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm -w apps/frontend exec vitest run src/modules/workitems/service.test.ts
```

Expected: FAIL because workitems service does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/frontend/src/modules/workitems/service.ts`:

```ts
import { apiFetch } from "@/lib/api-client";
import type { ActionEnvelope } from "@/modules/onboarding/types";

export type WorkItemCase = {
  id: string;
  status: string;
  createdAt?: string;
};

export function listHrOnboardingCases() {
  return apiFetch<WorkItemCase[]>("GET", "/api/onboarding-cases");
}

export function listManagerOnboardingCases() {
  return apiFetch<WorkItemCase[]>("GET", "/api/onboarding-cases");
}

export function listFinanceOffboardingCases() {
  return apiFetch<WorkItemCase[]>("GET", "/api/offboarding-cases");
}

export function transitionOnboardingCase(id: string, to: "HR_REVIEW" | "MANAGER_CONFIRM" | "COMPLETED") {
  return apiFetch<ActionEnvelope>("POST", `/api/onboarding-cases/${id}/transition`, { to });
}

export function transitionOffboardingCase(id: string, to: "HR_REVIEW" | "MANAGER_CONFIRM" | "FINANCE_CONFIRM" | "ARCHIVED") {
  return apiFetch<ActionEnvelope>("POST", `/api/offboarding-cases/${id}/transition`, { to });
}
```

Create `apps/frontend/src/modules/workitems/queries.ts`:

```ts
import { queryOptions } from "@tanstack/react-query";
import { listFinanceOffboardingCases, listHrOnboardingCases, listManagerOnboardingCases } from "./service";

export const hrWorkitemsQuery = queryOptions({
  queryKey: ["workitems", "hr"],
  queryFn: listHrOnboardingCases
});

export const managerWorkitemsQuery = queryOptions({
  queryKey: ["workitems", "manager"],
  queryFn: listManagerOnboardingCases
});

export const financeWorkitemsQuery = queryOptions({
  queryKey: ["workitems", "finance"],
  queryFn: listFinanceOffboardingCases
});
```

Create the three view files with a shared pattern:

```tsx
import { useQuery } from "@tanstack/react-query";
import { hrWorkitemsQuery } from "../queries";

export function HrWorklistView() {
  const query = useQuery(hrWorkitemsQuery);
  if (query.isLoading) return <p>加载中</p>;
  return (
    <div>
      <h2>HR 工作台</h2>
      <pre>{JSON.stringify(query.data, null, 2)}</pre>
    </div>
  );
}
```

Create routes:

```tsx
export const hrRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hr",
  component: HrPage
});
```

Use the same pattern for `/manager` and `/finance`.

Create `apps/frontend/src/components/layout/app-shell.tsx`:

```tsx
import { PropsWithChildren } from "react";

export function AppShell(props: PropsWithChildren<{ title: string }>) {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f8fb" }}>
      <header style={{ padding: 16, background: "#111827", color: "#fff" }}>{props.title}</header>
      <main style={{ padding: 24 }}>{props.children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and build to verify it passes**

Run:

```bash
npm -w apps/frontend exec vitest run src/modules/workitems/service.test.ts
npm -w apps/frontend run build
```

Expected:
- workitems test PASS
- build PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/modules/workitems apps/frontend/src/routes/hr.tsx apps/frontend/src/routes/manager.tsx apps/frontend/src/routes/finance.tsx apps/frontend/src/components/layout
git commit -m "feat: migrate role worklists to tanstack routes"
```

## Task 6: Remove the Old Router and Legacy Frontend Shell

**Files:**
- Modify: `apps/frontend/src/router.tsx`
- Delete: `apps/frontend/src/app/App.tsx`
- Delete: `apps/frontend/src/app/routes.tsx`
- Delete: `apps/frontend/src/pages/LoginPage.tsx`
- Delete: `apps/frontend/src/pages/SelfOnboardingPage.tsx`
- Delete: `apps/frontend/src/pages/HrWorklistPage.tsx`
- Delete: `apps/frontend/src/pages/ManagerConfirmPage.tsx`
- Delete: `apps/frontend/src/pages/FinanceConfirmPage.tsx`
- Delete: `apps/frontend/src/shared/api/client.ts`
- Delete: `apps/frontend/src/shared/auth/session.ts`
- Delete: `apps/frontend/src/shared/components/ActionEventTimeline.tsx`

- [ ] **Step 1: Write the failing final build check**

Run:

```bash
npm -w apps/frontend run build
```

Expected: FAIL if the router still references old `App.tsx`, old `pages/*`, or stale shared imports.

- [ ] **Step 2: Remove old references**

Update `apps/frontend/src/router.tsx` so the real route tree contains:

```tsx
import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "@/routes/__root";
import { loginRoute } from "@/routes/login";
import { selfRoute } from "@/routes/self";
import { hrRoute } from "@/routes/hr";
import { managerRoute } from "@/routes/manager";
import { financeRoute } from "@/routes/finance";

const routeTree = rootRoute.addChildren([
  loginRoute,
  selfRoute,
  hrRoute,
  managerRoute,
  financeRoute
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true
});
```

Delete the legacy files listed above.

- [ ] **Step 3: Run build to verify the new shell is standalone**

Run:

```bash
npm -w apps/frontend run build
```

Expected: PASS with no imports from `src/app/*`, `src/pages/*`, or `src/shared/*`.

- [ ] **Step 4: Smoke test the running app**

Run:

```bash
npm -w apps/frontend run dev -- --host 0.0.0.0 --port 5173
```

Expected:
- `/login` loads the new login page
- successful login navigates to `/self`, `/manager`, `/finance`, or `/hr`
- the three worklist routes render data without using the old shell

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/router.tsx
git rm apps/frontend/src/app/App.tsx apps/frontend/src/app/routes.tsx apps/frontend/src/pages/LoginPage.tsx apps/frontend/src/pages/SelfOnboardingPage.tsx apps/frontend/src/pages/HrWorklistPage.tsx apps/frontend/src/pages/ManagerConfirmPage.tsx apps/frontend/src/pages/FinanceConfirmPage.tsx apps/frontend/src/shared/api/client.ts apps/frontend/src/shared/auth/session.ts apps/frontend/src/shared/components/ActionEventTimeline.tsx
git commit -m "refactor: remove legacy frontend shell"
```

## Self-Review

### Spec coverage

- skill 安装：Task 1 覆盖 `.trae/skills/fastclaw-frontpage/SKILL.md`
- TanStack 骨架：Task 2 覆盖 Router、QueryClient、main 入口
- 登录与认证：Task 3 覆盖 auth module、login route、root gating
- HROS 业务页：Task 4 覆盖 `self`；Task 5 覆盖 `hr / manager / finance`
- 旧骨架清理：Task 6 覆盖旧路由、旧页面、旧共享层删除

### Placeholder scan

- 本计划未使用 `TBD`、`TODO`、`implement later`、`Similar to Task N`
- 每个任务都给出了明确的文件、测试、命令和最小代码

### Type consistency

- 统一前端基础类型：`ActionEnvelope`, `ActionEvent`, `CurrentUser`, `WorkItemCase`
- 统一请求入口：`apiFetch`
- 统一角色首页映射：`getRoleHomePath`
- 统一路由入口：`rootRoute`, `loginRoute`, `selfRoute`, `hrRoute`, `managerRoute`, `financeRoute`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-25-hros-shipany-tanstack-frontend.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
