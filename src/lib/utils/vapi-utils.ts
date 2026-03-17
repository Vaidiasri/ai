import { addDays, nextDay, startOfToday, format, parse, isAfter } from 'date-fns';

/**
 * Parses a date string from Vapi which might be natural language like "Monday" or "Tomorrow"
 */
export function parseVapiDate(dateStr: string): string {
  const currentYear = 2026;
  if (!dateStr) return format(new Date(), 'yyyy-MM-dd').replace(/^\d{4}/, currentYear.toString());

  // If it's already in YYYY-MM-DD or ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const parts = dateStr.split('T')[0].split('-');
    // Force 2026 if the year is in the past
    if (parseInt(parts[0]) < currentYear) {
      return `${currentYear}-${parts[1]}-${parts[2]}`;
    }
    return dateStr.split('T')[0];
  }

  const today = startOfToday();
  const lower = dateStr.toLowerCase().trim();


  if (lower === 'today') return format(today, 'yyyy-MM-dd').replace(/^\d{4}/, currentYear.toString());
  if (lower === 'tomorrow') return format(addDays(today, 1), 'yyyy-MM-dd').replace(/^\d{4}/, currentYear.toString());

  const dayMap: { [key: string]: number } = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6
  };

  for (const dayName in dayMap) {
    if (lower.includes(dayName)) {
      const dayIndex = dayMap[dayName];
      // nextDay from date-fns finds the NEXT occurrence of the day
      let targetDate = nextDay(today, dayIndex as any);
      
      // Ensure we use 2026
      const formatted = format(targetDate, 'yyyy-MM-dd').replace(/^\d{4}/, currentYear.toString());
      return formatted;
    }
  }

  // Fallback to original or today
  try {
    let parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      // If the year is 2023 or 2001 (defaulting behavior), force it to 2026
      if (parsed.getFullYear() < 2026) {
        parsed.setFullYear(currentYear);
      }
      return format(parsed, 'yyyy-MM-dd');
    }
  } catch (e) {
    // ignore
  }

  return format(today, 'yyyy-MM-dd').replace(/^\d{4}/, currentYear.toString());
}

/**
 * Normalizes time strings like "ten AM" or "7 PM" into "10:00 AM" or "07:00 PM"
 */
export function normalizeVapiTime(timeStr: string): string {
  if (!timeStr) return "10:00 AM"; // Default
  
  let time = timeStr.toLowerCase().trim();
  
  // Handle "ten AM" style
  const numberMap: { [key: string]: string } = {
    'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
    'eleven': '11', 'twelve': '12'
  };

  for (const word in numberMap) {
    if (time.startsWith(word)) {
      time = time.replace(word, numberMap[word]);
      break;
    }
  }

  // Ensure it has AM/PM
  const hasAmPm = time.includes('am') || time.includes('pm');
  if (!hasAmPm) {
    // Guess based on hour
    const hour = parseInt(time);
    if (!isNaN(hour)) {
      if (hour >= 9 && hour < 12) time += ' AM';
      else time += ' PM';
    }
  }

  // Final formatting check (e.g., "10 AM" -> "10:00 AM")
  const match = time.match(/(\d+)(?::(\d+))?\s*(am|pm)/);
  if (match) {
    const h = match[1].padStart(2, '0');
    const m = match[2] ? match[2].padStart(2, '0') : "00";
    const p = match[3].toUpperCase();
    return `${h}:${m} ${p}`;
  }

  return timeStr.toUpperCase();
}
