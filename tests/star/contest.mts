import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepSupport, stepRunner,
  stepFollower, stepBall, launch, applyFirstTouch, spaceScore,
  type Outcome, type Scenario, type Ball,
} from "../../lib/star/canvasEngine";

/**
 * The ball as something both sides can win: ownership, the 50-50 on a loose
 * ball, the aerial duel, and the touch you take when it comes back to you.
 *
 * What this replaced: a deflection or a parry rolled until it stopped and the
 * chance fizzled out as "scrambled clear" with nobody involved; a header was
 * struck as though the man marking you were not there; and a chained scenario
 * started with the ball glued to your foot however poor your technique.
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
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;

function playOut(sc: Scenario, ball: Ball, rng: () => number): Outcome | "none" {
  let out: Outcome | null = null;
  for (let i = 0; i < 900 && !out; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepSupport(sc, ball, ball.pos, DT);
    stepRunner(sc, DT);
    stepFollower(sc, ball, rng, DT);
    out = stepBall(ball, sc, rng, DT);
  }
  return out ?? "none";
}

function strikeAtGoal(kind: Parameters<typeof buildScenario>[0], seed: number, power = 0.9) {
  const rng = mulberry32(seed);
  const sc = buildScenario(kind, rng, 62, 60);
  initDefenders(sc, rng);
  const g = { x: (sc.goal.x1 + sc.goal.x2) / 2, y: 0 };
  const ball = launch(sc, { x: g.x - sc.ball.x, y: g.y - sc.ball.y }, power, { cx: 0, cy: -0.15 }, { power: 70, technique: 70 }, rng);
  return { sc, ball, rng };
}

// ── Ownership ───────────────────────────────────────────────────────────────
{
  const { ball } = strikeAtGoal("one_on_one", 5);
  check(ball.owner === "you", "a ball you have just struck is yours");

  // A header lost in the air belongs to nobody, which is what makes the second
  // ball a real moment rather than a formality.
  let anyLoose = false;
  for (let seed = 0; seed < 300 && !anyLoose; seed++) {
    const { ball: b } = strikeAtGoal("header", seed * 3 + 1);
    if (b.owner === "none" && b.loose) anyLoose = true;
  }
  check(anyLoose, "a header you lose in the air comes down loose, owned by nobody");
}

// ── The aerial duel ─────────────────────────────────────────────────────────
//
// It must matter, and it must not be a coin flip you cannot influence. A
// powerful player wins more of them; the marker still wins some off anybody.
{
  const rate = (power: number) => {
    let cleared = 0;
    const N = 800;
    for (let seed = 0; seed < N; seed++) {
      const rng = mulberry32(seed * 17 + 9);
      const sc = buildScenario("header", rng, 62, 60);
      initDefenders(sc, rng);
      const g = { x: (sc.goal.x1 + sc.goal.x2) / 2, y: 0 };
      const ball = launch(sc, { x: g.x - sc.ball.x, y: g.y - sc.ball.y }, 0.85, { cx: 0, cy: -0.15 }, { power, technique: 70 }, rng);
      // A ball travelling away from goal is one you did not win.
      if (ball.vel.y > 0) cleared++;
    }
    return cleared / N;
  };

  const weak = rate(30), strong = rate(95);
  check(weak > strong, `a stronger player wins more in the air (${pct(strong * 800, 800)} lost vs ${pct(weak * 800, 800)})`);
  check(strong > 0.02, `even a powerful header is contested (${pct(strong * 800, 800)} lost)`);
  check(weak < 0.6, `and a weak one is not hopeless (${pct(weak * 800, 800)} lost)`);

  // Only the header. A one-on-one is not an aerial duel however close the
  // defender is standing.
  for (let seed = 0; seed < 200; seed++) {
    const { ball } = strikeAtGoal("one_on_one", seed * 5 + 2);
    if (ball.vel.y > 0) { check(false, "a one-on-one is never contested in the air"); break; }
  }
}

// ── The 50-50 on a loose ball ───────────────────────────────────────────────
{
  const counts: Record<string, number> = {};
  const N = 800;
  for (let seed = 0; seed < N; seed++) {
    const { sc, ball, rng } = strikeAtGoal(seed % 2 ? "volley" : "header", seed * 11 + 7, 0.85);
    const out = playOut(sc, ball, rng);
    counts[out] = (counts[out] ?? 0) + 1;
  }
  const tackled = counts["tackled"] ?? 0;
  const goals = counts["goal"] ?? 0;
  check(tackled > 0, "a loose ball a defender reaches first is lost");
  check(tackled < N * 0.12, `losing the second ball is a cost, not the usual outcome (${pct(tackled, N)})`);
  check(goals > N * 0.15, `and chances still get finished (${pct(goals, N)})`);

  // A ball already over the line can never be stolen back.
  for (let seed = 0; seed < 300; seed++) {
    const { sc, ball, rng } = strikeAtGoal("one_on_one", seed * 13 + 3);
    const out = playOut(sc, ball, rng);
    if (out === "goal" || out === "rebound") check(ball.owner !== "opponent", "a goal is never un-scored by the 50-50");
  }
}

// ── The first touch ─────────────────────────────────────────────────────────
//
// Not a dice roll: the defence simply gets the time your touch cost them, using
// the same closing behaviour it uses everywhere else.
{
  const gapAfterTouch = (technique: number) => {
    const gaps: number[] = [];
    for (let seed = 0; seed < 300; seed++) {
      const rng = mulberry32(seed * 7 + 21);
      const sc = buildScenario("long_range", rng, 62, 60);
      initDefenders(sc, rng);
      applyFirstTouch(sc, technique, rng);
      gaps.push(Math.min(...sc.defenders.map(d => Math.hypot(d.x - sc.player.x, d.y - sc.player.y))));
    }
    return gaps.reduce((a, b) => a + b, 0) / gaps.length;
  };

  const poor = gapAfterTouch(20), good = gapAfterTouch(95);
  check(good > poor, `a better first touch leaves you more room (${poor.toFixed(2)} m vs ${good.toFixed(2)} m)`);
  check(poor > 1.5, "even a poor touch does not put a defender on top of you");

  // It costs time, and the time is bounded — you never lose a second and a half
  // to a touch.
  const rng = mulberry32(1);
  const sc = buildScenario("long_range", rng, 62, 60);
  initDefenders(sc, rng);
  for (let i = 0; i < 200; i++) {
    const lost = applyFirstTouch(buildScenario("long_range", rng, 62, 60), 50, rng);
    check(lost > 0.1 && lost < 0.95, `the touch costs a believable amount of time (${lost.toFixed(2)} s)`);
  }

  // And your options are still there afterwards — a touch is a cost, not a
  // reset of the whole scenario.
  const opts = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
  applyFirstTouch(sc, 50, rng);
  check(opts.some(r => spaceScore(r.pos, sc, sc.player) > 0), "you still have someone to find after taking a touch");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 12)) console.error("  ✗ " + p);
  if (problems.length > 12) console.error(`  …and ${problems.length - 12} more`);
  process.exit(1);
}
console.log("PASS — ownership, aerial duels, loose-ball 50-50s and first touch all hold");
