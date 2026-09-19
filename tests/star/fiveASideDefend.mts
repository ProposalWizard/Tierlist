/**
 * THROWING A BODY AT IT — does the one tap you get while they are shooting
 * actually make it a decision?
 *
 * Two halves. The first is ordinary unit testing of the four pure functions in
 * lib/star/fiveASide/defend.ts. The second is the half that matters, and it is
 * the reason this file exists rather than a paragraph of reasoning: three
 * players play the same 300 matches, seed for seed, and the only difference
 * between them is what they do with the tap.
 *
 *   nobody taps anything
 *   somebody who always taps the right thing (knows the shot before it is hit)
 *   somebody who taps SOMETHING, not necessarily the right thing
 *
 * Both failures are real and both have happened to this project before. A tap
 * that is too strong turns their three chances a match into a cutscene going
 * the other way — perfect play shutting them out entirely. A tap that pays
 * whatever you hit turns a decision into a button, and the earlier drafts of
 * this mechanic did exactly that: the first one, which sent the man at the
 * ball's real line of flight the moment it was struck, measured RANDOM tapping
 * at 0.96 goals conceded against 1.01 for not acting. Flailing helped. That
 * draft was thrown away rather than tuned.
 */
import {
  initDefenders, stepReactions, stepKeeper, stepBall, launch, setOffsideRuleEnabled,
} from "../../lib/star/canvasEngine";
import type { Ball, Outcome, Scenario, Vec2 } from "../../lib/star/canvasEngine";
import {
  buildPassage, buildTheirAttack, aimTheirShot, worldFromTheirAttack, passLeadsToShot,
} from "../../lib/star/fiveASide/passage";
import {
  newFiveMatch, applyOutcome, applyTheirAttack, advanceFlow, resumeAction,
  type FiveMatchState,
} from "../../lib/star/fiveASide/match";
import { passageQuality } from "../../lib/star/fiveASide/score";
import { FIVE_A_SIDE } from "../../lib/star/fiveASide/rules";
import { leftPitch, mirror } from "../../lib/star/fiveASide/geometry";
import {
  BRACE_MS, TAP_LATENCY_MS, BLOCK_SPRINT_SPEED, BLOCK_RUN_SECONDS, KEEPER_COMMIT_SHIFT,
  commitAt, blockTargetFor, beginBlockRun, stepBlockRun, commitKeeper,
  type BlockRun, type FiveCommit,
} from "../../lib/star/fiveASide/defend";
import { mulberry32 } from "../../lib/star/season";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const DT = 1 / 60;
const DIFF = 0.5;
const C = (FIVE_A_SIDE.goal.x1 + FIVE_A_SIDE.goal.x2) / 2;
const H = (FIVE_A_SIDE.goal.x2 - FIVE_A_SIDE.goal.x1) / 2;
/** How much of the window is left once a real thumb has decided. */
const PRE = (BRACE_MS - TAP_LATENCY_MS) / 1000;

// ── A REAL PICTURE TO TEST AGAINST ──────────────────────────────────────
//
// Built through `buildTheirAttack` rather than by hand, so every one of these
// tests is looking at the same shape the game actually produces.
function theirChance(seed: number): { sc: Scenario; rng: () => number } {
  const rng = mulberry32(seed * 1013 + 7);
  let m = newFiveMatch(seed, FIVE_A_SIDE);
  for (let i = 0; i < 200 && resumeAction(m) !== "opp"; i++) {
    const act = resumeAction(m);
    if (act === "done") break;
    if (act === "flow") { m = advanceFlow(m, { difficulty: DIFF, playerSkill: 70 }).state; continue; }
    // A touch of yours that gives it straight back, so we reach one of theirs.
    const sc = buildPassage(m.world, { keeperStrength: 60, rng });
    initDefenders(sc, rng);
    const ball = launch(sc, { x: 0, y: -1 }, 0.9, { cx: 0, cy: -0.2 }, { power: 70, technique: 70 }, rng);
    let out: Outcome | null = null;
    for (let k = 0; k < 3000 && !out; k++) {
      stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng); out = stepBall(ball, sc, rng, DT);
      if (!out && leftPitch(ball.pos)) out = "out" as Outcome;
    }
    m = applyOutcome(m, (out ?? "short") as Outcome, sc, ball,
      passageQuality((out ?? "short") as Outcome, sc, null, FIVE_A_SIDE), {});
  }
  const sc = buildTheirAttack(m.world, { keeperStrength: 60, teamRelationship: 55, rng });
  sc.goal = { ...FIVE_A_SIDE.goal };
  sc.crossbar = FIVE_A_SIDE.crossbar;
  sc.viewport = { ...FIVE_A_SIDE.view };
  initDefenders(sc, rng);
  return { sc, rng };
}

// ── THE TAP LANDS ON SOMEBODY ───────────────────────────────────────────
{
  const { sc } = theirChance(3);
  const grab = 3.8;   // what the screen uses: 9% of the frame's depth

  sc.defenders.forEach((d, i) => {
    const got = commitAt(sc, { x: d.x + 0.3, y: d.y - 0.2 }, grab);
    check(
      got?.kind === "block" && got.defender === i,
      `a tap all but on your ${i}th man has to be that man, got ${JSON.stringify(got)}`,
    );
  });

  // Two men close together resolve to the nearer, never to neither.
  const a = sc.defenders[0], b = sc.defenders[1];
  const between = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const near = commitAt(sc, { x: between.x + (a.x - between.x) * 0.6, y: between.y + (a.y - between.y) * 0.6 }, grab);
  check(near?.kind === "block", "a tap between two of your men still picks one of them");

  // ── The goal mouth, both sides of it ──
  //
  // Measured with your men pulled well clear, because the rule when they are
  // not is the OTHER thing being tested here: nearest wins, and a man standing
  // on his own line is a man, not a hole in the goal.
  {
    const clear = theirChance(3).sc;
    for (const d of clear.defenders) { d.y += 18; d.x = FIVE_A_SIDE.pitch.x1 + 1; }
    const left = commitAt(clear, { x: C - H * 0.6, y: clear.keeper.y }, grab);
    const right = commitAt(clear, { x: C + H * 0.6, y: clear.keeper.y }, grab);
    check(left?.kind === "keeper" && left.side === -1, `tapping the left of the goal sends him left, got ${JSON.stringify(left)}`);
    check(right?.kind === "keeper" && right.side === 1, `tapping the right of the goal sends him right, got ${JSON.stringify(right)}`);
  }
  {
    // …and with a man standing right there, he is the one you tapped.
    const crowded = theirChance(3).sc;
    crowded.defenders[0].x = C + H * 0.6;
    crowded.defenders[0].y = crowded.keeper.y + 0.4;
    const got = commitAt(crowded, { x: C + H * 0.6, y: crowded.keeper.y }, grab);
    check(got?.kind === "block" && got.defender === 0, `a man on the line is a man, got ${JSON.stringify(got)}`);
  }

  // Empty grass is a mis-tap, and a mis-tap must cost nothing rather than
  // commit somebody you did not mean to commit.
  const far = { x: FIVE_A_SIDE.pitch.x1 + 0.2, y: FIVE_A_SIDE.pitch.y2 - 0.2 };
  const anyoneNear = sc.defenders.some(d => Math.hypot(d.x - far.x, d.y - far.y) < grab);
  if (!anyoneNear) check(commitAt(sc, far, grab) === null, "a tap on empty grass commits nobody");
}

// ── WHERE HE THROWS HIMSELF ─────────────────────────────────────────────
{
  for (let seed = 1; seed <= 30; seed++) {
    const { sc } = theirChance(seed);
    for (const d of sc.defenders) {
      const t = blockTargetFor(sc, sc.ball, d);
      // On the segment from the ball to the middle of the goal.
      const vx = C - sc.ball.x, vy = 0 - sc.ball.y;
      const len = Math.hypot(vx, vy) || 1;
      const along = ((t.x - sc.ball.x) * vx + (t.y - sc.ball.y) * vy) / len;
      const off = Math.abs((t.x - sc.ball.x) * (vy / len) - (t.y - sc.ball.y) * (vx / len));
      check(off < 1e-6, `his spot is on the line to goal, not ${off.toFixed(3)} m off it`);
      check(along >= -1e-6 && along <= len + 1e-6, `his spot is between the ball and the goal (${along.toFixed(2)} of ${len.toFixed(2)})`);
      // …and it is the NEAREST point of that line, which is what makes it the
      // spot rather than a spot.
      for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const other = { x: sc.ball.x + vx * f, y: sc.ball.y + vy * f };
        check(
          Math.hypot(t.x - d.x, t.y - d.y) <= Math.hypot(other.x - d.x, other.y - d.y) + 1e-6,
          "…and no other point of that line is closer to him",
        );
      }
    }
  }
}

// ── HE RUNS, HE STOPS, AND HE STOPS DRIFTING ────────────────────────────
{
  const { sc } = theirChance(5);
  const d = sc.defenders[0];
  const run = beginBlockRun(sc, sc.ball, d);
  const start = { x: d.x, y: d.y };
  const far = Math.hypot(run.target.x - start.x, run.target.y - start.y);

  stepBlockRun(sc, run, 0.1);
  const moved = Math.hypot(d.x - start.x, d.y - start.y);
  check(
    Math.abs(moved - Math.min(far, BLOCK_SPRINT_SPEED * 0.1)) < 1e-6,
    `a tenth of a second is ${(BLOCK_SPRINT_SPEED * 0.1).toFixed(2)} m of ground, got ${moved.toFixed(3)}`,
  );

  // He is spent after BLOCK_RUN_SECONDS, wherever that leaves him.
  {
    const { sc: s2 } = theirChance(6);
    // A man deliberately placed too far away to make it.
    const man = s2.defenders[0];
    man.x = s2.ball.x + 30; man.y = s2.ball.y + 30;
    const r2 = beginBlockRun(s2, s2.ball, man);
    for (let t = 0; t < 4; t += DT) stepBlockRun(s2, r2, DT);
    const travelled = Math.hypot(man.x - (s2.ball.x + 30), man.y - (s2.ball.y + 30));
    check(
      travelled <= BLOCK_SPRINT_SPEED * BLOCK_RUN_SECONDS + 1e-6,
      `he throws himself once — ${(BLOCK_SPRINT_SPEED * BLOCK_RUN_SECONDS).toFixed(2)} m at most, got ${travelled.toFixed(2)}`,
    );
    const left = Math.hypot(r2.target.x - man.x, r2.target.y - man.y);
    check(left > 1, "…and a man sent from miles away genuinely never arrives");
  }

  // ── The cost: he stops drifting toward the ball ──
  //
  // This is the whole reason a wrong tap is worse than no tap, so it is
  // asserted rather than described. Something else moves him — exactly as
  // `stepReactions` would — and the next step puts that back.
  {
    const { sc: s3 } = theirChance(7);
    const man = s3.defenders[1];
    const r3 = beginBlockRun(s3, s3.ball, man);
    stepBlockRun(s3, r3, DT);
    const after = { x: man.x, y: man.y };
    man.x += 5; man.y -= 4;                        // the drift he would have made
    stepBlockRun(s3, r3, DT);
    const oneStep = BLOCK_SPRINT_SPEED * DT;
    check(
      Math.hypot(man.x - after.x, man.y - after.y) <= oneStep + 1e-6,
      "a committed man never keeps ground the ordinary reaction gave him",
    );
  }
}

// ── THE KEEPER GOES, AND THE ENGINE CARRIES HIM ─────────────────────────
{
  for (const side of [-1, 1] as const) {
    const { sc } = theirChance(9);
    const was = sc.keeper.x;
    commitKeeper(sc, side);
    check(
      Math.abs(sc.keeper.targetX - (C + side * KEEPER_COMMIT_SHIFT)) < 1e-9,
      "committing sets the spot he is going to",
    );
    // Stepped by the ENGINE, not by us — the point of using `scrambling` is
    // that his travel is the same travel a spilled rebound already gets.
    for (let t = 0; t < 0.6; t += DT) stepKeeper(sc, DT);
    check(
      Math.abs(sc.keeper.x - sc.keeper.targetX) < 0.05,
      `the engine carries him there (${was.toFixed(2)} -> ${sc.keeper.x.toFixed(2)}, wanted ${sc.keeper.targetX.toFixed(2)})`,
    );
    check(
      Math.sign(sc.keeper.x - C) === side,
      "…and he ends up on the side you sent him",
    );
  }
}

// ── A BLOCK IS THE ENGINE'S OWN BLOCK ───────────────────────────────────
//
// Nothing in defend.ts decides that a shot was stopped. It moves a man, and
// `stepBall`'s own defender-reach check — the one every block in the game goes
// through — does the rest. Proved by planting a man exactly on the line of a
// shot and reading the outcome back.
{
  setOffsideRuleEnabled(false);
  let blocked = 0, n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { sc, rng } = theirChance(seed);
    const shot = aimTheirShot(sc, DIFF, rng);
    const len = Math.hypot(shot.dir.x, shot.dir.y) || 1;
    // Half a metre in front of him, dead on the line he is about to hit.
    sc.defenders[0].x = sc.ball.x + (shot.dir.x / len) * 3;
    sc.defenders[0].y = sc.ball.y + (shot.dir.y / len) * 3;
    if (sc.defenders[0].y < 0.3) continue;
    const ball = launch(sc, shot.dir, shot.power, shot.contact, shot.skills, rng);
    let out: Outcome | null = null;
    for (let i = 0; i < 600 && !out; i++) {
      stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng); out = stepBall(ball, sc, rng, DT);
    }
    n++;
    if (out === "blocked" || out === "tackled") blocked++;
  }
  check(n > 20, `enough planted shots to measure, got ${n}`);
  check(
    blocked / Math.max(1, n) > 0.8,
    `a man standing on the line of a shot blocks it — the engine's own check, ${blocked}/${n}`,
  );
  setOffsideRuleEnabled(true);
}

// ── THE MEASUREMENT ─────────────────────────────────────────────────────
type Mode = "none" | "perfect" | "random" | "keeperRight" | "keeperWrong";

function runTo(from: Vec2, target: Vec2, secs: number): Vec2 {
  const dx = target.x - from.x, dy = target.y - from.y;
  const togo = Math.hypot(dx, dy);
  if (togo < 1e-6) return { ...from };
  const step = Math.min(togo, BLOCK_SPRINT_SPEED * secs);
  return { x: from.x + (dx / togo) * step, y: from.y + (dy / togo) * step };
}

/** Which man, if any, genuinely ends up in the way — knowing the struck
 *  direction, which no real player does. The upper bound on the mechanic. */
function bestBlock(sc: Scenario, dir: Vec2): { i: number; miss: number } {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len, uy = dir.y / len;
  const SPEED = 20;   // a struck shot, near enough, for ranking only
  let best = { i: 0, miss: Infinity };
  sc.defenders.forEach((d, i) => {
    const target = blockTargetFor(sc, sc.ball, d);
    const at = runTo(d, target, Math.min(PRE, BLOCK_RUN_SECONDS));
    let px = at.x, py = at.y, miss = Infinity;
    for (let t = 0; t <= 1.6; t += 0.02) {
      const by = sc.ball.y + uy * SPEED * t;
      if (by < -0.2) break;
      const bx = sc.ball.x + ux * SPEED * t;
      if (PRE + t < BLOCK_RUN_SECONDS) {
        const dx = target.x - px, dy = target.y - py;
        const togo = Math.hypot(dx, dy);
        if (togo > 1e-6) {
          const step = Math.min(togo, BLOCK_SPRINT_SPEED * 0.02);
          px += (dx / togo) * step; py += (dy / togo) * step;
        }
      }
      miss = Math.min(miss, Math.hypot(bx - px, by - py));
    }
    if (miss < best.miss) best = { i, miss };
  });
  return best;
}

function shotSide(sc: Scenario, dir: Vec2): -1 | 1 {
  const len = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / len, uy = dir.y / len;
  const tt = uy < -1e-6 ? (0 - sc.ball.y) / uy : 0;
  return sc.ball.x + ux * tt >= C ? 1 : -1;
}

function commitFor(mode: Mode, sc: Scenario, dir: Vec2, rng: () => number): FiveCommit | null {
  if (mode === "none") return null;
  if (mode === "keeperRight") return { kind: "keeper", side: shotSide(sc, dir) };
  if (mode === "keeperWrong") return { kind: "keeper", side: -shotSide(sc, dir) as -1 | 1 };
  if (mode === "random") {
    const n = sc.defenders.length;
    const pick = Math.floor(rng() * (n + 2));
    return pick < n ? { kind: "block", defender: pick } : { kind: "keeper", side: pick === n ? -1 : 1 };
  }
  const best = bestBlock(sc, dir);
  if (best.miss < 0.9) return { kind: "block", defender: best.i };
  return { kind: "keeper", side: shotSide(sc, dir) };
}

interface Played { state: FiveMatchState; chances: number; watched: number }

function playMatch(seed: number, mode: Mode): Played {
  const rng = mulberry32(seed * 7919 + 13);
  let m = newFiveMatch(seed, FIVE_A_SIDE);
  let chances = 0, watched = 0;

  for (let guard = 0; guard < 600 && !m.over; guard++) {
    const act = resumeAction(m);
    if (act === "done") break;
    if (act === "flow") { m = advanceFlow(m, { difficulty: DIFF, playerSkill: 70 }).state; continue; }

    if (act === "opp") {
      chances++;
      const from = m.world;
      const sc = buildTheirAttack(from, { keeperStrength: 60, teamRelationship: 55, rng });
      sc.goal = { ...FIVE_A_SIDE.goal };
      sc.crossbar = FIVE_A_SIDE.crossbar;
      sc.viewport = { ...FIVE_A_SIDE.view };
      initDefenders(sc, rng);
      // Rolled before the window, exactly as the screen does it, so the tap is
      // read off the picture rather than off the dice.
      const shot = aimTheirShot(sc, DIFF, rng);
      const commit = commitFor(mode, sc, shot.dir, rng);

      let run: BlockRun | null = null;
      if (commit?.kind === "keeper") commitKeeper(sc, commit.side);
      if (commit?.kind === "block") {
        const d = sc.defenders[commit.defender];
        if (d) run = beginBlockRun(sc, sc.ball, d);
      }
      // The brace window: he is already going when the ball is struck.
      if (run) for (let t = 0; t + 1e-9 < PRE; t += DT) stepBlockRun(sc, run, DT);

      const ball = launch(sc, shot.dir, shot.power, shot.contact, shot.skills, rng);
      let out: Outcome | null = null;
      for (let i = 0; i < 3000 && !out; i++) {
        stepKeeper(sc, DT);
        stepReactions(sc, ball, DT, rng);
        if (run) stepBlockRun(sc, run, DT);
        out = stepBall(ball, sc, rng, DT);
        if (!out && leftPitch(mirror(ball.pos))) out = "out" as Outcome;
      }
      const o = (out ?? "short") as Outcome | "out";
      if (o === "goal" || o === "rebound") watched++;
      m = applyTheirAttack(m, o, worldFromTheirAttack(sc, ball.pos, from));
      continue;
    }

    // Your own touch. The same striker the rest of the five-a-side suite
    // measures with, so the matches these numbers come out of are real ones.
    const sc: Scenario = buildPassage(m.world, { keeperStrength: 40 + DIFF * 45, teamRelationship: 55, rng });
    sc.goal = { ...FIVE_A_SIDE.goal };
    sc.crossbar = FIVE_A_SIDE.crossbar;
    sc.viewport = { ...FIVE_A_SIDE.view };
    initDefenders(sc, rng);
    let dir: Vec2, power: number, contact: { cx: number; cy: number };
    if (passLeadsToShot(sc.kind)) {
      const side = rng() < 0.5 ? -1 : 1;
      const tx = C + side * Math.max(0.2, H - 0.35) * (0.55 + rng() * 0.45);
      dir = { x: tx - sc.ball.x + (rng() - 0.5) * 0.8, y: -Math.max(sc.ball.y, 1) };
      power = Math.min(1, 0.42 + Math.hypot(sc.ball.x - C, sc.ball.y) / 40) * (0.9 + rng() * 0.2);
      contact = { cx: (rng() - 0.5) * 0.6, cy: -0.1 - rng() * 0.4 };
    } else {
      const opts = sc.secondaryRunners.map(r => r.pos);
      if (!opts.length) break;
      const t = opts.reduce((a, b) => (b.y < a.y ? b : a));
      dir = { x: t.x - sc.ball.x, y: t.y - sc.ball.y };
      power = Math.min(0.95, 0.2 + Math.hypot(dir.x, dir.y) / 32);
      contact = { cx: 0, cy: -0.2 };
    }
    const ball: Ball = launch(sc, dir, power, contact, { power: 70, technique: 70 }, rng);
    let out: Outcome | null = null;
    for (let i = 0; i < 3000 && !out; i++) {
      stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
      if (!out && leftPitch(ball.pos)) out = "out" as Outcome;
    }
    const o = (out ?? "short") as Outcome | "out";
    const crossX = o === "goal" || o === "wide" || o === "over" || o === "post" ? ball.pos.x : null;
    m = applyOutcome(m, o, sc, ball, passageQuality(o, sc, crossX, FIVE_A_SIDE), {
      assist: (o === "goal" || o === "rebound") && !!sc.receiverShot,
    });
  }
  return { state: m, chances, watched };
}

{
  setOffsideRuleEnabled(false);
  const N = 300;
  const seeds = Array.from({ length: N }, (_, i) => i + 1);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const played = new Map<Mode, Played[]>();
  for (const mode of ["none", "perfect", "random", "keeperRight", "keeperWrong"] as Mode[]) {
    played.set(mode, seeds.map(n => playMatch(n, mode)));
  }
  const conceded = (mode: Mode) => avg(played.get(mode)!.map(r => r.state.score[1]));
  const perChance = (mode: Mode) => {
    const rows = played.get(mode)!;
    return sum(rows.map(r => r.watched)) / Math.max(1, sum(rows.map(r => r.chances)));
  };

  const none = conceded("none"), perfect = conceded("perfect"), random = conceded("random");
  console.log(
    `      conceded a match over ${N} matches: no input ${none.toFixed(2)}`
    + ` | perfect ${perfect.toFixed(2)} | random ${random.toFixed(2)}`,
  );
  console.log(
    `      per chance you watch: no input ${(perChance("none") * 100).toFixed(1)}%`
    + ` | keeper sent the right way ${(perChance("keeperRight") * 100).toFixed(1)}%`
    + ` | the wrong way ${(perChance("keeperWrong") * 100).toFixed(1)}%`,
  );

  // ── It has to be worth doing ──
  check(
    none - perfect > 0.15,
    `playing the tap well has to be worth real goals, saved ${(none - perfect).toFixed(3)} a match`,
  );

  // ── …and it must not close the stage down ──
  //
  // The specific failure this whole mechanic was at risk of. Note what the
  // floor is NOT: it cannot go to zero however well you play, because roughly
  // four tenths of a goal a match is scored in the simulation BETWEEN touches
  // (see flow.ts), which no defensive input can reach and which is deliberate.
  check(
    perfect > none * 0.55,
    `perfect play must not shut them out — ${perfect.toFixed(2)} against ${none.toFixed(2)}`,
  );

  // ── …and flailing must not ──
  //
  // The bar is relative rather than absolute, because "neutral" cannot be
  // asserted to more precision than 300 matches gives (about 0.06 of a goal,
  // one standard error). What can be asserted, and is the thing that matters,
  // is that a tap thrown at nothing in particular gets nowhere near what a tap
  // chosen well gets.
  check(
    none - random < (none - perfect) * 0.4,
    `tapping at random must not be a strategy — it saved ${(none - random).toFixed(3)} `
    + `against ${(none - perfect).toFixed(3)} for playing it properly`,
  );
  check(
    random < none + 0.45,
    `…but it must not be a disaster either, ${random.toFixed(2)} against ${none.toFixed(2)}`,
  );

  // ── The keeper's guess is a guess ──
  //
  // Right and wrong have to be genuinely different, or committing him is
  // noise; and the average of the two has to be no better than leaving him
  // alone, or committing him every time without looking is free money.
  const right = perChance("keeperRight"), wrong = perChance("keeperWrong"), flat = perChance("none");
  check(right < flat - 0.02, `sending him the right way has to pay (${(right * 100).toFixed(1)}% vs ${(flat * 100).toFixed(1)}%)`);
  check(wrong > flat + 0.02, `…and the wrong way has to hurt (${(wrong * 100).toFixed(1)}%)`);
  check(
    (right + wrong) / 2 > flat - 0.025,
    `a coin flip on the keeper must not beat leaving him alone `
    + `(${(((right + wrong) / 2) * 100).toFixed(1)}% vs ${(flat * 100).toFixed(1)}%)`,
  );

  setOffsideRuleEnabled(true);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the tap is a decision: playing it well is worth real goals, playing it blind is worth nothing");
