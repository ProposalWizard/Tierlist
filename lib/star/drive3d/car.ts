/**
 * YOUR CAR ON THE ROAD (driving phase 1, 28 Nov 2026). Our own simple car, no physics library
 * (docs/plans/DRIVING_PLAN.md §3.3): distance along the road, speed, the lane offset, a faked
 * lean in bends and a nose dip on braking; wheels turned by the distance driven, the front pair
 * steered by the yaw it needs. It cannot leave the road, flip or crash: a car ahead slows you,
 * a blocked lane change sounds the horn instead.
 *
 * Controls (phone): auto-drive. Hold = faster; tap the left / right half = change lane.
 * Settings "Steer": "lanes" (that), "stick" (a thumb stick slides you across the road) or
 * "tilt" (the phone's tilt does the same). Pure and fixed-step: same inputs, same drive
 * (tests/star/drive.mts; window.__frameStep films it).
 */
import { ACCEL, BRAKE, HOLD_BOOST, LANE, ROAD_HALF, at, type Route } from "./route";

export type SteerMode = "lanes" | "stick" | "tilt";

export interface Traffic {
  id: string;
  /** Which way along the road: +1 your way (in your lane), −1 coming towards you (the other lane). */
  dir: 1 | -1;
  s: number;
  v: number;
  /** Paint and model for the scene (a light copy, repainted). */
  model: string;
  paint: string;
}

export interface CarInput {
  hold: boolean;
  /** A tap on the left (−1) or right (+1) half this step (lanes mode). */
  tap?: -1 | 1 | 0;
  /** Stick / tilt: −1 (all the way right… see note) to +1; in lanes mode ignored. + = towards the left kerb. */
  side?: number;
  /** An event's hold on your speed (m/s): slowing for a speed camera (./events.ts). */
  cap?: number;
  /** An event's push: a race with a team-mate (× the road's speed, ./events.ts RACE_BOOST). */
  boost?: number;
}

export interface CarState {
  s: number;
  v: number;
  /** Lateral offset from the road line, + = left. Your lane: +LANE. */
  off: number;
  /** The lane offset you are heading for (lanes mode). */
  laneTo: number;
  laneFrom: number;
  /** 0..1 through a lane change, and how long this one takes (s). */
  laneT: number;
  laneDur: number;
  /** World yaw of the car (road heading + the drift across). */
  yaw: number;
  yawRate: number;
  /** Wheel spin (radians, rolled) and front steer (radians, + = left). */
  spin: number;
  steer: number;
  /** Faked body roll (+ = leaning right, as in a left bend) and pitch (+ = nose down). */
  roll: number;
  pitch: number;
  accel: number;
  t: number;
  /** Seconds held up behind a slower car (the auto-drive overtakes after a while). */
  stuck: number;
  horn: number;
  /** What happened this step, for the sound and the tests. */
  events: string[];
}

export interface CarSpec { wheelR: number; wheelbase: number }

export const LANE_CHANGE_S = 1.1;
/** A lane change takes longer the faster you go (a calm 2.4 s at 45 mph, never a flick). */
export const laneChangeS = (v: number) => Math.max(LANE_CHANGE_S, Math.min(2.6, 0.9 + v * 0.075));
/** Cars going your way turn off this far before the compound gate. */
export const TURN_OFF_BEFORE_GATE = 48;
/** Lanes may not change here (the roundabout, the gate and the car park). */
const NO_LANE_CHANGE = new Set(["roundabout", "approach", "park"]);
/** Following gap: this many metres plus a second of speed. */
const GAP_M = 7;
const STEER_MAX = 0.55;

export function startCar(): CarState {
  return { s: 0, v: 0, off: LANE, laneTo: LANE, laneFrom: LANE, laneT: 1, laneDur: LANE_CHANGE_S, yaw: 0, yawRate: 0, spin: 0, steer: 0, roll: 0, pitch: 0, accel: 0, t: 0, stuck: 0, horn: 0, events: [] };
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Is the other lane free from s−10 to s+ahead (no one coming, no one alongside)? */
export function laneClear(traffic: Traffic[], s: number, lane: number, ahead = 55): boolean {
  for (const c of traffic) {
    const inLane = c.dir === 1 ? lane > 0 : lane < 0;
    if (!inLane) continue;
    // a car coming towards you closes the gap at both speeds: look further for it
    const reach = c.dir === -1 ? ahead + 30 : ahead;
    if (c.s > s - 10 && c.s < s + reach) return false;
  }
  return true;
}

/** The nearest car ahead in the lane you are in (or moving into). */
function leader(traffic: Traffic[], s: number, lane: number): Traffic | null {
  let best: Traffic | null = null;
  for (const c of traffic) {
    if (c.dir !== 1 || lane <= 0 || c.s <= s) continue;
    if (!best || c.s < best.s) best = c;
  }
  return best;
}

/** Move the traffic on (the same steps as your car; they keep their speed, cars in your lane brake for the end). */
export function stepTraffic(route: Route, traffic: Traffic[], dt: number) {
  for (const c of traffic) {
    // they keep to the road's speed too (the roundabout, the bends)
    c.s += c.dir * Math.min(c.v, Math.max(4, at(route, c.s).limit)) * dt;
  }
  // a car going your way turns off before the compound road (it is not going to training)
  for (let i = traffic.length - 1; i >= 0; i--) if (traffic[i].dir === 1 && traffic[i].s > route.gateS - TURN_OFF_BEFORE_GATE) traffic.splice(i, 1);
}

/**
 * One fixed step of your car. `auto` = the auto-drive's own lane choices (overtake a slow car
 * when it is clear, then back in). Returns the same state object, moved on.
 */
export function stepCar(route: Route, car: CarState, input: CarInput, dt: number, spec: CarSpec, opts: { mode: SteerMode; traffic: Traffic[]; auto?: boolean }): CarState {
  car.events = [];
  car.t += dt;
  const here = at(route, car.s);
  const changeOk = !NO_LANE_CHANGE.has(here.kind) && !NO_LANE_CHANGE.has(at(route, car.s + 25).kind);
  const lanes = opts.mode === "lanes";

  // ── lanes: a tap asks for the other lane; refused (horn) if someone is there ──
  const ask = (to: number, why: string) => {
    if (to === car.laneTo) return;
    if (!changeOk) { car.horn = 0.5; car.events.push("blocked"); return; }
    if (!laneClear(opts.traffic, car.s, to)) { car.horn = 0.5; car.events.push("blocked"); return; }
    car.laneFrom = car.off; car.laneTo = to; car.laneT = 0; car.laneDur = laneChangeS(car.v); car.events.push(why);
  };
  if (lanes) {
    // tap the right half: move right (to the other lane, −); the left half: back left (your lane, +)
    if (input.tap === 1) ask(-LANE, "lane-right");
    if (input.tap === -1) ask(LANE, "lane-left");
  }

  // ── speed: the road's limit, faster when held, never into the car ahead ──
  let target = here.limit * (input.hold ? HOLD_BOOST : 1) * (input.boost ?? 1);
  if (input.cap !== undefined) target = Math.min(target, input.cap);
  // the road's own braking still rules near the end (the boost never runs you through the gate)
  target = Math.min(target, Math.sqrt(Math.max(0, 2 * BRAKE * 0.75 * (route.length - car.s))));
  if (input.hold && here.limit > 3) target = Math.min(target, Math.max(here.limit, at(route, car.s + car.v * 1.5).limit * HOLD_BOOST));
  const lead = leader(opts.traffic, car.s, lanes ? car.laneTo : car.off);
  let heldUp = false;
  if (lead) {
    const gap = lead.s - car.s - 4.5;
    const want = GAP_M + car.v * 1.0;
    if (gap < want + 25) {
      const cap = lead.v + Math.max(0, (gap - want) * 0.5);
      if (cap < target) { target = cap; heldUp = true; }
    }
  }
  car.stuck = heldUp ? car.stuck + dt : 0;
  if (opts.auto && lanes && car.stuck > 1.2 && car.laneTo > 0 && changeOk && laneClear(opts.traffic, car.s, -LANE, 70)) ask(-LANE, "overtake");
  // back in once past everyone in your lane (auto, or after your own overtake)
  if (lanes && car.laneTo < 0 && car.laneT >= 1) {
    const clearBehind = opts.traffic.every((c) => c.dir !== 1 || c.s < car.s - 10 || c.s > car.s + 60);
    const someoneComing = !laneClear(opts.traffic, car.s, -LANE, 45);
    if ((clearBehind && (opts.auto || someoneComing)) || !changeOk) {
      if (laneClear(opts.traffic.filter((c) => c.dir === 1), car.s, LANE, 12) || !changeOk) { car.laneFrom = car.off; car.laneTo = LANE; car.laneT = 0; car.laneDur = laneChangeS(car.v); car.events.push("back-in"); }
    }
  }
  const dv = target - car.v;
  const a = dv > 0 ? Math.min(ACCEL, dv / dt) : Math.max(-BRAKE, dv / dt);
  car.accel = a;
  car.v = Math.max(0, car.v + a * dt);
  const ds = car.v * dt;
  car.s = Math.min(route.length, car.s + ds);

  // ── across the road ──
  const prevOff = car.off;
  if (lanes) {
    car.laneT = Math.min(1, car.laneT + dt / car.laneDur);
    car.off = car.laneFrom + (car.laneTo - car.laneFrom) * smooth(car.laneT);
  } else {
    const side = Math.max(-1, Math.min(1, input.side ?? 0));
    // the stick / tilt slides you across (2.6 m/s at full push), a metre off each kerb; the roundabout,
    // the gate and the car park take you back to your lane. Into a car alongside: the horn, no move.
    const edge = ROAD_HALF - 1.0;
    let next = changeOk ? Math.max(-edge, Math.min(edge, car.off + side * 2.6 * dt)) : car.off + Math.max(-2 * dt, Math.min(2 * dt, LANE - car.off));
    if (changeOk && next < 0 && car.off >= 0 && !laneClear(opts.traffic, car.s, -LANE, 30)) { next = car.off; if (car.horn <= 0) { car.horn = 0.5; car.events.push("blocked"); } }
    car.off = next;
    car.laneTo = car.off >= 0 ? LANE : -LANE;
  }
  const after = at(route, car.s);
  // the car's yaw: the road's heading, plus the angle of its drift across
  const drift = ds > 1e-4 ? Math.atan2(car.off - prevOff, ds) : 0;
  const yaw = after.h + drift;
  let dy = yaw - car.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  const rate = dt > 0 ? dy / dt : 0;
  car.yawRate += (rate - car.yawRate) * Math.min(1, dt * 12);
  car.yaw = yaw;

  // ── the wheels: rolled by the distance, the fronts steered (bicycle model: tan δ = L·ψ̇ / v) ──
  car.spin = (car.spin + ds / spec.wheelR) % (Math.PI * 2);
  const want = car.v > 0.3 ? Math.atan((spec.wheelbase * car.yawRate) / car.v) : car.steer;
  car.steer += (Math.max(-STEER_MAX, Math.min(STEER_MAX, want)) - car.steer) * Math.min(1, dt * 10);

  // ── a little life in the body: lean out of the bend, dip the nose when braking ──
  const lat = car.v * car.yawRate; // m/s² sideways
  car.roll += (Math.max(-0.05, Math.min(0.05, lat * 0.011)) - car.roll) * Math.min(1, dt * 5);
  car.pitch += (Math.max(-0.03, Math.min(0.04, -a * 0.006)) - car.pitch) * Math.min(1, dt * 6);
  car.horn = Math.max(0, car.horn - dt);
  return car;
}

/** Spin of a wheel of radius r after rolling d metres (radians). */
export const wheelSpinFor = (d: number, r: number) => d / r;
/** Front steer angle for a bend of curvature k (bicycle model). */
export const steerFor = (k: number, wheelbase: number) => Math.atan(wheelbase * k);
