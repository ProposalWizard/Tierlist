import { buildScenario, initDefenders, SCENARIO_KINDS, type Scenario, type Viewport, type Facing } from "../../lib/star/canvasEngine";
import { frameForNewView, keyPointsOf, NEW_VIEW_MAX_HW, NEW_VIEW_MIN_HW } from "../../lib/star/matchView";
import { CAMERA_TILT_DEFAULT, tiltFor, canvasToScreen, screenToCanvas, visibleOnScreen } from "../../lib/star/cameraTilt";

/**
 * THE CAMERA ANGLE (lib/star/cameraTilt.ts). Harry, 3 Oct 2026: "20 degrees
 * should be the base".
 * - touch goes through the exact inverse of the tilt;
 * - flat is the identity;
 * - the tipped picture still fills the screen's top edge;
 * - the ball, you, the pass target, the keeper and both posts stay on screen
 *   for every kind at 20° and 30°, on every phone shape.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
function mulberry32(a: number) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
check(CAMERA_TILT_DEFAULT === 20, "20° is the default");
check(tiltFor(0, 360, 700) === null, "flat is no tilt");

const W = 362;
for (const hw of [NEW_VIEW_MAX_HW, 1.85, NEW_VIEW_MIN_HW]) {
  for (const deg of [20, 30]) {
    const H = W * hw, t = tiltFor(deg, W, H)!;
    // The exact inverse.
    let worst = 0;
    const rng = mulberry32(deg);
    for (let i = 0; i < 2000; i++) {
      const sx = rng() * 1.4 - 0.2, sy = rng() * 1.4 - 0.2;
      const p = canvasToScreen(t, sx, sy, W, H), q = screenToCanvas(t, p.X, p.Y, W, H);
      worst = Math.max(worst, Math.abs(q.sx - sx) + Math.abs(q.sy - sy));
    }
    check(worst < 1e-9, `${deg}° hw ${hw}: inverse off by ${worst}`);
    // The top edge still fills the screen.
    const tl = canvasToScreen(t, 0, 0, W, H), tr = canvasToScreen(t, 1, 0, W, H);
    check(tl.X <= 1e-6 && tr.X >= W - 1e-6 && tl.Y <= 1e-6, `${deg}° hw ${hw}: the top of the picture leaves a gap`);
    // Everything that matters stays on screen.
    let off = 0, n = 0;
    for (const kind of SCENARIO_KINDS) for (let s = 0; s < 80; s++) {
      const r = mulberry32(s * 31 + kind.length);
      const sc: Scenario = buildScenario(kind, r, 60, 60, 60); initDefenders(sc, r);
      const cam: Viewport = frameForNewView(sc, hw, false, deg);
      const f: Facing = sc.facing ?? "up";
      for (const p of keyPointsOf(sc)) {
        const fx = (p.x - cam.x1) / (cam.x2 - cam.x1), fy = (p.y - cam.y1) / (cam.y2 - cam.y1);
        const c = f === "right" ? { sx: 1 - fy, sy: fx } : f === "left" ? { sx: fy, sy: 1 - fx } : { sx: fx, sy: fy };
        n++;
        if (!visibleOnScreen(t, c.sx, c.sy)) { off++; if (off < 4) problems.push(`${deg}° hw ${hw}: ${kind} seed ${s} has something off screen`); }
      }
    }
    check(off === 0, `${deg}° hw ${hw}: ${off}/${n} key points off screen`);
  }
}
if (problems.length) { console.error(problems.slice(0, 20).join("\n")); process.exit(1); }
console.log("cameraTilt: exact inverse, top filled, ball/you/target/keeper/posts on screen at 20° and 30°");
