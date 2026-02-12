import { SignInButton, SignUpButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Button } from "../ui/button";

const Header = () => {
  return (
    <>
      <nav className="fixed top-0 right-0 left-0 z-50 px-6 py-4 border-b border-border/40 bg-background/95 backdrop-blur-lg shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center h-full">
          {/* Logo Section */}
          <Link
            href="/"
            className="flex items-center gap-3 group transition-opacity hover:opacity-80"
          >
            <Image
              src="/logo.png"
              alt="FullStackAI Logo"
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              FullStackAI
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 relative group"
            >
              How it Works
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 relative group"
            >
              Pricing
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
            </a>
            <a
              href="#about"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 relative group"
            >
              About
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-full" />
            </a>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            <SignInButton mode="modal">
              <Button
                variant="ghost"
                size="sm"
                className="font-medium hover:bg-accent/50 transition-all duration-200"
              >
                Login
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button
                variant="default"
                size="sm"
                className="font-medium shadow-md hover:shadow-lg transition-all duration-200"
              >
                Sign Up
              </Button>
            </SignUpButton>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Header;
