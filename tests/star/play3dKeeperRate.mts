/**
 * PLAY3D KEEPER RATE (Harry, 9 Oct 2026: "why is the goalie unstoppable in free roam").
 * On-target shots at a 70-rated keeper should go in about as often as real ones
 * (roughly 20–50% by distance), corners far more often than the middle, and a
 * better keeper should save more. The old keeper saved 86–100%, corners included.
 */
import { CX, GOAL_H, POST_L, POST_R, STEP } from "../../lib/star/play3d/constants";
import { makePlayer, skillsOf } from "../../lib/star/play3d/player";
import { stepKeeper3d, keeperSpot } from "../../lib/star/play3d/keeper";
import { stepBall3d } from "../../lib/star/play3d/ball";
import { makeRng } from "../../lib/star/play3d/rng";

function rate(ov: number, dist: number, spd: number) {
  let goals = 0, n = 0, corner = 0, cornerG = 0;
  const rng = makeRng(ov * 1000 + dist);
  for (let i = 0; i < 400; i++) {
    const bx = CX + (rng() - 0.5) * 10, by = dist;
    const ball = { x: bx, y: by, z: 0.11, vx: 0, vy: 0, vz: 0, spin: 0, topspin: 0, inNet: false };
    const k = makePlayer({ id: "gk", x: 0, y: 0, skills: skillsOf(ov) });
    const s = keeperSpot(ball); k.x = s.x; k.y = s.y;
    const tx = POST_L + 0.25 + rng() * (POST_R - POST_L - 0.5), tz = 0.15 + rng() * (GOAL_H - 0.35);
    const t = Math.hypot(tx - bx, by) / spd;
    ball.vx = (tx - bx) / t; ball.vy = -by / t; ball.vz = (tz - 0.11) / t + 4.9 * t;
    const isCorner = Math.abs(tx - CX) > 2.4;
    let goal = false;
    for (let j = 0; j < 600; j++) {
      const ev = stepKeeper3d(k, ball, STEP, rng, false, 1);
      if (ev === "save" || ev === "catch") break;
      const evs = stepBall3d(ball, STEP) as unknown[];
      if (ball.inNet || evs.some((e) => ((e as { kind?: string }).kind ?? e) === "goal")) { goal = true; break; }
      if (ball.y < -1) break;
    }
    n++; if (goal) goals++;
    if (isCorner) { corner++; if (goal) cornerG++; }
  }
  return { all: goals / n, corners: cornerG / Math.max(1, corner) };
}

const problems: string[] = [];
const mid = rate(70, 18, 26), close = rate(70, 12, 22), far = rate(70, 25, 28);
const good = rate(90, 18, 26), poor = rate(50, 18, 26);
if (mid.all < 0.15 || mid.all > 0.45) problems.push(`70-rated keeper, 18 m: ${(mid.all * 100).toFixed(0)}% go in (want 15–45%)`);
if (close.all < 0.3 || close.all > 0.7) problems.push(`70-rated keeper, 12 m: ${(close.all * 100).toFixed(0)}% go in (want 30–70%)`);
if (far.all < 0.1) problems.push(`70-rated keeper, 25 m: only ${(far.all * 100).toFixed(0)}% go in (want 10%+)`);
if (mid.corners < mid.all + 0.1) problems.push(`corners (${(mid.corners * 100).toFixed(0)}%) not clearly better than the average (${(mid.all * 100).toFixed(0)}%)`);
if (!(good.all < mid.all && mid.all < poor.all)) problems.push(`a better keeper should save more: 90 → ${(good.all * 100).toFixed(0)}%, 70 → ${(mid.all * 100).toFixed(0)}%, 50 → ${(poor.all * 100).toFixed(0)}% go in`);
console.log(`go in, 70-rated: 12 m ${(close.all * 100).toFixed(0)}%, 18 m ${(mid.all * 100).toFixed(0)}%, 25 m ${(far.all * 100).toFixed(0)}%; corners at 18 m ${(mid.corners * 100).toFixed(0)}%`);
if (problems.length) { console.error("FAIL\n  " + problems.join("\n  ")); process.exit(1); }
console.log("ok");
