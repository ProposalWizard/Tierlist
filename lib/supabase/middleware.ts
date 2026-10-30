/**
 * lib/supabase/middleware.ts
 *
 * Helper used by the root middleware.ts to refresh the Supabase
 * session on every request.  This keeps the auth cookie valid
 * and avoids the user being logged out mid-session.
 *
 * It also returns WHO is signed in, so middleware.ts does not have to ask
 * Supabase a second time (the "two login checks", L5 in the Supabase plan,
 * 25 Oct 2026: before this, every request for a signed-in player asked
 * Supabase "who is this?" twice).
 */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; userId: string | null; isAnonymous: boolean }> {
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

  // getClaims() refreshes an expired token first (same as getUser() did), so
  // it still keeps the session alive: do not remove this call. Then it checks
  // the login token itself: on the spot when the project signs tokens with
  // the newer key pair, or with one call to Supabase (getUser) when it uses
  // the older shared secret. Either way, one check at most instead of two.
  // Supabase's Next.js guide: supabase.com/docs/guides/auth/server-side/nextjs
  // A failed check (no session, bad token, network) counts as signed out,
  // exactly as a failed getUser() did.
  let sub: unknown = null;
  let anon = false;
  try {
    const { data } = await supabase.auth.getClaims();
    sub = data?.claims?.sub;
    // Guest accounts (lib/guest/config.ts) carry is_anonymous in the token.
    anon = data?.claims?.is_anonymous === true;
  } catch {
    sub = null;
  }

  return { response: supabaseResponse, userId: typeof sub === "string" && sub ? sub : null, isAnonymous: anon };
}
