/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PLAY3D PICTURE — draws a play3d World in three.js. A view: it never
 * decides anything about the ball. Each frame it advances the World by the
 * real time passed (the World turns that into fixed steps), then puts the
 * people and the ball where the World says.
 *
 * People are the approved 3D people (people3d.ts — the 3D shop, garden and
 * training pitch's own), with the football clips (three3d/footballAnims.ts).
 * Every GLTFLoader goes through withMeshopt.
 *
 * Pitch metres → three: X = x − CX, Y = z (up), Z = y (out from the goal line).
 */
import { CX, GOAL_H, GOAL_W, PEN_SPOT_Y, HALF_LEN } from "./constants";
import type { World } from "./world";
import type { P3, Act3 } from "./player";
import { loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, relaxHands, type Person3D, type FacePic, type PlayerModel } from "../people3d";
import { people3dLook } from "../look3d";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { acquireRenderer } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { addClips, ClipPlayer, loadAnims3d } from "../three3d/footballAnims";
import type { KitColours } from "../shop3d/scene";

export interface Play3DPerson { skin: string; hair: string; hairStyle?: "short" | "long" | "buzz" | "none"; face?: FacePic | null }
export interface Play3DLook {
  /** Your side's training top. */
  kit: KitColours;
  /** Anyone not on your side (a keeper is in his own). */
  oppKit?: KitColours;
  keeperKit?: KitColours;
  people: Record<string, Play3DPerson>;
}
export type CameraMode = "chase" | "pair";

export interface Play3DController {
  /** Which way the camera looks, as a pitch-plane angle (0 = +x): the screen maps the stick and the drag with it. */
  heading(): number;
  setActive(on: boolean): void;
  dispose(): void;
}

const P = (x: number, y: number, z: number): [number, number, number] => [x - CX, z, y];
const yawOf = (facing: number) => Math.PI / 2 - facing;

export async function createPlay3DScene(
  container: HTMLElement, world: World, look: Play3DLook,
  opts: { camera: CameraMode; quality?: Quality3d; onFrame?: (dt: number) => void },
): Promise<Play3DController> {
  const tier = opts.quality ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const SK = SkeletonUtils.default ?? SkeletonUtils;

  const loader = new GLTFLoader();
  await withMeshopt(loader);
  const body = people3dLook();
  const models = new Map<PlayerModel, any>();
  const want = new Set<PlayerModel>(world.players.map((p) => playerModelFor(look.people[p.id]?.hairStyle)));
  const [animG] = await Promise.all([
    loadPeople3d(loader, "anims", body),
    ...Array.from(want).map(async (m) => { models.set(m, await loadPeople3d(loader, m, body)); }),
  ]);
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
  scene.fog = new THREE.Fog("#a9d4ef", 60, 140);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 260);

  root.add(new THREE.HemisphereLight("#e8f4ff", "#3f6b2a", 1.15));
  const sun = new THREE.DirectionalLight("#fff4df", 2.1);
  sun.position.set(-18, 30, 30);
  sun.target.position.set(0, 0, 20);
  root.add(sun, sun.target);
  if (prof.shadows) {
    sun.castShadow = true;
    const s = prof.shadowScale >= 1 ? 2048 : 1024;
    sun.shadow.mapSize.set(s, s);
    Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
    sun.shadow.bias = -0.0006;
  }

  // ── The half pitch ──
  const grassA = new THREE.MeshStandardMaterial({ color: "#4f8f3a", roughness: 0.95 });
  const grassB = new THREE.MeshStandardMaterial({ color: "#5c9c43", roughness: 0.95 });
  const base = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), grassA);
  base.rotation.x = -Math.PI / 2;
  base.receiveShadow = true;
  root.add(base);
  for (let i = 0; i < 14; i += 2) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(68, 4), grassB);
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.002, i * 4 + 2);
    s.receiveShadow = true;
    root.add(s);
  }
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
  if (world.goal) {
    strip(-34, 0, 34, 0);
    strip(-34, 0, -34, HALF_LEN); strip(34, 0, 34, HALF_LEN); strip(-34, HALF_LEN, 34, HALF_LEN);
    const six = GOAL_W / 2 + 5.5, box = GOAL_W / 2 + 16.5;
    strip(-six, 0, -six, 5.5); strip(six, 0, six, 5.5); strip(-six, 5.5, six, 5.5);
    strip(-box, 0, -box, 16.5); strip(box, 0, box, 16.5); strip(-box, 16.5, box, 16.5);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), lineMat);
    spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.006, PEN_SPOT_Y); root.add(spot);
    const half = Math.acos((16.5 - PEN_SPOT_Y) / 9.15);
    const arc = new THREE.Mesh(new THREE.RingGeometry(9.15 - LW / 2, 9.15 + LW / 2, 48, 1, Math.PI / 2 - half, half * 2), lineMat);
    arc.rotation.x = -Math.PI / 2; arc.rotation.z = Math.PI; arc.position.set(0, 0.006, PEN_SPOT_Y); root.add(arc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(9.15 - LW / 2, 9.15 + LW / 2, 64, 1, 0, Math.PI), lineMat);
    ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI; ring.position.set(0, 0.006, HALF_LEN); root.add(ring);

    // the goal and net
    const frameMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 });
    const R = 0.06, HW = GOAL_W / 2, D = 1.9;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(R, R, GOAL_H + R, 14), frameMat);
      post.position.set(sx * HW, (GOAL_H + R) / 2, 0); post.castShadow = true; root.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(R, R, GOAL_W + 2 * R, 14), frameMat);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, GOAL_H, 0); bar.castShadow = true; root.add(bar);
    const pts: number[] = [];
    const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
    const G = 0.25;
    for (let x = -HW; x <= HW + 1e-6; x += G) seg([x, GOAL_H, 0], [x, 0, -D]);
    for (let t = 0; t <= 1 + 1e-6; t += G / Math.hypot(D, GOAL_H)) { const y = GOAL_H * (1 - t), z = -D * t; seg([-HW, y, z], [HW, y, z]); }
    for (const sx of [-1, 1]) {
      for (let z = 0; z >= -D - 1e-6; z -= G) seg([sx * HW, 0, z], [sx * HW, GOAL_H * (1 + z / D), z]);
      for (let y = 0; y <= GOAL_H + 1e-6; y += G) seg([sx * HW, y, 0], [sx * HW, y, -D * (1 - y / GOAL_H)]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 })));
  } else {
    // two cones either side of where you stand: a training patch
    const coneMat = new THREE.MeshStandardMaterial({ color: "#ff7a1a", roughness: 0.6 });
    for (const [x, z] of [[-6, 19], [6, 19], [-6, 25], [6, 25]]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 14), coneMat);
      c.position.set(x, 0.17, z); c.castShadow = true; root.add(c);
    }
  }
  // a hedge and trees round the back
  const hedgeMat = new THREE.MeshStandardMaterial({ color: "#2f5a28", roughness: 1 });
  const hedge = new THREE.Mesh(new THREE.BoxGeometry(140, 3.5, 1.5), hedgeMat);
  hedge.position.set(0, 1.75, -14); root.add(hedge);
  for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.5, 90), hedgeMat); h.position.set(sx * 44, 1.75, 30); root.add(h); }

  // ── The ball ──
  const ballMat = new THREE.MeshStandardMaterial({ color: "#fbfbf8", roughness: 0.45 });
  const patchMat = new THREE.MeshStandardMaterial({ color: "#1d1f24", roughness: 0.5 });
  const ball = new THREE.Group();
  { const s = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), ballMat); s.castShadow = true; ball.add(s); }
  for (const [a, b] of [[0, 0], [1.2, 0.9], [2.4, -0.7], [3.6, 1.1], [4.8, -0.2], [0.6, -1.3]]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.038, 5), patchMat);
    const v = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
    p.position.copy(v.multiplyScalar(0.1105)); p.lookAt(v.clone().multiplyScalar(2)); ball.add(p);
  }
  root.add(ball);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);
  let lastBall = new THREE.Vector3(...P(world.ball.x, world.ball.y, world.ball.z));
  const placeBall = () => {
    const b = world.ball;
    const v = new THREE.Vector3(...P(b.x, b.y, b.z));
    const d = v.distanceTo(lastBall);
    if (d > 1e-4 && d < 3) {
      const axis = new THREE.Vector3().subVectors(v, lastBall).cross(new THREE.Vector3(0, 1, 0)).normalize().negate();
      if (axis.lengthSq() > 0) ball.rotateOnWorldAxis(axis, d / 0.11);
    }
    lastBall = v;
    ball.position.copy(v);
    shadow.position.set(v.x, 0.008, v.z);
    const k = Math.max(0.35, 1 - v.y / 4);
    shadow.scale.setScalar(k);
    shadow.material.opacity = 0.32 * k;
  };

  // ── The people ──
  type Body = { p: Person3D; play: ClipPlayer; who: P3; state: string };
  const bodies: Body[] = [];
  for (const who of world.players) {
    const lk = look.people[who.id] ?? { skin: "#c68642", hair: "#1b120c", hairStyle: "short" };
    const g = models.get(playerModelFor(lk.hairStyle));
    const p: Person3D = makePerson3d(THREE, SK, g, animG, { outline: prof.outlines ? 0.006 : 0, castShadow: prof.shadows });
    const kit = who.keeper ? (look.keeperKit ?? { shirt: "#16a34a", trim: "#0b3d1d" }) : who.team === 0 ? look.kit : (look.oppKit ?? { shirt: "#dc2626", trim: "#ffffff" });
    dressPerson3d(THREE, p, { skin: lk.skin, hair: lk.hair, kit, number: null, face: lk.face ?? null });
    relaxHands(THREE, p);
    if (fb) addClips(THREE, p, fb);
    root.add(p.root);
    const play = new ClipPlayer(THREE, p.actions);
    play.play("idle", { fade: 0 });
    bodies.push({ p, play, who, state: "idle" });
  }

  /**
   * Which clip, from what he is doing. The World's `act` is the last thing
   * he did and how long ago; the rest is running speed.
   * Missing clips (no Blender this round) are made from the nearest ones:
   * a header is a head nod on top of whatever he's doing; a keeper's dive
   * is the whole body laid out sideways; a sprint is the jog played faster.
   */
  const ONE_SHOT: Partial<Record<Act3, { clip: string; from: number; speed: number; len: number }>> = {
    pass: { clip: "pass", from: 0.42, speed: 1.5, len: 0.45 },
    loft: { clip: "pass", from: 0.4, speed: 1.3, len: 0.5 },
    touch: { clip: "pass", from: 1.1, speed: 1.4, len: 0.35 },
    tackle: { clip: "pass", from: 0.35, speed: 1.8, len: 0.4 },
    shot: { clip: "kick_r", from: 1.05, speed: 1.25, len: 0.75 },
    volley: { clip: "kick_r", from: 1.1, speed: 1.4, len: 0.6 },
    "juggle-foot": { clip: "juggle", from: 0.18, speed: 1.2, len: 0.35 },
    "juggle-thigh": { clip: "juggle", from: 0.78, speed: 1.2, len: 0.35 },
    celebrate: { clip: "celebrate_fist", from: 0, speed: 1, len: 2 },
  };
  const animate = (b: Body, dt: number) => {
    const w = b.who;
    const sp = Math.hypot(w.vx, w.vy);
    const shot = ONE_SHOT[w.act];
    let key: string;
    if (shot && w.actT < shot.len && b.play.has(shot.clip)) key = `${w.act}`;
    else if (sp < 0.35) key = "idle";
    else key = "jog";
    if (key !== b.state) {
      b.state = key;
      if (shot && key === w.act) b.play.play(shot.clip, { fade: 0.08, from: shot.from, speed: shot.speed, once: true });
      else if (key === "jog") b.play.play("jog", { fade: 0.2 });
      else b.play.play("idle", { fade: 0.25 });
    }
    if (key === "jog") { const a = b.p.actions.jog; if (a) a.timeScale = Math.max(0.7, Math.min(2.4, sp / 3.2)); }
    b.play.update(dt);
    b.p.mixer.update(dt);
    // place him
    b.p.root.position.set(w.x - CX, 0, w.y);
    b.p.root.rotation.set(0, yawOf(w.facing), 0);
    // procedural extras on top of the clip
    const head = b.p.bones.Head;
    if (head && (w.act === "header" || w.act === "juggle-head") && w.actT < 0.35) {
      const k = Math.sin(Math.min(1, w.actT / 0.35) * Math.PI);
      head.rotateX(0.55 * k);
    }
    if (w.keeper && w.dive) {
      const k = Math.min(1, w.dive.t);
      b.p.root.rotateZ(-w.dive.side * k * (1.25 - w.dive.up * 0.6));
      b.p.root.position.y = Math.sin(k * Math.PI) * 0.35 + w.dive.up * 0.6 * k;
    }
    b.p.root.visible = w.active;
  };

  // ── Camera ──
  let heading = -Math.PI / 2;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let snap = true;
  const camTarget = () => {
    const you = world.you() ?? world.players[0];
    if (opts.camera === "pair") {
      const mate = world.players.find((p) => p !== you) ?? you;
      const mid = new THREE.Vector3((you.x + mate.x) / 2 - CX, 1.1, (you.y + mate.y) / 2);
      const across = Math.atan2(mate.y - you.y, mate.x - you.x);
      const back = { x: -Math.cos(across), y: -Math.sin(across) };
      const side = { x: -Math.sin(across), y: Math.cos(across) };
      // behind you and a little to the side, both of you in shot
      const pos = new THREE.Vector3(you.x - CX + back.x * 5.5 + side.x * 3.5, 3.1, you.y + back.y * 5.5 + side.y * 3.5);
      heading = Math.atan2(mid.z - pos.z, mid.x - pos.x);
      return { pos, look: mid };
    }
    const sp = Math.hypot(you.vx, you.vy);
    // swing round behind him while he runs; hold still while he stands
    if (sp > 1) {
      let d = you.facing - heading;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      heading += Math.max(-1, Math.min(1, d)) * Math.min(1, 0.025 * sp);
    }
    const fx = Math.cos(heading), fy = Math.sin(heading);
    const pos = new THREE.Vector3(you.x - CX - fx * 7.5, 3.6, you.y - fy * 7.5);
    const look2 = new THREE.Vector3(you.x - CX + fx * 6, 0.9, you.y + fy * 6);
    return { pos, look: look2 };
  };

  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 58 : 48;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  ro?.observe(container);

  let active = true;
  let last = performance.now();
  const frame = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    world.advance(dt);
    for (const b of bodies) animate(b, dt);
    placeBall();
    const t = camTarget();
    if (snap) { camPos.copy(t.pos); camLook.copy(t.look); snap = false; }
    camPos.lerp(t.pos, Math.min(1, dt * 4));
    camLook.lerp(t.look, Math.min(1, dt * 5));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    renderer.render(scene, camera);
    opts.onFrame?.(dt);
  };
  renderer.setAnimationLoop(frame);
  (window as any).__play3d = { world, camera, bodies };

  return {
    heading: () => heading,
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
      if ((window as any).__play3d?.world === world) delete (window as any).__play3d;
    },
  };
}
