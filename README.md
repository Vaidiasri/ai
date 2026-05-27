# DentWise

DentWise is a full-stack dental clinic management platform with an AI voice assistant. Patients can book appointments through the web or by talking to **Riley** (Vapi). Admins manage doctors, clinics, and appointments from a protected dashboard.

![DentWise Platform Banner](/public/dentwise-banner.png)

## Features

- **3-step booking** — Select doctor, date/time, and appointment type
- **Patient dashboard** — Overview, upcoming appointments, quick actions
- **AI voice assistant** — Natural-language doctor search and booking (Vapi)
- **Admin panel** — Doctor CRUD, appointment stats (email-gated via `ADMIN_EMAIL`)
- **Confirmation emails** — Sent automatically via Resend after booking
- **Slot protection** — Canonical time format + DB unique index on active appointments

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, Radix UI |
| Database | PostgreSQL (Neon), Prisma ORM |
| Auth | Clerk |
| Voice AI | Vapi (`@vapi-ai/web`) |
| Email | Resend, React Email |
| Data fetching | TanStack Query |
| Lint / format | Biome |

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing (redirects logged-in users to dashboard)
│   ├── dashboard/            # Patient home
│   ├── appointments/         # 3-step booking wizard
│   ├── voice/                # Vapi voice UI
│   ├── admin/                # Admin dashboard
│   ├── pro/                  # Pricing / upgrade
│   └── api/
│       ├── vapi/tools/       # Vapi server webhook (tool execution)
│       └── send-appointment-email/
├── components/               # UI by feature (landing, dashboard, voice, admin)
├── lib/
│   ├── actions/              # Server Actions (appointments, doctors, users)
│   ├── services/             # Email, core booking logic
│   ├── auth.ts               # requireAuth, requireAdmin, Vapi webhook verify
│   └── utils/time.ts         # Canonical date/time helpers
prisma/                       # Schema + migrations
scripts/                      # DB utilities (seed, time migration)
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database ([Neon](https://neon.tech) recommended)
- [Clerk](https://clerk.com) application
- [Vapi](https://vapi.ai) assistant
- [Resend](https://resend.com) API key

### Install

```bash
git clone https://github.com/Vaidiasri/ai.git
cd ai
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
# Database (use Neon pooler URL for the app)
DATABASE_URL="postgresql://..."

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Vapi
NEXT_PUBLIC_VAPI_ASSISTANT_ID="..."
NEXT_PUBLIC_VAPI_API_KEY="..."
VAPI_WEBHOOK_SECRET="..."          # Server URL secret in Vapi dashboard
VAPI_PRIVATE_KEY="..."             # Optional: server-side Vapi API scripts

# Resend
RESEND_API_KEY="re_..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_EMAIL="your-admin@email.com"

# Optional
GOOGLE_MAPS_API_KEY="..."          # Geocoded doctor search by location
```

### Database Setup

**Fresh database:**

```bash
npx prisma generate
npx prisma migrate deploy
node scripts/seed-doctors.js       # optional sample doctors
```

**Existing database with appointment data:**

```bash
npm run db:migrate-times           # normalize legacy times + dedupe slots
npx prisma migrate deploy
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Vapi Configuration

1. Create an assistant in the [Vapi dashboard](https://dashboard.vapi.ai).
2. Attach tools: `get_doctors`, `get_current_user`, `initiate_payment`, `book_appointment`.
3. Set the **Server URL** (for server-side tools):
   - Local: use [ngrok](https://ngrok.com) → `https://<tunnel>/api/vapi/tools`
   - Production: `https://<your-domain>/api/vapi/tools`
4. Set **Server URL Secret** to the same value as `VAPI_WEBHOOK_SECRET` in `.env.local`.
5. Client-side tools (`initiate_payment`, and optionally `get_doctors` / `book_appointment`) are handled in `VapiWidget.tsx`.

Pass the Clerk user ID into calls via `variableValues.userId` so bookings attach to the correct patient.

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Prisma generate + production build |
| `npm run start` | Start production server |
| `npm run lint` | Biome check |
| `npm run format` | Biome format |
| `npm run db:migrate-times` | Normalize appointment times in DB |
| `npm run db:migrate` | Time migration + `prisma migrate deploy` |
| `npm run db:push` | Push schema without migrations (dev only) |

## Deployment (Vercel)

### Build status

Production build: `npm run build` (includes `prisma generate`).

### Checklist

| Step | Action |
|------|--------|
| 1 | Push to GitHub |
| 2 | Import project on Vercel |
| 3 | Add all env vars from `.env.local` (use **production** Clerk keys) |
| 4 | Set `NEXT_PUBLIC_APP_URL` to your production domain |
| 5 | Run `npx prisma migrate deploy` (post-deploy or CI, prefer direct Neon URL for migrations) |
| 6 | Configure Vapi Server URL → `https://<domain>/api/vapi/tools` |
| 7 | Verify a custom domain in Resend and update `from` in `src/lib/services/email.ts` |

### Production notes

- **Resend**: Replace `onboarding@resend.dev` with a verified domain sender before launch.
- **Clerk**: Use production keys (`pk_live_` / `sk_live_`), not test keys.
- **Payments**: Voice payment UI is simulated; Stripe integration is not complete.
- **Pro gating**: `/voice` may have plan checks disabled for testing — re-enable before monetizing.

## Security

- Admin server actions require `ADMIN_EMAIL` match
- `/api/vapi/tools` requires `VAPI_WEBHOOK_SECRET` (development allows requests without secret with a warning)
- `/api/send-appointment-email` requires Clerk auth; recipient must match signed-in user
- Appointment times stored as canonical 24h `HH:mm`; active slots protected by partial unique index

## Code Quality

```bash
npm run lint
npm run format
```

---

Built for performance, secure booking, and a smooth patient experience.
