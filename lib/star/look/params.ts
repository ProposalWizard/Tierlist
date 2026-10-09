/**
 * LOOK H's DIALS — the numbers the look-tuner turns (scripts/look-tuner).
 *
 * Every dial is a multiple of what lib/star/style3d/real/tod.ts already sets
 * (1 = as it was), except the four that are new with this round:
 *   lut     how much of the broadcast colour grade (a 3D LUT) is laid on, 0..1
 *   ao      how much the baked open-sky shade darkens the sky's light, 0..1
 *   shade   how much the baked sun shadow darkens the sun, 0..1
 *   bounce  the light thrown back off the stands, a multiple of the bake
 *   grassWarm  shifts the grass towards yellow (+) or blue (−)
 *
 * The tuner's winners live in ./tuned.ts (written by the tuner, one block
 * per time of day). On a dev build the tuner can also set dials live through
 * window.__lookTune (never on the live site).
 */
import type { TimeOfDay } from "../style3d/real/assets";
import { TUNED } from "./tuned";

export interface LookParams {
  exposure: number; contrast: number; sat: number; bloom: number; vignette: number;
  sun: number; env: number; hemi: number; rim: number;
  grassGain: number; grassWarm: number;
  lut: number; ao: number; shade: number; bounce: number;
  /** A multiple of the broadcast pass's sharpening (blade texture, crisp lines). */
  sharpen: number;
  /** The pitch's blade detail and mowing-stripe strength, multiples of the pitch as built. */
  blades: number; stripes: number;
}

export const LOOK_NEUTRAL: LookParams = {
  exposure: 1, contrast: 1, sat: 1, bloom: 1, vignette: 1,
  sun: 1, env: 1, hemi: 1, rim: 1,
  grassGain: 1, grassWarm: 0,
  lut: 0, ao: 0, shade: 0, bounce: 0, sharpen: 1, blades: 1, stripes: 1,
};

/** The new parts switched on at full strength, before any tuning. */
// rim 1.8: the 9 Oct review asked for players to "pop off the pitch" with an edge light. The tuner never
// turns it (its score looks at the picture's colours, not at the players), so it is set here by eye.
// sharpen 1.6: the same review asked for visible blade texture.
// blades 1.8 / stripes 1.4: the same review ("visible blade texture and strong mowing stripes").
const BASE: LookParams = { ...LOOK_NEUTRAL, lut: 1, ao: 1, shade: 1, bounce: 1, rim: 1.8, sharpen: 1.6, blades: 1.8, stripes: 1.4 };

/** Each dial's safe range (the tuner never leaves it). */
export const LOOK_RANGES: Record<keyof LookParams, [number, number]> = {
  exposure: [0.7, 1.4], contrast: [0.9, 1.25], sat: [0.75, 1.3], bloom: [0, 2.5], vignette: [0, 2.5],
  sun: [0.6, 1.5], env: [0.5, 1.8], hemi: [0, 2.5], rim: [1.4, 3],
  grassGain: [0.6, 1.4], grassWarm: [-0.3, 0.3],
  lut: [0, 1], ao: [0, 1], shade: [0, 1], bounce: [0, 3], sharpen: [0.5, 3], blades: [1, 3], stripes: [1, 2.5],
};

interface TuneHook { params?: Partial<LookParams>; version?: number; redraw?: () => void }
export function lookTuneHook(): TuneHook | null {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return null;
  return ((window as unknown as { __lookTune?: TuneHook }).__lookTune) ?? null;
}

/** The dials for a time of day: base ← the tuner's winners ← (dev only) a live override. */
export function lookParams(tod: TimeOfDay): LookParams {
  const live = lookTuneHook()?.params ?? {};
  return { ...BASE, ...(TUNED[tod] ?? {}), ...live };
}

/** Changes whenever the tuner sets new dials (so a scene knows to re-light). */
export function lookVersion(): number {
  return lookTuneHook()?.version ?? 0;
}

/** Grass colours with the grass dials applied. */
export function tuneGrass(hex: string, p: LookParams): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r *= p.grassGain * (1 + p.grassWarm * 0.6); g *= p.grassGain * (1 + p.grassWarm * 0.15); b *= p.grassGain * (1 - p.grassWarm * 0.8);
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** The broadcast colour grade for a time of day (a 32³ LUT as a 1024 × 32 strip, tools/look/build_lut.py). */
const lutCache = new Map<string, Promise<unknown>>();
export function lookLut(T: any, tod: TimeOfDay): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let p = lutCache.get(tod);
  if (!p) {
    p = new Promise((res) => {
      new T.TextureLoader().load(`/star/look/lut-${tod}.png`, (t: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        t.colorSpace = T.NoColorSpace; t.flipY = false; t.generateMipmaps = false;
        t.minFilter = t.magFilter = T.LinearFilter; t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
        t.needsUpdate = true;
        res(t);
      }, undefined, () => res(null));
    });
    lutCache.set(tod, p);
  }
  return p;
}
