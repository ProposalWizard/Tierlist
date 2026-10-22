/**
 * THE SEASON AWARDS NIGHT, IN 3D — the room (Leo's tonight plan, part 13a:
 * "a smaller hall, the same system" as the Ballon d'Or night).
 *
 * A club function room, not the Ballon d'Or's gold arena: a low carpeted
 * stage with steps at the front left, one wooden lectern, a big screen on the
 * back wall showing the award, red curtains at the sides, round tables with
 * white cloths and little lamps in the dark in front, guests round them,
 * strings of warm bulbs overhead. The host calls each award; the winner walks
 * up from his table in his club's kit (you in yours, with your face), up the
 * steps, takes the trophy from its table and lifts it.
 *
 * When everything happens: lib/star/awardsNight.ts (the same plan the page's
 * words read). The same people, walk and lights as the Ballon d'Or night
 * (people3d.ts, walkClip.ts, signing3dRig.ts; the same four-light rig, no new
 * realtime lights: the lamps and bulbs are glowing shapes). Under the governor.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, toonHeadsFor, type Person3D, type PeopleBody, type PlayerModel,
} from "./people3d";
import { people3dLook } from "./look3d";
import { solveArm } from "./signing3dRig";
import { rememberGpu } from "./three3d/perf";
import { loadCrestTexture } from "./crestTexture";
import { withMeshopt } from "./three3d/meshopt";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "./three3d/quality";
import { governScene } from "./three3d/governThree";
import { makeWalkClip } from "./walkClip";
import { SKIN_TONES, HAIR_COLOURS } from "./playerIdentity";
import { guardRand } from "./guardOfHonour";
import { awardAt, beatAt, winnerPosAt, trophyLiftAt, ROOM, type AwardsPlan, type AwardCall } from "./awardsNight";
import { makeScreenTexture } from "./awardsNightScreen";
import type { SigningYou } from "./signing3dScene";

type Three = typeof import("three");

export interface AwardsKit { shirt: string; trim: string }

export interface AwardsSceneOptions {
  plan: AwardsPlan;
  /** You: skin, face, hair, kit (used when you win anything). */
  you: SigningYou;
  /** Each winner's kit, by personId (awardsNight.ts). */
  kits: Record<string, AwardsKit>;
  /** Each winner's crest picture, by personId (a crest that fails leaves the shield). */
  crests?: Record<string, string>;
  seed: number;
  /** The night's clock, seconds (the page owns it, so the words and the room keep time). */
  clock: () => number;
  tier?: Quality3d;
}

export interface AwardsSceneHandle {
  dispose(): void;
  /** Hold the room still at t seconds (stills for checking). */
  debugSeek(t: number): void;
  debugInfo(): { tier: Quality3d; t: number; people: number; calls: number; triangles: number };
}

interface Walker { id: string; p: Person3D; walk: THREE.AnimationAction | null; cheered: boolean }

export async function createAwardsScene(container: HTMLElement, opts: AwardsSceneOptions): Promise<AwardsSceneHandle> {
  const T: Three = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const BODY: PeopleBody = people3dLook();
  const plan = opts.plan;
  const H = ROOM.stageH;

  // ── 3D quality: one tier, chosen before the renderer ──
  const tier: Quality3d = opts.tier ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
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
  const DARK = 0x120a07;
  scene.background = new T.Color(DARK);
  scene.fog = new T.Fog(DARK, 12, 26);
  const camera = new T.PerspectiveCamera(50, 1, 0.05, 60);

  // ── Light: the Ballon d'Or night's four, warmer (no extra lights) ──
  scene.add(new T.HemisphereLight(0xffe0bd, 0x2a1408, 0.6));
  const key = new T.DirectionalLight(0xffd9a8, 2.2);
  key.position.set(-3.5, 8, 7);
  key.target.position.set(0, 0.8, 0);
  if (prof.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(prof.shadowMapSize, prof.shadowMapSize);
    Object.assign(key.shadow.camera, { left: -6, right: 6, top: 5, bottom: -4, near: 2, far: 25 });
    key.shadow.bias = -0.0006;
  }
  scene.add(key, key.target);
  const rim = new T.DirectionalLight(0xffb070, 1.3);
  rim.position.set(4, 6, -5);
  scene.add(rim);
  const front = new T.DirectionalLight(0xfff2e0, 0.5);
  front.position.set(0, 2.5, 10);
  scene.add(front);

  // ── The room ──
  const std = (color: number, rough = 0.85, metal = 0) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const glow = (color: number, opacity = 1) => new T.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });
  const add = <O extends THREE.Object3D>(o: O): O => { scene.add(o); return o; };
  const shade = (m: THREE.Mesh, cast = true) => { m.castShadow = prof.shadows && cast; m.receiveShadow = prof.shadows; return m; };
  // The floor: dark wood.
  const floor = add(new T.Mesh(new T.PlaneGeometry(24, 20), std(0x2a1a10, 0.75)));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 4);
  shade(floor, false);
  // The stage: low, a deep red carpet on top, a warm glowing strip along its front.
  const STAGE_BACK = -1.85;
  const stageDepth = ROOM.stageFront - STAGE_BACK;
  const stage = add(new T.Mesh(new T.BoxGeometry(7.2, H, stageDepth), std(0x1c120c, 0.6)));
  stage.position.set(0, H / 2, STAGE_BACK + stageDepth / 2);
  shade(stage, false);
  const carpet = add(new T.Mesh(new T.PlaneGeometry(7.1, stageDepth - 0.04), std(0x5a1418, 0.95)));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, H + 0.004, stage.position.z);
  shade(carpet, false);
  const edge = add(new T.Mesh(new T.BoxGeometry(7.2, 0.035, 0.03), glow(0xffc46b)));
  edge.position.set(0, H - 0.03, ROOM.stageFront + 0.016);
  // The steps (two treads) at the front left, where the winner comes up.
  const tread = std(0x3a2416, 0.7);
  for (const [h, z0, z1] of [[H / 3, ROOM.stepFoot.z - 0.5, ROOM.stepFoot.z], [(2 * H) / 3, ROOM.stageFront, ROOM.stepFoot.z - 0.5]] as const) {
    const st = add(new T.Mesh(new T.BoxGeometry(1.1, h, z1 - z0), tread));
    st.position.set(ROOM.stepFoot.x, h / 2, (z0 + z1) / 2);
    shade(st, false);
  }
  // The back wall: warm wood with slim lit slats, and the screen.
  const wall = add(new T.Mesh(new T.PlaneGeometry(16, 7), std(0x2b1a12, 0.9)));
  wall.position.set(0, 3.2, STAGE_BACK - 0.02);
  for (let i = -7; i <= 7; i++) {
    if (Math.abs(i) <= 2) continue; // the screen's place
    const s = add(new T.Mesh(new T.PlaneGeometry(0.04, 4.2), glow(0xffb45a, 0.35)));
    s.position.set(i * 0.62, 2.6, STAGE_BACK);
  }
  const screenWords = makeScreenTexture(T);
  const SCREEN_W = 3.3, SCREEN_H = SCREEN_W * 576 / 1024;
  const screen = add(new T.Mesh(new T.PlaneGeometry(SCREEN_W, SCREEN_H), new T.MeshBasicMaterial({ map: screenWords.texture, toneMapped: false })));
  const SCREEN_Y = 2.55;
  screen.position.set(0, SCREEN_Y, STAGE_BACK + 0.01);
  const frame = add(new T.Mesh(new T.PlaneGeometry(SCREEN_W + 0.12, SCREEN_H + 0.12), std(0x0b0806, 0.4, 0.3)));
  frame.position.set(0, SCREEN_Y, STAGE_BACK + 0.005);
  // Red curtains at the sides of the stage.
  const curtainMat = std(0x4a0e12, 0.95);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const fold = add(new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 5.2, 10), curtainMat));
      fold.position.set(side * (3.35 + k * 0.26), 2.6, STAGE_BACK + 0.2 + (k % 2) * 0.06);
    }
  }
  // The lectern: wood, a little brass plate.
  const lectern = add(new T.Mesh(new T.BoxGeometry(0.62, 1.1, 0.42), std(0x4a2c18, 0.55)));
  lectern.position.set(ROOM.lectern.x, H + 0.55, ROOM.lectern.z);
  lectern.rotation.y = -0.3;
  shade(lectern);
  const plate = add(new T.Mesh(new T.PlaneGeometry(0.34, 0.08), glow(0xf6c445)));
  plate.position.set(ROOM.lectern.x - 0.06, H + 0.82, ROOM.lectern.z + 0.215);
  plate.rotation.y = -0.3;
  // The trophy table behind the spot.
  const tt = ROOM.trophyTable;
  const ttop = add(new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.04, 28), std(0x1a1210, 0.4)));
  ttop.position.set(tt.x, H + 0.86, tt.z);
  const tcloth = add(new T.Mesh(new T.CylinderGeometry(0.33, 0.38, 0.84, 28, 1, true), std(0xe9e1d2, 0.9)));
  tcloth.position.set(tt.x, H + 0.42, tt.z);
  shade(tcloth);

  // ── The trophy: a gold cup (one shape for every award), from primitives ──
  const gold = new T.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.25, metalness: 1 });
  gold.emissive = new T.Color(0x2a1a00);
  if (tier !== "low") {
    const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
    const pmrem = new T.PMREMGenerator(renderer);
    gold.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    gold.envMapIntensity = 1.2;
    pmrem.dispose();
  }
  const trophy = new T.Group();
  const cupPts = [[0.0, 0.0], [0.06, 0.0], [0.065, 0.02], [0.03, 0.04], [0.018, 0.12], [0.03, 0.16], [0.085, 0.21], [0.1, 0.3], [0.094, 0.31]]
    .map(([r, y]) => new T.Vector2(r, y));
  const cup = new T.Mesh(new T.LatheGeometry(cupPts, 28), gold);
  cup.castShadow = prof.shadows;
  const base = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.05, 24), std(0x111111, 0.3, 0.5));
  base.position.y = -0.025;
  const handleGeo = new T.TorusGeometry(0.045, 0.009, 8, 16, Math.PI);
  for (const s of [-1, 1]) {
    const hd = new T.Mesh(handleGeo, gold);
    hd.position.set(s * 0.1, 0.25, 0);
    hd.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    trophy.add(hd);
  }
  trophy.add(cup, base);
  add(trophy);
  /** The trophy's base, in the middle of the trophy table. */
  const trophyRest = new T.Vector3(tt.x, H + 0.88 + 0.05, tt.z);

  // ── The round tables, each with a lamp, and the guests round them ──
  const tableTop = std(0x1a1210, 0.5);
  const cloth = std(0xe8dfcf, 0.9);
  const lampBase = std(0x6b4a22, 0.4, 0.6);
  const lampGlow = glow(0xffcf7a);
  const lampHalo = new T.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
  for (const tb of ROOM.tables) {
    const top = add(new T.Mesh(new T.CylinderGeometry(ROOM.tableR, ROOM.tableR, 0.04, 36), tableTop));
    top.position.set(tb.x, 0.76, tb.z);
    const cl = add(new T.Mesh(new T.CylinderGeometry(ROOM.tableR + 0.02, ROOM.tableR + 0.08, 0.74, 36, 1, true), cloth));
    cl.position.set(tb.x, 0.39, tb.z);
    shade(cl);
    const lb = add(new T.Mesh(new T.CylinderGeometry(0.035, 0.05, 0.16, 12), lampBase));
    lb.position.set(tb.x, 0.86, tb.z);
    const lg = add(new T.Mesh(new T.SphereGeometry(0.06, 14, 10), lampGlow));
    lg.position.set(tb.x, 0.97, tb.z);
    const lh = add(new T.Mesh(new T.SphereGeometry(0.3, 16, 12), lampHalo));
    lh.position.copy(lg.position);
  }
  // Guests: seated, round the back and sides of each table (the stage side is
  // left free, where the winners wait), shoulders and a head each (instanced).
  interface Guest { x: number; y: number; z: number; s: number; face: number; phase: number }
  const guests: Guest[] = [];
  const perTable = tier === "low" ? 4 : 6;
  ROOM.tables.forEach((tb, ti) => {
    for (let k = 0; k < perTable; k++) {
      // Angles round the table from its left side, over the back, to its right side (0 = towards the stage).
      const a = (Math.PI * 0.42) + (k / (perTable - 1)) * (Math.PI * 1.16) + (guardRand(opts.seed, ti * 10 + k, 301) - 0.5) * 0.15;
      const r = ROOM.tableR + 0.32;
      const x = tb.x + Math.sin(a) * r, z = tb.z - Math.cos(a) * r;
      guests.push({ x, y: 0, z, s: 0.92 + guardRand(opts.seed, ti * 10 + k, 302) * 0.16, face: Math.atan2(-x * 0.15, -(z - 0.5)), phase: guardRand(opts.seed, ti * 10 + k, 303) * Math.PI * 2 });
    }
  });
  const G = guests.length;
  const bodyGeo = new T.CapsuleGeometry(0.19, 0.3, 3, 8);
  bodyGeo.scale(1, 1, 0.7);
  const fan = add(new T.InstancedMesh(bodyGeo, new T.MeshStandardMaterial({ roughness: 0.9 }), G));
  const fanHead = add(new T.InstancedMesh(new T.SphereGeometry(0.11, 12, 9), new T.MeshStandardMaterial({ roughness: 0.8 }), G));
  const col = new T.Color();
  const suitCols = ["#0b0d14", "#14161f", "#1d1a17", "#251c14", "#101820", "#2a2a2a"];
  const gownCols = ["#5a1220", "#4a3410", "#1d2a4a", "#2d1036", "#0f3326"];
  const skinCols = ["#5a3b2a", "#8a5a3c", "#b07a52", "#3a271c", "#d2a07a"];
  const hairCols = ["#0d0a08", "#1a120c", "#2b1b12", "#3a2a1e", "#6b6b6b", "#8a6a3a"];
  for (let i = 0; i < G; i++) {
    const r = (k: number) => guardRand(opts.seed, i, k);
    fan.setColorAt(i, col.set(r(310) < 0.25 ? gownCols[Math.floor(r(311) * gownCols.length)] : suitCols[Math.floor(r(311) * suitCols.length)]));
    fanHead.setColorAt(i, col.set(r(312) < 0.4 ? skinCols[Math.floor(r(313) * skinCols.length)] : hairCols[Math.floor(r(313) * hairCols.length)]));
  }
  if (fan.instanceColor) fan.instanceColor.needsUpdate = true;
  if (fanHead.instanceColor) fanHead.instanceColor.needsUpdate = true;
  const m4 = new T.Matrix4(), qy = new T.Quaternion(), sc = new T.Vector3(), pos3 = new T.Vector3(), eul = new T.Euler();
  const crowdPose = (t: number, cheer: number) => {
    for (let i = 0; i < G; i++) {
      const g = guests[i];
      // A guest right by the lens would fill the picture: he is left out of that shot.
      if (Math.hypot(g.x - camera.position.x, g.z - camera.position.z) < 2.3) {
        m4.makeScale(0, 0, 0);
        fan.setMatrixAt(i, m4);
        fanHead.setMatrixAt(i, m4);
        continue;
      }
      const sway = Math.sin(t * 0.8 + g.phase) * 0.03;
      const bounce = cheer * 0.04 * Math.abs(Math.sin(t * 7 + g.phase));
      eul.set(0, g.face, sway);
      qy.setFromEuler(eul);
      sc.setScalar(g.s);
      pos3.set(g.x, 0.78 * g.s + bounce, g.z);
      m4.compose(pos3, qy, sc);
      fan.setMatrixAt(i, m4);
      pos3.set(g.x + sway * 0.3, (0.78 + 0.42) * g.s + bounce, g.z);
      m4.compose(pos3, qy, sc);
      fanHead.setMatrixAt(i, m4);
    }
    fan.instanceMatrix.needsUpdate = true;
    fanHead.instanceMatrix.needsUpdate = true;
  };
  // Strings of warm bulbs across the room (glowing dots, no lights).
  const BULBS = 6 * 22;
  const bulbs = add(new T.InstancedMesh(new T.SphereGeometry(0.03, 6, 4), glow(0xffd28a), BULBS));
  for (let s = 0; s < 6; s++) {
    for (let k = 0; k < 22; k++) {
      const u = k / 21;
      const x = -6 + u * 12;
      const z = 1.2 + s * 1.15;
      const y = 3.9 - Math.sin(u * Math.PI) * 0.45 - (s % 2) * 0.1;
      m4.compose(pos3.set(x, y, z), qy.identity(), sc.setScalar(1));
      bulbs.setMatrixAt(s * 22 + k, m4);
    }
  }
  bulbs.instanceMatrix.needsUpdate = true;

  // ── People ──
  const loader = await withMeshopt(new GLTFLoader()); // meshopt-packed files (scripts/perf3d/shrink-models.mjs)
  // One person per different winner (two awards for one man: the same man).
  const winnerIds = Array.from(new Set(plan.awards.map((a) => a.winnerId)));
  const youModel: PlayerModel = playerModelFor(opts.you.hairStyle);
  const modelOf = (id: string): PlayerModel => (id === "you" ? youModel : (["player", "player-buzz", "player-long"] as PlayerModel[])[Math.floor(guardRand(opts.seed, id.length * 31 + id.charCodeAt(0), 1) * 3)]);
  const models: PlayerModel[] = Array.from(new Set<PlayerModel>(winnerIds.map(modelOf)));
  if (models.length === 0) models.push("player");
  const heads = toonHeadsFor(winnerIds.map((id) => (id === "you" ? { you: true } : { who: `awards-${id}` })));
  const crestTex = new Map<string, THREE.Texture>();
  await Promise.all(Object.entries(opts.crests ?? {}).map(async ([id, url]) => {
    const tex = await loadCrestTexture(T, url);
    if (tex) crestTex.set(id, tex);
  }));
  const [anims, hostGltf, ...bodies] = await Promise.all([
    loadPeople3d(loader, "anims"),
    loadPeople3d(loader, "manager", BODY),
    ...models.map((m) => loadPeople3d(loader, m, BODY, heads)),
  ]);
  const bodyOf = (m: PlayerModel): GLTF => bodies[models.indexOf(m)];
  const outline = prof.outlines ? 0.0035 : 0;
  const outlineNear = BODY === "new" ? 1.6 : undefined;

  // The host: a club man in a suit (seeded, nobody real), behind the lectern.
  const host = makePerson3d(T, SkeletonUtils, hostGltf, anims, { outline, outlineNear, who: "awards-host", suit: true, castShadow: prof.shadows });
  dressPerson3d(T, host, { skin: SKIN_TONES[1 % SKIN_TONES.length].hex, hair: "#3a2a1e", grey: 0.3 });
  host.root.position.set(ROOM.lectern.x + 0.12, H, ROOM.lectern.z - 0.42);
  host.root.rotation.y = -0.45;
  scene.add(host.root);
  const hostIdle = host.actions["boss-idle"] ?? host.actions.idle ?? null;
  const hostTalk = host.actions["boss-talk"] ?? null;
  const hostWave = host.actions["boss-wave"] ?? null;
  for (const a of [hostIdle, hostTalk, hostWave]) a?.play();

  const walkers = new Map<string, Walker>();
  for (const id of winnerIds) {
    const mine = id === "you";
    const p = makePerson3d(T, SkeletonUtils, bodyOf(modelOf(id)), anims, mine
      ? { outline, outlineNear, castShadow: prof.shadows, you: true }
      : { outline, outlineNear, castShadow: prof.shadows, who: `awards-${id}` });
    const kit = opts.kits[id] ?? { shirt: "#e5e7eb", trim: "#111827" };
    if (mine) {
      dressPerson3d(T, p, {
        skin: opts.you.skin, hair: opts.you.hair, kit, number: null, badge: crestTex.get(id) ?? null,
        face: opts.you.face ?? null, faceSkin: opts.you.face?.skin, accessories: opts.you.accessories,
      });
    } else {
      const k = Math.floor(guardRand(opts.seed, id.length, 5) * 1000) + id.charCodeAt(0);
      dressPerson3d(T, p, {
        skin: SKIN_TONES[Math.floor(guardRand(k, 2, 2) * SKIN_TONES.length)].hex,
        hair: HAIR_COLOURS[Math.floor(guardRand(k, 3, 3) * HAIR_COLOURS.length)].hex,
        kit, number: null, badge: crestTex.get(id) ?? null,
      });
    }
    p.root.visible = false;
    scene.add(p.root);
    const walk = p.actions.jog && p.actions.idle ? p.mixer.clipAction(makeWalkClip(T, p.actions.jog.getClip(), p.actions.idle.getClip())) : null;
    walk?.play();
    p.actions.idle?.play();
    p.actions.celebrate?.play();
    p.actions.wave?.play();
    walkers.set(id, { id, p, walk, cheered: false });
  }

  const v3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const wpos = (o: THREE.Object3D) => { const v = new T.Vector3(); o.getWorldPosition(v); return v; };
  const UP = v3(0, 1, 0);
  type Side = "L" | "R";
  const bn = (s: Side, part: "Arm" | "ForeArm" | "Hand") => (s === "R" ? "Right" : "Left") + part;
  /** Both arms up over his head, hands close together round the trophy's
   *  foot (the Ballon d'Or night's arms-up, narrower). Laid over the clips. */
  const liftUp = (p: Person3D, t: number, w: number) => {
    p.root.updateMatrixWorld(true);
    const q = p.root.quaternion;
    const fwd = v3(0, 0, 1).applyQuaternion(q);
    const left = v3(1, 0, 0).applyQuaternion(q);
    const centre = new T.Vector3();
    let n = 0;
    for (const s of ["L", "R"] as Side[]) {
      const out = s === "L" ? 1 : -1;
      const up = p.bones[bn(s, "Arm")], lo = p.bones[bn(s, "ForeArm")], ha = p.bones[bn(s, "Hand")];
      if (!up || !lo || !ha) continue;
      const shoulder = wpos(up);
      const pump = 0.03 * Math.sin(t * 4.5);
      // Over the head: each wrist pulled in from its shoulder towards the middle.
      const wrist = shoulder.clone().addScaledVector(UP, 0.46 + pump).addScaledVector(left, -out * 0.1).addScaledVector(fwd, 0.08);
      const pole = left.clone().multiplyScalar(out * 0.8).addScaledVector(fwd, -0.4);
      solveArm(T, up, lo, ha, wrist, pole, w);
      p.root.updateMatrixWorld(true);
      centre.add(wpos(ha));
      n++;
    }
    return n ? centre.multiplyScalar(1 / n) : null;
  };

  // ── The camera: one framing per beat ──
  // A framing is a point to look at and the half-width that must fit across
  // the screen (so a tall phone and a wide laptop both see the same people).
  // `cut`: jump to it at its time (no ease); `follow`: look at that award's winner.
  interface Frame { at: number; look: [number, number, number]; half: number; up: number; yaw?: number; cut?: boolean; follow?: AwardCall }
  const L = ROOM.lectern, S = ROOM.spot;
  const frames: Frame[] = [
    { at: 0, look: [0, 1.5, 0.6], half: 3.0, up: 1.5 },
    { at: plan.introEnd - 0.2, look: [0.2, 1.7, 0], half: 2.7, up: 1.0 },
  ];
  for (const a of plan.awards) {
    frames.push(
      { at: a.from, look: [0.4, 1.9, -0.6], half: 2.7, up: 0.5, cut: true },
      { at: a.from + 1.0, look: [L.x - 0.05, H + 1.5, L.z - 0.3], half: 1.15, up: 0.15, yaw: -0.35 },
      { at: a.nomineesAt, look: [0, SCREEN_Y - 0.15, STAGE_BACK], half: SCREEN_W / 2 + 0.25, up: 0, cut: true },
      { at: a.envelopeAt, look: [L.x - 0.05, H + 1.5, L.z - 0.3], half: 1.0, up: 0.1, yaw: -0.4, cut: true },
      { at: a.revealAt, look: [0, SCREEN_Y - 0.15, STAGE_BACK], half: SCREEN_W / 2 + 0.25, up: 0, cut: true },
      { at: a.walkFrom + 0.1, look: [0, 0, 0], half: 2.1, up: 1.5, cut: true, follow: a },
      { at: a.walkTo + 0.3, look: [S.x, H + 1.2, S.z], half: 1.25, up: 0.25 },
    );
  }
  frames.push({ at: plan.end + 0.5, look: [0, 1.7, 0], half: 3.4, up: 1.0 });
  frames.sort((a, b) => a.at - b.at);
  const lookOf = (f: Frame, t: number): [number, number, number] => {
    if (!f.follow) return f.look;
    const w = winnerPosAt(f.follow, t);
    return [w.x * 0.8, w.y + 1.15, w.z];
  };
  const placeCam = (t: number) => {
    let i = 0;
    while (i < frames.length - 1 && frames[i + 1].at <= t) i++;
    const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
    const span = Math.max(0.001, b.at - a.at);
    // Hold a; ease into b over the last 1.2 s before its time, unless b is a cut.
    const k0 = a === b || b.cut ? 0 : Math.max(0, Math.min(1, 1 - (b.at - t) / Math.min(1.2, span)));
    const k = k0 * k0 * (3 - 2 * k0);
    const la = lookOf(a, t), lb = lookOf(b, t);
    const lerp = (u: number, v: number) => u + (v - u) * k;
    const look = [lerp(la[0], lb[0]), lerp(la[1], lb[1]), lerp(la[2], lb[2])];
    const half = lerp(a.half, b.half) * (1 - 0.05 * Math.min(1, Math.max(0, t - a.at) / span));
    const up = lerp(a.up, b.up);
    const yaw = lerp(a.yaw ?? 0, b.yaw ?? 0);
    const hfov = 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    const d = half / Math.tan(hfov / 2);
    camera.position.set(look[0] + Math.sin(yaw) * d, look[1] + up, look[2] + Math.cos(yaw) * d);
    camera.lookAt(look[0], look[1], look[2]);
  };

  // ── The screen's words ──
  const screenAt = (t: number) => {
    const a = awardAt(plan, t);
    const beat = beatAt(plan, t);
    const kicker = `Season ${plan.season} Awards`;
    if (!a) return screenWords.draw({ kicker: "Welcome to", title: kicker });
    if (beat === "call") return screenWords.draw({ kicker, title: a.label });
    if (beat === "nominees" || beat === "envelope") return screenWords.draw({ kicker: a.label, title: "The nominees", lines: a.nominees.map((n) => (n.isYou ? `${n.name} (You)` : n.name)) });
    return screenWords.draw({ kicker: a.label, title: a.winner.name, gold: true });
  };

  // ── One moment of the night ──
  const pose = (t: number, dt: number) => {
    const a = awardAt(plan, t);
    const beat = beatAt(plan, t);
    // The host: talking as he calls and opens the envelope; a wave as the winner comes up.
    const talking = beat === "intro" || beat === "call" || beat === "envelope";
    const waving = beat === "walk" || beat === "moment";
    hostWave?.setEffectiveWeight(waving && hostWave ? 1 : 0);
    hostTalk?.setEffectiveWeight(!waving && talking ? 1 : 0);
    hostIdle?.setEffectiveWeight(!waving && !(talking && hostTalk) ? 1 : 0);
    host.mixer.update(dt);

    // The winners: only the one for this award is out.
    let handsAt: THREE.Vector3 | null = null;
    for (const w of Array.from(walkers.values())) {
      const mine = a && a.winnerId === w.id && t < a.end ? a : null;
      const p = w.p;
      if (!mine) { p.root.visible = false; w.cheered = false; continue; }
      const at = winnerPosAt(mine, t);
      p.root.visible = at.seen;
      p.root.position.set(at.x, at.y, at.z);
      p.root.rotation.y = at.yaw;
      const walking = at.walking ? 1 : 0;
      const lifting = t >= mine.walkTo ? Math.min(1, (t - mine.walkTo) / 0.4) : 0;
      if (w.walk) { w.walk.setEffectiveWeight(walking); w.walk.timeScale = 1.05; }
      if (lifting > 0 && !w.cheered && p.actions.celebrate) { p.actions.celebrate.reset().play(); p.actions.celebrate.timeScale = 0.7; w.cheered = true; }
      if (lifting === 0) w.cheered = false;
      // The celebrate clip under the arms (his legs and body); the arms are laid on top.
      // Standing tall under the trophy: the idle (the celebrate clip bends his head down, hiding his face).
      p.actions.celebrate?.setEffectiveWeight(0);
      p.actions.wave?.setEffectiveWeight(0);
      p.actions.idle?.setEffectiveWeight(Math.max(0, 1 - walking));
      p.mixer.update(dt);
      p.root.updateMatrixWorld(true);
      if (lifting > 0) handsAt = liftUp(p, t, Math.min(1, (t - mine.walkTo - 0.05) / 0.45));
    }

    // The trophy: on its table; when he arrives, into his hands and over his head.
    const lift = a ? trophyLiftAt(a, t) : 0;
    if (a && lift > 0 && handsAt && t < a.end) {
      const hold = (handsAt as THREE.Vector3).clone().addScaledVector(UP, 0.02);
      trophy.position.copy(trophyRest).lerp(hold, lift);
      trophy.position.y += Math.sin(lift * Math.PI) * 0.25;
    } else {
      trophy.position.copy(trophyRest);
    }
    trophy.rotation.y = 0;

    const cheer = a && t >= a.revealAt && t < a.end ? 1 : 0;
    placeCam(t);
    crowdPose(t, cheer);
    screenAt(t);
  };

  const governed = governScene(T, { name: "season awards night", start: tier, renderer, scene, camera, lights: [key], basePR: renderer.getPixelRatio() });
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
    // A skip jumps the clock: let the clips settle at once rather than run the gap.
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
      gold.envMap?.dispose();
      screenWords.texture.dispose();
      for (const tx of Array.from(crestTex.values())) tx.dispose();
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
      // Play up to `at` from a little before it (the clips need a run-in), 15 steps a second.
      const from = Math.max(0, at - 3);
      const steps = Math.max(1, Math.round((at - from) * 15));
      pose(from, 0);
      let t = from;
      for (let i = 0; i < steps; i++) { t += (at - from) / steps; pose(t, (at - from) / steps); }
      lastT = at;
      draw();
    },
    debugInfo() {
      return { tier, t: +lastT.toFixed(2), people: walkers.size + 1, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
  };
}
