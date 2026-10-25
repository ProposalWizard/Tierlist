/**
 * WEATHER ON vs OFF IN WHOLE CAREER MATCHES (Leo's update, part "weather"; hub job 25 Oct 2026).
 *   npx tsx scripts/weather/matchSim.mts [matches=1000] [old|new]
 *
 * The game's own unseen match runs ninety minutes and asks for your chances.
 * Each is played through the real ball (keeper, defenders, team-mates) by a
 * robot that is the same in every row: on a passing chance (cutback, cross,
 * through ball, midfield pass, build-up, corner) it passes to the runner or
 * the nearest team-mate at a sensible strength; on any other it shoots at
 * goal. Its result goes back into the match. Same seeds in every row.
 *   OFF = today's game (conditionsFor). ON = matchConditions (matchWeather.ts),
 *   each match's home club drawn from the division in the row's name.
 * Measured: your side's goals a match, pass completion, the share of shots
 * blocked, and (rain/heavy matches only) the share of shots blocked.
 */
import { newMatch, tick, resolveScenario, type HiddenMatchInputs, type ScenarioResult } from "../../lib/star/hiddenMatch";
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch, setBallPhysics, type Outcome, type Scenario,
} from "../../lib/star/canvasEngine";
import { conditionsFor, type Conditions } from "../../lib/star/weather";
import { matchConditions } from "../../lib/star/matchWeather";
import { POST_L, POST_R } from "../../lib/star/pitch";
import * as C from "../../lib/star/clubs";

const N = Number(process.argv[2]) || 1000;
const mode = (process.argv[3] === "new" ? "new" : "old") as "old" | "new";
setBallPhysics(mode);

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PASS_KINDS = new Set(["cutback", "byline_cross", "through_ball", "midfield_pass", "buildup", "corner"]);

interface Tally { yours: number; us: number; them: number; chances: number; passes: number; passDone: number; shots: number; blocked: number; wetShots: number; wetBlocked: number; }
const zero = (): Tally => ({ yours: 0, us: 0, them: 0, chances: 0, passes: 0, passDone: 0, shots: 0, blocked: 0, wetShots: 0, wetBlocked: 0 });

function playChance(kind: string, cond: Conditions | undefined, seed: number, t: Tally): ScenarioResult {
  const rng = mulberry32(seed);
  let sc: Scenario;
  try { sc = buildScenario(kind as never, rng, 75, 75, 60); } catch { return "lost"; }
  sc.conditions = cond;
  initDefenders(sc, rng);
  const wet = cond?.weather === "rain" || cond?.weather === "heavy";
  const passing = PASS_KINDS.has(kind) && (sc.runner || sc.teammates.length > 0);
  let ball;
  if (passing) {
    const tgt = sc.runner?.pos ?? sc.teammates.reduce((b, m) => (Math.hypot(m.x - sc.ball.x, m.y - sc.ball.y) < Math.hypot(b.x - sc.ball.x, b.y - sc.ball.y) ? m : b));
    const dist = Math.hypot(tgt.x - sc.ball.x, tgt.y - sc.ball.y);
    const lofted = dist > 22 || kind === "byline_cross" || kind === "corner";
    ball = launch(sc, { x: tgt.x - sc.ball.x, y: tgt.y - sc.ball.y }, Math.min(0.9, 0.22 + dist / 45 + (rng() - 0.5) * 0.1),
      { cx: (rng() - 0.5) * 0.3, cy: lofted ? 0.55 + rng() * 0.3 : -0.25 + rng() * 0.2 }, { power: 70, technique: 70 }, rng);
    t.passes++;
  } else {
    const tx = (POST_L + POST_R) / 2 + (rng() - 0.5) * 6;
    ball = launch(sc, { x: tx - sc.ball.x, y: -Math.max(1, sc.ball.y) }, 0.45 + rng() * 0.55,
      { cx: (rng() - 0.5) * 1.4, cy: -0.4 + rng() * 1.4 }, { power: 70, technique: 70 }, rng);
    t.shots++; if (wet) t.wetShots++;
  }
  const h = 1 / 180;
  let out: Outcome | null = null;
  for (let i = 0; i < 180 * 10 && !out; i++) {
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, rng);
    out = stepBall(ball, sc, rng, h);
  }
  if (passing && (out === "delivered" || sc.receiverReached || !!sc.receivedBy || out === "goal" || out === "rebound")) t.passDone++;
  if (!passing && out === "blocked") { t.blocked++; if (wet) t.wetBlocked++; }
  if (out === "goal" || out === "rebound") return "goal";
  if (out === "saved" || out === "caught" || out === "post" || out === "blocked") return "saved";
  if (out === "delivered") return "delivered";
  return "lost";
}

const inputs = { playerSkill: 70, pace: 70, freeKick: 60, position: "ST", livePenalties: true, context: {},
  teamStrength: 75, oppStrength: 75, home: true } as unknown as HiddenMatchInputs;
type CondFor = (m: number) => Conditions | undefined;

function run(condFor: CondFor): Tally {
  const t = zero();
  for (let m = 1; m <= N; m++) {
    const rng = mulberry32(m * 7919 + 13);
    const st = newMatch(rng);
    (st as { tally?: unknown }).tally = {};
    const cond = condFor(m);
    let k = 0;
    while (st.minute < 90) {
      const { request } = tick(st, inputs, rng);
      if (request) {
        t.chances++;
        const kind = request.kinds[Math.floor(rng() * request.kinds.length)];
        const r = playChance(kind, cond, m * 1000 + k++, t);
        if (r === "goal") t.yours++;
        resolveScenario(st, r);
      }
    }
    t.us += st.userScore; t.them += st.oppScore;
  }
  return t;
}

const week = (m: number) => ((m - 1) % 38) + 1, season = (m: number) => 1 + Math.floor((m - 1) / 38);
const on = (clubs: readonly string[]): CondFor => (m) => {
  const club = clubs[m % clubs.length];
  return matchConditions({ season: season(m), homeCity: "", player: { club } as never }, { week: week(m), home: true, opponent: "", kind: "league" });
};
const ROWS: [string, CondFor][] = [
  ["OFF: today's game", (m) => conditionsFor(season(m), week(m), "")],
  ["ON: Premier League grounds", on(C.PREMIER_LEAGUE_CLUBS)],
  ["ON: League Two grounds", on(C.LEAGUE_TWO_CLUBS)],
  ["ON: National League North grounds", on(C.NATIONAL_LEAGUE_NORTH_CLUBS)],
  ["ON: Step 3 grounds", on([...C.STEP3_NORTH_CLUBS, ...C.STEP3_SOUTH_CLUBS])],
];
const pct = (a: number, b: number) => (b ? (a / b * 100).toFixed(1) + "%" : "-");
console.log(`${N} matches each, 75 v 75 at home, ${mode === "old" ? "Old" : "New"} ball, robot passer/shooter.\n`);
console.log("| Row | Your chances | Your goals | Your side's goals | Their goals | Pass completion | Shots blocked | Shots blocked in rain |\n|---|---|---|---|---|---|---|---|");
for (const [name, f] of ROWS) {
  const t = run(f);
  console.log(`| ${name} | ${(t.chances / N).toFixed(2)} | ${(t.yours / N).toFixed(3)} | ${(t.us / N).toFixed(3)} | ${(t.them / N).toFixed(3)} | ${pct(t.passDone, t.passes)} (${t.passes}) | ${pct(t.blocked, t.shots)} | ${pct(t.wetBlocked, t.wetShots)} (${t.wetShots}) |`);
}
