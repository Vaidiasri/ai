# 0002. Close the doctor contact, webhook secret, and voice identity holes

**Date**: 2026-10-07
**Status**: In Progress

## Summary

Three holes from the audit get closed before real patient data arrives. Doctor emails are never sent to the browser, and phone numbers only go to signed in users. The voice webhook now demands the correct secret in every environment, compared in constant time (so timing cannot leak it). The webhook also stops trusting a user id the browser typed in: it books only for the person named in a short lived token your server signed.

## Context

**Code area**: `src/lib/auth.ts`, `src/app/api/vapi/tools/route.ts`, `src/lib/actions/doctors.ts`, `src/components/voice/VapiWidget.tsx`. Web app, existing Next.js 15, Clerk 6, Prisma 6, Vapi stack. Health adjacent data (patient bookings), so DPDP applies once real patients arrive.

Problems found in code (read 2026-10-07):

- `getAvailableDoctors` (`src/lib/actions/doctors.ts:144`) is a `"use server"` export, so anyone on the internet can call it, signed in or not. It has no auth check and returns whole rows (`d.*` in the raw SQL path, the full model in the `findMany` path), including `email` and `phone`. `VapiWidget.tsx:136` also forwards that full JSON to the AI model.
- `verifyVapiWebhookSecret` (`src/lib/auth.ts`) lets every request through in development when no secret is set. It falls back to `VAPI_PRIVATE_KEY` (the Vapi API key), so one value works as both a password and an API key. It compares with `===`, which leaks timing.
- `route.ts` answers `ping` before checking the secret.
- `resolveClerkUserId` (`route.ts:15`) accepts any `userId` starting with `user_` from the request body. The browser sets that value (`VapiWidget.tsx:288`), so a signed in user can edit it and book for someone else.
- **Unverified finding:** Vapi sends the `vapi.start` overrides inside the Call object, at `message.call.assistantOverrides.variableValues` (per the Vapi server events docs). The webhook reads `message.variableValues`, so on a real call it may never find a user at all. Nobody knows whether the dashboard routes tools to this webhook; the browser tool path (`bookAppointment` behind `requireAuth`) is already safe.

If nothing changes, the first real hospital onboarded exposes its doctors' contact details publicly, and a webhook booking can be made for another patient.

## Requirements

**User stories**:
- As a doctor, I want my email and phone kept away from anonymous visitors so that my contact details are not scraped.
- As a patient, I want bookings made in my name to come only from me so that nobody can book or fill slots for me.
- As the operator, I want the webhook to reject anyone without the secret so that only Vapi can call it.

**Acceptance criteria**:
- **AC-1**: The doctor list (`getAvailableDoctors`, both the location path and the plain path) never includes `email`, for any caller.
- **AC-2**: A signed out caller of `getAvailableDoctors` gets no `phone` field. A signed in caller gets `phone`.
- **AC-3**: The webhook (`POST /api/vapi/tools`) returns 401 for a missing or wrong secret, in development and production alike, for every message type including `ping`.
- **AC-4**: When `VAPI_WEBHOOK_SECRET` is not set, or is blank after trimming, the webhook rejects every POST with 401 and logs a server error. `VAPI_PRIVATE_KEY` is never accepted as the secret.
- **AC-5**: The secret is compared in constant time. A header of a different length, or an empty header, is rejected without throwing. `Bearer` is matched in any letter case.
- **AC-6**: A signed in user starting a voice call gets a call token from the server (HMAC SHA256 over their Clerk id and an expiry 30 minutes ahead). The browser no longer sends `userId` in `variableValues`.
- **AC-7**: The webhook's `book_appointment` books only for the Clerk id inside a valid call token. A `userId` anywhere in the body (`variableValues.userId`, `metadata.userId`, `customer.metadata.userId`) is ignored.
- **AC-8**: When the token is missing, expired, malformed, or its signature does not match, `book_appointment` returns exactly this tool result and creates no appointment: `{ "error": "I can't book this because your sign in for this call is missing or expired. Please sign in on the website and start a new call." }`. Other tool calls in the same request still answer.
- **AC-9**: `get_current_user` reports `isLoggedIn: true` and the user's name only with a valid call token, and `isLoggedIn: false` otherwise. It never returns the Clerk id.
- **AC-10**: When `VAPI_CALL_TOKEN_SECRET` is not set, the call still starts without a token, browser side booking still works, webhook bookings are refused (AC-8), and the server logs an error.
- **AC-11**: The voice AI never receives a doctor's phone or email: the widget's browser side `get_doctors` result sends only `name`, `speciality`, `clinicName`, and `distance`.
- **AC-12**: The location path of the doctor list (latitude and longitude given) returns active doctors within the radius, nearest first, without a database error.

## Options considered

### Option 1: Server signed call token

A signed in server action signs `clerkId` plus expiry with a new server only secret. The browser passes the token in `variableValues`; the webhook verifies it.

**Pros**: Node `crypto` only, nothing to install. Works whether or not the dashboard routes tools to the webhook. Proves identity even though Vapi stands between browser and server.
**Cons**: A new secret to manage. A token copied out of the user's own browser could book for that same user until it expires.

### Option 2: Remove booking from the webhook

Delete `book_appointment` and `get_current_user` from the webhook, and rely on the browser tool path.

**Pros**: Smallest diff, nothing to verify.
**Cons**: Breaks voice booking if the dashboard routes tools to the webhook, and nobody knows whether it does. Phone calls (no browser) can never book later.

### Option 3: Clerk JWT from a custom template

The browser fetches a Clerk token from a template, and the webhook verifies it against Clerk.

**Pros**: Reuses Clerk keys and rotation.
**Cons**: Needs a Clerk dashboard template with a lifetime long enough for a call. Adds a network or JWKS dependency to every tool call. More moving parts for the same proof.

## Decision

**Chosen option**: Option 1: Server signed call token.

The webhook trusts identity only from an HMAC token your server issued to the signed in user, it demands `VAPI_WEBHOOK_SECRET` (compared in constant time) on every request in every environment, and the doctor list returns a fixed set of public fields, plus phone for signed in callers.

## Rationale

Not knowing whether the dashboard uses the webhook rules out Option 2: it is safe only if the webhook is dead. Option 3 proves the same thing as Option 1 but adds a dashboard template and a verification dependency on every tool call. Option 1 is a few lines of stdlib, keeps both tool paths working, and uses a dedicated secret, because `VAPI_WEBHOOK_SECRET` also sits in the Vapi dashboard and one leak should not open both locks.

The doctor list stays public because the webhook calls it without a Clerk session. Moving the query into a service lets the action decide phone visibility from `auth()`, while the webhook asks for the public fields only.

## Feature design

**Data model sketch**: No schema change. The doctor list returns this allowlist:

| Field | Source | Who gets it |
|---|---|---|
| `id`, `name`, `speciality`, `bio`, `imageUrl`, `gender`, `clinicId` | `doctors` columns | everyone |
| `clinicName` (`string \| null`) | `clinics.name`, `null` when the doctor has no clinic | everyone |
| `isPartner` (`boolean`) | `clinics."isPartner"`, `false` when the doctor has no clinic | everyone |
| `distance` (`number \| null`) | km computed in SQL, rounded to 1 decimal (location path), `null` otherwise | everyone |
| `phone` (optional) | `doctors.phone`, key absent when not included | signed in callers only |
| `email`, `isActive`, `createdAt`, `updatedAt` | never returned | nobody |

**Call token format**: `v1.<clerkId>.<exp>.<sig>`
- `exp`: Unix seconds, issue time plus 1800.
- `sig`: base64url of HMAC SHA256 with key `VAPI_CALL_TOKEN_SECRET` over the string `v1.<clerkId>.<exp>`.
- Valid only when: there are exactly 4 parts, part one is `v1`, `clerkId` starts with `user_`, `exp` is an integer greater than now, and the signature matches in constant time.
- Clerk ids contain no dots, so splitting on `.` is unambiguous.

**API surface**:
| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getAvailableDoctors(params)` | server action (existing) | latitude, longitude, speciality, radius | public doctor list, plus `phone` when signed in | none (public) | throws "Failed to fetch available doctors" |
| `getVoiceCallToken()` | server action (new, `src/lib/actions/voice.ts`) | none | token string, or `null` when the secret is unset | `requireAuth()` | throws when signed out |
| `findAvailableDoctors(params, { includePhone })` | service (new, `src/lib/services/doctors.ts`) | same params plus flag | allowlisted list | internal only | |
| `POST /api/vapi/tools` | route (existing) | header `x-vapi-secret` or `Authorization: Bearer`, JSON body | `{ results }` | `VAPI_WEBHOOK_SECRET` | 401 `{ error: "Unauthorized", results: [] }` (unchanged body, no CORS headers needed, Vapi calls server to server), 400 bad JSON, 500 |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| `getAvailableDoctors` | include phone or not | `auth().userId` from Clerk (truthy means signed in) |
| `getAvailableDoctors` | doctor fields | the allowlist above, `doctors` and `clinics` columns |
| webhook `get_doctors` | doctor fields | `findAvailableDoctors(..., { includePhone: false })` |
| `getVoiceCallToken` | clerkId | `requireAuth()` return value |
| `getVoiceCallToken` | exp | server clock `Date.now()` plus 30 minutes |
| `getVoiceCallToken` | signing key | env `VAPI_CALL_TOKEN_SECRET` |
| `VapiWidget` start | `callToken` variable | return of `getVoiceCallToken()` (left out when `null` or on error) |
| `VapiWidget` start | `name` variable | unchanged, Clerk `user.firstName` |
| `VapiWidget` `get_doctors` result | fields sent to the AI | `name`, `speciality`, `clinicName`, `distance` picked from `getAvailableDoctors` rows |
| `useAvailableDoctors` | query key | `["getAvailableDoctors", isSignedIn]`, `isSignedIn` from Clerk `useAuth()` |
| `DoctorSelectionStep` | phone line | rendered only when `phone` is present |
| webhook auth | expected secret | env `VAPI_WEBHOOK_SECRET` only, trimmed, blank counts as unset |
| webhook auth | presented secret | header `x-vapi-secret`, else `Authorization` with a leading `Bearer ` removed (any case), trimmed, empty counts as missing |
| webhook `book_appointment` / `get_current_user` | caller identity | `clerkId` of the verified token read from `message.call.assistantOverrides.variableValues.callToken`, else `message.variableValues.callToken` (both safe, the signature is what proves it) |
| webhook `book_appointment` | doctor, date, time, reason | unchanged, tool args |
| webhook `get_current_user` | result | `{ name, isLoggedIn }` only, `name` from the `users` row by verified `clerkId` |

**Key invariants**:
- No code path returns a doctor's `email` outside the admin actions (`getDoctors`, `createDoctor`, `updateDoctor`, which keep `requireAdmin`).
- The webhook never reads identity from a field it did not verify.
- The secret check runs before `req.text()` reads the body and before any message type is handled.
- `route.ts` does not import from `@/lib/actions/doctors`; it uses the service only.
- No development bypass exists anywhere in the webhook auth.

**Security model**:
- Doctor list: public, minus email always and phone for anonymous callers. Admin views keep full rows behind `requireAdmin`.
- Webhook: only holders of `VAPI_WEBHOOK_SECRET` (Vapi). Identity comes only from a call token signed by your server for a signed in Clerk user.
- Token replay: a token works only for the user it names and only for 30 minutes, so a copied token can at worst book for that same user. Accepted.
- The token rides in `variableValues`, so it can appear in Vapi call logs. The assistant prompt must never reference `{{callToken}}`, so the model never speaks it.
- Never log the secret, the token, or a presented header value. Log one line per rejection reason: `console.error` for "VAPI_WEBHOOK_SECRET not set", `console.warn` for "missing secret header" and "wrong secret", `console.warn` for a refused token ("missing", "expired", "invalid").

**Configuration required**:
- `VAPI_CALL_TOKEN_SECRET`: new, server only, at least 32 random bytes (for example `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`). Set it in `.env.local` and Vercel.
- `VAPI_WEBHOOK_SECRET`: now required, with no fallback. Must equal the Server URL secret in the Vapi dashboard and be set in Vercel.

**Critical test scenarios** (Vitest unit tests on pure functions, plus runtime checks in `/check verify`):
- Allowlist mapper: no `email` either way, `phone` only with the flag; a row with no clinic gives `clinicName: null`, `isPartner: false`; distance `3.14159` gives `3.1`. Verifies **AC-1**, **AC-2**.
- Secret check: unset env gives false even with `NODE_ENV=development`; whitespace only env gives false; only `VAPI_PRIVATE_KEY` set gives false; the right `x-vapi-secret` gives true; the right `Bearer` and `bearer` give true; wrong gives false; empty header gives false; a different length gives false without throwing. Verifies **AC-3**, **AC-4**, **AC-5**.
- Token: a fresh token verifies to its clerkId; `exp` equal to now fails; tampered clerkId fails; tampered signature fails; wrong secret fails; 3 parts, empty string, non numeric exp, or an id not starting with `user_` fail. Verifies **AC-6**, **AC-7**, **AC-8**.
- Runtime (curl against the dev server): no header, wrong header, and `ping` without a header all return 401. `tool-calls` with only a forged `variableValues.userId`, `metadata.userId`, or `customer.metadata.userId` refuses the booking with the AC-8 message and creates no row. A valid token books for its own user. `get_current_user` output has no `userId`. Verifies **AC-3**, **AC-7**, **AC-8**, **AC-9**.
- Runtime: signed out call to the doctor list has no phone; signed in call has it; a call with coordinates near a seeded clinic returns doctors with a distance and no error. Verifies **AC-2**, **AC-12**.
- Runtime: the widget's `get_doctors` tool result (debug panel or Vapi log) has no `phone`, `email`, or `id`. Verifies **AC-11**.

## Build plan

Journey order: each path ships complete, with its tests, before the next.

**Journey 1, an anonymous visitor reads the doctor list**
1. Add `src/lib/services/doctors.ts` with `findAvailableDoctors(params, { includePhone })`: the raw SQL selects explicit columns instead of `d.*`, `findMany` uses `select`, and both map through one exported allowlist mapper. The current location query uses `HAVING` with no `GROUP BY` (`doctors.ts:167`), which Postgres rejects; move the distance filter into the `WHERE` clause. Satisfies **AC-1**, **AC-2**, **AC-12**.
2. Make `getAvailableDoctors` in `src/lib/actions/doctors.ts` call `auth()` and delegate with `includePhone: !!userId`. Point the webhook's `get_doctors` and its doctor name lookup at the service with `includePhone: false`, and drop the `actions/doctors` import from `route.ts`. In `use-doctors.ts`, key the query by `isSignedIn`; in `DoctorSelectionStep.tsx`, render the phone line only when `phone` is present. Satisfies **AC-1**, **AC-2**.
3. Vitest for the mapper. Satisfies **AC-1**, **AC-2**.

**Journey 2, only Vapi can reach the webhook**
4. Add `src/lib/vapi-auth.ts` (Node `crypto` only, no Clerk import, so it is unit testable): `safeEqual(a, b)` (compare SHA256 digests with `timingSafeEqual`, so lengths always match), and `verifyVapiWebhookSecret(req)` moved here from `auth.ts`, reading only `VAPI_WEBHOOK_SECRET`, with the trimming and logging rules in Value sourcing and Security model. Remove the old function from `auth.ts`. Satisfies **AC-3**, **AC-4**, **AC-5**.
5. In `route.ts`, run the secret check first, before `req.text()` and before `ping`, returning the unchanged 401 body. Satisfies **AC-3**.
6. Vitest for `safeEqual` and `verifyVapiWebhookSecret`. Satisfies **AC-3**, **AC-4**, **AC-5**.

**Journey 3, a voice booking is made only for the caller**
7. Add `signCallToken(clerkId, secret, nowMs)` and `verifyCallToken(token, secret, nowMs)` to `src/lib/vapi-auth.ts`, returning the clerkId or `null`. Satisfies **AC-6**, **AC-7**, **AC-8**.
8. Add `getVoiceCallToken()` in `src/lib/actions/voice.ts`: `requireAuth()`, then sign; if `VAPI_CALL_TOKEN_SECRET` is unset, log an error and return `null`. Satisfies **AC-6**, **AC-10**.
9. In `VapiWidget.tsx` `toggleCall`, fetch the token (an error becomes `null`), pass `callToken` when present, and stop sending `userId`. In the same file, the browser side `get_doctors` handler (`VapiWidget.tsx:136`) sends only the four fields in AC-11. Satisfies **AC-6**, **AC-10**, **AC-11**.
10. In `route.ts`, delete `resolveClerkUserId` (all three `userId` candidates go) and add a token reader using the two paths in Value sourcing, then `verifyCallToken`. `book_appointment` without a valid token returns the AC-8 message per tool call; `get_current_user` returns `{ name, isLoggedIn }` and never `userId`. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10**.
11. Vitest for sign and verify, covering every case in Critical test scenarios. Satisfies **AC-6**, **AC-7**, **AC-8**.
12. Update `README.md` (drop the "can match VAPI_PRIVATE_KEY" note, add `VAPI_CALL_TOKEN_SECRET`) and add the new variable name to `.env.local` with a placeholder for you to fill in. Satisfies **AC-4**, **AC-10**.

## Consequences

**Positive**:
- Doctor contact details stop leaking to scrapers and to the AI model's anonymous context.
- Webhook bookings become safe to enable for phone calls later.
- The likely broken identity lookup (`message.variableValues`) is replaced with the documented path.

**Negative / tradeoffs**:
- Deploying without `VAPI_WEBHOOK_SECRET` in Vercel makes the webhook answer 401 to everything, including Vapi.
- A new secret to store and rotate. Rotating it ends every in flight call's webhook bookings (browser bookings unaffected).
- The doctor list response shape shrinks. Any future screen needing another field must add it to the allowlist on purpose.
- Local development now needs `VAPI_WEBHOOK_SECRET` set to test the webhook at all.
- A voice call longer than 30 minutes loses webhook booking for the rest of the call (the caller hears the AC-8 message). Browser side booking is unaffected.
- The location path of the doctor list starts working for the first time, so screens that send coordinates may show results they never showed before.

**Neutral**:
- If the Vapi dashboard prompt references `{{userId}}`, it renders empty after this change.

## Migration plan

**Strategy**: config first, then a single deploy.
**Phases**:
1. Generate `VAPI_CALL_TOKEN_SECRET`. Set it, and confirm `VAPI_WEBHOOK_SECRET` (matching the dashboard Server URL secret), in Vercel production and preview, and in `.env.local`.
2. Merge and deploy. Run the runtime curl checks against the deployment.
**Rollback**: revert the merge commit. The env vars are harmless to leave in place.
**Risks**: a missing or mismatched `VAPI_WEBHOOK_SECRET` silently breaks webhook tools. Check the Vercel logs for the "not set" error right after deploy.

## Follow-up

- [ ] You: set `VAPI_CALL_TOKEN_SECRET` and confirm `VAPI_WEBHOOK_SECRET` in Vercel before merging.
- [ ] You: in the Vapi dashboard, check whether the tools have a Server URL, and whether the prompt uses `{{userId}}` (replace it with nothing; the AI never needs the id).
- [ ] Rate limiting on the public doctor list and the webhook: not in scope, add before public launch.
- [ ] Per hospital scoping of the doctor list arrives with multi tenancy; the allowlist mapper is the place to enforce it.
- [ ] Existing bug, not in scope: `DoctorSelectionStep.tsx:69` shows `appointmentCount`, which `getAvailableDoctors` has never returned (only the admin `getDoctors` adds it at `doctors.ts:21`), so the count renders empty. The allowlist does not add it; fix it separately if you want the count shown.
- [ ] `/sync`: update `src/components/voice/AGENTS.md` Gotchas (the trusted userId, the dev bypass, and the `===` compare are fixed) and add `VAPI_CALL_TOKEN_SECRET` to root `AGENTS.md`.
