import { schoolParts } from "@/lib/time";

/**
 * Students and teachers never see or type an email address. Supabase Auth
 * requires one, so we synthesise it from the profile's UUID.
 *
 * Deriving it from the UUID rather than the username is deliberate: a
 * student's username is their admission number, and setting or correcting it is
 * a single UPDATE. The auth record, the password and the session are untouched.
 */
export const AUTH_EMAIL_DOMAIN = "mashnock.local";

export const authEmailFor = (profileId: string) =>
  `${profileId}@${AUTH_EMAIL_DOMAIN}`;

/**
 * Students sign in with the admission number the school issued them, stored as
 * their profile's username. Case and spaces are ignored, so "mps/ 2026/001"
 * and "MPS/2026/001" are the same number: every admission number is stored, and
 * looked up, in this form.
 */
export function normalizeAdmissionNo(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** 3 to 30 characters: letters, digits, and / - . after the first. */
export const ADMISSION_NO_PATTERN = /^[A-Z0-9][A-Z0-9/.-]{2,29}$/;

export const CLASSES = ["JSS1", "JSS2", "JSS3", "SS1", "SS2"] as const;
export type SchoolClass = (typeof CLASSES)[number];

export type Role = "student" | "teacher" | "admin";

/**
 * Remembers whether the sidebar is collapsed. Lives here rather than in the
 * sidebar component because that file is "use client": importing a value from
 * a client module into a server component yields a client reference, not the
 * string, and the cookie lookup silently reads undefined.
 */
export const SIDEBAR_COOKIE = "mashanoch_sidebar_collapsed";

export const TERMS = ["First", "Second", "Third"] as const;
export type Term = (typeof TERMS)[number];

/**
 * The academic session a date falls in, as "2026/2027".
 *
 * A Nigerian session runs September to July, so anything from September
 * onwards starts a new session and January to August belongs to the one that
 * began the previous September.
 */
export function currentSession(now = new Date()): string {
  const { year: y, month } = schoolParts(now);
  return month >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

export const SESSION_PATTERN = "\\d{4}/\\d{4}";

/** Longest note on a test's review thread. Matches the check in 0010. */
export const REVIEW_NOTE_MAX = 2000;

/**
 * How long a password-reset link works, and how soon another can be sent.
 * These mirror the Supabase project's auth settings; they do not set them.
 * The first is the email provider's "Email OTP Expiration" (default 3600
 * seconds), the second the minimum interval between emails to one user
 * (default 60 seconds). Change them in the dashboard and here together.
 */
export const RESET_LINK_TTL_SECONDS = 3600;
export const RESET_RESEND_COOLDOWN_SECONDS = 60;
