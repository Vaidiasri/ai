import { addDays, format, nextDay, parse, startOfToday } from "date-fns";

/** Canonical slot format used in DB and UI comparisons: 24h "HH:mm" */
export function toCanonicalTime(timeStr: string): string {
  if (!timeStr?.trim()) {
    return "09:00";
  }

  const trimmed = timeStr.trim();

  // Legacy values like "14:00 PM" — strip erroneous am/pm on 24h strings
  const hybrid = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (hybrid && Number(hybrid[1]) > 12) {
    return toCanonicalTime(`${hybrid[1]}:${hybrid[2]}`);
  }

  const twentyFourHour = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = twentyFourHour[2];
    if (hours >= 0 && hours <= 23) {
      return `${String(hours).padStart(2, "0")}:${minutes}`;
    }
  }

  const twelveHour = trimmed.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = twelveHour[2] ?? "00";
    const period = twelveHour[3].toLowerCase();
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  const numberMap: Record<string, string> = {
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
  };

  let normalized = trimmed.toLowerCase();
  for (const [word, digit] of Object.entries(numberMap)) {
    if (normalized.startsWith(word)) {
      normalized = normalized.replace(word, digit);
      break;
    }
  }

  const guessed = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (guessed) {
    return toCanonicalTime(
      `${guessed[1]}:${guessed[2] ?? "00"} ${guessed[3] || (Number(guessed[1]) >= 12 ? "pm" : "am")}`,
    );
  }

  return trimmed;
}

/** @deprecated Use parseAppointmentDate — kept for Vapi route imports */
export function parseVapiDate(dateStr: string): string {
  return parseAppointmentDate(dateStr);
}

/** @deprecated Use toCanonicalTime — kept for Vapi route imports */
export function normalizeVapiTime(timeStr: string): string {
  return toCanonicalTime(timeStr);
}

export function parseAppointmentDate(dateStr: string): string {
  if (!dateStr) {
    return formatLocalDateString(new Date());
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split("T")[0];
  }

  const today = startOfToday();
  const lower = dateStr.toLowerCase().trim();

  if (lower === "today") return formatLocalDateString(today);
  if (lower === "tomorrow") return formatLocalDateString(addDays(today, 1));

  const dayMap: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };

  for (const [dayName, dayIndex] of Object.entries(dayMap)) {
    if (lower.includes(dayName)) {
      return formatLocalDateString(nextDay(today, dayIndex));
    }
  }

  const parsed = parse(dateStr, "yyyy-MM-dd", new Date());
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDateString(parsed);
  }

  const fallback = new Date(dateStr);
  if (!Number.isNaN(fallback.getTime())) {
    return formatLocalDateString(fallback);
  }

  return formatLocalDateString(today);
}

export function formatLocalDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Format a date stored as UTC noon (or legacy midnight UTC) as yyyy-MM-dd */
export function formatStoredAppointmentDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Display 24h HH:mm as 12h for emails/UI (e.g. "14:00" -> "2:00 PM") */
export function formatTimeForDisplay(time: string): string {
  const canonical = toCanonicalTime(time);
  const match = canonical.match(/^(\d{2}):(\d{2})$/);
  if (!match) return time;

  let hours = Number(match[1]);
  const minutes = match[2];
  const period = hours >= 12 ? "PM" : "AM";
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  return `${hours}:${minutes} ${period}`;
}

export function getNext5DaysLocal(): string[] {
  const dates: string[] = [];
  const tomorrow = addDays(startOfToday(), 1);

  for (let i = 0; i < 5; i++) {
    dates.push(formatLocalDateString(addDays(tomorrow, i)));
  }

  return dates;
}
