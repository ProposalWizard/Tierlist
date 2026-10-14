/**
 * "After you pass: Joystick" (lib/star/afterPass.ts, lib/star/playOn.ts THE
 * JOYSTICK). Harry, 14 Oct 2026.
 *
 * The same harness as playOn.mts: a served chance (makeChance), you pass to a
 * team-mate, and the real engine plays it out with CanvasMatch's substep stack
 * (stepDefenders, stepKeeper, stepReactions, stepPlayOn, stepBall). "You" are a
 * bot on the stick, played several ways:
 *   still      — you let go of the stick
 *   drift      — a small push away from goal
 *   jog        — a half push into the box
 *   sprint     — a full push into the box (toward the far post)
 * and, once a pass to you is on its way, a full push onto the ball.
 * Measured: how often he shoots, plays it to your feet, or slides you in; how
 * often you reach it; your speeds; the captain's call.
 * Proved: Old, and New on "Auto run", are byte-identical to before (a hash
 * of every chance's end, taken on the code before the joystick existed).
 */
import { makeChance } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import {
  launch, stepBall, stepReactions, stepDefenders, stepKeeper, initDefenders, orderableRunners,
  type Scenario, type Ball, type Outcome, type ScenarioKind, type Vec2,
} from "../../lib/star/canvasEngine";
import {
  startPlayOn, stepPlayOn, startPlayOnStick, steerPlayOn, callForIt, callForItShown, playOnStickWanted, stickRead, shotValue,
  MAX_LAY_OFFS, PLAY_ON_RUN_SPEED, type PlayOn,
} from "../../lib/star/playOn";
import { STICK_SPRINT } from "../../lib/star/firstPersonDribble";
import { parseAfterPassMode, afterPassMode, forceAfterPassMode, AFTER_PASS_DEFAULT } from "../../lib/star/afterPass";
import { playOnFingerprint } from "./afterPassFingerprint";

let fails = 0;
function check(label: string, ok: boolean, got?: unknown) {
  if (!ok) { fails++; console.log(`FAIL ${label}`, got ?? ""); } else console.log(`ok   ${label}`);
}
const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;

// ── 1. Auto run and Old are untouched ──
// Hashes taken on the code before the joystick (Harry branch at 4b46681).
const OLD_FP = "f75e6571", AUTO_FP = "2a3a379e";
check(`Old play-on fingerprint unchanged (${playOnFingerprint(false)})`, playOnFingerprint(false) === OLD_FP);
check(`New + Auto run play-on fingerprint unchanged (${playOnFingerprint(true)})`, playOnFingerprint(true) === AUTO_FP);
{
  const sc = makeChance({ source: { from: "kind", kind: "one_on_one" }, rng: mulberry32(3) }).sc;
  check("Auto run's play-on carries no stick", startPlayOn(sc, mulberry32(4)).stick === undefined);
}
check("the setting defaults to Auto run", AFTER_PASS_DEFAULT === "auto" && afterPassMode() === "auto");
check("?afterpass=stick / auto parse; anything else is ignored", parseAfterPassMode("stick") === "stick" && parseAfterPassMode("auto") === "auto" && parseAfterPassMode("x") === null);
forceAfterPassMode("stick");
check("a forced Joystick reads back", afterPassMode() === "stick");
forceAfterPassMode(null);
check("Old chances: never a joystick", !playOnStickWanted({ newChances: false, stick: true, kind: "one_on_one", youShotAtGoal: false }));
check("Auto run: never a joystick", !playOnStickWanted({ newChances: true, stick: false, kind: "one_on_one", youShotAtGoal: false }));
check("your own shot: no joystick", !playOnStickWanted({ newChances: true, stick: true, kind: "one_on_one", youShotAtGoal: true }));
check("a corner / a free kick: no joystick", !playOnStickWanted({ newChances: true, stick: true, kind: "corner", youShotAtGoal: false }) && !playOnStickWanted({ newChances: true, stick: true, kind: "free_kick", youShotAtGoal: false }));
check("a pass in a one-on-one, no build-up needed: joystick", playOnStickWanted({ newChances: true, stick: true, kind: "one_on_one", youShotAtGoal: false }));

// ── 2. The joystick, measured ──
const H = 1 / 180;
const N = 300;
const KINDS: ScenarioKind[] = ["one_on_one", "long_range", "cutback", "through_ball", "byline_cross"];
type Bot = "still" | "drift" | "jog" | "sprint";
interface Run { choice: string | null; caught: boolean; res: Outcome | null; maxSpeed: number; youValue: number; hisValue: number; note: string | null; called: boolean }

function play(kind: ScenarioKind, i: number, bot: Bot, call: "no" | "early" | "late" = "no"): Run | null {
  const rng = mulberry32(9100 + i * 53 + kind.length * 7);
  const sc: Scenario = makeChance({ source: { from: "kind", kind }, rng }).sc;
  initDefenders(sc, rng);
  const mates = orderableRunners(sc);
  if (!mates.length) return null;
  const to = mates[i % mates.length].pos;
  const dx = to.x - sc.ball.x, dy = to.y - sc.ball.y, d = Math.hypot(dx, dy) || 1;
  const ball: Ball = launch(sc, { x: dx, y: dy }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
  const sp = Math.max(12, Math.min(22, 10 + d * 0.45));
  ball.vel = { x: (dx / d) * sp, y: (dy / d) * sp }; ball.vz = 0; ball.z = 0.08; ball.spin = 0; ball.shot = false; ball.youStruckAtGoal = false;
  sc.player = { x: sc.ball.x, y: sc.ball.y };
  const st: PlayOn = startPlayOnStick(sc, rng, to);
  const lr = mulberry32(0x51ab ^ i);
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2;
  // Into the box, on the other side of the man you passed to.
  const runTo: Vec2 = { x: gcx + (to.x < gcx ? 5 : -5), y: 9 };
  let prev = { ...sc.player }, maxSpeed = 0;
  let res: Outcome | null = null, caught = false, youValue = 0, hisValue = 0, called = false;
  for (let t = 0; t < 14 && !res; t += H) {
    const p = sc.player;
    if (st.layOffLive) {
      const lead = { x: ball.pos.x + ball.vel.x * 0.3, y: ball.pos.y + ball.vel.y * 0.3 };
      steerPlayOn(st, lead.x - p.x, lead.y - p.y);
    } else if (bot === "still") steerPlayOn(st, 0, 0);
    else if (bot === "drift") steerPlayOn(st, 0, 0.3);
    else {
      const ux = runTo.x - p.x, uy = runTo.y - p.y, ul = Math.hypot(ux, uy) || 1;
      const k = ul < 1 ? 0 : bot === "jog" ? 0.6 : 1;
      steerPlayOn(st, (ux / ul) * k, (uy / ul) * k);
    }
    if (call === "early" && t > 0.05 && !called) { callForIt(st, sc); called = true; }
    if (call === "late" && sc.receiverShot && !called) { called = true; st.stick!.note = callForIt(st, sc) === "late" ? "late" : null; }
    stepDefenders(sc, H, ball.pos, false, ball); stepKeeper(sc, H); stepReactions(sc, ball, H, rng);
    const wasChoice = st.stick!.choice;
    if (stepPlayOn(st, sc, ball, H, lr, MAX_LAY_OFFS) === "caught") { caught = true; res = "delivered"; break; }
    if (wasChoice === null && st.stick!.choice !== null) { youValue = shotValue(sc, sc.player); hisValue = st.stick!.read?.his ?? 0; }
    res = stepBall(ball, sc, rng, H);
    if (ball.event) ball.event = null;
    maxSpeed = Math.max(maxSpeed, Math.hypot(sc.player.x - prev.x, sc.player.y - prev.y) / H);
    prev = { ...sc.player };
  }
  return { choice: st.stick!.choice, caught, res, maxSpeed, youValue, hisValue, note: st.stick!.note, called };
}

const all: Record<Bot, Run[]> = { still: [], drift: [], jog: [], sprint: [] };
for (const bot of ["still", "drift", "jog", "sprint"] as Bot[]) {
  for (const kind of KINDS) for (let i = 0; i < N; i++) { const r = play(kind, i, bot); if (r) all[bot].push(r); }
  const rs = all[bot];
  const decided = rs.filter((r) => r.choice !== null);
  const feet = decided.filter((r) => r.choice === "feet").length, thr = decided.filter((r) => r.choice === "through").length;
  const passes = feet + thr, caught = rs.filter((r) => r.caught).length;
  console.log(`\n${bot}: ${decided.length} times a team-mate had your pass`);
  console.log(`  he shoots ${pct(decided.length - passes, decided.length)} · to your feet ${pct(feet, decided.length)} · through ball ${pct(thr, decided.length)} · you reach it ${pct(caught, passes)} of his passes`);
  check(`${bot}: you never run faster than a sprint (${Math.max(...rs.map((r) => r.maxSpeed)).toFixed(2)} m/s)`, rs.every((r) => r.maxSpeed <= PLAY_ON_RUN_SPEED * STICK_SPRINT + 0.05));
}
const share = (b: Bot, c: string) => { const d = all[b].filter((r) => r.choice !== null); return d.filter((r) => r.choice === c).length / Math.max(1, d.length); };
const passShare = (b: Bot) => share(b, "feet") + share(b, "through");
check("standing still: never a through ball", share("still", "through") === 0);
check(`a sprint into the box gets through balls (${(100 * share("sprint", "through")).toFixed(1)}%)`, share("sprint", "through") > 0.05);
check("running in gets the ball more than drifting away", passShare("sprint") > passShare("drift") && passShare("jog") > passShare("drift"));
check("he still shoots most of the time", (["still", "drift", "jog", "sprint"] as Bot[]).every((b) => passShare(b) < 0.7));
{
  const ps = all.sprint.filter((r) => r.choice === "feet" || r.choice === "through");
  const caught = ps.filter((r) => r.caught).length;
  check(`steering onto it, you reach most passes (${pct(caught, ps.length)})`, caught >= 0.6 * ps.length);
}
{
  // A better-placed you gets it more often: split every decision by how good your spot was against his.
  const d = [...all.still, ...all.jog, ...all.sprint, ...all.drift].filter((r) => r.choice !== null);
  const better = d.filter((r) => r.youValue > r.hisValue * 1.2), worse = d.filter((r) => r.youValue < r.hisValue * 0.8);
  const pb = better.filter((r) => r.choice !== "shoot").length / Math.max(1, better.length);
  const pw = worse.filter((r) => r.choice !== "shoot").length / Math.max(1, worse.length);
  console.log(`\nyou better placed than him: passed to you ${(100 * pb).toFixed(1)}% (n ${better.length}) · worse placed: ${(100 * pw).toFixed(1)}% (n ${worse.length})`);
  check("a better-placed you is found far more often", pb > pw * 2 && pb > 0.2);
}

// ── 3. The captain's call ──
{
  let n = 0, passed = 0, noLane = 0, late = 0, lateN = 0, base = 0;
  for (const kind of KINDS) for (let i = 0; i < 150; i++) {
    const r = play(kind, i, "jog", "early"); const b = play(kind, i, "jog", "no");
    if (r && r.choice !== null) { n++; if (r.choice !== "shoot") passed++; if (r.note === "noLane") noLane++; }
    if (b && b.choice !== null && b.choice !== "shoot") base++;
    const l = play(kind, i, "jog", "late");
    if (l && l.called) { lateN++; if (l.note === "late") late++; }
  }
  console.log(`\ncall for it (jogging in): passed to you ${pct(passed, n)} (no call ${pct(base, n)}) · no lane ${pct(noLane, n)} · called while he was shooting: "too late" ${pct(late, lateN)}`);
  check("calling for it gets the ball far more often", passed > base * 1.5);
  check("every call is answered: a pass, or 'no lane'", passed + noLane >= n * 0.98, { passed, noLane, n });
  check("a call while he is shooting is too late", late === lateN && lateN > 0);
  check("Call for it shows only when you are captain", callForItShown({ captain: true, stickLive: true, layOffLive: false }) && !callForItShown({ captain: false, stickLive: true, layOffLive: false }));
  check("…only while the joystick is live and nothing is on its way", !callForItShown({ captain: true, stickLive: false, layOffLive: false }) && !callForItShown({ captain: true, stickLive: true, layOffLive: true }));
}

// ── 4. The read itself ──
{
  const sc = makeChance({ source: { from: "kind", kind: "one_on_one" }, rng: mulberry32(11) }).sc;
  sc.defenders = [];
  const at = { x: 34, y: 28 }, you = { x: 38, y: 16 };
  const r = stickRead(sc, at, you, { x: 0, y: -6 });
  check("open, onside, running in, nobody about: feet and through both on, he passes often", r.feet !== null && r.through !== null && r.pPass > 0.5, r);
  sc.defenders = [{ ...sc.keeper, x: 36, y: 22 } as unknown as Scenario["defenders"][number]];
  const r2 = stickRead(sc, at, you, { x: 0, y: -6 });
  check("a man in the lane to you: no ball to your feet", r2.feet === null, r2);
}

console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);
