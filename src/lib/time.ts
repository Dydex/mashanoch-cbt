/**
 * Every time in this app is school time, whatever timezone the server or the
 * viewer happens to be in.
 *
 * A datetime-local input sends a bare "2026-09-14T09:00" with no timezone,
 * and `new Date()` reads that in the server's own zone. On a UTC host (Vercel
 * and most containers) a test set for 9:00 would open at 10:00 in Lagos, and
 * every time shown would be an hour behind. So parsing, formatting and "what
 * hour is it" all go through here, naming the school's timezone explicitly.
 */
export const SCHOOL_TIME_ZONE = "Africa/Lagos";

export const SCHOOL_TIME_LABEL = "Lagos time (WAT)";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHOOL_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** A moment's date and clock time as the school sees it. Month is 1–12. */
export function schoolParts(date: Date = new Date()) {
  const part: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(date)) part[p.type] = Number(p.value);
  return {
    year: part.year,
    month: part.month,
    day: part.day,
    hour: part.hour,
    minute: part.minute,
    second: part.second,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** How far school time is ahead of UTC at a given instant, in ms. */
function offsetAt(ms: number): number {
  const p = schoolParts(new Date(ms));
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

/**
 * Reads a datetime-local value ("2026-09-14T09:00") as school time, or null
 * if it is not a real date and time.
 */
export function parseSchoolTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, Number(m[6] ?? 0));

  // Lagos keeps UTC+1 all year. Taking the offset a second time, at the
  // result rather than at the wall time, keeps this right for zones that
  // change their clocks too.
  const date = new Date(wall - offsetAt(wall - offsetAt(wall)));

  // Rejects dates that roll over, like 31 February.
  const p = schoolParts(date);
  const same =
    p.year === year &&
    p.month === month &&
    p.day === day &&
    p.hour === hour &&
    p.minute === minute;
  return same ? date : null;
}

/** A stored timestamp as a datetime-local value, in school time. */
export function toSchoolInput(iso: string): string {
  const p = schoolParts(new Date(iso));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** "14 Sept, 9:00 am", in school time. */
export const timeFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: SCHOOL_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** "Monday, 14 September 2026", in school time. */
export const dateFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: SCHOOL_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "Good morning" and so on, by the school's clock. */
export function greeting(): string {
  const h = schoolParts().hour;
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
