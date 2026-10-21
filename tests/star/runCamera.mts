/**
 * B14b — the camera through your run (lib/star/runCamera.ts). Harry, 21 Oct
 * 2026: keep the chance's framing through the run, follow the run, widen only
 * when the ball comes back and only as much as needed, never jump, men the
 * same size.
 */
import { panToKeep, followStep, widenToHold, holds, easeCam, BACK_EASE_S, RUN_CAM_MAX_MS } from "../../lib/star/runCamera";
import type { Viewport } from "../../lib/star/canvasEngine";

let fails = 0;
function check(label: string, ok: boolean, got?: unknown) {
  if (!ok) { fails++; console.log(`FAIL ${label}`, got ?? ""); } else console.log(`ok   ${label}`);
}
const W = (v: Viewport) => v.x2 - v.x1, H = (v: Viewport) => v.y2 - v.y1;
// The real long-range camera measured at 390x844 (366 x 744 px canvas).
const CAM: Viewport = { x1: 7.87, x2: 41.2, y1: -3.8, y2: 63.96 };
const PX = 366 / W(CAM);
const AREA: Viewport = { x1: 0, x2: 68, y1: -5, y2: 80 };
const POSTS = [{ x: 30.34, y: 0 }, { x: 37.66, y: 0 }];

// 1. The run: pans, never zooms.
const p1 = panToKeep(CAM, [{ x: 45, y: 30 }], AREA);
check("you near the right edge: it pans right", p1.x2 > CAM.x2);
check("…the same size (men stay their size)", Math.abs(W(p1) - W(CAM)) < 1e-9 && Math.abs(H(p1) - H(CAM)) < 1e-9);
check("you well inside: it does not move", panToKeep(CAM, [{ x: 24, y: 30 }], AREA) === CAM || JSON.stringify(panToKeep(CAM, [{ x: 24, y: 30 }], AREA)) === JSON.stringify(CAM));
const p2 = panToKeep(CAM, [{ x: 70, y: 30 }], AREA);
check("never past the play area", p2.x2 <= AREA.x2 + 1e-9);
// The follow, 60 fps, a man sprinting 7.9 m/s across: the most it moves a frame.
let cam = CAM, worst = 0;
for (let i = 0; i < 180; i++) {
  const you = { x: 24 + 7.9 * (i / 60), y: 30 };
  const nx = followStep(cam, panToKeep(cam, [you], AREA), 1 / 60);
  worst = Math.max(worst, Math.hypot((nx.x1 - cam.x1) * PX, (nx.y1 - cam.y1) * PX));
  cam = nx;
}
console.log(`  follow at 60 fps: at most ${worst.toFixed(2)} px a frame (cap ${(RUN_CAM_MAX_MS / 60 * PX).toFixed(2)} px)`);
check("the follow is a pan, never a jump (≤ its speed cap a frame)", worst <= RUN_CAM_MAX_MS / 60 * PX + 1e-6);

// 2. The ball back.
check("you, the ball and the goal already in: the camera stays (zero move)", widenToHold(CAM, [{ x: 20, y: 30 }, { x: 22, y: 28 }, ...POSTS]) === CAM);
const far = [{ x: 4, y: 40 }, { x: 5, y: 41 }, ...POSTS];
const to = widenToHold(CAM, far);
check("someone outside: it widens until all are in", holds(to, far, 1.4));
check("…keeping the picture's shape", Math.abs(W(to) / H(to) - W(CAM) / H(CAM)) < 1e-9);
check("…only as much as needed (≤ 15% here)", W(to) / W(CAM) < 1.15, W(to) / W(CAM));
// The ease: first frame = the run's last camera (no cut), per-frame steps small.
const f0 = easeCam(CAM, to, 0);
check("the first frame after the ball back IS the run's last camera (0 px)", JSON.stringify(f0) === JSON.stringify(CAM));
let prev = f0, worstE = 0;
for (let t = 1 / 60; t <= BACK_EASE_S + 1e-9; t += 1 / 60) {
  const v = easeCam(CAM, to, t / BACK_EASE_S);
  worstE = Math.max(worstE, Math.abs(v.x1 - prev.x1) * PX, Math.abs(v.x2 - prev.x2) * PX, Math.abs(v.y1 - prev.y1) * PX, Math.abs(v.y2 - prev.y2) * PX);
  prev = v;
}
console.log(`  the widen: ${(W(to) / W(CAM)).toFixed(3)}× over ${BACK_EASE_S} s, at most ${worstE.toFixed(2)} px of edge a frame`);
check("the widen eases (no edge moves more than 3 px a frame)", worstE < 3);
// Men the same size through the widen: zoom0 * W(from) / W(now) keeps unit/zoom fixed.
const fig = (v: Viewport, zoom: number) => (366 / W(v)) / zoom;
const z0 = 1.14, mid = easeCam(CAM, to, 0.5);
check("the men stay their size through the widen", Math.abs(fig(mid, z0 * W(CAM) / W(mid)) - fig(CAM, z0)) < 1e-9);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
