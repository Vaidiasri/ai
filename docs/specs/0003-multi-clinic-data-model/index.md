# 0003. Multi clinic data model with app enforced isolation

**Date**: 2026-10-07
**Status**: In Progress

## Summary

Many clinics will share one app and one database, so every piece of patient and clinic data gets a `clinicId` (the clinic that owns it). A scoped Prisma client (a database client locked to one clinic) adds that id to every query and write by itself, so a forgotten filter cannot leak data. A patient keeps one login, but each clinic holds its own patient record, and clinics never see each other's. Today's data moves into a Demo Clinic, so the live site keeps working the same day.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Requirements

**User stories**:
- As a clinic owner, I want my doctors, patients and appointments visible only to my clinic, so that patient data stays private.
- As a patient, I want one login that works at any clinic, so that I don't sign up again everywhere.
- As a receptionist, I want to book for a walk in caller with no account, so that phone bookings still work.
- As the platform operator, I want to create, suspend and restore clinics without seeing patient data, so that I stay out of health data.

**Acceptance criteria**:
- **AC-1**: With two clinics (A and B) each holding a branch, a doctor, a patient record and an appointment, every read through clinic A's scoped client returns only clinic A rows, for every clinic owned model.
- **AC-2**: Writes through a scoped client stamp `clinicId` automatically. A row that points at another clinic's doctor, branch or patient record is rejected by the database (composite foreign key), even if app code passes the wrong id.
- **AC-3**: No unscoped path exists: a test fails when a file outside the allowlist imports the base Prisma client or uses `$queryRaw` / `$executeRaw`, and when a model with a `clinicId` column is missing from the scoped client's model list.
- **AC-4**: After the migration, a Demo Clinic (slug `demo`) with one branch exists; every existing doctor and appointment belongs to it; every user with an appointment has one Demo patient record; the `ADMIN_EMAIL` user is a Demo `OWNER`; `npm run db:check` is clean; the booking form, voice booking, doctor list, admin page and patient dashboard work as before against Demo.
- **AC-5**: A signed in user's first booking at a clinic creates exactly one patient record for (clinic, user); later bookings reuse it; another clinic cannot read it.
- **AC-6**: A patient record can exist with no login (`userId` null). Phone is not unique within a clinic. A record is linked to a login only by a staff action (role `OWNER` or `RECEPTIONIST` of that clinic), never automatically.
- **AC-7**: A signed in patient's dashboard lists their own appointments across all clinics, each labeled with the clinic name, and nothing belonging to anyone else.
- **AC-8**: The platform admin (`ADMIN_EMAIL`) can list, create, suspend and restore clinics and sees per clinic counts only. No platform admin function returns patient record or appointment fields.
- **AC-9**: A suspended clinic's slug resolves as "not available", its members are refused, and no booking can be made there. Restoring it within 30 days brings everything back unchanged.
- **AC-10**: A daily cron deletes every clinic suspended more than 30 days ago, with all its clinic owned rows. It returns 401 without the right `CRON_SECRET`, leaves clinics suspended under 30 days untouched, and running it twice is harmless.
- **AC-11**: Clinic membership is unique per (clinic, user) with role `OWNER`, `DOCTOR` or `RECEPTIONIST`; `requireClinicMember` refuses non members and members without an allowed role.
- **AC-12**: Specialties come from one global catalog (unique slug, English name, optional Hindi name). Every doctor has a `specialtyId`, each clinic lists the specialties it offers, and the doctor search by speciality matches the catalog name.

## Decision

**Chosen option**: Option 1: shared tables with `clinicId` on every clinic owned row, enforced by a scoped Prisma client extension plus composite foreign keys.

One database, one schema; isolation lives in a single tenancy module (`src/lib/tenancy.ts`) that every clinic data access goes through, with the database itself refusing cross clinic references.

## Feature design

**Data model** (target; Prisma model names, tables mapped lowercase plural as today):

| Entity | Scope | Fields | Keys and rules |
|---|---|---|---|
| `User` (existing, unchanged columns) | global | clerkId, email, firstName?, lastName?, phone? | gains relations to `ClinicMember[]`, `ClinicPatient[]`; loses `appointments` |
| `Specialty` (new) | global | id, slug, name, nameHi? | `slug` unique |
| `Clinic` (reshaped) | tenant root | id, slug, name, status `ClinicStatus`, suspendedAt?, createdAt, updatedAt | `slug` unique; drops `latitude`, `longitude`, `googlePlaceId`, `isPartner` |
| `Branch` (new) | clinic owned | id, clinicId, name, address, city, latitude, longitude, timezone (default `Asia/Kolkata`), isActive (default true), timestamps | `@@unique([id, clinicId])`, index `clinicId` |
| `ClinicMember` (new) | clinic owned | id, clinicId, userId, role `ClinicRole`, createdAt | `@@unique([clinicId, userId])` |
| `ClinicSpecialty` (new) | clinic owned | clinicId, specialtyId | `@@id([clinicId, specialtyId])` |
| `Doctor` (reshaped) | clinic owned | adds clinicId (required), branchId, specialtyId, userId?; keeps name, email, phone, bio?, imageUrl, gender, isActive | drops `speciality` text and global unique on `email`; `@@unique([clinicId, email])`, `@@unique([id, clinicId])`; FK (branchId, clinicId) → Branch(id, clinicId) |
| `ClinicPatient` (new) | clinic owned | id, clinicId, userId?, name, phone? (E.164), timestamps | `@@unique([clinicId, userId])` (Postgres allows many nulls), index (clinicId, phone), `@@unique([id, clinicId])` |
| `Appointment` (reshaped) | clinic owned | adds clinicId, branchId, clinicPatientId; drops userId; rest unchanged | FKs (doctorId, clinicId) → Doctor, (branchId, clinicId) → Branch, (clinicPatientId, clinicId) → ClinicPatient; slot index unchanged; index `clinicId` |

Enums: `ClinicStatus { ACTIVE, SUSPENDED }`, `ClinicRole { OWNER, DOCTOR, RECEPTIONIST }`.

**Delete rules** (`onDelete`):

- `clinicId` → `Clinic.id` on every clinic owned table: `Cascade` (the purge deletes only `Clinic` rows; children go with them).
- Appointment → Doctor, Branch, ClinicPatient and Doctor → Branch (composite FKs): `Restrict`. A doctor with appointments is deactivated (`isActive = false`), never deleted; the existing delete doctor action returns "has appointments, deactivate instead". This replaces today's `Appointment → Doctor` Cascade.
- Never `SetNull` on a composite FK (Postgres would null `clinicId` too).
- `ClinicPatient.userId` → User: `SetNull` (the clinic keeps its history if a login is deleted). `ClinicMember.userId` → User: `Cascade`. `Doctor.userId` → User: `SetNull`.
- `ClinicSpecialty` → Specialty: `Restrict`; `Doctor.specialtyId` → Specialty: `Restrict`.

`ClinicPatient.phone` is nullable because `User.phone` is usually empty (Clerk phone is off for India); staff screens (Features 8, 18) require it for walk ins.

**State transitions** (Clinic): `ACTIVE → SUSPENDED` (platform admin, sets `suspendedAt`) · `SUSPENDED → ACTIVE` (platform admin restore, clears `suspendedAt`) · `SUSPENDED` for over 30 days → deleted by the purge cron. Feature 7 may add an onboarding state.

**Tenancy module** (`src/lib/tenancy.ts`, the only place that builds clinic access):
- `CLINIC_OWNED_MODELS`: `Branch`, `ClinicMember`, `ClinicSpecialty`, `Doctor`, `ClinicPatient`, `Appointment`.
- `forClinic(clinicId)`: `prisma.$extends` query extension. For those models: `findUnique*`, `findFirst*`, `findMany`, `count`, `aggregate`, `groupBy`, `update`, `updateMany`, `delete`, `deleteMany` get `clinicId` ANDed into `where` (Prisma 5+ accepts extra filters on unique `where`); `create`, `createMany`, `createManyAndReturn`, `upsert` get `clinicId` set in data (an explicit different `clinicId` throws). Any other operation on a clinic owned model throws, so a new Prisma operation fails closed. Other models pass through. Rows loaded through `include` / `select` are not filtered by the extension; they stay inside the clinic only because of the composite FKs, so never `include` a clinic owned relation from a global model (`User`, `Specialty`) in scoped code. Step 2 tests cover interactive `$transaction` on the extended client.
- `requireClinicMember(roles?)`: Clerk user → `User` → `ClinicMember` for the active clinic. Active clinic: the `clinic` cookie only if it matches one of the user's memberships; else the user's only membership; else (several and no valid cookie) refuse with "choose a clinic" (switcher UI is Feature 8). Refuses non members, wrong roles, and suspended clinics. Returns `{ clinicId, role, db }`.
- `clinicBySlug(slug)`: public resolver; `null` for unknown or suspended. Returns `{ clinic, db }`. Every patient and public path (booking, doctor list, Vapi tools) gets its clinic through this, never by reading `DEMO_CLINIC_SLUG` into a query directly, so suspension applies everywhere.
- `DEMO_CLINIC_SLUG = "demo"`: interim pin for today's patient flows until Feature 10 adds `/c/<slug>`. `suspendClinic` refuses the Demo clinic until then.
- `getOrCreateClinicPatient(db, user)`: `upsert` on (clinicId, userId), outside the booking slot P2002 handling, so two parallel first bookings neither fail nor report "slot taken".

**Unscoped allowlist** (the only files that may import `@/lib/prisma` or run raw SQL): `src/lib/prisma.ts`, `src/lib/tenancy.ts`, `src/lib/services/patient-self.ts` (patient's own cross clinic reads, filtered by `ClinicPatient.userId`), `src/lib/actions/platform.ts` (platform admin), `src/lib/actions/users.ts` and `src/lib/actions/user.ts` (global `User` sync), `src/app/api/cron/purge-clinics/route.ts`, `src/lib/services/doctors.ts` (its raw location query must filter `d."clinicId" = ${clinicId}` explicitly), `scripts/**`. Adding a file needs a spec or review note. The static test scans static `import` and `import()` strings; anything cleverer is caught in review.

**API surface** (server actions and routes):

| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `bookAppointment` (existing) | action | doctorId, date, time, reason? | appointment | signed in; clinic = Demo | slot taken, clinic not available |
| `getUserAppointments`, `getUserAppointmentStats` (existing) | action | none | own appointments across all active clinics, with clinicName; stats count across those clinics; suspended clinics hidden | signed in | none |
| `getAppointments`, `updateAppointmentStatus`, doctor actions (existing admin) | action | as today | as today, Demo only | `requireClinicMember(["OWNER"])` on Demo | not a member |
| `getAvailableDoctors` (existing) | action | lat?, long?, speciality? | `PublicDoctor` (drops `isPartner`, adds `branchName`) | public | none |
| `linkPatientToUser` | action (no UI yet) | clinicPatientId, userId | patient record | member, `OWNER` or `RECEPTIONIST` | not found in clinic, user already linked here |
| `listClinics` | action | none | id, slug, name, status, suspendedAt, counts of branches, doctors, patients, appointments | platform admin | none |
| `createClinic` | action | name, slug, ownerEmail, first branch (name, address, city, lat, long) | clinic | platform admin | slug taken or invalid, owner email has no user |
| `suspendClinic`, `restoreClinic` | action | clinicId | clinic status | platform admin | wrong state, Demo cannot be suspended |
| `GET /api/cron/purge-clinics` | route | `Authorization: Bearer CRON_SECRET` | `{ purged: n }` | Vercel Cron secret, compared with `safeEqual` from `src/lib/vapi-auth.ts`; refused when `CRON_SECRET` is unset | 401 |
| Vapi tools (existing) | webhook tool | as today | as today | spec 0002 call token; clinic from `clinicBySlug(DEMO_CLINIC_SLUG)`; caller's patient record via `getOrCreateClinicPatient` from the token's Clerk user | as today, plus clinic not available |

`createClinic` runs in one transaction: the clinic (status `ACTIVE`), its first branch, and an `OWNER` `ClinicMember` for the `User` whose email equals `ownerEmail`. It adds no `ClinicSpecialty` rows; the clinic's specialty list is managed in Feature 7 onboarding.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| any scoped read or write | clinicId | `requireClinicMember` (membership), `clinicBySlug` (URL slug), or `DEMO_CLINIC_SLUG` (interim) |
| booking | clinicPatientId | find or create `ClinicPatient` by (clinicId, user.id) |
| new ClinicPatient from a login | name | `User.firstName + lastName` trimmed, else the email part before `@` (the whole email if there is no `@`); copied once, not kept in sync |
| new ClinicPatient from a login | phone | `User.phone` (may be null) |
| booking | branchId | `Doctor.branchId` of the chosen doctor |
| confirmation email | patient email | `ClinicPatient.user.email`; no email when unlinked |
| patient dashboard | clinicName | `Appointment.clinic.name` |
| PublicDoctor | speciality, branchName | `Specialty.name`, `Branch.name` |
| doctor search by speciality | match | `Specialty.name ILIKE '%term%'` |
| public doctor list | which doctors | `isActive` doctors of the clinic from `clinicBySlug` (so suspended clinics show none) |
| clinic offers a specialty | `ClinicSpecialty` rows | migration: one Demo row per specialty used by a Demo doctor; later clinics: Feature 7. A doctor's specialty must be in the clinic's list: app rule in the doctor actions, not an FK |
| purge result | purged | number of `Clinic` rows deleted in this run |
| location search | distance | `Branch.latitude` / `longitude` (moved from `Clinic`) |
| listClinics counts | counts | `_count` on the clinic's relations |
| purge | cutoff | `now() - 30 days` vs `Clinic.suspendedAt` |
| platform admin check | is admin | Clerk primary email equals `ADMIN_EMAIL` (unchanged) |

**Key invariants**:
- Every clinic owned row has a non null `clinicId`, and every reference between clinic owned rows stays inside one clinic (composite FKs).
- Clinic owned models are read and written only through `forClinic` (or the allowlist), and nested writes never create clinic owned children (the extension cannot see them; the composite FKs still catch a mismatch).
- One `ClinicPatient` per (clinic, user); one `ClinicMember` per (clinic, user).
- `Specialty` and `User` are the only global tables holding people or catalog data; neither holds health details.

**Security model**:
- Compliance scope: DPDP Act 2023 (India). Patient name, phone and appointment reasons are personal data; the clinic is the data fiduciary and the platform its processor, so the platform admin gets no patient data (AC-8).
- Clinic staff: only their clinic's rows, by role (detailed per role in Feature 8; here `OWNER` covers today's admin pages).
- Patients: only their own `ClinicPatient` rows and appointments, via `patient-self.ts`.
- Public: active clinics' doctor list through the spec 0002 allowlist shape.
- Logs carry `clinicId` and reason on every tenancy refusal, never patient fields.

**Configuration required**:
- `CRON_SECRET`: Vercel Cron sends it as a bearer token to the purge route. Add to Vercel (Production) and `.env.local`.
- `vercel.json` cron: `/api/cron/purge-clinics`, daily (Hobby allows once per day).

**Critical test scenarios**:
- Happy path: two clinic fixture, each model read through A returns only A rows, verifies **AC-1**
- Failure: create an appointment in A with B's doctor id, rejected by the database, verifies **AC-2**
- Guard: a temp file importing `@/lib/prisma` outside the allowlist makes the static test fail, verifies **AC-3**
- Migration: fresh database from migrations, seeded legacy rows, Demo Clinic present and `db:check` clean, verifies **AC-4**
- Booking twice at Demo creates one `ClinicPatient`, verifies **AC-5**
- Receptionist links a walk in, a `DOCTOR` member is refused, verifies **AC-6**
- Patient with bookings in A and B sees both, labeled; another user's never, verifies **AC-7**
- `listClinics` result has no patient or appointment fields, verifies **AC-8**
- Suspended slug resolves null; member refused; restore restores, verifies **AC-9**
- Cron without secret 401; 31 day suspended clinic purged, 29 day kept; second run purges 0, verifies **AC-10**
- Duplicate membership rejected; non member refused, verifies **AC-11**
- Doctor search "cardio" finds a Cardiology doctor via catalog, verifies **AC-12**

## Build plan

Journey approach on a foundation: no user journey yet, so each step leaves the live Demo flows working end to end.

1. Schema and one migration (generated with `--create-only`, then hand edited; see Migration plan for the order). Backfill rules:
   - Demo Clinic: slug `demo`, name and coordinates from the oldest old `clinics` row by `createdAt` (name "Demo Clinic" and lat 28.6139, long 77.2090 if none). One branch: name "Main", address = that old clinic's name (or "Demo address"), city "Delhi". All other old `clinics` rows are deleted (they were "near me" listings, not customers).
   - Specialty catalog: a fixed seed list of common Indian OPD specialties (with `nameHi`), plus every distinct existing `doctors.speciality` value: name = original text, slug = lowercased, non alphanumerics to `-`, deduped ignoring case; `nameHi` null for those. One Demo `ClinicSpecialty` row per specialty a Demo doctor uses.
   - One Demo `ClinicPatient` per distinct appointment user (name and phone per the Value sourcing rule); Demo `OWNER` membership for the user whose email equals `ADMIN_EMAIL`, if present (the migration reads it as a literal written in at build time, not from env).
   - All doctors and appointments moved to Demo and its branch.
   Update `scripts/seed-doctors.js` and `db:check` for the new shape. Satisfies **AC-4**, **AC-11**, **AC-12**, **AC-2**
2. Tenancy module: `forClinic`, `requireClinicMember`, `clinicBySlug`, `DEMO_CLINIC_SLUG`, with unit tests on the args rewrite. Satisfies **AC-1**, **AC-9**, **AC-11**
3. Move every existing call site to the tenancy module: booking service and actions, doctor service (raw query filtered by clinic, location from branch), doctor admin actions, Vapi webhook, admin appointments. Create `patient-self.ts` for the dashboard. Satisfies **AC-4**, **AC-5**, **AC-7**, **AC-12**
4. `linkPatientToUser` action. Satisfies **AC-6**
5. Platform admin actions in `src/lib/actions/platform.ts` and a minimal clinics table on `/admin` (list, suspend, restore). Satisfies **AC-8**, **AC-9**
6. Purge route, `vercel.json` cron, `CRON_SECRET`. Satisfies **AC-10**
7. Static guard test (allowlist imports, raw SQL, `CLINIC_OWNED_MODELS` vs every model with a `clinicId` field from Prisma DMMF) and `scripts/check-isolation.js` (two temp clinics on the dev database, asserts AC-1 and AC-2, cleans up). Satisfies **AC-1**, **AC-2**, **AC-3**

## Migration plan

**Strategy**: big bang, one migration plus one code deploy. Acceptable because the only data is test data and one real user; no real patients yet.
**SQL order inside the migration** (Prisma will not generate a safe order by itself):

1. Create enums and new tables (`specialties`, `branches`, `clinic_members`, `clinic_specialties`, `clinic_patients`); add new columns as nullable (`clinics.slug`, `clinics.status` with default `ACTIVE`, `doctors.branchId/specialtyId/userId`, `appointments.clinicId/branchId/clinicPatientId`).
2. Backfill per Build plan step 1.
3. `SET NOT NULL` on the new required columns; drop the global unique on `doctors.email`.
4. Add unique indexes `(id, clinicId)` on `doctors`, `branches`, `clinic_patients`, then `(clinicId, email)` on `doctors`, `(clinicId, userId)` on `clinic_members` and `clinic_patients`.
5. Drop the old single column FKs (`appointments.doctorId`, `appointments.userId`), add the composite FKs with the Delete rules above.
6. Drop old columns (`appointments.userId`, `doctors.speciality`, `clinics.latitude/longitude/googlePlaceId/isPartner`). Keep `appointments_doctorId_date_time_active_key` untouched; delete any generated `DROP INDEX` for it.

**Phases**:

1. Take a backup (`pg_dump --format=custom` with the session pooler URL to a local file), run `npm run db:migrate` against Supabase (retry on P1002), then `npm run db:check`.
2. Deploy the code right after; the old code breaks against the new schema, so keep the gap to minutes.
**Rollback**: restore from the Supabase backup taken just before step 1 (free plan: take a manual `pg_dump` first), then redeploy the previous commit.
**Risks**: the backfill misses an orphan appointment (doctor with no clinic); the migration assigns every row to Demo before adding constraints, so it fails loudly rather than silently.

## Consequences

**Positive**:
- One place enforces isolation; a forgotten `where` cannot leak data, and the database blocks cross clinic links.
- Patients keep one login; clinics keep separate records, which fits DPDP purpose limits.
- Branches, specialties and roles exist before Journey 1 builds screens on them.

**Negative / tradeoffs**:
- The extension does not see raw SQL or nested writes; the allowlist test and composite FKs cover that, but raw queries need manual `clinicId` filters.
- Every existing action changes shape in one deploy, with a short window where old code meets the new schema.
- The platform operator can no longer read appointments as "admin"; you see Demo data only as its `OWNER`.
- Hard delete after 30 days is final; there is no restore after purge.

**Neutral**:
- `Doctor.email` is unique per clinic now, not globally.
- The `clinics near me` list only finds customer clinics.
- The `clinic` cookie for multi clinic staff is set by Feature 8's switcher.

## Follow-up

- [ ] Feature 8: role by role permissions, invites, clinic switcher, `ADMIN_EMAIL` retirement from clinic pages.
- [ ] Feature 9: schedule and leave tables follow this spec's rules (clinic owned, composite FKs, `CLINIC_OWNED_MODELS`).
- [ ] Feature 10 and Journey 2: replace `DEMO_CLINIC_SLUG` with the URL slug, and add `clinicId` to the spec 0002 call token.
- [ ] Record view audit log (Deferred in scope) becomes important once staff can open patient records.
- [ ] `/sync`: add the tenancy rule and allowlist to root `AGENTS.md` `## Rules` and `prisma/AGENTS.md`.
