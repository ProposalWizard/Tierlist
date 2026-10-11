/**
 * tests/star/emptyGrass.mts — the camera fits the play, not a huge empty pitch.
 *
 * Harry, 11 Oct 2026: "the camera view where it shows a huge area of the
 * pitch where no one's at — yeah that's just bugged". Leo: it happens as a
 * real match chance opens.
 *
 * The cause: a man a chance does not use is parked at (-400, 400), "off the
 * picture" (authoredChance.ts OFF_THE_PICTURE). A drawing with no poacher
 * parks the follower there, and so does EVERY Kane drawing. matchView's zoom
 * counted him as a man to keep on screen, could not fit a man 400 m away,
 * and gave up: the kind's widest camera, people in the top quarter.
 *
 * Measured on the phone's glass (390 px, 20° tilt, Zoom on), before → after:
 *   Kane one-on-ones: people cover 11% → 51% of the screen,
 *                     grass below them 66% → 23%
 *   Kane long range:  15% → 58%;   drawn one-on-ones with a parked
 *   poacher: zoom 1.00 → ~1.5.
 *
 *  1. A parked man is not a body to frame (bodiesOf / keyPointsOf).
 *  2. A one-on-one with a parked follower still zooms in.
 *  3. Kane drawings: the people fill the screen (fails 100% on the old code).
 *  4. The extra glass fit (fitToPlay) never cuts anybody off the glass.
 */
import { readFileSync } from "node:fs";
import { buildScenario, goalInView, type Scenario, type Viewport } from "../../lib/star/canvasEngine";
import { POST_L, POST_R } from "../../lib/star/pitch";
import { mulberry32 } from "../../lib/star/season";
import { makeChance } from "../../lib/star/chanceMaker";
import { setKaneMoments, kaneMomentsReady } from "../../lib/star/kaneMoments";
import {
  frameForNewView, setPlayZoomOverride, playZoomOf, bodiesOf, keyPointsOf, onThePitch,
} from "../../lib/star/matchView";
import { tiltFor, canvasToScreen, visibleOnScreen } from "../../lib/star/cameraTilt";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const HW = 686 / 366;
const TILT = 20;
const PARKED = { x: -400, y: 400 };

/** Share of the glass the people (and the goal) cover, and the empty grass below them. */
function onGlass(sc: Scenario, cam: Viewport) {
  const t = tiltFor(TILT, 1, HW);
  const pts = [...bodiesOf(sc)];
  if (goalInView(sc.kind)) pts.push({ x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 });
  const f = pts.map((p) => {
    const sx = (p.x - cam.x1) / (cam.x2 - cam.x1), sy = (p.y - cam.y1) / (cam.y2 - cam.y1);
    const s = canvasToScreen(t, sx, sy, 1, HW);
    return { x: Math.min(1, Math.max(0, s.X)), y: Math.min(1, Math.max(0, s.Y / HW)) };
  });
  const x1 = Math.min(...f.map((c) => c.x)), x2 = Math.max(...f.map((c) => c.x));
  const y1 = Math.min(...f.map((c) => c.y)), y2 = Math.max(...f.map((c) => c.y));
  return { area: (x2 - x1) * (y2 - y1), below: 1 - y2 };
}

setPlayZoomOverride("z2");

console.log("\n1. A PARKED MAN IS NOT A BODY TO FRAME");
{
  const sc = buildScenario("one_on_one", mulberry32(7));
  sc.follower.x = PARKED.x; sc.follower.y = PARKED.y;
  ok(!onThePitch(PARKED), "(-400, 400) is off the pitch");
  ok(bodiesOf(sc).every(onThePitch), "bodiesOf leaves the parked follower out");
  sc.keeper.x = PARKED.x; sc.keeper.y = PARKED.y;
  ok(keyPointsOf(sc).every(onThePitch), "keyPointsOf leaves a taken-off keeper out");
}

console.log("\n2. A ONE-ON-ONE WITH A PARKED POACHER STILL ZOOMS IN");
{
  let n = 0, zoomed = 0;
  for (let i = 0; i < 60; i++) {
    const sc = buildScenario("one_on_one", mulberry32(100 + i * 31));
    const free = buildScenario("one_on_one", mulberry32(100 + i * 31));
    sc.follower.x = PARKED.x; sc.follower.y = PARKED.y;
    frameForNewView(free, HW, false, TILT);
    frameForNewView(sc, HW, false, TILT);
    n++;
    // The poacher is one man; without him the camera is never wider than with him.
    if (playZoomOf(sc) >= playZoomOf(free) - 1e-9 && playZoomOf(sc) > 1.001) zoomed++;
  }
  ok(zoomed === n, `parked poacher: zoomed in ${zoomed}/${n} (old code: 0 — the zoom gave up)`);
}

console.log("\n3. KANE DRAWINGS: THE PEOPLE FILL THE SCREEN");
setKaneMoments(JSON.parse(readFileSync(new URL("../../public/star/kane-moments.json", import.meta.url), "utf8")).moments);
for (const kind of ["one_on_one", "long_range", "through_ball", "tight_angle"] as const) {
  const areas: number[] = [], below: number[] = [];
  for (let i = 0; i < 60; i++) {
    const made = makeChance({ source: { from: "kind", kind }, rng: mulberry32(1000 + i * 7919), memory: null, kaneDrawings: kaneMomentsReady() });
    const sc = made.sc;
    const cam = frameForNewView(sc, HW, false, TILT);
    const m = onGlass(sc, cam);
    areas.push(m.area); below.push(m.below);
  }
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const thin = areas.filter((a) => a < 0.35).length / areas.length;
  // Old code: one-on-one 100% thin, 66% below; long range 100% thin, 61% below.
  ok(thin <= 0.25 && mean(below) <= 0.4,
    `${kind}: people cover under 35% of the screen in ${(thin * 100).toFixed(0)}% (≤ 25%), grass below them ${(mean(below) * 100).toFixed(0)}% (≤ 40%)`);
}

console.log("\n4. THE GLASS FIT CUTS NOBODY OFF");
{
  const t = tiltFor(TILT, 1, HW);
  let cut = 0, n = 0;
  for (const kind of ["one_on_one", "tight_angle", "cutback", "through_ball", "long_range", "free_kick", "penalty"] as const) {
    for (let i = 0; i < 40; i++) {
      const sc = makeChance({ source: { from: "kind", kind }, rng: mulberry32(5000 + i * 7919), memory: null, kaneDrawings: null }).sc;
      const cam = frameForNewView(sc, HW, false, TILT);
      if (playZoomOf(sc) <= 1.001) continue;
      n++;
      for (const p of keyPointsOf(sc)) {
        const sx = (p.x - cam.x1) / (cam.x2 - cam.x1), sy = (p.y - cam.y1) / (cam.y2 - cam.y1);
        if (!visibleOnScreen(t, sx, sy, 0)) { cut++; break; }
      }
    }
  }
  ok(n > 100 && cut === 0, `zoomed chances with a man, post or keeper off the glass: ${cut} of ${n}`);
}
setPlayZoomOverride(null);

if (failed) { console.error(`\nemptyGrass: ${failed} failed`); process.exit(1); }
console.log("\nemptyGrass: all passed");
