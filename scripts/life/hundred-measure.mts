/**
 * DEN'S HUNDRED — how many of the ten a normal player lands, measured on the
 * match engine's own physics (launch, stepBall, stepKeeper: the same functions
 * CanvasMatch runs), on the same pictures the screen serves (drillScene.ts),
 * judged by the same rule (drill.ts judge).
 *
 *   npx tsx scripts/life/hundred-measure.mts [nights=400]
 *
 * The one thing that is a model, not the game: the thumb. For each ball the
 * script first finds the strike that puts the ball on the middle of the
 * target with a steady strike at that technique (the engine's error at its middle), then plays each
 * night with a human's wobble on top (aim ±2.5°, power ±0.07, contact ±0.15;
 * 1.4× in the dark) and the engine's own technique error at the given
 * technique. Den's keeper plays live (stepKeeper).
 */
import { launch, stepBall, stepKeeper, stepReactions, stepDefenders, type Scenario } from "../../lib/star/canvasEngine";
import { feedsFor, judge, pointsOf, type Feed } from "../../lib/star/life/drill";
import { hundredScenario } from "../../lib/star/life/drillScene";
import { mulberry32 } from "../../lib/star/season";
import { GOAL_H, POST_L, POST_R } from "../../lib/star/pitch";

const DT = 1 / 60;
const NIGHTS = Number(process.argv[2] ?? 400);
/** The thumb's wobble (a model, not measured): aim in radians (2.5°), power, contact. */
const AIM = Number(process.env.AIM ?? 0.0436), POW = Number(process.env.POW ?? 0.07), CON = Number(process.env.CON ?? 0.15);

interface Input { ang: number; power: number; cy: number }

function play(f: Feed, inp: Input, tech: number, rng: () => number, keeper: boolean) {
  const sc: Scenario = hundredScenario(f, mulberry32(7));
  if (!keeper) { sc.keeper.x = -50; sc.keeper.y = -50; sc.keeper.done = true; }
  const dx = Math.sin(inp.ang), dy = -Math.cos(inp.ang);
  const ball = launch(sc, { x: dx, y: dy }, inp.power, { cx: 0, cy: inp.cy }, { power: tech, technique: tech }, rng);
  let cross: { x: number; z: number } | null = null;
  let bar = false;
  let out: string | null = null;
  let prev = { x: ball.pos.x, y: ball.pos.y, z: ball.z };
  for (let i = 0; i < 900 && !out; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    out = stepBall(ball, sc, rng, DT);
    const b = { x: ball.pos.x, y: ball.pos.y, z: ball.z };
    if (!cross && prev.y > 0 && b.y <= 0) {
      const t = prev.y / (prev.y - b.y);
      cross = { x: prev.x + (b.x - prev.x) * t, z: prev.z + (b.z - prev.z) * t };
    }
    if (!bar && b.y < 0.6 && b.y > -0.3 && b.x > POST_L - 0.15 && b.x < POST_R + 0.15 && Math.abs(b.z - GOAL_H) < 0.28) bar = true;
    prev = b;
  }
  return { cross, bar, outcome: out ?? "none" };
}

/** Where the thumb aims for this ball. */
function aimPoint(f: Feed): { x: number; z: number } {
  const t = f.target;
  const mid = (POST_L + POST_R) / 2;
  switch (t.kind) {
    case "corner": return { x: t.side === "L" ? POST_L + 0.7 : POST_R - 0.7, z: 0.45 };
    case "half": return { x: t.side === "L" ? mid - 2 : mid + 2, z: 0.6 };
    case "bar": return { x: mid + (f.x > 0 ? 0.8 : -0.8), z: GOAL_H };
    case "tyre": return { x: t.x, z: t.z };
    case "bucket": return { x: t.x, z: 0.3 };
    case "past": return { x: f.x >= 0 ? POST_R - 0.75 : POST_L + 0.75, z: 0.5 };
  }
}

/** The perfect strike for a point: a search over aim, power and contact with no error. */
function ideal(f: Feed, tech: number): Input {
  const p = aimPoint(f);
  const steady = () => 0.5;
  let best: Input = { ang: 0, power: 0.6, cy: 0 }, bestD = 1e9;
  const sc = hundredScenario(f, mulberry32(7));
  const base = Math.atan2(p.x - sc.ball.x, sc.ball.y);
  for (let da = -0.12; da <= 0.12; da += 0.008) {
    for (let power = 0.3; power <= 1.0; power += 0.07) {
      for (let cy = -0.9; cy <= 1.0; cy += 0.12) {
        const inp = { ang: base + da, power, cy };
        const r = play(f, inp, tech, steady, false);
        if (!r.cross) continue;
        const d = Math.hypot(r.cross.x - p.x, (r.cross.z - p.z) * 1.2) + (power < 0.45 ? 0.3 : 0);
        if (d < bestD) { bestD = d; best = inp; }
      }
    }
  }
  return best;
}

function gauss(rng: () => number) { return Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng()); }

// ideal for a side-flipped ball, cached
const cache = new Map<string, Input>();
function ideal2(f: Feed, tech: number): Input {
  const key = `${f.label}:${(f.target as { side?: string }).side}:${tech}`;
  if (!cache.has(key)) cache.set(key, ideal(f, tech));
  return cache.get(key)!;
}

const feeds = feedsFor(0, 12345);
const techs = [55, 60, 65, 72];
console.log(`Den's hundred, measured on the engine (${NIGHTS} nights a technique)\n`);
const perBall: Record<number, number[]> = {};
for (const tech of techs) {
  const rng = mulberry32(tech * 101);
  const scores: number[] = [], tens: number[] = [];
  const ballHits = feeds.map(() => 0);
  for (let n = 0; n < NIGHTS; n++) {
    const fs = feedsFor(0, n);
    const hits = fs.map((f, i) => {
      // the sides can flip by night: mirror the ideal aim to the called side
      const id = ideal2(f, tech);
      const k = f.dark ? 1.4 : 1;
      const inp = { ang: id.ang + gauss(rng) * AIM * k, power: Math.max(0.2, Math.min(1, id.power + gauss(rng) * POW * k)), cy: Math.max(-1, Math.min(1, id.cy + gauss(rng) * CON * k)) };
      const r = play(f, inp, tech, rng, !!f.keeper);
      return judge(f, r) === "hit";
    });
    hits.forEach((h, i) => { if (h) ballHits[i]++; });
    scores.push(hits.filter(Boolean).length);
    tens.push(pointsOf(hits, fs));
  }
  scores.sort((a, b) => a - b); tens.sort((a, b) => a - b);
  const q = (xs: number[], p: number) => xs[Math.floor(p * (xs.length - 1))];
  const hist = Array.from({ length: 11 }, (_, k) => scores.filter((s) => s === k).length);
  perBall[tech] = ballHits.map((h) => Math.round((h / NIGHTS) * 100));
  console.log(`technique ${tech}: median ${q(scores, 0.5)} of 10 (10%-90%: ${q(scores, 0.1)}-${q(scores, 0.9)}), points median ${q(tens, 0.5)}; 5-8 hits: ${Math.round(100 * scores.filter((s) => s >= 5 && s <= 8).length / NIGHTS)}%`);
  console.log(`   hits 0..10: ${hist.join(" ")}`);
}
console.log("\nEach ball, % hit (technique 55 / 60 / 65 / 72):");
feeds.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)} ${f.label.padEnd(15)} ${techs.map((t) => String(perBall[t][i]).padStart(3)).join(" ")}`));

