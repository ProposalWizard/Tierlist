/**
 * lib/guest/config.ts — THE ONE SWITCH for guest accounts (Harry, 25 Oct 2026:
 * "a massive, massive idea that needs to be applied").
 *
 * A guest is a hidden Supabase account made by `signInAnonymously()`. It saves
 * a career exactly like a real account (same user id, same star_careers row),
 * and later "Save your career — sign in with Google" links Google to that same
 * id, so nothing is lost. The plan: docs/plans/2026-10-25/guest-accounts-plan.md.
 *
 * OFF unless NEXT_PUBLIC_GUEST_ACCOUNTS is exactly "on". Unset = the site
 * behaves exactly as before this file existed: no guest button, no landing
 * pages (/play/<campaign> is a 404 again), no upgrade prompt. It is read at
 * build time (NEXT_PUBLIC_), so flipping it in Vercel needs a redeploy.
 *
 * It also needs Supabase → Authentication → Sign In / Providers → "Allow
 * anonymous sign-ins" switched on. Without that, the guest button shows a
 * friendly "guest play isn't available right now" and nothing else changes.
 */

import type { User } from "@supabase/supabase-js";

export function guestAccountsOn(): boolean {
  return process.env.NEXT_PUBLIC_GUEST_ACCOUNTS === "on";
}

/**
 * Whether this signed-in user is a guest (an anonymous account). Supabase sets
 * `is_anonymous` on the user and in the login token; once Google is linked it
 * becomes false and the account is an ordinary one.
 *
 * Use it anywhere a guest must be treated as signed out: making tierlists,
 * choosing a username, the shop's paid items, tester codes. Road to Ballon
 * d'Or saves are the one place a guest counts as signed in.
 */
export function isGuestUser(user: Pick<User, "is_anonymous"> | null | undefined): boolean {
  return user?.is_anonymous === true;
}

/** Cloudflare Turnstile site key (public by design). Unset = no captcha step. */
export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
}
