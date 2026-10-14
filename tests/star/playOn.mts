/**
 * THE MOVE PLAYS ON AFTER YOUR PASS (lib/star/playOn.ts) — build-ups,
 * Chances: New only.
 *
 * For each build-up kind, 300 served chances (makeChance, the drawings): you
 * pass to a team-mate and the real engine plays it out with the same substep
 * stack CanvasMatch runs (stepDefenders, stepKeeper, stepReactions, stepBall),
 * once as the game was (Old) and once with stepPlayOn in front of stepBall
 * (New). Measured:
 *   - the share of passes that end in a CUT: "delivered" (the PASS banner,
 *     the pause, then BACK TO YOU / a new picture or the commentary);
 *   - how long from your pass to the end of the move;
 *   - your run: you move toward the box, never faster than a man can;
 *   - credit: a team-mate's goal is his, and the assist is yours; a lay-off
 *     you take back is a completed pass.
 */
import { makeChance } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import {
  launch, stepBall, stepReactions, stepDefenders, stepKeeper, initDefenders, orderableRunners,
  type Scenario, type Ball, type Outcome, type ScenarioKind,
} from "../../lib/star/canvasEngine";
import { OUTCOME_TEXT } from "../../lib/star/canvasEngine";
import { creditChance } from "../../lib/star/credit";
import { playOnWanted, startPlayOn, stepPlayOn, PLAY_ON_RUN_SPEED, MAX_LAY_OFFS, carryFrom, carryOnLeadIn } from "../../lib/star/playOn";
import { leadInEntities, LEAD_MAX_RUN } from "../../lib/star/leadIn";

let fails = 0;
function check(label: string, ok: boolean, got?: unknown) {
  if (!ok) { fails++; console.log(`FAIL ${label}`, got ?? ""); } else console.log(`ok   ${label}`);
}
const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

const N = 300;
const H = 1 / 180;
const KINDS: ScenarioKind[] = ["one_on_one", "long_range", "byline_cross", "cutback"];

interface Run { played: boolean; res: Outcome | null; t: number; mateShot: boolean; caught: boolean; maxSpeed: number; ranIn: number; received: boolean }

function play(kind: ScenarioKind, i: number, on: boolean): Run | null {
  const rng = mulberry32(7100 + i * 37 + kind.length * 11);
  const sc: Scenario = makeChance({ source: { from: "kind", kind }, rng }).sc;
  initDefenders(sc, rng);
  const mates = orderableRunners(sc);
  if (!mates.length) return null;
  const to = mates[i % mates.length].pos;
  const dx = to.x - sc.ball.x, dy = to.y - sc.ball.y;
  const d = Math.hypot(dx, dy) || 1;
  const ball: Ball = launch(sc, { x: dx, y: dy }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
  // A pass that is a pass: straight at him, firm enough to get there.
  const sp = Math.max(12, Math.min(22, 10 + d * 0.45));
  ball.vel = { x: (dx / d) * sp, y: (dy / d) * sp };
  ball.vz = 0; ball.z = 0.08; ball.spin = 0; ball.shot = false; ball.youStruckAtGoal = false;
  const wanted = playOnWanted({ newChances: on, hadBuildUp: true, kind, youShotAtGoal: false });
  const st = wanted ? startPlayOn(sc, rng, to) : null;
  const layRng = mulberry32(0x51ab ^ i);
  const p0 = { ...sc.player };
  let prev = { ...sc.player };
  let maxSpeed = 0;
  let res: Outcome | null = null, t = 0, caught = false, received = false;
  for (; t < 14 && !res; t += H) {
    stepDefenders(sc, H, ball.pos, false, ball);
    stepKeeper(sc, H);
    stepReactions(sc, ball, H, rng);
    if (st && stepPlayOn(st, sc, ball, H, layRng, MAX_LAY_OFFS) === "caught") { caught = true; res = "delivered"; break; }
    res = stepBall(ball, sc, rng, H);
    if (ball.event === "received") received = true;
    if (ball.event) ball.event = null;
    const v = Math.hypot(sc.player.x - prev.x, sc.player.y - prev.y) / H;
    maxSpeed = Math.max(maxSpeed, v);
    prev = { ...sc.player };
  }
  const gc = { x: (sc.goal.x1 + sc.goal.x2) / 2, y: 0 };
  const dg = (q: { x: number; y: number }) => Math.hypot(q.x - gc.x, q.y - gc.y);
  return { played: caught || st?.layOff === true, res, t, mateShot: sc.receiverShot === true, caught, maxSpeed, ranIn: dg(p0) - dg(sc.player), received };
}

let layPlayed = 0, layCaught = 0;
for (const kind of KINDS) {
  const out: Record<"old" | "new", Run[]> = { old: [], new: [] };
  for (let i = 0; i < N; i++) {
    for (const m of ["old", "new"] as const) { const r = play(kind, i, m === "new"); if (r) out[m].push(r); }
  }
  const sum = (m: "old" | "new") => {
    const rs = out[m];
    const cut = rs.filter((r) => r.res === "delivered" && !r.caught).length;
    const caught = rs.filter((r) => r.caught).length;
    const mate = rs.filter((r) => r.mateShot).length;
    const goals = rs.filter((r) => r.mateShot && r.res && OUTCOME_TEXT[r.res].kind === "goal").length;
    const ended = rs.filter((r) => r.res && !(r.res === "delivered" && !r.caught));
    return { n: rs.length, cut, caught, mate, goals, t: med(ended.map((r) => r.t)), uncut: rs.length - cut };
  };
  const o = sum("old"), n = sum("new");
  console.log(`\n${kind}: ${n.n} passes`);
  console.log(`  cut ("delivered", BACK TO YOU / new picture):  Old ${pct(o.cut, o.n)}   New ${pct(n.cut, n.n)}`);
  console.log(`  played out uncut:                              Old ${pct(o.uncut, o.n)}   New ${pct(n.uncut, n.n)}`);
  console.log(`  team-mate shot:                                Old ${pct(o.mate, o.n)}   New ${pct(n.mate, n.n)}  (goals ${pct(o.goals, o.n)} → ${pct(n.goals, n.n)})`);
  console.log(`  laid back into your run (same picture):        New ${pct(n.caught, n.n)}`);
  console.log(`  pass → end of move, median:                    Old ${o.t.toFixed(2)} s   New ${n.t.toFixed(2)} s`);
  layPlayed += out.new.filter((r) => r.played).length; layCaught += n.caught;
  check(`${kind}: no pass ends in a cut with New`, n.cut === 0, n.cut);
  const runs = out.new;
  check(`${kind}: your run never faster than ${(PLAY_ON_RUN_SPEED * 1.1).toFixed(1)} m/s`, runs.every((r) => r.maxSpeed <= PLAY_ON_RUN_SPEED * 1.1 + 0.05), Math.max(...runs.map((r) => r.maxSpeed)));
  check(`${kind}: you run in toward goal (median ${med(runs.map((r) => r.ranIn)).toFixed(1)} m)`, med(runs.map((r) => r.ranIn)) > 1);
  // Old is the game as it was: nothing of this runs.
  check(`${kind}: Old never moves you`, out.old.every((r) => r.ranIn === 0 && !r.caught));
}

console.log(`\nlay-offs played ${layPlayed}, reached you ${layCaught} (${pct(layCaught, layPlayed)})`);
check("a lay-off reaches you at least 3 times in 4", layCaught >= 0.75 * layPlayed);

// ── A pass in a picture with no goal in it (build-up, midfield pass) ──
// Old: "delivered" ends it — PASS, a 1.6 s pause, then BACK TO YOU and a new
// picture (or the commentary). New: the next picture is reached by a carry-on
// lead-in from where everyone was (carryOnLeadIn), the camera following.
for (const kind of ["buildup", "midfield_pass"] as ScenarioKind[]) {
  let passes = 0, delivered = 0, worst = 0, endErr = 0, ballErr = 0;
  const durs: number[] = [];
  for (let i = 0; i < N; i++) {
    const rng = mulberry32(8200 + i * 41 + kind.length);
    const sc = makeChance({ source: { from: "kind", kind }, rng }).sc;
    initDefenders(sc, rng);
    const mates = orderableRunners(sc);
    if (!mates.length) continue;
    const to = mates[i % mates.length].pos;
    const dx = to.x - sc.ball.x, dy = to.y - sc.ball.y, d = Math.hypot(dx, dy) || 1;
    const ball = launch(sc, { x: dx, y: dy }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
    const sp = Math.max(12, Math.min(22, 10 + d * 0.45));
    ball.vel = { x: (dx / d) * sp, y: (dy / d) * sp }; ball.vz = 0; ball.z = 0.08; ball.spin = 0; ball.shot = false; ball.youStruckAtGoal = false;
    passes++;
    let res: Outcome | null = null;
    for (let t = 0; t < 14 && !res; t += H) {
      stepDefenders(sc, H, ball.pos, false, ball); stepKeeper(sc, H); stepReactions(sc, ball, H, rng);
      res = stepBall(ball, sc, rng, H);
    }
    if (res !== "delivered") continue;
    delivered++;
    const at = sc.receivedAt ?? ball.pos;
    const from = carryFrom(sc, { x: ball.pos.x, y: ball.pos.y });
    const next = makeChance({ source: { from: "chain", pos: { ...at }, ambition: 0.5, position: "ST" }, rng }).sc;
    const lead = carryOnLeadIn(next, from);
    durs.push(lead.durS);
    const ents = leadInEntities(next);
    const ends = ents.map((e) => e.get());
    const FR = 1 / 60;
    let prev = ents.map((e) => lead.posAt(e.key, 0) ?? e.get());
    for (let t = FR; t <= lead.durS + 1e-9; t += FR) {
      const cur = ents.map((e) => lead.posAt(e.key, t) ?? e.get());
      cur.forEach((c, k) => { worst = Math.max(worst, Math.hypot(c.x - prev[k].x, c.y - prev[k].y) / FR); });
      prev = cur;
    }
    ents.forEach((e, k) => { const q = lead.posAt(e.key, lead.durS) ?? e.get(); endErr = Math.max(endErr, Math.hypot(q.x - ends[k].x, q.y - ends[k].y)); });
    const bEnd = lead.ballAt(lead.durS); ballErr = Math.max(ballErr, Math.hypot(bEnd.x - next.ball.x, bEnd.y - next.ball.y));
  }
  console.log(`\n${kind}: ${passes} passes, ${delivered} found their man (Old: every one of these is a cut)`);
  console.log(`  New: carry-on into the next picture, median ${med(durs).toFixed(2)} s (was 1.6 s pause + a new picture)`);
  check(`${kind}: nobody in the carry-on runs faster than ${LEAD_MAX_RUN} m/s (worst ${worst.toFixed(1)})`, worst <= LEAD_MAX_RUN + 1e-6);
  check(`${kind}: the carry-on ends with everyone exactly where the next picture has them (${endErr.toFixed(3)} m)`, endErr < 1e-6);
  check(`${kind}: …and the ball on the next picture's ball (${ballErr.toFixed(3)} m)`, ballErr < 1e-6);
}

// Credit, through the game's own creditChance.
{
  const goal = creditChance("goal", { youShot: false, receiverShot: true, isSimplePass: false, assistYours: true });
  check("a team-mate's goal off your pass: your assist, not your goal", goal.assists === 1 && goal.goals === 0 && goal.passesCompleted === 1, goal);
  const saved = creditChance("saved", { youShot: false, receiverShot: true, isSimplePass: false });
  check("his shot saved: a completed pass, no shot for you", saved.passesCompleted === 1 && saved.shots === 0, saved);
  const back = creditChance("delivered", { youShot: false, receiverShot: false, isSimplePass: true });
  check("a lay-off you take back: a completed pass", back.passesCompleted === 1 && back.shots === 0, back);
}
// Only New, only after a build-up, only a pass.
check("Old: no play-on", !playOnWanted({ newChances: false, hadBuildUp: true, kind: "one_on_one", youShotAtGoal: false }));
check("no build-up: no play-on", !playOnWanted({ newChances: true, hadBuildUp: false, kind: "one_on_one", youShotAtGoal: false }));
check("your own shot: no play-on", !playOnWanted({ newChances: true, hadBuildUp: true, kind: "one_on_one", youShotAtGoal: true }));
check("no goal in the picture: no play-on", !playOnWanted({ newChances: true, hadBuildUp: true, kind: "midfield_pass", youShotAtGoal: false }));

console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);
