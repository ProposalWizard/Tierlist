import {
  buildScenario, initDefenders, stepKeeper, stepReactions, stepBall, launch,
  offsideSnapshot, clearOffside, goalInView, SCENARIO_KINDS,
  type Outcome, type Scenario, type Ball, type Vec2,
} from "../../lib/star/canvasEngine";
import { HALF_LEN } from "../../lib/star/pitch";

/**
 * Offside.
 *
 * The law mapped onto what this game has, and nothing invented to make it fit.
 * There are no body parts here, no referee and no indirect free kick — every
 * entity is a single point, so a point is what gets compared.
 *
 * The two halves are kept apart, because conflating them is what makes offside
 * systems wrong. POSITION is a state, judged once, at the instant a team-mate
 * deliberately plays the ball, with the pitch frozen for the judgement. OFFENCE
 * is an act: a man who was in an offside position then playing the ball.
 *
 * This file replaced one that asserted the flag never goes up at all, which is
 * where the rule was left after the first attempt at it flagged men who were
 * plainly onside — a scenario has one or two defenders rather than a back four,
 * so `min(defender.y)` was never a real line.
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

/** Everybody the law judges. You are never one of them — you are playing the ball. */
const judged = (sc: Scenario) => [
  ...(sc.runner ? [sc.runner] : []),
  ...sc.secondaryRunners,
];
const anyFlagged = (sc: Scenario) =>
  judged(sc).some(r => r.offside) || sc.follower.offside === true;

/** A scenario with the pieces put exactly where a case needs them. */
function rigged(opts: {
  ball: Vec2; opponents: Vec2[]; attacker: Vec2; kind?: Parameters<typeof buildScenario>[0];
}): Scenario {
  const sc = buildScenario(opts.kind ?? "long_range", mulberry32(7), 62, 60);
  sc.ball = { ...opts.ball };
  sc.player = { x: opts.ball.x + 1.3, y: opts.ball.y };
  sc.defenders = opts.opponents.slice(1).map(p => ({ ...p }));
  sc.keeper = { ...sc.keeper, x: opts.opponents[0].x, y: opts.opponents[0].y };
  sc.runner = { pos: { ...opts.attacker }, to: { ...opts.attacker }, speed: 7, moving: false, role: "target" };
  sc.secondaryRunners = [];
  sc.follower = { ...sc.follower, x: 2, y: HALF_LEN - 1 };   // parked well out of it
  return sc;
}

// ── OFF-001 / OFF-003: position, judged once, and level is onside ───────────
{
  // Opponents: keeper on the line, one defender at 20. Second-last is the
  // defender, so the line is y = 20.
  const base = { ball: { x: 34, y: 30 }, opponents: [{ x: 34, y: 0.5 }, { x: 30, y: 20 }] };

  const at = (y: number) => {
    const sc = rigged({ ...base, attacker: { x: 36, y } });
    offsideSnapshot(sc, sc.ball);
    return sc.runner!.offside === true;
  };
  check(at(18), "a man beyond the second-last opponent is in an offside position");
  check(!at(22), "…and one behind him is not");
  check(!at(20), "level with the second-last opponent is onside — the benefit is the attacker's");

  // Ahead of the ball is the other half of it.
  const behindBall = rigged({ ball: { x: 34, y: 14 }, opponents: base.opponents, attacker: { x: 36, y: 16 } });
  offsideSnapshot(behindBall, behindBall.ball);
  check(!behindBall.runner!.offside, "a man behind the ball is onside however deep the defence is");
  const levelWithBall = rigged({ ball: { x: 34, y: 16 }, opponents: base.opponents, attacker: { x: 36, y: 16 } });
  offsideSnapshot(levelWithBall, levelWithBall.ball);
  check(!levelWithBall.runner!.offside, "level with the ball is onside too");

  // Own half.
  const ownHalf = rigged({
    ball: { x: 34, y: HALF_LEN + 4 },
    opponents: [{ x: 34, y: HALF_LEN + 2 }, { x: 30, y: HALF_LEN + 3 }],
    attacker: { x: 36, y: HALF_LEN + 1 },
  });
  offsideSnapshot(ownHalf, ownHalf.ball);
  check(!ownHalf.runner!.offside, "you cannot be offside in your own half");
}

// ── The keeper is not special ───────────────────────────────────────────────
//
// The law says opponents, not goalkeepers. If he has come out, another defender
// becomes the second-last opponent and the line moves with him.
{
  const out = rigged({
    ball: { x: 34, y: 30 },
    // Keeper 25 out, two defenders at 12 and 18. Sorted: 12, 18, 25 — the
    // second-last opponent is the defender at 18, not the keeper.
    opponents: [{ x: 34, y: 25 }, { x: 30, y: 12 }, { x: 38, y: 18 }],
    attacker: { x: 36, y: 15 },
  });
  offsideSnapshot(out, out.ball);
  check(out.runner!.offside === true, "with the keeper off his line, a defender is the second-last opponent");

  const behind = rigged({
    ball: { x: 34, y: 30 },
    opponents: [{ x: 34, y: 25 }, { x: 30, y: 12 }, { x: 38, y: 18 }],
    attacker: { x: 36, y: 19 },
  });
  offsideSnapshot(behind, behind.ball);
  check(!behind.runner!.offside, "…and a man behind that defender is onside even though he is past the keeper");

  // An empty goal, one defender: no second-last opponent, so no offside. The
  // benefit of the doubt is the attacker's when the law cannot be applied.
  const alone = rigged({ ball: { x: 34, y: 30 }, opponents: [{ x: 30, y: 20 }], attacker: { x: 36, y: 4 } });
  alone.defenders = [{ x: 30, y: 20 }];
  alone.kind = "midfield_pass";           // no goal in the situation, so no keeper in it
  offsideSnapshot(alone, alone.ball);
  check(!alone.runner!.offside, "without a second-last opponent there is no line, and no offside");
}

// ── OFF-002: a position is not an offence ───────────────────────────────────
{
  const sc = rigged({
    ball: { x: 34, y: 30 },
    opponents: [{ x: 34, y: 0.5 }, { x: 30, y: 20 }],
    attacker: { x: 50, y: 10 },           // miles offside, and miles from the ball
  });
  initDefenders(sc, mulberry32(3));
  offsideSnapshot(sc, sc.ball);
  check(sc.runner!.offside === true, "he is in an offside position");

  // Now play the ball somewhere else entirely and let it run out.
  const rng = mulberry32(4);
  const ball = launch(sc, { x: -1, y: 0 }, 0.9, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
  let out: Outcome | null = null;
  for (let i = 0; i < 900 && !out; i++) { stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng); out = stepBall(ball, sc, rng, DT); }
  check(out !== "offside", `standing in an offside position is not an offence (${out})`);
}

// ── OFF-006: every deliberate attacking touch is a NEW snapshot ─────────────
{
  const sc = rigged({
    ball: { x: 34, y: 30 },
    opponents: [{ x: 34, y: 0.5 }, { x: 30, y: 20 }],
    attacker: { x: 36, y: 24 },
  });
  offsideSnapshot(sc, sc.ball);
  check(!sc.runner!.offside, "onside when the ball was played");

  // The defence steps up — away from their own goal, which in these coordinates
  // is UP the y axis — and leaves him behind. Nothing about the first judgement
  // changes…
  sc.defenders[0].y = 26;
  check(!sc.runner!.offside, "…and stays unchanged while nobody touches the ball");
  // …until the next deliberate touch, which judges him where he is now.
  offsideSnapshot(sc, { x: 34, y: 28 });
  check(sc.runner!.offside === true, "the next touch is a new snapshot, against the line as it is then");
}

// ── OFF-005: what resets it, and what does not ──────────────────────────────
{
  const sc = rigged({
    ball: { x: 34, y: 30 },
    opponents: [{ x: 34, y: 0.5 }, { x: 30, y: 20 }],
    attacker: { x: 36, y: 12 },
  });
  offsideSnapshot(sc, sc.ball);
  check(sc.runner!.offside === true, "flagged");
  clearOffside(sc);
  check(!sc.runner!.offside, "a deliberate play by a defender puts everybody onside again");
}

// ── A corner cannot produce offside directly ────────────────────────────────
{
  const sc = buildScenario("corner", mulberry32(11), 62, 60);
  if (sc.runner) sc.runner.pos = { x: 34, y: 1 };     // right on the goal line
  sc.follower = { ...sc.follower, x: 34, y: 1 };
  offsideSnapshot(sc, sc.ball);
  check(!anyFlagged(sc), "nobody can be offside from a corner");
}

// ── Nobody starts offside, because nobody stands offside ────────────────────
//
// The trap this rule sets for a game like ours. A real penalty area has a back
// four in it; ours has one or two defenders, and in a one-on-one the only one is
// BEHIND you, recovering — so the second-last opponent sits twenty metres out
// and every attacker in the box is beyond him. Measured before the fix: 400 of
// 400 one-on-ones flagged somebody and 391 ended in an offside.
//
// The answer is not to weaken the rule but to place people legally, which is
// what footballers do — a striker following a shot in times his run rather than
// standing permanently beyond the last man.
{
  for (const kind of SCENARIO_KINDS) {
    if (kind === "through_ball") continue;    // built around the line on purpose
    let flagged = 0;
    const N = 300;
    for (let seed = 0; seed < N; seed++) {
      const rng = mulberry32(seed * 11 + 5);
      const sc = buildScenario(kind, rng, 62, 60);
      initDefenders(sc, rng);
      const mates = judged(sc);
      const t = mates.length ? mates[0].pos : { x: 34, y: 0 };
      launch(sc, { x: t.x - sc.ball.x, y: t.y - sc.ball.y }, 0.55, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
      if (anyFlagged(sc)) flagged += 1;
    }
    check(flagged === 0, `${kind}: nobody is standing offside when you play the ball (${flagged}/${N})`);
  }
}

// ── …except the one situation built around the line ─────────────────────────
{
  let flagged = 0, given = 0;
  const N = 600;
  for (let seed = 0; seed < N; seed++) {
    const rng = mulberry32(seed * 11 + 5);
    const sc = buildScenario("through_ball", rng, 62, 60);
    initDefenders(sc, rng);
    const t = sc.runner!.pos;
    const ball = launch(sc, { x: t.x - sc.ball.x, y: t.y - sc.ball.y }, 0.55, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
    if (sc.runner!.offside) flagged += 1;
    let out: Outcome | null = null;
    for (let i = 0; i < 900 && !out; i++) { stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng); out = stepBall(ball, sc, rng, DT); }
    if (out === "offside") given += 1;
  }
  check(flagged > N * 0.1 && flagged < N * 0.3,
    `sometimes the man in behind has gone early (${pct(flagged, N)} of through-balls)`);
  check(given > N * 0.05, `and playing him in then is an offence (${pct(given, N)})`);
  check(given <= flagged, "never given against a man who was onside");
}

// ── Involvement, and only involvement ───────────────────────────────────────
//
// The flag surviving a save is the "gains an advantage" clause: a save is not a
// deliberate play, so a man flagged when the shot was struck who then buries the
// rebound is offside.
{
  const sc = rigged({
    ball: { x: 34, y: 24 },
    opponents: [{ x: 34, y: 0.5 }, { x: 30, y: 18 }],
    attacker: { x: 35, y: 8 },
  });
  initDefenders(sc, mulberry32(5));
  const rng = mulberry32(6);
  offsideSnapshot(sc, sc.ball);
  check(sc.runner!.offside === true, "flagged when the ball was struck");

  // A parried ball dropping to him: he plays it, and that is the offence.
  const ball: Ball = {
    pos: { x: 35, y: 10 }, vel: { x: 0, y: -6 }, z: 0.1, vz: 0,
    spin: 0, resting: false, loose: true, contactCd: 0,
    receiverControlT: 0, event: null, inNet: false,
  };
  let out: Outcome | null = null;
  for (let i = 0; i < 600 && !out; i++) { stepKeeper(sc, DT); stepReactions(sc, ball, DT, rng); out = stepBall(ball, sc, rng, DT); }
  check(out === "offside", `a flagged man playing a rebound is an offence — a save does not reset it (${out})`);
}

// ── Determinism ─────────────────────────────────────────────────────────────
//
// OFF-007: identical state, identical outcome. Nothing in the judgement rolls a
// die, which is the whole difference from what this replaced.
{
  const run = () => {
    const rng = mulberry32(4242);
    const sc = buildScenario("through_ball", rng, 62, 60);
    initDefenders(sc, rng);
    offsideSnapshot(sc, sc.ball);
    return judged(sc).map(r => r.offside).join(",") + "|" + sc.follower.offside;
  };
  check(run() === run() && run() === run(), "the same situation is judged the same way every time");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 12)) console.error("  ✗ " + p);
  if (problems.length > 12) console.error(`  …and ${problems.length - 12} more`);
  process.exit(1);
}
console.log("PASS — position and offence are separate, level is onside, and only involvement is punished");
