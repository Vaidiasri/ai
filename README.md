# FullStackAI - Intelligent Dental Assistant Platform 🦷

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Status](https://img.shields.io/badge/Status-Development-orange.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-cyan)

A modern, full-stack application designed to revolutionize dental practice management with AI-powered features, premium UI/UX, and robust administrative controls.

## 🚀 Key Features

### 💎 Premium User Experience

- **Glassmorphism UI**: High-end aesthetic with blurred backdrops and refined gradients.
- **Dark Mode First**: Sleek, eye-friendly interface designed for professional environments.
- **Responsive Design**: Seamless experience across desktop, tablet, and mobile.
- **Advanced Navbar**: Animated, accessible navigation with role-based visibility.

### 🔐 Authentication & Security

- **Clerk Integration**: Secure, seamless authentication (Google, Email, etc.).
- **Role-Based Access Control (RBAC)**: Dedicated Admin Dashboard protected by server-side logic.
- **Data Privacy**: Secure user synchronization and session management.

### 🛠️ Core Functionality

- **Dashboard**: Central hub for managing appointments and patient data.
- **Admin Panel**: Restricted area for practice management and oversight.
- **User Management**: Automatic profile synchronization via webhooks.
- **Performance**: Optimized with TanStack Query for efficient data fetching.

## 💻 Tech Stack

- **Frontend**: [Next.js 14](https://nextjs.org/) (App Router), [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) (Icons)
- **Backend**: Next.js Server Actions, API Routes
- **Database**: [PostgreSQL](https://www.postgresql.org/), [Prisma ORM](https://www.prisma.io/)
- **Auth**: [Clerk](https://clerk.com/)
- **State Management**: [TanStack Query](https://tanstack.com/query/latest)

## ⚡ Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL Database URL
- Clerk API Keys

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Vaidiasri/fullstackai.git
    cd fullstackai
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    # or
    npm install --legacy-peer-deps
    ```

3.  **Configure environment variables:**
    Create a `.env` file in the root directory:

    ```env
    # Database
    DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

    # Clerk Auth
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
    CLERK_SECRET_KEY=sk_test_...

    # Admin
    NEXT_PUBLIC_ADMIN_EMAIL=admin@example.com
    ADMIN_EMAIL=admin@example.com
    ```

4.  **Set up the database:**

    ```bash
    npx prisma generate
    npx prisma db push
    ```

5.  **Run the development server:**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📂 Project Structure

```
src/
├── app/                  # App Router pages & layouts
│   ├── (auth)/           # Authentication routes
│   ├── admin/            # Admin dashboard
│   ├── dashboard/        # User dashboard
│   ├── api/              # API endpoints
│   └── page.tsx          # Landing page
├── components/           # Reusable UI components
│   ├── landing/          # Landing page specific components
│   ├── providers/        # Context providers (TanStack, Clerk)
│   └── Navbar.tsx        # Main navigation
├── lib/                  # Utilities & configurations
│   ├── prisma.ts         # Prisma client singleton
│   └── utils.ts          # Helper functions
└── ...
```

## 🤝 Contributing

We follow strict "UI Master" workflows for contributions:

1.  Run `/feature-reviewer` before committing.
2.  Use `/pr-raiser` to create focused pull requests.
3.  Adhere to the 25-Year Senior Dev standards (Semantic HTML, A11y, Performance).

---

© 2024 FullStackAI. All rights reserved.
