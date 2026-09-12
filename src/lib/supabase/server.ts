import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Request-scoped Supabase client that acts AS THE LOGGED-IN USER.
 * Every query it makes is subject to RLS — this is the safe default, and the
 * client you should reach for unless you specifically need to bypass policies.
 *
 * Must be created per request; never cache or share it across requests.
 */
export async function createClient() {
  // `cookies()` is async in Next 16.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // getAll/setAll — the get/set/remove trio is deprecated in
        // @supabase/ssr and mishandles token refresh edge cases.
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // proxy.ts refreshes the session, so this is safe to swallow.
          }
        },
      },
    },
  );
}
