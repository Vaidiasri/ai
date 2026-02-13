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
import React, { useState } from "react";

// --- Types & Constants ---
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

// --- Main Component ---
const Navbar = () => {
  const pathname = usePathname();
  const { user } = useUser();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.emailAddresses.some(
    (email) => email.emailAddress === adminEmail,
  );

  // Memoized navigation links
  const navLinks = React.useMemo(() => {
    return isAdmin ? [...STATIC_LINKS, ADMIN_LINK] : STATIC_LINKS;
  }, [isAdmin]);

  if (pathname === "/") return null;

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed top-0 right-0 left-0 z-50 px-6 py-4 bg-zinc-950/50 backdrop-blur-2xl border-b border-white/5 transition-all duration-500 supports-[backdrop-filter]:bg-zinc-950/20"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-[1fr_auto_1fr] items-center h-full relative">
        {/* Left: Branding */}
        <div className="flex justify-start items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-orange-500/50 rounded-lg"
            aria-label="Go to Dashboard"
          >
            <div className="w-8 h-8 relative transition-transform duration-300 group-hover:scale-110">
              <Image
                src="/logo.png"
                alt="FullStackAI Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-lg font-bold tracking-wide bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent group-hover:to-white transition-all duration-300">
              FullStackAI
            </span>
          </Link>
        </div>

        {/* Center: Desktop Navigation (Grid placement: col-start-2) */}
        <div className="hidden md:flex items-center justify-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                  isActive
                    ? "text-white bg-white/5 border border-white/10 shadow-[0_0_15px_-3px_rgba(249,115,22,0.1)]"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 to-transparent blur-lg rounded-full animate-pulse-slow pointer-events-none" />
                )}
                <Icon
                  className={`w-4 h-4 relative z-10 transition-colors duration-300 ${isActive ? "text-orange-400" : "text-zinc-500 group-hover:text-white"}`}
                />
                <span className="relative z-10 text-sm font-medium tracking-tight">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Right: User Section */}
        <div className="flex justify-end items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2 text-right">
            <span className="text-sm font-semibold text-white/90 leading-tight">
              {user?.fullName || "Guest User"}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
          </div>

          <div className="p-[2px] rounded-full bg-gradient-to-tr from-orange-500/20 via-transparent to-white/5 transition-all duration-300 hover:from-orange-500/40">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox:
                    "w-9 h-9 border-2 border-zinc-900 ring-1 ring-white/10 hover:ring-orange-500/50 transition-all shadow-lg",
                },
              }}
            />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-zinc-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 rounded-lg transition-colors"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-zinc-950/95 backdrop-blur-2xl border-b border-white/10 p-4 flex flex-col gap-2 animate-in slide-in-from-top-2 z-40 shadow-2xl">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all active:scale-[0.98] ${
                  isActive
                    ? "bg-white/10 text-white border border-white/5 shadow-inner"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${isActive ? "text-orange-400" : "text-zinc-500"}`}
                />
                <span className="font-medium">{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
