/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 3D GARDEN — your place as a footballer, walked in 3D (Mikey, 3 Oct
 * 2026: "make this garden area also a 3D area where it's basically your
 * garden as a footballer in your life … everything is 3D").
 *
 * You are the SAME footballer as in the 3D shop (lib/star/shop3d/scene.ts):
 * the same model, kit, walk and camera. The garden, from his recording:
 *   - the sky, trees and the boundary (it grows with your home, like before)
 *   - the stable, paddock, hay and water, and your horse if you own one
 *   - the trophy cabinet: every trophy you have won, on lit shelves
 *   - the fountain, with a bird that flies down for a drink now and then
 *   - the gazebo: three team-mates on the bench with KIB cans, a potted
 *     plant, and a teqball table
 *   - parking for the cars you own
 *   - where the house was, THE SHOP: walk through its doors and you are in
 *     the 3D shop; its own front doors bring you back out here.
 *
 * Real data only (lib/star/gardenLevel.ts and the career), nothing new to
 * save. The models are free CC0 packs (Kenney, Quaternius) packed by
 * tools/garden3d/export_models.py; the people's extra moves (sitting,
 * drinking) by tools/garden3d/build_anims.py — see
 * public/star/garden3d/LICENSE.txt. three.js loads only when this opens.
 *
 * THE 5 OCT 2026 LOOK PASS (Harry: "the garden … needs a lot of work
 * visually … the model has to be the same as the 3D shop"). This file is the
 * NEW garden; the garden as it was is frozen in ./sceneOld.ts and opens when
 * Settings → Look → "3D garden" is Old (lib/star/garden3d/look.ts).
 *   - YOU are the shop's own player: the approved people3d character in your
 *     skin, hair and kit when the shop's "3D shop player" is New (the shop's
 *     default), the old character.glb when it is Old — same files, scale,
 *     kit dressing and outline as lib/star/shop3d/scene.ts. The team-mates on
 *     the bench are the same body, sat with the clips' own "sitidle".
 *   - golden-hour light from behind the gate, so the shop front, the stable
 *     doors and the trophy cabinet face the sun; long soft shadows; a soft
 *     sky reflection (the shop's RoomEnvironment) so he is lit as in the shop
 *   - a mown lawn inside the boundary, rough meadow outside it, kerbed paths
 *   - the boundary as long clean runs (fence / clipped hedge / brick wall),
 *     a tree line behind the shop, clipped topiary instead of lumpy bushes
 *   - the shop as a real small shop front: brick, slate roof, a green painted
 *     shopfront with lit display windows, striped awnings and open doors
 *   - a lower camera further back; the fountain fades when the camera is in it
 * Static pieces are merged by material (one draw call each), so the extra
 * detail costs few draw calls.
 */
import { dressInKit, type KitColours } from "../shop3d/scene";
import { blobCanvas, neonCanvas, numberCanvas } from "../shop3d/textures";
import { loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, relaxHands, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { buildGrid, findPath, TapWalker, makeTapMarker, type WalkGrid, type XZ } from "../tapWalk";
import { makeWalkClip } from "../walkClip";
import { freezeStatic } from "../freezeStatic";
import { TIER_PROFILES, quality3dTier, stepDownTier, shadowSizeFor, type Quality3d } from "../three3d/quality";
import { Governor } from "../three3d/governor";
import { sceneSavings } from "../three3d/sceneSavings";
import { DynamicResolution, rememberGpu, loadGltfCached } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { look3dStyle } from "../look3dStyle";
import { loadRealNature, makeTree, makeBale, makeFlowerBeds, makeGroundDetail } from "./realNature";
import { grassMaps } from "../style3d/real/assets";
import { addClips, clipInfo, loadAnims3d, withMocapOwn } from "../three3d/footballAnims";
import { strideFor, type GaitBlend } from "../three3d/gaitBlend";
import { STROLL_SPEEDS, approach, stickTarget } from "../three3d/gait";
import { OrbitCam, CAM_MIN_Y } from "../three3d/orbitCam";
import { cullSkinned } from "../three3d/cullPeople";
import {
  gravelCanvas, pavingCanvas, strawCanvas, boardsCanvas, skyCanvas, countCanvas, glowCanvas,
  lawnCanvasSoft, meadowCanvas, brickCanvas, hedgeCanvas, stripeCanvas, slateCanvas,
} from "./textures";

export type GardenSpot = "trophies" | "horse" | "mates" | "fountain" | "cars" | "shop" | "teqball" | "casino" | "training" | "house";
export type GardenSky = "day" | "sunset" | "night";

export interface GardenTrophy { name: string; count: number; art: string | null }

export interface GardenData {
  kit: KitColours;
  /** Your shirt number (the back of the shirt). */
  number: number;
  /** How grand the garden is, 0-4, from the best home you own. */
  tier: number;
  /** The stable's level, 0 = none bought, 1-5. */
  stable: number;
  horse: { name: string } | null;
  trophies: GardenTrophy[];
  /** The cars you own: their 3D model files (the shop's own). */
  cars: string[];
  sky: GardenSky;
  /** The team-mates on the bench: their shirt numbers. */
  mates: number[];
  /** Where you appear: at the shop's doors (coming out of it), the casino's
   *  doors, the training pitch's gate, or the garden gate. */
  arrive: "shop" | "gate" | "casino" | "training" | "house";
  /** Who you are: the 3D shop's own player (its Settings → "3D shop player"
   *  switch and your saved skin, hair and hair style). Absent → the shop's
   *  default, the new player. */
  player?: { look: "new" | "old"; skin?: string; hair?: string; hairStyle?: "short" | "long" | "buzz" | "none" };
  /** What you wear (lib/star/home3d/outfits.ts wornAt): a casual set from your
   *  home's wardrobe, or absent / a kit for the club kit as before. The casual
   *  set needs the new player (player.look "new"); the old one stays in kit. */
  worn?: import("../home3d/outfits").Worn;
}

export interface GardenCallbacks {
  onNear: (spot: GardenSpot | null) => void;
  onFps: (fps: number) => void;
  /** He walked through the shop's doors. */
  onShopDoor: () => void;
  /** He walked through the casino's doors (8 Oct 2026). */
  onCasinoDoor?: () => void;
  /** He walked through the training pitch's gate (8 Oct 2026). */
  onTrainingGate?: () => void;
  /** He walked through your house's back door (9 Oct 2026). Absent: the door stays shut. */
  onHouseDoor?: () => void;
  /** The phone took the 3D away (iPhone Safari does this when memory runs
   *  short): the screen should restart the garden or fall back. */
  onContextLost?: () => void;
}

export interface GardenController {
  setStick: (x: number, y: number) => void;
  /** A drag on the view (pixels): left/right turns, up/down tilts (lib/star/three3d/orbitCam.ts). */
  orbit: (dxPixels: number, dyPixels?: number) => void;
  pick: (clientX: number, clientY: number) => GardenSpot | null;
  /** Tap to move: a tap on something you can use walks you up to it (its
   *  card then appears as you arrive); a tap on the ground walks you there.
   *  What the tap was, or null if it hit nothing (the sky). */
  tap?: (clientX: number, clientY: number) => { spot: GardenSpot | null } | null;
  /** For checking: is a tap-walk going on, and where to. */
  walking?: () => { to: [number, number] | null; active: boolean };
  /** For checking: stand him at (x, z), facing yaw (radians). */
  place: (x: number, z: number, yaw?: number) => void;
  where: () => { x: number; z: number; yaw: number; t: number; cam?: number[]; dodge?: number; block?: { d: number; what: string } | null };
  stats: () => { calls: number; triangles: number; pixelRatio: number; loaded: number; impostor?: boolean; shadowRenders?: number; frames?: number; quality?: string; merged?: { before: number; after: number }; carImpostor?: boolean; shadowCalls?: number; shadowTris?: number };
  /** For checking: a fixed test camera (null: back to the follow camera). */
  debugCamera?: (pos: [number, number, number] | null, look?: [number, number, number]) => void;
  /** For checking: where the horse and the bird are, and how big they draw. */
  debug: () => Record<string, unknown>;
  dispose: () => void;
}

export interface GardenOptions {
  /** Settings → Look → "3D quality" (lib/star/three3d/quality.ts). Unset: the setting, else Auto. */
  quality?: Quality3d;
  fixedStep?: number;
}

// ── The plan of the garden (metres; north is -z, the gate is south) ──
const LIMIT = 18.3;
/** The bench team-mates' own drawing layer (see makeImpostor). */
const MATE_LAYER = 3;
/** The parked cars' own drawing layers, one each (they get a picture too, far off). */
const CAR_LAYER = 4;
const SHOP = { x0: -6, x1: 6, z0: -17.5, z1: -9, h: 5.2 };
const DOOR = { half: 1.2, h: 2.8 };
const FOUNTAIN = { x: 0, z: -2.2, r: 1.95 };
/** How far the horse's neck and head drop to graze (radians, on top of his
 *  Idle clip; checked on a still, 7 Oct 2026: nose down at knee height). */
const HORSE_GRAZE = { neck: 1.5, head: -0.35 };
const CABINET = { x: -7.4, z: -5.8, w: 3.0, d: 2.6 };
const GAZEBO = { x: 9.4, z: 2.2, w: 3.6, d: 5.0 };
const BENCH_X = 10.75;
const TEQ = { x: 6.6, z: -3.6 };
const STABLE = { x: -15.2, z: 6.5, w: 4.2, d: 7.4 };
const PADDOCK = { x0: -13.0, x1: -6.4, z0: 0.8, z1: 12.6, gate: [5.6, 7.4] as [number, number] };
const PARK = { x0: 5.5, x1: 16.5, z0: 9.2, z1: 17.2 };
/** The casino (8 Oct 2026, Harry: "making the casino 3D and adding it to the
 *  garden/shop walkable area"): back right, beside the shop, its front
 *  facing the gate. Its doors are at x = CASINO.door. */
const CASINO = { x0: 7.6, x1: 15.4, z0: -17.6, z1: -11.8, h: 4.6, door: 11.5 };
const CAS_DOOR = { half: 1.0, h: 2.7 };
/** The training pitch (8 Oct 2026): back left, fenced, a goal at the far end;
 *  its gate is in the near (south) fence at x = PITCH.gate. */
const PITCH = { x0: -16.9, x1: -7.6, z0: -17.4, z1: -10.2, gate: -10.1, gateHalf: 0.8 };
/** The side paths to them: from the fountain court along z = SIDE_Z. */
const SIDE_Z = -1.8;
const START_SHOP = { x: 0, z: -5.3, yaw: 0 };
const START_CASINO = { x: CASINO.door, z: CASINO.z1 + 2.2, yaw: 0 };
const START_TRAINING = { x: PITCH.gate, z: PITCH.z1 + 2.0, yaw: 0 };
const START_GATE = { x: 0, z: 15.5, yaw: Math.PI };
/** Your house's back door (9 Oct 2026): on the east boundary, between the
 *  gazebo and the parked cars, facing the garden; a path to it from the main path. */
const HOUSE = { x: 17.95, z: 6.6 };
const HOUSE_DOOR = { half: 0.65, h: 2.3 };
const START_HOUSE = { x: HOUSE.x - 1.6, z: HOUSE.z, yaw: -Math.PI / 2 };
/** The follow camera: how far behind him, and how high. */
const CAM_BACK = 6.3;
const CAM_UP = 2.75;
const WALK = 1.55;
const JOG = 3.6;

// Golden hour by day; a deep orange sunset; a cool night. The sun sits low
// behind the gate (south-east), so walking in from the gate you look at the
// lit fronts of the shop, the stable and the cabinet with long shadows.
const SKY: Record<GardenSky, { top: string; mid: string; low: string; fog: string; sun: string; sunI: number; hemi: [string, string, number]; exp: number; dir: [number, number, number]; env: number; hill: string }> = {
  day: { top: "#3f78bf", mid: "#9cc2e4", low: "#f4dcb4", fog: "#e3d3b6", sun: "#ffd7a0", sunI: 3.1, hemi: ["#cfe0f4", "#4f4428", 0.55], exp: 1.0, dir: [0.55, 0.6, 0.85], env: 0.32, hill: "#7f9a5c" },
  sunset: { top: "#2b2f66", mid: "#e2835a", low: "#ffcf8c", fog: "#eeb789", sun: "#ffa45a", sunI: 2.7, hemi: ["#ffcfa4", "#463624", 0.45], exp: 1.02, dir: [0.75, 0.26, 0.6], env: 0.24, hill: "#7d7a4f" },
  night: { top: "#04070f", mid: "#0c1730", low: "#1b2747", fog: "#111a30", sun: "#9db8ff", sunI: 0.45, hemi: ["#5a6f9c", "#1a2216", 0.42], exp: 1.15, dir: [0.45, 0.9, -0.5], env: 0.1, hill: "#1d2c22" },
};

async function buildGarden(container: HTMLElement, cb: GardenCallbacks, data: GardenData, opts: GardenOptions, own: { renderer?: any }): Promise<GardenController> {
  // ── 3D quality (Settings → Look → "3D quality"): one tier, chosen before the
  // renderer (antialias is fixed when the context is made). High is the New
  // look exactly as it was on 5 Oct 2026. ──
  let tier: Quality3d = opts.quality ?? quality3dTier();
  let prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { DRACOLoader }: any = await import("three/examples/jsm/loaders/DRACOLoader.js");
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  // Look H by day: real golden hour, as the match's H look has it (Harry, 9 Oct 2026:
  // "make the light golden-hour quality"). The day sky's sun was high and near white
  // and the H pass graded it as plain day; now the sun sits lower and warmer (longer
  // shadows, warm fronts) and the H pass uses its golden grade. Old look: as before.
  const goldenDay = data.sky === "day" && look3dStyle() === "h";
  const look = goldenDay
    ? { ...SKY.day, sun: "#ffc98c", sunI: 3.3, dir: [0.75, 0.26, 0.6] as [number, number, number] /* the golden bake's own sun (tools/bake3d), so baked and live shadows agree */, low: "#f7d39c", fog: "#e8cfa8", hemi: ["#d6e2f0", "#5a4a2a", 0.5] as [string, string, number] }
    : SKY[data.sky];
  // test page switches, to check a lag measure on its own (?noimp, ?nofreeze)
  const dbg = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
  const night = data.sky === "night";

  // ── Renderer ──
  const { RoomEnvironment }: any = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const renderer = new THREE.WebGLRenderer({ antialias: prof.antialias, powerPreference: "high-performance" });
  own.renderer = renderer;
  rememberGpu(renderer);
  // ── LAG (Harry, 5 Oct 2026: "find ways to minimise lag") ──
  // Pixels: the tier's still cap standing still (High 1.5x a CSS pixel), its
  // moving cap while walking (High 1x: the picture is moving, so the softer
  // frame isn't seen; a phone's screen has 2-3x, so this is 2.25x fewer
  // pixels to colour while you walk). While walking, dynamic resolution may
  // take the moving picture a little lower still if frames are slow.
  const dpr = window.devicePixelRatio || 1;
  // look H standing still: the screen's real pixels, capped per tier (Harry: "still that pixelly element"); moving stays the tier's cap
  // The governor (three3d/governor.ts): under ~45 fps for 2 s → one rung down
  // (first the MOVING picture's pixels, never under 1.5 — a still frame keeps
  // full quality; only then, as an emergency, the tier's shadows). It replaces this scene's own "three slow seconds" check.
  const gov = new Governor({ start: tier, name: "garden", slowSeconds: 2, onChange: (r, _i, why) => {
    if (why === "start") return;
    if (why === "down" && r.tier !== tier) { if (!stepDown()) capAlways = true; }
    pr = stillPR(); renderer.setPixelRatio(pr);
  } });
  let govCap = 60;
  const STILL_H: Record<string, number> = { low: 1.25, medium: 2, high: 2.5 };
  const stillPR = () => Math.min(dpr, look3dStyle() === "h" ? Math.max(prof.maxPixelRatio, STILL_H[tier] ?? 1.5) : prof.maxPixelRatio);
  let dynPR = Math.min(dpr, prof.movePixelRatio);
  const makeDyn = () => new DynamicResolution(
    { setPixelRatio: (v: number) => { dynPR = v; } },
    { maxPixelRatio: prof.movePixelRatio, minPixelRatio: prof.minPixelRatio, fpsCap: prof.fpsCap },
    { step: 0.125, devicePixelRatio: dpr },
  );
  let dyn = makeDyn();
  const movePR = () => Math.min(dpr, gov.rung.pixelRatio, prof.movePixelRatio, dynPR);
  let pr = stillPR();
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exp;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // The sun's shadow is drawn again only when something that casts one has
  // moved (you, or a car arriving): standing still costs no shadow pass.
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);
  // iPhone Safari takes the 3D away when memory runs short: say so, cleanly.
  const onLost = (e: Event) => { e.preventDefault(); if (!disposed) cb.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(look.fog, 30, 110);
  scene.background = new THREE.Color(look.fog);
  // The shop's soft room reflection, so the people and the glass are lit as
  // they are in the shop (the old garden had none).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = look.env;
  // Settings → Look → "3D look: H": light from a real sky and the broadcast pass (Old: exactly as before)
  const hEnh = look3dStyle() === "h"
    ? (await import("../style3d/real/enhance")).enhanceH(THREE, renderer, scene, tier, data.sky === "sunset" || goldenDay ? "golden" : data.sky, { exposure: look.exp, envIntensity: look.env })
    : null;
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 160);
  camera.layers.enable(MATE_LAYER);
  for (let k = 0; k < 3; k++) camera.layers.enable(CAR_LAYER + k);
  let disposed = false;

  const canvasTex = (c: HTMLCanvasElement, repeat?: [number, number]) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
  const glow = (c: string, i = 1.6) => new THREE.MeshStandardMaterial({ color: "#000000", emissive: c, emissiveIntensity: i });
  const add = (o: any, x = 0, y = 0, z = 0, cast = true) => {
    o.position.set(x, y, z);
    o.traverse?.((c: any) => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = true; } });
    scene.add(o);
    return o;
  };
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, cast = true, parent: any = scene) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z);
    me.castShadow = cast;
    me.receiveShadow = true;
    parent.add(me);
    return me;
  };
  const blobT = canvasTex(blobCanvas());
  const blob = (w: number, d: number, x: number, z: number, opacity = 0.75, parent: any = scene) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    m.renderOrder = 1;
    parent.add(m);
    return m;
  };

  /**
   * Static pieces merged by material into one draw each. Add boxes or any
   * geometry (with a position/rotation/scale); `done()` builds the meshes and
   * puts them in `parent` (the parent's own frame).
   */
  const batch = (parent: any = scene, cast = true) => {
    const byMat = new Map<any, any[]>();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const put = (geo: any, m: any, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.applyMatrix4(m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), sc.set(sx, sy, sz)));
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m)!.push(g);
    };
    return {
      put,
      box: (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) => put(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz),
      done: () => {
        const out: any[] = [];
        byMat.forEach((list, m) => {
          const me = new THREE.Mesh(mergeGeometries(list), m);
          me.castShadow = cast && !m.transparent;
          me.receiveShadow = true;
          parent.add(me);
          out.push(me);
        });
        return out;
      },
    };
  };

  // ── The sky: a dome, the sun (or moon), far hills, clouds ──
  const dome = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ map: canvasTex(skyCanvas(look.top, look.mid, look.low)), side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.rotation.x = 0;
  scene.add(dome);
  const sunDir = new THREE.Vector3(...look.dir);
  sunDir.normalize();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(glowCanvas(night ? "210,225,255" : data.sky === "sunset" ? "255,170,100" : "255,245,215")), fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(night ? 9 : 22);
  sunSprite.position.copy(sunDir).multiplyScalar(105);
  scene.add(sunSprite);
  if (night) {
    const n = 450, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 110; pos[i * 3 + 1] = Math.sin(e) * 110; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 110;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 0.55, fog: false, sizeAttenuation: true })));
  }
  // far rolling hills: smooth, hazy, merged into one draw
  const hillM = mat(look.hill, { roughness: 1 });
  const hillGeos: any[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const g = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(22 + (i % 3) * 8, 5 + ((i * 7) % 5) * 1.6, 16);
    g.rotateY(-a);
    g.translate(Math.cos(a) * 78, -0.5, Math.sin(a) * 78);
    hillGeos.push(g);
  }
  scene.add(new THREE.Mesh(mergeGeometries(hillGeos), hillM));
  const cloudM = mat(data.sky === "sunset" ? "#ffe0c4" : "#ffffff", { transparent: true, opacity: night ? 0.18 : 0.9, emissive: data.sky === "sunset" ? "#ffb98a" : "#ffffff", emissiveIntensity: night ? 0 : 0.35 });
  const clouds: any[] = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), cloudM);
      p.scale.set(2.4 + Math.random() * 1.6, 1.3 + Math.random() * 0.6, 1.8);
      p.position.set(k * 2.1 - 3, Math.random() * 0.7, Math.random() * 1.2);
      c.add(p);
    }
    const a = (i / 7) * Math.PI * 2;
    c.position.set(Math.cos(a) * 55, 26 + (i % 3) * 4, Math.sin(a) * 55);
    c.lookAt(0, c.position.y, 0);
    clouds.push(c);
    scene.add(c);
  }

  // ── Light ──
  const hemiLight = new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]);
  scene.add(hemiLight);
  const nightLights: any[] = [];
  const sun = new THREE.DirectionalLight(look.sun, look.sunI);
  sun.position.copy(sunDir).multiplyScalar(40);
  sun.castShadow = prof.shadows;
  const SUN_MAP = 2048; // High: the full map; Medium: half (shadowSizeFor)
  sun.shadow.mapSize.set(shadowSizeFor(prof, SUN_MAP) || SUN_MAP, shadowSizeFor(prof, SUN_MAP) || SUN_MAP);
  // one fixed shadow over the whole garden (it used to follow him, so it had
  // to be redrawn every frame); redrawn only when a caster moves
  Object.assign(sun.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 100 });
  sun.shadow.autoUpdate = false;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  // a soft light from behind the camera, so he isn't a silhouette after dark
  const fillLight = new THREE.PointLight(night ? "#ffd9a8" : "#ffe6cc", night ? 7 : data.sky === "sunset" ? 3 : 0, 9, 1.6);
  fillLight.userData.moves = true; // it follows you (three3d/lightReach.ts)
  scene.add(fillLight);

  // Look H: real trees, hay, flowers and paving (./realNature.ts); Old: exactly as before
  const nature = look3dStyle() === "h" ? await loadRealNature(THREE, renderer).catch((e) => { console.error("garden nature maps failed", e); return null; }) : null;
  if (disposed) throw new Error("disposed");

  /** Look H: the lawn in look H's scanned grass (blades, normals), a copy every 2.4 m. */
  function realLawn() {
    const c = hGrass!.col.clone(), n = hGrass!.nrm.clone();
    for (const t of [c, n]) { t.repeat.set(39 / 2.4, 39 / 2.4); t.needsUpdate = true; }
    return mat("#e6f2d2", { map: c, normalMap: n, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.95 });
  }
  const hGrass = nature ? await grassMaps(THREE).catch(() => null) : null;
  if (disposed) throw new Error("disposed");

  // ── The ground ──
  // the mown lawn stops at the boundary; long meadow grass beyond it
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(39, 39), nature && hGrass ? realLawn() : mat("#ffffff", { map: canvasTex(lawnCanvasSoft(), [9, 9]), roughness: 0.95 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0.004;
  lawn.receiveShadow = true;
  scene.add(lawn);
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat("#ffffff", { map: canvasTex(meadowCanvas(), [50, 50]), roughness: 1 }));
  meadow.rotation.x = -Math.PI / 2;
  meadow.receiveShadow = true;
  scene.add(meadow);
  const flat = (w: number, d: number, m: any, x: number, z: number, y = 0.012, ry = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = ry;
    p.position.set(x, y, z);
    p.receiveShadow = true;
    scene.add(p);
    return p;
  };
  const paveT = canvasTex(pavingCanvas(), [1, 1]);
  /** Look H: real pavers, about 2.4 m to one copy of the map (slabs ~30 cm). */
  const realPaving = (w: number, d: number) => {
    const t = nature!.paving.clone(), n = nature!.pavingN.clone();
    for (const m of [t, n]) { m.repeat.set(w / 2.4, d / 2.4); m.needsUpdate = true; }
    return mat("#f6eee2", { map: t, normalMap: n, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.88 });
  };
  const pave = (w: number, d: number, x: number, z: number) => {
    if (nature) return flat(w, d, realPaving(w, d), x, z, 0.015);
    const t = paveT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 0.9, d / 0.9);
    t.needsUpdate = true;
    return flat(w, d, mat("#f3ece0", { map: t, roughness: 0.9 }), x, z, 0.015);
  };
  // a stone kerb along each side of a path (x0..x1 or z0..z1 at a fixed line)
  const kerbM = mat("#bdb3a2", { roughness: 0.85 });
  const kerbs = batch(scene, false);
  const kerbX = (x: number, z0: number, z1: number) => kerbs.box(0.14, 0.08, Math.abs(z1 - z0), kerbM, x, 0.04, (z0 + z1) / 2);
  const kerbZ = (z: number, x0: number, x1: number) => kerbs.box(Math.abs(x1 - x0), 0.08, 0.14, kerbM, (x0 + x1) / 2, 0.04, z);
  // the path: from the shop's doors down to the gate, and out to each place
  pave(2.6, 25, 0, 3.5);
  pave(7.0, 1.8, -3.6, -5.8);
  pave(6.6, 1.8, 3.8, 2.2);
  pave(8.4, 8.4, 0, -11 + 4.2); // the forecourt in front of the shop
  flat(5.4, 5.4, nature ? realPaving(5.4, 5.4) : mat("#ffffff", { map: canvasTex(pavingCanvas(), [4.5, 4.5]), roughness: 0.9 }), FOUNTAIN.x, FOUNTAIN.z, 0.017);
  flat(PARK.x1 - PARK.x0, PARK.z1 - PARK.z0, mat("#ffffff", { map: canvasTex(gravelCanvas(), [6, 4]), roughness: 1 }), (PARK.x0 + PARK.x1) / 2, (PARK.z0 + PARK.z1) / 2, 0.014);
  flat(PADDOCK.x1 - PADDOCK.x0, PADDOCK.z1 - PADDOCK.z0, mat("#7b8d43", { roughness: 1 }), (PADDOCK.x0 + PADDOCK.x1) / 2, (PADDOCK.z0 + PADDOCK.z1) / 2, 0.008);
  flat(6.2, 3.6, mat("#ffffff", { map: canvasTex(gravelCanvas("#b8a17a"), [3, 2]), roughness: 1 }), -10.6, 6.5, 0.011); // the stable yard
  flat(GAZEBO.w + 1.0, GAZEBO.d + 1.0, mat("#ffffff", { map: canvasTex(boardsCanvas("#9c7552"), [3, 4]), roughness: 0.8 }), GAZEBO.x, GAZEBO.z, 0.03);
  // kerbs: the main path (gaps where the side paths and the fountain court join)
  kerbX(-1.37, 0.5, 16.0);
  kerbX(1.37, 0.5, 1.3); kerbX(1.37, 3.1, 16.0);
  kerbZ(-4.83, -7.1, -4.2); kerbZ(-6.77, -7.1, -4.2); // to the cabinet
  kerbZ(1.23, 1.37, 7.1); kerbZ(3.17, 1.37, 7.1); // to the gazebo
  kerbs.done();

  // Things the camera must not sit behind: it moves in front of them instead.
  const occluders: any[] = [];

  // ── Where you can't walk ──
  const BOXES: [number, number, number, number][] = [];
  const CIRCLES: [number, number, number][] = [];
  const solid = (x0: number, x1: number, z0: number, z1: number) => BOXES.push([x0, x1, z0, z1]);

  // ── The loaders ──
  const draco = new DRACOLoader();
  draco.setDecoderPath("/star/shop3d/draco/");
  draco.setDecoderConfig({ type: "wasm" });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco); // props.glb
  await withMeshopt(loader); // people, clips, horse, bird (scripts/perf3d/shrink-models.mjs)
  let loaded = 0;
  const load = (url: string) => loadGltfCached(loader, url).then((g: any) => { loaded++; return g; });
  // You are the 3D shop's own player: the approved people3d body when the
  // shop's player is New (its default), else the old character.glb.
  const newPerson = (data.player?.look ?? "new") === "new";
  const personModel = playerModelFor(data.player?.hairStyle);
  const [propsG, charG, animG, gardenAnimG] = await Promise.all(newPerson ? [
    load("/star/garden3d/props.glb"),
    loadPeople3d(loader, personModel, people3dLook()).then((g: any) => { loaded++; return g; }),
    loadPeople3d(loader, "anims", people3dLook()).then((g: any) => { loaded++; return g; }),
    Promise.resolve(null),
  ] : [
    load("/star/garden3d/props.glb"),
    load("/star/shop3d/character.glb"),
    load("/star/shop3d/anims.glb").then((g: any) => withMocapOwn(loader, g, "ual")),
    load("/star/garden3d/anims.glb"),
  ]);
  if (disposed) throw new Error("disposed");
  // Each piece by its key, as ALL its parts (a tree is trunk + leaves, two
  // meshes). The old garden kept only single-mesh pieces, so every tree, the
  // paddock fence, the fountain basin and the potted plants never appeared.
  const pieces = new Map<string, { geometry: any; material: any }[]>();
  propsG.scene.updateMatrixWorld(true);
  for (const top of propsG.scene.children) {
    const inv = top.matrixWorld.clone().invert();
    const parts: { geometry: any; material: any }[] = [];
    top.traverse((o: any) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(inv.clone().multiply(o.matrixWorld));
      parts.push({ geometry: g, material: o.material });
    });
    if (parts.length) pieces.set(top.name, parts);
  }
  const leafFix = new Map<any, any>();
  pieces.forEach((parts, key) => {
    if (!key.startsWith("tree_")) return;
    for (const part of parts) {
      const n = String(part.material?.name ?? "");
      if (!/^leafs/i.test(n)) continue;
      if (!leafFix.has(part.material)) {
        const m2 = part.material.clone();
        m2.color.set(/dark/i.test(n) ? "#3d6a2a" : key.includes("pine") ? "#45703a" : "#5d8d36");
        m2.roughness = 0.9;
        m2.envMapIntensity = 0.4;
        leafFix.set(part.material, m2);
      }
      part.material = leafFix.get(part.material);
      if (!key.includes("pine")) puffLeaves(part);
      softenLeaves(part);
    }
  });
  // Look H: every Kenney tree becomes a real one the same size (bark, a crown of scanned leaves or fir twigs)
  if (nature) {
    let k = 0;
    pieces.forEach((parts, key) => {
      if (!key.startsWith("tree_")) return;
      const bb = new THREE.Box3();
      for (const p of parts) { p.geometry.computeBoundingBox(); bb.union(p.geometry.boundingBox); }
      const size = bb.getSize(new THREE.Vector3());
      const pine = key.includes("pine");
      const tint = key === "tree_fat" ? "#b8d894" : key === "tree_tall" ? "#c8e2a0" : key === "tree_oak" ? "#afcf88" : undefined;
      pieces.set(key, makeTree(THREE, nature, { h: size.y, w: Math.max(size.x, size.z), pine, seed: 101 + k++ * 37, tint }));
    });
    // the paddock rails: weathered timber, not orange
    for (const p of pieces.get("fence_wood") ?? []) { p.material = p.material.clone(); p.material.color.set("#8f7458"); p.material.roughness = 0.92; }
  }
  /**
   * Rounder crowns (the broadleaf trees; the pines keep their layered cones).
   * Kenney's crowns are a few hard-edged blocks; each block is swapped for a
   * smooth, slightly fuller ball the same size and in the same place, so the
   * tree keeps its outline and size but reads soft, like the people. 80
   * triangles a ball, shared by every copy of that tree (they are instanced).
   */
  function puffLeaves(part: { geometry: any; material: any }) {
    if (part.geometry.userData.puffed) return;
    const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    const pos = g.attributes.position;
    const n = pos.count;
    // which block each corner belongs to: corners at the same spot are joined
    const parent = new Int32Array(n).map((_, i) => i);
    const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const join = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
    const seen = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i); else join(i, j);
    }
    for (let t = 0; t < n; t += 3) { join(t, t + 1); join(t, t + 2); }
    const boxes = new Map<number, any>();
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const r0 = find(i);
      if (!boxes.has(r0)) boxes.set(r0, new THREE.Box3());
      boxes.get(r0).expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
    const ball = new THREE.IcosahedronGeometry(1, 1);
    const balls: any[] = [];
    const c = new THREE.Vector3(), h = new THREE.Vector3();
    boxes.forEach((bb) => {
      bb.getCenter(c); bb.getSize(h).multiplyScalar(0.5 * 1.12);
      h.x = Math.max(h.x, 1e-3); h.y = Math.max(h.y, 1e-3); h.z = Math.max(h.z, 1e-3);
      const b = ball.clone();
      const bp = b.attributes.position, bn = b.attributes.normal;
      for (let i = 0; i < bp.count; i++) {
        const ux = bp.getX(i), uy = bp.getY(i), uz = bp.getZ(i);
        bp.setXYZ(i, c.x + ux * h.x, c.y + uy * h.y, c.z + uz * h.z);
        v.set(ux / h.x, uy / h.y, uz / h.z).normalize();
        bn.setXYZ(i, v.x, v.y, v.z);
      }
      b.deleteAttribute("uv");
      balls.push(b);
    });
    const out = mergeGeometries(balls);
    if (!out) return;
    out.userData.puffed = true;
    part.geometry = out;
  }
  /**
   * Softer trees, for nothing extra to draw (Harry: the trees "look very
   * blocky next to the smooth people"). Kenney's leaves are faceted blocks: each
   * face its own flat shade. Here every leaf point is lit as if it sat on a
   * round canopy (its normal points out from the canopy's middle, mixed with a
   * little of its own), so the light rolls smoothly over the whole crown like
   * a painted tree; and the underside is a touch darker, as under real leaves.
   * Same triangles, same draw calls.
   */
  function softenLeaves(part: { geometry: any; material: any }) {
    if (part.geometry.userData.soft) return;
    const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox, c = new THREE.Vector3();
    bb.getCenter(c);
    const half = new THREE.Vector3().subVectors(bb.max, bb.min).multiplyScalar(0.5);
    const pos = g.attributes.position, nor = g.attributes.normal;
    const col = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      // out from the middle, the crown squashed to a ball first
      n.set((v.x - c.x) / Math.max(1e-3, half.x), (v.y - c.y) / Math.max(1e-3, half.y) + 0.25, (v.z - c.z) / Math.max(1e-3, half.z)).normalize();
      if (nor) { n.multiplyScalar(0.8).addScaledVector(v.set(nor.getX(i), nor.getY(i), nor.getZ(i)), 0.2).normalize(); nor.setXYZ(i, n.x, n.y, n.z); }
      const up = (pos.getY(i) - bb.min.y) / Math.max(1e-3, bb.max.y - bb.min.y);
      const k = 0.72 + 0.36 * up;
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.userData.soft = true;
    part.geometry = g;
    if (!part.material.vertexColors) { part.material.vertexColors = true; part.material.flatShading = false; part.material.needsUpdate = true; }
  }
  /** Many copies of one piece, one draw call per part: [x, z, scale, rotY, sx?, sy?, sz?, y?]. */
  const many = (key: string, at: number[][], cast = true) => {
    const parts = pieces.get(key);
    if (!parts || !at.length) return null;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const holder = new THREE.Group();
    for (const part of parts) {
      const im = new THREE.InstancedMesh(part.geometry, part.material, at.length);
      at.forEach((a, i) => {
        const [x, z, s, ry = 0, sx = 1, sy = 1, sz = 1, y = 0] = a;
        q.setFromEuler(e.set(0, ry, 0));
        m4.compose(v.set(x, y, z), q, sc.set(s * sx, s * sy, s * sz));
        im.setMatrixAt(i, m4);
      });
      im.computeBoundingSphere();
      // leaf cards: the shadow is cut out by the leaves, not the card
      if (part.material.userData?.depth) { im.customDepthMaterial = part.material.userData.depth; im.customDistanceMaterial = part.material.userData.distance; }
      im.castShadow = cast;
      im.receiveShadow = true;
      holder.add(im);
    }
    scene.add(holder);
    if (cast) occluders.push(holder);
    return holder;
  };
  const one = (key: string, x: number, z: number, s: number, ry = 0, y = 0) => {
    const parts = pieces.get(key);
    if (!parts) return null;
    const m = new THREE.Group();
    for (const part of parts) {
      const me = new THREE.Mesh(part.geometry, part.material);
      me.castShadow = true;
      me.receiveShadow = true;
      m.add(me);
    }
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.scale.setScalar(s);
    scene.add(m);
    return m;
  };

  // ── The boundary: it grows with your home (fence → hedge → brick wall) ──
  // Long single runs, not a row of little pieces: a close-boarded fence, a
  // tall clipped hedge, or a brick wall with stone coping and piers.
  const B = 19;
  const GATE = 1.8;
  const bound = batch(scene);
  // each side as [x0, z0, x1, z1]; the south side has the gate in it
  const sides: [number, number, number, number][] = [[-B, -B, B, -B], [-B, -B, -B, B], [B, -B, B, B], [-B, B, -GATE, B], [GATE, B, B, B]];
  const runOf = (s4: [number, number, number, number], h: number, t: number, m: any, y0 = 0, grow = 0) => {
    const [x0, z0, x1, z1] = s4;
    const len = Math.hypot(x1 - x0, z1 - z0) + grow;
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const tex = m.map;
    if (tex) { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / (tex.userData.tile ?? 2), h / (tex.userData.tileH ?? tex.userData.tile ?? 2)); t.needsUpdate = true; m = m.clone(); m.map = t; }
    const me = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : t, h, alongX ? t : len), m);
    me.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
    me.castShadow = true; me.receiveShadow = true;
    scene.add(me);
    return me;
  };
  if (data.tier >= 3) {
    const brickT = canvasTex(brickCanvas());
    brickT.userData.tile = 0.45; brickT.userData.tileH = 0.6;
    const brickM = mat("#ffffff", { map: brickT, roughness: 0.9 });
    const copeM = mat("#d8d0c0", { roughness: 0.8 });
    for (const sd of sides) { runOf(sd, 1.75, 0.35, brickM); runOf(sd, 0.1, 0.48, copeM, 1.75, 0.2); }
    for (const [x, z, h] of [[-GATE - 0.3, B, 2.3], [GATE + 0.3, B, 2.3], [-B, -B, 2.1], [B, -B, 2.1], [-B, B, 2.1], [B, B, 2.1]]) {
      bound.box(0.7, h, 0.7, brickM, x, h / 2, z);
      bound.box(0.86, 0.14, 0.86, copeM, x, h + 0.07, z);
      bound.put(new THREE.SphereGeometry(0.2, 14, 10), copeM, x, h + 0.34, z);
    }
  } else if (data.tier >= 1) {
    const hedgeT = canvasTex(hedgeCanvas());
    hedgeT.userData.tile = 1.6;
    const hedgeM = mat("#ffffff", { map: hedgeT, roughness: 0.95 });
    for (const sd of sides) runOf(sd, 1.9, 0.9, hedgeM);
    for (const x of [-GATE - 0.25, GATE + 0.25]) bound.box(0.35, 2.2, 0.35, mat("#7a5a3c", { roughness: 0.8 }), x, 1.1, B);
  } else {
    const fenceT = canvasTex(boardsCanvas("#8d6440"));
    fenceT.userData.tile = 1.0; fenceT.userData.tileH = 1.6;
    const fenceM = mat("#ffffff", { map: fenceT, roughness: 0.85 });
    const postM = mat("#5e4029", { roughness: 0.85 });
    for (const sd of sides) {
      runOf(sd, 1.6, 0.06, fenceM);
      const [x0, z0, x1, z1] = sd;
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 2.4));
      for (let k = 0; k <= n; k++) bound.box(0.14, 1.75, 0.14, postM, x0 + ((x1 - x0) * k) / n, 0.875, z0 + ((z1 - z0) * k) / n);
    }
  }
  bound.done();

  // ── Trees: a ring beyond the boundary, a few inside ──
  const treeKeys = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_tall", "tree_pine", "tree_pine2"];
  const treeAt: Record<string, number[][]> = {};
  const plant = (key: string, x: number, z: number, s: number, ry = 0) => { (treeAt[key] ??= []).push([x, z, s, ry]); };
  let seed = 12345;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const d = 23 + r() * 9;
    plant(treeKeys[i % treeKeys.length], Math.cos(a) * d, Math.sin(a) * d, 4.6 + r() * 2.4, r() * 6);
  }
  // a tall tree line just behind the back boundary: the backdrop above the
  // shop's roof as you walk in from the gate
  for (let k = 0; k < 15; k++) {
    const x = -19 + k * 2.7 + (r() - 0.5) * 1.2;
    plant(["tree_default", "tree_tall", "tree_detailed", "tree_pine2", "tree_oak"][k % 5], x, -21.2 - r() * 2.4, 5.6 + r() * 2.2, r() * 6);
  }
  // and along both sides, thinner
  for (let k = 0; k < 8; k++) {
    for (const sx of [-1, 1]) plant(["tree_default", "tree_detailed", "tree_pine", "tree_fat"][(k + (sx > 0 ? 1 : 0)) % 4], sx * (21.5 + r() * 2.5), -16 + k * 4.4, 4.0 + r() * 1.6, r() * 6);
  }
  // (the oak that stood at -17, -15.5 made way for the training pitch, 8 Oct 2026)
  plant("tree_detailed", 16.8, -15.8, 4.8, 2);
  plant("tree_fat", 17, -2, 4.2, 0.4); plant("tree_default", -17.2, -5.5, 4.4, 2.2);
  plant("tree_oak", 17.2, -9.5, 4.4, 1.3); plant("tree_tall", -3.6, 16.2, 3.6); plant("tree_tall", 3.6, 16.2, 3.6);
  // the far ring casts no shadow (it is outside the shadow's reach anyway)
  for (const [k, list] of Object.entries(treeAt)) {
    many(k, list.filter(([x, z]) => Math.hypot(x, z) <= 26));
    many(k, list.filter(([x, z]) => Math.hypot(x, z) > 26), false);
  }
  for (const [x, z] of [[16.8, -15.8], [17, -2], [-17.2, -5.5], [17.2, -9.5], [-3.6, 16.2], [3.6, 16.2]]) CIRCLES.push([x, z, 0.8]);

  // flower beds down the path, bushes, grass tufts
  // flower beds either side of the path: dark soil, low green, bright blooms
  const soilM = mat("#4a3326", { roughness: 1 });
  const leafM = mat("#3f7d34", { roughness: 0.9, flatShading: true });
  const bloomCols = ["#ff5a6e", "#ffd23f", "#b47cff", "#ffffff", "#ff8a3d"];
  const leafAt: number[][] = [];
  const bloomAt: number[][][] = bloomCols.map(() => []);
  const beds: [number, number, number][] = [[-2.15, 7.9, 7.6], [2.15, 7.9, 7.6], [-2.15, 14.4, 3.2], [2.15, 14.4, 3.2], [-2.15, -5.4 + 6.2, 2.2], [2.15, -5.4 + 6.2, 2.2]];
  for (const [x, zc, len] of beds) {
    box(0.95, 0.12, len, soilM, x, 0.06, zc, false);
    box(1.05, 0.14, 0.08, mat("#d9d2c4"), x, 0.07, zc - len / 2, false);
    box(1.05, 0.14, 0.08, mat("#d9d2c4"), x, 0.07, zc + len / 2, false);
    for (let k = 0; k < len * 9; k++) {
      const px = x + (r() - 0.5) * 0.8, pz = zc + (r() - 0.5) * (len - 0.2);
      leafAt.push([px, pz, 0.11 + r() * 0.06]);
      if (r() < 0.75) bloomAt[Math.floor(r() * bloomCols.length)].push([px + (r() - 0.5) * 0.1, pz + (r() - 0.5) * 0.1, 0.045 + r() * 0.025]);
    }
  }
  const sphereMany = (m: any, at: number[][], y: number, geo = new THREE.IcosahedronGeometry(1, 1)) => {
    const im = new THREE.InstancedMesh(geo, m, at.length);
    const m4 = new THREE.Matrix4();
    at.forEach(([x, z, sc], i) => { m4.makeScale(sc, sc * 0.8, sc); m4.setPosition(x, y + sc * 0.5, z); im.setMatrixAt(i, m4); });
    im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  if (nature) {
    // look H: hydrangea bushes along each bed (leaf cards, white / blue / pink heads)
    const fb = makeFlowerBeds(THREE, nature, beds, 7);
    for (const m of [fb.leaves, fb.heads]) { m.receiveShadow = true; scene.add(m); }
  } else {
  sphereMany(leafM, leafAt, 0.1);
  bloomAt.forEach((at, i) => sphereMany(mat(bloomCols[i], { roughness: 0.6, emissive: bloomCols[i], emissiveIntensity: night ? 0.05 : 0.12 }), at, 0.24));
  }
  // round leafy bushes (Kenney's read as dark spikes at this size)
  const bushM = mat("#33652b", { roughness: 0.9 });
  const bushLightM = mat("#46803a", { roughness: 0.9 });
  const bushAt: number[][] = [], bushLightAt: number[][] = [];
  const bush = (x: number, z: number, sz: number) => {
    // inside the casino or the training pitch (8 Oct 2026): not planted, but
    // its random numbers are still drawn, so every other bush stays put
    const gone = (x > CASINO.x0 - 0.5 && x < CASINO.x1 + 0.5 && z < CASINO.z1 + 0.5) || (x > PITCH.x0 - 0.5 && x < PITCH.x1 + 0.5 && z < PITCH.z1 + 0.5);
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2, d = r() * sz * 0.45;
      const sc = sz * (0.42 + r() * 0.2);
      if (!gone) (k % 2 ? bushLightAt : bushAt).push([x + Math.cos(a) * d, z + Math.sin(a) * d, sc]);
    }
    if (!gone) CIRCLES.push([x, z, sz * 0.55]);
  };
  // shrubs in the corners and either side of the gate, planted in groups
  for (const [x, z, sz] of [[-2.6, 17.4, 1.3], [2.6, 17.4, 1.3], [17.2, -12.5, 1.6], [16.4, -14.0, 1.2], [-17.2, 15, 1.6], [-16.2, 16.6, 1.1], [12.6, -12, 1.3], [-12.4, -12.6, 1.4], [17.0, 6.0, 1.4], [-17.2, -1.0, 1.3]]) bush(x, z, sz);
  const smoothBall = new THREE.IcosahedronGeometry(1, 2);
  occluders.push(sphereMany(bushM, bushAt, -0.05, smoothBall), sphereMany(bushLightM, bushLightAt, 0.05, smoothBall));
  // clipped box hedges framing the shop's forecourt, and two topiary balls
  // in square planters either side of the trophy cabinet
  const boxHedgeT = canvasTex(hedgeCanvas("#2c5a25"), [1, 1]);
  const boxHedgeM = mat("#ffffff", { map: boxHedgeT, roughness: 0.95 });
  const clipped = batch(scene);
  // (the left one stops short of the path to the trophy cabinet)
  for (const [x, z0, z1] of [[-5.0, -8.9, -7.0], [5.0, -8.9, -7.0]]) { // (the right one stops short of the path to the casino, 8 Oct 2026)
    clipped.box(0.7, 0.75, z1 - z0, boxHedgeM, x, 0.375, (z0 + z1) / 2);
    solid(x - 0.35, x + 0.35, z0, z1);
  }
  const planterM = mat("#e9e1d2", { roughness: 0.7 });
  for (const dz of [-2.4, 2.4]) {
    clipped.box(0.7, 0.6, 0.7, planterM, CABINET.x + 1.0, 0.3, CABINET.z + dz);
    clipped.put(new THREE.IcosahedronGeometry(0.48, 3), boxHedgeM, CABINET.x + 1.0, 1.05, CABINET.z + dz);
    clipped.box(0.07, 0.3, 0.07, mat("#5a3b25"), CABINET.x + 1.0, 0.7, CABINET.z + dz);
    CIRCLES.push([CABINET.x + 1.0, CABINET.z + dz, 0.45]);
  }
  occluders.push(...clipped.done());
  const tufts: number[][] = [];
  for (let i = 0; i < 220; i++) {
    const x = -18 + r() * 36, z = -8 + r() * 26;
    if (Math.abs(x) < 2.2 || (x < PADDOCK.x1 + 0.5 && x > PADDOCK.x0 - 0.5 && z > PADDOCK.z0 && z < PADDOCK.z1) || (x > PARK.x0 && z > PARK.z0) || Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 3) continue;
    tufts.push([x, z, 2.2 + r() * 1.4, r() * 6]);
  }
  void tufts; // Kenney's grass reads as dark spikes at this size; the mown lawn is enough

  // ── The shop, where the house was: a real small shop front ──
  // Brick, a slate roof with a chimney, and a painted green shopfront: fascia
  // with the name in gold, pilasters, two lit display windows (your kit on
  // stands, a ball, a cup), striped awnings, double doors standing open onto
  // the warm inside. Merged by material: a dozen draws for the whole shop.
  const shopG = new THREE.Group();
  occluders.push(shopG);
  shopG.position.set((SHOP.x0 + SHOP.x1) / 2, 0, (SHOP.z0 + SHOP.z1) / 2);
  scene.add(shopG);
  const W = SHOP.x1 - SHOP.x0, D = SHOP.z1 - SHOP.z0;
  const FF = D / 2; // the front, in the shop's own frame
  const TOP = 6.6, RH = 2.0; // the eaves, and the roof's height above them
  const sb = batch(shopG);
  const shopBrickT = canvasTex(brickCanvas("#a0563a"), [W / 0.45, TOP / 0.6]);
  const shopBrickM = mat("#ffffff", { map: shopBrickT, roughness: 0.9 });
  const sideBrickT = canvasTex(brickCanvas("#a0563a"), [D / 0.45, TOP / 0.6]);
  const sideBrickM = mat("#ffffff", { map: sideBrickT, roughness: 0.9 });
  const greenM = mat("#1f4a35", { roughness: 0.45 });
  const goldM = mat("#c9a14f", { roughness: 0.3, metalness: 0.85 });
  const creamM = mat("#efe6d4", { roughness: 0.6 });
  const stoneTrimM = mat("#ddd4c3", { roughness: 0.8 });
  const shopGlassM = new THREE.MeshStandardMaterial({ color: "#a9c4cf", transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0.9, depthWrite: false, envMapIntensity: 1.6 });
  const insideM = new THREE.MeshStandardMaterial({ color: "#f3e4c8", emissive: "#ffcf8a", emissiveIntensity: night ? 1.1 : 0.45, roughness: 0.8 });
  // the brick body (front face 1 m behind the shopfront) and its two sides
  const bodyM = [sideBrickM, sideBrickM, creamM, creamM, shopBrickM, shopBrickM];
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, TOP, D - 1.0), bodyM);
  body.position.set(0, TOP / 2, -0.5);
  body.castShadow = true; body.receiveShadow = true;
  shopG.add(body);
  const slabBrickM = mat("#ffffff", { map: canvasTex(brickCanvas("#a0563a"), [2.2, TOP / 0.6]), roughness: 0.9 });
  for (const sx of [-1, 1]) sb.box(0.3, TOP, 1.0, slabBrickM, sx * (W / 2 - 0.15), TOP / 2, FF - 0.5);
  // upper storey: brick over the shopfront, two sash windows, a stone cornice
  sb.box(W, TOP - 3.9, 0.3, shopBrickM, 0, 3.9 + (TOP - 3.9) / 2, FF - 0.15);
  // the flat upstairs: grey-blue glass by day, a warm lamp on after dark
  const upWinM = mat("#4d6470", { roughness: 0.15, metalness: 0.3, emissive: "#ffc77a", emissiveIntensity: night ? 0.9 : data.sky === "sunset" ? 0.25 : 0 });
  for (const sx of [-1, 1]) {
    const wx = sx * 3.3;
    sb.box(1.4, 1.6, 0.06, upWinM, wx, 5.15, FF + 0.02);
    sb.box(1.56, 0.12, 0.14, creamM, wx, 5.15 + 0.86, FF + 0.04);
    sb.box(1.7, 0.12, 0.22, stoneTrimM, wx, 5.15 - 0.86, FF + 0.08);
    for (const dx of [-0.74, 0, 0.74]) sb.box(0.08, 1.6, 0.1, creamM, wx + dx, 5.15, FF + 0.04);
    sb.box(1.4, 0.07, 0.1, creamM, wx, 5.15, FF + 0.05);
  }
  sb.box(W + 0.3, 0.26, 0.55, stoneTrimM, 0, TOP + 0.13, FF - 0.1);
  // the slate roof, its brick gables and a chimney
  const hd = D / 2 + 0.25, slant = Math.hypot(hd, RH), pitch = Math.atan2(RH, hd);
  const slateM = mat("#ffffff", { map: canvasTex(slateCanvas(), [W / 2, slant / 2]), roughness: 0.75 });
  sb.box(W + 0.5, 0.14, slant, slateM, 0, TOP + 0.26 + RH / 2, hd / 2, 0, pitch);
  sb.box(W + 0.5, 0.14, slant, slateM, 0, TOP + 0.26 + RH / 2, -hd / 2, 0, -pitch);
  sb.box(W + 0.55, 0.16, 0.2, mat("#2c2f35", { roughness: 0.6 }), 0, TOP + 0.3 + RH, 0);
  const gable = new THREE.Shape();
  gable.moveTo(-hd + 0.2, 0); gable.lineTo(hd - 0.2, 0); gable.lineTo(0, RH - 0.1); gable.closePath();
  for (const sx of [-1, 1]) sb.put(new THREE.ExtrudeGeometry(gable, { depth: 0.3, bevelEnabled: false }), mat("#ffffff", { map: canvasTex(brickCanvas("#a0563a"), [1 / 0.45, 1 / 0.6]), roughness: 0.9 }), sx * (W / 2 - 0.15) - 0.15, TOP + 0.26, 0, 0, Math.PI / 2, 0);
  sb.box(0.9, 2.4, 0.9, mat("#ffffff", { map: canvasTex(brickCanvas("#a0563a"), [2, 4]), roughness: 0.9 }), -3.6, TOP + RH + 0.2, -1.0);
  sb.box(1.05, 0.16, 1.05, stoneTrimM, -3.6, TOP + RH + 1.45, -1.0);
  for (const dx of [-0.2, 0.2]) sb.put(new THREE.CylinderGeometry(0.11, 0.13, 0.4, 10), mat("#a8603f", { roughness: 0.8 }), -3.6 + dx, TOP + RH + 1.73, -1.0);
  // the shopfront: cornice, fascia (the name), pilasters with gold capitals
  sb.box(W + 0.1, 0.2, 0.55, greenM, 0, 3.9, FF + 0.12);
  sb.box(W - 0.2, 0.78, 0.3, greenM, 0, 3.4, FF + 0.1);
  for (const y of [3.02, 3.78]) sb.box(W - 0.3, 0.04, 0.05, goldM, 0, y, FF + 0.27);
  for (const px of [-(W / 2 - 0.3), -(DOOR.half + 0.22), DOOR.half + 0.22, W / 2 - 0.3]) {
    sb.box(0.44, 3.0, 0.36, greenM, px, 1.5, FF + 0.06);
    sb.box(0.56, 0.22, 0.48, goldM, px, 3.0, FF + 0.1);
    sb.box(0.56, 0.18, 0.46, greenM, px, 0.09, FF + 0.08);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4 * 192 / 1024),
    new THREE.MeshBasicMaterial({ map: canvasTex(neonCanvas("KNOWITBALL", "#ffd77a")), transparent: true, depthWrite: false, toneMapped: false }));
  sign.position.set(0, 3.4, FF + 0.26);
  shopG.add(sign);
  // the two display windows: a stallriser, glass with glazing bars, and
  // inside, a lit back wall, a platform, your kit on stands, a ball and a cup
  const bayX = (DOOR.half + 0.44 + (W / 2 - 0.52)) / 2, bayW = W / 2 - 0.52 - (DOOR.half + 0.44);
  const shirtShape = new THREE.Shape();
  shirtShape.moveTo(-0.16, 0); shirtShape.lineTo(0.16, 0); shirtShape.lineTo(0.17, 0.42); shirtShape.lineTo(0.3, 0.33); shirtShape.lineTo(0.36, 0.42);
  shirtShape.lineTo(0.2, 0.56); shirtShape.lineTo(0.07, 0.56); shirtShape.quadraticCurveTo(0, 0.5, -0.07, 0.56); shirtShape.lineTo(-0.2, 0.56);
  shirtShape.lineTo(-0.36, 0.42); shirtShape.lineTo(-0.3, 0.33); shirtShape.lineTo(-0.17, 0.42); shirtShape.closePath();
  const shirtM = mat(data.kit.shirt, { roughness: 0.7, side: THREE.DoubleSide });
  const trimM = mat(data.kit.trim, { roughness: 0.7 });
  const ballM2 = mat("#f4f4f4", { roughness: 0.45 });
  const cupGeo2 = new THREE.LatheGeometry([new THREE.Vector2(0.0, 0), new THREE.Vector2(0.11, 0), new THREE.Vector2(0.11, 0.04), new THREE.Vector2(0.04, 0.07), new THREE.Vector2(0.03, 0.18), new THREE.Vector2(0.14, 0.26), new THREE.Vector2(0.16, 0.42), new THREE.Vector2(0.15, 0.43)], 16);
  for (const sx of [-1, 1]) {
    const bx = sx * bayX;
    sb.box(bayW, 0.6, 0.26, greenM, bx, 0.3, FF + 0.02);
    sb.box(bayW - 0.3, 0.36, 0.04, mat("#183a2a", { roughness: 0.5 }), bx, 0.3, FF + 0.16);
    sb.box(bayW, 0.1, 0.32, goldM, bx, 0.62, FF + 0.04);
    sb.box(bayW, 0.12, 0.3, greenM, bx, 2.94, FF + 0.04);
    sb.box(bayW, 0.07, 0.12, greenM, bx, 2.45, FF + 0.06);
    for (const k of [-1, 1]) sb.box(0.07, 2.3, 0.12, greenM, bx + (k * bayW) / 6, 1.75, FF + 0.06);
    sb.box(bayW, 2.3, 0.02, shopGlassM, bx, 1.75, FF + 0.02);
    // inside the window
    sb.box(bayW, 3.0, 0.04, insideM, bx, 1.5, FF - 0.97);
    sb.box(bayW, 0.62, 0.9, mat("#5b3a26", { roughness: 0.6 }), bx, 0.31, FF - 0.5);
    sb.box(bayW, 0.08, 1.0, creamM, bx, 3.0, FF - 0.5);
    // two shirts on stands, a ball on a plinth, a cup on a plinth
    for (const k of [-0.32, 0.12]) {
      const sxp = bx + k * bayW;
      sb.put(new THREE.ShapeGeometry(shirtShape), shirtM, sxp, 1.25, FF - 0.55, 0, 0, 0, 1.25, 1.25, 1);
      sb.box(0.5, 0.06, 0.05, trimM, sxp, 1.25 + 0.02, FF - 0.545);
      sb.box(0.04, 0.62, 0.04, goldM, sxp, 0.93, FF - 0.6);
    }
    sb.box(0.34, 0.5, 0.34, creamM, bx + 0.38 * bayW * (sx > 0 ? 1 : 0.9), 0.87, FF - 0.45);
    if (sx < 0) sb.put(new THREE.IcosahedronGeometry(0.15, 2), ballM2, bx + 0.34 * bayW, 1.27, FF - 0.45);
    else sb.put(cupGeo2, goldM, bx + 0.38 * bayW, 1.12, FF - 0.45);
  }
  // the doorway: a floor, a lit inside beyond, a fanlight, both doors open
  sb.box(W - 0.6, 0.03, 1.0, mat("#8a5a36", { roughness: 0.6 }), 0, 0.015, FF - 0.5);
  sb.box(DOOR.half * 2 + 0.6, 0.06, 0.55, stoneTrimM, 0, 0.03, FF + 0.27);
  sb.box(DOOR.half * 2, 0.16, 0.12, greenM, 0, DOOR.h + 0.08, FF + 0.02);
  sb.box(DOOR.half * 2, 0.2, 0.02, shopGlassM, 0, DOOR.h + 0.06, FF + 0.08);
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.half * 2, DOOR.h), new THREE.MeshBasicMaterial({ color: "#ffdcaa", fog: false, toneMapped: false }));
  inside.position.set(0, DOOR.h / 2, FF - 0.95);
  shopG.add(inside);
  const leafW = DOOR.half - 0.04, open = 1.25;
  for (const sx of [-1, 1]) {
    const hx = sx * DOOR.half, ry = sx > 0 ? Math.PI - open : open;
    const cx = hx - sx * Math.cos(open) * leafW / 2, cz = FF - 0.05 - Math.sin(open) * leafW / 2;
    sb.box(leafW, DOOR.h - 0.05, 0.06, greenM, cx, (DOOR.h - 0.05) / 2, cz, ry);
    sb.box(leafW - 0.3, DOOR.h - 0.9, 0.08, shopGlassM, cx, DOOR.h / 2 + 0.15, cz, ry);
  }
  // lamps either side of the door, and the striped awnings
  for (const sx of [-1, 1]) {
    sb.box(0.16, 0.3, 0.16, glow("#ffd59a", night ? 3 : 1.2), sx * 1.85, 2.25, FF + 0.34);
    sb.box(0.22, 0.05, 0.22, goldM, sx * 1.85, 2.42, FF + 0.34);
  }
  const awnT = canvasTex(stripeCanvas("#f2ead8", "#1f4a35"));
  const awnM = mat("#ffffff", { map: awnT, roughness: 0.85, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const bx = sx * bayX, drop = 0.5, reach = 1.15, tilt = Math.atan2(drop, reach);
    sb.box(bayW + 0.1, 0.04, Math.hypot(drop, reach), awnM, bx, 2.97 - drop / 2, FF + 0.18 + reach / 2, 0, tilt);
    sb.box(bayW + 0.1, 0.22, 0.03, awnM, bx, 2.97 - drop - 0.1, FF + 0.2 + reach);
  }
  // bay trees in square planters either side of the step
  for (const sx of [-1, 1]) {
    const px = sx * 1.9, pz = FF + 0.6;
    sb.box(0.56, 0.56, 0.56, greenM, px, 0.28, pz);
    sb.box(0.62, 0.05, 0.62, goldM, px, 0.58, pz);
    sb.box(0.05, 0.7, 0.05, mat("#5a3b25"), px, 0.95, pz);
    sb.put(new THREE.IcosahedronGeometry(0.42, 3), boxHedgeM, px, 1.55, pz);
  }
  sb.done();
  // a glow on the forecourt from the door
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshBasicMaterial({ map: canvasTex(glowCanvas()), transparent: true, depthWrite: false, opacity: night ? 0.75 : 0.25 }));
  doorGlow.rotation.x = -Math.PI / 2;
  doorGlow.position.set(0, 0.025, SHOP.z1 + 1.1);
  scene.add(doorGlow);
  solid(SHOP.x0 - 0.2, SHOP.x1 + 0.2, SHOP.z0 - 0.2, SHOP.z1 + 0.1);
  CIRCLES.push([-1.9, SHOP.z1 + 0.6, 0.4], [1.9, SHOP.z1 + 0.6, 0.4]);

  // lanterns down the path (lit at night)
  const lampAt = [[-1.65, -7.2], [1.65, -7.2], [-1.65, 6], [1.65, 6], [-1.65, 13], [1.65, 13]];
  many("lantern", lampAt.map(([x, z]) => [x, z, 1.25]));
  const lampHeads: any[] = [];
  for (const [x, z] of lampAt) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), glow("#ffd28a", night ? 3.2 : 0.6));
    g.position.set(x, 1.83, z);
    scene.add(g);
    lampHeads.push(g);
    CIRCLES.push([x, z, 0.2]);
    if (night) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: canvasTex(glowCanvas()), transparent: true, depthWrite: false, opacity: 0.45 }));
      gl.rotation.x = -Math.PI / 2;
      gl.position.set(x, 0.03, z);
      scene.add(gl);
    }
  }
  if (night) {
    for (const [x, y, z] of [[0, 2.4, SHOP.z1 + 1.6], [0, 2.4, 6], [GAZEBO.x, 2.4, GAZEBO.z], [CABINET.x, 1.8, CABINET.z]]) {
      const pl = new THREE.PointLight("#ffcf8a", 9, 9, 2);
      pl.position.set(x, y, z);
      scene.add(pl);
      nightLights.push(pl);
    }
  }

  // ── The casino (8 Oct 2026, Harry: "start work on making the casino 3D and
  // adding it to the garden/shop walkable area") ──
  // A small glamorous front, same family as the shop's: deep burgundy with
  // gold bands, an art-deco stepped top, a black fascia with the neon CASINO
  // ringed by marquee bulbs, gold columns, a canopy, open doors onto a warm
  // red inside, and a red carpet between gold rope posts. Walk through the
  // doors and the 3D casino opens (cb.onCasinoDoor).
  const casG = new THREE.Group();
  occluders.push(casG);
  scene.add(casG);
  let casinoPulse: ((t: number) => void) | null = null;
  {
    const C = CASINO.door, F = CASINO.z1, W = CASINO.x1 - CASINO.x0, D = CASINO.z1 - CASINO.z0, H = CASINO.h;
    const cx = (CASINO.x0 + CASINO.x1) / 2;
    const cb2 = batch(casG);
    const wallM = mat("#4a1222", { roughness: 0.55 });
    const blackM = mat("#141014", { roughness: 0.35, metalness: 0.2 });
    const gold2M = mat("#d4a94e", { roughness: 0.28, metalness: 0.9 });
    const redGlowM = new THREE.MeshStandardMaterial({ color: "#3a0610", emissive: "#ff4a3a", emissiveIntensity: night ? 1.1 : 0.55, roughness: 0.8 });
    const glassM = new THREE.MeshStandardMaterial({ color: "#2a1a22", transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.9, depthWrite: false });
    // the body (its front 1 m back, as the shop's), the front either side of
    // and over the doorway, a black plinth and gold bands
    const hd = CAS_DOOR.half;
    cb2.box(W, H, D - 1.0, wallM, cx, H / 2, (CASINO.z0 + F - 1.0) / 2);
    for (const [a, b] of [[CASINO.x0, C - hd], [C + hd, CASINO.x1]]) {
      cb2.box(b - a, H, 1.0, wallM, (a + b) / 2, H / 2, F - 0.5);
      cb2.box(b - a + 0.06, 0.5, 1.08, blackM, (a + b) / 2, 0.25, F - 0.48);
      cb2.box(b - a, 0.08, 0.14, gold2M, (a + b) / 2, 0.52, F + 0.03);
    }
    cb2.box(hd * 2, H - CAS_DOOR.h, 1.0, wallM, C, CAS_DOOR.h + (H - CAS_DOOR.h) / 2, F - 0.5);
    cb2.box(W + 0.08, 0.08, 0.14, gold2M, cx, 3.2, F + 0.03);
    cb2.box(W + 0.3, 0.22, 0.5, gold2M, cx, H + 0.11, F - 0.1);
    // the stepped art-deco top over the doors
    cb2.box(4.4, 0.9, 0.7, wallM, C, H + 0.67, F - 0.25);
    cb2.box(4.5, 0.1, 0.78, gold2M, C, H + 1.15, F - 0.25);
    cb2.box(2.6, 0.75, 0.6, wallM, C, H + 1.57, F - 0.3);
    cb2.box(2.7, 0.1, 0.68, gold2M, C, H + 1.98, F - 0.3);
    for (const k of [-1, 0, 1]) cb2.box(0.08, 1.6, 0.06, gold2M, C + k * 0.7, H + 1.1, F + 0.11);
    // the fascia, ringed with bulbs, and the neon name
    cb2.box(5.0, 1.0, 0.2, blackM, C, 3.75, F + 0.1);
    const bulbM = new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffd27a", emissiveIntensity: night ? 3 : 1.6 });
    bulbM.userData.keep = true; // it twinkles (freezeStatic must not swap it)
    const bulbGeo = new THREE.IcosahedronGeometry(0.045, 1);
    for (let k = 0; k <= 16; k++) for (const y of [3.3, 4.2]) cb2.put(bulbGeo.clone(), bulbM, C - 2.4 + k * 0.3, y, F + 0.22);
    for (let k = 1; k < 3; k++) for (const sx of [-1, 1]) cb2.put(bulbGeo.clone(), bulbM, C + sx * 2.4, 3.3 + k * 0.3, F + 0.22);
    const casNeonM = new THREE.MeshBasicMaterial({ map: canvasTex(neonCanvas("CASINO", "#ff3d6e")), transparent: true, depthWrite: false, toneMapped: false });
    casNeonM.userData.keep = true;
    const casSign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2 * 192 / 1024), casNeonM);
    casSign.position.set(C, 3.75, F + 0.21);
    casG.add(casSign);
    // little gold card suits either side of the name
    const suitM = mat("#d4a94e", { roughness: 0.3, metalness: 0.85, emissive: "#6a4a10", emissiveIntensity: 0.3 });
    for (const sx of [-1, 1]) cb2.put(new THREE.OctahedronGeometry(0.16, 0), suitM, C + sx * 2.05, 3.75, F + 0.24, 0, 0, 0, 0.8, 1.2, 0.3);
    // the doorway: a warm red inside, a gold frame, both doors open
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(CAS_DOOR.half * 2, CAS_DOOR.h), new THREE.MeshBasicMaterial({ color: "#ff8a5c", fog: false, toneMapped: false }));
    inside.position.set(C, CAS_DOOR.h / 2, F - 0.9);
    casG.add(inside);
    cb2.box(CAS_DOOR.half * 2, 0.03, 1.0, mat("#7a0f1c", { roughness: 0.9 }), C, 0.015, F - 0.5);
    cb2.box(CAS_DOOR.half * 2 + 0.24, 0.14, 0.2, gold2M, C, CAS_DOOR.h + 0.07, F + 0.06);
    for (const sx of [-1, 1]) cb2.box(0.12, CAS_DOOR.h, 0.2, gold2M, C + sx * (CAS_DOOR.half + 0.06), CAS_DOOR.h / 2, F + 0.06);
    for (const sx of [-1, 1]) {
      const hx = C + sx * CAS_DOOR.half, open = 1.2, leafW = CAS_DOOR.half - 0.04;
      const lx = hx - sx * Math.cos(open) * leafW / 2, lz = F - 0.05 - Math.sin(open) * leafW / 2;
      const ry = sx > 0 ? Math.PI - open : open;
      cb2.box(leafW, CAS_DOOR.h - 0.05, 0.05, blackM, lx, (CAS_DOOR.h - 0.05) / 2, lz, ry);
      cb2.box(leafW - 0.22, CAS_DOOR.h - 0.6, 0.06, glassM, lx, CAS_DOOR.h / 2, lz, ry);
    }
    // gold columns either side of the doors
    for (const sx of [-1, 1]) {
      const px = C + sx * 1.65;
      cb2.box(0.6, 0.3, 0.6, blackM, px, 0.15, F + 0.35);
      cb2.put(new THREE.CylinderGeometry(0.2, 0.22, 2.75, 16), gold2M, px, 1.68, F + 0.35);
      cb2.box(0.58, 0.18, 0.58, gold2M, px, 3.1, F + 0.35);
    }
    // the canopy over the doors
    cb2.box(3.6, 0.12, 1.5, blackM, C, 3.02, F + 0.78);
    cb2.box(3.66, 0.05, 0.06, gold2M, C, 3.0, F + 1.53);
    // two tall windows: red curtains lit from behind
    for (const sx of [-1, 1]) {
      const wx = C + sx * 2.95;
      if (wx - 0.55 < CASINO.x0 || wx + 0.55 > CASINO.x1) continue;
      cb2.box(1.0, 2.0, 0.04, redGlowM, wx, 1.75, F + 0.02);
      cb2.box(1.14, 0.1, 0.12, gold2M, wx, 2.8, F + 0.06);
      cb2.box(1.14, 0.1, 0.12, gold2M, wx, 0.72, F + 0.06);
      cb2.box(0.06, 2.0, 0.08, gold2M, wx, 1.75, F + 0.05);
    }
    // the red carpet, gold-edged, and gold rope posts with red ropes
    const carpetM = mat("#a3101f", { roughness: 0.95 });
    const carpetL = 3.2;
    cb2.box(1.8, 0.02, carpetL, carpetM, C, 0.025, F + 0.4 + carpetL / 2);
    for (const sx of [-1, 1]) cb2.box(0.06, 0.021, carpetL, gold2M, C + sx * 0.9, 0.026, F + 0.4 + carpetL / 2);
    const ropeM = mat("#b3152a", { roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const px = C + sx * 1.3;
      const zs = [F + 1.0, F + 2.1, F + 3.2];
      for (const pz of zs) {
        cb2.put(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), gold2M, px, 0.45, pz);
        cb2.put(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 14), gold2M, px, 0.025, pz);
        cb2.put(new THREE.SphereGeometry(0.06, 10, 8), gold2M, px, 0.93, pz);
        CIRCLES.push([px, pz, 0.12]);
      }
      for (let k = 0; k < zs.length - 1; k++) cb2.box(0.04, 0.04, zs[k + 1] - zs[k], ropeM, px, 0.8, (zs[k] + zs[k + 1]) / 2);
    }
    // black pots with gold rims and clipped topiary either side
    for (const sx of [-1, 1]) {
      const px = C + sx * 3.3;
      if (px < CASINO.x0 - 0.2 || px > CASINO.x1 + 0.2) continue;
      cb2.box(0.6, 0.6, 0.6, blackM, px, 0.3, F + 0.6);
      cb2.box(0.66, 0.05, 0.66, gold2M, px, 0.62, F + 0.6);
      cb2.put(new THREE.IcosahedronGeometry(0.45, 3), boxHedgeM, px, 1.1, F + 0.6);
      CIRCLES.push([px, F + 0.6, 0.4]);
    }
    cb2.done();
    // the light from the door on the path, stronger after dark
    const casGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3), new THREE.MeshBasicMaterial({ map: canvasTex(glowCanvas("255,120,110")), transparent: true, depthWrite: false, opacity: night ? 0.7 : 0.25 }));
    casGlow.rotation.x = -Math.PI / 2;
    casGlow.position.set(C, 0.03, F + 1.2);
    scene.add(casGlow);
    if (night) {
      const pl = new THREE.PointLight("#ff9a7a", 9, 9, 2);
      pl.position.set(C, 2.6, F + 1.8);
      scene.add(pl);
      nightLights.push(pl);
    }
    solid(CASINO.x0 - 0.2, CASINO.x1 + 0.2, CASINO.z0 - 0.2, CASINO.z1 + 0.1);
    // the bulbs chase round and the sign hums (two numbers, nothing redrawn)
    casinoPulse = (t: number) => {
      bulbM.emissiveIntensity = (night ? 2.6 : 1.4) + 0.6 * Math.sin(t * 5);
      casNeonM.opacity = 0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 2.3);
    };
  }
  // the path to it: from the forecourt's right-hand hedge, along, then up to the doors
  const sidePave = (w: number, d: number, x: number, z: number, y: number) => {
    const t = paveT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 0.9, d / 0.9);
    t.needsUpdate = true;
    return flat(w, d, mat("#f3ece0", { map: t, roughness: 0.9 }), x, z, y);
  };
  sidePave(CASINO.door + 1.0 - 4.2, 1.4, (4.2 + CASINO.door + 1.0) / 2, -6.0, 0.0155);
  sidePave(2.0, -6.7 - CASINO.z1, CASINO.door, (CASINO.z1 - 6.7) / 2, 0.016);

  // ── Your house (9 Oct 2026, Harry: "imagine you actually had your current
  // house with all your stuff and that's where you change clothes"): its back
  // door on the east boundary, a path to it from the main path. Walk through
  // the door and your 3D home opens (cb.onHouseDoor, lib/star/home3d). ──
  const houseG = new THREE.Group();
  scene.add(houseG);
  {
    const X = HOUSE.x, Z = HOUSE.z, hb = batch(houseG);
    const brickM = mat("#b98a6a", { roughness: 0.9 });
    const trimM2 = mat("#f3ede2", { roughness: 0.6 });
    const roofM = mat("#4a4f57", { roughness: 0.8 });
    const doorM = mat("#1f3b2e", { roughness: 0.5 });
    // the back of the house: a gable wall standing just inside the boundary, facing the garden
    hb.box(0.5, 3.4, 5.2, brickM, X + 0.25, 1.7, Z);
    for (const s of [-1, 1]) hb.box(0.75, 0.12, 3.05, roofM, X + 0.25, 3.4 + 0.62, Z + s * 1.3, 0, s * 0.45);
    hb.box(0.5, 0.9, 2.6, brickM, X + 0.25, 3.8, Z);
    hb.box(0.5, 0.45, 1.2, brickM, X + 0.25, 4.45, Z);
    // the open back door (a warm hall beyond), its frame and step, a lamp each side
    hb.box(0.06, HOUSE_DOOR.h + 0.12, 0.12, trimM2, X - 0.02, (HOUSE_DOOR.h + 0.12) / 2, Z - HOUSE_DOOR.half - 0.06);
    hb.box(0.06, HOUSE_DOOR.h + 0.12, 0.12, trimM2, X - 0.02, (HOUSE_DOOR.h + 0.12) / 2, Z + HOUSE_DOOR.half + 0.06);
    hb.box(0.06, 0.12, HOUSE_DOOR.half * 2 + 0.24, trimM2, X - 0.02, HOUSE_DOOR.h + 0.06, Z);
    hb.box(0.5, 0.12, HOUSE_DOOR.half * 2 + 0.4, trimM2, X - 0.25, 0.06, Z);
    hb.box(0.06, HOUSE_DOOR.h, 0.9, doorM, X - 0.35, HOUSE_DOOR.h / 2, Z - HOUSE_DOOR.half - 0.42);
    const hall = new THREE.Mesh(new THREE.PlaneGeometry(HOUSE_DOOR.half * 2, HOUSE_DOOR.h), new THREE.MeshBasicMaterial({ color: night ? "#ffcf8a" : "#e9c79a" }));
    hall.rotation.y = -Math.PI / 2;
    hall.position.set(X + 0.01, HOUSE_DOOR.h / 2, Z);
    houseG.add(hall);
    // two windows either side, lit after dark
    const winM = new THREE.MeshStandardMaterial({ color: "#2a3646", emissive: "#ffcf8a", emissiveIntensity: night ? 1.2 : 0.05, roughness: 0.1, metalness: 0.4 });
    for (const s of [-1, 1]) {
      hb.box(0.05, 1.1, 0.8, winM, X - 0.01, 1.6, Z + s * 1.7);
      hb.box(0.08, 0.08, 0.95, trimM2, X - 0.03, 1.05, Z + s * 1.7);
    }
    hb.done();
    const doorGlow2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.2), new THREE.MeshBasicMaterial({ map: canvasTex(glowCanvas()), transparent: true, depthWrite: false, opacity: night ? 0.7 : 0.22 }));
    doorGlow2.rotation.x = -Math.PI / 2;
    doorGlow2.position.set(X - 1.1, 0.03, Z);
    scene.add(doorGlow2);
    solid(X, X + 0.6, Z - 2.7, Z - HOUSE_DOOR.half);
    solid(X, X + 0.6, Z + HOUSE_DOOR.half, Z + 2.7);
    // the path to it from the main path
    sidePave(X - 1.37, 1.4, (X + 1.37) / 2, Z, 0.0155);
  }

  // ── The training pitch (8 Oct 2026): a small fenced pitch, a goal at the
  // far end, cones, a gate. Walk through the gate and the 3D training opens
  // (cb.onTrainingGate; the training itself is built separately). ──
  const pitchG = new THREE.Group();
  scene.add(pitchG);
  {
    const { x0, x1, z0, z1 } = PITCH;
    const pw = x1 - x0, pd = z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const pb = batch(pitchG);
    // striped turf, a touch greener than the lawn
    const turf = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), mat("#ffffff", { map: canvasTex(stripeCanvas("#4f9a3a", "#5aa844"), [1, 1]), roughness: 0.95 }));
    turf.rotation.x = -Math.PI / 2;
    turf.rotation.z = Math.PI / 2; // stripes across the pitch
    turf.position.set(mx, 0.018, mz);
    turf.receiveShadow = true;
    pitchG.add(turf);
    // white lines: the edge, the goal box, a spot, half an arc
    const lineM = mat("#f4f4f0", { roughness: 0.8 });
    const L = (w: number, d: number, x: number, z: number) => pb.box(w, 0.012, d, lineM, x, 0.026, z);
    const ins = 0.35;
    L(pw - ins * 2, 0.07, mx, z0 + ins); L(pw - ins * 2, 0.07, mx, z1 - ins);
    L(0.07, pd - ins * 2, x0 + ins, mz); L(0.07, pd - ins * 2, x1 - ins, mz);
    const boxW = 5.2, boxD = 2.2;
    L(boxW, 0.07, mx, z0 + ins + boxD); L(0.07, boxD, mx - boxW / 2, z0 + ins + boxD / 2); L(0.07, boxD, mx + boxW / 2, z0 + ins + boxD / 2);
    pb.put(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 14), lineM, mx, 0.026, z0 + ins + 3.4);
    const arc = new THREE.RingGeometry(1.55, 1.62, 32, 1, 0, Math.PI);
    pb.put(arc, lineM, mx, 0.027, z1 - ins, -Math.PI / 2, 0, 0);
    // the goal: white posts and bar, a net
    const GW = 3.6, GH = 2.0, GD = 1.1, gz0 = z0 + ins;
    const postM = mat("#fafafa", { roughness: 0.4 });
    for (const sx of [-1, 1]) pb.put(new THREE.CylinderGeometry(0.06, 0.06, GH, 10), postM, mx + sx * GW / 2, GH / 2, gz0);
    pb.put(new THREE.CylinderGeometry(0.06, 0.06, GW + 0.12, 10), postM, mx, GH, gz0, 0, 0, Math.PI / 2);
    const netM = new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.28, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false });
    pb.box(GW, GH, 0.02, netM, mx, GH / 2, gz0 - GD);
    pb.box(GW, 0.02, GD, netM, mx, GH, gz0 - GD / 2);
    for (const sx of [-1, 1]) pb.box(0.02, GH, GD, netM, mx + sx * GW / 2, GH / 2, gz0 - GD / 2);
    for (const sx of [-1, 1]) pb.put(new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(GD, GH), 6), postM, mx + sx * GW / 2, GH / 2, gz0 - GD / 2, Math.atan2(GD, GH), 0, 0);
    // cones: a slalom, and a row of four by the gate
    const coneM = mat("#ff7a1a", { roughness: 0.55 });
    const coneW = mat("#ffffff", { roughness: 0.6 });
    const cone = (x: number, z: number) => {
      pb.put(new THREE.ConeGeometry(0.14, 0.34, 14), coneM, x, 0.19, z);
      pb.put(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 14), coneW, x, 0.16, z);
      pb.box(0.32, 0.03, 0.32, coneM, x, 0.03, z);
    };
    for (let k = 0; k < 6; k++) cone(mx - 3.2 + k * 1.3, mz + 0.6 + (k % 2 ? 0.7 : -0.7));
    for (let k = 0; k < 4; k++) cone(x1 - 1.4, z1 - 1.0 - k * 0.9);
    // balls waiting by the box
    const tBallM = mat("#f6f6f6", { roughness: 0.5 });
    for (const [bx, bz] of [[mx - 0.6, z0 + ins + 3.4], [mx + 0.4, z0 + ins + 3.7], [mx + 1.2, z0 + ins + 3.3]]) pb.put(new THREE.IcosahedronGeometry(0.11, 2), tBallM, bx, 0.11, bz);
    // the fence: green posts, two rails, a see-through mesh; a gap for the gate
    const fenceGreen = mat("#1f4d2c", { roughness: 0.6, metalness: 0.3 });
    const meshM = new THREE.MeshStandardMaterial({ color: "#1d3b25", transparent: true, opacity: 0.32, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const FH = 1.25;
    const run = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 2.2));
      for (let k = 0; k <= n; k++) pb.box(0.08, FH + 0.1, 0.08, fenceGreen, ax + ((bx - ax) * k) / n, (FH + 0.1) / 2, az + ((bz - az) * k) / n);
      for (const y of [FH, 0.15]) pb.box(0.05, 0.05, len, fenceGreen, (ax + bx) / 2, y, (az + bz) / 2, ry);
      pb.box(0.02, FH - 0.15, len, meshM, (ax + bx) / 2, (FH + 0.15) / 2, (az + bz) / 2, ry);
    };
    const g0 = PITCH.gate - PITCH.gateHalf, g1 = PITCH.gate + PITCH.gateHalf;
    run(x0, z0, x1, z0); run(x0, z0, x0, z1); run(x1, z0, x1, z1);
    run(x0, z1, g0, z1); run(g1, z1, x1, z1);
    // the gate: tall posts, a board with the name, both leaves swung in
    for (const gx of [g0, g1]) pb.box(0.14, 2.6, 0.14, fenceGreen, gx, 1.3, z1);
    pb.box(g1 - g0 + 0.5, 0.5, 0.08, fenceGreen, PITCH.gate, 2.55, z1);
    const tSign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9 * 192 / 1024), new THREE.MeshBasicMaterial({ map: canvasTex(neonCanvas("TRAINING", "#ffe27a")), transparent: true, depthWrite: false, toneMapped: false }));
    tSign.position.set(PITCH.gate, 2.55, z1 + 0.05);
    pitchG.add(tSign);
    for (const sx of [-1, 1]) {
      const hx = sx < 0 ? g0 : g1, leaf = PITCH.gateHalf - 0.05, ry = sx < 0 ? -0.9 : 0.9;
      const lx = hx - sx * Math.cos(0.9) * leaf / 2, lz = z1 - Math.sin(0.9) * leaf / 2;
      pb.box(leaf, FH - 0.1, 0.05, meshM, lx, FH / 2, lz, ry);
      pb.box(leaf, 0.05, 0.05, fenceGreen, lx, FH, lz, ry);
      pb.box(leaf, 0.05, 0.05, fenceGreen, lx, 0.15, lz, ry);
    }
    // two floodlights at the far corners
    for (const fx of [x0 + 0.3, x1 - 0.3]) {
      pb.put(new THREE.CylinderGeometry(0.07, 0.1, 6.0, 8), mat("#9aa0a6", { roughness: 0.5, metalness: 0.6 }), fx, 3.0, z0 + 0.3);
      pb.box(0.9, 0.5, 0.2, mat("#2b2f33", { roughness: 0.5 }), fx, 6.0, z0 + 0.3);
      pb.box(0.8, 0.4, 0.02, glow("#fff6dd", night ? 3 : 0.8), fx, 6.0, z0 + 0.42);
    }
    pb.done();
    if (night) {
      const pl = new THREE.PointLight("#fff3d6", 12, 14, 1.6);
      pl.position.set(mx, 5.5, mz);
      scene.add(pl);
      nightLights.push(pl);
    }
    solid(x0 - 0.1, x1 + 0.1, z0 - 0.1, z1 + 0.1);
    for (const gx of [g0, g1]) CIRCLES.push([gx, z1, 0.12]);
  }
  // the path to it: from the fountain court, west, then up to the gate
  sidePave(-2.7 - (PITCH.gate - 0.7), 1.4, (-2.7 + PITCH.gate - 0.7) / 2, SIDE_Z, 0.0155);
  sidePave(1.4, SIDE_Z - 0.7 - PITCH.z1, PITCH.gate, (SIDE_Z - 0.7 + PITCH.z1) / 2, 0.016);

  // ── The fountain, and a bird that drops in for a drink ──
  one("fountain", FOUNTAIN.x, FOUNTAIN.z, 1.9);
  const waterM = new THREE.MeshStandardMaterial({ color: "#5aa8d6", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85, emissive: "#0c3550", emissiveIntensity: 0.4 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.62, 40), waterM);
  water.rotation.x = -Math.PI / 2;
  water.position.set(FOUNTAIN.x, 0.36, FOUNTAIN.z);
  scene.add(water);
  const stoneLightM = mat("#d9d2c4", { roughness: 0.7 });
  const fountainMats = [stoneLightM];
  let fountainFade = 1;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.3, 16), stoneLightM);
  add(column, FOUNTAIN.x, 0.65, FOUNTAIN.z);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 0.28, 24), stoneLightM);
  add(bowl, FOUNTAIN.x, 1.35, FOUNTAIN.z);
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.66, 24), waterM);
  bowlWater.rotation.x = -Math.PI / 2;
  bowlWater.position.set(FOUNTAIN.x, 1.48, FOUNTAIN.z);
  scene.add(bowlWater);
  const topper = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), stoneLightM);
  add(topper, FOUNTAIN.x, 1.72, FOUNTAIN.z);
  // the spray: drops thrown up from the top, falling into the bowls
  const DROPS = 140;
  const dropPos = new Float32Array(DROPS * 3);
  const dropVel = new Float32Array(DROPS * 3);
  const resetDrop = (i: number) => {
    const a = Math.random() * Math.PI * 2, sp = 0.35 + Math.random() * 0.35;
    dropPos[i * 3] = FOUNTAIN.x; dropPos[i * 3 + 1] = 1.78; dropPos[i * 3 + 2] = FOUNTAIN.z;
    dropVel[i * 3] = Math.cos(a) * sp; dropVel[i * 3 + 1] = 1.4 + Math.random() * 0.6; dropVel[i * 3 + 2] = Math.sin(a) * sp;
  };
  for (let i = 0; i < DROPS; i++) { resetDrop(i); dropPos[i * 3 + 1] = 1.4 + Math.random() * 0.5; }
  const dropG = new THREE.BufferGeometry();
  dropG.setAttribute("position", new THREE.BufferAttribute(dropPos, 3));
  const spray = new THREE.Points(dropG, new THREE.PointsMaterial({ color: "#e8f6ff", size: 0.07, map: canvasTex(glowCanvas("230,245,255")), transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(spray);
  CIRCLES.push([FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r]);

  // ── The trophy cabinet: a glass summer-house, your trophies on lit shelves ──
  const cab = new THREE.Group();
  cab.position.set(CABINET.x, 0, CABINET.z);
  cab.rotation.y = Math.PI / 2; // it faces the path (east)
  scene.add(cab);
  occluders.push(cab);
  const frameM = mat("#f4f1ea", { roughness: 0.5 });
  const glassM = new THREE.MeshStandardMaterial({ color: "#cfe6f5", transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const cw = CABINET.w, cd = CABINET.d, ch = 2.4;
  box(cw + 0.2, 0.18, cd + 0.2, mat("#bdb5a6"), 0, 0.09, 0, true, cab);
  for (const [x, z] of [[-cw / 2, -cd / 2], [cw / 2, -cd / 2], [-cw / 2, cd / 2], [cw / 2, cd / 2]]) box(0.1, ch, 0.1, frameM, x, 0.18 + ch / 2, z, true, cab);
  box(cw, ch, 0.04, frameM, 0, 0.18 + ch / 2, -cd / 2, true, cab); // the back wall
  for (const x of [-cw / 2, cw / 2]) box(0.03, ch, cd, glassM, x, 0.18 + ch / 2, 0, false, cab);
  box(cw, ch, 0.03, glassM, 0, 0.18 + ch / 2, cd / 2, false, cab); // glass front
  // a pitched roof
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, (cw + 0.6) * 0.72, 1.0, 4, 1), mat("#3d4a55", { roughness: 0.6, flatShading: true }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, (cd + 0.6) / (cw + 0.6));
  roof.position.set(0, 0.18 + ch + 0.5, 0);
  roof.castShadow = true;
  cab.add(roof);
  const shelfM = mat("#6b4a32", { roughness: 0.5 });
  const shelfY = [0.75, 1.35, 1.95];
  for (const y of shelfY) {
    box(cw - 0.3, 0.05, 0.55, shelfM, 0, y, -cd / 2 + 0.36, false, cab);
    box(cw - 0.32, 0.025, 0.02, glow("#ffd59a", 2.2), 0, y + 0.02, -cd / 2 + 0.64, false, cab);
  }
  const cabLight = new THREE.PointLight("#ffe2b0", night ? 6 : 3, 5, 2);
  cabLight.position.set(0, 2.2, -cd / 2 + 0.9);
  cab.add(cabLight);
  const texLoader = new THREE.TextureLoader();
  const cupM = mat("#e2b63e", { roughness: 0.25, metalness: 0.9 });
  const cupShape = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.09, 0), new THREE.Vector2(0.09, 0.03), new THREE.Vector2(0.03, 0.05), new THREE.Vector2(0.025, 0.14), new THREE.Vector2(0.11, 0.2), new THREE.Vector2(0.13, 0.33), new THREE.Vector2(0.12, 0.34)];
  const cupGeo = new THREE.LatheGeometry(cupShape, 20);
  data.trophies.slice(0, 12).forEach((t, i) => {
    const row = Math.floor(i / 4), col = i % 4;
    const x = -cw / 2 + 0.55 + col * ((cw - 1.1) / 3);
    const y = shelfY[2 - row] + 0.03;
    const z = -cd / 2 + 0.36;
    if (t.art) {
      texLoader.load(t.art, (tx: any) => {
        if (disposed) return;
        tx.colorSpace = THREE.SRGBColorSpace;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true }));
        const a = tx.image ? tx.image.width / tx.image.height : 0.8;
        sp.scale.set(0.46 * Math.min(1, a), 0.46 / Math.max(1, a), 1);
        sp.position.set(x, y + 0.24, z);
        cab.add(sp);
      });
    } else {
      const cup = new THREE.Mesh(cupGeo, cupM);
      cup.position.set(x, y, z);
      cup.castShadow = true;
      cab.add(cup);
    }
    if (t.count > 1) {
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(countCanvas(t.count)), transparent: true, depthWrite: false }));
      n.scale.set(0.24, 0.12, 1);
      n.position.set(x + 0.18, y + 0.08, z + 0.2);
      cab.add(n);
    }
  });
  solid(CABINET.x - cd / 2 - 0.15, CABINET.x + cd / 2 + 0.15, CABINET.z - cw / 2 - 0.15, CABINET.z + cw / 2 + 0.15);


  // ── The gazebo: a pergola, a bench, three team-mates, cans, a plant ──
  const woodM = mat("#ffffff", { map: canvasTex(boardsCanvas("#8b5e3c"), [1, 1]), roughness: 0.75 });
  const gz = GAZEBO;
  const posts = [[gz.x - gz.w / 2, gz.z - gz.d / 2], [gz.x + gz.w / 2, gz.z - gz.d / 2], [gz.x - gz.w / 2, gz.z + gz.d / 2], [gz.x + gz.w / 2, gz.z + gz.d / 2]];
  const gzG = new THREE.Group();
  scene.add(gzG);
  occluders.push(gzG);
  for (const [x, z] of posts) { box(0.16, 2.7, 0.16, woodM, x, 1.35, z, true, gzG); CIRCLES.push([x, z, 0.18]); }
  for (const z of [gz.z - gz.d / 2, gz.z + gz.d / 2]) box(gz.w + 0.5, 0.16, 0.12, woodM, gz.x, 2.72, z, true, gzG);
  for (const x of [gz.x - gz.w / 2, gz.x + gz.w / 2]) box(0.12, 0.16, gz.d + 0.5, woodM, x, 2.72, gz.z, true, gzG);
  for (let k = 0; k < 9; k++) box(gz.w + 0.7, 0.1, 0.08, woodM, gz.x, 2.86, gz.z - gz.d / 2 + (k / 8) * gz.d, true, gzG);
  // climbing green on the back beam
  // climbing leaves along the back beam
  const vineAt: number[][] = [];
  for (let k = 0; k < 26; k++) vineAt.push([gz.x + gz.w / 2 + (r() - 0.5) * 0.3, gz.z - gz.d / 2 + r() * gz.d, 0.14 + r() * 0.1]);
  occluders.push(sphereMany(leafM, vineAt, 2.66));
  // the bench: slats on dark iron legs, against the back
  const ironM = mat("#24262a", { roughness: 0.45, metalness: 0.6 });
  // (seat 0.52: the one body's sitting pose wants a seat this high, or his
  // feet go through the deck and his seat into the slats)
  const seatH = data.player?.look === "old" ? 0.46 : 0.52, benchLen = 2.7;
  for (let k = 0; k < 4; k++) box(0.1, 0.04, benchLen, woodM, BENCH_X - 0.2 + k * 0.12, seatH, gz.z);
  for (let k = 0; k < 3; k++) box(0.04, 0.1, benchLen, woodM, BENCH_X + 0.27, seatH + 0.18 + k * 0.14, gz.z);
  for (const dz of [-benchLen / 2 + 0.1, 0, benchLen / 2 - 0.1]) {
    box(0.5, 0.05, 0.05, ironM, BENCH_X, seatH - 0.05, gz.z + dz);
    box(0.05, seatH - 0.05, 0.05, ironM, BENCH_X - 0.2, (seatH - 0.05) / 2, gz.z + dz);
    box(0.05, seatH + 0.5, 0.05, ironM, BENCH_X + 0.25, (seatH + 0.5) / 2, gz.z + dz);
  }
  solid(BENCH_X - 0.35, BENCH_X + 0.4, gz.z - benchLen / 2, gz.z + benchLen / 2);
  // a side table with the KIB cans, and the plant pot
  const tableX = BENCH_X - 0.1, tableZ = gz.z + benchLen / 2 + 0.55;
  box(0.55, 0.04, 0.55, woodM, tableX, 0.55, tableZ);
  box(0.06, 0.53, 0.06, ironM, tableX, 0.27, tableZ);
  const canColours = ["#e11d48", "#2563eb", "#7c3aed"];
  const canG = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 14);
  canColours.forEach((c, i) => {
    const can = new THREE.Mesh(canG, mat(c, { roughness: 0.3, metalness: 0.7 }));
    can.position.set(tableX - 0.12 + i * 0.12, 0.63, tableZ + (i === 1 ? 0.1 : -0.04));
    can.castShadow = true;
    scene.add(can);
  });
  const fallen = new THREE.Mesh(canG, mat("#e11d48", { roughness: 0.3, metalness: 0.7 }));
  fallen.rotation.z = Math.PI / 2;
  fallen.position.set(BENCH_X - 0.65, 0.05, gz.z - 0.9);
  scene.add(fallen);
  CIRCLES.push([tableX, tableZ, 0.35]);
  one("potted_plant", BENCH_X - 0.05, gz.z - benchLen / 2 - 0.5, 3.4);
  CIRCLES.push([BENCH_X - 0.05, gz.z - benchLen / 2 - 0.5, 0.35]);
  one("pot_large", gz.x - gz.w / 2 - 0.6, gz.z + gz.d / 2 + 0.5, 2.2);
  sphereMany(bushLightM, [[gz.x - gz.w / 2 - 0.6, gz.z + gz.d / 2 + 0.5, 0.42]], 0.35);

  // the teqball table: a curved black top (high in the middle, curving down
  // to both ends), orange arched legs, a net across the middle
  const teq = new THREE.Group();
  teq.position.set(TEQ.x, 0, TEQ.z);
  scene.add(teq);
  occluders.push(teq);
  const TL = 3.0, TW = 1.7;
  const topG = new THREE.BoxGeometry(TW, 0.05, TL, 1, 1, 30);
  const tp = topG.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const z = tp.getZ(i);
    tp.setY(i, tp.getY(i) + 0.76 - 0.11 * Math.pow(z / (TL / 2), 2) * 2.2);
  }
  topG.computeVertexNormals();
  const tTop = new THREE.Mesh(topG, mat("#1d1f22", { roughness: 0.32, metalness: 0.25 }));
  tTop.castShadow = true;
  tTop.receiveShadow = true;
  teq.add(tTop);
  const edgeG = new THREE.BoxGeometry(TW + 0.02, 0.012, TL, 1, 1, 30);
  const ep = edgeG.attributes.position;
  for (let i = 0; i < ep.count; i++) { const z = ep.getZ(i); ep.setY(i, ep.getY(i) + 0.787 - 0.11 * Math.pow(z / (TL / 2), 2) * 2.2); }
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, TL), mat("#f2f2f2"));
  line.position.y = 0.787;
  void edgeG;
  const orangeM = mat("#ff6a1a", { roughness: 0.45 });
  for (const s2 of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24, Math.PI), orangeM);
    leg.rotation.y = Math.PI / 2;
    leg.position.set(s2 * 0.62, 0.0, 0);
    leg.scale.set(1, 1.15, 1);
    leg.castShadow = true;
    teq.add(leg);
  }
  const net = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.1, 0.15, 0.03), mat("#f4f4f4", { roughness: 0.6 }));
  net.position.set(0, 0.86, 0);
  teq.add(net);
  for (const s2 of [-1, 1]) box(0.04, 0.2, 0.04, mat("#111111"), s2 * (TW / 2 + 0.05), 0.86, 0, false, teq);
  solid(TEQ.x - 0.9, TEQ.x + 0.9, TEQ.z - 1.55, TEQ.z + 1.55);
  // a ball resting by it
  const ballM = mat("#f6f6f6", { roughness: 0.5 });
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 2), ballM);
  add(ball, TEQ.x + 1.0, 0.11, TEQ.z + 1.9);

  // ── The stable, paddock, hay and water ──
  const st = STABLE;
  const stableLv = Math.max(1, data.stable);
  const stallN = data.stable >= 4 ? 3 : data.stable >= 2 ? 2 : 1;
  const stableM = mat("#ffffff", { map: canvasTex(boardsCanvas("#a7764b"), [3, 1]), roughness: 0.8 });
  const stallDoorM = mat("#1f4a35", { roughness: 0.5 });
  const sg = new THREE.Group();
  sg.position.set(st.x, 0, st.z);
  scene.add(sg);
  occluders.push(sg);
  const sh = 3.0;
  box(st.w, sh, 0.15, stableM, 0, sh / 2, -st.d / 2, true, sg);
  box(st.w, sh, 0.15, stableM, 0, sh / 2, st.d / 2, true, sg);
  box(0.15, sh, st.d, stableM, -st.w / 2, sh / 2, 0, true, sg);
  // the front: stall doors with dark openings
  const stallW = st.d / stallN;
  for (let k = 0; k < stallN; k++) {
    const zc = -st.d / 2 + stallW * (k + 0.5);
    box(0.15, sh - 1.4, stallW - 1.3, stableM, st.w / 2, 1.4 + (sh - 1.4) / 2, zc, true, sg);
    box(0.15, 1.2, stallW - 1.3, stallDoorM, st.w / 2, 0.6, zc, true, sg);
    box(0.17, 0.08, stallW - 1.3, mat("#e9e2d2"), st.w / 2 + 0.01, 0.6, zc, false, sg);
    box(0.02, 1.0, stallW - 1.4, mat("#2a1c12"), st.w / 2 - 0.05, 1.9, zc, false, sg);
    box(0.17, 1.15, 0.08, mat("#e9e2d2"), st.w / 2 + 0.01, 1.95, zc - (stallW - 1.3) / 2, false, sg);
    box(0.17, 1.15, 0.08, mat("#e9e2d2"), st.w / 2 + 0.01, 1.95, zc + (stallW - 1.3) / 2, false, sg);
    box(0.17, 0.08, stallW - 1.2, mat("#e9e2d2"), st.w / 2 + 0.01, 2.52, zc, false, sg);
    box(0.15, sh, 0.65, stableM, st.w / 2, sh / 2, zc - stallW / 2 + 0.32, true, sg);
    box(0.15, sh, 0.65, stableM, st.w / 2, sh / 2, zc + stallW / 2 - 0.32, true, sg);
    box(0.18, 0.12, stallW - 1.25, mat("#e9e2d2"), st.w / 2 + 0.02, 1.25, zc, false, sg);
  }
  // a dark pitched roof (a stone-tiled one once the stable is grand)
  const sRoofM = mat(stableLv >= 4 ? "#59473a" : "#3f2f25", { roughness: 0.7, flatShading: true });
  const sRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), sRoofM);
  sRoof.rotation.y = Math.PI / 4;
  sRoof.scale.set((st.w + 0.9) * 0.72, 1.5, (st.d + 0.9) * 0.72);
  sRoof.position.set(0, sh + 0.75, 0);
  sRoof.castShadow = true;
  sg.add(sRoof);
  if (stableLv >= 3) { // a little cupola with a weather vane
    box(0.8, 0.8, 0.8, mat("#f2ede2"), 0, sh + 1.6, 0, true, sg);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.6, 4), sRoofM);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(0, sh + 2.3, 0);
    sg.add(cap);
  }
  solid(st.x - st.w / 2 - 0.1, st.x + st.w / 2 + 0.15, st.z - st.d / 2 - 0.1, st.z + st.d / 2 + 0.1);
  // the paddock: post-and-rail fence with a gap to walk in
  const pd = PADDOCK;
  const rails: number[][] = [];
  const railRun = (x0: number, z0: number, x1: number, z1: number, gap?: [number, number]) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 2);
    const ry = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (gap && z > gap[0] && z < gap[1]) continue;
      rails.push([x, z, 1, -ry, 2.0, 3.4, 2.0]);
    }
  };
  railRun(pd.x0, pd.z0, pd.x1, pd.z0);
  railRun(pd.x0, pd.z1, pd.x1, pd.z1);
  railRun(pd.x1, pd.z0, pd.x1, pd.z1, pd.gate);
  railRun(pd.x0, pd.z0, pd.x0, st.z - st.d / 2);
  railRun(pd.x0, st.z + st.d / 2, pd.x0, pd.z1);
  many("fence_wood", rails);
  const fenceT = 0.12;
  solid(pd.x0, pd.x1, pd.z0 - fenceT, pd.z0 + fenceT);
  solid(pd.x0, pd.x1, pd.z1 - fenceT, pd.z1 + fenceT);
  solid(pd.x1 - fenceT, pd.x1 + fenceT, pd.z0, pd.gate[0]);
  solid(pd.x1 - fenceT, pd.x1 + fenceT, pd.gate[1], pd.z1);
  // hay bales and a water trough
  const strawM = mat("#ffffff", { map: canvasTex(strawCanvas()), roughness: 1 });
  const bale = (x: number, z: number, ry: number, y = 0.42) => {
    const b = nature ? makeBale(THREE, nature) : new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 18), strawM);
    b.rotation.z = Math.PI / 2;
    b.rotation.y = ry;
    add(b, x, y, z);
    CIRCLES.push([x, z, 0.6]);
  };
  bale(pd.x0 + 1.4, pd.z0 + 1.2, 0.3);
  bale(pd.x0 + 2.6, pd.z0 + 1.0, -0.2);
  if (stableLv >= 2) bale(pd.x0 + 2.0, pd.z0 + 1.1, 0.05, 1.3);
  const trough = new THREE.Group();
  box(1.8, 0.5, 0.6, mat("#8b8f94", { roughness: 0.5, metalness: 0.5 }), 0, 0.25, 0, true, trough);
  const tw = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.46), waterM);
  tw.rotation.x = -Math.PI / 2;
  tw.position.y = 0.46;
  trough.add(tw);
  trough.position.set(pd.x1 - 1.4, 0, pd.z1 - 1.0);
  scene.add(trough);
  solid(pd.x1 - 2.4, pd.x1 - 0.4, pd.z1 - 1.4, pd.z1 - 0.6);
  one("bucket", pd.x1 - 2.7, pd.z1 - 0.9, 2.6);
  one("log_stack", st.x + 0.6, st.z + st.d / 2 + 0.9, 2.6, 0.3);

  // ── Parking for your cars ──
  const bays = [8.0, 11.0, 14.0];
  const lineM = mat("#f4f1ea", { roughness: 0.6 });
  for (let k = 0; k <= bays.length; k++) flat(0.08, 5.4, lineM, bays[0] - 1.5 + k * 3, PARK.z0 + 3.6, 0.02);
  const carGroups: any[] = [];
  let shadowDirty = true;
  data.cars.slice(0, 3).forEach((url, i) => {
    load(url).then((g: any) => {
      if (disposed) return;
      const c = g.scene;
      c.rotation.y = Math.PI / 2;
      c.position.set(bays[i], 0, PARK.z0 + 3.6);
      // (no cast shadow: a soft one under it instead, because far off the car
      // is drawn as a picture and would drop out of the sun's shadow)
      c.traverse((o: any) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } o.layers.set(CAR_LAYER + i); });
      scene.add(c);
      blob(2.4, 4.6, bays[i], PARK.z0 + 3.6, 0.85);
      carGroups.push(c);
      if (!dbg.has("noimp")) carImpostors.push(makeImpostor([c], CAR_LAYER + i, 9, 10.5));
    }).catch((e: any) => console.error("garden car", e));
    solid(bays[i] - 1.0, bays[i] + 1.0, PARK.z0 + 1.2, PARK.z0 + 6.0);
  });

  /**
   * THE BENCH, AS A PICTURE (lag: the three team-mates are 21k triangles
   * each, twice over with their outline, and they hardly move). Seen from
   * further than ~8 m they are not drawn as 3D people at all: a picture of the
   * three of them, taken from exactly where the camera is, stands in their
   * place, facing the camera, and is taken again only when the camera has
   * gone round them by a few degrees. Close up, the real people come back.
   * The picture is taken with the garden's own lights, so it matches.
   */
  type Impostor = { update: (camPos: any, dt: number) => void; on: () => boolean; dispose: () => void; bakes: () => number; size: () => number };
  let impostor: Impostor | null = null;
  const carImpostors: Impostor[] = [];
  function makeImpostor(roots: any[], layer: number, nearD: number, farD: number): Impostor {
    // the size of what is actually drawn (visible meshes only: a model can
    // carry hidden helpers far bigger than itself)
    const box3 = new THREE.Box3(), mb = new THREE.Box3();
    for (const r0 of roots) {
      r0.updateMatrixWorld(true);
      r0.traverse((o: any) => {
        if (!o.isMesh) return;
        for (let p = o; p; p = p.parent) if (!p.visible) return;
        mb.setFromObject(o, true);
        box3.union(mb);
      });
    }
    const C = new THREE.Vector3(), size = new THREE.Vector3();
    box3.getCenter(C); box3.getSize(size);
    const R = size.length() / 2 + 0.05;
    const half = renderer.capabilities.isWebGL2 && (renderer.extensions.has("EXT_color_buffer_half_float") || renderer.extensions.has("EXT_color_buffer_float"));
    const RES = tier === "low" ? 256 : 512;
    const rt = new THREE.WebGLRenderTarget(RES, RES, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: true });
    const cam = new THREE.OrthographicCamera(-R, R, R, -R, 0.1, 60);
    cam.layers.set(layer);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), new THREE.MeshBasicMaterial({ map: rt.texture, alphaTest: 0.5, transparent: false }));
    card.visible = false;
    scene.add(card);
    const baked = new THREE.Vector3(9, 9, 9), dir = new THREE.Vector3(), clear = new THREE.Color();
    let on = false, bakes = 0, distBaked = 0;
    const bake = (camPos: any) => {
      dir.subVectors(camPos, C).normalize();
      cam.position.copy(C).addScaledVector(dir, 30);
      cam.lookAt(C);
      cam.near = 30 - R - 0.5; cam.far = 30 + R + 0.5;
      cam.updateProjectionMatrix();
      const bg = scene.background, fog = scene.fog, alpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      scene.background = null; scene.fog = null;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(null);
      renderer.setClearColor(clear, alpha);
      scene.background = bg; scene.fog = fog;
      baked.copy(dir);
      distBaked = camPos.distanceTo(C);
      bakes++;
    };
    const lit = [hemiLight, sun, fillLight, ...nightLights];
    for (const l of lit) l.layers.enable(layer);
    return {
      on: () => on,
      bakes: () => bakes,
      size: () => +R.toFixed(2),
      update: (camPos, dt) => {
        void dt;
        const d = camPos.distanceTo(C);
        const want = on ? d > nearD : d > farD;
        if (want !== on) {
          on = want;
          if (on) camera.layers.disable(layer); else camera.layers.enable(layer);
          card.visible = on;
          if (on) bake(camPos);
        }
        if (!on) return;
        // round them by more than ~3 degrees, or much nearer/further: picture again
        dir.subVectors(camPos, C).normalize();
        if (dir.dot(baked) < 0.9986 || Math.abs(d - distBaked) / distBaked > 0.25) bake(camPos);
        // the picture stands a little in front of them (never further forward
        // than half their size, so nothing in front of them is hidden by it),
        // facing the camera, sized so it covers exactly what they would
        const s = Math.min(R * 0.5, 1.0, d * 0.25);
        card.position.copy(C).addScaledVector(baked, s);
        card.quaternion.copy(cam.quaternion);
        card.scale.setScalar((d - s) / d);
      },
      dispose: () => { rt.dispose(); card.geometry.dispose(); card.material.dispose(); },
    };
  }

  // ── People: you, and the team-mates on the bench ──
  const clip = (g: any, n: string) => g.animations.find((a: any) => a.name === n);
  let player: any, mixer: any, idleA: any, walkA: any, jogA: any;
  /** Motion: Mocap: walk → jog → run → sprint (three3d/gait.ts). Null: Motion: Old, the walk/jog blend. */
  let gaitBlend: GaitBlend | null = null;
  let personRef: Person3D | null = null;
  const st0 = data.arrive === "shop" ? START_SHOP : data.arrive === "casino" ? START_CASINO : data.arrive === "training" ? START_TRAINING : data.arrive === "house" ? START_HOUSE : START_GATE;
  // three team-mates, sitting and chatting; one has a can and drinks from it
  const HAIR = ["#1b120c", "#4a2e1c", "#2b1b10"];
  /** The people's outlines (hidden if the scene steps down to Low). */
  const outlines: any[] = [];
  const mates: { root: any; mixer: any; drink?: { a: any; sit: any; next: number; t: number }; upright?: { a: any; phase: number } }[] = [];
  let playerBlob: any;
  if (newPerson) {
    // exactly as the 3D shop builds him (shop3d/scene.ts): the same body,
    // the same outline, his own skin, hair and the club kit with his number
    const SK = SkeletonUtils.default ?? SkeletonUtils;
    // the casual set from your home's wardrobe (9 Oct 2026: lib/star/home3d/wear.ts), else the kit as before
    const casual = data.worn?.kind === "casual" ? data.worn : null;
    const person: Person3D = casual
      ? await (await import("../home3d/wear")).buildWearer(THREE, SkeletonUtils, loader, {
        worn: casual, kits: { home: data.kit, away: data.kit }, number: null,
        skin: data.player?.skin ?? "#c68642", hair: data.player?.hair ?? "#2b1b12", hairStyle: data.player?.hairStyle,
        outline: 0, castShadow: true,
      })
      : makePerson3d(THREE, SK, charG, animG, { outline: prof.outlines ? 0.006 : 0, castShadow: true, you: true });
    outlines.push(person.outline);
    if (!casual) dressPerson3d(THREE, person, {
      skin: data.player?.skin ?? "#c68642", hair: data.player?.hair ?? "#2b1b12",
      kit: data.kit, number: canvasTex(numberCanvas(data.number, "#ffffff")),
    });
    relaxHands(THREE, person); // the one body's fingers in a natural curl
    player = person.root;
    personRef = person;
    mixer = person.mixer;
    idleA = person.actions.idle;
    // a real walk (made from the jog, pulled back towards standing), and the jog
    walkA = mixer.clipAction(makeWalkClip(THREE, person.actions.jog.getClip(), person.actions.idle.getClip()));
    walkA.play();
    jogA = person.actions.jog;
    for (const a of [idleA, walkA, jogA]) a.setEffectiveWeight(0);
    idleA.setEffectiveWeight(1);
    player.position.set(st0.x, 0, st0.z);
    player.rotation.y = st0.yaw;
    scene.add(player);
    playerBlob = blob(0.9, 0.9, st0.x, st0.z, 0.9);
    // the team-mates: the same body, sat on the bench with the clips' "sitidle"
    const SKIN = ["#8d5524", "#e0ac69", "#5c3a1e"];
    data.mates.slice(0, 3).forEach((num, i) => {
      const m: Person3D = makePerson3d(THREE, SK, charG, animG, { outline: prof.outlines ? 0.006 : 0, castShadow: true, who: `garden-mate-${num}` });
      outlines.push(m.outline);
      dressPerson3d(THREE, m, { skin: SKIN[i % 3], hair: HAIR[i % 3], kit: data.kit, number: canvasTex(numberCanvas(num, "#ffffff")) });
      relaxHands(THREE, m);
      const z = gz.z - benchLen / 2 + 0.5 + i * ((benchLen - 1.0) / 2);
      m.root.rotation.y = -Math.PI / 2; // facing out of the gazebo (west)
      m.root.position.set(BENCH_X, 0, z);
      scene.add(m.root);
      // the upright part of the seated clip, swayed gently (as the signing
      // scene does: later in the clip he slumps forward like a thinker)
      const sit = m.actions.sitidle ?? m.actions.idle;
      sit.setEffectiveWeight(1);
      sit.timeScale = 0;
      sit.time = 0.45;
      m.mixer.update(0);
      // put his seat on the bench: the hips just above the slats, over the seat
      m.root.updateMatrixWorld(true);
      const hp = new THREE.Vector3();
      m.bones.Hips.getWorldPosition(hp);
      m.root.position.x += BENCH_X + 0.04 - hp.x;
      m.root.position.y += seatH + 0.1 - hp.y;
      m.root.position.z += z - hp.z;
      // then sit him ON the slats: the underside of his seat (the body's lowest
      // point near the hips, measured on the posed body) exactly on the top
      m.root.updateMatrixWorld(true);
      {
        m.bones.Hips.getWorldPosition(hp);
        const pv = new THREE.Vector3();
        const cnt = m.body.geometry.attributes.position.count;
        let under = Infinity;
        for (let k = 0; k < cnt; k += 3) {
          (m.body as any).getVertexPosition(k, pv);
          pv.applyMatrix4(m.body.matrixWorld);
          if (Math.hypot(pv.x - hp.x, pv.z - hp.z) < 0.16) under = Math.min(under, pv.y);
        }
        if (isFinite(under)) m.root.position.y += seatH + 0.02 - under;
      }
      if (i === 0 && m.bones.RightHand) {
        const can = new THREE.Mesh(canG, mat("#2563eb", { roughness: 0.3, metalness: 0.7 }));
        can.scale.setScalar(1 / m.unit);
        can.position.set(0, 0.07 / m.unit, 0.02 / m.unit);
        m.bones.RightHand.add(can);
      }
      // cheap on a phone: no cast shadow (a soft blob instead), and not drawn
      // when the bench is off screen
      m.body.castShadow = false;
      m.root.updateMatrixWorld(true);
      for (const sk of [m.body, m.outline]) {
        sk.frustumCulled = true;
        sk.computeBoundingSphere();
        sk.boundingSphere.radius *= 1.4;
      }
      blob(1.0, 0.75, BENCH_X - 0.3, z, 0.6); // under his seat and his feet
      // drawn on their own layer, so they can be pictured on their own (below)
      m.root.traverse((o: any) => o.layers.set(MATE_LAYER));
      mates.push({ root: m.root, mixer: m.mixer, upright: { a: sit, phase: i * 2.1 } });
    });
    if (!dbg.has("noimp") && mates.length) impostor = makeImpostor(mates.map((m) => m.root), MATE_LAYER, 7, 8);
  } else {
    const dress = (root: any, number: number, key: string) => {
      const U = {
        uShirt: { value: new THREE.Color(data.kit.shirt) },
        uTrim: { value: new THREE.Color(data.kit.trim) },
        uBoot: { value: new THREE.Color("#141416") },
        uNum: { value: canvasTex(numberCanvas(number, "#ffffff")) },
        uPelvis: { value: new THREE.Vector3() },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uRight: { value: new THREE.Vector3(1, 0, 0) },
        uFwd: { value: new THREE.Vector3(0, 0, 1) },
      };
      root.traverse((o: any) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.frustumCulled = false;
        if (o.isSkinnedMesh && o.material?.name === "Skin") {
          o.material = o.material.clone();
          o.material.name = "Skin";
          dressInKit(THREE, o, U, key);
        }
        if (o.material?.name === "Hair") { o.material = o.material.clone(); o.material.name = "Hair"; }
      });
      return U;
    };
    player = SkeletonUtils.clone(charG.scene);
    dress(player, data.number, "garden-kit-you");
    player.traverse((o: any) => { if (o.material?.name === "Hair") o.material.color.set("#4a2e1c"); });
    player.position.set(st0.x, 0, st0.z);
    player.rotation.y = st0.yaw;
    scene.add(player);
    playerBlob = blob(0.9, 0.9, st0.x, st0.z, 0.9);
    mixer = new THREE.AnimationMixer(player);
    const act = (n: string) => { const a = mixer.clipAction(clip(animG, n)); a.play(); a.setEffectiveWeight(0); return a; };
    idleA = act("Idle_Loop"); walkA = act("Walk_Loop"); jogA = act("Jog_Fwd_Loop");
    idleA.setEffectiveWeight(1);

    data.mates.slice(0, 3).forEach((num, i) => {
      const m = SkeletonUtils.clone(charG.scene);
      dress(m, num, `garden-kit-mate${i}`);
      m.traverse((o: any) => { if (o.material?.name === "Hair") o.material.color.set(HAIR[i % 3]); });
      const z = gz.z - benchLen / 2 + 0.5 + i * ((benchLen - 1.0) / 2);
      m.position.set(BENCH_X - 0.08, 0, z);
      m.rotation.y = -Math.PI / 2; // facing out of the gazebo (west)
      scene.add(m);
      const mx = new THREE.AnimationMixer(m);
      const name = i === 1 ? "Sitting_Talking_Loop" : "Sitting_Idle_Loop";
      const sit = mx.clipAction(clip(gardenAnimG, name));
      sit.time = i * 1.7;
      sit.play();
      const entry: (typeof mates)[number] = { root: m, mixer: mx };
      if (i === 0) {
        // a can in his right hand
        let hand: any = null;
        m.traverse((o: any) => { if (o.isBone && /hand_r$/i.test(o.name)) hand = o; });
        if (hand) {
          const can = new THREE.Mesh(canG, mat("#2563eb", { roughness: 0.3, metalness: 0.7 }));
          can.scale.setScalar(1);
          can.position.set(0.0, 0.08, 0.04);
          hand.add(can);
        }
        const drinkClip = clip(gardenAnimG, "Consume");
        if (drinkClip) {
          const a = mx.clipAction(drinkClip);
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = false;
          entry.drink = { a, sit, next: 4, t: 0 };
        }
      }
      cullSkinned(THREE, entry.root); // not drawn while the bench is off screen (three3d/cullPeople.ts)
      mates.push(entry);
    });


  }
  // Motion: Mocap: your walk → jog → run → sprint, the same foot down through each change
  strideFor(THREE, personRef, mixer, { idle: idleA, walk: walkA, jog: jogA })
    .then((g) => { if (!disposed) gaitBlend = g; })
    .catch((e) => console.error("gait clips", e));
  // ── Your horse, grazing and wandering the paddock ──
  // More than one pose (7 Oct 2026, "horses have one pose"): between walks he
  // either grazes (head down, nose at knee height, chewing) or stands and looks
  // about, switching now and then, and his tail flicks on its own clock. The
  // pack has no grazing clip, so the head and tail are turned on top of the
  // Idle clip; his clocks start at random so no two visits look alike.
  type HorseMode = "walk" | "graze" | "stand";
  let horse: {
    root: any; mixer: any; idle: any; walk: any; target: [number, number]; wait: number;
    mode: HorseMode; graze: number; swap: number; flick: number; flickT: number; t: number;
    neck: any; head: any; tail: any[];
  } | null = null;
  let horseBlob: any = null;
  if (data.horse) {
    load("/star/garden3d/horse.glb").then((g: any) => {
      if (disposed) return;
      const root = g.scene;
      root.scale.setScalar(0.24);
      root.position.set(-9.5, 0, 7.5);
      // the pack's materials came through with opacity 0: make them solid
      // no cast shadow (the sun's shadow is only redrawn when you move): a
      // soft blob under him instead, like the team-mates
      root.traverse((o: any) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; o.material.opacity = 1; o.material.transparent = false; } });
      scene.add(root);
      horseBlob = blob(1.1, 2.2, -9.5, 7.5, 0.6);
      const mx = new THREE.AnimationMixer(root);
      const find = (n: string) => g.animations.find((a: any) => a.name.endsWith(n));
      const idle = mx.clipAction(find("Idle")); idle.play();
      idle.time = Math.random() * idle.getClip().duration;
      idle.timeScale = 0.85 + Math.random() * 0.3;
      const walk = mx.clipAction(find("WalkSlow") ?? find("Walk")); walk.play(); walk.setEffectiveWeight(0);
      walk.time = Math.random() * walk.getClip().duration;
      const bone = (n: string) => root.getObjectByName(n);
      horse = {
        root, mixer: mx, idle, walk, target: [-9.5, 7.5], wait: 2 + Math.random() * 4,
        // (?horsegraze on a test page: start with his head already down)
        mode: dbg.has("horsegraze") || Math.random() < 0.6 ? "graze" : "stand", graze: dbg.has("horsegraze") ? 1 : 0, swap: 3 + Math.random() * 4,
        flick: 1 + Math.random() * 3, flickT: 0, t: Math.random() * 100,
        neck: bone("Neck"), head: bone("Head"), tail: ["Tail1", "Tail2", "Tail3"].map(bone).filter(Boolean),
      };
    }).catch((e: any) => console.error("garden horse", e));
  }
  // turn a bone about an axis given in the world (after the clip has set it)
  const hq = new THREE.Quaternion(), hqp = new THREE.Quaternion(), hqi = new THREE.Quaternion();
  const hAxis = new THREE.Vector3(), hUp = new THREE.Vector3(0, 1, 0);
  const turnBone = (b: any, axis: any, ang: number) => {
    if (!b || !b.parent || Math.abs(ang) < 1e-4) return;
    b.parent.getWorldQuaternion(hqp);
    hqi.copy(hqp).invert();
    hq.setFromAxisAngle(axis, ang);
    b.quaternion.premultiply(hqp).premultiply(hq).premultiply(hqi);
    b.updateMatrixWorld(true);
  };
  const poseHorse = (h: NonNullable<typeof horse>) => {
    h.root.updateMatrixWorld(true);
    // his own side-to-side axis: head down = a turn about it
    hAxis.set(1, 0, 0).applyQuaternion(h.root.quaternion);
    const g = h.graze * (1 - h.walk.getEffectiveWeight());
    const chew = g > 0.5 ? 0.04 * Math.sin(h.t * 7) : 0;
    turnBone(h.neck, hAxis, g * HORSE_GRAZE.neck);
    turnBone(h.head, hAxis, g * HORSE_GRAZE.head + chew);
    // the tail: a slow sway always, a quick flick now and then
    const flick = h.flickT > 0 ? Math.sin((0.9 - h.flickT) / 0.9 * Math.PI * 3) * Math.sin(h.flickT / 0.9 * Math.PI) * 0.55 : 0;
    const sway = 0.08 * Math.sin(h.t * 1.3) + flick;
    h.tail.forEach((b: any, i: number) => turnBone(b, hUp, sway * (0.6 + 0.3 * i)));
  };

  // ── A bird: circles high, drops onto the fountain's rim, drinks, flies off ──
  let bird: { root: any; mixer: any; fly: any; idle: any; phase: "circle" | "land" | "drink" | "leave"; t: number; next: number } | null = null;
  load("/star/garden3d/bird.glb").then((g: any) => {
    if (disposed) return;
    const root = g.scene;
    root.scale.setScalar(0.04);
    root.traverse((o: any) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; o.material.opacity = 1; o.material.transparent = false; } });
    scene.add(root);
    const mx = new THREE.AnimationMixer(root);
    const find = (n: string) => g.animations.find((a: any) => a.name.endsWith(n));
    const fly = mx.clipAction(find("Flying")); fly.play();
    const idle = mx.clipAction(find("Idle") ?? find("Flying")); idle.play(); idle.setEffectiveWeight(0);
    bird = { root, mixer: mx, fly, idle, phase: "circle", t: 0, next: 6 };
  }).catch((e: any) => console.error("garden bird", e));
  const RIM = { x: FOUNTAIN.x + 1.66, y: 0.5, z: FOUNTAIN.z };

  // ── Lag: everything that never moves, merged ──
  // Each little box of the gazebo, bench, stable, cabinet and beds was its own
  // draw: here every still piece is joined with the others of the same
  // material in the same group, so the garden draws in far fewer calls. The
  // picture is exactly the same.
  const frozen = dbg.has("nofreeze") ? { before: 0, after: 0 } : freezeStatic(THREE, mergeGeometries, scene, new Set<any>([player, playerBlob, column, bowl, bowlWater, topper, dome, sunSprite, ...mates.map((m) => m.root)]));

  // ── The training pitch's team-mates (Harry, 8 Oct 2026: "build all the
  // animations for any new 3D areas"). Behind the fence: two passing it
  // back and forth, one dribbling the slalom, one stretching, one jogging
  // laps. The same body as you (people3d, or the old footballer when the
  // shop's player is Old) with the hand-made football clips
  // (lib/star/three3d/footballAnims.ts). How many: the tier's live-character
  // budget (Low 2, Medium 4, High 5). Off screen they are not drawn and
  // their legs are not worked out. Added after the freeze: they move. ──
  type PitchMan = {
    root: any; mixer: any; acts: Record<string, any>; x: number; z: number; yaw: number;
    role: "passA" | "passB" | "dribble" | "stretch" | "jog"; blob: any; ball?: any;
    s?: number; dir?: number; turn?: number;
  };
  const pitchMen: PitchMan[] = [];
  let pitchInfo: { pass: any; dribble: any } = { pass: null, dribble: null };
  /** A point in a man's own frame (x = his left, z = forward), turned to the world. */
  const ownToWorld = (x: number, z: number, yaw: number): [number, number] => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
  const PASS_Z = -11.75, PASS_X: [number, number] = [-15.8, -11.0];
  const DRIB = { x0: -15.6, x1: -9.8, z: -13.2, speed: 0.95 };
  const LAP = { x0: -16.25, x1: -8.2, z0: -16.55, z1: -10.75, r: 1.2 };
  const lapLen = 2 * (LAP.x1 - LAP.x0 + LAP.z1 - LAP.z0) - 8 * LAP.r + 2 * Math.PI * LAP.r;
  /** Where on the lap (a rounded rectangle, run anticlockwise seen from above) at distance d, and which way he faces. */
  const lapAt = (d: number): [number, number, number] => {
    const { x0, x1, z0, z1, r } = LAP;
    const segs: [number, number, number, number][] = [
      [x0 + r, z1, x1 - r, z1], [x1, z1 - r, x1, z0 + r], [x1 - r, z0, x0 + r, z0], [x0, z0 + r, x0, z1 - r],
    ];
    const corners: [number, number, number][] = [[x1 - r, z1 - r, 0], [x1 - r, z0 + r, Math.PI / 2], [x0 + r, z0 + r, Math.PI], [x0 + r, z1 - r, Math.PI * 1.5]];
    d = ((d % lapLen) + lapLen) % lapLen;
    for (let i = 0; i < 4; i++) {
      const [ax, az, bx, bz] = segs[i];
      const L = Math.hypot(bx - ax, bz - az);
      if (d < L) { const u = d / L; return [ax + (bx - ax) * u, az + (bz - az) * u, Math.atan2(bx - ax, bz - az)]; }
      d -= L;
      const arc = (Math.PI / 2) * r;
      if (d < arc) {
        const [cx, cz, a0] = corners[i];
        const a = a0 + d / r;
        return [cx + Math.sin(a) * r, cz + Math.cos(a) * r, Math.atan2(Math.cos(a), -Math.sin(a))];
      }
      d -= arc;
    }
    return [x0 + r, z1, Math.PI / 2];
  };
  const pitchBallM = mat("#f6f6f6", { roughness: 0.5 });
  const pitchBall = () => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 2), pitchBallM); b.castShadow = false; scene.add(b); return b; };
  const pitchCount = Math.min(5, Math.max(2, prof.maxLiveCharacters));
  if (!dbg.has("nopitchmen")) (async () => {
    const fbG: any = await loadAnims3d(loader, "football", newPerson ? "people" : "ual");
    if (disposed) return;
    pitchInfo = { pass: clipInfo(fbG, "pass"), dribble: clipInfo(fbG, "cone_dribble") };
    const roles: PitchMan["role"][] = (["passA", "passB", "dribble", "stretch", "jog"] as PitchMan["role"][]).slice(0, pitchCount);
    const SKINS = ["#5c3a1e", "#e0ac69", "#8d5524", "#c68642", "#3d2716"];
    const NUMS = [4, 8, 14, 21, 9];
    roles.forEach((role, i) => {
      let root: any, mixer: any;
      const acts: Record<string, any> = {};
      if (newPerson) {
        const SK = SkeletonUtils.default ?? SkeletonUtils;
        const m: Person3D = makePerson3d(THREE, SK, charG, animG, { outline: prof.outlines ? 0.006 : 0, castShadow: false, who: `garden-bench-${i}` });
        outlines.push(m.outline);
        dressPerson3d(THREE, m, { skin: SKINS[i], hair: HAIR[i % 3], kit: data.kit, number: canvasTex(numberCanvas(NUMS[i], "#ffffff")) });
        relaxHands(THREE, m);
        addClips(THREE, m, fbG);
        root = m.root; mixer = m.mixer;
        for (const n of ["idle", "jog", "pass", "stretch", "cone_dribble"]) if (m.actions[n]) acts[n] = m.actions[n];
      } else {
        root = SkeletonUtils.clone(charG.scene);
        const U = {
          uShirt: { value: new THREE.Color(data.kit.shirt) }, uTrim: { value: new THREE.Color(data.kit.trim) },
          uBoot: { value: new THREE.Color("#141416") }, uNum: { value: canvasTex(numberCanvas(NUMS[i], "#ffffff")) },
          uPelvis: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3(0, 1, 0) },
          uRight: { value: new THREE.Vector3(1, 0, 0) }, uFwd: { value: new THREE.Vector3(0, 0, 1) },
        };
        root.traverse((o: any) => {
          if (!o.isMesh) return;
          o.castShadow = false; o.frustumCulled = false;
          if (o.isSkinnedMesh && o.material?.name === "Skin") { o.material = o.material.clone(); o.material.name = "Skin"; dressInKit(THREE, o, U, `garden-kit-pitch${i}`); }
          if (o.material?.name === "Hair") { o.material = o.material.clone(); o.material.name = "Hair"; o.material.color.set(HAIR[i % 3]); }
        });
        mixer = new THREE.AnimationMixer(root);
        const take = (g: any, from: string, as: string) => { const c = clip(g, from); if (c) { const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); acts[as] = a; } };
        take(animG, "Idle_Loop", "idle"); take(animG, "Jog_Fwd_Loop", "jog");
        for (const n of ["pass", "stretch", "cone_dribble"]) take(fbG, n, n);
      }
      for (const a of Object.values(acts)) a.setEffectiveWeight(0);
      const man: PitchMan = { root, mixer, acts, x: 0, z: 0, yaw: 0, role, blob: null };
      if (role === "passA" || role === "passB") {
        man.x = PASS_X[role === "passA" ? 0 : 1]; man.z = PASS_Z; man.yaw = role === "passA" ? Math.PI / 2 : -Math.PI / 2;
        if (acts.pass) acts.pass.timeScale = 0; // its time is set by hand: see the loop
      } else if (role === "dribble") {
        man.s = 0.3; man.dir = 1; man.turn = 0; man.z = DRIB.z; man.x = DRIB.x0; man.yaw = Math.PI / 2;
        man.ball = pitchBall();
        acts.cone_dribble?.setEffectiveWeight(1);
      } else if (role === "stretch") {
        man.x = -14.6; man.z = -15.4; man.yaw = 0.35; // facing out, towards the garden
        acts.stretch?.setEffectiveWeight(1);
        if (acts.stretch) acts.stretch.time = 1.7;
      } else {
        man.s = lapLen * 0.62;
        acts.jog?.setEffectiveWeight(1);
      }
      if (!acts.pass && role.startsWith("pass")) acts.idle?.setEffectiveWeight(1);
      if (!acts.cone_dribble && role === "dribble") acts.idle?.setEffectiveWeight(1);
      if (!acts.stretch && role === "stretch") acts.idle?.setEffectiveWeight(1);
      root.position.set(man.x, 0, man.z);
      root.rotation.y = man.yaw;
      scene.add(root);
      man.blob = blob(0.85, 0.85, man.x, man.z, 0.55);
      cullSkinned(THREE, root); // the training pitch's men are not drawn while it is off screen (three3d/cullPeople.ts)
      pitchMen.push(man);
    });
    if (pitchMen.some((m) => m.role === "passB")) {
      const b = pitchBall();
      pitchMen.forEach((m) => { if (m.role === "passA") m.ball = b; });
    } else {
      // only one passer: give him the dribble instead
      pitchMen.forEach((m) => { if (m.role === "passA") m.root.visible = false; });
    }
  })().catch((e: any) => console.error("garden pitch people", e));

  /**
   * The two passers on one 3.2 s round: A's turn is the first 1.6 s (he
   * traps at 0.4, passes at 1.25), B's the next. The pass clip is played
   * from 0.9 s (just before its trap at 1.3) round to its pass at 0.55, so
   * each touch lands on the clip's own measured moment; the ball takes
   * 0.75 s between them. Off turn each stands in his idle.
   */
  const PASS_ROUND = 3.2, PASS_FLIGHT = 0.75;
  const stepPitchMen = (dt: number) => {
    if (!pitchMen.length) return;
    const g = gameT % PASS_ROUND;
    const A = pitchMen.find((m) => m.role === "passA"), B = pitchMen.find((m) => m.role === "passB");
    const ballPt = (m: PitchMan): [number, number] => {
      const o = pitchInfo.pass?.ball ?? [-0.06, 0.31];
      const [wx, wz] = ownToWorld(o[0], o[1], m.yaw);
      return [m.x + wx, m.z + wz];
    };
    for (const m of pitchMen) {
      if (!m.root.visible && m.role === "passA" && !B) continue;
      if (m.role === "passA" || m.role === "passB") {
        const u = (m.role === "passA" ? g : g - 1.6 + PASS_ROUND) % PASS_ROUND;
        const on = u < 1.6;
        const w = on ? Math.min(1, u / 0.2, (1.6 - u) / 0.25) : 0;
        if (m.acts.pass) {
          m.acts.pass.time = (0.9 + Math.min(u, 1.6)) % 1.6;
          m.acts.pass.setEffectiveWeight(w);
          m.acts.idle?.setEffectiveWeight(1 - w);
        }
      } else if (m.role === "dribble") {
        // weave through the slalom: between each pair of cones, then turn at the end
        if (m.turn! > 0) {
          m.turn! -= dt;
          const want = m.dir! > 0 ? Math.PI / 2 : -Math.PI / 2;
          m.yaw += angDiff(m.yaw, want) * Math.min(1, dt * 3.2);
        } else {
          m.s! += m.dir! * DRIB.speed * dt;
          if (m.s! > DRIB.x1 - DRIB.x0 || m.s! < 0) { m.s = Math.max(0, Math.min(DRIB.x1 - DRIB.x0, m.s!)); m.dir = -m.dir!; m.turn = 1.3; }
          const x = DRIB.x0 + m.s!;
          const ph = (Math.PI * (x - (-15.45))) / 1.3;
          const z = DRIB.z + 0.4 * Math.cos(ph);
          const dzdx = -0.4 * Math.sin(ph) * (Math.PI / 1.3);
          m.yaw = Math.atan2(m.dir!, m.dir! * dzdx);
          m.x = x; m.z = z;
        }
        // the ball: just ahead of his feet, where the clip's touches put it
        const tch = pitchInfo.dribble?.touches as [number, string, [number, number, number]][] | undefined;
        let bx = 0, bz = 0.35;
        if (tch && tch.length >= 2 && m.acts.cone_dribble) {
          const per = pitchInfo.dribble.duration || 1.2;
          const t = m.acts.cone_dribble.time % per;
          const [a, b] = t >= tch[0][0] && t < tch[1][0] ? [tch[0], tch[1]] : [tch[1], tch[0]];
          const ta = a[0], tb = b[0] + (b[0] <= ta ? per : 0), tt = t < ta ? t + per : t;
          const k = (tt - ta) / (tb - ta);
          bx = a[2][0] + (b[2][0] - a[2][0]) * k;
          bz = 0.32 + (a[2][2] + (b[2][2] - a[2][2]) * k) * 0.5;
        }
        const [ox, oz] = ownToWorld(bx, m.turn! > 0 ? 0.3 : bz, m.yaw);
        m.ball.position.set(m.x + ox, 0.11, m.z + oz);
        m.ball.rotation.x += dt * (m.turn! > 0 ? 1 : 8);
      } else if (m.role === "jog") {
        m.s! += 3.0 * dt;
        const [x, z, yw] = lapAt(m.s!);
        m.x = x; m.z = z; m.yaw = yw;
        if (m.acts.jog) m.acts.jog.timeScale = newPerson ? 1.0 : 0.95;
      }
      m.root.position.set(m.x, 0, m.z);
      m.root.rotation.y = m.yaw;
      m.blob.position.set(m.x, 0.012, m.z);
      const seen = inView(m.x, 0.9, m.z, 1.3);
      m.root.visible = seen && !(m.role === "passA" && !B);
      if (seen) m.mixer.update(dt);
    }
    // the passers' ball
    if (A && B && A.ball) {
      const pa = ballPt(A), pb = ballPt(B);
      // A traps 0.4, passes 1.25; B traps 2.0, passes 2.85 (0.75 s on the way)
      let p: [number, number], spin = 0;
      const roll = (from: [number, number], to: [number, number], t0: number) => {
        const v = ((g - t0 + PASS_ROUND) % PASS_ROUND) / PASS_FLIGHT;
        const s = v * (1.35 - 0.35 * v);
        spin = 10;
        return [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s] as [number, number];
      };
      if (g >= 0.4 && g < 1.25) p = pa;
      else if (g >= 1.25 && g < 2.0) p = roll(pa, pb, 1.25);
      else if (g >= 2.0 && g < 2.85) p = pb;
      else p = roll(pb, pa, 2.85);
      A.ball.position.set(p[0], 0.11, p[1]);
      A.ball.rotation.z -= dt * spin * (g < 2 ? 1 : -1);
      A.ball.visible = inView(p[0], 0.11, p[1], 0.3);
    }
  };

  // ── Input, camera, the loop ──
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let speed = 0, yaw = st0.yaw, camYaw = st0.yaw + Math.PI, orbitHold = 0;
  const orb = new OrbitCam(); // the look-around drag, eased (shared with the shop)
  let near: GardenSpot | null = null;
  let frames = 0, fpsT0 = performance.now(), slowSeconds = 0, gameT = 0;
  let doorFired = false;
  // tap to move (lib/star/tapWalk.ts)
  const walker = new TapWalker();
  const marker = makeTapMarker(THREE, scene);
  let grid: WalkGrid | null = null;
  let faceTo: XZ | null = null;
  const stopWalk = () => { if (walker.active) { walker.cancel(); marker.fade(); } faceTo = null; };
  const onKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) return;
    if (down) { keys.add(k); stopWalk(); } else keys.delete(k);
    if (k.startsWith("arrow")) e.preventDefault();
  };
  const kd = (e: KeyboardEvent) => onKey(e, true);
  const ku = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.7 ? 62 : 54;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const RR = 0.32;
  const collide = (x: number, z: number) => {
    const rr = RR;
    // the shop's doorway: walk in and you are inside
    if (Math.abs(x) < DOOR.half - 0.2 && z < SHOP.z1 + 0.7 && z > SHOP.z1 - 1.2) {
      if (!doorFired && z < SHOP.z1 - 0.1) { doorFired = true; cb.onShopDoor(); }
      return [x, Math.max(z, SHOP.z1 - 0.6)];
    }
    // the casino's doorway, the same (8 Oct 2026)
    if (cb.onCasinoDoor && Math.abs(x - CASINO.door) < CAS_DOOR.half - 0.2 && z < CASINO.z1 + 0.7 && z > CASINO.z1 - 1.2) {
      if (!doorFired && z < CASINO.z1 - 0.1) { doorFired = true; cb.onCasinoDoor(); }
      return [x, Math.max(z, CASINO.z1 - 0.6)];
    }
    // your house's back door (9 Oct 2026)
    if (cb.onHouseDoor && Math.abs(z - HOUSE.z) < HOUSE_DOOR.half - 0.2 && x > HOUSE.x - 1.0) {
      if (!doorFired && x > HOUSE.x + 0.1) { doorFired = true; cb.onHouseDoor(); }
      return [Math.min(x, HOUSE.x + 0.5), z];
    }
    // the training pitch's gate
    if (cb.onTrainingGate && Math.abs(x - PITCH.gate) < PITCH.gateHalf - 0.2 && z < PITCH.z1 + 0.7 && z > PITCH.z1 - 1.0) {
      if (!doorFired && z < PITCH.z1 - 0.1) { doorFired = true; cb.onTrainingGate(); }
      return [x, Math.max(z, PITCH.z1 - 0.5)];
    }
    x = Math.max(-LIMIT, Math.min(LIMIT, x));
    z = Math.max(-LIMIT, Math.min(LIMIT, z));
    for (const [x0, x1, z0, z1] of BOXES) {
      if (x > x0 - rr && x < x1 + rr && z > z0 - rr && z < z1 + rr) {
        const push = [x - (x0 - rr), x1 + rr - x, z - (z0 - rr), z1 + rr - z];
        const m = Math.min(...push);
        if (m === push[0]) x = x0 - rr; else if (m === push[1]) x = x1 + rr; else if (m === push[2]) z = z0 - rr; else z = z1 + rr;
      }
    }
    for (const [cx, cz, cr] of CIRCLES) {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < cr + rr && d > 1e-6) { x = cx + (dx / d) * (cr + rr); z = cz + (dz / d) * (cr + rr); }
    }
    return [x, z];
  };
  /** Somewhere he can stand (for the tap-walk's path), with a little room. */
  const isFree = (x: number, z: number) => {
    const rr = RR + 0.08;
    if (Math.abs(x) > LIMIT - 0.1 || Math.abs(z) > LIMIT - 0.1) return false;
    for (const [x0, x1, z0, z1] of BOXES) if (x > x0 - rr && x < x1 + rr && z > z0 - rr && z < z1 + rr) return false;
    for (const [cx, cz, cr] of CIRCLES) if (Math.hypot(x - cx, z - cz) < cr + rr) return false;
    return true;
  };
  const ZONES: { id: GardenSpot; inside: (x: number, z: number) => boolean }[] = [
    { id: "shop", inside: (x, z) => Math.abs(x) < 3 && z < SHOP.z1 + 2.6 },
    { id: "casino", inside: (x, z) => Math.abs(x - CASINO.door) < 2.4 && z < CASINO.z1 + 3.0 },
    { id: "training", inside: (x, z) => Math.abs(x - PITCH.gate) < 2.0 && z < PITCH.z1 + 2.6 },
    { id: "house", inside: (x, z) => x > HOUSE.x - 2.6 && Math.abs(z - HOUSE.z) < 1.6 },
    { id: "trophies", inside: (x, z) => Math.hypot(x - CABINET.x, z - CABINET.z) < 3.4 },
    { id: "teqball", inside: (x, z) => Math.hypot(x - TEQ.x, z - TEQ.z) < 2.6 },
    { id: "mates", inside: (x, z) => x > gz.x - gz.w / 2 - 1.0 && x < gz.x + gz.w / 2 + 0.5 && Math.abs(z - gz.z) < gz.d / 2 + 0.4 },
    { id: "horse", inside: (x, z) => x > PADDOCK.x0 - 0.5 && x < PADDOCK.x1 + 1.4 && z > PADDOCK.z0 - 0.5 && z < PADDOCK.z1 + 0.5 },
    { id: "cars", inside: (x, z) => x > PARK.x0 - 0.5 && z > PARK.z0 - 0.8 },
    { id: "fountain", inside: (x, z) => Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 3.4 },
  ];
  /** Where to stand to use each thing (inside its zone, so its card shows), and what to look at. */
  const STAND: Record<GardenSpot, { at: XZ; face: XZ }> = {
    shop: { at: [0, SHOP.z1 + 1.7], face: [0, SHOP.z1] },
    casino: { at: [CASINO.door, CASINO.z1 + 1.9], face: [CASINO.door, CASINO.z1] },
    training: { at: [PITCH.gate, PITCH.z1 + 1.6], face: [PITCH.gate, PITCH.z1] },
    house: { at: [HOUSE.x - 1.5, HOUSE.z], face: [HOUSE.x, HOUSE.z] },
    trophies: { at: [CABINET.x + 2.55, CABINET.z], face: [CABINET.x, CABINET.z] },
    teqball: { at: [TEQ.x - 1.75, TEQ.z + 0.3], face: [TEQ.x, TEQ.z] },
    mates: { at: [gz.x - 0.9, gz.z], face: [BENCH_X, gz.z] },
    horse: { at: [PADDOCK.x1 + 0.9, (PADDOCK.gate[0] + PADDOCK.gate[1]) / 2], face: [(PADDOCK.x0 + PADDOCK.x1) / 2, 7] },
    cars: { at: [9.5, PARK.z0 + 0.3], face: [11, PARK.z0 + 3.6] },
    fountain: { at: [FOUNTAIN.x, FOUNTAIN.z + FOUNTAIN.r + 0.9], face: [FOUNTAIN.x, FOUNTAIN.z] },
  };
  const walkTo = (to: XZ, face: XZ | null) => {
    grid ??= buildGrid(-LIMIT, LIMIT, -LIMIT, LIMIT, 0.3, isFree);
    const path = findPath(grid, [player.position.x, player.position.z], to);
    if (!path) return false;
    faceTo = null;
    walker.go(path, { onArrive: () => { marker.fade(); faceTo = face; } });
    const g = path[path.length - 1];
    marker.show(g[0], g[1]);
    orbitHold = 0;
    return true;
  };

  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let first = true;
  const v3 = new THREE.Vector3();
  const camRay = new THREE.Raycaster();
  const headPos = new THREE.Vector3(), rayDir = new THREE.Vector3();
  const frustum = new THREE.Frustum(), projM = new THREE.Matrix4(), sph = new THREE.Sphere();
  const inView = (x: number, y: number, z: number, r: number) => frustum.intersectsSphere(sph.set(v3.set(x, y, z), r));
  // the fountain's top (column, bowl, its water and spray) clears out of the
  // way when the camera can only see him through it
  const fountainTop = [column, bowl, bowlWater, topper, spray];
  let fountainHide = 0;
  /** Where a line from (x,z) along (dx,dz) first enters a circle, or Infinity. */
  const enterCircle = (x: number, z: number, dx: number, dz: number, cx: number, cz: number, r: number) => {
    const fx = x - cx, fz = z - cz;
    const b = fx * dx + fz * dz, c = fx * fx + fz * fz - r * r;
    if (c < 0) return 0;
    const disc = b * b - c;
    if (disc < 0) return Infinity;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : Infinity;
  };
  /** Where a line from (x,z) along (dx,dz) first enters a box, or Infinity. */
  const enterBox = (x: number, z: number, dx: number, dz: number, x0: number, x1: number, z0: number, z1: number) => {
    let t0 = 0, t1 = Infinity;
    for (const [p, d, lo, hi] of [[x, dx, x0, x1], [z, dz, z0, z1]] as [number, number, number, number][]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return Infinity; continue; }
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) return Infinity;
    }
    return t0;
  };
  /** How far a line from (x,z) along (dx,dz) runs before it leaves the
   *  garden (the inner face of the boundary, with room for the hedge). */
  const CAM_IN = 18.35;
  const exitGarden = (x: number, z: number, dx: number, dz: number) => {
    let t = Infinity;
    if (dx > 1e-9) t = Math.min(t, (CAM_IN - x) / dx); else if (dx < -1e-9) t = Math.min(t, (-CAM_IN - x) / dx);
    if (dz > 1e-9) t = Math.min(t, (CAM_IN - z) / dz); else if (dz < -1e-9) t = Math.min(t, (-CAM_IN - z) / dz);
    return Math.max(0, t);
  };
  let dodge = 0; // the camera's swing round the gazebo and off the boundary (radians)
  let lastBlock: { d: number; what: string } | null = null;
  let testCam: [[number, number, number], [number, number, number]] | null = null;
  const GZ_BOX: [number, number, number, number] = [GAZEBO.x - GAZEBO.w / 2 - 0.35, GAZEBO.x + GAZEBO.w / 2 + 0.35, GAZEBO.z - GAZEBO.d / 2 - 0.35, GAZEBO.z + GAZEBO.d / 2 + 0.35];

  // the frame limiter and the pixels: see the renderer above
  let acc = 0, busy = true, busyT = 0, stillT = 0, shadowRenders = 0, drawn = 0, lastShadowX = NaN, lastShadowZ = NaN, lastShadowYaw = NaN;
  let capAlways = false; // a phone still too slow at Low: 30 a second all the time
  /** Too slow for three seconds: one tier down (High → Medium → Low), never
   *  straight to the bottom. Antialias stays (it is fixed with the context). */
  const stepDown = (): boolean => {
    const next = stepDownTier(tier);
    if (!next) return false;
    tier = next; prof = TIER_PROFILES[tier];
    dyn = makeDyn(); dynPR = Math.min(dpr, prof.movePixelRatio);
    pr = stillPR(); renderer.setPixelRatio(pr);
    if (!prof.shadows) { sun.castShadow = false; renderer.shadowMap.enabled = false; }
    else {
      const n = shadowSizeFor(prof, SUN_MAP);
      if (n !== sun.shadow.mapSize.x) { sun.shadow.map?.dispose(); sun.shadow.map = null; sun.shadow.mapSize.set(n, n); shadowDirty = true; }
    }
    if (!prof.outlines) for (const o of outlines) o.visible = false;
    resize();
    return true;
  };

  // Warm up: build every shader before the first frame, so the first steps
  // don't stutter while the phone compiles them.
  camera.position.set(player.position.x, CAM_UP, player.position.z + CAM_BACK);
  camera.lookAt(player.position.x, 1.3, player.position.z);
  // Look H: shade where things meet the grass, and long-grass tufts round them and along the boundary
  if (nature) {
    const spots: [number, number, number][] = CIRCLES.filter(([, , rr]) => rr >= 0.45 && rr <= 1.2).map(([x, z, rr]) => [x, z, rr]);
    for (const list of Object.values(treeAt)) for (const [x, z, s] of list) if (Math.hypot(x, z) < 30) spots.push([x, z, Math.min(1.1, 0.16 * s)]);
    const gd = makeGroundDetail(THREE, nature, spots, B, 11);
    scene.add(gd.contacts, gd.tufts);
  }
  // same picture, less work: still shadows kept, lamps only where they reach (before the shaders are built)
  const savings = sceneSavings(THREE, renderer, scene);
  try { await renderer.compileAsync(scene, camera); } catch { /* older browsers: compiled on first use */ }
  if (disposed) throw new Error("disposed");

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    const raw = Math.min(0.25, clock.getDelta());
    let dt: number;
    if (opts.fixedStep) dt = opts.fixedStep;
    else {
      // standing still: 30 pictures a second is plenty (the fountain, the
      // bench and the horse still move); walking or turning: the tier's cap
      // (High and Medium every frame, Low 30)
      acc += raw;
      const cap = busy && !capAlways ? prof.fpsCap : prof.stillFps;
      govCap = cap;
      if (cap < 60 && acc < 1 / (cap + 1)) return;
      dt = Math.min(0.05, acc);
      gov.frame(performance.now(), govCap);
      acc = 0;
    }
    gameT += dt;
    let ix = stick.x, iy = stick.y;
    if (keys.size) {
      ix = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      iy = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const m = Math.hypot(ix, iy) || 1;
      const runK = keys.has("shift") ? 1 : gaitBlend ? 0.4 : 0.6;
      ix = (ix / m) * runK; iy = (iy / m) * runK;
    }
    let mag = Math.min(1, Math.hypot(ix, iy));
    let wantYaw: number | null = null;
    if (mag >= 0.08) {
      // the stick is relative to where the camera actually looks
      const cy = camYaw + dodge;
      const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
      wantYaw = Math.atan2(fx * iy + rx * ix, fz * iy + rz * ix);
    } else if (walker.active) {
      const s = walker.step(player.position.x, player.position.z, dt);
      if (s) {
        wantYaw = s.yaw;
        // turning round first: don't stride off the wrong way meanwhile
        mag = s.push * Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(angDiff(yaw, s.yaw)))));
      } else if (!walker.active && marker.visible) marker.fade();
    }
    if (gaitBlend) {
      // a small push walks, medium jogs, near-full runs, full sprints (no stamina in the garden)
      speed = approach(speed, stickTarget(mag, keys.has("shift"), STROLL_SPEEDS), dt, STROLL_SPEEDS);
    } else {
      const target = mag < 0.08 ? 0 : mag < 0.75 ? WALK * (mag / 0.75) : WALK + (JOG - WALK) * ((mag - 0.75) / 0.25);
      speed += (target - speed) * Math.min(1, dt * 8);
    }
    if (wantYaw !== null) yaw += angDiff(yaw, wantYaw) * Math.min(1, dt * 10);
    else if (faceTo && speed < 0.4) {
      // arrived at something: turn to it
      const d = angDiff(yaw, Math.atan2(faceTo[0] - player.position.x, faceTo[1] - player.position.z));
      yaw += d * Math.min(1, dt * 5);
      if (Math.abs(d) < 0.03) faceTo = null;
    }
    const [nx, nz] = collide(player.position.x + Math.sin(yaw) * speed * dt, player.position.z + Math.cos(yaw) * speed * dt);
    player.position.x = nx; player.position.z = nz;
    player.rotation.y = yaw;
    playerBlob.position.set(nx, 0.02, nz);
    marker.update(dt);
    const wWalk = speed < WALK ? speed / WALK : Math.max(0, 1 - (speed - WALK) / (JOG - WALK));
    const wJog = speed <= WALK ? 0 : Math.min(1, (speed - WALK) / (JOG - WALK));
    if (gaitBlend) gaitBlend.update(speed, dt);
    else {
      idleA.setEffectiveWeight(Math.max(0, 1 - speed / WALK));
      walkA.setEffectiveWeight(wWalk);
      jogA.setEffectiveWeight(wJog);
    }
    if (gaitBlend) { /* GaitBlend sets each loop's pace */ }
    else if (newPerson) {
      // the walk and the jog are the same stride timing, so they share one
      // pace and the feet stay together while one blends into the other
      const ts = Math.max(0.5, speed / (1.7 + 1.3 * wJog));
      walkA.timeScale = ts; jogA.timeScale = ts;
    } else {
      walkA.timeScale = Math.max(0.6, speed / 1.45);
      jogA.timeScale = Math.max(0.8, speed / 3.2);
    }
    mixer.update(dt);

    // team-mates: sit, chat; the one with the can takes a drink now and then.
    // As a picture (far off) they hold still and cost nothing.
    const matesReal = !impostor || !impostor.on();
    for (const m of mates) {
      if (!matesReal) break;
      if (m.drink) {
        const d = m.drink;
        d.next -= dt;
        if (d.next <= 0 && d.t <= 0) { d.a.reset(); d.a.play(); d.t = d.a.getClip().duration; d.next = 9 + Math.random() * 6; }
        if (d.t > 0) {
          d.t -= dt;
          const dur = d.a.getClip().duration;
          const w = Math.min(1, (dur - d.t) / 0.35, d.t / 0.35);
          // only the upper body drinks: blend the clip in lightly over the sitting pose
          d.a.setEffectiveWeight(Math.max(0, w) * 0.85);
          d.sit.setEffectiveWeight(1 - Math.max(0, w) * 0.5);
        } else { d.a.setEffectiveWeight(0); d.sit.setEffectiveWeight(1); }
      }
      if (m.upright) m.upright.a.time = 0.45 + 0.12 * Math.sin(gameT * 0.45 + m.upright.phase);
      m.mixer.update(dt);
    }

    stepPitchMen(dt);

    // the horse: graze, then amble to somewhere else in the paddock
    if (horse) {
      const h = horse;
      const dx = h.target[0] - h.root.position.x, dz = h.target[1] - h.root.position.z, d = Math.hypot(dx, dz);
      h.t += dt;
      if (d < 0.25) {
        h.wait -= dt;
        h.walk.setEffectiveWeight(Math.max(0, h.walk.getEffectiveWeight() - dt * 2));
        h.idle.setEffectiveWeight(1 - h.walk.getEffectiveWeight());
        if (h.mode === "walk") h.mode = Math.random() < 0.65 ? "graze" : "stand";
        // now and then: head up for a look round, or back down to the grass
        if ((h.swap -= dt) <= 0) { h.mode = h.mode === "graze" ? "stand" : "graze"; h.swap = h.mode === "graze" ? 5 + Math.random() * 6 : 2.5 + Math.random() * 3; }
        if (h.wait <= 0) {
          h.target = [PADDOCK.x0 + 1.6 + Math.random() * (PADDOCK.x1 - PADDOCK.x0 - 3.2), PADDOCK.z0 + 2.4 + Math.random() * (PADDOCK.z1 - PADDOCK.z0 - 4.4)];
          h.wait = 6 + Math.random() * 9;
          h.mode = "walk";
        }
      } else {
        const want2 = Math.atan2(dx, dz);
        h.root.rotation.y += angDiff(h.root.rotation.y, want2) * Math.min(1, dt * 1.6);
        const sp = 0.9 * Math.max(0, Math.cos(angDiff(h.root.rotation.y, want2)));
        h.root.position.x += Math.sin(h.root.rotation.y) * sp * dt;
        h.root.position.z += Math.cos(h.root.rotation.y) * sp * dt;
        h.walk.setEffectiveWeight(Math.min(1, h.walk.getEffectiveWeight() + dt * 2));
        h.idle.setEffectiveWeight(1 - h.walk.getEffectiveWeight());
      }
      if (horseBlob) { horseBlob.position.set(h.root.position.x, 0.02, h.root.position.z); horseBlob.rotation.z = h.root.rotation.y; }
      // off screen: skip working out his legs (and don't draw him)
      const seen = inView(h.root.position.x, 0.9, h.root.position.z, 1.6);
      h.root.visible = seen;
      h.graze += ((h.mode === "graze" ? 1 : 0) - h.graze) * Math.min(1, dt * 1.4);
      if ((h.flick -= dt) <= 0) { h.flickT = 0.9; h.flick = 2 + Math.random() * 5; }
      if (h.flickT > 0) h.flickT -= dt;
      if (seen) {
        h.mixer.update(dt);
        poseHorse(h);
      }
    }

    // the bird
    if (bird) {
      const b = bird;
      b.t += dt;
      const ox = FOUNTAIN.x, oz = FOUNTAIN.z;
      if (b.phase === "circle") {
        const a = b.t * 0.45;
        v3.set(ox + Math.cos(a) * 9, 7 + Math.sin(b.t * 0.7) * 0.6, oz + Math.sin(a) * 9);
        b.root.lookAt(ox + Math.cos(a + 0.1) * 9, v3.y, oz + Math.sin(a + 0.1) * 9);
        b.root.position.copy(v3);
        b.next -= dt;
        if (b.next <= 0) { b.phase = "land"; b.t = 0; }
      } else if (b.phase === "land") {
        const p = Math.min(1, b.t / 3.2);
        const e = p * p * (3 - 2 * p);
        const sx = b.root.position.x, sz = b.root.position.z;
        const nxB = sx + (RIM.x - sx) * Math.min(1, dt * 1.8), nzB = sz + (RIM.z - sz) * Math.min(1, dt * 1.8);
        b.root.lookAt(RIM.x, b.root.position.y, RIM.z);
        b.root.position.set(nxB, 7 + (RIM.y - 7) * e, nzB);
        if (p >= 1) { b.phase = "drink"; b.t = 0; b.root.position.set(RIM.x, RIM.y, RIM.z); b.root.lookAt(ox, RIM.y, oz); }
      } else if (b.phase === "drink") {
        b.fly.setEffectiveWeight(0); b.idle.setEffectiveWeight(1);
        // a dip of the head to the water every couple of seconds
        b.root.rotation.x = Math.max(0, Math.sin(b.t * 2.6)) * 0.45;
        if (b.t > 7) { b.phase = "leave"; b.t = 0; b.root.rotation.x = 0; b.fly.setEffectiveWeight(1); b.idle.setEffectiveWeight(0); }
      } else {
        const p = Math.min(1, b.t / 3);
        b.root.position.set(RIM.x + p * 8, RIM.y + p * 7, RIM.z - p * 6);
        b.root.lookAt(RIM.x + 9, RIM.y + p * 7, RIM.z - 7);
        if (p >= 1) { b.phase = "circle"; b.t = 0; b.next = 14 + Math.random() * 10; }
      }
      const seen = inView(b.root.position.x, b.root.position.y, b.root.position.z, 0.8);
      b.root.visible = seen;
      if (seen) b.mixer.update(dt);
    }

    // the fountain spray and gentle water (only worked out when it's in view)
    if (inView(FOUNTAIN.x, 1.2, FOUNTAIN.z, 2.4)) {
      for (let i = 0; i < DROPS; i++) {
        dropVel[i * 3 + 1] -= 9.8 * dt * 0.55;
        dropPos[i * 3] += dropVel[i * 3] * dt;
        dropPos[i * 3 + 1] += dropVel[i * 3 + 1] * dt;
        dropPos[i * 3 + 2] += dropVel[i * 3 + 2] * dt;
        if (dropPos[i * 3 + 1] < 1.45) resetDrop(i);
      }
      dropG.attributes.position.needsUpdate = true;
    }
    waterM.emissiveIntensity = 0.35 + 0.08 * Math.sin(gameT * 2.2);
    casinoPulse?.(gameT);
    clouds.forEach((c, i) => { c.position.x += Math.sin(i) * dt * 0.25; });

    // the camera follows behind him
    camYaw += orb.step(dt);
    if (orbitHold > 0) orbitHold -= dt;
    else if (speed > 0.3) camYaw += angDiff(camYaw, yaw + Math.PI) * Math.min(1, dt * 1.6);
    // The gazebo between him and the camera (standing south of it, looking at
    // the cars, put the camera among its posts with the team-mates filling
    // the picture): swing the camera round to the nearest side that's clear.
    {
      const hx = player.position.x, hz = player.position.z;
      const inGz = hx > GZ_BOX[0] && hx < GZ_BOX[1] && hz > GZ_BOX[2] && hz < GZ_BOX[3];
      // (with room to spare round it, so no post stands right beside the camera)
      const gzClear = (dx: number, dz: number) => inGz || enterBox(hx, hz, dx, dz, GZ_BOX[0] - 0.6, GZ_BOX[1] + 0.6, GZ_BOX[2] - 0.6, GZ_BOX[3] + 0.6) >= CAM_BACK;
      // THE CAR PARK BUG (7 Oct 2026, "player not drawn at the car park, once
      // in 4 runs"): with his back to the boundary (behind the cars, walking
      // back to the garden) the camera stood 6.3 m behind him, outside the
      // wall among the trees, and the wall hid him (seen in the harness). The
      // wall was never a camera blocker. Now the camera swings round to keep
      // most of its distance inside the garden, and the boom below stops at
      // the wall when even that can't.
      const wallRoom = (dx: number, dz: number) => exitGarden(hx, hz, dx, dz);
      const clear = (off: number) => {
        const dx = Math.sin(camYaw + off), dz = Math.cos(camYaw + off);
        return gzClear(dx, dz) && wallRoom(dx, dz) >= CAM_BACK * 0.7;
      };
      let target = 0;
      if (!clear(dodge)) {
        if (!clear(0)) {
          const pref = dodge < 0 ? -1 : 1;
          target = 0;
          let found = false, best = -1;
          for (let k = 1; k <= 11 && !found; k++) {
            const a = k * 0.15;
            for (const o of [pref * a, -pref * a]) {
              if (clear(o)) { target = o; found = true; break; }
              // nothing fully clear (a corner): the swing with the most room
              const dx = Math.sin(camYaw + o), dz = Math.cos(camYaw + o);
              if (gzClear(dx, dz)) { const room = wallRoom(dx, dz); if (room > best + 0.3) { best = room; target = o; } }
            }
          }
          if (!found && best <= wallRoom(Math.sin(camYaw), Math.cos(camYaw)) + 0.3) target = 0;
        }
      } else if (dodge !== 0 && !clear(0)) target = dodge; // still needed: hold it
      dodge += (target - dodge) * Math.min(1, dt * 3);
      if (Math.abs(dodge) < 1e-3) dodge = 0;
    }
    const cfx = -Math.sin(camYaw + dodge), cfz = -Math.cos(camYaw + dodge);
    // lower and further back than before: more garden and sky in the frame
    const [camUp, camBack] = orb.lift(CAM_UP, CAM_BACK, 1.3); // the drag's tilt, same distance from him
    want.set(player.position.x - cfx * camBack, camUp, player.position.z - cfz * camBack);
    wantLook.set(player.position.x + cfx * 2.4, 1.3, player.position.z + cfz * 2.4);
    {
      // Things the camera must not end up inside or behind, in plan:
      const hx = player.position.x, hz = player.position.z;
      const sx = want.x - hx, sz = want.z - hz, L = Math.hypot(sx, sz) || 1, ux = sx / L, uz = sz / L;
      let boom = L;
      // the gazebo, from outside it: stop short of it, rather than standing
      // among its posts with the team-mates filling the picture
      const inGz = hx > GZ_BOX[0] && hx < GZ_BOX[1] && hz > GZ_BOX[2] && hz < GZ_BOX[3];
      if (!inGz) {
        const t = enterBox(hx, hz, ux, uz, ...GZ_BOX);
        if (t < boom) boom = Math.max(2.2, t - 0.2);
      }
      // the boundary: never out past it (the wall would hide him)
      const tw = exitGarden(hx, hz, ux, uz);
      if (tw < boom) boom = Math.max(0.9, tw);
      // the fountain's column and bowl: come in front of them if that leaves
      // room; if he is right up against it, they clear out of the way instead
      let hideTop = false;
      const tf = enterCircle(hx, hz, ux, uz, FOUNTAIN.x, FOUNTAIN.z, 1.05);
      if (tf < boom) {
        if (tf > 2.6) boom = tf - 0.25; else hideTop = true;
      }
      if (boom < L) {
        want.x = hx + ux * boom; want.z = hz + uz * boom;
        // closer in, a little lower, so it still looks over his shoulder
        want.y = Math.max(CAM_MIN_Y, camUp - 0.75 * Math.max(0, Math.min(1, (L - boom) / 4)));
      }
      fountainHide += ((hideTop ? 1 : 0) - fountainHide) * Math.min(1, dt * 9);
      const op = 1 - fountainHide;
      for (const fm of fountainMats) {
        const see = op < 0.99;
        if (fm.transparent !== see) { fm.transparent = see; fm.depthWrite = !see; fm.needsUpdate = true; }
        fm.opacity = op;
      }
      for (const o of fountainTop) o.visible = o === spray || o === bowlWater ? op > 0.6 : op > 0.04;
    }
    // over the gazebo: stay under its rafters, not up among them
    if (want.x > GAZEBO.x - GAZEBO.w / 2 - 0.9 && want.x < GAZEBO.x + GAZEBO.w / 2 + 0.9 && Math.abs(want.z - GAZEBO.z) < GAZEBO.d / 2 + 0.9) want.y = Math.min(want.y, 2.3);
    // don't let the camera go into the shop's wall
    if (want.z < SHOP.z1 + 0.6 && Math.abs(want.x) < SHOP.x1 + 0.5) want.z = SHOP.z1 + 0.6;
    // nor the casino's (8 Oct 2026)
    if (want.z < CASINO.z1 + 0.6 && want.x > CASINO.x0 - 0.5 && want.x < CASINO.x1 + 0.5) want.z = CASINO.z1 + 0.6;
    // something in the way between him and the camera: come in front of it
    headPos.set(player.position.x, 1.5, player.position.z);
    camRay.set(headPos, rayDir.subVectors(want, headPos).normalize());
    camRay.far = headPos.distanceTo(want);
    camRay.camera = camera;
    const block = camRay.intersectObjects(occluders.filter(Boolean), true)[0];
    lastBlock = block ? { d: +block.distance.toFixed(2), what: String(block.object?.parent?.name || block.object?.name || block.object?.type) } : null;
    if (block) want.copy(headPos).addScaledVector(rayDir, Math.max(1.2, block.distance - 0.35));
    const camWas = camPos.clone();
    if (first) { camPos.copy(want); camLook.copy(wantLook); first = false; shadowDirty = true; }
    else { camPos.lerp(want, Math.min(1, dt * (block ? 12 : 5))); camLook.lerp(wantLook, Math.min(1, dt * 6)); }
    // the eased camera must not lag into what the boom stopped short of (a tree, a wall): never further out than the clear distance
    if (block) {
      const lim = Math.max(1.2, block.distance - 0.35);
      if (camPos.distanceTo(headPos) > lim) camPos.sub(headPos).setLength(lim).add(headPos);
    }
    if (camPos.y < CAM_MIN_Y) camPos.y = CAM_MIN_Y;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (testCam) { camera.position.set(...testCam[0]); camera.lookAt(...testCam[1]); }
    fillLight.position.set(camPos.x * 0.6 + player.position.x * 0.4, 2.6, camPos.z * 0.6 + player.position.z * 0.4);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(projM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    impostor?.update(camera.position, dt);
    for (const ci of carImpostors) ci.update(camera.position, dt);

    let now: GardenSpot | null = null;
    for (const zn of ZONES) if (zn.inside(player.position.x, player.position.z)) { now = zn.id; break; }
    if (now !== near) { near = now; cb.onNear(near); }

    // the sun's shadow: drawn again only when he has moved or turned
    if (sun.castShadow) {
      const moved = Math.abs(nx - lastShadowX) + Math.abs(nz - lastShadowZ) > 0.004 || Math.abs(angDiff(lastShadowYaw, yaw)) > 0.004 || speed > 0.05;
      if (shadowDirty || moved || !(lastShadowX === lastShadowX)) {
        sun.shadow.needsUpdate = true;
        renderer.shadowMap.needsUpdate = true;
        shadowDirty = false;
        lastShadowX = nx; lastShadowZ = nz; lastShadowYaw = yaw;
        shadowRenders++;
      }
    }
    if (hEnh) hEnh.render(scene, camera); else renderer.render(scene, camera);
    drawn++;

    // busy (walking, turning, the camera swinging): full frame rate at fewer
    // pixels; still: 30 a second at full pixels
    busy = speed > 0.05 || mag > 0.05 || walker.active || orbitHold > 0 || orb.moving || camWas.distanceToSquared(camPos) > 1e-6 || !!faceTo;
    if (busy) { busyT += dt; stillT = 0; } else { stillT += dt; busyT = 0; }
    if (!opts.fixedStep) {
      // dynamic resolution: judged only while moving at the full cap (the
      // still picture rests at 30 a second on purpose)
      if (busy && !capAlways) dyn.frame(performance.now()); else dyn.pause();
      const wantPR = busyT > 0.25 ? movePR() : stillT > 0.5 ? stillPR() : pr;
      if (wantPR !== pr) { pr = wantPR; renderer.setPixelRatio(pr); }
    }

    frames++;
    const nowMs = performance.now();
    if (nowMs - fpsT0 >= 1000) {
      const fps = Math.round((frames * 1000) / (nowMs - fpsT0));
      cb.onFps(fps);
      frames = 0; fpsT0 = nowMs;
      if (!opts.fixedStep) {
        // too slow for three seconds: one tier down; still too slow at Low:
        // 30 frames a second all the time
        void slowSeconds; // the governor judges slow frames now (gov, above)
      }
    }
  });

  const ray = new THREE.Raycaster();
  ray.layers.enableAll();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const targets: { obj: any; spot: GardenSpot }[] = [
    { obj: cab, spot: "trophies" }, { obj: shopG, spot: "shop" }, { obj: casG, spot: "casino" }, { obj: pitchG, spot: "training" }, { obj: houseG, spot: "house" }, { obj: teq, spot: "teqball" }, { obj: sg, spot: "horse" }, { obj: gzG, spot: "mates" },
  ];
  const aim = (px: number, py: number) => {
    const rct = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((px - rct.left) / rct.width) * 2 - 1, -((py - rct.top) / rct.height) * 2 + 1), camera);
  };
  const pickSpot = (): GardenSpot | null => {
    const objs = [...targets.map((t) => t.obj), ...mates.map((m) => m.root), ...(horse ? [horse.root] : []), ...carGroups];
    const hit = ray.intersectObjects(objs, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o) {
      const t = targets.find((x) => x.obj === o);
      if (t) return t.spot;
      if (mates.some((m) => m.root === o)) return "mates";
      if (horse && horse.root === o) return "horse";
      if (carGroups.includes(o)) return "cars";
      o = o.parent;
    }
    return null;
  };
  const ctrl: GardenController = {
    setStick: (x, y) => { stick = { x, y }; if (Math.hypot(x, y) > 0.05) stopWalk(); },
    orbit: (dx, dy = 0) => { orb.drag(dx, dy); orbitHold = 1.5; },
    pick: (px, py) => { aim(px, py); return pickSpot(); },
    tap: (px, py) => {
      aim(px, py);
      const spot = pickSpot();
      if (spot) { const s = STAND[spot]; walkTo(s.at, s.face); return { spot }; }
      const hit = ray.ray.intersectPlane(ground, new THREE.Vector3());
      if (!hit || Math.hypot(hit.x - player.position.x, hit.z - player.position.z) > 40) return null;
      return walkTo([hit.x, hit.z], null) ? { spot: null } : null;
    },
    debugCamera: (pos, look) => { testCam = pos ? [pos, look ?? [0, 1, 0]] : null; },
    walking: () => ({ to: walker.goal ? [walker.goal[0], walker.goal[1]] : null, active: walker.active }),
    place: (x, z, y = yaw) => { stopWalk(); player.position.x = x; player.position.z = z; yaw = y; camYaw = y + Math.PI; orb.reset(); first = true; },
    where: () => ({ x: player.position.x, z: player.position.z, yaw, t: gameT, cam: camera.position.toArray().map((n: number) => +n.toFixed(2)), dodge: +dodge.toFixed(2), block: lastBlock }),
    stats: () => {
      // the sun's shadow pass: one draw per visible caster (renderer.info doesn't count it)
      let shadowCalls = 0, shadowTris = 0;
      scene.traverse((o: any) => {
        if (!o.isMesh || !o.castShadow || !o.visible || !o.layers.test(camera.layers)) return;
        for (let p = o.parent; p; p = p.parent) if (!p.visible) return;
        const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
        shadowCalls++; shadowTris += n * (o.isInstancedMesh ? o.count : 1);
      });
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), loaded, impostor: !!impostor?.on(), carImpostor: carImpostors.some((c) => c.on()), shadowRenders, frames: drawn, quality: tier, merged: frozen, shadowCalls, shadowTris: Math.round(shadowTris) };
    },
    debug: () => {
      const sz = (o: any) => { const b = new THREE.Box3().setFromObject(o); const v = new THREE.Vector3(); b.getSize(v); return { min: b.min.toArray().map((n: number) => +n.toFixed(2)), size: v.toArray().map((n: number) => +n.toFixed(2)) }; };
      const precise = (o: any) => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o, true); const v = new THREE.Vector3(); b.getSize(v); return { pmin: b.min.toArray().map((n: number) => +n.toFixed(3)), psize: v.toArray().map((n: number) => +n.toFixed(2)) }; };
      const triOf = (o: any) => { let t = 0; o.traverse((m: any) => { if (!m.isMesh) return; const g = m.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; t += n * (m.isInstancedMesh ? m.count : 1); }); return Math.round(t); };
      const tris = { cars: carGroups.reduce((s, c) => s + triOf(c), 0), horse: horse ? triOf(horse.root) : 0, bird: bird ? triOf(bird.root) : 0, player: triOf(player), mates: mates.reduce((s, m) => s + triOf(m.root), 0), all: triOf(scene) };
      // where the first team-mate actually touches: the underside of his seat
      // (lowest point near the hips) and his feet (lowest point of all)
      let sit: any = null;
      const m0 = mates[0];
      if (m0) {
        let body: any = null;
        m0.root.traverse((o: any) => { if (o.isSkinnedMesh && o.name !== "Outline") body ??= o; });
        if (body?.getVertexPosition) {
          const hp = new THREE.Vector3(); let hips: any = null;
          m0.root.traverse((o: any) => { if (o.isBone && o.name === "Hips") hips = o; });
          hips?.getWorldPosition(hp);
          const p = new THREE.Vector3();
          let seat = Infinity, feet = Infinity;
          const n = body.geometry.attributes.position.count;
          for (let i = 0; i < n; i += 2) {
            body.getVertexPosition(i, p); p.applyMatrix4(body.matrixWorld);
            feet = Math.min(feet, p.y);
            if (Math.hypot(p.x - hp.x, p.z - hp.z) < 0.16) seat = Math.min(seat, p.y);
          }
          sit = { hipsY: +hp.y.toFixed(3), seatUnderside: +seat.toFixed(3), feet: +feet.toFixed(3), benchTop: +(0.46 + 0.02).toFixed(3), deck: 0.03 };
        }
      }
      const pv: any[] = [];
      player.traverse((o: any) => {
        if (!o.isMesh) return;
        let nan = false;
        if (o.isSkinnedMesh) for (const b of o.skeleton.bones) if (b.matrixWorld.elements.some((e: number) => !isFinite(e))) nan = true;
        let hidden = false;
        for (let p = o; p; p = p.parent) if (!p.visible) hidden = true;
        pv.push({ n: o.name, hidden, nan, layers: o.layers.mask, camLayers: camera.layers.mask, op: o.material?.opacity, tr: o.material?.transparent, inScene: (() => { let p = o; while (p.parent) p = p.parent; return p === scene; })() });
      });
      // what lies on the line from the camera to his chest
      const rc = new THREE.Raycaster();
      rc.layers.mask = camera.layers.mask;
      rc.camera = camera;
      const chest = new THREE.Vector3(player.position.x, 1.2, player.position.z);
      rc.set(camera.position, chest.clone().sub(camera.position).normalize());
      rc.far = camera.position.distanceTo(chest) + 0.5;
      const los = rc.intersectObjects(scene.children, true).filter((h: any) => h.object.visible).slice(0, 4).map((h: any) => ({ d: +h.distance.toFixed(2), type: h.object.type, name: h.object.name, mat: h.object.material?.type, matName: h.object.material?.name, tr: h.object.material?.transparent, parent: h.object.parent?.type, ro: h.object.renderOrder }));
      return { carSizes: carImpostors.map((c) => c.size()), mateSize: impostor?.size(), los, pv, sit, tris, cars: carGroups.length, carsWanted: data.cars, horseP: horse ? precise(horse.root) : null, birdP: bird ? precise(bird.root) : null, horse: horse ? { pos: horse.root.position.toArray(), ...sz(horse.root) } : null, mates: mates.map((m) => precise(m.root)), player: precise(player), bakes: impostor?.bakes() ?? 0 };
    },
    dispose: () => {
      disposed = true;
      gov.dispose();
      savings.dispose();
      hEnh?.dispose();
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      impostor?.dispose();
      for (const ci of carImpostors) ci.dispose();
      marker.dispose();
      scene.traverse((o: any) => {
        o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x: any) => { x.map?.dispose?.(); x.dispose?.(); });
      });
      envTex.dispose();
      draco.dispose();
      renderer.dispose();
      // give the phone its 3D back now, not whenever the page is collected
      // (iPhone Safari allows only a few at once: the shop and garden swap often)
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
  return ctrl;
}

/**
 * Opens the garden. If anything fails part-way, the half-built 3D is thrown
 * away properly before the error goes up (so a retry, or the drawn garden,
 * doesn't leave a dead WebGL context behind on an iPhone).
 */
export async function startGarden(container: HTMLElement, cb: GardenCallbacks, data: GardenData, opts: GardenOptions = {}): Promise<GardenController> {
  const own: { renderer?: any } = {};
  try {
    return await buildGarden(container, cb, data, opts, own);
  } catch (e) {
    const r = own.renderer;
    if (r) {
      try { r.setAnimationLoop(null); r.dispose(); r.forceContextLoss(); r.domElement.remove(); } catch { /* already gone */ }
    }
    throw e;
  }
}
