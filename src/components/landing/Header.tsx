"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";

// ─── Config ─────────────────────────────────────────────────────
const NAV_LINKS = [
  { href: "#how-it-works", label: "How it Works" },
  { href: "#what-to-ask", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About" },
];

// ─── Component ──────────────────────────────────────────────────
const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHash, setActiveHash] = useState("");

  // Scroll detection for navbar bg transition
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // IntersectionObserver for active section highlight
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHash(`#${entry.target.id}`);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );

    NAV_LINKS.forEach(({ href }) => {
      const el = document.getElementById(href.slice(1));
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const closeMobile = useCallback(() => setIsMobileMenuOpen(false), []);

  return (
    <nav
      aria-label="Main Navigation"
      className={`
        fixed top-0 inset-x-0 z-50
        transition-all duration-500 ease-out
        ${
          scrolled
            ? "py-3 bg-[#0a0c14]/75 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_40px_rgba(0,0,0,0.45)]"
            : "py-5 bg-transparent border-b border-transparent"
        }
      `}
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex items-center justify-between">
        {/* ── Logo ─────────────────────────────────────────────── */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 rounded-lg"
          aria-label="Go to Homepage"
        >
          <div className="w-9 h-9 relative transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/logo.png"
              alt="FullStackAI Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-[1.15rem] font-bold tracking-tight text-white/90 group-hover:text-white transition-colors duration-300">
            FullStackAI
            <span className="text-purple-400 ml-[1px]">.</span>
          </span>
        </Link>

        {/* ── Desktop Nav Links ────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = activeHash === href;
            return (
              <a
                key={href}
                href={href}
                className={`
                  relative flex items-center gap-2.5 px-4 py-2 rounded-lg
                  text-[0.875rem] font-medium tracking-wide
                  transition-all duration-300 group
                  ${isActive ? "text-white" : "text-zinc-400 hover:text-white"}
                `}
              >
                {/* Purple dot for active section */}
                {isActive && (
                  <span className="w-[5px] h-[5px] rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.7)] animate-pulse" />
                )}

                <span className="relative">
                  {label}
                  {/* Underline hover effect */}
                  <span
                    className={`
                      absolute -bottom-[3px] left-0 h-[1.5px] rounded-full
                      bg-gradient-to-r from-purple-400 to-violet-600
                      transition-all duration-300 ease-out
                      ${isActive ? "w-full" : "w-0 group-hover:w-full"}
                    `}
                  />
                </span>
              </a>
            );
          })}
        </div>

        {/* ── Auth Buttons ─────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          <SignInButton mode="modal">
            <button className="relative px-4 py-2 text-[0.875rem] font-medium text-zinc-400 hover:text-white rounded-lg transition-all duration-300 cursor-pointer group">
              Login
              <span className="absolute -bottom-[1px] left-1/2 -translate-x-1/2 w-0 h-[1px] bg-white/30 transition-all duration-300 group-hover:w-3/4 rounded-full" />
            </button>
          </SignInButton>

          <SignUpButton mode="modal">
            <button
              className="
                relative px-6 py-[7px]
                text-[0.8rem] font-semibold tracking-[0.08em] uppercase
                text-white/90 hover:text-white
                border border-white/[0.15] hover:border-purple-400/50
                rounded-full cursor-pointer
                bg-white/[0.03] hover:bg-white/[0.06]
                backdrop-blur-sm
                shadow-[0_0_0_1px_rgba(255,255,255,0.02)] hover:shadow-[0_0_25px_rgba(168,85,247,0.12)]
                transition-all duration-400 ease-out
              "
            >
              Sign Up
            </button>
          </SignUpButton>
        </div>

        {/* ── Mobile Hamburger ─────────────────────────────────── */}
        <button
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="md:hidden relative w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors duration-300 rounded-xl hover:bg-white/[0.05] cursor-pointer"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileMenuOpen}
        >
          <span
            className={`absolute transition-all duration-300 ${
              isMobileMenuOpen ? "rotate-0 opacity-100" : "rotate-90 opacity-0"
            }`}
          >
            <X size={20} strokeWidth={2} />
          </span>
          <span
            className={`absolute transition-all duration-300 ${
              isMobileMenuOpen ? "-rotate-90 opacity-0" : "rotate-0 opacity-100"
            }`}
          >
            <Menu size={20} strokeWidth={2} />
          </span>
        </button>
      </div>

      {/* ── Mobile Menu ──────────────────────────────────────── */}
      <div
        className={`
          md:hidden overflow-hidden
          transition-all duration-400 ease-out
          ${isMobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="px-6 pt-4 pb-6 mt-2 mx-4 rounded-2xl bg-[#0e1018]/90 backdrop-blur-2xl border border-white/[0.06] space-y-1 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = activeHash === href;
            return (
              <a
                key={href}
                href={href}
                onClick={closeMobile}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl
                  text-[0.9375rem] font-medium
                  transition-all duration-200
                  ${
                    isActive
                      ? "text-white bg-white/[0.06] border border-white/[0.06]"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
                  }
                  active:scale-[0.98]
                `}
              >
                {isActive && (
                  <span className="w-[5px] h-[5px] rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]" />
                )}
                {label}
              </a>
            );
          })}

          {/* Mobile Auth */}
          <div className="pt-3 mt-2 border-t border-white/[0.06] space-y-2">
            <SignInButton mode="modal">
              <button
                onClick={closeMobile}
                className="w-full px-4 py-3 text-[0.9375rem] font-medium text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer text-left"
              >
                Login
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                onClick={closeMobile}
                className="w-full px-4 py-3 text-[0.8rem] font-semibold tracking-[0.08em] uppercase text-center text-white/90 border border-white/[0.15] rounded-full bg-white/[0.03] hover:border-purple-400/50 transition-all duration-300 cursor-pointer"
              >
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;
