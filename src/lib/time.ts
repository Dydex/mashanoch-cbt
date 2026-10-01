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

function offsetAt(ms: number): number {
  const p = schoolParts(new Date(ms));
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

export function parseSchoolTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, Number(m[6] ?? 0));
  const date = new Date(wall - offsetAt(wall - offsetAt(wall)));
  const p = schoolParts(date);
  const same =
    p.year === year &&
    p.month === month &&
    p.day === day &&
    p.hour === hour &&
    p.minute === minute;
  return same ? date : null;
}

export function toSchoolInput(iso: string): string {
  const p = schoolParts(new Date(iso));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export const timeFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: SCHOOL_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export const dateFmt = new Intl.DateTimeFormat("en-NG", {
  timeZone: SCHOOL_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function greeting(): string {
  const h = schoolParts().hour;
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
