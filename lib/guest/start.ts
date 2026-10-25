/**
 * lib/guest/start.ts — making a guest, and turning a guest into a real account.
 * Browser only. Everything here does nothing unless guestAccountsOn().
 *
 * startGuest: signInAnonymously() makes a hidden Supabase account. The
 *   campaign and UTM words go into the account's own details (user metadata),
 *   which supabase/migrations/guest_accounts.sql copies into account_campaigns
 *   the moment the account is made, and into PostHog as the person's
 *   properties.
 *
 * upgradeGuestWithGoogle: linkIdentity() adds Google to the SAME account. The
 *   user id does not change, so the star_careers rows, the Hall of Fame and
 *   everything else stay where they are. Google sends the player back to
 *   /auth/callback, which then asks for a username like any new account.
 *
 * If that Google account already belongs to someone (they signed up before),
 *   Supabase refuses the link (identity_already_exists). /auth/callback sends
 *   them back to the game with ?guest_link=taken, and the prompt offers
 *   signInToExistingAccount: sign in to the old account and bring this guest's
 *   careers along (moveGuestSavesInto, lib/guest/moveSaves.ts).
 */

import { createClient } from "@/lib/supabase/client";
import { posthogClient } from "@/components/PostHogProvider";
import type { Utm } from "@/lib/campaigns";
import { guestAccountsOn, isGuestUser } from "./config";
import { captchaToken } from "./captcha";
import { rememberGuestForMove } from "./moveSaves";

export type GuestStartResult =
  | { ok: true; userId: string; isGuest: boolean; created: boolean }
  | { ok: false; reason: "off" | "captcha" | "disabled" | "error"; message: string };

/** Fires a PostHog event; silent when PostHog is not set up. */
export function track(event: string, props: Record<string, unknown> = {}): void {
  void posthogClient().then((ph) => ph?.capture(event, props)).catch(() => {});
}

/**
 * Makes a guest account, or reuses whoever is already signed in (a guest from
 * an earlier visit, or a real account: neither gets a second account).
 */
export async function startGuest(opts: { campaign?: string; utm?: Utm; landing?: string } = {}): Promise<GuestStartResult> {
  if (!guestAccountsOn()) return { ok: false, reason: "off", message: "Guest play is switched off." };
  const supabase = createClient();
  const { data: { user: existing } } = await supabase.auth.getUser();
  if (existing) return { ok: true, userId: existing.id, isGuest: isGuestUser(existing), created: false };

  let token: string | null = null;
  try {
    token = await captchaToken();
  } catch {
    return { ok: false, reason: "captcha", message: "We couldn't check you're not a robot. Try again." };
  }

  const meta: Record<string, string> = { guest_started_at: new Date().toISOString() };
  if (opts.campaign) meta.campaign = opts.campaign;
  if (opts.landing) meta.landing = opts.landing.slice(0, 200);
  for (const [k, v] of Object.entries(opts.utm ?? {})) if (v) meta[k] = v;

  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: meta, ...(token ? { captchaToken: token } : {}) },
  });
  if (error || !data.user) {
    // "Anonymous sign-ins are disabled" = the Supabase switch is still off.
    const disabled = /anonymous.*disabled|disabled.*anonymous/i.test(error?.message ?? "");
    track("guest_start_failed", { reason: disabled ? "disabled" : "error", campaign: opts.campaign });
    return disabled
      ? { ok: false, reason: "disabled", message: "Guest play isn't available right now. Sign in with Google to play." }
      : { ok: false, reason: "error", message: "Something went wrong starting your career. Try again." };
  }

  const ph = await posthogClient().catch(() => null);
  if (ph) {
    ph.identify(data.user.id, { is_guest: true, campaign: opts.campaign ?? null, ...opts.utm });
    ph.capture("guest_started", { campaign: opts.campaign ?? null, ...opts.utm });
  }
  return { ok: true, userId: data.user.id, isGuest: true, created: true };
}

const UPGRADE_NOTE = "kib-guest-upgrading-v1";

/** Back to this page after Google, with the game's own address as the default. */
function callbackUrl(next: string, extra = ""): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}${extra}`;
}

/**
 * "Save your career — sign in with Google". Leaves the page for Google;
 * returns only when it could not start.
 */
export async function upgradeGuestWithGoogle(next = "/star-dev", where = "prompt"): Promise<{ ok: false; message: string } | void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isGuestUser(user)) return { ok: false, message: "You're not playing as a guest." };
  try { localStorage.setItem(UPGRADE_NOTE, user.id); } catch { /* the upgrade still works; only the analytics event is lost */ }
  track("guest_upgrade_clicked", { where });
  const { error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: callbackUrl(next, "&guest=link") },
  });
  if (error) {
    // "Manual linking is disabled" = Supabase → Auth → "Allow manual linking" is off.
    return { ok: false, message: /manual linking/i.test(error.message)
      ? "Saving to Google isn't switched on yet. Your career is still saved on this device."
      : "Couldn't open Google. Try again." };
  }
}

/**
 * The Google account already has a Knowitball account: sign in to THAT one and
 * bring this guest's careers into its empty save slots.
 */
export async function signInToExistingAccount(next = "/star-dev"): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && isGuestUser(user)) rememberGuestForMove(user.id);
  track("guest_signin_existing");
  await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });
}

/**
 * Called once the game knows who is signed in: if this browser was in the
 * middle of an upgrade and the same account is now a real one, record it.
 */
export function noteUpgradeFinished(user: { id: string; is_anonymous?: boolean } | null): void {
  let pending: string | null = null;
  try { pending = localStorage.getItem(UPGRADE_NOTE); } catch { return; }
  if (!pending || !user || isGuestUser(user) || pending !== user.id) return;
  try { localStorage.removeItem(UPGRADE_NOTE); } catch { /* ignore */ }
  void posthogClient().then((ph) => {
    if (!ph) return;
    ph.identify(user.id, { is_guest: false });
    ph.capture("guest_upgraded");
  }).catch(() => {});
}
