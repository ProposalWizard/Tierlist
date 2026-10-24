/**
 * FEEL CHECK: is a "stops dead" pitch frustrating? (hub, 22 Oct 2026)
 *   npx tsx scripts/weather/feelCheck.mts [old|new]
 * A "normal pass": a ground pass 8-30 m to a team-mate, struck so that on a
 * clear, perfect pitch it would reach him still moving at 4 m/s (a firm,
 * receivable ball), with ±15% error in the strike like a real player. Then
 * the same strikes on each pitch: how often does it die short of him?
 * "Dies short" = stops 1.5 m or more before him (out of his reach: he has to
 * come back for it). "Limps in" = reaches him under 1.5 m/s.
 */
import { buildConditions, CLEAR_DIALS, type WeatherDials } from "../../lib/star/weatherLab";
import { integrateBallOld, type Ball } from "../../lib/star/canvasEngine";
import { integrateBallReal } from "../../lib/star/ballPhysics";
import type { Conditions } from "../../lib/star/weather";

const mode = (process.argv[2] === "new" ? "new" : "old") as "old" | "new";
const dt = 1 / 180;

/** Roll a ground pass of speed v along +y; return distance reached and the speed at `target` (0 if it never gets there). */
function roll(v: number, cond: Conditions, target: number): { dist: number; speedAt: number } {
  const ball = { pos: { x: 0, y: 0 }, vel: { x: 0, y: v }, z: 0.11, vz: 0.6, spin: 0, topspin: 0,
    resting: false, loose: false, contactCd: 0, receiverControlT: 0, event: null, inNet: false } as unknown as Ball;
  let speedAt = 0;
  for (let t = 0; t < 15 && !ball.resting; t += dt) {
    if (mode === "new") integrateBallReal(ball, cond, dt); else integrateBallOld(ball, cond, dt);
    if (!speedAt && ball.pos.y >= target) speedAt = Math.hypot(ball.vel.x, ball.vel.y);
  }
  return { dist: ball.pos.y, speedAt };
}

/** The strike that arrives at `d` at 4 m/s on a clear perfect pitch. */
const clear = buildConditions(CLEAR_DIALS);
function strikeFor(d: number): number {
  let lo = 1, hi = 40;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (roll(m, clear, d).speedAt >= 4) hi = m; else lo = m; }
  return hi;
}

let s = 99;
const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const passes = Array.from({ length: 1000 }, () => { const d = 8 + rnd() * 22; return { d, v: strikeFor(d) * (0.85 + rnd() * 0.3) }; });

const CASES: [string, Partial<WeatherDials>][] = [
  ["Clear, perfect", {}],
  ["Fair (0.6), normal", { pitch: 0.6 }],
  ["Poor (0.45), dry", { pitch: 0.45, ground: "dry" }],
  ["Very poor (0.35), dry", { pitch: 0.35, ground: "dry" }],
  ["Worst (0.25), dry", { pitch: 0.25, ground: "dry" }],
  ["Worst, dry, HARSH (first build)", { pitch: 0.25, ground: "dry", worst: "harsh" }],
  ["Poor (0.45), dry, HARSH", { pitch: 0.45, ground: "dry", worst: "harsh" }],
  ["Rain", { weather: "rain" }],
  ["Heavy rain", { weather: "heavy" }],
];
console.log(`Ball: ${mode}. 1,000 normal ground passes, 8-30 m.\n`);
console.log("pitch".padEnd(24), "dies short", " limps in", " mean short by");
for (const [name, d] of CASES) {
  const c = buildConditions({ ...CLEAR_DIALS, ...d });
  let short = 0, limp = 0, by = 0;
  for (const p of passes) {
    const r = roll(p.v, c, p.d);
    if (r.dist < p.d - 1.5) { short++; by += p.d - r.dist; }
    else if (r.speedAt < 1.5) limp++;
  }
  console.log(name.padEnd(24), `${(short / 10).toFixed(1)}%`.padStart(10), `${(limp / 10).toFixed(1)}%`.padStart(9), short ? `${(by / short).toFixed(1)} m`.padStart(13) : "            -");
}
