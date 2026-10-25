/**
 * THE TIMED HEADER AND VOLLEY — goals per 100 at Aerial 30 / 60 / 90, before
 * (no clock) and after (airborneChance.ts airStrikeTimerS; run out = the late
 * touch, airLateContact).
 *
 *   npx tsx scripts/aerial/timer-measure.mts [--n=600] [--median=0.9] [--spread=0.35]
 *
 * scripts/aerial/measure.mts's method (the served cross pictures, the seeded
 * bot thumb at B10's "average" hand, Aerial on the strike), plus WHEN the bot
 * taps: a human reaction time, log-normal, median --median s and log-spread
 * --spread (an assumption: nobody has measured real taps on this screen).
 * A tap after the timer is replaced by the late touch, as the screen does.
 * Also: the goal rate of a touch that always runs out.
 */
import { shoot, type Thumb, type LabOptions } from "../../tests/star/shotLab";
import { applyAirborne, airStrikeTimerS, airLateContact } from "../../lib/star/airborneChance";
import type { Scenario, ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "600"));
const MED = Number(arg("median", "0.9")), SPREAD = Number(arg("spread", "0.35"));
const TAP_SD = 0.3, TIME_SD = 0.22;

function gauss(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

type Mode = "before" | "after" | "always-late";

function liftFor(kind: "header" | "volley", seed: number): number {
  const r = mulberry32((seed ^ 0x1f7a3) >>> 0);
  if (kind === "header") return 0.84 + 0.16 * r();
  return Math.max(0, Math.min(1, 0.55 + gauss(r) * TIME_SD));
}
function tapTimeFor(seed: number): number {
  const r = mulberry32((seed ^ 0x7a9b1) >>> 0);
  return MED * Math.exp(gauss(r) * SPREAD);
}

function rate(kind: "header" | "volley", mode: Mode, aerial: number): { goals: number; late: number } {
  let goals = 0, lateN = 0;
  for (let i = 1; i <= N; i++) {
    const seed = (i * 7919 + kind.length * 104729) >>> 0;
    const late = mode === "always-late" || (mode === "after" && tapTimeFor(seed) > airStrikeTimerS(kind, aerial));
    if (late) lateN++;
    const side = (seed & 1) ? 1 : -1;
    let lift = liftFor(kind, seed);
    const thumbFor = (sc: Scenario, r: () => number): Thumb => {
      const farSide = sc.keeper.x < CX ? 1 : -1;
      const s = r() < 0.75 ? farSide : -farSide;
      const inset = 0.35 + r() * 0.6;
      const targetX = s > 0 ? POST_R - inset : POST_L + inset;
      const meant = kind === "header" ? (r() < 0.6 ? { cx: 0, cy: -0.35 } : { cx: 0, cy: 0 }) : { cx: 0, cy: -0.1 };
      const power = kind === "header" ? 0.7 + r() * 0.3 : 0.75 + r() * 0.25;
      let cx = meant.cx + gauss(r) * TAP_SD, cy = meant.cy + gauss(r) * TAP_SD;
      const d = Math.hypot(cx, cy); if (d > 1) { cx /= d; cy /= d; }
      if (late) { const lc = airLateContact(kind, lift, side); cx = lc.cx; cy = lc.cy; lift = lc.lift; }
      return { aimErrDeg: gauss(r) * 2.5, power, contact: { cx, cy }, intent: "placed", targetX, aimX: targetX };
    };
    const o: LabOptions = { skills: { power: 60, technique: 60 }, thumbFor };
    o.afterLaunch = (ball, sc, thumb) => {
      applyAirborne(ball, sc, { kind, lift, cx: thumb.contact.cx, cy: thumb.contact.cy, tech: 60, aerial });
    };
    if (shoot(kind as ScenarioKind, seed, o).goal) goals++;
  }
  return { goals: (100 * goals) / N, late: (100 * lateN) / N };
}

console.log(`tap time: log-normal, median ${MED} s, spread ${SPREAD} (assumed); ${N} chances a cell`);
for (const kind of ["header", "volley"] as const) {
  console.log(`\n${kind.toUpperCase()} — goals per 100        Aerial 30      60      90`);
  const cells = (m: Mode) => [30, 60, 90].map((a) => rate(kind, m, a));
  const b = cells("before"), a = cells("after"), l = cells("always-late");
  console.log(`before (no clock)                ${b.map((x) => x.goals.toFixed(1).padStart(6)).join("  ")}`);
  console.log(`after  (timed)                   ${a.map((x) => x.goals.toFixed(1).padStart(6)).join("  ")}`);
  console.log(`       ran out, per 100          ${a.map((x) => x.late.toFixed(1).padStart(6)).join("  ")}`);
  console.log(`       timer (s)                 ${[30, 60, 90].map((x) => airStrikeTimerS(kind, x).toFixed(2).padStart(6)).join("  ")}`);
  console.log(`always late (every one runs out) ${l.map((x) => x.goals.toFixed(1).padStart(6)).join("  ")}`);
}
