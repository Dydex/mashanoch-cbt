/**
 * Provision an account. Public signup is disabled, so this (and later the admin
 * roster page) is the only way users are created.
 *
 *   node --env-file=.env scripts/create-user.mjs <username> "<Full Name>" <role> [class]
 *
 * The email is synthetic and derived from the new profile's UUID; the user never
 * sees it. The PIN is random and printed once — there is no way to recover it,
 * only to reset it.
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt, randomUUID } from "node:crypto";

const [username, fullName, role, klass] = process.argv.slice(2);
if (!username || !fullName || !role) {
  console.error('Usage: node --env-file=.env scripts/create-user.mjs <username> "<Full Name>" <role> [class]');
  process.exit(1);
}

// Ambiguous characters (0/O, 1/l/I) omitted — these get read off a paper slip.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const pin = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Generate the id ourselves so the email can be derived from it.
const id = randomUUID();

const { error } = await admin.auth.admin.createUser({
  id,
  email: `${id}@mashnock.local`,
  password: pin,
  email_confirm: true,
  user_metadata: { username, full_name: fullName, role, class: klass ?? null },
});

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}

console.log("\n  Account created — write this down, the PIN is not recoverable.\n");
console.log(`    Name  : ${fullName}`);
console.log(`    ID    : ${username}`);
console.log(`    PIN   : ${pin}`);
console.log(`    Role  : ${role}${klass ? ` (${klass})` : ""}\n`);
