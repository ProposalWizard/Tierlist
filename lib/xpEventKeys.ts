/**
 * WHO DECIDES AN XP AWARD'S KEY (8 Oct 2026, Harry: close the XP farm).
 *
 * xp_events has UNIQUE (user_id, event_type, event_ref): one award per key.
 * The key used to be whatever the phone sent, so a new key each time paid
 * again, forever. Now the server builds the key from what it can check:
 *
 *   join                      once ever                    "join"
 *   streak_7 / streak_30      once ever, and only with the streak really there
 *   daily_login, daily_tictactoe   once a day (UTC)        "day:2026-10-08"
 *   other daily-capped ways   one key per slot per day     "day:2026-10-08:3"
 *   draft_complete/win/invincible  the saved season (draft_runs.event_key);
 *                             win needs 1st, invincible no losses, complete
 *                             the 5th season
 *   Ballon d'Or seasons       the game's own season key (it lives on the
 *                             phone), but at most DAILY_XP_CAP a day
 *   objective_<id>            unchanged: the objective must really be done
 *
 * Ways the phone never awards (other routes do: votes, tierlists, the
 * records board) are refused here. Pure: tests/star/routeLocks.mts runs it.
 */
import { DAILY_CAPPED_EVENTS, DAILY_XP_CAP } from "./xp";

export type XpPlan =
  | { kind: "reject"; reason: string }
  /** A fixed key: once ever (join), or once ever with a check (streaks). */
  | { kind: "fixed"; ref: string; needStreak?: number }
  /** Once a day. */
  | { kind: "day"; ref: string }
  /** Up to DAILY_XP_CAP a day: ref is `${base}:${slot}`, slot = awards so far today. */
  | { kind: "slot"; base: string }
  /** A saved draft season. */
  | { kind: "run"; runKey: string; ref: string; need: "complete" | "win" | "invincible" }
  /** A game key the server can't check: kept for replays, capped per day. */
  | { kind: "capped-ref"; ref: string };

/** Awarded by other server routes, never by the phone through /api/xp. */
export const SERVER_ONLY_XP = new Set<string>(["vote_cast", "tierlist_create", "hall_of_fame_record"]);
/** Once a day, whatever the phone says. */
export const ONCE_A_DAY_XP = new Set<string>(["daily_login", "daily_tictactoe"]);
/** Capped per day here as well as the shared list (lib/xp.ts). */
export const EXTRA_CAPPED_XP = new Set<string>(["draft_invincible", "bdo_win", "bdo_career", "bdo_podium", "bdo_season"]);

export function isCappedXp(eventType: string): boolean {
  return DAILY_CAPPED_EVENTS.has(eventType) || EXTRA_CAPPED_XP.has(eventType);
}

const RUN_KEY = /^[A-Za-z0-9._-]{1,120}$/;
const GAME_REF = /^[A-Za-z0-9._:-]{1,120}$/;

/** "2026-10-08" in UTC. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The key plan for a non-objective event. `known` = it is in XP_AWARDS. */
export function planXpEvent(eventType: string, clientRef: unknown, now: Date, known: boolean): XpPlan {
  if (!known) return { kind: "reject", reason: "Unknown event type" };
  if (SERVER_ONLY_XP.has(eventType)) return { kind: "reject", reason: "This XP is awarded by the game itself" };
  const day = utcDay(now);
  if (eventType === "join") return { kind: "fixed", ref: "join" };
  if (eventType === "streak_7") return { kind: "fixed", ref: "streak_7", needStreak: 7 };
  if (eventType === "streak_30") return { kind: "fixed", ref: "streak_30", needStreak: 30 };
  if (ONCE_A_DAY_XP.has(eventType)) return { kind: "day", ref: `day:${day}` };
  if (eventType === "draft_complete" || eventType === "draft_win" || eventType === "draft_invincible") {
    const raw = typeof clientRef === "string" ? clientRef : "";
    const runKey = eventType === "draft_complete" ? raw.replace(/^draft-/, "") : raw;
    if (!RUN_KEY.test(runKey)) return { kind: "reject", reason: "No saved season named" };
    // Same keys the game always used, so seasons paid before stay paid.
    const ref = eventType === "draft_complete" ? `draft-${runKey}` : runKey;
    const need = eventType === "draft_complete" ? "complete" : eventType === "draft_win" ? "win" : "invincible";
    return { kind: "run", runKey, ref, need };
  }
  if (eventType.startsWith("bdo_")) {
    if (typeof clientRef !== "string" || !GAME_REF.test(clientRef)) return { kind: "reject", reason: "Bad season key" };
    return { kind: "capped-ref", ref: clientRef };
  }
  if (DAILY_CAPPED_EVENTS.has(eventType)) return { kind: "slot", base: `day:${day}` };
  return { kind: "reject", reason: "This XP can't be claimed from the game" };
}

/** The slot key for the next award today, or null once the day's cap is reached. */
export function slotRef(base: string, awardedToday: number): string | null {
  return awardedToday >= DAILY_XP_CAP ? null : `${base}:${awardedToday}`;
}

/** Does a saved season (draft_runs row) earn this award? */
export function runQualifies(
  need: "complete" | "win" | "invincible",
  row: { season_number: number | null; finish: number | null; losses: number | null },
): boolean {
  if (need === "win") return row.finish === 1;
  if (need === "invincible") return row.losses === 0;
  return (row.season_number ?? 0) >= 5;
}
