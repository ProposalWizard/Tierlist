/**
 * lib/teamRoom/bells.ts — the 🔔 on each channel (plan U12, A6; Harry,
 * 25 Oct 2026: "phone push for every message where the bell says so").
 * Pure: tested in tests/star/teamRoomBells.mts.
 *
 *   Every new message   a buzz (phone, and a pop-up on a computer) for each one
 *   Only @mentions      a buzz when you are named, replied to, pointed at, or
 *                       for @all / @everyone (the default)
 *   Off                 never a buzz; the channel still goes bold
 *   Only red            #health only: a buzz only when a line is red
 *   Mute 1 hour         no buzz at all from that channel for an hour
 *
 * Starting setup (plan "Your calls"): DMs and @mentions everywhere, every
 * message in #bugs, #health only when red, the rest on Only @mentions.
 *
 * Your choices follow you to every device: they are kept in your own
 * sign-in account's details (user_metadata.teamBells), like your phone list.
 * No table.
 */
import { TEAM_PEOPLE, type TeamPerson } from "./config";

export type Bell = "all" | "mentions" | "off" | "red";
export const BELL_WORD: Record<Bell, string> = { all: "Every new message", mentions: "Only @mentions", off: "Off", red: "Only when red" };

/** The starting setting per channel (anything not listed: Only @mentions). */
export const DEFAULT_BELLS: Readonly<Record<string, Bell>> = { bugs: "all", health: "red" };
/** The channels that may choose "Only red". */
export const RED_CHANNELS = ["health"] as const;

export interface BellPrefs {
  /** Per channel, where it differs from the start. */
  ch: Record<string, Bell>;
  /** Per channel: muted until (ISO). */
  mute: Record<string, string>;
}
export const NO_BELLS: BellPrefs = { ch: {}, mute: {} };
export const BELLS_KEY = "teamBells";

const SLUG = /^[a-z0-9][a-z0-9-]{0,29}$/;
const isBell = (v: unknown): v is Bell => v === "all" || v === "mentions" || v === "off" || v === "red";

/** The saved choices, cleaned (never throws). */
export function cleanBells(raw: unknown): BellPrefs {
  const out: BellPrefs = { ch: {}, mute: {} };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  if (r.ch && typeof r.ch === "object") {
    for (const [k, v] of Object.entries(r.ch as Record<string, unknown>).slice(0, 80)) if (SLUG.test(k) && isBell(v)) out.ch[k] = v;
  }
  if (r.mute && typeof r.mute === "object") {
    for (const [k, v] of Object.entries(r.mute as Record<string, unknown>).slice(0, 80)) if (SLUG.test(k) && typeof v === "string" && Date.parse(v)) out.mute[k] = v;
  }
  return out;
}

/** The bell for one channel. "Only red" outside #health reads as Only @mentions. */
export function bellFor(prefs: BellPrefs | null | undefined, slug: string): Bell {
  const b = prefs?.ch[slug] ?? DEFAULT_BELLS[slug] ?? "mentions";
  return b === "red" && !(RED_CHANNELS as readonly string[]).includes(slug) ? "mentions" : b;
}

/** Muted right now? */
export const mutedNow = (prefs: BellPrefs | null | undefined, slug: string, now: number) => {
  const until = prefs?.mute[slug];
  return !!until && Date.parse(until) > now;
};

/** Set one channel's bell (back to the start = removed from the list). Clears its mute. */
export function withBell(prefs: BellPrefs, slug: string, bell: Bell): BellPrefs {
  const ch = { ...prefs.ch };
  if ((DEFAULT_BELLS[slug] ?? "mentions") === bell) delete ch[slug]; else ch[slug] = bell;
  const mute = { ...prefs.mute };
  delete mute[slug];
  return { ch, mute };
}

/** Mute one channel until a time (null = unmute). Old mutes are tidied away. */
export function withMute(prefs: BellPrefs, slug: string, until: string | null, now: number): BellPrefs {
  const mute: Record<string, string> = {};
  for (const [k, v] of Object.entries(prefs.mute)) if (Date.parse(v) > now && k !== slug) mute[k] = v;
  if (until) mute[slug] = until;
  return { ch: { ...prefs.ch }, mute };
}

/** Why a buzz goes out. "message" = only because the bell says every message. */
export type BellWhy = "point" | "reply" | "mention" | "all" | "message";

/**
 * Who a new channel message buzzes, after each person's bell. `base` = who it
 * would buzz on mentions alone (notify.ts ringsForMessage). `quiet` = people
 * with buzzes paused (do not disturb, or a schedule that pauses them).
 * Never the sender. Board order.
 */
export function ringsWithBells(opts: {
  /** null = a bot's post (nobody to leave out). */
  sender: TeamPerson | null; slug: string; base: { person: TeamPerson; why: Exclude<BellWhy, "message"> }[];
  prefsOf: Partial<Record<TeamPerson, BellPrefs>>; quiet: readonly TeamPerson[]; now: number;
  /** A bot's post marked red (#health): Only red buzzes for it. */
  red?: boolean;
}): { person: TeamPerson; why: BellWhy }[] {
  const out: { person: TeamPerson; why: BellWhy }[] = [];
  for (const p of TEAM_PEOPLE) {
    if (p === opts.sender || opts.quiet.includes(p)) continue;
    const prefs = opts.prefsOf[p];
    if (mutedNow(prefs, opts.slug, opts.now)) continue;
    const bell = bellFor(prefs, opts.slug);
    if (bell === "off") continue;
    const had = opts.base.find((r) => r.person === p);
    if (bell === "red") { if (opts.red || had) out.push({ person: p, why: had?.why ?? "message" }); continue; }
    if (had) { out.push({ person: p, why: had.why }); continue; }
    if (bell === "all") out.push({ person: p, why: "message" });
  }
  return out;
}

/** Should THIS open tab show a computer pop-up for a message, by my bell? (The phone push uses ringsWithBells on the server.) */
export function popupFor(opts: { me: TeamPerson; sender: TeamPerson | null; slug: string; namesMe: boolean; prefs: BellPrefs; quiet: boolean; now: number }): boolean {
  if (opts.sender === opts.me || opts.quiet || mutedNow(opts.prefs, opts.slug, opts.now)) return false;
  const bell = bellFor(opts.prefs, opts.slug);
  if (bell === "off") return false;
  return bell === "all" || opts.namesMe;
}
