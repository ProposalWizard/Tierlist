import {
  initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch,
  OUTCOME_TEXT, type ScenarioKind, type Outcome, type Identity,
} from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import {
  creditChance, assistFor, noteMatePlays, probeMatePlays, type MatePlay,
} from "../../lib/star/credit";

/**
 * WHOSE ASSIST IS IT?
 *
 * Harry, playing a real match (Mikey v0.7 review, 14:28): "I'm going to have to
 * pass this off because I can't score that. There we go. And I still get an
 * assist for that even though I wasn't the one who actually assisted him."
 *
 * The old rule: a team-mate shot after your pass → your assist, whatever
 * happened in between. So your pass, HIS shot saved, ANOTHER man's rebound was
 * your assist; and your pass, his lay-off, a third man's goal was your assist.
 * The rule now (lib/star/credit.ts assistFor): the assist is the last play by a
 * team-mate other than the scorer; nobody else touched it → yours.
 *
 * Part 1 checks the rule on hand-built sequences. Part 2 plays real chances —
 * served by makeChance, as the match serves them — on the real engine — a pass from you to the runner, played out, the plays
 * logged exactly as CanvasMatch logs them — and checks every goal.
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

// ── Part 1: the rule ────────────────────────────────────────────────────────
{
  const A: MatePlay = { kind: "shot", key: "A" };
  const B: MatePlay = { kind: "shot", key: "B" };
  const layA: MatePlay = { kind: "layoff", key: "A" };
  check(assistFor([]).yours, "no team-mate play at all: yours");
  check(assistFor([A]).yours, "your pass, he scored: yours");
  check(assistFor([A, A]).yours, "your pass, his shot came back, he scored the rebound: yours");
  const r1 = assistFor([A, B]);
  check(!r1.yours && r1.by?.key === "A", "your pass, A's shot saved, B scored: A's assist");
  const r2 = assistFor([layA, B]);
  check(!r2.yours && r2.by?.key === "A", "your pass, A's lay-off, B scored: A's assist");
  const r3 = assistFor([A, B, A]);
  check(!r3.yours && r3.by?.key === "B", "A, then B's shot came back, A scored: B's assist");

  // creditChance: a team-mate's goal you did not assist is not yours at all.
  for (const res of ["goal", "rebound"] as const) {
    const off = creditChance(res, { youShot: false, receiverShot: true, isSimplePass: false, assistYours: false });
    check(off.assists === 0 && off.goals === 0, `${res}, another man assisted: no goal and no assist for you`);
    check(off.passes === 1 && off.passesCompleted === 1, `${res}, another man assisted: your pass still counts`);
    const on = creditChance(res, { youShot: false, receiverShot: true, isSimplePass: false, assistYours: true });
    check(on.assists === 1, `${res}, nobody else touched it: your assist`);
    const dflt = creditChance(res, { youShot: false, receiverShot: true, isSimplePass: false });
    check(dflt.assists === 1, `${res}, no assist info passed: unchanged (your assist)`);
  }
}

// ── Part 2: the real engine ─────────────────────────────────────────────────
const H = 1 / 180;
const KINDS: ScenarioKind[] = ["cutback", "byline_cross", "through_ball", "corner", "one_on_one", "tight_angle"];
const SEEDS = 220;
const id = (n: string): Identity => ({ id: n, name: n, shortName: n, position: "ST" });

function run(withLayoff: boolean) {
  let goals = 0, oldWrong = 0, newWrong = 0, yoursKept = 0, mateCredited = 0, rebounds = 0;
  for (const kind of KINDS) for (let s = 0; s < SEEDS; s++) {
    const rng = mulberry32(s * 2654435761 + kind.length * 97);
    // Served the way the real match serves it (the drawings), then set up.
    const sc = makeChance({ source: { from: "kind", kind }, rng, strength: { keeper: 62, team: 60, vision: 55 }, mode: "drawings" }).sc;
    initDefenders(sc, rng);
    if (!sc.runner) continue;
    sc.runner.who = id("R0");
    sc.secondaryRunners.forEach((r, i) => { r.who = id(`R${i + 1}`); });
    sc.follower.who = id("F");
    if (withLayoff && sc.secondaryRunners[0]) sc.relayTo = sc.secondaryRunners[0];
    const t = sc.runner.pos;
    const dir = { x: t.x - sc.ball.x + (rng() - 0.5) * 1.5, y: t.y - sc.ball.y + (rng() - 0.5) * 1.5 };
    const power = Math.min(0.95, 0.2 + Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y) / 32) * (0.9 + rng() * 0.2);
    const ball = launch(sc, dir, power, { cx: (rng() - 0.5) * 0.5, cy: -0.1 - rng() * 0.4 },
      { power: 65, technique: 65 }, rng);
    const plays: MatePlay[] = [];
    // An independent record of who touched it, by object, to judge the rule against.
    const touches: string[] = [];
    let out: Outcome | null = null;
    for (let i = 0; i < 180 * 12 && !out; i++) {
      stepDefenders(sc, H, ball.pos, false, ball);
      stepKeeper(sc, H);
      stepReactions(sc, ball, H, rng);
      const probe = probeMatePlays(sc);
      out = stepBall(ball, sc, rng, H);
      noteMatePlays(plays, probe, sc);
      if (!probe.relayed && sc.relayed) touches.push(probe.receivedBy?.who?.id ?? "?");
      if ((sc.receiverShots ?? 0) > probe.receiverShots) {
        touches.push(!probe.followerShot && sc.follower.shot ? "F" : sc.receivedBy?.who?.id ?? "?");
      }
    }
    if (!out || OUTCOME_TEXT[out].kind !== "goal") continue;
    if (sc.receiverShot !== true) continue;            // your own goal, not this test
    goals++;
    const scorer = touches[touches.length - 1];
    const someoneElse = touches.slice(0, -1).some((k) => k !== scorer);
    if (touches.length > 1 && !someoneElse) rebounds++;
    // What the match credited before this fix, and what it credits now.
    const before = creditChance(out, { youShot: false, receiverShot: true, isSimplePass: false });
    const a = assistFor(plays);
    const after = creditChance(out, { youShot: false, receiverShot: true, isSimplePass: false, assistYours: a.yours });
    if (someoneElse && before.assists === 1) oldWrong++;
    if (someoneElse && after.assists === 1) newWrong++;
    if (!someoneElse) {
      check(after.assists === 1, `${kind} seed ${s}: nobody else touched it, but your assist was taken away`);
      if (after.assists === 1) yoursKept++;
    } else {
      // The man credited is the last other man to play it.
      let expect: string | undefined;
      for (let i = touches.length - 2; i >= 0; i--) if (touches[i] !== scorer) { expect = touches[i]; break; }
      check(a.by?.who?.id === expect, `${kind} seed ${s}: assist went to ${a.by?.who?.id}, expected ${expect}`);
      if (a.by?.who?.id === expect) mateCredited++;
    }
  }
  return { goals, oldWrong, newWrong, yoursKept, mateCredited, rebounds };
}

const plain = run(false);
const layoff = run(true);
const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
console.log(`No orders: ${plain.goals} team-mate goals after your pass.`);
console.log(`  you were wrongly credited the assist: before ${plain.oldWrong} (${pct(plain.oldWrong, plain.goals)}) → after ${plain.newWrong}`);
console.log(`  your real assists kept: ${plain.yoursKept} (incl. ${plain.rebounds} where he scored his own rebound); assist moved to the right team-mate: ${plain.mateCredited}`);
console.log(`Captain's lay-off ordered: ${layoff.goals} team-mate goals after your pass.`);
console.log(`  you were wrongly credited the assist: before ${layoff.oldWrong} (${pct(layoff.oldWrong, layoff.goals)}) → after ${layoff.newWrong}`);
console.log(`  your real assists kept: ${layoff.yoursKept}; assist moved to the right team-mate: ${layoff.mateCredited}`);

check(plain.goals > 200 && layoff.goals > 150, "enough team-mate goals to judge the rule on");
check(plain.oldWrong > 0 && layoff.oldWrong > 0, "the old rule's mistake is still reproduced (the test measures something)");
check(plain.newWrong === 0 && layoff.newWrong === 0, "no assist is credited to you when another team-mate played it in between");
check(plain.yoursKept > plain.goals * 0.6, "most team-mate goals after your pass are still your assist");

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 20)) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("\nassistCredit: all checks passed");
