# DentWise: Modern Dental Management with AI Voice Integration

DentWise is an advanced dental clinic management platform designed to streamline patient booking, appointment management, and automated patient communication. Featuring a cutting-edge AI Voice Assistant, DentWise provides a seamless bridge between modern clinical needs and automated patient interactions.

![DentWise Platform Banner](/public/dentwise-banner.png)

## Core Features

### Intelligent Appointment Management

* **3-Step Patient Booking**: A structured workflow for selecting practitioners, services, and time slots.
* **Clinic Dashboard**: A centralized administrative view for managing upcoming appointments and patient statistics.
* **Real-time Availability**: Dynamic slot management to prevent double-bookings and ensure scheduling accuracy.

### AI Voice Assistant (Powered by Vapi)

* **Natural Language Booking**: Patients can schedule, reschedule, or inquire about appointments through a sophisticated voice interface.
* **Seamless Integration**: The voice agent interacts directly with the system's database to retrieve availability and record bookings in real-time.

### Enterprise-Grade Security

* **Robust Authentication**: Powered by Clerk, supporting Google, GitHub, and secure Email/Password authentication.
* **Session Management**: Secure handling of user sessions and protected API routes for administrative tasks.

### Automated Notifications

* **Confirmation Emails**: Professional email notifications sent via Resend immediately upon successful booking.
* **Standardized Date Formatting**: Consistent, localized date and time representation across all communication channels.

## Technology Stack

| Layer | Technologies |
|---|---|
| **Core Framework** | Next.js 15 (App Router), TypeScript |
| **Styling** | Tailwind CSS, Shadcn UI, Radix UI |
| **Database** | PostgreSQL, Prisma ORM |
| **Authentication** | Clerk Auth |
| **AI / Voice** | Vapi AI |
| **Email Service** | Resend, React Email |
| **State Management** | TanStack Query |
| **Quality Control** | Biome (Linting & Formatting) |

## Getting Started

### Prerequisites

* Node.js 18+
* PostgreSQL Database
* Accounts with Clerk, Vapi, and Resend

### Installation

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Initialize the database schema:

   ```bash
   npx prisma generate
   npx prisma db push
   ```

### Configuration

Create a `.env.local` file in the root directory and configure the following variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."

# Vapi Voice Assistant
NEXT_PUBLIC_VAPI_ASSISTANT_ID="..."
NEXT_PUBLIC_VAPI_API_KEY="..."

# Email Service (Resend)
RESEND_API_KEY="..."

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"
```

### Development

Start the development server:

```bash
npm run dev
```

## Maintenance & Code Quality

This project uses **Biome** for strict linting and formatting standards.

```bash
# Check for linting issue
npm run lint

# Automatically format code
npm run format
```

---
Developed with a focus on performance, scalability, and exceptional patient experience.
