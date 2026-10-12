// Man-to-goal size on the phone: real life, the 2D view, and the 3D camera at each
// fixed scale option (MATCH_SCALES in lib/star/style3d/match2dCam.ts). Real chances
// (tests/star/match2dCam.mts chanceFor: the engine's own buildScenario, framed as
// CanvasMatch frames them). Usage: npx tsx scripts/cam3d/scale.mts
import { chanceFor } from "../../tests/star/match2dCam.mts";
import { SCENARIO_KINDS } from "../../lib/star/canvasEngine";
import { bcProject } from "../../lib/star/style3d/broadcastCam";
import { solveMatch2D, leanedManShare, leanFor, pitchTo2dScreen, MATCH_SCALES, type MatchScale } from "../../lib/star/style3d/match2dCam";

const W = 372, H = 704;
const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
export function measure(kind: string, seed: number, s: MatchScale) {
  const c = chanceFor(kind, seed);
  const cam = solveMatch2D(c.f);
  const lean = s.lean ? leanFor(cam.elevDeg) : 0;
  const man = leanedManShare(cam, W, H, c.sc.ball, 1.8 * s.man, lean) * H;
  const keeper = leanedManShare(cam, W, H, { x: c.keeper.x, y: c.keeper.y }, 1.8 * s.keeper, lean) * H;
  const gH = (bcProject(cam, W, H, { x: 34, y: 0 }).fr - bcProject(cam, W, H, { x: 34, y: 0, z: 2.44 * s.goal }).fr) * H;
  const gW = Math.abs(bcProject(cam, W, H, { x: 34 + 3.66 * s.goal, y: 0 }).nx - bcProject(cam, W, H, { x: 34 - 3.66 * s.goal, y: 0 }).nx) * W / 2;
  // the 2D: the same frame, true-height goal and men drawn upright (1.847 m)
  const v = c.f.viewport, turned = c.f.facing !== "up";
  const unit = turned ? H / (v.x2 - v.x1) : W / (v.x2 - v.x1);
  const tk = c.f.tilt ? c.f.tilt.s * c.f.tilt.cos : 1;
  const man2 = 1.847 * unit * tk, gH2 = 2.44 * unit * tk;
  const p1 = pitchTo2dScreen(c.f, { x: 30.34, y: 0 }), p2 = pitchTo2dScreen(c.f, { x: 37.66, y: 0 });
  const gW2 = Math.hypot(p1.X - p2.X, p1.Y - p2.Y);
  return {
    kind, seed, gv: c.gv, elev: cam.elevDeg, manPct: (100 * man) / H, keeperPct: (100 * keeper) / H,
    manToGoalH: man / gH, keeperToGoalH: keeper / gH, manToGoalW: man / gW,
    d2: { manPct: (100 * man2) / H, manToGoalH: man2 / gH2, manToGoalW: man2 / gW2 },
  };
}
const isMain = process.argv[1]?.includes("scale.mts");
if (isMain) {
  console.log(`real life: man/goal height ${(1.8 / 2.44).toFixed(2)}, man/goal width ${(1.8 / 7.32).toFixed(2)}`);
  for (const [name, s] of Object.entries(MATCH_SCALES)) {
    const rows = SCENARIO_KINDS.flatMap((k) => [1, 2, 3, 4, 5, 6].map((sd) => measure(k, sd, s)));
    const g = rows.filter((r) => r.gv);
    const m = rows.map((r) => r.manPct);
    console.log(`${name.padEnd(8)} man ${s.man}x keeper ${s.keeper}x goal ${s.goal}x lean ${s.lean ? "on" : "off"} | man % of screen p10 ${pct(m, 0.1).toFixed(1)} median ${pct(m, 0.5).toFixed(1)} p90 ${pct(m, 0.9).toFixed(1)} | median man/goal height ${pct(g.map((r) => r.manToGoalH), 0.5).toFixed(2)}, keeper/goal height ${pct(g.map((r) => r.keeperToGoalH), 0.5).toFixed(2)}, man/goal width ${pct(g.map((r) => r.manToGoalW), 0.5).toFixed(2)}`);
    for (const k of ["penalty", "one_on_one", "corner"]) {
      const r = measure(k, 1, s);
      console.log(`   ${k.padEnd(11)} man ${r.manPct.toFixed(1)}%  keeper ${r.keeperPct.toFixed(1)}%  man/goalH ${r.manToGoalH.toFixed(2)}  keeper/goalH ${r.keeperToGoalH.toFixed(2)}  man/goalW ${r.manToGoalW.toFixed(2)}`);
    }
  }
  const d = SCENARIO_KINDS.flatMap((k) => [1, 2, 3, 4, 5, 6].map((sd) => measure(k, sd, MATCH_SCALES.current))).filter((r) => r.gv);
  console.log(`2D view: man % median ${pct(d.map((r) => r.d2.manPct), 0.5).toFixed(1)}, man/goal height ${pct(d.map((r) => r.d2.manToGoalH), 0.5).toFixed(2)}, man/goal width ${pct(d.map((r) => r.d2.manToGoalW), 0.5).toFixed(2)}`);
  for (const k of ["penalty", "one_on_one", "corner"]) {
    const r = measure(k, 1, MATCH_SCALES.current);
    console.log(`   2D ${k.padEnd(11)} man ${r.d2.manPct.toFixed(1)}%  man/goalH ${r.d2.manToGoalH.toFixed(2)}  man/goalW ${r.d2.manToGoalW.toFixed(2)}`);
  }
}
