/**
 * FOUR WAYS TO HIT A HEADER OR VOLLEY (lib/star/airControl.ts) — goals per
 * 100, clean hits and missed timings for an "average thumb" (AVERAGE_THUMB,
 * assumed), at Aerial 30 / 60 / 90, on the pictures the game serves, struck
 * through the engine's own launch + applyAirborne (tests/star/shotLab.ts),
 * next to today's ball screen (tap-measure.mts's tapRate, same seeds).
 *
 *   npx tsx scripts/aerial/control-measure.mts [--n=600]
 */
import { shoot, type Thumb, type LabOptions } from "../../tests/star/shotLab";
import { applyAirborne } from "../../lib/star/airborneChance";
import { botStrike, type AirControlMode, type AirKind, type AirStrikeOut } from "../../lib/star/airControl";
import type { Scenario, ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";
import { tapRate } from "./tap-measure.mts";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "600"));
type Mode = Exclude<AirControlMode, "screen">;

function rate(mode: Mode, kind: AirKind, aerial: number) {
  let goals = 0, clean = 0, miss = 0;
  for (let i = 1; i <= N; i++) {
    const seed = (i * 7919 + kind.length * 104729) >>> 0;
    let st: AirStrikeOut | null = null;
    const thumbFor = (sc: Scenario, r: () => number): Thumb => {
      const farSide = sc.keeper.x < CX ? 1 : -1;
      const s = r() < 0.75 ? farSide : -farSide;
      const inset = 0.35 + r() * 0.6;
      const targetX = s > 0 ? POST_R - inset : POST_L + inset;
      st = botStrike(mode, kind, sc.ball, targetX, aerial, mulberry32((seed ^ 0x51ab) >>> 0));
      const ax = sc.ball.x + (st.aim.dir.x / -st.aim.dir.y) * sc.ball.y;
      return { aimErrDeg: 0, power: st.aim.power, contact: { cx: st.contact.cx, cy: st.contact.cy }, intent: "placed", targetX, aimX: ax };
    };
    const o: LabOptions = { skills: { power: 60, technique: 60 }, thumbFor };
    o.afterLaunch = (ball, sc) => { const c = st!.contact; applyAirborne(ball, sc, { kind, lift: c.lift, cx: c.cx, cy: c.cy, tech: 60, aerial }); };
    if (shoot(kind as ScenarioKind, seed, o).goal) goals++;
    const w = (st as AirStrikeOut | null)?.word;
    if (w === "PERFECT") clean++; else if (w === "MISSED IT") miss++;
  }
  return { goals: (100 * goals) / N, clean: (100 * clean) / N, miss: (100 * miss) / N };
}

console.log(`${N} chances a cell · average thumb (assumed) · Aerial 30 / 60 / 90`);
for (const kind of ["header", "volley"] as const) {
  console.log(`\n${kind.toUpperCase()}`);
  const sc = [30, 60, 90].map((a) => tapRate(kind, a, N));
  console.log(`today (ball screen)  goals ${sc.map((x) => x.goals.toFixed(1).padStart(5)).join(" ")}   ran out ${sc.map((x) => x.late.toFixed(0).padStart(3)).join(" ")}`);
  for (const mode of ["ghost", "preaim", "swipe", "beat"] as Mode[]) {
    const c = [30, 60, 90].map((a) => rate(mode, kind, a));
    console.log(`${mode.padEnd(20)} goals ${c.map((x) => x.goals.toFixed(1).padStart(5)).join(" ")}   clean ${c.map((x) => x.clean.toFixed(0).padStart(3)).join(" ")}   missed ${c.map((x) => x.miss.toFixed(0).padStart(3)).join(" ")}`);
  }
}
