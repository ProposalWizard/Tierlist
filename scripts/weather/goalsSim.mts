/**
 * GOALS A MATCH WITH THE NEW WEATHER ON VS OFF (hub, 22 Oct 2026).
 *   npx tsx scripts/weather/goalsSim.mts [matches=300] [old|new]
 *
 * Whole matches: the game's own unseen match (hiddenMatch.ts) runs the ninety
 * minutes and asks for your chances, as in a career. Each chance is played
 * through the real ball (buildScenario + launch + stepBall, keeper, defenders,
 * team-mates) by a robot shooter (aims at goal ±3 m, random power and lift,
 * the same in every condition), and its result goes back into the match.
 * Same seeds in every condition, so the only difference is the weather.
 * Opponent goals and team-mates' unseen goals come from the unseen match.
 */
import { newMatch, tick, resolveScenario, type HiddenMatchInputs, type ScenarioResult } from "../../lib/star/hiddenMatch";
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch, setBallPhysics, type Outcome,
} from "../../lib/star/canvasEngine";
import { conditionsFor, type Conditions } from "../../lib/star/weather";
import { buildConditions, CLEAR_DIALS, plannedDials, type WeatherDials } from "../../lib/star/weatherLab";
import { POST_L, POST_R } from "../../lib/star/pitch";

const N = Number(process.argv[2]) || 300;
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

function playChance(kind: string, cond: Conditions | undefined, seed: number): ScenarioResult {
  const rng = mulberry32(seed);
  let sc;
  try { sc = buildScenario(kind as never, rng, 75, 75, 60); } catch { return "lost"; }
  sc.conditions = cond;
  initDefenders(sc, rng);
  const tx = (POST_L + POST_R) / 2 + (rng() - 0.5) * 6;
  const ball = launch(sc, { x: tx - sc.ball.x, y: -Math.max(1, sc.ball.y) }, 0.45 + rng() * 0.55,
    { cx: (rng() - 0.5) * 1.4, cy: -0.4 + rng() * 1.4 }, { power: 70, technique: 70 }, rng);
  const h = 1 / 180;
  let out: Outcome | null = null;
  for (let i = 0; i < 180 * 10 && !out; i++) {
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, rng);
    out = stepBall(ball, sc, rng, h);
  }
  if (out === "goal" || out === "rebound") return "goal";
  if (out === "saved" || out === "caught" || out === "post" || out === "blocked") return "saved";
  if (out === "delivered") return "delivered";
  return "lost";
}

type CondFor = (match: number) => Conditions | undefined;
const inputs = { playerSkill: 70, pace: 70, freeKick: 60, position: "ST", livePenalties: true, context: {},
  teamStrength: 75, oppStrength: 75, home: true } as unknown as HiddenMatchInputs;

function run(condFor: CondFor) {
  let yours = 0, us = 0, them = 0, chances = 0;
  for (let m = 1; m <= N; m++) {
    const rng = mulberry32(m * 7919 + 13);
    const st = newMatch(rng);
    (st as { tally?: unknown }).tally = {};
    const cond = condFor(m);
    let k = 0;
    while (st.minute < 90) {
      const { request } = tick(st, inputs, rng);
      if (request) {
        chances++;
        const kind = request.kinds[Math.floor(rng() * request.kinds.length)];
        const r = playChance(kind, cond, m * 1000 + k++);
        if (r === "goal") yours++;
        resolveScenario(st, r);
      }
    }
    us += st.userScore; them += st.oppScore;
  }
  return { yours: yours / N, us: us / N, them: them / N, chances: chances / N };
}

const fix = (d: Partial<WeatherDials>) => () => buildConditions({ ...CLEAR_DIALS, ...d });
const week = (m: number) => ((m - 1) % 38) + 1, season = (m: number) => 1 + Math.floor((m - 1) / 38);
const CASES: [string, CondFor][] = [
  ["Off: today's game (its own weather roll)", (m) => conditionsFor(season(m), week(m), "")],
  ["Clear every match", () => undefined],
  ["On: Premier League home ground (Arsenal)", (m) => buildConditions(plannedDials(season(m), week(m), "Arsenal"))],
  ["On: League Two home ground (Accrington Stanley)", (m) => buildConditions(plannedDials(season(m), week(m), "Accrington Stanley"))],
  ["On: worst NL North ground (Spalding United)", (m) => buildConditions(plannedDials(season(m), week(m), "Spalding United"))],
  ["Every match: wind 10 m/s across", fix({ weather: "wind", windSpeed: 10, windTo: 90 })],
  ["Every match: wind 10 m/s in your face", fix({ weather: "wind", windSpeed: 10, windTo: 180 })],
  ["Every match: wind 10 m/s behind you", fix({ weather: "wind", windSpeed: 10, windTo: 0 })],
  ["Every match: rain", fix({ weather: "rain" })],
  ["Every match: heavy rain", fix({ weather: "heavy" })],
  ["Every match: worst pitch, dry (tame)", fix({ pitch: 0.25, ground: "dry" })],
  ["Every match: worst pitch, dry (harsh)", fix({ pitch: 0.25, ground: "dry", worst: "harsh" })],
];
console.log(`${N} matches each, 75 v 75 at home, ${mode === "old" ? "Old" : "New"} ball, robot shooter.\n`);
console.log("| Condition | Your chances | Your goals | Your side's goals | Their goals |\n|---|---|---|---|---|");
for (const [name, f] of CASES) {
  const r = run(f);
  console.log(`| ${name} | ${r.chances.toFixed(2)} | ${r.yours.toFixed(2)} | ${r.us.toFixed(2)} | ${r.them.toFixed(2)} |`);
}
