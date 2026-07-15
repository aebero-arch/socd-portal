# socd-portal — Project Memory

> Auto-synced | 91 observations

## 🏛️ CORE ARCHITECTURE

> **CRITICAL:** The following rules represent strict architectural boundaries defined by the user. NEVER violate them in your generated code or explanations.

# Intellectual Property & Architecture Rules
Write your strict architectural boundaries here. 
BrainSync will automatically enforce these rules across all agents (Cursor, Windsurf, Cline) 
and inject them into the memory context.

Example:
- NEVER use TailwindCSS. Only use vanilla CSS.
- NEVER write class components. Only use functional React components.

## 🛡️ GLOBAL SAFETY RULES

- **NEVER** run `git clean -fd` or `git reset --hard` without checking `git log` and verifying commits exist.
- **NEVER** delete untracked files or folders blindly. Always backup or stash before bulk edits.

## 🧭 ACTIVE CONTEXT

> Always read `.cursor/active-context.md` for exact instructions on the specific file you are currently editing. It updates dynamically.

## 🔴 STOP — READ THESE FIRST

- **Don't mix Tailwind with inline styles** — Don't mix Tailwind with inline styles
- **Don't import server-only code in client components** — Don't import server-only code in client components
- **Environment variables: NEXT_PUBLIC_ prefix for client-side only** — Environment variables: NEXT_PUBLIC_ prefix for client-side only
- **Don't use useEffect for data fetching — use server actions or loader** — Don't use useEffect for data fetching — use server actions or loader
- **Clean up effects — return cleanup function from useEffect** — Clean up effects — return cleanup function from useEffect

## 📐 Conventions

- Extract repeated class patterns into components
- Use responsive prefixes consistently (sm:, md:, lg:, xl:)
- Don't use arbitrary values when a utility class exists
- Use middleware.ts for authentication guards, not client-side checks
- Use next/image (not img tag) for automatic optimization
- Handle loading.tsx and error.tsx for every async route
- Use Server Components by default — add "use client" only when needed
- Use Suspense and Error Boundaries for async operations

## ⚡ Available Tools (ON-DEMAND only)
- `sys_core_02(title, content, category)` — Save a note + auto-detect conflicts
- `sys_core_03(items[])` — Save multiple notes in 1 call
- `sys_core_01(text)` — Search memory for architecture, past fixes, decisions
- `sys_core_05(text)` — Full-text search for details
- `sys_core_16()` — Check compiler errors after edits

> ℹ️ DO NOT call sys_core_14() or sys_core_08() at startup — context above IS your context.

---
*Auto-synced | 2026-07-15*
