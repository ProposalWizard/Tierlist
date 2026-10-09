/**
 * LOOK H's THREE TIMES OF DAY — data only (no three.js).
 *
 *   day     a bright afternoon: high sun from the west stand's side, so its
 *           shadow lies along the left touchline (the TV picture everyone knows)
 *   golden  the low warm sun of a late kick-off, long soft light, a pink sky
 *   night   floodlights: four lamp banks on the roof corners, each with its
 *           own soft shadow (the four-way shadow star), light shafts, a
 *           damp sheen on the grass, glow round every lamp
 */
import type { TimeOfDay } from "./assets";

type V3 = [number, number, number];

export interface TodLook {
  /** Towards the sun (x, y up, z towards the camera's end). */
  sunDir: V3;
  sunColor: string;
  sunIntensity: number;
  /** Image-based light strength (the real sky round the stadium). */
  env: number;
  /** A weak fill from above (keeps faces out of black). */
  hemi: { sky: string; ground: string; intensity: number };
  /** The sky picture's brightness on screen, and a sun disc/glow drawn over it. */
  sky: number; sunDisc: number;
  fog: { color: string; near: number; far: number };
  /** Grass: 0 dry, 1 wet (lower roughness, sheen from the lights). */
  wet: number;
  grass: [string, string];
  floods: boolean;
  /** The colour grade after ACES. */
  exposure: number; contrast: number; sat: number;
  tint: V3; lift: V3;
  /** Glow on bright things. */
  bloom: number; bloomThresh: number;
  vignette: number;
}

export const TODS: Record<TimeOfDay, TodLook> = {
  day: {
    sunDir: [-0.6, 0.64, -0.48], sunColor: "#fff1dc", sunIntensity: 3.1,
    env: 0.85, hemi: { sky: "#dbe9ff", ground: "#47602f", intensity: 0.25 },
    sky: 1.0, sunDisc: 0.6,
    fog: { color: "#c9d6e2", near: 170, far: 650 },
    wet: 0.1, grass: ["#2d5c21", "#3d752c"], floods: false,
    exposure: 1.0, contrast: 1.08, sat: 1.0, tint: [1.0, 1.0, 0.99], lift: [0.0, 0.004, 0.01],
    bloom: 0.22, bloomThresh: 1.6, vignette: 0.22,
  },
  golden: {
    sunDir: [-0.74, 0.34, -0.58], sunColor: "#ffb36e", sunIntensity: 3.0,
    env: 0.75, hemi: { sky: "#ffd8b0", ground: "#4a4a2a", intensity: 0.22 },
    sky: 1.35, sunDisc: 1.0,
    fog: { color: "#c99a7a", near: 170, far: 650 },
    wet: 0.15, grass: ["#33602a", "#3f6e30"], floods: false,
    exposure: 1.0, contrast: 1.1, sat: 1.1, tint: [1.06, 0.99, 0.9], lift: [0.012, 0.006, 0.0],
    bloom: 0.35, bloomThresh: 1.3, vignette: 0.3,
  },
  night: {
    sunDir: [-0.3, 0.86, -0.4], sunColor: "#e9f1ff", sunIntensity: 0.75,
    env: 0.12, hemi: { sky: "#7088b8", ground: "#14200f", intensity: 0.1 },
    sky: 0.8, sunDisc: 0,
    fog: { color: "#0e1522", near: 120, far: 380 },
    wet: 0.3, grass: ["#2c5f22", "#386d2a"], floods: true,
    exposure: 1.05, contrast: 1.12, sat: 1.08, tint: [0.98, 1.0, 1.03], lift: [0.0, 0.002, 0.006],
    bloom: 0.8, bloomThresh: 1.0, vignette: 0.38,
  },
};
