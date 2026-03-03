/**
 * lib/supabase/service.ts
 *
 * Supabase client using the SERVICE ROLE key.
 * This bypasses Row Level Security entirely.
 *
 * ONLY use this in server-side code (API routes, server components).
 * NEVER import this in client components — the service role key must
 * never be exposed to the browser.
 */

import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
