import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, settleBall, stepBallInNet, SCENARIO_KINDS, OUTCOME_TEXT,
  type Outcome, type Scenario, type ScenarioKind,
} from "../../lib/star/canvasEngine";
import { POST_L, POST_R } from "../../lib/star/pitch";
import { commentaryResult } from "../../lib/star/matchCommentary";

/**
 * WHAT HAPPENED, not where the ball stopped.
 *
 * Four of the fourteen outcomes the engine declares were unreachable. All four
 * had commentary written for them; three had sound and screen-shake wired up to
 * fire and never fired once in 11,700 simulated chances:
 *
 *   · `saved`    — resolveKeeper only ever returned catch, tip or a live parry,
 *                  so a shot the keeper pushed away and a defender then belted
 *                  clear was reported as "DISPOSSESSED", and one that rolled out
 *                  of the frame as "Out of play".
 *   · `post`     — only returned on a SECOND frame hit, which is pinball and
 *                  never happened. Hitting the woodwork once said nothing.
 *   · `rebound`  — tested `ball.loose`, which every re-strike clears before the
 *                  ball reaches the line. Every rebound finish was a plain goal.
 *   · `blocked`  — never returned at all, while the component had a live branch
 *                  for it and showed its banner for `tackled` instead. So the
 *                  banner said BLOCKED and the line under it said DISPOSSESSED,
 *                  about the same moment.
 *
 * The fix is naming, not physics: `ball.lastTouch` says who stopped it and
 * `ball.deflected` says the chance went through a second phase.
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
const GOAL_CX = (POST_L + POST_R) / 2;
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;

/** Kinds where the situation is asking you to shoot. */
const SHOOT: ScenarioKind[] = ["one_on_one", "tight_angle", "long_range", "volley", "header", "penalty", "free_kick"];

/** Play a chance out the way somebody who knows what they are doing would. */
function played(kind: ScenarioKind, seed: number) {
  const rng = mulberry32(seed * 1013 + kind.length * 7919);
  const sc = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
  initDefenders(sc, rng);

  let dir: { x: number; y: number };
  let power: number;
  if (SHOOT.includes(kind)) {
    const side = rng() < 0.5 ? -1 : 1;
    const tx = GOAL_CX + side * ((POST_R - POST_L) / 2 - 0.6) * (0.55 + rng() * 0.45);
    dir = { x: tx - sc.ball.x + (rng() - 0.5) * 1.2, y: -Math.max(sc.ball.y, 1) };
    power = Math.min(1, 0.42 + Math.hypot(sc.ball.x - GOAL_CX, sc.ball.y) / 40) * (0.85 + rng() * 0.3);
  } else {
    const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos ?? { x: sc.ball.x, y: sc.ball.y - 10 };
    dir = { x: t.x - sc.ball.x + (rng() - 0.5) * 1.5, y: t.y - sc.ball.y + (rng() - 0.5) * 1.5 };
    power = Math.min(0.95, 0.2 + Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y) / 32) * (0.9 + rng() * 0.2);
  }

  const ball = launch(sc, dir, power,
    { cx: (rng() - 0.5) * 0.8, cy: -0.1 - rng() * 0.45 },
    { power: 55 + rng() * 25, technique: 55 + rng() * 25 }, rng);

  let out: Outcome | null = null;
  let hitFrame = false, keeperTouched = false;
  for (let i = 0; i < 2000 && !out; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    const before = ball.postHits ?? 0;
    out = stepBall(ball, sc, rng, DT);
    if ((ball.postHits ?? 0) > before) hitFrame = true;
    if (sc.keeper.saves > 0) keeperTouched = true;
  }
  return { out: out ?? "none", sc, ball, hitFrame, keeperTouched };
}

// ── Every outcome the engine declares can actually happen ───────────────────
{
  const seen = new Map<Outcome, number>();
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 0; seed < 400; seed++) {
      const { out } = played(kind, seed);
      if (out !== "none") seen.set(out, (seen.get(out) ?? 0) + 1);
      // …and a handful struck the way people actually strike them, which is
      // sometimes into the second tier. Nobody who is aiming properly ever
      // produces `over`, and it is not a dead outcome for that.
      const rng = mulberry32(seed * 4409 + kind.length * 17);
      const sc = buildScenario(kind, rng, 55 + rng() * 20, 60, 60);
      initDefenders(sc, rng);
      const ball = launch(sc, { x: (rng() - 0.5) * 2, y: -1 + (rng() - 0.5) * 1.8 },
        0.02 + rng() * 0.98, { cx: (rng() - 0.5) * 2.2, cy: (rng() - 0.5) * 2.2 },
        { power: 5 + rng() * 95, technique: 5 + rng() * 95 }, rng);
      let wild: Outcome | null = null;
      for (let i = 0; i < 2000 && !wild; i++) {
        stepDefenders(sc, DT, ball.pos, false, ball);
        stepKeeper(sc, DT);
        stepReactions(sc, ball, DT, rng);
        wild = stepBall(ball, sc, rng, DT);
      }
      if (wild) seen.set(wild, (seen.get(wild) ?? 0) + 1);
    }
  }

  // ── …and one struck deliberately under the ball ──
  //
  // `over` came out of the random sample above four times in 5,200 shots, so
  // this block was passing on a coin that landed the right way. Any change that
  // shifts the rng stream — a builder that rolls one extra number — moved those
  // four somewhere else and the whole suite went red for a reason that had
  // nothing to do with what changed.
  //
  // A ball ballooned over the bar is not a rare accident of the physics, it is
  // what happens when somebody gets right underneath it. So get underneath it:
  // full power, contact at the very bottom, from close range. If THAT cannot
  // put a ball into the second tier then `over` really is unreachable, which is
  // the thing this check is for.
  for (let seed = 0; seed < 40; seed++) {
    const rng = mulberry32(seed * 7717 + 91);
    const sc = buildScenario("one_on_one", rng, 60, 60, 60);
    initDefenders(sc, rng);
    // cy is measured DOWN the ball, so +1 is the very bottom of it — under the
    // ball, which is what skies one. (-1 is the top, and drives it into the
    // ground: worth stating, because getting that sign backwards makes a
    // "ballooned" shot come out as a daisy-cutter and sends you hunting for a
    // bug in the goalkeeper.)
    const ball = launch(sc, { x: 0, y: -1 }, 1, { cx: 0, cy: 1 },
      { power: 95, technique: 60 }, rng);
    let out: Outcome | null = null;
    for (let i = 0; i < 2000 && !out; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
    }
    if (out) seen.set(out, (seen.get(out) ?? 0) + 1);
  }

  const declared = Object.keys(OUTCOME_TEXT) as Outcome[];
  const missing = declared.filter(o => !seen.has(o));
  check(missing.length === 0, `every declared outcome is reachable (never seen: ${missing.join(", ") || "none"})`);

  // Not merely reachable — reachable often enough to be worth the code that
  // handles it. A one-in-ten-thousand outcome is a curiosity, not a result.
  for (const o of ["saved", "blocked", "post", "rebound"] as Outcome[]) {
    check((seen.get(o) ?? 0) >= 20, `${o} happens more than once in a blue moon (${seen.get(o) ?? 0})`);
  }
}

// ── A save is reported as a save, however the ball finishes ────────────────
{
  // Every chance where the keeper got a hand to it and the move died without
  // one of your players touching it again should name HIM, not the grass it
  // rolled onto.
  let keeperEnded = 0, namedForHim = 0;
  for (const kind of SHOOT) {
    for (let seed = 0; seed < 300; seed++) {
      const { out, ball, keeperTouched } = played(kind, seed + 5000);
      if (!keeperTouched || out === "none") continue;
      if (ball.lastTouch !== "keeper") continue;   // somebody re-struck it after
      keeperEnded++;
      if (out === "saved" || out === "caught" || out === "tipped") namedForHim++;
    }
  }
  check(keeperEnded > 100, `the keeper ends a lot of chances (${keeperEnded})`);
  check(namedForHim === keeperEnded,
    `and every one of them is called a save (${namedForHim}/${keeperEnded})`);
}

// ── The woodwork gets a mention ────────────────────────────────────────────
{
  let frame = 0, calledPost = 0, scored = 0;
  for (const kind of SHOOT) {
    for (let seed = 0; seed < 400; seed++) {
      const r = played(kind, seed + 90000);
      if (!r.hitFrame || r.out === "none") continue;
      frame++;
      if (r.out === "post") calledPost++;
      if (OUTCOME_TEXT[r.out as Outcome].kind === "goal") scored++;
    }
  }
  check(frame > 25, `shots hit the frame (${frame})`);
  // It either goes in off it or it is reported as having hit it. What must not
  // happen is the third thing that used to: it hits the post, dribbles away and
  // the highlight says the move was scrambled clear.
  check(calledPost + scored > frame * 0.5,
    `and hitting it is either a goal or reported as the woodwork (${calledPost} post + ${scored} in, of ${frame})`);
}

// ── A finish from a second phase is a rebound ─────────────────────────────
{
  let goals = 0, rebounds = 0, wrongly = 0;
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 0; seed < 400; seed++) {
      const { out, ball } = played(kind, seed + 31000);
      if (out === "goal") { goals++; if (ball.deflected) wrongly++; }
      if (out === "rebound") { rebounds++; if (!ball.deflected) wrongly++; }
    }
  }
  check(rebounds > 30, `chances are finished from a rebound (${rebounds})`);
  check(goals > rebounds, `but most goals are first-time finishes (${goals} vs ${rebounds})`);
  check(wrongly === 0, `and the two are never confused (${wrongly} mislabelled)`);
}

// ── Blocked is a shot; tackled is a pass ─────────────────────────────────
{
  // A defender in the way of a ball going in has blocked it. A defender in the
  // way of one played to somebody has read it. They were the same outcome and
  // the same banner, so a wall doing exactly what a wall is for announced that
  // you had been dispossessed.
  let blockedInShots = 0, blockedInPasses = 0, tackledInPasses = 0;
  for (let seed = 0; seed < 500; seed++) {
    if (played("free_kick", seed + 700).out === "blocked") blockedInShots++;
    const mid = played("midfield_pass", seed + 700).out;
    if (mid === "blocked") blockedInPasses++;
    if (mid === "tackled") tackledInPasses++;
  }
  check(blockedInShots > 50, `a free kick driven into the wall is blocked (${blockedInShots}/500)`);
  check(tackledInPasses > 5, `a pass read by a defender is an interception (${tackledInPasses}/500)`);
  // There is no goal in the frame in midfield, so nothing there can be a block —
  // a forward pass extrapolated forty metres will sometimes pass between the
  // posts, and a defender cutting it out is not charging down a shot.
  check(blockedInPasses === 0, `and nothing in midfield is ever "blocked" (${blockedInPasses})`);
}

// ── The keeper holds one now and then ────────────────────────────────────
{
  let reached = 0, caught = 0, tipped = 0, parried = 0;
  for (const kind of SHOOT) {
    for (let seed = 0; seed < 500; seed++) {
      const rng = mulberry32(seed * 77 + kind.length * 313);
      const sc = buildScenario(kind, rng, 55 + rng() * 20, 60, 60);
      initDefenders(sc, rng);
      const side = rng() < 0.5 ? -1 : 1;
      const placed = rng() < 0.6;   // a mix of corners and shots down his throat
      const tx = GOAL_CX + (placed
        ? side * ((POST_R - POST_L) / 2 - 0.6) * (0.55 + rng() * 0.45)
        : side * rng() * 1.6);
      const ball = launch(sc,
        { x: tx - sc.ball.x + (rng() - 0.5) * 1.6, y: -Math.max(sc.ball.y, 1) },
        Math.min(1, 0.42 + Math.hypot(sc.ball.x - GOAL_CX, sc.ball.y) / 40) * (0.85 + rng() * 0.3),
        { cx: (rng() - 0.5) * 0.8, cy: -0.1 - rng() * 0.45 },
        { power: 55 + rng() * 25, technique: 55 + rng() * 25 }, rng);
      let out: Outcome | null = null, saves = 0;
      for (let i = 0; i < 2000 && !out; i++) {
        stepDefenders(sc, DT, ball.pos, false, ball);
        stepKeeper(sc, DT);
        stepReactions(sc, ball, DT, rng);
        out = stepBall(ball, sc, rng, DT);
        if (sc.keeper.saves > saves) {
          saves = sc.keeper.saves; reached++;
          if (out === "caught") caught++;
          else if (out === "tipped") tipped++;
          else if (out === null) parried++;
        }
      }
    }
  }
  // Measured before the fix: 7 catches in 2,484. The gate was `speed < 17` when
  // the median shot he gets a hand to travels at 21, and `margin > 0.5` — which
  // sounds like half his reach and is not, because height is folded into the
  // same distance and a ball along the ground spends 1.09 m of a 2.4 m budget
  // before it moves sideways at all. Half a metre either side of his boots was
  // the whole catch window.
  check(reached > 500, `the keeper gets to plenty of them (${reached})`);
  check(caught / reached > 0.05, `he holds a fair few (${pct(caught, reached)})`);
  check(caught / reached < 0.30, `but he is not a wall (${pct(caught, reached)})`);
  check(parried / reached > 0.10, `and he spills enough to make a scramble (${pct(parried, reached)})`);
  check(tipped / reached > 0.30, `while most of what beats him for placement is pushed clear (${pct(tipped, reached)})`);
}

// ── A volley is a chance, not a shooting gallery ─────────────────────────
{
  // The two defenders were placed off YOU — one a metre and a half left, one
  // three right, both a stride in front — so 47.5% of volleys were blocked from
  // two metres. buildLongRange documents exactly why that is wrong and
  // addCover already avoids it; the volley was the one situation left doing it,
  // and it is the situation where being crowded hurts most.
  let blocked = 0, goals = 0, nearest = 0;
  const N = 500;
  for (let seed = 0; seed < N; seed++) {
    const r = played("volley", seed + 4200);
    let d = Infinity;
    for (const def of r.sc.defenders) d = Math.min(d, Math.hypot(def.x - r.sc.ball.x, def.y - r.sc.ball.y));
    nearest += d;
    if (r.out === "blocked") blocked++;
    if (r.out === "goal" || r.out === "rebound") goals++;
  }
  check(nearest / N > 5, `nobody is standing on top of you at a volley (nearest ${(nearest / N).toFixed(1)} m)`);
  check(blocked / N < 0.25, `so it is not blocked before it starts (${pct(blocked, N)})`);
  check(goals / N > 0.2, `and it is worth having a go (${pct(goals, N)} scored)`);
}

// ── The line under the result describes the result ────────────────────────
{
  // Two flags, both read wrong, and between them the commentary was exactly
  // inverted on every chained chance in the game. `chain` was `receiverShot`,
  // so a pass that never reached anybody was not a chain at all and could never
  // be called a failed pass. `receiverReached` was `receiverDone`, which is
  // cleared the instant he strikes it — so it was false for every chance where
  // the pass had WORKED. You picked out a team-mate, he shot, the keeper saved
  // it, and the game said "Cut out! A defender reads it well."
  const FAILURE = /cut out|intercepted|under-hit|overhit|before it can find|reaches anyone/i;
  let reached = 0, wrongOnReached = 0, missed = 0, wrongOnMissed = 0;
  for (const kind of ["cutback", "byline_cross", "through_ball", "corner"] as ScenarioKind[]) {
    for (let seed = 0; seed < 300; seed++) {
      const rng = mulberry32(seed * 1013 + kind.length * 7919);
      const sc = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
      initDefenders(sc, rng);
      const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos;
      if (!t || !sc.receiver) continue;
      const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
      // Deliberately sloppier than `played` — some of these have to miss him.
      const ball = launch(sc,
        { x: t.x - sc.ball.x + (rng() - 0.5) * 3.5, y: t.y - sc.ball.y + (rng() - 0.5) * 3.5 },
        Math.min(0.95, 0.2 + d / 32) * (0.8 + rng() * 0.45),
        { cx: (rng() - 0.5) * 0.8, cy: -0.1 - rng() * 0.45 },
        { power: 55 + rng() * 25, technique: 55 + rng() * 25 }, rng);
      let out: Outcome | null = null;
      for (let i = 0; i < 2000 && !out; i++) {
        stepDefenders(sc, DT, ball.pos, false, ball);
        stepKeeper(sc, DT);
        stepReactions(sc, ball, DT, rng);
        out = stepBall(ball, sc, rng, DT);
      }
      if (!out) continue;
      const line = commentaryResult(out, rng, {
        chain: sc.receiver != null,
        receiverReached: sc.receiverReached === true,
        roleLabel: "the striker",
        isPass: false,
      });
      if (sc.receiverReached) { reached++; if (FAILURE.test(line)) wrongOnReached++; }
      else { missed++; if (out !== "offside" && !FAILURE.test(line) && !/out of play/i.test(line)) wrongOnMissed++; }
    }
  }
  check(reached > 400 && missed > 40, `passes both find their man and fail to (${reached} reached, ${missed} missed)`);
  check(wrongOnReached === 0, `a pass that found him is never called a failed pass (${wrongOnReached}/${reached})`);
  check(wrongOnMissed < missed * 0.2, `and one that did not is not credited to him (${wrongOnMissed}/${missed})`);
}

// ── After the whistle, the ball stays where you can see it ────────────────
{
  // "You watch it go" was the whole reason a saved ball keeps travelling after
  // the outcome is decided. Measured: 74% of them were off the visible frame
  // within two and a half seconds — some seventeen metres past it — and 1,695
  // of 1,701 were still rolling when the highlight ended. You watched it leave
  // and then watched an empty rectangle. A keeper's tip left at 9-16 m/s
  // against 1.9 m/s² of rolling resistance, which is forty metres of running.
  let settled = 0, gone = 0, goals = 0, outsideTheNet = 0;
  for (const kind of SCENARIO_KINDS) {
    for (let seed = 0; seed < 250; seed++) {
      const { out, sc, ball } = played(kind, seed + 61000);
      if (out === "none") continue;
      for (let i = 0; i < 150; i++) { settleBall(ball, DT, sc); stepBallInNet(ball, DT); }
      if (OUTCOME_TEXT[out as Outcome].kind === "goal") {
        goals++;
        if (ball.pos.x < POST_L - 0.3 || ball.pos.x > POST_R + 0.3 || ball.pos.y > 0.6) outsideTheNet++;
      } else if (ball.settling) {
        settled++;
        const vp = sc.viewport;
        if (ball.pos.x < vp.x1 || ball.pos.x > vp.x2 || ball.pos.y < vp.y1 || ball.pos.y > vp.y2) gone++;
      }
    }
  }
  check(settled > 300 && goals > 300, `plenty of both to look at (${settled} settling, ${goals} goals)`);
  check(gone <= settled * 0.01, `a ball pushed clear finishes inside the frame (${gone}/${settled} left it)`);
  check(outsideTheNet === 0, `and a goal finishes inside the net (${outsideTheNet}/${goals} did not)`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — every outcome happens, and each one is called what it is");
