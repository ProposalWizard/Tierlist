/**
 * lib/supabase/server.ts
 *
 * Server-side Supabase client for use in:
 *  - Server Components
 *  - API Route Handlers (app/api/*)
 *  - Server Actions
 *
 * Uses @supabase/ssr's createServerClient which reads/writes
 * cookies via Next.js `cookies()` to maintain the user session
 * server-side without exposing the service-role key to the browser.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  // cookies() returns the read-only store in RSC; writable in Route Handlers.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component – ignore write errors.
            // The middleware is responsible for refreshing the session cookie.
          }
        },
      },
      // Disable Next.js Data Cache for Supabase requests.
      // Without this, fetch() responses are cached by URL (ignoring auth
      // headers), so authenticated and anonymous users can receive each
      // other's stale data.
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
