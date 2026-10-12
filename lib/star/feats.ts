/**
 * CAREER FEATS — the per-match tallies the achievements and records need.
 *
 * Roadmap #4 (11 Oct 2026): "Achievements and records filled out." Most of
 * the new achievements ask about ONE match ("a hat-trick in a derby", "a
 * winner after 85 minutes", "a free-kick goal"), and a CareerState only
 * keeps career totals. So creditMatchResult folds each played match into
 * this small record once (it is guarded on `alreadyPlayed`, like every other
 * tally there), and the achievement checks read it afterwards.
 *
 * Pure. Additive: a save from before it has no feats and starts counting
 * from its next match; nothing here can be rebuilt from older matches.
 * Every competition counts (club and country) unless a field says otherwise.
 */
import type { CareerState, Fixture, MatchStats, GoalEvent } from "./types";
import { divisionOf } from "./calendar";
import { isDerby } from "./rivalries";

export interface CareerFeats {
  /** Your goals by how they went in: a chance kind ("header", "free_kick",
   *  "penalty", "rebound" …), "chip" and "curl" for the finish, "far25" and
   *  "far30" for strikes from 25 m and 30 m out. */
  goalsBy?: Record<string, number>;
  /** Matches with 2+ / 3+ / 4+ goals of yours, any competition. */
  braces?: number;
  hatTricks?: number;
  hauls4?: number;
  /** Your best single match: completed passes, assists, match rating. */
  bestPassesMatch?: number;
  bestAssistsMatch?: number;
  bestRating?: number;
  /** Derbies (lib/star/rivalries.ts isDerby) you played in. */
  derbyWins?: number;
  derbyGoals?: number;
  derbyHatTricks?: number;
  /** The goal that won the match was yours (`winners`), and it came in the
   *  85th minute or later (`lateWinners`). Only counted when the match's goal
   *  list agrees with its score, so a guess is never credited. */
  winners?: number;
  lateWinners?: number;
  /** A goal after coming off the bench. */
  subGoals?: number;
  /** Penalty shootouts your side won. */
  shootoutWins?: number;
  /** European club football. */
  europeApps?: number;
  europeGoals?: number;
  clGoals?: number;
  /** Matches in a row with a goal of yours (now, and the best). */
  scoringRun?: number;
  bestScoringRun?: number;
  bestScoringRunSeason?: number;
  /** Wins in a row in matches you played (now, and the best). */
  winRun?: number;
  bestWinRun?: number;
  /** Premier League only, for the real Premier League records. */
  plScoringRun?: number;
  bestPlScoringRun?: number;
  plHatTricks?: number;
  bestPlWinMargin?: number;
}

const add = (n: number | undefined, by: number) => (n ?? 0) + by;

/** Our side's score and theirs, from the fixture's home/away. */
export function scoreFor(fixture: Fixture, stats: MatchStats): { us: number; them: number } {
  return fixture.home
    ? { us: stats.homeScore, them: stats.awayScore }
    : { us: stats.awayScore, them: stats.homeScore };
}

/**
 * The goal that won the match — our (them + 1)th goal in time order — or
 * null when it can't be known for sure: not a win, the named goals don't add
 * up to the score, or two goals share the same minute around it.
 */
export function winningGoal(fixture: Fixture, stats: MatchStats): GoalEvent | null {
  const { us, them } = scoreFor(fixture, stats);
  if (us <= them) return null;
  const ours = stats.goalEvents ?? [];
  const theirs = stats.oppGoalEvents ?? [];
  if (ours.length !== us || theirs.length !== them) return null;
  // Shootouts and extra time are added into the score; the minutes still sort.
  const sorted = [...ours].sort((a, b) => a.minute - b.minute);
  const winner = sorted[them];
  if (!winner) return null;
  // Same minute as the goal before or after it: the order isn't known.
  if (sorted[them - 1]?.minute === winner.minute || sorted[them + 1]?.minute === winner.minute) return null;
  return winner;
}

/** This match folded into the feats. Call once per played match. */
export function featsAfterMatch(career: CareerState, fixture: Fixture, stats: MatchStats): CareerFeats {
  const f: CareerFeats = { ...(career.feats ?? {}), goalsBy: { ...(career.feats?.goalsBy ?? {}) } };
  const goalsBy = f.goalsBy!;
  const mine = (stats.goalEvents ?? []).filter(e => e.isUserGoal);
  for (const e of mine) {
    if (e.how) goalsBy[e.how] = add(goalsBy[e.how], 1);
    if (e.finish === "chip" || e.finish === "curl") goalsBy[e.finish] = add(goalsBy[e.finish], 1);
    if ((e.distance ?? 0) >= 25) goalsBy.far25 = add(goalsBy.far25, 1);
    if ((e.distance ?? 0) >= 30) goalsBy.far30 = add(goalsBy.far30, 1);
  }

  const goals = Math.max(0, stats.goals | 0);
  const { us, them } = scoreFor(fixture, stats);
  const won = us > them;
  const kind = fixture.kind ?? "league";
  const pl = kind === "league" && divisionOf(career) === "premier";

  if (goals >= 2) f.braces = add(f.braces, 1);
  if (goals >= 3) f.hatTricks = add(f.hatTricks, 1);
  if (goals >= 4) f.hauls4 = add(f.hauls4, 1);
  f.bestPassesMatch = Math.max(f.bestPassesMatch ?? 0, stats.passes | 0);
  f.bestAssistsMatch = Math.max(f.bestAssistsMatch ?? 0, stats.assists | 0);
  if (Number.isFinite(stats.rating)) f.bestRating = Math.max(f.bestRating ?? 0, stats.rating);

  if (kind !== "international" && isDerby(career.player.club, fixture.opponent)) {
    if (won) f.derbyWins = add(f.derbyWins, 1);
    f.derbyGoals = add(f.derbyGoals, goals);
    if (goals >= 3) f.derbyHatTricks = add(f.derbyHatTricks, 1);
  }

  const w = winningGoal(fixture, stats);
  if (w?.isUserGoal) {
    f.winners = add(f.winners, 1);
    if (w.minute >= 85) f.lateWinners = add(f.lateWinners, 1);
  }
  if (stats.cameo && goals > 0) f.subGoals = add(f.subGoals, 1);
  if (stats.shootout) {
    const ours = fixture.home ? stats.shootout.home : stats.shootout.away;
    const theirs = fixture.home ? stats.shootout.away : stats.shootout.home;
    if (ours > theirs) f.shootoutWins = add(f.shootoutWins, 1);
  }
  if (kind === "europe") {
    f.europeApps = add(f.europeApps, 1);
    f.europeGoals = add(f.europeGoals, goals);
    if (fixture.competition === "Champions League") f.clGoals = add(f.clGoals, goals);
  }

  f.scoringRun = goals > 0 ? add(f.scoringRun, 1) : 0;
  if (f.scoringRun > (f.bestScoringRun ?? 0)) { f.bestScoringRun = f.scoringRun; f.bestScoringRunSeason = career.season; }
  f.winRun = won ? add(f.winRun, 1) : 0;
  f.bestWinRun = Math.max(f.bestWinRun ?? 0, f.winRun);

  if (pl) {
    f.plScoringRun = goals > 0 ? add(f.plScoringRun, 1) : 0;
    f.bestPlScoringRun = Math.max(f.bestPlScoringRun ?? 0, f.plScoringRun);
    if (goals >= 3) f.plHatTricks = add(f.plHatTricks, 1);
    if (won) f.bestPlWinMargin = Math.max(f.bestPlWinMargin ?? 0, us - them);
  }
  return f;
}
