"use client";

/**
 * components/guest/GuestSavePrompt.tsx — "Save your career — sign in with
 * Google", for a player on a guest account (lib/guest/config.ts).
 *
 * WHEN (lib/guest/promptSchedule.ts):
 *   - days 0 to 6 of the guest account: two moments, each shown once (Later
 *     remembers it): after the first match, after the first season;
 *   - day 7 onwards (Harry, 25 Oct 2026: "prompted every day, maybe 7 days"):
 *     once a day, the first time the game opens that day, with a small
 *     "Guest · day N" note. Later closes it until tomorrow. No lock-out;
 *   - straight away when Google said the account is already taken
 *     (?guest_link=taken from /auth/callback).
 *
 * It lives inside the career's home shell (app/star-dev/page.tsx, next to the
 * Player of the Month pop-up), so it never covers a match.
 *
 * GuestSaveSheet is the picture alone, so the test page (/star-guest-dev) can
 * show every version without an account.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CareerState } from "@/lib/star/types";
import { guestAccountsOn, isGuestUser } from "@/lib/guest/config";
import { signInToExistingAccount, track, upgradeGuestWithGoogle } from "@/lib/guest/start";
import { DAILY_FROM_DAY, guestAgeDays, localDayKey, pickGuestPrompt, type GuestMilestone } from "@/lib/guest/promptSchedule";

export type GuestSaveVariant = GuestMilestone | "daily" | "taken";

const COPY: Record<GuestSaveVariant, { kicker: string; title: string; body: string }> = {
  "first-match": {
    kicker: "Playing as a guest",
    title: "Save your career",
    body: "Right now it lives on this phone only. Sign in with Google to keep it forever and carry on from any device.",
  },
  "first-season": {
    kicker: "Season one done",
    title: "Don't lose this career",
    body: "A whole season is on this phone and nowhere else. One tap with Google keeps it safe.",
  },
  daily: {
    kicker: "Guest",
    title: "Save your career",
    body: "It's still only on this phone. Clear your browser and it's gone. One tap with Google keeps it safe.",
  },
  taken: {
    kicker: "Already signed up",
    title: "That Google account is taken",
    body: "It already has a Knowitball account. Sign in to it and we'll bring this career into a free save slot.",
  },
};

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GuestSaveSheet({ variant, day, playerLine, busy, error, onSave, onExisting, onLater }: {
  variant: GuestSaveVariant;
  /** The daily card's "Guest · day N". */
  day?: number;
  /** e.g. "Jay Carter · 1 game · 1 goal" */
  playerLine?: string;
  busy?: boolean;
  error?: string | null;
  onSave: () => void;
  onExisting: () => void;
  onLater: () => void;
}) {
  const c = COPY[variant];
  const taken = variant === "taken";
  const kicker = variant === "daily" && day !== undefined ? `Guest · day ${day}` : c.kicker;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-6 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="guest-save-title">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-gray-800 to-gray-900 p-5 text-white shadow-2xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-2xl" aria-hidden="true">{taken ? "🔑" : "☁️"}</div>
        <p className="text-center text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">{kicker}</p>
        <h2 id="guest-save-title" className="mt-1 text-center text-2xl font-black leading-tight">{c.title}</h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-white/70">{c.body}</p>
        {playerLine && !taken && (
          <div className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-center text-xs font-bold text-white/80">{playerLine}</div>
        )}
        {error && <p className="mt-3 text-center text-xs font-bold text-amber-300">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={taken ? onExisting : onSave}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-gray-900 active:scale-95 disabled:opacity-60"
        >
          <GoogleG />
          {busy ? "Opening Google…" : taken ? "Sign in to that account" : "Save with Google"}
        </button>
        {taken && (
          <button type="button" disabled={busy} onClick={onSave} className="mt-2 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white/85 active:scale-95">
            Use a different Google account
          </button>
        )}
        <button type="button" onClick={onLater} className="mt-2 w-full py-2 text-sm font-bold text-white/50">
          {variant === "daily" ? "Tomorrow" : "Later"}
        </button>
      </div>
    </div>
  );
}

const DISMISS_KEY = "kib-guest-prompt-seen-v1";
/** userId → the local day the daily card last showed. */
const DAILY_KEY = "kib-guest-prompt-daily-v1";

function readMap<T>(key: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, T>; } catch { return {}; }
}
function seenFor(userId: string): GuestMilestone[] {
  const v = readMap<GuestMilestone[]>(DISMISS_KEY)[userId];
  return Array.isArray(v) ? v : [];
}
function markSeen(userId: string, v: GuestMilestone): void {
  try {
    const all = readMap<GuestMilestone[]>(DISMISS_KEY);
    all[userId] = Array.from(new Set([...(all[userId] ?? []), v]));
    localStorage.setItem(DISMISS_KEY, JSON.stringify(all));
  } catch { /* shown again next time: harmless */ }
}
function lastDailyFor(userId: string): string | null {
  const v = readMap<string>(DAILY_KEY)[userId];
  return typeof v === "string" ? v : null;
}
function markDaily(userId: string, day: string): void {
  try {
    const all = readMap<string>(DAILY_KEY);
    all[userId] = day;
    localStorage.setItem(DAILY_KEY, JSON.stringify(all));
  } catch { /* shown again on the next open: harmless */ }
}

/** Which moment this career has reached, newest first. */
export function guestMilestone(career: Pick<CareerState, "careerStats" | "seasonHistory"> | null): GuestMilestone | null {
  if (!career) return null;
  if ((career.seasonHistory?.length ?? 0) >= 1) return "first-season";
  if ((career.careerStats?.appearances ?? 0) >= 1) return "first-match";
  return null;
}

export default function GuestSavePrompt({ career }: { career: CareerState | null }) {
  const on = guestAccountsOn();
  const [guestId, setGuestId] = useState<string | null>(null);
  const [ageDays, setAgeDays] = useState<number | null>(null);
  const [taken, setTaken] = useState(false);
  const [closed, setClosed] = useState<GuestMilestone | null>(null);
  /** The daily card, decided once when the game opens (and recorded at once, so it is once a day). */
  const [daily, setDaily] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!on) return;
    let live = true;
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!live || !user || !isGuestUser(user)) return;
      setGuestId(user.id);
      const now = Date.now();
      const age = guestAgeDays(user.created_at, now);
      setAgeDays(age);
      const today = localDayKey(now);
      const pick = pickGuestPrompt({ milestone: null, seen: [], ageDays: age, lastDaily: lastDailyFor(user.id), today });
      if (pick?.kind === "daily") { markDaily(user.id, today); setDaily(pick.day); }
      const params = new URLSearchParams(window.location.search);
      if (params.get("guest_link") === "taken") {
        setTaken(true);
        params.delete("guest_link");
        const q = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
      }
    }).catch(() => {});
    return () => { live = false; };
  }, [on]);

  if (!on || !guestId) return null;
  let variant: GuestSaveVariant | null = null;
  if (taken) variant = "taken";
  else if (daily !== null) variant = "daily";
  else if (ageDays === null || ageDays < DAILY_FROM_DAY) {
    // Days 0 to 6: the two moments. (Day 7+ is daily only, decided above.)
    const m = guestMilestone(career);
    const pick = pickGuestPrompt({ milestone: m, seen: seenFor(guestId), ageDays, lastDaily: null, today: "" });
    if (pick?.kind === "milestone" && closed !== pick.milestone) variant = pick.milestone;
  }
  if (!variant) return null;

  const s = career?.careerStats;
  const name = career ? `${career.player.firstName} ${career.player.lastName}` : "";
  const playerLine = career && s
    ? `${name} · ${s.appearances} game${s.appearances === 1 ? "" : "s"} · ${s.goals} goal${s.goals === 1 ? "" : "s"}`
    : undefined;

  const later = () => {
    track("guest_prompt_later", { variant, day: ageDays });
    if (variant === "taken") setTaken(false);
    else if (variant === "daily") setDaily(null);
    else if (variant) { markSeen(guestId, variant); setClosed(variant); }
  };
  const save = async () => {
    setBusy(true); setError(null);
    const r = await upgradeGuestWithGoogle(window.location.pathname, variant ?? "prompt");
    if (r && !r.ok) { setBusy(false); setError(r.message); }
  };
  const existing = async () => {
    setBusy(true); setError(null);
    await signInToExistingAccount(window.location.pathname);
  };

  return <GuestSaveSheet variant={variant} day={daily ?? undefined} playerLine={playerLine} busy={busy} error={error} onSave={save} onExisting={existing} onLater={later} />;
}
