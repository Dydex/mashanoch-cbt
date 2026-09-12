import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * Required for the paths the database deliberately denies to logged-in users:
 *   - reading/writing question_options.is_correct (the answer key)
 *   - provisioning accounts (students have no email and cannot sign up)
 *
 * Because RLS is off for this client, EVERY caller must perform its own
 * ownership check. See requireTestOwner() in src/lib/auth.ts.
 *
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
