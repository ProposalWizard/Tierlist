/**
 * lib/teamRoom/activeNow.ts — who is active right now, for the Team board tab
 * (Harry, 13 Nov 2026: "where is the live now/active now?"). Pure: no React,
 * no database; tested in tests/star/teamRoomActiveNow.mts.
 *
 * THE RULE, in order (the first that fits wins):
 *   1. Active now      the Team room is open on their device and they used it
 *                      in the last 10 minutes. This is the same signal as the
 *                      green dot beside a name in the room (store.ts `online`).
 *   2. Working now     a progress update from one of their Claude chats, or a
 *                      push, in the last 20 minutes ("via Claude chat": a
 *                      person can be building with the room closed).
 *   3. Their status    the status they set in Me (Filming, Work, Off, custom,
 *                      or a schedule that is on now), with "last active …".
 *   4. Last active     the newest of: progress update, push, message in the room.
 *   5. Away            none of those is known.
 *
 * Change a number here and the tab, the top strip and the test all follow.
 */
import { TEAM_PEOPLE, type TeamPerson } from "./config";

/** A progress update or a push this recent counts as working now. */
export const WORKING_WINDOW_MS = 20 * 60_000;

export type ActiveKind = "active" | "working" | "status" | "last" | "away";

export interface ActiveSignals {
  /** The room is open and used in the last 10 minutes (the room's own green dot). */
  here: boolean;
  /** The status line they set in Me, "" when none. */
  status: string;
  /** Their latest progress update from a Claude chat. */
  updateAt: string | null;
  /** Their latest push. */
  pushAt: string | null;
  /** Their latest message in the room. */
  messageAt: string | null;
}

export interface ActiveState {
  kind: ActiveKind;
  /** True for "Active now" and "Working now": the green dot pulses and the top strip names them. */
  live: boolean;
  /** The main words: "Active now", "Working now", their status, "Last active 2h ago", "Away". */
  label: string;
  /** Quieter words after it, "" when none. */
  detail: string;
  /** The newest thing they did that we know of (ms), null when nothing is known. */
  lastAt: number | null;
}

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/** "just now", "5 min ago", "2h ago", "yesterday", "3 days ago", then a date. A time ahead of now (a clock a little off) reads as just now. */
export function agoWords(at: number, now: number): string {
  const d = Math.max(0, now - at);
  if (d < 60_000) return "just now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)} min ago`;
  if (d < 24 * 3600_000) return `${Math.floor(d / 3600_000)}h ago`;
  if (d < 48 * 3600_000) return "yesterday";
  if (d < 14 * 86400_000) return `${Math.floor(d / 86400_000)} days ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** One person's state on the board, by the rule at the top of this file. */
export function activeNow(sig: ActiveSignals, now: number): ActiveState {
  const update = ms(sig.updateAt), push = ms(sig.pushAt), message = ms(sig.messageAt);
  const known = [update, push, message].filter((x): x is number => x !== null).map((x) => Math.min(x, now));
  const lastAt = sig.here ? now : known.length ? Math.max(...known) : null;
  const status = sig.status.trim();
  if (sig.here) return { kind: "active", live: true, label: "Active now", detail: status, lastAt };
  const recent = (t: number | null) => t !== null && now - t < WORKING_WINDOW_MS;
  if (recent(update) || recent(push)) return { kind: "working", live: true, label: "Working now", detail: "via Claude chat", lastAt };
  const last = lastAt === null ? "" : `last active ${agoWords(lastAt, now)}`;
  if (status) return { kind: "status", live: false, label: status, detail: last, lastAt };
  if (lastAt !== null) return { kind: "last", live: false, label: `Last active ${agoWords(lastAt, now)}`, detail: "", lastAt };
  return { kind: "away", live: false, label: "Away", detail: "", lastAt: null };
}

/** The strip at the top of the tab: who is live, or who was last and when. */
export function activeStrip(states: Partial<Record<TeamPerson, ActiveState>>, now: number): { live: TeamPerson[]; words: string } {
  const live = TEAM_PEOPLE.filter((p) => states[p]?.live);
  if (live.length) return { live, words: "" };
  const last = TEAM_PEOPLE.map((p) => ({ p, at: states[p]?.lastAt ?? null })).filter((x): x is { p: TeamPerson; at: number } => x.at !== null).sort((a, b) => b.at - a.at)[0];
  return { live, words: last ? `Nobody is active right now. Last: ${last.p}, ${agoWords(last.at, now)}.` : "Nobody is active right now." };
}

/* ── The work bars: in progress, waiting, done ── */

export type BarState = "progress" | "waiting" | "done";
const WAIT_WORDS = /\b(wait(s|ing)?|blocked|stuck|on hold|paused|needs?)\b/i;

/** 100% = done; a note or name that says waiting / blocked / needs = waiting; the rest is in progress. */
export function barState(bar: { label: string; pct: number; note: string }): BarState {
  if (bar.pct >= 100) return "done";
  return WAIT_WORDS.test(bar.note) || WAIT_WORDS.test(bar.label) ? "waiting" : "progress";
}

/** Who a "waiting on" line names. "you" in a person's own update means that person (their Claude chat is waiting on them). */
export function waitsOn(text: string | null | undefined, owner: TeamPerson): TeamPerson[] {
  if (!text) return [];
  const out = TEAM_PEOPLE.filter((p) => new RegExp(`\\b${p}\\b`, "i").test(text));
  if (/\byou\b/i.test(text) && !out.includes(owner)) out.push(owner);
  return out;
}

/** Done bars fold away: up to 3 are all shown; more than 3 shows 2 and counts the rest. */
export function foldDone<T>(done: readonly T[]): { shown: T[]; more: number } {
  return done.length > 3 ? { shown: done.slice(0, 2), more: done.length - 2 } : { shown: [...done], more: 0 };
}
