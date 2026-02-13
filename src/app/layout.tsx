import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import UserSync from "@/components/UserSync";
import Navbar from "@/components/Navbar";
import TanStackProvider from "@/components/providers/TanStackProvider";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DetWise-AI Powered Dental Assistant",
  description:
    "DetWise-AI is a dental assistant that uses AI to help dentists diagnose and treat dental problems.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TanStackProvider>
      <ClerkProvider>
        <html lang="en">
          <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased dark`}
          >
            <UserSync />
            <Navbar />
            {children}
          </body>
        </html>
      </ClerkProvider>
    </TanStackProvider>
  );
}
