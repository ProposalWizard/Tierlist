import type { CareerState, Fixture } from "./types";
import { divisionOf } from "./calendar";

/**
 * RECORDS.
 *
 * The Achievements tab's second half: not "did you do X at all" but "did you
 * do it better than the real Premier League has ever seen it done". A short,
 * hand-picked, high-confidence starting list — more is meant to be added here
 * as they come to mind, the same way ACHIEVEMENTS (achievements.ts) grew.
 *
 * "season"/"match" records are measured against your best SEASON or best
 * SINGLE MATCH ever, not a running career total — `leagueSeasonStats` (the
 * league-only tally the Golden Boot/Assist King already use) resets every
 * rollover, so `personalBests` on CareerState remembers the high-water mark
 * across seasons (see `updatePersonalBests`, folded in by `advanceSeason`).
 * "career" records need no such snapshot: `careerLeagueStats` is already a
 * running total that is never reset, so `progress` reads it straight.
 *
 * Every record here is Premier-League-specific by the nature of the real
 * numbers being compared against, so a Championship season contributes
 * nothing toward one — `divisionOf(c) === "championship"` opts a season out
 * of `seasonValue` rather than counting a lesser division's goals against a
 * top-flight record.
 */

export type RecordScope = "season" | "match" | "career";

export interface RecordDef {
  id: string;
  label: string;
  holder: string;
  /** When it happened — a season ("2022/23") or, for a shared record, looser. */
  achieved: string;
  value: number;
  unit: string;
  scope: RecordScope;
  description: string;
  /**
   * This season's (or this match's) contribution toward the record, read at
   * rollover to update `personalBests`. Only meaningful for "season"/"match"
   * scope — "career" records read `careerLeagueStats` directly instead and
   * leave this unset. Returns null for a season that cannot count (played in
   * the Championship, or no league fixtures yet).
   */
  seasonValue?: (c: CareerState) => number | null;
  /** Your best-ever showing against this record, right now. */
  progress: (c: CareerState) => number;
}

function playedLeagueFixtures(c: CareerState): Fixture[] {
  return c.fixtures.filter(f => f.kind === "league" && f.played);
}

/** The higher of your locked-in personal best and this season's live number,
 *  so mid-season progress shows immediately rather than waiting for rollover. */
function seasonBest(c: CareerState, id: string, live: (c: CareerState) => number | null): number {
  const locked = c.personalBests?.[id] ?? 0;
  const now = live(c);
  return now === null ? locked : Math.max(locked, now);
}

const plAssistsSeason = (c: CareerState) => (divisionOf(c) === "championship" ? null : c.leagueSeasonStats?.assists ?? 0);
const plGoalsSeason = (c: CareerState) => (divisionOf(c) === "championship" ? null : c.leagueSeasonStats?.goals ?? 0);
const plGoalsMatch = (c: CareerState) => {
  if (divisionOf(c) === "championship") return null;
  const games = playedLeagueFixtures(c);
  return games.length ? Math.max(...games.map(f => f.userGoals ?? 0)) : null;
};

export const RECORDS: RecordDef[] = [
  {
    id: "pl-assists-season",
    label: "Most Assists in a Premier League Season",
    holder: "Bruno Fernandes",
    achieved: "2025/26",
    value: 21,
    unit: "assists",
    scope: "season",
    description: "21 assists across a single 38-game Premier League campaign.",
    seasonValue: plAssistsSeason,
    progress: (c) => seasonBest(c, "pl-assists-season", plAssistsSeason),
  },
  {
    id: "pl-goals-season",
    label: "Most Goals in a Premier League Season",
    holder: "Erling Haaland",
    achieved: "2022/23",
    value: 36,
    unit: "goals",
    scope: "season",
    description: "36 goals in a single 38-game Premier League campaign, in his debut season at Manchester City.",
    seasonValue: plGoalsSeason,
    progress: (c) => seasonBest(c, "pl-goals-season", plGoalsSeason),
  },
  {
    id: "pl-goals-match",
    label: "Most Goals in a Single Premier League Match",
    holder: "Held jointly — Andy Cole, Alan Shearer, Jermain Defoe and others",
    achieved: "several occasions",
    value: 5,
    unit: "goals",
    scope: "match",
    description: "5 goals in one Premier League match, a mark reached by a handful of strikers across the competition's history.",
    seasonValue: plGoalsMatch,
    progress: (c) => seasonBest(c, "pl-goals-match", plGoalsMatch),
  },
  {
    id: "pl-goals-career",
    label: "Most Premier League Goals (Career)",
    holder: "Alan Shearer",
    achieved: "1992–2006",
    value: 260,
    unit: "goals",
    scope: "career",
    description: "260 goals across a whole Premier League career — the competition's all-time top scorer.",
    progress: (c) => c.careerLeagueStats?.goals ?? 0,
  },
  {
    id: "pl-appearances-career",
    label: "Most Premier League Appearances (Career)",
    holder: "Gareth Barry",
    achieved: "1998–2017",
    value: 653,
    unit: "appearances",
    scope: "career",
    description: "653 Premier League appearances across a nineteen-season career.",
    progress: (c) => c.careerLeagueStats?.appearances ?? 0,
  },
];

/** Whether your best-ever showing against a record has actually beaten it. */
export function recordBeaten(c: CareerState, r: RecordDef): boolean {
  return r.progress(c) >= r.value;
}

/**
 * Folds the season just finished into `personalBests`, taking the higher of
 * what was already locked in and what this season (or its best single match)
 * produced. Called from `advanceSeason`, on the CareerState from BEFORE the
 * rollover resets `leagueSeasonStats`/`fixtures` — the only moment this
 * season's numbers are still readable.
 */
export function updatePersonalBests(c: CareerState): Record<string, number> {
  const best = { ...(c.personalBests ?? {}) };
  for (const r of RECORDS) {
    if (!r.seasonValue) continue;
    const v = r.seasonValue(c);
    if (v !== null) best[r.id] = Math.max(best[r.id] ?? 0, v);
  }
  return best;
}
