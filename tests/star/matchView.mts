import { goalInView } from "../../lib/star/canvasEngine";
import { buildScenario, initDefenders, SCENARIO_KINDS, type Scenario } from "../../lib/star/canvasEngine";
import { PITCH_W } from "../../lib/star/pitch";
import {
  cameraFor, passersOf, frameForNewView, engineFrameOf, newViewCanvasHeight,
  NEW_VIEW_WIDTH_M, NEW_VIEW_KIND_WIDTH_M, NEW_VIEW_MAX_HW, NEW_VIEW_MIN_HW, MATCH_VIEW_DEFAULT,
} from "../../lib/star/matchView";

/**
 * THE NEW MATCH VIEW'S CAMERA (lib/star/matchView.ts, option D, 3 Oct 2026).
 *
 * - it holds the canvas's shape (same metres per pixel both ways);
 * - each kind has its own zoom (Harry, 3 Oct 2026): long range the full
 *   38 m, the box chances tighter, build-up fitted to the passers;
 * - a shot's camera always contains the frame the engine built the chance in,
 *   so nobody the engine placed is off the screen; a build-up camera holds
 *   the ball, you, every man you can pass to and defenders in those lanes;
 * - the play area is never smaller than the engine's frame (Classic's out
 *   line), so a tighter camera never makes a ball go out sooner;
 * - side-on (corners, byline crosses) it never shows more than a few metres
 *   of grass past either touchline — the "28 m past the touchline" picture
 *   the prototype warned about;
 * - framing twice is the same as framing once (a touch-on reuses its chance).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

check(MATCH_VIEW_DEFAULT === "new", "the new view is the default");

const EPS = 1e-6;
const contains = (a: { x1: number; x2: number; y1: number; y2: number }, b: typeof a) =>
  a.x1 <= b.x1 + EPS && a.x2 >= b.x2 - EPS && a.y1 <= b.y1 + EPS && a.y2 >= b.y2 - EPS;

for (const hw of [NEW_VIEW_MAX_HW, 1.87, NEW_VIEW_MIN_HW]) {
  let worstFar = 0, worstNear = 0, notContained = 0, n = 0;
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 0; seed < 150; seed++) {
      const rng = mulberry32(seed * 31 + kind.length);
      const sc: Scenario = buildScenario(kind, rng, 60, 60, 60);
      initDefenders(sc, rng);
      const engine = { ...sc.viewport };
      const f = sc.facing ?? "up";
      const cam = cameraFor(sc, engine, hw);
      n++;
      const across = f === "up" ? cam.x2 - cam.x1 : cam.y2 - cam.y1;
      const down = f === "up" ? cam.y2 - cam.y1 : cam.x2 - cam.x1;
      const want = NEW_VIEW_KIND_WIDTH_M[kind];
      if (want === "passers") {
        check(across >= 22 - EPS && across <= NEW_VIEW_WIDTH_M + EPS, `${kind}: ${across} m across`);
        for (const p of passersOf(sc)) {
          if (p.x < cam.x1 - EPS || p.x > cam.x2 + EPS || p.y < cam.y1 - EPS || p.y > cam.y2 + EPS) {
            // Only the full zoom may fail to hold everyone.
            check(across >= NEW_VIEW_WIDTH_M - EPS, `${kind}: a passer is off a ${across.toFixed(1)} m camera`);
          }
        }
      } else {
        check(across >= want - EPS && across <= NEW_VIEW_WIDTH_M + EPS, `${kind}: ${across} m across, wanted ${want}`);
        // Past the engine's own hard out line (2 m off a touchline) there is nothing to hold.
        const onPitch = { ...engine, x1: Math.max(engine.x1, -2), x2: Math.min(engine.x2, PITCH_W + 2) };
        if (!contains(cam, onPitch)) notContained++;
      }
      if (kind === "long_range") check(Math.abs(across - NEW_VIEW_WIDTH_M) < 1e-6, "long range is the full zoom out");
      check(Math.abs(down / across - Math.max(hw, NEW_VIEW_MIN_HW)) < 1e-6, `${kind}: shape ${down / across} vs ${hw}`);
      if (f !== "up") {
        const ballLow = f === "right" ? sc.ball.x > PITCH_W / 2 : sc.ball.x < PITCH_W / 2;
        const nearLine = ballLow ? (f === "right" ? cam.x2 - PITCH_W : 0 - cam.x1) : 0;
        const farLine = f === "right" ? 0 - cam.x1 : cam.x2 - PITCH_W;
        worstNear = Math.max(worstNear, nearLine);
        worstFar = Math.max(worstFar, farLine);
      }
      // Framing twice is framing once.
      const a = frameForNewView(sc, hw);
      const b = frameForNewView(sc, hw);
      check(JSON.stringify(a) === JSON.stringify(b), `${kind}: framing is not stable`);
      check(JSON.stringify(engineFrameOf(sc)) === JSON.stringify(engine), `${kind}: engine frame lost`);
      // Never smaller than the engine's frame, and holds the whole camera.
      check(contains(sc.viewport, { ...engine, y1: sc.viewport.y1, x1: f === "right" ? sc.viewport.x1 : engine.x1, x2: f === "left" ? sc.viewport.x2 : engine.x2 }),
        `${kind}: play area smaller than the engine frame`);
      if (goalInView(kind)) check(contains(sc.viewport, a), `${kind}: play area smaller than the camera`);
      else {
        // No keeper, no back line: the ball must go out before it reaches the goal.
        const goalSide = f === "up" ? sc.viewport.y1 : f === "right" ? sc.viewport.x1 : -sc.viewport.x2;
        const engineSide = f === "up" ? engine.y1 : f === "right" ? engine.x1 : -engine.x2;
        check(goalSide >= engineSide - EPS, `${kind}: play area reaches past the engine frame toward an empty goal`);
        check(f !== "up" || sc.viewport.y1 > 0.5, `${kind}: play area reaches the goal line`);
        // The screen IS the play area: no out line in the middle of the grass
        // (playtest, 3 Oct 2026: the ball "stops" at an invisible line).
        if (f === "up") check(contains(a, sc.viewport) && contains(sc.viewport, a), `${kind}: the play area is not the screen`);
      }
    }
  }
  check(notContained === 0, `hw ${hw}: ${notContained}/${n} cameras miss part of the engine frame`);
  check(worstFar <= 7.5 + EPS, `hw ${hw}: ${worstFar.toFixed(1)} m of grass past the far touchline`);
  check(worstNear <= 8 + EPS, `hw ${hw}: ${worstNear.toFixed(1)} m of grass past the near touchline`);
}

// The canvas height: between 5:8 and 38 × 83, and the room it is given.
check(newViewCanvasHeight(366, 10000) === Math.round(366 * NEW_VIEW_MAX_HW), "tall phone: option D's height");
check(newViewCanvasHeight(366, 200) === Math.round(366 * NEW_VIEW_MIN_HW), "short screen: never under 5:8");
check(newViewCanvasHeight(366, 700) === 700, "fills the room it has");

if (problems.length) {
  console.error(problems.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log("matchView: per-kind zoom, camera holds its shape and the engine frame, play area never under Classic, side-on stays on the pitch");
