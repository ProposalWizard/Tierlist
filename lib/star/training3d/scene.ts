/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 3D TRAINING PITCH (Harry, 8 Oct 2026: "full 3D training area …
 * actually utilising the 3D model in 3D games").
 *
 * A view only. It never moves the ball by itself:
 *   - on YOUR shot, the ball is put wherever the real match engine says it is
 *     (`setBall`, fed from EngineFeature's onBallStep, pitch metres);
 *   - on HIS shot, the screen feeds it the cut-scene path
 *     (crossbar.ts `mateBallAt`).
 * People: the approved 3D people (people3d.ts — the 3D shop and garden's
 * own), in a training kit. Every GLTFLoader goes through withMeshopt.
 *
 * Pitch metres → three: X = x − CX, Y = z (up), Z = y (out from the goal
 * line). The goal mouth is at Z = 0, the D at Z ≈ 18.
 */
import { CX, GOAL_H, GOAL_W, PEN_SPOT_Y } from "../pitch";
import { loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, relaxHands, type Person3D, type FacePic, type PlayerModel } from "../people3d";
import { people3dLook } from "../look3d";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { acquireRenderer } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import type { KitColours } from "../shop3d/scene";
import { CROSSBAR_SPOT, MATE_AFTER_S, MATE_FLIGHT_S, mateBallAt, type MateShot } from "./crossbar";

/** When, in the 3D kick, the foot meets the ball (seconds after the swing starts). */
export const KICK_DELAY_S = 0.26;

export interface TrainingPerson { skin: string; hair: string; hairStyle?: "short" | "long" | "buzz" | "none"; face?: FacePic | null }
export interface TrainingData { kit: KitColours; you: TrainingPerson; mate: TrainingPerson }

export type Who = "you" | "mate";
export type Move = "idle" | "runup" | "kick" | "celebrate" | "watch";

export interface TrainingController {
  /** Put the ball back on the spot. */
  resetBall(): void;
  /**
   * One step of the REAL engine's ball (EngineFeature's onBallStep, pitch
   * metres). Shown KICK_DELAY_S late, so your 3D leg meets the ball as it
   * leaves — the path drawn is exactly the engine's, only later.
   */
  feedEngineBall(p: { x: number; y: number; z: number }): void;
  /** His turn: run-up, kick, and the cut-scene path (crossbar.ts mateBallAt). */
  playMateShot(shot: MateShot, onDone: () => void): void;
  /** Who is on the ball; the other stands off to the side and watches. */
  setShooter(who: Who): void;
  /** What one of them is doing now. */
  play(who: Who, move: Move): void;
  /** Camera: behind the shooter, or following the ball to the goal. */
  setCamera(mode: "behind" | "goal"): void;
  /** Stop drawing while hidden (the engine's own pitch is on screen). */
  setActive(on: boolean): void;
  dispose(): void;
}

const P = (x: number, y: number, z: number): [number, number, number] => [x - CX, z, y];

export async function createTrainingScene(container: HTMLElement, data: TrainingData, opts: { quality?: Quality3d } = {}): Promise<TrainingController> {
  const tier = opts.quality ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const SK = SkeletonUtils.default ?? SkeletonUtils;

  // ── The people (load first: a failure here is the one that matters) ──
  const loader = new GLTFLoader();
  await withMeshopt(loader);
  const body = people3dLook();
  const youModel: PlayerModel = playerModelFor(data.you.hairStyle);
  const mateModel: PlayerModel = playerModelFor(data.mate.hairStyle);
  const [youG, mateG, animG] = await Promise.all([
    loadPeople3d(loader, youModel, body),
    loadPeople3d(loader, mateModel, body),
    loadPeople3d(loader, "anims", body),
  ]);

  const { renderer, release } = acquireRenderer(THREE, container, prof);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  scene.background = new THREE.Color("#a9d4ef");
  scene.fog = new THREE.Fog("#a9d4ef", 45, 110);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  // ── Light: a bright training-morning sun ──
  root.add(new THREE.HemisphereLight("#e8f4ff", "#3f6b2a", 1.15));
  const sun = new THREE.DirectionalLight("#fff4df", 2.1);
  sun.position.set(-14, 22, 18);
  sun.target.position.set(0, 0, 8);
  root.add(sun, sun.target);
  if (prof.shadows) {
    sun.castShadow = true;
    const s = prof.shadowScale >= 1 ? 2048 : 1024;
    sun.shadow.mapSize.set(s, s);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
    sun.shadow.bias = -0.0006;
  }

  // ── The grass: mown stripes across the pitch ──
  const grassA = new THREE.MeshStandardMaterial({ color: "#4f8f3a", roughness: 0.95 });
  const grassB = new THREE.MeshStandardMaterial({ color: "#5c9c43", roughness: 0.95 });
  const base = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), grassA);
  base.rotation.x = -Math.PI / 2;
  base.receiveShadow = true;
  root.add(base);
  for (let i = 0; i < 12; i++) {
    if (i % 2) continue;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(90, 4), grassB);
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.002, -6 + i * 4 + 2);
    s.receiveShadow = true;
    root.add(s);
  }

  // ── White lines: goal line, six-yard box, the box, the spot and the D ──
  const lineMat = new THREE.MeshBasicMaterial({ color: "#f4f6f2" });
  const LW = 0.12;
  const strip = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len + LW, LW), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, 0.006, (z1 + z2) / 2);
    root.add(m);
  };
  strip(-40, 0, 40, 0);
  const six = GOAL_W / 2 + 5.5, box = GOAL_W / 2 + 16.5;
  strip(-six, 0, -six, 5.5); strip(six, 0, six, 5.5); strip(-six, 5.5, six, 5.5);
  strip(-box, 0, -box, 16.5); strip(box, 0, box, 16.5); strip(-box, 16.5, box, 16.5);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), lineMat);
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(0, 0.006, PEN_SPOT_Y);
  root.add(spot);
  // the D: the part of the 9.15 m circle round the spot outside the box
  const half = Math.acos((16.5 - PEN_SPOT_Y) / 9.15);
  const arc = new THREE.Mesh(new THREE.RingGeometry(9.15 - LW / 2, 9.15 + LW / 2, 48, 1, Math.PI / 2 - half, half * 2), lineMat);
  arc.rotation.x = -Math.PI / 2;
  arc.position.set(0, 0.006, PEN_SPOT_Y);
  // RingGeometry draws in its own XY plane: after lying flat, +Y is −Z, so
  // turn it round to open towards the halfway line
  arc.rotation.z = Math.PI;
  root.add(arc);

  // ── The goal: posts, bar, and a net ──
  const frameMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 });
  const R = 0.06, HW = GOAL_W / 2, D = 1.9;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(R, R, GOAL_H + R, 14), frameMat);
    post.position.set(sx * HW, (GOAL_H + R) / 2, 0);
    post.castShadow = true;
    root.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(R, R, GOAL_W + 2 * R, 14), frameMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, GOAL_H, 0);
  bar.castShadow = true;
  root.add(bar);
  // back stanchions
  const stanMat = new THREE.MeshStandardMaterial({ color: "#d9dde3", roughness: 0.5 });
  for (const sx of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, Math.hypot(D, GOAL_H), 8), stanMat);
    st.position.set(sx * HW, GOAL_H / 2, -D / 2);
    st.rotation.x = -Math.atan2(D, GOAL_H);
    root.add(st);
  }
  {
    const pts: number[] = [];
    const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
    const G = 0.22;
    // the back (a slope from the bar down to the grass behind) and the roof
    for (let x = -HW; x <= HW + 1e-6; x += G) { seg([x, GOAL_H, 0], [x, 0, -D]); }
    for (let t = 0; t <= 1 + 1e-6; t += G / Math.hypot(D, GOAL_H)) { const y = GOAL_H * (1 - t), z = -D * t; seg([-HW, y, z], [HW, y, z]); }
    // the sides
    for (const sx of [-1, 1]) {
      for (let z = 0; z >= -D - 1e-6; z -= G) { const top = GOAL_H * (1 + z / D); seg([sx * HW, 0, z], [sx * HW, top, z]); }
      for (let y = 0; y <= GOAL_H + 1e-6; y += G) { const zEnd = -D * (1 - y / GOAL_H); seg([sx * HW, y, 0], [sx * HW, y, zEnd]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 })));
  }

  // ── Training things: cones, a few spare balls, mannequins off to one side ──
  const coneMat = new THREE.MeshStandardMaterial({ color: "#ff7a1a", roughness: 0.6 });
  const coneGeo = new THREE.ConeGeometry(0.16, 0.34, 14);
  const cone = (x: number, z: number) => { const c = new THREE.Mesh(coneGeo, coneMat); c.position.set(x, 0.17, z); c.castShadow = true; root.add(c); };
  for (let i = 0; i < 6; i++) cone(-11 + i * 1.6, 22);
  for (let i = 0; i < 5; i++) cone(13, 8 + i * 2.2);
  cone(-2.2, CROSSBAR_SPOT.y + 0.6); cone(2.2, CROSSBAR_SPOT.y + 0.6);
  const ballMat = new THREE.MeshStandardMaterial({ color: "#fbfbf8", roughness: 0.45 });
  const patchMat = new THREE.MeshStandardMaterial({ color: "#1d1f24", roughness: 0.5 });
  const makeBall = () => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), ballMat);
    s.castShadow = true;
    g.add(s);
    // a few dark panels, so the ball reads as a football and its spin shows
    for (const [a, b] of [[0, 0], [1.2, 0.9], [2.4, -0.7], [3.6, 1.1], [4.8, -0.2], [0.6, -1.3]]) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.038, 5), patchMat);
      const v = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
      p.position.copy(v.multiplyScalar(0.1105));
      p.lookAt(v.clone().multiplyScalar(2));
      g.add(p);
    }
    return g;
  };
  for (const [x, z] of [[-3.2, 19.4], [-3.5, 19.9], [-2.9, 20.1], [-3.8, 19.3]]) { const b = makeBall(); b.position.set(x, 0.11, z); root.add(b); }
  // a ball bag
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshStandardMaterial({ color: "#1f3a8a", roughness: 0.8 }));
  bag.scale.set(1, 0.7, 1);
  bag.position.set(-4.3, 0.22, 20.2);
  root.add(bag);
  // mannequins (the free-kick dummies) standing by the cones
  const dumMat = new THREE.MeshStandardMaterial({ color: "#f2c230", roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.25, 4, 10), dumMat);
    m.position.set(-14 + i * 0.75, 0.85, 10);
    m.castShadow = true;
    root.add(m);
  }
  // a low fence and a tree line far behind the goal
  const hedge = new THREE.Mesh(new THREE.BoxGeometry(120, 3.5, 1.5), new THREE.MeshStandardMaterial({ color: "#2f5a28", roughness: 1 }));
  hedge.position.set(0, 1.75, -14);
  root.add(hedge);
  const treeMat = new THREE.MeshStandardMaterial({ color: "#3a6b30", roughness: 1 });
  for (let i = 0; i < 18; i++) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(2.4 + (i % 3) * 0.6, 10, 8), treeMat);
    t.position.set(-50 + i * 6 + (i % 2) * 1.5, 3.6 + (i % 3) * 0.5, -17 - (i % 2) * 2);
    root.add(t);
  }

  // ── The ball in play, and its shadow ──
  const ball = makeBall();
  root.add(ball);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);
  const ballAt = new THREE.Vector3(...P(CROSSBAR_SPOT.x, CROSSBAR_SPOT.y, 0.11));
  let lastBall = ballAt.clone();
  const placeBall = (v: any) => {
    const d = v.distanceTo(lastBall);
    if (d > 1e-4 && d < 3) {
      // roll the ball the way it travels (looks only)
      const axis = new THREE.Vector3().subVectors(v, lastBall).cross(new THREE.Vector3(0, 1, 0)).normalize().negate();
      if (axis.lengthSq() > 0) ball.rotateOnWorldAxis(axis, d / 0.11);
    }
    lastBall = v.clone();
    ball.position.copy(v);
    shadow.position.set(v.x, 0.008, v.z);
    const k = Math.max(0.35, 1 - v.y / 4);
    shadow.scale.setScalar(k);
    shadow.material.opacity = 0.32 * k;
  };
  placeBall(ballAt);

  // ── The two people ──
  const SPOT = new THREE.Vector3(...P(CROSSBAR_SPOT.x, CROSSBAR_SPOT.y, 0));
  const SIDE = new THREE.Vector3(SPOT.x - 3.4, 0, SPOT.z + 2.4);
  const make = (g: any, look: TrainingPerson, number: number) => {
    const p: Person3D = makePerson3d(THREE, SK, g, animG, { outline: prof.outlines ? 0.006 : 0, castShadow: prof.shadows });
    dressPerson3d(THREE, p, { skin: look.skin, hair: look.hair, kit: data.kit, number: null, face: look.face ?? null });
    relaxHands(THREE, p);
    void number;
    root.add(p.root);
    return p;
  };
  const people: Record<Who, { p: Person3D; move: Move; t: number; at: any; yaw: number; legSave: any[] }> = {
    you: { p: make(youG, data.you, 10), move: "idle", t: 0, at: SPOT.clone(), yaw: Math.PI, legSave: [] },
    mate: { p: make(mateG, data.mate, 8), move: "watch", t: 0, at: SIDE.clone(), yaw: Math.PI * 0.75, legSave: [] },
  };
  let shooter: Who = "you";
  let spotX = SPOT.x;
  const BEHIND = 1.1; // the shooter stands this far behind the ball, a little to the left (a right-footer)
  const standFor = (who: Who) => {
    const s = people[who];
    if (who === shooter) { s.at.set(spotX - 0.45, 0, SPOT.z + BEHIND); s.yaw = Math.PI; }
    else { s.at.copy(SIDE); s.yaw = Math.PI * 0.82; }
  };
  standFor("you"); standFor("mate");

  const legs = (p: Person3D) => [p.bones.RightUpLeg, p.bones.RightLeg].filter(Boolean);
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qw = new THREE.Quaternion();
  /** Turn a bone about a WORLD axis by `ang`, whatever its parents' turns. */
  const turnWorld = (b: any, axis: any, ang: number) => {
    b.parent.getWorldQuaternion(qp);
    qw.setFromAxisAngle(axis, ang);
    qa.copy(qp).invert().multiply(qw).multiply(qp);
    b.quaternion.premultiply(qa);
  };

  const weights = (s: (typeof people)[Who], w: Record<string, number>) => {
    for (const [n, a] of Object.entries(s.p.actions)) a.setEffectiveWeight(w[n] ?? 0);
  };
  const applyMove = (who: Who) => {
    const s = people[who];
    const a = s.p.actions;
    if (s.move === "runup") { weights(s, { jog: 1 }); a.jog.timeScale = 1.2; }
    else if (s.move === "celebrate" && a.celebrate) { weights(s, { celebrate: 1 }); a.celebrate.time = 0; }
    else weights(s, { idle: 1 });
  };
  applyMove("you"); applyMove("mate");

  // ── Camera ──
  let camMode: "behind" | "goal" = "behind";
  /** Cut (not glide) to the next camera: a new turn starts on a new shot. */
  let snap = true;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const camTarget = () => {
    const sx = people[shooter].at.x;
    if (camMode === "goal") return { pos: new THREE.Vector3(sx * 0.4 + 2.6, 2.6, 13.5), look: new THREE.Vector3(0, 1.5, 0) };
    return { pos: new THREE.Vector3(sx * 0.6 - 1.7, 2.7, SPOT.z + 9), look: new THREE.Vector3(0, 1.3, 0) };
  };
  { const t = camTarget(); camPos.copy(t.pos); camLook.copy(t.look); }

  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole goal in frame on a tall phone: widen the lens as it narrows
    camera.fov = w / h < 0.8 ? 52 : 42;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(container);

  // ── The loop (three's own animation loop; nothing here moves the ball) ──
  let active = true;
  let last = performance.now();
  const feed: { t: number; v: any }[] = [];
  let mate: { shot: MateShot; t: number; stage: number; onDone: () => void } | null = null;
  const right = new THREE.Vector3();
  const frame = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const who of ["you", "mate"] as Who[]) {
      const s = people[who];
      s.t += dt;
      const lg = legs(s.p);
      // put the kicking leg back where the clips left it before they update
      lg.forEach((b, i) => { if (s.legSave[i]) b.quaternion.copy(s.legSave[i]); });
      // the run-up: a few strides towards the ball
      if (s.move === "runup") {
        const k = Math.min(1, s.t / 0.75);
        s.p.root.position.set(spotX - 0.45 - 1.4 * (1 - k), 0, SPOT.z + BEHIND + 2.2 * (1 - k));
      } else s.p.root.position.lerp(s.at, Math.min(1, dt * 6));
      const yawNow = s.p.root.rotation.y;
      s.p.root.rotation.y = yawNow + (s.yaw - yawNow) * Math.min(1, dt * 8);
      s.p.mixer.update(dt);
      s.legSave = lg.map((b) => b.quaternion.clone());
      // the kick: a back-swing, then the leg through the ball (drawn, not physics)
      if (s.move === "kick") {
        const k = s.t;
        const thigh = k < 0.16 ? 0.7 * (k / 0.16) : k < 0.34 ? 0.7 - 1.9 * ((k - 0.16) / 0.18) : k < 0.8 ? -1.2 + 0.9 * ((k - 0.34) / 0.46) : -0.3 * Math.max(0, 1 - (k - 0.8) / 0.3);
        const knee = k < 0.16 ? 1.1 * (k / 0.16) : k < 0.3 ? 1.1 * (1 - (k - 0.16) / 0.14) : 0;
        s.p.root.updateMatrixWorld(true);
        right.set(1, 0, 0).applyQuaternion(s.p.root.quaternion);
        if (lg[0]) turnWorld(lg[0], right, -thigh);
        if (lg[1]) { lg[1].parent?.updateMatrixWorld(true); turnWorld(lg[1], right, knee); }
      }
    }
    // the ball: the engine's own steps, played back KICK_DELAY_S late
    if (feed.length) {
      const showAt = now - KICK_DELAY_S * 1000;
      while (feed.length > 1 && feed[1].t <= showAt) feed.shift();
      if (feed[0].t <= showAt) placeBall(feed[0].v);
    }
    // his turn: the run-up, the kick, then the cut-scene path
    if (mate) {
      mate.t += dt;
      const m = people.mate;
      if (mate.stage === 0 && mate.t > 0.45) { mate.stage = 1; m.move = "runup"; m.t = 0; applyMove("mate"); }
      else if (mate.stage === 1 && mate.t > 0.45 + 0.75) { mate.stage = 2; m.move = "kick"; m.t = 0; applyMove("mate"); }
      const since = mate.t - (0.45 + 0.75 + KICK_DELAY_S);
      if (since > 0) {
        if (since > 0.25) camMode = "goal";
        const b = mateBallAt(mate.shot, since);
        placeBall(new THREE.Vector3(...P(b.x, b.y, b.z)));
        if (since > MATE_FLIGHT_S + MATE_AFTER_S) { const done = mate.onDone; mate = null; done(); }
      }
    }
    // camera eases to where it should be, and follows the ball a little
    const t = camTarget();
    if (camMode === "goal") t.look.lerp(ball.position, 0.25);
    if (snap) { camPos.copy(t.pos); camLook.copy(t.look); snap = false; }
    camPos.lerp(t.pos, Math.min(1, dt * 2.2));
    camLook.lerp(t.look, Math.min(1, dt * 3));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(frame);
  // test pages: where everyone is (read by the playtest scripts only)
  (window as any).__training3d = { people, camera, ball, get shooter() { return shooter; } };

  return {
    resetBall() {
      feed.length = 0;
      spotX = SPOT.x;
      standFor("you"); standFor("mate");
      lastBall = ballAt.clone();
      placeBall(ballAt.clone());
      ball.rotation.set(0, 0, 0);
      camMode = "behind";
      snap = true;
    },
    feedEngineBall(p) {
      feed.push({ t: performance.now(), v: new THREE.Vector3(...P(p.x, p.y, Math.max(0.11, p.z))) });
    },
    playMateShot(shot, onDone) {
      const b0 = new THREE.Vector3(...P(shot.sx, CROSSBAR_SPOT.y, 0.11));
      feed.length = 0;
      lastBall = b0.clone();
      placeBall(b0);
      camMode = "behind";
      snap = true;
      spotX = b0.x;
      standFor("mate");
      mate = { shot, t: 0, stage: 0, onDone };
    },
    setShooter(who) {
      shooter = who;
      standFor("you"); standFor("mate");
    },
    play(who, move) {
      const s = people[who];
      s.move = move;
      s.t = 0;
      applyMove(who);
    },
    setCamera(mode) { camMode = mode; },
    setActive(on) {
      if (on === active) return;
      active = on;
      last = performance.now();
      renderer.setAnimationLoop(on ? frame : null);
    },
    dispose() {
      ro?.disconnect();
      renderer.setAnimationLoop(null);
      release(root);
    },
  };
}
