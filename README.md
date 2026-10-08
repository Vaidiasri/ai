# DentWise: AI Front Desk for Clinics

DentWise is a clinic booking platform with an AI front desk. Patients book by web form, by voice, or by chatting with an AI agent that lists doctors and books slots on their behalf. It is becoming a multi clinic app for small clinics in India: many clinics share one deployment, each with its own isolated data.

![DentWise Platform Banner](/public/dentwise-banner.png)

## Core Features

### Appointment Management

* **3-Step Patient Booking**: Pick a doctor, a service, and a time slot.
* **No Double Bookings**: A database index blocks two active bookings on the same doctor, date, and time.
* **Patient Dashboard**: Signed in patients see their upcoming appointments across clinics.

### AI Agent (Groq, server side tools)

* **Text and Voice Modes**: Chat with the agent, or talk hands free with voice activity detection, Whisper transcription, and spoken replies.
* **English and Hindi**: The agent handles English, Hindi, and Hinglish booking conversations.
* **Clinic Scoped Tools**: Booking tools run on the server and only see the current clinic's doctors and slots.
* **Limits Built In**: Daily session limits, a 10 minute voice cap, and automatic purge of old sessions.
* **Engine Switch**: `NEXT_PUBLIC_VOICE_ENGINE=native` shows the new agent on `/voice`; unset or `vapi` keeps the original Vapi voice widget.

### Multi Clinic Tenancy

* **Isolated Data**: Every doctor and appointment belongs to one clinic, and queries go through a tenancy module that scopes them.
* **Platform Admin**: The admin can suspend and restore clinics. A daily cron deletes clinics suspended for more than 30 days.
* **Isolation Guard Tests**: `npm run check:isolation` proves one clinic cannot read another's data.

### Security

* **Authentication**: Clerk, with Google, GitHub, and email/password sign in.
* **Protected Server Actions**: Every action is guarded by `requireAuth()` or `requireAdmin()`.
* **Signed Voice Calls**: The Vapi webhook requires a shared secret and a signed call token, so a caller cannot book for another user.

### Notifications

* **Confirmation Emails**: Sent via Resend with React Email immediately after a booking.

## Technology Stack

| Layer | Technologies |
| --- | --- |
| **Core Framework** | Next.js 15 (App Router, Turbopack), React 19, TypeScript |
| **Styling** | Tailwind CSS 4, shadcn/ui, Radix UI |
| **Database** | PostgreSQL (Supabase), Prisma 6 |
| **Authentication** | Clerk |
| **AI Agent** | Vercel AI SDK, Groq |
| **Voice (legacy)** | Vapi |
| **Email** | Resend, React Email |
| **State Management** | TanStack Query |
| **Quality** | Biome (lint and format), Vitest, `tsc` |
| **Hosting** | Vercel (with Vercel Cron) |

## Getting Started

### Prerequisites

* Node.js 20.6+ (the `db:*` scripts use `node --env-file`)
* A PostgreSQL database (Supabase recommended)
* Accounts with Clerk, Groq, Resend, and optionally Vapi

### Configuration

Create `.env.local` in the project root. Keep every comment on its own line: `prisma.config.ts` parses this file itself and reads an inline `# comment` as part of the value. URL encode special characters in `DATABASE_URL` (for example `@` becomes `%40`).

```env
# Database: use the Supabase Session pooler URL (the direct host is IPv6 only)
DATABASE_URL="postgresql://..."

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."

# AI agent (server only, the browser never talks to Groq)
GROQ_API_KEY="..."
# "native" shows the Groq agent on /voice; unset or "vapi" shows the Vapi widget
NEXT_PUBLIC_VOICE_ENGINE="native"

# Vapi voice widget (only needed when NEXT_PUBLIC_VOICE_ENGINE is unset or "vapi")
NEXT_PUBLIC_VAPI_ASSISTANT_ID="..."
NEXT_PUBLIC_VAPI_API_KEY="..."
# Same value as "Server URL Secret" in the Vapi dashboard; the webhook returns 401 without it
VAPI_WEBHOOK_SECRET="..."
# Random 32+ bytes, server only, signs voice call tokens
# node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
VAPI_CALL_TOKEN_SECRET="..."
# Vapi private API key (server side scripts only)
VAPI_PRIVATE_KEY="..."

# Email
RESEND_API_KEY="..."

# Cron: Vercel sends this as a bearer token to /api/cron/purge-clinics
CRON_SECRET="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"

# Optional: geocoding for doctor addresses (disabled when unset)
GOOGLE_MAPS_API_KEY="..."
```

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up the database:

   ```bash
   npx prisma generate
   npm run db:migrate   # apply prisma/migrations
   npm run db:check     # exit 0 means the database matches schema.prisma
   npm run db:seed      # optional: five sample doctors
   ```

   Change the schema with `npx prisma migrate dev`. If the generated SQL drops `appointments_doctorId_date_time_active_key`, delete that line before committing.

3. Start the dev server at <http://localhost:3000>:

   ```bash
   npm run dev
   ```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | `prisma generate`, then a production build (fails on type errors) |
| `npm run lint` | Biome lint and format check |
| `npm run format` | Biome format, writing changes |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run check:isolation` | Clinic isolation tests against the real database |
| `npm run db:migrate` | Apply migrations |
| `npm run db:check` | Check the database for schema drift |
| `npm run db:seed` | Seed sample doctors |

Run `npm run typecheck`, `npm test`, and `npm run lint` before opening a PR.

## Deployment

The app deploys to Vercel. Add every variable above to the Vercel project (Production, and Preview where needed). `vercel.json` schedules `/api/cron/purge-clinics` daily at 03:00 UTC. That route refuses every request when `CRON_SECRET` is unset.

## Project Docs

* [AGENTS.md](AGENTS.md): conventions and rules for contributors and AI agents
* [docs/scope/scope.md](docs/scope/scope.md): the product roadmap and feature status
* [docs/specs/](docs/specs/): design specs for each feature
