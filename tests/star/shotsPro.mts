/**
 * SHOTS (lib/star/shotModel.ts) — Settings → Gameplay "Shots" and
 * "Knuckleball & power shot". Numbers and sources: docs/gameplay15/shots.md.
 *
 * Run: npx tsx tests/star/shotsPro.mts
 */
import * as E from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import {
  launchShot, gradeContact, intendedHeight, vzForHeight, makeKnuckle, stepKnuckle, knuckleOf,
  powerShotQuality, powerShotStrike, shotSeedFor,
} from "../../lib/star/shotModel";
import { shoot } from "./shotLab";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

// ── Old is today's strike, draw for draw ──
{
  let same = 0, n = 0;
  for (const kind of ["one_on_one", "long_range", "cutback", "penalty", "corner"] as E.ScenarioKind[]) {
    for (let s = 1; s <= 60; s++) {
      const mk = () => { const r = mulberry32(s * 31 + kind.length); const sc = E.buildScenario(kind, r, 62, 60, 55); return { sc, r }; };
      const a = mk(), b = mk();
      const dir = { x: (s % 7 - 3) * 0.2, y: -1 }, c = { cx: ((s % 5) - 2) * 0.3, cy: ((s % 9) - 4) * 0.2 };
      const ba = E.launch(a.sc, dir, 0.9, c, { power: 65, technique: 65 }, a.r);
      const bb = launchShot(b.sc, dir, 0.9, c, { power: 65, technique: 65 }, b.r, { seed: 1 }, { pro: false, knuckle: false }, E.launch).ball;
      n++; if (JSON.stringify(ba) === JSON.stringify(bb) && a.r() === b.r()) same++;
    }
  }
  ok(same === n, `both switches Old: the same ball and the same random stream as launch (${same}/${n})`);
}

// ── Contact grades ──
{
  ok(gradeContact({ cx: 0.2, cy: -0.3 }, 0.9).grade === "clean", "a tap through the body of the ball is clean");
  ok(gradeContact({ cx: 0, cy: 0.05 }, 0.9).grade === "knuckle", "a hard strike through the dead centre knuckles");
  ok(gradeContact({ cx: 0, cy: 0.05 }, 0.5).grade === "clean", "…but not a soft one");
  ok(gradeContact({ cx: 0.9, cy: 0.1 }, 0.9).grade === "sliced", "the side rim slices");
  ok(gradeContact({ cx: 0.1, cy: -0.9 }, 0.9).grade === "topped", "the top rim is topped");
  ok(gradeContact({ cx: 0.6, cy: 0.8 }, 0.9).grade === "scuffed", "a tap outside the ball (snapped to radius 1) is scuffed");
  ok(gradeContact({ cx: 0, cy: 0.9 }, 0.5).grade === "chip", "the bottom is the chip, not a mistake");
  const clean = gradeContact({ cx: 0.2, cy: 0 }, 0.9), bad = gradeContact({ cx: 0.95, cy: 0.1 }, 0.9);
  ok(clean.spread < 1 && bad.spread > 1 && bad.power < 1, "clean is truer, sliced loses pace and line");
}

// ── Height is aimed at the line ──
{
  ok(intendedHeight(-1) < intendedHeight(0) && intendedHeight(0) < intendedHeight(0.3) && intendedHeight(0.3) < 2.44, "top low, middle mid, below the middle under the bar");
  const vz = vzForHeight(11, 25, 1.0)!;
  let x = 0, z = 0.08, v = vz, sp = 25;
  for (let t = 0; t < 2 && x < 11; t += 1 / 600) { sp *= 1 - 0.12 / 600; x += sp / 600; v -= 9.8 / 600; z += v / 600; }
  ok(Math.abs(z - 1.0) < 0.1, `the solve lands it at the height asked (asked 1.00 m, got ${z.toFixed(2)} m at 11 m)`);
}

// ── Knuckleball wobbles; power shot ──
{
  const sc = E.buildScenario("long_range", mulberry32(5), 62, 60, 55);
  const ball = E.launch(sc, { x: 0, y: -1 }, 1, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, mulberry32(9));
  ball.vz = 4;
  makeKnuckle(ball, mulberry32(3));
  const x0 = ball.pos.x; let maxOff = 0;
  for (let i = 0; i < 180; i++) { stepKnuckle(ball, 1 / 180); maxOff = Math.max(maxOff, Math.abs(ball.pos.x - x0)); }
  ok(!!knuckleOf(ball) && maxOff > 0.1 && maxOff < 1.2, `a knuckleball moves off its line late (${maxOff.toFixed(2)} m)`);
  ok(powerShotQuality(0.1, true) === 1 && powerShotQuality(2, true) === 0 && powerShotQuality(0.1, false) === 0, "power shot: fast tap perfect, slow or missed none");
  const p = powerShotStrike(1, mulberry32(1));
  ok(p.powerMult === 1.5 && Math.abs(p.driftDeg) < 1, "a perfect power shot is 1.5x and on line");
  ok(shotSeedFor(1, 2) !== shotSeedFor(1, 3), "each strike has its own seed");
}

// ── Conversion with a human-like thumb (see shotLab.ts), before → after ──
{
  const N = 160;
  const rate = (kind: E.ScenarioKind, model: { pro: boolean; knuckle: boolean } | null) => {
    let g = 0, ot = 0;
    for (let s = 1; s <= N; s++) { const r = shoot(kind, s * 7919 + 13, { model }); if (r.goal) g++; if (r.onTarget) ot++; }
    return { g: g / N, ot: ot / N };
  };
  const pOld = rate("penalty", null), pNew = rate("penalty", { pro: true, knuckle: true });
  console.log(`  penalty: scored ${(pOld.g * 100).toFixed(1)}% → ${(pNew.g * 100).toFixed(1)}%, on target ${(pOld.ot * 100).toFixed(1)}% → ${(pNew.ot * 100).toFixed(1)}%`);
  ok(pNew.g > pOld.g + 0.1 && pNew.g > 0.6, "penalties are no longer skied: far more go in (real: 76%)");
  const one = rate("one_on_one", { pro: true, knuckle: true });
  console.log(`  one-on-one (new): scored ${(one.g * 100).toFixed(1)}%, on target ${(one.ot * 100).toFixed(1)}%`);
  ok(one.g > 0.28 && one.g < 0.5, "a one-on-one converts in the real big-chance band (30-45%)");
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nPASS — shots");
