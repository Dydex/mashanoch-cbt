import { schoolParts } from "@/lib/time";

export const AUTH_EMAIL_DOMAIN = "mashnock.local";

export const authEmailFor = (profileId: string) =>
  `${profileId}@${AUTH_EMAIL_DOMAIN}`;

export function normalizeAdmissionNo(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export const ADMISSION_NO_PATTERN = /^[A-Z0-9][A-Z0-9/.-]{2,29}$/;

export const CLASSES = ["JSS1", "JSS2", "JSS3", "SS1", "SS2"] as const;
export type SchoolClass = (typeof CLASSES)[number];

export type Role = "student" | "teacher" | "admin";

export const SIDEBAR_COOKIE = "mashanoch_sidebar_collapsed";

export const TERMS = ["First", "Second", "Third"] as const;
export type Term = (typeof TERMS)[number];

export function currentSession(now = new Date()): string {
  const { year: y, month } = schoolParts(now);
  return month >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

export const SESSION_PATTERN = "\\d{4}/\\d{4}";

export const REVIEW_NOTE_MAX = 2000;

export const RESET_LINK_TTL_SECONDS = 3600;
export const RESET_RESEND_COOLDOWN_SECONDS = 60;
