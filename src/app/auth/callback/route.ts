import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for invite and password-reset emails.
 *
 * Supabase verifies the emailed token and redirects here with either a PKCE
 * `code` or a `token_hash` + `type`, depending on the project's email
 * templates. Both are handled: whichever arrives is exchanged for a session,
 * then the person is sent on to set their password.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/staff/set-password";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "invite" | "recovery" | "email",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // No code and no token_hash means the tokens are in the URL fragment
  // (implicit flow). Fragments never reach the server, so hand off to the
  // page and let its client-side handler read them. The browser reattaches
  // the fragment across this redirect.
  return NextResponse.redirect(`${origin}${next}`);
}
