/**
 * THE 3D LOOK-AROUND CAMERA (Harry, 9 Oct 2026: "the camera is super
 * sensitive in the 3D modes"). lib/star/three3d/orbitCam.ts, shared by the
 * garden and the shop. Measures degrees turned per 100 px of drag, before and
 * after; that the turn eases in (no snap); that the tilt is held.
 * Also the mocap head levelling (lib/star/three3d/footballAnims.ts).
 */
import {
  OrbitCam, ORBIT_RAD_PER_PX, ORBIT_RAD_PER_PX_OLD, ORBIT_DEG_PER_100PX, PITCH_MIN, PITCH_MAX, CAM_MIN_Y,
} from "../../lib/star/three3d/orbitCam";
import { levelQuatTrack } from "../../lib/star/three3d/footballAnims";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const deg = (r: number) => (r * 180) / Math.PI;

// degrees per 100 px: a 100 px drag in 10 moves, then let it settle
const before = deg(ORBIT_RAD_PER_PX_OLD * 100);
const cam = new OrbitCam();
let turned = 0;
for (let i = 0; i < 10; i++) { cam.drag(10, 0); turned += cam.step(1 / 60); }
for (let i = 0; i < 120; i++) turned += cam.step(1 / 60);
const after = Math.abs(deg(turned));
console.log(`degrees per 100 px of drag: before ${before.toFixed(1)}°, after ${after.toFixed(1)}°`);
ok(Math.abs(before - 45.8) < 0.1, "before was 45.8° per 100 px");
ok(Math.abs(after - ORBIT_DEG_PER_100PX) < 0.05 && after < before * 0.6, `after is about half (${after.toFixed(1)}°)`);

// eased, not snapped: one 100 px drag, the first frame turns only part of it
const c2 = new OrbitCam();
c2.drag(60, 0); c2.drag(40, 0);
const first = Math.abs(c2.step(1 / 60));
ok(first < ORBIT_RAD_PER_PX * 100 * 0.3, `first frame turns ${(first / (ORBIT_RAD_PER_PX * 100) * 100).toFixed(0)}% of the drag (eased)`);
let rest = first;
for (let i = 0; i < 12; i++) rest += Math.abs(c2.step(1 / 60));
ok(rest > ORBIT_RAD_PER_PX * 100 * 0.85, "about 90% there in 0.2 s");

// a jump in the pointer is capped
const c3 = new OrbitCam();
c3.drag(900, 0);
let t3 = 0;
for (let i = 0; i < 200; i++) t3 += c3.step(1 / 60);
ok(Math.abs(deg(t3)) < 15, `a 900 px pointer jump turns ${Math.abs(deg(t3)).toFixed(1)}°, not ${deg(ORBIT_RAD_PER_PX_OLD * 900).toFixed(0)}°`);

// tilt: held between the limits whatever the drag, camera never under the floor, never flipped
const c4 = new OrbitCam();
for (let i = 0; i < 500; i++) { c4.drag(0, 60); c4.step(1 / 30); }
ok(c4.pitch <= PITCH_MAX + 1e-9, `tilt held at the top (${c4.pitch.toFixed(2)})`);
const [yUp, bUp] = c4.lift(2.75, 6.3, 1.3);
ok(bUp > 0, `looking down, still behind him (boom ${bUp.toFixed(2)} m, height ${yUp.toFixed(2)} m)`);
for (let i = 0; i < 1000; i++) { c4.drag(0, -60); c4.step(1 / 30); }
ok(c4.pitch >= PITCH_MIN - 1e-9, `tilt held at the bottom (${c4.pitch.toFixed(2)})`);
for (const [y, b, l] of [[2.75, 6.3, 1.3], [2.85, 4.6, 0.95]]) {
  const [h] = c4.lift(y, b, l);
  ok(h >= CAM_MIN_Y, `lowest camera ${h.toFixed(2)} m, not under the floor`);
}
const c5 = new OrbitCam();
const [h0, b0] = c5.lift(2.75, 6.3, 1.3);
ok(Math.abs(h0 - 2.75) < 1e-9 && Math.abs(b0 - 6.3) < 1e-9, "no drag: exactly the old follow view");

// mocap head levelling: a track tilted 13° sideways on average comes back with no average tilt
const q = (ax: number, ay: number, az: number) => { // small-angle XYZ
  const cx = Math.cos(ax / 2), sx = Math.sin(ax / 2), cy = Math.cos(ay / 2), sy = Math.sin(ay / 2), cz = Math.cos(az / 2), sz = Math.sin(az / 2);
  return [sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz];
};
const vals: number[] = [];
for (let i = 0; i < 50; i++) vals.push(...q(0.17 + 0.05 * Math.sin(i), 0.17, 0.22 + 0.04 * Math.cos(i)));
const lv = levelQuatTrack(vals);
let m = [0, 0, 0, 0];
for (let i = 0; i < 50; i++) for (let k = 0; k < 4; k++) m[k] += lv[i * 4 + k];
const L = Math.hypot(...m); m = m.map((x) => x / L);
const roll = deg(Math.atan2(2 * (m[3] * m[2] + m[0] * m[1]), 1 - 2 * (m[1] * m[1] + m[2] * m[2])));
const yawD = deg(Math.asin(2 * (m[3] * m[1] - m[2] * m[0])));
const pitchD = deg(Math.atan2(2 * (m[3] * m[0] + m[1] * m[2]), 1 - 2 * (m[0] * m[0] + m[1] * m[1])));
ok(Math.abs(roll) < 0.5 && Math.abs(yawD) < 0.5, `levelled: average side tilt ${roll.toFixed(2)}°, turn ${yawD.toFixed(2)}°`);
ok(pitchD > 5, `pitch kept (${pitchD.toFixed(1)}°)`);
let spread = 0;
for (let i = 1; i < 50; i++) spread = Math.max(spread, Math.abs(lv[i * 4] - lv[(i - 1) * 4]));
ok(spread > 0.001, "the motion is still there");

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("orbitCam: all passed");
