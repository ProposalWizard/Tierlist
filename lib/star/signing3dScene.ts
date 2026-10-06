/**
 * THE SIGNING, LIVE IN 3D — three.js, built and run in the browser.
 *
 * Harry, 2 Oct 2026: "Make the cutscene 3D live. Use a rig body, but if they
 * choose a skin tone, if they have a face picture, or if they have any
 * accessories, put that in there … do all of the movement stuff as well …
 * maybe they shake hands."
 *
 * The same beats, cuts and lines as the approved picture version (v0.24):
 *   talk      over YOUR shoulder at the manager (he talks, small gestures)
 *   reply     over HIS shoulder at you
 *   contract  the contract slides across and turns to face you
 *   sign      TAP TO SIGN: the camera pulls back, you reach for the pen, pick
 *             it up, write your name, the SIGNED stamp lands, you both stand
 *             and shake hands across the desk while the camera pulls back.
 *
 * The office, desk, chairs, contract, pen and lamp are modelled here in code.
 * The two men are the approved characters (people3d.ts, 3 Oct 2026): your
 * player — your skin tone, face picture, hair (short / buzz / long, "none" is
 * the buzz), club kit and number, accessories and the Star Pass aviators —
 * and the manager in his suit. Their clips (sitting, standing up, standing)
 * are posed on top of each frame: hands on the desk, the pen, the lean, the
 * head turn and the handshake are arm IK. The models have no finger bones,
 * so a grip is the hand placed round the pen, and the pen sits in it.
 *
 * The contract is a canvas texture drawn from the career (club, seasons,
 * wage, shirt number), so no words are baked into any picture.
 *
 * three.js is imported only when this scene starts (the page lazy-loads it).
 * No shadow maps; a soft dark patch under each person and object instead.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { solveArm, handWorldQuat, setBoneWorldQuat, rotateBoneWorld, type HandAxes } from "./signing3dRig";
import {
  newNumberCanvas, drawShirtNumber, woodGrainCanvas, framedShirtCanvas, namePlateCanvas, softShadowCanvas,
  newContractCanvas, drawContract, CONTRACT_W, CONTRACT_H, CONTRACT_SIG,
} from "./signing3dTextures";
import {
  loadPeople3d, makePerson3d, dressPerson3d, poseClips, poseRest, setHipsXZ, playerModelFor,
  poseFingers, fingerTip, fingersDeg, mixFingers, hasFingers, type FingerPose, type PeopleBody,
  type Person3D, type PersonModel,
} from "./people3d";
import { people3dLook } from "./look3d";
import { withMeshopt } from "./three3d/meshopt";

type Three = typeof import("three");

export const SIGNING3D_FILES = {
  aviators: "/star/signing3d/aviators.glb",
  window: "/star/signing3d/room-golden-hour.webp",
};

export type SigningShot = "talk" | "reply" | "contract";

/** A fitted face picture (faceFit.ts's FittedHead, or anything shaped like it). */
export interface FacePicture {
  canvas: HTMLCanvasElement | HTMLImageElement; chinX: number; chinY: number; faceH: number;
  /** The photo's own skin tone (faceFit.ts samples the cheeks), "#rrggbb". */
  skin?: string;
}

export interface SigningYou {
  skin: string;
  face?: FacePicture | null;
  /** Store accessory ids worn (Sweatband, Snood, Long Sleeves …). */
  accessories: { id: string; slot: string; color: string; color2?: string; stripes?: string[] }[];
  /** The Star Pass gold aviators. */
  aviators?: boolean;
  kit: { shirt: string; trim: string };
  number?: number | null;
  /** Hair colour. */
  hair?: string;
  hairStyle?: SigningHairStyle;
}

export type SigningHairStyle = "short" | "long" | "buzz" | "none";

export interface SigningManager { skin: string; hairColour: string; grey: number; beard: boolean; bald: boolean; buzz: boolean }

export interface SigningContract {
  club: string;
  playerName: string;
  managerName: string;
  rows: [string, string][];
  /** Club colours for the paper's heading. */
  shirt: string;
  trim: string;
}

export interface SigningSceneOptions {
  you: SigningYou;
  manager: SigningManager;
  contract: SigningContract;
  /** The signature as an SVG path in a 300x60 box. */
  signaturePath: string;
  /** Things the page shows on top: the SIGNED stamp, the end. */
  onEvent?: (e: "stamp" | "shake" | "done") => void;
  /** "new" = the one body with fingers; "old" = as before. Default: Settings → Look. */
  body?: PeopleBody;
  /** "office": the same room as a stage for the manager's talks — no
   *  contract or pen, a dressed office, only the talk/reply shots. */
  stage?: "signing" | "office";
}

export interface SigningSceneHandle {
  setShot(shot: SigningShot): void;
  sign(): void;
  /** Jump to the end (the handshake held). */
  skip(): void;
  setYou(you: SigningYou): void;
  setTalking(who: "boss" | "you" | null): void;
  /** For stills: hold one moment. */
  debugSeek(what: SigningShot | "sign", t: number): void;
  debugCamera(pos: [number, number, number] | null, look: [number, number, number] | null, fov?: number): void;
  debugInfo(): Record<string, unknown>;
  /** Tuning only: hold your (or his) right hand's fingers at these angles (degrees), or null. */
  debugFingers(who: "you" | "boss", deg: Parameters<typeof fingersDeg>[0] | null): void;
  /** Tuning only: change the one body's handshake numbers (SHAKE1) on the fly. */
  debugShake(p: Partial<Record<"y" | "back" | "gap" | "lean" | "step" | "tilt", number>>): Record<string, number>;
  /** Measuring only: show or hide both men's outlines. */
  debugOutline(on: boolean): void;
  /** Tuning only: the pen in the one body's fingers (GRIP). */
  debugGrip(p: Partial<Record<"padIn" | "webOut" | "tipOut", number>>): Record<string, number>;
  /** Hold the current beat at `t` seconds into it. */
  debugHold(t: number): void;
  /** Run `n` frames of `dt` seconds each, exactly as the live loop does
   *  (same delta cap), and draw the last one. For slow-frame checks. */
  debugStep(dt: number, n?: number): void;
  /** Measuring only: time n frames (posing, drawing) and read the renderer's counts. */
  debugPerf(n?: number): Record<string, unknown>;
  dispose(): void;
}

// ── Where everything is (metres; desk centre on the floor at the origin) ──

const DESK = { w: 1.4, d: 0.68, top: 0.76 };
/** Each man's hips, seated (his chair is behind them). */
const SEAT_Z = 0.72;
const YOU_Z = SEAT_Z - 0.3;   // your chair, facing -z
const BOSS_Z = -(SEAT_Z - 0.3);   // his chair, facing +z
/** How far forward the hips travel standing up (the clip's own step, cut down to fit the desk). */
const RISE_TRAVEL = 0.5;
const PAPER = { w: 0.26, h: 0.36, z: 0.13 };
const PEN_REST = { x: 0.2, z: 0.2 };
const SIGN_T = {
  pull: 0.8, reachA: 0.1, reachB: 0.6, grip: 0.75, toLine: 1.0, writeEnd: 2.2, lift: 2.4, stamp: 2.4, putDown: 2.75,
  standA: 2.8, standB: 4.1, shakeA: 3.85, shakeB: 4.45, pumpEnd: 5.3, done: 5.35,
};
export const SIGN_SECONDS = SIGN_T.done;
/** Where in the stand-to-sit clip he is fully sat, and fully stood. */
const RISE_CLIP = { sat: 4.3, stood: 0.75 };
/** The upright part of the seated clip (it slumps into a "thinker" later). */
const SIT_CLIP = { mid: 0.45, swing: 0.35 };
/** The most his back may lean forward while he gets up (radians). */
const RISE_MAX_BEND = 0.18;

/** The pen in the (fingerless) hand, in the hand's own frame: the pad under
 *  the fingers' ends (`along` × hand length, a little off the palm), and where
 *  it rests back over the web of the thumb. Metres. */
const PEN_GRIP = { padAlong: 0.82, padPalm: 0.02, padThumb: 0.03, webAlong: 0.3, webThumb: 0.075, webPalm: 0.004, tip: 0.026 };

/** The handshake: where the hands meet (height), how far each wrist sits
 *  back from the middle, and each palm's distance off the middle plane. */
const SHAKE = { y: 1.1, back: 0.085, gap: 0.024 };
/** The one body's handshake. Measured: at 1.1 m, 8.5 cm back, your wrist
 *  could only reach 7 cm short of its mark (arm 0.49 m, shoulder 0.53 m from
 *  the desk's middle), so the hands never met — the same was true of the old
 *  bodies. Higher, the wrists nearer the middle, a deeper lean, and each man
 *  takes a short step (6 cm) in. */
/** (5 Oct, later: the wrists 7 cm back and the hands near level, the
 *  fingers wrapped less at the knuckle: at 9 cm and tipped 26° down the two
 *  hands crossed like an X and his fingers hung under yours in the close-ups.) */
const SHAKE1 = { y: 1.2, back: 0.07, gap: 0.022, lean: 0.24, step: 0.08, tilt: -0.15 };

/** THE ONE BODY'S HANDS (fingers, degrees per joint, root first). Worked out
 *  from close-up stills of the scene, not guessed. */
const HANDS = {
  /** Resting on the desk / in the lap: a loose, natural curl. */
  relax: fingersDeg({ thumb: [5, 10, 8], index: [8, 14, 8], middle: [10, 16, 10], ring: [12, 18, 10], little: [14, 20, 12], thumbSwing: 8 }),
  /** Reaching for the pen: opened a little, thumb out. */
  open: fingersDeg({ thumb: [0, 0, 0], index: [4, 6, 4], middle: [6, 8, 5], ring: [8, 10, 6], little: [10, 12, 8], thumbSwing: -10 }),
  /** Holding the pen (tripod): index and thumb pinch, the others tuck under. */
  pen: fingersDeg({ thumb: [10, 5, 5], index: [35, 45, 20], middle: [45, 58, 30], ring: [65, 80, 45], little: [72, 85, 50], thumbSwing: 20 }),
  /** The handshake: fingers wrapped round the other man's hand, thumb over his. */
  shake: fingersDeg({ thumb: [0, 12, 15], index: [25, 55, 35], middle: [28, 58, 38], ring: [30, 60, 40], little: [32, 62, 42], thumbSwing: 15 }),
  /** Holding the paper flat. */
  flat: fingersDeg({ thumb: [0, 5, 5], index: [3, 5, 3], middle: [3, 5, 3], ring: [4, 6, 4], little: [5, 7, 5], thumbSwing: 0 }),
};
/** The pen in the one body's fingers: pads a touch in from the fingertips'
 *  centre lines, the shaft over the web, the nib this far past the pads. */
// (webOut 1.2 cm → 3.5 cm, 5 Oct: the barrel ran back under the thumb, low
// in the hand; now it rests up on the web between thumb and index.)
const GRIP = { padIn: 0.004, webOut: 0.035, tipOut: 0.032 };

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

interface Person extends Person3D {
  facing: 1 | -1; // +1 faces +z
  seatZ: number;  // world z of his hips, seated
  restHeadInv: THREE.Quaternion;
  /** Hips (clip) z where the rise clip has him sat, metres. */
  riseSatZ: number;
  /** How far forward his hips end up once stood (metres, his own frame). */
  riseTravel: number;
  extras: THREE.Object3D[];
  model: PersonModel;
}

export async function createSigningScene(container: HTMLElement, opts: SigningSceneOptions): Promise<SigningSceneHandle> {
  const T: Three = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");

  // Which people: the one body (fingers that grip; Settings → Look → "3D
  // people: New") or the bodies exactly as they were ("Old").
  const BODY: PeopleBody = opts.body ?? people3dLook();
  const ONE = BODY === "new";
  /** The New look also draws lighter (5 Oct, "find ways to minimise lag"): at
   *  most 1.5 pixels per screen point, 30 frames a second while nothing but
   *  the idle sway moves, the room drawn once per camera and only the two men
   *  live on top of it, and every shader built before the first frame. Old
   *  draws exactly as it always did. */
  const FAST = ONE && !(typeof window !== "undefined" && (window as unknown as { __star3dSlow?: boolean }).__star3dSlow);

  // ── Renderer ──
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(FAST ? 1.5 : 2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const scene = new T.Scene();
  scene.background = new T.Color(0x1a120c);
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new T.PerspectiveCamera(46, 1, 0.03, 40);

  // ── Load ──
  const STAGE = opts.stage ?? "signing";
  const loader = await withMeshopt(new GLTFLoader()); // the files are meshopt-packed (scripts/perf3d/shrink-models.mjs)
  const texLoader = new T.TextureLoader();
  const youModel0 = playerModelFor(opts.you.hairStyle);
  // The window view loads with the people (it was fetched afterwards, so a
  // first frame, or a held still, showed a black pane where the stadium is).
  const winTexP = texLoader.loadAsync(SIGNING3D_FILES.window).catch(() => new T.Texture());
  const [anims, bossGltf, youGltf0] = await Promise.all([
    loadPeople3d(loader, "anims"), loadPeople3d(loader, "manager", BODY), loadPeople3d(loader, youModel0, BODY),
  ]);
  let aviatorsGltf: GLTF | null = null;
  const loadAviators = async () => {
    if (!aviatorsGltf) aviatorsGltf = await loader.loadAsync(SIGNING3D_FILES.aviators);
    return aviatorsGltf;
  };

  const v3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const wpos = (o: THREE.Object3D) => { const v = new T.Vector3(); o.getWorldPosition(v); return v; };

  // ── People ──
  const makePerson = (gltf: GLTF, model: PersonModel, facing: 1 | -1): Person => {
    const p3 = makePerson3d(T, SkeletonUtils, gltf, anims, { outline: 0.0035, outlineNear: ONE ? 1.6 : undefined });
    const seatZ = facing === 1 ? -SEAT_Z : SEAT_Z;
    p3.root.position.set(0, 0, seatZ);
    p3.root.rotation.y = facing === 1 ? 0 : Math.PI;
    scene.add(p3.root);
    // Rest head facing, for the head turn (bind pose).
    poseRest(p3);
    const hq = new T.Quaternion(); p3.bones.Head.getWorldQuaternion(hq);
    // Where the rise clip has the hips when he is fully sat.
    // and how far forward his hips go standing up (cut down to fit the desk).
    poseClips(p3, [["sitdown", RISE_CLIP.sat, 1]]);
    const riseSatZ = p3.bones.Hips.position.z * p3.unit;
    poseClips(p3, [["sitdown", RISE_CLIP.stood, 1]]);
    const riseTravel = RISE_TRAVEL * (p3.bones.Hips.position.z * p3.unit - riseSatZ);
    return Object.assign(p3, { facing, seatZ, restHeadInv: hq.invert(), riseSatZ, riseTravel, extras: [] as THREE.Object3D[], model });
  };

  const boss = makePerson(bossGltf, "manager", 1);
  dressPerson3d(T, boss, { skin: opts.manager.skin, hair: opts.manager.hairColour, grey: opts.manager.bald ? 0.85 : opts.manager.grey });
  let you = makePerson(youGltf0, youModel0, -1);

  // You: kit, number, face, accessories, aviators. A different hair style is
  // a different body, built again; anything else is paint.
  const numberCanvas = newNumberCanvas();
  const numberTex = new T.CanvasTexture(numberCanvas);
  let youBuildId = 0;
  let lastYou: SigningYou = opts.you;
  const buildYou = async (y: SigningYou) => {
    lastYou = y;
    const id = ++youBuildId;
    const model = playerModelFor(y.hairStyle);
    if (model !== you.model) {
      const g = await loadPeople3d(loader, model, BODY);
      if (id !== youBuildId) return;
      const old = you;
      you = makePerson(g, model, -1);
      you.root.position.copy(old.root.position);
      for (const e of old.extras) e.parent?.remove(e);
      scene.remove(old.root);
    }
    for (const e of you.extras) e.parent?.remove(e);
    you.extras = [];
    drawShirtNumber(numberCanvas, y.number);
    numberTex.needsUpdate = true;
    dressPerson3d(T, you, {
      skin: y.skin, hair: y.hair, kit: y.kit, number: y.number != null ? numberTex : null,
      face: y.face ?? null, faceSkin: y.face?.skin, accessories: y.accessories,
    });
    // The sunglasses: hung on the head bone in the bind pose, then they ride it.
    if (y.aviators) {
      const g = await loadAviators();
      if (id !== youBuildId) return;
      const saved = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>();
      for (const b of Object.values(you.bones)) saved.set(b, [b.position.clone(), b.quaternion.clone()]);
      poseRest(you);
      const glasses = g.scene.clone(true);
      const box = new T.Box3().setFromObject(glasses);
      const size = new T.Vector3(); box.getSize(size);
      const centre = new T.Vector3(); box.getCenter(centre);
      const F = you.meta.face;
      const s = 0.158 / size.x;
      const holder = new T.Group();
      glasses.position.sub(centre);
      holder.add(glasses);
      holder.scale.setScalar(s);
      // The lenses just clear of the nose tip, their middle on the eyes; the
      // arms run back over the ears. (Placed in the body's own rest frame.)
      holder.position.set(0, F.eyeY + 0.007, F.frontZ + 0.006 - (size.z * s) / 2);
      you.root.children[0].add(holder);
      holder.updateMatrixWorld(true);
      you.bones.Head.attach(holder);
      you.extras.push(holder);
      saved.forEach(([pos, q], b) => { b.position.copy(pos); b.quaternion.copy(q); });
      you.root.updateMatrixWorld(true);
    }
  };
  await buildYou(opts.you);

  // ── The room ──
  const room = new T.Group();
  scene.add(room);
  const std = (color: number | string, rough = 0.8, metal = 0) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    room.add(m);
    return m;
  };
  // Wood grain, drawn once.
  const woodTex = new T.CanvasTexture(woodGrainCanvas());
  woodTex.colorSpace = T.SRGBColorSpace; woodTex.wrapS = woodTex.wrapT = T.RepeatWrapping;
  const wood = new T.MeshStandardMaterial({ map: woodTex, roughness: 0.38, metalness: 0.0 });
  const darkWood = new T.MeshStandardMaterial({ color: 0x3a2114, roughness: 0.55 });
  const wall = std(0xc79a6e, 0.9);
  const leather = std(0x1c1714, 0.45);

  // Floor and walls.
  const floor = new T.Mesh(new T.PlaneGeometry(9, 9), std(0x272c38, 0.95));
  floor.rotation.x = -Math.PI / 2; room.add(floor);
  const BACK = -2.2, FRONT = 2.5, SIDE = 2.4;
  // Behind the manager: panelling, a big window over the ground, wall round it.
  box(SIDE * 2, 0.95, 0.06, darkWood, 0, 0.475, BACK);
  box(SIDE * 2, 0.05, 0.12, darkWood, 0, 0.97, BACK + 0.04);
  const winTex = await winTexP;
  winTex.colorSpace = T.SRGBColorSpace;
  winTex.repeat.set(665 / 1344, 320 / 752);
  winTex.offset.set(335 / 1344, 1 - 330 / 752);
  const view = new T.Mesh(new T.PlaneGeometry(3.4, 1.64), new T.MeshBasicMaterial({ map: winTex, toneMapped: false, color: 0xd9c2a8 }));
  view.position.set(0, 1.82, BACK - 0.02); room.add(view);
  const frameMat = std(0x2b2724, 0.5, 0.3);
  for (const x of [-1.7, -0.57, 0.57, 1.7]) box(0.06, 1.7, 0.08, frameMat, x, 1.82, BACK);
  box(3.46, 0.07, 0.08, frameMat, 0, 2.66, BACK); box(3.46, 0.07, 0.1, frameMat, 0, 1.0, BACK);
  box(SIDE * 2, 0.6, 0.06, wall, 0, 2.99, BACK - 0.01);
  for (const s of [-1, 1]) box(SIDE - 1.73, 1.7, 0.06, wall, s * (1.73 + (SIDE - 1.73) / 2), 1.82, BACK - 0.01);
  // Side walls and the wall behind you.
  for (const s of [-1, 1]) {
    const w = new T.Mesh(new T.PlaneGeometry(FRONT - BACK, 3.3), wall);
    w.position.set(s * SIDE, 1.65, (FRONT + BACK) / 2); w.rotation.y = -s * Math.PI / 2; room.add(w);
    const p = new T.Mesh(new T.PlaneGeometry(FRONT - BACK, 0.95), darkWood);
    p.position.set(s * (SIDE - 0.01), 0.475, (FRONT + BACK) / 2); p.rotation.y = -s * Math.PI / 2; room.add(p);
  }
  const fw = new T.Mesh(new T.PlaneGeometry(SIDE * 2, 3.3), wall);
  fw.position.set(0, 1.65, FRONT); fw.rotation.y = Math.PI; room.add(fw);
  box(SIDE * 2, 0.95, 0.04, darkWood, 0, 0.475, FRONT - 0.02);
  // Framed club shirts on the walls (the club's colours, no badge).
  const shirtFrame = (x: number, y: number, z: number, rotY: number, colour: string, trim: string) => {
    const c = framedShirtCanvas(colour, trim);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(new T.PlaneGeometry(0.56, 0.7), new T.MeshStandardMaterial({ map: t, roughness: 0.4 }));
    m.position.set(x, y, z); m.rotation.y = rotY; room.add(m);
  };
  shirtFrame(-0.75, 1.75, FRONT - 0.03, Math.PI, opts.contract.shirt, opts.contract.trim);
  // (every frame is the home shirt: a trim-coloured one read as the wrong club)
  shirtFrame(0.75, 1.75, FRONT - 0.03, Math.PI, opts.contract.shirt, opts.contract.trim);
  shirtFrame(-SIDE + 0.03, 1.75, -0.6, Math.PI / 2, opts.contract.shirt, opts.contract.trim);
  shirtFrame(SIDE - 0.03, 1.75, -0.6, -Math.PI / 2, opts.contract.shirt, opts.contract.trim);

  // The desk.
  box(DESK.w, 0.035, DESK.d, wood, 0, DESK.top - 0.0175, 0);
  for (const s of [-1, 1]) box(0.36, DESK.top - 0.035, DESK.d - 0.06, wood, s * (DESK.w / 2 - 0.2), (DESK.top - 0.035) / 2, 0);
  box(DESK.w - 0.8, 0.07, 0.02, wood, 0, DESK.top - 0.07, 0);
  // Leather pad, folder, pen pot, name plate, lamp.
  box(0.5, 0.004, 0.4, std(0x18120f, 0.55), 0, DESK.top + 0.002, 0.07);
  box(0.24, 0.018, 0.31, std(0x111827, 0.5), 0.47, DESK.top + 0.009, -0.12).rotation.y = -0.12;
  const pot = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.1, 20), std(0x111111, 0.35, 0.2));
  pot.position.set(-0.4, DESK.top + 0.05, -0.26); room.add(pot);
  const plateCanvas = namePlateCanvas(opts.contract.managerName);
  const plateTex = new T.CanvasTexture(plateCanvas); plateTex.colorSpace = T.SRGBColorSpace;
  const plate = new T.Mesh(new T.BoxGeometry(0.26, 0.05, 0.012), [std(0x9c7a35, 0.35, 0.6), std(0x9c7a35, 0.35, 0.6), std(0x9c7a35, 0.35, 0.6), std(0x9c7a35, 0.35, 0.6), new T.MeshStandardMaterial({ map: plateTex, roughness: 0.35, metalness: 0.3 }), std(0x9c7a35, 0.35, 0.6)]);
  plate.position.set(0.3, DESK.top + 0.027, -0.27); plate.rotation.x = -0.25; room.add(plate);
  const brass = std(0xc8942f, 0.28, 0.85);
  {
    const lamp = new T.Group();
    const base = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, 0.02, 24), brass); base.position.y = 0.01; lamp.add(base);
    const arm1 = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.36, 10), brass); arm1.position.set(0, 0.19, 0); arm1.rotation.z = 0.2; lamp.add(arm1);
    const arm2 = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.26, 10), brass); arm2.position.set(-0.1, 0.4, 0); arm2.rotation.z = 1.15; lamp.add(arm2);
    const shade = new T.Mesh(new T.ConeGeometry(0.075, 0.1, 24, 1, true), new T.MeshStandardMaterial({ color: 0xc8942f, roughness: 0.3, metalness: 0.8, side: T.DoubleSide }));
    shade.position.set(-0.22, 0.4, 0); shade.rotation.z = 0.5; lamp.add(shade);
    const bulb = new T.Mesh(new T.SphereGeometry(0.03, 12, 8), new T.MeshBasicMaterial({ color: 0xfff1c9 }));
    bulb.position.set(-0.235, 0.37, 0); lamp.add(bulb);
    lamp.position.set(-0.55, DESK.top, -0.14);
    lamp.rotation.y = 0.7;
    room.add(lamp);
  }
  // Chairs: a seat, a tall back, arms, one pedestal.
  const makeChair = (z: number, facing: 1 | -1) => {
    const g = new T.Group();
    const seat = new T.Mesh(new T.BoxGeometry(0.52, 0.09, 0.5), leather); seat.position.set(0, 0.515, -0.23); g.add(seat);
    const back = new T.Mesh(new T.BoxGeometry(0.52, 0.66, 0.1), leather); back.position.set(0, 0.92, -0.52); back.rotation.x = -0.1; g.add(back);
    for (const s of [-1, 1]) {
      const a = new T.Mesh(new T.BoxGeometry(0.05, 0.04, 0.4), leather); a.position.set(s * 0.29, 0.72, -0.25); g.add(a);
      const p = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.2, 8), brass); p.position.set(s * 0.29, 0.62, -0.2); g.add(p);
    }
    const stem = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.44, 10), std(0x222222, 0.4, 0.6)); stem.position.set(0, 0.25, -0.23); g.add(stem);
    for (let i = 0; i < 5; i++) {
      const leg = new T.Mesh(new T.BoxGeometry(0.03, 0.025, 0.3), std(0x222222, 0.4, 0.6));
      const a = (i / 5) * Math.PI * 2;
      leg.position.set(Math.sin(a) * 0.15, 0.04, -0.23 + Math.cos(a) * 0.15); leg.rotation.y = a; g.add(leg);
    }
    g.position.z = z; g.rotation.y = facing === 1 ? 0 : Math.PI;
    room.add(g);
    return g;
  };
  const youChair = makeChair(YOU_Z, -1);
  const bossChair = makeChair(BOSS_Z, 1);

  // Soft dark patches under things (no shadow maps).
  const blobTex = new T.CanvasTexture(softShadowCanvas());
  const blob = (w: number, d: number, x: number, y: number, z: number, o = 1) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: o }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); room.add(m); return m;
  };
  blob(1.9, 1.3, 0, 0.003, 0);
  blob(0.9, 0.9, 0, 0.004, YOU_Z + 0.1, 0.8);
  blob(0.9, 0.9, 0, 0.004, BOSS_Z - 0.1, 0.8);

  // ── The contract (a canvas texture: the terms come from the career) ──
  const CW = CONTRACT_W, CH = CONTRACT_H;
  const paperCanvas = newContractCanvas();
  const paperTex = new T.CanvasTexture(paperCanvas);
  paperTex.colorSpace = T.SRGBColorSpace;
  paperTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const paper = new T.Mesh(new T.PlaneGeometry(PAPER.w, PAPER.h), new T.MeshStandardMaterial({ map: paperTex, roughness: 0.85 }));
  paper.rotation.x = -Math.PI / 2;
  paper.position.set(0, DESK.top + 0.0055, PAPER.z);
  room.add(paper);
  const SIG = CONTRACT_SIG; // where your name goes, paper px
  const sigPts = sampleSignature(opts.signaturePath);
  let inkUpTo = 0;
  let stamped = false;
  const drawPaper = () => { drawContract(paperCanvas, opts.contract, sigPts, inkUpTo, stamped); paperTex.needsUpdate = true; };
  drawPaper();
  /** A point on the paper (canvas px) in the world. */
  const paperPoint = (px: number, py: number, lift = 0) =>
    paper.localToWorld(new T.Vector3((px / CW - 0.5) * PAPER.w, (0.5 - py / CH) * PAPER.h, lift));

  // ── The pen ──
  const pen = new T.Group();
  {
    const lacquer = std(0x0b0d12, 0.18, 0.4);
    const barrel = new T.Mesh(new T.CylinderGeometry(0.0052, 0.0046, 0.118, 16), lacquer); barrel.position.y = 0.073; pen.add(barrel);
    const grip = new T.Mesh(new T.CylinderGeometry(0.0046, 0.0036, 0.02, 16), brass); grip.position.y = 0.006 + 0.0095; pen.add(grip);
    const nib = new T.Mesh(new T.ConeGeometry(0.0034, 0.008, 12), brass); nib.position.y = 0.004; nib.rotation.x = Math.PI; pen.add(nib);
    const band = new T.Mesh(new T.CylinderGeometry(0.0055, 0.0055, 0.006, 16), brass); band.position.y = 0.1; pen.add(band);
    const clip = new T.Mesh(new T.BoxGeometry(0.0018, 0.04, 0.003), brass); clip.position.set(0, 0.105, 0.0058); pen.add(clip);
  }
  // A touch bigger than life, so it reads in the hand from across the desk.
  pen.scale.setScalar(1.35);
  scene.add(pen);
  const penRestPos = new T.Vector3(PEN_REST.x, DESK.top + 0.0055, PEN_REST.z);
  // Lying on the desk, tip towards the manager.
  const penRestQ = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(-0.15, 0, 1).normalize());
  const placePen = (tip: THREE.Vector3, q: THREE.Quaternion) => { pen.position.copy(tip); pen.quaternion.copy(q); };
  placePen(penRestPos.clone().add(new T.Vector3(0, 0, -0.0)), penRestQ);
  const penBlob = blob(0.06, 0.16, PEN_REST.x, DESK.top + 0.0045, PEN_REST.z + 0.06, 0.5);

  // ── The office stage (the manager talks: lib/star/office3d.ts) ──
  // The same room with no contract on the desk, and dressed as a working
  // office: a rug, a bookcase, a trophy cabinet, a plant, a laptop and a mug,
  // a ceiling light.
  if (STAGE === "office") {
    paper.visible = false; pen.visible = false; penBlob.visible = false;
    const rugM = new T.Mesh(new T.PlaneGeometry(3.0, 2.3), std(0x5b2330, 0.95));
    rugM.rotation.x = -Math.PI / 2; rugM.position.set(0, 0.002, 0); room.add(rugM);
    const rugB = new T.Mesh(new T.PlaneGeometry(2.8, 2.1), std(0x7a3141, 0.95));
    rugB.rotation.x = -Math.PI / 2; rugB.position.set(0, 0.0025, 0); room.add(rugB);
    // Bookcase on the left wall: carcass, shelves, rows of books.
    const caseX = -SIDE + 0.2, caseZ = 0.9;
    box(0.36, 2.0, 1.3, darkWood, caseX, 1.0, caseZ);
    const bookCols = [0x7f1d1d, 0x1e3a8a, 0x14532d, 0xa16207, 0x334155, 0x6b21a8, 0x9a3412, 0x0f766e];
    let k = 0;
    for (let s = 0; s < 4; s++) {
      const y = 0.25 + s * 0.45;
      box(0.33, 0.025, 1.24, wood, caseX + 0.02, y, caseZ);
      let z = caseZ - 0.58;
      while (z < caseZ + 0.56) {
        const w = 0.03 + ((k * 37) % 5) * 0.008, h = 0.24 + ((k * 13) % 4) * 0.03;
        if ((k * 7) % 11 === 3) { z += 0.07; k++; continue; }
        box(0.22, h, w, std(bookCols[k % bookCols.length], 0.7), caseX + 0.06, y + 0.0125 + h / 2, z + w / 2);
        z += w + 0.004; k++;
      }
    }
    // Trophy cabinet on the right wall, with three cups.
    const cabX = SIDE - 0.25;
    box(0.4, 0.9, 1.0, darkWood, cabX, 0.45, 0.6);
    box(0.36, 1.0, 0.96, new T.MeshStandardMaterial({ color: 0xbfd7e6, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18 }), cabX, 1.42, 0.6);
    box(0.4, 0.03, 1.0, darkWood, cabX, 1.93, 0.6);
    const gold = std(0xd4a017, 0.25, 0.9), silver = std(0xd1d5db, 0.25, 0.9);
    [[0.3, gold, 0.36], [0.6, silver, 0.3], [0.9, gold, 0.26]].forEach(([z, m, h]) => {
      const cup = new T.Group();
      const bowl = new T.Mesh(new T.CylinderGeometry(0.075, 0.04, (h as number) * 0.5, 20), m as THREE.Material); bowl.position.y = (h as number) * 0.62; cup.add(bowl);
      const stem = new T.Mesh(new T.CylinderGeometry(0.015, 0.02, (h as number) * 0.3, 10), m as THREE.Material); stem.position.y = (h as number) * 0.25; cup.add(stem);
      const foot = new T.Mesh(new T.BoxGeometry(0.1, 0.06, 0.1), darkWood); foot.position.y = 0.03; cup.add(foot);
      cup.position.set(cabX - 0.02, 0.92, z as number); room.add(cup);
    });
    // A plant in the corner by the window.
    const potM = new T.Mesh(new T.CylinderGeometry(0.17, 0.13, 0.36, 20), std(0xe5e0d8, 0.6)); potM.position.set(1.95, 0.18, -1.8); room.add(potM);
    const leafM = std(0x2f6b34, 0.75);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const leaf = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), leafM);
      leaf.scale.set(0.55, 1.4, 0.3);
      leaf.position.set(1.95 + Math.sin(a) * 0.12, 0.62 + (i % 3) * 0.14, -1.8 + Math.cos(a) * 0.12);
      leaf.rotation.set(Math.cos(a) * 0.5, a, Math.sin(a) * 0.5);
      room.add(leaf);
    }
    // On the desk: a laptop (lid half closed, facing him), a mug, a phone.
    // The lid hinges on the base's far edge (your side) and opens a little
    // past upright, its screen to him. (It used to float over the middle of
    // the base, tipped towards him: a grey slab from your side.)
    {
      const alu = std(0x9ca3af, 0.35, 0.7);
      const lap = new T.Group();
      lap.position.set(0.36, DESK.top, -0.12); lap.rotation.y = 0.25;
      const base = new T.Mesh(new T.BoxGeometry(0.32, 0.014, 0.22), alu); base.position.y = 0.007; lap.add(base);
      const keys = new T.Mesh(new T.PlaneGeometry(0.28, 0.1), std(0x1f2329, 0.6, 0.2));
      keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.0145, -0.015); lap.add(keys);
      const hinge = new T.Group(); hinge.position.set(0, 0.014, 0.108); hinge.rotation.x = 0.28; lap.add(hinge);
      const lidM = new T.Mesh(new T.BoxGeometry(0.32, 0.21, 0.008), alu); lidM.position.set(0, 0.105, 0.004); hinge.add(lidM);
      const scr = new T.Mesh(new T.PlaneGeometry(0.29, 0.18), new T.MeshBasicMaterial({ color: 0x27406b }));
      scr.position.set(0, 0.107, -0.0005); scr.rotation.y = Math.PI; hinge.add(scr);
      room.add(lap);
    }
    const mugM = new T.Mesh(new T.CylinderGeometry(0.04, 0.036, 0.1, 18), std(0xf5f5f4, 0.4)); mugM.position.set(-0.3, DESK.top + 0.05, 0.05); room.add(mugM);
    const handleM = new T.Mesh(new T.TorusGeometry(0.025, 0.007, 8, 16), std(0xf5f5f4, 0.4)); handleM.position.set(-0.345, DESK.top + 0.055, 0.05); handleM.rotation.y = Math.PI / 2; room.add(handleM);
    box(0.08, 0.008, 0.16, std(0x111111, 0.3, 0.4), 0.1, DESK.top + 0.004, 0.2).rotation.y = 0.3;
    // A pendant light over the desk.
    const cord = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.9, 6), std(0x111111)); cord.position.set(0, 2.85, 0); room.add(cord);
    const shadeP = new T.Mesh(new T.ConeGeometry(0.26, 0.2, 24, 1, true), new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5, metalness: 0.4, side: T.DoubleSide }));
    shadeP.position.set(0, 2.35, 0); room.add(shadeP);
    const glow = new T.Mesh(new T.SphereGeometry(0.06, 12, 8), new T.MeshBasicMaterial({ color: 0xfff1c9 })); glow.position.set(0, 2.3, 0); room.add(glow);
    const pend = new T.PointLight(0xffe6b8, 1.4, 4, 1.5); pend.position.set(0, 2.2, 0); scene.add(pend);
  }

  // ── Light: low gold sun through the window, warm lamps inside ──
  scene.add(new T.HemisphereLight(0xffe3c2, 0x2b211a, 1.0));
  const sun = new T.DirectionalLight(0xffc488, 2.4); sun.position.set(-1.2, 2.6, -3.5); scene.add(sun);
  const front = new T.DirectionalLight(0xdfe6ff, 0.7); front.position.set(0.8, 2.2, 3); scene.add(front);
  const lampLight = new T.PointLight(0xffcf8a, 2.2, 3.2, 1.6); lampLight.position.set(-0.4, 1.25, -0.1); scene.add(lampLight);
  const fill = new T.PointLight(0xffe2b8, 1.6, 4, 1.5); fill.position.set(-0.8, 2.2, 1.2); scene.add(fill);
  // A soft light on your face from the manager's side (a darker skin tone or
  // a face picture otherwise sinks into the warm dark of the reply shot).
  const faceFill = new T.DirectionalLight(0xfff1e0, 0.9); faceFill.position.set(0.5, 1.9, -2.6); faceFill.target.position.set(0, 1.2, 0.6); scene.add(faceFill, faceFill.target);

  // ── Posing helpers ──
  /** A direction in a person's own frame (x = his left, z = his front) to world. */
  const dirOf = (p: Person, x: number, y: number, z: number) => v3(x * p.facing, y, z * p.facing).normalize();
  const ptOf = (p: Person, x: number, y: number, z: number) => v3(x * p.facing, y, p.root.position.z + z * p.facing);

  type Side = "R" | "L";
  const bn = (s: Side, part: "Shoulder" | "Arm" | "ForeArm" | "Hand") => (s === "R" ? "Right" : "Left") + part;
  const axesOf = (p: Person, s: Side): HandAxes => {
    const h = p.hand[s];
    return { along: h.along, palm: h.palm, side: new T.Vector3().crossVectors(h.along, h.palm).normalize() };
  };
  const handQ = (p: Person, s: Side) => { const q = new T.Quaternion(); p.bones[bn(s, "Hand")].getWorldQuaternion(q); return q; };

  const lean = (p: Person, rad: number) => {
    if (!rad) return;
    const axis = new T.Vector3(0, 1, 0).cross(dirOf(p, 0, 0, 1)).normalize();
    for (const b of ["Spine02", "Spine01", "Spine"]) rotateBoneWorld(T, p.bones[b], new T.Quaternion().setFromAxisAngle(axis, rad / 3));
  };
  const lookAt = (p: Person, target: THREE.Vector3, w: number) => {
    const head = p.bones.Head;
    const hq = new T.Quaternion(); head.getWorldQuaternion(hq);
    const fwd = dirOf(p, 0, 0, 1);
    const h = wpos(head).add(v3(0, 0.1, 0));
    const want = target.clone().sub(h).normalize();
    // The head's facing now = its rest facing turned by how far the head has turned since.
    const cur = fwd.clone().applyQuaternion(hq.clone().multiply(p.restHeadInv));
    const q = new T.Quaternion().setFromUnitVectors(cur, want);
    q.slerp(new T.Quaternion(), 1 - w);
    rotateBoneWorld(T, p.bones.Head, new T.Quaternion().copy(q).slerp(new T.Quaternion(), 0.45));
    rotateBoneWorld(T, p.bones.neck, new T.Quaternion().copy(q).slerp(new T.Quaternion(), 0.55));
  };
  /** Wrist on `wrist`, fingers along `along`, palm towards `palm` (all world). */
  const placeHand = (p: Person, s: Side, wrist: THREE.Vector3, along: THREE.Vector3, palm: THREE.Vector3, pole: THREE.Vector3, w = 1) => {
    const up = p.bones[bn(s, "Arm")], lo = p.bones[bn(s, "ForeArm")], ha = p.bones[bn(s, "Hand")];
    const q0 = ha.quaternion.clone();
    solveArm(T, up, lo, ha, wrist, pole, w);
    setBoneWorldQuat(T, ha, handWorldQuat(T, axesOf(p, s), along, palm));
    if (w < 1) { ha.quaternion.copy(q0.slerp(ha.quaternion.clone(), w)); ha.updateMatrixWorld(true); }
  };
  /** The pen held in the hand: under the ends of the fingers, resting back
   *  over the web of the thumb (the models have no finger bones). */
  const penInHandOf = (p: Person, s: Side) => {
    if (hasFingers(p)) {
      // The one body: pinched between the thumb and index pads, resting back
      // over the web between them (a tripod grip, the middle finger under).
      const q = handQ(p, s);
      const palm = p.hand[s].palm.clone().applyQuaternion(q);
      const ti = fingerTip(T, p, s, "index")!, tt = fingerTip(T, p, s, "thumb")!;
      const G = ti.clone().add(tt).multiplyScalar(0.5).addScaledVector(palm, GRIP.padIn);
      const mcpI = wpos(p.fingers![s].index.bones[0]), mcpT = wpos(p.fingers![s].thumb.bones[1]);
      const web = mcpI.add(mcpT).multiplyScalar(0.5).addScaledVector(palm, -GRIP.webOut);
      const axis = web.sub(G).normalize();
      return { tip: G.clone().addScaledVector(axis, -GRIP.tipOut), axis };
    }
    const h = p.hand[s];
    const q = handQ(p, s);
    const along = h.along.clone().applyQuaternion(q), palm = h.palm.clone().applyQuaternion(q), thumb = h.thumb.clone().applyQuaternion(q);
    const W = wpos(p.bones[bn(s, "Hand")]);
    const G = PEN_GRIP;
    const pad = W.clone().addScaledVector(along, h.len * G.padAlong).addScaledVector(palm, G.padPalm).addScaledVector(thumb, G.padThumb);
    const web = W.clone().addScaledVector(along, h.len * G.webAlong).addScaledVector(thumb, G.webThumb).addScaledVector(palm, G.webPalm);
    const axis = web.sub(pad).normalize();
    return { tip: pad.clone().addScaledVector(axis, -G.tip), axis };
  };
  const ARM_R = ["RightShoulder", "RightArm", "RightForeArm", "RightHand"];
  const snapshot = (p: Person, names: string[]) => names.map((n) => [p.bones[n], p.bones[n].quaternion.clone()] as const);
  const restore = (p: Person, s: (readonly [THREE.Bone, THREE.Quaternion])[]) => { for (const [b, q] of s) b.quaternion.copy(q); p.root.updateMatrixWorld(true); };

  // ── The camera shots ──
  const SHOTS: Record<string, { pos: THREE.Vector3; look: THREE.Vector3; fov: number }> = {
    talk: { pos: v3(0.22, 1.42, 1.42), look: v3(-0.05, 1.12, -0.6), fov: 44 },
    reply: { pos: v3(-0.22, 1.42, -1.42), look: v3(0.05, 1.12, 0.6), fov: 44 },
    contract: { pos: v3(0.26, 1.62, 0.98), look: v3(-0.02, DESK.top, 0.12), fov: 40 },
    sign: { pos: v3(0.7, 1.55, -0.45), look: v3(-0.02, 0.95, 0.42), fov: 46 },
    // From behind the manager's side, across the desk: your face to camera,
    // both men whole with a margin on a 390×844 phone (a side-on shot from your
    // side cut you off at the left edge).
    shake: { pos: v3(2.3, 1.5, -1.45), look: v3(0, 1.05, 0.0), fov: 58 },
  };
  let camFrom = SHOTS.talk, camTo = SHOTS.talk;
  let camA = 0, camB = 0;
  let debugCam: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
  /** New look: this frame's camera is a held talk/reply shot (the room is
   *  drawn from its picture, see the backdrop below). Set by setCam. */
  let held = false;
  /** The held shot's field of view before its slow zoom (the picture's). */
  let heldFov = 46;
  const setCam = (t: number) => {
    held = false;
    if (debugCam) { camera.position.copy(debugCam.pos); camera.fov = debugCam.fov; camera.lookAt(debugCam.look); camera.updateProjectionMatrix(); return; }
    const k = camB > camA ? ease((t - camA) / (camB - camA)) : 1;
    held = FAST && k >= 1 && (mode === "talk" || mode === "reply");
    const pos = camFrom.pos.clone().lerp(camTo.pos, k);
    const look = camFrom.look.clone().lerp(camTo.look, k);
    // A slow drift, so a held shot is alive. (New look, held: the same push
    // in as a zoom from where the camera stands, so one picture of the room
    // serves the whole shot. A 3.5% move towards what it looks at grows that
    // by the same 3.5% as a 3.5% zoom.)
    const drift = Math.min(1, (t - camB) / 8);
    if (drift > 0 && !held) pos.add(look.clone().sub(pos).multiplyScalar(0.035 * drift));
    camera.position.copy(pos);
    camera.fov = camFrom.fov + (camTo.fov - camFrom.fov) * k;
    // Portrait screens see less sideways: widen a touch when narrow.
    const aspect = camera.aspect;
    if (aspect < 0.6) camera.fov *= 1 + (0.6 - aspect) * 0.25;
    heldFov = camera.fov;
    if (held && drift > 0) camera.fov = (2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * (1 - 0.035 * drift)) * 180) / Math.PI;
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  };

  // ── The room, drawn once per camera (New look) ──
  // talk and reply hold a fixed camera on a room where nothing moves (the
  // office's whole talk is these two shots). The room and everything on the
  // desk is drawn once into a picture with its depth; each frame draws that
  // picture, then only the two men live, hidden behind the desk and chairs by
  // the picture's depth. About 150 room draws a frame become one.
  // The picture is drawn exactly as the screen would be (three's own switch
  // for that, isXRRenderTarget: tone-mapped and sRGB-encoded into the
  // target), at 4x multisample like the screen, then copied to a plain
  // target so the big multisample buffers can go.
  const bakedBack = new Map<string, { rt: THREE.WebGLRenderTarget; fov: number }>();
  const backMat = new T.ShaderMaterial({
    uniforms: { tColor: { value: null }, tDepth: { value: null }, uK: { value: 1 } },
    vertexShader: "varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: "varying vec2 vUv;\nuniform sampler2D tColor;\nuniform sampler2D tDepth;\nuniform float uK;\nvoid main() {\n  vec2 uv = 0.5 + (vUv - 0.5) * uK;\n  gl_FragColor = texture(tColor, uv);\n  gl_FragDepth = texture(tDepth, uv).r;\n}",
    depthTest: true, depthWrite: true, depthFunc: T.AlwaysDepth, toneMapped: false,
  });
  const backGeo = new T.PlaneGeometry(2, 2);
  const backQuad = new T.Mesh(backGeo, backMat);
  backQuad.frustumCulled = false; backQuad.renderOrder = -1e9; backQuad.visible = false;
  scene.add(backQuad);
  const copyScene = new T.Scene();
  const copyQuad = new T.Mesh(backGeo, backMat); copyQuad.frustumCulled = false;
  copyScene.add(copyQuad);
  const bakeBack = (key: string) => {
    const size = renderer.getDrawingBufferSize(new T.Vector2());
    const w = size.x, h = size.y;
    const ms = new T.WebGLRenderTarget(w, h, { samples: 4, depthTexture: new T.DepthTexture(w, h) });
    (ms as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
    ms.texture.colorSpace = T.SRGBColorSpace;
    ms.texture.internalFormat = "RGBA8"; // stores the encoded bytes as they are (and resolves from the multisample buffer)
    const fov = camera.fov;
    camera.fov = heldFov; camera.updateProjectionMatrix();
    you.root.visible = false; boss.root.visible = false; backQuad.visible = false;
    room.visible = true; pen.visible = STAGE !== "office";
    renderer.setRenderTarget(ms);
    renderer.render(scene, camera);
    you.root.visible = true; boss.root.visible = true;
    let b = bakedBack.get(key);
    if (!b || b.rt.width !== w || b.rt.height !== h) {
      if (b) { b.rt.depthTexture?.dispose(); b.rt.dispose(); }
      b = { rt: new T.WebGLRenderTarget(w, h, { depthTexture: new T.DepthTexture(w, h) }), fov: 0 };
      bakedBack.set(key, b);
    }
    backMat.uniforms.tColor.value = ms.texture; backMat.uniforms.tDepth.value = ms.depthTexture; backMat.uniforms.uK.value = 1;
    renderer.setRenderTarget(b.rt);
    renderer.render(copyScene, camera);
    renderer.setRenderTarget(null);
    ms.depthTexture?.dispose(); ms.dispose();
    b.fov = heldFov;
    camera.fov = fov; camera.updateProjectionMatrix();
  };
  /** Draw this frame (the backdrop, when held, else the whole room live). */
  const draw = () => {
    // (Not on the first two frames: drawing the picture then held up the
    // first frame on screen. From the third on, the picture is ready.)
    if (held && drawn >= 2) {
      const size = renderer.getDrawingBufferSize(new T.Vector2());
      let b = bakedBack.get(mode);
      if (!b || b.rt.width !== size.x || b.rt.height !== size.y || Math.abs(b.fov - heldFov) > 1e-3) { bakeBack(mode); b = bakedBack.get(mode)!; }
      backMat.uniforms.tColor.value = b.rt.texture; backMat.uniforms.tDepth.value = b.rt.depthTexture;
      backMat.uniforms.uK.value = Math.tan((camera.fov * Math.PI) / 360) / Math.tan((b.fov * Math.PI) / 360);
      room.visible = false; pen.visible = false; backQuad.visible = true;
    } else {
      room.visible = true; pen.visible = STAGE !== "office"; backQuad.visible = false;
    }
    renderer.render(scene, camera);
  };

  // ── The timeline ──
  type Mode = SigningShot | "sign";
  let mode: Mode = "talk";
  let modeStart = 0;
  let clock = 0;
  let frozen = false;
  let talking: "boss" | "you" | null = "boss";
  const fired = new Set<string>();
  const fire = (e: "stamp" | "shake" | "done") => { if (!fired.has(e)) { fired.add(e); opts.onEvent?.(e); } };

  const cutTo = (shot: keyof typeof SHOTS, t: number, blend = 0) => {
    camFrom = blend > 0 ? { pos: camera.position.clone(), look: camTo.look.clone(), fov: camera.fov } : SHOTS[shot];
    camTo = SHOTS[shot];
    camA = t; camB = t + blend;
  };

  // Hand poses in each person's own frame (from his seated hips): [wrist x,y,z], along, palm.
  const restR = { w: [-0.19, DESK.top + 0.035, 0.4], along: [0.25, -0.15, 1], palm: [0.15, -1, 0.05] };
  const restL = { w: [0.19, DESK.top + 0.035, 0.4], along: [-0.25, -0.15, 1], palm: [-0.15, -1, 0.05] };

  // The writing hand's direction (fixed while writing).
  const writeAlong = () => dirOf(you, 0.2, -0.7, 0.68);
  const writePalm = () => dirOf(you, 0.85, -0.5, -0.1);

  /** The one body: your right hand's fingers this frame (set in frame()). */
  let fingersR: FingerPose = HANDS.relax;
  const fingerOverride: { you?: FingerPose; boss?: FingerPose } = {};
  const handsRelaxed = (p: Person) => {
    if (!hasFingers(p)) return;
    poseFingers(T, p, "R", HANDS.relax);
    poseFingers(T, p, "L", HANDS.relax);
  };

  /** Pose the writing hand so the pen tip is on `tip`. */
  const handToTip =(tip: THREE.Vector3, along: THREE.Vector3, palm: THREE.Vector3) => {
    const p = you;
    const pole = dirOf(p, -0.7, -0.6, -0.2);
    const saved = snapshot(p, ARM_R);
    // Measure where the tip lands for this hand, and move the wrist by the miss.
    let wrist = tip.clone().add(v3(0.03 * -p.facing, 0.1, 0.1 * -p.facing));
    for (let i = 0; i < 4; i++) {
      restore(p, saved);
      placeHand(p, "R", wrist, along, palm, pole, 1);
      if (hasFingers(p)) poseFingers(T, p, "R", fingersR);
      wrist = wrist.add(tip.clone().sub(penInHandOf(p, "R").tip));
    }
  };

  const restHands = (p: Person, w = 1, talk = 0, t = 0) => {
    const g = talk * Math.max(0, Math.sin(t * 2.1));
    const wr = ptOf(p, restR.w[0] - g * 0.04, restR.w[1] + g * 0.1, restR.w[2] - g * 0.02);
    const alongR = dirOf(p, restR.along[0], restR.along[1] + g * 0.6, restR.along[2]);
    const palmR = dirOf(p, restR.palm[0] - g * 0.6, -1 + g * 0.7, 0.05 + g * 0.3);
    placeHand(p, "R", wr, alongR, palmR, dirOf(p, -0.8, -0.5, -0.3), w);
    const g2 = talk * Math.max(0, Math.sin(t * 1.7 + 2.2)) * 0.6;
    const wl = ptOf(p, restL.w[0] + g2 * 0.03, restL.w[1] + g2 * 0.08, restL.w[2]);
    placeHand(p, "L", wl, dirOf(p, restL.along[0], restL.along[1] + g2 * 0.5, restL.along[2]), dirOf(p, restL.palm[0] + g2 * 0.5, -1 + g2 * 0.6, 0.05), dirOf(p, 0.8, -0.5, -0.3), w);
  };

  const headTop = (p: Person) => wpos(p.bones.Head).add(v3(0, 0.1, 0));

  /** The seated clip (its upright part, swaying a little) for each man. */
  const sitClip = (p: Person) => (p.model === "manager" ? "boss-sit" : "sitidle");
  const idleClip = (p: Person) => (p.model === "manager" ? "boss-idle" : "idle");
  const sitTime = (p: Person, t: number) => SIT_CLIP.mid + SIT_CLIP.swing * Math.sin(t * 0.45 + (p === you ? 1.3 : 0));
  /** Feet on the floor: the clips' own legs are a little shorter than these bodies'. */
  const plantFeet = (p: Person, w: number) => {
    p.root.position.y = 0;
    if (w <= 0) return;
    p.root.updateMatrixWorld(true);
    const low = Math.min(wpos(p.bones.LeftFoot).y, wpos(p.bones.RightFoot).y);
    const want = p.meta.joints.LeftFoot[1];
    p.root.position.y = Math.max(0, Math.min(0.06, want - low)) * w;
    p.root.updateMatrixWorld(true);
  };

  const frame = (t: number) => {
    const e = t - modeStart;
    // Paper: on his side until the contract shot, then it slides over and turns.
    const pk = mode === "talk" || mode === "reply" ? 0 : mode === "contract" ? seg(e, 0, 0.9) : 1;
    paper.position.z = -0.12 + (PAPER.z + 0.12) * pk;
    paper.rotation.set(-Math.PI / 2, 0, Math.PI * (1 - pk));
    paper.updateMatrixWorld(true);

    if (mode !== "sign") {
      const bossTalk = talking === "boss" ? 1 : 0;
      const youTalk = talking === "you" ? 1 : 0;
      for (const p of [boss, you]) {
        poseClips(p, [[sitClip(p), sitTime(p, t), 1]]);
        setHipsXZ(p, 0, 0);
        plantFeet(p, 0);
        youChair.position.z = YOU_Z; bossChair.position.z = BOSS_Z;
      }
      lean(boss, 0.12);
      lean(you, mode === "contract" ? 0.22 * seg(e, 0.3, 1.2) + 0.12 : 0.12);
      restHands(boss, 1, bossTalk, t);
      restHands(you, 1, youTalk * 0.6, t + 1);
      lookAt(boss, mode === "contract" ? paperPoint(CW / 2, CH / 2) : headTop(you), 0.8);
      lookAt(you, mode === "contract" ? paperPoint(CW / 2, CH * 0.45) : headTop(boss), 0.75);
      handsRelaxed(boss); handsRelaxed(you);
      placePen(penRestPos, penRestQ);
      setCam(t);
      return;
    }

    // ── TAP TO SIGN ──
    const S = SIGN_T;
    const standK = seg(e, S.standA, S.standB);
    const riseK = Math.min(1, Math.max(0, (e - S.standA) / (S.standB - S.standA)));
    const preK = seg(e, S.standA - 0.25, S.standA + 0.1);
    // The one body's fingers: open on the way to the pen, close round it,
    // let it go, then wrap round his hand in the handshake.
    const shakeW = seg(e, S.shakeA - 0.3, S.shakeB);
    {
      let f = mixFingers(HANDS.relax, HANDS.open, seg(e, S.reachA, S.reachB));
      f = mixFingers(f, HANDS.pen, seg(e, S.reachB, S.grip));
      f = mixFingers(f, HANDS.relax, seg(e, S.lift + 0.02, S.putDown));
      fingersR = fingerOverride.you ?? mixFingers(f, HANDS.shake, shakeW);
    }
    const idleW = seg(e, S.standB - 0.2, S.standB + 0.3);
    for (const p of [you, boss]) {
      const chair = p === you ? youChair : bossChair;
      chair.position.z = (p === you ? YOU_Z : BOSS_Z) - p.facing * 0.2 * seg(e, S.standA + 0.2, S.standB);
      if (e < S.standA - 0.25) poseClips(p, [[sitClip(p), sitTime(p, t), 1]]);
      else {
        const tc = RISE_CLIP.sat + (RISE_CLIP.stood - RISE_CLIP.sat) * ease(riseK);
        const idleT = Math.max(0, e - S.standB + 0.2);
        poseClips(p, [[sitClip(p), sitTime(p, t), 1 - preK], ["sitdown", tc, preK * (1 - idleW)], [idleClip(p), 1.2 + idleT, idleW]]);
      }
      setHipsXZ(p, 0, p.riseTravel * ease(riseK) + (ONE ? SHAKE1.step * shakeW : 0));
      // Getting up, the clip folds him far forward: both men at one desk
      // would meet head to head. Keep each back nearer upright.
      if (e > S.standA - 0.3) {
        // (a few passes: one spine turn only gets part of the way back)
        for (let i = 0; i < 4; i++) {
          const d = wpos(p.bones.neck).sub(wpos(p.bones.Hips));
          const bend = Math.atan2(d.dot(dirOf(p, 0, 0, 1)), d.y);
          if (bend <= RISE_MAX_BEND + 0.01) break;
          lean(p, -(bend - RISE_MAX_BEND));
        }
      }
      plantFeet(p, seg(e, S.standA + 0.5, S.standB));
    }
    // Leans: you over the paper; both a touch forward into the handshake.
    const writeLean = 0.3 * seg(e, 0, S.reachB) * (1 - seg(e, S.putDown - 0.1, S.standA + 0.3));
    const shakeLean = (ONE ? SHAKE1.lean : 0.12) * seg(e, S.shakeA - 0.2, S.shakeB);
    lean(you, 0.12 * (1 - standK) + writeLean + shakeLean);
    lean(boss, 0.12 * (1 - standK) + shakeLean);

    // The manager: hands on the desk until he stands.
    const handsW = 1 - seg(e, S.standA - 0.05, S.standA + 0.4);
    if (handsW > 0) restHands(boss, handsW, 0, t);

    // Your left hand holds the paper while you write.
    const lW = 1 - seg(e, S.standA - 0.05, S.standA + 0.4);
    if (lW > 0) placeHand(you, "L", paperPoint(40, CH * 0.66, 0.03), dirOf(you, -0.35, -0.15, 1), dirOf(you, -0.1, -1, 0), dirOf(you, 0.8, -0.5, -0.3), lW);

    // Your right hand: rest → over the pen → grip → to the line → write → lift → put down.
    const sigStart = paperPoint(SIG.x + (sigPts[0][0] / 300) * SIG.w, SIG.y + (sigPts[0][1] / 60) * SIG.h);
    const penGripOnDesk = penRestPos.clone();
    let pickK = 0;
    let penInHand = false;
    if (e < S.standA) {
      const reach = seg(e, S.reachA, S.reachB);
      const toLine = seg(e, S.grip, S.toLine);
      const writeK = Math.min(1, Math.max(0, (e - S.toLine) / (S.writeEnd - S.toLine)));
      const lift = seg(e, S.writeEnd, S.lift);
      const down = seg(e, S.lift + 0.02, S.putDown);
      pickK = seg(e, S.reachB, S.grip);
      let tip: THREE.Vector3;
      if (e < S.toLine) {
        const over = penGripOnDesk.clone().add(v3(0, 0.03 * (1 - reach) + 0.012, 0));
        tip = over.clone().lerp(sigStart.clone().add(v3(0, 0.01, 0)), toLine);
        if (toLine > 0) tip.y += Math.sin(toLine * Math.PI) * 0.04;
      } else if (e < S.writeEnd) {
        const n = writeK * (sigPts.length - 1);
        const i = Math.floor(n), f = n - i;
        const a = sigPts[i], b = sigPts[Math.min(sigPts.length - 1, i + 1)];
        const px = a[0] + (b[0] - a[0]) * f, py = a[1] + (b[1] - a[1]) * f;
        tip = paperPoint(SIG.x + (px / 300) * SIG.w, SIG.y + (py / 60) * SIG.h);
        inkUpTo = writeK;
      } else {
        inkUpTo = 1;
        const end = sigPts[sigPts.length - 1];
        const endP = paperPoint(SIG.x + (end[0] / 300) * SIG.w, SIG.y + (end[1] / 60) * SIG.h);
        tip = endP.clone().add(v3(0, 0.05 * lift, 0)).lerp(penGripOnDesk.clone().add(v3(0, 0.012, 0)), down);
      }
      penInHand = e >= S.grip && down < 0.98;
      const along = writeAlong(), palm = writePalm();
      const restAlong = dirOf(you, restR.along[0], restR.along[1], restR.along[2]);
      const restPalm = dirOf(you, restR.palm[0], restR.palm[1], restR.palm[2]);
      const k = Math.max(reach, 1 - seg(e, S.lift, S.standA - 0.05));
      const al = restAlong.clone().lerp(along, k).normalize();
      const pa = restPalm.clone().lerp(palm, k).normalize();
      if (k < 0.999 && e < S.reachB) {
        // Still coming from the rest pose: blend the IK in.
        const saved = snapshot(you, ARM_R);
        handToTip(tip, al, pa);
        const solved = snapshot(you, ARM_R);
        restore(you, saved);
        placeHand(you, "R", ptOf(you, restR.w[0], restR.w[1], restR.w[2]), restAlong, restPalm, dirOf(you, -0.8, -0.5, -0.3), 1);
        for (let j = 0; j < solved.length; j++) solved[j][0].quaternion.slerp(solved[j][1], reach);
        you.root.updateMatrixWorld(true);
      } else if (e < S.standA - 0.05) {
        handToTip(tip, al, pa);
      } else {
        // Hand back to the desk edge as he gets up.
        const back = seg(e, S.standA - 0.05, S.standA + 0.35);
        placeHand(you, "R", ptOf(you, restR.w[0], restR.w[1], restR.w[2]), restAlong, restPalm, dirOf(you, -0.8, -0.5, -0.3), 1 - back);
      }
    } else {
      inkUpTo = 1;
    }
    // Getting up, both men push off the desk edge: the clip's own hands go
    // forward and down (to the knees) and would pass through the desk. They
    // let go once nearly up, and the clip's hands hang at their sides.
    if (e >= S.standA - 0.05) {
      const span = S.standB - S.standA;
      const release = 1 - seg(e, S.standA + 0.5 * span, S.standA + 0.8 * span);
      for (const p of [you, boss]) {
        for (const s of ["R", "L"] as const) {
          const R = s === "R" ? restR : restL;
          const comeIn = p === you && s === "L" ? seg(e, S.standA - 0.05, S.standA + 0.2) : 1;
          const w = release * comeIn;
          if (w <= 0) continue;
          placeHand(p, s, ptOf(p, R.w[0], R.w[1], R.w[2]), dirOf(p, R.along[0], R.along[1], R.along[2]), dirOf(p, R.palm[0], R.palm[1], R.palm[2]),
            dirOf(p, s === "R" ? -0.8 : 0.8, -0.5, -0.3), w);
        }
      }
    }
    // Ink and the stamp on the paper.
    const wantStamp = e >= S.stamp;
    if (wantStamp && !stamped) { stamped = true; fire("stamp"); }
    if (!wantStamp && stamped) stamped = false;
    drawPaperThrottled();

    // The one body's fingers, for this frame.
    if (hasFingers(you)) {
      poseFingers(T, you, "R", fingersR);
      poseFingers(T, you, "L", mixFingers(HANDS.relax, HANDS.flat, lW));
    }
    if (hasFingers(boss)) {
      poseFingers(T, boss, "R", fingerOverride.boss ?? mixFingers(HANDS.relax, HANDS.shake, shakeW));
      poseFingers(T, boss, "L", HANDS.relax);
    }

    // The pen: on the desk, in the fingers, or on its way between.
    if (penInHand) {
      const held = penInHandOf(you, "R");
      const q = new T.Quaternion().setFromUnitVectors(v3(0, 1, 0), held.axis);
      if (pickK < 1) placePen(penRestPos.clone().lerp(held.tip, pickK), penRestQ.clone().slerp(q, pickK));
      else placePen(held.tip, q);
    } else placePen(penRestPos, penRestQ);

    // The handshake: right hands meet palm to palm over the middle of the
    // desk, upright, at arm's length. Each palm faces the other man's on the
    // plane x = 0, a hand's half-thickness (and a hair) off it, so the two
    // never pass through each other; thumbs up, fingers forward.
    if (e >= S.shakeA - 0.3) {
      const w = seg(e, S.shakeA - 0.3, S.shakeB);
      const pump = e > S.shakeB ? Math.sin((e - S.shakeB) * Math.PI * 2 * 2.4) * 0.024 * (1 - seg(e, S.pumpEnd - 0.2, S.pumpEnd)) : 0;
      const SH = ONE ? SHAKE1 : SHAKE;
      const M = v3(0, SH.y + pump, 0);
      for (const p of [you, boss]) {
        // The shoulder comes forward into the reach.
        rotateBoneWorld(T, p.bones.RightShoulder, new T.Quaternion().setFromAxisAngle(v3(0, 1, 0), 0.2 * w));
        const palm = dirOf(p, 1, 0, 0);
        const wrist = M.clone().add(palm.clone().multiplyScalar(-SH.gap));
        wrist.z = M.z - p.facing * SH.back;
        placeHand(p, "R", wrist, dirOf(p, 0, ONE ? SHAKE1.tilt : -0.05, 1), palm, dirOf(p, -0.7, -0.7, -0.15), w);
      }
      if (e >= S.shakeB) fire("shake");
    }
    if (e >= S.done) fire("done");

    // Eyes: on the paper while writing, then on each other.
    const eyesUp = seg(e, S.lift, S.standA + 0.4);
    lookAt(you, paperPoint(SIG.x + SIG.w / 2, SIG.y).lerp(headTop(boss), eyesUp), 0.8);
    lookAt(boss, paperPoint(CW / 2, CH * 0.7).lerp(headTop(you), Math.max(eyesUp, 1 - seg(e, 0, 0.6))), 0.75);

    // Camera: pulled back from the paper to the desk, then wider for the shake.
    // (a cut to the desk: a pan from your side to his flew through your head)
    if (e < S.standA) { camFrom = SHOTS.sign; camTo = SHOTS.sign; camA = camB = modeStart; }
    // (a cut as he starts to rise: a pan from the paper would lose his head)
    else { camFrom = SHOTS.shake; camTo = SHOTS.shake; camA = camB = modeStart + S.standA; }
    setCam(t);
  };
  let lastInk = -1, lastStamp = false;
  const drawPaperThrottled = () => {
    if (Math.abs(inkUpTo - lastInk) > 0.004 || stamped !== lastStamp) { lastInk = inkUpTo; lastStamp = stamped; drawPaper(); }
  };

  // ── Size and loop ──
  const resize = () => {
    const w = container.clientWidth || 390, h = container.clientHeight || 844;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let raf = 0;
  /** Frames drawn by the live loop (for measuring idle cost). */
  let drawn = 0;
  let last = performance.now();
  let visible = true;
  const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); });
  io.observe(container);
  /** One frame's worth of time: never backwards (the first frame's time can
   *  be stamped before the scene finished building), never more than a tenth
   *  of a second (a slow phone or a tab coming back from the background plays
   *  on from where it was instead of jumping). */
  const MAX_DT = 0.1;
  const stepClock = (dtRaw: number) => { clock += Math.min(MAX_DT, Math.max(0, Number.isFinite(dtRaw) ? dtRaw : 0)); };
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = (now - last) / 1000;
    last = now;
    if (frozen) return; // a held still (debugSeek) is drawn once, by itself
    stepClock(dt);
    if (!visible || document.hidden) return;
    // New look: a held shot only sways and talks, 30 frames a second is
    // plenty (the clock above still runs at the screen's rate).
    if (FAST && held && now - lastDraw < 1000 / 30 - 4) return;
    lastDraw = now;
    frame(clock);
    { const d0 = performance.now(); draw(); if (!loadT.first) loadT.first = Math.round(performance.now() - d0); }
    drawn++;
  };
  let lastDraw = 0;
  /** Measuring: how long building the shaders and the first frame took (ms). */
  const loadT = { compile: 0, first: 0 };
  let disposed = false;
  if (FAST) {
    // Every shader built now, not in the first frames on screen (a hitch on
    // the way in).
    const c0 = performance.now();
    try { await renderer.compileAsync(scene, camera); } catch { /* built on the first draw instead */ }
    // And every picture sent to the GPU now (the bodies' skin and cloth, the
    // window, the wood, the face photo), not during the first frame.
    const texs = new Set<THREE.Texture>();
    scene.traverse((o) => {
      const mats = (o as THREE.Mesh).material ? ([] as THREE.Material[]).concat((o as THREE.Mesh).material) : [];
      for (const m of mats) for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture) texs.add(v as THREE.Texture);
    });
    for (const p of [you, boss]) for (const u of Object.values(p.u)) if (u.value && (u.value as THREE.Texture).isTexture) texs.add(u.value as THREE.Texture);
    texs.forEach((t) => { try { renderer.initTexture(t); } catch { /* sent on first use instead */ } });
    loadT.compile = Math.round(performance.now() - c0);
    // (The first frame draws the talk shot's picture. The reply shot's is
    // drawn a moment after the scene is up, not before: measured, drawing
    // both before the first frame doubled the wait to get in.)
    window.setTimeout(() => {
      if (disposed || bakedBack.has("reply")) return;
      const keep = { mode, camFrom, camTo, camA, camB, pos: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov };
      mode = "reply"; camFrom = camTo = SHOTS.reply; camA = camB = clock;
      setCam(clock);
      if (held) bakeBack("reply");
      ({ mode, camFrom, camTo, camA, camB } = keep);
      camera.position.copy(keep.pos); camera.quaternion.copy(keep.q); camera.fov = keep.fov; camera.updateProjectionMatrix();
      setCam(clock);
    }, 1200);
  }
  cutTo("talk", 0);
  frame(0);
  raf = requestAnimationFrame(loop);

  const bendOf = (p: Person) => {
    const d = wpos(p.bones.neck).sub(wpos(p.bones.Hips)).normalize();
    return +(Math.acos(Math.max(-1, Math.min(1, d.y))) * 180 / Math.PI).toFixed(1);
  };
  const handle: SigningSceneHandle = {
    setShot(shot) {
      if (mode === "sign") return;
      mode = shot; modeStart = clock;
      cutTo(shot, clock, shot === "contract" ? 0.7 : 0);
      if (shot === "contract") { camFrom = { pos: camera.position.clone(), look: SHOTS.talk.look.clone(), fov: camera.fov }; }
      talking = shot === "talk" ? "boss" : shot === "reply" ? "you" : null;
    },
    setTalking(who) { talking = who; },
    sign() {
      if (STAGE === "office") return;
      if (mode === "sign") return;
      mode = "sign"; modeStart = clock; fired.clear(); inkUpTo = 0; stamped = false;
    },
    skip() {
      if (mode !== "sign") { mode = "sign"; fired.clear(); }
      modeStart = clock - SIGN_T.pumpEnd;
      fire("stamp"); fire("shake"); fire("done");
    },
    setYou(y) { void buildYou(y); },
    debugSeek(what, t) {
      frozen = true;
      mode = what; modeStart = 0; clock = t;
      talking = what === "talk" ? "boss" : what === "reply" ? "you" : null;
      if (what !== "sign") { camFrom = camTo = SHOTS[what]; camA = camB = 0; }
      inkUpTo = 0; stamped = false; fired.clear();
      frame(clock);
      draw();
    },
    debugInfo() {
      const r = (v: THREE.Vector3) => [v.x, v.y, v.z].map((n) => +n.toFixed(3));
      return {
        pen: r(pen.position), penTip: r(penInHandOf(you, "R").tip), hand: r(wpos(you.bones.RightHand)), shoulder: r(wpos(you.bones.RightArm)),
        handL: r(wpos(you.bones.LeftHand)), mode, t: clock - modeStart, model: you.model,
        head: r(wpos(you.bones.Head)), hips: r(wpos(you.bones.Hips)),
        bossHead: r(wpos(boss.bones.Head)), bossHand: r(wpos(boss.bones.RightHand)), bossHips: r(wpos(boss.bones.Hips)),
        kit: lastYou.kit, contractKit: [opts.contract.shirt, opts.contract.trim], club: opts.contract.club,
        youBend: bendOf(you), bossBend: bendOf(boss), headGap: +wpos(you.bones.Head).distanceTo(wpos(boss.bones.Head)).toFixed(3), cam: [...r(camera.position), +camera.fov.toFixed(1)],
        palmR: r(you.hand.R.palm.clone().applyQuaternion(handQ(you, "R"))), alongR: r(you.hand.R.along.clone().applyQuaternion(handQ(you, "R"))),
        bossPalmR: r(boss.hand.R.palm.clone().applyQuaternion(handQ(boss, "R"))),
        extras: you.extras.map((x) => [x.name || x.type, x.parent?.name, r(wpos(x))]),
        body: BODY, drawn, held, loadT, backQuad: backQuad.visible,
        baked: Array.from(bakedBack.entries()).map(([k, b]) => { const px = new Uint8Array(4); renderer.readRenderTargetPixels(b.rt, b.rt.width >> 1, b.rt.height >> 1, 1, 1, px); return [k, b.rt.width, b.rt.height, +b.fov.toFixed(2), Array.from(px)]; }),
        // The one body's hands, for checking a grip by numbers.
        fingers: hasFingers(you) ? Object.fromEntries((["you", "boss"] as const).map((who) => {
          const p = who === "you" ? you : boss;
          const q = handQ(p, "R");
          const W = wpos(p.bones.RightHand);
          const al = p.hand.R.along.clone().applyQuaternion(q), pa = p.hand.R.palm.clone().applyQuaternion(q), th = p.hand.R.thumb.clone().applyQuaternion(q);
          return [who, {
            wrist: r(W), along: r(al), palm: r(pa), thumbAx: r(th),
            palmC: r(W.clone().addScaledVector(al, 0.07)),
            tips: Object.fromEntries((["thumb", "index", "middle", "ring", "little"] as const).map((f) => [f, r(fingerTip(T, p, "R", f)!)])),
            mcp: r(wpos(p.fingers!.R.middle.bones[0])),
          }];
        })) : null,
      };
    },
    debugOutline(on) { you.outline.visible = on; boss.outline.visible = on; },
    debugShake(p) { Object.assign(SHAKE1, p); frame(clock); draw(); return { ...SHAKE1 }; },
    debugGrip(p) { Object.assign(GRIP, p); frame(clock); draw(); return { ...GRIP }; },
    debugFingers(who, deg) {
      if (deg) fingerOverride[who] = fingersDeg(deg); else delete fingerOverride[who];
      frame(clock);
      draw();
    },
    debugHold(t) {
      frozen = true;
      clock = modeStart + t;
      frame(clock);
      draw();
    },
    debugPerf(n = 30) {
      // Time n frames: the posing (JS) and the drawing, each forced to finish.
      frozen = true;
      const gl = renderer.getContext();
      const px = new Uint8Array(4);
      let pose = 0, drawT = 0;
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        stepClock(1 / 60); frame(clock);
        const t1 = performance.now();
        draw();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const t2 = performance.now();
        pose += t1 - t0; drawT += t2 - t1;
      }
      const inf = renderer.info;
      return {
        poseMs: +(pose / n).toFixed(2), drawMs: +(drawT / n).toFixed(2), held,
        calls: inf.render.calls, triangles: inf.render.triangles, textures: inf.memory.textures, geometries: inf.memory.geometries,
        programs: inf.programs?.length ?? 0, pixelRatio: renderer.getPixelRatio(), size: [renderer.domElement.width, renderer.domElement.height],
      };
    },
    debugStep(dt, n = 1) {
      frozen = true;
      for (let i = 0; i < n; i++) { stepClock(dt); frame(clock); }
      draw();
    },
    debugCamera(pos, look, fov = 40) {
      debugCam = pos && look ? { pos: v3(...pos), look: v3(...look), fov } : null;
      frame(clock);
      draw();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        // The bodies' geometry and textures are shared with the page's cache.
        if ((m as unknown as THREE.SkinnedMesh).isSkinnedMesh) { const mt = m.material as THREE.Material; mt.dispose(); return; }
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mt of mats) { for (const v of Object.values(mt)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose(); mt.dispose(); }
      });
      numberTex.dispose();
      pmrem.dispose();
      if (FAST) {
        // The room's pictures, the face picture, the room light map; then the
        // whole GL context at once, so a phone gets its memory back on leaving.
        bakedBack.forEach((b) => { b.rt.depthTexture?.dispose(); b.rt.dispose(); });
        bakedBack.clear();
        backGeo.dispose(); backMat.dispose();
        (scene.environment as THREE.Texture | null)?.dispose();
        for (const p of [you, boss]) {
          const ft = (p.u as Record<string, { value: unknown }>).uFaceTex?.value as (THREE.Texture & { userData: { mine?: boolean } }) | undefined;
          if (ft?.userData?.mine) ft.dispose();
        }
        renderer.dispose();
        renderer.forceContextLoss();
      } else renderer.dispose();
      canvas.remove();
    },
  };
  return handle;
}

/** Points along an SVG path (in its own units), evenly spaced. */
function sampleSignature(d: string): [number, number][] {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const len = path.getTotalLength();
  const pts: [number, number][] = [];
  const n = 90;
  for (let i = 0; i < n; i++) { const p = path.getPointAtLength((i / (n - 1)) * len); pts.push([p.x, p.y]); }
  svg.remove();
  return pts;
}
