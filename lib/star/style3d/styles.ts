/**
 * STYLE TESTING — the five art styles Harry shortlisted (9 Oct 2026), plus
 * "Mix" (H for play, A for cut scenes, one warm grade across both).
 *
 * A style is only DATA here: sky, sun, lights, haze, which material family the
 * stadium is built from, people's outline, and the post-process numbers
 * (post.ts). kit.ts turns it into a picture. Nothing here touches the 2D game.
 *
 *   golden  A  Golden Hour Matchday — painted, warm, soft toon bands, thin coloured lines, haze, grain
 *   ink     B  Floodlight Ink — night, floodlights, bold ink lines, halftone dots, rain
 *   pixel   D  Pixel Matchday — low-res render, nearest upscale, limited palette
 *   strikers S Strikers — toy-like glossy chunky men, rusted steel arena, electric cage, smoky
 *              orange-vs-teal light, lightning, glowing goal frames (our own take: no game's
 *              characters, names or logos)
 *   anime      Anime — a normal daytime match; the PLAYERS are cel-shaded with clean outlines,
 *              animate on twos in cut scenes, and get an aura, speed lines and impact frames on the
 *              big moments, plus an eyes close-up in the goal cut scene (our own characters)
 *   real    H  Console Realism — PBR, ACES, strong sun, mown stripes, bloom
 *   mix        H in gameplay, A in cut scenes, the same warm sky/grade on both
 */
export type StyleId = "golden" | "ink" | "pixel" | "strikers" | "anime" | "real" | "mix";
export type SceneKind = "play" | "cut";

export const STYLE_CHIPS: { id: StyleId; label: string; name: string }[] = [
  { id: "golden", label: "A", name: "Golden Hour" },
  { id: "ink", label: "B", name: "Floodlight Ink" },
  { id: "pixel", label: "D", name: "Pixel" },
  { id: "strikers", label: "S", name: "Strikers" },
  { id: "anime", label: "Anime", name: "Anime" },
  { id: "real", label: "H", name: "Console Real" },
  { id: "mix", label: "Mix", name: "H play · A cut scenes" },
];

type RGB = [number, number, number];

export interface PostLook {
  /** Depth-edge outlines: strength 0..1, colour, width in render pixels. */
  edge: number; edgeColor: string; edgeWidth: number;
  /** Cel bands: how many, and how much (0 = off). */
  posterize: number; posterMix: number;
  /** Comic dots in the darker tones (0 = off). */
  halftone: number;
  grain: number;
  /** Glow round bright things. */
  bloom: number; bloomThresh: number;
  sat: number; contrast: number;
  /** Multiply, then add (the colour grade). */
  tint: RGB; lift: RGB;
  vignette: number;
  /** Render pixel size in CSS px (0 = full resolution). */
  pixel: number;
  /** Colour levels per channel after the pixel pass (0 = off), and ordered dither 0..1. */
  palette: number; dither: number;
  exposure: number;
}

export interface StyleDef {
  id: string;
  sky: { top: string; mid: string; horizon: string; ground: string; sun: string; sunSize: number; sunGlow: number; clouds: number; cloud: string; stars: number };
  /** Towards the sun (x, y up, z towards the camera's side of the pitch). */
  sunDir: RGB;
  sun: { color: string; intensity: number };
  hemi: { sky: string; ground: string; intensity: number };
  fog: { color: string; near: number; far: number };
  /** The stadium's materials: toon bands, plain lambert or PBR. */
  mat: "toon" | "lambert" | "pbr";
  toonSteps: number;
  personOutline: boolean; outlineColor: string;
  floodlights: boolean; floodOn: boolean; rain: boolean;
  backdrop: "city" | "none";
  /** Strikers: the metal cage round the pitch with glowing electric edges. */
  cage?: { glow: string; crackle: boolean };
  /** Scuffed bald patches on the grass. */
  worn?: boolean;
  /** A coloured light from behind the action (rim light). */
  rim?: { color: string; intensity: number };
  /** Two side lights in their own colours (Strikers: warm orange one side, cold teal the other). */
  floodColors?: [string, string];
  /** Floodlight colour (else a cool white). */
  floodColor?: string;
  /** Lightning now and then in the sky. */
  lightning?: boolean;
  /** Men a touch wider than life (chunky). 1 = as built. */
  chunky?: number;
  /** An electric glow round the ball when it flies hard. */
  ballSparks?: string;
  /** Goal cut scene: speed lines on the big moments (Anime). */
  burst?: string;
  /** Toy-like glossy people (Strikers). */
  glossy?: boolean;
  /** Rust-streaked steel stands (Strikers). */
  rusty?: boolean;
  /** Big chunky glowing goal frames, this colour (Strikers). */
  goalGlow?: string;
  /** A glowing aura round the scorer on the big moments (Anime). */
  aura?: string;
  /** Impact frames: a hard black-and-white flash on the strike (Anime). */
  impact?: boolean;
  /** Cel shading on the people only (Anime): hard light bands on the body shader. */
  celPeople?: boolean;
  /** Cut scenes: clips stepped to this many poses a second (anime "on twos"). 0 = smooth. */
  stepped?: number;
  grass: [string, string];
  /** Outside the pitch (the run-off). */
  apron: string;
  stand: string; roof: string;
  crowd: string[];
  /** Bigger ball on the fixed camera (the 2D game draws it big for the same reason). */
  ballScale: number;
  confetti: boolean;
  post: PostLook;
}

const POST0: PostLook = {
  edge: 0, edgeColor: "#000000", edgeWidth: 1, posterize: 0, posterMix: 0, halftone: 0, grain: 0,
  bloom: 0, bloomThresh: 1, sat: 1, contrast: 1, tint: [1, 1, 1], lift: [0, 0, 0], vignette: 0,
  pixel: 0, palette: 0, dither: 0, exposure: 1,
};

const CROWD_MIX = ["#c0392b", "#e74c3c", "#f5f5f5", "#2c3e50", "#2563eb", "#1e3a8a", "#d4a017", "#7f1d1d", "#111827", "#9ca3af"];

export const STYLES: Record<Exclude<StyleId, "mix">, StyleDef> = {
  golden: {
    id: "golden",
    sky: { top: "#5d7fb8", mid: "#e7a978", horizon: "#ffcf8a", ground: "#7a5a3a", sun: "#fff1c4", sunSize: 0.012, sunGlow: 1.2, clouds: 0.75, cloud: "#f39a7a", stars: 0 },
    sunDir: [0.42, 0.16, -0.89],
    sun: { color: "#ffb36b", intensity: 3.0 },
    hemi: { sky: "#ffd7a6", ground: "#6b5a32", intensity: 1.05 },
    fog: { color: "#f2b98a", near: 70, far: 230 },
    mat: "toon", toonSteps: 3,
    personOutline: true, outlineColor: "#3b2416",
    floodlights: true, floodOn: false, rain: false,
    backdrop: "city",
    grass: ["#58a63a", "#66b445"], apron: "#4f8f35",
    stand: "#8a6a55", roof: "#5b4a44",
    crowd: ["#c2412d", "#e0703f", "#f2d7b0", "#3d5a80", "#7a3b2e", "#f4a259", "#5a3d5c", "#e9c46a"],
    ballScale: 1.7, confetti: true,
    post: { ...POST0, edge: 0.55, edgeColor: "#4a2a18", edgeWidth: 1, posterize: 4, posterMix: 0.45, grain: 0.05, bloom: 0.55, bloomThresh: 0.8, sat: 1.08, contrast: 1.02, tint: [1.06, 0.99, 0.9], lift: [0.03, 0.015, 0], vignette: 0.3, exposure: 1.4 },
  },
  ink: {
    id: "ink",
    sky: { top: "#04070f", mid: "#0b1630", horizon: "#1d2d52", ground: "#05070a", sun: "#000000", sunSize: 0, sunGlow: 0, clouds: 0.25, cloud: "#26365c", stars: 0.5 },
    sunDir: [-0.3, 0.85, 0.25],
    sun: { color: "#dbe8ff", intensity: 2.6 },
    hemi: { sky: "#5c7aa8", ground: "#0b1408", intensity: 0.55 },
    fog: { color: "#0c1426", near: 60, far: 200 },
    mat: "toon", toonSteps: 2,
    personOutline: true, outlineColor: "#000000",
    floodlights: true, floodOn: true, rain: true,
    backdrop: "none",
    grass: ["#2f6a2a", "#387a31"], apron: "#1d3d1a",
    stand: "#273042", roof: "#141a26",
    crowd: CROWD_MIX,
    ballScale: 1.7, confetti: false,
    post: { ...POST0, edge: 1, edgeColor: "#000000", edgeWidth: 1.6, posterize: 3, posterMix: 0.35, halftone: 0.6, grain: 0.03, bloom: 0.9, bloomThresh: 0.75, sat: 1.2, contrast: 1.25, tint: [0.95, 1, 1.08], lift: [0, 0, 0.01], vignette: 0.55, exposure: 1.15 },
  },
  pixel: {
    id: "pixel",
    sky: { top: "#2d2a7a", mid: "#9a4fa8", horizon: "#ff9a5a", ground: "#2a2240", sun: "#ffe08a", sunSize: 0.02, sunGlow: 0.6, clouds: 0.6, cloud: "#d86a8a", stars: 0 },
    sunDir: [0.2, 0.35, -0.92],
    sun: { color: "#fff0d0", intensity: 2.6 },
    hemi: { sky: "#cfe0ff", ground: "#3a5a2a", intensity: 1.2 },
    fog: { color: "#c07aa0", near: 120, far: 300 },
    mat: "toon", toonSteps: 4,
    personOutline: false, outlineColor: "#000000",
    floodlights: true, floodOn: true, rain: false,
    backdrop: "city",
    grass: ["#3f9a35", "#4cae3f"], apron: "#327d2b",
    stand: "#3a3a5a", roof: "#262640",
    crowd: CROWD_MIX,
    ballScale: 1.9, confetti: true,
    post: { ...POST0, edge: 0.6, edgeColor: "#14121e", edgeWidth: 1, sat: 1.08, contrast: 1.05, pixel: 3, palette: 7, dither: 0.6, exposure: 0.92 },
  },
  strikers: {
    id: "strikers",
    // smoky dusk, warm orange against cold teal; rusted steel; toy-like glossy men
    sky: { top: "#0f1a22", mid: "#3a3238", horizon: "#d8743a", ground: "#140f0c", sun: "#ffb060", sunSize: 0.01, sunGlow: 1.1, clouds: 1, cloud: "#2c2a30", stars: 0 },
    sunDir: [0.3, 0.18, -0.94],
    sun: { color: "#ff9d55", intensity: 2.6 },
    hemi: { sky: "#5a8a94", ground: "#2a1e14", intensity: 0.7 },
    fog: { color: "#4a3a34", near: 60, far: 210 },
    mat: "pbr", toonSteps: 0,
    personOutline: false, outlineColor: "#000000",
    floodlights: true, floodOn: true, rain: false,
    backdrop: "city",
    grass: ["#2f7a2c", "#388634"], apron: "#2a2620",
    stand: "#6b3f26", roof: "#2e2a2a",
    crowd: ["#3a3a44", "#5a4a40", "#e07a3a", "#2a6a7a", "#1e1e24", "#8a8a90", "#b04a2a"],
    ballScale: 1.9, confetti: false,
    cage: { glow: "#3fe0d0", crackle: true },
    worn: true,
    rim: { color: "#4fd6e0", intensity: 3.0 },
    floodColor: "#ffd2a0",
    floodColors: ["#ff8a3a", "#36d0d8"],
    lightning: true,
    chunky: 1.18,
    glossy: true,
    rusty: true,
    goalGlow: "#ffb347",
    ballSparks: "#7af0ff",
    post: { ...POST0, edge: 0.25, edgeColor: "#1a120c", edgeWidth: 1, bloom: 0.7, bloomThresh: 0.9, sat: 1.1, contrast: 1.15, tint: [1.03, 0.98, 0.96], lift: [0.01, 0.008, 0.01], vignette: 0.55, grain: 0.03, exposure: 1.05 },
  },
  anime: {
    id: "anime",
    // the world stays a normal daytime match; only the PLAYERS are anime: cel-shaded with clean
    // outlines, stepped (on-twos) animation in cut scenes, an aura, speed lines and impact frames
    // on the big moments
    sky: { top: "#3a74c8", mid: "#8fbbe6", horizon: "#e1ecf2", ground: "#4a4a40", sun: "#fffaf0", sunSize: 0.006, sunGlow: 0.4, clouds: 0.35, cloud: "#ffffff", stars: 0 },
    sunDir: [0.5, 0.65, -0.57],
    sun: { color: "#fff6e8", intensity: 3.2 },
    hemi: { sky: "#d2e4ff", ground: "#4a5a30", intensity: 0.85 },
    fog: { color: "#c9d8e4", near: 110, far: 320 },
    mat: "pbr", toonSteps: 0,
    personOutline: true, outlineColor: "#10131c",
    floodlights: true, floodOn: false, rain: false,
    backdrop: "city",
    grass: ["#3f8a2e", "#4b983a"], apron: "#3a6f29",
    stand: "#4b525c", roof: "#2c3138",
    crowd: ["#c0392b", "#e74c3c", "#f5f5f5", "#2c3e50", "#2563eb", "#1e3a8a", "#d4a017", "#111827"],
    ballScale: 1.8, confetti: false,
    celPeople: true,
    ballSparks: "#9cd0ff",
    burst: "#ffffff",
    aura: "#3b8cff",
    impact: true,
    stepped: 12,
    post: { ...POST0, bloom: 0.3, bloomThresh: 0.9, sat: 1.12, contrast: 1.08, vignette: 0.25, exposure: 1.05 },
  },
  real: {
    id: "real",
    sky: { top: "#3a6fb5", mid: "#8fb6dc", horizon: "#dce7ee", ground: "#4a4a40", sun: "#fffaf0", sunSize: 0.006, sunGlow: 0.4, clouds: 0.3, cloud: "#ffffff", stars: 0 },
    sunDir: [0.55, 0.62, -0.56],
    sun: { color: "#fff4e2", intensity: 3.4 },
    hemi: { sky: "#cfe2ff", ground: "#4a5a30", intensity: 0.75 },
    fog: { color: "#c7d6e2", near: 110, far: 320 },
    mat: "pbr", toonSteps: 0,
    personOutline: false, outlineColor: "#000000",
    floodlights: true, floodOn: false, rain: false,
    backdrop: "city",
    grass: ["#3f7d2c", "#4f9238"], apron: "#3a6f29",
    stand: "#4b525c", roof: "#2c3138",
    crowd: CROWD_MIX,
    ballScale: 1.8, confetti: false,
    post: { ...POST0, bloom: 0.35, bloomThresh: 0.9, sat: 1.05, contrast: 1.06, vignette: 0.28, grain: 0.012, exposure: 1.05 },
  },
};

/**
 * Mix: the same late-afternoon sky, sun and warm grade under both looks, so a
 * cut from play into a cut scene is the same evening, drawn two ways.
 */
const MIX_SKY: StyleDef["sky"] = { top: "#4f78b0", mid: "#d9a985", horizon: "#ffd6a0", ground: "#6a5a40", sun: "#fff3d6", sunSize: 0.01, sunGlow: 0.9, clouds: 0.5, cloud: "#f2b08a", stars: 0 };
const MIX_SUN = { color: "#ffc68a", intensity: 3.2 };
const MIX_DIR: RGB = [0.5, 0.45, -0.74];
const MIX_TINT: RGB = [1.06, 0.99, 0.9];

export function resolveStyle(id: StyleId, kind: SceneKind): StyleDef {
  if (id !== "mix") return STYLES[id];
  if (kind === "play") {
    const r = STYLES.real;
    return {
      ...r, id: "mix-play", sky: MIX_SKY, sun: MIX_SUN, sunDir: MIX_DIR,
      hemi: { sky: "#ffe6c8", ground: "#55603a", intensity: 1.0 },
      fog: { color: "#e8c9a6", near: 110, far: 320 },
      post: { ...r.post, tint: MIX_TINT, lift: [0.015, 0.008, 0], bloom: 0.45, sat: 1.08, exposure: 1.45 },
    };
  }
  const g = STYLES.golden;
  return { ...g, id: "mix-cut", sky: MIX_SKY, sun: MIX_SUN, sunDir: MIX_DIR, post: { ...g.post, tint: MIX_TINT } };
}
