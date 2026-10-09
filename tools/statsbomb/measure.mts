/**
 * Do real moments play like real football in our engine? — TESTING ONLY.
 *
 * The same shooter (a fixed, decent finish: the far side from the keeper,
 * a little aim error) takes every real Premier League chance in
 * real-moments.json many times, and the same number of the game's own
 * generated chances of the same kind. Two questions:
 *   1. Does the game's conversion RISE with the real xG? (If the real
 *      pictures carry real information, a 40% chance should play easier
 *      than a 5% one.)
 *   2. How do real pictures compare to generated ones, kind by kind?
 *
 * Usage: npx tsx tools/statsbomb/measure.mts DATA_DIR
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildScenario, launch, stepBall, stepDefenders, stepKeeper, stepReactions, initDefenders,
  type Scenario, type ScenarioKind, type Outcome,
} from "../../lib/star/canvasEngine";
import { applyOverrideToScenario } from "../../lib/star/scenarioEdit";
import { mulberry32 } from "../../lib/star/season";
import { POST_L, POST_R } from "../../lib/star/pitch";
import type { RealMoment } from "../../lib/star/realMoments";

const dir = process.argv[2] ?? "sb-data";
const all: RealMoment[] = JSON.parse(readFileSync(join(dir, "real-moments.json"), "utf8"));
const DT = 1 / 60;
const TRIES = 6;

/** One shot by "you": the far side from the keeper, 0.6m in from the post. */
function shoot(sc: Scenario, rng: () => number): boolean {
  initDefenders(sc, rng);
  const farLeft = sc.keeper.x > (POST_L + POST_R) / 2;
  const tx = (farLeft ? POST_L + 0.6 : POST_R - 0.6) + (rng() - 0.5) * 1.6;
  const dist = Math.hypot(tx - sc.ball.x, sc.ball.y);
  const ball = launch(sc, { x: tx - sc.ball.x, y: -sc.ball.y },
    Math.min(0.95, 0.45 + dist / 60) * (0.92 + rng() * 0.16),
    { cx: (rng() - 0.5) * 0.3, cy: -0.15 - rng() * 0.15 },
    { power: 65, technique: 65 }, rng);
  let res: Outcome | null = null;
  for (let i = 0; i < 1500 && !res; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    res = stepBall(ball, sc, rng, DT);
  }
  return res === "goal";
}

function rate(build: (i: number) => Scenario, n: number): number {
  let g = 0;
  for (let i = 0; i < n; i++) if (shoot(build(i), mulberry32(9000 + i))) g++;
  return g / n;
}

const pl = all.filter(m => m.source === "pl1516");
const pct = (v: number) => `${(100 * v).toFixed(1)}%`;

// 1. Game conversion by the real xG band.
const bands: [number, number][] = [[0, 0.03], [0.03, 0.06], [0.06, 0.1], [0.1, 0.2], [0.2, 0.35], [0.35, 1.01]];
console.log("Real xG band | real chances | real goals | our engine, same shooter");
for (const [lo, hi] of bands) {
  const xs = pl.filter(m => (m.meta.xg ?? 0) >= lo && (m.meta.xg ?? 0) < hi);
  const sample = xs.filter((_, i) => i % Math.max(1, Math.floor(xs.length / 300)) === 0).slice(0, 300);
  const realGoals = xs.filter(m => m.meta.outcome === "Goal").length / xs.length;
  let g = 0, n = 0;
  for (const m of sample) for (let t = 0; t < TRIES; t++) {
    const sc = buildScenario(m.kind, mulberry32(m.seed));
    applyOverrideToScenario(sc, m.override);
    if (shoot(sc, mulberry32(m.seed * 13 + t))) g++;
    n++;
  }
  console.log(`${lo.toFixed(2)}-${Math.min(hi, 1).toFixed(2)} | ${String(xs.length).padStart(5)} | ${pct(realGoals).padStart(6)} | ${pct(g / n).padStart(6)} (${n} shots)`);
}

// 2. Real vs generated, kind by kind (real ones in the 8-50% xG band).
console.log("\nKind | real pictures | generated pictures (same shooter)");
for (const kind of ["one_on_one", "volley", "tight_angle", "long_range"] as ScenarioKind[]) {
  const xs = pl.filter(m => m.kind === kind && (m.meta.xg ?? 0) >= 0.08 && (m.meta.xg ?? 0) <= 0.5).slice(0, 300);
  if (!xs.length) continue;
  const real = rate(i => {
    const m = xs[i % xs.length];
    const sc = buildScenario(m.kind, mulberry32(m.seed));
    applyOverrideToScenario(sc, m.override);
    return sc;
  }, xs.length * TRIES);
  const gen = rate(i => buildScenario(kind, mulberry32(50_000 + i)), xs.length * TRIES);
  const meanXg = xs.reduce((a, m) => a + (m.meta.xg ?? 0), 0) / xs.length;
  const dist = (sc: { ball: { y: number } }) => sc.ball.y;
  const genDist = Array.from({ length: 200 }, (_, i) => dist(buildScenario(kind, mulberry32(50_000 + i)))).reduce((a, b) => a + b, 0) / 200;
  const realDist = xs.reduce((a, m) => a + (m.override.ball?.y ?? 0), 0) / xs.length;
  console.log(`${kind.padEnd(12)} | ${pct(real).padStart(6)} (real xG ${pct(meanXg)}, ${realDist.toFixed(1)}m out) | ${pct(gen).padStart(6)} (${genDist.toFixed(1)}m out)`);
}
