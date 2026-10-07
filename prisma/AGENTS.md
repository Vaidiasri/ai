# Database (Prisma)

## Overview

Prisma 6 schema for Supabase Postgres: `User`, `Doctor`, `Clinic`, `Appointment`. Tables are mapped to lowercase plural names (`users`, `doctors`, `clinics`, `appointments`) with `@@map`.

## Key files

| File | Owns |
| --- | --- |
| `prisma/schema.prisma` | The source of truth for the data model |
| `prisma/migrations/` | The only way a schema change reaches a database (spec 0001) |
| `prisma.config.ts` | Loads `.env.local` then `.env` with its own parser before Prisma runs |
| `scripts/db-check.js` | Drift check: live database vs `schema.prisma`, plus the slot index |
| `scripts/seed-doctors.js` | Seeds five sample doctors, upserted by email |

## Commands

```bash
# Apply migrations
npm run db:migrate

# Prove the database matches the schema (0 clean, 1 drift, 2 could not compare)
npm run db:check

# Seed sample doctors (safe to run twice)
npm run db:seed

# Author the next migration after changing schema.prisma
npx prisma migrate dev --name <change>
```

## Conventions

- Change `schema.prisma`, then `npx prisma migrate dev`. Never `prisma db push` and never hand SQL against a shared database.
- A partial unique index (`appointments_doctorId_date_time_active_key`) blocks double booking a doctor slot. Prisma 6 cannot express it in the schema, so it lives in raw SQL in `20260527120000_appointment_slot_unique`. If `migrate dev` generates `DROP INDEX "appointments_doctorId_date_time_active_key"`, delete that line before committing.
- Plain `node` scripts do not read `.env.local`; run them with `node --env-file=.env.local`.

## Gotchas

- The Supabase direct host (`db.<ref>.supabase.co:5432`) is IPv6 only. Use the Session pooler URL (port 5432) for `DATABASE_URL`.
- `migrate deploy` through the pooler can fail with P1002 (advisory lock timeout). Retry it.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
