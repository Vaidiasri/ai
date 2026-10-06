# Database (Prisma)

## Overview

Prisma 6 schema for Supabase Postgres: `User`, `Doctor`, `Clinic`, `Appointment`. Tables are mapped to lowercase plural names (`users`, `doctors`, `clinics`, `appointments`) with `@@map`.

## Key files

| File | Owns |
| --- | --- |
| `prisma/schema.prisma` | The source of truth for the data model |
| `prisma/migrations/` | Two migrations, out of step with the schema (see Gotchas) |
| `prisma/init.sql` | Hand written bootstrap SQL for a fresh database |
| `prisma.config.ts` | Loads `.env.local` then `.env` with its own parser before Prisma runs |
| `scripts/migrate-appointment-times.js` | Data fix run before `prisma migrate deploy` by `npm run db:migrate` |
| `scripts/seed-doctors.js` | Seeds sample doctors |

## Commands

```bash
# Push the schema straight to the database (what works today)
npm run db:push

# Apply migrations (runs the time data fix first)
npm run db:migrate

# Regenerate the client after a schema change
npx prisma generate
```

## Conventions

- Change `schema.prisma`, then regenerate the client. Import types from `@prisma/client`.
- A partial unique index on appointments blocks double booking a doctor slot. Keep it when you touch appointments.

## Gotchas

- The migrations have drifted: the init migration creates PascalCase tables (`"User"`) with no clinics, while the schema maps to lowercase tables. Do not run `prisma migrate dev` on a real database without first fixing the history (baseline or a fresh init).
- The Supabase direct host (`db.<ref>.supabase.co:5432`) is IPv6 only. On an IPv4 network use the Supabase Session pooler connection string instead.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
