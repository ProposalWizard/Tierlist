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
 * The two men are the rigged body (signing3dRig.ts). The contract is a canvas
 * texture drawn from the career (club, seasons, wage, shirt number), so no
 * words are baked into any picture.
 *
 * three.js is imported only when this scene starts (the page lazy-loads it).
 * No shadow maps; a soft dark patch under each person and object instead.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  landmarksOf, weldBody, buildGarment, hideCoveredSkin, kitSpec, suitSpec, footSpec, sleevesSpec, wristTapeSpec,
  glovesSpec, armbandSpec, headbandSpec, snoodSpec, slimArms, HAND_SCALE, faceFrameOf, buildFaceDecal, solveArm, handAxesOf, handWorldQuat,
  setBoneWorldQuat, rotateBoneWorld, curlFinger, aimBone, type GarmentSpec, type HandAxes, type Landmarks, type WeldedBody,
} from "./signing3dRig";
import {
  averageColour, newNumberCanvas, drawShirtNumber, woodGrainCanvas, framedShirtCanvas, namePlateCanvas, softShadowCanvas,
  newContractCanvas, drawContract, CONTRACT_W, CONTRACT_H, CONTRACT_SIG,
} from "./signing3dTextures";

type Three = typeof import("three");

export const SIGNING3D_FILES = {
  people: "/star/signing3d/people.glb",
  anims: "/star/signing3d/anims.glb",
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
const YOU_Z = 0.5;     // your chair, facing -z
const BOSS_Z = -0.5;   // his chair, facing +z
const PAPER = { w: 0.26, h: 0.36, z: 0.13 };
const PEN_REST = { x: 0.24, z: 0.12 };
const SIGN_T = {
  pull: 0.8, reachA: 0.1, reachB: 0.6, grip: 0.75, toLine: 1.0, writeEnd: 2.1, lift: 2.3, stamp: 2.3, putDown: 2.6,
  standA: 2.6, standB: 3.63, stepB: 3.95, shakeA: 3.7, shakeB: 4.05, pumpEnd: 4.85, done: 4.9,
};
export const SIGN_SECONDS = SIGN_T.done;

/** The writing grip: how far the pen sits under the first finger's pad,
 *  towards the thumb, where it rests on the web, and how much nib shows. */
const PEN_GRIP = { pad: 0.011, side: 0.004, web: 0.014, webUp: 0.006, tip: 0.024 };

/** The handshake: where the palms meet (height), how far each wrist sits
 *  back from the middle, and each palm's distance off the middle plane. */
const SHAKE = { y: 1.07, back: 0.08, gap: 0.021 };

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

interface Person {
  root: THREE.Object3D;
  body: THREE.SkinnedMesh;
  weld: WeldedBody;
  L: Landmarks;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  bones: Record<string, THREE.Bone>;
  handAxR: HandAxes;
  handAxL: HandAxes;
  extras: THREE.Object3D[];
  skinMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  hairMat2: THREE.MeshStandardMaterial;
  facing: 1 | -1; // +1 faces +z
  restHeadInv?: THREE.Quaternion;
  /** Each bone's own rest position and turn (the file's), for hanging things on bones. */
  rest: Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>;
  /** Every bone as the clips last left it, before this frame's leans, IK and
   *  grips. Put back at the start of each frame (see `clips`). */
  base: Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>;
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
  const [people, anims] = await Promise.all([
    loader.loadAsync(SIGNING3D_FILES.people) as Promise<GLTF>,
    loader.loadAsync(SIGNING3D_FILES.anims) as Promise<GLTF>,
  ]);
  let aviatorsGltf: GLTF | null = null;
  const loadAviators = async () => {
    if (!aviatorsGltf) aviatorsGltf = await loader.loadAsync(SIGNING3D_FILES.aviators);
    return aviatorsGltf;
  };

  // The average colour of each texture, so a tint lands on the colour asked for.
  const avgOf = (tex: THREE.Texture | null) => averageColour(tex?.image as CanvasImageSource | undefined);
  let skinAvg: [number, number, number] = [0.5, 0.4, 0.35];
  let hairAvg: [number, number, number] = [0.3, 0.3, 0.3];
  let hair2Avg: [number, number, number] = [0.3, 0.3, 0.3];
  people.scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (m.name === "Body") skinAvg = avgOf(mat.map);
    if (m.name === "Hair_SimpleParted") hairAvg = avgOf(mat.map);
    if (m.name === "Hair_Long") hair2Avg = avgOf(mat.map);
  });
  const tinted = (hex: string, avg: [number, number, number], k = 1) => {
    const c = new T.Color(hex); // linear
    return new T.Color(Math.min(4, (c.r / avg[0]) * k), Math.min(4, (c.g / avg[1]) * k), Math.min(4, (c.b / avg[2]) * k));
  };

  // ── People ──
  const makePerson = (facing: 1 | -1, z: number): Person => {
    const root = SkeletonUtils.clone(people.scene) as THREE.Object3D;
    root.position.set(0, 0, z);
    root.rotation.y = facing === 1 ? 0 : Math.PI;
    const body = root.getObjectByName("Body") as THREE.SkinnedMesh;
    const bones: Record<string, THREE.Bone> = {};
    root.traverse((o) => { if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone; });
    // Rest-pose measurements, before any clip touches the bones.
    root.updateMatrixWorld(true);
    const rootInv = new T.Matrix4().copy(root.matrixWorld).invert();
    void rootInv;
    const L = landmarksOf(T, root);
    const handAxR = handAxesOf(T, bones.hand_r, bones.middle_01_r);
    const handAxL = handAxesOf(T, bones.hand_l, bones.middle_01_l);
    body.geometry = body.geometry.clone();
    slimArms(T, root, body.geometry, L);
    const weld = weldBody(body.geometry);
    const skinMat = (body.material as THREE.MeshStandardMaterial).clone();
    body.material = skinMat;
    const hairMat = ((root.getObjectByName("Hair_SimpleParted") as THREE.Mesh).material as THREE.MeshStandardMaterial).clone();
    const hairMat2 = ((root.getObjectByName("Hair_Long") as THREE.Mesh).material as THREE.MeshStandardMaterial).clone();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.name.startsWith("Hair_") || m.name === "Eyebrows")) { m.material = m.name === "Hair_Long" ? hairMat2 : hairMat; }
      if (m.isMesh) m.frustumCulled = false;
    });
    const rest = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>();
    for (const b of Object.values(bones)) rest.set(b, [b.position.clone(), b.quaternion.clone()]);
    const mixer = new T.AnimationMixer(root);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of anims.animations) {
      const a = mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(0);
      actions[clip.name] = a;
    }
    scene.add(root);
    // Hands a size down, about the wrist (bones, so the fingers and their
    // joints shrink together; the clips never touch a bone's scale).
    bones.hand_l.scale.setScalar(HAND_SCALE);
    bones.hand_r.scale.setScalar(HAND_SCALE);
    const base = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>();
    for (const b of Object.values(bones)) base.set(b, [b.position.clone(), b.quaternion.clone()]);
    return { root, body, weld, L, mixer, actions, bones, handAxR, handAxL, extras: [], skinMat, hairMat, hairMat2, facing, rest, base };
  };

  const you = makePerson(-1, YOU_Z);
  const boss = makePerson(1, BOSS_Z);

  const show = (p: Person, name: string, on: boolean) => { const o = p.root.getObjectByName(name); if (o) o.visible = on; };

  // The manager: suit, hair, beard.
  {
    const m = opts.manager;
    boss.skinMat.color.copy(tinted(m.skin, skinAvg));
    const hair = new T.Color(m.hairColour).lerp(new T.Color("#c9c9c9"), m.grey);
    boss.hairMat.color.copy(tinted("#" + hair.getHexString(T.LinearSRGBColorSpace), hairAvg));
    show(boss, "Hair_SimpleParted", !m.bald && !m.buzz);
    show(boss, "Hair_Buzzed", m.buzz);
    show(boss, "Hair_Beard", m.beard);
    show(boss, "Hair_Long", false);
    const specs = [...suitSpec(boss.L, { suit: "#1c2433", tie: new T.Color(opts.contract.shirt).getHSL({ h: 0, s: 0, l: 0 }).l > 0.6 ? opts.contract.trim : opts.contract.shirt }), footSpec(boss.L, "#0b0b0c", "#1f1a17", true)];
    for (const s of specs) { const g = buildGarment(T, boss.body, boss.weld, s); boss.body.parent!.add(g); }
    hideCoveredSkin(T, boss.body, boss.weld, specs);
  }

  // You: kit, number, face, accessories. Rebuilt when the look changes.
  const numberCanvas = newNumberCanvas();
  const numberTex = new T.CanvasTexture(numberCanvas);
  const drawNumber = (n: number | null | undefined) => { drawShirtNumber(numberCanvas, n); numberTex.needsUpdate = true; };
  const youBaseIndex = you.body.geometry.index!.clone();
  const youRestPos = (you.body.geometry.attributes.position.array as Float32Array).slice();
  let youBuildId = 0;
  const buildYou = async (y: SigningYou) => {
    const id = ++youBuildId;
    for (const e of you.extras) e.parent?.remove(e);
    you.extras = [];
    you.body.geometry.setIndex(youBaseIndex.clone());
    // A clean face (a face picture softens it in place).
    (you.body.geometry.attributes.position.array as Float32Array).set(youRestPos);
    you.body.geometry.attributes.position.needsUpdate = true;
    you.skinMat.color.copy(tinted(y.skin, skinAvg));
    you.hairMat.color.copy(tinted(y.hair ?? "#2b1b12", hairAvg));
    you.hairMat2.color.copy(tinted(y.hair ?? "#2b1b12", hair2Avg));
    const style = y.hairStyle ?? "short";
    show(you, "Hair_Buzzed", style === "buzz");
    show(you, "Hair_Beard", false);
    show(you, "Hair_SimpleParted", style === "short");
    show(you, "Hair_Long", style === "long");
    drawNumber(y.number);
    const acc = (slot: string) => y.accessories.find((a) => a.slot === slot);
    const L = you.L;
    const kit = { shirt: y.kit.shirt, trim: y.kit.trim, shorts: y.kit.trim, socks: y.kit.shirt };
    const specs: GarmentSpec[] = kitSpec(L, kit);
    specs[0].uniforms = { uNumber: { value: numberTex } };
    const boots = acc("boots");
    specs.push(footSpec(L, boots?.color ?? "#111214", boots?.color2 ?? "#f4f4f5", !!boots));
    const sl = acc("arms"); if (sl) specs.push(sleevesSpec(L, sl.color));
    const tp = acc("wrists"); if (tp) specs.push(wristTapeSpec(L, tp.color));
    const gl = acc("hands"); if (gl) specs.push(glovesSpec(L, gl.color, gl.color2));
    const ab = acc("armband"); if (ab) specs.push(armbandSpec(L, ab.stripes ?? (ab.color2 ? [ab.color, ab.color] : [ab.color])));
    const F = faceFrameOf(you.weld, L);
    const hb = acc("head"); if (hb) specs.push(headbandSpec(L, F.browY, hb.color, hb.color2));
    const sn = acc("neck"); if (sn) specs.push(snoodSpec(L, sn.color));
    for (const s of specs) { const g = buildGarment(T, you.body, you.weld, s); you.body.parent!.add(g); you.extras.push(g); }
    // The face picture over the head; his own modelled eyes and brows go.
    hideCoveredSkin(T, you.body, you.weld, specs);
    if (y.face) {
      // The photo's skin brought to the body's skin tone (so a fair photo on
      // a dark body, or the other way, doesn't read as a mask).
      const want = tinted(y.skin, [1, 1, 1]);
      const has = new T.Color(y.face.skin ?? y.skin);
      const k = (a: number, b: number) => Math.min(1.8, Math.max(0.25, a / Math.max(0.004, b)));
      const d = buildFaceDecal(T, you.body, you.weld, F, y.face, [k(want.r, has.r), k(want.g, has.g), k(want.b, has.b)]);
      you.body.parent!.add(d); you.extras.push(d);
    }
    show(you, "Eyes", !y.face);
    show(you, "Eyebrows", !y.face);
    // The sunglasses: hung on the head bone in the rest pose, then they ride it.
    if (y.aviators) {
      const g = await loadAviators();
      if (id !== youBuildId) return;
      const restMats = poseRest(you);
      const glasses = g.scene.clone(true);
      // Fit Mikey's aviators to this head: the lens line on the eyes.
      const box = new T.Box3().setFromObject(glasses);
      const size = new T.Vector3(); box.getSize(size);
      const centre = new T.Vector3(); box.getCenter(centre);
      const s = 0.152 / size.x;
      const holder = new T.Group();
      glasses.position.sub(centre);
      holder.add(glasses);
      holder.scale.setScalar(s);
      // The lenses (the front of the model's box) just clear of the nose
      // tip, their middle on the eyes; the arms run back over the ears.
      attachRest(you, holder, "Head", new T.Vector3(0, F.eyeY - 0.004, F.frontZ + 0.004 - (size.z * s) / 2));
      restoreRest(you, restMats);
    }
  };

  // Rest pose, briefly, to hang things on bones in the measured places.
  const poseRest = (p: Person) => {
    const saved = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion, THREE.Vector3]>();
    p.rest.forEach((_, b) => saved.set(b, [b.position.clone(), b.quaternion.clone(), b.scale.clone()]));
    // The bind pose: the one the body's own vertices (and so every rest
    // measurement here) are in.
    p.body.skeleton.pose();
    p.root.updateMatrixWorld(true);
    return saved;
  };
  const restoreRest = (p: Person, saved: Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion, THREE.Vector3]>) => {
    // (the clips set every bone's turn again on the next frame anyway; not its scale)
    saved.forEach(([pos, q, sc], b) => { b.position.copy(pos); b.quaternion.copy(q); b.scale.copy(sc); });
    p.root.updateMatrixWorld(true);
  };
  const attachRest = (p: Person, obj: THREE.Object3D, boneName: string, restPos: THREE.Vector3) => {
    obj.position.copy(restPos);
    p.root.add(obj);
    obj.updateMatrixWorld(true);
    p.bones[boneName].attach(obj);
    p.extras.push(obj);
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
    const seat = new T.Mesh(new T.BoxGeometry(0.52, 0.09, 0.5), leather); seat.position.set(0, 0.46, -0.23); g.add(seat);
    const back = new T.Mesh(new T.BoxGeometry(0.52, 0.66, 0.1), leather); back.position.set(0, 0.86, -0.52); back.rotation.x = -0.1; g.add(back);
    for (const s of [-1, 1]) {
      const a = new T.Mesh(new T.BoxGeometry(0.05, 0.04, 0.4), leather); a.position.set(s * 0.29, 0.66, -0.25); g.add(a);
      const p = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.2, 8), brass); p.position.set(s * 0.29, 0.56, -0.2); g.add(p);
    }
    const stem = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.36, 10), std(0x222222, 0.4, 0.6)); stem.position.set(0, 0.22, -0.23); g.add(stem);
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

  // ── Posing helpers ──
  const v3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  /** A direction in a person's own frame (x = his left, z = his front) to world. */
  const dirOf = (p: Person, x: number, y: number, z: number) => v3(x * p.facing, y, z * p.facing).normalize();
  const ptOf = (p: Person, x: number, y: number, z: number) => v3(x * p.facing, y, p.root.position.z + z * p.facing);
  const wpos = (o: THREE.Object3D) => { const v = new T.Vector3(); o.getWorldPosition(v); return v; };

  const clips = (p: Person, entries: [string, number, number][]) => {
    for (const a of Object.values(p.actions)) a.setEffectiveWeight(0);
    for (const [name, time, w] of entries) {
      const a = p.actions[name];
      if (!a) continue;
      a.setEffectiveWeight(w);
      a.time = Math.max(0, Math.min(time, a.getClip().duration - 1e-3));
    }
    // three.js's mixer only writes a bone when its clip value CHANGED since
    // the last frame. spine_01 (and the clavicles, root, pelvis, some fingers)
    // never move in these clips, so the mixer stopped writing them after the
    // first frame — and the lean, head turn and shoulder roll below, which
    // turn bones from where they are, piled up frame on frame until both men
    // folded over the desk. So put every bone back to the clips' own pose
    // first: whether or not the mixer writes a bone, it then starts the frame
    // from the clips, and everything after it is the same every frame.
    p.base.forEach(([pos, q], b) => { b.position.copy(pos); b.quaternion.copy(q); });
    p.mixer.update(0);
    p.base.forEach(([pos, q], b) => { pos.copy(b.position); q.copy(b.quaternion); });
    p.root.updateMatrixWorld(true);
  };
  const lean = (p: Person, rad: number) => {
    if (!rad) return;
    const axis = new T.Vector3(0, 1, 0).cross(dirOf(p, 0, 0, 1)).normalize();
    for (const b of ["spine_01", "spine_02", "spine_03"]) rotateBoneWorld(T, p.bones[b], new T.Quaternion().setFromAxisAngle(axis, rad / 3));
  };
  const lookAt = (p: Person, target: THREE.Vector3, w: number) => {
    const head = p.bones.Head;
    const hq = new T.Quaternion(); head.getWorldQuaternion(hq);
    // The head's forward, measured off the face (rest: +z of the body).
    const fwd = dirOf(p, 0, 0, 1);
    const rootQ = new T.Quaternion(); p.root.getWorldQuaternion(rootQ);
    void rootQ;
    const h = wpos(head).add(v3(0, 0.09, 0));
    const want = target.clone().sub(h).normalize();
    // Current facing of the head = its rest facing turned by how the head has turned since rest.
    const cur = fwd.clone().applyQuaternion(hq.clone().multiply(p.restHeadInv!));
    const q = new T.Quaternion().setFromUnitVectors(cur, want);
    q.slerp(new T.Quaternion(), 1 - w);
    rotateBoneWorld(T, p.bones.Head, new T.Quaternion().copy(q).slerp(new T.Quaternion(), 0.45));
    rotateBoneWorld(T, p.bones.neck_01, new T.Quaternion().copy(q).slerp(new T.Quaternion(), 0.55));
  };
  type Side = "r" | "l";
  const fingersOf = (p: Person, s: Side) => ({
    index: [p.bones[`index_01_${s}`], p.bones[`index_02_${s}`], p.bones[`index_03_${s}`]],
    middle: [p.bones[`middle_01_${s}`], p.bones[`middle_02_${s}`], p.bones[`middle_03_${s}`]],
    ring: [p.bones[`ring_01_${s}`], p.bones[`ring_02_${s}`], p.bones[`ring_03_${s}`]],
    pinky: [p.bones[`pinky_01_${s}`], p.bones[`pinky_02_${s}`], p.bones[`pinky_03_${s}`]],
    thumb: [p.bones[`thumb_01_${s}`], p.bones[`thumb_02_${s}`], p.bones[`thumb_03_${s}`]],
  });
  const palmOf = (p: Person, s: Side) => {
    const q = new T.Quaternion(); p.bones[`hand_${s}`].getWorldQuaternion(q);
    return (s === "r" ? p.handAxR : p.handAxL).palm.clone().applyQuaternion(q);
  };
  /** Grips, radians of curl per finger joint, from straight. */
  const GRIPS = {
    flat: { index: [0.05, 0.08, 0.05], middle: [0.05, 0.08, 0.05], ring: [0.08, 0.1, 0.05], pinky: [0.1, 0.1, 0.05], thumb: [0, 0, 0] },
    pen: { index: [0.22, 0.38, 0.28], middle: [0.55, 0.85, 0.55], ring: [1.0, 1.1, 0.7], pinky: [1.1, 1.1, 0.7], thumb: [0.2, 0.3, 0.2] },
    shake: { index: [0.06, 0.12, 0.08], middle: [0.06, 0.12, 0.08], ring: [0.08, 0.12, 0.08], pinky: [0.1, 0.14, 0.08], thumb: [0.05, 0.12, 0.05] },
    open: { index: [0.1, 0.1, 0.05], middle: [0.1, 0.12, 0.05], ring: [0.15, 0.15, 0.05], pinky: [0.2, 0.15, 0.05], thumb: [0, 0.05, 0] },
  } as const;
  type GripName = keyof typeof GRIPS;
  const grip = (p: Person, s: Side, a: GripName, b: GripName = a, t = 0) => {
    const f = fingersOf(p, s);
    // From straight fingers (the rest pose's), not the clip's own half-closed
    // ones: a curl on top of those turned every grip into a fist.
    for (const k of ["index", "middle", "ring", "pinky", "thumb"] as const) for (const bone of f[k]) bone.quaternion.copy(p.rest.get(bone)![1]);
    p.bones[`hand_${s}`].updateMatrixWorld(true);
    const palm = palmOf(p, s);
    for (const k of ["index", "middle", "ring", "pinky", "thumb"] as const) {
      const A = GRIPS[a][k], B = GRIPS[b][k];
      const angles = [0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * t);
      const pl = k === "thumb" ? palm.clone().add(handSide(p, s).multiplyScalar(s === "r" ? -0.8 : 0.8)).normalize() : palm;
      curlFinger(T, f[k], angles, pl);
    }
  };
  const handSide = (p: Person, s: Side) => {
    const q = new T.Quaternion(); p.bones[`hand_${s}`].getWorldQuaternion(q);
    return (s === "r" ? p.handAxR : p.handAxL).side.clone().applyQuaternion(q);
  };
  /** Wrist on `wrist`, fingers along `along`, palm towards `palm` (all world). */
  const placeHand = (p: Person, s: Side, wrist: THREE.Vector3, along: THREE.Vector3, palm: THREE.Vector3, pole: THREE.Vector3, w = 1) => {
    const up = p.bones[`upperarm_${s}`], lo = p.bones[`lowerarm_${s}`], ha = p.bones[`hand_${s}`];
    const q0 = ha.quaternion.clone();
    solveArm(T, up, lo, ha, wrist, pole, w);
    const want = handWorldQuat(T, s === "r" ? p.handAxR : p.handAxL, along, palm);
    setBoneWorldQuat(T, ha, want);
    if (w < 1) { ha.quaternion.copy(q0.slerp(ha.quaternion.clone(), w)); ha.updateMatrixWorld(true); }
  };
  /** Where the pen sits between thumb and first finger. */
  const pinchOf = (p: Person, s: Side) => wpos(p.bones[`thumb_03_${s}`]).add(wpos(p.bones[`index_03_${s}`])).multiplyScalar(0.5);
  /** The pen held in a writer's (tripod) grip, from the bones: it lies
   *  under the pad of the first finger, near its tip, with the thumb on its
   *  side, and rests back over the web between thumb and first finger. */
  const penInHandOf = (p: Person, s: Side) => {
    const palm = palmOf(p, s);
    const i1 = wpos(p.bones[`index_01_${s}`]);
    const i3 = wpos(p.bones[`index_03_${s}`]);
    const iTip = wpos(p.bones[`index_04_leaf_${s}`]);
    const hand = wpos(p.bones[`hand_${s}`]);
    const along = wpos(p.bones[`middle_01_${s}`]).sub(hand).normalize();
    // Towards the thumb, square to the fingers and the palm.
    const thumb = wpos(p.bones[`thumb_02_${s}`]).sub(hand);
    thumb.sub(along.clone().multiplyScalar(thumb.dot(along))).sub(palm.clone().multiplyScalar(thumb.dot(palm))).normalize();
    const pad = i3.clone().lerp(iTip, 0.6).add(palm.clone().multiplyScalar(PEN_GRIP.pad)).add(thumb.clone().multiplyScalar(PEN_GRIP.side));
    const web = i1.add(thumb.clone().multiplyScalar(PEN_GRIP.web)).add(palm.clone().multiplyScalar(-PEN_GRIP.webUp));
    const axis = web.sub(pad).normalize();
    return { tip: pad.clone().sub(axis.clone().multiplyScalar(PEN_GRIP.tip)), axis };
  };

  // Rest head facing, for the head turn.
  for (const p of [you, boss]) {
    const saved = poseRest(p);
    const hq = new T.Quaternion(); p.bones.Head.getWorldQuaternion(hq);
    p.restHeadInv = hq.invert();
    restoreRest(p, saved);
  }

  // ── The camera shots ──
  const SHOTS: Record<string, { pos: THREE.Vector3; look: THREE.Vector3; fov: number }> = {
    talk: { pos: v3(0.2, 1.46, 1.32), look: v3(-0.06, 1.17, -0.6), fov: 44 },
    reply: { pos: v3(-0.2, 1.46, -1.32), look: v3(0.06, 1.17, 0.6), fov: 44 },
    contract: { pos: v3(0.26, 1.68, 0.92), look: v3(-0.02, DESK.top, 0.1), fov: 38 },
    sign: { pos: v3(0.78, 1.32, -0.08), look: v3(0.02, 0.9, 0.3), fov: 46 },
    shake: { pos: v3(1.85, 1.55, 0.9), look: v3(0, 1.08, 0.02), fov: 48 },
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

  // Hand poses in each person's own frame: [wrist x,y,z], along, palm.
  const restR = { w: [-0.2, DESK.top + 0.035, 0.27], along: [0.15, -0.12, 1], palm: [0, -1, 0.05] };
  const restL = { w: [0.2, DESK.top + 0.035, 0.27], along: [-0.15, -0.12, 1], palm: [0, -1, 0.05] };

  // The writing hand's direction (fixed while writing).
  const writeAlong = () => dirOf(you, 0.25, -0.62, 0.72);
  const writePalm = () => dirOf(you, 0.55, -0.55, -0.35);

  /** Pose the writing hand so the pen tip is on `tip`. Returns where the pen is. */
  const handToTip = (tip: THREE.Vector3, w: number, along: THREE.Vector3, palm: THREE.Vector3, gripK: number) => {
    const p = you;
    const pole = dirOf(p, -0.7, -0.6, -0.2);
    const saved = snapshot(p, ARM_R);
    // Twice: the first pass measures where the pinch lands for this hand.
    // Measure where the tip lands for this hand, and move the wrist by the miss.
    let wrist = tip.clone().add(v3(0.04 * -p.facing, 0.1, 0.09 * -p.facing));
    for (let i = 0; i < 4; i++) {
      restore(p, saved);
      placeHand(p, "r", wrist, along, palm, pole, w);
      grip(p, "r", "flat", "pen", gripK);
      const miss = tip.clone().sub(penInHandOf(p, "r").tip);
      wrist = wrist.add(miss);
    }
  };
  const ARM_R = ["upperarm_r", "lowerarm_r", "hand_r", "index_01_r", "index_02_r", "index_03_r", "middle_01_r", "middle_02_r", "middle_03_r", "ring_01_r", "ring_02_r", "ring_03_r", "pinky_01_r", "pinky_02_r", "pinky_03_r", "thumb_01_r", "thumb_02_r", "thumb_03_r"];
  const snapshot = (p: Person, names: string[]) => names.map((n) => [p.bones[n], p.bones[n].quaternion.clone()] as const);
  const restore = (p: Person, s: (readonly [THREE.Bone, THREE.Quaternion])[]) => { for (const [b, q] of s) b.quaternion.copy(q); p.root.updateMatrixWorld(true); };

  const restHands = (p: Person, w = 1, talk = 0, t = 0) => {
    const g = talk * Math.max(0, Math.sin(t * 2.1)) ;
    const wr = ptOf(p, restR.w[0] - g * 0.04, restR.w[1] + g * 0.09, restR.w[2] + g * 0.03);
    const alongR = dirOf(p, restR.along[0], restR.along[1] + g * 0.6, restR.along[2]);
    const palmR = dirOf(p, -g * 0.6, -1 + g * 0.7, 0.05 + g * 0.3);
    placeHand(p, "r", wr, alongR, palmR, dirOf(p, -0.8, -0.5, -0.3), w);
    grip(p, "r", "flat", "open", g);
    const g2 = talk * Math.max(0, Math.sin(t * 1.7 + 2.2)) * 0.6;
    const wl = ptOf(p, restL.w[0] + g2 * 0.03, restL.w[1] + g2 * 0.07, restL.w[2]);
    placeHand(p, "l", wl, dirOf(p, restL.along[0], restL.along[1] + g2 * 0.5, restL.along[2]), dirOf(p, g2 * 0.5, -1 + g2 * 0.6, 0.05), dirOf(p, 0.8, -0.5, -0.3), w);
    grip(p, "l", "flat", "open", g2);
  };

  const youHead = () => wpos(you.bones.Head).add(v3(0, 0.09, 0));
  const bossHead = () => wpos(boss.bones.Head).add(v3(0, 0.09, 0));

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
      clips(boss, [["Sitting_Idle_Loop", t % 1.6667, 1 - bossTalk * 0.6], ["Sitting_Talking_Loop", t % 2.9333, bossTalk * 0.6]]);
      clips(you, [["Sitting_Idle_Loop", (t + 0.7) % 1.6667, 1 - youTalk * 0.5], ["Sitting_Talking_Loop", (t + 1.1) % 2.9333, youTalk * 0.5]]);
      lean(boss, 0.08);
      lean(you, mode === "contract" ? 0.2 * seg(e, 0.3, 1.2) + 0.06 : 0.06);
      restHands(boss, 1, bossTalk, t);
      restHands(you, 1, youTalk * 0.6, t + 1);
      lookAt(boss, mode === "contract" ? paperPoint(CW / 2, CH / 2) : youHead(), 0.8);
      lookAt(you, mode === "contract" ? paperPoint(CW / 2, CH * 0.45) : bossHead(), 0.75);
      placePen(penRestPos, penRestQ);
      setCam(t);
      return;
    }

    // ── TAP TO SIGN ──
    const S = SIGN_T;
    const standK = seg(e, S.standA, S.standB);
    const stepK = seg(e, S.standB - 0.25, S.stepB);
    // Both men: sitting → standing (the clip), then a step in to the desk.
    const exitT = Math.min(1.0333, Math.max(0, e - S.standA));
    const standing = e >= S.standA;
    const idleT = Math.max(0, e - S.standB);
    for (const p of [you, boss]) {
      const back = 0.07 * standK - 0.24 * stepK;
      p.root.position.z = (p === you ? YOU_Z : BOSS_Z) + p.facing * -back;
      const chair = p === you ? youChair : bossChair;
      chair.position.z = (p === you ? YOU_Z : BOSS_Z) - p.facing * 0.16 * standK;
      if (!standing) clips(p, [["Sitting_Idle_Loop", (t + (p === you ? 0.7 : 0)) % 1.6667, 1]]);
      else if (e < S.standB) clips(p, [["Sitting_Exit", exitT, 1]]);
      else clips(p, [["Sitting_Exit", 1.0333, 1 - seg(idleT, 0, 0.3)], ["Idle_Loop", idleT % 2.5, seg(idleT, 0, 0.3)]]);
    }
    // Leans: you over the paper; both forward over the desk for the shake.
    const writeLean = 0.3 * seg(e, 0, S.reachB) * (1 - seg(e, S.putDown - 0.1, S.standA + 0.3));
    const shakeLean = 0.13 * seg(e, S.shakeA - 0.2, S.shakeB);
    lean(you, 0.06 + writeLean + shakeLean);
    lean(boss, 0.08 * (1 - standK) + shakeLean);

    // The manager: hands on the desk until he stands.
    const handsW = 1 - seg(e, S.standA - 0.05, S.standA + 0.35);
    if (handsW > 0) restHands(boss, handsW, 0, t);

    // Your left hand holds the paper while you write.
    const lW = 1 - seg(e, S.standA - 0.05, S.standA + 0.35);
    if (lW > 0) {
      placeHand(you, "l", paperPoint(40, CH * 0.62, 0.03), dirOf(you, -0.35, -0.1, 1), dirOf(you, 0, -1, 0), dirOf(you, 0.8, -0.5, -0.3), lW);
      grip(you, "l", "flat");
    }

    // Your right hand: rest → over the pen → grip → to the line → write → lift → put down.
    const sigStart = paperPoint(SIG.x + (sigPts[0][0] / 300) * SIG.w, SIG.y + (sigPts[0][1] / 60) * SIG.h);
    const penGripOnDesk = penRestPos.clone().add(new T.Vector3(-0.15, 0, 1).normalize().multiplyScalar(0.045));
    let pickK = 0;
    let penInHand = false;
    let tip: THREE.Vector3 | null = null;
    if (e < S.standA) {
      const reach = seg(e, S.reachA, S.reachB);
      const toLine = seg(e, S.grip, S.toLine);
      const writeK = Math.min(1, Math.max(0, (e - S.toLine) / (S.writeEnd - S.toLine)));
      const lift = seg(e, S.writeEnd, S.lift);
      const down = seg(e, S.lift + 0.02, S.putDown);
      pickK = seg(e, S.reachB, S.grip);
      if (e < S.toLine) {
        // Over the pen, then lifting it to the line.
        const over = penGripOnDesk.clone().add(v3(0, 0.035 * (1 - reach) + 0.012, 0));
        const lineHover = sigStart.clone().add(v3(0, 0.01, 0));
        tip = over.clone().lerp(lineHover, toLine);
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
        const restWrist = ptOf(you, restR.w[0], restR.w[1], restR.w[2]);
        const saved = snapshot(you, ARM_R);
        handToTip(tip, 1, al, pa, pickK);
        const solved = snapshot(you, ARM_R);
        restore(you, saved);
        placeHand(you, "r", restWrist, restAlong, restPalm, dirOf(you, -0.8, -0.5, -0.3), 1);
        grip(you, "r", "flat");
        for (let j = 0; j < solved.length; j++) {
          const [bone, q] = solved[j];
          bone.quaternion.slerp(q, reach);
        }
        you.root.updateMatrixWorld(true);
      } else {
        const gripK = e < S.lift ? pickK : 1 - down;
        handToTip(tip, 1, al, pa, gripK);
      }
    } else {
      inkUpTo = 1;
    }
    // Ink and the stamp on the paper.
    const wantStamp = e >= S.stamp;
    if (wantStamp && !stamped) { stamped = true; fire("stamp"); }
    if (!wantStamp && stamped) stamped = false;
    drawPaperThrottled();

    // The pen: on the desk, in the fingers, or on its way between.
    if (penInHand) {
      const held = penInHandOf(you, "r");
      const q = new T.Quaternion().setFromUnitVectors(v3(0, 1, 0), held.axis);
      const inHandTip = held.tip;
      if (pickK < 1) {
        const k = pickK;
        const tq = penRestQ.clone().slerp(q, k);
        placePen(penRestPos.clone().lerp(inHandTip, k), tq);
      } else placePen(inHandTip, q);
      void tip;
    } else placePen(penRestPos, penRestQ);

    // The handshake: right hands meet palm to palm over the middle of the
    // desk. Each palm faces the other man's on the plane x = 0, a hand's
    // half-thickness (and a hair) off it, so the two never pass through each
    // other; thumbs up, fingers forward and only lightly closed, the wrists
    // back far enough that each man's fingers end at the other's wrist.
    if (e >= S.shakeA - 0.3) {
      const w = seg(e, S.shakeA - 0.3, S.shakeB);
      const pump = e > S.shakeB ? Math.sin((e - S.shakeB) * Math.PI * 2 * 2.4) * 0.024 * (1 - seg(e, S.pumpEnd - 0.2, S.pumpEnd)) : 0;
      const M = v3(0, SHAKE.y + pump, 0);
      for (const p of [you, boss]) {
        // The shoulder comes forward into the reach.
        rotateBoneWorld(T, p.bones.clavicle_r, new T.Quaternion().setFromAxisAngle(v3(0, 1, 0), 0.22 * w));
        const palm = dirOf(p, 1, 0, 0);
        const wrist = M.clone().add(palm.clone().multiplyScalar(-SHAKE.gap));
        wrist.z = M.z - p.facing * SHAKE.back;
        const along = dirOf(p, 0, -0.08, 1);
        placeHand(p, "r", wrist, along, palm, dirOf(p, -0.7, -0.7, -0.15), w);
        grip(p, "r", "open", "shake", w);
      }
      if (e >= S.shakeB) fire("shake");
    }
    if (e >= S.done) fire("done");

    // Eyes: on the paper while writing, then on each other.
    const eyesUp = seg(e, S.lift, S.standA + 0.4);
    lookAt(you, paperPoint(SIG.x + SIG.w / 2, SIG.y).lerp(bossHead(), eyesUp), 0.8);
    lookAt(boss, paperPoint(CW / 2, CH * 0.7).lerp(youHead(), Math.max(eyesUp, 1 - seg(e, 0, 0.6))), 0.75);

    // Camera: pulled back from the paper to the desk, then wider for the shake.
    if (e < S.standA) { camFrom = SHOTS.contract; camTo = SHOTS.sign; camA = modeStart; camB = modeStart + S.pull; }
    else { camFrom = SHOTS.sign; camTo = SHOTS.shake; camA = modeStart + S.standA; camB = modeStart + S.shakeB + 0.2; }
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
    const d = wpos(p.bones.neck_01).sub(wpos(p.bones.pelvis)).normalize();
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
        pen: r(pen.position), penVisible: pen.visible,
        pinch: r(pinchOf(you, "r")), penTip: r(penInHandOf(you, "r").tip), hand: r(wpos(you.bones.hand_r)), shoulder: r(wpos(you.bones.upperarm_r)),
        handL: r(wpos(you.bones.hand_l)), mode, t: clock - modeStart,
        head: r(wpos(you.bones.Head)),
        bossHead: r(wpos(boss.bones.Head)), bossHand: r(wpos(boss.bones.hand_r)), youHandR: r(wpos(you.bones.hand_r)),
        // How far each man's back leans off upright, degrees (pelvis → neck).
        youBend: bendOf(you), bossBend: bendOf(boss),
        L: you.L,
        extras: you.extras.map((e) => [e.name || e.type, e.parent?.name, r(wpos(e))]),
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
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mt of mats) { for (const v of Object.values(mt)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose(); mt.dispose(); }
      });
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
  for (let i = 0; i <= n; i++) { const p = path.getPointAtLength((i / n) * len); pts.push([p.x, p.y]); }
  svg.remove();
  return pts;
}
