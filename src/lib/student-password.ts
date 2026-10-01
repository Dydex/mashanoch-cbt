const SUFFIX = "#mashanoch-student";

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
