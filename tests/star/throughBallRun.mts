import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, type Outcome,
} from "../../lib/star/canvasEngine";

/**
 * A MAN ON A RUN MEETS A THROUGH-BALL (Leo, 8 Oct 2026).
 *
 * "throughballs arent really a thing because players just run towards the
 * ball … I do want to be able to set a player on a run past the defenders and
 * play a throughball through the defenders that gets to him and he gets it
 * and shoots."
 *
 * Two things were wrong. A run that finished while you were still aiming
 * dropped the order, so by the kick he was an ordinary player drifting back
 * to the ball. And a man still on his run ignored a ball played ahead of him
 * until he reached the end of the run. Now he holds the end of his run
 * (heldAt) and meets a ball coming onto it where it is going (runMeetPoint).
 *
 * Measured over 242 onside through-balls (before → after), runner sent 8 m
 * past the line and played in as he reaches it:
 *   ball to his feet   he gets it 14% → 48%   goal 22% → 26%
 *   3 m ahead          36% → 64%              26% → 33%
 *   6 m ahead          66% → 72%              35% → 38%
 *   9 m ahead          24% → 57%              24% → 31%
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
function mulberry32(a: number) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const DT = 1 / 180;

function throughBalls(lead: number) {
  let n = 0, reached = 0, goals = 0;
  for (let seed = 0; seed < 500; seed++) {
    const rng = mulberry32(seed * 131 + 9);
    const sc = buildScenario("through_ball", rng, 65, 65, 60);
    initDefenders(sc, rng);
    const r = sc.runner; if (!r) continue;
    const ys = sc.defenders.map(d => d.y).concat([sc.keeper.y]).sort((a, b) => a - b);
    const line = ys[1];
    if (r.pos.y < line + 1) continue;
    const gx = (sc.goal.x1 + sc.goal.x2) / 2;
    const to = { x: r.pos.x + (gx - r.pos.x) * 0.3, y: Math.max(3, line - 8) };
    r.commandedTo = { ...to };
    for (let t = 0; t < 4; t += 1 / 60) {
      const c = r.commandedTo!; const dx = c.x - r.pos.x, dy = c.y - r.pos.y, g = Math.hypot(dx, dy);
      if (r.pos.y <= line + 0.4 || g < 0.6) break;
      const st = Math.min(g, r.speed / 60); r.pos.x += dx / g * st; r.pos.y += dy / g * st;
    }
    const rd = { x: to.x - r.pos.x, y: to.y - r.pos.y }; const rl = Math.hypot(rd.x, rd.y) || 1;
    const aim = { x: r.pos.x + rd.x / rl * lead, y: r.pos.y + rd.y / rl * lead };
    const d = Math.hypot(aim.x - sc.ball.x, aim.y - sc.ball.y);
    const ball = launch(sc, { x: aim.x - sc.ball.x, y: aim.y - sc.ball.y }, Math.min(0.95, 0.25 + d / 30),
      { cx: 0, cy: -0.25 }, { power: 60, technique: 60 }, rng);
    if (r.offside) continue;
    let res: Outcome | null = null;
    for (let i = 0; i < 2500 && !res; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball); stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng);
      res = stepBall(ball, sc, rng, DT);
    }
    n++;
    if (sc.receiverReached && sc.receivedBy === r) reached++;
    if (res === "goal") goals++;
  }
  return { n, reached: reached / Math.max(1, n), goals: goals / Math.max(1, n) };
}

{
  const feet = throughBalls(0), three = throughBalls(3), nine = throughBalls(9);
  check(feet.n > 150, `enough onside through-balls to measure (${feet.n})`);
  check(feet.reached > 0.35, `a ball to his feet on the run reaches him (${(feet.reached * 100).toFixed(0)}%, was 14%)`);
  check(three.reached > 0.5, `a ball 3 m ahead reaches him (${(three.reached * 100).toFixed(0)}%, was 36%)`);
  check(nine.reached > 0.42, `a ball 9 m into space reaches him (${(nine.reached * 100).toFixed(0)}%, was 24%)`);
  check(three.goals > 0.25, `and he scores from it (${(three.goals * 100).toFixed(0)}%)`);
}

// ── He holds the end of his run, rather than drifting back to the ball ──
{
  const rng = mulberry32(77);
  const sc = buildScenario("through_ball", rng, 65, 65, 60);
  initDefenders(sc, rng);
  const r = sc.runner!;
  r.heldAt = { x: r.pos.x, y: r.pos.y };
  // A ball going away from him, 8 m off: nothing to meet.
  const ball = launch(sc, { x: -(r.pos.x - sc.ball.x), y: 6 }, 0.3, { cx: 0, cy: -0.2 }, { power: 60, technique: 60 }, rng);
  const start = { ...r.pos };
  for (let i = 0; i < 0.6 / DT; i++) stepReactions(sc, ball, DT, rng);
  check(Math.hypot(r.pos.x - start.x, r.pos.y - start.y) < 0.05, "a man holding the end of his run stays there for a ball not coming to him");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — a man on a run meets a through-ball, and holds the end of his run");
