# 0003. Rationale: multi clinic data model

## Context

The app was built for one dental practice. `Doctor.clinicId` is optional, `Clinic` holds only a location for a "near me" list (including clinics that aren't customers), and patients and appointments carry no clinic at all. The product is now a front desk for many Indian clinics on one deployment, free tiers only, holding patient names, phones and visit reasons: personal data under the DPDP Act 2023, where each clinic is the data fiduciary.

Forces:
- **Isolation is load bearing.** One missed filter shows one clinic's patients to another. Adding a tenant key after launch means rewriting every query, so it has to land before Journey 1.
- **Zero budget, small team.** One Supabase Postgres reached through the session pooler, Prisma 6, Vercel Hobby. No per tenant databases, no extra services.
- **Indian clinic reality.** Doctors consult at several clinics; receptionists book for callers with no account; families share one phone; Clerk cannot verify +91 numbers.
- **A live deployment.** The Vercel site, voice assistant and admin page must keep working through the change.

## Options considered

### Option 1: Shared tables, `clinicId`, scoped Prisma extension, composite FKs

Every clinic owned table gets `clinicId`; a Prisma client extension injects it into every query and write; composite foreign keys stop cross clinic references in the database.

**Pros**: one enforcement point; works over the pooler with no session state; free; the database still guards references.
**Cons**: raw SQL and nested writes bypass the extension; isolation of reads is enforced by the app, not the database.

### Option 2: Shared tables with Postgres row level security

The database filters rows by a per transaction setting such as `app.clinic_id`.

**Pros**: the strongest guarantee; even raw SQL is filtered.
**Cons**: with Prisma and a pooler, every query must run inside a transaction that sets the variable first; migrations, tests and the role setup get harder; a misconfigured policy fails silently.

### Option 3: Manual `where: { clinicId }` at every call site

**Pros**: no new machinery.
**Cons**: a single forgotten filter leaks health data, and code review is the only guard.

### Option 4: Schema or database per clinic

**Pros**: physical separation.
**Cons**: N migrations per change, connection limits, does not fit the free tier.

## Rationale

The leak risk comes from the number of call sites (about 20 today, many more by Journey 4), so the answer has to remove the per call site decision. Option 1 does that with one module and costs nothing to run. Row level security (Option 2) is stronger in theory, but the session pooler forced by Supabase's IPv6 direct host makes it a transaction per query, which is the kind of fragility a small team pays for at 2am. Option 1 closes its own gaps another way: composite FKs make cross clinic writes impossible at the database level, and a static test keeps raw SQL and the base client inside a short allowlist. Runner up: Option 2, worth revisiting if an enterprise customer asks for database level guarantees.

The patient choices follow the same forces. One login with a record per clinic gives a good experience while keeping each clinic's data under its own purpose (DPDP). Linking walk ins only through staff confirmation is forced by Clerk not verifying +91 phones: a typed number proves nothing, so an automatic link would let anyone claim someone else's records. Keeping the platform admin out of patient data keeps the operator a processor, not a reader.

Decided by the architect (not asked): the tenancy module API and file, the allowlist contents, composite FKs over app only checks, `ClinicPatient.phone` nullable (because `User.phone` is usually empty), the Demo `OWNER` membership for `ADMIN_EMAIL` so today's admin page keeps working, `clinicId` from a cookie for staff in several clinics, and a big bang migration (justified by having no real patient data yet; runner up: expand and contract over three deploys).
