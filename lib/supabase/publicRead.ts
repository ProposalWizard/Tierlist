/**
 * lib/supabase/publicRead.ts
 *
 * A read-only Supabase client for tables that are PUBLIC-READ by RLS policy.
 *
 * WHY THIS EXISTS
 * ---------------
 * Several routes that only ever SELECT from public-read tables were reaching
 * for `createServiceClient()` — the service-role key, which bypasses RLS
 * entirely. That works, but it made the whole Road to Ballon d'Or data layer
 * unrunnable without a full-access database credential, which in turn is why
 * so many sessions shipped gameplay changes having never once seen the game
 * with real players in it (every club renders "NO SQUAD YET" and falls back to
 * `generateSquad`'s invented roster).
 *
 * None of these routes need the service role. The tables they read all carry
 * an explicit public-read policy:
 *
 *   sofifa_players  — supabase/migrations/sofifa_data.sql
 *                     CREATE POLICY "Public read sofifa_players" ... USING (true)
 *   club_logos      — supabase/migrations/club_league_logos.sql
 *   league_logos    — supabase/migrations/club_league_logos.sql
 *   star_lineups    — supabase/migrations/star_lineups.sql  ("public read")
 *
 * So the anon key — which is `NEXT_PUBLIC_`-prefixed and already shipped in the
 * browser bundle of every page on the live site — is sufficient.
 *
 * PRODUCTION BEHAVIOUR IS UNCHANGED, DELIBERATELY
 * -----------------------------------------------
 * When SUPABASE_SERVICE_ROLE_KEY is set (Vercel, and any local .env.local that
 * has it), this returns exactly the same service client these routes have
 * always used — byte-identical queries, byte-identical results. The anon
 * fallback only ever engages when that key is genuinely absent, which on a
 * correctly-configured deployment never happens.
 *
 * DO NOT use this for writes, for cross-user reads, or for any table whose RLS
 * would hide rows from an anonymous caller. It is named `publicRead` because
 * that is the entire contract. Anything else still wants `createServiceClient`.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Shared options — matches createServiceClient so cached responses can't differ. */
const OPTS = {
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, cache: "no-store" }),
  },
} as const;

/**
 * True when this process has a real service-role key to use.
 *
 * Checks for a non-empty value rather than mere presence: an env var set to
 * "" (easy to do in a dashboard, or via `vercel env pull` on an unset var)
 * would otherwise produce a client that authenticates as nobody and fails
 * every query with a confusing RLS error instead of falling back cleanly.
 */
export function hasServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

/**
 * A client for reading public-read tables.
 *
 * Service-role when available (production, and any fully-configured local
 * environment); anon key otherwise. Both reach the same rows for these
 * specific tables — that is what "public read" means.
 */
export function createPublicReadClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = hasServiceRole()
    ? process.env.SUPABASE_SERVICE_ROLE_KEY!
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, OPTS);
}
