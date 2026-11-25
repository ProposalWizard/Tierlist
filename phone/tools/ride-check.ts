/**
 * CHECKS THE NUMBERS OF RIDING AND DRIVING (src/three/garden/ride.ts) ON THEIR OWN: no graphics, no phone.
 *
 *   cd phone && npx tsx tools/ride-check.ts
 *
 * A horse and a car are driven by a scripted stick round a small pretend garden (a fountain, a wall, a fence with a gap, the
 * boundary) and must: reach the speeds they should, turn at a limited rate, never be inside anything, never leave the garden,
 * stop softly against a wall, reverse, and slide a little only under a hard-braked turn. Exits 1 on any failure.
 */
import { CAR, CAR_BODY, HORSE_BODY, HORSE_SPEEDS, bodyFree, horseClipWeights, horseGait, mph, newCar, stepCar, stepHorse, type Obstacles, type HorseState } from "../src/three/garden/ride";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.log(`   FAIL ${what}`); } };
const obs: Obstacles = {
  limit: 18.3,
  boxes: [[-6.2, 6.2, -17.7, -8.9], [4.5, 7.5, 5, 6]],
  circles: [[0, -2.2, 1.95], [-10, 8, 0.6]],
  extra: [[17.75, 19.15, 5.6, 7.6]],
};
const DT = 1 / 30;
const wantYawFromStick = (ix: number, iy: number, camYaw: number) => { const m = Math.hypot(ix, iy); if (m < 0.08) return null; const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw); return Math.atan2(fx * iy + rx * ix, fz * iy + rz * ix); };

console.log("horse");
{
  const h: HorseState = { x: 0, z: 14, yaw: Math.PI, speed: 0, turn: 0 };
  const run = (secs: number, ix: number, iy: number, camYaw?: number) => {
    let bad = 0, maxSp = 0, maxTurn = 0, hit = 0;
    for (let t = 0; t < secs; t += DT) {
      const yw0 = h.yaw;
      const cam = camYaw ?? h.yaw + Math.PI; // the camera is behind him
      const w = wantYawFromStick(ix, iy, cam);
      hit = Math.max(hit, stepHorse(h, w, Math.min(1, Math.hypot(ix, iy)), DT, obs));
      if (!bodyFree(h.x, h.z, h.yaw, HORSE_BODY, obs)) bad++;
      maxSp = Math.max(maxSp, h.speed);
      maxTurn = Math.max(maxTurn, Math.abs(((h.yaw - yw0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / DT);
    }
    return { bad, maxSp, maxTurn, hit };
  };
  const lane = () => { h.x = 12; h.z = 16; h.yaw = Math.PI; h.speed = 0; h.turn = 0; };
  lane();
  let r = run(3, 0, 0.3);
  ok(Math.abs(h.speed - 0.6 - (HORSE_SPEEDS.walk - 0.6) * ((0.3 - 0.12) / 0.28)) < 0.05, `a gentle push walks (${h.speed.toFixed(2)} m/s)`);
  console.log(`   gentle push: ${h.speed.toFixed(2)} m/s ${horseGait(h.speed)} ${mph(h.speed)} mph`);
  lane();
  r = run(3, 0, 0.6);
  ok(horseGait(h.speed) === "trot", `a half push trots (${h.speed.toFixed(2)})`);
  console.log(`   half push: ${h.speed.toFixed(2)} m/s ${horseGait(h.speed)} ${mph(h.speed)} mph, at ${h.x.toFixed(1)}, ${h.z.toFixed(1)}`);
  lane();
  r = run(2.0, 0, 1);
  console.log(`   full push 2 s: ${h.speed.toFixed(2)} m/s (${mph(h.speed)} mph)`);
  r = run(2.5, 0, 1);
  ok(horseGait(h.speed) === "canter" && h.speed > HORSE_SPEEDS.canter - 0.3, `a full push canters (${h.speed.toFixed(2)})`);
  ok(r.bad === 0, "inside something while cantering");
  console.log(`   canter: ${h.speed.toFixed(2)} m/s ${mph(h.speed)} mph, at ${h.x.toFixed(1)}, ${h.z.toFixed(1)} (a clear lane), pushed ${r.hit.toFixed(2)}`);
  // straight into the fountain for 8 s: he must stop against it, never in it
  h.x = 0; h.z = 14; h.yaw = Math.PI; h.speed = 0; h.turn = 0;
  r = run(9, 0, 1);
  const dFount = Math.hypot(h.x, h.z + 2.2);
  console.log(`   8 s more into the fountain: at ${h.x.toFixed(2)}, ${h.z.toFixed(2)}, ${dFount.toFixed(2)} m from its middle (its edge is 1.95)`);
  ok(r.bad === 0, "inside the fountain or the wall");
  ok(dFount > 1.95 + 0.4, "ended inside the fountain");
  // turning: a hard left from a canter never turns faster than the limit
  lane(); h.speed = HORSE_SPEEDS.canter; h.turn = 0;
  r = run(2, -1, 0.2);
  ok(r.maxTurn < 2.7, `turn rate ${r.maxTurn.toFixed(2)} rad/s over the limit`);
  console.log(`   hard turn from a canter: fastest ${r.maxTurn.toFixed(2)} rad/s, speed after ${h.speed.toFixed(2)}`);
  // the boundary and the wall: a long ride in a circle and into every edge
  let badAll = 0;
  for (const [x, z, yw] of [[17, 0, Math.PI / 2], [-17, 0, -Math.PI / 2], [0, 17, 0], [0, -7, Math.PI], [5, 2, 0]] as const) {
    h.x = x; h.z = z; h.yaw = yw; h.speed = 0; h.turn = 0;
    const q = run(6, 0, 1, yw + Math.PI);
    badAll += q.bad;
    ok(Math.abs(h.x) <= 18.3 && Math.abs(h.z) <= 18.3, `left the garden at ${x},${z}: ${h.x.toFixed(1)},${h.z.toFixed(1)}`);
  }
  ok(badAll === 0, "inside an obstacle");
  // the clips add to one
  for (const sp of [0, 0.5, 1, 1.8, 3, 4, 5, 6.6]) { const w = horseClipWeights(sp); ok(Math.abs(w.idle + w.slow + w.walk + w.run - 1) < 1e-9, `clip weights at ${sp}`); }
}

console.log("car");
{
  let c = newCar(10, 12, Math.PI);
  const run = (secs: number, ix: number, iy: number) => {
    let bad = 0, hit = 0, maxSlip = 0;
    for (let t = 0; t < secs; t += DT) {
      hit = Math.max(hit, stepCar(c, ix, iy, DT, obs));
      if (!bodyFree(c.x, c.z, c.yaw, CAR_BODY, obs)) bad++;
      maxSlip = Math.max(maxSlip, Math.abs(c.vx * Math.cos(c.yaw) - c.vz * Math.sin(c.yaw)));
    }
    return { bad, hit, maxSlip };
  };
  c = newCar(10, 12, Math.PI);
  let r = run(1, 0, 1);
  console.log(`   1 s of throttle: ${c.vf.toFixed(2)} m/s (${mph(c.vf)} mph), moved to z ${c.z.toFixed(2)}`);
  ok(c.vf > 3 && c.vf < 7, `pulls away at a car's pace (${c.vf.toFixed(2)})`);
  r = run(6, 0, 1);
  console.log(`   7 s: ${c.vf.toFixed(2)} m/s (${mph(c.vf)} mph) at ${c.x.toFixed(1)}, ${c.z.toFixed(1)}`);
  ok(c.vf <= CAR.top + 0.01, "over the top speed");
  ok(r.bad === 0, "inside something");
  // coast, then brake, then reverse
  c = newCar(10, 4, Math.PI); c.vz = -8; c.vx = 0;
  const v0 = Math.abs(c.vz);
  run(1.5, 0, 0);
  ok(Math.abs(c.vf) < v0 && Math.abs(c.vf) > 4, `coasting slows gently (${v0} -> ${c.vf.toFixed(2)})`);
  const v1 = c.vf;
  run(0.5, 0, -1);
  ok(c.vf < v1 - 3, `the brake bites (${v1.toFixed(2)} -> ${c.vf.toFixed(2)})`);
  run(3, 0, -1);
  ok(c.vf < -1.5 && c.vf >= -CAR.reverse - 0.01, `then it reverses (${c.vf.toFixed(2)} m/s)`);
  console.log(`   brake then reverse: ${c.vf.toFixed(2)} m/s`);
  // steering: slow = tight, fast = wide; limited
  const turnAt = (v: number) => { const k = newCar(-8, -14, 0); k.vz = v; k.vf = v; let t = 0; let a = 0; while (t < 1.5) { stepCar(k, 1, 0.4 * (v > 0 ? 1 : 0), DT, { ...obs, boxes: [], circles: [] }); t += DT; } a = k.yaw; return a / 1.5; };
  const slow = turnAt(3), fast = turnAt(10);
  console.log(`   steering full right: ${slow.toFixed(2)} rad/s at 3 m/s, ${fast.toFixed(2)} rad/s at 10 m/s`);
  ok(slow > 0.4 && fast > 0.6 && fast < 1.6, "steering rates are sensible");
  // a head-on into the shop wall: soft stop, no entry
  c = newCar(0, -2.0 + 2, 0); c.x = -3; c.z = -4; c.yaw = Math.PI; c.vx = 0; c.vz = -9; c.vf = -9;
  r = run(3, 0, 1);
  console.log(`   9 m/s into the shop wall: at z ${c.z.toFixed(2)} (wall at -8.9, car is 2.4 long so the nose stops near -6.4), hit ${r.hit.toFixed(1)}, speed after ${c.vf.toFixed(2)}`);
  ok(r.bad === 0 && c.z > -8.9 + CAR_BODY.r, "went into the shop wall");
  ok(r.hit > 3, "no impact felt");
  // the doorway plug and the boundary
  c = newCar(17, 6.6, Math.PI / 2); r = run(5, 0, 1);
  ok(c.x < 17.75 - CAR_BODY.r + 0.5 && Math.abs(c.x) <= 18.3, `drove into the house's doorway or out of the garden (${c.x.toFixed(2)})`);
  // the hand-brake turn slides a little, a plain turn does not
  c = newCar(0, 14, Math.PI); run(3, 0, 1);
  const plain = run(1.2, 1, 1).maxSlip;
  c = newCar(0, 14, Math.PI); run(3, 0, 1);
  const drift = run(1.2, 1, -1).maxSlip;
  console.log(`   sideways slip: ${plain.toFixed(2)} m/s in a plain turn, ${drift.toFixed(2)} m/s with the brake held`);
  ok(plain < 3.0, "the car slides in a plain turn");
}
console.log(failed ? `${failed} problem(s)` : "all good");
process.exit(failed ? 1 : 0);
