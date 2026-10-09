/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PACKED PICTURES (9 Oct 2026, lag pass 2). The big 3D colour maps (crowd,
 * skies, grass, the garden's bark / leaves / paving, the shop's floors) have
 * a KTX2 copy beside their WebP (scripts/perf3d/ktx2-textures.mjs). A WebP is
 * unpacked to full RGBA on the graphics chip; the KTX2 stays packed there
 * (ASTC / ETC2 / BC on the chip: ~4× less picture memory, and less memory
 * traffic per pixel drawn).
 *
 * `loadPicture3d(url, fallback)` tries `<name>.ktx2` (only for the files
 * in KTX2_FILES) and falls
 * back to the plain loader on ANY failure: no transcoder, no file, a chip
 * that can't take it, a decode error. Off: ?ktx2=0 or window.__ktx2Off.
 * The transcoder (three's own) is served from /star/three/basis/.
 */
import type * as THREE from "three";

/** The pictures that have a .ktx2 copy (paths under /star/; scripts/perf3d/ktx2-textures.mjs makes them). */
export const KTX2_FILES = new Set([
  "h3d/crowd.webp", "h3d/sky-day.webp", "h3d/sky-golden.webp", "h3d/sky-night.webp", "h3d/grass-col.webp",
  "garden3d/h/bark.webp", "garden3d/h/leaves.webp", "garden3d/h/needles.webp", "garden3d/h/paving.webp", "garden3d/h/straw.webp", "garden3d/h/blooms.webp",
  "shop3d/h/parquet.webp", "shop3d/h/planks.webp",
]);
export const TRANSCODER_PATH = "/star/three/basis/";

export function ktx2Off(): boolean {
  if (typeof window === "undefined") return true;
  if ((window as any).__ktx2Off) return true;
  try { return new URLSearchParams(window.location.search).get("ktx2") === "0"; } catch { return false; }
}

let renderer: THREE.WebGLRenderer | null = null;
let loader: Promise<any> | null = null;
let broken = false;

/** Name the renderer the packed pictures will be drawn by (optional: the chip is asked directly otherwise). */
export function useKtx2With(r: THREE.WebGLRenderer) {
  if (renderer) return;
  renderer = r;
}

/** The .ktx2 path for a picture URL, or null when it has none. */
export function ktx2UrlFor(url: string): string | null {
  const i = url.indexOf("/star/");
  if (i < 0) return null;
  const rel = url.slice(i + 6).split("?")[0];
  return KTX2_FILES.has(rel) ? url.slice(0, i + 6) + rel.replace(/\.(webp|png|jpe?g)$/i, ".ktx2") : null;
}

/**
 * What the chip can hold packed. From the named renderer, else asked once of
 * a throwaway WebGL2 context (pictures preload before a scene's renderer
 * exists); the answer is the chip's, the same for every context on the page.
 */
let probed: { extensions: { has(n: string): boolean } } | null = null;
function chip(): { extensions: { has(n: string): boolean } } | null {
  if (renderer) return renderer as any;
  if (probed) return probed;
  if (typeof document === "undefined") return null;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return null;
    const ext = new Set(gl.getSupportedExtensions() ?? []);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    probed = { extensions: { has: (n: string) => ext.has(n) } };
    return probed;
  } catch { return null; }
}

function getLoader(): Promise<any> | null {
  if (broken) return null;
  if (!loader) {
    const r = chip();
    if (!r) return null;
    loader = import("three/examples/jsm/loaders/KTX2Loader.js").then(({ KTX2Loader }) => {
      const l = new KTX2Loader();
      l.setTranscoderPath(TRANSCODER_PATH);
      l.detectSupport(r as any);
      return l;
    });
    loader.catch(() => { broken = true; loader = null; });
  }
  return loader;
}

/**
 * A picture for a 3D scene: the packed copy when there is one and it loads,
 * else `fallback()` (the scene's own loader, exactly as before). The packed
 * texture keeps the plain one's orientation (the file is stored bottom row
 * first) and its own mipmaps.
 */
export async function loadPicture3d<Tex>(url: string, fallback: () => Promise<Tex>): Promise<Tex> {
  const k = ktx2Off() ? null : ktx2UrlFor(url);
  const lp = k ? getLoader() : null;
  if (!k || !lp) return fallback();
  try {
    const l = await lp;
    const t = await l.loadAsync(k);
    t.userData.ktx2 = true;
    return t as Tex;
  } catch {
    return fallback();
  }
}

/**
 * The shared KTX2 loader for a GLTFLoader's packed models (the shop's items:
 * tools/shop3d/ktx2_items.mjs), or null when the phone can't read them or
 * KTX2 is off (?ktx2=0) — the caller then loads the plain model. Speed job B.
 */
export async function ktx2LoaderForModels(r: THREE.WebGLRenderer): Promise<any | null> {
  if (ktx2Off()) return null;
  useKtx2With(r);
  const lp = getLoader();
  if (!lp) return null;
  try { return await lp; } catch { return null; }
}

/**
 * PACKED PEOPLE (lag pass 4, 9 Oct 2026). These models have a `<name>.ktx2.glb`
 * twin (scripts/perf3d/ktx2-models.mjs) whose pictures stay packed on the chip:
 * a one body 11 → ~2.8 MB, the human ~50 → ~13 MB. Nothing reads their pixels.
 * NOT the Style A heads: packed, their skin read a shade grey-blue on a still
 * pair (the toon shader reads skin and hair off the map), and the careful
 * packing (UASTC) made each head 220 → 920 KB to download. Not the Star Pass
 * glasses yet: no still of them was checked.
 * Keep in step with MODELS in that script. Off: ?ktx2=0.
 */
export const KTX2_MODELS = new Set([
  ...["player", "player-buzz", "player-long", "manager"].map((n) => `onebody/${n}.glb`),
  "human3d/human.glb",
]);

/** The packed twin's address for a model with one, when this phone can read it; else null. */
export function ktx2ModelUrl(url: string): string | null {
  if (ktx2Off()) return null;
  const i = url.indexOf("/star/");
  if (i < 0) return null;
  const rel = url.slice(i + 6).split("?")[0];
  if (!KTX2_MODELS.has(rel) || !chip()) return null;
  return url.slice(0, i + 6) + rel.replace(/\.glb$/, ".ktx2.glb");
}

/**
 * Load a model, its packed twin first when it has one (KTX2_MODELS) and the
 * phone reads KTX2, the plain file on ANY failure. `load` is the caller's own
 * loading (loadGltfCached, loadAsync): it gets the same loader, now able to
 * read packed pictures.
 */
export async function loadModel3d<G>(
  loader: { setKTX2Loader?: (l: any) => unknown },
  url: string,
  load: (url: string) => Promise<G>,
): Promise<G> {
  const twin = ktx2ModelUrl(url);
  const lp = twin ? getLoader() : null;
  if (!twin || !lp || !loader.setKTX2Loader) return load(url);
  try {
    loader.setKTX2Loader(await lp);
    return await load(twin);
  } catch {
    return load(url);
  }
}
