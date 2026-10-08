import {
  touchingBar, touchingPost, mateBarChance, rollMateShots, mateBallAt, crossbarWinner, crossbarReward,
  CROSSBAR_SPOT, MATE_FLIGHT_S, MATE_AFTER_S,
} from "../../lib/star/training3d/crossbar";
import { mulberry32 } from "../../lib/star/season";
import { CX, GOAL_H, POST_L, POST_R } from "../../lib/star/pitch";

/** The 3D crossbar challenge's rules (lib/star/training3d/crossbar.ts). */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// The bar scores; the post, the net and over the top do not.
check(touchingBar({ x: CX, y: 0.1, z: GOAL_H }), "middle of the bar is a hit");
check(touchingBar({ x: POST_L + 0.1, y: 0, z: GOAL_H + 0.15 }), "near the left end of the bar is a hit");
check(!touchingBar({ x: CX, y: 0, z: GOAL_H + 0.5 }), "half a metre over is not a hit");
check(!touchingBar({ x: CX, y: 0, z: 1.5 }), "into the net is not a hit");
check(!touchingBar({ x: 33.44, y: -0.02, z: 2.24 }), "the browser shot that went in just under the bar is not a hit");
check(!touchingBar({ x: CX, y: 5, z: GOAL_H }), "bar height but 5 m out is not a hit");
check(!touchingBar({ x: POST_R + 1, y: 0, z: GOAL_H }), "a metre wide is not a hit");
check(touchingPost({ x: POST_R, y: 0, z: 1 }), "the post is seen");
check(!touchingPost({ x: POST_R, y: 0, z: GOAL_H }), "the bar end is the bar, not the post");

// His chance climbs with his rating and stays sane.
check(mateBarChance(60) < mateBarChance(85), "a better player hits the bar more");
for (const ov of [undefined, 30, 50, 70, 99, 140]) {
  const p = mateBarChance(ov);
  check(p >= 0.05 && p <= 0.25, `chance for ${ov} in 5..25% (${p})`);
}

// His shots are fixed by the seed, and hits sit on the bar between the posts.
const a = rollMateShots(80, mulberry32(7)), b = rollMateShots(80, mulberry32(7));
check(JSON.stringify(a) === JSON.stringify(b), "same seed, same shots");
let hits = 0, n = 0;
for (let s = 1; s <= 400; s++) for (const sh of rollMateShots(75, mulberry32(s))) {
  n++;
  if (sh.hit) { hits++; check(sh.tz === GOAL_H && sh.tx > POST_L && sh.tx < POST_R, "a hit lands on the bar"); }
  else check(!!sh.miss, "a miss says how");
  // The cut-scene path starts at the D and arrives at the target.
  const p0 = mateBallAt(sh, 0), p1 = mateBallAt(sh, MATE_FLIGHT_S), p2 = mateBallAt(sh, MATE_FLIGHT_S + MATE_AFTER_S);
  check(Math.abs(p0.y - CROSSBAR_SPOT.y) < 1e-9 && p0.z < 0.2, "starts on the grass at the D");
  check(Math.abs(p1.x - sh.tx) < 1e-6 && Math.abs(p1.y) < 1e-6 && Math.abs(p1.z - sh.tz) < 1e-6, "arrives at the target");
  check(p2.z >= 0.1, "never under the grass");
  if (sh.hit) check(touchingBar(p1), "a hit's path touches the bar");
  else check(!touchingBar(p1), "a miss's path does not touch the bar");
}
const rate = hits / n;
check(rate > 0.1 && rate < 0.25, `a 75 hits the bar 10-25% of the time (${(rate * 100).toFixed(1)}%)`);

check(crossbarWinner(2, 1) === "you" && crossbarWinner(1, 2) === "him" && crossbarWinner(1, 1) === "level", "winner");
check(crossbarReward(1, 1, 50, 0.3).won, "level counts as a win");
check(crossbarReward(0, 1, 50, 0.3).gain === -1, "a loss costs one");
check(crossbarReward(2, 1, 30, 0.3).gain === 6, "a win at a low bar is +6");

if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
console.log(`crossbar3d: ok (a 75 hits the bar ${(rate * 100).toFixed(1)}% of shots)`);
