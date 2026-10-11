/**
 * BALL PHYSICS — the real football, measured (Leo, 11 Oct 2026: "ball physics
 * needs to be perfect"). docs/gameplay15/physics.md has the numbers and sources.
 *
 * 1. A reference table from a real ball (RK4, quadratic drag with the drag
 *    crisis, grass bounce and roll), checked against published anchors.
 * 2. The Old and New engine balls flown through the same launches, and the
 *    New one held to the reference.
 * 3. Bounce and roll-out, spin decay.
 * 4. Posts and bar: the deflection angle off a round post.
 * 5. The net catches and drops the ball; nothing stops dead in the air.
 * 6. Frame-rate independence: the same chances played at 30/60/120 fps.
 */
import {
  integrateBallOld, buildScenario, initDefenders, stepDefenders, stepKeeper,
  stepReactions, stepBall, launch, stepBallInNet, setBallPhysics, realBallOn, type Ball, type Outcome,
} from "../../lib/star/canvasEngine";
import {
  integrateBallReal, frameContact, bounceOffFrame,
  K_AIR, dragCoeff, ROLL_DECEL, GRASS_DRAG, BOUNCE_E, POST_CX_L, POST_HIT_R,
  SPIN_TAU_AIR,
} from "../../lib/star/ballPhysics";
import { POST_L, POST_R, NET_DEPTH, GOAL_H } from "../../lib/star/pitch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const f1 = (n: number) => n.toFixed(1), f2 = (n: number) => n.toFixed(2);

// ── 1. The reference ball ───────────────────────────────────────────────────
// Its own integrator (RK4, 1 ms), written from the physics, not from the engine.
interface Flight { carry: number; tFlight: number; apex: number; t20: number; v20: number; z20: number; rollTotal: number; tStop: number; }

function refFlight(v0: number, deg: number, maxT = 30): Flight {
  const a = deg * Math.PI / 180;
  let x = 0, z = 0.11, vx = v0 * Math.cos(a), vz = v0 * Math.sin(a);
  const dt = 0.001;
  let t = 0, carry = -1, tFlight = -1, apex = z, t20 = -1, v20 = -1, z20 = -1;
  const acc = (vx: number, vz: number) => {
    const s = Math.hypot(vx, vz);
    const k = K_AIR * dragCoeff(s) * s;
    return [-k * vx, -k * vz - 9.8];
  };
  let airborne = vz > 0;
  let rw = 0;   // rim speed rω: struck through the middle, no spin yet
  while (t < maxT) {
    if (airborne) {
      const [ax1, az1] = acc(vx, vz);
      const [ax2, az2] = acc(vx + ax1 * dt / 2, vz + az1 * dt / 2);
      const [ax3, az3] = acc(vx + ax2 * dt / 2, vz + az2 * dt / 2);
      const [ax4, az4] = acc(vx + ax3 * dt, vz + az3 * dt);
      const nvx = vx + dt / 6 * (ax1 + 2 * ax2 + 2 * ax3 + ax4);
      const nvz = vz + dt / 6 * (az1 + 2 * az2 + 2 * az3 + az4);
      x += (vx + nvx) / 2 * dt; z += (vz + nvz) / 2 * dt;
      vx = nvx; vz = nvz;
      apex = Math.max(apex, z);
      if (z <= 0.11) {
        if (carry < 0) { carry = x; tFlight = t; }
        z = 0.11;
        if (vz < -0.5) {
          // grass: vertical e; friction (μ 0.5) takes speed off until it
          // rolls; a thin shell's slip falls 2.5× the speed lost.
          const e = BOUNCE_E;
          const grip = Math.min(1, (-vz / 3) ** 2);
          const top = Math.max(-1, Math.min(1, rw / Math.max(vx, 1e-3)));
          const loss = Math.min(0.5 * grip * (1 + e) * -vz, 0.4 * Math.max(0, vx - rw));
          // topspin flattens the rebound a little (the game's 0.18)
          vx -= loss; rw = Math.min(vx, rw + 1.5 * loss); vz = -vz * e * (1 - top * 0.18);
        } else { vz = 0; airborne = false; }
      }
    } else {
      const d = (ROLL_DECEL + GRASS_DRAG * vx + K_AIR * dragCoeff(vx) * vx * vx) * dt;
      if (vx <= d) { vx = 0; break; }
      x += (vx - d / 2) * dt; vx -= d;
    }
    t += dt;
    if (t20 < 0 && x >= 20) { t20 = t; v20 = Math.hypot(vx, vz); z20 = z - 0.11; }
  }
  if (carry < 0) { carry = 0; tFlight = 0; }
  return { carry, tFlight, apex: apex - 0.11, t20, v20, z20, rollTotal: x, tStop: t };
}

// ── The engine ball, Old or New, flown on its own (no players) ──────────────
function engFlight(kind: "old" | "new", v0: number, deg: number, opts: { spin?: number; top?: number } = {}): Flight & { lateral25: number; spinEnd: number } {
  const a = deg * Math.PI / 180;
  const b: Ball = {
    pos: { x: 0, y: 0 }, vel: { x: 0, y: -v0 * Math.cos(a) }, z: 0.08, vz: v0 * Math.sin(a),
    spin: opts.spin ?? 0, topspin: opts.top ?? 0, resting: false, loose: false, contactCd: 0,
    lastTouch: "attack", receiverControlT: 0, event: null, inNet: false,
  };
  const dt = 1 / 180;
  let t = 0, carry = -1, tFlight = -1, apex = 0, t20 = -1, v20 = -1, z20 = -1, lateral25 = NaN, spin25 = NaN;
  let wasUp = b.z > 0.02 || b.vz > 0;
  while (t < 30 && !b.resting) {
    if (kind === "old") integrateBallOld(b, undefined, dt); else integrateBallReal(b, undefined, dt);
    t += dt;
    apex = Math.max(apex, b.z);
    const d = -b.pos.y;
    if (wasUp && carry < 0 && b.z <= 0) { carry = d; tFlight = t; }
    if (t20 < 0 && d >= 20) { t20 = t; v20 = Math.hypot(b.vel.x, b.vel.y, b.vz); z20 = b.z; }
    if (Number.isNaN(lateral25) && d >= 25) { lateral25 = b.pos.x; spin25 = b.spin; }
  }
  if (carry < 0) { carry = 0; tFlight = 0; }
  return { carry, tFlight, apex, t20, v20, z20, rollTotal: Math.hypot(b.pos.x, b.pos.y), tStop: t, lateral25, spinEnd: spin25 };
}

const LAUNCHES: { name: string; v: number; deg: number }[] = [
  { name: "Shot, driven", v: 30, deg: 5 },
  { name: "Free kick", v: 25, deg: 14 },
  { name: "Driven pass (ground)", v: 20, deg: 0 },
  { name: "Ground pass", v: 12, deg: 0 },
  { name: "Short pass", v: 8, deg: 0 },
  { name: "Lofted pass", v: 20, deg: 25 },
  { name: "Clearance", v: 25, deg: 35 },
  { name: "Goal kick", v: 30, deg: 35 },
  { name: "Chip", v: 12, deg: 45 },
];

console.log("\n1-2. REFERENCE (real ball) vs ENGINE  [carry m / flight s / apex m · at 20 m: s and m/s · total incl. roll m / s]");
const rows: string[] = [];
for (const L of LAUNCHES) {
  const r = refFlight(L.v, L.deg), o = engFlight("old", L.v, L.deg), n = engFlight("new", L.v, L.deg);
  const fmt = (f: Flight) => `${f1(f.carry)}/${f2(f.tFlight)}/${f1(f.apex)} · ${f.t20 > 0 ? f2(f.t20) : "—"}s ${f.t20 > 0 ? f1(f.v20) : "—"} · ${f1(f.rollTotal)}/${f1(f.tStop)}`;
  rows.push(`  ${L.name.padEnd(22)} ${L.v} m/s ${String(L.deg).padStart(2)}°  REF ${fmt(r)}\n${" ".repeat(38)}OLD ${fmt(o)}\n${" ".repeat(38)}NEW ${fmt(n)}`);
  // New must sit on the reference (Euler at 1/180 s vs RK4 at 1 ms).
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= Math.max(0.4, Math.abs(b) * tol);
  if (r.carry > 0) check(near(n.carry, r.carry, 0.06), `${L.name}: New carry ${f1(n.carry)} vs reference ${f1(r.carry)}`);
  if (r.t20 > 0 && r.t20 < 3) check(near(n.t20, r.t20, 0.06), `${L.name}: New time to 20 m ${f2(n.t20)} vs reference ${f2(r.t20)}`);
  check(near(n.rollTotal, r.rollTotal, 0.16), `${L.name}: New total distance ${f1(n.rollTotal)} vs reference ${f1(r.rollTotal)}`);
}
console.log(rows.join("\n"));

// Published anchors the reference itself must meet.
const gk = refFlight(30, 35), clr = refFlight(25, 35), shot = refFlight(30, 5);
console.log(`\n  anchors: goal kick 30 m/s 35° carries ${f1(gk.carry)} m (real long kicks 55-65 m); clearance 25 m/s 35° ${f1(clr.carry)} m (vacuum ${f1(625 * Math.sin(70 * Math.PI / 180) / 9.8)} m); 30 m/s shot reaches 20 m in ${f2(shot.t20)} s at ${f1(shot.v20)} m/s`);
check(gk.carry > 50 && gk.carry < 66, `reference goal kick carry ${f1(gk.carry)} m outside 50-66`);
check(shot.t20 > 0.65 && shot.t20 < 0.85, `reference 30 m/s shot to 20 m ${f2(shot.t20)} s`);

// ── 3. Bounce, roll-out, spin ────────────────────────────────────────────────
console.log("\n3. BOUNCE, ROLL, SPIN");
for (const kind of ["old", "new"] as const) {
  // Dropped from 2 m: FIFA turf rebound 0.60-0.85 m.
  const b: Ball = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, z: 2, vz: 0, spin: 0, topspin: 0, resting: false, loose: false, contactCd: 0, lastTouch: "attack", receiverControlT: 0, event: null, inNet: false };
  let bounced = false, apex = 0;
  for (let i = 0; i < 1000; i++) {
    const was = b.vz;
    (kind === "old" ? integrateBallOld : integrateBallReal)(b, undefined, 1 / 180);
    if (!bounced && was < 0 && b.vz > 0) bounced = true;
    if (bounced) { apex = Math.max(apex, b.z); if (b.vz < 0) break; }
  }
  // FIFA-style ramp roll: rolling at 3.4 m/s on cut grass goes 4-10 m.
  const r: Ball = { pos: { x: 0, y: 0 }, vel: { x: 0, y: -3.4 }, z: 0, vz: 0, spin: 0, topspin: 1, resting: false, loose: false, contactCd: 0, lastTouch: "attack", receiverControlT: 0, event: null, inNet: false };
  for (let i = 0; i < 20000 && !r.resting; i++) (kind === "old" ? integrateBallOld : integrateBallReal)(r, undefined, 1 / 180);
  const roll = -r.pos.y;
  // Curl: a 25 m/s free kick with spin 0.7 (turn rate 0.34 rad/s, about a real
  // top-spin free kick: S≈0.25, CL≈0.25), lateral bend at 25 m, spin left.
  const c = engFlight(kind, 25, 12, { spin: 0.7 });
  console.log(`  ${kind.toUpperCase()}: 2 m drop rebounds ${f2(apex)} m (FIFA 0.60-0.85) · 3.4 m/s roll goes ${f1(roll)} m (FIFA ramp 4-10) · free kick bends ${f2(Math.abs(c.lateral25))} m over 25 m, spin left at 25 m ${f1(c.spinEnd / 0.7 * 100)}%`);
  if (kind === "new") {
    check(apex >= 0.6 && apex <= 0.85, `New 2 m drop rebound ${f2(apex)} m`);
    check(roll >= 4 && roll <= 10, `New ramp roll ${f1(roll)} m`);
    check(c.spinEnd < 0.7 * Math.exp(-0.5 / SPIN_TAU_AIR) && c.spinEnd > 0.7 * 0.6, `New spin at 25 m ${f2(c.spinEnd)} of 0.70`);
  }
}

// ── 4. Posts and bar ─────────────────────────────────────────────────────────
console.log("\n4. POSTS AND BAR — the deflection angle off a round post (New)");
{
  // A ball at 20 m/s straight at the left post, offset sideways by b from the
  // post's centre. Real: reflection about the contact normal, e = 0.7.
  const lines: string[] = [];
  let inCount = 0;
  for (const off of [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15]) {
    const x0 = POST_CX_L + off;
    const b: Ball = { pos: { x: x0, y: 1 }, vel: { x: 0, y: -20 }, z: 1, vz: 0, spin: 0, topspin: 0, resting: false, loose: false, contactCd: 0, lastTouch: "attack", receiverControlT: 0, event: null, inNet: false };
    const px = b.pos.x, py = b.pos.y, pz = b.z;
    b.pos.y -= 1.2;  // a long step straight through
    const hit = frameContact(px, py, pz, b.pos.x, b.pos.y, b.z);
    if (!hit) { lines.push(`off ${f2(off)}: miss`); continue; }
    const goingIn = bounceOffFrame(b, px, py, pz, hit);
    if (goingIn) inCount++;
    const ang = Math.atan2(b.vel.x, b.vel.y) * 180 / Math.PI;
    // Expected, off a round post: the normal is at θ with sin θ = off / 0.17 m;
    // the speed into it comes back ×0.7, the speed along it ×0.9.
    const sinT = off / POST_HIT_R, cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
    const exX = 20 * sinT * cosT * (0.7 + 0.9), exY = 20 * (0.7 * cosT * cosT - 0.9 * sinT * sinT);
    check(Math.hypot(b.vel.x - exX, b.vel.y - exY) < 0.05, `post off ${f2(off)}: (${f2(b.vel.x)}, ${f2(b.vel.y)}) vs expected (${f2(exX)}, ${f2(exY)})`);
    lines.push(`off ${off >= 0 ? "+" : ""}${f2(off)} m → leaves at ${f1(ang)}° from straight back, ${f1(Math.hypot(b.vel.x, b.vel.y))} m/s${goingIn ? ", IN" : ""}`);
    // Physical checks: a centre hit comes straight back at 0.7 × speed;
    // an inside clip (off > 0 for the left post) is sent inwards/in.
    if (off === 0) check(Math.abs(b.vel.x) < 0.01 && Math.abs(b.vel.y - 14) < 0.05, `centre post hit: ${f2(b.vel.x)}, ${f2(b.vel.y)}`);
    if (off >= 0.1) check(b.vel.x > 0, `inside clip of the left post should go inwards`);
    if (off <= -0.1) check(b.vel.x < 0, `outside clip of the left post should go wide`);
  }
  console.log("  " + lines.join("\n  "));
  check(inCount >= 1, "no glancing inside hit ever went in off the post");
  // Bar: under the bar going in goes down and in; over it goes up and over.
  const bar = (z0: number) => {
    const b: Ball = { pos: { x: 34, y: 1 }, vel: { x: 0, y: -20 }, z: z0, vz: 0, spin: 0, topspin: 0, resting: false, loose: false, contactCd: 0, lastTouch: "attack", receiverControlT: 0, event: null, inNet: false };
    const px = 34, py = 1, pz = z0; b.pos.y -= 1.2;
    const hit = frameContact(px, py, pz, b.pos.x, b.pos.y, b.z);
    if (!hit) return "miss";
    const inn = bounceOffFrame(b, px, py, pz, hit);
    return `${hit.part} → vy ${f1(b.vel.y)} vz ${f1(b.vz)}${inn ? " (in)" : ""}`;
  };
  console.log(`  bar: z 2.36 ${bar(2.36)} · z 2.50 ${bar(2.50)} · z 2.64 ${bar(2.64)}`);
}

// ── 5. The net ───────────────────────────────────────────────────────────────
console.log("\n5. THE NET — shots into the goal, then 3 s after the line");
for (const kind of ["old", "new"] as const) {
  setBallPhysics(kind);
  let stuckAir = 0, outside = 0, maxBulge = 0, n = 0;
  const lines: string[] = [];
  for (const [x, z, v] of [[POST_L + 0.4, 2.2, 30], [34, 0.3, 25], [POST_R - 0.4, 1.2, 28], [33, 2.3, 15], [36, 0.1, 10]] as const) {
    const b: Ball = { pos: { x, y: -0.01 }, vel: { x: 2, y: -v }, z, vz: 1, spin: 0, topspin: 0, resting: false, loose: false, contactCd: 0, lastTouch: "attack", receiverControlT: 0, event: null, inNet: true };
    if (kind === "old") { b.vel.x *= 0.55; b.vel.y *= 0.55; b.vz = Math.min(b.vz, 0); }  // what the line does in Old
    let stillT = 0;
    for (let i = 0; i < 180; i++) {
      const pz = b.z, px = b.pos.x, py = b.pos.y;
      stepBallInNet(b, 1 / 60);
      maxBulge = Math.max(maxBulge, -b.pos.y);
      const moved = Math.hypot(b.pos.x - px, b.pos.y - py, b.z - pz);
      if (b.z > 0.3 && moved < 1e-4) stillT += 1 / 60;
    }
    n++;
    if (stillT > 0.2) stuckAir++;
    if (b.pos.y < -NET_DEPTH || b.pos.x < POST_L || b.pos.x > POST_R || b.z > GOAL_H) outside++;
    lines.push(`(${f1(x)}, ${f1(z)} m, ${v} m/s) ends ${f2(-b.pos.y)} m deep, ${f2(b.z)} m up`);
  }
  console.log(`  ${kind.toUpperCase()}: ${lines.join(" · ")} · deepest ${f2(maxBulge)} m (net ${NET_DEPTH})`);
  if (kind === "new") {
    check(stuckAir === 0, `New net: ${stuckAir} ball(s) hung still in the air`);
    check(outside === 0, `New net: ${outside} ball(s) went through the netting`);
  }
}
setBallPhysics("old");

// ── 6. Frame-rate independence ───────────────────────────────────────────────
// The CanvasMatch loop: Old = 3 substeps of frame/3; New = fixed 1/180 s steps
// with the remainder carried to the next frame.
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function playAt(fps: number, mode: "old" | "new", seed: number): { out: Outcome | null; x: number; y: number } {
  setBallPhysics(mode);
  const rng = mulberry32(seed * 7919 + 13);
  const kinds = ["long_range", "one_on_one", "tight_angle", "free_kick", "cutback", "through_ball"] as const;
  const kind = kinds[seed % kinds.length];
  const sc = buildScenario(kind, rng, 65, 65, 60);
  initDefenders(sc, rng);
  const tx = (POST_L + POST_R) / 2 + (rng() - 0.5) * 6;
  const ball = launch(sc, { x: tx - sc.ball.x, y: -Math.max(1, sc.ball.y) }, 0.55 + rng() * 0.45,
    { cx: (rng() - 0.5) * 1.2, cy: -0.3 + rng() * 0.9 }, { power: 70, technique: 70 }, rng);
  const frame = 1 / fps;
  let acc = 0, out: Outcome | null = null;
  for (let f = 0; f < fps * 12 && !out; f++) {
    let steps = 3, h = frame / 3;
    if (mode === "new") { acc += frame; steps = Math.floor(acc * 180 + 1e-6); acc = Math.max(0, acc - steps / 180); h = 1 / 180; }
    for (let i = 0; i < steps && !out; i++) {
      stepDefenders(sc, h, ball.pos, false, ball);
      stepKeeper(sc, h);
      stepReactions(sc, ball, h, rng);
      out = stepBall(ball, sc, rng, h);
    }
  }
  return { out, x: ball.pos.x, y: ball.pos.y };
}
console.log("\n6. FRAME RATE — the same 600 chances at 30, 60 and 120 fps");
for (const mode of ["old", "new"] as const) {
  let diff = 0, posDiff = 0;
  const N = 600;
  for (let s = 0; s < N; s++) {
    const a = playAt(60, mode, s), b = playAt(30, mode, s), c = playAt(120, mode, s);
    if (a.out !== b.out || a.out !== c.out) diff++;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-9 || Math.hypot(a.x - c.x, a.y - c.y) > 1e-9) posDiff++;
  }
  console.log(`  ${mode.toUpperCase()}: outcome differs between frame rates in ${diff}/${N} chances (${(diff / N * 100).toFixed(1)}%), final ball spot differs in ${posDiff}/${N}`);
  if (mode === "new") check(diff === 0 && posDiff === 0, `New: frame rate changed ${diff} outcomes, ${posDiff} spots`);
}
setBallPhysics("old");

// ── 7. What it does to the game ──────────────────────────────────────────────
// 1,500 chances of every shooting kind, struck the way a decent player would,
// each played with the Old and the New ball from the same seed.
console.log("\n7. THE GAME — 1,500 shots (7 kinds), Old ball vs New ball, same seeds");
{
  const SHOOT = ["one_on_one", "tight_angle", "long_range", "volley", "header", "penalty", "free_kick"] as const;
  const tally = { old: {} as Record<string, number>, new: {} as Record<string, number> };
  const frame = { old: { hits: 0, inOff: 0 }, new: { hits: 0, inOff: 0 } };
  const N = 1500;
  for (const mode of ["old", "new"] as const) {
    setBallPhysics(mode);
    for (let s = 0; s < N; s++) {
      const kind = SHOOT[s % SHOOT.length];
      const rng = mulberry32(s * 1013 + kind.length * 7919);
      const sc = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
      initDefenders(sc, rng);
      const side = rng() < 0.5 ? -1 : 1;
      const cx = (POST_L + POST_R) / 2;
      const tx = cx + side * ((POST_R - POST_L) / 2 - 0.6) * (0.55 + rng() * 0.45);
      const dir = { x: tx - sc.ball.x + (rng() - 0.5) * 1.2, y: -Math.max(sc.ball.y, 1) };
      const power = Math.min(1, 0.42 + Math.hypot(sc.ball.x - cx, sc.ball.y) / 40) * (0.85 + rng() * 0.3);
      const ball = launch(sc, dir, power, { cx: (rng() - 0.5) * 0.8, cy: -0.1 - rng() * 0.6 },
        { power: 55 + rng() * 25, technique: 55 + rng() * 25 }, rng);
      let out: Outcome | null = null;
      const h = 1 / 180;
      for (let i = 0; i < 180 * 12 && !out; i++) {
        stepDefenders(sc, h, ball.pos, false, ball);
        stepKeeper(sc, h);
        stepReactions(sc, ball, h, rng);
        out = stepBall(ball, sc, rng, h);
      }
      const k = out ?? "none";
      tally[mode][k] = (tally[mode][k] ?? 0) + 1;
      if ((ball.postHits ?? 0) > 0) { frame[mode].hits++; if (out === "goal" || out === "rebound") frame[mode].inOff++; }
    }
  }
  const keys = [...new Set([...Object.keys(tally.old), ...Object.keys(tally.new)])].sort();
  for (const k of keys) {
    const o = tally.old[k] ?? 0, n = tally.new[k] ?? 0;
    console.log(`  ${k.padEnd(9)} ${String(o).padStart(4)} → ${String(n).padStart(4)}   (${(o / N * 100).toFixed(1)}% → ${(n / N * 100).toFixed(1)}%)`);
  }
  const goals = (m: "old" | "new") => (tally[m].goal ?? 0) + (tally[m].rebound ?? 0);
  console.log(`  goals ${goals("old")} → ${goals("new")} · touched the woodwork ${frame.old.hits} → ${frame.new.hits}, of which went in ${frame.old.inOff} → ${frame.new.inOff}`);
  // Realism must not turn the game upside down: conversion within ±4 points.
  check(Math.abs(goals("new") - goals("old")) / N < 0.04, `New ball moves conversion by ${((goals("new") - goals("old")) / N * 100).toFixed(1)} points`);
}
setBallPhysics("old");

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("\nball physics: all checks passed");
