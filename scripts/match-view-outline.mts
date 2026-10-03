/**
 * THE OUT LINE, BEFORE AND AFTER THE NEW MATCH VIEW.
 *
 *   npx tsx scripts/match-view-outline.mts [chances-per-kind]
 *
 * The engine calls a ball "out" when it leaves `scenario.viewport`. Classic
 * keeps the engine's own frame (26 × 42 m); the new view (lib/star/matchView.ts)
 * makes the play area the camera (38 m across, as tall as the phone allows —
 * measured here at option D's 83 m). Same seeds, same strikes, same everything
 * else: the only difference is that rectangle. Prints, per kind, the goal rate
 * each way and how many chances ended differently.
 */
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, SCENARIO_KINDS, type Outcome, type ScenarioKind, type Scenario,
} from "../lib/star/canvasEngine";
import { POST_L, POST_R } from "../lib/star/pitch";
import { frameForNewView, crossCutCamera, NEW_VIEW_MAX_HW } from "../lib/star/matchView";

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = Number(process.argv[2] ?? 600);
const DT = 1 / 60;
const GOAL_CX = (POST_L + POST_R) / 2;
const SHOOT: ScenarioKind[] = ["one_on_one", "tight_angle", "long_range", "volley", "header", "penalty", "free_kick"];
const HW = process.argv[3] ? Number(process.argv[3]) : NEW_VIEW_MAX_HW;

function play(kind: ScenarioKind, seed: number, newView: boolean): Outcome | "none" {
  const rng = mulberry32(seed * 1013 + kind.length * 7919);
  const sc: Scenario = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
  initDefenders(sc, rng);
  if (newView) frameForNewView(sc, HW);

  let dir: { x: number; y: number };
  let power: number;
  if (SHOOT.includes(kind)) {
    const side = rng() < 0.5 ? -1 : 1;
    const tx = GOAL_CX + side * ((POST_R - POST_L) / 2 - 0.6) * (0.55 + rng() * 0.45);
    dir = { x: tx - sc.ball.x + (rng() - 0.5) * 1.2, y: -Math.max(sc.ball.y, 1) };
    power = Math.min(1, 0.42 + Math.hypot(sc.ball.x - GOAL_CX, sc.ball.y) / 40) * (0.85 + rng() * 0.3);
  } else {
    const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos ?? { x: sc.ball.x, y: sc.ball.y - 10 };
    dir = { x: t.x - sc.ball.x + (rng() - 0.5) * 1.5, y: t.y - sc.ball.y + (rng() - 0.5) * 1.5 };
    power = Math.min(0.95, 0.2 + Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y) / 32) * (0.9 + rng() * 0.2);
  }
  const ball = launch(sc, dir, power,
    { cx: (rng() - 0.5) * 0.8, cy: -0.1 - rng() * 0.45 },
    { power: 55 + rng() * 25, technique: 55 + rng() * 25 }, rng);

  let turned = (sc.facing ?? "up") !== "up";
  let out: Outcome | null = null;
  for (let i = 0; i < 2000 && !out; i++) {
    // The cut on a cross, as CanvasMatch does it.
    if (turned && sc.crossSwitchView && ball.pos.y < (sc.crossSwitchY ?? 0)) {
      const view = newView ? crossCutCamera(sc.crossSwitchView, HW, ball.pos) : sc.crossSwitchView;
      if (ball.pos.x > view.x1 - 1 && ball.pos.x < view.x2 + 1) { sc.viewport = { ...view }; turned = false; }
    }
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    out = stepBall(ball, sc, rng, DT);
  }
  return out ?? "none";
}

const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
const rows: string[] = [];
let allDiff = 0, allN = 0, allGoalA = 0, allGoalB = 0;
for (const kind of SCENARIO_KINDS) {
  let goalA = 0, goalB = 0, diff = 0, outA = 0, outB = 0;
  const changes = new Map<string, number>();
  for (let s = 0; s < N; s++) {
    const a = play(kind, s, false), b = play(kind, s, true);
    if (a === "goal" || a === "rebound") goalA++;
    if (b === "goal" || b === "rebound") goalB++;
    if (a === "out") outA++;
    if (b === "out") outB++;
    if (a !== b) { diff++; const k = `${a}→${b}`; changes.set(k, (changes.get(k) ?? 0) + 1); }
  }
  allDiff += diff; allN += N; allGoalA += goalA; allGoalB += goalB;
  const top = [...changes.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(", ");
  rows.push(`${kind.padEnd(14)} goals ${pct(goalA, N).padStart(6)} → ${pct(goalB, N).padStart(6)}   out ${pct(outA, N).padStart(6)} → ${pct(outB, N).padStart(6)}   ended differently ${String(diff).padStart(4)}/${N} (${pct(diff, N)})  ${top}`);
}
console.log(`Classic play area vs new view's (38 m × ${(38 * HW).toFixed(0)} m), ${N} chances per kind, same seeds\n`);
for (const r of rows) console.log(r);
console.log(`\nALL            goals ${pct(allGoalA, allN)} → ${pct(allGoalB, allN)}   ended differently ${allDiff}/${allN} (${pct(allDiff, allN)})`);
