// The career star rating, 1.0-10.0★ (lib/star/starPoints.ts; Mikey, 30 Sep 2026).
import { makeInitialCareer, creditMatchResult, attachClub } from "../../lib/star/careerFlow.ts";
import { NATIONAL_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs.ts";
import {
  starStatus, withStars, matchStarPoints, livePoints, starsFromPoints, pointsForStars, ledgerFromHistory,
  STAR_THRESHOLDS, STAR_GATES, LEGEND_TASKS, TROPHY_SP, MATCH_SP, TIER_MULT, emptyLedger,
} from "../../lib/star/starPoints.ts";
import { ACHIEVEMENTS } from "../../lib/star/achievements.ts";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types.ts";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };
const P: StarPlayer = { firstName: "T", lastName: "P", age: 16, skinTone: "light", club: NATIONAL_LEAGUE_CLUBS[3], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 };
const fresh = () => makeInitialCareer(P, [...NATIONAL_LEAGUE_CLUBS], "national_league");
const stats = (o: Partial<MatchStats>): MatchStats => ({ chances: 4, goals: 0, assists: 0, passes: 20, rating: 6.5, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0, homeScore: 0, awayScore: 1, ...o });
const leagueFixture = (c: CareerState) => c.fixtures.find(f => !f.played && (f.kind ?? "league") === "league")!;
const zero = { apps: 0, starts: 0, wins: 0, draws: 0, goals: 0, assists: 0, hatTricks: 0, starMan: 0, high: 0 };

// ── A new career, and what a match is worth ──
{
  const c = fresh();
  check(c.stars === 1 && starStatus(c).stars === 1, `a new career is on 1.0★ (${c.stars})`);
  const f = leagueFixture(c);
  const big = matchStarPoints(c, f, stats({ goals: 1, starMan: true, rating: 8.1, homeScore: 1, awayScore: 0 }));
  check(big.base === 51 && big.total === 51, `a 1-goal Star Man win, started, 8.0+: 51 SP in the National League (${big.total})`);
  check(matchStarPoints(c, f, stats({ homeScore: 1, awayScore: 1 })).base === 5 + 3 + 1, "a draw is 1 point");
  check(matchStarPoints(c, f, stats({})).base === 5 + 3, "a defeat is 0 for the result");
  const hat = matchStarPoints(c, f, stats({ goals: 3, homeScore: 3 })).base;
  check(hat === 5 + 3 + 3 + 36 + MATCH_SP.hatTrick && MATCH_SP.hatTrick === 20, `a hat-trick bonus is +20 (${hat})`);
  check(matchStarPoints({ ...c, status: "Substitute" }, f, stats({})).base === 5, "coming off the bench: no start points");
  check(TIER_MULT.premier === 4 && TIER_MULT.europe === 5 && TIER_MULT.national_league === 1, "x1 at the bottom, x4 Premier League, x5 Europe");
  check(TROPHY_SP["League Cup"] === 900 && TROPHY_SP["Conference League"] === 900 && TROPHY_SP["FA Cup"] === 1200, "League Cup 900 (level with the Conference League), FA Cup 1,200");
}

// ── A match is banked once, however often it is credited ──
{
  const c = fresh(), f = leagueFixture(c), s = stats({ goals: 2, homeScore: 2 });
  const once = creditMatchResult(c, f, s).career;
  const twice = creditMatchResult(once, once.fixtures.find(x => x.week === f.week && x.opponent === f.opponent)!, s).career;
  check(starStatus(once).points.match === matchStarPoints(c, f, s).total, "one match banks exactly its own points");
  check(starStatus(twice).points.match === starStatus(once).points.match, "a replayed match banks nothing twice");
}

// ── The curve ──
{
  check(STAR_THRESHOLDS.every((t, i) => i === 0 || t > STAR_THRESHOLDS[i - 1]), "each star costs more than the last");
  check(starsFromPoints(0) === 1 && starsFromPoints(599) === 1.9 && starsFromPoints(600) === 2, "600 SP is 2.0★");
  check(starsFromPoints(10_000_000) === 9, "points alone stop at 9.0★");
  for (let s10 = 10; s10 <= 90; s10++) check(starsFromPoints(pointsForStars(s10 / 10)) === s10 / 10, `pointsForStars round-trips at ${s10 / 10}`);
}

// ── Gates: "or higher", and banking ──
{
  const rich = (c: CareerState, apps: Record<string, number>): CareerState => ({
    ...c, starBest: undefined, stars: undefined,
    starLedger: { ...emptyLedger(), firstRep: 20, maxRep: 20,
      tiers: { national_league: { ...zero, goals: 5000 },
        ...Object.fromEntries(Object.entries(apps).map(([k, n]) => [k, { ...zero, apps: n }])) } },
  });
  const held = starStatus(rich(fresh(), {}));
  check(held.stars === 2.9 && held.gate?.cap === 2.9 && held.ungated > 2.9, `60,000 SP earned only in the National League is held at 2.9★, the rest banked (${held.stars}, points say ${held.ungated})`);
  const jump = starStatus(rich(fresh(), { championship: 10 }));
  check(jump.stars === 5.9 && jump.gate?.cap === 5.9, `10 Championship games open the League Two, League One AND Championship gates at once (${jump.stars})`);
  check(starStatus(rich(fresh(), { championship: 9 })).stars === 2.9, "nine games is not ten");
  const prem = starStatus(rich(fresh(), { premier: 10 }));
  check(prem.stars === 6.9 && prem.gate?.cap === 6.9, `and 10 Premier League games open four; the next gate is a trophy (${prem.stars})`);
  check(STAR_GATES.length === 7, "seven gates, none at 9.0 or above");
}

// ── It never goes down ──
{
  let c = withStars({ ...fresh(), ownedItems: [{ id: "island", name: "Private Island", category: "property", price: 1, lifestyleValue: 250, level: 5 }] as CareerState["ownedItems"], investments: [{ club: "X", percent: 60 }] as unknown as CareerState["investments"] });
  const before = starStatus(c);
  c = { ...c, ownedItems: [], investments: [] };
  const after = starStatus(c);
  check(before.points.status >= 2500 && after.points.status === before.points.status && after.stars >= before.stars, "selling the club and losing the island takes no points and no stars away");
  check(livePoints(c).status < before.points.status, "(the live figure did fall; the banked one is what counts)");
}

// ── The last star: ten tasks, 0.1★ each ──
{
  check(LEGEND_TASKS.length === 10, "ten Legend tasks");
  const at9 = (legend: string[]): CareerState => ({ ...fresh(), stars: undefined,
    starLedger: { ...emptyLedger(), uclApps: 1, ballonRanks: [1], tiers: { premier: { ...zero, apps: 10 } } },
    ballonDorWins: 1, trophies: [{ season: 1, competition: "Premier League", club: "X" }],
    starBest: { match: 200_000, trophies: 0, awards: 0, milestones: 0, status: 0, stars: 9, legend } });
  check(starStatus(at9([])).stars === 9, `9.0★ with no tasks done (${starStatus(at9([])).stars})`);
  check(starStatus(at9(["ballons", "ucl", "titles"])).stars === 9.3, "three tasks is 9.3★");
  check(starStatus(at9(LEGEND_TASKS.slice(0, 9).map(t => t.id))).stars === 9.9, "nine of ten is 9.9★");
  check(starStatus(at9(LEGEND_TASKS.map(t => t.id))).stars === 10, "all ten is 10.0★");
  const c = fresh();
  const led = { ...emptyLedger(), maxRep: 97 };
  const all: CareerState = { ...c, ballonDorWins: 4, reputation: 96, fame: 100,
    trophies: [...Array(3).fill({ season: 1, competition: "Champions League", club: "X" }), ...Array(5).fill({ season: 1, competition: "Premier League", club: "X" }), ...Array(12).fill({ season: 1, competition: "FA Cup", club: "X" })],
    careerStats: { ...c.careerStats, goals: 400, assists: 100 }, achievements: ACHIEVEMENTS.map(a => a.id) };
  const done = LEGEND_TASKS.filter(t => t.done(all, led)).map(t => t.id);
  check(["ballons", "ucl", "titles", "trophies", "club", "numbers", "achievements"].every(id => done.includes(id)), `the tasks read the real career (${done.join(", ")})`);
  check(!LEGEND_TASKS.find(t => t.id === "owner")!.done(all, led), "owning nothing does not tick the owner task");
}

// ── A save from before Star Points ──
{
  const old: CareerState = { ...attachClub(fresh(), CHAMPIONSHIP_CLUBS[2], [...CHAMPIONSHIP_CLUBS], "championship"), stars: undefined, starLedger: undefined, starBest: undefined };
  old.careerStats = { appearances: 80, goals: 30, hatTricks: 1, passes: 0, assists: 12, starMan: 9, totalRating: 560, ratingCount: 80 };
  const led = ledgerFromHistory(old);
  check(led.tiers.championship?.apps === 80 && led.tiers.championship.goals === 30, "its matches are filed under the division it is in");
  const st = starStatus(withStars(old));
  check(st.stars > 1 && st.stars <= 5.9, `it opens on a real rating, inside its gates (${st.stars})`);
  check(withStars(withStars(old)).stars === withStars(old).stars, "banking twice changes nothing");
}

console.log(fail ? "FAIL" : "PASS — Star Points: matches by stage, gates that open together, a rating that never drops, and a last star made of ten tasks");
if (fail) process.exit(1);
