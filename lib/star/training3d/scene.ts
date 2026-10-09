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
import { installAssetVersions } from "../three3d/assetUrl";
import { toonYou, toonHeadFor } from "../style3d/toon/bodies";
import { CX, GOAL_H, GOAL_W, PEN_SPOT_Y } from "../pitch";
import { loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, relaxHands, type Person3D, type FacePic, type PlayerModel } from "../people3d";
import { people3dLook } from "../look3d";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { governScene } from "../three3d/governThree";
import { acquireRenderer } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { addClips, clipInfo, ClipPlayer, KICK_FALLBACK, loadAnims3d } from "../three3d/footballAnims";
import type { KitColours } from "../shop3d/scene";
import { CROSSBAR_SPOT, MATE_AFTER_S, MATE_FLIGHT_S, mateBallAt, type MateShot } from "./crossbar";

/**
 * When, in the 3D kick (the hand-made "kick_r" clip: run-up, plant, strike),
 * the foot meets the ball, in seconds after the clip starts. The file's own
 * measured number wins (controller.kickDelayS); this is its fallback.
 */
export const KICK_DELAY_S = KICK_FALLBACK.contact!;

export interface TrainingPerson { skin: string; hair: string; hairStyle?: "short" | "long" | "buzz" | "none"; face?: FacePic | null }
export interface TrainingData { kit: KitColours; you: TrainingPerson; mate: TrainingPerson }

export type Who = "you" | "mate";
/** "watch" = waiting his turn (keepy-uppies); "kick" = the run-up and strike (one clip). */
export type Move = "idle" | "runup" | "kick" | "celebrate" | "frustrated" | "watch";

export interface TrainingController {
  /** Seconds from the start of the kick to the foot meeting the ball (the engine's ball is shown this late). */
  readonly kickDelayS: number;
  /** Put the ball back on the spot. */
  resetBall(): void;
  /**
   * One step of the REAL engine's ball (EngineFeature's onBallStep, pitch
   * metres). Shown kickDelayS late, so your 3D foot meets the ball as it
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
  /**
   * Run `fn` this many seconds from now on the SCENE's clock (the one the
   * people and the shown ball move on), not the wall's: on a slow phone the
   * celebration then still waits for the ball to reach the bar. Held while
   * the scene is resting (setActive(false)).
   */
  after(seconds: number, fn: () => void): void;
  /** Stop drawing while hidden (the engine's own pitch is on screen). */
  setActive(on: boolean): void;
  dispose(): void;
}

const P = (x: number, y: number, z: number): [number, number, number] => [x - CX, z, y];

export async function createTrainingScene(container: HTMLElement, data: TrainingData, opts: { quality?: Quality3d } = {}): Promise<TrainingController> {
  const tier = opts.quality ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  await installAssetVersions(); // every file this place asks for by its versioned address (three3d/assetUrl.ts)
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
    loadPeople3d(loader, youModel, body, [toonYou().head]),
    loadPeople3d(loader, mateModel, body, [toonHeadFor("training-mate")]),
    loadPeople3d(loader, "anims", body),
  ]);
  // the kick, reactions and keepy-uppies (a failed load just leaves them standing)
  const fb: any = await loadAnims3d(loader, "football").catch((e) => { console.error("football clips failed to load", e); return null; });

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
  // Their moves are the hand-made clips (lib/star/three3d/footballAnims.ts):
  // the kick with its run-up, celebrate, frustrated, and keepy-uppies while waiting.
  const SPOT = new THREE.Vector3(...P(CROSSBAR_SPOT.x, CROSSBAR_SPOT.y, 0));
  const SIDE = new THREE.Vector3(SPOT.x - 3.4, 0, SPOT.z + 2.4);
  const kickInfo = clipInfo(fb, "kick_r") ?? KICK_FALLBACK;
  const contactS = kickInfo.contact ?? KICK_FALLBACK.contact!;
  const make = (g: any, look: TrainingPerson, who: string) => {
    const p: Person3D = makePerson3d(THREE, SK, g, animG, { outline: prof.outlines ? 0.006 : 0, castShadow: prof.shadows, who, you: who === "you" });
    dressPerson3d(THREE, p, { skin: look.skin, hair: look.hair, kit: data.kit, number: null, face: look.face ?? null });
    relaxHands(THREE, p);
    if (fb) addClips(THREE, p, fb);
    root.add(p.root);
    return p;
  };
  type Body = { p: Person3D; player: ClipPlayer; move: Move; at: any; yaw: number };
  const person = (g: any, look: TrainingPerson, who: string): Body => {
    const p = make(g, look, who);
    return { p, player: new ClipPlayer(THREE, p.actions), move: "idle", at: new THREE.Vector3(), yaw: Math.PI };
  };
  const people: Record<Who, Body> = { you: person(youG, data.you, "you"), mate: person(mateG, data.mate, "training-mate") };
  let shooter: Who = "you";
  /** Turn a point in a man's own frame (x = his left, z = forward) by his facing. */
  const toWorld = (x: number, z: number, yaw: number) => new THREE.Vector3(x * Math.cos(yaw) + z * Math.sin(yaw), 0, -x * Math.sin(yaw) + z * Math.cos(yaw));
  /** Where the kicker starts so his foot meets a ball at `b` on the contact frame. */
  const kickStart = (b: any, yaw: number) => {
    const o = kickInfo.ball ?? KICK_FALLBACK.ball!;
    return b.clone().sub(toWorld(o[0], o[1], yaw)).setY(0);
  };
  const spotBall = new THREE.Vector3(SPOT.x, 0, SPOT.z);
  const standFor = (who: Who) => {
    const s = people[who];
    if (who === shooter) { s.yaw = Math.PI; s.at.copy(kickStart(spotBall, s.yaw)); }
    else { s.at.copy(SIDE); s.yaw = Math.PI * 0.82; }
    s.p.root.position.copy(s.at);
    s.p.root.rotation.y = s.yaw;
  };
  const applyMove = (who: Who) => {
    const s = people[who];
    const pl = s.player;
    const back = () => { s.move = "idle"; pl.play("idle", { fade: 0.25 }); };
    if (s.move === "kick" || s.move === "runup") {
      const ok = pl.play("kick_r", {
        fade: 0.1, once: true,
        onEnd: () => {
          // root motion: he ran on through the ball; stand him where the clip ends
          const e = kickInfo.end ?? KICK_FALLBACK.end!;
          s.at.copy(s.p.root.position).add(toWorld(e[0], e[1], s.yaw));
          s.p.root.position.copy(s.at);
          s.move = "idle";
          pl.play("idle", { fade: 0 });
        },
      });
      if (!ok) back();
    } else if (s.move === "celebrate" || s.move === "frustrated") {
      const clip = s.move === "celebrate" ? "celebrate_fist" : "frustrated";
      // the kick ran him on towards the goal, out past the side of the goal
      // camera: cut to a camera in front of him so the reaction is seen
      // (anim-stills, 8 Oct: he ended half out of frame on the right)
      camMode = "react"; reactWho = who; snap = true;
      if (!pl.play(clip, { fade: 0.15, once: true, onEnd: back })) back();
    } else if (s.move === "watch") {
      // waiting his turn: keepy-uppies
      if (!pl.play("juggle", { fade: 0.25 })) pl.play("idle", { fade: 0.25 });
    } else pl.play("idle", { fade: 0.25 });
  };
  standFor("you"); standFor("mate");
  people.mate.move = "watch";
  applyMove("you"); applyMove("mate");

  // The waiting man's own ball, kept up on his feet (the clip's measured touches).
  const jBall = makeBall();
  jBall.visible = false;
  root.add(jBall);
  const juggleInfo = clipInfo(fb, "juggle");
  const placeJuggle = () => {
    const w = (Object.values(people) as Body[]).find((s) => s.player.current === "juggle");
    const tch = juggleInfo?.touches;
    if (!w || !tch || tch.length < 2) { jBall.visible = false; return; }
    jBall.visible = true;
    const per = juggleInfo!.duration;
    const t = w.player.time() % per;
    let i = tch.length - 1;
    for (let k = 0; k < tch.length; k++) if (t >= tch[k][0]) i = k;
    const a = tch[i], b = tch[(i + 1) % tch.length];
    const ta = a[0], tb = b[0] + (b[0] <= ta ? per : 0);
    const tt = t < ta ? t + per : t;
    const u = (tt - ta) / (tb - ta);
    const T = tb - ta;
    const pa = a[2], pb = b[2];
    const x = pa[0] + (pb[0] - pa[0]) * u, z = pa[2] + (pb[2] - pa[2]) * u;
    const y = pa[1] + (pb[1] - pa[1]) * u + (9.8 * T * T / 2) * u * (1 - u);
    const off = toWorld(x, z, w.p.root.rotation.y);
    jBall.position.set(w.p.root.position.x + off.x, y, w.p.root.position.z + off.z);
    jBall.rotation.x += 0.08;
  };

  // ── Camera ──
  let camMode: "behind" | "goal" | "react" = "behind";
  /** Who the "react" camera is on. */
  let reactWho: Who = "you";
  /** Cut (not glide) to the next camera: a new turn starts on a new shot. */
  let snap = true;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const camTarget = () => {
    const sx = spotBall.x;
    if (camMode === "goal") return { pos: new THREE.Vector3(sx * 0.4 + 2.6, 2.6, 13.5), look: new THREE.Vector3(0, 1.5, 0) };
    if (camMode === "react") {
      // in front of him (he faces the goal), a touch to his right, chest high
      const s = people[reactWho];
      const pos = s.at.clone().add(toWorld(-0.9, 4.4, s.yaw)).setY(1.75);
      return { pos, look: s.at.clone().setY(1.05) };
    }
    return { pos: new THREE.Vector3(sx * 0.6 - 2.4, 2.4, SPOT.z + 7.5), look: new THREE.Vector3(sx * 0.6, 0.9, SPOT.z - 1) };
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

  // ── The loop (three's own animation loop; nothing here moves the engine's ball) ──
  let active = true;
  let last = performance.now();
  /** Scene time (ms), advanced by the same clamped steps as the people: the engine's ball is timed on it, so a slow phone keeps foot and ball together. */
  let clock = 0;
  /** after(): callbacks waiting on the scene clock (ms). */
  let timers: { at: number; fn: () => void }[] = [];
  const feed: { t: number; v: any }[] = [];
  /** The last engine step shown before the current one, to carry the ball on once the engine stops. */
  const shown: { t: number; v: any }[] = [];
  /** After the engine has settled the shot: the 3D ball drops and rolls away (looks only; never fed back). */
  let loose: { v: any; vel: any } | null = null;
  let mate: { shot: MateShot; t: number; stage: number; onDone: () => void } | null = null;
  const MATE_WAIT = 0.3;
  const HW2 = GOAL_W / 2;
  const stepLoose = (dt: number) => {
    if (!loose) return;
    const { v, vel } = loose;
    vel.y -= 9.8 * dt;
    v.addScaledVector(vel, dt);
    if (v.y < 0.11) {
      v.y = 0.11;
      if (vel.y < -0.8) vel.y = -vel.y * 0.5; else vel.y = 0;
      vel.x *= 0.97; vel.z *= 0.97; // rolling on grass
    }
    // the net: in behind the line, between the posts and under the bar
    if (v.z < 0 && Math.abs(v.x) < HW2 && v.y < GOAL_H + 0.1) {
      vel.x *= 0.9; vel.z *= 0.8;
      if (v.z < -1.6) { v.z = -1.6; vel.z = Math.abs(vel.z) * 0.2; }
    }
    placeBall(v.clone());
    if (vel.lengthSq() < 0.02 && v.y <= 0.111) loose = null;
  };
  const frame = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    governed.frame(now);
    clock += dt * 1000;
    for (const who of ["you", "mate"] as Who[]) {
      const s = people[who];
      if (s.player.current !== "kick_r") {
        s.p.root.position.lerp(s.at, Math.min(1, dt * 6));
        const yawNow = s.p.root.rotation.y;
        s.p.root.rotation.y = yawNow + (s.yaw - yawNow) * Math.min(1, dt * 8);
      }
      s.player.update(dt);
      s.p.mixer.update(dt);
    }
    placeJuggle();
    if (timers.length) {
      const due = timers.filter((x) => x.at <= clock);
      if (due.length) { timers = timers.filter((x) => x.at > clock); due.forEach((x) => x.fn()); }
    }
    // the ball: the engine's own steps, shown from the moment the 3D foot reaches it
    if (feed.length) {
      const showAt = clock - contactS * 1000;
      while (feed.length > 1 && feed[1].t <= showAt) { shown.push(feed.shift()!); if (shown.length > 16) shown.shift(); }
      if (feed[0].t <= showAt) {
        placeBall(feed[0].v);
        // the engine has gone quiet: it has settled the shot. Carry the ball on.
        if (feed.length === 1 && showAt - feed[0].t > 120) {
          const b = feed[0];
          // its last speed, over the last few engine steps at least 30 ms back
          let h = null as { t: number; v: any } | null;
          for (const x of shown) if (b.t - x.t >= 30) h = x;
          const vel = h ? b.v.clone().sub(h.v).multiplyScalar(1000 / (b.t - h.t)) : new THREE.Vector3();
          if (vel.length() > 30) vel.setLength(30);
          loose = { v: b.v.clone(), vel };
          feed.length = 0;
          shown.length = 0;
        }
      }
    } else stepLoose(dt);
    // his turn: the run-up and kick (one clip), then the cut-scene path
    if (mate) {
      mate.t += dt;
      if (mate.stage === 0 && mate.t > MATE_WAIT) { mate.stage = 1; people.mate.move = "kick"; applyMove("mate"); }
      const since = mate.t - (MATE_WAIT + contactS);
      if (since > 0.25) camMode = "goal";
      if (since > 0) {
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
  // the governor (three3d/governor.ts): slow for 2.5 s → one rung down
  const governed = governScene(THREE, {
    name: "training", start: tier, renderer, scene, camera, lights: [sun], basePR: renderer.getPixelRatio(),
    shadowSize: prof.shadowScale >= 1 ? 2048 : 1024, keepCasting: (m: any) => m === ball || m.parent === ball,
  });
  renderer.setAnimationLoop(frame);
  // test pages: where everyone is (read by the playtest scripts only)
  (window as any).__training3d = {
    people, camera, ball, get shooter() { return shooter; },
    /** Stills: hold one man on a clip at a time (s), the camera in a mode. */
    hold(who: Who, clip: string, t: number, cam?: "behind" | "goal") {
      const s = people[who];
      s.player.play(clip, { fade: 0 });
      const a = s.p.actions[clip];
      if (a) { a.time = t; a.paused = true; }
      if (cam) { camMode = cam; snap = true; }
      else if (clip === "celebrate_fist" || clip === "frustrated") { camMode = "react"; reactWho = who; snap = true; }
      if (who === shooter && clip.startsWith("kick")) { feed.length = 0; loose = null; placeBall(spotBall.clone().setY(0.11)); }
      else if (who === shooter) {
        // stand him where the kick leaves him
        const e = kickInfo.end ?? KICK_FALLBACK.end!;
        s.at.copy(kickStart(spotBall, s.yaw)).add(toWorld(e[0], e[1], s.yaw));
        s.p.root.position.copy(s.at);
      }
    },
  };

  return {
    kickDelayS: contactS,
    resetBall() {
      feed.length = 0;
      shown.length = 0;
      loose = null;
      spotBall.set(SPOT.x, 0, SPOT.z);
      standFor("you"); standFor("mate");
      lastBall = ballAt.clone();
      placeBall(ballAt.clone());
      ball.rotation.set(0, 0, 0);
      camMode = "behind";
      snap = true;
    },
    feedEngineBall(p) {
      feed.push({ t: clock, v: new THREE.Vector3(...P(p.x, p.y, Math.max(0.11, p.z))) });
    },
    playMateShot(shot, onDone) {
      const b0 = new THREE.Vector3(...P(shot.sx, CROSSBAR_SPOT.y, 0.11));
      feed.length = 0;
      loose = null;
      lastBall = b0.clone();
      placeBall(b0);
      camMode = "behind";
      snap = true;
      spotBall.set(b0.x, 0, b0.z);
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
      applyMove(who);
    },
    setCamera(mode) { camMode = mode; },
    after(seconds, fn) { timers.push({ at: clock + seconds * 1000, fn }); },
    setActive(on) {
      if (on === active) return;
      active = on;
      last = performance.now();
      renderer.setAnimationLoop(on ? frame : null);
    },
    dispose() {
      ro?.disconnect();
      renderer.setAnimationLoop(null);
      governed.dispose();
      timers = [];
      release(root);
    },
  };
}
