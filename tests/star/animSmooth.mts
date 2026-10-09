/**
 * CLEAN ANIMATIONS (Harry, 9 Oct 2026: "The animations are a bit wild and
 * rough … I want animations clean in every mode").
 *
 * Plays the real capture clips (public/star/anims3d/mocap.glb) on their own
 * skeleton, headless, at 60 frames a second, through the shared clip player
 * (three3d/footballAnims.ts ClipPlayer) and the garden/shop/house legs
 * (three3d/gaitBlend.ts GaitBlend), and measures:
 *
 *   POPS        a bone turning more than POP_DEG in one frame AND more than
 *               POP_SPIKE× its turn in the frames either side (a jump, not a
 *               fast limb).
 *   FOOT SLIDE  how far the planted foot moves along the ground, cm per metre
 *               he travels (0 = glued to the grass).
 *   FLICKER     how often the loop in charge changes during a speed that
 *               hovers on a gait edge.
 *   TURNS       the shown facing against a sudden 90° change: no one-frame snap,
 *               no overshoot.
 *
 * ANIM_OLD=1 runs the same scenes on the code from before (copies in
 * lib/star/three3d/_old_*.ts, only present while measuring the before).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { readFileSync } from "node:fs";
import { FadeWeights, LocoPhase, locoWeights, smoothYaw, MIN_FADE, type LocoLoop } from "../../lib/star/three3d/animBlend";
import { footMark } from "../../lib/star/three3d/locomotion";
import { gaitEdges, pickGait, strideLoop, sameFootTime, loopRate, STROLL_SPEEDS, MAX_LOOP_RATE, type Gait } from "../../lib/star/three3d/gait";

const OLD = process.env.ANIM_OLD === "1";
const FA: any = OLD ? await import("../../lib/star/three3d/_old_footballAnims") : await import("../../lib/star/three3d/footballAnims");
const GB: any = OLD ? await import("../../lib/star/three3d/_old_gaitBlend") : await import("../../lib/star/three3d/gaitBlend");
const tag = OLD ? "BEFORE" : "AFTER";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const load = async (f: string): Promise<any> => {
  const buf = readFileSync(f);
  const l = new GLTFLoader();
  l.setMeshoptDecoder(MeshoptDecoder as never);
  return new Promise((res, rej) => l.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "", res, rej));
};

const FPS = 60, DT = 1 / FPS;
export const POP_DEG = 12, POP_SPIKE = 2.5;
const g = await load("public/star/anims3d/mocap.glb");
const info = (n: string) => (g.scene.userData.clips ?? {})[n] ?? null;

/** A fresh body: the capture's own skeleton, its mixer, an action per clip (weight 0). */
function body() {
  const root: THREE.Object3D = g.scene.clone(true);
  const mixer = new THREE.AnimationMixer(root);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const c of g.animations) { const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); actions[c.name] = a; }
  const bones: THREE.Object3D[] = [];
  root.traverse((o) => { if ((o as any).isBone || /Hips|Spine|neck|Head|Arm|Hand|Leg|Foot|Shoulder|Toe/.test(o.name)) bones.push(o); });
  const by = (n: string) => root.getObjectByName(n)!;
  return { root, mixer, actions, bones, lf: by("LeftFoot"), rf: by("RightFoot"), lt: by("LeftToeBase"), rt: by("RightToeBase") };
}
type Body = ReturnType<typeof body>;
/** One body for the clip lengths in the pure checks. */
const b0: Body = body();

/** Records per-frame bone turns, foot slide and travel. */
function recorder(b: Body) {
  const prev = new Map<THREE.Object3D, THREE.Quaternion>();
  const deltas: number[] = []; // max bone turn per frame, degrees
  let slide = 0, travel = 0;
  let lastFoot: { which: string; x: number; z: number } | null = null;
  let groundY = Infinity;
  const pts = [b.lf, b.lt, b.rf, b.rt];
  const P = new THREE.Vector3();
  return {
    frame(moved: number) {
      b.root.updateMatrixWorld(true);
      let mx = 0;
      for (const o of b.bones) {
        const q = o.quaternion;
        const p = prev.get(o);
        if (p) { const d = (2 * Math.acos(Math.min(1, Math.abs(p.dot(q))))) * 180 / Math.PI; if (d > mx) mx = d; p.copy(q); }
        else prev.set(o, q.clone());
      }
      deltas.push(mx);
      // the lowest of both ankles and both toes is the one on the grass
      let low: { which: string; x: number; y: number; z: number } | null = null;
      for (const o of pts) { o.getWorldPosition(P); if (!low || P.y < low.y) low = { which: o.name, x: P.x, y: P.y, z: P.z }; }
      groundY = Math.min(groundY, low!.y);
      travel += moved;
      if (low!.y < groundY + 0.03) {
        if (lastFoot && lastFoot.which === low!.which) slide += Math.hypot(low!.x - lastFoot.x, low!.z - lastFoot.z);
        lastFoot = { which: low!.which, x: low!.x, z: low!.z };
      } else lastFoot = null;
    },
    pops() {
      let n = 0;
      for (let i = 1; i < deltas.length - 1; i++) {
        const d = deltas[i];
        if (d > POP_DEG && d > POP_SPIKE * Math.max(deltas[i - 1], deltas[i + 1], 0.5)) n++;
      }
      return n;
    },
    maxTurn: () => Math.max(...deltas.slice(1)),
    slidePerM: () => (travel > 0.5 ? (slide / travel) * 100 : slide * 100),
    slideCm: () => slide * 100,
  };
}

// ── 1. Clip changes inside one fade (the shared player) ─────────────────────
function clipChanges() {
  const b = body();
  const p = new FA.ClipPlayer(THREE, b.actions);
  const rec = recorder(b);
  const script: [number, () => void][] = [
    [0, () => p.play("idle", { fade: 0 })],
    [0.6, () => p.play("shot_r", { fade: 0.2, once: true })],
    [0.66, () => p.play("celebrate_fist", { fade: 0.2, once: true })],
    [0.72, () => p.play("frustrated", { fade: 0.2 })],
    [0.8, () => p.play("idle", { fade: 0.25 })],
    [1.6, () => p.play("shot_r", { fade: 0.08, once: true })],
    [1.75, () => p.play("shot_r", { fade: 0.08, once: true, from: 0.3 })], // the same move again, still showing
    [2.6, () => p.play("pass_inside", { fade: 0.04, once: true })], // a pinned strike's tiny fade
    [2.63, () => p.play("first_touch", { fade: 0.04, once: true })],
    [3.2, () => p.play("idle", { fade: 0.2 })],
  ];
  let si = 0;
  for (let f = 0; f < 4.2 * FPS; f++) {
    const t = f * DT;
    while (si < script.length && script[si][0] <= t + 1e-9) script[si++][1]();
    p.update(DT); b.mixer.update(DT); rec.frame(0);
  }
  return { pops: rec.pops(), max: rec.maxTurn() };
}

// ── 2. The drills' legs: speed up to a sprint, hover on an edge, stop ───────
/** Speed over time: stand, build to a sprint, hover on the jog/run edge, slow to a stop. */
const speedAt = (t: number) => {
  if (t < 0.6) return 0;
  if (t < 3.6) return 7.2 * ((t - 0.6) / 3);
  if (t < 4.6) return 7.2;
  if (t < 5.4) return 7.2 - 4.4 * ((t - 4.6) / 0.8);
  if (t < 8.4) return 2.8 + 0.45 * Math.sin((t - 5.4) * 9) + 0.15 * Math.sin((t - 5.4) * 23);
  if (t < 9.6) return 2.8 * (1 - (t - 8.4) / 1.2);
  return 0;
};
const END = 10.6;
const LOOPS: Gait[] = ["walk", "jog", "run", "sprint"];

function drillLegs() {
  const b = body();
  const p = new FA.ClipPlayer(THREE, b.actions);
  const rec = recorder(b);
  p.play("idle", { fade: 0 });
  let state = "idle", switches = 0, dominant = "idle";
  const edgeSwitches: number[] = [];
  if (!OLD) p.setLoco(LOOPS.map((n) => ({ name: n, speed: info(n).speed })), "idle");
  // the drills' old way (play3d/scene.ts before): pick a gait with a band, the longer stride past 1.3×, same-foot start from the plant marks
  const edges = gaitEdges(STROLL_SPEEDS);
  for (let f = 0; f < END * FPS; f++) {
    const t = f * DT, sp = speedAt(t);
    if (OLD) {
      let gg: string = pickGait(state, sp, edges);
      if (gg !== "idle") gg = strideLoop(gg as Gait, sp, (n) => info(n)?.speed).loop;
      if (gg !== state) {
        const was = state; state = gg; switches++; if (t > 5.4 && t < 8.4) edgeSwitches.push(t);
        if (gg === "idle") p.play("idle", { fade: 0.25 });
        else {
          const pa = was !== "idle" ? b.actions[was] : null;
          const plant = (c: string) => info(c)?.plants?.L?.[0]?.[0] ?? 0;
          const from = pa ? sameFootTime(pa.time, pa.getClip().duration, plant(was), b.actions[gg].getClip().duration, plant(gg)) : 0;
          p.play(gg, { fade: 0.2, from });
        }
      }
      if (state !== "idle") b.actions[state].timeScale = loopRate(sp, info(state)?.speed, 1, 0.5, MAX_LOOP_RATE);
    } else {
      p.loco(sp);
      let best = "idle", bw = b.actions.idle.getEffectiveWeight();
      for (const n of LOOPS) { const w = b.actions[n].getEffectiveWeight(); if (w > bw) { bw = w; best = n; } }
      // the dominant loop changing is a smooth handover here, but count it the same way
      void best;
    }
    p.update(DT);
    if (!OLD) {
      let best = "idle", bw = -1;
      for (const [n, a] of Object.entries(b.actions)) { const w = a.getEffectiveWeight(); if (w > bw) { bw = w; best = n.replace(/#.*/, ""); } }
      if (best !== dominant) { dominant = best; switches++; if (t > 5.4 && t < 8.4) edgeSwitches.push(t); }
    }
    b.mixer.update(DT);
    b.root.position.z += sp * DT;
    rec.frame(sp * DT);
  }
  return { pops: rec.pops(), max: rec.maxTurn(), slide: rec.slidePerM(), switches, edgeFlicker: edgeSwitches.length };
}

// ── 3. The garden / shop / house legs (GaitBlend) ───────────────────────────
function strollLegs() {
  const b = body();
  const acts: any = { idle: b.actions.idle, walk: b.actions.walk, jog: b.actions.jog, run: b.actions.run, sprint: b.actions.sprint };
  const inf: any = { walk: info("walk"), jog: info("jog"), run: info("run"), sprint: info("sprint") };
  const gb = OLD ? new GB.GaitBlend(acts, inf, STROLL_SPEEDS, 1) : new GB.GaitBlend(acts, inf, STROLL_SPEEDS, 1, THREE);
  const rec = recorder(b);
  let flick = 0, last = "idle";
  for (let f = 0; f < END * FPS; f++) {
    const t = f * DT, sp = speedAt(t) * 0.9;
    gb.update(sp, DT);
    if (gb.gait !== last) { last = gb.gait; if (t > 5.4 && t < 8.4) flick++; }
    b.mixer.update(DT);
    b.root.position.z += sp * DT;
    rec.frame(sp * DT);
  }
  return { pops: rec.pops(), max: rec.maxTurn(), slide: rec.slidePerM(), edgeFlicker: flick };
}

// ── 4. Steady speeds: foot slide at each pace ───────────────────────────────
function steady(sp: number) {
  const b = body();
  const p = new FA.ClipPlayer(THREE, b.actions);
  const rec = recorder(b);
  p.play("idle", { fade: 0 });
  if (!OLD) p.setLoco(LOOPS.map((n) => ({ name: n, speed: info(n).speed })), "idle");
  const edges = gaitEdges(STROLL_SPEEDS);
  let state = "idle";
  for (let f = 0; f < 6 * FPS; f++) {
    if (OLD) {
      let gg: string = pickGait(state, sp, edges);
      if (gg !== "idle") gg = strideLoop(gg as Gait, sp, (n) => info(n)?.speed).loop;
      if (gg !== state) { state = gg; p.play(gg, { fade: 0.2 }); }
      if (state !== "idle") b.actions[state].timeScale = loopRate(sp, info(state)?.speed, 1, 0.5, MAX_LOOP_RATE);
    } else p.loco(sp);
    p.update(DT); b.mixer.update(DT);
    b.root.position.z += sp * DT;
    if (f > 1.5 * FPS) rec.frame(sp * DT); else { b.root.updateMatrixWorld(true); }
  }
  return rec.slidePerM();
}

const cc = clipChanges();
console.log(`${tag} clip changes inside a fade: ${cc.pops} pops (biggest one-frame bone turn ${cc.max.toFixed(0)}°)`);
const dl = drillLegs();
console.log(`${tag} drill legs (0 → sprint → hover on the jog/run edge → stop): ${dl.pops} pops, foot slide ${dl.slide.toFixed(1)} cm per metre, ${dl.edgeFlicker} changes of the loop in charge while hovering on the edge (${OLD ? "each a 0.2 s crossfade" : "each a smooth handover on one stride clock"})`);
const sl = strollLegs();
console.log(`${tag} garden/shop/house legs, same run: ${sl.pops} pops, foot slide ${sl.slide.toFixed(1)} cm per metre, ${sl.edgeFlicker} loop changes while hovering`);
const paces: number[] = [];
for (let v = 0.8; v < 7.6; v += 0.15) paces.push(+v.toFixed(2));
const slides = paces.map((v) => steady(v));
if (process.env.ANIM_DEBUG) console.log(paces.map((v, i) => `${v}:${slides[i].toFixed(0)}`).join(" "));
const mean = slides.reduce((x, y) => x + y, 0) / slides.length, worst = Math.max(...slides);
console.log(`${tag} foot slide held at every speed 0.8–7.5 m/s (46 speeds): mean ${mean.toFixed(1)}, worst ${worst.toFixed(1)} cm per metre (at ${paces[slides.indexOf(worst)]} m/s); over 8: ${slides.filter((x) => x > 8).length} speeds`);

if (!OLD) {
  check(cc.pops === 0, `clip changes inside a fade still pop (${cc.pops})`);
  check(dl.pops === 0, `the drill legs pop (${dl.pops})`);
  check(sl.pops === 0, `the stroll legs pop (${sl.pops})`);
  check(dl.slide < 6, `drill legs slide ${dl.slide.toFixed(1)} cm per metre`);
  check(sl.slide < 6, `stroll legs slide ${sl.slide.toFixed(1)} cm per metre`);
  check(mean < 5.5, `mean foot slide ${mean.toFixed(1)} cm per metre`);
  check(worst < 16, `worst foot slide ${worst.toFixed(1)} cm per metre`);

  // ── the pure parts ──
  // FadeWeights: always sums to 1, an interrupted fade never drops a clip in one frame
  const fw = new FadeWeights<string>();
  fw.to("a", 0); fw.step(DT);
  fw.to("b", 0.2); for (let i = 0; i < 3; i++) fw.step(DT);
  const wa = fw.get("a"), wb = fw.get("b");
  fw.to("c", 0.2); fw.step(DT);
  const sum = fw.get("a") + fw.get("b") + fw.get("c");
  check(Math.abs(sum - 1) < 1e-6, `weights add up to 1 (${sum})`);
  check(fw.get("a") > wa * 0.8 && fw.get("b") > wb * 0.8, "a change inside a fade keeps the older clips (scaled, not dropped)");
  fw.to("d", 0.001); fw.step(DT / 4);
  check(fw.get("d") <= (DT / 4) / MIN_FADE + 1e-9, "no fade is shorter than MIN_FADE");
  // locoWeights: continuous in speed (no jump anywhere), sums to 1
  const L: LocoLoop[] = LOOPS.map((n) => ({ speed: info(n).speed, dur: b0.actions[n].getClip().duration, mark: footMark(THREE, b0.actions[n].getClip(), b0.root) ?? 0 }));
  let jump = 0;
  let prevW = locoWeights(0, L);
  for (let v = 0.005; v < 8; v += 0.005) {
    const w = locoWeights(v, L);
    const s = w.idle + w.w.reduce((x, y) => x + y, 0);
    check(Math.abs(s - 1) < 1e-9, `loco weights add to 1 at ${v.toFixed(2)}`);
    jump = Math.max(jump, Math.abs(w.idle - prevW.idle), ...w.w.map((x, i) => Math.abs(x - prevW.w[i])));
    prevW = w;
  }
  check(jump < 0.1, `loco weights never jump (biggest step ${jump.toFixed(3)} per 5 mm/s)`);
  // the measured left-foot moments: the sprint's is NOT the capture's "left plant at 0" (that one is the right foot)
  console.log(`left-foot-forward moments: ` + LOOPS.map((n, i) => `${n} ${L[i].mark.toFixed(2)} s`).join(" · ") + ` · capture's first left plant: ` + LOOPS.map((n) => `${n} ${(info(n).plants?.L?.[0]?.[0] ?? 0).toFixed(2)}`).join(" · "));
  // LocoPhase: same foot down across loops
  const ph = new LocoPhase();
  ph.phase = 0.37;
  const t0 = ph.timeOf(L[2]);
  ph.syncTo(L[2], t0);
  check(Math.abs(ph.phase - 0.37) < 1e-9, "the stride clock picks up from a loop's own time");
  // turns: a sudden 90° change eases round, no one-frame snap, no overshoot
  const ys = { yaw: 0, vel: 0 };
  let maxStep = 0, over = 0, settled = -1;
  for (let i = 0; i < 60; i++) {
    const before = ys.yaw;
    smoothYaw(ys, Math.PI / 2, DT);
    maxStep = Math.max(maxStep, Math.abs(ys.yaw - before));
    over = Math.max(over, ys.yaw - Math.PI / 2);
    if (settled < 0 && Math.abs(ys.yaw - Math.PI / 2) < 0.03) settled = i;
  }
  console.log(`turn 90°: biggest one-frame turn ${(maxStep * 180 / Math.PI).toFixed(1)}° (before: 90° in one frame), overshoot ${(over * 180 / Math.PI).toFixed(2)}°, settled in ${((settled + 1) / FPS).toFixed(2)} s`);
  check(maxStep * 180 / Math.PI < 15, "a sudden 90° turn never jumps more than 15° in a frame");
  check(over < 0.01, "no overshoot");
  check(settled > 0 && settled < 30, "settles inside half a second");
}
if (problems.length) { console.error(problems.map((p) => "  ✗ " + p).join("\n")); process.exit(1); }
console.log(OLD ? "measured the before" : "animSmooth: all checks passed");
