# DentWise (becoming a multi hospital AI front desk)

## Stack

- **Language / Runtime**: TypeScript (strict), Node
- **Framework**: Next.js 15 App Router with Turbopack, React 19
- **Key dependencies**: Prisma 6 on Supabase Postgres, Clerk 6 (`@clerk/nextjs`), Vapi web SDK, Resend with react email, TanStack Query
- **UI**: Tailwind 4, shadcn (new york style) in `src/components/ui`
- **Package manager**: npm

## Build approach

<TBD, set by /scope>

## Commands

```bash
# Install
npm install

# Dev server (http://localhost:3000)
npm run dev

# Build (runs prisma generate first)
npm run build

# Lint, then format (Biome, not ESLint or Prettier)
npm run lint; npm run format

# Type check (the build does NOT catch type errors, see Rules)
npx tsc --noEmit

# Test
# none yet, there is no test runner or test script
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`.

## Rules

- Import with the `@/` alias, which maps to `src/`.
- Data access lives in server actions under `src/lib/actions` (`"use server"`), with shared logic in `src/lib/services`. Client components reach them only through TanStack Query hooks in `src/hooks`.
- Guard every server action with `requireAuth()` or `requireAdmin()` from `src/lib/auth.ts`. Admin means the Clerk email equals `ADMIN_EMAIL`.
- Use the single Prisma client from `src/lib/prisma.ts`; never create another `PrismaClient`.
- `next.config.ts` sets `ignoreBuildErrors` and `ignoreDuringBuilds`, so a green build proves nothing about types. Run `npx tsc --noEmit` and `npm run lint` before you call work done.
- Secrets live in `.env.local` (git ignored by `.env*`). Put each comment on its own line there: `prisma.config.ts` parses the file itself and reads an inline `# comment` as part of the value. URL encode special characters in `DATABASE_URL` (for example `@` becomes `%40`).
- Clerk is v6: use `SignedIn` and `SignedOut`, there is no `Show` component. `src/middleware.ts` runs `clerkMiddleware()`.
- Biome formats with 2 space indents and skips `src/components/ui`; leave generated shadcn files as they are.

## Git

- integration: on
- branch prefix: feat/
- commit: per-milestone

## Context files

- [src/components/voice/AGENTS.md](src/components/voice/AGENTS.md): the Vapi voice assistant, its client side tools and the server tool webhook
- [prisma/AGENTS.md](prisma/AGENTS.md): schema, migrations that drifted from it, and the bootstrap SQL

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
