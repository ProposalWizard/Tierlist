/**
 * B14 — running after a chance (lib/star/legs.ts, lib/star/playOn.ts THE RUN).
 * Harry, 20 Oct 2026: "WASD to move your player and Shift to sprint after
 * you've played the ball … a stamina bar … auto run … team-mates sometimes
 * pass back to you even before you're captain."
 *
 * The same harness as afterPassStick.mts: a served chance (makeChance), you
 * pass to a team-mate, and the real engine plays it out with CanvasMatch's
 * substep stack (stepDefenders, stepKeeper, stepReactions, stepPlayOn,
 * stepBall). Proved / measured:
 *   1. who gets the run (open play, a goal in the picture, a pass);
 *   2. the legs: speeds from pace, the bar drains sprinting and refills, never
 *      past your energy, and sprinting costs real energy;
 *   3. the keys;
 *   4. Auto run: you go toward goal, onside, never faster than your sprint;
 *   5. the ball back to you: no captaincy needed; more often from a better
 *      passer, and more often when you run into a good spot.
 */
import { makeChance } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import {
  launch, stepBall, stepReactions, stepDefenders, stepKeeper, initDefenders, orderableRunners, offsideAt,
  type Scenario, type Ball, type ScenarioKind, type Vec2, type Identity,
} from "../../lib/star/canvasEngine";
import { runAfterWanted, startPlayOnRun, stepPlayOn, steerPlayOn, sprintPlayOn, pickRunSpot, MAX_LAY_OFFS, type PlayOn } from "../../lib/star/playOn";
import { newLegs, stepLegs, setLegsEnergy, takeEnergySpent, barCap, moveKeyOf, keysScreenDir, noKeys, SPRINT_ENERGY_PER_S } from "../../lib/star/legs";
import { speedsForPace } from "../../lib/star/three3d/gait";

let fails = 0;
function check(label: string, ok: boolean, got?: unknown) {
  if (!ok) { fails++; console.log(`FAIL ${label}`, got ?? ""); } else console.log(`ok   ${label}`);
}
const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;

// ── 1. Who gets the run ──
check("a pass in a one-on-one: the run", runAfterWanted({ kind: "one_on_one", youShotAtGoal: false }));
check("a pass in a cutback / through ball / long range: the run", (["cutback", "through_ball", "long_range"] as ScenarioKind[]).every((k) => runAfterWanted({ kind: k, youShotAtGoal: false })));
check("a shot at goal: no run", !runAfterWanted({ kind: "one_on_one", youShotAtGoal: true }));
check("corner, free kick, penalty: no run", (["corner", "free_kick", "penalty"] as ScenarioKind[]).every((k) => !runAfterWanted({ kind: k, youShotAtGoal: false })));
check("a picture with no goal (build-up, midfield pass): no run", !runAfterWanted({ kind: "buildup", youShotAtGoal: false }) && !runAfterWanted({ kind: "midfield_pass", youShotAtGoal: false }));
check("someone else's kick (auto): no run", !runAfterWanted({ kind: "one_on_one", youShotAtGoal: false, auto: true }));

// ── 2. The legs ──
const H = 1 / 180;
{
  const s50 = speedsForPace(50), s90 = speedsForPace(90);
  const top = (pace: number) => { const l = newLegs({ pace }); const p = { x: 30, y: 60 }; let m = 0; for (let t = 0; t < 2; t += H) { stepLegs(l, p, { x: 0, y: -1 }, true, H); m = Math.max(m, Math.hypot(l.vel.x, l.vel.y)); } return m; };
  check(`sprint top speed = pace's sprint (pace 50: ${top(50).toFixed(2)} vs ${s50.sprint.toFixed(2)} m/s)`, Math.abs(top(50) - s50.sprint) < 0.05);
  check(`a quicker man sprints faster (pace 90: ${top(90).toFixed(2)} m/s)`, top(90) > top(50) + 0.5 && Math.abs(top(90) - s90.sprint) < 0.05);
  // Sprint to empty, physical 50: 6 s (gait.ts STAMINA.sprintSeconds).
  const l = newLegs({ pace: 50, physical: 50, energy: 100 });
  const p = { x: 30, y: 100 };
  let t = 0;
  for (; t < 12 && l.stamina.v > 0; t += H) stepLegs(l, p, { x: 0, y: -1 }, true, H, { bounds: false });
  check(`full to empty in about 6 s of sprinting (${t.toFixed(2)} s)`, t > 5.6 && t < 6.8);
  const spent = takeEnergySpent(l);
  check(`a 6 s sprint costs ${spent.toFixed(2)} energy (${SPRINT_ENERGY_PER_S}/s)`, Math.abs(spent - SPRINT_ENERGY_PER_S * t) < 0.15);
  // Empty: you run, no sprint, until a quarter is back.
  for (let u = 0; u < 1; u += H) stepLegs(l, p, { x: 0, y: -1 }, true, H, { bounds: false });
  const vE = Math.hypot(l.vel.x, l.vel.y);
  check(`empty: down to a run within a second (${vE.toFixed(2)} ≤ run ${l.speeds.run.toFixed(2)})`, vE <= l.speeds.run + 0.01);
  // Standing: it refills.
  const v0 = l.stamina.v;
  for (let u = 0; u < 2; u += H) stepLegs(l, p, { x: 0, y: 0 }, false, H, { bounds: false });
  check(`standing 2 s refills it (${v0.toFixed(2)} → ${l.stamina.v.toFixed(2)})`, l.stamina.v > v0 + 0.3);
  // The bar never passes your energy.
  const e60 = newLegs({ energy: 60 });
  check("energy 60: the bar starts at 60%", Math.abs(e60.stamina.v - 0.6) < 1e-9 && e60.cap === barCap(60));
  for (let u = 0; u < 5; u += H) stepLegs(e60, p, { x: 0, y: 0 }, false, H, { bounds: false });
  check("energy 60: standing never fills it past 60%", e60.stamina.v <= 0.6 + 1e-9);
  setLegsEnergy(e60, 40);
  check("energy drops to 40: the bar drops with it", e60.stamina.v <= 0.4 + 1e-9);
  const e0 = newLegs({ energy: 1 });
  let mx = 0;
  for (let u = 0; u < 1; u += H) { stepLegs(e0, p, { x: 0, y: -1 }, true, H, { bounds: false }); mx = Math.max(mx, Math.hypot(e0.vel.x, e0.vel.y)); }
  check("no energy left: no sprint", mx <= e0.speeds.run + 0.01);
}

// ── 3. Keys ──
check("W A S D, arrows and Shift are move keys", moveKeyOf("KeyW") === "up" && moveKeyOf("KeyA") === "left" && moveKeyOf("KeyS") === "down" && moveKeyOf("KeyD") === "right" && moveKeyOf("ArrowUp") === "up" && moveKeyOf("ShiftLeft") === "sprint");
check("other keys are not (Space, E, Q)", moveKeyOf("Space") === null && moveKeyOf("KeyE") === null && moveKeyOf("KeyQ") === null);
{
  const k = { ...noKeys(), up: true, right: true };
  const d = keysScreenDir(k);
  check("W + D: up-right, length 1", Math.abs(Math.hypot(d.x, d.y) - 1) < 1e-9 && d.x > 0 && d.y < 0);
  check("W + S cancel", keysScreenDir({ ...noKeys(), up: true, down: true }).y === 0);
}

// ── 4 & 5. The run in the real engine ──
type Bot = "auto" | "still" | "box";
interface Run { choice: string | null; caught: boolean; maxSpeed: number; startY: number; endY: number; offsideAtRead: boolean | null; startOff: boolean }

function play(kind: ScenarioKind, i: number, bot: Bot, passing?: number): Run | null {
  const rng = mulberry32(9300 + i * 61 + kind.length * 13);
  const sc: Scenario = makeChance({ source: { from: "kind", kind }, rng }).sc;
  initDefenders(sc, rng);
  const mates = orderableRunners(sc);
  if (!mates.length) return null;
  if (passing !== undefined) for (const m of mates) m.who = { id: `m${passing}`, name: "Mate", shortName: "Mate", position: "CM", overall: passing, passing } as Identity;
  const to = mates[i % mates.length].pos;
  const dx = to.x - sc.ball.x, dy = to.y - sc.ball.y, d = Math.hypot(dx, dy) || 1;
  const ball: Ball = launch(sc, { x: dx, y: dy }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
  const sp = Math.max(12, Math.min(22, 10 + d * 0.45));
  ball.vel = { x: (dx / d) * sp, y: (dy / d) * sp }; ball.vz = 0; ball.z = 0.08; ball.spin = 0; ball.shot = false; ball.youStruckAtGoal = false;
  sc.player = { x: sc.ball.x, y: sc.ball.y };
  const st: PlayOn = startPlayOnRun(sc, rng, to, { pace: 70, energy: 90 });
  if (bot === "still") st.stick!.auto = false;
  const lr = mulberry32(0x51ab ^ i);
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2;
  const box: Vec2 = { x: gcx + (to.x < gcx ? 5 : -5), y: 10 };
  const startY = sc.player.y;
  const startOff = offsideAt(sc, sc.player, to);
  let prev = { ...sc.player }, maxSpeed = 0, caught = false, offsideAtRead: boolean | null = null;
  for (let t = 0; t < 14; t += H) {
    const p = sc.player;
    if (bot === "box" && !st.layOffLive) {
      const ux = box.x - p.x, uy = box.y - p.y, ul = Math.hypot(ux, uy) || 1;
      steerPlayOn(st, ul < 1 ? 0 : ux / ul, ul < 1 ? 0 : uy / ul); sprintPlayOn(st, ul > 4);
    } else if (bot === "box") { steerPlayOn(st, 0, 0); sprintPlayOn(st, false); }
    stepDefenders(sc, H, ball.pos, false, ball); stepKeeper(sc, H); stepReactions(sc, ball, H, rng);
    const was = st.stick!.choice;
    if (stepPlayOn(st, sc, ball, H, lr, MAX_LAY_OFFS) === "caught") { caught = true; break; }
    if (was === null && st.stick!.choice !== null) offsideAtRead = offsideAt(sc, sc.player, ball.pos);
    const res = stepBall(ball, sc, rng, H);
    if (ball.event) ball.event = null;
    maxSpeed = Math.max(maxSpeed, Math.hypot(sc.player.x - prev.x, sc.player.y - prev.y) / H);
    prev = { ...sc.player };
    if (res) break;
  }
  return { choice: st.stick!.choice, caught, maxSpeed, startY, endY: sc.player.y, offsideAtRead, startOff };
}

const KINDS: ScenarioKind[] = ["one_on_one", "long_range", "cutback", "through_ball", "tight_angle"];
const N = 160;
const runs = (bot: Bot, passing?: number) => {
  const out: Run[] = [];
  for (const k of KINDS) for (let i = 0; i < N; i++) { const r = play(k, i, bot, passing); if (r) out.push(r); }
  return out;
};
const back = (rs: Run[]) => { const d = rs.filter((r) => r.choice !== null); return { n: d.length, b: d.filter((r) => r.choice === "feet" || r.choice === "through").length }; };

const auto = runs("auto");
{
  const sprint70 = speedsForPace(70).sprint;
  check(`Auto run never runs faster than your sprint (${Math.max(...auto.map((r) => r.maxSpeed)).toFixed(2)} ≤ ${sprint70.toFixed(2)} m/s)`, auto.every((r) => r.maxSpeed <= sprint70 + 0.05));
  const moved = auto.filter((r) => Math.abs(r.endY - r.startY) > 1);
  const fwd = moved.filter((r) => r.endY < r.startY).length;
  console.log(`  Auto run went toward goal in ${pct(fwd, moved.length)} of the runs that went somewhere (the rest: back onside after a square ball or a pass back)`);
  check(`Auto run goes toward goal more often than not`, fwd > 0.5 * moved.length);
  const reads = auto.filter((r) => r.offsideAtRead !== null && !r.startOff);
  const off = reads.filter((r) => r.offsideAtRead).length;
  console.log(`  onside when you passed: Auto run offside when he looks up ${pct(off, reads.length)} of ${reads.length}`);
  check("onside when you passed, Auto run rarely runs offside (< 8%)", off < 0.08 * Math.max(1, reads.length));
  const a = back(auto);
  console.log(`  Auto run, not captain: ball back to you ${pct(a.b, a.n)} of ${a.n} reads · you reach it ${pct(auto.filter((r) => r.caught).length, a.b)}`);
  check("not captain, Auto run: the ball sometimes comes back (5–45% of reads)", a.b > 0.05 * a.n && a.b < 0.45 * a.n);
}
{
  const still = back(runs("still")), box = back(runs("box"));
  console.log(`  standing still ${pct(still.b, still.n)} · sprinting into the box ${pct(box.b, box.n)}`);
  check("running into a good spot gets it back more than standing still", box.b / Math.max(1, box.n) > still.b / Math.max(1, still.n));
}
{
  const lo = back(runs("auto", 45)), hi = back(runs("auto", 88));
  console.log(`  passer 45: back ${pct(lo.b, lo.n)} of ${lo.n} · passer 88: back ${pct(hi.b, hi.n)} of ${hi.n}`);
  check("a better passer gives it back clearly more often (×1.3 or more)", hi.b / Math.max(1, hi.n) > 1.3 * (lo.b / Math.max(1, lo.n)));
}
{
  // pickRunSpot: onside, ahead of you.
  let onside = 0, ahead = 0, n = 0, wasOff = 0;
  for (const k of KINDS) for (let i = 0; i < 60; i++) {
    const rng = mulberry32(400 + i * 7 + k.length);
    const sc = makeChance({ source: { from: "kind", kind: k }, rng }).sc;
    initDefenders(sc, rng);
    const mate = orderableRunners(sc)[0]?.pos ?? sc.ball;
    const q = pickRunSpot(sc, sc.ball, mate, null);
    n++;
    const gcx = (sc.goal.x1 + sc.goal.x2) / 2;
    const rebound = Math.hypot(mate.x - gcx, mate.y) < 18 && q.x === sc.ball.x && q.y === sc.ball.y;
    if (!offsideAt(sc, q, mate) || rebound) onside++;
    if (offsideAt(sc, sc.ball, mate)) wasOff++;
    else if (q.y <= sc.ball.y + 1.01) ahead++;
  }
  console.log(`  you were past the line at your pass in ${pct(wasOff, n)} of pictures`);
  check(`Auto run's spot is onside, or you hold for the rebound beside a man about to shoot (${pct(onside, n)})`, onside === n);
  check(`onside at your pass: the spot is never more than a metre behind you (${ahead} of ${n - wasOff})`, ahead >= 0.98 * (n - wasOff));
}

// ── 6. B14b: "After you pass: Joystick" — thumb off, Auto run takes over (Harry: "sure") ──
{
  const stickRun = (thumb: "off" | "held" | "release") => {
    const rng = mulberry32(7711);
    const sc: Scenario = makeChance({ source: { from: "kind", kind: "long_range" }, rng }).sc;
    initDefenders(sc, rng);
    const to = orderableRunners(sc)[0]?.pos ?? { x: sc.ball.x + 8, y: sc.ball.y };
    const ball: Ball = launch(sc, { x: to.x - sc.ball.x, y: to.y - sc.ball.y }, 0.4, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
    ball.vz = 0; ball.z = 0.08; ball.shot = false; ball.youStruckAtGoal = false;
    sc.player = { x: sc.ball.x, y: sc.ball.y };
    const st = startPlayOnRun(sc, rng, to, { stick: true, pace: 70, energy: 90 });
    const s = st.stick!;
    const lr = mulberry32(3);
    const p0 = { ...sc.player };
    let autoAt: number | null = null, movedHeld = 0;
    for (let t = 0; t < 1.6; t += H) {
      s.held = thumb === "held" || (thumb === "release" && t < 0.5);
      steerPlayOn(st, 0, 0);
      const was = { ...sc.player };
      if (stepPlayOn(st, sc, ball, H, lr, MAX_LAY_OFFS) === "caught") break;
      if (s.held) movedHeld += Math.hypot(sc.player.x - was.x, sc.player.y - was.y);
      if (s.autoOn && autoAt === null) autoAt = t;
      stepBall(ball, sc, rng, H);
      if (ball.event) ball.event = null;
    }
    return { thumb: s.thumb, autoAt, moved: Math.hypot(sc.player.x - p0.x, sc.player.y - p0.y), movedHeld };
  };
  const off = stickRun("off"), held = stickRun("held"), rel = stickRun("release");
  console.log(`  Joystick, thumb off: Auto run from ${off.autoAt?.toFixed(2)} s, moved ${off.moved.toFixed(1)} m · thumb held still: moved ${held.movedHeld.toFixed(2)} m · let go at 0.5 s: Auto run from ${rel.autoAt?.toFixed(2)} s`);
  check("Joystick: the stick is still drawn (thumb)", off.thumb === true);
  check("Joystick, thumb never on the stick: Auto run runs you", off.autoAt !== null && off.autoAt < 0.05 && off.moved > 1);
  check("Joystick, thumb on the stick but still: you stand (no Auto run)", held.autoAt === null && held.movedHeld < 0.05);
  check("Joystick, thumb lifted at 0.5 s: Auto run takes over 0.6 s later", rel.autoAt !== null && Math.abs(rel.autoAt - 1.1) < 0.05);
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
