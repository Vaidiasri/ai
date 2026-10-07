import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { utcDayStart } = await import("./agent-session");

describe("utcDayStart", () => {
  it.each([
    ["2026-10-07T00:00:00.000Z", "2026-10-07T00:00:00.000Z"],
    ["2026-10-07T23:59:59.999Z", "2026-10-07T00:00:00.000Z"],
    // 04:00 IST on the 8th is still the 7th in UTC: the limit follows UTC.
    ["2026-10-07T22:30:00.000Z", "2026-10-07T00:00:00.000Z"],
    ["2026-12-31T18:30:00.000Z", "2026-12-31T00:00:00.000Z"],
  ])("%s starts at %s", (now, start) => {
    expect(utcDayStart(new Date(now)).toISOString()).toBe(start);
  });
});
