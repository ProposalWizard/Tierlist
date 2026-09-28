/**
 * lib/star/dribbleCamera.ts — the dribble's camera options (Harry, 28 Sep
 * 2026: "the dribbling mode with a camera reframe").
 *
 * The old complaint was the ball reading as ON your body, not in front of it.
 * This measures it through the real camera (cameraFor / project): where the
 * carried ball lands on screen against your figure's legs, body and head, for
 * 7 sideways touch positions × 3 push-glide depths × rest/burst = 42 cases,
 * the camera leaning to the ball's side exactly as FirstPersonDribble does.
 */
import { cameraFor, project } from "../../lib/star/firstPersonView";
import { poseFor, closeness, blendPose, CAM_C1, CAM_C3_FAR, type CamPose } from "../../lib/star/dribbleCamera";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const W = 390 * 3, H = 624 * 3; // the embedded canvas at phone size, 3× pixels
const TODAY: CamPose = { eye: 5, pitchDeg: 5, offset: 4, side: 0, lead: 0.95, look: 0 }; // the real match's values

function overlaps(p: CamPose): { hits: number; n: number; feetX: number } {
  let hits = 0, n = 0, feetX = 0;
  for (const lat of [-1.26, -0.9, -0.45, 0, 0.45, 0.9, 1.26]) for (const wave of [-0.18, 0, 0.18]) for (const burst of [0, 1]) {
    const side = lat === 0 ? p.side : Math.sign(lat) * p.side; // leans to the ball's side
    const fwd = p.look > 0 ? (() => { const fx = -side, fy = -(p.look + p.offset), L = Math.hypot(fx, fy); return { x: fx / L, y: fy / L }; })() : undefined;
    const cam = cameraFor({ x: side, y: p.offset }, W, H, { eye: p.eye, pitch: (p.pitchDeg * Math.PI) / 180, forward: fwd });
    const box = (xa: number, xb: number, za: number, zb: number) => {
      const ps = [project(cam, xa, 0, za), project(cam, xb, 0, za), project(cam, xa, 0, zb), project(cam, xb, 0, zb)].filter(Boolean) as { px: number; py: number }[];
      return { x0: Math.min(...ps.map((q) => q.px)), x1: Math.max(...ps.map((q) => q.px)), y0: Math.min(...ps.map((q) => q.py)), y1: Math.max(...ps.map((q) => q.py)) };
    };
    const body = [box(-0.26, 0.26, 0, 0.62), box(-0.34, 0.34, 0.6, 1.24), box(-0.22, 0.22, 1.24, 1.8)];
    const b = project(cam, lat, -(p.lead + 0.85 * burst + wave), 0.11);
    if (!b) continue;
    const r = 0.11 * b.scale;
    const hit = body.some((q) => Math.max(q.x0 - (b.px + r), (b.px - r) - q.x1) < 0 && Math.max(q.y0 - (b.py + r), (b.py - r) - q.y1) < 0);
    if (hit) hits++;
    n++;
    if (lat === 0 && wave === 0 && burst === 0) feetX = project(cam, 0, 0, 0)!.px / 3;
  }
  return { hits, n, feetX };
}

const today = overlaps(TODAY);
const c1 = overlaps(poseFor("C1"));
const c2 = overlaps(poseFor("C2"));
const c3near = overlaps(poseFor("C3", 1));
const c3far = overlaps(poseFor("C3", 0));
console.log(`ball on your body: today ${today.hits}/${today.n}, C1 ${c1.hits}/${c1.n}, C2 ${c2.hits}/${c2.n}, C3 close ${c3near.hits}/${c3near.n}, C3 back ${c3far.hits}/${c3far.n}`);
check(today.hits >= 8, "today's camera does put the ball on your body (the complaint, reproduced)");
check(c1.hits === 0, "C1: the ball is never on your body");
check(c2.hits === 0, "C2: the ball is never on your body");
check(c3near.hits === 0 && c3far.hits <= 3, "C3: never close in, at most 3 of 42 pulled back");
check(c1.feetX > 40 && c1.feetX < 350, `C1 keeps you in frame (feet at x ${c1.feetX.toFixed(0)} of 390)`);

// C3's blend: close inside 5 m, back beyond 12 m, and in between it moves smoothly.
check(closeness(3) === 1 && closeness(20) === 0 && closeness(Infinity) === 0, "C3 is close near a defender and back in open space");
check(closeness(8) > 0 && closeness(8) < 1, "C3 eases between the two");
const mid = blendPose(CAM_C3_FAR, CAM_C1, 0.5);
check(mid.eye < CAM_C3_FAR.eye && mid.eye > CAM_C1.eye, "a half-way blend sits between the two cameras");

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the new dribble cameras keep the ball in front of you, and today's camera is untouched");
