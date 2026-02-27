/**
 * lib/supabase/middleware.ts
 *
 * Helper used by the root middleware.ts to refresh the Supabase
 * session on every request.  This keeps the auth cookie valid
 * and avoids the user being logged out mid-session.
 */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  // Start with a plain "pass-through" response; we'll mutate cookies on it.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          // Write cookies onto both the request (for downstream RSC) and the
          // response (so the browser receives the refreshed token).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Calling getUser() triggers a token refresh if the access token has expired.
  // IMPORTANT: do not remove this call – it is what keeps the session alive.
  await supabase.auth.getUser();

  return supabaseResponse;
}
