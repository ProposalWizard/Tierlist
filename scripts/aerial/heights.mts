/**
 * HEADER HEIGHTS (headers piece 4) — do varying heights (1.5 to 2.6 m) move
 * the goal rate? Goals per 100 header chances at finishing 30 / 60 / 90
 * (Power = Technique = Aerial = the level), heights OFF (every header at
 * 1.85 m) against ON (each chance its own height, airDrawings.ts airZOf).
 *
 *   npx tsx scripts/aerial/heights.mts [--n=800]
 *
 * B10's method (scripts/aerial/measure.mts): the served pictures, the same
 * seeded bot thumb, the same strike read. Also prints the ON rate by height band.
 */
import { shoot, type Thumb, type LabOptions } from "../../tests/star/shotLab";
import { applyAirborne } from "../../lib/star/airborneChance";
import { setAirHeightVariesOverride, airZOf, type AirHeighted } from "../../lib/star/airDrawings";
import type { Scenario } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "800"));
const TAP_SD = 0.3;
function gauss(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const thumb = (sc: Scenario, r: () => number): Thumb => {
  const farSide = sc.keeper.x < CX ? 1 : -1;
  const side = r() < 0.75 ? farSide : -farSide;
  const inset = 0.35 + r() * 0.6;
  const targetX = side > 0 ? POST_R - inset : POST_L + inset;
  const meant = r() < 0.6 ? { cx: 0, cy: -0.35 } : { cx: 0, cy: 0 };
  const power = 0.7 + r() * 0.3;
  let cx = meant.cx + gauss(r) * TAP_SD, cy = meant.cy + gauss(r) * TAP_SD;
  const d = Math.hypot(cx, cy); if (d > 1) { cx /= d; cy /= d; }
  return { aimErrDeg: gauss(r) * 2.5, power, contact: { cx, cy }, intent: "placed", targetX, aimX: targetX };
};

const bands = [[1.5, 1.8], [1.8, 2.1], [2.1, 2.35], [2.35, 2.61]] as const;
function run(on: boolean, skill: number) {
  setAirHeightVariesOverride(on);
  let goals = 0, onT = 0; const by = bands.map(() => ({ n: 0, g: 0 }));
  for (let i = 1; i <= N; i++) {
    const seed = (i * 7919 + 6 * 104729) >>> 0;
    let z = 0;
    const o: LabOptions = { skills: { power: skill, technique: skill }, thumbFor: thumb };
    o.afterLaunch = (ball, sc) => {
      z = airZOf(sc as Scenario & AirHeighted);
      const lift = 0.84 + 0.16 * mulberry32((seed ^ 0x1f7a3) >>> 0)();
      applyAirborne(ball, sc, { kind: "header", lift, cx: o.thumbFor ? undefined : 0, tech: skill, aerial: skill, ...lastTap });
    };
    let lastTap: { cx?: number; cy?: number } = {};
    const wrapped = o.thumbFor!;
    o.thumbFor = (sc, r) => { const t = wrapped(sc, r); lastTap = { cx: t.contact.cx, cy: t.contact.cy }; return t; };
    const res = shoot("header", seed, o);
    if (res.goal) goals++;
    if (res.onTarget) onT++;
    const b = bands.findIndex(([lo, hi]) => z >= lo && z < hi);
    if (b >= 0) { by[b].n++; if (res.goal) by[b].g++; }
  }
  setAirHeightVariesOverride(null);
  return { rate: (100 * goals) / N, onT: (100 * onT) / N, by };
}

console.log(`HEADER — goals per 100 (${N} chances each)        30     60     90`);
const rows: Record<string, ReturnType<typeof run>[]> = {};
for (const on of [false, true]) {
  rows[String(on)] = [30, 60, 90].map((s) => run(on, s));
  console.log(`${on ? "heights ON  (1.5-2.6 m)" : "heights OFF (all 1.85 m)"}   goals     ${rows[String(on)].map((r) => r.rate.toFixed(1).padStart(5)).join("  ")}`);
  console.log(`                           on target ${rows[String(on)].map((r) => r.onT.toFixed(1).padStart(5)).join("  ")}`);
}
console.log(`difference (ON - OFF)                ${[0, 1, 2].map((i) => (rows.true[i].rate - rows.false[i].rate).toFixed(1).padStart(5)).join("  ")}`);
console.log(`\nON, goals per 100 by height band (n per band at 60 in brackets):`);
for (let b = 0; b < bands.length; b++) {
  console.log(`  ${bands[b][0].toFixed(2)}-${Math.min(2.6, bands[b][1]).toFixed(2)} m  ${rows.true.map((r) => (r.by[b].n ? (100 * r.by[b].g / r.by[b].n).toFixed(1) : "  -").padStart(5)).join("  ")}   (${rows.true[1].by[b].n})`);
}
