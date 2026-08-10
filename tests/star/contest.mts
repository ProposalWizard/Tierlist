import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, applyFirstTouch, spaceScore,
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

function playOutTimed(sc: Scenario, ball: Ball, rng: () => number): { out: Outcome | "none"; frames: number } {
  let out: Outcome | null = null;
  let i = 0;
  for (; i < 900 && !out; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    out = stepBall(ball, sc, rng, DT);
  }
  return { out: out ?? "none", frames: i };
}

const playOut = (sc: Scenario, ball: Ball, rng: () => number): Outcome | "none" =>
  playOutTimed(sc, ball, rng).out;

/**
 * Where a footballer would put it: the corner away from the keeper.
 *
 * These used to aim at the middle of the goal, which was a reasonable shot when
 * the keeper swept his line — you were timing his sweep. He stands still now,
 * so the middle of the goal is the middle of the keeper, and a suite that aimed
 * there was measuring the worst shot in football.
 */
function awayFromKeeper(sc: Scenario) {
  const mid = (sc.goal.x1 + sc.goal.x2) / 2;
  return { x: sc.keeper.x < mid ? sc.goal.x2 - 0.8 : sc.goal.x1 + 0.8, y: 0 };
}

function strikeAtGoal(kind: Parameters<typeof buildScenario>[0], seed: number, power = 0.9) {
  const rng = mulberry32(seed);
  const sc = buildScenario(kind, rng, 62, 60);
  initDefenders(sc, rng);
  const g = awayFromKeeper(sc);
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
      const g = awayFromKeeper(sc);
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
  let blocked = 0;                       // the strike itself, stopped on its way
  const N = 800;
  for (let seed = 0; seed < N; seed++) {
    const { sc, ball, rng } = strikeAtGoal(seed % 2 ? "volley" : "header", seed * 11 + 7, 0.85);
    const { out, frames } = playOutTimed(sc, ball, rng);
    counts[out] = (counts[out] ?? 0) + 1;
    if (out === "tackled" && frames < 30) blocked += 1;
  }
  const tackled = counts["tackled"] ?? 0;
  const second = tackled - blocked;       // …and the ball afterwards, lost
  const goals = counts["goal"] ?? 0;
  check(tackled > 0, "a loose ball a defender reaches first is lost");
  // Two different things wear the same outcome, so they are counted apart. A
  // defender who gets to the ball now CLEARS it rather than knocking it back
  // into play, so both genuinely end the move rather than starting a scramble
  // the attack usually still won.
  check(blocked < N * 0.3, `a body in the way blocks some of them (${pct(blocked, N)})`);
  check(second < N * 0.3, `and the second ball is a real contest, not a formality (${pct(second, N)} lost)`);
  check(goals > N * 0.15, `and chances still get finished (${pct(goals, N)})`);

  // A ball already over the line can never be stolen back.
  for (let seed = 0; seed < 300; seed++) {
    const { sc, ball, rng } = strikeAtGoal("one_on_one", seed * 13 + 3);
    const out = playOut(sc, ball, rng);
    if (out === "goal" || out === "rebound") check(ball.owner !== "opponent", "a goal is never un-scored by the 50-50");
  }
}

// ── The woodwork ────────────────────────────────────────────────────────────
//
// Hitting the post used to end the highlight, which is not what it looks like:
// it cannons back out with most of the pace on it and somebody has a decision
// to make. It is loose from that moment — your poacher can follow it in, a
// defender who gets there first hoofs it clear — and only a second ricochet
// off the frame ends it, because that is pinball rather than football.
{
  let live = 0, resolved = 0, after: Record<string, number> = {};
  for (let seed = 0; seed < 1500; seed++) {
    // Aimed at an upright rather than the middle of the net, because otherwise
    // you are waiting all night for the sample.
    const rng = mulberry32(seed * 3 + 41);
    const sc = buildScenario(seed % 2 ? "one_on_one" : "tight_angle", rng, 62, 60);
    initDefenders(sc, rng);
    const aim = { x: seed % 4 < 2 ? sc.goal.x1 : sc.goal.x2, y: 0 };  // at an upright, deliberately
    const ball = launch(sc, { x: aim.x - sc.ball.x, y: aim.y - sc.ball.y }, 0.9, { cx: 0, cy: -0.15 }, { power: 70, technique: 70 }, rng);
    let out: Outcome | null = null;
    let sawPost = false, speedOut = 0, speedIn = 0;
    for (let i = 0; i < 900 && !out; i++) {
      const before = Math.hypot(ball.vel.x, ball.vel.y);
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
      if (ball.event === "post" && !sawPost) {
        sawPost = true;
        speedIn = before;
        speedOut = Math.hypot(ball.vel.x, ball.vel.y);
        check(ball.loose, "a ball off the post belongs to nobody");
        check(ball.vel.y > 0, "and it comes back out, not through");
        check(speedOut > speedIn * 0.5, `keeping a lot of the power (${speedOut.toFixed(1)} of ${speedIn.toFixed(1)} m/s)`);
      }
      ball.event = null;
    }
    if (sawPost) {
      live += 1;
      if (out) { resolved += 1; after[out] = (after[out] ?? 0) + 1; }
    }
  }
  check(live > 20, `the frame gets hit (${live} times in 1500 shots at the upright)`);
  check(resolved === live, "and every rebound off it is played out to something");
  check((after["post"] ?? 0) < live, `a second ricochet is not the only way it can end (${JSON.stringify(after)})`);
  check((after["goal"] ?? 0) + (after["rebound"] ?? 0) > 0, "and the follow-up sometimes goes in");
}

// ── The ball never goes through anybody ─────────────────────────────────────
//
// "If the ball goes anywhere within my player, he should have the ball." Two
// things were letting it through. A support player steps out of the way of a
// ball that is going in — right, but he was stepping out of EXISTENCE, so a
// shot that would have hit him in the chest carried on. And `shot` is sticky so
// a team-mate cannot turn your goal into a completed pass, which is right while
// it is still your shot and wrong the moment the keeper has palmed it away:
// every one of your players stepped aside from the rebound and it rolled
// visibly through them.
{
  let reached = 0, through = 0;
  for (let seed = 0; seed < 2500; seed++) {
    const rng = mulberry32(seed * 7 + 3);
    const kind = (["long_range", "one_on_one", "volley"] as const)[seed % 3];
    const sc = buildScenario(kind, rng, 62, 60);
    initDefenders(sc, rng);
    sc.defenders = [];                                  // nobody to clear it
    // Straight at the keeper, so he has to push it out.
    const ball = launch(sc, { x: sc.keeper.x - sc.ball.x, y: -sc.ball.y }, 0.9, { cx: 0, cy: -0.15 }, { power: 70, technique: 70 }, rng);
    const mates = () => [
      ...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map(r => r.pos),
      { x: sc.follower.x, y: sc.follower.y },
    ];
    let out: Outcome | null = null, pending = -1;
    for (let i = 0; i < 1500 && !out; i++) {
      if (ball.loose && pending < 0 && ball.contactCd <= 0) {
        for (const m of mates()) {
          if (Math.hypot(ball.pos.x - m.x, ball.pos.y - m.y) < 0.55) { pending = i; reached += 1; break; }
        }
      }
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
      if (pending >= 0) {
        if (!ball.loose || sc.receiverDone || sc.receiverShot || out) pending = -1;
        else if (i - pending > 6) { through += 1; pending = -1; }
      }
    }
  }
  check(through === 0, `a loose ball never passes through a team-mate (${through} of ${reached} that reached one)`);
}

// ── A scramble is a scramble, not a machine ─────────────────────────────────
//
// Reception was the one contact test that did not respect contactCd, and it is
// the one place it mattered most: a team-mate who shoots is standing ON the
// ball he has just hit, so on the very next frame he was inside his own control
// radius and collected it again. Then shot. Then collected. A move either had
// no team-mate shot at all or ran to the runaway cap — 306 of 1200, and never
// one, two or three of them.
{
  const hist: Record<number, number> = {};
  const N = 1200;
  for (let seed = 0; seed < N; seed++) {
    const rng = mulberry32(seed * 13 + 5);
    const kind = (["one_on_one", "tight_angle", "long_range", "volley", "header"] as const)[seed % 5];
    const sc = buildScenario(kind, rng, 62, 60);
    initDefenders(sc, rng);
    const mid = (sc.goal.x1 + sc.goal.x2) / 2;
    const g = { x: sc.keeper.x < mid ? sc.goal.x2 - 0.8 : sc.goal.x1 + 0.8, y: 0 };
    const ball = launch(sc, { x: g.x - sc.ball.x, y: g.y - sc.ball.y }, 0.9, { cx: 0, cy: -0.2 }, { power: 70, technique: 70 }, rng);
    let out: Outcome | null = null;
    for (let i = 0; i < 1500 && !out; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
    }
    const n = sc.receiverShots ?? 0;
    hist[n] = (hist[n] ?? 0) + 1;
  }
  const one = hist[1] ?? 0, many = (hist[3] ?? 0) + (hist[4] ?? 0);
  check(one > N * 0.1, `a rebound is often followed in once (${one}/${N})`);
  check(many < N * 0.02, `and hardly ever more than twice (${many}/${N} went three or four)`);
}

// ── Where it will land ──────────────────────────────────────────────────────
//
// A ball in the air is marked on the grass at the spot it will first bounce.
// The mark is worked out ONCE, at the kick, and pinned — recomputing it each
// frame from the ball's current state was the obvious thing and it was wrong:
// a curling ball's projection sweeps round as the curl bites, so the mark
// crawled across the pitch and chased the ball in.
//
// Pinning it only works if it is right. It runs the same flight the ball
// actually flies — curl, drag, wind and the same integration step — so this
// asserts the thing that matters: the ball lands ON the mark.
{
  const errs: number[] = [];
  let marked = 0, curled = 0, n = 0;
  for (let seed = 0; seed < 1500; seed++) {
    const rng = mulberry32(seed * 13 + 7);
    const sc = buildScenario(seed % 2 ? "long_range" : "byline_cross", rng, 62, 60);
    initDefenders(sc, rng);
    // Nothing to intervene: this is about the flight and nothing else.
    sc.defenders = []; sc.runner = null; sc.secondaryRunners = [];
    sc.follower = { ...sc.follower, x: -90, y: -90 };
    sc.keeper = { ...sc.keeper, x: -90, y: -90 };
    const cx = (rng() - 0.5) * 1.6;                    // deliberately curled
    const ball = launch(sc, { x: (rng() - 0.5) * 0.6, y: -1 }, 0.8, { cx, cy: 0.55 }, { power: 70, technique: 80 }, rng);
    n += 1;
    if (Math.abs(ball.spin) > 0.05) curled += 1;
    if (!ball.landAt) continue;
    marked += 1;
    const pinned = { ...ball.landAt };

    let prevZ = ball.z, done = false;
    for (let i = 0; i < 900 && !done; i++) {
      // The match loop substeps three times a frame, and the prediction is
      // matched to that step, so this has to be too.
      for (let k = 0; k < 3; k++) {
        const o = stepBall(ball, sc, rng, DT / 3);
        if (ball.z <= 0.001 && prevZ > 0.001) {
          errs.push(Math.hypot(ball.pos.x - pinned.x, ball.pos.y - pinned.y));
          done = true; break;
        }
        prevZ = ball.z;
        if (o) { done = true; break; }
      }
    }
  }
  errs.sort((a, b) => a - b);
  const worst = errs[errs.length - 1] ?? 99;
  check(marked === n, `every lofted ball is marked (${marked}/${n})`);
  check(curled > n * 0.8, `and these are genuinely curling (${curled}/${n})`);
  check(errs.length > 400, `enough of them land inside the situation to measure (${errs.length})`);
  check(worst < 0.15, `the ball lands on the mark (worst miss ${worst.toFixed(2)} m over ${errs.length} flights)`);
}

// ── The first touch ─────────────────────────────────────────────────────────
//
// Not a dice roll: the defence simply gets the time your touch cost them, using
// the same closing behaviour it uses everywhere else.
{
  // How far the ball got away from you. Nobody moves before you kick it, so the
  // cost of a heavy touch is in the POSITION you end up striking from.
  const strayAfterTouch = (technique: number) => {
    const strays: number[] = [];
    for (let seed = 0; seed < 300; seed++) {
      const rng = mulberry32(seed * 7 + 21);
      const sc = buildScenario("long_range", rng, 62, 60);
      initDefenders(sc, rng);
      strays.push(applyFirstTouch(sc, technique, rng));
    }
    return strays.reduce((a, b) => a + b, 0) / strays.length;
  };

  const poor = strayAfterTouch(20), good = strayAfterTouch(95);
  check(poor > good, `a heavy touch gets away from you (${poor.toFixed(2)} m vs ${good.toFixed(2)} m)`);
  check(good < 0.6, "and a good one kills it dead");
  check(poor < 3.5, "but a bad touch is not a giveaway");

  // The player stays with the ball — he does not get left standing where it was.
  {
    const rng = mulberry32(3);
    const sc = buildScenario("long_range", rng, 62, 60);
    applyFirstTouch(sc, 20, rng);
    check(Math.hypot(sc.player.x - sc.ball.x, sc.player.y - sc.ball.y) < 2,
      "you are still next to the ball after taking a touch");
  }

  // It costs time, and the time is bounded — you never lose a second and a half
  // to a touch.
  const rng = mulberry32(1);
  const sc = buildScenario("long_range", rng, 62, 60);
  initDefenders(sc, rng);
  for (let i = 0; i < 200; i++) {
    const stray = applyFirstTouch(buildScenario("long_range", rng, 62, 60), 50, rng);
    check(stray >= 0 && stray < 2.5, `the touch costs a believable distance (${stray.toFixed(2)} m)`);
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
