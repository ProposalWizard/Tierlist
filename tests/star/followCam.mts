import {
  FOLLOW_CAM_D, FOLLOW_CAM_FAR, FOLLOW_HEAD_Y, FOLLOW_MIN_DIST, FollowBoom, FollowCarry, boxRoom, capOnLine, followFade, riseForMin, settledArrival, zoomedFollowCam,
} from "../../lib/star/three3d/followCam";

/**
 * CAMERA D, THE WALKING CAMERA OF EVERY 3D AREA (Harry, 20 Nov 2026: "D is good and
 * should be the base for all 3D areas"; "should camera D go into the real game?" "yes").
 * The doorway jam: just through a door the wall stood right behind him and the camera
 * slid onto the back of his head. Walked here in a house-sized room, frame by frame,
 * the way home3d/scene.ts places it: the camera never leaves the room, never comes
 * nearer his head than FOLLOW_MIN_DIST while the ceiling allows, and never jumps.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// the pure parts
{
  // entering by a south door of a 6 x 6 m room: he starts far enough in that the whole boom fits behind him
  const door = { x: 0, z: 3, nx: 0, nz: -1 };
  const a = settledArrival(door, (x, z) => Math.abs(x) < 2.4 && Math.abs(z) < 2.4);
  check(!!a && 3 - a.z >= FOLLOW_CAM_D.back, `settled arrival: the boom fits behind him (${a ? (3 - a.z).toFixed(2) : "none"} m in)`);
  check(!!a && Math.abs(a.yaw - Math.PI) < 1e-9, "settled arrival: facing into the room");
  check(settledArrival(door, () => false) === null, "settled arrival: no clear spot, none (the caller keeps its own)");
}
check(Math.abs(boxRoom(0, 0, 0, 1, -3, 3, -3, 3) - 3) < 1e-9, "boxRoom: 3 m to the wall straight behind");
check(boxRoom(0, 3.2, 0, 1, -3, 3, -3, 3) === 0, "boxRoom: outside the box, no room");
check(boxRoom(0, 0, 0, 1, -3, 3, -3, 3, 2) === 2, "boxRoom: capped at what was asked");
{
  const b = new FollowBoom();
  check(b.step(2.5, 9, 1 / 30) === 2.5, "boom: first step is the full boom");
  const l = b.step(2.5, 1.0, 1 / 30);
  check(l <= 1.0 + 1e-9, "boom: never past a wall that came in");
  b.reset(); b.step(2.5, 1.0, 1 / 30);
  const out = b.step(2.5, 9, 1 / 30);
  check(out > 1.0 && out < 1.2, `boom: eases back out slowly, not a snap (${out.toFixed(2)})`);
}
check(Math.abs(Math.hypot(0.3, riseForMin(0.3, 1.7) - FOLLOW_HEAD_Y) - FOLLOW_MIN_DIST) < 1e-9, "rise: a 0.3 m boom rises to the nearest distance");
check(riseForMin(0.3, 1.7, 2.2) === 2.2, "rise: never through the ceiling");
check(riseForMin(2.5, 2.2) === 2.2, "rise: a full boom is left as it is");
check(followFade(2) === 1 && followFade(0.3) >= 0.5 && followFade(0.3) < 1, "fade: all of him normally, a little see-through only very close");
{
  const c = { x: 0, z: -4 };
  const f = capOnLine(c, 0, 0, () => 1.5);
  check(f === 1.5 && Math.abs(c.z + 1.5) < 1e-9 && c.x === 0, "capOnLine: pulled in along its own line, not slid sideways");
}
{
  const k = new FollowCarry(), cam = { x: 0, z: 2.5 }, look = { x: 0, z: -1.4 };
  k.step(0, 0, cam, look, true); k.step(0.5, 0, cam, look, true);
  check(cam.x === 0.5 && look.x === 0.5, "carry: his sideways step goes straight into the camera and its look point (he stays centred)");
  k.step(3, 0, cam, look, false);
  check(cam.x === 0.5, "carry: off (a card's shot, a new place) it only notes where he is");
}
const far = zoomedFollowCam(1);
check(far.back === FOLLOW_CAM_FAR.back && far.height === FOLLOW_CAM_FAR.height && zoomedFollowCam(0).back === FOLLOW_CAM_D.back, "zoom: D at 0, about A's distance at 1");

// the doorway walk: a 6 x 5.4 m room, 2.7 m ceiling (the house's rooms), the camera's
// wall gap 0.3 m; he comes through the south door, 1.5 m in, facing north; stands, then
// turns round and walks back to the door, then along the wall. Both zooms.
const W2 = 3, D2 = 2.7, CEIL = 2.7 - 0.18, GAP = 0.3, dt = 1 / 30;
function walk(old: boolean) {
let worstDist = Infinity, worstStep = 0, worstJerk = 0, outside = 0, faded = 0;
for (const z of [0, 1]) {
  const cs = zoomedFollowCam(z);
  const boom = new FollowBoom();
  const P = { x: 0, z: D2 - 1.5 };
  let yaw = Math.PI; // facing -z (north)
  let camYaw = yaw + Math.PI;
  const cam = { x: 0, y: 0, z: 0 };
  let first = true;
  let lastV: number[] | null = null;
  const freeAt = (dx: number, dz: number) => boxRoom(P.x, P.z, dx, dz, -W2 + GAP, W2 - GAP, -D2 + GAP, D2 - GAP);
  for (let i = 0; i < 30 * 9; i++) {
    const t = i * dt;
    // 0-1 s stand; 1-1.6 s turn round; 1.6-3.2 s walk back to the door; then along the south wall
    let speed = 0;
    if (t > 1 && t <= 1.6) yaw = Math.PI + Math.PI * ((t - 1) / 0.6);
    if (t > 1.6 && t <= 3.2) speed = 1.2;
    if (t > 3.2) { yaw = Math.PI / 2; speed = 1.2; }
    P.x += Math.sin(yaw) * speed * dt; P.z += Math.cos(yaw) * speed * dt;
    P.x = Math.max(-W2 + 0.3, Math.min(W2 - 0.3, P.x)); P.z = Math.max(-D2 + 0.3, Math.min(D2 - 0.3, P.z));
    if (speed > 0.3) { let d = yaw + Math.PI - camYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; camYaw += d * Math.min(1, dt * cs.yawK); }
    const bx = Math.sin(camYaw), bz = Math.cos(camYaw);
    if (first) boom.reset();
    // before (20 Nov 2026): the boom floored at minBoom (through the wall) and the eased camera clamped to the walls by axis
    const len = old ? Math.max(cs.minBoom, Math.max(0.6, Math.min(cs.back, freeAt(bx, bz)))) : boom.step(cs.back, freeAt(bx, bz), dt);
    const wy0 = Math.min(CEIL, cs.height + (cs.back - len) * cs.riseIfShort);
    const wy = old ? wy0 : riseForMin(len, wy0, CEIL);
    const want = { x: P.x + bx * len, y: wy, z: P.z + bz * len };
    const was = { ...cam };
    if (first) { Object.assign(cam, want); first = false; }
    else { const k = Math.min(1, dt * cs.posK); cam.x += (want.x - cam.x) * k; cam.y += (want.y - cam.y) * k; cam.z += (want.z - cam.z) * k; }
    if (old) { cam.x = Math.max(-W2 + 0.25, Math.min(W2 - 0.25, cam.x)); cam.z = Math.max(-D2 + 0.25, Math.min(D2 - 0.25, cam.z)); }
    const flat = old ? Math.hypot(cam.x - P.x, cam.z - P.z) : capOnLine(cam, P.x, P.z, freeAt);
    if (!old) cam.y = riseForMin(flat, cam.y, 2.7 - 0.15);
    const d = Math.hypot(flat, cam.y - FOLLOW_HEAD_Y);
    if (i > 0) {
      const v = [cam.x - was.x, cam.y - was.y, cam.z - was.z];
      worstStep = Math.max(worstStep, Math.hypot(v[0], v[1], v[2]));
      // a snap is a sudden change of step, not a quick smooth swing round him
      if (lastV) worstJerk = Math.max(worstJerk, Math.hypot(v[0] - lastV[0], v[1] - lastV[1], v[2] - lastV[2]));
      lastV = v;
    }
    worstDist = Math.min(worstDist, d);
    if (followFade(d) < 1) faded++;
    if (Math.abs(cam.x) > W2 - (old ? 0.25 : GAP) + 1e-6 || Math.abs(cam.z) > D2 - (old ? 0.25 : GAP) + 1e-6 || cam.y > 2.7) outside++;
  }
}
return { worstDist, worstStep, worstJerk, outside, faded };
}
const before = walk(true);
const { worstDist, worstStep, worstJerk, outside, faded } = walk(false);
check(outside === 0, `doorway walk: the camera left the room on ${outside} frames`);
check(worstDist >= FOLLOW_MIN_DIST - 0.02, `doorway walk: the camera came ${worstDist.toFixed(2)} m from his head (min ${FOLLOW_MIN_DIST})`);
check(worstStep < 0.3, `doorway walk: the camera moved ${worstStep.toFixed(2)} m in one frame`);
check(worstJerk < 0.08, `doorway walk: the camera snapped (its step changed by ${worstJerk.toFixed(3)} m in one frame)`);
console.log(`followCam before: nearest his head ${before.worstDist.toFixed(2)} m, biggest change of step ${before.worstJerk.toFixed(3)} m`);
console.log(`followCam: nearest his head ${worstDist.toFixed(2)} m, biggest step ${worstStep.toFixed(3)} m/frame, biggest change of step ${worstJerk.toFixed(3)} m, faded frames ${faded}`);

if (problems.length) { console.error("FAIL followCam\n- " + problems.join("\n- ")); process.exit(1); }
console.log("PASS followCam");
