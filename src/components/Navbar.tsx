"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  CalendarDays,
  Mic,
  Crown,
  Settings,
  Menu,
  X,
  LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useCallback } from "react";

// ─── Types & Config ─────────────────────────────────────────────
interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const STATIC_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/voice", label: "Voice", icon: Mic },
  { href: "/pro", label: "Pro", icon: Crown },
];

const ADMIN_LINK: NavLink = { href: "/admin", label: "Admin", icon: Settings };

// ─── Component ──────────────────────────────────────────────────
const Navbar = () => {
  const pathname = usePathname();
  const { user } = useUser();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.emailAddresses.some(
    (email) => email.emailAddress === adminEmail,
  );

  const navLinks = React.useMemo(() => {
    return isAdmin ? [...STATIC_LINKS, ADMIN_LINK] : STATIC_LINKS;
  }, [isAdmin]);

  const closeMobile = useCallback(() => setIsMobileMenuOpen(false), []);

  // Don't render on landing
  if (pathname === "/") return null;

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6 py-3 bg-[#0a0c14]/70 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_40px_rgba(0,0,0,0.4)] transition-all duration-500"
    >
      <div className="max-w-[1280px] mx-auto flex items-center justify-between">
        {/* ── Logo ───────────────────────────────────────────── */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 rounded-lg"
          aria-label="Go to Dashboard"
        >
          <div className="w-8 h-8 relative transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/logo.png"
              alt="FullStackAI Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-lg font-bold tracking-tight text-white/90 group-hover:text-white transition-colors duration-300">
            FullStackAI
            <span className="text-purple-400 ml-[1px]">.</span>
          </span>
        </Link>

        {/* ── Desktop Nav ────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`
                  relative flex items-center gap-2 px-4 py-2 rounded-full
                  text-[0.8125rem] font-medium tracking-wide
                  transition-all duration-300 group
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40
                  ${
                    isActive
                      ? "text-white bg-white/[0.06] border border-white/[0.08] shadow-[0_0_20px_-4px_rgba(168,85,247,0.12)]"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                  }
                `}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active glow pulse */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/[0.08] to-transparent rounded-full blur-md pointer-events-none animate-pulse" />
                )}
                <Icon
                  className={`w-4 h-4 relative z-10 transition-all duration-300 ${
                    isActive
                      ? "text-purple-400"
                      : "text-zinc-500 group-hover:text-zinc-300"
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className="relative z-10">{link.label}</span>
              </Link>
            );
          })}
        </div>

        {/* ── Right Section ──────────────────────────────────── */}
        <div className="flex items-center gap-3">
          {/* User Info — Desktop only */}
          <div className="hidden md:flex flex-col items-end mr-1 text-right">
            <span className="text-[0.8125rem] font-semibold text-white/85 leading-tight truncate max-w-[140px]">
              {user?.fullName || "Guest User"}
            </span>
            <span className="text-[0.625rem] text-zinc-500 font-medium uppercase tracking-[0.06em]">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
          </div>

          {/* Avatar */}
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-purple-500/25 via-transparent to-white/[0.06] transition-all duration-300 hover:from-purple-500/40">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox:
                    "w-9 h-9 border-2 border-[#0a0c14] ring-1 ring-white/[0.08] hover:ring-purple-400/40 transition-all duration-300 shadow-lg",
                },
              }}
            />
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="md:hidden relative w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors duration-300 rounded-xl hover:bg-white/[0.05] cursor-pointer"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            <span
              className={`absolute transition-all duration-300 ${
                isMobileMenuOpen
                  ? "rotate-0 opacity-100"
                  : "rotate-90 opacity-0"
              }`}
            >
              <X size={20} strokeWidth={2} />
            </span>
            <span
              className={`absolute transition-all duration-300 ${
                isMobileMenuOpen
                  ? "-rotate-90 opacity-0"
                  : "rotate-0 opacity-100"
              }`}
            >
              <Menu size={20} strokeWidth={2} />
            </span>
          </button>
        </div>
      </div>

      {/* ── Mobile Menu ────────────────────────────────────── */}
      <div
        className={`
          md:hidden overflow-hidden
          transition-all duration-400 ease-out
          ${isMobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="px-2 pt-3 pb-4 mt-3 mx-2 rounded-2xl bg-[#0e1018]/90 backdrop-blur-2xl border border-white/[0.06] space-y-1 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobile}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl
                  text-[0.9375rem] font-medium
                  transition-all duration-200 active:scale-[0.98]
                  ${
                    isActive
                      ? "text-white bg-white/[0.06] border border-white/[0.06]"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                  }
                `}
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? "text-purple-400" : "text-zinc-500"
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
