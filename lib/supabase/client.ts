/**
 * lib/supabase/client.ts
 *
 * Browser-side Supabase client.
 * Use this in Client Components ("use client") for auth state,
 * real-time subscriptions, or direct DB reads that don't need
 * server-only credentials.
 *
 * Uses @supabase/ssr's createBrowserClient which handles cookie
 * storage automatically for Next.js App Router.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    // These env vars are exposed to the browser (NEXT_PUBLIC_ prefix).
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
