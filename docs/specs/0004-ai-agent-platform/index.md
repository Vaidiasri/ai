# 0004. AI agent platform: turn based agent on Vercel with Groq

**Date**: 2026-10-07
**Status**: In Progress

## Summary

The AI front desk moves off Vapi (a paid voice platform with a one time credit) onto our own agent that runs inside the app's Vercel functions. Each patient turn is one request: the browser hears the patient, Groq Whisper turns speech into text, a Groq hosted open model replies and calls our booking tools on the server, and the browser speaks the reply with its built in voice. Text chat uses the same agent. Everything stays on free tiers, works in English and Hindi, stores no conversation content, and keeps Vapi behind a switch until the new path is verified.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Requirements

**User stories**:
- As a signed in patient, I want to talk or type to the clinic's AI front desk in English or Hindi, so that I can book without filling a form.
- As a patient, I want to know before I start that an AI provider processes what I say and that nothing is recorded, so that I can decide.
- As the platform operator, I want the agent to cost nothing at pilot volume and to fail over to the booking form, so that a provider outage never strands a patient.
- As a clinic, I want the agent to book only for the signed in patient and only in my clinic, so that no conversation can touch another account or clinic.

**Acceptance criteria**:
- **AC-1**: A signed in user can start a session for an `ACTIVE` clinic by slug, choosing channel (`VOICE` or `TEXT`) and language (`EN` or `HI`). The server creates one `AgentSession` row and returns its id and limits. A signed out caller gets 401. An unknown or `SUSPENDED` clinic gets 404 with `CLINIC_UNAVAILABLE`.
- **AC-2**: A user may start at most 5 sessions per clinic per UTC day (resets 00:00 UTC). The sixth start that day returns 429 with the reset time and creates no row. Sessions at another clinic are counted separately.
- **AC-3**: In text mode, the reply streams in word by word in the session language. The patient can switch EN and HI at any time in the session, and the next reply follows the new language.
- **AC-4**: In voice mode, the patient speaks without pressing a button per turn: end of speech is detected in the browser, the audio is transcribed (Hindi, English and Hinglish), and the reply is spoken sentence by sentence as it streams. If the device has no voice for the session language, the reply is shown as text with a one line note, and the session continues.
- **AC-5**: The agent can list the clinic's doctors (optionally by specialty), list a doctor's free slots for a date from tomorrow through 4 days after tomorrow (today is excluded, same as the booking form), and book a slot. Every tool runs on the server, scoped to the session's clinic and the session's user. Nothing the patient says (a name, an email, an id) can make a tool act for another account or clinic.
- **AC-6**: A session books at most one appointment. A second booking attempt returns an "already booked" result with the first booking's details. A slot taken in the meantime returns "that time was just taken" and the agent offers other slots. A successful booking sets the session's `appointmentId`, and the confirmation email goes out as it does today.
- **AC-7**: A session allows at most 40 patient turns (voice and text both count). The 41st chat request ends the session with `MESSAGE_LIMIT`. A voice session warns the patient at 9 minutes and refuses further turns at 10 minutes, ending with `TIME_LIMIT`. Transcribe accepts only `VOICE` sessions, at most 60 audio uploads per session, and none past 10 minutes.
- **AC-8**: If the primary model fails before replying (rate limit, server error, timeout), the turn is retried once on the backup model. If that fails too, the patient gets a reply with the booking form link, and the session ends with `PROVIDER_ERROR`.
- **AC-9**: Chat, transcribe and end requests for a session id that is not the caller's own return 404. Requests for an ended session return 409. After start, the clinic always comes from the session row, never from the request.
- **AC-10**: No message text, transcript or audio is stored in the database or written to logs. The session row holds metadata only. Before starting, the start screen shows a one line notice in the chosen language naming AI provider processing and saying nothing is recorded or stored. Starting counts as acknowledgement.
- **AC-11**: Closing or leaving the page ends the open session as `ABANDONED` (beacon). Any of the user's sessions still open at this clinic when they start a new one are closed as `ABANDONED` first. The patient's End button ends it as `COMPLETED`.
- **AC-12**: Voice mode checks microphone permission before starting a session. If permission is denied or no microphone exists, the page offers "Continue in text" and no session is used up.
- **AC-13**: The daily purge cron also deletes `AgentSession` rows whose `startedAt` is more than 90 days old. Running it twice is harmless.
- **AC-14**: The agent follows a fixed platform policy that lives in code and that patients and clinics cannot edit. It does not counsel, diagnose or prescribe. It points the patient to booking. System or tool messages sent by the client are dropped.
- **AC-15**: `NEXT_PUBLIC_VOICE_ENGINE=native` shows the new agent on `/voice`. Unset, or set to `vapi`, shows the existing Vapi widget unchanged.

## Decision

**Chosen option**: Option 2: a turn based agent in Vercel functions, built on the Vercel AI SDK with Groq for the model and speech to text, and browser speech for voice output.

One shared server agent serves both text and voice. Voice is a thin browser layer (end of speech detection, upload, speak) around the same chat endpoint.

**Implementation skills**: `ai-sdk` (`vercel/ai`, `.claude/skills/ai-sdk/`). The skill says to verify every AI SDK API against the docs bundled in `node_modules/ai/docs/` for the installed version, and not to write from memory. Ignore its AI Gateway advice: this feature calls Groq directly through `@ai-sdk/groq`.

## Feature design

**Stack additions**:

| Piece | Choice | Notes |
|---|---|---|
| Agent library | `ai`, `@ai-sdk/react`, `@ai-sdk/groq` | `streamText` with tools on the server, `useChat` on the client; `zod` is already installed for tool schemas |
| Primary model | `openai/gpt-oss-120b` on Groq | Free tier: 30 RPM, 1K RPD, 8K TPM, 200K TPD; supports tool use |
| Backup model | `qwen/qwen3.8-27b` on Groq | Separate rate limit bucket with the same free limits; supports tool use; strong multilingual coverage |
| Speech to text | `whisper-large-v3-turbo` on Groq | Free tier: 20 RPM, 2K RPD, 7.2K audio seconds per hour, 28.8K per day |
| End of speech | `@ricky0123/vad-web` (Silero model, runs in the browser) | Only voiced audio is sent, which also stops Whisper from inventing text on silence |
| Text to speech | Browser `speechSynthesis` | Free and on device; Hindi voice availability varies by device |

Model ids are code constants in `src/lib/agent/models.ts`. Before shipping, check both ids against Groq's current model list. The Hindi smoke test (Build plan step 10) decides which model is primary. If the backup does better in Hindi, swap the two constants.

**Data model** (target, one migration):

`AgentSession` (new, clinic owned, table `agent_sessions`):

| Field | Type | Rule |
|---|---|---|
| `id` | String | cuid |
| `clinicId` | String | FK Clinic, `onDelete: Cascade` |
| `userId` | String | FK User (`User.id`, not Clerk id), `onDelete: Cascade` |
| `channel` | `AgentChannel` | `VOICE`, `TEXT` |
| `language` | `AgentLanguage` | `EN`, `HI`; updated when the patient switches |
| `provider` | String? | model id that served the last reply |
| `startedAt` | DateTime | default now |
| `endedAt` | DateTime? | null while open |
| `endReason` | `AgentEndReason`? | `COMPLETED`, `TIME_LIMIT`, `MESSAGE_LIMIT`, `PROVIDER_ERROR`, `ABANDONED` |
| `toolCallCount` | Int | default 0 |
| `turnCount` | Int | default 0 |
| `transcribeCount` | Int | default 0; audio uploads, capped at 60 |
| `appointmentId` | String? | composite FK `(appointmentId, clinicId)` to `Appointment(id, clinicId)`, `onDelete: NoAction` |

- Index `(clinicId, userId, startedAt)` (limit count and lazy close). Index `startedAt` (purge).
- `Appointment` gains `@@unique([id, clinicId])`, which the composite FK needs. This matches Doctor, Branch and ClinicPatient.
- Delete rule `NoAction`, not `SetNull`. Postgres `SET NULL` on a composite key nulls `clinicId` too, which is `NOT NULL`. App code never hard deletes appointments, and a clinic delete cascades both tables.
- Add `AgentSession` to `CLINIC_OWNED_MODELS`. The DMMF guard test enforces this.

**State transitions**: open (`endedAt` null) → ended (`endedAt` set, `endReason` set). It's one way. Every write that ends a session uses `updateMany where { id, endedAt: null }`, so the first ending wins and later ones are no ops.

**Server modules**:
- `src/lib/services/agent-session.ts` (added to the base client allowlist): `findOwnSession(sessionId, userId)` is the only unscoped read (`where { id, userId }`). Every other read and write goes through `forClinic(session.clinicId)`. It also holds start, limit check, lazy close, end, and turn claim.
- `src/lib/agent/policy.ts`: the fixed system prompt per language, and the sanitizer.
- `src/lib/agent/tools.ts`: `buildTools({ clinicId, db, clerkId, sessionId })`, which returns the three tools closed over the session.
- `src/lib/agent/models.ts`: model id constants.
- `src/lib/agent/sentences.ts` (client): splits streamed text into sentences on `.`, `!`, `?` and the Hindi danda `।`.

**API surface** (all `runtime = "nodejs"`; Clerk `auth()` on every route):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/agent/session` | POST | `clinicSlug` string, `channel` `VOICE`/`TEXT`, `language` `EN`/`HI` (zod) | `{ sessionId, limits: { perDay: 5, remainingToday, maxTurns: 40, voiceSeconds: 600, warnAtSeconds: 540 } }` | Clerk session | 401, 404 `CLINIC_UNAVAILABLE`, 422, 429 `{ resetsAt }` |
| `/api/agent/chat` | POST | `sessionId`, `language`, `messages` (UI messages from `useChat`) | AI SDK UI message stream | Clerk + own session | 401, 404, 409 `{ endReason }`, 422 |
| `/api/agent/transcribe` | POST | multipart: `audio` (webm/ogg/wav, at most 2 MB), `sessionId`, `language` | `{ text }` | Clerk + own open `VOICE` session | 401, 404, 409 (ended, past 600 s, or 60 uploads used), 413, 422 (not a `VOICE` session, bad audio), 502 |
| `/api/agent/session/end` | POST | `sessionId`, `reason` (`COMPLETED`/`ABANDONED` only) | 204 | Clerk + own session | 401, 404 (an already ended session returns 204) |

**Chat request flow** (in order):
1. Load the session with `findOwnSession`. Missing → 404. Ended → 409.
2. Voice only: if `now - startedAt` ≥ 600 s, end with `TIME_LIMIT` and return 409.
3. Claim a turn: `updateMany where { id, endedAt: null, turnCount: { lt: 40 } } data { turnCount: { increment: 1 } }`. Count 0 → end with `MESSAGE_LIMIT` and return 409.
4. If `language` differs from the row, update it.
5. Sanitize: keep only `user` and `assistant` text parts, the last 20 messages, each cut to 1,000 characters. Prepend the server policy for the language, plus today's date in `Asia/Kolkata`, plus the exact bookable dates from `getNext5Days()` (so the model never works out a date itself; this also covers 00:00 to 05:30 IST, when the server's UTC day lags India's), plus (voice, from 540 s) a "one minute left, wrap up" note.
6. Run `streamText` on the primary model with the tools: `maxRetries: 0`, at most 4 steps, `maxOutputTokens` 400. On failure before the first chunk, run the same call once on the backup. If both fail, stream a fixed reply with the booking form link (`/appointments`) and end with `PROVIDER_ERROR`. A failure after text has started streaming gets the same fixed ending, with no retry.
7. On finish, save `provider` (the serving model id).

**Tools** (each runs only on the session's clinic and user):

| Tool | Input (zod) | Does | Returns |
|---|---|---|---|
| `list_doctors` | `specialty?` string | `findAvailableDoctors(clinicId, { speciality }, { includePhone: false })`, sorted by name, first 10 | `id`, `name`, `speciality`, `branchName` per doctor |
| `get_free_slots` | `doctorId`, `date` (YYYY-MM-DD) | Doctor check (below). Date must be in `getNext5Days()`. `getAvailableTimeSlots()` minus `getBookedTimeSlotsForDoctor(doctorId, date, clinicId)` | free `HH:mm` list, "doctor not found", or "date not bookable" |
| `book_appointment` | `doctorId`, `date`, `time`, `reason?` (at most 200 chars) | Doctor check (below). Read the session's `appointmentId` again; if set, return "already booked" plus that booking. Else `createAppointmentForClerkUser(clerkId, input, clinicId)`, then `updateMany where { id, appointmentId: null }` sets `appointmentId` | `doctorName`, `date`, `time` of the booking; "already booked"; "doctor not found"; or "that time was just taken" |

- **Doctor check**: both slot and booking tools first run `db.doctor.findFirst({ where: { id: doctorId, isActive: true } })` on the clinic scoped client. No row (another clinic's id, an inactive doctor, an invented id) returns "doctor not found" and nothing else runs.
- **One tool at a time**: `buildTools` chains every tool `execute` on one promise inside its closure, so parallel tool calls in one model step run one after another. That makes the `appointmentId` read and the booking a single critical section within a request. If the final `updateMany` still returns count 0, return "already booked". `ponytail:` per request lock; switch to a `SELECT ... FOR UPDATE` on the session row if one session ever sends chat requests at the same time (the client never does).
- **Error mapping**: the error `This time slot is already booked for this doctor.` from `createAppointmentForClerkUser` becomes "that time was just taken". `CLINIC_UNAVAILABLE` passes through. Any other error becomes "booking failed, please use the booking form" and is logged with the session id only.

Every tool call increments `toolCallCount`. Tool errors return a short plain result to the model and never throw a stack trace into the stream.

**Changes to existing code**:
- `createAppointmentForClerkUser` and `getBookedTimeSlotsForDoctor` gain an optional `clinicId` parameter. It defaults to the Demo clinic, so the existing callers (booking form, Vapi webhook) keep working unchanged. When `clinicId` is given, the function loads the clinic and throws `CLINIC_UNAVAILABLE` unless its status is `ACTIVE` (the same rule `clinicBySlug` applies today), so a clinic suspended mid session cannot take bookings.
- `/api/cron/purge-clinics` also deletes `AgentSession` rows with `startedAt` older than 90 days, and logs both counts.
- `/voice` page: when `NEXT_PUBLIC_VOICE_ENGINE === "native"`, render the new `AgentPanel` with `clinicSlug = DEMO_CLINIC_SLUG`. Otherwise render `VapiWidget` as today.

**Client (`src/components/voice/AgentPanel.tsx` and children)**:
- The start screen has a language picker (default from `navigator.language`: `hi*` → HI, else EN), a Voice/Text toggle, the one line notice in the chosen language, and a Start button.
- Voice start order: `getUserMedia` first. If it's denied, show "Continue in text" (no session call). Then call `POST /api/agent/session`.
- `useChat` with a transport whose body carries `sessionId` and the current `language`. Text replies render as they stream.
- Voice loop: VAD `onSpeechEnd` → encode WAV → `/transcribe` → `sendMessage(text)` → split the stream into sentences → `speechSynthesis.speak` each one, using the first voice whose `lang` starts with `hi` or `en` (prefer `en-IN`). The mic is paused while speaking, so the agent does not hear itself.
- Timers come from `limits`: a banner at 9:00, and the mic stops at 10:00. The server stays authoritative.
- `pagehide` → `navigator.sendBeacon("/api/agent/session/end", { sessionId, reason: "ABANDONED" })`.
- Patient facing strings for this panel live in one EN/HI dictionary in the component folder. Full screen translation is Feature 6.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| start | `clinicId` | `clinicBySlug(clinicSlug)` input; `/voice` passes `DEMO_CLINIC_SLUG` |
| start | `userId` | `User` row by Clerk `auth().userId`. If missing, run the existing `syncUser()` then read again. Still missing → 401 |
| start | day start | `now` truncated to 00:00 UTC (derived) |
| start | `remainingToday`, `resetsAt` | 5 minus the count of rows `(clinicId, userId, startedAt ≥ day start)`; `resetsAt` = day start + 24 h |
| start | `channel`, `language` | request input (zod enums) |
| chat | `clinicId`, `userId` for tools | the session row (never the request) |
| chat | `clerkId` for booking | Clerk `auth().userId` of the caller, who owns the session (checked at step 1) |
| chat | reply language | request `language`, saved to the row |
| chat | today's date in the prompt | server clock formatted in `Asia/Kolkata` (all branches are in India; switch to the branch timezone when one is not) |
| chat | elapsed voice time | `now - session.startedAt` |
| chat | turn number | `turnCount` after the atomic increment |
| chat | `provider` | the model id constant that served the reply |
| chat | fallback link | the fixed path `/appointments` |
| get_free_slots | bookable dates | `getNext5Days()` (same as the booking form) |
| get_free_slots | slot grid | `getAvailableTimeSlots()` (same as the booking form; Feature 9 replaces it with doctor schedules) |
| book_appointment | patient record | `getOrCreateClinicPatient` inside `createAppointmentForClerkUser`, for the session user |
| chat | bookable dates in the prompt | `getNext5Days()`, the same list the tool checks |
| transcribe | Whisper `language` | request `language` mapped `EN`→`en`, `HI`→`hi` |
| transcribe | upload number | `transcribeCount` after a guarded increment (`updateMany where { id, endedAt: null, channel: VOICE, transcribeCount: { lt: 60 } }`) |
| book_appointment | result shown to the patient | `doctorName`, `date`, `time` from `transformAppointment` (its `clinicName` is empty, so it is not returned) |
| UI | notice text, voice choice | EN/HI dictionary in the panel; `speechSynthesis.getVoices()` |
| UI | warn and stop times | `limits.warnAtSeconds`, `limits.voiceSeconds` from the start response |

**Key invariants**:
- A tool never takes a user or clinic id from model output. Both come from the session row and the Clerk caller.
- At most one open session per (user, clinic) after any start. At most one `appointmentId` per session.
- `turnCount` ≤ 40 and `transcribeCount` ≤ 60. Both are enforced by guarded increments, not by counting client history.
- The policy prompt always comes from the server. The client cannot add system text.
- No request body, transcript or model output is passed to `console.*`. Logs carry `{ sessionId, event, provider, endReason }` only.

**Security model**:
- Every route requires a Clerk session. Ownership is enforced by `findOwnSession(sessionId, userId)` (404 for anyone else's session, so ids leak nothing).
- `GROQ_API_KEY` is server only. The browser never talks to Groq.
- Prompt injection is contained: whatever the patient says, the tools can only read this clinic's doctors and book for this user.
- Compliance: DPDP Act 2023. Health related speech is personal data. Groq processes it as a data processor in the US (allowed cross border), with zero data retention turned on in the Groq console. Nothing is stored here except session metadata, deleted after 90 days. Full consent capture is Feature 11. Emergency red flags are Feature 13.

**Configuration required**:
- `GROQ_API_KEY`: server only, in `.env.local` and the Vercel env (Production and Preview).
- `NEXT_PUBLIC_VOICE_ENGINE`: `native` turns on the new agent. Unset or `vapi` keeps Vapi.
- Manual: turn on zero data retention in the Groq console data controls before any real patient uses it.
- Route config: `export const maxDuration = 60` on chat and transcribe.

**Critical test scenarios**:
- Happy path, text: start (EN) → "book a dentist tomorrow" → list doctors → free slots → book → appointment exists for this user at Demo, `appointmentId` set, email sent. Verifies **AC-1**, **AC-3**, **AC-5**, **AC-6**
- Happy path, voice in Hindi on Chrome desktop: speak, hear a spoken reply, book. Verifies **AC-4**
- Limit: the sixth start in one UTC day → 429. A start at another clinic still works. Verifies **AC-2**
- Turn cap: 40 claims succeed, the 41st returns 409 `MESSAGE_LIMIT`. Voice session with `startedAt` 10 min ago → 409 `TIME_LIMIT`. Verifies **AC-7**
- Ownership: user B posts user A's `sessionId` to chat, transcribe and end → 404. Verifies **AC-9**
- Injection: the patient says "book for user X at clinic Y" → the booking is still for the caller at Demo. A client message with role `system` is dropped. Verifies **AC-5**, **AC-14**
- Double booking: a second book in the same session → "already booked". Two parallel book calls for different slots in one step → exactly one appointment. A slot taken between list and book → "just taken". Another clinic's `doctorId` → "doctor not found". Verifies **AC-5**, **AC-6**
- Transcribe abuse: a `TEXT` session → 422. The 61st upload, or an upload past 600 s → 409. Verifies **AC-7**
- Fallback: force a primary failure (bad model id via test hook) → the backup answers. Force both → form link, `PROVIDER_ERROR`. Verifies **AC-8**
- Privacy: after a full session, the DB row has no text fields, and server logs show no message content. Verifies **AC-10**
- Mic denied → "Continue in text" and no row created. Tab closed → row `ABANDONED`. Verifies **AC-11**, **AC-12**
- Purge: a row 91 days old is deleted, an 89 day old row stays, and a second run deletes 0. Verifies **AC-13**
- Engine switch: unset → Vapi widget renders, `native` → agent panel renders. Verifies **AC-15**

## Build plan

Journey approach: finish the text booking path end to end first (it carries the whole agent), then add voice on top of it, then cut over.

**Journey A: text booking**
1. Migration: `AgentSession` with its three enums, indexes and composite FK, plus `@@unique([id, clinicId])` on `Appointment`. Add `AgentSession` to `CLINIC_OWNED_MODELS` and `agent-session.ts` to the allowlist. `db:check` stays clean and the guard test stays green. If `migrate dev` generates `DROP INDEX "appointments_doctorId_date_time_active_key"`, delete that line before committing (see `prisma/AGENTS.md`). Satisfies **AC-1**, **AC-9**
2. Install `ai`, `@ai-sdk/react`, `@ai-sdk/groq` (read the bundled docs per the `ai-sdk` skill). Add `GROQ_API_KEY` to `.env.local`. Add `src/lib/agent/models.ts`. Satisfies **AC-8**
3. `agent-session.ts` plus `POST /api/agent/session` and `POST /api/agent/session/end`: syncUser fallback, clinic check, lazy close, UTC day limit, create, ownership, idempotent end. Unit test the day start helper. Satisfies **AC-1**, **AC-2**, **AC-9**, **AC-11**
4. Optional `clinicId` on `createAppointmentForClerkUser` and `getBookedTimeSlotsForDoctor` (Demo default, ACTIVE check when given). `src/lib/agent/tools.ts` with the three tools, the doctor check, the one tool at a time chain, the one booking rule and the error mapping. Satisfies **AC-5**, **AC-6**
5. `src/lib/agent/policy.ts` (EN and HI policy, sanitizer with unit tests) and `POST /api/agent/chat`: turn claim, language update, time cap, primary then backup, form link fallback, provider save, content free logging. Satisfies **AC-3**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-14**
6. `AgentPanel` text mode on `/voice` behind `NEXT_PUBLIC_VOICE_ENGINE`: start screen (language, notice, toggle), streaming chat, End button, `pagehide` beacon. Satisfies **AC-3**, **AC-10**, **AC-11**, **AC-15**

**Journey B: voice booking**
7. `POST /api/agent/transcribe`: size and type checks, open `VOICE` session check, 600 s check, guarded `transcribeCount` increment, Groq Whisper through the AI SDK transcription API. Satisfies **AC-4**, **AC-7**, **AC-9**
8. Voice mode in `AgentPanel`: mic permission check first, VAD, WAV upload, sentence splitter (unit tested with the danda), `speechSynthesis` voice pick with a text fallback, mic pause while speaking, 9 min banner and 10 min stop. Satisfies **AC-4**, **AC-7**, **AC-12**

**Cutover and retention**
9. Extend `/api/cron/purge-clinics` with the 90 day `AgentSession` delete. Satisfies **AC-13**
10. Hindi smoke test of both model ids (5 scripted Hindi and Hinglish booking turns each). Set primary and backup by the result, then verify both journeys with `NEXT_PUBLIC_VOICE_ENGINE=native` locally. Satisfies **AC-3**, **AC-4**, **AC-8**, **AC-15**

## Consequences

**Positive**:
- No Vapi credit to run out. Voice and text share one agent, one policy and one set of tools, all in this repo.
- Tools run on the server against the session row, which closes the Vapi webhook's "trust the caller's userId" gap for the new path.
- No new infrastructure: same Vercel project, same database, one new env var.

**Negative / tradeoffs**:
- Capacity is small. At about 2.5K tokens per model call and roughly 8 calls per session, 200K tokens a day per model means about 7 conversations a day on the primary, plus about 7 more on the backup, for the whole platform. And 8K tokens a minute allows only one or two conversations at a time. Past that, patients get the booking form link. That is fine for a one clinic pilot. Going beyond it means Groq's paid tier, which breaks zero spend.
- Turn based voice feels slower than real time voice: about 1 to 3 seconds per turn (upload, transcribe, first sentence), and the patient cannot interrupt the agent mid sentence.
- Browser voices vary: many Android and Windows devices lack a Hindi voice and fall back to text. Voice quality is below Vapi's.
- Free tier open models may make more tool calling mistakes than the large hosted model behind Vapi today (not measured; the Hindi smoke test is the first check). The step limit and server side checks contain them, but they show up as clumsy turns.
- Two voice engines live side by side until Vapi is removed.

**Neutral**:
- The day limit count and the start are not one locked transaction, so two simultaneous starts by one user could make a sixth session. That's harmless at this scale. Add an advisory lock if it ever matters.
- One booking per session also means rescheduling inside a session is not supported. The patient starts a new session.

## Follow-up

- [ ] Before real patients: create the Groq API key, turn on zero data retention, and add `GROQ_API_KEY` and `NEXT_PUBLIC_VOICE_ENGINE` to Vercel (your manual steps).
- [ ] After AC-15 is verified in production with `native`: remove Vapi. First move `safeEqual` out of `src/lib/vapi-auth.ts` (the purge cron imports it), then delete `VapiWidget.tsx`, `src/lib/vapi*.ts`, `/api/vapi/tools`, `getVoiceCallToken`, Vapi env vars), and update `src/components/voice/AGENTS.md`, which describes Vapi today (via `/sync`).
- [ ] `ai-sdk` conventions are not yet in any `AGENTS.md`. They are area scoped, so they belong in a nested `src/lib/agent/AGENTS.md` with a one line pointer from root `## Context files`, not in root `## Rules`.
- [ ] Watch daily Groq usage during the pilot. When fallbacks to the form become common, decide between Groq's paid tier and a second free provider that does not train on inputs.
- [ ] Emergency red flags in conversation (Feature 13) and recorded consent (Feature 11) build on this agent's policy and start screen.
