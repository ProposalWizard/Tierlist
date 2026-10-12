/**
 * The 3D match draws a man where the 2D put him, at a man's pace (lib/star/style3d/figureFollow.ts).
 * Harry, 12 Oct 2026: "half teleporting with the ball". Checks: a 2D jump under the cut size is
 * never drawn as one big step; a cut is taken at once; steady running is drawn exactly.
 */
import { followStep, FOLLOW } from "../../lib/star/style3d/figureFollow";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error("  ✗ " + m); } else console.log("  ✓ " + m); };
const dt = 1 / 60;

// steady running at 8 m/s: drawn exactly on the 2D spot
let p = { x: 0, y: 0 }, worstLag = 0;
for (let i = 1; i <= 120; i++) { const t = { x: (8 * i) / 60, y: 0 }; p = followStep(p, t, dt); worstLag = Math.max(worstLag, Math.hypot(t.x - p.x, t.y - p.y)); }
ok(worstLag < 1e-9, `steady 8 m/s run drawn on the 2D spot (lag ${worstLag.toFixed(4)} m)`);

// a 2D jump of 0.5–3.9 m: never drawn as more than FOLLOW.maxSpeed·dt + (snapM − maxLag) in a frame
let worstStep = 0, frames = 0;
for (const jump of [0.5, 1, 2, 3, 3.9]) {
  let q = { x: 0, y: 0 };
  const t = { x: jump, y: 0 };
  for (let i = 0; i < 60; i++) { const n = followStep(q, t, dt); worstStep = Math.max(worstStep, Math.hypot(n.x - q.x, n.y - q.y)); q = n; if (Math.hypot(t.x - q.x, t.y - q.y) < 1e-6) { frames = Math.max(frames, i + 1); break; } }
}
const cap = Math.max(FOLLOW.maxSpeed * dt, FOLLOW.snapM - FOLLOW.maxLag);
ok(worstStep <= cap + 1e-9, `a 2D jump of up to ${FOLLOW.snapM} m is drawn in steps of at most ${cap.toFixed(2)} m (worst ${worstStep.toFixed(2)} m; caught up within ${frames} frames)`);

// a cut (a new chance): at once
const cut = followStep({ x: 0, y: 0 }, { x: 10, y: 0 }, dt);
ok(cut.snapped && cut.x === 10, "a jump over the cut size is taken at once (a new chance)");

// never further behind than maxLag
let r = { x: 0, y: 0 }, lag = 0;
for (let i = 1; i <= 30; i++) { const t = { x: i * 0.9, y: 0 }; r = followStep(r, t, dt); lag = Math.max(lag, Math.hypot(t.x - r.x, t.y - r.y)); }
ok(lag <= FOLLOW.maxLag + 1e-9, `a 54 m/s 2D glitch run: never more than ${FOLLOW.maxLag} m behind (worst ${lag.toFixed(2)} m)`);

if (fails) { console.error(`${fails} failed`); process.exit(1); }
