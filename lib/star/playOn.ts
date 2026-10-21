/**
 * THE MOVE PLAYS ON AFTER YOUR PASS — build-ups only, Chances: New only.
 *
 * Harry, 14 Oct 2026: "it would be cool if, on some build-up highlights, you
 * pass it off, your guy starts running, and then you get to see the whole
 * highlight. It doesn't cut back and say 'back to you'."
 *
 * Before this, a pass on a one-on-one or a long shot ended the chance the
 * moment it reached a team-mate: "delivered", the PASS banner, a 1.6 s pause,
 * then either "BACK TO YOU" and a NEW picture, or the match went to the
 * commentary. Those two kinds have no `receiver` (canvasEngine.ts: only
 * cutbacks, crosses, through balls and corners do), so the engine had nobody
 * whose job was to shoot.
 *
 * With this, after a build-up, a pass you play (not a shot) carries on in the
 * same picture:
 *   - you make a supporting run toward the box (stepPlayOn moves
 *     `scenario.player`, the same field Touch Mode's chase moves);
 *   - the team-mate who takes it shoots, by the engine's own reception rule,
 *     because the chance is given a receiver at your pass (playOnReceiver);
 *   - or, if he is a long way out and the engine's own give-and-go roll says
 *     the ball comes back (chainReturnChance), he lays it into your run and
 *     you take it in your stride: the same picture, your next kick
 *     (CanvasMatch: resetForTouchOn, as Touch Mode's re-touch does).
 * The move only stops when it is over: a goal, a save, a miss, or lost.
 *
 * Pure: no React, no canvas, no new loop. It runs inside CanvasMatch's own
 * flight substeps, before stepBall, and never touches the engine file.
 * tests/star/playOn.mts measures it.
 */
import {
  goalInView, chainReturnChance, logBallAction, orderableRunners, acceptsCaptainOrders, offsideAt, passQuality, setMateReceptionRule,
  type MateReception, type Ball, type Scenario, type ScenarioKind, type Receiver, type Vec2,
} from "./canvasEngine";
import { CX, PEN_SPOT_Y } from "./pitch";
import { leadInEntities, ballAlong, type LeadIn, type LeadBallKey } from "./leadIn";
import { stickSpeed, STICK_UP_T, STICK_DOWN_T } from "./firstPersonDribble";
import { newLegs, stepLegs, type Legs } from "./legs";

/** Your supporting run, m/s (a team-mate's run is 7.0, canvasEngine RUNNER_SPEED). */
export const PLAY_ON_RUN_SPEED = 6.6;
/** Close enough to take the lay-off in your stride, metres (canvasEngine CONTROL_R is 1.15). */
export const PLAY_ON_CATCH_R = 1.3;
/** A team-mate this close to goal (metres) always shoots; past LAY_OFF_FULL_M the engine's own roll decides. */
export const SHOOT_ALWAYS_M = 14;
export const LAY_OFF_FULL_M = 26;
/** At most this many lay-offs back to you in one move. */
export const MAX_LAY_OFFS = 1;

export interface PlayOn {
  /** Where your run is heading. */
  target: Vec2;
  /** null until the ball reaches a team-mate; then whether he lays it back. */
  layOff: boolean | null;
  /** The lay-off has been played and is on its way to you. */
  layOffLive: boolean;
  /** "After you pass: Joystick" only (THE JOYSTICK, below). Absent = Auto run, exactly as before. */
  stick?: PlayOnStick;
}

/** Whether a kick plays on: New chances, a build-up before it, a goal in the picture, and a pass. */
export function playOnWanted(o: {
  newChances: boolean; hadBuildUp: boolean; kind: ScenarioKind; youShotAtGoal: boolean; auto?: boolean;
}): boolean {
  return o.newChances && o.hadBuildUp && !o.auto && !o.youShotAtGoal && goalInView(o.kind);
}

/** Somebody whose job it is to shoot (the engine names him at reception). Only when the chance has none. */
export function playOnReceiver(rng: () => number): Receiver {
  return { skill: 58 + rng() * 26, roleLabel: "the striker" };
}

/**
 * Where your run goes: into the box, across from where the ball is, so you
 * arrive as the other option rather than on top of the man you passed to.
 */
export function supportRunTarget(sc: Scenario, passTo?: Vec2): Vec2 {
  const ref = passTo ?? sc.ball;
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2 || CX;
  const across = Math.max(-7, Math.min(7, (gcx - ref.x) * 0.45 + (ref.x < gcx ? 3.5 : -3.5)));
  const y = Math.min(sc.player.y - 2, Math.max(PEN_SPOT_Y - 3, PEN_SPOT_Y + 1));
  return { x: gcx + across, y: Math.max(6, y) };
}

export function startPlayOn(sc: Scenario, rng: () => number, passTo?: Vec2): PlayOn {
  delete sc.matePace;
  if (!sc.receiver) sc.receiver = playOnReceiver(rng);
  return { target: supportRunTarget(sc, passTo), layOff: null, layOffLive: false };
}

/** Whether the man who has it lays it back to you: never close in, the engine's own roll far out. */
export function layOffChance(sc: Scenario, at: Vec2): number {
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2 || CX;
  const dGoal = Math.hypot(at.x - gcx, at.y);
  const far = Math.max(0, Math.min(1, (dGoal - SHOOT_ALWAYS_M) / (LAY_OFF_FULL_M - SHOOT_ALWAYS_M)));
  return chainReturnChance(sc) * far;
}

function moveToward(p: Vec2, to: Vec2, step: number) {
  const dx = to.x - p.x, dy = to.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return;
  const k = Math.min(1, step / d);
  p.x += dx * k; p.y += dy * k;
}

/**
 * One substep, before stepBall. Moves your run, decides and plays the lay-off,
 * and reports "caught" the substep you take it back. `layOffsLeft` = 0 means
 * the team-mate always shoots.
 */
export function stepPlayOn(
  st: PlayOn, sc: Scenario, ball: Ball, dt: number, rng: () => number, layOffsLeft: number,
): "caught" | null {
  if (st.stick) return stepPlayOnStick(st, st.stick, sc, ball, dt, rng, layOffsLeft);
  const p = sc.player;
  // The lay-off is coming: run onto it.
  if (st.layOffLive) {
    const lead = { x: ball.pos.x + ball.vel.x * 0.25, y: ball.pos.y + ball.vel.y * 0.25 };
    moveToward(p, lead, PLAY_ON_RUN_SPEED * 1.1 * dt);
    if (ball.contactCd <= 0 && ball.z < 1.0 && Math.hypot(ball.pos.x - p.x, ball.pos.y - p.y) < PLAY_ON_CATCH_R) return "caught";
    // Somebody else got it (a defender, a team-mate): it is his ball now.
    if (ball.owner !== "mate" || sc.receiverDone || ball.shot) st.layOffLive = false;
    return null;
  }
  moveToward(p, st.target, PLAY_ON_RUN_SPEED * dt);

  // He has it and is taking his touch: lay it back, or let him shoot.
  if (sc.receiverDone && ball.receiverControlT > 0 && !sc.relayTo && !sc.relayToFollower) {
    if (st.layOff === null) {
      const at = sc.receivedAt ?? ball.pos;
      // He only lays it back if he can see you: no defender in the lane.
      st.layOff = layOffsLeft > 0 && laneClear(sc, at, layOffAim(st, sc)) && rng() < layOffChance(sc, at);
    }
    if (st.layOff && ball.receiverControlT <= dt + 1e-9) {
      // Looked up again as he plays it: a man has stepped into the lane → he shoots instead.
      if (laneClear(sc, ball.pos, layOffAim(st, sc))) playLayOff(st, sc, ball);
      else st.layOff = false;
    }
  }
  return null;
}

/** A lay-off is not tried through a man: nobody this close (m) to the line from him to you. */
export const LAY_OFF_LANE_M = 2.6;

/** Where you will be when it gets there: your run, half a second on. */
function layOffAim(st: PlayOn, sc: Scenario): Vec2 {
  const p = sc.player;
  const dir = { x: st.target.x - p.x, y: st.target.y - p.y };
  const dl = Math.hypot(dir.x, dir.y);
  if (dl < 0.5) return { x: p.x, y: p.y };
  const k = Math.min(dl, PLAY_ON_RUN_SPEED * 0.5) / dl;
  return { x: p.x + dir.x * k, y: p.y + dir.y * k };
}

/** No defender within LAY_OFF_LANE_M of the line from `a` to `b` (past the first two metres). */
export function laneClear(sc: Scenario, a: Vec2, b: Vec2): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  if (L2 < 1) return true;
  const L = Math.sqrt(L2);
  return sc.defenders.every((d) => {
    const u = ((d.x - a.x) * dx + (d.y - a.y) * dy) / L2;
    if (u * L < 2 || u > 1.05) return true;
    const cx = a.x + dx * u, cy = a.y + dy * u;
    return Math.hypot(d.x - cx, d.y - cy) >= LAY_OFF_LANE_M;
  });
}

/** The team-mate plays it into your run. Assignments only (like canvasEngine's own relay pass). */
function playLayOff(st: PlayOn, sc: Scenario, ball: Ball) {
  const from = { x: ball.pos.x, y: ball.pos.y };
  const ahead = layOffAim(st, sc);
  const dx = ahead.x - from.x, dy = ahead.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = Math.max(13, Math.min(21, 11 + d * 0.45));
  ball.receiverControlT = 0;
  ball.vel = { x: (dx / d) * speed, y: (dy / d) * speed };
  ball.vz = 0; ball.z = 0.08; ball.spin = 0;
  ball.loose = false; ball.resting = false; ball.restT = 0;
  ball.shot = false;
  ball.owner = "mate";
  ball.lastTouch = "attack";
  ball.contactCd = 0.2;
  const list = orderableRunners(sc);
  const i = sc.receivedBy ? list.indexOf(sc.receivedBy) : -1;
  logBallAction(ball, { kind: "pass", actor: i >= 0 ? `run${i}` : "follower", mode: "ground", at: { x: from.x, y: from.y, z: ball.z } });
  // He has played it; the man it was played by is not a receiver for it.
  sc.relayed = true;
  sc.receiverDone = false;
  st.layOffLive = true;
}

// ─────────────────────────────────────────────────────────────────────────
//  A pass in a picture with no goal in it (build-up, midfield pass)
// ─────────────────────────────────────────────────────────────────────────
//
// There the engine has nobody to shoot: the pass finds its man and the next
// link is a new picture further up (CanvasMatch: "delivered" → the give-and-go
// roll → loadScenario(true)). It used to arrive as a CUT: PASS, a 1.6 s pause,
// BACK TO YOU, and the new picture appeared. Now the new picture is reached by
// a short carry-on lead-in made from where everyone actually was: the man who
// took your pass plays it on into your run, everyone runs to his place in the
// new picture, and the camera follows (leadInCamera), the way the build-ups do.

/** Where everyone was when your pass found its man. */
export interface CarryFrom {
  /** Where the ball is (the team-mate who took it). */
  ball: Vec2;
  you: Vec2;
  mates: Vec2[];
  opps: Vec2[];
}

/** His touch before he plays it on, seconds. */
export const CARRY_TOUCH_S = 0.25;
/** The carry-on is never shorter / longer than this, seconds. */
export const CARRY_MIN_S = 1.0;
export const CARRY_MAX_S = 2.6;
/** The pass on: how fast it travels, m/s (a long one is lifted). */
export const CARRY_PASS_SPEED = 16;
export const CARRY_LOFT_M = 30;
/** Nobody runs faster than this, on average, along his path (m/s; LEAD_MAX_RUN is 9). */
export const CARRY_RUN_AVG = 7;

/** Snapshot of the live picture, for carryOnLeadIn. */
export function carryFrom(sc: Scenario, ball: Vec2): CarryFrom {
  const mates: Vec2[] = [];
  if (sc.runner) mates.push({ ...sc.runner.pos });
  for (const r of sc.secondaryRunners) mates.push({ ...r.pos });
  for (const m of sc.teammates) mates.push({ x: m.x, y: m.y });
  // The man on the ball is drawn as the passer ("extra0"), not twice.
  let bi = -1, bd = 3;
  mates.forEach((p, i) => { const d = Math.hypot(p.x - ball.x, p.y - ball.y); if (d < bd) { bd = d; bi = i; } });
  if (bi >= 0) mates.splice(bi, 1);
  return { ball: { ...ball }, you: { ...sc.player }, mates, opps: sc.defenders.map((d) => ({ x: d.x, y: d.y })) };
}

/**
 * The lead-in into the NEW picture `sc` (already built) from the old one.
 * Keys are leadInEntities' keys; "extra0" is the man who took your pass.
 */
export function carryOnLeadIn(sc: Scenario, from: CarryFrom): LeadIn {
  const passD = Math.hypot(sc.ball.x - from.ball.x, sc.ball.y - from.ball.y);
  const durS = Math.max(CARRY_MIN_S, Math.min(CARRY_MAX_S, CARRY_TOUCH_S + passD / CARRY_PASS_SPEED + 0.15));
  const arrive = durS - 0.1;
  const run = CARRY_RUN_AVG * durS;
  /** A start no further from `to` than he can run in the time. */
  const reach = (p: Vec2, to: Vec2): Vec2 => {
    const d = Math.hypot(p.x - to.x, p.y - to.y);
    if (d <= run) return { ...p };
    const k = run / d;
    return { x: to.x + (p.x - to.x) * k, y: to.y + (p.y - to.y) * k };
  };
  const ents = leadInEntities(sc);
  const starts = new Map<string, Vec2>();
  // Each man in the new picture starts from the nearest unused man of his side
  // in the old one (greedy), pulled in as far as he needs to get there in time.
  const pair = (side: "mate" | "opp", pool: Vec2[]) => {
    const left = pool.map((p) => ({ ...p }));
    const want = ents.filter((e) => e.side === side);
    for (const e of want) {
      if (!left.length) break;
      const to = e.get();
      let bi = 0, bd = Infinity;
      left.forEach((p, i) => { const dd = Math.hypot(p.x - to.x, p.y - to.y); if (dd < bd) { bd = dd; bi = i; } });
      starts.set(e.key, reach(left[bi], to));
      left.splice(bi, 1);
    }
  };
  pair("mate", from.mates);
  pair("opp", from.opps);
  const youEnd = sc.player;
  starts.set("you", reach(from.you, youEnd));
  const ends = new Map(ents.map((e) => [e.key, e.get()] as const));
  const ease = (f: number) => { const c = Math.max(0, Math.min(1, f)); return 0.5 * c + 0.5 * c * c * (3 - 2 * c); };
  // The passer jogs on a few metres after he has played it.
  const passer0 = { ...from.ball };
  const fwd = { x: sc.ball.x - passer0.x, y: sc.ball.y - passer0.y };
  const fl = Math.hypot(fwd.x, fwd.y) || 1;
  const passer1 = { x: passer0.x + (fwd.x / fl) * 3, y: passer0.y + (fwd.y / fl) * 3 };
  const lofted = passD > CARRY_LOFT_M;
  const keys: LeadBallKey[] = [
    { t: 0, p: { ...from.ball } },
    { t: CARRY_TOUCH_S, p: { ...from.ball } },
    { t: arrive, p: { x: sc.ball.x, y: sc.ball.y }, pass: { h: lofted ? passD * 0.1 : 0 } },
  ];
  return {
    durS,
    ballAt: (t) => ballAlong(keys, Math.min(t, arrive)),
    posAt: (key, t) => {
      if (key === "extra0") {
        const g = ease((t - CARRY_TOUCH_S) / Math.max(0.01, durS - CARRY_TOUCH_S));
        return { x: passer0.x + (passer1.x - passer0.x) * g, y: passer0.y + (passer1.y - passer0.y) * g };
      }
      const s = starts.get(key), e = ends.get(key);
      if (!s || !e) return null;
      const g = ease(t / durS);
      return { x: s.x + (e.x - s.x) * g, y: s.y + (e.y - s.y) * g };
    },
    extraMates: 1,
    passStart: [CARRY_TOUCH_S],
    passEnd: [arrive],
    skippable: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  THE JOYSTICK — Settings → "After you pass: Joystick" (lib/star/afterPass.ts)
// ─────────────────────────────────────────────────────────────────────────
//
// Harry, 14 Oct 2026: "As soon as you pass the ball off, you should then get a
// joystick, and you can still continue moving in that play. And if you want,
// if they want to pass it back to you, they can. Maybe when you're captain, you
// can call for the ball … running through on goal, they play a through ball to
// you."
//
// Auto run never reaches this code: stepPlayOn hands over only when the play-on
// was started by startPlayOnStick. Here:
//   - YOU move only by the stick (lib/star/firstPersonDribble.ts's stickSpeed:
//     a small push walks, a full push sprints; speed builds over STICK_UP_T);
//   - the man who takes your pass reads where you REALLY are when he has it:
//     he shoots; or he plays it to your feet if you are open, onside and the
//     lane to you is clear; or a through ball into your run if you are running
//     in toward goal, onside, with space ahead of you. Which he picks is the
//     better chance of the two of you (shotValue), and how good a passer he is
//     (canvasEngine passQuality, the number his relay passes use);
//   - captain only: "Call for it" (stick.called) makes him pass to you on his
//     touch if a lane exists. Already shooting = too late.
//   - the pass is a real ball (a speed, a small error by his passing), not a
//     teleport; if you reach it, the match gives you your kick in the same
//     picture (CanvasMatch: "caught" → resetForTouchOn), as the lay-off does.

/** Nobody within this of you (m) = open for a ball to feet. */
export const STICK_OPEN_M = 2.5;
/** Running in toward goal at least this fast (m/s) = a run worth a through ball. */
export const THROUGH_RUN_MS = 3.0;
/** Space: nobody this close (m) to where the through ball meets you. */
export const THROUGH_SPACE_M = 2.5;
/** You take it a touch further away than the auto run's catch, steering yourself (m). */
export const STICK_CATCH_R = PLAY_ON_CATCH_R + 0.3;
/** A pass shorter / longer than this (m) is not played to you. */
export const STICK_PASS_MIN_M = 3;
export const STICK_PASS_MAX_M = 32;
/** He waits this much longer on it (s) to see your run, when his own chance is no better than STICK_WAIT_BELOW. */
export const STICK_WAIT_S = 0.35;
export const STICK_WAIT_BELOW = 0.6;

// ── The tempo after your pass (Harry, 14 Oct 2026) ──
//
// "with the joystick one, I think the play needs to slow down a bit. If it's a
// position where someone can straight away shoot, then they shoot first time.
// Right now, they're shooting pretty much first time, instantly, every time."
//
// Measured before (tests/star/afterPassStick.mts §5, 500 passes): the man who
// took your pass held it 0.46 s whatever the spot (the engine's one touch,
// RECEIVER_CONTROL_T), then shot — 94% of the time — and a named finisher hit
// it first time MORE often outside the box or marked (15%) than in the box and
// clear (11%). So on the joystick only (Scenario.matePace "stick"):
//   - first time ONLY when it is on (stickShotIsOn): close, a clear sight of
//     goal, and nobody tight on him — then always, whoever he is;
//   - otherwise a real touch and a look up (STICK_TOUCH_T), and far out in
//     space he runs on with it first (STICK_CARRY_FROM_M, the engine's own
//     MATE_CARRY run). Then he reads you as before: shoot, to feet, through.

/** First time only this close to the goal's centre (m). */
export const FIRST_TIME_MAX_M = 15;
/** …with at least this clear a sight of goal (shotValue: angle, distance, bodies in the way). */
export const FIRST_TIME_MIN_VALUE = 0.4;
/** …and nobody this close to him (m), or goal-side of him within FIRST_TIME_SCREEN_M. */
export const FIRST_TIME_TIGHT_M = 1.8;
export const FIRST_TIME_SCREEN_M = 5;
/** His touch and look up when it is not on (s). The engine's own touch is 0.45. */
export const STICK_TOUCH_T = 1.0;
/** A loose ball he has run down: a quicker touch, men are closing (s). */
export const STICK_SCRAMBLE_T = 0.6;
/** Further out than this (m) and in space: he runs on with it first. */
export const STICK_CARRY_FROM_M = 20;
export const STICK_CARRY_T = 1.4;
/** At his touch: his own shot this poor, no pass on, and room ahead → he runs on with it and looks again (once). */
export const STICK_DEVELOP_BELOW = 0.22;
/** The ball back to you, a calmer pace than before (m/s at its quickest; was 21 to feet, 23 through). */
export const STICK_PASS_MAX_FEET = 18;
export const STICK_PASS_MAX_THROUGH = 20;

/** Is a first-time shot on from `at`? Close, a clear sight of goal, nobody tight. */
export function stickShotIsOn(sc: Scenario, at: Vec2): boolean {
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2 || CX;
  if (Math.hypot(at.x - gcx, at.y) > FIRST_TIME_MAX_M) return false;
  if (shotValue(sc, at) < FIRST_TIME_MIN_VALUE) return false;
  for (const d of sc.defenders) {
    const dx = d.x - at.x, dy = d.y - at.y;
    if (Math.hypot(dx, dy) < FIRST_TIME_TIGHT_M) return false;
    // Goal-side and in front of him: he would be shooting into the man.
    if (dy < 0 && dy > -FIRST_TIME_SCREEN_M && Math.abs(dx) < 1.6) return false;
  }
  return true;
}

/** The joystick's reception rule (canvasEngine setMateReceptionRule). */
export function stickReception(sc: Scenario, at: Vec2, _mode: string, scrambled: boolean): MateReception {
  if (stickShotIsOn(sc, at)) return { firstTime: true, holdT: 0, carryT: 0 };
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2 || CX;
  const far = Math.hypot(at.x - gcx, at.y) > STICK_CARRY_FROM_M;
  const space = nobodyNear(sc, at, 4);
  return { firstTime: false, holdT: scrambled ? STICK_SCRAMBLE_T : STICK_TOUCH_T, carryT: far && space && !scrambled ? STICK_CARRY_T : 0 };
}
export type StickChoice = "shoot" | "feet" | "through";

export interface PlayOnStick {
  /** The push, in pitch directions: unit direction × how far it is pushed (0..1). */
  push: Vec2;
  /** Your velocity now, m/s. */
  vel: Vec2;
  /** Your run speed, m/s (a full push sprints at STICK_SPRINT × this). */
  run: number;
  /** Captain's "Call for it", pressed. */
  called: boolean;
  /** What the man on the ball chose, once he has it. */
  choice: StickChoice | null;
  /** Where the pass to you was aimed, once played. */
  passTo: Vec2 | null;
  /** A line for the screen about the call; the match reads and clears it. */
  note: "late" | "noLane" | null;
  /** The read he made (for tests and the dev hook). */
  read: StickRead | null;
  /** He has already run on with it once, looking for a better shot (STICK_DEVELOP_BELOW). */
  developed?: boolean;
  /** THE RUN (B14) only: your legs and the stamina bar (lib/star/legs.ts). Absent = the joystick as it was. */
  legs?: Legs;
  /** THE RUN only: Shift held (PC). */
  sprintHeld?: boolean;
  /** THE RUN only: you run on your own when nobody steers (Auto run). */
  auto?: boolean;
  /** "After you pass: Joystick": the thumb stick is drawn and listened to. */
  thumb?: boolean;
  /** The thumb is on the stick now (held still counts as steering: you stand). */
  held?: boolean;
  /** Seconds since you last steered (keys or thumb). */
  idleT?: number;
  /** Auto run is steering you this substep. */
  autoOn?: boolean;
  /** Where Auto run is taking you, and when it looks again. */
  autoTarget?: Vec2 | null;
  retargetT?: number;
  /** THE RUN only: where the pass was going (the man who takes it), until he has it. */
  mateAt?: Vec2 | null;
}

export interface StickRead {
  his: number;
  feet: number | null;
  through: number | null;
  throughAt: Vec2 | null;
  pPass: number;
}

/** Whether a pass gives you the joystick: New chances, "Joystick", a goal in the picture, open play, a pass. No build-up needed. */
export function playOnStickWanted(o: { newChances: boolean; stick: boolean; kind: ScenarioKind; youShotAtGoal: boolean; auto?: boolean }): boolean {
  return o.newChances && o.stick && !o.auto && !o.youShotAtGoal && goalInView(o.kind) && acceptsCaptainOrders(o.kind);
}

export function startPlayOnStick(sc: Scenario, rng: () => number, passTo?: Vec2, run = PLAY_ON_RUN_SPEED): PlayOn {
  if (!sc.receiver) sc.receiver = playOnReceiver(rng);
  // The calmer tempo (stickReception): whoever takes it asks the joystick's rule.
  sc.matePace = "stick";
  // Registered here, not at load: the engine's module may finish loading after this one.
  setMateReceptionRule(stickReception);
  return {
    target: supportRunTarget(sc, passTo), layOff: null, layOffLive: false,
    stick: { push: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, run, called: false, choice: null, passTo: null, note: null, read: null },
  };
}

/** Point the stick, in pitch directions (toward goal is y negative). (0,0) stands still. */
export function steerPlayOn(st: PlayOn, x: number, y: number) {
  if (!st.stick) return;
  let mx = Number.isFinite(x) ? x : 0, my = Number.isFinite(y) ? y : 0;
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  st.stick.push = { x: mx, y: my };
}

/** Captain's call. Says whether he is already shooting, it is already coming, or he will look for you. */
export function callForIt(st: PlayOn, sc: Scenario): "late" | "coming" | "calling" {
  const stk = st.stick;
  if (!stk) return "late";
  if (st.layOffLive) return "coming";
  if (sc.receiverShot || stk.choice === "shoot" && !(sc.receiverDone)) return "late";
  stk.called = true;
  return "calling";
}

/** You, one substep on the stick: speed builds and eases like the dribble stick, in any direction. */
export function moveOnStick(stk: PlayOnStick, p: Vec2, dt: number) {
  const mag = Math.hypot(stk.push.x, stk.push.y);
  const want = stickSpeed(mag, stk.run);
  const ux = mag > 1e-6 ? stk.push.x / mag : 0, uy = mag > 1e-6 ? stk.push.y / mag : 0;
  const tvx = want * ux, tvy = want * uy;
  const cur = Math.hypot(stk.vel.x, stk.vel.y);
  const rate = (want > cur ? stk.run / STICK_UP_T : stk.run / STICK_DOWN_T) * dt;
  let dvx = tvx - stk.vel.x, dvy = tvy - stk.vel.y;
  const dv = Math.hypot(dvx, dvy);
  if (dv > rate) { dvx *= rate / dv; dvy *= rate / dv; }
  stk.vel.x += dvx; stk.vel.y += dvy;
  p.x = Math.max(-2, Math.min(70, p.x + stk.vel.x * dt));
  p.y = Math.max(-2, Math.min(106, p.y + stk.vel.y * dt));
}

/** How good a chance a shot from here is, 0..1: the goal's opening angle, distance, men in the way. A comparison only. */
export function shotValue(sc: Scenario, p: Vec2): number {
  if (p.y <= 0.3) return 0;
  const gx1 = sc.goal.x1, gx2 = sc.goal.x2;
  const gcx = (gx1 + gx2) / 2 || CX;
  const open = Math.abs(Math.atan2(gx2 - p.x, p.y) - Math.atan2(gx1 - p.x, p.y));
  const d = Math.hypot(p.x - gcx, p.y);
  let v = (open / 0.64) * Math.exp(-Math.max(0, d - 11) / 14);
  const dx = gcx - p.x, dy = -p.y, L2 = dx * dx + dy * dy;
  for (const df of sc.defenders) {
    // A man between him and the goal, close to the line of the shot.
    const u = ((df.x - p.x) * dx + (df.y - p.y) * dy) / L2;
    if (u <= 0.03 || u >= 1) continue;
    if (Math.hypot(df.x - (p.x + dx * u), df.y - (p.y + dy * u)) < 1.4) v *= 0.65;
  }
  return Math.max(0, Math.min(1, v));
}

function passSpeedFor(d: number, through: boolean): number {
  return through ? Math.max(13, Math.min(STICK_PASS_MAX_THROUGH, 11 + d * 0.45)) : Math.max(12, Math.min(STICK_PASS_MAX_FEET, 10 + d * 0.4));
}

/** Where a through ball from `at` meets your run: you + your velocity × its travel time, a metre on into your stride. */
export function throughPoint(at: Vec2, you: Vec2, vel: Vec2): Vec2 {
  const sp = Math.hypot(vel.x, vel.y) || 1;
  let lead = { x: you.x, y: you.y };
  for (let i = 0; i < 4; i++) {
    const d = Math.hypot(lead.x - at.x, lead.y - at.y);
    const T = d / passSpeedFor(d, true) + 0.15;
    lead = { x: you.x + vel.x * T + vel.x / sp, y: you.y + vel.y * T + vel.y / sp };
  }
  return lead;
}

function nobodyNear(sc: Scenario, p: Vec2, r: number): boolean {
  return sc.defenders.every((d) => Math.hypot(d.x - p.x, d.y - p.y) >= r);
}

/** What the man on the ball at `at` sees of you: his chance, your feet, your run, and how likely he is to pass. */
export function stickRead(sc: Scenario, at: Vec2, you: Vec2, vel: Vec2): StickRead {
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2 || CX;
  const his = shotValue(sc, at);
  const dist = (q: Vec2) => Math.hypot(q.x - at.x, q.y - at.y);
  const inRange = (q: Vec2) => dist(q) >= STICK_PASS_MIN_M && dist(q) <= STICK_PASS_MAX_M;
  const onside = !offsideAt(sc, you, at);
  let feet: number | null = null;
  if (onside && inRange(you) && nobodyNear(sc, you, STICK_OPEN_M) && laneClear(sc, at, you)) {
    // To feet he has to take a touch with men closing: a little less than the same spot in stride.
    feet = shotValue(sc, you) * 0.85;
  }
  let through: number | null = null, throughAt: Vec2 | null = null;
  const g = { x: gcx - you.x, y: -you.y }, gl = Math.hypot(g.x, g.y) || 1;
  const runIn = (vel.x * g.x + vel.y * g.y) / gl;
  if (onside && runIn >= THROUGH_RUN_MS) {
    const lead = throughPoint(at, you, vel);
    const kd = Math.hypot(sc.keeper.x - lead.x, sc.keeper.y - lead.y);
    if (lead.y > 1.5 && lead.x > 0.5 && lead.x < 67.5 && inRange(lead) && kd > 2.5 && nobodyNear(sc, lead, THROUGH_SPACE_M) && laneClear(sc, at, lead)) {
      through = shotValue(sc, lead); throughAt = lead;
    }
  }
  const best = Math.max(feet ?? -1, through ?? -1);
  const q = passQuality(sc);
  const pPass = best < 0 ? 0 : Math.max(0, Math.min(0.92, ((best - his) / Math.max(0.05, his)) * 0.9 + 0.25)) * (0.55 + 0.45 * q);
  return { his, feet, through, throughAt, pPass };
}

function bestPass(r: StickRead): "feet" | "through" | null {
  if (r.feet === null && r.through === null) return null;
  return (r.through ?? -1) >= (r.feet ?? -1) ? "through" : "feet";
}

function gauss(rng: () => number) {
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** The pass to you: a real ball at a pass's speed, a small error by how good a passer he is. */
function playPassTo(st: PlayOn, stk: PlayOnStick, sc: Scenario, ball: Ball, to: Vec2, through: boolean, rng: () => number) {
  const from = { x: ball.pos.x, y: ball.pos.y };
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const q = passQuality(sc);
  const err = gauss(rng) * (1 - q) * 5 * (Math.PI / 180);
  const c = Math.cos(err), s = Math.sin(err);
  const ux = (dx / d) * c - (dy / d) * s, uy = (dx / d) * s + (dy / d) * c;
  const speed = passSpeedFor(d, through) * (1 + gauss(rng) * (1 - q) * 0.06);
  ball.receiverControlT = 0;
  ball.vel = { x: ux * speed, y: uy * speed };
  ball.vz = 0; ball.z = 0.08; ball.spin = 0;
  ball.loose = false; ball.resting = false; ball.restT = 0;
  ball.shot = false;
  ball.owner = "mate";
  ball.lastTouch = "attack";
  ball.contactCd = 0.2;
  const list = orderableRunners(sc);
  const i = sc.receivedBy ? list.indexOf(sc.receivedBy) : -1;
  logBallAction(ball, { kind: "pass", actor: i >= 0 ? `run${i}` : "follower", mode: "ground", at: { x: from.x, y: from.y, z: ball.z } });
  sc.relayed = true;
  sc.receiverDone = false;
  stk.passTo = { ...to };
  st.layOffLive = true;
}

function stepPlayOnStick(st: PlayOn, stk: PlayOnStick, sc: Scenario, ball: Ball, dt: number, rng: () => number, layOffsLeft: number): "caught" | null {
  const p = sc.player;
  if (stk.legs) moveRun(st, stk, stk.legs, sc, ball, dt);
  else moveOnStick(stk, p, dt);
  if (st.layOffLive) {
    if (ball.contactCd <= 0 && ball.z < 1.0 && Math.hypot(ball.pos.x - p.x, ball.pos.y - p.y) < STICK_CATCH_R) return "caught";
    if (ball.owner !== "mate" || sc.receiverDone || ball.shot) st.layOffLive = false;
    return null;
  }
  // He hit it first time, before he could look up: the call came too late.
  if (stk.called && sc.receiverShot) { stk.note = "late"; stk.called = false; }
  if (stk.passTo || !(sc.receiverDone && ball.receiverControlT > 0) || sc.relayTo || sc.relayToFollower) return null;
  const at = sc.receivedAt ?? ball.pos;
  if (stk.read === null) {
    // His first look, the moment he has it. You are making a run he could
    // find (onside, running in): he takes a beat longer on it to see it.
    const r = stickRead(sc, at, p, stk.vel);
    stk.read = r;
    const gcx = (sc.goal.x1 + sc.goal.x2) / 2 || CX;
    const g = { x: gcx - p.x, y: -p.y }, gl = Math.hypot(g.x, g.y) || 1;
    const runIn = (stk.vel.x * g.x + stk.vel.y * g.y) / gl;
    if (layOffsLeft > 0 && (runIn >= THROUGH_RUN_MS || stk.called) && !offsideAt(sc, p, at) && r.his < STICK_WAIT_BELOW) ball.receiverControlT += STICK_WAIT_S;
  }
  if (ball.receiverControlT <= dt + 1e-9) {
    // He plays it: where you are NOW. One look, one choice.
    const r = stickRead(sc, ball.pos, p, stk.vel);
    stk.read = r;
    const pick = bestPass(r);
    let go: "feet" | "through" | null = null;
    if (layOffsLeft > 0 && stk.called) {
      if (pick) go = pick; else stk.note = "noLane";
      stk.called = false;
    } else if (layOffsLeft > 0 && pick && rng() < r.pPass * (stk.legs ? runPassBias(passQuality(sc)) : 1)) go = pick;
    const gcx = (sc.goal.x1 + sc.goal.x2) / 2 || CX;
    if (go) {
      stk.choice = go;
      playPassTo(st, stk, sc, ball, go === "through" ? r.throughAt! : { x: p.x, y: p.y }, go === "through", rng);
    } else if (!stk.developed && r.his < STICK_DEVELOP_BELOW && Math.hypot(ball.pos.x - gcx, ball.pos.y) > 16 && nobodyNear(sc, ball.pos, 3)) {
      // Nothing on yet: he runs on with it toward goal (the engine's own
      // MATE_CARRY run) and looks again when he stops — shot, or you.
      stk.developed = true;
      ball.carryT = STICK_CARRY_T;
      ball.receiverControlT = 0.3;
    } else stk.choice = "shoot";
  }
  return null;
}

/** The captain's "Call for it" button: only for the captain, only while the joystick is live and no pass to you is on its way. */
export function callForItShown(o: { captain: boolean; stickLive: boolean; layOffLive: boolean }): boolean {
  return o.captain && o.stickLive && !o.layOffLive;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE RUN (B14, Harry, 20 Oct 2026) — every pass in open play, the real game
// ─────────────────────────────────────────────────────────────────────────
//
// "WASD to move your player and Shift to sprint after you've played the ball
// (and while waiting for it back) … a stamina bar … auto run … team-mates
// sometimes pass back to you even before you're captain."
//
// Any pass you play in an open-play chance with a goal in it (not a shot, not
// a set piece, not a penalty) now plays on in the same picture, whatever the
// Chances setting:
//   - you move on your LEGS (lib/star/legs.ts): your pace sets your speeds,
//     sprinting drains the stamina bar, and the bar never refills past your
//     match energy;
//   - nobody steering: AUTO RUN takes you into the best space it can see,
//     onside, toward goal (pickRunSpot), and sprints onto a ball played to you;
//     on a computer, W A S D steer and Shift sprints the moment you press them;
//     let go and Auto run picks it up again after AUTO_AFTER_S;
//   - the man who takes your pass reads you exactly as the joystick's man does
//     (stickRead): he shoots, or plays it to your feet, or through into your
//     run, by how much better your spot is than his and how good a passer he
//     is (passQuality). Captain or not. The captain can still call for it.
// "After you pass: Joystick" keeps its thumb stick (and its calmer tempo); it
// now has the same legs and bar. Thumb off the stick: Auto run takes over after
// AUTO_AFTER_S, as when you let go of the keys (B14b, Harry: "sure").

/** After you stop steering, Auto run takes over again after this long (s). */
export const AUTO_AFTER_S = 0.6;
/** Auto run looks for a new spot this often (s). */
export const AUTO_RETARGET_S = 0.35;
/** Auto run sprints when its spot is further than this (m) and the bar is above AUTO_SPRINT_BAR. */
export const AUTO_SPRINT_M = 6;
export const AUTO_SPRINT_BAR = 0.3;

/** Whether a kick gives you the run: open play, a goal in the picture, a pass (not a shot at goal). */
export function runAfterWanted(o: { kind: ScenarioKind; youShotAtGoal: boolean; auto?: boolean }): boolean {
  return !o.auto && !o.youShotAtGoal && goalInView(o.kind) && acceptsCaptainOrders(o.kind);
}

export interface RunOptions {
  /** Your pace and physical (0–100). */
  pace?: number;
  physical?: number;
  /** Your match energy now (0–100) and the bar as it was (0..1). */
  energy?: number;
  bar?: number;
  /** "After you pass: Joystick": the thumb stick and its tempo (Auto run when the thumb is off). */
  stick?: boolean;
}

/** Start the run at your pass. `passTo`: where the pass is going. */
export function startPlayOnRun(sc: Scenario, rng: () => number, passTo: Vec2 | undefined, o: RunOptions = {}): PlayOn {
  if (!sc.receiver) sc.receiver = playOnReceiver(rng);
  delete sc.matePace;
  if (o.stick) {
    sc.matePace = "stick";
    setMateReceptionRule(stickReception);
  }
  const legs = newLegs({ pace: o.pace, physical: o.physical, energy: o.energy, bar: o.bar });
  return {
    target: supportRunTarget(sc, passTo), layOff: null, layOffLive: false,
    stick: {
      push: { x: 0, y: 0 }, vel: legs.vel, run: legs.speeds.run, called: false, choice: null, passTo: null, note: null, read: null,
      legs, sprintHeld: false, auto: true, thumb: !!o.stick, held: false, idleT: AUTO_AFTER_S, autoOn: false, autoTarget: null, retargetT: 0, mateAt: passTo ? { ...passTo } : null,
    },
  };
}

/** Shift (PC). */
export function sprintPlayOn(st: PlayOn, held: boolean) {
  if (st.stick) st.stick.sprintHeld = held;
}

function moveRun(st: PlayOn, stk: PlayOnStick, legs: Legs, sc: Scenario, ball: Ball, dt: number) {
  let push = stk.push, sprint = !!stk.sprintHeld;
  const steering = Math.hypot(push.x, push.y) > 0.08 || !!stk.held;
  stk.idleT = steering ? 0 : (stk.idleT ?? 0) + dt;
  stk.autoOn = false;
  if (stk.auto && !steering && (stk.idleT ?? 0) >= AUTO_AFTER_S) {
    const a = autoPush(st, stk, legs, sc, ball, dt);
    push = a.push; sprint = sprint || a.sprint;
    stk.autoOn = true;
  }
  stepLegs(legs, sc.player, push, sprint, dt);
  stk.vel = legs.vel;
}

/** Auto run, one substep: onto a ball played to you, else to its spot. */
function autoPush(st: PlayOn, stk: PlayOnStick, legs: Legs, sc: Scenario, ball: Ball, dt: number): { push: Vec2; sprint: boolean } {
  const p = sc.player;
  if (st.layOffLive) {
    const lead = { x: ball.pos.x + ball.vel.x * 0.25, y: ball.pos.y + ball.vel.y * 0.25 };
    const dx = lead.x - p.x, dy = lead.y - p.y, d = Math.hypot(dx, dy) || 1;
    return { push: { x: dx / d, y: dy / d }, sprint: true };
  }
  stk.retargetT = (stk.retargetT ?? 0) - dt;
  if (!stk.autoTarget || stk.retargetT <= 0) {
    // Read off the man who has it (or is about to): offside is judged from him, and you are the other option.
    const mate = sc.receivedAt ?? stk.mateAt ?? ball.pos;
    stk.autoTarget = pickRunSpot(sc, p, mate, stk.autoTarget ?? null);
    stk.retargetT = AUTO_RETARGET_S;
  }
  const t = stk.autoTarget;
  const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
  if (d < 0.8) return { push: { x: 0, y: 0 }, sprint: false };
  const mag = d > 2.5 ? 1 : 0.6;
  return { push: { x: (dx / d) * mag, y: (dy / d) * mag }, sprint: d > AUTO_SPRINT_M && legs.stamina.v > AUTO_SPRINT_BAR };
}

/**
 * Where Auto run goes: the best spot within reach, never behind you, onside
 * from the man with the ball (`ballAt`), with a sight of goal (shotValue), room
 * around it, a clear lane from him, and not on top of a team-mate or of him.
 */
export function pickRunSpot(sc: Scenario, you: Vec2, ballAt: Vec2, prev: Vec2 | null): Vec2 {
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2 || CX;
  const mates: Vec2[] = [
    ...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((r) => r.pos), { x: sc.follower.x, y: sc.follower.y },
  ];
  let best: Vec2 | null = null, bestS = -Infinity;
  for (let gy = 5; gy <= 32; gy += 2.5) {
    if (gy > you.y + 1) break;
    for (let gx = -15; gx <= 15; gx += 3) {
      const q = { x: gcx + gx, y: gy };
      const dist = Math.hypot(q.x - you.x, q.y - you.y);
      if (dist > 22) continue;
      // Onside with a metre to spare: the line moves while he takes his touch.
      if (offsideAt(sc, q, ballAt) || offsideAt(sc, { x: q.x, y: q.y - 1 }, ballAt)) continue;
      let room = 6;
      for (const d of sc.defenders) room = Math.min(room, Math.hypot(d.x - q.x, d.y - q.y));
      let s = shotValue(sc, q) + (room / 6) * 0.35 - dist / 30;
      if (laneClear(sc, ballAt, q)) s += 0.15;
      if (mates.some((m) => Math.hypot(m.x - q.x, m.y - q.y) < 3.5)) s -= 0.25;
      if (Math.hypot(ballAt.x - q.x, ballAt.y - q.y) < 5) s -= 0.3;
      if (prev && Math.hypot(prev.x - q.x, prev.y - q.y) < 2) s += 0.05;
      if (s > bestS) { bestS = s; best = q; }
    }
  }
  if (best) return best;
  // Nowhere onside ahead (you are past the line: a square ball, a pass back).
  // He is close enough to shoot: stay for the rebound. Further out: come back
  // level with the line, so he can find you.
  if (Math.hypot(ballAt.x - gcx, ballAt.y) < 18) return { x: you.x, y: you.y };
  const ys = sc.defenders.map((d) => d.y);
  ys.push(sc.keeper.y);
  ys.sort((a, b) => a - b);
  const line = Math.min(ballAt.y, ys.length > 1 ? ys[1] : ys[0] ?? 0);
  return { x: you.x, y: Math.max(you.y, line + 1) };
}

/**
 * THE RUN: how much a passer's quality moves "does he give it back" (Harry:
 * "more often for better team-mates"). passQuality 0.4 → ×0.5, 0.6 → ×0.75,
 * 0.8 → ×1.0, capped 0.45–1.2. On top of stickRead's own small lift. The
 * old joystick (startPlayOnStick, no legs) is untouched.
 */
export function runPassBias(q: number): number {
  return Math.max(0.45, Math.min(1.2, 0.5 + 1.25 * (q - 0.4)));
}
