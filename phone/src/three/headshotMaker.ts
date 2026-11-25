/**
 * THE HEADSHOT MAKER ON THE PHONE — lib/star/headshot3d/maker.ts, the same
 * picture made without a browser.
 *
 * The same man (lib/star/people3d.ts, his look from headshot3d/look.ts), the
 * same pose, smile, lens and studio light (HEADSHOT_SHOT, HEADSHOT_LIGHT,
 * CARD_SHOT), one GL context for every picture, pictures made one at a time
 * with a breath between them, and the context let go after IDLE_MS with
 * nothing to do. The two differences:
 * - the website draws on a hidden <canvas>; the phone draws into a picture on
 *   the chip (a render target on a GL context of its own, no view on screen),
 *   finished exactly as the screen finishes it (ACES, sRGB), and reads the
 *   pixels back;
 * - the pixels go back to the caller (./headshots.ts keeps them as files).
 * Any failure answers null: the card keeps the drawn head.
 */
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Person3D } from "@/lib/star/people3d";
import type { ToonFaceRig } from "@/lib/star/style3d/toon/face";
import type { ToonHead } from "@/lib/star/style3d/toon/bodies";
import { HEADSHOT_PX, HEADSHOT_SHOT, HEADSHOT_LIGHT, CARD_SHOT, type HeadshotLook, type HeadshotFrame } from "@/lib/star/headshot3d/look";
import { GLTFLoader } from "./GLTFLoader";
import { withMeshopt } from "./meshopt";
import { withSceneDocument, withSceneDocumentSync } from "./env";
import { prepareGl } from "./gl";
import { headshotsPaused, registerHeadshotSettler } from "./glBusy";

type People = typeof import("@/lib/star/people3d");

/** The renderer goes after this long with no picture to make (as the website). */
const IDLE_MS = 20_000;
/** A breath between two pictures, so a screen of cards never stalls. */
const BREATH_MS = 24;

/** Where the GL comes from (the phone: a context with no view; the check: a browser canvas). */
export interface HeadshotGl { make(): Promise<WebGL2RenderingContext>; drop(gl: WebGL2RenderingContext): void }
let glSource: HeadshotGl | null = null;
export function setHeadshotGl(s: HeadshotGl) { glSource = s; }

/** How long pictures took on this device (ms). */
export const headshotStats = { setupMs: [] as number[], sitterMs: [] as number[], shotMs: [] as number[], failed: 0 };

interface Sitter { p: Person3D; face: ToonFaceRig | null }
interface Rig {
  gl: WebGL2RenderingContext;
  people: People;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  cam: THREE.PerspectiveCamera;
  loader: GLTFLoader;
  anims: GLTF;
  sitters: Map<ToonHead, Promise<Sitter>>;
  targets: Map<number, THREE.WebGLRenderTarget>;
  face: typeof import("@/lib/star/style3d/toon/face");
  shader: typeof import("@/lib/star/style3d/toon/shader");
}

export interface HeadshotPixels { width: number; height: number; data: Uint8Array }

let rig: Promise<Rig | null> | null = null;
let noGl = false;
let fails = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const queue: { look: HeadshotLook; frame: HeadshotFrame; done: (px: HeadshotPixels | null) => void }[] = [];
let pumping = false;

/** Can this phone make headshots (false once the GL failed twice). */
export const headshotsPossible = () => !noGl && !!glSource;

/** One picture of this man (queued behind the others). Top row first, premultiplied RGBA. */
export function shootHeadshot(look: HeadshotLook, frame: HeadshotFrame = "head"): Promise<HeadshotPixels | null> {
  if (!headshotsPossible()) return Promise.resolve(null);
  // a 3D place is open (./glBusy.ts): no second GL now; the drawn head stays and the picture is made the next time it is wanted
  if (headshotsPaused()) return Promise.resolve(null);
  return new Promise((done) => { queue.push({ look, frame, done }); void pump(); });
}

async function pump() {
  if (pumping) return;
  pumping = true;
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  try {
    while (queue.length) {
      const job = queue.shift()!;
      let px: HeadshotPixels | null = null;
      try {
        const r = await getRig();
        if (r) px = await shoot(r, job.look, job.frame);
      } catch (e) { console.warn("headshot", e); }
      if (!px) headshotStats.failed++;
      job.done(px);
      await new Promise((res) => setTimeout(res, BREATH_MS));
    }
  } finally {
    pumping = false;
    idleTimer = setTimeout(dropRig, IDLE_MS);
  }
}

function getRig(): Promise<Rig | null> {
  if (noGl) return Promise.resolve(null);
  rig ??= buildRig().catch((e) => { console.warn("headshot renderer", e); rig = null; if (++fails >= 2) noGl = true; return null; });
  return rig;
}

async function buildRig(): Promise<Rig | null> {
  if (!glSource) return null;
  const t0 = performance.now();
  const gl = prepareGl(await glSource.make(), { present: false });
  return withSceneDocument(async () => {
    const people = await import("@/lib/star/people3d");
    const face = await import("@/lib/star/style3d/toon/face");
    const shader = await import("@/lib/star/style3d/toon/shader");
    const canvas = { width: HEADSHOT_PX, height: HEADSHOT_PX, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => gl };
    const renderer = new THREE.WebGLRenderer({ canvas: canvas as never, context: gl as never, antialias: false, alpha: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    const scene = new THREE.Scene();
    const L = HEADSHOT_LIGHT;
    scene.add(new THREE.HemisphereLight(L.sky, L.ground, L.hemi));
    const key = new THREE.DirectionalLight(L.key, L.keyIntensity);
    key.position.set(...L.keyFrom);
    scene.add(key);
    const cam = new THREE.PerspectiveCamera(HEADSHOT_SHOT.fov, 1, 0.1, 20);
    const loader = await withMeshopt(new GLTFLoader());
    const anims = await people.loadPeople3d(loader, "anims", "new");
    headshotStats.setupMs.push(Math.round(performance.now() - t0));
    return { gl, people, renderer, scene, cam, loader, anims, sitters: new Map(), targets: new Map(), face, shader };
  });
}

/**
 * The picture he is drawn into: finished as the screen is (three tone-maps and
 * sRGB-encodes only for the screen or an "XR" target, so it is marked as one),
 * stored as plain 8-bit (no second sRGB step on the chip). Drawn at twice the
 * size and halved on reading (./shoot): smooth edges like the website's
 * antialiased canvas, because the phone's GL has no multisampled targets
 * (expo-gl: renderbufferStorageMultisample is not there).
 */
const SUPER = 2;
function targetFor(r: Rig, px: number): THREE.WebGLRenderTarget {
  let t = r.targets.get(px);
  if (!t) {
    t = new THREE.WebGLRenderTarget(px * SUPER, px * SUPER, { samples: 0, colorSpace: THREE.SRGBColorSpace, depthBuffer: true });
    t.texture.internalFormat = "RGBA8";
    (t as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
    r.targets.set(px, t);
  }
  return t;
}

function sitterFor(r: Rig, head: ToonHead, body: HeadshotLook["body"]): Promise<Sitter> {
  let s = r.sitters.get(head);
  if (!s) {
    s = withSceneDocument(async () => {
      const t0 = performance.now();
      const { people } = r;
      const g = await people.loadToonHead(r.loader, head);
      const SK = ((SkeletonUtils as unknown as { default?: unknown }).default ?? SkeletonUtils) as never;
      const p = people.makePerson3d(THREE, SK, g, r.anims, { outline: 0.0045, toonHead: head, toonBody: body, who: `headshot-${head}` });
      p.root.updateMatrixWorld(true);
      const headBone = p.bones.Head;
      const bindInv = new THREE.Quaternion();
      headBone?.getWorldQuaternion(bindInv);
      bindInv.invert();
      if (p.actions.idle) people.poseClips(p, [["idle", 0.6, 1]]);
      people.relaxToonArms(THREE, p, 5, 9);
      p.root.rotation.y = (HEADSHOT_SHOT.bodyTurn * Math.PI) / 180;
      p.root.updateMatrixWorld(true);
      if (headBone) aimFace(people, p, headBone, bindInv, HEADSHOT_SHOT.bodyTurn - HEADSHOT_SHOT.headBack, 0);
      const face = r.face.addToonFace(THREE, p);
      face?.set({ face: r.face.toonFaceFor({ smile: HEADSHOT_SHOT.smile }), blink: 0, gaze: [0, 0.03], talk: 0 });
      p.root.visible = false;
      r.scene.add(p.root);
      headshotStats.sitterMs.push(Math.round(performance.now() - t0));
      return { p, face };
    });
    s.catch(() => r.sitters.delete(head));
    r.sitters.set(head, s);
  }
  return s;
}

/** lib/star/headshot3d/maker.ts aimFace: his face turned `yawDeg` across and `pitchDeg` up, measured off the head bone. */
function aimFace(people: People, p: Person3D, head: THREE.Bone, bindInv: THREE.Quaternion, yawDeg: number, pitchDeg: number) {
  const deg = 180 / Math.PI;
  const fwd = () => {
    const q = new THREE.Quaternion();
    head.getWorldQuaternion(q);
    return new THREE.Vector3(0, 0, 1).applyQuaternion(q.multiply(bindInv)).normalize();
  };
  const rootInv = new THREE.Quaternion();
  for (let i = 0; i < 3; i++) {
    let f = fwd();
    const dy = yawDeg - Math.atan2(f.x, f.z) * deg;
    people.turnBoneInBody(THREE, p, "neck", [0, 1, 0], dy * 0.4);
    people.turnBoneInBody(THREE, p, "Head", [0, 1, 0], dy * 0.6);
    f = fwd();
    const yaw = Math.atan2(f.x, f.z);
    const dp = Math.asin(Math.max(-1, Math.min(1, f.y))) * deg - pitchDeg;
    p.root.getWorldQuaternion(rootInv);
    rootInv.invert();
    const ax = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).applyQuaternion(rootInv);
    people.turnBoneInBody(THREE, p, "neck", [ax.x, ax.y, ax.z], dp * 0.4);
    people.turnBoneInBody(THREE, p, "Head", [ax.x, ax.y, ax.z], dp * 0.6);
  }
}

async function shoot(r: Rig, look: HeadshotLook, frame: HeadshotFrame): Promise<HeadshotPixels | null> {
  const { people, renderer, scene, cam } = r;
  const s = await sitterFor(r, look.head, look.body);
  const t0 = performance.now();
  const p = s.p;
  people.setToonBuild(p, look.body);
  withSceneDocumentSync(() => people.dressPerson3d(THREE, p, {
    skin: look.skin, hair: look.hair,
    kit: { shirt: look.shirt, trim: look.trim, shorts: look.shorts },
    number: null, badge: null, name: null,
  }));
  p.root.updateMatrixWorld(true);
  const head = new THREE.Vector3();
  (p.bones.Head ?? p.bones.neck ?? p.root).getWorldPosition(head);
  const S = HEADSHOT_SHOT;
  const px = frame === "card" ? CARD_SHOT.px : HEADSHOT_PX;
  if (frame === "card") {
    const hips = new THREE.Vector3();
    (p.bones.Hips ?? p.root).getWorldPosition(hips);
    const top = head.y + CARD_SHOT.overHead, bottom = hips.y - CARD_SHOT.underHips;
    const midY = (top + bottom) / 2, midX = (head.x + hips.x) / 2, midZ = (head.z + hips.z) / 2;
    const dist = (top - bottom) / 2 / Math.tan((S.fov * Math.PI) / 360);
    cam.position.set(midX, midY + S.camUp, midZ + dist);
    cam.lookAt(midX, midY, midZ);
  } else {
    cam.position.set(head.x, head.y + S.camUp, head.z + S.distance);
    cam.lookAt(head.x, head.y + S.aimUp, head.z);
  }
  cam.updateMatrixWorld(true);
  for (const o of scene.children) if ((o as { isGroup?: boolean }).isGroup) o.visible = o === p.root;
  const L = HEADSHOT_LIGHT;
  const target = targetFor(r, px);
  const big = px * SUPER;
  const raw = new Uint8Array(big * big * 4);
  r.shader.withToonRim(THREE, { color: L.rim, strength: L.rimStrength, from: L.rimFrom }, () => {
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(target, 0, 0, big, big, raw);
    renderer.setRenderTarget(null);
  });
  p.root.visible = false;
  // halve it (each pixel the mean of its 2×2, premultiplied, so edges blend right),
  // and GL rows run bottom up: turn them the right way up
  const data = new Uint8Array(px * px * 4);
  const brow = big * 4;
  for (let y = 0; y < px; y++) {
    const src = (big - 1 - y * SUPER) * brow, src2 = src - brow, dst = y * px * 4;
    for (let x = 0; x < px; x++) {
      const a = src + x * 8, b = src2 + x * 8, o = dst + x * 4;
      for (let k = 0; k < 4; k++) data[o + k] = (raw[a + k] + raw[a + 4 + k] + raw[b + k] + raw[b + 4 + k] + 2) >> 2;
    }
  }
  headshotStats.shotMs.push(Math.round(performance.now() - t0));
  let any = false;
  for (let i = 3; i < data.length; i += 4 * 97) if (data[i] > 0) { any = true; break; }
  return any ? { width: px, height: px, data } : null;
}

/** Waits for the running job to end, then lets the GL go now (not after the idle wait): the Walk3D places call this before they make their view. */
registerHeadshotSettler(async () => {
  queue.splice(0).forEach((j) => j.done(null));
  for (let i = 0; i < 60 && pumping; i++) await new Promise((res) => setTimeout(res, 100));
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  await dropRig();
});

function dropRig(): Promise<void> {
  idleTimer = null;
  const was = rig;
  rig = null;
  if (!was) return Promise.resolve();
  return was.then(async (r) => {
    if (!r) return;
    for (const sp of Array.from(r.sitters.values())) {
      try {
        const s = await sp;
        s.face?.dispose();
        (s.p.body.material as THREE.Material).dispose();
        (s.p.outline.material as THREE.Material).dispose();
        s.p.mixer.stopAllAction();
      } catch { /* never made */ }
    }
    for (const t of Array.from(r.targets.values())) t.dispose();
    r.renderer.dispose();
    glSource?.drop(r.gl);
  });
}
