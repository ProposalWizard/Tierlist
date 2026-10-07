import { TapWalker, type XZ } from "../../lib/star/tapWalk";

/**
 * TAP TO MOVE IS QUICK (Harry, 7 Oct 2026, on an iPhone: "tap to walk is too
 * slow"). Runs the real TapWalker through the garden's own speed line (stick
 * push → m/s, the same easing and turn as lib/star/garden3d/scene.ts) and
 * checks a tap-walk is at least as quick as the stick held at full tilt.
 *
 * Measured with this file on 7 Oct 2026 (old walker vs new):
 *   gate to shop door, 22.8 m in a line: 8.77 s → 6.32 s, top 3.60 → 4.01 m/s
 *   a 4 m hop:                          2.90 s → 1.60 s, top 1.45 → 3.60 m/s
 *   10 m, starting with his back to it: 5.37 s → 3.28 s
 * (The real garden walk goes round the fountain, so it is a little longer.)
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// the garden's numbers (lib/star/garden3d/scene.ts)
const WALK = 1.55, JOG = 3.6;
const speedFor = (mag: number) => (mag < 0.08 ? 0 : mag < 0.75 ? WALK * (mag / 0.75) : WALK + (JOG - WALK) * ((mag - 0.75) / 0.25));
const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

/** Walk a path the way the garden does; returns seconds to arrive and the top speed. */
function walk(path: XZ[], from: XZ, yaw0: number) {
  const w = new TapWalker();
  let arrived = false;
  w.go(path, { onArrive: () => { arrived = true; } });
  let [x, z] = from, yaw = yaw0, speed = 0, t = 0, top = 0;
  const dt = 1 / 60;
  while (t < 60 && !arrived) {
    const s = w.step(x, z, dt);
    let mag = 0;
    if (s) { mag = s.push * Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(angDiff(yaw, s.yaw))))); yaw += angDiff(yaw, s.yaw) * Math.min(1, dt * 10); }
    speed += (speedFor(mag) - speed) * Math.min(1, dt * 8);
    top = Math.max(top, speed);
    x += Math.sin(yaw) * speed * dt; z += Math.cos(yaw) * speed * dt;
    t += dt;
  }
  return { t, top, arrived };
}

// the gate to the shop door, straight up the path
const long = walk([[0, -7.3]], [0, 15.5], Math.PI);
check(long.arrived, "gate to shop: arrives");
check(long.top >= JOG - 0.01, `gate to shop: as quick as the stick at full tilt (${long.top.toFixed(2)} m/s, stick ${JOG})`);
check(long.t < 7.2, `gate to shop: under 7.2 s (${long.t.toFixed(2)} s)`);

// a 4 m hop (was a 1.45 m/s walk): now a jog
const mid = walk([[0, 4]], [0, 0], 0);
check(mid.arrived, "4 m: arrives");
check(mid.top > 2.6, `4 m: jogs (${mid.top.toFixed(2)} m/s)`);

// turned the wrong way first: he still gets going within half a second
const back = walk([[0, -10]], [0, 0], 0);
check(back.arrived, "behind him: arrives");

console.log(`tapWalkSpeed: gate→shop ${long.t.toFixed(2)} s at ${long.top.toFixed(2)} m/s; 4 m hop ${mid.t.toFixed(2)} s at ${mid.top.toFixed(2)} m/s; 10 m behind him ${back.t.toFixed(2)} s`);
if (problems.length) { console.error("tapWalkSpeed FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("tapWalkSpeed: all passed");
