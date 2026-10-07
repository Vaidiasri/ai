# 0001. Database connection and migration baseline

**Date**: 2026-10-07
**Status**: In Progress

## Summary

The app now reaches Supabase through the Session pooler (a shared entry point that works on IPv4 networks), and the broken migration history is replaced with a fresh one built from `schema.prisma`. After this, migrations are the only way to build or change the database, and one command proves a migrated database matches the schema. Every later data change (multi clinic tenancy first) ships as a normal migration on top of this baseline.

## Context

- The Supabase direct host (`db.<ref>.supabase.co:5432`) is IPv6 only. This network is IPv4, so the app cannot reach the database at all. The project is zero spend, which rules out Supabase's paid IPv4 add on.
- The migration history does not describe the schema. `20260212100758_init` creates PascalCase tables (`"User"`, `"Doctor"`, `"Appointment"`), no `clinics` table, and a three value `AppointmentStatus` enum. `schema.prisma` maps to lowercase tables (`users`, `doctors`, `clinics`, `appointments`), has a four value enum (`COMPLETED` added) and five appointment indexes. `20260527120000_appointment_slot_unique` targets `"appointments"`, a table the init migration never creates, so a fresh `migrate deploy` fails.
- Three side channels let the drift happen and keep it alive: `npm run db:push` (writes the schema straight to the DB), `prisma/init.sql` (hand written bootstrap SQL with yet another enum), and `scripts/migrate-appointment-times.js` (a legacy row fixer chained before every deploy).
- The live database is empty (checked 2026-10-07: no tables in `public`). Nothing has to be preserved.
- Prisma is 6.16. Partial indexes are not expressible in a Prisma 6 schema (they arrived in 7.4 as a preview), so the no double booking index must live in raw migration SQL.

## Requirements

**User stories**:
- As the engineer, I want the app to reach Supabase from my IPv4 network so I can run and test it locally.
- As the engineer, I want a database built from migrations to equal the schema so every future change ships as one clean migration.
- As a patient, I want my account saved on first sign in so my bookings attach to me.

**Acceptance criteria**:
- **AC-1**: With `DATABASE_URL` set to the Supabase Session pooler URL (port 5432), `npx prisma migrate status` connects from this network and, after AC-2, reports the database schema is up to date.
- **AC-2**: On an empty database, `npm run db:migrate` builds the tables `users`, `doctors`, `clinics`, `appointments`, the enums `Gender` and `AppointmentStatus` (`PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`), every index and unique constraint in `schema.prisma`, and the partial unique index `appointments_doctorId_date_time_active_key`, using only files in `prisma/migrations/`.
- **AC-3**: `npm run db:check` exits 0 against a database built by AC-2. It exits 1 when the database differs from `schema.prisma` in any way other than the allowed partial slot index statement, or when the slot index is missing or its definition differs (proved by planting a drift, for example dropping `appointments_date_idx`, then restoring it). It exits 2 when it cannot run the comparison (bad URL, no connection), never 0.
- **AC-4**: Signing in to the running app with a Clerk account that has no row yet creates exactly one `users` row with that `clerkId` and email. Signing in again creates no second row.
- **AC-5**: Inserting a second appointment with status other than `CANCELLED` for the same `doctorId`, `date` and `time` fails with a unique violation. The same slot can be booked again when the earlier appointment is `CANCELLED`.
- **AC-6**: `npm run db:seed` inserts the five sample doctors into the migrated database. Running it a second time succeeds and leaves five doctors.
- **AC-7**: `prisma/init.sql`, `scripts/migrate-appointment-times.js` and the `db:push` and `db:migrate-times` scripts are gone, and no file outside `docs/` references them (`prisma/AGENTS.md` and `README.md` included).

## Options considered

### Option 1: Fresh init migration (squash)

Replace the init migration's SQL with SQL generated from `schema.prisma`, keep the slot index migration as the second step.

**Pros**: history equals the schema from step one; smallest diff; no replay of broken steps.
**Cons**: only safe because the database is empty; rewrites a migration that was already in git.

### Option 2: Corrective migration on top

Keep both migrations and add a third that renames tables, adds `clinics`, fixes the enum and adds indexes.

**Pros**: never rewrites existing history.
**Cons**: a fresh DB still fails at migration two (it targets a table migration one never creates), so the old files need editing anyway; three files to read to understand one schema.

### Option 3: Baseline with `migrate resolve`

Generate an init from the schema and mark it applied on the live DB without running it.

**Pros**: the right tool when a live DB holds real data.
**Cons**: there is no data to protect here; the live DB has no tables, so marking a migration applied would lie.

## Decision

**Chosen option**: Option 1: Fresh init migration.

Connect through the Session pooler, regenerate `20260212100758_init/migration.sql` from `schema.prisma`, keep `20260527120000_appointment_slot_unique` unchanged, delete the drift side channels, and add `db:check` and `db:seed`.

## Rationale

The database is empty, so the only cost of rewriting history (breaking a database that already applied it) does not exist. Option 2 does not even work without editing old files, and Option 3 solves a data preservation problem the project does not have. Keeping the folder name `20260212100758_init` keeps the ordering before the slot index migration with zero renames.

Session pooler for everything, over Transaction pooler plus `directUrl`: one env var, works on IPv4, supports migrations and prepared statements, and the traffic is one developer plus preview deploys. Transaction mode is the scale up path when concurrent serverless connections exhaust the session pool.

Staying on Prisma 6 and allowing the one known index in the drift check, over upgrading to Prisma 7.4: the upgrade changes the generator and adds driver adapters, a feature on its own, and is not needed to get a trustworthy baseline.

## Feature design

**Data model**: unchanged. `schema.prisma` as it stands is the target; this feature changes no model.

| Table | Primary key | Foreign keys | Unique | Indexes |
|---|---|---|---|---|
| `users` | `id` (cuid) | | `clerkId`, `email` | |
| `doctors` | `id` | `clinicId` → `clinics.id` (N:1, nullable) | `email` | |
| `clinics` | `id` | | `googlePlaceId` | |
| `appointments` | `id` | `userId` → `users.id`, `doctorId` → `doctors.id` (N:1, cascade delete) | partial: (`doctorId`, `date`, `time`) where `status <> 'CANCELLED'` (raw SQL) | (`doctorId`,`date`,`time`), `date`, `doctorId`, `status`, `userId` |

**Command surface** (the "API" of this feature is npm scripts):

| Script | Runs | Needs | Exit |
|---|---|---|---|
| `db:migrate` | `prisma migrate deploy` | `DATABASE_URL` | 0 applied, non zero on failure |
| `db:check` | `node --env-file=.env.local scripts/db-check.js` | `DATABASE_URL` | 0 no drift, 1 drift (prints what differs), 2 could not compare |
| `db:seed` | `node --env-file=.env.local scripts/seed-doctors.js` | `DATABASE_URL`, migrated DB | 0 seeded, non zero on failure (existing `catch` exits 1) |
| removed | `db:push`, `db:migrate-times` | | |

Plain `node` does not read `.env.local` (Prisma Client 6 only loads `.env` itself, and `prisma.config.ts` only affects the CLI), hence `--env-file` (Node 20.6+, safe under cmd.exe). npm script text uses no quotes and no `$VAR`.

**`scripts/db-check.js` behaviour**:
1. Spawn Prisma without a shell: `execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel", "prisma/schema.prisma", "--script"])`. Spawning `npx` fails on Windows (it is a `.cmd` file). If the child exits non zero, print its stderr and exit 2.
2. Split stdout on `/\r?\n/`, trim each line, drop empty lines and `--` comments, and drop lines matching `/^DROP INDEX "appointments_doctorId_date_time_active_key";$/`. Anything left is drift: print it, exit 1.
3. With `@prisma/client`, read `select indexdef from pg_indexes where indexname = 'appointments_doctorId_date_time_active_key'`. Missing, or not containing both `UNIQUE` and `WHERE (status <> 'CANCELLED'`: print it, exit 1. A query error exits 2. This makes the step 2 exception safe: the index is proved present and correct, not just ignored.
4. Otherwise exit 0.

At build time, run the diff once against the migrated DB and paste its real output into a comment at the top of the script, so the allowed line is a verified fact, not a guess. If Prisma 6 does not report the partial index at all, the step 2 filter stays harmless and step 3 still guards the index.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| any DB command, app runtime | connection target | `DATABASE_URL` in `.env.local` (local) or Vercel env (deploys) |
| init migration SQL | tables, enums, indexes | generated by `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` |
| slot index | its definition | existing `20260527120000_appointment_slot_unique/migration.sql`, unchanged |
| `db:check` | drift / no drift | live DB introspection vs `schema.prisma`, minus the one allowed statement |
| user row (AC-4) | `clerkId`, email, names, phone | Clerk `currentUser()` via existing `syncUser()` in `src/lib/actions/users.ts`; test account = a new sign up on the Clerk development instance in `.env.local` |
| slot check (AC-5) | a user, a doctor, two appointments | created by `scripts/check-slot-index.js` inside `prisma.$transaction`, rolled back by a thrown sentinel error, so nothing persists |
| seed rows (AC-6) | five doctors | the literal list in `scripts/seed-doctors.js`, upserted by email |

**Key invariants**:
- `prisma/migrations/` is the only way a schema change reaches a database. No `db push`, no hand SQL.
- The partial slot index exists on every migrated database (AC-5).
- `prisma migrate dev` is the way to author the next migration; it must not propose dropping the slot index. If it does, delete that `DROP INDEX` line from the generated SQL before committing.

**Security model**: no change to who can read or write what. The connection string carries the DB password: it lives only in `.env.local` (git ignored) and Vercel env, URL encoded, never in a tracked file, commit or log.

**Configuration required**:
- `DATABASE_URL`: changes from the direct host to the Session pooler, `postgresql://postgres.<ref>:<url-encoded-password>@<pooler-host>:5432/postgres?sslmode=require`. Copy the pooler host from Supabase Connect (it can be `aws-0-…` or `aws-1-…`; do not assume). Local value already set on 2026-10-07. On Vercel, append `&connection_limit=1` so each serverless instance holds one session (runner up: no limit, which can exhaust the free tier session pool under preview traffic).

**Critical test scenarios**:
- Happy path: empty DB → `db:migrate` → `migrate status` up to date → `db:check` exit 0 → `db:seed` → sign in on `npm run dev` → one `users` row. Verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-6**.
- Failure case: drop `appointments_date_idx` by hand → `db:check` exit 1 naming it → recreate it → exit 0. Verifies **AC-3**.
- Failure case: two active bookings for one slot → second fails; cancel first → rebook succeeds. Verifies **AC-5**.
- Idempotency: sign in twice, seed twice → still one user row, five doctors. Verifies **AC-4**, **AC-6**.

## Build plan

Journey approach: one path, empty database to a signed in user with bookable doctors, completed in order.

1. Regenerate `prisma/migrations/20260212100758_init/migration.sql` from `schema.prisma` (`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`). Review the output: four lowercase tables, both enums with `COMPLETED`, `appointments.status DEFAULT 'CONFIRMED'`, `updatedAt DEFAULT CURRENT_TIMESTAMP` on users, doctors and appointments (none on clinics), all schema indexes. Leave the slot index migration and `migration_lock.toml` untouched. Satisfies **AC-2**.
2. Delete `prisma/init.sql` and `scripts/migrate-appointment-times.js`. In `package.json`, remove `db:push` and `db:migrate-times`, set `db:migrate` to `prisma migrate deploy`, add `db:seed` and `db:check`. Update `prisma/AGENTS.md` and `README.md` so neither mentions the removed files or scripts, and both document `db:check`, `db:seed` and the slot index rule for `migrate dev`. Satisfies **AC-7**.
3. Add `scripts/db-check.js` as described in Feature design. Satisfies **AC-3**.
4. Run `npm run db:migrate` against the empty Supabase DB, then `npx prisma migrate status`. Satisfies **AC-1**, **AC-2**.
5. Run the raw diff once and paste its output into the `db-check.js` header comment. If `--from-schema-datasource` does not resolve the URL, switch the spawn to `--from-url` with `process.env.DATABASE_URL`. Then run `npm run db:check` (expect 0), the planted drift round trip (expect 1, then 0), and once with a broken URL (expect 2). Satisfies **AC-3**.
6. Run `npm run db:seed` twice and count doctors. Satisfies **AC-6**.
7. Add and run `scripts/check-slot-index.js` (`node --env-file=.env.local`): in one `prisma.$transaction`, create a user and a doctor, book a slot, assert a second active booking fails with P2002, cancel the first, assert a rebook succeeds, then throw a sentinel error so everything rolls back. Exit 0 on pass. Satisfies **AC-5**.
8. Start `npm run dev`, sign up a new user on the Clerk dev instance, confirm one `users` row; sign in again, still one. Satisfies **AC-4**.
9. Engineer action: set Vercel `DATABASE_URL` to the pooler URL plus `&connection_limit=1`, then confirm a preview deploy loads `/`. Satisfies **AC-1** for deploys.

## Consequences

**Positive**:
- The app runs locally for the first time against the real database.
- Any fresh database (a teammate, a new Supabase project, CI later) builds from `npm run db:migrate` alone.
- Drift is detectable in one command instead of discovered by a failed deploy.

**Negative / tradeoffs**:
- The init migration was rewritten. Any database that applied the old one (none known) would need a reset.
- `db:check` carries one hand maintained exception for the partial index until Prisma 7.4.
- Session mode holds one pooled connection per client. Under real concurrent serverless traffic the free tier pool runs out; moving to the Transaction pooler is then a config change plus `?pgbouncer=true`.
- No quick `db push` for experiments; every change goes through `migrate dev`.
- With `connection_limit=1` on Vercel, parallel queries inside one request (`Promise.all`) run one after another. Fine at current traffic.
- `migrate deploy` through the pooler can fail with an advisory lock timeout (P1002) if another session holds the lock. It is safe to retry.

**Neutral**:
- Migrations run by hand before merging a schema change; the Vercel build does not touch the DB.
- `scripts/seed-doctors.js` keeps its own `PrismaClient`; the single client rule in `AGENTS.md` covers app code under `src/`.

## Follow-up

- [ ] Rotate the Supabase database password: it was pasted into chat on 2026-10-07. Then update `.env.local` and Vercel.
- [ ] `/sync`: set root `AGENTS.md` Build approach to Journey and add `db:check` to its pre done command list.
- [ ] `syncUser()` swallows errors (`src/lib/actions/users.ts`). A Clerk account whose email already belongs to another `clerkId` fails the upsert silently and gets no row. Handle it in the auth or tenancy work.
- [ ] Later: run `db:check` in CI once there is a disposable database for it.
- [ ] Later: upgrade to Prisma 7.4+ and declare the partial index in the schema, then drop the `db:check` exception.
- [ ] `doctors.clinicId` has no index. Add one in the multi clinic tenancy feature, which reshapes clinic relations anyway.
