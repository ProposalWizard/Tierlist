/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BAKED LIGHT — the light a set really gets, worked out once in Blender and
 * read back while you play (tools/bake3d: capture → bake_light.py → pack.py).
 *
 * The live lights give every surface the same open sky and stop their
 * shadows 48 m from the ball. The bake knows the set's shape, so for every
 * point it stores three things, per time of day:
 *
 *   sky     how much open sky the point sees (the shade under a roof, in a
 *           corner, at the foot of a wall, behind the advertising boards)
 *   sun     whether the sun (or the main floodlight bank) reaches it — soft
 *           edged, over the WHOLE set (the stand's shadow across the far
 *           half of the pitch, the roof's shadow on the upper tier)
 *   bounce  the light thrown back off the lit stands, walls and grass
 *
 * A material with userData.bakeNeutral (the crowd) keeps a floor under its
 * shade and has its sky light turned neutral-warm, so a shaded stand reads as
 * a dark crowd, not a blue one.
 *
 * Two pictures carry it: the FLOOR (the ground seen from above) and the
 * VOLUME (the same numbers through the air, as stacked slices). Static
 * things AND the people and ball read the volume where they stand, so a man
 * walking into the stand's shadow goes into shade with it.
 *
 * Applied by patching each lit material's shader (one more texture read per
 * pixel; kept on Low quality too). Files: public/star/bake/<set>/.
 */

export type BakeSet = "stadium" | "garden" | "shop" | "casino";
export type BakeTod = "day" | "golden" | "night" | "indoor";

interface GridMeta { min: [number, number, number]; max: [number, number, number]; dims: [number, number, number]; y?: number }
export interface BakeMeta {
  tods: string[];
  aoRadius: number;
  bounce: { floor?: Record<string, number>; volume?: Record<string, number> };
  floor?: GridMeta;
  volume?: GridMeta;
}

export interface BakeStrength {
  /** 0..1: how much the open-sky shade darkens the sky's light. */
  ao: number;
  /** 0..1: how much the baked sun shadow darkens the direct light. */
  shade: number;
  /** Bounced light, a multiple of the bake's own measure (1 = as baked). */
  bounce: number;
}

export interface BakedLight {
  readonly set: BakeSet;
  /** Patch every lit material under `root` that is not patched yet (cheap; call again when things are added). */
  apply(root: any): void;
  /** Change the time of day (loads that one's pictures). */
  setTod(tod: BakeTod): Promise<void>;
  /** The direct light's colour × strength (the bounce is that light, thrown back). */
  setLight(color: any, intensity: number): void;
  setStrength(s: Partial<BakeStrength>): void;
  dispose(): void;
}

export const BAKE_BASE = "/star/bake/";

const metaCache = new Map<BakeSet, Promise<BakeMeta | null>>();
function loadMeta(set: BakeSet): Promise<BakeMeta | null> {
  let p = metaCache.get(set);
  if (!p) {
    p = fetch(`${BAKE_BASE}${set}/meta.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    metaCache.set(set, p);
  }
  return p;
}

/** The raw bytes of a picture (no colour management, no premultiplying: the numbers are data). */
async function pixels(url: string): Promise<{ data: Uint8Array; w: number; h: number } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const bmp = await createImageBitmap(await r.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" } as any);
    const c: any = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement("canvas"), { width: bmp.width, height: bmp.height });
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    const w = bmp.width, h = bmp.height;
    const d = g.getImageData(0, 0, w, h).data;
    bmp.close?.();
    return { data: new Uint8Array(d.buffer.slice(0)), w, h };
  } catch {
    return null;
  }
}

const VERT_HEAD = /* glsl */ `
varying vec3 vBkW;
varying vec3 vBkN;`;
const VERT_BODY = /* glsl */ `
{
  vec4 bkw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  bkw = instanceMatrix * bkw;
#endif
  vBkW = (modelMatrix * bkw).xyz;
  vBkN = (vec4(transformedNormal, 0.0) * viewMatrix).xyz;
}`;
const FRAG_HEAD = /* glsl */ `
varying vec3 vBkW;
varying vec3 vBkN;
uniform highp sampler3D uBkVol;
uniform sampler2D uBkFloor;
uniform vec3 uBkVMin, uBkVSize, uBkBounceV, uBkBounceF;
uniform vec2 uBkFMin, uBkFSize;
uniform float uBkFloorY, uBkOff, uBkAO, uBkShade, uBkOn, uBkHasF, uBkHasV;`;
const FRAG_BODY = /* glsl */ `
if (uBkOn > 0.5) {
  vec3 bkn = normalize(vBkN);
  vec3 bk = vec3(1.0, 1.0, 0.0);
  vec3 bounceCol = uBkBounceV;
  vec2 fuv = (vBkW.xz - uBkFMin) / uBkFSize;
  if (uBkHasF > 0.5 && vBkW.y < uBkFloorY && bkn.y > 0.6 && all(greaterThan(fuv, vec2(0.0))) && all(lessThan(fuv, vec2(1.0)))) {
    bk = texture2D(uBkFloor, fuv).rgb;
    bounceCol = uBkBounceF;
  } else if (uBkHasV > 0.5) {
    vec3 q = (vBkW + bkn * uBkOff - uBkVMin) / uBkVSize;
    vec3 inb = step(vec3(0.0), q) * step(q, vec3(1.0));
    bk = mix(vec3(1.0, 1.0, 0.0), texture(uBkVol, clamp(q.xzy, 0.0, 1.0)).rgb, inb.x * inb.y * inb.z);
  }
  float bkSky = mix(1.0, bk.r, uBkAO);
#ifdef BK_NEUTRAL
  // the crowd: never darker than half the open sky's light (under the roof it read as a black hole)
  bkSky = max(bkSky, 0.55);
#endif
  float bkSun = mix(1.0, bk.g, uBkShade);
  reflectedLight.indirectDiffuse *= bkSky;
  reflectedLight.indirectSpecular *= mix(1.0, bkSky, 0.75);
  reflectedLight.directDiffuse *= bkSun;
  reflectedLight.directSpecular *= bkSun;
  reflectedLight.indirectDiffuse += bounceCol * bk.b * BRDF_Lambert(diffuseColor.rgb);
#ifdef BK_NEUTRAL
  // ... and its shade is neutral-warm, not the blue sky's colour (9 Oct still: a navy crowd with red flecks)
  { vec3 ind = reflectedLight.indirectDiffuse; float g = dot(ind, vec3(0.3333));
    reflectedLight.indirectDiffuse = mix(vec3(g), ind, 0.3) * vec3(1.14, 1.0, 0.8) * 1.3;
    float gs = dot(reflectedLight.indirectSpecular, vec3(0.3333)); reflectedLight.indirectSpecular = vec3(gs) * 0.6; }
#endif
}`;

/** Materials that light per pixel with three's usual light chunks. */
const LIT = (m: any) => m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial) && !m.isShaderMaterial;

export async function createBakedLight(T: any, set: BakeSet, tod: BakeTod, strength: Partial<BakeStrength> = {}): Promise<BakedLight | null> {
  // ?bake=0 on any page: the live light alone (for before/after stills)
  if (typeof location !== "undefined" && new URLSearchParams(location.search).get("bake") === "0") return null;
  const meta = await loadMeta(set);
  if (!meta) return null;
  const U: Record<string, { value: any }> = {
    uBkVol: { value: null }, uBkFloor: { value: null },
    uBkVMin: { value: new T.Vector3() }, uBkVSize: { value: new T.Vector3(1, 1, 1) },
    uBkFMin: { value: new T.Vector2() }, uBkFSize: { value: new T.Vector2(1, 1) },
    uBkBounceV: { value: new T.Color(0, 0, 0) }, uBkBounceF: { value: new T.Color(0, 0, 0) },
    uBkFloorY: { value: 0.15 }, uBkOff: { value: 0.5 }, uBkAO: { value: 1 }, uBkShade: { value: 1 },
    uBkOn: { value: 0 }, uBkHasF: { value: 0 }, uBkHasV: { value: 0 },
  };
  const st: BakeStrength = { ao: 1, shade: 1, bounce: 1, ...strength };
  const light = { color: new T.Color(1, 1, 1), intensity: 1 };
  let bounceScale = { v: 0, f: 0 };
  if (meta.volume) {
    const v = meta.volume;
    U.uBkVMin.value.set(...v.min);
    U.uBkVSize.value.set(v.max[0] - v.min[0], v.max[1] - v.min[1], v.max[2] - v.min[2]);
    // sample half a cell out from the surface, so a wall does not read the inside of itself
    const cell = Math.min((v.max[0] - v.min[0]) / (v.dims[0] - 1), (v.max[2] - v.min[2]) / (v.dims[2] - 1));
    U.uBkOff.value = cell * 0.6;
  }
  if (meta.floor) {
    const f = meta.floor;
    U.uBkFMin.value.set(f.min[0], f.min[2]);
    U.uBkFSize.value.set(f.max[0] - f.min[0], f.max[2] - f.min[2]);
    U.uBkFloorY.value = (f.y ?? 0) + 0.15;
  }
  const textures: any[] = [];
  const patched = new Set<any>();
  const refresh = () => {
    const k = (s: number) => light.intensity * s * st.bounce;
    U.uBkBounceV.value.copy(light.color).multiplyScalar(k(bounceScale.v));
    U.uBkBounceF.value.copy(light.color).multiplyScalar(k(bounceScale.f));
    U.uBkAO.value = st.ao; U.uBkShade.value = st.shade;
  };
  let token = 0;
  const load = async (t: BakeTod) => {
    const id = meta.tods.includes(t) ? t : meta.tods[0];
    const my = ++token;
    const [vol, flo] = await Promise.all([
      meta.volume ? pixels(`${BAKE_BASE}${set}/${id}-vol.webp`) : Promise.resolve(null),
      meta.floor ? pixels(`${BAKE_BASE}${set}/${id}-floor.webp`) : Promise.resolve(null),
    ]);
    if (my !== token) return;
    for (const tx of textures.splice(0)) tx.dispose();
    if (vol && meta.volume) {
      const [nx, ny, nz] = meta.volume.dims;
      // the picture is slices stacked down the page (y = 0 first), each nz rows of nx: that IS x-fastest, then z, then y
      // — so read as a 3D texture whose axes are (x, z, y), and swap y/z in the lookup
      const tex = new T.Data3DTexture(vol.data, nx, nz, ny);
      tex.format = T.RGBAFormat; tex.type = T.UnsignedByteType;
      tex.minFilter = tex.magFilter = T.LinearFilter;
      tex.wrapS = tex.wrapT = tex.wrapR = T.ClampToEdgeWrapping;
      tex.unpackAlignment = 1; tex.needsUpdate = true;
      textures.push(tex);
      U.uBkVol.value = tex; U.uBkHasV.value = 1;
    }
    if (flo && meta.floor) {
      const tex = new T.DataTexture(flo.data, flo.w, flo.h, T.RGBAFormat, T.UnsignedByteType);
      tex.minFilter = tex.magFilter = T.LinearFilter;
      tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
      tex.flipY = false; tex.needsUpdate = true;
      textures.push(tex);
      U.uBkFloor.value = tex; U.uBkHasF.value = 1;
    }
    bounceScale = { v: meta.bounce.volume?.[id] ?? 0, f: meta.bounce.floor?.[id] ?? 0 };
    refresh();
    U.uBkOn.value = U.uBkHasV.value || U.uBkHasF.value ? 1 : 0;
  };
  await load(tod);

  const patch = (m: any) => {
    if (patched.has(m) || !LIT(m) || m.userData.noBake) return;
    patched.add(m);
    const inner = m.onBeforeCompile;
    const innerKey = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = (sh: any, r: any) => {
      inner?.call(m, sh, r);
      if (!m.userData.bakeOn) return;
      if (m.userData.bakeNeutral) sh.fragmentShader = `#define BK_NEUTRAL\n${sh.fragmentShader}`;
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>\n${VERT_HEAD}`)
        .replace("#include <project_vertex>", `#include <project_vertex>\n${VERT_BODY}`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
        .replace("#include <aomap_fragment>", `${FRAG_BODY}\n#include <aomap_fragment>`);
    };
    m.customProgramCacheKey = () => `${innerKey ? innerKey() : ""}-bk${m.userData.bakeOn ? 1 : 0}${m.userData.bakeNeutral ? "n" : ""}`;
    m.userData.bakeOn = true;
    m.userData.bakeU = U;
    m.needsUpdate = true;
  };

  return {
    set,
    apply(root) {
      root.traverse((o: any) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) patch(m);
      });
    },
    setTod: (t) => load(t),
    setLight(color, intensity) { light.color.copy(color); light.intensity = intensity; refresh(); },
    setStrength(s) { Object.assign(st, s); refresh(); },
    dispose() {
      token++;
      U.uBkOn.value = 0;
      patched.forEach((m) => { m.userData.bakeOn = false; m.needsUpdate = true; });
      patched.clear();
      for (const tx of textures.splice(0)) tx.dispose();
    },
  };
}
