/**
 * KIB RIDE: the numbers of riding your horse and driving your car round the garden.
 *
 * No three.js and no phone-only imports: pure functions on plain numbers, so the checks
 * (tools/walk-check.ts, tools/ride-check.ts) can run exactly this code without a graphics chip.
 * The scene that uses them is ./sceneRide.ts (every use is marked `// KIB RIDE`).
 *
 * Plan of the garden as the scene has it: metres, north is -z, a yaw of 0 faces +z (the gate),
 * forward = (sin yaw, cos yaw), right = (cos yaw, -sin yaw). A yaw that grows turns to the right.
 */

export type Box = [number, number, number, number];
export type Circle = [number, number, number];
/** What a vehicle must keep out of. `extra` are boxes only a vehicle meets (the doorways a man walks through). */
export interface Obstacles { boxes: readonly Box[]; circles: readonly Circle[]; limit: number; extra?: readonly Box[] }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
/** Move `v` toward `t` by at most `up` (rising) or `down` (falling). */
const approach = (v: number, t: number, up: number, down: number) => (t > v ? Math.min(t, v + up) : Math.max(t, v - down));

// ── collision: a body is a few circles on a line along its heading ──────────────────────

/** Push one circle at (x, z) out of the boundary, the boxes and the circles. Returns the corrected centre. */
export function pushOut(x: number, z: number, r: number, o: Obstacles): [number, number] {
  const lim = o.limit - r * 0.6;
  // one box: push the circle out of it (a box that is switched off, the car being driven, is empty and skipped)
  const out = (b: Box) => {
    const [x0, x1, z0, z1] = b;
    if (x1 <= x0 || z1 <= z0) return;
    const cx = clamp(x, x0, x1), cz = clamp(z, z0, z1);
    const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
    if (d >= r) return;
    if (d > 1e-6) { x = cx + (dx / d) * r; z = cz + (dz / d) * r; return; }
    // the centre is inside the box: out through the nearest side
    const push0 = x - (x0 - r), push1 = x1 + r - x, push2 = z - (z0 - r), push3 = z1 + r - z;
    const m = Math.min(push0, push1, push2, push3);
    if (m === push0) x = x0 - r; else if (m === push1) x = x1 + r; else if (m === push2) z = z0 - r; else z = z1 + r;
  };
  for (let pass = 0; pass < 2; pass++) {
    x = clamp(x, -lim, lim);
    z = clamp(z, -lim, lim);
    for (let i = 0; i < o.boxes.length; i++) out(o.boxes[i]);
    if (o.extra) for (let i = 0; i < o.extra.length; i++) out(o.extra[i]);
    for (let i = 0; i < o.circles.length; i++) {
      const [cx, cz, cr] = o.circles[i];
      if (cr <= 0) continue;
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < cr + r && d > 1e-6) { x = cx + (dx / d) * (cr + r); z = cz + (dz / d) * (cr + r); }
    }
  }
  return [x, z];
}

/** A body: circles of radius `r` at these distances along its heading (negative = behind the middle). */
export interface Body { r: number; at: readonly number[] }

/**
 * Move a body to (x, z) facing `yaw`, then push it out of whatever it is in. Returns where its middle ends up
 * and how far it was pushed (0 = clear): the caller turns that into a soft stop.
 */
export function resolveBody(x: number, z: number, yaw: number, b: Body, o: Obstacles): { x: number; z: number; pushed: number; nx: number; nz: number } {
  const sx = Math.sin(yaw), sz = Math.cos(yaw);
  let px = x, pz = z;
  for (let pass = 0; pass < 2; pass++) {
    for (const d of b.at) {
      const [cx, cz] = pushOut(px + sx * d, pz + sz * d, b.r, o);
      px = cx - sx * d; pz = cz - sz * d;
    }
  }
  const dx = px - x, dz = pz - z, pushed = Math.hypot(dx, dz);
  return { x: px, z: pz, pushed, nx: pushed > 1e-6 ? dx / pushed : 0, nz: pushed > 1e-6 ? dz / pushed : 0 };
}

/** Is there room for this body here? (Where to put a man down, where to park.) */
export const bodyFree = (x: number, z: number, yaw: number, b: Body, o: Obstacles) => resolveBody(x, z, yaw, b, o).pushed < 0.02;

// ── the horse ──────────────────────────────────────────────────────────────────────────

/** The horse's size on the ground (the model at scale 0.3: about 2.5 m nose to tail, measured by tools/walk-check.ts; see the notes in 3D-PLAN.md WP8). */
export const HORSE_BODY: Body = { r: 0.55, at: [-0.7, 0.6] };

/** Gaits, by how hard the stick is pushed. Metres a second. */
export const HORSE_SPEEDS = { walk: 1.6, trot: 3.8, canter: 6.6 };
export type HorseGait = "stand" | "walk" | "trot" | "canter";

/** The speed a stick push asks for: 0 standing, then a walk, a trot, a canter at full push. */
export function horseWantSpeed(mag: number): number {
  if (mag < 0.12) return 0;
  if (mag < 0.4) return 0.6 + (HORSE_SPEEDS.walk - 0.6) * ((mag - 0.12) / 0.28);
  if (mag < 0.75) return HORSE_SPEEDS.walk + (HORSE_SPEEDS.trot - HORSE_SPEEDS.walk) * ((mag - 0.4) / 0.35);
  return HORSE_SPEEDS.trot + (HORSE_SPEEDS.canter - HORSE_SPEEDS.trot) * Math.min(1, (mag - 0.75) / 0.25);
}

export function horseGait(speed: number): HorseGait {
  if (speed < 0.3) return "stand";
  if (speed < 2.5) return "walk";
  if (speed < 5.0) return "trot";
  return "canter";
}

/** How much of each clip shows at a speed: Idle, WalkSlow, Walk, Run (they add up to 1). */
export function horseClipWeights(speed: number): { idle: number; slow: number; walk: number; run: number } {
  const t = (a: number, b: number) => clamp((speed - a) / (b - a), 0, 1);
  const idle = 1 - t(0.15, 0.7);
  const toWalk = t(1.4, 2.0), toRun = t(3.6, 4.4);
  const moving = 1 - idle;
  return { idle, slow: moving * (1 - toWalk), walk: moving * toWalk * (1 - toRun), run: moving * toRun };
}

export interface HorseState { x: number; z: number; yaw: number; speed: number; turn: number }

/**
 * One step of riding. `wantYaw` is where the stick points (null: not pushed), `mag` how hard (0..1).
 * The horse turns at a limited rate (slower the faster he goes), speeds up gently and slows down a little quicker,
 * and a hard turn at speed slows him. Trees, fences and the rest stop him: a soft stop, never a stick.
 * Returns how hard he met something (m/s into it), for the caller to show or ignore.
 */
export function stepHorse(s: HorseState, wantYaw: number | null, mag: number, dt: number, o: Obstacles): number {
  let want = wantYaw === null ? 0 : horseWantSpeed(mag);
  if (wantYaw !== null) {
    const d = angDiff(s.yaw, wantYaw);
    // turning on the spot is for a walk: the faster he goes, the less he is asked to turn short
    const maxRate = 2.6 - 1.5 * clamp(s.speed / HORSE_SPEEDS.canter, 0, 1);
    const wantTurn = clamp(d * 4.5, -maxRate, maxRate);
    s.turn += (wantTurn - s.turn) * Math.min(1, dt * 7);
    if (Math.abs(d) > 1.0 && want > HORSE_SPEEDS.walk) want = HORSE_SPEEDS.walk + (want - HORSE_SPEEDS.walk) * 0.35;
  } else s.turn += (0 - s.turn) * Math.min(1, dt * 8);
  s.yaw += s.turn * dt * (0.35 + 0.65 * clamp(s.speed / 1.2, 0, 1)); // he turns as he walks, not on the spot
  s.speed = approach(s.speed, want, 3.2 * dt, 5.0 * dt);
  const nx = s.x + Math.sin(s.yaw) * s.speed * dt, nz = s.z + Math.cos(s.yaw) * s.speed * dt;
  const r = resolveBody(nx, nz, s.yaw, HORSE_BODY, o);
  s.x = r.x; s.z = r.z;
  if (r.pushed > 0.004) {
    // the part of his speed that went into the thing is lost, the rest slides along it
    const into = s.speed * (Math.sin(s.yaw) * -r.nx + Math.cos(s.yaw) * -r.nz);
    if (into > 0) s.speed = Math.max(0, s.speed - into * 1.2);
    return Math.max(0, into);
  }
  return 0;
}

// ── the car ────────────────────────────────────────────────────────────────────────────

/** A car as the garden has it: about 4.8 m long and 2 m wide (every one of the six models is within 10% of that). */
export const CAR_BODY: Body = { r: 0.98, at: [-1.3, 0, 1.3] };
export const CAR = { top: 10.5, reverse: 3.2, accel: 5.2, brake: 14, wheelbase: 2.7, grip: 8, slide: 2.4 };

export interface CarState {
  x: number; z: number; yaw: number;
  /** World velocity, m/s. */
  vx: number; vz: number;
  /** The front wheels' angle (radians, + = right). */
  steer: number;
  yawRate: number;
  /** For the body: lean about its length (+ = leans out of a right turn) and nose dip. */
  roll: number; pitch: number;
  /** Forward speed (signed) and the push of the throttle, as last stepped. */
  vf: number; accel: number;
}

export const newCar = (x: number, z: number, yaw: number): CarState => ({ x, z, yaw, vx: 0, vz: 0, steer: 0, yawRate: 0, roll: 0, pitch: 0, vf: 0, accel: 0 });

/**
 * One step of driving. `ix` -1..1 (left..right), `iy` -1..1 (down = brake, then reverse; up = accelerate).
 * Arcade: steering shrinks with speed, the sideways slip is killed quickly (so it grips), but a hard turn
 * with the brake held lets the back out (the hand-brake turn). Returns how hard it hit something (m/s).
 */
export function stepCar(s: CarState, ix: number, iy: number, dt: number, o: Obstacles): number {
  const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
  const vf0 = s.vx * fx + s.vz * fz;
  // throttle, brake, reverse, and coasting: all along the way the car points
  let a = 0;
  if (iy > 0.05) {
    if (vf0 < -0.4) a = CAR.brake * 0.8 * iy; // still rolling back: the brake first
    else a = CAR.accel * iy * (1 - Math.max(0, vf0) / CAR.top);
  } else if (iy < -0.05) {
    if (vf0 > 0.5) a = -CAR.brake * -iy; // braking
    else a = -CAR.accel * 0.55 * -iy * (1 - Math.max(0, -vf0) / CAR.reverse); // reversing
  } else if (Math.abs(vf0) > 0.05) a = -Math.sign(vf0) * (0.9 + 0.1 * Math.abs(vf0)); // coasts down
  s.vx += fx * a * dt; s.vz += fz * a * dt;
  const vf1 = s.vx * fx + s.vz * fz;
  s.accel = a;
  // steering: the wheels turn to the stick, less the faster it goes
  const speedK = clamp(Math.abs(vf1) / CAR.top, 0, 1);
  const maxSteer = 0.62 - 0.36 * speedK;
  s.steer += (ix * maxSteer - s.steer) * Math.min(1, dt * 7);
  // a bicycle: the nose turns at speed / wheelbase * tan(angle); reversing turns the other way round
  const rate = (vf1 / CAR.wheelbase) * Math.tan(s.steer);
  s.yawRate += (rate - s.yawRate) * Math.min(1, dt * 10);
  s.yaw += s.yawRate * dt;
  // the way it was going stays, the way it points has turned: the part of it now sideways dies away (grip);
  // braking hard into a turn lets the back out
  const nfx = Math.sin(s.yaw), nfz = Math.cos(s.yaw), nrx = Math.cos(s.yaw), nrz = -Math.sin(s.yaw);
  let vf = s.vx * nfx + s.vz * nfz, vl = s.vx * nrx + s.vz * nrz;
  const slide = iy < -0.5 && Math.abs(ix) > 0.3 && Math.abs(vf) > 4;
  vl *= Math.exp(-(slide ? CAR.slide : CAR.grip) * dt);
  if (iy > -0.05 && iy < 0.05 && Math.abs(vf) < 0.18) vf = 0; // comes to rest
  s.vx = nfx * vf + nrx * vl; s.vz = nfz * vf + nrz * vl;
  const r = resolveBody(s.x + s.vx * dt, s.z + s.vz * dt, s.yaw, CAR_BODY, o);
  s.x = r.x; s.z = r.z;
  let hit = 0;
  if (r.pushed > 0.004) {
    // a soft bounce: the speed into the thing is turned round a little, the car loses some of the rest
    const vn = s.vx * r.nx + s.vz * r.nz;
    if (vn < 0) { s.vx -= 1.25 * vn * r.nx; s.vz -= 1.25 * vn * r.nz; hit = -vn; }
    s.vx *= 0.92; s.vz *= 0.92;
  }
  s.vf = s.vx * nfx + s.vz * nfz;
  // the body leans out of a turn and dips its nose under the brake
  const roll = clamp(-s.yawRate * s.vf * 0.011, -0.07, 0.07);
  const pitch = clamp(-a * 0.0035, -0.05, 0.05);
  s.roll += (roll - s.roll) * Math.min(1, dt * 6);
  s.pitch += (pitch - s.pitch) * Math.min(1, dt * 6);
  return hit;
}

/** The speed readout: miles an hour (it is a British garden). */
export const mph = (metresPerSecond: number) => Math.round(Math.abs(metresPerSecond) * 2.23694);
