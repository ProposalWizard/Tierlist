/**
 * MOOD PRESETS — time of day and feeling, laid over the chosen art style.
 *
 * Look A (golden) is the house style for cut scenes. A mood swaps its sky,
 * sun, fill, haze and grade (golden hour, floodlit night, overcast, a warm
 * room …) and keeps everything else (toon bands, the painted lines, grain).
 * Other styles keep their own sky: a mood only nudges exposure and the grade.
 */
import type { StyleDef } from "../../style3d/styles";
import type { MoodId } from "../types";

type Patch = Partial<Pick<StyleDef, "sky" | "sunDir" | "sun" | "hemi" | "fog" | "floodOn" | "rain">> & { post?: Partial<StyleDef["post"]> };

export interface MoodPreset {
  id: MoodId;
  name: string;
  /** Laid over look A. */
  patch: Patch;
  /** For any other look: exposure and grade only. */
  light: { exposure: number; tint: [number, number, number] };
  /** The interior lamps: how bright, what colour (locations3d reads these). */
  lamps: { intensity: number; color: string };
}

export const MOODS: Record<MoodId, MoodPreset> = {
  "golden-hour": {
    id: "golden-hour", name: "Golden hour",
    patch: {},
    light: { exposure: 1, tint: [1.06, 0.99, 0.9] },
    lamps: { intensity: 1, color: "#ffc98a" },
  },
  dawn: {
    id: "dawn", name: "Dawn",
    patch: {
      sky: { top: "#6d86b8", mid: "#e9b7a6", horizon: "#ffd9b8", ground: "#5a5048", sun: "#fff3dc", sunSize: 0.01, sunGlow: 0.9, clouds: 0.55, cloud: "#f6c0b0", stars: 0 },
      sun: { color: "#ffd2a6", intensity: 2.4 },
      hemi: { sky: "#ffe2d2", ground: "#5a5a48", intensity: 1.0 },
      fog: { color: "#f0cbb8", near: 60, far: 220 },
      post: { tint: [1.03, 0.98, 0.97] },
    },
    light: { exposure: 1.0, tint: [1.02, 0.98, 0.98] },
    lamps: { intensity: 0.6, color: "#ffd9b0" },
  },
  overcast: {
    id: "overcast", name: "Overcast",
    patch: {
      sky: { top: "#8796a8", mid: "#aab4c0", horizon: "#c9cfd6", ground: "#5a5a54", sun: "#ffffff", sunSize: 0, sunGlow: 0.15, clouds: 1, cloud: "#9aa3ae", stars: 0 },
      sunDir: [0.3, 0.7, -0.6],
      sun: { color: "#e8ecf2", intensity: 1.4 },
      hemi: { sky: "#d4dbe4", ground: "#4a5040", intensity: 1.35 },
      fog: { color: "#b9c1ca", near: 50, far: 200 },
      post: { tint: [0.98, 1.0, 1.03], sat: 0.92 },
    },
    light: { exposure: 0.95, tint: [0.98, 1, 1.03] },
    lamps: { intensity: 0.8, color: "#fff0d8" },
  },
  "floodlit-night": {
    id: "floodlit-night", name: "Floodlit night",
    patch: {
      sky: { top: "#05080f", mid: "#0d1830", horizon: "#25365c", ground: "#05070a", sun: "#000000", sunSize: 0, sunGlow: 0, clouds: 0.2, cloud: "#26365c", stars: 0.45 },
      sunDir: [-0.3, 0.85, 0.25],
      sun: { color: "#dbe8ff", intensity: 2.2 },
      hemi: { sky: "#6c88b8", ground: "#0b1408", intensity: 0.65 },
      fog: { color: "#0c1426", near: 60, far: 200 },
      floodOn: true,
      post: { tint: [0.96, 1.0, 1.08], lift: [0, 0, 0.01], exposure: 1.25 },
    },
    light: { exposure: 1.0, tint: [0.96, 1, 1.08] },
    lamps: { intensity: 1.2, color: "#fff0d8" },
  },
  "rain-night": {
    id: "rain-night", name: "Rain at night",
    patch: {
      sky: { top: "#04070d", mid: "#0b1424", horizon: "#1c2838", ground: "#05070a", sun: "#000000", sunSize: 0, sunGlow: 0, clouds: 0.9, cloud: "#1d2838", stars: 0 },
      sunDir: [-0.3, 0.85, 0.25],
      sun: { color: "#cfdcf0", intensity: 1.8 },
      hemi: { sky: "#58708f", ground: "#0b1408", intensity: 0.6 },
      fog: { color: "#0e1622", near: 30, far: 140 },
      floodOn: true, rain: true,
      post: { tint: [0.94, 0.99, 1.08], sat: 0.85, exposure: 1.25 },
    },
    light: { exposure: 0.95, tint: [0.94, 0.99, 1.08] },
    lamps: { intensity: 1, color: "#ffe6c0" },
  },
  "interior-warm": {
    id: "interior-warm", name: "A warm room",
    patch: {
      sun: { color: "#ffb36b", intensity: 1.6 },
      hemi: { sky: "#ffd9b0", ground: "#5a4030", intensity: 1.15 },
      fog: { color: "#3a2a20", near: 40, far: 140 },
    },
    light: { exposure: 1.05, tint: [1.06, 0.99, 0.9] },
    lamps: { intensity: 1.5, color: "#ffc98a" },
  },
  "interior-cool": {
    id: "interior-cool", name: "A bright room",
    patch: {
      sun: { color: "#ffd8a8", intensity: 1.4 },
      hemi: { sky: "#e8ecf6", ground: "#4a4a50", intensity: 1.3 },
      fog: { color: "#20242c", near: 40, far: 140 },
      post: { tint: [1.03, 1.0, 0.96] },
    },
    light: { exposure: 1.05, tint: [1.0, 1.0, 1.0] },
    lamps: { intensity: 1.4, color: "#fff2dc" },
  },
  spotlight: {
    id: "spotlight", name: "Spotlights",
    patch: {
      sky: { top: "#05060a", mid: "#0a0b12", horizon: "#12131c", ground: "#05060a", sun: "#000000", sunSize: 0, sunGlow: 0, clouds: 0, cloud: "#000000", stars: 0 },
      sunDir: [0.2, 0.9, 0.4],
      sun: { color: "#ffe6c0", intensity: 0.8 },
      hemi: { sky: "#6a5a7a", ground: "#100c14", intensity: 0.45 },
      fog: { color: "#08070c", near: 18, far: 60 },
      post: { tint: [1.04, 0.98, 1.0], bloom: 0.75, bloomThresh: 0.75, exposure: 1.35 },
    },
    light: { exposure: 1.0, tint: [1.04, 0.98, 1.0] },
    lamps: { intensity: 2.2, color: "#ffe2b8" },
  },
};

/** The style with the mood laid over it. */
export function applyMood(def: StyleDef, mood: MoodId): StyleDef {
  const m = MOODS[mood] ?? MOODS["golden-hour"];
  const isA = def.id === "golden" || def.id === "mix-cut";
  if (isA) {
    const { post, ...rest } = m.patch;
    return { ...def, ...rest, id: def.id, post: { ...def.post, ...(post ?? {}) } };
  }
  const t = def.post.tint;
  return { ...def, post: { ...def.post, exposure: def.post.exposure * m.light.exposure, tint: [t[0] * m.light.tint[0], t[1] * m.light.tint[1], t[2] * m.light.tint[2]] } };
}
