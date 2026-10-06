# Review, feat/coding-standards-and-tooling, 2026-10-07

**Reviewed by**: sonnet, inline (not a contrasting model; shares author-family blind spots) (author model not confirmed)
**Scope**: 13 files (excluding lockfile 12), branch vs main (`git diff origin/main...HEAD`)
**Verdict**: Approve with nits

## Summary
Adds a Clerk proxy matcher entry, AGENTS.md/CLAUDE.md context files plus a scope doc, removes `typescript.ignoreBuildErrors`, and adds Vitest with time util tests. `npx tsc --noEmit` is clean on the branch, so un-ignoring build errors is safe today. No secrets found in the diff. Headline issues are doc claims that are wrong at merge time, and a matcher entry that is inert in this Clerk version.

## Minor
### 🟡 `/__clerk/:path*` matcher is correct in form but inert, `src/middleware.ts:9`
**Problem**: Clerk 6.32.2 documents `/__clerk` only as a relative `proxyUrl` value (`node_modules/@clerk/types/dist/index.d.ts:9188`). No `proxyUrl` is set anywhere in `src` or `next.config.ts`, and `node_modules/@clerk/nextjs/dist/esm` contains no `/__clerk` handling. The entry does add coverage: the first matcher (line 7) excludes paths containing `.js` etc., so `/__clerk/.../clerk.browser.js` would skip middleware without it.
**Why it matters**: Dead config today; harmless. Unverified whether a later Clerk version proxies in middleware.
**Suggested fix**: Keep it only if a proxy is planned (then set `proxyUrl` too); otherwise drop it or add a comment saying why.

### 🟡 Docs ship two false claims, `AGENTS.md:30-31` and `AGENTS.md:56`
**Problem**: Says "none yet, there is no test runner" and that `next.config.ts` sets `ignoreBuildErrors`. Both are contradicted by commit fa5642e in this same PR (`package.json` test script, `next.config.ts` diff). AGENTS.md also still tells people to run `npx tsc --noEmit` instead of the new `npm run typecheck`.
**Why it matters**: Agents and people will skip tests or distrust the build because of it. Stated as scheduled for /sync; flagging only because it is wrong the moment this merges.
**Suggested fix**: Edit the three lines in this PR, or merge and run /sync immediately.

### 🟡 Wrong claim: assistant_config.json is "git ignored", `src/components/voice/AGENTS.md:27`
**Problem**: `.gitignore:64` lists `/assistant_config.json`, but the file is tracked (`git ls-files` returns it; blob eeac686, commit e6949c2), so the ignore does nothing.
**Why it matters**: The doc says it is local only; it is committed. Content grep found no keys (only `isServerUrlSecretSet: false` at line 167).
**Suggested fix**: Reword to "listed in .gitignore but already tracked", or `git rm --cached` it (separate change).

### 🟡 UTC test cannot detect a local-time regression on a UTC machine, `src/lib/utils/time.test.ts:40-44`
**Problem**: `formatStoredAppointmentDate` test uses 23:30Z; an implementation using local getters gives the same answer when TZ is UTC, and differs only in zones ahead of UTC.
**Why it matters**: Test name claims more than it proves in CI (Linux UTC).
**Suggested fix**: Set `process.env.TZ` (or `vi.stubEnv`) to `Asia/Kolkata` in that test, or use `test.env`.

### 🟡 Node floor not declared, `package.json:72-82`
**Problem**: Vitest 5.0.3 requires node `^22.12 || ^24 || >=26` (`node_modules/vitest/package.json` engines) and `@types/node` is now ^24, but no `engines` or `.nvmrc` exists.
**Why it matters**: CI or hosting on Node 20 fails `npm test`; types allow Node 24-only APIs that would fail at runtime.
**Suggested fix**: Add `"engines": {"node": ">=22.12"}` and align CI/hosting (unverified what CI uses; no `.github` found).

## Nits
- ⚪ `src/lib/utils/time.test.ts` has no cases for relative dates ("today", weekday names), or invalid time input (e.g. "25:00"); `src/lib/utils/time.ts:84-127`.
- ⚪ `vitest.config.mts` includes only `*.test.ts`; `.test.tsx` will be silently skipped.

## Strengths
- Time test expectations all match `time.ts` by trace (e.g. "14:00 PM" via `time.ts:12-15`, "three pm" via `time.ts:51-63`, 12 am/pm via `time.ts:31-32`); 13/13 pass.
- Removing `ignoreBuildErrors` with a clean `tsc` is a real quality gain.
- voice/prisma AGENTS.md claims spot-checked true: plain `===` and dev bypass at `src/lib/auth.ts:32-46`, `vapi-prompt.ts` unimported, `@@map` lowercase tables at `prisma/schema.prisma:21,40,54,77`.

## Test coverage
Tests configured. Only `time.ts` covered (4 of ~9 exports). Branching in `toCanonicalTime` is well exercised; date parsing branches beyond ISO are untested.
