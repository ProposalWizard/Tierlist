/**
 * THE GUARD OF HONOUR, IN 3D — the walk-out before the farewell match.
 *
 * Leo, 6 Oct 2026 (the plans page): "both teams in two lines clapping. Built
 * in 3D with the one-body people". The same people as the 3D signing and the
 * shop (people3d.ts): Your XI in your club's kit on one side, the Rivals XI in
 * black and gold on the other, every man clapping (his arms set by the same
 * reach-for-a-point solver the signing uses, signing3dRig.ts), his head
 * turning to follow you. You walk out between them towards the camera, stop
 * past the last pair and wave.
 *
 * Where everyone stands and when things happen: lib/star/guardOfHonour.ts.
 * The screen around it (and the drawn fallback for a phone that can't run
 * 3D): components/star/GuardOfHonour.tsx.
 *
 * Kept light (Harry, 5 Oct: "the less lag is BIG"): the line length and the
 * number of men who move follow the phone's 3D quality; the far ones stand
 * still with no outline; one instanced crowd; 30 frames a second on Low.
 * Pure three.js: the shirt number is painted by signing3dTextures.ts.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, toonHeadsFor, type Person3D, type PeopleBody, type PlayerModel,
} from "./people3d";
import { people3dLook } from "./look3d";
import { solveArm, handWorldQuat, setBoneWorldQuat, rotateBoneWorld, type HandAxes } from "./signing3dRig";
import { rememberGpu } from "./three3d/perf";
import { withMeshopt } from "./three3d/meshopt";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "./three3d/quality";
import { makeWalkClip } from "./walkClip";
import { SKIN_TONES, HAIR_COLOURS } from "./playerIdentity";
import { GUARD, OUTLINED, lineLength, clappers, lineZ, startZ, youZAt, youSpeedAt, clapGap, waveWeight, guardRand } from "./guardOfHonour";
import type { SigningYou } from "./signing3dScene";

type Three = typeof import("three");

export interface GuardKit { shirt: string; trim: string }

export interface GuardSceneOptions {
  /** You: skin, face, hair, kit, accessories (the 3D signing's shape). */
  you: SigningYou;
  /** Your XI's kit (your last club's) and the Rivals XI's. */
  ours: GuardKit;
  rivals: GuardKit;
  /** Keeps every man's look and clap the same each time. */
  seed: number;
  /** Fired once, when the walk and the wave are over. */
  onDone?: () => void;
  /** Force a quality (the test page); else the phone's own. */
  tier?: Quality3d;
}

export interface GuardSceneHandle {
  dispose(): void;
  /** Hold the scene still at t seconds (stills for checking). */
  debugSeek(t: number): void;
  /** What is drawn, for a check by numbers. */
  debugInfo(): { tier: Quality3d; men: number; moving: number; t: number; you: number[]; calls: number; triangles: number };
}

interface Man {
  p: Person3D;
  side: 1 | -1;
  /** He claps (the rest stand still). */
  live: boolean;
  phase: number;
}

export async function createGuardScene(container: HTMLElement, opts: GuardSceneOptions): Promise<GuardSceneHandle> {
  const T: Three = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");

  const BODY: PeopleBody = people3dLook();

  // ── 3D quality (Settings → Look → "3D quality"): one tier, chosen before
  // the renderer, the same as every other 3D scene.
  const tier: Quality3d = opts.tier ?? quality3dTier();
  const prof = TIER_PROFILES[tier];

  // ── Renderer ──
  const renderer = new T.WebGLRenderer({ antialias: prof.antialias, powerPreference: "high-performance" });
  rememberGpu(renderer);
  renderer.setPixelRatio(Math.min(prof.maxPixelRatio, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
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
  scene.fog = new T.Fog(NIGHT, 26, 70);
  const camera = new T.PerspectiveCamera(55, 1, 0.05, 120);

  // ── Light: four floodlights and the sky ──
  scene.add(new T.HemisphereLight(0xc9dcff, 0x1d4524, 0.75));
  const key = new T.DirectionalLight(0xfff6e6, 2.4);
  key.position.set(-9, 16, 8);
  key.target.position.set(0, 0, -3);
  if (prof.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(prof.shadowMapSize, prof.shadowMapSize);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 8, bottom: -14, near: 2, far: 40 });
    key.shadow.bias = -0.0006;
  }
  scene.add(key, key.target);
  const rim = new T.DirectionalLight(0xdfe9ff, 1.4);
  rim.position.set(10, 14, -16);
  scene.add(rim);
  const front = new T.DirectionalLight(0xffffff, 0.7);
  front.position.set(0, 3, 12);
  scene.add(front);

  // ── The ground ──
  const std = (color: number, rough = 0.9) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
  const owned: THREE.Object3D[] = [];
  const add = <O extends THREE.Object3D>(o: O): O => { scene.add(o); owned.push(o); return o; };
  const grass = add(new T.Mesh(new T.PlaneGeometry(90, 120), std(0x2e7a3c)));
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = prof.shadows;
  // Mown stripes, across the path.
  const stripeMat = std(0x358a45);
  for (let i = -6; i < 6; i++) {
    const s = add(new T.Mesh(new T.PlaneGeometry(90, 5), stripeMat));
    s.rotation.x = -Math.PI / 2;
    s.position.set(0, 0.003, i * 10 + 2.5);
    s.receiveShadow = prof.shadows;
  }
  // The touchline you walk over, and the halfway line beyond.
  const chalk = new T.MeshBasicMaterial({ color: 0xf2f5f0 });
  for (const z of [2.6]) {
    const l = add(new T.Mesh(new T.PlaneGeometry(60, 0.12), chalk));
    l.rotation.x = -Math.PI / 2;
    l.position.set(0, 0.006, z);
  }
  const touch = add(new T.Mesh(new T.PlaneGeometry(0.12, 60), chalk));
  touch.rotation.x = -Math.PI / 2;
  touch.position.set(-7.5, 0.006, -20);

  // ── The stands and the crowd ──
  const stand = std(0x1a2233, 0.95);
  const tiers = (axis: "x" | "z", sign: 1 | -1, near: number) => {
    for (let k = 0; k < 5; k++) {
      const w = 70, d = 2.4, h = 1.1 + k * 1.1;
      const b = add(new T.Mesh(new T.BoxGeometry(axis === "x" ? d : w, h, axis === "x" ? w : d), stand));
      const off = near + k * d;
      if (axis === "x") b.position.set(sign * off, h / 2, -12);
      else b.position.set(0, h / 2, sign * off);
    }
  };
  tiers("x", -1, 12);
  tiers("x", 1, 12);
  tiers("z", -1, 24);
  // One instanced crowd: a head-and-shoulders block in a shirt colour.
  const CROWD = tier === "low" ? 1100 : tier === "medium" ? 1800 : 2600;
  const fanGeo = new T.BoxGeometry(0.5, 0.62, 0.4);
  const fanMat = new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  const crowd = add(new T.InstancedMesh(fanGeo, fanMat, CROWD));
  const palette = [opts.ours.shirt, opts.ours.trim, opts.rivals.shirt, opts.rivals.trim, "#e5e7eb", "#1f2937", "#9ca3af", opts.ours.shirt];
  const m4 = new T.Matrix4();
  const col = new T.Color();
  for (let i = 0; i < CROWD; i++) {
    const r1 = guardRand(opts.seed, i, 101), r2 = guardRand(opts.seed, i, 102), r3 = guardRand(opts.seed, i, 103);
    const k = Math.floor(r1 * 5);
    // Most of them in the stand behind the tunnel, which the camera faces.
    const where = r3 < 0.2 ? 0 : r3 < 0.4 ? 1 : 2;
    const along = where === 2 ? (r2 - 0.5) * 50 : -30 + r2 * 34;
    const off = (where < 2 ? 12 : 24) + k * 2.4 + 0.6;
    const y = 1.1 + k * 1.1 + 0.28;
    if (where === 0) m4.makeTranslation(-off, y, along);
    else if (where === 1) m4.makeTranslation(off, y, along);
    else m4.makeTranslation(along, y, -off);
    crowd.setMatrixAt(i, m4);
    crowd.setColorAt(i, col.set(palette[Math.floor(guardRand(opts.seed, i, 104) * palette.length)]));
  }
  crowd.instanceMatrix.needsUpdate = true;
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  // Lit advertising boards round the pitch, in both sides' colours.
  const boardA = new T.MeshBasicMaterial({ color: new T.Color(opts.ours.shirt), toneMapped: false });
  const boardB = new T.MeshBasicMaterial({ color: new T.Color(opts.rivals.trim), toneMapped: false });
  for (let k = 0; k < 10; k++) {
    const b = add(new T.Mesh(new T.BoxGeometry(5.6, 0.8, 0.12), k % 2 ? boardB : boardA));
    b.position.set(-25 + k * 5.7, 0.4, -20.5);
  }
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const b = add(new T.Mesh(new T.BoxGeometry(0.12, 0.8, 5.6), (k + (sx > 0 ? 1 : 0)) % 2 ? boardB : boardA));
      b.position.set(sx * 9.5, 0.4, -18 + k * 5.7);
    }
  }
  // Floodlight towers: a mast and a lit panel at each corner.
  const lamp = new T.MeshBasicMaterial({ color: 0xfffbea, toneMapped: false });
  const mast = std(0x2a3346, 0.6);
  for (const [x, z] of [[-17, 6], [17, 6], [-17, -34], [17, -34]] as const) {
    const m = add(new T.Mesh(new T.BoxGeometry(0.5, 22, 0.5), mast));
    m.position.set(x, 11, z);
    const p = add(new T.Mesh(new T.BoxGeometry(3.4, 1.8, 0.3), lamp));
    p.position.set(x, 22.5, z);
    p.lookAt(0, 0, -6);
  }

  // ── The tunnel you come out of ──
  const n = lineLength(tier);
  const z0 = startZ(n);
  const tunnelZ = z0 - 1.6;
  const brick = std(0x2b2f3a, 0.8);
  for (const s of [-1, 1]) {
    const pillar = add(new T.Mesh(new T.BoxGeometry(0.5, 2.9, 0.6), brick));
    pillar.position.set(s * 1.25, 1.45, tunnelZ);
  }
  const lintel = add(new T.Mesh(new T.BoxGeometry(3.0, 0.5, 0.6), brick));
  lintel.position.set(0, 3.1, tunnelZ);
  const mouth = add(new T.Mesh(new T.PlaneGeometry(2.0, 2.9), new T.MeshBasicMaterial({ color: 0x06080d })));
  mouth.position.set(0, 1.45, tunnelZ - 0.25);

  // ── People ──
  const loader = await withMeshopt(new GLTFLoader()); // the files are meshopt-packed (scripts/perf3d/shrink-models.mjs)
  const youModel: PlayerModel = playerModelFor(opts.you.hairStyle);
  const models: PlayerModel[] = ["player", "player-buzz", "player-long"];
  // only the heads of the men in the two lines (one id a man, in order) and yours: no suits
  const heads = toonHeadsFor([{ you: true }, ...Array.from({ length: 2 * n }, (_, k) => ({ who: `farewell-${opts.seed}-${k}` }))]);
  const [anims, ...bodies] = await Promise.all([
    loadPeople3d(loader, "anims"),
    ...models.map((m) => loadPeople3d(loader, m, BODY, heads)),
  ]);
  const bodyOf = (m: PlayerModel): GLTF => bodies[models.indexOf(m)];

  const v3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const wpos = (o: THREE.Object3D) => { const v = new T.Vector3(); o.getWorldPosition(v); return v; };
  const UP = v3(0, 1, 0);

  const men: Man[] = [];
  const LIVE = clappers(tier);
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < n; i++) {
      const k = men.length;
      const model = models[Math.floor(guardRand(opts.seed, k, 1) * models.length)];
      const live = i < LIVE;
      const p = makePerson3d(T, SkeletonUtils, bodyOf(model), anims, {
        who: `farewell-${opts.seed}-${k}`,
        outline: prof.outlines && i < OUTLINED ? 0.0035 : 0, castShadow: prof.shadows && i < OUTLINED, outlineNear: BODY === "new" ? 1.6 : undefined,
      });
      // Your XI on your left as you walk out (the camera's right), the Rivals XI opposite.
      const ours = side === 1;
      const kit = ours ? opts.ours : opts.rivals;
      dressPerson3d(T, p, {
        skin: SKIN_TONES[Math.floor(guardRand(opts.seed, k, 2) * SKIN_TONES.length)].hex,
        hair: HAIR_COLOURS[Math.floor(guardRand(opts.seed, k, 3) * HAIR_COLOURS.length)].hex,
        kit,
      });
      p.root.position.set(side * GUARD.gapX, 0, lineZ(i) + (guardRand(opts.seed, k, 4) - 0.5) * 0.12);
      // Facing the middle of the path: rest facing is +z; the man on +x faces -x.
      p.root.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(p.root);
      p.root.updateMatrixWorld(true);
      const idle = p.actions.idle;
      if (idle) {
        idle.setEffectiveWeight(1);
        idle.time = guardRand(opts.seed, k, 5) * idle.getClip().duration;
      }
      p.mixer.update(0);
      p.root.updateMatrixWorld(true);
      men.push({ p, side, live, phase: guardRand(opts.seed, k, 6) * Math.PI * 2 });
    }
  }
  // Bones the idle clip does not move are put back each frame before the
  // clap and the head turn go on top, so nothing adds up frame on frame.
  const clipBones = new Set((anims.animations.find((c) => c.name === "idle")?.tracks ?? []).map((tr) => tr.name.split(".")[0]));
  const OWN = ["neck", "Head", "LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand"].filter((b) => !clipBones.has(b));
  const settle = (p: Person3D) => {
    for (const name of OWN) {
      const b = p.bones[name];
      const r = b && p.rest.get(b);
      if (r) b.quaternion.copy(r[1]);
    }
  };

  // You.
  const you = makePerson3d(T, SkeletonUtils, bodyOf(youModel), anims, { outline: prof.outlines ? 0.0035 : 0, castShadow: prof.shadows, outlineNear: BODY === "new" ? 1.6 : undefined, you: true });
  dressPerson3d(T, you, {
    skin: opts.you.skin, hair: opts.you.hair, kit: opts.you.kit, number: null,
    face: opts.you.face ?? null, faceSkin: opts.you.face?.skin, accessories: opts.you.accessories,
  });
  you.root.position.set(0, 0, z0);
  scene.add(you.root);
  const walkA = you.actions.jog && you.actions.idle
    ? you.mixer.clipAction(makeWalkClip(T, you.actions.jog.getClip(), you.actions.idle.getClip()))
    : null;
  walkA?.play();
  const waveA = you.actions.wave ?? you.actions.celebrate ?? null;
  const youIdle = you.actions.idle ?? null;

  // ── Posing ──
  type Side = "L" | "R";
  const bn = (s: Side, part: "Arm" | "ForeArm" | "Hand") => (s === "R" ? "Right" : "Left") + part;
  const axesOf = (p: Person3D, s: Side): HandAxes => {
    const h = p.hand[s];
    return { along: h.along, palm: h.palm, side: new T.Vector3().crossVectors(h.along, h.palm).normalize() };
  };
  const tmpQ = new T.Quaternion();
  /** A clap: both wrists in front of the chest, palms facing, `gap` apart. */
  const clap = (m: Man, t: number) => {
    const p = m.p;
    const q = p.root.quaternion;
    const fwd = v3(0, 0, 1).applyQuaternion(q);
    const left = v3(1, 0, 0).applyQuaternion(q);
    const chest = wpos(p.bones.Spine02 ?? p.bones.Spine ?? p.bones.Hips);
    const centre = chest.clone().addScaledVector(fwd, 0.3).addScaledVector(UP, 0.02);
    const gap = clapGap(t, m.phase);
    const along = fwd.clone().multiplyScalar(0.75).addScaledVector(UP, 0.65).normalize();
    for (const s of ["L", "R"] as Side[]) {
      const out = s === "L" ? 1 : -1;
      // The wrist sits a hand's width back from where the palms meet.
      const len = p.hand[s].len || 0.18;
      const wrist = centre.clone()
        .addScaledVector(left, out * (gap / 2 + 0.03))
        .addScaledVector(along, -len * 0.55);
      const pole = left.clone().multiplyScalar(out * 0.7).addScaledVector(UP, -0.65).addScaledVector(fwd, -0.15);
      const up = p.bones[bn(s, "Arm")], lo = p.bones[bn(s, "ForeArm")], ha = p.bones[bn(s, "Hand")];
      if (!up || !lo || !ha) continue;
      solveArm(T, up, lo, ha, wrist, pole, 1);
      // Palm towards the other hand.
      const palm = left.clone().multiplyScalar(-out);
      setBoneWorldQuat(T, ha, handWorldQuat(T, axesOf(p, s), along, palm));
    }
  };
  /** Turn his head (and a little of his neck) towards a point, sideways only. */
  const follow = (m: Man, target: THREE.Vector3, w: number) => {
    const p = m.p;
    const head = p.bones.Head;
    if (!head) return;
    const fwd = v3(0, 0, 1).applyQuaternion(p.root.quaternion);
    const to = target.clone().sub(wpos(head));
    to.y = 0;
    if (to.lengthSq() < 1e-6) return;
    to.normalize();
    const ang = Math.max(-1.05, Math.min(1.05, Math.atan2(fwd.z * to.x - fwd.x * to.z, fwd.x * to.x + fwd.z * to.z))) * w;
    if (p.bones.neck) rotateBoneWorld(T, p.bones.neck, tmpQ.setFromAxisAngle(UP, ang * 0.4));
    rotateBoneWorld(T, head, tmpQ.setFromAxisAngle(UP, ang * 0.6));
  };

  // ── The camera: down the path, backing off as you come; then on you ──
  const camAt = (t: number) => {
    const yz = youZAt(t, n);
    const k = Math.max(0, Math.min(1, (t - GUARD.walkFrom) / (GUARD.walkTo - GUARD.walkFrom)));
    const e = k * k * (3 - 2 * k);
    const pos = v3(0, 1.5 - 0.05 * e, 5.4 - 1.5 * e);
    const look = v3(0, 1.3 + 0.05 * e, Math.max(yz - 2.6 + 1.6 * e, z0 - 2));
    return { pos, look };
  };

  // ── One frame ──
  let t = 0;
  let last = performance.now();
  let raf = 0;
  let frozen = false;
  let disposed = false;
  let doneFired = false;
  const minFrame = prof.fpsCap === 30 ? 1000 / 31 : 0;
  const pose = (time: number, dt: number) => {
    const youPos = v3(0, 1.55, youZAt(time, n));
    // The men: their idle, then the clap and the head turn on top.
    for (const m of men) {
      // A still man holds the one clap he was given at the start.
      if (!m.live && time > 0) continue;
      m.p.mixer.update(dt);
      settle(m.p);
      m.p.root.updateMatrixWorld(true);
      follow(m, youPos, 0.85);
      clap(m, m.live ? time : 0.12);
    }
    // You: walking, then the wave.
    const speed = youSpeedAt(time, n);
    const ww = waveWeight(time);
    const walking = Math.min(1, speed / 0.45) * (1 - ww);
    if (walkA) { walkA.setEffectiveWeight(walking); walkA.timeScale = Math.max(0.5, speed / 1.7); }
    if (youIdle) youIdle.setEffectiveWeight(Math.max(0, 1 - walking - ww));
    if (waveA) waveA.setEffectiveWeight(ww);
    you.mixer.update(dt);
    you.root.position.z = youZAt(time, n);
    you.root.updateMatrixWorld(true);
    const c = camAt(time);
    camera.position.copy(c.pos);
    camera.lookAt(c.look);
  };
  const draw = () => renderer.render(scene, camera);
  const tick = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (frozen) return;
    if (now - last < minFrame) return;
    // Real time, up to 4 frames a second: a playtest at 5-10 frames a second
    // saw the 10-second walk-out take 40 to 80 seconds with a 0.05 s cap.
    // The cap still stops a jump after the phone wakes from a locked screen.
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    t += dt;
    pose(t, dt);
    draw();
    if (!doneFired && t >= GUARD.end) { doneFired = true; opts.onDone?.(); }
  };

  const fit = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // A tall phone sees less across: widen the view so both lines stay in.
    camera.fov = w / h < 0.62 ? 52 : 46;
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
        // The bodies' geometry is shared with the page's cache: only their materials go.
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
      // Step there so the clips and the claps are where they would be.
      const steps = Math.max(1, Math.round(at * 20));
      t = 0;
      for (let i = 0; i < steps; i++) { t += at / steps; pose(t, at / steps); }
      draw();
    },
    debugInfo() {
      const r = (v: THREE.Vector3) => [v.x, v.y, v.z].map((x) => +x.toFixed(2));
      return {
        tier, men: men.length, moving: men.filter((m) => m.live).length, t: +t.toFixed(2),
        you: r(you.root.position), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      };
    },
  };
}
