import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepSupport, stepRunner,
  stepFollower, stepBall, launch,
  type Outcome, type Scenario, type Ball, type Vec2,
} from "../../lib/star/canvasEngine";
import { CX } from "../../lib/star/pitch";

/**
 * Defending: reading a pass, committing to the interception, recovering
 * goal-side, and offside judged live rather than baked in when the scenario was
 * built.
 *
 * What this replaced: a defender only ever deflected a ball that happened to
 * pass within a metre of where he was already standing. He never went for
 * anything, never turned when he was played past, and the offside risk on a
 * through-ball was a fixed number decided before you had even taken aim.
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

const DT = 1 / 60;

/** Play a scenario out, stepping everything the real loop steps. */
function playOut(sc: Scenario, ball: Ball, rng: () => number, watch?: (sc: Scenario, ball: Ball) => void): Outcome | "none" {
  let out: Outcome | null = null;
  for (let i = 0; i < 800 && !out; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepSupport(sc, ball, ball.pos, DT);
    stepRunner(sc, DT);
    stepFollower(sc, ball, rng, DT);
    watch?.(sc, ball);
    out = stepBall(ball, sc, rng, DT);
  }
  return out ?? "none";
}

const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(0)}%`;

// ── A defender in the lane goes for the ball ────────────────────────────────
//
// The same pass twice: once with a defender standing on the line of it, once
// with him fifteen metres away. If the first is not markedly harder to complete,
// covering a lane is decoration.
{
  let blockedFails = 0, openFails = 0;
  const N = 400;

  for (let seed = 0; seed < N; seed++) {
    for (const inLane of [true, false]) {
      const rng = mulberry32(seed * 29 + 5);
      const sc = buildScenario("midfield_pass", rng, 62, 60);
      const target = sc.runner!.to;
      const mid = { x: (sc.ball.x + target.x) / 2, y: (sc.ball.y + target.y) / 2 };
      // One defender, placed deliberately, so this measures the lane and
      // nothing else.
      sc.defenders = [inLane ? { x: mid.x, y: mid.y } : { x: mid.x, y: mid.y + 16 }];
      initDefenders(sc, rng);

      const ball = launch(sc, { x: target.x - sc.ball.x, y: target.y - sc.ball.y }, 0.42, { cx: 0, cy: 0.1 }, { power: 70, technique: 70 }, rng);
      const out = playOut(sc, ball, rng);
      if (out !== "delivered") { if (inLane) blockedFails++; else openFails++; }
    }
  }

  check(blockedFails > openFails * 2,
    `a pass through a covered lane is far likelier to be cut out (${pct(blockedFails, N)} vs ${pct(openFails, N)} open)`);
  check(openFails < N * 0.25, `an open lane is still a pass you complete (${pct(N - openFails, N)} completed)`);
  check(blockedFails < N * 0.95, `and a covered lane is not an automatic loss (${pct(N - blockedFails, N)} completed)`);
}

// ── He commits, rather than trailing the ball forever ───────────────────────
{
  let chased = 0, arrived = 0;
  for (let seed = 0; seed < 200; seed++) {
    const rng = mulberry32(seed * 13 + 77);
    const sc = buildScenario("midfield_pass", rng, 62, 60);
    const target = sc.runner!.to;
    const mid = { x: (sc.ball.x + target.x) / 2, y: (sc.ball.y + target.y) / 2 };
    sc.defenders = [{ x: mid.x + 3.5, y: mid.y }];
    initDefenders(sc, rng);
    const ball = launch(sc, { x: target.x - sc.ball.x, y: target.y - sc.ball.y }, 0.4, { cx: 0, cy: 0.1 }, { power: 70, technique: 70 }, rng);

    let sawIntercept = false, closest = 99;
    playOut(sc, ball, rng, (s, b) => {
      if (s.defenders[0].role === "intercept") sawIntercept = true;
      closest = Math.min(closest, Math.hypot(s.defenders[0].x - b.pos.x, s.defenders[0].y - b.pos.y));
    });
    if (sawIntercept) { chased++; if (closest < 1.6) arrived++; }
  }
  check(chased > 100, `defenders do read a pass they can reach (${chased}/200)`);
  check(arrived > chased * 0.6,
    `and a defender who commits actually gets there (${arrived}/${chased}) — re-solving every frame left him trailing it`);
}

// ── He never chases your shot ──────────────────────────────────────────────
{
  let chasedShot = 0, goals = 0, stolen = 0;
  const N = 400;
  for (let seed = 0; seed < N; seed++) {
    const rng = mulberry32(seed * 7 + 900);
    const sc = buildScenario(seed % 2 ? "one_on_one" : "long_range", rng, 62, 60);
    initDefenders(sc, rng);
    const goalC = { x: (sc.goal.x1 + sc.goal.x2) / 2, y: 0 };
    const ball = launch(sc, { x: goalC.x - sc.ball.x, y: goalC.y - sc.ball.y }, 0.92, { cx: 0, cy: -0.2 }, { power: 72, technique: 72 }, rng);
    check(ball.shot === true, "a strike at goal is recorded as a shot");
    const out = playOut(sc, ball, rng, (s) => {
      if (s.defenders.some(d => d.role === "intercept")) chasedShot++;
    });
    if (out === "goal") goals++;
    if (out === "delivered") stolen++;
  }
  check(chasedShot === 0, `no defender steps into a strike he could not have anticipated (${chasedShot} frames)`);
  check(stolen === 0, `and no team-mate collects it either (${stolen}/${N})`);
  check(goals > N * 0.15, `shots still go in (${pct(goals, N)})`);
}

// ── Played past, he turns and gets goal-side ───────────────────────────────
{
  let recovered = 0, sampled = 0;
  for (let seed = 0; seed < 200; seed++) {
    const rng = mulberry32(seed * 23 + 11);
    const sc = buildScenario("through_ball", rng, 62, 60);
    initDefenders(sc, rng);
    const target = sc.runner!.to;
    const ball = launch(sc, { x: target.x - sc.ball.x, y: target.y - sc.ball.y }, 0.5, { cx: 0, cy: 0.05 }, { power: 70, technique: 70 }, rng);

    // Catch each defender the moment the ball goes past him, and see whether he
    // is nearer his own goal by the end than he was at that moment.
    const caughtAt = new Map<number, number>();
    playOut(sc, ball, rng, (s) => {
      s.defenders.forEach((d, i) => {
        if (d.role === "recover" && !caughtAt.has(i)) caughtAt.set(i, d.y);
      });
    });
    caughtAt.forEach((y0, i) => {
      sampled++;
      if (sc.defenders[i].y < y0 - 0.5) recovered++;
    });
  }
  check(sampled > 20, `the through-ball does play defenders past the ball (${sampled})`);
  check(recovered > sampled * 0.7, `a defender who is beaten runs back toward his own goal (${recovered}/${sampled})`);
}

// ── Offside is judged when you play it, not when the scenario was built ────
{
  // Same scenario, same pass. One played straight away; one after two seconds
  // of holding it while the defence steps up.
  let riskNow = 0, riskLate = 0, n = 0;
  for (let seed = 0; seed < 300; seed++) {
    const mk = () => {
      const rng = mulberry32(seed * 31 + 3);
      const sc = buildScenario("through_ball", rng, 62, 60);
      initDefenders(sc, rng);
      return { sc, rng };
    };
    const a = mk(), b = mk();
    const t1 = a.sc.runner!.to;
    launch(a.sc, { x: t1.x - a.sc.ball.x, y: t1.y - a.sc.ball.y }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, a.rng);

    for (let t = 0; t < 2; t += DT) {
      stepDefenders(b.sc, DT, b.sc.player, false, null);
      stepSupport(b.sc, null, b.sc.player, DT);
      stepRunner(b.sc, DT);
    }
    const t2 = b.sc.runner!.to;
    launch(b.sc, { x: t2.x - b.sc.ball.x, y: t2.y - b.sc.ball.y }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, b.rng);

    riskNow += a.sc.offsideRisk;
    riskLate += b.sc.offsideRisk;
    n++;
  }
  check(riskLate > riskNow,
    `dwelling on a through-ball while the runner goes costs you (${(riskNow / n).toFixed(3)} → ${(riskLate / n).toFixed(3)})`);

  // …but it only applies where a line was actually built. A scenario carries one
  // or two defenders, not a back four, so applying it everywhere flagged two
  // thirds of ordinary midfield passes offside.
  for (const kind of ["midfield_pass", "buildup", "cutback", "corner"] as const) {
    const rng = mulberry32(4);
    const sc = buildScenario(kind, rng, 62, 60);
    const t: Vec2 = sc.runner?.to ?? { x: CX, y: 20 };
    launch(sc, { x: t.x - sc.ball.x, y: t.y - sc.ball.y }, 0.45, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
    check(sc.offsideRisk === 0, `${kind}: no offside where the scenario has no line to judge against`);
  }
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — interception, commitment, shot safety, recovery runs and live offside all hold");
