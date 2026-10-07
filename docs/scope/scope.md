# Scope: AI front desk for clinics (working name, currently DentWise)

An AI front desk that small clinics and polyclinics in India use instead of a phone booking line. The AI hears the patient's concern in English or Hindi, picks the right specialty and doctor, books the slot, sends reminders, and then connects patient and doctor on video and chat. The doctor only receives a ready appointment with a short summary. Many clinics share one app, each with its own separated data. Clinics join on free pilots first; running costs must stay at zero (free tiers only). Success means the share of appointments booked end to end by the AI with no human help.

**Build approach:** Journey (finish one whole user path, every step and state, before starting the next).
**Workflow:** Beta (`/check verify` then `/test` after `/develop`). Features tagged `· GA` also get a fresh model `/check review` and `/document`, because they touch health data, consent, emergencies, or clinic data isolation. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Sign in and accounts | Existing | existing |
| B | Doctor directory and admin | Existing | existing |
| C | Web booking form | Existing | existing |
| D | Voice booking assistant | Existing | in-progress |
| E | Booking confirmation email | Existing | existing |
| F | Patient dashboard | Existing | existing |
| 1 | Coding standards and tooling | Foundation | done |
| 2 | Database connection and migration baseline | Foundation | in-progress |
| 3 | Security fixes in existing code | Foundation | in-progress |
| 4 | Multi clinic data model | Foundation | planned |
| 5 | AI agent platform | Foundation | planned |
| 6 | English and Hindi support | Foundation | planned |
| 7 | Clinic sign up and profile | Journey 1: clinic setup | planned |
| 8 | Staff and roles | Journey 1: clinic setup | planned |
| 9 | Doctor schedules and time off | Journey 1: clinic setup | planned |
| 10 | Public clinic booking page | Journey 1: clinic setup | planned |
| 11 | Patient consent and data control | Journey 2: patient booking | planned |
| 12 | AI intake conversation | Journey 2: patient booking | planned |
| 13 | Emergency red flags | Journey 2: patient booking | planned |
| 14 | Specialty and doctor routing | Journey 2: patient booking | planned |
| 15 | AI booking on real availability | Journey 2: patient booking | planned |
| 16 | Doctor visit summary | Journey 2: patient booking | planned |
| 17 | Appointment reminders | Journey 3: reminders | planned |
| 18 | Doctor appointment inbox | Journey 4: consultation | planned |
| 19 | Video consult room | Journey 4: consultation | planned |
| 20 | Patient and doctor chat | Journey 4: consultation | planned |
| 21 | Clinic analytics | Journey 5: clinic insights | planned |
| 22 | Rename and rebrand | Polish | planned |

## Already built

### A. Sign in and accounts · existing
Clerk sign in and sign up, with each Clerk user synced to a `users` row. code in `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/actions/users.ts`

### B. Doctor directory and admin · existing
One admin (matched by `ADMIN_EMAIL`) adds and edits doctors; patients browse active doctors. code in `src/app/admin/`, `src/lib/actions/doctors.ts`

### C. Web booking form · existing
Patient picks a doctor, a date, and a fixed slot; double booking is blocked by a database index. code in `src/app/appointments/`, `src/lib/services/appointment-booking.ts`

### D. Voice booking assistant · in-progress
Voice call in the browser that lists doctors and books. Partial: tools run on the client, payment is a fake, the prompt is dental and US based, and there is one clinic only. Feature 5 decides its future and Journey 2 replaces it. code in `src/components/voice/`, `src/app/api/vapi/tools/`

### E. Booking confirmation email · existing
Sends a confirmation email after a booking (needs `RESEND_API_KEY` set). code in `src/lib/services/email.ts`, `src/components/emails/`

### F. Patient dashboard · existing
Signed in patient sees upcoming appointments. code in `src/app/dashboard/`

## Foundations

### 1. Coding standards and tooling · done
Conventions are captured; the build still ignores type errors and there is no test runner, so nothing later can be proven.
**Done when:** a type error fails the build or a check script, and one sample test runs with a single npm command.
- [x] Capture conventions and tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`
- [x] Verify it: `/check verify tooling`
- [x] Test it: `/test tooling` (skipped, the sample suite is the test; marked done by the engineer)
code in `next.config.ts`, `vitest.config.mts`, `package.json`

### 2. Database connection and migration baseline · in-progress
Reach the database from this network and make the migration history match the real schema, so every later data change ships as a clean migration.
**Done when:** the app connects locally, sign up creates a user row, and a fresh database built from migrations equals the schema with no drift.
- [x] Design it (spec): `/architect database connection and migration baseline`
- [ ] Build it: `/develop database connection and migration baseline`
  - [x] Fresh init migration, drift side channels removed, docs updated (AC-2, AC-7)
  - [x] `db:check` and `db:seed` scripts (AC-3, AC-6)
  - [x] Migrate the Supabase DB and prove it: status, drift check, slot index, seed (AC-1, AC-2, AC-3, AC-5, AC-6)
  - [ ] Sign in creates one user row; Vercel `DATABASE_URL` switched (AC-4, AC-1)
- [ ] Verify it: `/check verify database connection and migration baseline`
- [ ] Test it: `/test database connection and migration baseline`
spec [0001](../specs/0001-database-connection-baseline.md) · code in `prisma/migrations/`, `scripts/db-check.js`, `scripts/check-slot-index.js`

### 3. Security fixes in existing code · GA
Close the holes found in the audit before real patient data arrives: doctor contact details exposed without sign in, the voice webhook trusting a caller supplied user id, and a weak secret check.
**Done when:** unauthenticated calls cannot read doctor emails or phones, the webhook rejects requests with a missing or wrong secret in every environment, and a booking cannot be made for another user.
- [x] Design it (spec): `/architect security fixes in existing code`
- [x] Build it: `/develop security fixes in existing code`
  - [x] Doctor list allowlist: no email, phone only when signed in, location query fixed (AC-1, AC-2, AC-12)
  - [x] Webhook secret required everywhere, constant time compare, checked before ping (AC-3, AC-4, AC-5)
  - [x] Signed call token: issue, pass from the widget, verify in the webhook; AI sees no phone or Clerk id (AC-6 to AC-11)
  - [x] README and env updates (AC-4, AC-10)
- [ ] Verify it: `/check verify security fixes in existing code`
- [ ] Test it: `/test security fixes in existing code`
- [ ] Review it (fresh model): `/check review security fixes in existing code`
- [ ] Document it: `/document pr`
spec [0002](../specs/0002-security-fixes-existing-code.md) · code `src/lib/vapi-auth.ts`, `src/lib/services/doctors.ts`, `src/app/api/vapi/tools/route.ts`

### 4. Multi clinic data model · needs a decision · GA
Clinics, branches, specialties, staff roles, and doctor schedules, with every patient record tied to one clinic and never visible to another.
**Done when:** two clinics can hold doctors and appointments side by side, and no query path returns another clinic's data.
- [ ] Design it (spec): `/architect multi clinic data model`

### 5. AI agent platform · needs a decision
Choose how the AI agent runs: the voice and text model providers inside free tiers, tools executed on the server, and a path off the current voice platform's one time credit.
**Done when:** one decision covers voice and text, server side tool calls, Hindi support, and stays at zero cost for pilot volumes.
- [ ] Design it (spec): `/architect AI agent platform`

### 6. English and Hindi support · needs a decision
Every patient facing screen and the AI conversation work in English and Hindi, with room for regional languages later.
**Done when:** a patient can switch language, every patient screen and AI reply follows it, and dates and phone numbers use Indian formats.
- [ ] Design it (spec): `/architect English and Hindi support`

## Journey 1: Clinic setup

### 7. Clinic sign up and profile · needs a decision
A clinic owner signs up, creates the clinic, adds branches, address, hours, and specialties offered.
**Done when:** a new owner goes from sign up to a complete clinic profile without help; missing fields and duplicate clinics are handled.
- [ ] Design it (spec): `/architect clinic sign up and profile`

### 8. Staff and roles · needs a decision · GA
The owner invites doctors and receptionists; each role sees only what it needs, replacing the single admin email.
**Done when:** an invited doctor and receptionist can join, each sees only their clinic, and a removed staff member loses access at once.
- [ ] Design it (spec): `/architect staff and roles`

### 9. Doctor schedules and time off · needs a decision
Each doctor sets weekly hours, slot length, and leave days, replacing the hard coded slots.
**Done when:** bookable slots come only from a doctor's schedule, leave blocks them, and changing hours never breaks existing bookings.
- [ ] Design it (spec): `/architect doctor schedules and time off`

### 10. Public clinic booking page
Each clinic gets a shareable public page where patients start talking to the AI, findable on Google.
**Done when:** the page shows the clinic, its doctors, and a start button; it has a title, description, social card, and a sitemap entry; an unknown clinic shows a clear not found page.
- [ ] Build it: `/develop public clinic booking page`

## Journey 2: Patient booking

### 11. Patient consent and data control · needs a decision · GA
The patient agrees before the AI collects health details, and can see and delete their own data.
**Done when:** no health detail is stored without recorded consent, and a patient can view and delete their data, which is then gone from every clinic view.
- [ ] Design it (spec): `/architect patient consent and data control`

### 12. AI intake conversation · needs a decision · GA
By voice or text, the AI asks about the concern in plain words and collects it in a structured form, never giving medical advice or a prescription.
**Done when:** a patient can describe a problem by voice or text in English or Hindi, the AI asks sensible follow ups, never counsels or prescribes, and a dropped session can resume.
- [ ] Design it (spec): `/architect AI intake conversation`

### 13. Emergency red flags · needs a decision · GA
When the concern sounds like an emergency (chest pain, stroke signs, heavy bleeding, and similar), the AI stops booking and directs the patient to 112 or 108.
**Done when:** every listed red flag phrase in English and Hindi stops the booking flow and shows the emergency numbers, and each case is logged for the clinic.
- [ ] Design it (spec): `/architect emergency red flags`

### 14. Specialty and doctor routing · needs a decision
From the intake, pick the right specialty and offer suitable doctors in that clinic, with a fallback to a general physician.
**Done when:** common concerns map to the right specialty, the patient can override the choice, and an unclear case falls back safely.
- [ ] Design it (spec): `/architect specialty and doctor routing`

### 15. AI booking on real availability · needs a decision
The AI offers open slots from real schedules, books, and lets the patient reschedule or cancel.
**Done when:** the AI books only free slots, two patients can never take the same slot, and reschedule and cancel work by voice, text, and the dashboard.
- [ ] Design it (spec): `/architect AI booking on real availability`

### 16. Doctor visit summary · needs a decision · GA
The doctor gets a short structured summary of the patient's concern before the visit, clearly marked as patient reported and not a diagnosis.
**Done when:** each booked appointment carries a summary the doctor can read in one glance, and it never contains a diagnosis or treatment advice.
- [ ] Design it (spec): `/architect doctor visit summary`

## Journey 3: Reminders

### 17. Appointment reminders · needs a decision
Free reminders before each visit (email and browser notification), with confirm, reschedule, and cancel links.
**Done when:** a patient gets reminders at set times before the visit, can act on them in one tap, and a cancelled appointment sends no further reminders.
- [ ] Design it (spec): `/architect appointment reminders`

## Journey 4: Consultation

### 18. Doctor appointment inbox
The doctor's day view: today's and upcoming appointments with summaries, and one button to start the consult.
**Done when:** a doctor sees only their own appointments with summaries, can mark them done or no show, and empty days show a clear state.
- [ ] Build it: `/develop doctor appointment inbox`

### 19. Video consult room · needs a decision · GA
Patient and doctor meet on a video call inside the app at the appointment time.
**Done when:** only the booked patient and doctor can join, the call works on a phone browser, and a failed connection offers a retry or a switch to chat.
- [ ] Design it (spec): `/architect video consult room`

### 20. Patient and doctor chat · needs a decision · GA
Text chat between patient and doctor tied to an appointment, before and after the visit.
**Done when:** messages arrive live, only the two participants see the thread, and chat history stays with the appointment.
- [ ] Design it (spec): `/architect patient and doctor chat`

## Journey 5: Clinic insights

### 21. Clinic analytics · needs a decision
Per clinic numbers: bookings, no shows, busiest hours, and the share booked by the AI with no human help (the pilot success measure).
**Done when:** an owner sees these numbers for a chosen date range for their clinic only, and empty clinics show a clear state.
- [ ] Design it (spec): `/architect clinic analytics`

## Polish

### 22. Rename and rebrand
Replace the DentWise name and every dental, US phone format, 911, and dollar price string once a new name is chosen.
**Done when:** no DentWise or dental text remains in the UI, emails, or AI prompts, and the new name shows everywhere.
- [ ] Build it: `/develop rename and rebrand`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **WhatsApp channel**: patients book through WhatsApp · needs a decision
- **Phone call channel**: patients call a number (no free Indian number, costs money) · needs a decision
- **Subscription billing**: paid plans after the free pilots · needs a decision · GA
- **Consultation fee payment**: patient pays the clinic online · needs a decision · GA
- **Regional languages**: beyond English and Hindi · needs a decision
- **Prisma 7.4 upgrade**: declare the partial slot index in the schema, drop the `db:check` exception · from spec 0001
- **Drift check in CI**: run `db:check` on every PR against a disposable database · from spec 0001
- **National health ID link**: connect patient records to India's digital health ID · needs a decision · GA
- **Record view audit log**: log who viewed which patient record · needs a decision · GA

## Legend

**The decision box.** Every feature carries at most one, the sub task whose label ends with `(spec)`. Skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`. The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (built before this workflow) and `dropped` (de scoped, kept for history).
- **Workflow tier tag** beside a heading (`· GA`) sets that one feature's rigor above the project default; no tag inherits Beta.
- **Workflow**: **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
