import { initDefenders, type ScenarioKind } from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import {
  PRESS_REACT_S, PRESS_WIN_R, PRESS_BODY_R, FOUL_SHARE, FOUL_SHARE_BEHIND,
  pressSpeedFor, pressFromBehind, foulShareFor, pressStep,
} from "../../lib/star/pressure";

/**
 * THE CLOSER GOES ROUND YOU, AND FROM BEHIND HE FOULS YOU.
 *
 * Harry, playing a real match (Mikey v0.7 review, 13:59): "that intercepts it
 * even though he's on the wrong side of me … if the player's behind you they
 * should be more likely to foul you". The Premier League closer ran in a
 * straight line at the ball, through your own body when you stood between —
 * 47% of served one-on-ones. Harry chose: he goes round you, and a closer from
 * behind fouls you 2 times in 3 (a penalty in the box); from in front, 1 in 3
 * as before.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── The rules on hand-built geometry ────────────────────────────────────────
{
  const ball = { x: 30, y: 10 }, you = { x: 30, y: 11.2 };       // you stand 1.2 m behind the ball
  check(pressFromBehind({ x: 30, y: 14 }, ball, you), "a man straight behind you is from behind");
  check(!pressFromBehind({ x: 30, y: 6 }, ball, you), "a man goal-side of the ball is not");
  check(!pressFromBehind({ x: 34, y: 10 }, ball, you), "a man level, off to the side, is not");
  check(foulShareFor(true) === FOUL_SHARE_BEHIND && foulShareFor(false) === FOUL_SHARE, "foul share by side");
  check(FOUL_SHARE_BEHIND > FOUL_SHARE, "from behind fouls more often than from in front");

  // Straight behind you: he must never pass through you, and must still get there.
  const p = { x: 30, y: 14 };
  let minYou = Infinity, t = 0;
  for (; t < 10; t += 1 / 60) {
    if (Math.hypot(ball.x - p.x, ball.y - p.y) <= PRESS_WIN_R) break;
    pressStep(p, ball, you, pressSpeedFor(1) / 60);
    minYou = Math.min(minYou, Math.hypot(p.x - you.x, p.y - you.y));
  }
  check(minYou >= PRESS_BODY_R - 1e-9, `straight behind: closest to your middle ${minYou.toFixed(2)} m (must stay ≥ ${PRESS_BODY_R})`);
  check(t < 10, "straight behind: he still gets to the ball");

  // Goal-side: nothing changes — straight at the ball, same as before.
  const q = { x: 30, y: 6 }, q0 = { x: 30, y: 6 };
  pressStep(q, ball, you, 0.05);
  check(Math.abs(q.x - q0.x) < 1e-9 && Math.abs(q.y - (q0.y + 0.05)) < 1e-9, "goal-side: a plain straight step at the ball");
}

// ── Served chances, Premier League pressure ─────────────────────────────────
const KINDS: ScenarioKind[] = ["one_on_one", "tight_angle", "long_range", "cutback", "byline_cross", "through_ball", "midfield_pass", "buildup"];
let n = 0, through = 0, stuck = 0, behind = 0, oneOnOneBehind = 0, oneOnOnes = 0;
for (const kind of KINDS) for (let s = 0; s < 150; s++) {
  const rng = mulberry32(s * 7919 + kind.length * 131 + 17);
  const sc = makeChance({ source: { from: "kind", kind }, rng, strength: { keeper: 62, team: 60, vision: 55 }, mode: "drawings" }).sc;
  initDefenders(sc, rng);
  let pr: { x: number; y: number } | null = null, best = Infinity;
  for (const d of sc.defenders) { const dd = Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y); if (dd < best) { best = dd; pr = d; } }
  if (!pr) continue;
  n++;
  const b = pressFromBehind(pr, sc.ball, sc.player);
  if (b) behind++;
  if (kind === "one_on_one") { oneOnOnes++; if (b) oneOnOneBehind++; }
  const p = { x: pr.x, y: pr.y };
  let got = false;
  for (let t = 0; t < 20; t += 1 / 60) {
    if (t <= PRESS_REACT_S) continue;
    if (Math.hypot(sc.ball.x - p.x, sc.ball.y - p.y) <= PRESS_WIN_R) { got = true; break; }
    pressStep(p, sc.ball, sc.player, pressSpeedFor(1) / 60);
    if (Math.hypot(p.x - sc.player.x, p.y - sc.player.y) < 0.6) { through++; break; }
  }
  if (!got) stuck++;
}
console.log(`${n} served chances: closer from behind ${behind} (one-on-ones ${oneOnOneBehind}/${oneOnOnes}); runs through your body ${through}; never got there ${stuck}`);
check(n > 1000, "enough chances");
check(through === 0, "no closer passes through your body");
check(stuck === 0, "every closer still gets to the ball");
check(oneOnOneBehind > oneOnOnes * 0.5, "one-on-ones are mostly from behind (the case Harry hit)");

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 20)) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("\npressFromBehind: all checks passed");
