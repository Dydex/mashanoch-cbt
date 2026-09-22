/**
 * A student's password is their surname. They type just that, in any case,
 * with or without spaces; this turns it into what Supabase Auth stores.
 *
 * The fixed ending is there because Supabase refuses passwords shorter than
 * six characters, and plenty of surnames are shorter (Obi, Eze, Ali). It adds
 * no secrecy: the password is exactly as strong as a surname. Changing it
 * would lock out every existing student, so it must stay as it is.
 *
 * Server-side only: imported by the login and admin actions.
 */
const SUFFIX = "#mashanoch-student";

/**
 * "Adeyemi Cole", "ADEYEMICOLE" and "adeyemi cole" are the same surname, and
 * so are "Ọlá" and "Ola": tone marks and accents are dropped, because most
 * keyboards cannot type them and names are written both ways.
 */
export function normalizeSurname(surname: string): string {
  return surname
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function studentAuthPassword(surname: string): string {
  return normalizeSurname(surname) + SUFFIX;
}
