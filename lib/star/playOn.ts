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
  goalInView, chainReturnChance, logBallAction, orderableRunners,
  type Ball, type Scenario, type ScenarioKind, type Receiver, type Vec2,
} from "./canvasEngine";
import { CX, PEN_SPOT_Y } from "./pitch";
import { leadInEntities, ballAlong, type LeadIn, type LeadBallKey } from "./leadIn";

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
