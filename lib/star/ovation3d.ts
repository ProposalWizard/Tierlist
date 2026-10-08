/**
 * THE STANDING OVATION, IN 3D — you come off for the last time.
 *
 * Mikey, 8 Oct 2026 (farewell playtest): the camera circles you slowly; you
 * clap the fans and the whole ground stands and claps back; on the way to the
 * touchline team-mates and rivals stop you for a hug, a dap-up, a pat on the
 * back; the substitute waits on the line, hugs you and runs on.
 *
 * Who meets you, where and when: lib/star/ovation.ts (pure, tested). The
 * screen around it and the drawn version for a phone that can't run 3D:
 * components/star/Ovation.tsx.
 *
 * Built the way the guard of honour is (lib/star/farewell3d.ts): the one-body
 * people (people3d.ts), the reach-for-a-point arm solver (signing3dRig.ts).
 * There are no hug or dap-up clips in our files, so every greeting is posed
 * here, arm by arm, onto the other man: a hug reaches round his back, a dap
 * meets his right hand in the middle and pulls in, a pat lands on his
 * shoulder. Kept light like the walk-out: men and crowd follow the phone's
 * 3D quality.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, type Person3D, type PeopleBody, type PlayerModel } from "./people3d";
import { people3dLook } from "./look3d";
import { solveArm, handWorldQuat, rotateBoneWorld, type HandAxes } from "./signing3dRig";
import { rememberGpu } from "./three3d/perf";
import { withMeshopt } from "./three3d/meshopt";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "./three3d/quality";
import { makeWalkClip } from "./walkClip";
import { SKIN_TONES, HAIR_COLOURS } from "./playerIdentity";
import { guardRand } from "./guardOfHonour";
import type { SigningYou } from "./signing3dScene";
import { OVATION, youAt, greetWeight, cameraAngle, type OvationPlan, type OvationStop } from "./ovation";

type Three = typeof import("three");

export interface OvationKit { shirt: string; trim: string }

export interface OvationSceneOptions {
  you: SigningYou;
  ours: OvationKit;
  rivals: OvationKit;
  plan: OvationPlan;
  seed: number;
  onDone?: () => void;
  /** Each greeting as it starts (the caption under the picture). */
  onStop?: (stop: OvationStop | null) => void;
  tier?: Quality3d;
}

export interface OvationSceneHandle {
  dispose(): void;
  debugSeek(t: number): void;
  debugInfo(): { tier: Quality3d; men: number; t: number; you: number[]; calls: number; triangles: number };
}

/** Men standing round the pitch clapping you off, by quality. */
const BACKGROUND_MEN: Record<Quality3d, number> = { low: 4, medium: 8, high: 12 };
const CROWD_SIZE: Record<Quality3d, number> = { low: 1400, medium: 2400, high: 3400 };

export async function createOvationScene(container: HTMLElement, opts: OvationSceneOptions): Promise<OvationSceneHandle> {
  const T: Three = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const BODY: PeopleBody = people3dLook();
  const plan = opts.plan;

  const tier: Quality3d = opts.tier ?? quality3dTier();
  const prof = TIER_PROFILES[tier];

  // ── Renderer ──
  const renderer = new T.WebGLRenderer({ antialias: prof.antialias, powerPreference: "high-performance" });
  rememberGpu(renderer);
  renderer.setPixelRatio(Math.min(prof.maxPixelRatio, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const scene = new T.Scene();
  const NIGHT = 0x0a1426;
  scene.background = new T.Color(NIGHT);
  scene.fog = new T.Fog(NIGHT, 30, 80);
  const camera = new T.PerspectiveCamera(50, 1, 0.05, 140);

  // ── Light: the floodlights ──
  scene.add(new T.HemisphereLight(0xc9dcff, 0x1d4524, 0.8));
  const key = new T.DirectionalLight(0xfff6e6, 2.3);
  key.position.set(-10, 18, 6);
  key.target.position.set(0, 0, 0);
  if (prof.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(prof.shadowMapSize, prof.shadowMapSize);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 12, bottom: -12, near: 2, far: 50 });
    key.shadow.bias = -0.0006;
  }
  scene.add(key, key.target);
  const rim = new T.DirectionalLight(0xdfe9ff, 1.2);
  rim.position.set(12, 14, -14);
  scene.add(rim);

  const std = (color: number, rough = 0.9) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
  const add = <O extends THREE.Object3D>(o: O): O => { scene.add(o); return o; };

  // ── The pitch: grass, stripes, the touchline you walk over, halfway ──
  const grass = add(new T.Mesh(new T.PlaneGeometry(120, 120), std(0x2e7a3c)));
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = prof.shadows;
  const stripeMat = std(0x358a45);
  for (let i = -6; i < 6; i++) {
    const s = add(new T.Mesh(new T.PlaneGeometry(120, 5), stripeMat));
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.003, i * 10 + 2.5);
    s.receiveShadow = prof.shadows;
  }
  const chalk = new T.MeshBasicMaterial({ color: 0xf2f5f0 });
  const line = (w: number, d: number, x: number, z: number) => {
    const l = add(new T.Mesh(new T.PlaneGeometry(w, d), chalk));
    l.rotation.x = -Math.PI / 2;
    l.position.set(x, 0.006, z);
  };
  line(90, 0.12, 0, OVATION.lineZ);
  line(0.12, 60, 0, OVATION.lineZ - 30);
  const circle = add(new T.Mesh(new T.RingGeometry(9.1, 9.22, 72), chalk));
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(0, 0.006, OVATION.lineZ - 30);

  // ── The stands, all the way round: the camera circles you ──
  const standMat = std(0x1a2233, 0.95);
  const ring = { left: -16, right: 16, front: OVATION.lineZ + 5, back: -30 };
  type Wall = { axis: "x" | "z"; at: number; sign: 1 | -1; from: number; to: number };
  const walls: Wall[] = [
    { axis: "z", at: ring.front, sign: 1, from: ring.left - 6, to: ring.right + 6 },
    { axis: "z", at: ring.back, sign: -1, from: ring.left - 6, to: ring.right + 6 },
    { axis: "x", at: ring.left, sign: -1, from: ring.back, to: ring.front },
    { axis: "x", at: ring.right, sign: 1, from: ring.back, to: ring.front },
  ];
  for (const w of walls) {
    const len = w.to - w.from, mid = (w.to + w.from) / 2;
    for (let k = 0; k < 6; k++) {
      const d = 2.4, h = 1.1 + k * 1.1;
      const off = w.at + w.sign * k * d;
      const b = add(new T.Mesh(new T.BoxGeometry(w.axis === "x" ? d : len, h, w.axis === "x" ? len : d), standMat));
      if (w.axis === "x") b.position.set(off, h / 2, mid); else b.position.set(mid, h / 2, off);
    }
  }
  // Advertising boards in both sides' colours, just inside the stands.
  const boardA = new T.MeshBasicMaterial({ color: new T.Color(opts.ours.shirt), toneMapped: false });
  const boardB = new T.MeshBasicMaterial({ color: new T.Color(opts.rivals.trim), toneMapped: false });
  for (let k = 0; k < 12; k++) {
    const b = add(new T.Mesh(new T.BoxGeometry(5.4, 0.8, 0.12), k % 2 ? boardB : boardA));
    b.position.set(-30 + k * 5.5, 0.4, ring.front - 1.4);
    const c = add(new T.Mesh(new T.BoxGeometry(5.4, 0.8, 0.12), k % 2 ? boardA : boardB));
    c.position.set(-30 + k * 5.5, 0.4, ring.back + 1.4);
  }
  // Floodlight towers at the corners.
  const lamp = new T.MeshBasicMaterial({ color: 0xfffbea, toneMapped: false });
  const mast = std(0x2a3346, 0.6);
  for (const [x, z] of [[-22, ring.front + 8], [22, ring.front + 8], [-22, ring.back - 8], [22, ring.back - 8]] as const) {
    const m = add(new T.Mesh(new T.BoxGeometry(0.5, 24, 0.5), mast));
    m.position.set(x, 12, z);
    const p = add(new T.Mesh(new T.BoxGeometry(3.4, 1.8, 0.3), lamp));
    p.position.set(x, 24.5, z);
    p.lookAt(0, 0, -6);
  }

  // ── The crowd: every one of them on his feet, clapping ──
  const CROWD = CROWD_SIZE[tier];
  const fan = new T.BoxGeometry(0.46, 0.78, 0.38);
  const fanMat = new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  const crowd = add(new T.InstancedMesh(fan, fanMat, CROWD));
  crowd.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const palette = [opts.ours.shirt, opts.ours.trim, opts.ours.shirt, opts.rivals.shirt, "#e5e7eb", "#1f2937", "#9ca3af", opts.ours.shirt];
  const base = new Float32Array(CROWD * 3);
  const phase = new Float32Array(CROWD);
  const col = new T.Color();
  for (let i = 0; i < CROWD; i++) {
    const w = walls[Math.floor(guardRand(opts.seed, i, 201) * walls.length)];
    const k = Math.floor(guardRand(opts.seed, i, 202) * 6);
    const along = w.from + guardRand(opts.seed, i, 203) * (w.to - w.from);
    const off = w.at + w.sign * (k * 2.4 + 0.6);
    const y = 1.1 + k * 1.1 + 0.38;
    if (w.axis === "x") { base[i * 3] = off; base[i * 3 + 2] = along; } else { base[i * 3] = along; base[i * 3 + 2] = off; }
    base[i * 3 + 1] = y;
    phase[i] = guardRand(opts.seed, i, 204) * Math.PI * 2;
    crowd.setColorAt(i, col.set(palette[Math.floor(guardRand(opts.seed, i, 205) * palette.length)]));
  }
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  const m4 = new T.Matrix4();
  const moveCrowd = (time: number) => {
    for (let i = 0; i < CROWD; i++) {
      // A clap's bounce, and now and then arms up.
      const bounce = Math.max(0, Math.sin(time * 8.5 + phase[i])) * 0.05;
      m4.makeTranslation(base[i * 3], base[i * 3 + 1] + bounce, base[i * 3 + 2]);
      crowd.setMatrixAt(i, m4);
    }
    crowd.instanceMatrix.needsUpdate = true;
  };
  moveCrowd(0);

  // ── People ──
  const loader = await withMeshopt(new GLTFLoader());
  const models: PlayerModel[] = ["player", "player-buzz", "player-long"];
  const [anims, ...bodies] = await Promise.all([
    loadPeople3d(loader, "anims"),
    ...models.map((m) => loadPeople3d(loader, m, BODY)),
  ]);
  const bodyOf = (m: PlayerModel): GLTF => bodies[models.indexOf(m)];
  const v3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const wpos = (o: THREE.Object3D) => { const v = new T.Vector3(); o.getWorldPosition(v); return v; };
  const UP = v3(0, 1, 0);

  const outline = prof.outlines ? 0.0035 : 0;
  const outlineNear = BODY === "new" ? 1.6 : undefined;
  const clipBones = new Set((anims.animations.find((c) => c.name === "idle")?.tracks ?? []).map((tr) => tr.name.split(".")[0]));
  const OWN = ["neck", "Head", "LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand"].filter((b) => !clipBones.has(b));

  let made = 0;
  const person = (kit: OvationKit, model?: PlayerModel): Person3D => {
    const k = made++;
    const m = model ?? models[Math.floor(guardRand(opts.seed, k, 11) * models.length)];
    const p = makePerson3d(T, SkeletonUtils, bodyOf(m), anims, { outline, castShadow: prof.shadows, outlineNear });
    dressPerson3d(T, p, {
      skin: SKIN_TONES[Math.floor(guardRand(opts.seed, k, 12) * SKIN_TONES.length)].hex,
      hair: HAIR_COLOURS[Math.floor(guardRand(opts.seed, k, 13) * HAIR_COLOURS.length)].hex,
      kit,
    });
    scene.add(p.root);
    const idle = p.actions.idle;
    if (idle) { idle.setEffectiveWeight(1); idle.play(); idle.time = guardRand(opts.seed, k, 14) * idle.getClip().duration; }
    return p;
  };
  const settle = (p: Person3D) => {
    for (const name of OWN) {
      const b = p.bones[name];
      const r = b && p.rest.get(b);
      if (r) b.quaternion.copy(r[1]);
    }
  };
  const face = (p: Person3D, dx: number, dz: number) => { p.root.rotation.y = Math.atan2(dx, dz); };

  // You.
  const you = makePerson3d(T, SkeletonUtils, bodyOf(playerModelFor(opts.you.hairStyle)), anims, { outline, castShadow: prof.shadows, outlineNear });
  dressPerson3d(T, you, {
    skin: opts.you.skin, hair: opts.you.hair, kit: opts.you.kit, number: null,
    face: opts.you.face ?? null, faceSkin: opts.you.face?.skin, accessories: opts.you.accessories,
  });
  scene.add(you.root);
  const youWalk = you.actions.jog && you.actions.idle
    ? you.mixer.clipAction(makeWalkClip(T, you.actions.jog.getClip(), you.actions.idle.getClip()))
    : null;
  youWalk?.play();
  const youIdle = you.actions.idle ?? null;
  youIdle?.play();

  // The men who stop you, each waiting by your path; the sub on the line.
  interface Greeter { p: Person3D; stop: OvationStop; jog: THREE.AnimationAction | null }
  const greeters: Greeter[] = plan.stops.map((stop) => {
    const kit = stop.who.team === "rivals" ? opts.rivals : opts.ours;
    const p = person(kit);
    const jog = p.actions.jog ?? null;
    jog?.play();
    jog?.setEffectiveWeight(0);
    return { p, stop, jog };
  });

  // Everyone else, standing where they finished, clapping you off.
  interface Clapper { p: Person3D; phase: number }
  const clappers: Clapper[] = [];
  const NB = BACKGROUND_MEN[tier];
  for (let i = 0; i < NB; i++) {
    const kit = i % 2 === 0 ? opts.ours : opts.rivals;
    const p = person(kit);
    const a = guardRand(opts.seed, i, 31) * Math.PI * 2;
    const r = 6 + guardRand(opts.seed, i, 32) * 6;
    const x = Math.cos(a) * r, z = Math.min(OVATION.lineZ - 1.5, -1 + Math.sin(a) * r);
    p.root.position.set(x, 0, z);
    clappers.push({ p, phase: guardRand(opts.seed, i, 33) * Math.PI * 2 });
  }

  // ── Arms ──
  type Side = "L" | "R";
  const bn = (s: Side, part: "Arm" | "ForeArm" | "Hand") => (s === "R" ? "Right" : "Left") + part;
  const axesOf = (p: Person3D, s: Side): HandAxes => {
    const h = p.hand[s];
    return { along: h.along, palm: h.palm, side: new T.Vector3().crossVectors(h.along, h.palm).normalize() };
  };
  const qa = new T.Quaternion(), qb = new T.Quaternion(), qp = new T.Quaternion();
  /** One arm to a point, the hand turned `along`/`palm`, blended by w. */
  const reach = (p: Person3D, s: Side, wrist: THREE.Vector3, pole: THREE.Vector3, along: THREE.Vector3, palm: THREE.Vector3, w: number) => {
    if (w <= 0) return;
    const up = p.bones[bn(s, "Arm")], lo = p.bones[bn(s, "ForeArm")], ha = p.bones[bn(s, "Hand")];
    if (!up || !lo || !ha) return;
    solveArm(T, up, lo, ha, wrist, pole, w);
    ha.getWorldQuaternion(qa);
    qb.copy(handWorldQuat(T, axesOf(p, s), along, palm));
    qa.slerp(qb, w);
    ha.parent!.getWorldQuaternion(qp);
    ha.quaternion.copy(qp.invert().multiply(qa));
  };
  const frame = (p: Person3D) => {
    const q = p.root.quaternion;
    return {
      fwd: v3(0, 0, 1).applyQuaternion(q),
      left: v3(1, 0, 0).applyQuaternion(q),
      chest: wpos(p.bones.Spine02 ?? p.bones.Spine ?? p.bones.Hips),
      head: wpos(p.bones.Head ?? p.bones.Hips),
    };
  };
  /** Palms together, `high` above the head (you, to the fans) or at the chest. */
  const clap = (p: Person3D, time: number, ph: number, high: boolean, w: number) => {
    const f = frame(p);
    const centre = high
      ? f.head.clone().addScaledVector(UP, 0.34).addScaledVector(f.fwd, 0.14)
      : f.chest.clone().addScaledVector(f.fwd, 0.3).addScaledVector(UP, 0.02);
    const gap = 0.015 + 0.14 * (0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 2.1 + ph));
    const along = high ? UP.clone().addScaledVector(f.fwd, 0.15).normalize() : f.fwd.clone().multiplyScalar(0.75).addScaledVector(UP, 0.65).normalize();
    for (const s of ["L", "R"] as Side[]) {
      const out = s === "L" ? 1 : -1;
      const len = p.hand[s].len || 0.18;
      const wrist = centre.clone().addScaledVector(f.left, out * (gap / 2 + 0.03)).addScaledVector(along, -len * 0.55);
      const pole = high
        ? f.left.clone().multiplyScalar(out * 0.9).addScaledVector(f.fwd, 0.2)
        : f.left.clone().multiplyScalar(out * 0.7).addScaledVector(UP, -0.65).addScaledVector(f.fwd, -0.15);
      reach(p, s, wrist, pole, along, f.left.clone().multiplyScalar(-out), w);
    }
  };
  /** A hug: both arms round his back, one high and one low. */
  const hug = (a: Person3D, b: Person3D, w: number) => {
    const fa = frame(a), fb = frame(b);
    for (const s of ["L", "R"] as Side[]) {
      const out = s === "L" ? 1 : -1;
      // Round his side to his back: an arm reaches about half a metre, so
      // the hands land just behind his ribs, not in the middle of his back
      // (measured: aimed at his spine they stopped 0.23 m short, on his chest).
      const target = fb.chest.clone()
        .addScaledVector(fb.fwd, -0.12)
        .addScaledVector(fa.left, out * 0.22)
        .addScaledVector(UP, s === "L" ? 0.2 : -0.02);
      const pole = fa.left.clone().multiplyScalar(out * 0.9).addScaledVector(UP, -0.2).addScaledVector(fa.fwd, 0.15);
      reach(a, s, target, pole, fa.left.clone().multiplyScalar(-out), fb.fwd.clone(), w);
    }
  };
  /** A dap: right hands meet in the middle and shake, then he pulls you in. */
  const dap = (a: Person3D, b: Person3D, w: number, k: number, time: number) => {
    const fa = frame(a), fb = frame(b);
    const mid = fa.chest.clone().add(fb.chest).multiplyScalar(0.5).addScaledVector(UP, 0.04 + Math.sin(time * 14) * 0.025 * (k < 0.55 ? 1 : 0));
    for (const [p, f] of [[a, fa], [b, fb]] as const) {
      reach(p, "R", mid, f.left.clone().multiplyScalar(-0.7).addScaledVector(UP, -0.6), f.fwd.clone().addScaledVector(UP, 0.4).normalize(), f.left.clone(), w);
    }
    // The pull-in: his left hand on your back, yours on his.
    const pull = Math.max(0, Math.min(1, (k - 0.45) / 0.25)) * w;
    if (pull > 0) {
      for (const [p, f, other] of [[a, fa, fb], [b, fb, fa]] as const) {
        const target = other.chest.clone().addScaledVector(other.fwd, -0.1).addScaledVector(f.left, 0.2).addScaledVector(UP, 0.08);
        reach(p, "L", target, f.left.clone().multiplyScalar(0.8).addScaledVector(UP, -0.3), f.left.clone().multiplyScalar(-1), other.fwd.clone(), pull);
      }
    }
  };
  /** A pat on the shoulder: your right hand, a light tap. */
  const pat = (a: Person3D, b: Person3D, w: number, time: number) => {
    const fa = frame(a), fb = frame(b);
    const tap = Math.max(0, Math.sin(time * 9)) * 0.05;
    const target = fb.head.clone().addScaledVector(UP, -0.24 + tap).addScaledVector(fb.left, 0.17).addScaledVector(fb.fwd, -0.04);
    reach(a, "R", target, fa.left.clone().multiplyScalar(-0.8).addScaledVector(UP, -0.4), fa.fwd.clone(), UP.clone().multiplyScalar(-1), w);
  };
  /** Head (and a little neck) towards a point, sideways only. */
  const look = (p: Person3D, target: THREE.Vector3, w: number) => {
    const head = p.bones.Head;
    if (!head) return;
    const fwd = v3(0, 0, 1).applyQuaternion(p.root.quaternion);
    const to = target.clone().sub(wpos(head));
    to.y = 0;
    if (to.lengthSq() < 1e-6) return;
    to.normalize();
    const ang = Math.max(-1, Math.min(1, Math.atan2(fwd.z * to.x - fwd.x * to.z, fwd.x * to.x + fwd.z * to.z))) * w;
    if (p.bones.neck) rotateBoneWorld(T, p.bones.neck, qa.setFromAxisAngle(UP, ang * 0.4));
    rotateBoneWorld(T, head, qa.setFromAxisAngle(UP, ang * 0.6));
  };

  // ── One frame ──
  let lastStop: OvationStop | null | undefined;
  const pose = (time: number, dt: number) => {
    const at = youAt(plan, time);
    const stop = at.stop;
    if (stop !== lastStop) { lastStop = stop; opts.onStop?.(stop); }
    const w = stop ? greetWeight(stop, time) : 0;
    const k = stop ? (time - stop.from) / (stop.to - stop.from) : 0;

    // You: walking, or turned to the man who stopped you.
    you.root.position.set(0, 0, at.z);
    const turn = stop ? w : 0;
    you.root.rotation.y = stop ? stop.side * (Math.PI / 2) * turn : 0;
    const walking = at.walking ? 1 : 0;
    if (youWalk) { youWalk.setEffectiveWeight(walking); youWalk.timeScale = 0.62; }
    youIdle?.setEffectiveWeight(1 - walking);
    you.mixer.update(dt);
    settle(you);
    you.root.updateMatrixWorld(true);

    // The men waiting for you, and the sub.
    for (const g of greeters) {
      const s = g.stop;
      const mine = stop === s;
      const gw = mine ? w : 0;
      // Waiting a stride off your path, stepping in to meet you.
      // Chest to chest for a hug; a dap starts at arm's length and pulls in.
      const pullIn = s.kind === "dap" && mine ? Math.max(0, Math.min(1, (k - 0.45) / 0.25)) : 0;
      const close = s.kind === "hug" ? 0.18 : s.kind === "dap" ? 0.6 - 0.16 * pullIn : 0.55;
      const gap = 1.25 + (close - 1.25) * gw;
      let x = s.side * gap, z = s.z;
      let jogW = 0;
      if (s.sub && time > s.to) {
        // On he runs, past where you came from.
        const run = time - s.to;
        x = s.side * 1.25 + Math.min(run, 0.6) * -s.side * 1.2;
        z = s.z - run * 3.2;
        jogW = Math.min(1, run * 3);
        face(g.p, 0, -1);
      } else {
        // Facing you as you come, square on while you greet.
        face(g.p, -x, at.z - z + 0.0001);
        if (mine) face(g.p, -s.side, 0);
      }
      g.p.root.position.set(x, 0, z);
      if (g.jog) g.jog.setEffectiveWeight(jogW);
      g.p.actions.idle?.setEffectiveWeight(1 - jogW);
      g.p.mixer.update(dt);
      settle(g.p);
      g.p.root.updateMatrixWorld(true);
      const youHead = v3(0, 1.6, at.z);
      if (!mine && jogW === 0) {
        // Clapping you towards him.
        look(g.p, youHead, 0.9);
        clap(g.p, time, s.z, false, 1);
      }
    }

    // The greeting itself, arm by arm onto each other.
    if (stop) {
      const g = greeters.find((x) => x.stop === stop)!;
      look(you, wpos(g.p.bones.Head ?? g.p.root), w);
      look(g.p, wpos(you.bones.Head ?? you.root), w);
      if (stop.kind === "hug") { hug(you, g.p, w); hug(g.p, you, w); }
      else if (stop.kind === "dap") dap(you, g.p, w, k, time);
      else { pat(you, g.p, w, time); clap(g.p, time, 0, false, w); }
      // Out of the greeting, back to the fans.
      if (w < 1) clap(you, time, 0, true, 1 - w);
    } else {
      // Hands above your head to every stand in turn.
      clap(you, time, 0, true, time < OVATION.walkFrom ? Math.min(1, time / 0.6) : 1);
    }

    // Everyone else on the pitch, clapping you off.
    const youHead = v3(0, 1.6, at.z);
    for (const c of clappers) {
      c.p.root.rotation.y = Math.atan2(-c.p.root.position.x, at.z - c.p.root.position.z);
      c.p.mixer.update(dt);
      settle(c.p);
      c.p.root.updateMatrixWorld(true);
      look(c.p, youHead, 0.8);
      clap(c.p, time, c.phase, false, 1);
    }

    moveCrowd(time);

    // The camera: one slow circle round you, a little higher as it ends.
    const a = cameraAngle(plan, time);
    const R = OVATION.camRadius + (stop ? 0.5 * w : 0);
    // Never inside the stand behind the touchline: closer in, not through it.
    const cz = Math.min(at.z + Math.cos(a) * R, ring.front - 1.2);
    camera.position.set(Math.sin(a) * R, OVATION.camHeight, cz);
    camera.lookAt(0, 1.2, at.z);
  };
  const draw = () => renderer.render(scene, camera);

  let t = 0;
  let last = performance.now();
  let raf = 0;
  let frozen = false;
  let disposed = false;
  let doneFired = false;
  const minFrame = prof.fpsCap === 30 ? 1000 / 31 : 0;
  const tick = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (frozen) return;
    if (now - last < minFrame) return;
    // Real time, up to 4 frames a second, as the walk-out does.
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    t += dt;
    pose(t, dt);
    draw();
    if (!doneFired && t >= plan.end) { doneFired = true; opts.onDone?.(); }
  };

  const fit = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.62 ? 56 : 46;
    camera.updateProjectionMatrix();
  };
  fit();
  const ro = new ResizeObserver(() => { fit(); if (frozen) draw(); });
  ro.observe(container);
  pose(0, 0);
  draw();
  raf = requestAnimationFrame(tick);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if ((mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) { (mesh.material as THREE.Material).dispose(); return; }
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const mt of mats) mt.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
    debugSeek(at: number) {
      frozen = true;
      const steps = Math.max(1, Math.round(at * 20));
      t = 0;
      for (let i = 0; i < steps; i++) { t += at / steps; pose(t, at / steps); }
      draw();
    },
    debugInfo() {
      const r = (v: THREE.Vector3) => [v.x, v.y, v.z].map((x) => +x.toFixed(2));
      return {
        tier, men: greeters.length + clappers.length + 1, t: +t.toFixed(2),
        you: r(you.root.position), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      };
    },
  };
}
