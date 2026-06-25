---
name: fastclaw-frontpage
description: "Generate a complete fastclaw frontpage (landing page) using the shipany-tanstack template. Use whenever the user wants to create a new landing page, frontpage, homepage, or marketing page for a fastclaw project. Triggers on: 'create a frontpage', 'make a landing page', 'build the homepage', 'generate a marketing page', 'fastclaw frontpage'."
runAs: inline
---

# FastClaw Frontpage Generator

Generate a complete frontpage for a **fastclaw** project using the bundled shipany-tanstack template.

## Template Location

All template files are at **relative path `template/`** — no external dependencies.

## Workflow

### Step 1: Understand the brief
Ask the user for: product name, tagline, key features, target audience, color/style preference, sections needed, pricing tiers.

### Step 2: Copy template files
```
mkdir -p frontend/src
cp -r template/src/components template/src/core template/src/lib template/src/config template/src/hooks template/src/styles template/src/modules template/src/content frontend/src/
cp template/src/server.ts template/src/router.tsx frontend/src/
cp template/package.json template/tsconfig.json template/vite.config.ts template/components.json template/.env.example template/drizzle.config.ts frontend/
cp -r template/project.inlang template/messages template/public template/scripts frontend/
```

### Step 3: Install + generate paraglide
```
cd frontend && pnpm install
```

### Step 4: Read reference files
Read `frontend/src/blocks/*.tsx` for block patterns and `frontend/src/components/` for component patterns. These are the source of truth for code style.

### Step 5: Generate blocks, i18n, route
- Create blocks in `frontend/src/blocks/` following patterns from Step 4
- Add i18n keys to **both** `messages/en.json` and `messages/zh.json`
- Rewrite `frontend/src/routes/index.tsx`

### Step 6: Verify
```
cd frontend && npx vite build
```

## Key Rules

1. **Blocks vs Components:** reads i18n → block. pure props → component.
2. **i18n:** `m['ns.key']()` from `@/paraglide/messages.js`, add keys to both en.json and zh.json
3. **Imports:** `Link` from `@/core/i18n/navigation`, `envConfigs` from `@/config`, `cn` from `@/lib/utils`, `buttonVariants` from `@/components/ui/button`
4. **shadcn/ui v4:** No `asChild`. Use `className={cn(buttonVariants())}` on Link
