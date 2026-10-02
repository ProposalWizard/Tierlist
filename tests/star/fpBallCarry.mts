/**
 * THE CARRIED BALL SITS ON THE GRASS AT YOUR BOOT, NOT ON YOUR HIP.
 *
 * Harry, 2 Oct 2026, on the trial's Take Him On: "we gotta get this dribbling
 * screen looking better" — the ball drew on the player's hip. The real cause
 * (firstPersonDribble.ts, CARRY): it sat 1.6 m ahead and dead centre, so its
 * sight line from the C1 camera crossed your body at waist height, inside
 * your drawn arm; and it was painted ON TOP of your body although it is
 * farther away than it.
 *
 * This measures, through the real camera (cameraFor / project) and against
 * the DRAWN body (FP_ANATOMY — shoulders 0.405 m out, arms beyond them, not
 * a slimmer box), for a whole gait cycle, both feet and both camera feels:
 *   - how much of the ball's disc lands on your upper body (shorts, shirt,
 *     arms, head) — before it was painted on top there; now it would be
 *     hidden there, so it must be zero;
 *   - how high up your body the ball's foot sits on screen, as a share of
 *     your height (0 = level with your boots, 0.5 = your hips).
 */
import { cameraFor, project, type FpCamera } from "../../lib/star/firstPersonView";
import { poseFor } from "../../lib/star/dribbleCamera";
import { CARRY, carryLead, OWN_GAIT_M, CALM_CAMERA, LIVELY_CAMERA } from "../../lib/star/firstPersonDribble";
import { FP_ANATOMY } from "../../lib/star/firstPersonRender";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const W = 345 * 2, H = 552 * 2; // the trial's embedded canvas at phone size, 2x pixels
const A = FP_ANATOMY;
const pose = poseFor("C1");

function camFor(side: number): FpCamera {
  const fx = -side, fy = -(pose.look + pose.offset), L = Math.hypot(fx, fy);
  return cameraFor({ x: side, y: pose.offset }, W, H, { eye: pose.eye, pitch: (pose.pitchDeg * Math.PI) / 180, forward: { x: fx / L, y: fy / L } });
}

/** Screen boxes of the drawn upper body (you at the origin, facing -y). */
function upperBody(cam: FpCamera) {
  const box = (xa: number, xb: number, za: number, zb: number) => {
    const ps = [project(cam, xa, 0, za), project(cam, xb, 0, za), project(cam, xa, 0, zb), project(cam, xb, 0, zb)]
      .filter(Boolean) as { px: number; py: number }[];
    return { x0: Math.min(...ps.map((q) => q.px)), x1: Math.max(...ps.map((q) => q.px)), y0: Math.min(...ps.map((q) => q.py)), y1: Math.max(...ps.map((q) => q.py)) };
  };
  const armOut = A.shoulderHalf * 1.04 + 0.05;
  return [
    box(-A.shoulderHalf * 0.75, A.shoulderHalf * 0.75, 0.2147 * A.height, 0.3757 * A.height), // shorts
    box(-A.shoulderHalf, A.shoulderHalf, 0.3435 * A.height, A.shoulderZ),                       // shirt
    box(-armOut, armOut, A.shoulderZ - 0.47, A.shoulderZ),                                      // arms
    box(-0.16, 0.16, A.neckZ, A.height),                                                          // head
  ];
}

/** Share of the ball's disc (sampled) that lands on any of the boxes. */
function onBody(cam: FpCamera, bx: number, lead: number): number {
  const b = project(cam, bx, -lead, 0.11);
  if (!b) return 1;
  const r = 0.11 * b.scale;
  const boxes = upperBody(cam);
  let hit = 0, n = 0;
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const x = b.px + (i / 6) * r, y = b.py + (j / 6) * r;
    if (Math.hypot(x - b.px, y - b.py) > r) continue;
    n++;
    if (boxes.some((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1)) hit++;
  }
  return hit / n;
}

/** How far up your body the ball's foot is on screen (0 boots, 1 crown). */
function heightUpBody(cam: FpCamera, bx: number, lead: number): number {
  const feet = project(cam, 0, 0, 0)!, crown = project(cam, 0, 0, A.height)!;
  const foot = project(cam, bx, -lead, 0)!;
  return (feet.py - foot.py) / (feet.py - crown.py);
}

// ── Before: 1.6 m ahead, dead centre (the C1 pose's own lead), camera leaning right.
const camR = camFor(pose.side);
const beforeOn = onBody(camR, 0, pose.lead);
const beforeUp = heightUpBody(camR, 0, pose.lead);
console.log(`  before: ${(beforeOn * 100).toFixed(0)}% of the ball on your body, its foot ${(beforeUp * 100).toFixed(0)}% of the way up you`);
check(beforeOn > 0.25, "the old placement does put the ball on your body (the complaint, reproduced)");
check(beforeUp > 0.35, "the old placement sits at hip height on screen");

// ── After: a whole gait cycle, the ball on either boot, both camera feels.
let worstOn = 0, worstUp = 0, bestUp = 1;
for (const feel of [LIVELY_CAMERA, CALM_CAMERA]) for (const foot of [1, -1] as const) {
  const cam = camFor(foot * pose.side * feel.sideScale);
  for (let k = 0; k < 40; k++) {
    const stride = (k / 40) * OWN_GAIT_M;
    const lead = carryLead(stride, foot);
    const bx = foot * CARRY.restFootX;
    worstOn = Math.max(worstOn, onBody(cam, bx, lead));
    const up = heightUpBody(cam, bx, lead);
    worstUp = Math.max(worstUp, up); bestUp = Math.min(bestUp, up);
  }
}
console.log(`  after:  at most ${(worstOn * 100).toFixed(0)}% of the ball on your body; its foot ${(bestUp * 100).toFixed(0)}-${(worstUp * 100).toFixed(0)}% of the way up you`);
check(worstOn === 0, "carried at your boot, the ball never lands on your upper body");
check(worstUp < 0.3, "the ball's foot stays below your knees on screen (at your feet, not your hip)");

// The touch: the boot reaches it, then it runs ahead and you close the gap.
const leads = Array.from({ length: 40 }, (_, k) => carryLead((k / 40) * OWN_GAIT_M, 1));
check(Math.min(...leads) >= CARRY.leadMin - 1e-9 && Math.max(...leads) <= CARRY.leadMin + CARRY.push + 1e-9, "the lead stays between touch and push");
check(carryLead(0.75 * OWN_GAIT_M, 1) < carryLead(0.85 * OWN_GAIT_M, 1), "after the right boot's touch the ball runs away from you");
check(carryLead(0, 1, 1) > carryLead(0, 1, 0), "a burst knocks it further on");

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the carried ball sits on the grass at your boot, never on your hip");
