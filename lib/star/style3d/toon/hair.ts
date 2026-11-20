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
 *   hair?.dispose();
 * Loaded with withMeshopt (RUL-3D-007); a file is fetched once per page.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Person3D } from "../../people3d";
import { people3dOutline } from "../../people3d";
import { loadGltfCached } from "../../three3d/perf";
import { TOON_SOFT, toonRimUniforms } from "./shader";
import { TOON_HAIR_INFO, TOON_HAIR_LIFT, toonHairFile, toonHairFits, type ToonHair } from "./hairStyles";

type Three = typeof THREE;
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
function hairMaterial(T: Three, uHairK: { value: unknown }, sheen: number, shadeMax: number): THREE.MeshStandardMaterial {
  const mat = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.9 });
  mat.envMapIntensity = 0.8;
  const lightsPars = (T.ShaderChunk as Record<string, string>).lights_physical_pars_fragment
    .replace("vec3 irradiance = dotNL * directLight.color;", `vec3 irradiance = mix(${v3(TOON_SOFT.low)}, ${v3(TOON_SOFT.lit)}, smoothstep(${TOON_SOFT.edge[0].toFixed(3)}, ${TOON_SOFT.edge[1].toFixed(3)}, dotNL)) * directLight.color;\n\tthLitEdge = max(thLitEdge, step(0.42, dotNL) * dot(directLight.color, vec3(0.33)));`)
    .replace("reflectedLight.directSpecular += irradiance * BRDF_GGX(", "reflectedLight.directSpecular += (dotNL * directLight.color) * BRDF_GGX(");
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHairK = uHairK as { value: unknown };
    Object.assign(sh.uniforms, toonRimUniforms(T));
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRestN;\nvarying vec2 vHairUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRestN = normal;\nvHairUv = uv;");
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
  mat.customProgramCacheKey = () => `toon-hair-v1-${sheen.toFixed(2)}-${shadeMax.toFixed(2)}`;
  return mat;
}

export interface ToonHairOn {
  hair: ToonHair;
  mesh: THREE.SkinnedMesh;
  outline: THREE.SkinnedMesh | null;
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
  const mat = hairMaterial(T, (p.u as unknown as Record<string, { value: unknown }>).uHairK, info.sheen, ud.shadeMax ?? 1);
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
    outline = new T.SkinnedMesh(geo, people3dOutline(T, w));
    outline.name = "ToonHairOutline";
    put(outline);
  }
  return {
    hair, mesh, outline,
    dispose() {
      mesh.removeFromParent(); outline?.removeFromParent();
      geo.dispose(); mat.dispose(); (outline?.material as THREE.Material | undefined)?.dispose();
    },
  };
}

/** Load and wear in one go. */
export async function wearToonHair(T: Three, loader: { loadAsync(url: string): Promise<unknown> }, p: Person3D, hair: ToonHair, opts: { outline?: number; castShadow?: boolean } = {}): Promise<ToonHairOn | null> {
  if (!p.toonHead || !toonHairFits(p.toonHead)) return null;
  return addToonHair(T, p, await loadToonHair(loader, hair, p.toonHead), hair, opts);
}
