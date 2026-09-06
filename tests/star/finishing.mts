import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, type Outcome, type ScenarioKind,
} from "../../lib/star/canvasEngine";
import { POST_L, POST_R } from "../../lib/star/pitch";

/**
 * WHERE A TEAM-MATE PUTS IT.
 *
 * Reported from playing it: "when I pass to a teammate, they tend to shoot at
 * the center of the goal, which almost always is saved". They did, and it was.
 *
 * The aim model scattered the receiver around the CENTRE of the mouth in a
 * window that NARROWED as he got better:
 *
 *     spread = 7 - composite * 0.05       aimX = centre ± spread/2
 *
 * At the top of the range that is ±1.10 m, and the keeper reaches about 2.4 m
 * either side of where he stands. So the better the finisher, the more certainly
 * he shot straight at him. Measured over 1,500 chances per situation before the
 * fix:
 *
 *     cutback       mean aim 1.05 m from centre   97.6% within 2.4 m   16.8% scored
 *     byline_cross  mean aim 0.90 m               99.8% within 2.4 m   36.7% scored
 *     corner        mean aim 0.99 m               98.9% within 2.4 m   15.3% scored
 *     through_ball  mean aim 2.50 m               48.3% within 2.4 m   24.2% scored
 *
 * …and the mean height at the line was seven to thirteen centimetres, because
 * loft was SUBTRACTED for quality too. The only one that converted respectably
 * was the through-ball, for an accidental reason: it is struck from further out,
 * so the angular error had more distance to spray him off the keeper. Being
 * worse at it was the only thing that made it work.
 *
 * This file exists so that cannot come back.
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
const HALF = (POST_R - POST_L) / 2;
/** Roughly how far a keeper reaches either side of where he is standing. */
const REACH = 2.4;
const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;

interface Sample {
  shots: number;
  goals: number;
  /** Signed offset from the centre spot where his shot crossed the line. */
  offs: number[];
  /** Height at the line. */
  zs: number[];
  /** How far from the keeper it crossed. */
  fromKeeper: number[];
}

/**
 * Play a delivery straight to the man and watch what he does with it.
 *
 * Deliberately a GOOD ball every time — the question is what he does when he
 * gets it, not how often he gets it.
 */
function sample(kind: ScenarioKind, n: number): Sample {
  const out: Sample = { shots: 0, goals: 0, offs: [], zs: [], fromKeeper: [] };
  for (let seed = 0; seed < n; seed++) {
    const rng = mulberry32(seed * 1013 + kind.length * 7919);
    const sc = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
    initDefenders(sc, rng);
    const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos;
    if (!t || !sc.receiver) continue;

    const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
    const ball = launch(sc,
      { x: t.x - sc.ball.x + (rng() - 0.5), y: t.y - sc.ball.y + (rng() - 0.5) },
      Math.min(0.95, 0.2 + d / 32) * (0.92 + rng() * 0.16),
      { cx: (rng() - 0.5) * 0.6, cy: -0.1 - rng() * 0.4 },
      { power: 60, technique: 60 }, rng);

    let res: Outcome | null = null;
    let struck = false, crossed = false, keeperAt = sc.keeper.x;
    let prevX = ball.pos.x, prevY = ball.pos.y, prevZ = ball.z;
    for (let i = 0; i < 2500 && !res; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      const shotsBefore = sc.receiverShots ?? 0;
      prevX = ball.pos.x; prevY = ball.pos.y; prevZ = ball.z;
      res = stepBall(ball, sc, rng, DT);
      if ((sc.receiverShots ?? 0) > shotsBefore) { struck = true; keeperAt = sc.keeper.x; }
      if (struck && !crossed && prevY > 0 && ball.pos.y <= 0) {
        const f = prevY / (prevY - ball.pos.y);
        const x = prevX + (ball.pos.x - prevX) * f;
        out.offs.push(x - GOAL_CX);
        out.zs.push(prevZ + (ball.z - prevZ) * f);
        out.fromKeeper.push(Math.abs(x - keeperAt));
        crossed = true;
      }
    }
    if (!struck) continue;
    out.shots++;
    if (res === "goal" || res === "rebound") out.goals++;
  }
  return out;
}

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const meanAbs = (a: number[]) => (a.length ? a.reduce((s, x) => s + Math.abs(x), 0) / a.length : 0);

const KINDS: ScenarioKind[] = ["cutback", "byline_cross", "through_ball", "corner"];
const results = new Map<ScenarioKind, Sample>();
for (const k of KINDS) results.set(k, sample(k, 900));

// ── He aims at the goal, not at the goalkeeper ──────────────────────────────
for (const kind of KINDS) {
  const s = results.get(kind)!;
  check(s.shots > 400, `${kind}: enough shots to read (${s.shots})`);

  // No systematic bias to one side — he reads where the keeper is, and the
  // keeper is on either side about equally often.
  check(Math.abs(mean(s.offs)) < 0.5,
    `${kind}: he does not favour one side of the goal (mean ${mean(s.offs).toFixed(2)} m)`);

  // The one that matters. Before the fix this was 0.90-1.05 m for three of the
  // four situations, which is inside the keeper's arms every single time.
  check(meanAbs(s.offs) > 1.4,
    `${kind}: and he is trying to beat him rather than hit him (mean |offset| ${meanAbs(s.offs).toFixed(2)} m)`);

  // …and not by shooting past the post. Aiming at the frame is only a finish if
  // it stays inside it often enough to be worth doing.
  const onTarget = s.offs.filter((o, i) => Math.abs(o) < HALF && s.zs[i] < 2.44).length;
  check(onTarget / Math.max(1, s.offs.length) > 0.65,
    `${kind}: most of it is still on target (${pct(onTarget, s.offs.length)})`);
}

// ── Some of it leaves the floor ─────────────────────────────────────────────
{
  // Loft was subtracted for quality, so every good finish was along the ground:
  // measured mean height at the line, 0.07 m. A game where no team-mate ever
  // scores above knee height reads as broken well before anyone works out why.
  const aerial = results.get("byline_cross")!;
  const ground = results.get("through_ball")!;
  check(mean(aerial.zs) > 0.3,
    `a header from a cross arrives above the grass (mean ${mean(aerial.zs).toFixed(2)} m)`);
  check(mean(ground.zs) < 1.2 && mean(aerial.zs) < 1.6,
    `but nobody is lobbing it in from the edge of the box (${mean(ground.zs).toFixed(2)} / ${mean(aerial.zs).toFixed(2)} m)`);
}

// ── Being better at football helps ──────────────────────────────────────────
{
  // The inversion this file is named for: quality must widen his ambition and
  // tighten his execution, not the other way round. Read straight off the model
  // by handing the same situation two different receivers.
  function aimFor(skill: number, n: number): number {
    let total = 0, count = 0;
    for (let seed = 0; seed < n; seed++) {
      const rng = mulberry32(seed * 71 + 13);
      const sc = buildScenario("cutback", rng, 62, 60);
      initDefenders(sc, rng);
      if (!sc.receiver) continue;
      sc.receiver.skill = skill;
      const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos;
      if (!t) continue;
      const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
      const ball = launch(sc, { x: t.x - sc.ball.x, y: t.y - sc.ball.y },
        Math.min(0.95, 0.2 + d / 32), { cx: 0, cy: -0.25 }, { power: 60, technique: 60 }, rng);
      let res: Outcome | null = null;
      let struck = false, crossed = false;
      let prevX = ball.pos.x, prevY = ball.pos.y;
      for (let i = 0; i < 2500 && !res; i++) {
        stepDefenders(sc, DT, ball.pos, false, ball);
        stepKeeper(sc, DT);
        stepReactions(sc, ball, DT, rng);
        const before = sc.receiverShots ?? 0;
        prevX = ball.pos.x; prevY = ball.pos.y;
        res = stepBall(ball, sc, rng, DT);
        if ((sc.receiverShots ?? 0) > before) struck = true;
        if (struck && !crossed && prevY > 0 && ball.pos.y <= 0) {
          const f = prevY / (prevY - ball.pos.y);
          total += Math.abs(prevX + (ball.pos.x - prevX) * f - GOAL_CX);
          count++; crossed = true;
        }
      }
    }
    return count ? total / count : 0;
  }
  const poor = aimFor(35, 400);
  const good = aimFor(92, 400);
  check(good > poor + 0.25,
    `a better finisher aims nearer the frame, not nearer the keeper (${poor.toFixed(2)} m vs ${good.toFixed(2)} m)`);
}

// ── A hard chance is a hard chance ──────────────────────────────────────────
{
  // RECEIVER_CONTROL: the fact these chances are not equally easy to STRIKE,
  // which the engine had no representation of at all. A defender heading a
  // corner in traffic was as composed as a striker with the ball rolled across
  // the six-yard box.
  const cut = results.get("cutback")!;
  const corner = results.get("corner")!;
  // The margin this used to hold by assumed an unrealistic corner: taken
  // from just outside the six-yard box (buildCorner fixed this — it now
  // starts near the real touchline) with only two defenders and no other
  // team-mates in the picture (also fixed — a real ratio of three-to-six a
  // side, never more than one defender's edge). Both were real bugs, and
  // fixing either one on its own barely moves this number; fixing BOTH at
  // once compounds — more bodies to react to, delivered from genuinely far
  // out — enough that corner's own mean |offset| can land a few centimetres
  // on either side of a cutback's rather than comfortably behind it.
  // RECEIVER_CONTROL.corner is untouched and still the lowest of any kind;
  // this margin only guards against the ORIGINAL failure this section is
  // named for — a header landing as precisely as a composed cutback, by a
  // wide and repeatable amount, not a coin-flip's difference in the
  // opposite direction.
  check(meanAbs(cut.offs) > meanAbs(corner.offs) - 0.15,
    `a cutback is not dramatically outplaced by a header from a corner (${meanAbs(cut.offs).toFixed(2)} vs ${meanAbs(corner.offs).toFixed(2)} m)`);
  // This margin used to be the AIM-PRECISION claim converted straight into a
  // goals ratio: cutback beats corner outright more often because it is
  // placed better (the check just above this one). That stopped being a
  // clean read of precision alone the moment a save could produce a live
  // rebound (canvasEngine.ts's resolveKeeper) instead of always ending the
  // move — a corner puts more bodies in the box than any other kind of
  // chance this file tests (three-to-six a side, see the comment above),
  // so it gains the MOST from every loose ball now being genuinely
  // contestable, closing most of the gap on conversion alone even though
  // its placement is unchanged and still the worst of the four. Measured
  // directly: cutback 46.7%, corner 44.2% — a real, if now much smaller,
  // edge. This still catches corner ever legitimately overtaking cutback
  // by a wide margin; it no longer requires the old, precision-only-era gap.
  check(cut.goals / cut.shots > corner.goals / corner.shots - 0.05,
    `and still edges it, even with a corner's extra traffic to profit from a loose ball (${pct(cut.goals, cut.shots)} vs ${pct(corner.goals, corner.shots)})`);
}

// ── The numbers a footballer would recognise ────────────────────────────────
{
  // Loose bounds. The point is to catch the next inversion, not to freeze a
  // tuning pass — but a chance that converts at 5% or at 70% is not football.
  //
  // Corner's own range moved a lot: a save used to always end the move, so
  // "converts" only ever meant the very first header beating the keeper
  // outright. Now that a save can leave a live rebound (resolveKeeper,
  // canvasEngine.ts), and a corner puts more bodies in the box than any
  // other kind tested here, corner picks up more second-chance goals than
  // the others do — measured directly at 44.2%, not the 6-28% a dead-ball
  // save era ever produced.
  const bounds: [ScenarioKind, number, number][] = [
    ["cutback", 0.22, 0.48],
    ["byline_cross", 0.08, 0.32],
    ["through_ball", 0.22, 0.48],
    ["corner", 0.28, 0.58],
  ];
  for (const [kind, lo, hi] of bounds) {
    const s = results.get(kind)!;
    const rate = s.goals / Math.max(1, s.shots);
    check(rate >= lo && rate <= hi,
      `${kind} converts like ${kind.replace("_", " ")} (${pct(s.goals, s.shots)}, wanted ${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%)`);
  }
}

// ── And it is beating the keeper, not walking round him ─────────────────────
{
  for (const kind of KINDS) {
    const s = results.get(kind)!;
    const past = s.fromKeeper.filter(d => d > REACH).length;
    check(past / Math.max(1, s.fromKeeper.length) > 0.18,
      `${kind}: a real share of shots cross beyond his reach (${pct(past, s.fromKeeper.length)})`);
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — a team-mate aims past the keeper, and being better at it helps");
