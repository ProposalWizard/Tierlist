/**
 * EVERY ACHIEVEMENT CAN UNLOCK, AND ONLY ONCE (Roadmap #4, 11 Oct 2026).
 *
 * - The list: unique ids, a label, a description, a tier and a group each,
 *   and an XP amount in the XP Book (only First Contract pays nothing).
 * - Three synthetic careers (a teenager, a one-club veteran, a well-travelled
 *   veteran) between them trigger every achievement — so none is dead.
 * - A brand-new career triggers nothing but the contract.
 * - feats.ts reads one match correctly (goal kinds, chip/curl, derby, the
 *   winning goal, shootouts, runs), and a replayed match changes nothing.
 * - The money ones moved: ★100 / ★500 → ★10,000 / ★100,000.
 */
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS, checkNewAchievements } from "../../lib/star/achievements";
import { DEFAULT_XP, achievementXp } from "../../lib/star/xpConfig";
import { featsAfterMatch, winningGoal } from "../../lib/star/feats";
import { makeInitialCareer, creditMatchResult, attachClub } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { RECORDS } from "../../lib/star/records";
import type { CareerState, Fixture, MatchStats, StarPlayer, GoalEvent, OppGoalEvent } from "../../lib/star/types";

const problems: string[] = [];
let passed = 0;
const check = (ok: boolean, what: string) => { if (ok) passed++; else problems.push(what); };

// ── The list ──
{
  const ids = ACHIEVEMENTS.map(a => a.id);
  check(new Set(ids).size === ids.length, "every achievement id is unique");
  for (const a of ACHIEVEMENTS) {
    check(a.label.length > 0 && a.description.length > 0, `${a.id} has a label and a description`);
    check(ACHIEVEMENT_GROUPS.includes(a.group), `${a.id} is in a known group`);
    check(DEFAULT_XP.achievementTier[a.id] === a.tier, `${a.id}'s tier is in the XP Book`);
    const pays = achievementXp(a.id, DEFAULT_XP);
    check(a.id === "first-contract" ? pays === 0 : pays > 0, `${a.id} pays XP (${pays})`);
  }
  for (const r of RECORDS) check((DEFAULT_XP.records[r.id] ?? 0) > 0, `record ${r.id} pays XP`);
  console.log(`${ACHIEVEMENTS.length} achievements: ` + (["easy", "medium", "hard", "legendary"] as const)
    .map(t => `${ACHIEVEMENTS.filter(a => a.tier === t).length} ${t}`).join(", "));
}

// ── Synthetic careers ──
function player(age: number): StarPlayer {
  return { firstName: "Test", lastName: "Player", age, skinTone: "light", club: "Arsenal", clubBadge: null,
    position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
}
const fresh = (): CareerState => makeInitialCareer(player(17), [...PREMIER_LEAGUE_CLUBS]);

const ALL_TROPHIES = ["Premier League", "Championship", "League One", "League Two", "National League", "National League North",
  "Play-Offs", "FA Cup", "League Cup", "Community Shield", "Conference League", "Europa League", "Champions League",
  "Super Cup", "World Cup", "European Championship"];

/** Everything a great career can have, apart from the things that rule each other out. */
function great(age: number): CareerState {
  const c = attachClub(fresh(), "Arsenal", [...PREMIER_LEAGUE_CLUBS]);
  const stats = { appearances: 600, goals: 320, hatTricks: 8, passes: 900, assists: 120, starMan: 40, totalRating: 0, ratingCount: 0 };
  return {
    ...c,
    player: { ...c.player, age },
    season: 20,
    careerStats: stats,
    seasonStats: { ...stats, appearances: 30, goals: 25, assists: 8 },
    careerBests: {
      mostGoalsMatch: { goals: 5, season: 3, opponent: "Chelsea" },
      mostGoalsSeason: { goals: 42, season: 4 },
      mostAssistsSeason: { assists: 18, season: 4 },
      mostAssistsMatch: { assists: 3, season: 4, opponent: "Chelsea" },
      fastestGoal: { minute: 2, season: 5, opponent: "Chelsea" },
      biggestWin: { us: 7, them: 0, season: 5, opponent: "Chelsea" },
      furthestGoal: { metres: 31, season: 5, opponent: "Chelsea" },
    },
    feats: {
      goalsBy: { header: 12, volley: 2, free_kick: 6, penalty: 11, long_range: 3, tight_angle: 1, rebound: 4, chip: 1, curl: 2, far25: 3, far30: 1 },
      braces: 20, hatTricks: 8, hauls4: 2, bestPassesMatch: 11, bestAssistsMatch: 3, bestRating: 9.7,
      derbyWins: 12, derbyGoals: 9, derbyHatTricks: 1, winners: 14, lateWinners: 2, subGoals: 1, shootoutWins: 1,
      europeApps: 30, europeGoals: 12, clGoals: 5, bestScoringRun: 11, bestWinRun: 12,
    },
    caps: 110, internationalGoals: 30,
    trophies: [
      ...ALL_TROPHIES.map((competition, i) => ({ season: i + 1, competition, club: "Arsenal" })),
      { season: 18, competition: "Premier League", club: "Arsenal" }, { season: 18, competition: "FA Cup", club: "Arsenal" },
      { season: 18, competition: "Champions League", club: "Arsenal" },
      { season: 19, competition: "FA Cup", club: "Arsenal" }, { season: 19, competition: "Premier League", club: "Arsenal" },
      ...Array.from({ length: 8 }, (_, i) => ({ season: 10 + i, competition: "Community Shield", club: "Arsenal" })),
    ],
    awards: [
      ...Array.from({ length: 6 }, (_, i) => ({ season: 2 + i, kind: "Player of the Month", detail: "" })),
      { season: 4, kind: "Golden Boot", detail: "" }, { season: 4, kind: "Player of the Season", detail: "" },
    ],
    ballonDorWins: 3,
    seasonHistory: [
      { season: 1, age: 17, club: "Arsenal", division: "league_two", position: 1, teams: 24, move: "promoted", winners: {}, overall: 60, fame: 10, money: 0, wage: 0, caps: 0, intlGoals: 0 },
      { season: 2, age: 18, club: "Arsenal", division: "league_one", position: 1, teams: 24, move: "promoted", winners: {}, overall: 60, fame: 10, money: 0, wage: 0, caps: 0, intlGoals: 0 },
      { season: 3, age: 19, club: "Arsenal", division: "championship", position: 1, teams: 24, move: "promoted", winners: {}, overall: 60, fame: 10, money: 0, wage: 0, caps: 0, intlGoals: 0 },
      { season: 4, age: 20, club: "Arsenal", division: "premier", position: 1, teams: 20, move: null, winners: {}, ballonDor: { winner: "x", club: "y", yourRank: 2 }, overall: 60, fame: 10, money: 0, wage: 0, caps: 0, intlGoals: 0 },
    ],
    relationships: { ...c.relationships, boss: 95, team: 95, fans: 95 },
    starRating: 5,
    skills: { pace: 100, power: 100, technique: 100, vision: 100, freeKick: 100 },
    captain: true,
    money: 12_000_000,
    fame: 90,
    ownedItems: Array.from({ length: 10 }, (_, i) => ({ id: `item${i}`, name: "Thing", category: "item" as const, price: 1, lifestyleValue: 1, level: i === 0 ? 5 : 1 })),
  };
}
const archive = (clubs: string[]) => clubs.map((club, i) => ({ season: i + 1, club, apps: 40, goals: 15, assists: 5, avgRating: 7, motm: 2 }));

const teen = { ...great(19), seasonArchive: archive(Array(10).fill("Arsenal")) };
const oneClub = { ...great(36), seasonArchive: archive(Array(12).fill("Arsenal")) };
const travelled: CareerState = {
  ...great(36),
  seasonArchive: archive(["Arsenal", "Arsenal", "Chelsea", "Everton", "Real Madrid", "Real Madrid"]),
  transfers: [{ season: 2, from: "Arsenal", to: "Chelsea", fee: 1 }, { season: 4, from: "Chelsea", to: "Real Madrid", fee: 1 }],
};
{
  const unlockedBy = new Set<string>();
  for (const c of [teen, oneClub, travelled]) for (const id of checkNewAchievements({ ...c, achievements: [] })) unlockedBy.add(id);
  const dead = ACHIEVEMENTS.filter(a => !unlockedBy.has(a.id)).map(a => a.id);
  check(dead.length === 0, `every achievement can unlock (never triggered: ${dead.join(", ")})`);

  const first = checkNewAchievements(fresh());
  check(first.length <= 1 && first.every(id => id === "first-contract"), `a new career unlocks nothing but its contract (${first.join(", ")})`);
}

// ── Money thresholds (before: ★100 / ★500) ──
{
  const c = fresh();
  const at = (money: number) => checkNewAchievements({ ...c, money });
  check(!at(500).includes("rich") && !at(500).includes("loaded"), "★500 no longer unlocks Comfortable Living or Wealthy");
  check(at(10_000).includes("rich") && !at(10_000).includes("loaded"), "★10,000 unlocks Comfortable Living only");
  check(at(100_000).includes("loaded") && !at(100_000).includes("millionaire"), "★100,000 unlocks Wealthy");
  check(at(1_000_000).includes("millionaire") && at(10_000_000).includes("rich-list"), "★1M and ★10M unlock Millionaire and Rich List");
}

// ── One match through feats.ts ──
const fx = (over: Partial<Fixture> = {}): Fixture => ({ week: 3, opponent: "Chelsea", home: true, played: false, ...over });
function stats(us: number, them: number, goals: GoalEvent[], opp: OppGoalEvent[], extra: Partial<MatchStats> = {}): MatchStats {
  return {
    chances: 6, goals: goals.filter(g => g.isUserGoal).length, assists: 0, passes: 7, rating: 8.4, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
    homeScore: us, awayScore: them, minutes: 90, goalEvents: goals, oppGoalEvents: opp, ...extra,
  };
}
const me = (minute: number, how: string, extra: Partial<GoalEvent> = {}): GoalEvent => ({ minute, scorer: "Test Player", isUserGoal: true, how, distance: 12, ...extra });
const mate = (minute: number): GoalEvent => ({ minute, scorer: "Mate", isUserGoal: false });
const them = (minute: number): OppGoalEvent => ({ minute, scorerId: "o", scorer: "Them" });
{
  const c = fresh();
  // Arsenal v Spurs is a derby (rivalries.ts). 3-1: a hat-trick; the winner is our 2nd goal.
  const s = stats(3, 1, [me(10, "header"), me(40, "free_kick", { finish: "curl" }), me(88, "long_range", { distance: 31 })], [them(20)]);
  const f = featsAfterMatch(c, fx({ opponent: "Tottenham Hotspur" }), s);
  check(f.goalsBy?.header === 1 && f.goalsBy?.free_kick === 1 && f.goalsBy?.curl === 1 && f.goalsBy?.far30 === 1, "goal kinds, the curl and the 30 m strike are counted");
  check(f.braces === 1 && f.hatTricks === 1 && !f.hauls4, "a hat-trick counts as a brace and a hat-trick, not a four");
  check(f.derbyWins === 1 && f.derbyGoals === 3 && f.derbyHatTricks === 1, "a derby hat-trick is counted");
  check(f.winners === 1 && !f.lateWinners, "the winner is the 2nd goal at 40', not a late one");

  const late = featsAfterMatch(c, fx({ opponent: "Burnley" }), stats(2, 1, [mate(30), me(87, "rebound")], [them(60)]));
  check(late.winners === 1 && late.lateWinners === 1, "an 87th-minute goal that makes it 2-1 is a late winner");
  check(!late.derbyWins, "Arsenal v Burnley is not a derby");

  const unknown = featsAfterMatch(c, fx(), stats(2, 1, [me(87, "rebound")], [them(60)]));
  check(!unknown.winners, "a goal list that does not add up to the score credits no winner");
  check(winningGoal(fx(), stats(1, 1, [me(10, "header")], [them(20)])) === null, "a draw has no winning goal");

  const shoot = featsAfterMatch(c, fx({ home: false, kind: "cup", competition: "FA Cup" }), stats(1, 1, [], [], { goals: 0, shootout: { home: 3, away: 5 } }));
  check(shoot.shootoutWins === 1, "an away shootout won 5-3 is a win");

  // Runs: score, score, blank.
  let run = c;
  for (const g of [1, 1, 0]) {
    run = { ...run, feats: featsAfterMatch(run, fx(), stats(g, 0, g ? [me(50, "one_on_one")] : [], [])) };
  }
  check(run.feats?.scoringRun === 0 && run.feats?.bestScoringRun === 2 && run.feats?.bestWinRun === 2, "scoring and winning runs reset and keep their best");
}

// ── A replayed match unlocks nothing twice ──
{
  const c0 = fresh();
  const fixture = c0.fixtures.find(f => !f.played)!;
  const s = stats(4, 0, [me(3, "header"), me(20, "volley"), me(50, "penalty"), mate(70)], [], {});
  const s2 = { ...s, homeScore: fixture.home ? 4 : 0, awayScore: fixture.home ? 0 : 4 };
  const once = creditMatchResult(c0, fixture, s2);
  const twice = creditMatchResult(once.career, fixture, s2);
  check(once.newlyUnlocked.includes("goal-header") && once.newlyUnlocked.includes("hat-trick"), `the match unlocks Head On and Hat-trick Hero (${once.newlyUnlocked.join(", ")})`);
  check(twice.newlyUnlocked.length === 0, `a replay unlocks nothing (${twice.newlyUnlocked.join(", ")})`);
  check(JSON.stringify(twice.career.feats) === JSON.stringify(once.career.feats), "a replay leaves the feats alone");
  check(new Set(twice.career.achievements).size === twice.career.achievements.length, "no achievement is in the list twice");
  check(once.career.careerBests?.fastestGoal?.minute === 3, "the fastest goal is recorded (3')");
}

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s), ${passed} passed`);
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log(`PASS — ${passed} checks`);
