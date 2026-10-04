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
//   1 Oct 2026, steep curve (STAR_CURVES "recommended"; 20 careers per type,
//   12 seasons, plus 20-season runs for the top). Matches per level, riser /
//   star (60→61 and 80→81 averaged over five levels, from the points):
//                    4→5   10→11  30→31  60→61  80→81   level 60     after 12 seasons
//     band curve     2/1   3.4/1.8 5.4/3.8 8.8/9.8 36/25  season 5/5   80 / 90
//     recommended    2/1   3.8/4.2 6.8/5.2 27/20  –/28   season 9/7   65 / 73
//   Level 1-4 still about one a match (level 4 in the 3rd match). After level
//   4 a match alone pays a whole level 0.2-0.5% of the time (was 1.0-1.6%);
//   with season-end prizes counted, 1.3-1.5%. 9 of 20 star careers reach 90
//   by season 20 (was all of them, by season 11); the National League stayer is held at 29 either way.
import { makeInitialCareer, creditMatchResult, attachClub, advanceSeason } from "../../lib/star/careerFlow.ts";
import { NATIONAL_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs.ts";
import {
  starStatus, withStars, matchStarPoints, livePoints, levelFromPoints, pointsForLevel, ledgerFromHistory, starGain,
  pointLines, starLevel, isOldStarScale, STAR_TITLES, starTitle,
  LEVEL_THRESHOLDS, LEVEL_COST, STAR_CURVE, levelCosts, STAR_GATES, LEGEND_TASKS, tierMult, tierOfFixture, xp, setXpConfig, DEFAULT_XP, achievementXp, SP_SCALE, emptyLedger,
  MAX_RISE_PER_MATCH, POINTS_CAP_LEVEL,
  POOR_MATCH_RATING, GOOD_MATCH_RATING, SLUMP_MATCHES, SLUMP_SHARE,
} from "../../lib/star/starPoints.ts";
import { ACHIEVEMENTS } from "../../lib/star/achievements.ts";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData.ts";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types.ts";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };
const S = SP_SCALE;
const P: StarPlayer = { firstName: "T", lastName: "P", age: 16, skinTone: "light", club: NATIONAL_LEAGUE_CLUBS[3], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 };
const fresh = () => makeInitialCareer(P, [...NATIONAL_LEAGUE_CLUBS], "national_league");
const freshChelsea = () => withStars(makeInitialCareer({ ...P, club: "Chelsea" }, [...PREMIER_LEAGUE_CLUBS], "premier"));
const stats = (o: Partial<MatchStats>): MatchStats => ({ chances: 4, goals: 0, assists: 0, passes: 20, rating: 6.5, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0, homeScore: 0, awayScore: 1, ...o });
const leagueFixture = (c: CareerState) => c.fixtures.find(f => !f.played && (f.kind ?? "league") === "league")!;
const zero = { apps: 0, starts: 0, wins: 0, draws: 0, goals: 0, assists: 0, hatTricks: 0, starMan: 0, high: 0, minutes: 0, ratingPts: 0 };

// ── A new career, and what a match is worth ──
{
  const c = fresh();
  check(c.stars === 1 && starStatus(c).stars === 1, `a new career is on 1 (${c.stars})`);
  const f = leagueFixture(c);
  // Mikey, 3 Oct 2026: 10 XP a minute, no hat-trick bonus, one rating bonus
  // (400 per point above 6) instead of star man + "rating 8+".
  const big = matchStarPoints(c, f, stats({ goals: 1, starMan: true, rating: 8.1, homeScore: 1, awayScore: 0 }));
  check(big.base === 900 + 360 + 1200 + 840 && big.total === Math.round(3300 * 1.25), `a 1-goal 8.1 win: 3,300 XP, ×1.25 in the National League (${big.base} → ${big.total})`);
  check(matchStarPoints(c, f, stats({ homeScore: 1, awayScore: 1 })).base === 900 + 120 + 200, "a 6.5 draw: 90 minutes + draw + half a rating point");
  check(matchStarPoints(c, f, stats({})).base === 900 + 200, "a defeat pays nothing for the result");
  const hat = matchStarPoints(c, f, stats({ goals: 3, homeScore: 3 })).base;
  check(hat === 900 + 360 + 3 * 1200 + 200, `no hat-trick bonus: three goals pay three goals (${hat})`);
  check(matchStarPoints(c, f, stats({ goals: 3, homeScore: 3, starMan: true })).base === hat, "star man pays nothing on top of the rating bonus");
  check(matchStarPoints({ ...c, status: "Substitute" }, f, stats({ minutes: 24 })).base === 240 + 200, "24 minutes off the bench: 240 XP for the minutes");
  check(matchStarPoints(c, f, stats({ minutes: 73 })).base === 730 + 200, "taken off after 73 minutes: 730");
  check(matchStarPoints(c, f, stats({ rating: 5 })).base === 900, "a rating under 6 earns no rating bonus (never negative)");
  check(tierMult("national_league_north") === 1 && tierMult("national_league") === 1.25 && tierMult("premier") === 4, "North/South ×1, National League ×1.25, Premier League ×4");
  check(tierMult("europe") === 5 && tierMult("europa") === 4 && tierMult("conference") === 3, "Champions League ×5, Europa ×4, Conference ×3");
  const cup = { ...f, kind: "cup" as const, competition: "FA Cup" };
  check(tierOfFixture(c, cup) === "cup_national_league" && tierMult(tierOfFixture(c, cup)) === 1.25, "a cup tie is worth your league's multiplier, not ×4");
  check(xp().trophies["World Cup"] === 400_000 && xp().trophies["European Championship"] === 300_000 && xp().trophies["Super Cup"] === 65_000, "World Cup 400k, Euros 300k, Super Cup 65k");
  check(achievementXp("first-match") === 600 && achievementXp("hat-trick") === 2_400 && achievementXp("ballon-dor") === 12_000 && achievementXp("first-contract") === 0, "achievements: easy 600, medium 2,400, hard 12,000, signing 0");
}

// ── The XP Book: a saved copy changes the game, a broken one never does ──
{
  const c = fresh(), f = leagueFixture(c);
  setXpConfig({ match: { goal: 2000 }, mult: { national_league: 2 } });
  const one = matchStarPoints(c, f, stats({ goals: 1 }));
  check(one.base === 900 + 2000 + 200 && one.mult === 2, `an edited goal and multiplier are used (${one.base} ×${one.mult})`);
  setXpConfig({ match: { goal: -5, win: "lots" }, mult: null, fame: "x" });
  check(xp().match.goal === DEFAULT_XP.match.goal && xp().match.win === DEFAULT_XP.match.win && xp().fame === DEFAULT_XP.fame, "a negative or broken value keeps the default");
  setXpConfig(null);
  check(xp() === DEFAULT_XP, "null goes back to the defaults");
}

// ── A match is banked once, however often it is credited ──
{
  const c = fresh(), f = leagueFixture(c), s = stats({ goals: 2, homeScore: 2 });
  const once = creditMatchResult(c, f, s).career;
  const twice = creditMatchResult(once, once.fixtures.find(x => x.week === f.week && x.opponent === f.opponent)!, s).career;
  check(starStatus(once).points.match === matchStarPoints(c, f, s).total, "one match banks exactly its own points");
  check(starStatus(twice).points.match === starStatus(once).points.match, "a replayed match banks nothing twice");
}

// ── The curve: 1 to 90 from points, cheap to 4, then each level dearer than the last ──
{
  check(LEVEL_THRESHOLDS.slice(2).every((t, i) => t > LEVEL_THRESHOLDS[i + 1]), "every level costs something");
  check(LEVEL_COST.slice(5).every((c, i) => c >= LEVEL_COST[i + 4]) && LEVEL_COST[4] > LEVEL_COST[3], "from level 4 every level costs at least the one before");
  check(LEVEL_COST.slice(1, 4).every(c => c >= 10_000 && c < LEVEL_COST[4]), `1→4 is on the curve, no cheap start (Mikey, 3 Oct 2026) (${LEVEL_COST.slice(1, 4).join(", ")})`);
  check(levelFromPoints(0) === 1 && levelFromPoints(LEVEL_COST[1] - 1) === 1 && levelFromPoints(LEVEL_COST[1]) === 2, `${LEVEL_COST[1].toLocaleString()} SP is level 2`);
  const low = pointsForLevel(20) - pointsForLevel(11), high = pointsForLevel(90) - pointsForLevel(81);
  // Harry's earlier anchors were ~100,000 and ~10 million. The steeper curve
  // (1 Oct 2026, "60-61 exponentially longer than 4-5") moves the low one to
  // ~300,000; the high one stays near 10 million.
  check(low >= 250_000 && low <= 350_000, `11 → 20 is about 300,000 SP (${low.toLocaleString()})`);
  check(high >= 9_000_000 && high <= 15_000_000, `81 → 90 is about 10-13 million SP (${high.toLocaleString()})`);
  check(STAR_CURVE === "recommended" && (["gentle", "recommended", "brutal"] as const).every(k => levelCosts(k).length === 90), "three curves, one switch, the recommended one in the game");
  check(levelFromPoints(1e12) === 90, "points alone stop at 90");
  for (let L = 1; L <= 90; L++) check(levelFromPoints(pointsForLevel(L)) === L && levelFromPoints(pointsForLevel(L) - 1) === Math.max(1, L - 1), `pointsForLevel round-trips at ${L}`);
}

// ── Gates: "or higher", and banking ──
{
  const rich = (c: CareerState, apps: Record<string, number>): CareerState => ({
    ...c, starBest: undefined, stars: undefined,
    starLedger: { ...emptyLedger(), firstRep: 20, maxRep: 20,
      tiers: { national_league: { ...zero, goals: 100_000 },
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

// ── Things you lose never take a level away (form is the one thing that can, below) ──
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
    starBest: { match: 200_000_000, trophies: 0, awards: 0, milestones: 0, status: 0, stars: 90, legend, scale: 100, win: { apps: 10, base: 99 } } });
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
  check(xp().milestones.premierDebut <= LEVEL_COST[1], `the Premier League debut is under one level at the start (${xp().milestones.premierDebut})`);
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

// ── After level 4 a match is less than a level; 60→61 is many times 4→5 ──
// Harry, 1 Oct 2026: "almost impossible after like level 4 to go more than 1
// level and the curve should rapidly change so that say level 60-61 is
// exponentially longer than 4-5." Played-out careers through the real
// careerFlow, two player types from the measurement in this file's header.
{
  const mulberry = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const squads = (clubs: readonly string[], season: number) => clubs.map(c => ({ club: c, players: generateSquad(clubNameSeed(c) + season).map((p, i) => ({ id: `${c}:${i}`, name: `${p.name} (${c})`, position: p.position, positions: p.positions ?? [p.position], overall: 55 + (clubNameSeed(p.name) % 20), goals: 0, assists: 0 })) })) as unknown as CareerState["leagueSquads"];
  type Prof = { win: number; draw: number; goals: number; assists: number; rating: number };
  const RISER: Prof = { win: 0.62, draw: 0.2, goals: 0.55, assists: 0.3, rating: 7.3 };
  const STAR: Prof = { win: 0.7, draw: 0.15, goals: 0.9, assists: 0.45, rating: 7.9 };
  /** Each match: the rating before and after, and the points the match itself banked. */
  const career = (pr: Prof, run: number, seasons: number) => {
    const rng = mulberry(1000 + run * 77 + pr.win * 1000);
    let c: CareerState = makeInitialCareer({ ...P, club: NATIONAL_LEAGUE_CLUBS[(run * 5 + 3) % NATIONAL_LEAGUE_CLUBS.length] }, [...NATIONAL_LEAGUE_CLUBS], "national_league");
    c = withStars({ ...c, leagueSquads: squads(NATIONAL_LEAGUE_CLUBS, 1) });
    const out: { before: number; after: number; sp: number; total: number }[] = [];
    for (let season = 1; season <= seasons; season++) {
      for (let g = 0; g < 200; g++) {
        const f = c.fixtures.find(x => !x.played);
        if (!f) break;
        const r = rng(), won = r < pr.win, drew = !won && r < pr.win + pr.draw;
        const goals = rng() < pr.goals ? (rng() < 0.25 ? 2 : 1) + (rng() < 0.04 ? 1 : 0) : 0, assists = rng() < pr.assists ? 1 : 0;
        const us = won ? Math.max(goals, 1) + (rng() < 0.4 ? 1 : 0) : drew ? Math.max(goals, rng() < 0.5 ? 1 : 0) : goals;
        const them = won ? Math.max(0, us - 1 - Math.floor(rng() * 2)) : drew ? us : us + 1 + Math.floor(rng() * 2);
        const rating = Math.min(10, pr.rating + goals * 0.7 + assists * 0.4 + (rng() - 0.5) * 1.2);
        const was = starStatus(c);
        c = creditMatchResult(c, f, stats({ chances: 5, goals, assists, passes: 25, rating, starMan: rating >= 8.3, homeScore: us, awayScore: them })).career;
        const now = starStatus(c);
        out.push({ before: was.stars, after: now.stars, sp: now.total - was.total, total: now.total });
      }
      c = advanceSeason(c, false).career;
      c = { ...c, leagueSquads: c.leagueSquads?.length ? c.leagueSquads : squads(c.league.map(t => t.name), season + 1) };
    }
    return out;
  };
  const med = (xs: number[]) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };
  const stars = [0, 1, 2].map(run => career(STAR, run, 10));
  const risers = [0, 1].map(run => career(RISER, run, 5));

  // 1. After level 4, a match on its own almost never pays for a whole level.
  // Recommended curve: 0.2-0.5% measured (the old band curve: 1.0-1.6%), so
  // the bar is 1%, tighter than the 2% first asked for. Season-end prizes
  // (titles, promotion, awards) are not a match and are not counted here.
  let n = 0, full = 0;
  for (const m of [...stars, ...risers].flat()) if (m.before >= 5 && m.before < POINTS_CAP_LEVEL) { n++; if (m.sp >= LEVEL_COST[m.before]) full++; }
  const share = (100 * full) / n;
  check(share <= 1, `after level 4, at most 1% of matches pay for a whole level on their own (${share.toFixed(2)}% of ${n})`);
  // …and 1→4 still come about one a match.
  const first4 = [...stars, ...risers].map(r => r.findIndex(m => m.after >= 4) + 1);
  check(first4.every(i => i >= 4) && first4.some(i => i >= 5), `level 4 is no longer a match a level: it takes 4+ matches (${first4.join(", ")})`);

  // 2. 60→61 takes many times the matches 4→5 does. 4→5 is the rating you
  // see; 60→61 is the points, averaged over 60→65, because a gate (59) or a
  // season's prizes can pay several levels out one a match and hide the curve.
  const at = (r: typeof stars[0], L: number) => r.findIndex(m => m.after >= L) + 1;
  const pts = (r: typeof stars[0], L: number) => r.findIndex(m => m.total >= pointsForLevel(L)) + 1;
  const four = med(stars.map(r => at(r, 5) - at(r, 4)));
  // 3 Oct 2026: with no hat-trick/star-man stacking a star reaches ~60-65 in
  // ten seasons (was 64-69), so the high stretch is measured over 50→55.
  const sixty = med(stars.map(r => (pts(r, 55) > 0 && pts(r, 50) > 0 ? (pts(r, 55) - pts(r, 50)) / 5 : NaN)));
  check(sixty / four >= 6, `50→51 takes at least 6× the matches of 4→5 (the curve is unchanged; 60→61 was the 10× bar) (${sixty} vs ${four} matches: ${(sixty / four).toFixed(0)}×)`);
  console.log(`  curve: after level 4, ${share.toFixed(2)}% of matches pay a whole level; 4→5 ${four} match(es), 50→51 ${sixty} (${(sixty / four).toFixed(0)}×); level 4 at match ${first4.join("/")}`);
  check(med(risers.map(r => at(r, 5) - at(r, 4))) >= 2, `a riser's 4→5 takes more than one match (${risers.map(r => at(r, 5) - at(r, 4)).join(", ")})`);
}

// ── Poor form can take a level away (Harry, 1 Oct 2026, P14) ──
// Measured over played-out careers (scratch harness, 20 careers a row, the
// real careerFlow; before = v023-base, after = this rule):
//   rising player (avg 7.3)   level after 46 / 92 matches: 9 / 13 before, 9 / 13 after; 0 of 20 ever dropped
//   struggling (avg 5.7)      after 92 matches: 10 before, 3 after (peak 4); 19 of 20 dropped at least once
//   5-match slump at level 8  8 → 8 before, 8 → 7 after (20 of 20, on the 5th poor match); won back in a median 3 good matches
//   15-match slump at level 8 8 → 9 before (still climbing), 8 → 5 after; never more than 1 level in a match
//   poor from the first match level after 20: 4 before, 1 after; never below 1
{
  check(POOR_MATCH_RATING === 5.5 && SLUMP_MATCHES === 5 && SLUMP_SHARE === 0.2 && GOOD_MATCH_RATING === 6.5, "the rule's numbers");
  // Climb a National League career to level 8 on good matches.
  let c = fresh();
  while (starStatus(c).stars < 8) c = creditMatchResult(c, leagueFixture(c), stats({ goals: 1, rating: 7.8, homeScore: 1, awayScore: 0 })).career;
  const top = starStatus(c).stars;
  const poor = (x: CareerState, rating = 4.6) => creditMatchResult(x, leagueFixture(x), stats({ rating })).career;
  const levels: number[] = [], totals: number[] = [starStatus(c).total];
  for (let i = 0; i < SLUMP_MATCHES - 1; i++) { c = poor(c); levels.push(starStatus(c).stars); totals.push(starStatus(c).total); }
  check(levels.every(l => l === top), `four poor matches keep the level (${top} → ${levels.join(", ")})`);
  check(totals.every((t, i) => i === 0 || t < totals[i - 1]), "…but each one takes points off, so the bar falls");
  c = poor(c);
  check(starStatus(c).stars === top - 1, `the fifth poor match in a row drops one level (${top} → ${starStatus(c).stars})`);
  c = poor(c);
  check(starStatus(c).stars === top - 1, `the sixth doesn't drop another — the run starts again (${starStatus(c).stars})`);
  check(withStars(withStars(c)).stars === top - 1, "banking again between matches doesn't change it");

  // A good match breaks the run; an in-between one doesn't.
  let d = fresh();
  while (starStatus(d).stars < 8) d = creditMatchResult(d, leagueFixture(d), stats({ goals: 1, rating: 7.8, homeScore: 1, awayScore: 0 })).career;
  const top2 = starStatus(d).stars;
  for (let i = 0; i < 4; i++) d = poor(d);
  d = creditMatchResult(d, leagueFixture(d), stats({ rating: GOOD_MATCH_RATING })).career;
  for (let i = 0; i < 4; i++) d = poor(d);
  check(starStatus(d).stars === top2, `4 poor, a good one, 4 poor: no level lost (${top2} → ${starStatus(d).stars})`);
  let e = fresh();
  while (starStatus(e).stars < 8) e = creditMatchResult(e, leagueFixture(e), stats({ goals: 1, rating: 7.8, homeScore: 1, awayScore: 0 })).career;
  const top3 = starStatus(e).stars;
  for (let i = 0; i < 4; i++) e = poor(e);
  e = poor(e, 6.0); // between the two lines: neither counts nor breaks
  check(starStatus(e).stars === top3, `4 poor and a 6.0 keep the level (${starStatus(e).stars})`);
  e = poor(e);
  check(starStatus(e).stars === top3 - 1, `…and one more poor one completes the run of five (${top3} → ${starStatus(e).stars})`);

  // Never below 1.
  let f = fresh();
  for (let i = 0; i < 12; i++) f = poor(f, 3.5);
  check(starStatus(f).stars === 1 && starStatus(f).total >= 0, `poor from the first match stays on 1 (${starStatus(f).stars}, ${starStatus(f).total} SP)`);

  // Good form climbs as before: a rating of 6.5+ never costs anything.
  let g = fresh();
  for (let i = 0; i < 10; i++) g = creditMatchResult(g, leagueFixture(g), stats({ rating: 6.6 })).career;
  check(!g.starLedger?.slump || g.starLedger.slump.debt === 0, "a career with no poor matches carries no debt");
}

// ── Names describe the career, never the club or division (Harry: "Non-league regular" in the Prem) ──
{
  check(STAR_TITLES.length === 11 && STAR_TITLES.every(t => !/league|premier|championship|non-league/i.test(t)), `no band name mentions a division (${STAR_TITLES.join(", ")})`);
  check(starTitle(20) === starTitle(29) && starTitle(29) !== starTitle(30) && starTitle(100) === "The Complete Career", "one name per ten");
}

console.log(fail ? "FAIL" : "PASS — Star Points, 1-100: matches by stage, a steep curve, gates that open together, old saves ×10, a card that adds up, and a last ten made of tasks");
if (fail) process.exit(1);
