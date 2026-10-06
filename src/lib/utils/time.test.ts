import { describe, expect, it } from "vitest";
import {
  formatStoredAppointmentDate,
  formatTimeForDisplay,
  parseAppointmentDate,
  toCanonicalTime,
} from "@/lib/utils/time";

describe("toCanonicalTime", () => {
  it.each([
    ["9:00", "09:00"],
    ["14:30", "14:30"],
    ["2 pm", "14:00"],
    ["12 am", "00:00"],
    ["12:30 pm", "12:30"],
    ["14:00 PM", "14:00"],
    ["three pm", "15:00"],
    ["", "09:00"],
  ])("%j -> %s", (input, expected) => {
    expect(toCanonicalTime(input)).toBe(expected);
  });
});

describe("formatTimeForDisplay", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["12:00", "12:00 PM"],
    ["14:30", "2:30 PM"],
  ])("%s -> %s", (input, expected) => {
    expect(formatTimeForDisplay(input)).toBe(expected);
  });
});

describe("parseAppointmentDate", () => {
  it("keeps the date part of an ISO string", () => {
    expect(parseAppointmentDate("2026-10-12T10:00:00Z")).toBe("2026-10-12");
  });
});

describe("formatStoredAppointmentDate", () => {
  it("reads the UTC calendar day, not the local one", () => {
    expect(formatStoredAppointmentDate(new Date("2026-10-12T23:30:00Z"))).toBe(
      "2026-10-12",
    );
  });
});
