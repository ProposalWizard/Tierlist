import {
  logMatchGoals, bestGoals, goalScore, protectedClipIds, seasonGoals, competitionOf,
  GOAL_LOG_MAX, type CareerGoal,
} from "../../lib/star/goalLog";
import { slimCareer, hallIdFor } from "../../lib/star/hallOfFame";
import type { CareerState, Fixture, GoalEvent, MatchStats } from "../../lib/star/types";

/**
 * THE CAREER GOAL LOG (Leo, 22 Oct 2026): one small row per goal of yours.
 *
 *  - Only your goals go in; a match where you did not score changes nothing.
 *  - Crediting the same match twice replaces its goals, never doubles them.
 *  - The log never grows past GOAL_LOG_MAX (oldest go first).
 *  - bestGoals ranks the special ones first (distance, chips, late winners).
 *  - protectedClipIds keeps the season still waiting for its reel + the best 10.
 *  - The Hall of Fame copy keeps only the best 10, and its id ignores them.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const career = (over: Partial<CareerState> = {}): CareerState => ({
  season: 2,
  player: { club: "Arsenal", firstName: "Leo", lastName: "Test", startYear: 2026 },
  careerStats: { appearances: 0, goals: 0, assists: 0 },
  trophies: [],
  ...over,
} as unknown as CareerState);

const fixture = (over: Partial<Fixture> = {}): Fixture => ({ week: 5, opponent: "Chelsea", home: true, played: true, ...over });
const goal = (minute: number, mine = true, extra: Partial<GoalEvent> = {}): GoalEvent => ({ minute, scorer: mine ? "Leo Test" : "Someone Else", isUserGoal: mine, ...extra });
const stats = (events: GoalEvent[], us = 3, them = 1): MatchStats => ({ goalEvents: events, homeScore: us, awayScore: them } as unknown as MatchStats);

// ── 1. Only your goals ──────────────────────────────────────────────────────
{
  const c = career();
  const log = logMatchGoals(c, fixture(), stats([goal(12), goal(30, false), goal(77, true, { distance: 24.37, finish: "curl", clipId: "clip-a", how: "long range" })]), "Premier League") ?? [];
  check(log.length === 2, `two of three goals are yours (got ${log.length})`);
  check(log.every(g => g.club === "Arsenal" && g.opponent === "Chelsea" && g.home), "club, opponent and ground are set");
  check(log[0].competition === "Premier League", `a league game reads the league's name (${log[0].competition})`);
  check(log[1].distance === 24.4 && log[1].finish === "curl" && log[1].clipId === "clip-a", "distance (one decimal), finish and clip are kept");
  check(log[0].score === "3-1", `the score is yours first (${log[0].score})`);
  check(!("distance" in log[0]) && !("clipId" in log[0]), "missing facts stay out of the row (small save)");
  const none = logMatchGoals({ ...c, goalLog: log }, fixture({ week: 6 }), stats([goal(5, false)]));
  check(none === log, "a match you did not score in returns the same list");
  check(logMatchGoals(c, fixture(), stats([])) === undefined, "an old save with no log and no goal stays without one");
  check(competitionOf(fixture({ kind: "playoff" })) === "Play-Offs", "a play-off reads Play-Offs");
  check(competitionOf(fixture({ competition: "FA Cup" as Fixture["competition"], kind: "cup" })) === "FA Cup", "a cup reads its name");
}

// ── 2. A re-credit replaces, never doubles ─────────────────────────────────
{
  let c = career();
  c = { ...c, goalLog: logMatchGoals(c, fixture(), stats([goal(10), goal(20)])) };
  c = { ...c, goalLog: logMatchGoals(c, fixture({ week: 6, opponent: "Spurs" }), stats([goal(44)])) };
  const again = logMatchGoals(c, fixture(), stats([goal(10)]));
  check(again?.length === 2, `crediting week 5 again replaces its goals (got ${again?.length}, want 2)`);
  check(again?.filter(g => g.week === 5).length === 1 && again?.some(g => g.opponent === "Spurs"), "the other match's goal stays");
  // The same week against a different opponent (a cup tie) is a different match.
  const cup = logMatchGoals(c, fixture({ opponent: "Spurs", kind: "cup", competition: "FA Cup" as Fixture["competition"] }), stats([goal(90)]));
  check(cup?.length === 4, `a cup tie the same week is its own match (got ${cup?.length})`);
  check(seasonGoals({ ...c, goalLog: cup }).length === 4 && seasonGoals({ ...c, goalLog: cup }, 1).length === 0, "seasonGoals picks the season");
  check(new Set(cup?.map(g => g.id)).size === cup?.length, "every id is unique");
}

// ── 3. The cap ─────────────────────────────────────────────────────────────
{
  const full: CareerGoal[] = Array.from({ length: GOAL_LOG_MAX }, (_, i) => ({
    id: `1:${i}:league:X:${i}:0`, season: 1, week: i, minute: 10, opponent: "X", club: "Arsenal", home: true, competition: "League", score: "1-0",
  }));
  const c = career({ goalLog: full });
  const after = logMatchGoals(c, fixture({ week: 9999 }), stats([goal(1), goal(2)])) ?? [];
  check(after.length === GOAL_LOG_MAX, `never past ${GOAL_LOG_MAX} (got ${after.length})`);
  check(after[after.length - 1].minute === 2 && after[0].id === full[2].id, "the oldest two go, the new two are kept");
}

// ── 4. bestGoals order ─────────────────────────────────────────────────────
{
  const g = (id: string, over: Partial<CareerGoal>): CareerGoal => ({ id, season: 1, week: 1, minute: 30, opponent: "X", club: "Arsenal", home: true, competition: "League", score: "3-0", ...over });
  const tapIn = g("a", { distance: 6 });
  const pen = g("b", { distance: 11, how: "penalty" });
  const screamer = g("c", { distance: 30 });
  const chip = g("d", { distance: 16, finish: "chip" });
  const lateWinner = g("e", { distance: 14, minute: 89, score: "2-1" });
  const ranked = bestGoals([tapIn, pen, screamer, chip, lateWinner], 5).map(x => x.id);
  check(ranked[0] === "c", `the 30 m strike is best (${ranked.join(",")})`);
  check(ranked.indexOf("b") === 4, `the penalty is last (${ranked.join(",")})`);
  check(goalScore(chip) > goalScore(g("f", { distance: 16 })), "a chip beats the same goal not chipped");
  check(goalScore(lateWinner) > goalScore(g("h", { distance: 14 })), "a late winner beats the same goal at 30'");
  check(bestGoals([tapIn, pen, screamer], 2).length === 2, "n is respected");
  const twin = g("z", { distance: 6, clipId: "v" });
  check(bestGoals([tapIn, twin], 1)[0].id === "z", "a tie goes to the goal with a video");
}

// ── 5. protectedClipIds ─────────────────────────────────────────────────────
{
  const rows: CareerGoal[] = [];
  // Season 1: 15 goals with videos, the reel made. Distances 10..38 m.
  for (let i = 0; i < 15; i++) rows.push({ id: `s1-${i}`, season: 1, week: i, minute: 20, opponent: "X", club: "Arsenal", home: true, competition: "League", score: "4-0", distance: 10 + i * 2, clipId: `c1-${i}` });
  // Season 2: 3 short goals with videos, reel still to come.
  for (let i = 0; i < 3; i++) rows.push({ id: `s2-${i}`, season: 2, week: i, minute: 20, opponent: "X", club: "Arsenal", home: true, competition: "League", score: "4-0", distance: 6, clipId: `c2-${i}` });
  // A goal with no video is never asked for.
  rows.push({ id: "s2-novid", season: 2, week: 9, minute: 20, opponent: "X", club: "Arsenal", home: true, competition: "League", score: "4-0", distance: 40 });
  const ids = new Set(protectedClipIds(career({ season: 2, goalLog: rows, reelDoneSeason: 1 })));
  check(["c2-0", "c2-1", "c2-2"].every(id => ids.has(id)), "the season waiting for its reel is kept");
  const best10 = Array.from({ length: 10 }, (_, k) => `c1-${14 - k}`);
  check(best10.every(id => ids.has(id)), "the best 10 videos are kept");
  check(!ids.has("c1-0") && !ids.has("c1-4"), "the short season-1 goals outside the best 10 are not");
  check(ids.size === 13, `13 kept (got ${ids.size})`);
  check(protectedClipIds(null).length === 0 && protectedClipIds(career()).length === 0, "no career or no log: nothing");
}

// ── 6. The Hall of Fame copy keeps the best 10 ──────────────────────────────
{
  const rows: CareerGoal[] = Array.from({ length: 40 }, (_, i) => ({ id: `g${i}`, season: 1 + (i % 4), week: i, minute: 30, opponent: "X", club: "Arsenal", home: true, competition: "League", score: "2-0", distance: 5 + i }));
  const c = career({ goalLog: rows });
  const slim = slimCareer(c);
  check(slim.goalLog?.length === 10, `the Hall copy keeps 10 goals (got ${slim.goalLog?.length})`);
  check(JSON.stringify(slim.goalLog) === JSON.stringify(bestGoals(rows, 10)), "they are the best 10, best first");
  check(hallIdFor(c) === hallIdFor(slim) && hallIdFor(c) === hallIdFor(career()), "the Hall id does not depend on the goal log");
  check(!("goalLog" in slimCareer(career())), "a career with no log gets none");
}

if (problems.length) { console.error("goalLog FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("goalLog: all checks passed");
