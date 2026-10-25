/**
 * THE NEW HEADER / VOLLEY MOMENT (lib/star/airPick.ts) — goals per 100 at
 * Aerial 30 / 60 / 90, next to the timed "Head it?" screen it replaces.
 *
 *   npx tsx scripts/aerial/pick-measure.mts [--n=600] [--sd=0.14] [--aimsd=0.12]
 *
 * The same pictures, struck the same way (tests/star/shotLab.ts + applyAirborne),
 * as scripts/aerial/timer-measure.mts. Only the hand changes:
 *  - WHEN: a person aims for the middle of the green band; the tap lands
 *    --sd seconds either side (normal). Past the end = the timer ran out
 *    (the late touch). An assumption: nobody has measured real taps here.
 *  - WHERE: 3 in 4 at the far corner from the keeper, else the near one;
 *    0.7-1.0 of the way to the post, 60% aimed low, 40% high; the finger
 *    lands --aimsd (share of half the goal) off the spot it meant.
 * The aim is the tap (no drag, so no drag error).
 */
import { shoot, type Thumb, type LabOptions } from "../../tests/star/shotLab";
import { applyAirborne } from "../../lib/star/airborneChance";
import { airPickStrike, airPickWindowS, airSweetS, airAimX, airCrossSide, type AirKind } from "../../lib/star/airPick";
import type { Scenario, ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX } from "../../lib/star/pitch";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "600"));
const SD = Number(arg("sd", "0.14")), AIM_SD = Number(arg("aimsd", "0.12"));

function gauss(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function pickRate(kind: AirKind, aerial: number, n = N, sd = SD, aimSd = AIM_SD): { goals: number; late: number; clean: number } {
  let goals = 0, late = 0, clean = 0;
  for (let i = 1; i <= n; i++) {
    const seed = (i * 7919 + kind.length * 104729) >>> 0;
    const rt = mulberry32((seed ^ 0x7a9b1) >>> 0);
    const w = airPickWindowS(kind, aerial), band = airSweetS(kind, aerial);
    const tS = w - band / 2 + gauss(rt) * sd;
    let strike: ReturnType<typeof airPickStrike> | null = null;
    const thumbFor = (sc: Scenario, r: () => number): Thumb => {
      const farSide = sc.keeper.x < CX ? 1 : -1;
      const s = r() < 0.75 ? farSide : -farSide;
      const gx = s * (0.7 + r() * 0.3) + gauss(r) * aimSd;
      const gy = (r() < 0.6 ? 0.15 : 0.7) + gauss(r) * aimSd;
      strike = airPickStrike(kind, { tS: tS >= w ? null : Math.max(0, tS), gx, gy }, sc.ball, aerial, airCrossSide(sc));
      const ax = strike.late ? CX : airAimX(gx);
      return { aimErrDeg: 0, power: strike.power, contact: { cx: strike.cx, cy: strike.cy }, intent: "placed", targetX: ax, aimX: ax };
    };
    const o: LabOptions = { skills: { power: 60, technique: 60 }, thumbFor };
    o.afterLaunch = (ball, sc) => {
      const st = strike!;
      applyAirborne(ball, sc, { kind, lift: st.lift, cx: st.cx, cy: st.cy, tech: 60, aerial });
    };
    if (shoot(kind as ScenarioKind, seed, o).goal) goals++;
    const st = strike as ReturnType<typeof airPickStrike> | null;
    if (st?.late) late++; else if (st && st.err === 0) clean++;
  }
  return { goals: (100 * goals) / n, late: (100 * late) / n, clean: (100 * clean) / n };
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("pick-measure.mts");
if (isMain) {
  console.log(`tap: band middle ± ${SD} s (normal), finger ± ${AIM_SD} of half the goal (assumed); ${N} chances a cell`);
  console.log(`timed screen it replaces (timer-measure.mts): header 19.0 / 25.0 / 35.3 · volley 19.3 / 26.3 / 35.3`);
  for (const kind of ["header", "volley"] as const) {
    const cells = [30, 60, 90].map((a) => pickRate(kind, a));
    console.log(`\n${kind.toUpperCase()}                Aerial 30      60      90`);
    console.log(`goals per 100              ${cells.map((x) => x.goals.toFixed(1).padStart(6)).join("  ")}`);
    console.log(`clean (in the band)        ${cells.map((x) => x.clean.toFixed(1).padStart(6)).join("  ")}`);
    console.log(`ran out, per 100           ${cells.map((x) => x.late.toFixed(1).padStart(6)).join("  ")}`);
    console.log(`timer / band (s)           ${[30, 60, 90].map((a) => `${airPickWindowS(kind, a).toFixed(2)}/${airSweetS(kind, a).toFixed(2)}`.padStart(9)).join(" ")}`);
  }
}
