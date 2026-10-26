/**
 * ONE SIZE IN METRES ON EVERY CAMERA (Mikey, 26 Oct 2026; lib/star/matchView.ts
 * FIXED_FIGURES). A man must be the same share of the goal's width on every
 * chance: every kind, side-on or upright, zoomed or not, the real moments, and
 * a feature's own close camera. Before: 9% to 27% (game chances), 10% to 23%
 * (real moments). This test fails the build if that comes back.
 *
 * It also reads the source, so a renderer that stops going through
 * figureDivFor (the match's figure and ball sizes, the highlight stills) fails
 * here rather than drifting quietly.
 */
import { readFileSync, existsSync } from "node:fs";
import { buildScenario, SCENARIO_KINDS, type Scenario } from "../../lib/star/canvasEngine";
import {
  frameForNewView, setPlayZoomOverride, playZoomOf, figureShrinkFor, figureDivFor,
  NEW_FIGURE_SCALE, FIXED_FIGURES, FIXED_MAN_M, REFERENCE_CAMERA_M,
} from "../../lib/star/matchView";
import { MATCH_FIGURE_R_MULT, MATCH_FIGURE_HEIGHT_R } from "../../lib/star/fiveASide/render";
import { GOAL_W } from "../../lib/star/pitch";

let fails = 0;
const check = (ok: boolean, what: string) => { if (!ok) { fails++; console.log("  ✗", what); } else console.log("  ✓", what); };
function rng32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const HW = 844 / 390;
const H0 = MATCH_FIGURE_R_MULT * MATCH_FIGURE_HEIGHT_R * NEW_FIGURE_SCALE;
/** The man's drawn height in metres on this chance's camera, the way CanvasMatch sizes him. */
function manMetres(sc: Scenario, tilt = 0): { m: number; across: number } {
  const cam = frameForNewView(sc, HW, false, tilt);
  const k = playZoomOf(sc), across = (sc.facing ?? "up") === "up" ? cam.x2 - cam.x1 : cam.y2 - cam.y1;
  return { m: H0 / figureDivFor(k, figureShrinkFor(sc.kind, across * k)), across };
}

check(FIXED_FIGURES, "the size is fixed in metres");
check(Math.abs(FIXED_MAN_M - 1.63) < 0.01 && REFERENCE_CAMERA_M === 26.8, `a man is ${FIXED_MAN_M.toFixed(2)} m, Mikey's 4-0 build-up size (${(100 * FIXED_MAN_M / GOAL_W).toFixed(0)}% of the goal's width)`);

for (const zoom of ["z2", "off"] as const) {
  setPlayZoomOverride(zoom);
  const ratios: number[] = [], cams: number[] = [];
  for (const kind of SCENARIO_KINDS) for (let s = 1; s <= 40; s++) for (const tilt of [0, 20]) {
    const r = manMetres(buildScenario(kind, rng32(s * 7919 + 11)), tilt);
    ratios.push(r.m / GOAL_W); cams.push(r.across);
  }
  const lo = Math.min(...ratios), hi = Math.max(...ratios);
  check(hi - lo < 1e-9, `Chance framing ${zoom === "z2" ? "Zoom" : "Old"}: man ÷ goal is ${(100 * lo).toFixed(1)}% on all ${ratios.length} chances, cameras ${Math.min(...cams).toFixed(0)} to ${Math.max(...cams).toFixed(0)} m across`);
}
setPlayZoomOverride(null);

// A feature's own close camera (training, the manager's four shots): CanvasMatch
// sizes it with figureShrinkFor(kind, its width) and no Zoom.
{
  const widths = [12, 14, 19, 26, 38, 45];
  const m = widths.map((w) => H0 / figureDivFor(1, figureShrinkFor("long_range", w)));
  check(Math.max(...m) - Math.min(...m) < 1e-9, `feature cameras ${widths[0]} to ${widths[widths.length - 1]} m: the same ${m[0].toFixed(2)} m man`);
}

// The real moments, when their data is here (the same camera code).
{
  const D = "data/realmoments/";
  if (existsSync(D + "tracked.json") && existsSync(D + "tracks.json")) {
    const rm = await import("../../lib/star/fhr/realMomentHighlights");
    rm.setRealMomentPool(rm.buildRealMomentPool(JSON.parse(readFileSync(D + "tracked.json", "utf8")), JSON.parse(readFileSync(D + "tracks.json", "utf8"))));
    setPlayZoomOverride("z2");
    const ratios: number[] = [];
    for (const kind of SCENARIO_KINDS) for (let s = 1; s <= 20; s++) {
      const m = rm.serveRealMoment(kind, rng32(s * 31 + 7), { force: true });
      if (m) ratios.push(manMetres(m.sc).m / GOAL_W);
    }
    setPlayZoomOverride(null);
    check(ratios.length > 0 && Math.max(...ratios) - Math.min(...ratios) < 1e-9, `real moments: the same ${(100 * (ratios[0] ?? 0)).toFixed(1)}% on all ${ratios.length}`);
  } else console.log("  · real moments: data not here, skipped");
}

// Every renderer goes through figureDivFor.
{
  const cm = readFileSync("components/star/CanvasMatch.tsx", "utf8");
  check(/const figZoomDiv = \(\) => figureDivFor\(/.test(cm), "the match sizes men and ball through figureDivFor");
  const uses = (cm.match(/\/ \(nv \? figZoomDiv\(\) : 1\)\) \* MATCH_FIGURE_R_MULT/g) ?? []).length;
  check(uses >= 2, `both of the match's figure-size lines divide by figZoomDiv (${uses} found)`);
  const balls = (cm.match(/\(unit \/ figZoomDiv\(\)\) \* 0\.5 \* NEW_BALL_SCALE/g) ?? []).length;
  check(balls >= 2, `both ball-size lines divide by figZoomDiv (${balls} found)`);
  const st = readFileSync("lib/star/fhr/stillCamera.ts", "utf8");
  check(/figureDivFor\(/.test(st), "the highlight stills size men through figureDivFor");
}

if (fails) { console.log(`FAIL (${fails})`); process.exit(1); }
console.log("PASS — a man is the same size next to the goal on every camera");
