import {
  newDribble, stepDribble, flick, dribbleSpeed, dribbleProgress, dribbleViewport, DRIBBLE_TIMEOUT,
  type DribbleState,
} from "../../lib/star/dribble";
import {
  buildScenario, launch, curlRange, loftRange, dragForFullPower, stepBall,
  initDefenders, stepKeeper, stepDefenders, stepReactions,
  type Outcome,
} from "../../lib/star/canvasEngine";
import { newMatch, tick, resolveScenario } from "../../lib/star/hiddenMatch";
import { CX } from "../../lib/star/pitch";

/**
 * The dribble, and attributes that expand what you can do rather than what you
 * get away with.
 *
 * Chapter 6 of the specification is a whole chapter on dribbling and the game
 * had none of it — you were a fixed point who struck the ball and never moved.
 *
 * §13.1: "Attributes should increase the player's football vocabulary, not
 * simply increase their success rate. If upgrading an attribute only increases
 * hidden percentages without changing player behaviour, the system has failed
 * its design goal." Ours did exactly the named failure case: Technique's main
 * job was shrinking the launch-angle error, and Pace was read by no code in the
 * match at all.
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
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(0)}%`;

/**
 * Run a dribble with a simple but honest policy: head for the gap. Steers
 * toward whichever side of the corridor the nearest awake chaser is not on,
 * re-reading every 0.25 s. Not optimal — that is the point. It stands in for a
 * competent player so the measurements reflect skill, not a solver.
 */
function runDribble(pace: number, oppStrength: number, seed: number, chasers = 3) {
  const rng = mulberry32(seed);
  const s = newDribble({ pace, oppStrength, chasers, rng });
  let since = 0;
  let steps = 0;
  while (s.outcome === "running" && steps++ < 60 * (DRIBBLE_TIMEOUT + 2)) {
    since += DT;
    if (since >= 0.25) {
      since = 0;
      let nearest: { x: number; y: number } | null = null;
      let best = Infinity;
      for (const c of s.chasers) {
        if (!c.awake) continue;
        const d = Math.hypot(c.x - s.pos.x, c.y - s.pos.y);
        if (d < best) { best = d; nearest = c; }
      }
      if (nearest && best < 8) {
        // Go round him, on the side with more room.
        const away = s.pos.x > nearest.x ? 1 : -1;
        const room = away > 0 ? s.maxX - s.pos.x : s.pos.x - s.minX;
        const side = room > 5 ? away : -away;
        flick(s, side * 0.6, -0.7);
      } else {
        flick(s, (CX - s.pos.x) * 0.02, -1);
      }
    }
    stepDribble(s, DT);
  }
  return s;
}

// ── Pace is what the run is for ─────────────────────────────────────────────
{
  check(dribbleSpeed(0) < dribbleSpeed(100), "pace makes you quicker with the ball");
  check(dribbleSpeed(0) > 3, "and a slow player still moves");
  check(dribbleSpeed(100) < 9, "…and a fast one is not a motorbike");

  const rate = (pace: number) => {
    const runs = Array.from({ length: 500 }, (_, i) => runDribble(pace, 70, i * 13 + 1));
    return runs.filter(r => r.outcome === "through").length / runs.length;
  };
  const slow = rate(20), quick = rate(90);
  check(quick > slow, `a quicker player gets through more (${pct(slow * 500, 500)} at pace 20 vs ${pct(quick * 500, 500)} at 90)`);
  check(slow > 0.12, `and a slow one is not hopeless (${pct(slow * 500, 500)})`);
  check(quick < 0.95, `nor a fast one a certainty (${pct(quick * 500, 500)})`);
}

// ── The run itself behaves ──────────────────────────────────────────────────
{
  const rng = mulberry32(9);
  const s = newDribble({ pace: 60, oppStrength: 70, chasers: 3, rng });
  check(s.chasers.length === 3, "three defenders, as asked");
  check(s.chasers.every(c => !c.awake), "and none of them is watching you yet");
  check(s.targetY < s.startY, "the run goes up the pitch");
  check(s.chasers.every(c => Math.hypot(c.x - s.pos.x, c.y - s.pos.y) > 4),
    "nobody starts on top of you — an opening flick must be a read, not a guess");
  check(new Set(s.chasers.map(c => Math.round(c.y))).size > 1,
    "they are staggered down the run rather than lined up as a wall");
  check(dribbleProgress(s) < 0.02, "you start at the beginning");

  // A defender wakes when you come near, and stays awake.
  const near = newDribble({ pace: 60, oppStrength: 70, chasers: 1, rng: mulberry32(4) });
  near.pos = { x: near.chasers[0].x, y: near.chasers[0].y + 4 };
  stepDribble(near, DT);
  check(near.chasers[0].awake, "he notices you at close range");
  near.pos = { x: near.chasers[0].x + 40, y: near.chasers[0].y + 40 };
  stepDribble(near, DT);
  check(near.chasers[0].awake,
    "and does not forget — beating a man has to mean beating him, not leaving his radius");

  // Every ending is reachable.
  const outcomes = new Set(Array.from({ length: 400 }, (_, i) => runDribble(55, 70, i * 7 + 3).outcome));
  check(outcomes.has("through"), "runs can succeed");
  check(outcomes.has("lost"), "and can be broken up");

  // Straying out of the corridor ends it.
  const stray = newDribble({ pace: 60, oppStrength: 70, chasers: 3, rng: mulberry32(21) });
  flick(stray, 1, 0);
  let n = 0;
  while (stray.outcome === "running" && n++ < 2000) stepDribble(stray, DT);
  check(stray.outcome !== "through", "running sideways does not get you there");

  // ── It is a run you can actually play ──
  //
  // What this replaced: a run over in a second and a half, on the camera the
  // last chance had been using, with a goal in the corner of the screen and two
  // white lines nobody could identify. You could not read it, let alone play it.
  {
    // Long enough to see. A straight sprint is the fastest a run can possibly
    // be, and even that has to be worth watching.
    const straight = newDribble({ pace: 95, oppStrength: 70, chasers: 0, rng: mulberry32(77) });
    let t = 0;
    while (straight.outcome === "running" && t < 30) { stepDribble(straight, DT); t += DT; }
    check(t > 3, `even a flat-out sprint takes a few seconds (${t.toFixed(1)}s)`);

    // The goal is never on screen. The run asks "can you get past these men",
    // which is a different question from "can you finish" — the chance you earn
    // is built afterwards, from wherever you got to.
    let nearest = Infinity;
    for (let seed = 0; seed < 200; seed++) {
      const d = newDribble({ pace: 95, oppStrength: 70, chasers: 3, rng: mulberry32(seed * 5 + 2) });
      flick(d, 0, -1);
      let n = 0;
      while (d.outcome === "running" && n++ < 3000) {
        stepDribble(d, DT);
        nearest = Math.min(nearest, dribbleViewport(d).y1);
      }
      nearest = Math.min(nearest, dribbleViewport(d).y1);
    }
    check(nearest > 3, `neither goal is ever in frame (closest edge ${nearest.toFixed(1)} m from the line)`);

    // Drifting wide costs you ground, not the ball. Losing possession for it
    // taught you to fear the one thing the situation is asking you to do.
    const wide = newDribble({ pace: 60, oppStrength: 70, chasers: 0, rng: mulberry32(88) });
    flick(wide, 1, 0);
    let w = 0;
    while (wide.outcome === "running" && w++ < 400) stepDribble(wide, DT);
    check(wide.outcome === "running", "running into the side of the run does not lose it for you");
    check(wide.pos.x <= wide.maxX + 1e-9, "you are held inside the corridor instead");
  }

  // A run that goes nowhere still ends.
  const stall = newDribble({ pace: 60, oppStrength: 70, chasers: 0, rng: mulberry32(31) });
  flick(stall, 0, 0.001);
  let m = 0;
  while (stall.outcome === "running" && m++ < 60 * 60) stepDribble(stall, DT);
  check(stall.outcome !== "running", `a run that goes nowhere still ends (${stall.outcome})`);
  check(m < 60 * (DRIBBLE_TIMEOUT + 12), "and does so in a reasonable time");
}

// ── Better defenders are harder to beat ─────────────────────────────────────
{
  const rate = (opp: number) => {
    const runs = Array.from({ length: 400 }, (_, i) => runDribble(60, opp, i * 11 + 5));
    return runs.filter(r => r.outcome === "through").length / runs.length;
  };
  const weak = rate(40), strong = rate(95);
  check(weak > strong, `a better defence is harder to run through (${pct(weak * 400, 400)} vs ${pct(strong * 400, 400)})`);

  const more = Array.from({ length: 400 }, (_, i) => runDribble(60, 70, i * 11 + 5, 5));
  const fewer = Array.from({ length: 400 }, (_, i) => runDribble(60, 70, i * 11 + 5, 2));
  check(more.filter(r => r.outcome === "through").length < fewer.filter(r => r.outcome === "through").length,
    "and more of them harder still");
}

// ── The match asks for runs, and asks a quick player more often ────────────
{
  const rate = (pace: number) => {
    let runs = 0, total = 0;
    for (let seed = 0; seed < 600; seed++) {
      const rng = mulberry32(seed * 31 + 7);
      const st = newMatch(rng);
      const inputs = { teamStrength: 70, oppStrength: 70, energy: 85, playerSkill: 65, pace };
      while (st.minute < 90) {
        const { request } = tick(st, inputs, rng);
        if (request) {
          total += 1;
          if (request.dribble) runs += 1;
          resolveScenario(st, request.dribble ? "lost" : "saved");
        }
      }
    }
    return { share: runs / Math.max(1, total), total };
  };

  const slow = rate(20), quick = rate(95);
  check(slow.total > 1000, "there are plenty of chances to measure");
  check(slow.share > 0.03, `runs happen (${(slow.share * 100).toFixed(0)}% of chances at pace 20)`);
  check(quick.share > slow.share, `and a quick player is given the ball to run at them more (${(quick.share * 100).toFixed(0)}% at pace 95)`);
  check(quick.share < 0.4, `but most chances are still a ball to strike (${(quick.share * 100).toFixed(0)}%)`);
}

// ── Technique expands the ball, it does not tighten the aim ────────────────
{
  check(curlRange(0) < curlRange(100), "technique decides how much of the ball you can use");
  check(curlRange(0) > 0.3, "a beginner can still bend it a little");
  check(loftRange(0) < loftRange(100), "and how much lift you can get on it");

  // The same contact, two players. The better one gets a bigger shot out of it.
  const spinFor = (tech: number) => {
    const rng = mulberry32(2);
    const sc = buildScenario("long_range", rng, 62, 60);
    const g = { x: (sc.goal.x1 + sc.goal.x2) / 2, y: 0 };
    const b = launch(sc, { x: g.x - sc.ball.x, y: g.y - sc.ball.y }, 0.9, { cx: 1, cy: 0 }, { power: 70, technique: tech }, mulberry32(2));
    return Math.abs(b.spin);
  };
  const poor = spinFor(20), good = spinFor(95);
  check(good > poor * 1.6, `the same strike bends far more for a better technician (${poor.toFixed(2)} vs ${good.toFixed(2)})`);

  const liftFor = (tech: number) => {
    const rng = mulberry32(5);
    const sc = buildScenario("long_range", rng, 62, 60);
    const g = { x: (sc.goal.x1 + sc.goal.x2) / 2, y: 0 };
    return launch(sc, { x: g.x - sc.ball.x, y: g.y - sc.ball.y }, 0.9, { cx: 0, cy: 1 }, { power: 70, technique: tech }, mulberry32(5)).vz;
  };
  check(liftFor(95) > liftFor(20), `and gets more lift out of the same contact (${liftFor(20).toFixed(2)} vs ${liftFor(95).toFixed(2)})`);

  // It must still be possible to score with poor technique — an expander that
  // gates you out of the game is just a difficulty multiplier wearing a hat.
  const goals = (tech: number) => {
    let scored = 0;
    for (let seed = 0; seed < 300; seed++) {
      const rng = mulberry32(seed * 17 + 1);
      const sc = buildScenario("one_on_one", rng, 62, 60);
      initDefenders(sc, rng);
      // At the corner away from the keeper. Aiming down the middle of the goal
      // now means aiming down the middle of HIM — he stands still, so the middle
      // is the one part of the net that is never open, and a wild technician
      // scored more than a sharp one purely by missing his target.
      const mid = (sc.goal.x1 + sc.goal.x2) / 2;
      const g = { x: sc.keeper.x < mid ? sc.goal.x2 - 0.8 : sc.goal.x1 + 0.8, y: 0 };
      const ball = launch(sc, { x: g.x - sc.ball.x, y: g.y - sc.ball.y }, 0.9, { cx: 0, cy: -0.15 }, { power: 70, technique: tech }, rng);
      let out: Outcome | null = null;
      for (let i = 0; i < 700 && !out; i++) {
        stepDefenders(sc, DT, ball.pos, false, ball);
        stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng);
        out = stepBall(ball, sc, rng, DT);
      }
      if (out === "goal") scored++;
    }
    return scored / 300;
  };
  const rough = goals(15), sharp = goals(95);
  check(rough > 0.2, `a poor technician can still finish a one-on-one (${pct(rough * 300, 300)})`);
  check(sharp >= rough - 0.05, `and a good one is no worse off (${pct(sharp * 300, 300)})`);
}

// ── Power makes the arrow more generous ────────────────────────────────────
{
  check(dragForFullPower(0) > dragForFullPower(100), "a stronger player reaches full power with a shorter pull");
  check(dragForFullPower(100) > 0.15, "but still has to ask for it");
  check(dragForFullPower(0) < 0.6, "and a weak one is not dragging off the screen");

  // The same gesture, two players: the stronger one gets more of a shot.
  const dragFraction = 0.3;
  const weak = Math.min(1, dragFraction / dragForFullPower(20));
  const strong = Math.min(1, dragFraction / dragForFullPower(90));
  check(strong > weak, `the same flick is worth more of a shot (${weak.toFixed(2)} vs ${strong.toFixed(2)} of full power)`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the dribble runs, and pace, technique and power expand what you can do");
