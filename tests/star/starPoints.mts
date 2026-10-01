// The career star rating, 1-100 (lib/star/starPoints.ts; Mikey, 30 Sep 2026;
// moved from 1.0-10.0 to 1-100 for Harry, 1 Oct 2026).
//
// Measured with the real careerFlow + starPoints functions, six played-out
// careers per row, twelve seasons each (scratch harness, not run here: it
// takes minutes). Old scale shown ×10.
//
//                         level 20       30         50          70          90
//   riser    before       match 8        season 2   season 4-5  season 5-7  season 8-11
//            after        match 49       season 2   season 4-5  season 6-7  not by season 12 (84-86)
//   star     before       match 5        season 2   season 4-6  season 5-8  season 7-11
//            after        match 30       season 2   season 4-6  season 5-8  season 11-12
//   NL stayer before      match 11       held at 29 from season 2
//            after        match 81       held at 29 from season 3-4
//   first match: before +3 to +6 levels, after +0 to +2.
//   1 Oct 2026, one level a match at most (MAX_RISE_PER_MATCH): biggest
//   one-match rise over these 18 careers 12 -> 1; matches to level 10
//   unchanged (riser 20.2, star 11.2, stayer 32.0). A Premier League start
//   reaches 10 in 9 matches (was 3-6), first match +1 (was +3 to +6).
import { makeInitialCareer, creditMatchResult, attachClub, advanceSeason } from "../../lib/star/careerFlow.ts";
import { NATIONAL_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs.ts";
import {
  starStatus, withStars, matchStarPoints, livePoints, levelFromPoints, pointsForLevel, ledgerFromHistory, starGain,
  pointLines, starLevel, isOldStarScale, STAR_TITLES, starTitle,
  LEVEL_THRESHOLDS, LEVEL_COST, STAR_GATES, LEGEND_TASKS, TROPHY_SP, MATCH_SP, TIER_MULT, SP_SCALE, emptyLedger,
  PREMIER_DEBUT_SP, MAX_RISE_PER_MATCH,
} from "../../lib/star/starPoints.ts";
import { ACHIEVEMENTS } from "../../lib/star/achievements.ts";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types.ts";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };
const S = SP_SCALE;
const P: StarPlayer = { firstName: "T", lastName: "P", age: 16, skinTone: "light", club: NATIONAL_LEAGUE_CLUBS[3], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 };
const fresh = () => makeInitialCareer(P, [...NATIONAL_LEAGUE_CLUBS], "national_league");
const freshChelsea = () => withStars(makeInitialCareer({ ...P, club: "Chelsea" }, [...PREMIER_LEAGUE_CLUBS], "premier"));
const stats = (o: Partial<MatchStats>): MatchStats => ({ chances: 4, goals: 0, assists: 0, passes: 20, rating: 6.5, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0, homeScore: 0, awayScore: 1, ...o });
const leagueFixture = (c: CareerState) => c.fixtures.find(f => !f.played && (f.kind ?? "league") === "league")!;
const zero = { apps: 0, starts: 0, wins: 0, draws: 0, goals: 0, assists: 0, hatTricks: 0, starMan: 0, high: 0 };

// ── A new career, and what a match is worth ──
{
  const c = fresh();
  check(c.stars === 1 && starStatus(c).stars === 1, `a new career is on 1 (${c.stars})`);
  const f = leagueFixture(c);
  const big = matchStarPoints(c, f, stats({ goals: 1, starMan: true, rating: 8.1, homeScore: 1, awayScore: 0 }));
  check(big.base === 51 * S && big.total === 51 * S, `a 1-goal Star Man win, started, 8.0+: ${51 * S} SP in the National League (${big.total})`);
  check(matchStarPoints(c, f, stats({ homeScore: 1, awayScore: 1 })).base === (5 + 3 + 1) * S, "a draw is 1 unit");
  check(matchStarPoints(c, f, stats({})).base === (5 + 3) * S, "a defeat is 0 for the result");
  const hat = matchStarPoints(c, f, stats({ goals: 3, homeScore: 3 })).base;
  check(hat === (5 + 3 + 3 + 36) * S + MATCH_SP.hatTrick && MATCH_SP.hatTrick === 20 * S, `a hat-trick bonus is +${20 * S} (${hat})`);
  check(matchStarPoints({ ...c, status: "Substitute" }, f, stats({})).base === 5 * S, "coming off the bench: no start points");
  check(TIER_MULT.premier === 4 && TIER_MULT.europe === 5 && TIER_MULT.national_league === 1, "x1 at the bottom, x4 Premier League, x5 Europe");
  check(TROPHY_SP["League Cup"] === 900 * S && TROPHY_SP["Conference League"] === 900 * S && TROPHY_SP["FA Cup"] === 1200 * S, "League Cup level with the Conference League, FA Cup above");
  check(MATCH_SP.highRating === 8, "the high-rating threshold is a match rating, not points, and is not scaled");
}

// ── A match is banked once, however often it is credited ──
{
  const c = fresh(), f = leagueFixture(c), s = stats({ goals: 2, homeScore: 2 });
  const once = creditMatchResult(c, f, s).career;
  const twice = creditMatchResult(once, once.fixtures.find(x => x.week === f.week && x.opponent === f.opponent)!, s).career;
  check(starStatus(once).points.match === matchStarPoints(c, f, s).total, "one match banks exactly its own points");
  check(starStatus(twice).points.match === starStatus(once).points.match, "a replayed match banks nothing twice");
}

// ── The curve: 1 to 90 from points, each band dearer than the last ──
{
  check(LEVEL_THRESHOLDS.slice(2).every((t, i) => t > LEVEL_THRESHOLDS[i + 1]), "every level costs something");
  check(LEVEL_COST.every((c, i) => i === 0 || c > LEVEL_COST[i - 1]), "each band costs more a level than the one below");
  check(levelFromPoints(0) === 1 && levelFromPoints(LEVEL_COST[0] - 1) === 1 && levelFromPoints(LEVEL_COST[0]) === 2, `${LEVEL_COST[0].toLocaleString()} SP is level 2`);
  const low = pointsForLevel(20) - pointsForLevel(11), high = pointsForLevel(90) - pointsForLevel(81);
  check(low >= 90_000 && low <= 120_000, `11 → 20 is about 100,000 SP, as Harry asked (${low.toLocaleString()})`);
  check(high >= 9_000_000 && high <= 11_000_000, `81 → 90 is about 10 million SP, as Harry asked (${high.toLocaleString()})`);
  check(levelFromPoints(1e12) === 90, "points alone stop at 90");
  for (let L = 1; L <= 90; L++) check(levelFromPoints(pointsForLevel(L)) === L && levelFromPoints(pointsForLevel(L) - 1) === Math.max(1, L - 1), `pointsForLevel round-trips at ${L}`);
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
  check(held.stars === 29 && held.gate?.cap === 29 && held.ungated > 29, `millions of SP earned only in the National League are held at 29, the rest banked (${held.stars}, points say ${held.ungated})`);
  const jump = starStatus(rich(fresh(), { championship: 10 }));
  check(jump.stars === 59 && jump.gate?.cap === 59, `10 Championship games open the League Two, League One AND Championship gates at once (${jump.stars})`);
  check(starStatus(rich(fresh(), { championship: 9 })).stars === 29, "nine games is not ten");
  const prem = starStatus(rich(fresh(), { premier: 10 }));
  check(prem.stars === 69 && prem.gate?.cap === 69, `and 10 Premier League games open four; the next gate is a trophy (${prem.stars})`);
  check(STAR_GATES.length === 7 && STAR_GATES.map(g => g.cap).join() === "29,39,49,59,69,79,89", "seven gates, at 29 … 89");
}

// ── It never goes down ──
{
  let c = withStars({ ...fresh(), ownedItems: [{ id: "island", name: "Private Island", category: "property", price: 1, lifestyleValue: 250, level: 5 }] as CareerState["ownedItems"], investments: [{ club: "X", percent: 60 }] as unknown as CareerState["investments"] });
  const before = starStatus(c);
  c = { ...c, ownedItems: [], investments: [] };
  const after = starStatus(c);
  check(before.points.status >= 2500 * S && after.points.status === before.points.status && after.stars >= before.stars, "selling the club and losing the island takes no points and no levels away");
  check(livePoints(c).status < before.points.status, "(the live figure did fall; the banked one is what counts)");
}

// ── The last ten: ten tasks, one level each ──
{
  check(LEGEND_TASKS.length === 10, "ten Legend tasks");
  const at90 = (legend: string[]): CareerState => ({ ...fresh(), stars: 90,
    starLedger: { ...emptyLedger(), uclApps: 1, ballonRanks: [1], tiers: { premier: { ...zero, apps: 10 } } },
    ballonDorWins: 1, trophies: [{ season: 1, competition: "Premier League", club: "X" }],
    // A window that doesn't bind: this block is about tasks → levels; the
    // one-level-a-match cap has its own block below.
    starBest: { match: 30_000_000, trophies: 0, awards: 0, milestones: 0, status: 0, stars: 90, legend, scale: 100, win: { apps: 10, base: 99 } } });
  check(starStatus(at90([])).stars === 90, `90 with no tasks done (${starStatus(at90([])).stars})`);
  check(starStatus(at90(["ballons", "ucl", "titles"])).stars === 93, "three tasks is 93");
  check(starStatus(at90(LEGEND_TASKS.slice(0, 9).map(t => t.id))).stars === 99, "nine of ten is 99");
  check(starStatus(at90(LEGEND_TASKS.map(t => t.id))).stars === 100, "all ten is 100");
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
  check(st.stars > 1 && st.stars <= 59, `it opens on a real rating, inside its gates (${st.stars})`);
  check(withStars(withStars(old)).stars === withStars(old).stars, "banking twice changes nothing");
}

// ── A save from the 1.0-10.0 days: ×10, nothing lost, still climbing ──
{
  // 30 Championship games: the gates up to 49 are open, as they would be for a real 4.3.
  const c0 = withStars(attachClub(fresh(), CHAMPIONSHIP_CLUBS[2], [...CHAMPIONSHIP_CLUBS], "championship"));
  const base: CareerState = { ...c0, starLedger: { ...c0.starLedger!, tiers: { championship: { ...zero, apps: 30, starts: 30 } } } };
  // The old 1.0-10.0 curve, to give each case points that match its rating.
  const OLD = [0, 600, 2000, 4500, 8500, 14000, 30000, 55000, 95000, 150000];
  const oldPts = (s: number) => OLD[Math.floor(s) - 1] + (s - Math.floor(s)) * (OLD[Math.floor(s)] - OLD[Math.floor(s) - 1]);
  for (const [oldStars, want] of [[2.9, 29], [4.3, 43], [1.0, 10], [1.6, 16], [7.4, 74]] as const) {
    // Old-scale banked marks: no `scale`, points in old units.
    const old: CareerState = { ...(want >= 30 ? base : c0), stars: oldStars, starBest: { match: Math.round(oldPts(oldStars)), trophies: 0, awards: 0, milestones: 0, status: 0, stars: oldStars, legend: [] } };
    check(isOldStarScale(old) && starLevel(old) === want, `an old ${oldStars} reads as ${want} before it is even banked (${starLevel(old)})`);
    const now = withStars(old);
    check(now.stars === want && now.starBest?.scale === 100 && !isOldStarScale(now), `an old ${oldStars} becomes ${want} on the new scale (${now.stars})`);
    check(withStars(now).stars === now.stars && withStars(now).starBest?.carry === now.starBest?.carry, `${want}: converting twice changes nothing`);
    if (want < 29 || (want >= 40 && want < 59)) {
      // Not sitting on a gate: it is at the start of its level, and a match moves it on.
      const st = starStatus(now);
      check(st.total >= pointsForLevel(want) && st.toNext < 0.5, `${want}: starts at the bottom of its level, not below it (${Math.round(st.toNext * 100)}%)`);
      const f = leagueFixture(now);
      const after = creditMatchResult(now, f, stats({ goals: 1, homeScore: 1, awayScore: 0 })).career;
      check(after.stars! >= want && starStatus(after).total > st.total, `${want}: a match after converting adds points and never drops the rating (${after.stars})`);
    }
  }
}

// ── The after-match card tells the truth (Harry: "+68 took me from 1.0 to 2.1") ──
{
  const c = freshChelsea(), f = leagueFixture(c);
  const s = stats({ assists: 1, homeScore: 1, awayScore: 1, rating: 6.7 });
  const after = creditMatchResult(c, f, s).career;
  const gain = starGain(c, after);
  const match = matchStarPoints(c, f, s).total;
  const sum = gain.lines.reduce((t, l) => t + l.sp, 0);
  check(gain.total === starStatus(after).total - starStatus(c).total, "the total is what the banked points actually moved by");
  check(sum === gain.total, `the lines add up to the total (${sum} vs ${gain.total})`);
  check(gain.lines.some(l => l.cat === "match" && l.sp === match), "the match itself is one line, exactly what it earned");
  check(gain.lines.some(l => l.key === "pl-debut"), "the Premier League debut is named, not hidden");
  check(gain.lines.some(l => l.key === "achievements" && (l.n ?? 0) >= 1), "and so are the achievements the match unlocked");
  const moved = after.stars! - c.stars!;
  check(moved === 1, `a first Premier League draw with an assist moves you one level (${c.stars} → ${after.stars})`);
  check(PREMIER_DEBUT_SP === 6_000 && PREMIER_DEBUT_SP <= LEVEL_COST[0], `the Premier League debut is about one level at the start (${PREMIER_DEBUT_SP})`);
  const nl = fresh();
  const nlAfter = creditMatchResult(nl, leagueFixture(nl), stats({ goals: 1, assists: 1, starMan: true, rating: 8.4, homeScore: 2, awayScore: 0 })).career;
  check(nlAfter.stars! - nl.stars! <= 2, `a dream National League debut is a level or two (${nl.stars} → ${nlAfter.stars})`);
  check(pointLines(after).reduce((t, l) => t + l.sp, 0) === Object.values(livePoints(after)).reduce((a, b) => a + b, 0), "the named lines are the whole of livePoints");
}

// ── Never two levels from one match (Harry, 1 Oct 2026: "you should never jump 2 levels") ──
// Played-out careers through the real careerFlow: every match, plus anything
// credited before the next one (season-end awards, promotion, a gate
// opening), moves the rating by at most one level. Fails if any match moves 2+.
{
  check(MAX_RISE_PER_MATCH === 1, "the cap is one level");
  let worst = 0, heldSeen = 0, matches = 0;
  const rnd = (() => { let x = 7; return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648); })();
  for (const [start, clubs, div, goals] of [
    ["Chelsea", PREMIER_LEAGUE_CLUBS, "premier", 0.9], [NATIONAL_LEAGUE_CLUBS[3], NATIONAL_LEAGUE_CLUBS, "national_league", 0.8],
  ] as const) {
    let c: CareerState = withStars(makeInitialCareer({ ...P, club: start }, [...clubs], div));
    let last = starStatus(c).stars;
    for (let season = 1; season <= 3; season++) {
      for (let g = 0; g < 80; g++) {
        const f = c.fixtures.find(x => !x.played);
        if (!f) break;
        const won = rnd() < 0.7, n = rnd() < goals ? (rnd() < 0.3 ? 3 : 1) : 0;
        c = creditMatchResult(c, f, stats({ goals: n, assists: rnd() < 0.5 ? 1 : 0, starMan: n > 0, rating: n > 0 ? 8.8 : 7, homeScore: won ? n + 1 : 0, awayScore: won ? 0 : 1 })).career;
        const now = starStatus(c).stars;
        worst = Math.max(worst, now - last); last = now; matches++;
        if (starStatus(c).held > 0) heldSeen++;
      }
      c = advanceSeason(c, false).career;
      const now = starStatus(c).stars;
      worst = Math.max(worst, now - last); last = now;
    }
  }
  check(worst <= 1, `no match moved the rating 2+ levels (biggest: ${worst}, over ${matches} matches)`);
  check(heldSeen > 0, `the cap did hold points back at times (${heldSeen} matches), so this isn't passing by accident`);
  // Nothing is lost: what was held pays out one level a match after.
  const c0 = freshChelsea(), f0 = leagueFixture(c0);
  const big = creditMatchResult(c0, f0, stats({ goals: 3, assists: 1, starMan: true, rating: 9.5, homeScore: 4, awayScore: 0 })).career;
  const st = starStatus(big);
  check(st.stars === c0.stars! + 1 && st.held > 0 && st.carried > 0, `a dream Premier League debut is still one level, the rest carried (${c0.stars} → ${st.stars}, ${st.held} held, +${st.carried})`);
  check(withStars(withStars(big)).stars === st.stars, "banking again between matches doesn't sneak a second level in");
  const g2 = big.fixtures.find(x => !x.played)!;
  const next = creditMatchResult(big, g2, stats({})).career;
  check(starStatus(next).stars === st.stars + 1, `the next match (even a quiet defeat) pays out a held level (${st.stars} → ${starStatus(next).stars})`);
}

// ── Names describe the career, never the club or division (Harry: "Non-league regular" in the Prem) ──
{
  check(STAR_TITLES.length === 11 && STAR_TITLES.every(t => !/league|premier|championship|non-league/i.test(t)), `no band name mentions a division (${STAR_TITLES.join(", ")})`);
  check(starTitle(20) === starTitle(29) && starTitle(29) !== starTitle(30) && starTitle(100) === "The Complete Career", "one name per ten");
}

console.log(fail ? "FAIL" : "PASS — Star Points, 1-100: matches by stage, a steep curve, gates that open together, old saves ×10, a card that adds up, and a last ten made of tasks");
if (fail) process.exit(1);
