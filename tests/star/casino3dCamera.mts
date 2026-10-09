import { clampBoom, haloFade, LAMP_KEEP_OUT, MIN_BOOM, type V3 } from "../../lib/star/casino3d/camera";
import { ROOM, ROUL } from "../../lib/star/casino3d/plan";
import { LAMP_Y } from "../../lib/star/casino3d/hRoom";

/**
 * THE 3D CASINO'S CAMERA (Casino look: New) — Harry's iPhone: "the camera got
 * too close and sat inside the lamp". The camera never ends up inside a
 * chandelier's keep-out, a wall or the ceiling, from anywhere in the room.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const lamps: V3[] = [[ROUL.x, LAMP_Y(ROOM.h), ROUL.z], [3.4, LAMP_Y(ROOM.h), -1.0]];

// the screenshot case: he stands in front of the roulette table facing the doors; the camera wanted
// to sit 4.4 m behind him, right in the chandelier
const p = clampBoom([ROUL.x, 1.55, 3.6], [ROUL.x, 3.3, -0.8], ROOM, lamps);
check(Math.hypot(p[0] - lamps[0][0], p[1] - lamps[0][1], p[2] - lamps[0][2]) >= LAMP_KEEP_OUT - 1e-6, `camera in the lamp at ${p}`);

// every spot on a grid, every direction, a range of heights: never inside a lamp, wall or ceiling
let worst = Infinity, n = 0;
for (let x = -ROOM.x + 0.5; x <= ROOM.x - 0.5; x += 0.5) for (let z = -ROOM.z + 0.5; z <= ROOM.z - 0.5; z += 0.5) {
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) for (const y of [2.2, 2.55, 3.3, 4.0]) {
    const q = clampBoom([x, 1.55, z], [x - Math.sin(a) * 4.4, y, z - Math.cos(a) * 4.4], ROOM, lamps);
    n++;
    for (const l of lamps) worst = Math.min(worst, Math.hypot(q[0] - l[0], q[1] - l[1], q[2] - l[2]));
    check(Math.abs(q[0]) <= ROOM.x && Math.abs(q[2]) <= ROOM.z && q[1] < ROOM.h, `camera outside the room from ${x},${z}`);
    const roomy = Math.abs(x) < ROOM.x - 1.6 && Math.abs(z) < ROOM.z - 1.6; // in a corner the wall comes first
    check(!roomy || Math.hypot(q[0] - x, q[2] - z, q[1] - 1.55) >= MIN_BOOM - 0.05, `boom shorter than its floor from ${x},${z}`);
  }
}
check(worst >= LAMP_KEEP_OUT - 0.11, `closest camera to a lamp ${worst.toFixed(2)} m`);
// a clear boom is untouched
const free = clampBoom([0, 1.55, 3], [0, 2.55, 7.4], ROOM, lamps);
check(Math.abs(free[2] - 7.4) < 1e-6, "a clear boom was shortened");
// halos: gone when near, full far away
check(haloFade(1.0) === 0 && haloFade(3) === 1, "halo fade ends");

if (problems.length) { console.error(problems.slice(0, 10).join("\n")); process.exit(1); }
console.log(`casino3dCamera: ok (${n} booms, nearest a lamp ${worst.toFixed(2)} m)`);
