/**
 * Invite a teacher or admin.
 *
 *   node --env-file=.env scripts/invite-staff.mjs <email> "<Full Name>" <teacher|admin>
 *
 * Tries to send the invitation email. If email delivery is not configured on
 * the Supabase project yet, it falls back to printing the invite link so you
 * can hand it over yourself — useful for creating the very first admin.
 *
 * Staff never receive a password from us; the link lets them choose their own.
 */
import { createClient } from "@supabase/supabase-js";

const [email, fullName, role] = process.argv.slice(2);
if (!email || !fullName || !role || !["teacher", "admin"].includes(role)) {
  console.error('Usage: node --env-file=.env scripts/invite-staff.mjs <email> "<Full Name>" <teacher|admin>');
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const options = {
  data: { username: email, full_name: fullName, role },
  redirectTo: `${site}/auth/callback?next=/staff/set-password`,
};

const sent = await admin.auth.admin.inviteUserByEmail(email, options);

if (!sent.error) {
  console.log(`\n  Invitation emailed to ${email} (${role}).`);
  console.log("  They choose their own password from the link.\n");
  process.exit(0);
}

console.log(`\n  Could not send the email: ${sent.error.message}`);
console.log("  Falling back to a link you can pass on yourself.\n");

const { data, error } = await admin.auth.admin.generateLink({
  type: "invite",
  email,
  options,
});

if (error) {
  console.error("  Failed:", error.message);
  process.exit(1);
}

console.log(`    Name : ${fullName}`);
console.log(`    Role : ${role}`);
console.log(`    Link : ${data.properties.action_link}\n`);
console.log("  Send that link to them. It expires, and it can only be used once.\n");
