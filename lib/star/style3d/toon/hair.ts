/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * WEARING TOON HAIR (hairStyles.ts): a modelled hairstyle put on a Style A person.
 *
 * The hair is a skinned mesh on the person's own skeleton, with the bone weights of the scalp
 * under each vertex (tools/hair3d/build_hair.py), so it turns, nods and scales with the head
 * exactly as the scalp does. It takes the person's own hair colour (the same uniform the body's
 * shader paints his sides, brows and beard with, so dressPerson3d recolours both), the body's
 * two soft cel bands, cool shade side, warm rim and the page's back rim, and an ink line of its own.
 *
 *   const hair = await wearToonHair(T, loader, person, "locsLong");   // after makePerson3d
 *   hair?.update(dt);        // every frame, after the person is posed: the loose hair swings (below)
 *   hair?.dispose();
 *
 * THE SWING (Harry, 20 Nov 2026: "locs and braids not swinging could be slightly weird"). No cloth,
 * no extra bones, no extra draw: ONE damped spring per head of hair. A point behind and below the
 * head is followed by a weight on a spring; how far the weight trails it is the swing, handed to
 * the vertex shader, which moves each vertex by its own share (0 on the scalp … 1 at a loose tip,
 * written by tools/hair3d/build_hair.py). So long locs, braids, a ponytail and a mullet's back lag
 * when the head turns or stops, and settle. The swing is taken in the head's own rest pose: any
 * part of it that points in towards the head's axis is dropped, and the hair only ever rises as it
 * swings, so it never goes into the head, the neck or down into the shoulders any further than the
 * still hair does. Not updated (or the head still): exactly the modelled hair.
 * Loaded with withMeshopt (RUL-3D-007); a file is fetched once per page.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Person3D } from "../../people3d";
import { loadGltfCached } from "../../three3d/perf";
import { TOON_SOFT, toonRimUniforms } from "./shader";
import { TOON_HAIR_INFO, TOON_HAIR_LIFT, toonHairFile, toonHairFits, type ToonHair } from "./hairStyles";

type Three = typeof THREE;

/**
 * The swing's dials (Harry on the first film: "it seems decent"; then a touch more weight, so the
 * locs never swing out level): the spring (a period of about 0.75 s, settled in about a second), how much
 * of the trail the hair takes, the most a tip may move (metres: under 20 degrees off the hang on
 * shoulder locs), the pendulum's length and the most a tip may rise (how
 * much a tip rises as it swings out).
 */
export const TOON_HAIR_SWING = { stiffness: 70, damping: 6.5, amount: 0.75, max: 0.06, length: 0.16, lift: 0.012 };
const v3 = (a: readonly number[]) => `vec3(${a.map((x) => x.toFixed(3)).join(", ")})`;

const cache = new Map<string, Promise<GLTF>>();
/** The hair file for this style on this head (cached per page). */
export function loadToonHair(loader: { loadAsync(url: string): Promise<unknown> }, hair: ToonHair, head: NonNullable<Person3D["toonHead"]>): Promise<GLTF> {
  const url = toonHairFile(hair, head);
  let g = cache.get(url);
  if (!g) {
    g = loadGltfCached<GLTF>(loader, url);
    g.catch(() => cache.delete(url));
    cache.set(url, g);
  }
  return g;
}

/** The hair's own Style A material: the body's hair paint and light, on a plain mesh. */
/** The vertex shader's share of the swing (both the hair and its ink line). */
const SWING_PARS = "\nuniform vec3 uSwing;\nuniform vec3 uSwingC;\nuniform vec2 uSwingTop;\nattribute vec2 aSwing;";
const SWING_VERT = `
{
  vec3 swO = uSwing * aSwing.x;
  vec2 swR = transformed.xz - uSwingC.xy;
  float swL = length(swR);
  if (swL > 1e-4) { swR /= swL; float swD = dot(swO.xz, swR); if (swD < 0.0) swO.xz -= swR * swD; }
  // hair has weight: a tip rises only a little as it swings out, and loose hair never comes up past the ears
  swO.y = min(dot(swO.xz, swO.xz) / (2.0 * uSwingC.z), uSwingTop.y) * step(1e-4, aSwing.x);
  transformed += swO;
  if (aSwing.x > 0.0 && position.y < uSwingTop.x) transformed.y = min(transformed.y, uSwingTop.x);
}`;
export interface SwingUniforms { uSwing: { value: THREE.Vector3 }; uSwingC: { value: THREE.Vector3 }; uSwingTop: { value: THREE.Vector2 } }

/** The hair's ink line (people3d's own, plus the swing). */
function hairOutline(T: Three, width: number, sw: SwingUniforms | null): THREE.MeshBasicMaterial {
  const m = new T.MeshBasicMaterial({ color: 0x15171c, side: T.BackSide });
  m.onBeforeCompile = (sh) => {
    if (sw) Object.assign(sh.uniforms, sw);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>${sw ? SWING_PARS : ""}`)
      .replace("#include <begin_vertex>", `vec3 transformed = vec3(position) + normalize(normal) * ${width.toFixed(4)};${sw ? SWING_VERT : ""}`)
      .replace("#include <project_vertex>", "#include <project_vertex>\nmvPosition.z -= 0.015;\ngl_Position = projectionMatrix * mvPosition;");
  };
  m.customProgramCacheKey = () => `toon-hair-outline-${width.toFixed(4)}-${sw ? 1 : 0}`;
  return m;
}

function hairMaterial(T: Three, uHairK: { value: unknown }, sheen: number, shadeMax: number, sw: SwingUniforms | null): THREE.MeshStandardMaterial {
  const mat = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.9 });
  mat.envMapIntensity = 0.8;
  const lightsPars = (T.ShaderChunk as Record<string, string>).lights_physical_pars_fragment
    .replace("vec3 irradiance = dotNL * directLight.color;", `vec3 irradiance = mix(${v3(TOON_SOFT.low)}, ${v3(TOON_SOFT.lit)}, smoothstep(${TOON_SOFT.edge[0].toFixed(3)}, ${TOON_SOFT.edge[1].toFixed(3)}, dotNL)) * directLight.color;\n\tthLitEdge = max(thLitEdge, step(0.42, dotNL) * dot(directLight.color, vec3(0.33)));`)
    .replace("reflectedLight.directSpecular += irradiance * BRDF_GGX(", "reflectedLight.directSpecular += (dotNL * directLight.color) * BRDF_GGX(");
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHairK = uHairK as { value: unknown };
    Object.assign(sh.uniforms, toonRimUniforms(T));
    if (sw) Object.assign(sh.uniforms, sw);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRestN;\nvarying vec2 vHairUv;${sw ? SWING_PARS : ""}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvRestN = normal;\nvHairUv = uv;${sw ? SWING_VERT : ""}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uHairK;\nuniform vec4 uRimFx;\nuniform vec3 uRimDirV;\nvarying vec3 vRestN;\nvarying vec2 vHairUv;\nfloat thLitEdge = 0.0;")
      .replace("#include <map_fragment>", `{
  // the body's stylised hair (shader.ts TOON_BODY): one flat colour, lighter on top, a painted sheen
  // band; the mesh's own shade (roots and creases darker, each strand a touch different) on top
  vec3 rn = normalize(vRestN);
  float sheen = smoothstep(0.25, 0.4, rn.y) * (1.0 - smoothstep(0.62, 0.78, rn.y)) * ${sheen.toFixed(3)};
  vec3 flat_ = uHairK * mix(0.85, 1.0, smoothstep(0.0, 0.6, rn.y)) * (vHairUv.x * ${shadeMax.toFixed(3)});
  diffuseColor.rgb = min(flat_ * (1.0 + 0.9 * sheen) + sheen * 0.04, vec3(1.0));
}`)
      .replace("#include <lights_physical_pars_fragment>", lightsPars)
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= vec3(0.9, 0.9, 1.06);")
      .replace("#include <opaque_fragment>", `{
  float thF = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
  float thRim = step(0.72, thF) * step(0.05, thLitEdge);
  outgoingLight += thRim * 0.35 * vec3(1.0, 0.75, 0.45) * diffuseColor.rgb * clamp(thLitEdge, 0.5, 1.2);
  if (uRimFx.w > 0.0) {
    float rNdv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
    float rK = pow(1.0 - rNdv, 2.4) * smoothstep(-0.3, 0.55, dot(normal, normalize(uRimDirV)));
    outgoingLight += uRimFx.rgb * rK * uRimFx.w * (0.3 + diffuseColor.rgb);
  }
}
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `toon-hair-v2-${sheen.toFixed(2)}-${shadeMax.toFixed(2)}-${sw ? 1 : 0}`;
  return mat;
}

export interface ToonHairOn {
  hair: ToonHair;
  mesh: THREE.SkinnedMesh;
  outline: THREE.SkinnedMesh | null;
  /** Does this style have loose hair that swings? */
  swings: boolean;
  /** Call every frame after the person is posed (dt seconds): the loose hair lags and settles. Does nothing on a style with none. */
  update(dt: number): void;
  /** Put the hair back at rest now (after a cut, or moving the person somewhere else). */
  settle(): void;
  dispose(): void;
}

/**
 * Put a loaded hair file on a person (a head that wears hair: toonHairFits). `outline`: the ink
 * line's width in metres (0 none; default the person's own). Returns null on a head that wears
 * none, or a body rebuilt to other proportions (its scalp is no longer where the file's is).
 */
export function addToonHair(T: Three, p: Person3D, g: GLTF, hair: ToonHair, opts: { outline?: number; castShadow?: boolean } = {}): ToonHairOn | null {
  if (!p.toonHead || !toonHairFits(p.toonHead) || (p.prop && p.prop !== "a")) return null;
  const src = g.scene.getObjectByName("Hair") as THREE.Mesh | undefined;
  if (!src) return null;
  const ud = g.scene.userData as { joints?: string[]; shadeMax?: number };
  const geo = src.geometry.clone();
  // the file's joints by name → this body's skeleton
  const bones = p.body.skeleton.bones;
  const at = new Map(bones.map((b, i) => [b.name, i]));
  const names = ud.joints ?? [];
  const si = geo.getAttribute("skinIndex");
  const idx = new Uint16Array(si.count * 4);
  for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) idx[i * 4 + k] = at.get(names[si.getComponent(i, k)]) ?? 0;
  geo.setAttribute("skinIndex", new T.Uint16BufferAttribute(idx, 4));
  const lift = TOON_HAIR_LIFT[p.toonHead] ?? 0;
  if (lift) geo.translate(0, lift, 0);
  const info = TOON_HAIR_INFO[hair];
  // the swing: only a style with loose hair carries the share per vertex (TEXCOORD_1)
  const uv1 = geo.getAttribute("uv1");
  const swings = !!uv1 && !!(g.scene.userData as { swing?: boolean }).swing && !!p.bones.Head;
  const J = (p.meta.joints as Record<string, [number, number, number]>).Head ?? [0, p.meta.face.eyeY - 0.03, 0.03];
  const sw: SwingUniforms | null = swings ? { uSwing: { value: new T.Vector3() }, uSwingC: { value: new T.Vector3(0, J[2] - 0.015, TOON_HAIR_SWING.length) }, uSwingTop: { value: new T.Vector2(p.meta.face.eyeY + 0.015 + lift, TOON_HAIR_SWING.lift) } } : null;
  if (swings) geo.setAttribute("aSwing", uv1);
  const mat = hairMaterial(T, (p.u as unknown as Record<string, { value: unknown }>).uHairK, info.sheen, ud.shadeMax ?? 1, sw);
  const put = (m: THREE.SkinnedMesh) => {
    m.position.copy(p.body.position); m.quaternion.copy(p.body.quaternion); m.scale.copy(p.body.scale);
    m.frustumCulled = false;
    p.body.parent!.add(m);
    m.bind(p.body.skeleton, p.body.bindMatrix);
  };
  const mesh = new T.SkinnedMesh(geo, mat);
  mesh.name = "ToonHair";
  mesh.castShadow = opts.castShadow ?? p.body.castShadow;
  put(mesh);
  let outline: THREE.SkinnedMesh | null = null;
  const w = opts.outline ?? (p.outline.visible ? 0.0045 : 0);
  if (w > 0) {
    outline = new T.SkinnedMesh(geo, hairOutline(T, w, sw));
    outline.name = "ToonHairOutline";
    put(outline);
  }
  // under a cap he already wears (accessories.ts): pressed in under its crown, as the hair on his head is
  const press = (p as Person3D & { capPress?: ((m: THREE.SkinnedMesh) => number) | null }).capPress;
  if (press) press(mesh);
  // one weight on a spring, trailing a point behind and below the head (rest pose → world by the head bone's own skin matrix)
  const head = p.bones.Head;
  const hi = bones.indexOf(head);
  const skinM = new T.Matrix4(), inv3 = new T.Matrix3(), target = new T.Vector3(), q = new T.Vector3(), vel = new T.Vector3(), off = new T.Vector3();
  const anchor = new T.Vector3(0, J[1] - 0.12, J[2] - 0.12);
  let live = false;
  const aim = () => {
    head.updateWorldMatrix(true, false);
    skinM.multiplyMatrices(head.matrixWorld, p.body.skeleton.boneInverses[hi]).multiply(p.body.bindMatrix);
    target.copy(anchor).applyMatrix4(skinM);
  };
  const settle = () => { if (!sw) return; aim(); q.copy(target); vel.set(0, 0, 0); sw.uSwing.value.set(0, 0, 0); live = true; };
  const update = (dt: number) => {
    if (!sw || !(dt > 0)) return;
    if (!live) { settle(); return; }
    aim();
    // moved somewhere else in one frame (a cut, a teleport): start again at rest
    if (q.distanceTo(target) > 0.6) { settle(); return; }
    const S = TOON_HAIR_SWING;
    let left = Math.min(dt, 0.1);
    while (left > 1e-5) {
      const h = Math.min(left, 1 / 90);
      vel.x += (S.stiffness * (target.x - q.x) - S.damping * vel.x) * h;
      vel.y += (S.stiffness * (target.y - q.y) - S.damping * vel.y) * h;
      vel.z += (S.stiffness * (target.z - q.z) - S.damping * vel.z) * h;
      q.addScaledVector(vel, h);
      left -= h;
    }
    // how far the weight trails, in the head's own rest pose, never more than `max`
    off.subVectors(q, target);
    inv3.setFromMatrix4(skinM).invert();
    off.applyMatrix3(inv3).multiplyScalar(S.amount);
    const l = off.length();
    if (l > S.max) off.multiplyScalar(S.max / l);
    sw.uSwing.value.copy(off);
  };
  return {
    hair, mesh, outline, swings, update, settle,
    dispose() {
      mesh.removeFromParent(); outline?.removeFromParent();
      geo.dispose(); mat.dispose(); (outline?.material as THREE.Material | undefined)?.dispose();
      if (outline && outline.geometry !== geo) outline.geometry.dispose(); // pressed under a cap: its own copy
    },
  };
}

/** Load and wear in one go. */
export async function wearToonHair(T: Three, loader: { loadAsync(url: string): Promise<unknown> }, p: Person3D, hair: ToonHair, opts: { outline?: number; castShadow?: boolean } = {}): Promise<ToonHairOn | null> {
  if (!p.toonHead || !toonHairFits(p.toonHead)) return null;
  return addToonHair(T, p, await loadToonHair(loader, hair, p.toonHead), hair, opts);
}
