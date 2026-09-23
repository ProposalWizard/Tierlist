import type { CareerState, Fixture } from "./types";
import type { CareerDivision } from "./calendar";
import { getTuning } from "./tuningStore";

/**
 * ENERGY — THE WEEKLY BUDGET (rebuilt 22 Sep 2026, owners' master plan).
 *
 *  - Every day you don't play is a rest day and gives energy back
 *    (Saturday → Saturday = 6 rest days; Saturday → Wednesday = 3).
 *  - A match drains energy minute by minute, at a rate set by the
 *    competition AND the energy mode you pick in the match:
 *
 *      Premier League, full 90:   Low 30 · Medium 60 · High 95
 *
 *    Every other competition is that, times its own factor (below).
 *  - Training costs 30 a session. Rest (the weekly action) gives 10.
 *  - Owning a working property and your club's training ground add a
 *    little every rest day.
 *
 * The old rule — every unused weekly action silently worth +20 when you
 * played — is gone. It was why energy never ran out.
 *
 * All the headline numbers are editable at /star-tuning-dev.
 */

export type EnergyMode = "low" | "medium" | "high";
export const ENERGY_MODES: EnergyMode[] = ["low", "medium", "high"];

/** Premier League, full 90 minutes, on Medium. */
export const ENERGY_FULL_MATCH_MEDIUM = getTuning("energy.fullMatchMedium");
/** Premier League, full 90 minutes, on High. */
export const ENERGY_FULL_MATCH_HIGH = getTuning("energy.fullMatchHigh");
/** Premier League, full 90 minutes, on Low. */
export const ENERGY_FULL_MATCH_LOW = getTuning("energy.fullMatchLow");

/** How much more (or less) often the ball comes to you in each mode.
 *  Medium is exactly today's game. */
export const MODE_INVOLVEMENT: Record<EnergyMode, number> = {
  low: getTuning("energy.lowModeChances"),
  medium: 1,
  high: getTuning("energy.highModeChances"),
};

/** Each competition's cost, relative to the Premier League (1.0).
 *  From the plan's full-match Medium costs: NL 28 · L2 30 · L1 32 ·
 *  Champ 34 · PL 36 · Europa 38 · Champions League / Super Cup 40. */
export const DIVISION_ENERGY_FACTOR: Record<CareerDivision, number> = {
  national_league: 28 / 36,
  league_two: 30 / 36,
  league_one: 32 / 36,
  championship: 34 / 36,
  premier: 1,
};
export const EUROPA_ENERGY_FACTOR = 38 / 36;
export const CHAMPIONS_ENERGY_FACTOR = 40 / 36;
/** Internationals weren't specified; set at Europa League level. */
export const INTERNATIONAL_ENERGY_FACTOR = 38 / 36;

/** Which English division a club plays in this season, if known. */
export function clubDivision(career: Pick<CareerState, "divisions" | "division" | "league">, club: string): CareerDivision | null {
  if (career.league?.some(t => t.name === club)) return career.division ?? "premier";
  const d = career.divisions;
  if (!d) return null;
  if (d.premier?.includes(club)) return "premier";
  if (d.championship?.includes(club)) return "championship";
  if (d.leagueOne?.includes(club)) return "league_one";
  if (d.leagueTwo?.includes(club)) return "league_two";
  if (d.nationalLeague?.includes(club)) return "national_league";
  return null;
}

/**
 * The factor for this fixture.
 *  - League: your own division.
 *  - FA Cup, League Cup, Community Shield: the OPPONENT's division (a
 *    Premier League side at a National League ground pays National League
 *    legs; the other way round, Premier League legs).
 *  - Europa League 38/36; Champions League and Super Cup 40/36.
 */
export function energyFactorFor(
  career: Pick<CareerState, "divisions" | "division" | "league">,
  fixture: Pick<Fixture, "kind" | "competition" | "opponent"> | null | undefined,
): number {
  const own = DIVISION_ENERGY_FACTOR[career.division ?? "premier"] ?? 1;
  if (!fixture) return own;
  const comp = fixture.competition;
  if (comp === "Champions League" || comp === "Super Cup") return CHAMPIONS_ENERGY_FACTOR;
  if (comp === "Europa League" || comp === "Conference League") return EUROPA_ENERGY_FACTOR;
  if (fixture.kind === "international") return INTERNATIONAL_ENERGY_FACTOR;
  if (comp === "FA Cup" || comp === "League Cup" || comp === "Community Shield") {
    const theirs = clubDivision(career, fixture.opponent);
    return theirs ? DIVISION_ENERGY_FACTOR[theirs] : own;
  }
  return own;
}

/** Energy used per match minute, in this mode, at this factor. */
export function energyPerMinute(mode: EnergyMode, factor = 1): number {
  const full = mode === "high" ? ENERGY_FULL_MATCH_HIGH
    : mode === "low" ? ENERGY_FULL_MATCH_LOW
      : ENERGY_FULL_MATCH_MEDIUM;
  return (full / 90) * factor;
}

// ── Recovery ────────────────────────────────────────────────────────────────

export const REST_DAY_ENERGY = getTuning("energy.restDayEnergy");
export const PROPERTY_DAY_ENERGY = getTuning("energy.propertyDayEnergy");
/** Training ground tier 1 / 2 / 3, per rest day. */
export const TRAINING_GROUND_DAY_ENERGY: Record<1 | 2 | 3, number> = {
  1: 0,
  2: getTuning("energy.trainingGroundTier2Day"),
  3: getTuning("energy.trainingGroundTier3Day"),
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Recovery is capped at this many days in one gap (a winter or
 *  international break); energy tops out at 100 anyway. */
export const MAX_REST_DAYS = 14;

/** Whole days strictly between two kick-offs — Sat→Sat is 6, Sat→Wed is 3. */
export function restDaysBetween(fromMs: number, toMs: number): number {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return 0;
  const days = Math.round((toMs - fromMs) / DAY_MS) - 1;
  return Math.max(0, Math.min(MAX_REST_DAYS, days));
}

/** Energy per rest day, with everything that adds to it. */
export function dailyRecovery(ownsWorkingProperty: boolean, trainingGroundTier: number): number {
  const tier = (Math.max(1, Math.min(3, Math.round(trainingGroundTier || 1))) as 1 | 2 | 3);
  return REST_DAY_ENERGY + (ownsWorkingProperty ? PROPERTY_DAY_ENERGY : 0) + TRAINING_GROUND_DAY_ENERGY[tier];
}

export function clampEnergy(n: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}
