/**
 * THE MAN ON THE BALL IN THE 3D MATCH (lib/star/style3d/setPiece3d.ts).
 * Harry, 12 Oct 2026: "why is he just stood next to the ball". Checks:
 *  - a corner / open-play stance is BEHIND the ball in the shot's direction (never beside it);
 *  - the run-up clip is timed off the 2D's run-up clock: it reaches its held backswing exactly
 *    when the 2D's run-up ends, never earlier, and only moves forward in time;
 *  - the blend onto the foot-on-ball spot goes 0 → 1 over the same stretch.
 */
import { shotTarget, stanceFor, stanceSpot, runClipTime, runBlend, SET_PIECE_3D } from "../../lib/star/style3d/setPiece3d";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error("  ✗ " + m); } else console.log("  ✓ " + m); };

// stances, all over the pitch, both feet, corner and open play
let n = 0, worstDeg = 0, wrongSide = 0;
for (const kind of ["one_on_one", "long_range", "corner"]) {
  for (let x = 2; x <= 66; x += 4) for (let y = 2; y <= 40; y += 4) for (const foot of [1, -1]) {
    const ball = { x, y };
    const target = shotTarget(kind, null, ball);
    const st = stanceFor(kind, ball, target, foot);
    const dx = target.x - ball.x, dy = target.y - ball.y, L = Math.hypot(dx, dy);
    if (L < 1) continue;
    const bx = st.x - ball.x, by = st.y - ball.y, B = Math.hypot(bx, by);
    // angle between "straight back" and the stance, degrees
    const deg = (Math.acos(Math.max(-1, Math.min(1, -(bx * dx + by * dy) / (B * L)))) * 180) / Math.PI;
    worstDeg = Math.max(worstDeg, deg);
    // a right-footer stands to his left of the line (penaltyRunup.ts's sideOf), a left-footer to his right
    const cross = (dx * by - dy * bx) / (L * B); // + = to the right of a man facing the target? sign checked below
    const right = stanceSpot(ball, target, 1, 30, 1), left = stanceSpot(ball, target, 1, 30, -1);
    const crossR = (dx * (right.y - ball.y) - dy * (right.x - ball.x)), crossL = (dx * (left.y - ball.y) - dy * (left.x - ball.x));
    if (Math.sign(crossR) === Math.sign(crossL) || Math.sign(cross) !== Math.sign(foot > 0 ? crossR : crossL)) wrongSide++;
    n++;
  }
}
ok(n > 500, `${n} stances checked`);
ok(worstDeg <= Math.max(SET_PIECE_3D.cornerAngleDeg, SET_PIECE_3D.openAngleDeg) + 0.01, `every stance is behind the ball, at most ${worstDeg.toFixed(1)}° off the line straight back (beside would be 90°)`);
ok(wrongSide === 0, `a right-footer and a left-footer stand on opposite sides of the line (${wrongSide} wrong)`);
const o = stanceFor("one_on_one", { x: 30, y: 20 }, { x: 34, y: 0 }, 1);
ok(Math.abs(Math.hypot(o.x - 30, o.y - 20) - SET_PIECE_3D.openBack) < 1e-9, `open play: ${SET_PIECE_3D.openBack} m back`);
const aimT = shotTarget("one_on_one", { from: { x: 30, y: 20 }, to: { x: 25, y: 18 } }, { x: 30, y: 20 });
ok(Math.abs(aimT.x - 25) < 1e-9 && Math.abs(aimT.y - 18) < 1e-9, "with an aim arrow, the stance follows the arrow");

// the run-up clip timing, for every run-up length the styles use
let bad = 0;
for (const runS of [2.3, 2.4, 2.5, 3.0, 3.1]) for (const hold of [0.9, 1.15, 1.3]) {
  let last = -1;
  for (let t = 0; t <= runS + 0.5; t += 1 / 60) {
    const ct = runClipTime(runS, t, hold), w = runBlend(runS, t, hold);
    if (ct !== null) { if (ct < last - 1e-9 || ct > hold + 1e-9) bad++; last = ct; }
    if (w < 0 || w > 1) bad++;
    if (t >= runS && (ct === null || Math.abs(ct - hold) > 1e-9 || Math.abs(w - 1) > 1e-9)) bad++;
    if (runS - t > Math.min(hold, SET_PIECE_3D.maxRunClipS) + 1e-9 && (ct !== null || w !== 0)) bad++;
  }
}
ok(bad === 0, `the run-up clip lands on its held backswing exactly when the 2D's run-up ends, and only runs forward (${bad} bad samples)`);

if (fails) { console.error(`${fails} failed`); process.exit(1); }
