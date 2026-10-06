/**
 * THE BALL'S ACTION LOG (Animations: New, Leo 6 Oct 2026).
 *
 * The engine writes down who touched the ball and how (BallAction,
 * canvasEngine.ts) so the screen can show that man doing it. This checks the
 * record is TRUE to what happened — the outcome and the log never disagree —
 * and that every animation it drives ends inside the time the match already
 * gives it (lib/star/actionAnim.ts).
 *
 * That the log changes no physics was checked by a seeded fingerprint of
 * 5,200 chances (outcomes, ball, keeper and defenders, the next random
 * number) before and after: identical.
 */
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, SCENARIO_KINDS, type Outcome, type BallAction,
} from "../../lib/star/canvasEngine";
import {
  outfieldAnimFrame, keeperAnimFrame, animDuration, animFromAction,
  TOUCH_S, STRIKE_S, HEADER_S, BLOCK_S,
} from "../../lib/star/actionAnim";

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

const DT = 1 / 180;
const tally: Record<string, number> = {};
let chances = 0, catches = 0, heldNear = 0;

for (const kind of SCENARIO_KINDS) {
  for (let seed = 1; seed <= 150; seed++) {
    const rng = mulberry32(seed * 7919 + kind.length);
    const sc = buildScenario(kind, rng, 50 + rng() * 30, 50 + rng() * 30, 50 + rng() * 30);
    initDefenders(sc, rng);
    const tx = 34 + (rng() - 0.5) * 7;
    const tgt = rng() < 0.5 ? { x: tx, y: 0 } : (sc.runner?.pos ?? { x: tx, y: 0 });
    const ball = launch(sc, { x: tgt.x - sc.ball.x, y: tgt.y - sc.ball.y }, 0.3 + rng() * 0.7,
      { cx: (rng() - 0.5) * 1.6, cy: (rng() - 0.5) * 1.6 }, { power: 40 + rng() * 60, technique: 40 + rng() * 60 }, rng);
    const all: BallAction[] = [];
    let lastSeq = 0;
    const drain = () => {
      for (const a of ball.actionLog ?? []) if (a.seq > lastSeq) { all.push(a); lastSeq = a.seq; }
    };
    drain();
    let out: Outcome | null = null;
    for (let i = 0; i < 3000 && !out; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
      drain(); // the log holds 8; a frame never writes that many
    }
    chances++;
    const where = `${kind} #${seed} (${out})`;

    // Ordered, stamped, and never skipping a number.
    check(all.length > 0 && all[0].actor === "you" && all[0].seq === 1, `${where}: your own strike is not the first record`);
    all.forEach((a, i) => {
      check(a.seq === i + 1, `${where}: record ${i} has seq ${a.seq}`);
      if (i > 0) check(a.t >= all[i - 1].t, `${where}: record ${i} goes back in time`);
      tally[a.kind + (a.save ? ":" + a.save : "")] = (tally[a.kind + (a.save ? ":" + a.save : "")] ?? 0) + 1;
      // Every actor is somebody drawn on the pitch.
      const m = /^(run|def)(\d+)$/.exec(a.actor);
      if (m) {
        const n = Number(m[2]);
        const size = m[1] === "def" ? sc.defenders.length : (sc.runner ? 1 : 0) + sc.secondaryRunners.length;
        check(n < size, `${where}: ${a.actor} is not on the pitch (only ${size})`);
      } else {
        check(["you", "follower", "keeper"].includes(a.actor), `${where}: unknown actor ${a.actor}`);
      }
      if (a.kind === "save") check(a.actor === "keeper" && !!a.save, `${where}: a save not by the keeper`);
    });

    // The log agrees with the outcome.
    const last = all[all.length - 1];
    if (out === "caught") {
      catches++;
      check(last?.kind === "save" && last.save === "catch", `${where}: caught, but the last record is ${last?.kind}:${last?.save}`);
      // …and the ball he holds is where he ends up (the catch fix).
      for (let i = 0; i < 360 && !sc.keeper.done; i++) stepKeeper(sc, DT);
      if (Math.abs(ball.pos.x - sc.keeper.x) < 0.5) heldNear++;
    }
    if (out === "blocked") check(last?.kind === "block" && last.actor.startsWith("def"), `${where}: blocked, but the last record is ${last?.kind} by ${last?.actor}`);
    if (out === "tackled") check(all.some(a => a.kind === "clearance" && a.actor.startsWith("def")), `${where}: tackled with no clearance recorded`);
    if (out === "goal" || out === "rebound") {
      const keeper = all.filter(a => a.actor === "keeper");
      if (keeper.length) {
        const k = keeper[keeper.length - 1];
        // A goal after his last touch is a fumble or a ball that beat him —
        // never a catch he then dropped.
        check(k.save !== "catch", `${where}: a goal after a recorded catch`);
      }
    }
  }
}

check(catches > 50, `only ${catches} catches to check`);
check(heldNear / Math.max(1, catches) >= 0.97, `the caught ball ends up with the keeper in only ${heldNear}/${catches}`);
for (const k of ["shot", "pass", "touch", "block", "clearance", "save:catch", "save:parry", "save:push", "save:fumble", "save:beaten"]) {
  check((tally[k] ?? 0) > 0, `no "${k}" was ever recorded`);
}

// ── The animations end inside the time the match gives them ──
check(TOUCH_S <= 0.45 + 1e-9, "a touch outlasts the 0.45 s a team-mate holds the ball");
for (const d of [STRIKE_S, HEADER_S, BLOCK_S]) check(d <= 0.6, `an animation of ${d} s is longer than 0.6 s`);
const scene = {};
const mk = (kind: BallAction["kind"], mode?: BallAction["mode"]) =>
  animFromAction({ kind, actor: "run0", mode, seq: 1, t: 0 }, 0, scene);
for (const [kind, mode] of [["touch", "ground"], ["touch", "volley"], ["touch", "header"], ["shot", "ground"], ["shot", "curl"],
  ["shot", "volley"], ["shot", "chip"], ["shot", "header"], ["pass", "ground"], ["clearance", "ground"], ["clearance", "header"], ["block", "ground"]] as const) {
  const a = mk(kind, mode);
  const d = animDuration(a);
  check(outfieldAnimFrame(a, d * 0.5, 1) !== null, `${kind}/${mode}: nothing drawn half-way through`);
  check(outfieldAnimFrame(a, d + 0.01, 1) === null, `${kind}/${mode}: still animating after ${d} s`);
  // A left-footer is the mirror of a right-footer.
  const r = outfieldAnimFrame(a, d * 0.3, 1)!, l = outfieldAnimFrame(a, d * 0.3, -1)!;
  check(Math.abs(r.lean + l.lean) < 1e-9 && (r.pose.kickFoot ?? 1) === -(l.pose.kickFoot ?? -1), `${kind}/${mode}: left and right are not mirrors`);
}
// A header leaves the ground; nothing else jumps that high.
check(outfieldAnimFrame(mk("shot", "header"), HEADER_S / 2, 1)!.liftR > 0.4, "a header does not jump");
check(outfieldAnimFrame(mk("shot", "ground"), STRIKE_S / 2, 1)!.liftR === 0, "a ground shot leaves the ground");

// The keeper: held, one-handed, spilled.
const save = (s: BallAction["save"], z: number) =>
  animFromAction({ kind: "save", actor: "keeper", save: s, at: { x: 34, y: 0.5, z }, seq: 1, t: 0 }, 0, scene);
check(keeperAnimFrame(save("catch", 0.8), 0.5, false).handsIn === 1 && keeperAnimFrame(save("catch", 0.8), 0.5, false).holding, "a catch is not held");
check(keeperAnimFrame(save("push", 2.1), 0.3, true).trailDrop === 1, "a top-corner push is not one-handed");
check(keeperAnimFrame(save("beaten", 2.2), 0.3, false).trailDrop === 1, "beaten in the top corner is not a one-handed stretch");
check(keeperAnimFrame(save("parry", 0.5), 0.3, false).trailDrop === 0, "a low parry is one-handed");
const fum = keeperAnimFrame(save("fumble", 1.0), 0.5, false);
check(fum.handsIn === 0 && fum.armSpreadAdd > 0, "a fumble does not spill");
check(keeperAnimFrame(save("catch", 1), 0, false).flash === 1 && keeperAnimFrame(save("beaten", 1), 0, false).flash === 0, "the contact flash is wrong");
check(keeperAnimFrame(save("parry", 1), 2, false).getUp === 1, "he never gets up after a parry");

console.log(`chances ${chances}; records ${JSON.stringify(tally)}; caught ball with the keeper ${heldNear}/${catches}`);
if (problems.length) {
  console.error(`FAIL — ${problems.length} problem(s):\n  ` + problems.slice(0, 20).join("\n  "));
  process.exit(1);
}
console.log("PASS — the log matches what happened, and every animation ends inside the time the match gives it");
