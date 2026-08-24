---
name: nextjs-workflow
description: >-
  Use this skill when running, building, linting, or checking routes in Next.js development workflow.
---

# Next.js Development and Build Workflows

This skill guides the running, linting, and building of the Next.js frontend in the `socd-portal` project.

## Development Server

Start the development server with hot reloading enabled:
`npm run dev`

By default, the server runs on `http://localhost:3000`.

## Building for Production

Compile and optimize the project for production:
`npm run build`

This performs production builds, generating optimized output in the `.next/` directory.

## Code Quality and Typing Checks

### Linting
Run ESLint to check for stylistic and programmatic issues:
`npm run lint`

### TypeScript Type-Checking
Perform static type analysis without emitting build assets:
`npx tsc --noEmit`

## App Router & Components

- Always place pages, layouts, and route handlers in the `app/` directory.
- Use Server Components by default. Include the `"use client"` directive only when interactive features (e.g., hooks like `useState`, `useEffect`, or client-only libraries) are required.
- Use Next.js built-in components like `<Image />` (`next/image`) for optimized asset delivery.
