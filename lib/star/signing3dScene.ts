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
  type Person3D, type PersonModel,
} from "./people3d";

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
  /** Hold the current beat at `t` seconds into it. */
  debugHold(t: number): void;
  /** Run `n` frames of `dt` seconds each, exactly as the live loop does
   *  (same delta cap), and draw the last one. For slow-frame checks. */
  debugStep(dt: number, n?: number): void;
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

  // ── Renderer ──
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
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
  const loader = new GLTFLoader();
  const texLoader = new T.TextureLoader();
  const youModel0 = playerModelFor(opts.you.hairStyle);
  const [anims, bossGltf, youGltf0] = await Promise.all([
    loadPeople3d(loader, "anims"), loadPeople3d(loader, "manager"), loadPeople3d(loader, youModel0),
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
    const p3 = makePerson3d(T, SkeletonUtils, gltf, anims, { outline: 0.0035 });
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
  const buildYou = async (y: SigningYou) => {
    const id = ++youBuildId;
    const model = playerModelFor(y.hairStyle);
    if (model !== you.model) {
      const g = await loadPeople3d(loader, model);
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
  const winTex = texLoader.load(SIGNING3D_FILES.window);
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
  shirtFrame(0.75, 1.75, FRONT - 0.03, Math.PI, opts.contract.trim, opts.contract.shirt);
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
  blob(0.06, 0.16, PEN_REST.x, DESK.top + 0.0045, PEN_REST.z + 0.06, 0.5);

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
    shake: { pos: v3(2.6, 1.5, 0.9), look: v3(0, 1.1, 0.0), fov: 50 },
  };
  let camFrom = SHOTS.talk, camTo = SHOTS.talk;
  let camA = 0, camB = 0;
  let debugCam: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
  const setCam = (t: number) => {
    if (debugCam) { camera.position.copy(debugCam.pos); camera.fov = debugCam.fov; camera.lookAt(debugCam.look); camera.updateProjectionMatrix(); return; }
    const k = camB > camA ? ease((t - camA) / (camB - camA)) : 1;
    const pos = camFrom.pos.clone().lerp(camTo.pos, k);
    const look = camFrom.look.clone().lerp(camTo.look, k);
    // A slow drift, so a held shot is alive.
    const drift = Math.min(1, (t - camB) / 8);
    if (drift > 0) pos.add(look.clone().sub(pos).multiplyScalar(0.035 * drift));
    camera.position.copy(pos);
    camera.fov = camFrom.fov + (camTo.fov - camFrom.fov) * k;
    // Portrait screens see less sideways: widen a touch when narrow.
    const aspect = camera.aspect;
    if (aspect < 0.6) camera.fov *= 1 + (0.6 - aspect) * 0.25;
    camera.lookAt(look);
    camera.updateProjectionMatrix();
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

  /** Pose the writing hand so the pen tip is on `tip`. */
  const handToTip = (tip: THREE.Vector3, along: THREE.Vector3, palm: THREE.Vector3) => {
    const p = you;
    const pole = dirOf(p, -0.7, -0.6, -0.2);
    const saved = snapshot(p, ARM_R);
    // Measure where the tip lands for this hand, and move the wrist by the miss.
    let wrist = tip.clone().add(v3(0.03 * -p.facing, 0.1, 0.1 * -p.facing));
    for (let i = 0; i < 4; i++) {
      restore(p, saved);
      placeHand(p, "R", wrist, along, palm, pole, 1);
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
      placePen(penRestPos, penRestQ);
      setCam(t);
      return;
    }

    // ── TAP TO SIGN ──
    const S = SIGN_T;
    const standK = seg(e, S.standA, S.standB);
    const riseK = Math.min(1, Math.max(0, (e - S.standA) / (S.standB - S.standA)));
    const preK = seg(e, S.standA - 0.25, S.standA + 0.1);
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
      setHipsXZ(p, 0, p.riseTravel * ease(riseK));
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
    const shakeLean = 0.12 * seg(e, S.shakeA - 0.2, S.shakeB);
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
      const M = v3(0, SHAKE.y + pump, 0);
      for (const p of [you, boss]) {
        // The shoulder comes forward into the reach.
        rotateBoneWorld(T, p.bones.RightShoulder, new T.Quaternion().setFromAxisAngle(v3(0, 1, 0), 0.2 * w));
        const palm = dirOf(p, 1, 0, 0);
        const wrist = M.clone().add(palm.clone().multiplyScalar(-SHAKE.gap));
        wrist.z = M.z - p.facing * SHAKE.back;
        placeHand(p, "R", wrist, dirOf(p, 0, -0.05, 1), palm, dirOf(p, -0.7, -0.7, -0.15), w);
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
    frame(clock);
    renderer.render(scene, camera);
  };
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
      renderer.render(scene, camera);
    },
    debugInfo() {
      const r = (v: THREE.Vector3) => [v.x, v.y, v.z].map((n) => +n.toFixed(3));
      return {
        pen: r(pen.position), penTip: r(penInHandOf(you, "R").tip), hand: r(wpos(you.bones.RightHand)), shoulder: r(wpos(you.bones.RightArm)),
        handL: r(wpos(you.bones.LeftHand)), mode, t: clock - modeStart, model: you.model,
        head: r(wpos(you.bones.Head)), hips: r(wpos(you.bones.Hips)),
        bossHead: r(wpos(boss.bones.Head)), bossHand: r(wpos(boss.bones.RightHand)), bossHips: r(wpos(boss.bones.Hips)),
        youBend: bendOf(you), bossBend: bendOf(boss), headGap: +wpos(you.bones.Head).distanceTo(wpos(boss.bones.Head)).toFixed(3), cam: [...r(camera.position), +camera.fov.toFixed(1)],
        palmR: r(you.hand.R.palm.clone().applyQuaternion(handQ(you, "R"))), alongR: r(you.hand.R.along.clone().applyQuaternion(handQ(you, "R"))),
        bossPalmR: r(boss.hand.R.palm.clone().applyQuaternion(handQ(boss, "R"))),
        extras: you.extras.map((x) => [x.name || x.type, x.parent?.name, r(wpos(x))]),
      };
    },
    debugHold(t) {
      frozen = true;
      clock = modeStart + t;
      frame(clock);
      renderer.render(scene, camera);
    },
    debugStep(dt, n = 1) {
      frozen = true;
      for (let i = 0; i < n; i++) { stepClock(dt); frame(clock); }
      renderer.render(scene, camera);
    },
    debugCamera(pos, look, fov = 40) {
      debugCam = pos && look ? { pos: v3(...pos), look: v3(...look), fov } : null;
      frame(clock);
      renderer.render(scene, camera);
    },
    dispose() {
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
      renderer.dispose();
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
