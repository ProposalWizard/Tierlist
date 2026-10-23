/**
 * THE HEADSHOT MAKER — a head-and-shoulders still of a Style A player, shot
 * from the 3D model (B15, 20 Oct 2026; Harry: "they should be headshots shot
 * from our 3D model, not the old 2D style").
 *
 * One WebGL renderer for every headshot on the page, on a canvas that is never
 * shown (HEADSHOT_PX square, a clear background). One man per head file is
 * made once and kept (re-dressed for each picture: skin, hair, kit, build), so
 * a page of cards loads at most the six player heads and the clips, the same
 * files every 3D place already uses (people3d.ts loadToonHead). The camera,
 * the lens, the pose, the smile and the studio light are the same in every
 * picture (look.ts HEADSHOT_SHOT, HEADSHOT_LIGHT).
 *
 * Light on purpose: pictures are made one at a time, with a breath between
 * them (the page keeps scrolling), only when a card asks (Headshot3D.tsx asks
 * as it comes near the screen), and each is made once per device (store.ts).
 * The renderer is thrown away after IDLE_MS with nothing to do, so no WebGL
 * context sits open behind a 2D screen.
 *
 * Any failure (no WebGL, a lost context, a file that will not load) answers
 * null, and the card keeps the drawn head it was already showing.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Person3D } from "../people3d";
import type { ToonFaceRig } from "../style3d/toon/face";
import type { ToonHead } from "../style3d/toon/bodies";
import { HEADSHOT_PX, HEADSHOT_SHOT, HEADSHOT_LIGHT, CARD_SHOT, headshotKey, type HeadshotLook, type HeadshotFrame } from "./look";
import { getHeadshot, putHeadshot, headshotFromMemory } from "./store";

type Three = typeof import("three");
type People = typeof import("../people3d");

/** The renderer goes after this long with no picture to make. */
const IDLE_MS = 20_000;
/** A breath between two pictures, so a page of cards never stalls the screen. */
const BREATH_MS = 24;

interface Sitter { p: Person3D; face: ToonFaceRig | null }
interface Rig {
  T: Three;
  people: People;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  cam: THREE.PerspectiveCamera;
  loader: { loadAsync(url: string): Promise<unknown> };
  SK: { clone(o: THREE.Object3D): THREE.Object3D };
  anims: GLTF;
  sitters: Map<ToonHead, Promise<Sitter>>;
  addFace: typeof import("../style3d/toon/face").addToonFace;
  faceFor: typeof import("../style3d/toon/face").toonFaceFor;
  withRim: typeof import("../style3d/toon/shader").withToonRim;
  lost: boolean;
}

/** How long pictures took on this device (the bench page shows them; window.__headshots too). */
export const headshotStats = {
  /** ms to make the renderer and load the clips (once per visit, or after an idle drop). */
  setupMs: [] as number[],
  /** ms to load a head file and make its man (once per head). */
  sitterMs: [] as number[],
  /** ms for one picture with its man ready: pose read, draw, encode. */
  shotMs: [] as number[],
  /** Pictures found already kept on this device. */
  kept: 0,
  /** Pictures that could not be made (the drawn head stayed). */
  failed: 0,
};

let rig: Promise<Rig | null> | null = null;
let noWebgl = false;
let buildFails = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const inflight = new Map<string, Promise<string | null>>();
const queue: { key: string; look: HeadshotLook; frame: HeadshotFrame; done: (url: string | null) => void }[] = [];
let pumping = false;

/** Can this page make headshots at all? (false: no document, or WebGL failed once this visit). */
export function headshotsPossible(): boolean {
  return typeof document !== "undefined" && !noWebgl;
}

/**
 * His headshot: the kept picture if this device has one, else made now (queued
 * behind the others). Null when it cannot be made: the card keeps the drawn head.
 */
export function makeHeadshot(id: string, look: HeadshotLook, frame: HeadshotFrame = "head"): Promise<string | null> {
  const key = headshotKey(id, look, frame);
  const mem = headshotFromMemory(key);
  if (mem) return Promise.resolve(mem);
  const going = inflight.get(key);
  if (going) return going;
  const p = (async () => {
    const kept = await getHeadshot(key);
    if (kept) { headshotStats.kept++; return kept; }
    if (!headshotsPossible()) return null;
    return new Promise<string | null>((done) => { queue.push({ key, look, frame, done }); void pump(); });
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function pump() {
  if (pumping) return;
  pumping = true;
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  try {
    while (queue.length) {
      const job = queue.shift()!;
      let url: string | null = null;
      try {
        const r = await getRig();
        if (r) {
          const blob = await shoot(r, job.look, job.frame);
          if (blob) url = await putHeadshot(job.key, blob);
        }
      } catch (e) {
        console.warn("headshot", e);
      }
      if (!url) headshotStats.failed++;
      job.done(url);
      await breath();
    }
  } finally {
    pumping = false;
    idleTimer = setTimeout(dropRig, IDLE_MS);
  }
}

function breath(): Promise<void> {
  return new Promise((res) => {
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    setTimeout(() => (ric ? ric(() => res(), { timeout: 250 }) : res()), BREATH_MS);
  });
}

function getRig(): Promise<Rig | null> {
  if (noWebgl) return Promise.resolve(null);
  // a file that would not load: this picture fails (the drawn head stays) and the next one tries again
  // (twice in a visit and it gives up: no context made over and over)
  rig ??= buildRig().catch((e) => { console.warn("headshot renderer", e); rig = null; if (++buildFails >= 2) noWebgl = true; return null; });
  return rig.then((r) => {
    if (r && r.lost) { rig = null; return getRig(); }
    return r;
  });
}

async function buildRig(): Promise<Rig | null> {
  if (typeof document === "undefined") return null;
  const t0 = performance.now();
  const T = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const { withMeshopt } = await import("../three3d/meshopt");
  const people = await import("../people3d");
  const { addToonFace, toonFaceFor } = await import("../style3d/toon/face");
  const { withToonRim } = await import("../style3d/toon/shader");

  // One renderer, never on screen. preserveDrawingBuffer: the picture is read after the draw.
  // The context is asked for first, so a phone without WebGL 2 simply keeps the drawn heads (no errors).
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
  if (!context) { noWebgl = true; return null; }
  const renderer = new T.WebGLRenderer({ canvas, context: context as unknown as WebGLRenderingContext, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
  renderer.setPixelRatio(1);
  renderer.setSize(HEADSHOT_PX, HEADSHOT_PX, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  // straight to the picture through ACES: the skin takes its own curve (toon/shader.ts TN_ACES_SCREEN)
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new T.Scene();
  const L = HEADSHOT_LIGHT;
  scene.add(new T.HemisphereLight(L.sky, L.ground, L.hemi));
  const key = new T.DirectionalLight(L.key, L.keyIntensity);
  key.position.set(...L.keyFrom);
  scene.add(key);
  const cam = new T.PerspectiveCamera(HEADSHOT_SHOT.fov, 1, 0.1, 20);

  // every GLTFLoader packs with meshopt (three3d/meshopt.ts)
  const loader = await withMeshopt(new GLTFLoader());
  const anims = await people.loadPeople3d(loader, "anims", "new");
  const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as Rig["SK"];
  const r: Rig = { T, people, renderer, scene, cam, loader, SK, anims, sitters: new Map(), addFace: addToonFace, faceFor: toonFaceFor, withRim: withToonRim, lost: false };
  canvas.addEventListener("webglcontextlost", () => { r.lost = true; }, false);
  headshotStats.setupMs.push(Math.round(performance.now() - t0));
  return r;
}

/** The man for this head: made once, posed once (the portrait stance), kept. */
function sitterFor(r: Rig, head: ToonHead, body: HeadshotLook["body"]): Promise<Sitter> {
  let s = r.sitters.get(head);
  if (!s) {
    s = (async () => {
      const t0 = performance.now();
      const { T, people } = r;
      const g = await people.loadToonHead(r.loader, head);
      const p = people.makePerson3d(T, r.SK, g, r.anims, { outline: 0.0045, toonHead: head, toonBody: body, who: `headshot-${head}` });
      // his head's turn in the bind pose (he faces +z there), to measure where his face points once posed
      p.root.updateMatrixWorld(true);
      const headBone = p.bones.Head;
      const bindInv = new T.Quaternion();
      headBone?.getWorldQuaternion(bindInv);
      bindInv.invert();
      // the stance: the relaxed standing idle, the body a quarter turned, the face brought back to the lens
      if (p.actions.idle) people.poseClips(p, [["idle", 0.6, 1]]);
      people.relaxToonArms(T, p, 5, 9);
      p.root.rotation.y = (HEADSHOT_SHOT.bodyTurn * Math.PI) / 180;
      p.root.updateMatrixWorld(true);
      if (headBone) aimFace(T, people, p, headBone, bindInv, HEADSHOT_SHOT.bodyTurn - HEADSHOT_SHOT.headBack, 0);
      // a calm face, a small closed smile, eyes to the lens
      const face = r.addFace(T, p);
      face?.set({ face: r.faceFor({ smile: HEADSHOT_SHOT.smile }), blink: 0, gaze: [0, 0.03], talk: 0 });
      p.root.visible = false;
      r.scene.add(p.root);
      headshotStats.sitterMs.push(Math.round(performance.now() - t0));
      return { p, face };
    })();
    s.catch(() => r.sitters.delete(head));
    r.sitters.set(head, s);
  }
  return s;
}

/**
 * Turn his neck and head so his face points `yawDeg` across (+ toward his
 * body's turn) and `pitchDeg` up, measured, not guessed: the face's direction
 * is the head bone's turn since the bind pose applied to +z (he faces +z in
 * the bind pose). The idle clip carries its own head turn, so a fixed number
 * of degrees would land somewhere different on every clip.
 */
function aimFace(T: Three, people: People, p: Person3D, head: THREE.Bone, bindInv: THREE.Quaternion, yawDeg: number, pitchDeg: number) {
  const deg = 180 / Math.PI;
  const fwd = () => {
    const q = new T.Quaternion();
    head.getWorldQuaternion(q);
    return new T.Vector3(0, 0, 1).applyQuaternion(q.multiply(bindInv)).normalize();
  };
  const rootInv = new T.Quaternion();
  for (let i = 0; i < 3; i++) {
    let f = fwd();
    const dy = yawDeg - Math.atan2(f.x, f.z) * deg;
    // across: about up (the same in his frame and the world's)
    people.turnBoneInBody(T, p, "neck", [0, 1, 0], dy * 0.4);
    people.turnBoneInBody(T, p, "Head", [0, 1, 0], dy * 0.6);
    // up and down: about the axis across his face (+ turns the face down)
    f = fwd();
    const yaw = Math.atan2(f.x, f.z);
    const dp = Math.asin(Math.max(-1, Math.min(1, f.y))) * deg - pitchDeg;
    p.root.getWorldQuaternion(rootInv);
    rootInv.invert();
    const ax = new T.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).applyQuaternion(rootInv);
    people.turnBoneInBody(T, p, "neck", [ax.x, ax.y, ax.z], dp * 0.4);
    people.turnBoneInBody(T, p, "Head", [ax.x, ax.y, ax.z], dp * 0.6);
  }
}

/** One picture: dress the head's man in this look, aim the camera at his head, draw, encode. */
async function shoot(r: Rig, look: HeadshotLook, frame: HeadshotFrame = "head"): Promise<Blob | null> {
  const { T, people, renderer, scene, cam } = r;
  const s = await sitterFor(r, look.head, look.body);
  const t0 = performance.now();
  const p = s.p;
  people.setToonBuild(p, look.body);
  people.dressPerson3d(T, p, {
    skin: look.skin, hair: look.hair,
    kit: { shirt: look.shirt, trim: look.trim, shorts: look.shorts },
    number: null, badge: null, name: null,
  });
  p.root.updateMatrixWorld(true);
  // the camera: the same lens, distance and angle every time, aimed at his head (he is never resized)
  const head = new T.Vector3();
  (p.bones.Head ?? p.bones.neck ?? p.root).getWorldPosition(head);
  const S = HEADSHOT_SHOT;
  const px = frame === "card" ? CARD_SHOT.px : HEADSHOT_PX;
  renderer.setSize(px, px, false);
  if (frame === "card") {
    // head to waist: the same lens, stood back until crown and waistband both fit (measured off his bones)
    const hips = new T.Vector3();
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
  r.withRim(T, { color: L.rim, strength: L.rimStrength, from: L.rimFrom }, () => renderer.render(scene, cam));
  p.root.visible = false;
  const blob = await new Promise<Blob | null>((res) => {
    try { renderer.domElement.toBlob((b) => res(b), "image/webp", 0.9); } catch { res(null); }
  });
  headshotStats.shotMs.push(Math.round(performance.now() - t0));
  return blob && blob.size > 200 ? blob : null;
}

/** Nothing to make for a while: free the WebGL context (the files stay in the page's cache). */
function dropRig() {
  idleTimer = null;
  const was = rig;
  rig = null;
  if (!was) return;
  void was.then(async (r) => {
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
    r.renderer.dispose();
    r.renderer.forceContextLoss();
  });
}

if (typeof window !== "undefined") {
  (window as unknown as { __headshots?: unknown }).__headshots = headshotStats;
}
