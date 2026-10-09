/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOOK H's FILES (public/star/h3d, credits in its LICENSE.txt). Loaded once
 * per page and shared by every scene that wears look H: the gameplay test,
 * the 3D drills, the garden and the shop.
 *
 *   env-{day,golden,night}.hdr   256 × 128 light from a real sky (Poly Haven, CC0),
 *                                turned into image-based light (PMREM) per renderer
 *   sky-{day,golden,night}.webp  the same skies to look at, zenith to 22.5° below the horizon
 *   grass-col / -nrm / -orh      ambientCG Grass004 (CC0): blade detail, normals,
 *                                occlusion · roughness · height
 *   crowd.webp                   a grey-and-white cheering crowd (ours), tinted per club in the shader
 *   led.webp                     the pitch-side LED boards (ours; invented brands only)
 *
 * About 1.3 MB in all, fetched only when a scene wears look H.
 */
export type TimeOfDay = "day" | "golden" | "night";
export const H_BASE = "/star/h3d/";

const cache = new Map<string, Promise<any>>();
const once = <V>(key: string, make: () => Promise<V>): Promise<V> => {
  let p = cache.get(key);
  if (!p) { p = make(); cache.set(key, p); p.catch(() => cache.delete(key)); }
  return p as Promise<V>;
};

/** A colour texture (sRGB), repeat-wrapped. */
export function hTexture(T: any, file: string, o: { srgb?: boolean; repeat?: boolean; aniso?: number } = {}): Promise<any> {
  return once(`tex:${file}:${o.srgb !== false}:${o.repeat !== false}`, () => new Promise((res, rej) => {
    new T.TextureLoader().load(H_BASE + file, (t: any) => {
      t.colorSpace = o.srgb === false ? T.NoColorSpace : T.SRGBColorSpace;
      if (o.repeat !== false) t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = o.aniso ?? 4;
      res(t);
    }, undefined, rej);
  }));
}

/** The raw equirect HDR (shared); PMREM is per renderer, see envFor. */
function hdr(T: any, tod: TimeOfDay): Promise<any> {
  return once(`hdr:${tod}`, async () => {
    const { RGBELoader }: any = await import("three/examples/jsm/loaders/RGBELoader.js");
    const t = await new RGBELoader().loadAsync(H_BASE + `env-${tod}.hdr`);
    t.mapping = T.EquirectangularReflectionMapping;
    return t;
  });
}

/** Start downloading the time of day's light file now (start-up runs it beside the people's files). */
export const preloadHdr = (T: any, tod: TimeOfDay): Promise<any> => hdr(T, tod);

const pmrems = new WeakMap<any, Map<TimeOfDay, Promise<any>>>();
/** Image-based light for this renderer and time of day (a PMREM cube, cached). */
export function envFor(T: any, renderer: any, tod: TimeOfDay): Promise<any> {
  let m = pmrems.get(renderer);
  if (!m) { m = new Map(); pmrems.set(renderer, m); }
  let p = m.get(tod);
  if (!p) {
    p = hdr(T, tod).then((eq) => {
      const gen = new T.PMREMGenerator(renderer);
      const rt = gen.fromEquirectangular(eq);
      gen.dispose();
      return rt.texture;
    });
    m.set(tod, p);
    p.catch(() => m!.delete(tod));
  }
  return p;
}

/** Sky picture brightness (the webp holds sky × k; divide it back out). From meta.json. */
export const SKY_SCALE: Record<TimeOfDay, number> = { day: 4.125, golden: 14, night: 1.1016 };

export interface GrassMaps { col: any; nrm: any; orh: any }
export function grassMaps(T: any): Promise<GrassMaps> {
  return once("grass", async () => {
    const [col, nrm, orh] = await Promise.all([
      hTexture(T, "grass-col.webp"), hTexture(T, "grass-nrm.webp", { srgb: false }), hTexture(T, "grass-orh.webp", { srgb: false }),
    ]);
    return { col, nrm, orh };
  });
}
