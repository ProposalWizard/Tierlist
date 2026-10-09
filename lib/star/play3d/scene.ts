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
import { addClips, clipInfo, ClipPlayer, loadAnims3d } from "../three3d/footballAnims";
import type { KitColours } from "../shop3d/scene";

export interface Play3DPerson { skin: string; hair: string; hairStyle?: "short" | "long" | "buzz" | "none"; face?: FacePic | null }
export interface Play3DLook {
  /** Your side's training top. */
  kit: KitColours;
  /** Anyone not on your side (a keeper is in his own). */
  oppKit?: KitColours;
  keeperKit?: KitColours;
  /** A colour per side, by team number (training bibs: Wembley gives every man or pair his own). Falls back to oppKit. */
  teamKits?: Record<number, KitColours>;
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
  // ── Rings on the grass (World.markers: a cross's landing spot …) ──
  const rings: any[] = [];
  const syncMarkers = () => {
    const ms = world.markers;
    while (rings.length < ms.length) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 40), new THREE.MeshBasicMaterial({ color: "#facc15", transparent: true, opacity: 0.85, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      root.add(m);
      rings.push(m);
    }
    rings.forEach((r, i) => {
      const m = ms[i];
      r.visible = !!m;
      if (!m) return;
      r.position.set(m.x - CX, 0.012, m.y);
      r.scale.setScalar(m.r ?? 1);
      r.material.color.set(m.color && !m.color.startsWith("rgba") ? m.color : "#facc15");
      r.material.opacity = m.color?.startsWith("rgba") ? 0.45 : 0.9;
    });
  };
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
  type Body = {
    p: Person3D; play: ClipPlayer; who: P3; state: string;
    /** The act last seen (a fresh one starts its clip). */
    lastAct?: Act3; lastActT: number;
    /** Seconds left of the one-off clip playing. */
    onceLeft: number;
    /** The nudge that puts the clip's contact point on the ball, held to the contact then faded. */
    off: any; offHold: number; offFade: number;
    /** The one-off playing was started early, for a ball seen coming. */
    antic?: boolean;
    offRamp: number;
  };
  const bodies: Body[] = [];
  for (const who of world.players) {
    const lk = look.people[who.id] ?? { skin: "#c68642", hair: "#1b120c", hairStyle: "short" };
    const g = models.get(playerModelFor(lk.hairStyle));
    const p: Person3D = makePerson3d(THREE, SK, g, animG, { outline: prof.outlines ? 0.006 : 0, castShadow: prof.shadows });
    const kit = who.keeper ? (look.keeperKit ?? { shirt: "#16a34a", trim: "#0b3d1d" })
      : who.team === 0 ? look.kit
      : (look.teamKits?.[who.team] ?? look.oppKit ?? { shirt: "#dc2626", trim: "#ffffff" });
    dressPerson3d(THREE, p, { skin: lk.skin, hair: lk.hair, kit, number: null, face: lk.face ?? null });
    relaxHands(THREE, p);
    if (fb) addClips(THREE, p, fb);
    root.add(p.root);
    const play = new ClipPlayer(THREE, p.actions);
    play.play("idle", { fade: 0 });
    bodies.push({ p, play, who, state: "idle", lastActT: 9, onceLeft: 0, off: new THREE.Vector3(), offHold: 0, offFade: 0, offRamp: 0 });
  }

  /**
   * Which clip, from what he is doing. The World's `act` is the last thing
   * he did and how long ago; the rest is running speed and whether he has
   * the ball. Every move is its own hand-made clip (tools/anims3d/clips.py).
   *
   * Timing: the World sets `act` at the instant the ball is met, so a move
   * starts at the clip's measured contact frame (the file says when:
   * clipInfo().contact) plus however long ago that was: the foot or head is on
   * the ball the frame it leaves. A ball coming to a man (a cross, a pass) is
   * seen coming: the clip starts early, timed so its contact frame lands when
   * the ball gets to him, wind-up and all, and is put back on time if the real
   * touch comes a little early or late. His body is nudged so the clip's
   * measured contact point (`contactPoint`) sits on the ball; the nudge fades
   * out after the contact.
   * A keeper's dive is driven by the World's own dive progress, so his hands
   * are at full stretch exactly when the World says they are.
   */
  type Once = { clip: string; lead: number; speed?: number; align?: "flat" | "full"; from?: number };
  /** Strikes and touches are pinned to the contact; the rest (celebrations, keepy-ups' old clip) start where `lead` says. */
  const PINNED = new Set(["shot_r", "volley", "header_stand", "header_diving", "pass", "pass_inside", "pass_lofted", "first_touch", "thigh_control", "chest_control", "poke_tackle", "sliding_tackle", "high_claim", "throw_out"]);
  const info = (n: string) => clipInfo(fb, n);
  const loopSpeed: Record<string, number> = { jog: 3.2, sprint: 7.4, dribble_run: 4.6, celebrate_safe: 3.4, slump_walk: 1.15 };
  for (const n of Object.keys(loopSpeed)) { const s = info(n)?.speed; if (typeof s === "number") loopSpeed[n] = s; }
  const partOf = (z: number) => (z < 0.6 ? "foot" : z < 1.0 ? "thigh" : z < 1.55 ? "chest" : "head");

  /** The one-shot for a fresh act (null: keep running/standing as he is). */
  const onceFor = (b: Body, sp: number, ballZ: number): Once | null => {
    const w = b.who;
    switch (w.act) {
      case "shot": return { clip: "shot_r", lead: 0.05, align: "flat" };
      case "volley": return { clip: "volley", lead: 0.05, align: "flat" };
      case "header":
        // flying in at a ball not far above the ground: a diving header; else up for it
        return sp > 3.2 && ballZ < 1.7 ? { clip: "header_diving", lead: 0.06, align: "full" } : { clip: "header_stand", lead: 0.06, align: "full" };
      // the mocap set has a real side-foot pass; the old set has its drill clip
      case "pass": return b.play.has("pass_inside") ? { clip: "pass_inside", lead: 0.05, align: "flat" } : { clip: "pass", lead: 0.05, speed: 1.2, align: "flat" };
      case "loft": return { clip: "pass_lofted", lead: 0.05, align: "flat" };
      case "touch": {
        // a touch while running with it is the dribble's own (dribble_run has it)
        if (world.owner === w.id && sp > 1.2) return null;
        const part = partOf(ballZ);
        if (part === "foot") return sp > 2.5 ? null : { clip: "first_touch", lead: 0.05, align: "flat" };
        if (part === "thigh") return { clip: "thigh_control", lead: 0.05, align: "flat" };
        if (part === "chest") return { clip: "chest_control", lead: 0.06, align: "flat" };
        return { clip: "header_stand", lead: 0.06, align: "full" };
      }
      case "tackle": return sp > 3.5 ? { clip: "sliding_tackle", lead: 0.12, align: "flat" } : { clip: "poke_tackle", lead: 0.06, align: "flat" };
      // keepy-ups: the juggle clip's right-foot touch; a thigh touch is the thigh's own move
      case "juggle-foot": return { clip: "juggle", lead: 0, from: 0.18, speed: 1.2 };
      case "juggle-thigh": return { clip: "thigh_control", lead: 0, align: "flat" };
      case "catch": return ballZ > 1.7 ? { clip: "high_claim", lead: 0.08, align: "full" } : null;
      case "throw": return { clip: "throw_out", lead: 0.1 };
      case "celebrate": return { clip: "celebrate_fist", lead: 0 };
      case "slump": return { clip: "frustrated", lead: 0 };
      default: return null;
    }
  };

  /** What he does when nothing one-off is playing. */
  const loopFor = (b: Body, sp: number): string => {
    const w = b.who;
    if (!w.active && w.sideline) {
      if (w.act === "celebrate" && sp > 0.35) return "celebrate_safe";
      if (w.act === "slump" && sp > 0.15) return "slump_walk";
    }
    if (w.keeper) {
      if (world.owner === w.id) return "hold";
      return sp > 2.5 ? "jog" : "ready_shuffle";
    }
    if (sp < 0.35) return "idle";
    if (world.owner === w.id && sp > 1.2) return "dribble_run";
    return sp > 5.4 ? "sprint" : "jog";
  };

  const R3 = new THREE.Vector3();
  /** Where the clip's measured contact point is now, in the world (his frame → three). */
  const contactWorld = (b: Body, cp: [number, number, number]) => {
    const yaw = yawOf(b.who.facing), c = Math.cos(yaw), s = Math.sin(yaw);
    return R3.set(b.who.x - CX + cp[0] * c + cp[2] * s, cp[1], b.who.y - cp[0] * s + cp[2] * c);
  };

  /**
   * Start a one-off. `ago`: how long ago the ball was met (a pinned clip
   * starts that far past its contact frame). `early`: the ball is still
   * coming and gets to him in this many seconds (the clip starts that far
   * before its contact frame). A clip already playing because the ball was
   * seen coming is put back on time, not restarted.
   */
  const startOnce = (b: Body, o: Once, ball: { x: number; y: number; z: number }, ago: number, early?: number) => {
    const ci = info(o.clip);
    if (!ci || !b.play.has(o.clip)) return false;
    const contact = ci.contact ?? 0;
    const sp1 = o.speed ?? 1;
    const pinned = PINNED.has(o.clip);
    const from = early !== undefined ? Math.max(0, contact - early * sp1)
      : pinned ? Math.min(ci.duration, contact + ago * sp1) : o.from ?? Math.max(0, contact - o.lead);
    if (b.state === `once:${o.clip}` && early === undefined && b.antic) {
      // seen coming: put it back on time, keep the nudge it already has
      b.p.actions[o.clip].time = from;
      b.antic = false;
      b.onceLeft = (ci.duration - from) / sp1;
      b.offHold = 0; b.offRamp = 0;
      return true;
    }
    b.play.play(o.clip, { fade: early !== undefined ? 0.12 : pinned ? 0.04 : 0.08, from, speed: sp1, once: true });
    b.antic = early !== undefined;
    b.state = `once:${o.clip}`;
    b.onceLeft = (ci.duration - from) / sp1;
    b.off.set(0, 0, 0);
    // early: the nudge eases in until the ball arrives; otherwise it is there now
    b.offHold = early ?? 0;
    b.offRamp = early ?? 0;
    b.offFade = 0.45;
    const cp = ci.contactPoint as [number, number, number] | undefined;
    if (o.align && cp) {
      const w = b.who, ahead = early ?? 0;
      const at = contactWorld(b, cp).add(new THREE.Vector3(w.vx * ahead, 0, w.vy * ahead));
      const d = new THREE.Vector3(...P(ball.x, ball.y, ball.z)).sub(at);
      if (o.align === "flat") d.y = 0;
      else d.y = Math.max(-0.45, Math.min(0.5, d.y));
      const h = Math.hypot(d.x, d.z);
      if (h > 0.9) { d.x *= 0.9 / h; d.z *= 0.9 / h; }
      b.off.copy(d);
    }
    return true;
  };

  /**
   * A ball coming to him (a pass or a cross meant for him, nobody on it): when
   * it gets to him, and what he'll meet it with. In Headers & Volleys that is
   * a strike; anywhere else a touch.
   */
  const coming = (b: Body): { once: Once; t: number; at: { x: number; y: number; z: number } } | null => {
    const w = b.who, bl = world.ball;
    if (!w.active || w.keeper || world.owner || world.passTarget !== w.id || bl.inNet) return null;
    const rx = bl.x - w.x, ry = bl.y - w.y;
    const v2 = bl.vx * bl.vx + bl.vy * bl.vy;
    if (v2 < 1) return null;
    const t = -(rx * bl.vx + ry * bl.vy) / v2;
    if (t <= 0 || t > 0.8) return null;
    const miss = Math.hypot(rx + bl.vx * t, ry + bl.vy * t);
    if (miss > 1.3) return null;
    const z = Math.max(0.11, bl.z + bl.vz * t - 4.9 * t * t);
    const at = { x: bl.x + bl.vx * t, y: bl.y + bl.vy * t, z };
    const hv = world.rules.id === "headers-volleys";
    const sp = Math.hypot(w.vx, w.vy);
    let once: Once | null;
    if (hv) once = z > 1.45 ? (sp > 3.2 && z < 1.7 ? { clip: "header_diving", lead: 0, align: "full" } : { clip: "header_stand", lead: 0, align: "full" })
      : z > 0.65 ? { clip: "volley", lead: 0, align: "flat" } : { clip: "shot_r", lead: 0, align: "flat" };
    else {
      const part = partOf(z);
      once = part === "foot" ? (sp > 2.5 ? null : { clip: "first_touch", lead: 0, align: "flat" })
        : part === "thigh" ? { clip: "thigh_control", lead: 0, align: "flat" }
        : part === "chest" ? { clip: "chest_control", lead: 0, align: "flat" } : { clip: "header_stand", lead: 0, align: "full" };
    }
    if (!once) return null;
    const ci = info(once.clip);
    if (!ci || t > (ci.contact ?? 0)) return null;
    return { once, t, at };
  };

  const startLoop = (b: Body, name: string) => {
    const wasDown = b.state === "" && !!b.play.current?.startsWith("dive_");
    b.state = name;
    if (name === "hold") { b.play.play("throw_out", { fade: 0.2, from: 0.1, speed: 0 }); return; }
    b.play.play(b.play.has(name) ? name : name === "ready_shuffle" ? "idle" : "jog", { fade: wasDown ? 0.5 : name === "idle" ? 0.25 : 0.2 });
  };

  const animate = (b: Body, dt: number, prevBall: { x: number; y: number; z: number }) => {
    const w = b.who;
    const sp = Math.hypot(w.vx, w.vy);
    const fresh = w.act !== b.lastAct || w.actT < b.lastActT;
    b.lastAct = w.act; b.lastActT = w.actT;
    if (w.keeper && w.dive) {
      // the dive: his own clip, its time pinned to the World's dive progress
      const clip = w.dive.side > 0 ? "dive_left" : "dive_right";
      const ci = info(clip);
      if (ci && b.play.has(clip)) {
        if (b.state !== `dive:${clip}`) { b.play.play(clip, { fade: 0.06, from: (ci.launch as number) ?? 0.12, once: true }); b.state = `dive:${clip}`; }
        const a = b.p.actions[clip];
        const launch = (ci.launch as number) ?? 0.12, reach = ci.contact ?? 0.42;
        if (w.dive.t < 1) a.time = launch + w.dive.t * (reach - launch);
      }
    } else {
      if (b.state.startsWith("dive:")) b.state = "";
      if (b.onceLeft > 0) b.onceLeft -= dt;
      const once = b.state.startsWith("once:") && b.onceLeft > 0;
      const o = fresh ? onceFor(b, sp, prevBall.z) : null;
      const c = !o && !once ? coming(b) : null;
      if (o && startOnce(b, o, prevBall, w.actT)) { /* started */ }
      else if (c && startOnce(b, c.once, c.at, 0, c.t)) { /* started early: the ball is on its way */ }
      else {
        const lp = loopFor(b, sp);
        // a man walking off doesn't finish his celebration/despair standing still
        const interrupt = once && (lp === "celebrate_safe" || lp === "slump_walk");
        if ((!once || interrupt) && lp !== b.state) startLoop(b, lp);
      }
    }
    // loops at the speed he's really going
    const ls = loopSpeed[b.state];
    if (ls) { const a = b.p.actions[b.state]; if (a) a.timeScale = Math.max(0.6, Math.min(b.state === "sprint" ? 1.35 : 1.9, sp / ls)); }
    // dribbling: keep the clip's touch on the World's touch (each touch nudges the stride into step)
    if (b.state === "dribble_run" && fresh && w.act === "touch") {
      const a = b.p.actions.dribble_run, ci = info("dribble_run");
      const tt = ci?.touches?.[0]?.[0];
      if (a && ci && typeof tt === "number") {
        let err = tt - a.time;
        const P2 = ci.duration;
        while (err > P2 / 2) err -= P2;
        while (err < -P2 / 2) err += P2;
        a.time = (((a.time + err * 0.6) % P2) + P2) % P2;
      }
    }
    b.play.update(dt);
    b.p.mixer.update(dt);
    // place him (plus the contact nudge, fading after the contact)
    let k = 0;
    if (b.state.startsWith("once:")) {
      if (b.offHold > 0) { b.offHold -= dt; k = b.offRamp > 0 ? Math.min(1, 1 - b.offHold / b.offRamp) : 1; }
      else if (b.offFade > 0) { b.offFade -= dt; k = Math.max(0, b.offFade / 0.45); }
    }
    b.p.root.position.set(w.x - CX + b.off.x * k, b.off.y * k, w.y + b.off.z * k);
    b.p.root.rotation.set(0, yawOf(w.facing), 0);
    // a keeper going for a high one: lift the dive so the hands get up there
    if (w.keeper && w.dive) {
      const tz = 0.4 + w.dive.up * 2;
      const a = b.state.startsWith("dive:") ? b.p.actions[b.state.slice(5)] : null;
      const ci = a ? info(b.state.slice(5)) : null;
      const launch = (ci?.launch as number) ?? 0.12, land = (ci?.land as number) ?? 0.7;
      const s = a ? Math.max(0, Math.min(1, (a.time - launch) / (land - launch))) : 0;
      b.p.root.position.y = Math.max(0, tz - 0.75) * Math.sin(s * Math.PI);
    }
    // keepy-up headers: a nod on top of whatever he's doing
    const head = b.p.bones.Head;
    if (head && w.act === "juggle-head" && w.actT < 0.35) head.rotateX(0.55 * Math.sin(Math.min(1, w.actT / 0.35) * Math.PI));
    // off the pitch but in the picture (walking off, standing by the post)
    b.p.root.visible = w.active || !!w.sideline;
    if (!w.active && w.sideline && head && w.act === "slump" && w.actT >= 2.2 && sp < 0.15) head.rotateX(0.35);
  };

  // ── Camera ──
  let heading = -Math.PI / 2;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let snap = true;
  const camTarget = () => {
    const you = world.you() ?? world.players[0];
    if (opts.camera === "chase" && !you.active) {
      // you're off (safe, or out and watching): a high view of the ball and the goal
      const b = world.ball;
      heading = -Math.PI / 2;
      const bx = b.x - CX;
      return { pos: new THREE.Vector3(bx * 0.6, 9.5, Math.max(14, b.y + 13)), look: new THREE.Vector3(bx * 0.7, 0.5, Math.max(4, b.y * 0.55)) };
    }
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
    const prevBall = { x: world.ball.x, y: world.ball.y, z: world.ball.z };
    world.advance(dt);
    for (const b of bodies) animate(b, dt, prevBall);
    placeBall();
    syncMarkers();
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
  // dev/test hook: the World, the camera, the people, and a one-off draw (stills from a frozen frame)
  (window as any).__play3d = { world, camera, bodies, render: () => renderer.render(scene, camera) };

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
