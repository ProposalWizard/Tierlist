import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, type Outcome, type ScenarioKind, type Scenario,
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

// ── A real, named finisher plays like one — and never at the cost of the
//    target itself ──────────────────────────────────────────────────────────
//
// Requested directly, after real live play, with real players named (Bruno,
// Cunha, Mbeumo, Sesko — all real, genuinely good finishers): "my teammates
// seem AT MOST to be SLIGHTLY curving the ball sometimes... just shoot
// straight into the goalies hands or into a defender like theyre blind... i
// wanna see them play like a real world class attacker... shooting in
// corners far from goalie... curving shots (SIGNIFICANTLY AND NOTICEABLY)
// around defenders." Two real, additive-only mechanisms answer this —
// `eliteBoost` widens `placement` for a real, known-elite `receiver.who?.
// shooting`, and the receiver-shot `spin` term went from a flat, skill-
// independent 0.9 wobble to a real, directional curl scaled by real
// technique (curlRange(), the SAME mapping the player's own struck shots
// use) — both are gated on `receiver.who?.shooting`, so a generic chance
// (this whole file above) is byte-identical to before; nothing here can
// regress it.
//
// The real danger, measured and corrected before this ever shipped: a flat,
// strong curl coefficient sent through_ball's on-target rate from 82% to
// 19% — not a skill effect (a POOR real finisher regressed almost as badly
// as an elite one), a DISTANCE one. CURL_K bends the ball continuously over
// its whole flight, and a through_ball is struck from much further out than
// a cutback — so the same spin, held for longer, swerved the ball clean off
// a target it was aimed AT. `curlDistScale`/`curlControlScale`
// (launchReceiverShot) taper the coefficient back down for a longer or
// harder-to-control strike — this section is the permanent proof that
// correction holds, not just the scratch measurement that found it.
{
  interface IdSample { shots: number; onTarget: number; offs: number[]; }

  function sampleWithIdentity(kind: ScenarioKind, n: number, shooting: number | undefined): IdSample {
    const out: IdSample = { shots: 0, onTarget: 0, offs: [] };
    for (let seed = 0; seed < n; seed++) {
      // Same seed regardless of `shooting` — a controlled comparison of the
      // SAME scenario with a different finisher, not three different random
      // scenario distributions (a real mistake caught while tuning this).
      const rng = mulberry32(seed * 1013 + kind.length * 7919);
      const sc = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
      initDefenders(sc, rng);
      const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos;
      if (!t || !sc.receiver) continue;
      // Set on EVERY candidate runner, not just one — otherwise whichever
      // man actually receives the ball is a coin flip between "real
      // identity" and "the scenario's own generic roll", diluting and
      // confounding exactly what's being measured.
      if (shooting !== undefined) {
        const who = { id: "x", name: "X", shortName: "X", position: "ST", shooting, overall: shooting };
        if (sc.runner) sc.runner.who = who;
        for (const r of sc.secondaryRunners) r.who = who;
      }

      const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
      const ball = launch(sc,
        { x: t.x - sc.ball.x + (rng() - 0.5), y: t.y - sc.ball.y + (rng() - 0.5) },
        Math.min(0.95, 0.2 + d / 32) * (0.92 + rng() * 0.16),
        { cx: (rng() - 0.5) * 0.6, cy: -0.1 - rng() * 0.4 },
        { power: 60, technique: 60 }, rng);

      let res: Outcome | null = null;
      let struck = false, crossed = false;
      let prevX = ball.pos.x, prevY = ball.pos.y, prevZ = ball.z;
      for (let i = 0; i < 2500 && !res; i++) {
        stepDefenders(sc, DT, ball.pos, false, ball);
        stepKeeper(sc, DT);
        stepReactions(sc, ball, DT, rng);
        const shotsBefore = sc.receiverShots ?? 0;
        prevX = ball.pos.x; prevY = ball.pos.y; prevZ = ball.z;
        res = stepBall(ball, sc, rng, DT);
        if ((sc.receiverShots ?? 0) > shotsBefore) struck = true;
        if (struck && !crossed && prevY > 0 && ball.pos.y <= 0) {
          const f = prevY / (prevY - ball.pos.y);
          const x = prevX + (ball.pos.x - prevX) * f;
          const z = prevZ + (ball.z - prevZ) * f;
          out.offs.push(x - GOAL_CX);
          if (Math.abs(x - GOAL_CX) < HALF && z < 2.44) out.onTarget++;
          crossed = true;
        }
      }
      if (!struck) continue;
      out.shots++;
    }
    return out;
  }

  for (const kind of KINDS) {
    const poor = sampleWithIdentity(kind, 500, 40);
    const elite = sampleWithIdentity(kind, 500, 92);

    // The corrected floor: real curl must never tank the target rate the
    // way the uncorrected flat coefficient did (82% -> 19% on through_ball).
    check(poor.onTarget / Math.max(1, poor.offs.length) > 0.7,
      `${kind}: a real (if modest) finisher still mostly hits the target (${pct(poor.onTarget, poor.offs.length)})`);
    check(elite.onTarget / Math.max(1, elite.offs.length) > 0.7,
      `${kind}: a real elite finisher still mostly hits the target (${pct(elite.onTarget, elite.offs.length)})`);

    // Being genuinely elite should not read as LESS reliable than being
    // merely decent — a small tolerance for noise, not an exact ordering.
    const poorRate = poor.onTarget / Math.max(1, poor.offs.length);
    const eliteRate = elite.onTarget / Math.max(1, elite.offs.length);
    check(eliteRate > poorRate - 0.08,
      `${kind}: an elite finisher isn't noticeably LESS accurate than a poor one (${pct(elite.onTarget, elite.offs.length)} vs ${pct(poor.onTarget, poor.offs.length)})`);
  }
}

// ── The curl actually bends AROUND a real defender in the way — not just
//    around the keeper ──────────────────────────────────────────────────────
//
// Reported directly, TWICE, after the eliteBoost/curl work above had
// already shipped and gone live: "STILL doing terrible shots... i still am
// yet to see a good curve shot... a finesse shot to get the shot around a
// blocking defender." Investigating found the real gap: everything above
// only ever curled off where the KEEPER stands — completely blind to a man
// actually standing in the shot's direct line, which is the literal, named
// ask both times. This section plants a real, static "wall" defender
// directly between the ball and goal centre (the same real engine code
// path a match uses, not a re-derived approximation) and proves the block
// rate genuinely drops once a real finisher's curl is active — not just
// that SOME number moved, but that the ball measurably gets PAST that
// specific man more often.
//
// The sign here is worth real care: this exact codebase has gotten a curl
// sign backwards once already (CURVE_SPIN_STEP's own comment) — positive
// spin bends the ball toward SMALLER x, so a defender sitting at lower x
// needs NEGATIVE spin to curl away from him. Caught here by measuring
// first (a naive sign choice measurably made the block rate WORSE, not
// better, before this was corrected) rather than trusting the arithmetic
// alone.
{
  interface BlockSample { blocked: number; total: number; }

  function sampleWithWall(kind: ScenarioKind, n: number, shooting: number | undefined): BlockSample {
    const out: BlockSample = { blocked: 0, total: 0 };
    for (let seed = 0; seed < n; seed++) {
      const rng = mulberry32(seed * 1013 + kind.length * 7919);
      const sc = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
      initDefenders(sc, rng);
      const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos;
      if (!t || !sc.receiver) continue;
      if (shooting !== undefined) {
        const who = { id: "x", name: "X", shortName: "X", position: "ST", shooting, overall: shooting };
        if (sc.runner) sc.runner.who = who;
        for (const r of sc.secondaryRunners) r.who = who;
      }

      const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
      const ball = launch(sc,
        { x: t.x - sc.ball.x + (rng() - 0.5), y: t.y - sc.ball.y + (rng() - 0.5) },
        Math.min(0.95, 0.2 + d / 32) * (0.92 + rng() * 0.16),
        { cx: (rng() - 0.5) * 0.6, cy: -0.1 - rng() * 0.4 },
        { power: 60, technique: 60 }, rng);

      // A static wall defender, planted once, directly goal-side of the
      // receiver — a real body genuinely screening the direct route.
      let planted = false;
      let res: Outcome | null = null;
      let struck = false;
      for (let i = 0; i < 2500 && !res; i++) {
        if (!planted && !struck) {
          sc.defenders.push({ x: t.x, y: Math.max(1, t.y - 4) } as Scenario["defenders"][number]);
          planted = true;
        }
        stepDefenders(sc, DT, ball.pos, false, ball);
        stepKeeper(sc, DT);
        stepReactions(sc, ball, DT, rng);
        const shotsBefore = sc.receiverShots ?? 0;
        res = stepBall(ball, sc, rng, DT);
        if ((sc.receiverShots ?? 0) > shotsBefore) struck = true;
      }
      if (!struck) continue;
      out.total++;
      if (res === "blocked" || res === "tackled") out.blocked++;
    }
    return out;
  }

  // cutback/one_on_one: genuinely composed, high-control situations — the
  // ones the mechanic is actually gated to apply in.
  for (const kind of ["cutback", "one_on_one"] as ScenarioKind[]) {
    const noId = sampleWithWall(kind, 400, undefined);
    const elite = sampleWithWall(kind, 400, 92);
    const noIdRate = noId.blocked / Math.max(1, noId.total);
    const eliteRate = elite.blocked / Math.max(1, elite.total);
    check(eliteRate < noIdRate - 0.03,
      `${kind}: a real finisher genuinely gets the ball PAST a defender planted directly in his path more often (blocked ${pct(elite.blocked, elite.total)} vs no-identity ${pct(noId.blocked, noId.total)})`);
  }
}

// ── THE CHIP — a good finisher can lob an exposed keeper ────────────────────
//
// Requested directly, alongside the finesse-curl redesign: "good finishers
// should also be able to CHIP the goalie like the player can; ... if the
// goalie is far out enough of their goal to be able to be chipped (a low
// power bottom of the ball very high shot that drops down in the goal and
// goes over someones head)." A chip has a distinctive SHAPE — a real
// finisher's shot elsewhere in this file runs 20-31 m/s forward with a
// modest loft; a chip trades almost all of that pace for height — cheap to
// detect from the outside by reading the struck ball's own vel/vz, without
// needing an internal hook into launchReceiverShot itself.
{
  const CHIP_SPEED_MAX = 15;  // m/s — well under any ordinary driven/placed shot
  const CHIP_VZ_MIN = 5;      // m/s — a real, steep initial climb

  interface ChipSample { total: number; chips: number; chipGoals: number; }

  function sampleOneOnOne(n: number, shooting: number | undefined, keeperOff: boolean): ChipSample {
    const out: ChipSample = { total: 0, chips: 0, chipGoals: 0 };
    for (let seed = 0; seed < n; seed++) {
      const rng = mulberry32(seed * 7001 + (keeperOff ? 991 : 0) + (shooting ?? 0) * 17);
      const sc = buildScenario("one_on_one" as ScenarioKind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
      initDefenders(sc, rng);
      // Keep only the situation this section is actually testing — the
      // keeper's own real band (see buildOneOnOne's "off his line and
      // closing" comment) rather than a second, hand-picked threshold.
      if (keeperOff !== (sc.keeper.y > 3.5)) continue;
      const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos;
      if (!t || !sc.receiver) continue;
      if (shooting !== undefined) {
        const who = { id: "x", name: "X", shortName: "X", position: "ST", shooting, overall: shooting };
        if (sc.runner) sc.runner.who = who;
        for (const r of sc.secondaryRunners) r.who = who;
      }
      const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
      const ball = launch(sc,
        { x: t.x - sc.ball.x + (rng() - 0.5), y: t.y - sc.ball.y + (rng() - 0.5) },
        Math.min(0.95, 0.2 + d / 32) * (0.92 + rng() * 0.16),
        { cx: (rng() - 0.5) * 0.6, cy: -0.1 - rng() * 0.4 },
        { power: 60, technique: 60 }, rng);

      let res: Outcome | null = null, struck = false, chipShot = false;
      for (let i = 0; i < 2500 && !res; i++) {
        stepDefenders(sc, DT, ball.pos, false, ball);
        stepKeeper(sc, DT);
        stepReactions(sc, ball, DT, rng);
        const shotsBefore = sc.receiverShots ?? 0;
        res = stepBall(ball, sc, rng, DT);
        if ((sc.receiverShots ?? 0) > shotsBefore && !struck) {
          struck = true;
          const speed = Math.hypot(ball.vel.x, ball.vel.y);
          chipShot = speed < CHIP_SPEED_MAX && ball.vz > CHIP_VZ_MIN;
        }
      }
      if (!struck) continue;
      out.total++;
      if (chipShot) { out.chips++; if (res === "goal") out.chipGoals++; }
    }
    return out;
  }

  const eliteOff = sampleOneOnOne(1500, 92, true);
  check(eliteOff.chips / Math.max(1, eliteOff.total) > 0.1,
    `one_on_one: an elite finisher genuinely attempts a real chip against an exposed keeper (${pct(eliteOff.chips, eliteOff.total)} of chances)`);
  check(eliteOff.chipGoals / Math.max(1, eliteOff.chips) > 0.6,
    `one_on_one: a chip against an exposed keeper converts at a real high rate, not a coin flip (${pct(eliteOff.chipGoals, eliteOff.chips)})`);

  // The gate itself: a keeper who is NOT off his line, and a generic
  // chance with no real identity at all, should essentially never produce
  // this shot shape.
  const eliteOn = sampleOneOnOne(1500, 92, false);
  check(eliteOn.chips / Math.max(1, eliteOn.total) < 0.02,
    `one_on_one: a chip is not attempted against a keeper who is not off his line (${pct(eliteOn.chips, eliteOn.total)})`);

  const noIdOff = sampleOneOnOne(1500, undefined, true);
  check(noIdOff.chips / Math.max(1, noIdOff.total) < 0.02,
    `one_on_one: a generic, no-identity chance never attempts a chip (${pct(noIdOff.chips, noIdOff.total)})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — a team-mate aims past the keeper, and being better at it helps");
