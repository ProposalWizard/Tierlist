import { newMatch, tick, resolveScenario, type HiddenMatchInputs, type Zone, type ScenarioResult } from "../../lib/star/hiddenMatch";
import { clubExpectation, personalDuty, judgeSeason, expectationStatus } from "../../lib/star/expectations";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { leaguePosition as leaguePositionOf } from "../../lib/star/competitions";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * Match context, and what the board wanted.
 *
 * Two things the specification asks for that the game had no idea about.
 *
 * §2.9: "The Hidden Match Simulation must also understand the broader match
 * situation: current score, remaining time, competition type, knockout or league
 * fixture, home or away… For example, a team trailing late in a match may
 * naturally generate more attacking pressure." The score and the clock were
 * both already in the state and read by nothing, so a cup final away from home
 * 1-0 down with fifteen minutes left played exactly like a goalless friendly.
 *
 * §16.11: "Every club should possess its own identity: league, competitive
 * level, expectations… The player joins an existing football world." Finishing
 * sixth was worth the same at every club in the division.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FULL_TIME = 90;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function standIn(zone: Zone, rng: () => number): ScenarioResult {
  const roll = rng();
  if (zone === "box") return roll < 0.24 ? "goal" : roll < 0.85 ? "saved" : "lost";
  if (zone === "attacking") return roll < 0.11 ? "goal" : roll < 0.6 ? "saved" : roll < 0.85 ? "delivered" : "lost";
  return roll < 0.72 ? "delivered" : "lost";
}

/** Play a match out; optionally hold the scoreline fixed to isolate game state. */
function playMatch(inputs: HiddenMatchInputs, seed: number, opts: { freezeScore?: [number, number]; from?: number } = {}) {
  const rng = mulberry32(seed);
  const state = newMatch(rng);
  let requests = 0, lateRequests = 0, minutesUser = 0;
  while (state.minute < FULL_TIME) {
    if (opts.freezeScore) { state.userScore = opts.freezeScore[0]; state.oppScore = opts.freezeScore[1]; }
    const before = state.possession;
    const { request } = tick(state, inputs, rng);
    if (before === "user") minutesUser += 1;
    if (request) {
      requests += 1;
      if (state.minute >= (opts.from ?? 70)) lateRequests += 1;
      resolveScenario(state, standIn(request.zone, rng));
    }
  }
  return { requests, lateRequests, minutesUser, userScore: state.userScore, oppScore: state.oppScore };
}

const run = (inputs: HiddenMatchInputs, n = 1200, opts = {}) =>
  Array.from({ length: n }, (_, i) => playMatch(inputs, 1 + i * 7919, opts));

const EVEN: HiddenMatchInputs = { teamStrength: 70, oppStrength: 70, energy: 80, playerSkill: 65 };

// ── Home and away ───────────────────────────────────────────────────────────
{
  const neutral = run(EVEN);
  const atHome = run({ ...EVEN, home: true });
  const away = run({ ...EVEN, home: false });

  const h = mean(atHome.map(x => x.requests));
  const n = mean(neutral.map(x => x.requests));
  const a = mean(away.map(x => x.requests));
  check(h > n && n > a, `you get more of the game at home (${a.toFixed(2)} away < ${n.toFixed(2)} neutral < ${h.toFixed(2)} home)`);

  const hp = mean(atHome.map(x => x.minutesUser)) / FULL_TIME;
  const ap = mean(away.map(x => x.minutesUser)) / FULL_TIME;
  check(hp > ap, `and more of the ball (${(ap * 100).toFixed(1)}% away vs ${(hp * 100).toFixed(1)}% home)`);

  // It is an advantage, not a decision.
  check(h / a < 1.6, `home advantage is an edge, not a formality (ratio ${(h / a).toFixed(2)})`);
  const homeWins = atHome.filter(x => x.userScore > x.oppScore).length / atHome.length;
  const awayWins = away.filter(x => x.userScore > x.oppScore).length / away.length;
  check(homeWins > awayWins, `and it shows in results (${(awayWins * 100).toFixed(0)}% away vs ${(homeWins * 100).toFixed(0)}% home)`);
  check(awayWins > 0.15, `but you can still win away (${(awayWins * 100).toFixed(0)}%)`);

  // An old save, or the sandbox, passes nothing at all and must behave as before.
  check(Math.abs(n - mean(run({ ...EVEN, home: undefined }).map(x => x.requests))) < 0.001,
    "an unspecified venue is exactly neutral, so nothing that does not know about this changes");
}

// ── Trailing late ───────────────────────────────────────────────────────────
//
// The specification's own worked example. Scoreline held fixed so this measures
// the response to the game state and nothing else.
{
  const behind = run(EVEN, 1200, { freezeScore: [0, 2] as [number, number] });
  const level = run(EVEN, 1200, { freezeScore: [1, 1] as [number, number] });
  const ahead = run(EVEN, 1200, { freezeScore: [2, 0] as [number, number] });

  const b = mean(behind.map(x => x.lateRequests));
  const l = mean(level.map(x => x.lateRequests));
  const a = mean(ahead.map(x => x.lateRequests));
  check(b > l && l > a,
    `a side chasing the game throws bodies forward (${a.toFixed(2)} ahead < ${l.toFixed(2)} level < ${b.toFixed(2)} behind, last 20 min)`);

  // …and only late. The same scoreline early must change nothing.
  const earlyBehind = mean(run(EVEN, 800, { freezeScore: [0, 2] as [number, number], from: 5 }).map(x => x.requests));
  const earlyAhead = mean(run(EVEN, 800, { freezeScore: [2, 0] as [number, number], from: 5 }).map(x => x.requests));
  const spread = Math.abs(earlyBehind - earlyAhead) / earlyBehind;
  check(spread < 0.25, `being two down in the first half is not yet a crisis (${(spread * 100).toFixed(0)}% apart over the full match)`);

  check(b / Math.max(0.01, a) < 3, `chasing the game is a tilt, not a rewrite (${(b / Math.max(0.01, a)).toFixed(2)})`);
}

// ── What the board wants ────────────────────────────────────────────────────
{
  const PLAYER: StarPlayer = {
    firstName: "T", lastName: "P", age: 24, position: "ST", club: "Arsenal", nationality: "England",
  } as StarPlayer;
  const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
  const base = makeInitialCareer(PLAYER, CLUBS);

  const withStrength = (mine: number): CareerState => ({
    ...base,
    league: base.league.map((t, i) => t.name === "Arsenal" ? { ...t, strength: mine } : { ...t, strength: 50 + i * 4 }),
  });

  const big = clubExpectation(withStrength(95));
  const small = clubExpectation(withStrength(30));
  check(big.ambition === "Title", `the strongest club in the division wants the title (${big.ambition})`);
  check(small.ambition === "Survival", `and the weakest wants to stay up (${small.ambition})`);
  check(big.targetPosition < small.targetPosition, "so the bar is set in different places");

  // The same finish, judged by two different clubs. This is the whole point.
  //
  // Points are set explicitly so the club genuinely finishes sixth: with a fresh
  // league everybody is on zero and the sort falls back to array order, which
  // made an earlier version of this test measure nothing.
  const finishNth = (mine: number, place: number): CareerState => {
    const c = withStrength(mine);
    let rank = 0;
    const league = c.league.map(t => {
      if (t.name === "Arsenal") return { ...t, points: 100 - place * 5 };
      rank += 1;
      const spot = rank < place ? rank : rank + 1;      // skip the player's place
      return { ...t, points: 100 - spot * 5 };
    });
    return { ...c, league, seasonStats: { ...c.seasonStats, goals: 10 } };
  };
  check(leaguePositionOf(finishNth(70, 6)) === 6, "the fixture really does finish sixth");

  const finishSixth = (mine: number): number => judgeSeason(finishNth(mine, 6)).score;
  const atBigClub = finishSixth(95);
  const atSmallClub = finishSixth(30);
  check(atSmallClub > atBigClub,
    `sixth is a good season at a small club and a bad one at a big club (${atSmallClub.toFixed(2)} vs ${atBigClub.toFixed(2)})`);
  check(atBigClub < 0, "the big club is not happy");
  check(atSmallClub > 0, "the small one is");

  // Personal duty rises with standing, per §16.10.
  check(personalDuty({ ...base, starRating: 1.5 }).duty === "Earn a place", "a nobody is trying to get in the side");
  check(personalDuty({ ...base, starRating: 3.2 }).duty === "Perform consistently", "an established player is expected weekly");
  check(personalDuty({ ...base, starRating: 4.6 }).duty === "Lead the team", "a star is expected to win matches");
  check(personalDuty({ ...base, starRating: 4.6 }).goalTarget > personalDuty({ ...base, starRating: 1.5 }).goalTarget,
    "and asked for more");

  // Winning something rescues a season. Measured on a middling finish, because
  // a season already at the top of the scale cannot show it — which is exactly
  // how the scale being too steep was caught.
  const c = finishNth(70, 6);
  const withTrophy = judgeSeason({ ...c, trophies: [{ season: c.season, competition: "FA Cup", club: "Arsenal" }] });
  const without = judgeSeason(c);
  check(withTrophy.score > without.score, "a cup run counts for something");
  check(withTrophy.bossChange > without.bossChange, "and the manager notices");

  // The judgement is bounded — one season can neither destroy nor secure you.
  for (const mine of [20, 50, 70, 95]) {
    const j = judgeSeason(finishNth(mine, 5));
    check(j.score >= -1 && j.score <= 1, "the judgement stays inside its scale");
    check(Math.abs(j.bossChange) <= 18, `and moves the manager by a bounded amount (${j.bossChange})`);
    check(j.headline.length > 0 && j.detail.length > 0, "and always says something");
  }

  const status = expectationStatus(base);
  check(status.pos >= 1 && status.pos <= base.league.length, "the live position is a real position");
  check(typeof status.onTrack === "boolean", "and the dashboard knows whether you are on track");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — home, away, chasing the game, and a season judged by the club that asked for it");
