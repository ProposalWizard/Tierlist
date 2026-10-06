import { buildGrid, findPath, nearestFree, clearLine, freeAt, TapWalker, type XZ } from "../../lib/star/tapWalk";

/**
 * TAP TO MOVE (lib/star/tapWalk.ts) — the path round things and the walker
 * that follows it. The garden and the 3D shop were also tapped in a browser.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// a 20 x 20 m room with a wall across the middle (a gap at the east end)
const wall = (x: number, z: number) => Math.abs(z) < 0.5 && x < 6;
const free = (x: number, z: number) => Math.abs(x) < 9.6 && Math.abs(z) < 9.6 && !wall(x, z);
const g = buildGrid(-10, 10, -10, 10, 0.3, free);

// straight across open floor: one step, straight to the spot
const p1 = findPath(g, [-5, 5], [5, 7]);
check(!!p1 && p1.length === 1, "open floor: one straight leg");

// through the wall: it must go round by the gap, never through
const p2 = findPath(g, [-5, 5], [-5, -5]);
check(!!p2 && p2.length >= 2, "behind the wall: a path with corners");
if (p2) {
  let at: XZ = [-5, 5], ok = true;
  for (const q of p2) { if (!clearLine(g, at, q)) ok = false; at = q; }
  check(ok, "every leg of the path is clear");
  check(p2.some((q) => q[0] > 6), "it goes round by the gap");
  const end = p2[p2.length - 1];
  check(Math.hypot(end[0] + 5, end[1] + 5) < 0.3, "it ends where you tapped");
}

// a tap inside the wall: the nearest place he can stand
const n = nearestFree(g, 0, 0.1);
check(!!n && freeAt(g, n[0], n[1]) && Math.abs(n[1]) > 0.5, "a tap on the wall moves to the floor beside it");

// nowhere to go (a closed box around the target)
const box = (x: number, z: number) => free(x, z) && !(Math.abs(x - 5) < 2 && Math.abs(z - 5) < 2 && !(Math.abs(x - 5) < 1 && Math.abs(z - 5) < 1));
const g2 = buildGrid(-10, 10, -10, 10, 0.3, box);
check(findPath(g2, [-5, -5], [5, 5]) === null, "a walled-in spot: no path, no walk");

// the walker: walk the path at a steady speed and arrive
const w = new TapWalker();
let arrived = false;
w.go(p2 ?? [], { onArrive: () => { arrived = true; } });
let x = -5, z = 5, yaw = 0;
for (let i = 0; i < 2000 && w.active; i++) {
  const s = w.step(x, z, 1 / 60);
  if (!s) break;
  yaw = s.yaw;
  const sp = 1.55 * Math.min(1, s.push / 0.75);
  x += Math.sin(yaw) * sp / 60; z += Math.cos(yaw) * sp / 60;
}
check(arrived, "the walker arrives and says so");
check(Math.hypot(x + 5, z + 5) < 0.3, "it stops at the spot");

// stuck (pushed back every frame): it gives up rather than walk on the spot forever
const w2 = new TapWalker();
w2.go([[5, 5]]);
for (let i = 0; i < 200 && w2.active; i++) w2.step(0, 0, 1 / 60);
check(!w2.active, "stuck: it gives up");

// cancel (the stick was touched)
const w3 = new TapWalker();
w3.go([[1, 1]]); w3.cancel();
check(!w3.active && w3.step(0, 0, 1 / 60) === null, "cancel stops it");

if (problems.length) { console.error("tapWalk FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("tapWalk: all passed");
