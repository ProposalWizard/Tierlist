/**
 * THE BALLON D'OR NIGHT, IN 3D — the stage (STAR_ROADMAP.md #7: "your player
 * walks up, a famous player hosts and calls the winner up, the final three on
 * podiums").
 *
 * A dark theatre: a black stage with a gold edge, a wall of light strips and
 * a big gold ring behind, three podiums, the host at his lectern on the
 * right (a generic retired-great in a suit — nobody real), the audience's
 * heads in front. The three finalists walk on in their clubs' kits (you in
 * yours, with your face), the podiums rise to 1st/2nd/3rd at the reveal, the
 * golden ball lifts off its plinth and floats over the winner, his beam turns
 * gold. The words on screen are the page's (components/star/BallonDorNight.tsx);
 * confetti is the page's too.
 *
 * When everything happens: lib/star/ballonDorNight.ts (the same plan the
 * page's captions read). The same people as the farewell's guard of honour
 * (people3d.ts, the clap from signing3dRig.ts) and the same light rig: no
 * new realtime lights, the beams are see-through cones. Under the governor.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, toonHeadsFor, type Person3D, type PeopleBody, type PlayerModel,
} from "./people3d";
import { people3dLook } from "./look3d";
import { solveArm, handWorldQuat, setBoneWorldQuat, type HandAxes } from "./signing3dRig";
import { rememberGpu } from "./three3d/perf";
import { withMeshopt } from "./three3d/meshopt";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "./three3d/quality";
import { governScene } from "./three3d/governThree";
import { makeWalkClip } from "./walkClip";
import { SKIN_TONES, HAIR_COLOURS } from "./playerIdentity";
import { guardRand } from "./guardOfHonour";
import { beatAt, finalistXAt, podiumHeightAt, podiumX, PODIUM, type NightPlan, type Finalist } from "./ballonDorNight";
import type { SigningYou } from "./signing3dScene";

type Three = typeof import("three");

export interface NightKit { shirt: string; trim: string }

export interface NightSceneOptions {
  plan: NightPlan;
  /** You (when you are one of the three): skin, face, hair, kit. */
  you: SigningYou;
  /** Each finalist's kit, by rank (1..3). */
  kits: Record<number, NightKit>;
  seed: number;
  /** The night's clock, seconds (the page owns it, so the words and the stage keep time). */
  clock: () => number;
  tier?: Quality3d;
}

export interface NightSceneHandle {
  dispose(): void;
  /** Hold the stage still at t seconds (stills for checking). */
  debugSeek(t: number): void;
  debugInfo(): { tier: Quality3d; t: number; people: number; calls: number; triangles: number };
}

interface OnStage { f: Finalist; p: Person3D; walk: THREE.AnimationAction | null; phase: number }

const GOLD = 0xd4a017;

export async function createNightScene(container: HTMLElement, opts: NightSceneOptions): Promise<NightSceneHandle> {
  const T: Three = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const BODY: PeopleBody = people3dLook();
  const plan = opts.plan;

  // ── 3D quality: one tier, chosen before the renderer ──
  const tier: Quality3d = opts.tier ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const renderer = new T.WebGLRenderer({ antialias: prof.antialias, powerPreference: "high-performance" });
  rememberGpu(renderer);
  renderer.setPixelRatio(Math.min(prof.maxPixelRatio, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const scene = new T.Scene();
  const ROOM = 0x070912;
  scene.background = new T.Color(ROOM);
  scene.fog = new T.Fog(ROOM, 14, 34);
  const camera = new T.PerspectiveCamera(50, 1, 0.05, 80);

  // ── Light: the farewell's rig, warmer (no extra lights) ──
  scene.add(new T.HemisphereLight(0xc8d2ff, 0x1a1208, 0.55));
  const key = new T.DirectionalLight(0xfff0d8, 2.3);
  key.position.set(-4, 9, 7);
  key.target.position.set(0, 0.6, 0);
  if (prof.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(prof.shadowMapSize, prof.shadowMapSize);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 5, bottom: -3, near: 2, far: 25 });
    key.shadow.bias = -0.0006;
  }
  scene.add(key, key.target);
  const rim = new T.DirectionalLight(0xffd99a, 1.5);
  rim.position.set(5, 7, -6);
  scene.add(rim);
  const front = new T.DirectionalLight(0xffffff, 0.55);
  front.position.set(0, 2.5, 10);
  scene.add(front);

  // ── The room ──
  const std = (color: number, rough = 0.85, metal = 0) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const glow = (color: number, opacity = 1) => new T.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });
  const add = <O extends THREE.Object3D>(o: O): O => { scene.add(o); return o; };
  // The stage: black, a touch of shine, a gold edge.
  const stage = add(new T.Mesh(new T.BoxGeometry(14, 1.0, 5.6), std(0x0c0d12, 0.35, 0.2)));
  stage.position.set(0, -0.5, -0.3);
  stage.receiveShadow = prof.shadows;
  const goldMat = std(GOLD, 0.32, 0.85);
  goldMat.emissive = new T.Color(0x4a3000);
  const edge = add(new T.Mesh(new T.BoxGeometry(14, 0.06, 0.08), glow(0xf6c445)));
  edge.position.set(0, -0.02, 2.46);
  // The audience floor, below the stage.
  const floor = add(new T.Mesh(new T.PlaneGeometry(40, 30), std(0x0a0b10)));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1.0, 8);
  // The back wall, light strips and the gold ring.
  const wall = add(new T.Mesh(new T.PlaneGeometry(20, 9), std(0x10121c, 0.9)));
  wall.position.set(0, 3.0, -3.0);
  const stripMat = glow(0x6d86ff, 0.55);
  for (let i = -6; i <= 6; i++) {
    const s = add(new T.Mesh(new T.PlaneGeometry(0.05, 6.5), i % 3 === 0 ? glow(0xf6c445, 0.8) : stripMat));
    s.position.set(i * 0.95, 3.2, -2.97);
  }
  const ring = add(new T.Mesh(new T.TorusGeometry(1.25, 0.055, 12, 72), glow(0xf6c445)));
  ring.position.set(0, 4.1, -2.9);
  const ring2 = add(new T.Mesh(new T.TorusGeometry(1.42, 0.018, 8, 72), glow(0xfde68a, 0.7)));
  ring2.position.copy(ring.position);
  // The audience: one instanced block of heads and shoulders, low in front.
  const CROWD = tier === "low" ? 160 : tier === "medium" ? 260 : 360;
  // Dark suits and gowns: a silhouette band under the stage, never bright blocks.
  const fan = add(new T.InstancedMesh(new T.BoxGeometry(0.34, 0.44, 0.3), new T.MeshStandardMaterial({ roughness: 0.95 }), CROWD));
  const m4 = new T.Matrix4();
  const col = new T.Color();
  const suitCols = ["#07080c", "#0b0d14", "#10131c", "#151925", "#1b1410", "#0e1220", "#2a1f12"];
  for (let i = 0; i < CROWD; i++) {
    const row = Math.floor(i / 36), seat = i % 36;
    const x = -8.4 + seat * 0.48 + (row % 2) * 0.24 + (guardRand(opts.seed, i, 201) - 0.5) * 0.1;
    const z = 3.6 + row * 0.9;
    m4.makeTranslation(x, -0.55 + row * 0.22, z);
    fan.setMatrixAt(i, m4);
    fan.setColorAt(i, col.set(suitCols[Math.floor(guardRand(opts.seed, i, 202) * suitCols.length)]));
  }
  fan.instanceMatrix.needsUpdate = true;
  if (fan.instanceColor) fan.instanceColor.needsUpdate = true;

  // ── The podiums: the same height until the winner is named ──
  const podiumMat = std(0x15161d, 0.4, 0.3);
  const podiums = new Map<number, { body: THREE.Mesh; rim: THREE.Mesh; beam: THREE.Mesh; beamMat: THREE.MeshBasicMaterial }>();
  for (const f of plan.finalists) {
    const x = podiumX(f.slot);
    const body = add(new T.Mesh(new T.CylinderGeometry(0.62, 0.68, 1, 40), podiumMat));
    body.position.set(x, 0, 0);
    body.castShadow = prof.shadows;
    body.receiveShadow = prof.shadows;
    const rimM = add(new T.Mesh(new T.TorusGeometry(0.63, 0.025, 8, 48), glow(0xf6c445)));
    rimM.rotation.x = Math.PI / 2;
    rimM.position.set(x, 0, 0);
    // A see-through beam from above (no real light).
    const beamMat = new T.MeshBasicMaterial({ color: 0xbfd2ff, transparent: true, opacity: 0.0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false });
    const beam = add(new T.Mesh(new T.CylinderGeometry(0.18, 0.95, 6.2, 32, 1, true), beamMat));
    beam.position.set(x, 3.4, 0);
    podiums.set(f.rank, { body, rim: rimM, beam, beamMat });
  }

  // ── The golden ball on its plinth by the lectern ──
  const plinth = add(new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 1.05, 24), std(0x0b0b0f, 0.3, 0.4)));
  const plinthX = PODIUM.hostX - 1.05;
  plinth.position.set(plinthX, 0.525, 0.6);
  const ball = new T.Group();
  const ballMesh = new T.Mesh(new T.SphereGeometry(0.17, 40, 28), goldMat);
  const base = new T.Mesh(new T.CylinderGeometry(0.06, 0.12, 0.16, 24), std(0x0b0b0f, 0.25, 0.6));
  base.position.y = -0.22;
  ball.add(ballMesh, base);
  const halo = new T.Mesh(new T.SphereGeometry(0.25, 24, 16), new T.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ball.add(halo);
  add(ball);
  const ballRest = new T.Vector3(plinthX, 1.05 + 0.3, 0.6);

  // The lectern.
  const lectern = add(new T.Mesh(new T.BoxGeometry(0.7, 1.15, 0.45), std(0x0f1016, 0.3, 0.3)));
  lectern.position.set(PODIUM.hostX, 0.575, 0.55);
  lectern.rotation.y = -0.35;
  const lecternFace = add(new T.Mesh(new T.PlaneGeometry(0.5, 0.1), glow(0xf6c445)));
  lecternFace.position.set(PODIUM.hostX - 0.08, 0.9, 0.79);
  lecternFace.rotation.y = -0.35;

  // ── People ──
  const loader = await withMeshopt(new GLTFLoader()); // meshopt-packed files (scripts/perf3d/shrink-models.mjs)
  const youIn = plan.finalists.some((f) => f.entry.isPlayer);
  const youModel: PlayerModel = playerModelFor(opts.you.hairStyle);
  const models: PlayerModel[] = Array.from(new Set<PlayerModel>(["player", "player-buzz", "player-long", youModel]));
  const ids = plan.finalists.map((f) => (f.entry.isPlayer ? { you: true } : { who: `bdor-${f.entry.name}` }));
  const heads = toonHeadsFor(ids);
  const [anims, hostGltf, ...bodies] = await Promise.all([
    loadPeople3d(loader, "anims"),
    loadPeople3d(loader, "manager", BODY),
    ...models.map((m) => loadPeople3d(loader, m, BODY, heads)),
  ]);
  const bodyOf = (m: PlayerModel): GLTF => bodies[models.indexOf(m)];
  const outline = prof.outlines ? 0.0035 : 0;
  const outlineNear = BODY === "new" ? 1.6 : undefined;

  // The host: a retired great in a suit (seeded, nobody real), at the lectern.
  const host = makePerson3d(T, SkeletonUtils, hostGltf, anims, { outline, outlineNear, who: "bdor-host", suit: true, castShadow: prof.shadows });
  dressPerson3d(T, host, { skin: SKIN_TONES[3 % SKIN_TONES.length].hex, hair: "#2b2b2b", grey: 0.55 });
  host.root.position.set(PODIUM.hostX + 0.25, 0, 0.05);
  host.root.rotation.y = -0.55;
  scene.add(host.root);
  const hostIdle = host.actions["boss-idle"] ?? host.actions.idle ?? null;
  const hostTalk = host.actions["boss-talk"] ?? null;
  const hostWave = host.actions["boss-wave"] ?? null;
  for (const a of [hostIdle, hostTalk, hostWave]) a?.play();

  const people: OnStage[] = [];
  for (const f of plan.finalists) {
    const mine = f.entry.isPlayer;
    const model = mine ? youModel : (["player", "player-buzz", "player-long"] as PlayerModel[])[Math.floor(guardRand(opts.seed, f.rank, 1) * 3)];
    const p = makePerson3d(T, SkeletonUtils, bodyOf(model), anims, mine
      ? { outline, outlineNear, castShadow: prof.shadows, you: true }
      : { outline, outlineNear, castShadow: prof.shadows, who: `bdor-${f.entry.name}` });
    const kit = opts.kits[f.rank] ?? { shirt: "#e5e7eb", trim: "#111827" };
    if (mine) {
      dressPerson3d(T, p, {
        skin: opts.you.skin, hair: opts.you.hair, kit, number: null,
        face: opts.you.face ?? null, faceSkin: opts.you.face?.skin, accessories: opts.you.accessories,
      });
    } else {
      const k = f.rank * 7 + opts.seed;
      dressPerson3d(T, p, {
        skin: SKIN_TONES[Math.floor(guardRand(k, 2, 2) * SKIN_TONES.length)].hex,
        hair: HAIR_COLOURS[Math.floor(guardRand(k, 3, 3) * HAIR_COLOURS.length)].hex,
        kit, number: null,
      });
    }
    scene.add(p.root);
    const walk = p.actions.jog && p.actions.idle ? p.mixer.clipAction(makeWalkClip(T, p.actions.jog.getClip(), p.actions.idle.getClip())) : null;
    walk?.play();
    p.actions.idle?.play();
    p.actions.celebrate?.play();
    p.actions.wave?.play();
    people.push({ f, p, walk, phase: guardRand(opts.seed, f.rank, 9) * Math.PI * 2 });
  }
  // The clap goes on top of the idle: bones the idle does not move are put back first.
  const clipBones = new Set((anims.animations.find((c) => c.name === "idle")?.tracks ?? []).map((tr) => tr.name.split(".")[0]));
  const OWN = ["LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand"].filter((b) => !clipBones.has(b));
  const v3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const wpos = (o: THREE.Object3D) => { const v = new T.Vector3(); o.getWorldPosition(v); return v; };
  const UP = v3(0, 1, 0);
  type Side = "L" | "R";
  const bn = (s: Side, part: "Arm" | "ForeArm" | "Hand") => (s === "R" ? "Right" : "Left") + part;
  const axesOf = (p: Person3D, s: Side): HandAxes => {
    const h = p.hand[s];
    return { along: h.along, palm: h.palm, side: new T.Vector3().crossVectors(h.along, h.palm).normalize() };
  };
  /** The farewell's clap (farewell3d.ts): wrists in front of the chest, palms facing. */
  const clap = (o: OnStage, t: number, w: number) => {
    const p = o.p;
    for (const name of OWN) { const b = p.bones[name]; const r = b && p.rest.get(b); if (r) b.quaternion.copy(r[1]); }
    p.root.updateMatrixWorld(true);
    const q = p.root.quaternion;
    const fwd = v3(0, 0, 1).applyQuaternion(q);
    const left = v3(1, 0, 0).applyQuaternion(q);
    const chest = wpos(p.bones.Spine02 ?? p.bones.Spine ?? p.bones.Hips);
    const centre = chest.clone().addScaledVector(fwd, 0.3).addScaledVector(UP, 0.02);
    const gap = 0.05 + 0.13 * (0.5 + 0.5 * Math.sin(t * 2.3 * Math.PI * 2 + o.phase));
    const along = fwd.clone().multiplyScalar(0.75).addScaledVector(UP, 0.65).normalize();
    for (const s of ["L", "R"] as Side[]) {
      const out = s === "L" ? 1 : -1;
      const len = p.hand[s].len || 0.18;
      const wrist = centre.clone().addScaledVector(left, out * (gap / 2 + 0.03)).addScaledVector(along, -len * 0.55);
      const pole = left.clone().multiplyScalar(out * 0.7).addScaledVector(UP, -0.65).addScaledVector(fwd, -0.15);
      const up = p.bones[bn(s, "Arm")], lo = p.bones[bn(s, "ForeArm")], ha = p.bones[bn(s, "Hand")];
      if (!up || !lo || !ha) continue;
      solveArm(T, up, lo, ha, wrist, pole, w);
      setBoneWorldQuat(T, ha, handWorldQuat(T, axesOf(p, s), along, left.clone().multiplyScalar(-out)));
    }
  };

  // ── The camera: one framing per beat, eased from one to the next ──
  // A framing is a point to look at and the half-width that must fit across
  // the screen, so a tall phone and a wide laptop both see the same people.
  interface Frame { at: number; look: [number, number, number]; half: number; up: number; yaw?: number }
  const winner = plan.finalists[0];
  const yours = plan.finalists.find((f) => f.entry.isPlayer);
  const wx = podiumX(winner.slot);
  const frames: Frame[] = [
    { at: 0, look: [0.4, 1.7, -1], half: 4.9, up: 1.3 },
    { at: plan.hostFrom - 0.6, look: [0.8, 1.6, 0], half: 4.6, up: 1.0 },
    { at: plan.hostFrom + 0.6, look: [PODIUM.hostX - 0.2, 1.45, 0.2], half: 1.7, up: 0.35, yaw: -0.25 },
  ];
  if (plan.kind === "full") {
    for (const f of [...plan.finalists].sort((a, b) => a.walkFrom - b.walkFrom)) {
      frames.push({ at: f.walkFrom, look: [-1.8, 1.3, 0], half: 3.6, up: 0.6 });
      frames.push({ at: f.walkTo - 0.3, look: [podiumX(f.slot), 1.6, 0], half: 2.2, up: 0.5 });
    }
  } else {
    frames.push({ at: plan.finalists[0].walkFrom - 0.2, look: [-1.2, 1.3, 0], half: 4.4, up: 0.8 });
  }
  frames.push(
    { at: plan.callAt - 0.4, look: [0.9, 1.6, 0], half: 3.8, up: 0.8 },
    { at: plan.callAt + 0.5, look: [PODIUM.hostX - 0.1, 1.5, 0.2], half: 1.3, up: 0.25, yaw: -0.3 },
    { at: plan.pauseAt, look: [0, 1.45, 0], half: 2.9, up: 0.5 },
    { at: plan.revealAt - 0.1, look: [0, 1.5, 0], half: 2.5, up: 0.45 },
    // Looking a little below his middle puts him high on the screen, clear of the words.
    { at: plan.revealAt + 0.6, look: [wx, 1.6, 0], half: 1.6, up: 0.3 },
  );
  if (yours && yours !== winner) {
    // Held on the winner first; onto you as your place is said.
    frames.push({ at: plan.yourPlaceAt + 0.8, look: [podiumX(yours.slot), 1.25, 0], half: 1.5, up: 0.3 });
  }
  frames.push({ at: plan.end - 1.4, look: [0, 2.0, 0], half: 3.4, up: 0.8 });
  frames.sort((a, b) => a.at - b.at);
  const vfov = () => camera.fov * Math.PI / 180;
  // Hold each framing until the next one's time, easing into it over the last 1.3 s.
  const placeCam = (t: number) => {
    let i = 0;
    while (i < frames.length - 1 && frames[i + 1].at <= t) i++;
    const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
    const span = Math.max(0.001, b.at - a.at);
    const k0 = a === b ? 0 : Math.max(0, Math.min(1, 1 - (b.at - t) / Math.min(1.3, span)));
    const k = k0 * k0 * (3 - 2 * k0);
    const lerp = (u: number, v: number) => u + (v - u) * k;
    const look = [lerp(a.look[0], b.look[0]), lerp(a.look[1], b.look[1]), lerp(a.look[2], b.look[2])];
    // A slow drift in while a framing holds.
    const half = lerp(a.half, b.half) * (1 - 0.04 * Math.min(1, Math.max(0, t - a.at) / span));
    const up = lerp(a.up, b.up);
    const yaw = lerp(a.yaw ?? 0, b.yaw ?? 0);
    const hfov = 2 * Math.atan(Math.tan(vfov() / 2) * camera.aspect);
    const d = half / Math.tan(hfov / 2);
    camera.position.set(look[0] + Math.sin(yaw) * d, look[1] + up, look[2] + Math.cos(yaw) * d);
    camera.lookAt(look[0], look[1], look[2]);
  };

  // ── One moment of the night ──
  const pose = (t: number, dt: number) => {
    const beat = beatAt(plan, t);
    const revealed = t >= plan.revealAt;
    // The host: talking while he calls names and at the call, a wave at the reveal.
    const talking = beat === "host" || beat === "call" || (plan.kind === "full" && beat === "walk");
    const waving = revealed && t < plan.revealAt + 2.2;
    hostWave?.setEffectiveWeight(waving ? 1 : 0);
    hostTalk?.setEffectiveWeight(!waving && talking ? 1 : 0);
    hostIdle?.setEffectiveWeight(!waving && !talking ? 1 : hostTalk || waving ? 0 : 1);
    host.mixer.update(dt);

    // The podiums.
    for (const f of plan.finalists) {
      const pd = podiums.get(f.rank)!;
      const h = podiumHeightAt(plan, f.rank, t);
      pd.body.scale.y = h;
      pd.body.position.y = h / 2;
      pd.rim.position.y = h + 0.005;
      // The beams: up as he stands there; at the reveal the winner's goes gold, the others dim.
      const on = finalistXAt(f, t).on ? 1 : 0;
      const isWin = f.rank === 1;
      const rk = Math.max(0, Math.min(1, (t - plan.revealAt) / 0.6));
      pd.beamMat.color.set(isWin && revealed ? 0xffd36b : 0xbfd2ff);
      pd.beamMat.opacity = on * (revealed ? (isWin ? 0.09 + 0.06 * rk : 0.08 * (1 - 0.6 * rk)) : 0.08);
    }

    // The three.
    for (const o of people) {
      const { f, p } = o;
      const at = finalistXAt(f, t);
      p.root.visible = at.seen;
      const h = podiumHeightAt(plan, f.rank, t);
      // Up onto the podium over the last part of the walk.
      const k = Math.max(0, Math.min(1, (t - (f.walkTo - 0.45)) / 0.45));
      p.root.position.set(at.x, at.on ? h : h * k * k, f.slot === 0 ? -0.02 : 0);
      // Walking towards +x (rest faces +z), then turning to the room.
      const turn = Math.max(0, Math.min(1, (t - f.walkTo + 0.3) / 0.6));
      p.root.rotation.y = (Math.PI / 2) * (1 - turn) + (f.slot === -1 ? 0.12 : f.slot === 1 ? -0.12 : 0) * turn;
      const walking = at.walking ? 1 : 0;
      const winning = revealed && f.rank === 1;
      const celebrate = winning ? Math.min(1, (t - plan.revealAt) / 0.4) : 0;
      if (o.walk) { o.walk.setEffectiveWeight(walking * (1 - celebrate)); o.walk.timeScale = 1.05; }
      p.actions.celebrate?.setEffectiveWeight(celebrate);
      p.actions.wave?.setEffectiveWeight(0);
      p.actions.idle?.setEffectiveWeight(Math.max(0, 1 - walking - celebrate));
      p.mixer.update(dt);
      p.root.updateMatrixWorld(true);
      // The other two clap the winner.
      if (revealed && f.rank !== 1) clap(o, t, Math.min(1, (t - plan.revealAt - 0.4) / 0.5));
    }

    // The golden ball: on its plinth; at the reveal it lifts and floats over the winner.
    // (A fixed height over his podium: following his head would bounce it with the celebration.)
    const lift = Math.max(0, Math.min(1, (t - plan.revealAt - 0.2) / 1.6));
    const e = lift * lift * (3 - 2 * lift);
    const over = v3(wx, podiumHeightAt(plan, 1, t) + 2.3, 0.15);
    ball.position.copy(ballRest).lerp(over, e);
    ball.position.y += Math.sin(e * Math.PI) * 0.6 + (e >= 1 ? Math.sin(t * 2.2) * 0.04 : 0);
    ball.rotation.y = t * (0.6 + 1.6 * e);
    base.visible = e < 0.5;
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.04 + 0.16 * e;
    halo.scale.setScalar(1 + 0.15 * Math.sin(t * 3));
    goldMat.emissive.setRGB(0.29 + 0.35 * e, 0.19 + 0.22 * e, 0);
    // The ring behind breathes, brighter at the reveal.
    (ring.material as THREE.MeshBasicMaterial).color.setScalar(1).multiply(col.set(0xf6c445)).multiplyScalar(revealed ? 1.25 : 0.85 + 0.1 * Math.sin(t * 1.5));
    placeCam(t);
  };

  const governed = governScene(T, { name: "ballon d'or night", start: tier, renderer, scene, camera, lights: [key], basePR: renderer.getPixelRatio() });
  const draw = () => renderer.render(scene, camera);
  let raf = 0;
  let disposed = false;
  let frozen = false;
  let lastT = 0;
  let lastNow = performance.now();
  const minFrame = prof.fpsCap === 30 ? 1000 / 31 : 0;
  const tick = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (frozen || now - lastNow < minFrame) return;
    lastNow = now;
    const t = opts.clock();
    const dt = Math.max(0, Math.min(0.25, t - lastT));
    lastT = t;
    pose(t, dt);
    governed.frame(now);
    draw();
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
      governed.dispose();
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
      const steps = Math.max(1, Math.round(at * 15));
      let t = 0;
      for (let i = 0; i < steps; i++) { t += at / steps; pose(t, at / steps); }
      lastT = at;
      draw();
    },
    debugInfo() {
      return { tier, t: +lastT.toFixed(2), people: people.length + 1, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
  };
}
