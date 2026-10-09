/**
 * THE NEW 3D PEOPLE — the approved characters (Harry, 3 Oct 2026: simple,
 * clean, modern adults with a thin outline), shared by the live 3D signing
 * (signing3dScene.ts) and the walk-around 3D shop (shop3d/scene.ts).
 *
 * Files (public/star/people3d/, made small by scripts/people3d/build_people3d.py):
 *   player.glb (short hair), player-buzz.glb, player-long.glb, manager.glb
 *     — one skinned body each, 24 joints, a 1024 colour + normal texture.
 *       The player wears a plain WHITE kit; the manager a navy suit.
 *   anims.glb — the skeleton and every clip (bone turns + hip height only,
 *     so one clip plays on every body).
 *
 * Your player is painted live in the body's own shader, from where each
 * point sits in the REST pose (an A-pose, metres, y up, facing +z, his left
 * at +x) and the texture's own colour:
 *   - the white kit takes the club's shirt / shorts / socks colours, split
 *     by height (the shirt hem, under the knee, the ankle), keeping every
 *     fold and line of the white cloth; the shirt number goes on the back;
 *   - skin is brought to the chosen tone, hair to the chosen colour;
 *   - a face picture is laid over the face from the front, an oval that
 *     fades into the skin, its colour brought to the body's skin tone;
 *   - accessories are painted on the body where they sit (sleeves, wrist
 *     tape, gloves, headband, snood, armband, boots).
 * A second copy of the body, pushed out and drawn back-faces only, is the
 * thin dark outline.
 *
 * Pure three.js; no 2D canvas drawing here (signing3dTextures.ts does that).
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadGltfCached } from "./three3d/perf";
import { makeHuman, defaultHumanSpec, HUMAN3D_FILE, type HumanSpec } from "./human3d/human";
import { humanBodyLook } from "./human3d/look";

type Three = typeof import("three");

export const PEOPLE3D_FILES = {
  player: "/star/people3d/player.glb",
  "player-buzz": "/star/people3d/player-buzz.glb",
  "player-long": "/star/people3d/player-long.glb",
  manager: "/star/people3d/manager.glb",
  anims: "/star/people3d/anims.glb",
} as const;

/**
 * THE ONE BODY (Harry, 5 Oct 2026: "use the same models across all cutscenes
 * and 3D sections … they have really wide torsos and thin waists … his
 * fingers obviously don't move"). The same people as above, rebuilt by
 * scripts/people3d/build_onebody.py: an ordinary waist (the lats and
 * shoulders brought in, the waist filled out), and 15 finger bones a hand.
 * Settings → Look → "3D people: New | Old" picks these (New, the default) or
 * the files above exactly as they were (Old).
 */
export const ONEBODY_FILES = {
  player: "/star/onebody/player.glb",
  "player-buzz": "/star/onebody/player-buzz.glb",
  "player-long": "/star/onebody/player-long.glb",
  manager: "/star/onebody/manager.glb",
  anims: "/star/people3d/anims.glb",
} as const;

export type PeopleBody = "new" | "old";

export type PlayerModel = "player" | "player-buzz" | "player-long";
export type PersonModel = PlayerModel | "manager";

/** The saved hair style → the body that has it ("none" → the buzz cut). */
export function playerModelFor(style: "short" | "long" | "buzz" | "none" | undefined | null): PlayerModel {
  if (style === "long") return "player-long";
  if (style === "buzz" || style === "none") return "player-buzz";
  return "player";
}

type V3 = [number, number, number];

/** What build_people3d.py measured on each body (glb scene extras). */
export interface PersonMeta {
  model: PersonModel;
  skinAvg: V3;
  hairAvg: V3;
  face: { chinY: number; eyeY: number; browY: number; frontZ: number };
  kit: { hemY: number; sockY: number; bootY: number };
  joints: Record<string, V3>;
  hands: Record<"L" | "R", { along: V3; palm: V3; thumb: V3; len: number }>;
  /** The one body only: each finger's bones and the axes it bends about
   *  (rest pose, world). `axis` curls it towards the palm; the thumb's
   *  `swing` takes it across towards the fingers. */
  fingers?: Record<"L" | "R", Record<FingerName, { bones: string[]; axis: V3; dir: V3; len: number; swing?: V3 }>>;
  /** The one body only: positions are stored as 16-bit steps (see makePerson3d). */
  quant?: { scale: number; offset: V3 };
}

export type FingerName = "thumb" | "index" | "middle" | "ring" | "little";
export const FINGER_NAMES: FingerName[] = ["thumb", "index", "middle", "ring", "little"];

/** A hand's finger bends, radians, root joint first. `thumbSwing` takes the
 *  thumb across the palm towards the fingers. Missing fingers stay straight. */
export interface FingerPose {
  thumb?: [number, number, number];
  index?: [number, number, number];
  middle?: [number, number, number];
  ring?: [number, number, number];
  little?: [number, number, number];
  thumbSwing?: number;
}

interface FingerRig {
  bones: THREE.Bone[];
  rest: THREE.Quaternion[];
  /** The bend axis in each bone's own frame. */
  axis: THREE.Vector3[];
  swing?: THREE.Vector3;
  /** Root-to-tip direction in the last bone's own frame, and that bone's length. */
  dir: THREE.Vector3;
  tipLen: number;
}

/** A hand's axes in its own bone's space. */
export interface HandFrame { along: THREE.Vector3; palm: THREE.Vector3; thumb: THREE.Vector3; len: number }

export interface Person3D {
  root: THREE.Group;
  body: THREE.SkinnedMesh;
  outline: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  meta: PersonMeta;
  u: Record<string, { value: unknown }>;
  hand: Record<"L" | "R", HandFrame>;
  /** Every bone as the clips last left it (see poseClips). */
  base: Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>;
  /** Every bone in the bind pose (the file's own). */
  rest: Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>;
  /** The Hips bone's rest position (its parent's units: cm). */
  hipsRest: THREE.Vector3;
  /** The Armature's scale (cm → m). */
  unit: number;
  /** The one body only: each hand's fingers. */
  fingers?: Record<"L" | "R", Record<FingerName, FingerRig>>;
}

/** A face picture fitted by faceFit.ts (or anything shaped like it). */
export interface FacePic {
  canvas: HTMLCanvasElement | HTMLImageElement;
  chinX: number; chinY: number; faceH: number;
}

export interface WornThing { slot: string; color: string; color2?: string; stripes?: string[] }

export interface PersonLook {
  skin: string;
  hair?: string;
  /** Club colours (players only). Shorts in the trim, socks in the shirt colour. */
  kit?: { shirt: string; trim: string };
  /** The back of the shirt (a canvas texture of the number), or none. */
  number?: THREE.Texture | null;
  face?: FacePic | null;
  /** The photo's own skin tone, so its colour can be brought to the body's. */
  faceSkin?: string;
  accessories?: WornThing[];
  /** Manager: how grey his hair is (0..1). */
  grey?: number;
}

// ── Loading ───────────────────────────────────────────────────────────────

const cache = new Map<string, Promise<GLTF>>();

/** Load (once per page) a body or the clips. `body` "new" is the one body. */
export function loadPeople3d(loader: { loadAsync(url: string): Promise<unknown>; parseAsync?(data: ArrayBuffer, path: string): Promise<unknown> }, which: keyof typeof PEOPLE3D_FILES, body: PeopleBody = "old"): Promise<GLTF> {
  // The human (Settings → Look → "3D body: Human", the default with "3D people: New"):
  // one file for every person; makePerson3d builds the one asked for by name.
  if (body === "new" && which !== "anims" && humanBodyLook() === "human") {
    let h = cache.get(HUMAN3D_FILE);
    if (!h) {
      h = loadGltfCached<GLTF>(loader, HUMAN3D_FILE);
      h.catch(() => cache.delete(HUMAN3D_FILE));
      cache.set(HUMAN3D_FILE, h);
    }
    return h.then((g) => ({ ...g, humanWhich: which }) as GLTF);
  }
  const url = (body === "new" ? ONEBODY_FILES : PEOPLE3D_FILES)[which];
  let p = cache.get(url);
  if (!p) {
    p = loadGltfCached<GLTF>(loader, url); // from the early download when it got there first
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

// ── The shader ────────────────────────────────────────────────────────────

const VERT_HEAD = `
varying vec3 vRest;
varying vec3 vRestN;`;

const FRAG_HEAD = `
varying vec3 vRest;
varying vec3 vRestN;
uniform float uKit;
uniform vec3 uShirt, uShorts, uSocks, uBoots, uTrim;
uniform vec4 uLines;      // hem, sock top, boot top, -
uniform vec4 uFaceF;      // chin, eye, brow, front z
uniform vec3 uSkinK, uHairK;
uniform float uHairL;
uniform float uSkinRef;
uniform sampler2D uNum;
uniform float uNumOn;
uniform vec4 uNumBox;     // centre x, centre y, width, height
uniform sampler2D uFaceTex;
uniform float uFaceOn;
uniform vec4 uFaceA;      // chin x, eye y (picture 0..1), picture units per metre across, down
uniform vec4 uFaceO;      // oval centre x, y, radius x, y (picture 0..1)
uniform vec3 uFaceK;
uniform vec4 uSleeve, uTape, uGlove, uBand, uSnood;
uniform vec3 uGlove2, uBand2;
uniform vec3 uArmC[6];
uniform float uArmN;
uniform vec3 uShL, uElL, uWrL, uShR, uElR, uWrR, uNeck;
float p3Face = 0.0;
float p3SegT(vec3 p, vec3 a, vec3 b) { vec3 ab = b - a; return dot(p - a, ab) / dot(ab, ab); }
float p3SegD(vec3 p, vec3 a, vec3 b, float lo, float hi) { vec3 ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), lo, hi); return length(p - (a + ab * t)); }`;

const FRAG_BODY = `
{
  vec3 r = vRest;
  vec3 c = diffuseColor.rgb;
  vec3 cs = pow(max(c, vec3(1e-5)), vec3(1.0 / 2.2));
  float mx = max(cs.r, max(cs.g, cs.b));
  float mn = min(cs.r, min(cs.g, cs.b));
  float sat = (mx - mn) / max(mx, 1e-3);
  float lum = max(c.r, max(c.g, c.b));
  float head = smoothstep(uFaceF.x - 0.045, uFaceF.x - 0.025, r.y);
  float offFace = max(step(uFaceF.z - 0.012, r.y), max(step(r.z, uFaceF.w - 0.07), step(0.064, abs(r.x))));
  float eye = (1.0 - step(0.013, abs(r.y - uFaceF.y))) * step(uFaceF.w - 0.05, r.z);
  float hairCol = uKit > 0.5 ? (1.0 - smoothstep(0.3, 0.5, mx)) : (1.0 - smoothstep(0.12, 0.22, sat)) * smoothstep(0.2, 0.32, mx);
  float hair = head * offFace * (1.0 - eye) * hairCol;
  float kit = uKit * (1.0 - smoothstep(0.1, 0.2, sat)) * smoothstep(0.2, 0.45, mx) * (1.0 - head);
  float skin = (1.0 - kit) * (1.0 - hair) * smoothstep(0.1, 0.2, sat) * smoothstep(0.25, 0.45, mx) * smoothstep(0.03, 0.09, cs.r - cs.b);
  vec3 col = c;
  col = mix(col, min(c * uSkinK, vec3(1.0)), skin);
  col = mix(col, min(uHairK * (dot(c, vec3(0.2126, 0.7152, 0.0722)) / uHairL), vec3(1.0)), hair);
  float shade = clamp(lum / uSkinRef, 0.35, 1.15);

  // The kit: shirt over the hem, shorts to the knee, socks to the ankle, boots.
  float shirtW = step(uLines.x, r.y);
  float bootW = 1.0 - step(uLines.z, r.y);
  float shortsW = step(uLines.y, r.y) * (1.0 - shirtW);
  float socksW = max(0.0, 1.0 - shirtW - shortsW - bootW);
  vec3 part = uShirt * shirtW + uShorts * shortsW + uSocks * socksW + uBoots * bootW;
  if (uNumOn > 0.5 && shirtW > 0.5 && vRestN.z < -0.25 && r.z < 0.0) {
    vec2 nuv = vec2(0.5 - (r.x - uNumBox.x) / uNumBox.z, (r.y - uNumBox.y) / uNumBox.w + 0.5);
    if (nuv.x > 0.0 && nuv.x < 1.0 && nuv.y > 0.0 && nuv.y < 1.0) part = mix(part, uTrim, texture2D(uNum, nuv).a);
  }
  col = mix(col, part * lum, kit);

  // The face picture, straight on from the front, an oval fading into the skin.
  if (uFaceOn > 0.5) {
    vec2 fp = vec2(uFaceA.x + r.x * uFaceA.z, uFaceA.y - (r.y - uFaceF.y) * uFaceA.w);
    vec2 e = (fp - uFaceO.xy) / uFaceO.zw;
    float oval = 1.0 - smoothstep(0.7, 1.0, length(e));
    float facing = smoothstep(0.15, 0.5, vRestN.z) * step(uFaceF.w - 0.11, r.z);
    float inside = step(0.0, fp.x) * step(fp.x, 1.0) * step(0.0, fp.y) * step(fp.y, 1.0);
    vec4 ph = texture2D(uFaceTex, vec2(fp.x, 1.0 - fp.y));
    p3Face = oval * facing * inside * ph.a;
    col = mix(col, ph.rgb * uFaceK, p3Face);
  }

  // Arms: forearm/hand line and upper arm, each side.
  bool lft = r.x > 0.0;
  vec3 S = lft ? uShL : uShR; vec3 E = lft ? uElL : uElR; vec3 W = lft ? uWrL : uWrR;
  float tf = p3SegT(r, E, W);
  float df = p3SegD(r, E, W, -0.3, 1.9);
  float tu = p3SegT(r, S, E);
  float du = p3SegD(r, S, E, 0.0, 1.0);
  float limb = step(0.12, abs(r.x));
  float onFore = step(df, 0.085) * step(-0.05, tf) * limb;
  float onUpper = step(du, 0.095) * step(0.15, tu) * step(tu, 1.05) * limb;
  if (uSleeve.a > 0.5) col = mix(col, uSleeve.rgb * shade, skin * max(onUpper, onFore * step(tf, 0.97)));
  if (uTape.a > 0.5) col = mix(col, uTape.rgb * max(shade, 0.6), onFore * step(0.8, tf) * step(tf, 0.97));
  if (uGlove.a > 0.5) {
    float g = step(df, 0.1) * step(0.97, tf) * limb;
    col = mix(col, mix(uGlove.rgb, uGlove2, step(tf, 1.07)) * max(shade, 0.6), g);
  }
  if (uArmN > 0.5 && lft) {
    float a = onUpper * step(0.36, tu) * step(tu, 0.6) * step(du, 0.09);
    int k = int(clamp(floor((tu - 0.36) / 0.24 * uArmN), 0.0, uArmN - 1.0));
    vec3 ac = uArmC[0];
    for (int i = 1; i < 6; i++) if (i == k) ac = uArmC[i];
    col = mix(col, ac * max(lum, 0.55), a);
  }
  // Head and neck.
  if (uBand.a > 0.5) {
    float y0 = uFaceF.z + 0.016, y1 = uFaceF.z + 0.05;
    float b = step(y0, r.y) * step(r.y, y1) * head;
    float mid = 1.0 - step(0.005, abs(r.y - (y0 + y1) * 0.5));
    col = mix(col, mix(uBand.rgb, uBand2, mid) * 0.9, b);
  }
  if (uSnood.a > 0.5) {
    float rad = length(vec2(r.x - uNeck.x, r.z - uNeck.z));
    float s = step(uFaceF.x - 0.095, r.y) * step(r.y, uFaceF.x - 0.012) * step(rad, 0.085);
    col = mix(col, uSnood.rgb * 0.85, s);
  }
  diffuseColor.rgb = col;
}`;

function lin(T: Three, hex: string): THREE.Color { return new T.Color(hex); }

function makeUniforms(T: Three, meta: PersonMeta) {
  const j = (n: string) => new T.Vector3(...(meta.joints[n] ?? [0, 0, 0]));
  const blank = new T.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  blank.needsUpdate = true;
  return {
    uKit: { value: meta.model === "manager" ? 0 : 1 },
    uShirt: { value: new T.Color(1, 1, 1) }, uShorts: { value: new T.Color(1, 1, 1) },
    uSocks: { value: new T.Color(1, 1, 1) }, uBoots: { value: new T.Color(0.02, 0.02, 0.025) }, uTrim: { value: new T.Color(0, 0, 0) },
    uLines: { value: new T.Vector4(meta.kit.hemY, meta.kit.sockY, meta.kit.bootY, 0) },
    uFaceF: { value: new T.Vector4(meta.face.chinY, meta.face.eyeY, meta.face.browY, meta.face.frontZ) },
    uSkinK: { value: new T.Vector3(1, 1, 1) }, uHairK: { value: new T.Vector3(...meta.hairAvg) },
    uHairL: { value: 0.2126 * meta.hairAvg[0] + 0.7152 * meta.hairAvg[1] + 0.0722 * meta.hairAvg[2] },
    uSkinRef: { value: Math.max(...meta.skinAvg) },
    uNum: { value: blank as THREE.Texture }, uNumOn: { value: 0 },
    uNumBox: { value: new T.Vector4(0, (meta.kit.hemY + meta.joints.Spine[1]) / 2 + 0.03, 0.27, 0.27) },
    uFaceTex: { value: blank as THREE.Texture }, uFaceOn: { value: 0 },
    uFaceA: { value: new T.Vector4() }, uFaceO: { value: new T.Vector4(0.5, 0.5, 1, 1) }, uFaceK: { value: new T.Vector3(1, 1, 1) },
    uSleeve: { value: new T.Vector4(0, 0, 0, 0) }, uTape: { value: new T.Vector4(0, 0, 0, 0) }, uGlove: { value: new T.Vector4(0, 0, 0, 0) },
    uBand: { value: new T.Vector4(0, 0, 0, 0) }, uSnood: { value: new T.Vector4(0, 0, 0, 0) },
    uGlove2: { value: new T.Color() }, uBand2: { value: new T.Color() },
    uArmC: { value: [0, 1, 2, 3, 4, 5].map(() => new T.Color()) }, uArmN: { value: 0 },
    uShL: { value: j("LeftArm") }, uElL: { value: j("LeftForeArm") }, uWrL: { value: j("LeftHand") },
    uShR: { value: j("RightArm") }, uElR: { value: j("RightForeArm") }, uWrR: { value: j("RightHand") },
    uNeck: { value: j("neck") },
  };
}

function patchBody(mat: THREE.MeshStandardMaterial, u: Record<string, { value: unknown }>) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>${VERT_HEAD}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position;\nvRestN = normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>${FRAG_HEAD}`)
      .replace("#include <map_fragment>", `#include <map_fragment>${FRAG_BODY}`)
      // Under the face picture the head's own modelled features go smooth, so
      // the photo's eyes and mouth are the only ones there.
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nvec3 p3GeoN = normal;")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = normalize(mix(normal, p3GeoN, 0.35 + 0.65 * p3Face));");
  };
  mat.customProgramCacheKey = () => "people3d-body-v2";
}

/** The outline: the body pushed out along its normals, back faces only.
 *  With `near` (metres), it is pushed out after the bones have posed the body,
 *  and nearer the camera than `near` it thins in step with the distance: the
 *  same few pixels in a close-up as in a medium shot (a fixed 3.5 mm was a
 *  thick black band round every finger in the hand close-ups, and poked out
 *  between them as shards). Further than `near`, exactly as without it. */
function outlineMaterial(T: Three, width: number, near?: number): THREE.MeshBasicMaterial {
  const m = new T.MeshBasicMaterial({ color: 0x15171c, side: T.BackSide });
  if (near) {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace(
        "#include <project_vertex>",
        `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
float p3d = -mvPosition.z;
float p3k = min(1.0, p3d / ${near.toFixed(3)});
vec3 p3n = normalize(transformedNormal);
#ifdef FLIP_SIDED
p3n = -p3n;
#endif
mvPosition.xyz += p3n * ${width.toFixed(4)} * p3k;
mvPosition.z -= 0.015 * p3k;
gl_Position = projectionMatrix * mvPosition;`,
      );
    };
    m.customProgramCacheKey = () => `people3d-outline-near-${width.toFixed(4)}-${near.toFixed(3)}`;
    return m;
  }
  m.onBeforeCompile = (sh) => {
    // Pushed out along the (seam-welded) normals, and 1.5 cm back from the
    // camera, so it shows round the edge and never pokes through a fold.
    sh.vertexShader = sh.vertexShader
      .replace("#include <begin_vertex>", `vec3 transformed = vec3(position) + normalize(normal) * ${width.toFixed(4)};`)
      .replace("#include <project_vertex>", "#include <project_vertex>\nmvPosition.z -= 0.015;\ngl_Position = projectionMatrix * mvPosition;");
  };
  m.customProgramCacheKey = () => `people3d-outline-${width.toFixed(4)}`;
  return m;
}

// ── A person ──────────────────────────────────────────────────────────────

export interface MakePersonOptions {
  /** Outline thickness, metres (0 for none). */
  outline?: number;
  castShadow?: boolean;
  /** Thin the outline nearer the camera than this (metres): see outlineMaterial. Unset: a fixed width, as before. */
  outlineNear?: number;
  /** The human body only: who to build (height, build, hair, outfit …). Unset: by the file name asked for. */
  human?: HumanSpec;
}

/**
 * One person from a loaded body and the loaded clips. `SkeletonUtils` is
 * three's (passed in, so this file never imports three at load time).
 */
export function makePerson3d(
  T: Three, SkeletonUtils: { clone(o: THREE.Object3D): THREE.Object3D },
  model: GLTF, anims: GLTF, opts: MakePersonOptions = {},
): Person3D {
  const which = (model as GLTF & { humanWhich?: string }).humanWhich;
  if (which) return makeHuman(T, SkeletonUtils, model, anims, opts.human ?? defaultHumanSpec(which), opts);
  const meta = model.scene.userData as PersonMeta;
  if (meta.quant) dequantize(T, model, meta.quant);
  const root = new T.Group();
  const inner = SkeletonUtils.clone(model.scene);
  root.add(inner);
  const body = inner.getObjectByName("Body") as THREE.SkinnedMesh;
  const bones: Record<string, THREE.Bone> = {};
  inner.traverse((o) => { if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone; });
  const armature = inner.getObjectByName("Armature")!;
  const unit = armature.scale.y || 0.01;

  const u = makeUniforms(T, meta);
  const mat = (body.material as THREE.MeshStandardMaterial).clone();
  mat.metalness = 0;
  mat.roughness = 0.72;
  patchBody(mat, u);
  body.material = mat;
  body.frustumCulled = false;
  body.castShadow = !!opts.castShadow;
  const outline = new T.SkinnedMesh(body.geometry, outlineMaterial(T, opts.outline ?? 0.0045, opts.outlineNear));
  outline.name = "Outline";
  outline.frustumCulled = false;
  outline.visible = (opts.outline ?? 0.0045) > 0;
  body.parent!.add(outline);
  outline.bind(body.skeleton, body.bindMatrix);

  // The file's own bone turns ARE the bind pose (and skeleton.pose() can't be
  // used: it writes the Hips' world metres into its cm-scaled local slot).
  const rest = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>();
  for (const b of Object.values(bones)) rest.set(b, [b.position.clone(), b.quaternion.clone()]);
  root.updateMatrixWorld(true);
  const handOf = (side: "L" | "R"): HandFrame => {
    const h = meta.hands[side];
    const q = new T.Quaternion();
    bones[side === "L" ? "LeftHand" : "RightHand"].getWorldQuaternion(q);
    const inv = q.invert();
    return {
      along: new T.Vector3(...h.along).applyQuaternion(inv),
      palm: new T.Vector3(...h.palm).applyQuaternion(inv),
      thumb: new T.Vector3(...h.thumb).applyQuaternion(inv),
      len: h.len,
    };
  };
  const hand = { L: handOf("L"), R: handOf("R") };
  const hipsRest = bones.Hips.position.clone();

  // Clips, the hips' height brought to this body's.
  const k = hipsRest.y / ((anims.scene.userData as { hipsY?: number }).hipsY || hipsRest.y);
  const mixer = new T.AnimationMixer(inner);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of anims.animations) {
    const c = clip.clone();
    for (const tr of c.tracks) {
      if (tr.name.endsWith(".position")) { const v = tr.values.slice(); for (let i = 0; i < v.length; i++) v[i] *= k; tr.values = v; }
    }
    const a = mixer.clipAction(c);
    a.play();
    a.setEffectiveWeight(0);
    actions[clip.name] = a;
  }
  const base = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>();
  for (const b of Object.values(bones)) base.set(b, [b.position.clone(), b.quaternion.clone()]);

  // The one body's fingers: each bone's bend axis in its own frame.
  let fingers: Person3D["fingers"];
  if (meta.fingers) {
    fingers = {} as NonNullable<Person3D["fingers"]>;
    for (const side of ["L", "R"] as const) {
      const out = {} as Record<FingerName, FingerRig>;
      for (const f of FINGER_NAMES) {
        const m = meta.fingers[side][f];
        const bs = m.bones.map((n) => bones[n]);
        const local = (v: V3, b: THREE.Bone) => {
          const q = new T.Quaternion(); b.getWorldQuaternion(q);
          return new T.Vector3(...v).applyQuaternion(q.invert()).normalize();
        };
        out[f] = {
          bones: bs,
          rest: bs.map((b) => b.quaternion.clone()),
          axis: bs.map((b) => local(m.axis, b)),
          swing: m.swing ? local(m.swing, bs[0]) : undefined,
          dir: local(m.dir, bs[2]),
          tipLen: m.len * 0.24 / unit,
        };
      }
      fingers[side] = out;
    }
  }
  return { root, body, outline, bones, mixer, actions, meta, u, hand, base, rest, hipsRest, unit, fingers };
}

/**
 * The one body's positions are 16-bit steps with the decode folded into the
 * bind matrices (KHR_mesh_quantization). The body's shader reads rest-pose
 * METRES (kit lines, face, sleeves), so they go back to metres here, once per
 * loaded file, and the bind matrices lose the decode again.
 */
function dequantize(T: Three, model: GLTF, q: { scale: number; offset: V3 }) {
  const ud = model.scene.userData as { __deq?: boolean };
  if (ud.__deq) return;
  ud.__deq = true;
  const body = model.scene.getObjectByName("Body") as THREE.SkinnedMesh;
  const g = body.geometry;
  const pos = g.getAttribute("position");
  const n = pos.count;
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    P[i * 3] = pos.getX(i) * q.scale + q.offset[0];
    P[i * 3 + 1] = pos.getY(i) * q.scale + q.offset[1];
    P[i * 3 + 2] = pos.getZ(i) * q.scale + q.offset[2];
  }
  g.setAttribute("position", new T.BufferAttribute(P, 3));
  const nor = g.getAttribute("normal");
  if (nor) {
    const N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = nor.getX(i), y = nor.getY(i), z = nor.getZ(i);
      const l = Math.hypot(x, y, z) || 1;
      N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
    }
    g.setAttribute("normal", new T.BufferAttribute(N, 3));
  }
  const uv = g.getAttribute("uv");
  if (uv) {
    const U = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { U[i * 2] = uv.getX(i); U[i * 2 + 1] = uv.getY(i); }
    g.setAttribute("uv", new T.BufferAttribute(U, 2));
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  const D = new T.Matrix4().makeScale(q.scale, q.scale, q.scale).setPosition(q.offset[0], q.offset[1], q.offset[2]);
  const Dinv = D.clone().invert();
  for (const m of body.skeleton.boneInverses) m.multiply(Dinv);
}

/** Does this person have finger bones (the one body)? */
export function hasFingers(p: Person3D): boolean { return !!p.fingers; }

/** Bend one hand's fingers (after the arm is posed). Straight = 0. */
export function poseFingers(T: Three, p: Person3D, side: "L" | "R", pose: FingerPose, w = 1) {
  const rig = p.fingers?.[side];
  if (!rig) return;
  const q = new T.Quaternion();
  for (const f of FINGER_NAMES) {
    const r = rig[f];
    const a = pose[f] ?? [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const b = r.bones[k];
      b.quaternion.copy(r.rest[k]);
      if (k === 0 && f === "thumb" && r.swing && pose.thumbSwing) b.quaternion.multiply(q.setFromAxisAngle(r.swing, pose.thumbSwing * w));
      if (a[k]) b.quaternion.multiply(q.setFromAxisAngle(r.axis[k], a[k] * w));
    }
  }
  rig.thumb.bones[0].parent?.updateMatrixWorld(true);
}

/** Blend two finger poses (k = 0 → a, 1 → b). */
export function mixFingers(a: FingerPose, b: FingerPose, k: number): FingerPose {
  const out: FingerPose = {};
  for (const f of FINGER_NAMES) {
    const x = a[f] ?? [0, 0, 0], y = b[f] ?? [0, 0, 0];
    out[f] = [0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * k) as [number, number, number];
  }
  out.thumbSwing = (a.thumbSwing ?? 0) + ((b.thumbSwing ?? 0) - (a.thumbSwing ?? 0)) * k;
  return out;
}

/** World position of a fingertip (the end of its last bone), and the pad a
 *  little towards the palm side. */
export function fingerTip(T: Three, p: Person3D, side: "L" | "R", f: FingerName): THREE.Vector3 | null {
  const r = p.fingers?.[side]?.[f];
  if (!r) return null;
  const b = r.bones[2];
  b.updateMatrixWorld(true);
  return new T.Vector3().copy(r.dir).multiplyScalar(r.tipLen).applyMatrix4(b.matrixWorld);
}

/** Both hands in a loose, natural curl (the one body's fingers otherwise stay
 *  dead straight, as modelled). The clips never move a finger, so once is
 *  enough unless something else bends them. */
export function relaxHands(T: Three, p: Person3D) {
  if (!p.fingers) return;
  const relaxed = fingersDeg({ thumb: [5, 10, 8], index: [10, 16, 9], middle: [13, 19, 11], ring: [15, 21, 12], little: [17, 23, 14], thumbSwing: 8 });
  poseFingers(T, p, "L", relaxed);
  poseFingers(T, p, "R", relaxed);
}

/** Degrees → a FingerPose in radians (all fingers [a,b,c]). */
export function fingersDeg(d: { [K in FingerName]?: [number, number, number] } & { thumbSwing?: number }): FingerPose {
  const r = (v?: [number, number, number]) => (v ? (v.map((x) => (x * Math.PI) / 180) as [number, number, number]) : undefined);
  return { thumb: r(d.thumb), index: r(d.index), middle: r(d.middle), ring: r(d.ring), little: r(d.little), thumbSwing: ((d.thumbSwing ?? 0) * Math.PI) / 180 };
}

/**
 * Set the clips' weights and times and pose the bones from them. Every bone
 * goes back to the clips' own pose first (the mixer only writes a bone whose
 * value changed, so posing on top would otherwise pile up frame on frame).
 */
export function poseClips(p: Person3D, entries: [string, number, number][]) {
  for (const a of Object.values(p.actions)) a.setEffectiveWeight(0);
  for (const [name, time, w] of entries) {
    const a = p.actions[name];
    if (!a) continue;
    a.setEffectiveWeight(w);
    a.time = Math.max(0, Math.min(time, a.getClip().duration - 1e-3));
  }
  p.base.forEach(([pos, q], b) => { b.position.copy(pos); b.quaternion.copy(q); });
  p.mixer.update(0);
  p.base.forEach(([pos, q], b) => { pos.copy(b.position); q.copy(b.quaternion); });
  p.root.updateMatrixWorld(true);
}

/** Put every bone back in the bind pose (to hang things on bones, or measure). */
export function poseRest(p: Person3D) {
  p.rest.forEach(([pos, q], b) => { b.position.copy(pos); b.quaternion.copy(q); });
  p.root.updateMatrixWorld(true);
}

/** Put the hips at (x, z) metres in the person's own frame (clips keep the height). */
export function setHipsXZ(p: Person3D, x: number, z: number) {
  p.bones.Hips.position.x = x / p.unit;
  p.bones.Hips.position.z = z / p.unit;
  p.root.updateMatrixWorld(true);
}


/** Paint a look onto a person (cheap: uniforms only). */
export function dressPerson3d(T: Three, p: Person3D, look: PersonLook) {
  const u = p.u as Record<string, { value: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const m = p.meta;
  const ratio = (hex: string, avg: V3, cap = 6) => {
    const c = lin(T, hex);
    return new T.Vector3(Math.min(cap, c.r / avg[0]), Math.min(cap, c.g / avg[1]), Math.min(cap, c.b / avg[2]));
  };
  u.uSkinK.value = ratio(look.skin, m.skinAvg);
  // Hair: the chosen colour, shaded strand by strand as the texture is.
  const hair = m.model === "manager"
    ? new T.Color(look.hair ?? "#3a2a20").lerp(new T.Color("#c9c9c9"), look.grey ?? 0.6)
    : lin(T, look.hair ?? "#2b1b12");
  u.uHairK.value = new T.Vector3(hair.r, hair.g, hair.b);
  if (look.kit) {
    u.uShirt.value = lin(T, look.kit.shirt);
    u.uShorts.value = lin(T, look.kit.trim);
    u.uSocks.value = lin(T, look.kit.shirt);
    u.uTrim.value = lin(T, look.kit.trim);
  }
  u.uNumOn.value = look.number ? 1 : 0;
  if (look.number) u.uNum.value = look.number;
  const acc = (slot: string) => look.accessories?.find((a) => a.slot === slot);
  const on4 = (hex: string | undefined) => (hex ? new T.Vector4(...lin(T, hex).toArray(), 1) : new T.Vector4(0, 0, 0, 0));
  const boots = acc("boots");
  u.uBoots.value = lin(T, boots?.color ?? "#141416");
  u.uSleeve.value = on4(acc("arms")?.color);
  u.uTape.value = on4(acc("wrists")?.color);
  const gl = acc("hands");
  u.uGlove.value = on4(gl?.color);
  u.uGlove2.value = lin(T, gl?.color2 ?? gl?.color ?? "#000000");
  const hb = acc("head");
  u.uBand.value = on4(hb?.color);
  u.uBand2.value = lin(T, hb?.color2 ?? hb?.color ?? "#000000");
  u.uSnood.value = on4(acc("neck")?.color);
  const ab = acc("armband");
  const stripes = ab ? (ab.stripes ?? (ab.color2 ? [ab.color, ab.color2] : [ab.color])).slice(0, 6) : [];
  u.uArmN.value = stripes.length;
  stripes.forEach((s, i) => { (u.uArmC.value as THREE.Color[])[i] = lin(T, s); });

  // The face picture.
  const f = look.face;
  if (f) {
    const old = u.uFaceTex.value as THREE.Texture;
    const tex = f.canvas instanceof HTMLCanvasElement ? new T.CanvasTexture(f.canvas) : new T.Texture(f.canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.needsUpdate = true;
    if (old && old !== tex && (old as THREE.Texture & { userData: { mine?: boolean } }).userData?.mine) old.dispose();
    tex.userData.mine = true;
    u.uFaceTex.value = tex;
    const cw = f.canvas.width, ch = f.canvas.height;
    const F = m.face;
    // Picture px per metre: the photo's eyes three quarters of its face box
    // over its chin, on this head's eyes; its chin on this head's chin.
    const sy = (0.75 * f.faceH) / (F.eyeY - F.chinY);
    const sx = sy * 1.25; // the photo's eyes as far apart as this head's
    const eyePx = f.chinY - 0.75 * f.faceH;
    u.uFaceA.value = new T.Vector4(f.chinX / cw, eyePx / ch, sx / cw, sy / ch);
    u.uFaceO.value = new T.Vector4(f.chinX / cw, (f.chinY - f.faceH * 0.55) / ch, (f.faceH * 0.47) / cw, (f.faceH * 0.66) / ch);
    const want = lin(T, look.skin);
    const has = lin(T, look.faceSkin ?? look.skin);
    const k = (a: number, b: number) => Math.min(1.8, Math.max(0.25, a / Math.max(0.004, b)));
    u.uFaceK.value = new T.Vector3(k(want.r, has.r), k(want.g, has.g), k(want.b, has.b));
    u.uFaceOn.value = 1;
  } else {
    u.uFaceOn.value = 0;
  }
}

/** World position of a bone. */
export function bonePos(T: Three, b: THREE.Object3D): THREE.Vector3 { const v = new T.Vector3(); b.getWorldPosition(v); return v; }

/** The body shader's pieces, for scenes that light the same body their own
 *  way (the cut-scene people, lib/star/cutscene/face.ts). Read only. */
export const PEOPLE3D_SHADER = { VERT_HEAD, FRAG_HEAD, FRAG_BODY } as const;
/** The body's uniforms, shader patch and outline (as makePerson3d makes them),
 *  for the human body (lib/star/human3d/human.ts). */
export { makeUniforms as makePeople3dUniforms, patchBody as patchPeople3dBody, outlineMaterial as people3dOutline };
