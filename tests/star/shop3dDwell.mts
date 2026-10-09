import { stepDwell, DWELL_S } from "../../lib/star/shop3d/dwell";

/**
 * 3D SHOP — an item's card opens only when he stops at it or turns to it
 * (Harry, 9 Oct 2026: "too easy for it to pop up on screen"). Walking past
 * never opens it.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const run = (frames: { inZone: boolean; dist: number; speed: number; faceOff: number; arrived?: boolean }[], dt = 1 / 30) => {
  let s = { timer: 0, open: false };
  let openedAt = -1;
  frames.forEach((f, i) => { s = stepDwell(s.timer, s.open, f, dt); if (s.open && openedAt < 0) openedAt = i * dt; });
  return { s, openedAt };
};
const N = (n: number, f: Parameters<typeof run>[0][number]) => Array.from({ length: n }, () => f);

// walking past the boots at walking pace, side-on, 0.9 m from the plinths, for 4 s: never opens
check(!run(N(120, { inZone: true, dist: 0.9, speed: 1.55, faceOff: Math.PI / 2 })).s.open, "walking past opened the card");
// slowing to 1 m/s, still side-on: never opens
check(!run(N(120, { inZone: true, dist: 0.9, speed: 1.0, faceOff: 1.4 })).s.open, "a slow walk past opened the card");
// stopped near an item: opens after the dwell, not before
const stop = run(N(30, { inZone: true, dist: 1.0, speed: 0.1, faceOff: 2 }));
check(stop.s.open && stop.openedAt >= DWELL_S - 0.04 && stop.openedAt <= DWELL_S + 0.05, `stopping opened at ${stop.openedAt}s`);
// stopped but far (2 m): no
check(!run(N(60, { inZone: true, dist: 2.0, speed: 0, faceOff: 0 })).s.open, "stopped 2 m away opened the card");
// facing an item within 1.2 m while easing up to it: opens
check(run(N(30, { inZone: true, dist: 1.1, speed: 0.8, faceOff: 0.3 })).s.open, "facing an item did not open the card");
// a brief stop (0.2 s) between steps: no
check(!run([...N(6, { inZone: true, dist: 1, speed: 0.1, faceOff: 2 }), ...N(30, { inZone: true, dist: 1, speed: 1.5, faceOff: 2 })]).s.open, "a brief pause opened the card");
// a tap-walk arriving: at once
check(run([{ inZone: true, dist: 0.8, speed: 0.2, faceOff: 0, arrived: true }]).s.open, "arriving by tap did not open the card");
// leaving the area closes it
check(!run([...N(30, { inZone: true, dist: 1, speed: 0, faceOff: 0 }), { inZone: false, dist: 5, speed: 1, faceOff: 0 }]).s.open, "leaving did not close the card");

if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log("shop3dDwell: ok");
