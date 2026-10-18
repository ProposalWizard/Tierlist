/**
 * VISUAL EFFECTS LAB — candidate pictures for the match's big moments, as
 * editable recipes.
 *
 * Leo, 15 Oct 2026: "good we have sound effect stuff but i mainly meant the
 * visual effects like the graphics stuff u added for game feel for things like
 * kicking the ball, saving, goal etc, I want loads of different unique editable
 * variants."
 *
 * Every candidate is a small recipe: a STYLE (a ring, sparks, a turf puff, a
 * comic burst, confetti…) plus a few dials (size, length, colour, how many…).
 * `drawVfx` paints one recipe at one moment of its life (u = 0 → 1) with a
 * pure function: no state, no timers, no random numbers (feelNoise is a fixed
 * sequence), so a still is the same every time and node can test every one.
 *
 * Two places draw them:
 *   - /star-vfx-lab-dev paints filmstrips (a few moments of each effect) once
 *     per edit, with no animation loop of its own;
 *   - the real match (CanvasMatch's test-only `vfxOverride` prop, mounted only
 *     by EnginePlay on the lab page) draws the picked recipes on real kicks,
 *     saves and goals. The career match never passes it.
 *
 * "Current (match feel)" copies what Settings → Match → Match feel: New draws
 * today (lib/star/matchFeelDraw.ts), so the lab starts from the game.
 * Nothing here changes the game.
 */
import { feelNoise } from "./matchFeel";
import { drawImpactBurst, drawSpeedStreak, drawGloveSpark, drawClang, drawNetBulge } from "./matchFeelDraw";

// ── Events ───────────────────────────────────────────────────────────────

export type VfxEvent =
  | "pass" | "strike" | "trail" | "firstTouch" | "save" | "catch" | "dive"
  | "woodwork" | "net" | "block" | "header" | "nearMiss" | "celebration";

export const VFX_EVENTS: { id: VfxEvent; label: string; emoji: string; about: string }[] = [
  { id: "strike", label: "Hard shot", emoji: "💥", about: "Your boot meets the ball hard (a shot)." },
  { id: "pass", label: "Soft pass", emoji: "👟", about: "A soft kick: a pass, a lay-off, a gentle touch on." },
  { id: "trail", label: "Ball in flight", emoji: "☄️", about: "Drawn behind the ball while it flies." },
  { id: "firstTouch", label: "First touch", emoji: "🦶", about: "A team-mate takes the ball down." },
  { id: "save", label: "Save (parry)", emoji: "🧤", about: "The keeper gets a glove to it and it bounces away." },
  { id: "catch", label: "Catch", emoji: "🤲", about: "The keeper holds it." },
  { id: "dive", label: "Keeper dive", emoji: "🤸", about: "The keeper throws himself at it (any save, or a dive that misses)." },
  { id: "woodwork", label: "Post / bar", emoji: "🥅", about: "The ball hits the frame of the goal." },
  { id: "net", label: "Ball in the net", emoji: "🎯", about: "The ball hits the back of the net." },
  { id: "block", label: "Blocked", emoji: "🛡️", about: "A body gets in the way of the ball." },
  { id: "header", label: "Header", emoji: "🗣️", about: "Anyone heads the ball." },
  { id: "nearMiss", label: "Near miss", emoji: "😬", about: "Just wide or just over." },
  { id: "celebration", label: "Goal moment", emoji: "🎉", about: "The whole screen the moment it is a goal." },
];

// ── Styles and dials ─────────────────────────────────────────────────────

export type VfxStyle =
  | "current" | "none"
  | "ring" | "starburst" | "dust" | "shockArc" | "speedLines" | "chroma" | "comic" | "smear" | "shake"
  | "netRipple" | "confetti" | "lightBurst" | "punchIn" | "slowmo" | "glow" | "shards" | "gloves"
  | "lightning" | "fireworks" | "banner" | "ghosts" | "skid" | "vignette"
  // trails
  | "tStreak" | "tDots" | "tRibbon" | "tComet" | "tGhosts" | "tSparkle" | "tSmoke" | "tNeon" | "tDashes";

export interface VfxParams {
  /** × the base size (a few ball-widths at the ball). */
  size: number;
  /** How long it lasts, ms. */
  durationMs: number;
  /** Brightness / how strong, 0–2. */
  intensity: number;
  color: string;
  color2: string;
  /** How many (sparks, rings, bits of confetti, spikes…). */
  count: number;
  /** How wide it spreads, 0 (a narrow cone) … 1 (all the way round). */
  spread: number;
  /** Camera shake, px. */
  shakePx: number;
  /** Freeze at the moment it happens, ms. */
  hitStopMs: number;
  /** Camera punch-in, 0–0.3 (0.1 = 10% closer). */
  zoom: number;
  /** The word on a comic burst or a banner. */
  text: string;
}

export type VfxNumKey = Exclude<keyof VfxParams, "color" | "color2" | "text">;

export const PARAM_INFO: Record<VfxNumKey, { label: string; min: number; max: number; step: number; unit?: string }> = {
  size: { label: "Size", min: 0.2, max: 3, step: 0.05, unit: "×" },
  durationMs: { label: "Length", min: 80, max: 2500, step: 10, unit: "ms" },
  intensity: { label: "Strength", min: 0, max: 2, step: 0.05 },
  count: { label: "How many", min: 1, max: 60, step: 1 },
  spread: { label: "Spread", min: 0, max: 1, step: 0.02 },
  shakePx: { label: "Camera shake", min: 0, max: 24, step: 0.5, unit: "px" },
  hitStopMs: { label: "Freeze at the hit", min: 0, max: 250, step: 5, unit: "ms" },
  zoom: { label: "Camera punch-in", min: 0, max: 0.3, step: 0.01 },
};
export const NUM_KEYS = Object.keys(PARAM_INFO) as VfxNumKey[];

export const DEFAULT_PARAMS: VfxParams = {
  size: 1, durationMs: 350, intensity: 1, color: "#ffffff", color2: "#fde047",
  count: 8, spread: 1, shakePx: 0, hitStopMs: 0, zoom: 0, text: "",
};

/** Which dials each style listens to (the edit panel shows only these). */
const ALWAYS: (keyof VfxParams)[] = ["durationMs", "shakePx", "hitStopMs", "zoom"];
export const STYLE_PARAMS: Record<VfxStyle, (keyof VfxParams)[]> = {
  current: ["size", "intensity", ...ALWAYS],
  none: [],
  ring: ["size", "intensity", "color", "count", ...ALWAYS],
  starburst: ["size", "intensity", "color", "color2", "count", "spread", ...ALWAYS],
  dust: ["size", "intensity", "color", "color2", "count", ...ALWAYS],
  shockArc: ["size", "intensity", "color", "count", "spread", ...ALWAYS],
  speedLines: ["size", "intensity", "color", "count", "spread", ...ALWAYS],
  chroma: ["size", "intensity", ...ALWAYS],
  comic: ["size", "intensity", "color", "color2", "count", "text", ...ALWAYS],
  smear: ["size", "intensity", "color", "count", ...ALWAYS],
  shake: ["intensity", "color", ...ALWAYS],
  netRipple: ["size", "intensity", "color", "count", ...ALWAYS],
  confetti: ["size", "intensity", "color", "color2", "count", "spread", ...ALWAYS],
  lightBurst: ["size", "intensity", "color", "count", ...ALWAYS],
  punchIn: ["intensity", "color", ...ALWAYS],
  slowmo: ["intensity", "color", ...ALWAYS],
  glow: ["size", "intensity", "color", ...ALWAYS],
  shards: ["size", "intensity", "color", "color2", "count", "spread", ...ALWAYS],
  gloves: ["size", "intensity", "color", "color2", ...ALWAYS],
  lightning: ["size", "intensity", "color", "count", ...ALWAYS],
  fireworks: ["size", "intensity", "color", "color2", "count", ...ALWAYS],
  banner: ["size", "intensity", "color", "color2", "text", ...ALWAYS],
  ghosts: ["size", "intensity", "color", "count", ...ALWAYS],
  skid: ["size", "intensity", "color", "color2", "count", ...ALWAYS],
  vignette: ["intensity", "color", ...ALWAYS],
  tStreak: ["size", "intensity"],
  tDots: ["size", "intensity", "color", "count"],
  tRibbon: ["size", "intensity", "color", "color2"],
  tComet: ["size", "intensity", "color", "color2"],
  tGhosts: ["size", "intensity", "color", "count"],
  tSparkle: ["size", "intensity", "color", "color2", "count"],
  tSmoke: ["size", "intensity", "color", "count"],
  tNeon: ["size", "intensity", "color"],
  tDashes: ["size", "intensity", "color", "count"],
};

export interface VfxRecipe { style: VfxStyle; params: VfxParams }
/** CanvasMatch's test-only `vfxOverride`: the recipe to draw for each event. */
export type VfxOverride = Partial<Record<VfxEvent, VfxRecipe>>;

export interface VfxVariant {
  /** "event/name", unique. */
  id: string;
  event: VfxEvent;
  name: string;
  about: string;
  recipe: VfxRecipe;
  current?: boolean;
  off?: boolean;
}

const isHex = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);

/** Every number inside its slider, colours as #rrggbb, text short. Never throws. */
export function clampParams(raw: unknown, base: VfxParams = DEFAULT_PARAMS): VfxParams {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: VfxParams = { ...base };
  for (const k of NUM_KEYS) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      const i = PARAM_INFO[k];
      out[k] = Math.max(i.min, Math.min(i.max, k === "count" ? Math.round(v) : v));
    }
  }
  if (isHex(r.color)) out.color = r.color;
  if (isHex(r.color2)) out.color2 = r.color2;
  if (typeof r.text === "string") out.text = r.text.slice(0, 14);
  return out;
}

// ── The variants ─────────────────────────────────────────────────────────

const V = (event: VfxEvent, key: string, name: string, about: string, style: VfxStyle, p: Partial<VfxParams> = {}): VfxVariant =>
  ({ id: `${event}/${key}`, event, name, about, recipe: { style, params: clampParams(p) } });
const CUR = (event: VfxEvent, about: string, p: Partial<VfxParams> = {}): VfxVariant =>
  ({ ...V(event, "current", "Current (match feel)", about, "current", p), current: true });
const OFF = (event: VfxEvent): VfxVariant =>
  ({ ...V(event, "off", "Off", "Nothing drawn.", "none"), off: true });

export const VFX_VARIANTS: Record<VfxEvent, VfxVariant[]> = {
  strike: [
    CUR("strike", "Match feel New today: a hot flash, a shock ring, speed lines and turf.", { durationMs: 400, hitStopMs: 75, shakePx: 7 }),
    V("strike", "ring", "Impact ring", "Two clean white rings punched out from the boot.", "ring", { count: 2, size: 1.1, durationMs: 330 }),
    V("strike", "starburst", "Starburst sparks", "Gold sparks fly forward off the strike.", "starburst", { count: 14, spread: 0.45, color: "#fff7cc", color2: "#fbbf24", durationMs: 360 }),
    V("strike", "turf", "Turf puff", "Grass and dirt kicked up behind the boot.", "dust", { count: 12, size: 1.2, color: "#7c5a36", color2: "#4d7c2a", durationMs: 520 }),
    V("strike", "shockwave", "Shockwave arc", "A curved wave pushed out ahead of the ball.", "shockArc", { count: 3, spread: 0.35, size: 1.3, durationMs: 380 }),
    V("strike", "speedlines", "Speed lines", "Anime-style lines streaming past the ball.", "speedLines", { count: 10, spread: 0.18, size: 1.4, durationMs: 300 }),
    V("strike", "chroma", "Chromatic flash", "The hit splits into red and blue for a blink.", "chroma", { size: 1.2, durationMs: 260, shakePx: 4 }),
    V("strike", "pow", "Comic POW", "A jagged comic-book burst with a word in it.", "comic", { text: "POW!", color: "#facc15", color2: "#dc2626", count: 12, size: 1.2, durationMs: 520 }),
    V("strike", "smear", "Motion smear", "The ball leaves a stretched blur as it goes.", "smear", { count: 5, size: 1.1, durationMs: 300 }),
    V("strike", "shake", "Shake + freeze", "No picture: the screen jolts and holds for a beat.", "shake", { shakePx: 12, hitStopMs: 110, durationMs: 320 }),
    OFF("strike"),
  ],
  pass: [
    CUR("pass", "Match feel New today on a soft kick: a faint flash, almost nothing.", { durationMs: 300 }),
    V("pass", "ring", "Small ring", "One thin ring off the boot.", "ring", { count: 1, size: 0.6, durationMs: 260, intensity: 0.8 }),
    V("pass", "puff", "Grass puff", "A little puff of grass.", "dust", { count: 5, size: 0.6, color: "#86efac", color2: "#4d7c2a", durationMs: 380 }),
    V("pass", "lines", "Direction lines", "Three short lines show where it is going.", "speedLines", { count: 3, spread: 0.1, size: 0.8, durationMs: 260 }),
    V("pass", "glow", "Soft glow", "A soft blue glow round the ball.", "glow", { color: "#93c5fd", size: 0.8, durationMs: 300, intensity: 0.8 }),
    V("pass", "arc", "Small wave", "A small curved wave ahead of the ball.", "shockArc", { count: 1, spread: 0.25, size: 0.7, durationMs: 300 }),
    V("pass", "sparks", "Tiny sparks", "A few small sparks forward.", "starburst", { count: 5, spread: 0.3, size: 0.6, durationMs: 260 }),
    V("pass", "ping", "Comic PING", "A small comic word.", "comic", { text: "PING", count: 8, size: 0.7, color: "#a7f3d0", color2: "#065f46", durationMs: 420 }),
    V("pass", "smear", "Light smear", "A short soft blur behind it.", "smear", { count: 3, size: 0.7, intensity: 0.7, durationMs: 240 }),
    OFF("pass"),
  ],
  trail: [
    CUR("trail", "Match feel New today: a white streak whose length follows the speed."),
    V("trail", "dots", "Dots (Old)", "The old fading dots along the path.", "tDots", { count: 10 }),
    V("trail", "ribbon", "Colour ribbon", "A solid tapered ribbon in two colours.", "tRibbon", { color: "#38bdf8", color2: "#a78bfa" }),
    V("trail", "comet", "Comet", "A glowing fire tail.", "tComet", { color: "#fde047", color2: "#ef4444", size: 1.2 }),
    V("trail", "ghosts", "Afterimages", "See-through copies of the ball behind it.", "tGhosts", { count: 5 }),
    V("trail", "sparkle", "Sparkles", "Twinkling bits left in the air.", "tSparkle", { count: 14, color: "#fef9c3", color2: "#fbbf24" }),
    V("trail", "smoke", "Smoke", "Grey puffs that grow and fade.", "tSmoke", { count: 8, color: "#d1d5db" }),
    V("trail", "neon", "Neon line", "A thin glowing line.", "tNeon", { color: "#22d3ee" }),
    V("trail", "dashes", "Dashed path", "A dashed line, like a chalk diagram.", "tDashes", { count: 9 }),
    OFF("trail"),
  ],
  firstTouch: [
    CUR("firstTouch", "Match feel New today: the ball squashes; nothing is drawn.", { durationMs: 220 }),
    V("firstTouch", "ring", "Touch ring", "A ring at the foot.", "ring", { count: 1, size: 0.7, durationMs: 280 }),
    V("firstTouch", "puff", "Grass puff", "A little puff where it lands at his feet.", "dust", { count: 6, size: 0.6, durationMs: 400, color: "#a3a36b", color2: "#4d7c2a" }),
    V("firstTouch", "glow", "Control glow", "A green glow: under control.", "glow", { color: "#4ade80", size: 0.9, durationMs: 360 }),
    V("firstTouch", "sparks", "Small sparks", "A few sparks all round.", "starburst", { count: 6, spread: 1, size: 0.6, durationMs: 260 }),
    V("firstTouch", "chroma", "Colour blink", "A quick red-blue blink.", "chroma", { size: 0.7, durationMs: 200, intensity: 0.8 }),
    V("firstTouch", "ghost", "Stop ghost", "Faint copies of the ball catch up and stop.", "ghosts", { count: 4, size: 0.6, durationMs: 300 }),
    V("firstTouch", "cushion", "Cushion lines", "Short lines showing the ball being killed.", "speedLines", { count: 4, spread: 0.4, size: 0.6, durationMs: 260 }),
    OFF("firstTouch"),
  ],
  save: [
    CUR("save", "Match feel New today: a white-blue spark off the glove.", { durationMs: 360, hitStopMs: 50, shakePx: 3.5 }),
    V("save", "sparks", "Glove sparks", "Hot sparks off the glove, all round.", "starburst", { count: 12, spread: 1, color: "#ffffff", color2: "#7dd3fc", durationMs: 360 }),
    V("save", "gloves", "Glove print", "Two gloves flash where he met it.", "gloves", { color: "#f8fafc", color2: "#22c55e", durationMs: 420 }),
    V("save", "shards", "Shards", "Bright shards fly off the hands.", "shards", { count: 10, spread: 1, color: "#e0f2fe", color2: "#38bdf8", durationMs: 450 }),
    V("save", "ring", "Ring burst", "Three rings out from the save.", "ring", { count: 3, size: 1.1, color: "#bae6fd", durationMs: 380 }),
    V("save", "comic", "Comic SAVE!", "A comic burst with the word.", "comic", { text: "SAVE!", color: "#0ea5e9", color2: "#ffffff", count: 12, durationMs: 560 }),
    V("save", "lightning", "Lightning", "Short electric bolts.", "lightning", { count: 5, color: "#e0f2fe", durationMs: 300 }),
    V("save", "chroma", "Chromatic flash", "The save splits red and blue for a blink.", "chroma", { durationMs: 260, shakePx: 4 }),
    V("save", "shake", "Shake + freeze", "No picture: a jolt and a held beat.", "shake", { shakePx: 9, hitStopMs: 90, durationMs: 300 }),
    OFF("save"),
  ],
  catch: [
    CUR("catch", "Match feel New today: a smaller glove spark.", { size: 0.8, durationMs: 300, hitStopMs: 35, shakePx: 3.5 }),
    V("catch", "gloves", "Glove print", "Two gloves clamp on it.", "gloves", { color: "#f8fafc", color2: "#facc15", durationMs: 420 }),
    V("catch", "halo", "Safe-hands halo", "A gold halo round the ball.", "glow", { color: "#facc15", size: 1, durationMs: 500 }),
    V("catch", "ring", "Thump ring", "One heavy ring.", "ring", { count: 1, size: 0.9, color: "#fef3c7", durationMs: 300 }),
    V("catch", "sparks", "Soft sparks", "A few soft sparks.", "starburst", { count: 7, spread: 1, size: 0.7, color: "#fffbeb", color2: "#fcd34d", durationMs: 300 }),
    V("catch", "comic", "Comic GOT IT", "A comic word.", "comic", { text: "GOT IT", color: "#fde68a", color2: "#78350f", count: 10, durationMs: 520 }),
    V("catch", "vignette", "Edge pulse", "The screen edges darken for a moment.", "vignette", { color: "#000000", intensity: 0.9, durationMs: 450 }),
    V("catch", "shake", "Thump", "No picture: a small jolt and a held beat.", "shake", { shakePx: 5, hitStopMs: 60, durationMs: 260 }),
    OFF("catch"),
  ],
  dive: [
    CUR("dive", "Match feel New today: his body hops and arcs; no picture is drawn.", { durationMs: 400 }),
    V("dive", "ghosts", "Afterimages", "See-through copies of him along the dive.", "ghosts", { count: 4, size: 1.4, color: "#facc15", durationMs: 450 }),
    V("dive", "skid", "Grass skid", "Two skid marks and clods where he lands.", "skid", { count: 8, color: "#3f6212", color2: "#7c5a36", durationMs: 800 }),
    V("dive", "dust", "Landing dust", "A dust cloud as he hits the grass.", "dust", { count: 10, size: 1.3, color: "#a8987a", color2: "#4d7c2a", durationMs: 600 }),
    V("dive", "lines", "Motion lines", "Lines behind him as he flies.", "speedLines", { count: 7, spread: 0.2, size: 1.4, durationMs: 360 }),
    V("dive", "smear", "Body smear", "A long blur along the dive.", "smear", { count: 5, size: 1.6, color: "#fde68a", durationMs: 360 }),
    V("dive", "comic", "Comic WHOOSH", "A comic word.", "comic", { text: "WHOOSH", color: "#e9d5ff", color2: "#581c87", count: 10, durationMs: 520 }),
    V("dive", "glow", "Stretch glow", "A glow where he is reaching.", "glow", { color: "#fbbf24", size: 1.2, durationMs: 420 }),
    OFF("dive"),
  ],
  woodwork: [
    CUR("woodwork", "Match feel New today: rings of vibration and a spark.", { size: 1.1, durationMs: 550, hitStopMs: 40, shakePx: 6.3 }),
    V("woodwork", "rings", "Vibration rings", "Three rings humming out from the frame.", "ring", { count: 3, size: 1.2, color: "#e5e7eb", durationMs: 520 }),
    V("woodwork", "sparks", "Metal sparks", "Orange sparks off the post.", "starburst", { count: 16, spread: 1, color: "#fff7ed", color2: "#f97316", durationMs: 380 }),
    V("woodwork", "lightning", "Shock bolts", "Zig-zag bolts round the hit.", "lightning", { count: 6, color: "#fef9c3", durationMs: 340 }),
    V("woodwork", "chips", "Paint chips", "White chips fly off the frame.", "shards", { count: 9, spread: 1, color: "#ffffff", color2: "#d1d5db", durationMs: 500 }),
    V("woodwork", "comic", "Comic CLANG!", "A comic word.", "comic", { text: "CLANG!", color: "#e5e7eb", color2: "#111827", count: 14, durationMs: 560 }),
    V("woodwork", "chroma", "Chromatic flash", "A red-blue blink.", "chroma", { durationMs: 260 }),
    V("woodwork", "shake", "Big shake", "No picture: a hard jolt and a held beat.", "shake", { shakePx: 14, hitStopMs: 100, durationMs: 420 }),
    OFF("woodwork"),
  ],
  net: [
    CUR("net", "Match feel New today: the net bulges round the ball and ripples.", { durationMs: 1600 }),
    V("net", "ripple", "Big ripple", "The net bulges hard and waves out in rings.", "netRipple", { count: 3, size: 1.3, durationMs: 1400 }),
    V("net", "confetti", "Confetti", "A burst of confetti out of the net.", "confetti", { count: 36, spread: 0.6, color: "#facc15", color2: "#34d399", durationMs: 1600 }),
    V("net", "light", "Light burst", "Rays of light from the ball.", "lightBurst", { count: 12, color: "#fef9c3", size: 1.4, durationMs: 1000 }),
    V("net", "punch", "Camera punch-in", "The camera jumps closer for a moment.", "punchIn", { zoom: 0.14, durationMs: 700, intensity: 0.7 }),
    V("net", "slowmo", "Slow-mo flash", "A white flash, bars and a long freeze.", "slowmo", { hitStopMs: 220, durationMs: 900 }),
    V("net", "fireworks", "Fireworks", "Bursts of light over the goal.", "fireworks", { count: 4, color: "#f472b6", color2: "#facc15", durationMs: 1400 }),
    V("net", "ring", "Net rings", "Rings spreading through the net.", "ring", { count: 3, size: 1.6, color: "#ffffff", durationMs: 700 }),
    OFF("net"),
  ],
  block: [
    CUR("block", "Match feel New today: the ball squashes; nothing is drawn.", { durationMs: 220 }),
    V("block", "ring", "Thud ring", "A short heavy ring.", "ring", { count: 1, size: 1, color: "#fecaca", durationMs: 300 }),
    V("block", "sparks", "Deflection sparks", "Sparks off the body, one way.", "starburst", { count: 10, spread: 0.5, color: "#fee2e2", color2: "#ef4444", durationMs: 330 }),
    V("block", "comic", "Comic BLOCKED", "A comic word.", "comic", { text: "BLOCKED", color: "#fca5a5", color2: "#7f1d1d", count: 12, durationMs: 520 }),
    V("block", "shards", "Shards", "Bits fly off the block.", "shards", { count: 8, spread: 0.6, color: "#fecaca", color2: "#b91c1c", durationMs: 420 }),
    V("block", "dust", "Body puff", "A small cloud off the body.", "dust", { count: 7, size: 0.9, durationMs: 450 }),
    V("block", "chroma", "Chromatic flash", "A red-blue blink.", "chroma", { durationMs: 240 }),
    V("block", "shake", "Shake + freeze", "No picture: a jolt and a held beat.", "shake", { shakePx: 8, hitStopMs: 70, durationMs: 280 }),
    OFF("block"),
  ],
  header: [
    CUR("header", "Match feel New today: the header move is bigger; nothing is drawn.", { durationMs: 220 }),
    V("header", "ring", "Head ring", "A ring off the head.", "ring", { count: 2, size: 0.9, durationMs: 300 }),
    V("header", "sparks", "Head sparks", "Sparks forward off the head.", "starburst", { count: 9, spread: 0.45, durationMs: 320 }),
    V("header", "spray", "Sweat spray", "A spray of drops off the head.", "dust", { count: 10, size: 0.9, color: "#bae6fd", color2: "#e0f2fe", durationMs: 450 }),
    V("header", "lines", "Speed lines", "Lines past the ball.", "speedLines", { count: 7, spread: 0.2, durationMs: 300 }),
    V("header", "comic", "Comic BONK", "A comic word.", "comic", { text: "BONK!", color: "#fde68a", color2: "#9a3412", count: 10, durationMs: 500 }),
    V("header", "glow", "Head glow", "A soft glow round the ball.", "glow", { color: "#fde68a", durationMs: 360 }),
    V("header", "wave", "Shockwave", "A curved wave ahead.", "shockArc", { count: 2, spread: 0.3, durationMs: 340 }),
    OFF("header"),
  ],
  nearMiss: [
    CUR("nearMiss", "Match feel New today: nothing drawn for a near miss.", { durationMs: 400 }),
    V("nearMiss", "ghosts", "Afterimages", "Copies of the ball hang where it went past.", "ghosts", { count: 5, size: 0.8, durationMs: 600 }),
    V("nearMiss", "glow", "Red glow", "A red glow round the ball.", "glow", { color: "#f87171", size: 1.1, durationMs: 600 }),
    V("nearMiss", "vignette", "Red edges", "The screen edges flush red.", "vignette", { color: "#b91c1c", intensity: 1, durationMs: 700 }),
    V("nearMiss", "comic", "Comic SO CLOSE", "A comic word.", "comic", { text: "SO CLOSE", color: "#fecaca", color2: "#7f1d1d", count: 10, durationMs: 650 }),
    V("nearMiss", "ring", "Miss rings", "Two rings where it went by.", "ring", { count: 2, size: 1, color: "#fecaca", durationMs: 450 }),
    V("nearMiss", "slowmo", "Slow-mo", "Bars and a held beat.", "slowmo", { hitStopMs: 160, intensity: 0.6, durationMs: 800 }),
    V("nearMiss", "shake", "Groan shake", "No picture: a small jolt.", "shake", { shakePx: 6, durationMs: 300 }),
    OFF("nearMiss"),
  ],
  celebration: [
    CUR("celebration", "The game today on a goal: a quick white flash over the screen.", { durationMs: 550 }),
    V("celebration", "rays", "Light rays", "Gold rays turning behind everything.", "lightBurst", { count: 14, size: 3, color: "#fde68a", durationMs: 1400 }),
    V("celebration", "confetti", "Confetti shower", "Confetti all over the screen.", "confetti", { count: 50, spread: 1, size: 1.5, color: "#facc15", color2: "#34d399", durationMs: 1800 }),
    V("celebration", "fireworks", "Fireworks", "Fireworks across the sky.", "fireworks", { count: 6, color: "#f472b6", color2: "#60a5fa", durationMs: 1800 }),
    V("celebration", "banner", "GOAL! banner", "A big word slams across the screen.", "banner", { text: "GOAL!", color: "#facc15", color2: "#111827", durationMs: 1300 }),
    V("celebration", "vignette", "Gold edges", "The screen edges glow gold.", "vignette", { color: "#f59e0b", intensity: 1, durationMs: 1200 }),
    V("celebration", "slowmo", "Slow-mo flash", "A white flash, bars and a long freeze.", "slowmo", { hitStopMs: 200, durationMs: 1000 }),
    V("celebration", "chroma", "Screen split", "The whole picture splits red and blue.", "chroma", { size: 3, durationMs: 420, shakePx: 8 }),
    V("celebration", "punch", "Camera punch-in", "The camera jumps closer.", "punchIn", { zoom: 0.18, intensity: 0.8, durationMs: 900 }),
    OFF("celebration"),
  ],
};

export function variantById(id: string): VfxVariant | undefined {
  const ev = id.split("/")[0] as VfxEvent;
  return VFX_VARIANTS[ev]?.find((v) => v.id === id);
}

/** The variant's recipe with this device's edits (clamped). */
export function editedRecipe(v: VfxVariant, edit?: Partial<VfxParams>): VfxRecipe {
  return { style: v.recipe.style, params: edit ? clampParams(edit, v.recipe.params) : v.recipe.params };
}

/** How long one recipe runs (s). */
export const vfxDurS = (r: VfxRecipe) => r.params.durationMs / 1000;

// ── Camera (shake, punch-in): applied by the match, not drawn ────────────

/** Camera shake, px, `u` (0→1) into the effect. A sharp kick that rings out; never random. */
export function vfxShake(r: VfxRecipe, u: number, dx: number, dy: number): { x: number; y: number } {
  const px = r.params.shakePx;
  if (!(px > 0) || u < 0 || u >= 1) return { x: 0, y: 0 };
  const k = Math.cos(Math.PI * 3 * u) * (1 - u) * (1 - u) * px;
  const across = Math.sin(Math.PI * 7 * u) * (1 - u) * px * 0.3;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l, uy = dy / l;
  return { x: ux * k - uy * across, y: uy * k + ux * across };
}

/** Camera punch-in, as a scale (1 = none): quick in, eased out. */
export function vfxZoom(r: VfxRecipe, u: number): number {
  const z = r.params.zoom;
  if (!(z > 0) || u < 0 || u >= 1) return 1;
  const k = u < 0.12 ? u / 0.12 : Math.pow(1 - (u - 0.12) / 0.88, 2);
  return 1 + z * k;
}

// ── Drawing ──────────────────────────────────────────────────────────────

/** Where an effect is drawn. All px. */
export interface VfxAt {
  x: number; y: number;
  /** The ball's way on screen (any length). */
  dx: number; dy: number;
  /** Base size, px (the match uses about four ball-widths). */
  s: number;
  /** 0–1: how hard it was hit. */
  power: number;
  /** The whole canvas, for screen-wide effects. */
  w: number; h: number;
  /** A number that varies the sparks from one hit to the next. */
  salt?: number;
}

function rgba(hex: string, a: number): string {
  const h = isHex(hex) ? hex : "#ffffff";
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (u: number) => 1 - (1 - u) * (1 - u);
/** A pop that overshoots then settles. */
const pop = (u: number) => (u < 0.18 ? Math.sin((u / 0.18) * Math.PI * 0.6) / Math.sin(Math.PI * 0.6) * 1.15 : 1.15 - 0.15 * clamp01((u - 0.18) / 0.2));

function unit(dx: number, dy: number) { const l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; }

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, n: number, salt: number) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? r1 * (0.8 + 0.4 * feelNoise(i, salt)) : r0;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/**
 * Paint one recipe at `u` (0 → 1 over its life) for an event. Pure: the same
 * arguments draw the same picture. Never throws for any clamped recipe.
 */
export function drawVfx(ctx: CanvasRenderingContext2D, event: VfxEvent, r: VfxRecipe, u: number, at: VfxAt): void {
  if (u < 0 || u >= 1) return;
  const P = r.params;
  const I = P.intensity;
  if (!(I > 0) && r.style !== "current") return;
  const s = 1 - u;
  const S = at.s * P.size;
  const salt = at.salt ?? 0;
  const d = unit(at.dx, at.dy);
  const n = Math.max(1, Math.round(P.count));
  ctx.save();
  try {
    switch (r.style) {
      case "none": case "shake": case "punchIn":
        if (r.style === "shake" && u < 0.25) {
          // A thin flash so you can see where it happened.
          ctx.strokeStyle = rgba(P.color, 0.5 * I * (1 - u / 0.25));
          ctx.lineWidth = Math.max(1, at.s * 0.05);
          ctx.beginPath(); ctx.arc(at.x, at.y, at.s * (0.3 + u), 0, Math.PI * 2); ctx.stroke();
        }
        if (r.style === "punchIn") drawVignette(ctx, at, P.color, 0.55 * I * Math.sin(Math.PI * u));
        break;
      case "current": drawCurrent(ctx, event, r, u, at); break;
      case "ring":
        for (let i = 0; i < n; i++) {
          const uu = u - i * 0.12;
          if (uu < 0) continue;
          ctx.strokeStyle = rgba(P.color, 0.9 * I * s * (1 - i / (n + 1)));
          ctx.lineWidth = Math.max(1, S * 0.1 * (1 - uu));
          ctx.beginPath(); ctx.arc(at.x, at.y, S * (0.25 + 1.2 * easeOut(clamp01(uu))), 0, Math.PI * 2); ctx.stroke();
        }
        break;
      case "starburst": {
        const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, S * 0.6);
        g.addColorStop(0, rgba(P.color, 0.95 * I * s * s));
        g.addColorStop(1, rgba(P.color2, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(at.x, at.y, S * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.lineCap = "round";
        const base = Math.atan2(d.y, d.x);
        for (let i = 0; i < n; i++) {
          const a = base + (feelNoise(i, salt + 3) - 0.5) * Math.PI * 2 * Math.max(0.05, P.spread);
          const sp = 0.6 + 0.8 * feelNoise(i, salt + 4);
          const r0 = S * (0.2 + 1.2 * easeOut(u) * sp);
          const r1 = r0 + S * 0.45 * s * sp;
          ctx.strokeStyle = rgba(i % 2 ? P.color2 : P.color, I * s);
          ctx.lineWidth = Math.max(1, S * 0.06 * s + 0.5);
          ctx.beginPath(); ctx.moveTo(at.x + Math.cos(a) * r0, at.y + Math.sin(a) * r0); ctx.lineTo(at.x + Math.cos(a) * r1, at.y + Math.sin(a) * r1); ctx.stroke();
        }
        break;
      }
      case "dust": {
        const cr = S * (0.35 + 0.8 * u);
        const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, cr);
        g.addColorStop(0, rgba(P.color, 0.4 * I * s));
        g.addColorStop(1, rgba(P.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(at.x, at.y - cr * 0.15, cr, cr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (0.05 + 0.9 * feelNoise(i, salt + 11));
          const sp = 0.6 + 0.8 * feelNoise(i, salt + 12);
          const side = feelNoise(i, salt + 13) < 0.5 ? -1 : 1;
          const px = at.x + Math.cos(a) * S * sp * u * side;
          const py = at.y - Math.sin(a) * S * sp * 1.2 * u + S * 1.5 * u * u;
          ctx.fillStyle = rgba(i % 3 === 0 ? P.color2 : P.color, 0.9 * I * s);
          ctx.beginPath(); ctx.arc(px, py, Math.max(1, S * (0.05 + 0.05 * feelNoise(i, salt + 14))), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "shockArc": {
        const base = Math.atan2(d.y, d.x);
        const half = Math.PI * Math.max(0.05, P.spread);
        for (let i = 0; i < n; i++) {
          const uu = u - i * 0.1;
          if (uu < 0) continue;
          const rr = S * (0.3 + 1.6 * easeOut(clamp01(uu)));
          ctx.strokeStyle = rgba(P.color, 0.85 * I * (1 - clamp01(uu)));
          ctx.lineWidth = Math.max(1, S * 0.16 * (1 - clamp01(uu)));
          ctx.lineCap = "round";
          ctx.beginPath(); ctx.arc(at.x, at.y, rr, base - half, base + half); ctx.stroke();
        }
        break;
      }
      case "speedLines": {
        ctx.lineCap = "round";
        const px = -d.y, py = d.x;
        for (let i = 0; i < n; i++) {
          const off = (feelNoise(i, salt + 21) - 0.5) * S * (0.6 + 2.4 * P.spread);
          // Thrown forward along the ball's way, streaming with it.
          const ahead = S * (0.1 + 0.6 * feelNoise(i, salt + 22)) + S * 1.6 * easeOut(u);
          const len = S * (0.6 + 0.8 * feelNoise(i, salt + 23)) * s;
          const x0 = at.x + d.x * ahead + px * off, y0 = at.y + d.y * ahead + py * off;
          ctx.strokeStyle = rgba(P.color, 0.85 * I * s);
          ctx.lineWidth = Math.max(1, S * 0.05);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 - d.x * len, y0 - d.y * len); ctx.stroke();
        }
        break;
      }
      case "chroma": {
        const off = S * 0.25 * easeOut(u) + 1;
        ctx.globalCompositeOperation = "lighter";
        const rr = S * (0.5 + 0.6 * u);
        for (const [c, ox] of [["#ff2d55", -off], ["#2dd4ff", off], ["#a3ff2d", 0]] as const) {
          ctx.fillStyle = rgba(c, 0.55 * I * s * s);
          ctx.beginPath(); ctx.arc(at.x + ox, at.y - ox * 0.3, rr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = rgba("#ffffff", 0.8 * I * s);
        ctx.lineWidth = Math.max(1, S * 0.05);
        ctx.beginPath(); ctx.arc(at.x, at.y, rr * 1.1, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case "comic": {
        const k = pop(u) * (u > 0.8 ? 1 - (u - 0.8) / 0.2 * 0.3 : 1);
        const a = u > 0.75 ? (1 - u) / 0.25 : 1;
        const r1 = S * 0.9 * k;
        ctx.globalAlpha = clamp01(a * Math.min(1, I));
        star(ctx, at.x, at.y - S * 0.3, r1 * 0.62, r1, Math.max(5, n), salt);
        ctx.fillStyle = P.color; ctx.fill();
        ctx.lineWidth = Math.max(1.5, S * 0.07); ctx.strokeStyle = "#111111"; ctx.stroke();
        const word = P.text || "POW!";
        const fs = Math.max(7, (r1 * 1.15) / Math.max(2.4, word.length * 0.55));
        ctx.font = `900 ${fs.toFixed(1)}px system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(1, fs * 0.16); ctx.strokeStyle = "#111111";
        ctx.strokeText(word, at.x, at.y - S * 0.3);
        ctx.fillStyle = P.color2; ctx.fillText(word, at.x, at.y - S * 0.3);
        break;
      }
      case "smear": case "ghosts": {
        const br = S * 0.22;
        for (let i = n; i >= 1; i--) {
          const back = (i / n) * S * (r.style === "smear" ? 1.6 : 1.2) * (0.4 + 0.6 * s);
          const x = at.x - d.x * back, y = at.y - d.y * back;
          ctx.fillStyle = rgba(P.color, (r.style === "smear" ? 0.32 : 0.45) * I * s * (1 - (i - 1) / n));
          ctx.beginPath();
          if (r.style === "smear") ctx.ellipse(x, y, br * 1.7, br * 0.8, Math.atan2(d.y, d.x), 0, Math.PI * 2);
          else ctx.arc(x, y, br, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "netRipple": {
        const amt = (u < 0.1 ? u / 0.1 : 0.55 + 0.45 * Math.cos((u - 0.1) * 18) * Math.exp(-(u - 0.1) * 4)) * s;
        drawNetBulge(ctx, at.x, at.y, at.x + d.x * 10, at.y + d.y * 10, S * 1.3, clamp01(amt * I));
        for (let i = 0; i < n; i++) {
          const uu = u * 1.4 - i * 0.18;
          if (uu < 0 || uu > 1) continue;
          ctx.strokeStyle = rgba(P.color, 0.6 * I * (1 - uu));
          ctx.lineWidth = Math.max(0.8, S * 0.04);
          ctx.beginPath(); ctx.ellipse(at.x, at.y, S * (0.3 + 1.6 * uu), S * (0.2 + 1.1 * uu), 0, 0, Math.PI * 2); ctx.stroke();
        }
        break;
      }
      case "confetti": {
        const cols = [P.color, P.color2, "#ffffff", "#f472b6", "#60a5fa"];
        const screen = event === "celebration";
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (feelNoise(i, salt + 31) - 0.5) * Math.PI * 2 * Math.max(0.1, P.spread);
          const v = S * (1.2 + 2.2 * feelNoise(i, salt + 32));
          const t = u * 1.6;
          const ox = screen ? feelNoise(i, salt + 35) * at.w : at.x;
          const oy = screen ? -10 : at.y;
          const x = ox + Math.cos(a) * v * t * (screen ? 0.3 : 1) + Math.sin(t * 6 + i) * S * 0.12;
          const y = screen ? oy + at.h * 1.1 * t * (0.5 + 0.5 * feelNoise(i, salt + 36)) : oy + Math.sin(a) * v * t + S * 2.4 * t * t;
          ctx.save();
          ctx.translate(x, y); ctx.rotate(t * 8 * (feelNoise(i, salt + 33) - 0.5) * 2);
          ctx.fillStyle = rgba(cols[i % cols.length], I * (u > 0.7 ? (1 - u) / 0.3 : 1));
          const cw = Math.max(1.5, S * 0.12), ch = Math.max(1, S * 0.06);
          ctx.fillRect(-cw / 2, -ch / 2, cw, ch * (0.6 + Math.abs(Math.cos(t * 9 + i))));
          ctx.restore();
        }
        break;
      }
      case "lightBurst": {
        const rr = Math.max(S * 1.6, event === "celebration" ? Math.hypot(at.w, at.h) * 0.6 : 0);
        const a = I * Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.6;
        const rot = u * 0.9;
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < n; i++) {
          const a0 = rot + (i / n) * Math.PI * 2, w = (Math.PI / n) * 0.55;
          const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, rr);
          g.addColorStop(0, rgba(P.color, a));
          g.addColorStop(1, rgba(P.color, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(at.x, at.y); ctx.arc(at.x, at.y, rr, a0 - w, a0 + w); ctx.closePath(); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "slowmo": {
        // A flash, then cinema bars and a cool wash while it holds.
        const fl = u < 0.25 ? 1 - u / 0.25 : 0;
        if (fl > 0) { ctx.fillStyle = rgba(P.color, 0.7 * I * fl); ctx.fillRect(0, 0, at.w, at.h); }
        const bar = at.h * 0.09 * Math.sin(Math.PI * u);
        ctx.fillStyle = rgba("#000000", 0.85 * Math.min(1, I));
        ctx.fillRect(0, 0, at.w, bar); ctx.fillRect(0, at.h - bar, at.w, bar);
        ctx.fillStyle = rgba("#60a5fa", 0.12 * I * Math.sin(Math.PI * u));
        ctx.fillRect(0, 0, at.w, at.h);
        break;
      }
      case "glow": {
        const rr = S * (0.5 + 0.35 * Math.sin(Math.PI * u));
        const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, rr);
        const a = 0.75 * I * Math.sin(Math.PI * Math.min(1, u * 1.3 + 0.05));
        g.addColorStop(0, rgba(P.color, a));
        g.addColorStop(0.5, rgba(P.color, a * 0.5));
        g.addColorStop(1, rgba(P.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(at.x, at.y, rr, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "shards": {
        const base = Math.atan2(d.y, d.x);
        for (let i = 0; i < n; i++) {
          const a = base + (feelNoise(i, salt + 41) - 0.5) * Math.PI * 2 * Math.max(0.1, P.spread);
          const v = S * (0.6 + 1.2 * feelNoise(i, salt + 42));
          const x = at.x + Math.cos(a) * v * easeOut(u), y = at.y + Math.sin(a) * v * easeOut(u) + S * 0.6 * u * u;
          const sz = S * (0.08 + 0.1 * feelNoise(i, salt + 43)) * (0.5 + 0.5 * s);
          ctx.save(); ctx.translate(x, y); ctx.rotate(u * 9 * (feelNoise(i, salt + 44) - 0.5));
          ctx.fillStyle = rgba(i % 2 ? P.color2 : P.color, I * s);
          ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.7, sz * 0.8); ctx.lineTo(-sz * 0.7, sz * 0.6); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case "gloves": {
        const k = pop(u);
        const a = I * (u > 0.5 ? (1 - u) / 0.5 : 1);
        for (const side of [-1, 1]) {
          const gx = at.x + side * S * 0.32 * k, gy = at.y - S * 0.05;
          ctx.save(); ctx.translate(gx, gy); ctx.rotate(side * 0.35);
          ctx.fillStyle = rgba(P.color, 0.9 * a);
          ctx.strokeStyle = rgba(P.color2, a); ctx.lineWidth = Math.max(1, S * 0.05);
          const gw = S * 0.28 * k, gh = S * 0.36 * k;
          ctx.beginPath(); ctx.ellipse(0, gh * 0.15, gw * 0.5, gh * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          for (let f = 0; f < 4; f++) {
            ctx.beginPath(); ctx.ellipse((f - 1.5) * gw * 0.25, -gh * 0.3, gw * 0.11, gh * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
          ctx.restore();
        }
        ctx.strokeStyle = rgba(P.color2, 0.7 * a);
        ctx.lineWidth = Math.max(1, S * 0.05 * s);
        ctx.beginPath(); ctx.arc(at.x, at.y, S * (0.4 + 0.8 * u), 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case "lightning": {
        const flick = feelNoise(Math.floor(u * 14), salt + 51) > 0.25 ? 1 : 0.35;
        ctx.strokeStyle = rgba(P.color, I * s * flick);
        ctx.lineWidth = Math.max(1, S * 0.05);
        ctx.lineJoin = "round";
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + feelNoise(i, salt + 52);
          let x = at.x, y = at.y;
          ctx.beginPath(); ctx.moveTo(x, y);
          const segs = 4, len = S * (0.6 + 0.6 * feelNoise(i, salt + 53)) * (0.4 + 0.6 * easeOut(u));
          for (let j = 1; j <= segs; j++) {
            const jit = (feelNoise(i * 7 + j, salt + 54 + Math.floor(u * 10)) - 0.5) * S * 0.35;
            x = at.x + Math.cos(a) * (len * j / segs) - Math.sin(a) * jit;
            y = at.y + Math.sin(a) * (len * j / segs) + Math.cos(a) * jit;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      }
      case "fireworks": {
        for (let b = 0; b < n; b++) {
          const delay = feelNoise(b, salt + 61) * 0.4;
          const uu = (u - delay) / (1 - delay);
          if (uu <= 0 || uu >= 1) continue;
          const cx = event === "celebration" ? at.w * (0.15 + 0.7 * feelNoise(b, salt + 62)) : at.x + (feelNoise(b, salt + 62) - 0.5) * S * 3;
          const cy = event === "celebration" ? at.h * (0.1 + 0.35 * feelNoise(b, salt + 63)) : at.y - S * (0.6 + 1.2 * feelNoise(b, salt + 63));
          const rr = S * (0.5 + 0.6 * feelNoise(b, salt + 64)) * easeOut(uu);
          const dots = 14;
          for (let i = 0; i < dots; i++) {
            const a = (i / dots) * Math.PI * 2;
            ctx.fillStyle = rgba(b % 2 ? P.color2 : P.color, I * (1 - uu));
            ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + S * 0.4 * uu * uu, Math.max(1, S * 0.045), 0, Math.PI * 2); ctx.fill();
          }
        }
        break;
      }
      case "banner": {
        const inT = clamp01(u / 0.15), outT = clamp01((u - 0.8) / 0.2);
        const x = at.w / 2 + (1 - easeOut(inT)) * at.w * 0.9 - outT * at.w * 0.9;
        const y = at.h * 0.42;
        const bh = at.h * 0.13 * P.size;
        ctx.globalAlpha = clamp01(I);
        ctx.fillStyle = P.color2;
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.07);
        ctx.fillRect(-at.w * 0.7, -bh / 2, at.w * 1.4, bh);
        ctx.fillStyle = P.color;
        ctx.fillRect(-at.w * 0.7, -bh / 2, at.w * 1.4, Math.max(2, bh * 0.08));
        ctx.fillRect(-at.w * 0.7, bh / 2 - Math.max(2, bh * 0.08), at.w * 1.4, Math.max(2, bh * 0.08));
        const fs = bh * 0.72;
        ctx.font = `900 italic ${fs.toFixed(1)}px system-ui, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(P.text || "GOAL!", 0, bh * 0.04);
        ctx.restore();
        break;
      }
      case "skid": {
        const along = Math.atan2(d.y, d.x);
        const len = S * 1.6 * easeOut(clamp01(u * 1.5));
        const a = I * (u > 0.6 ? (1 - u) / 0.4 : 1);
        ctx.strokeStyle = rgba(P.color, 0.7 * a); ctx.lineCap = "round";
        for (const off of [-0.18, 0.18]) {
          ctx.lineWidth = Math.max(1.5, S * 0.12);
          const ox = -Math.sin(along) * S * off, oy = Math.cos(along) * S * off;
          ctx.beginPath(); ctx.moveTo(at.x + ox, at.y + oy); ctx.lineTo(at.x + ox + Math.cos(along) * len, at.y + oy + Math.sin(along) * len); ctx.stroke();
        }
        for (let i = 0; i < n; i++) {
          const k = feelNoise(i, salt + 71);
          const px = at.x + Math.cos(along) * len * k + (feelNoise(i, salt + 72) - 0.5) * S * 0.5;
          const py = at.y + Math.sin(along) * len * k - S * 0.6 * Math.sin(Math.PI * clamp01(u * 1.4)) * feelNoise(i, salt + 73);
          ctx.fillStyle = rgba(i % 2 ? P.color2 : P.color, 0.9 * a);
          ctx.beginPath(); ctx.arc(px, py, Math.max(1, S * 0.05), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "vignette":
        drawVignette(ctx, at, P.color, 0.75 * I * Math.sin(Math.PI * u));
        break;
      default:
        // Trail styles are drawn by drawVfxTrail; a single moment shows the trail's shape.
        drawTrailPreview(ctx, r, u, at);
    }
  } finally {
    ctx.restore();
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, at: VfxAt, color: string, a: number) {
  if (!(a > 0.005)) return;
  const cx = at.w / 2, cy = at.h / 2, R = Math.hypot(at.w, at.h) / 2;
  const g = ctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, a));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, at.w, at.h);
}

/** What Match feel: New draws for this event today. */
function drawCurrent(ctx: CanvasRenderingContext2D, event: VfxEvent, r: VfxRecipe, u: number, at: VfxAt) {
  const P = r.params;
  const S = at.s * P.size;
  const salt = at.salt ?? 0;
  switch (event) {
    case "strike": drawImpactBurst(ctx, at.x, at.y, S * (0.25 + 0.95 * Math.max(0.6, at.power)), u, at.dx, at.dy, Math.max(0.6, at.power), true, false); break;
    case "pass": drawImpactBurst(ctx, at.x, at.y, S * 0.35, u, at.dx, at.dy, 0.12, true, false); break;
    case "save": drawGloveSpark(ctx, at.x, at.y, S * 0.8 * 1.1, u, salt); break;
    case "catch": drawGloveSpark(ctx, at.x, at.y, S * 0.8 * 0.8, u, salt); break;
    case "woodwork": drawClang(ctx, at.x, at.y, S, u); break;
    case "net": {
      const t = u * vfxDurS(r);
      const env = t < 0.1 ? Math.sin((Math.PI / 2) * (t / 0.1))
        : (0.55 + 0.45 * Math.cos((t - 0.1) * 16) * Math.exp(-(t - 0.1) * 5)) * Math.max(0, 1 - Math.max(0, t - 1.2) / 0.8);
      drawNetBulge(ctx, at.x, at.y, at.x + at.dx, at.y + at.dy, S * 1.2, Math.max(0, env) * P.intensity);
      break;
    }
    case "celebration": {
      const a = 0.55 * (1 - u) * P.intensity;
      ctx.fillStyle = `rgba(255,255,255,${clamp01(a).toFixed(3)})`;
      ctx.fillRect(0, 0, at.w, at.h);
      break;
    }
    case "trail": drawTrailPreview(ctx, { style: "tStreak", params: P }, u, at); break;
    default: break; // firstTouch, dive, block, header, nearMiss: nothing is drawn today.
  }
}

// ── Trails ───────────────────────────────────────────────────────────────

/**
 * The ball's trail, `pts` oldest → newest (the ball), screen px. `speed01`
 * 0-1 how fast it is going; `time` seconds (for twinkle). Pure.
 */
export function drawVfxTrail(
  ctx: CanvasRenderingContext2D, r: VfxRecipe, pts: { x: number; y: number }[], ballR: number, speed01: number, time: number,
): void {
  if (pts.length < 2) return;
  const P = r.params;
  const I = P.intensity * clamp01(speed01 * 1.2 + 0.1);
  if (!(I > 0)) return;
  const W = ballR * P.size;
  const n = Math.max(1, Math.round(P.count));
  const at = (k: number) => {
    // A point a fraction k (0 tail → 1 head) along the path.
    const f = k * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), t = f - i;
    return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
  };
  ctx.save();
  try {
    switch (r.style) {
      case "none": break;
      case "current": case "tStreak": drawSpeedStreak(ctx, pts, W * 1.05, clamp01(I)); break;
      case "tDots":
        for (let i = 0; i < n; i++) {
          const k = (i + 1) / n, p = at(k * 0.97);
          ctx.fillStyle = rgba(P.color, (0.06 + 0.24 * k) * I * 1.5);
          ctx.beginPath(); ctx.arc(p.x, p.y, W * (0.3 + 0.5 * k), 0, Math.PI * 2); ctx.fill();
        }
        break;
      case "tRibbon": case "tComet": {
        const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = [];
        for (let i = 0; i < pts.length; i++) {
          const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
          const t = unit(q.x - o.x, q.y - o.y);
          const k = i / (pts.length - 1);
          const hw = W * (r.style === "tComet" ? 1.4 : 0.8) * Math.pow(k, r.style === "tComet" ? 0.6 : 1);
          left.push({ x: pts[i].x - t.y * hw, y: pts[i].y + t.x * hw });
          right.push({ x: pts[i].x + t.y * hw, y: pts[i].y - t.x * hw });
        }
        ctx.beginPath(); ctx.moveTo(left[0].x, left[0].y);
        for (const p of left) ctx.lineTo(p.x, p.y);
        for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
        ctx.closePath();
        const tail = pts[0], head = pts[pts.length - 1];
        const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        g.addColorStop(0, rgba(P.color2, 0));
        g.addColorStop(0.6, rgba(P.color2, 0.5 * I));
        g.addColorStop(1, rgba(P.color, 0.9 * I));
        if (r.style === "tComet") ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g; ctx.fill();
        if (r.style === "tComet") {
          const hg = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, W * 2.2);
          hg.addColorStop(0, rgba(P.color, 0.8 * I)); hg.addColorStop(1, rgba(P.color2, 0));
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(head.x, head.y, W * 2.2, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "tGhosts":
        for (let i = 0; i < n; i++) {
          const k = (i + 1) / (n + 1), p = at(k);
          ctx.fillStyle = rgba(P.color, 0.4 * k * I);
          ctx.strokeStyle = rgba("#111111", 0.25 * k * I);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, W, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        break;
      case "tSparkle":
        for (let i = 0; i < n; i++) {
          const k = feelNoise(i, 81), p = at(k * 0.95);
          const tw = 0.5 + 0.5 * Math.sin(time * 18 + i * 2.3);
          const off = (feelNoise(i, 82) - 0.5) * W * 2.4;
          const sz = W * (0.25 + 0.35 * feelNoise(i, 83)) * tw;
          ctx.fillStyle = rgba(i % 2 ? P.color2 : P.color, I * k * (0.4 + 0.6 * tw));
          ctx.beginPath();
          ctx.moveTo(p.x + off, p.y - sz); ctx.lineTo(p.x + off + sz * 0.3, p.y); ctx.lineTo(p.x + off, p.y + sz); ctx.lineTo(p.x + off - sz * 0.3, p.y);
          ctx.closePath(); ctx.fill();
        }
        break;
      case "tSmoke":
        for (let i = 0; i < n; i++) {
          const k = (i + 0.5) / n, p = at(k * 0.9);
          const rr = W * (0.6 + 1.6 * (1 - k));
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
          g.addColorStop(0, rgba(P.color, 0.35 * I * k)); g.addColorStop(1, rgba(P.color, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case "tNeon":
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (const [w, a] of [[W * 1.4, 0.18], [W * 0.7, 0.4], [W * 0.25, 1]] as const) {
          ctx.strokeStyle = w === W * 0.25 ? rgba("#ffffff", a * I) : rgba(P.color, a * I);
          ctx.lineWidth = Math.max(1, w);
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (const p of pts) ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        break;
      case "tDashes":
        ctx.lineCap = "round";
        for (let i = 0; i < n; i++) {
          const k0 = i / n, k1 = k0 + 0.5 / n;
          const a = at(k0), b = at(Math.min(0.98, k1));
          ctx.strokeStyle = rgba(P.color, 0.85 * I * (0.3 + 0.7 * k0));
          ctx.lineWidth = Math.max(1, W * 0.45);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        break;
      default:
        // A moment style used as a trail: draw it at the head, halfway through its life.
        drawVfx(ctx, "trail", r, 0.5, { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, dx: 1, dy: 0, s: ballR * 4, power: speed01, w: 0, h: 0 });
    }
  } finally {
    ctx.restore();
  }
}

/** A trail recipe as one moment (the filmstrip): the ball `u` of the way along an arc. */
function drawTrailPreview(ctx: CanvasRenderingContext2D, r: VfxRecipe, u: number, at: VfxAt) {
  const L = at.s * 2.4;
  const pts: { x: number; y: number }[] = [];
  const steps = 14;
  const head = 0.25 + 0.75 * u;
  for (let i = 0; i <= steps; i++) {
    const k = (i / steps) * head;
    pts.push({ x: at.x - L * 0.5 + L * k, y: at.y + L * 0.25 - Math.sin(Math.PI * k) * L * 0.35 });
  }
  drawVfxTrail(ctx, r, pts, at.s / 4.2, 0.9, u * 1.2);
}

// ── Filmstrips ───────────────────────────────────────────────────────────

/** The moments a filmstrip shows (fractions of the effect's life). */
export const FILM_SLICES = [0.04, 0.22, 0.5, 0.85];

/**
 * One filmstrip frame: a patch of grass, the ball (and a goal or a keeper
 * where it helps), and the effect `u` of the way through. Pure.
 */
export function paintThumb(ctx: CanvasRenderingContext2D, event: VfxEvent, r: VfxRecipe, u: number, w: number, h: number): void {
  ctx.save();
  // Camera, as the match would move it.
  const shake = vfxShake(r, u, 1, -0.3);
  const z = vfxZoom(r, u);
  ctx.fillStyle = "#1f7a3c"; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2 + shake.x, h / 2 + shake.y); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 6; i++) ctx.fillRect(i * (w / 6), 0, w / 12, h);
  const goalish = event === "net" || event === "woodwork" || event === "save" || event === "catch" || event === "dive" || event === "nearMiss" || event === "celebration";
  if (goalish) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.2, h * 0.14, w * 0.6, h * 0.36);
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.7;
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(w * 0.2 + i * w * 0.075, h * 0.14); ctx.lineTo(w * 0.2 + i * w * 0.075, h * 0.5); ctx.stroke(); }
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.14 + i * h * 0.09); ctx.lineTo(w * 0.8, h * 0.14 + i * h * 0.09); ctx.stroke(); }
  }
  const base = Math.min(w, h) * 0.3;
  const spot: Record<VfxEvent, [number, number, number, number]> = {
    strike: [0.3, 0.72, 1, -0.4], pass: [0.3, 0.7, 1, -0.2], trail: [0.5, 0.6, 1, -0.2], firstTouch: [0.5, 0.66, 0, 1],
    save: [0.36, 0.3, -1, 0.3], catch: [0.5, 0.34, 0, 1], dive: [0.42, 0.42, -1, 0], woodwork: [0.8, 0.3, -1, 0.5],
    net: [0.55, 0.3, 0, -1], block: [0.5, 0.55, -0.3, 1], header: [0.5, 0.5, 0.3, -1], nearMiss: [0.86, 0.32, 1, -0.3],
    celebration: [0.5, 0.32, 0, -1],
  };
  const [fx, fy, dx, dy] = spot[event];
  const x = w * fx, y = h * fy;
  const ballR = base / 6.5;
  if (event === "save" || event === "catch" || event === "dive") {
    // A keeper silhouette reaching.
    ctx.fillStyle = "#facc15";
    ctx.save(); ctx.translate(event === "dive" ? x + base * 0.4 : x + base * 0.15, y + base * 0.35); ctx.rotate(event === "dive" ? -1.2 : 0);
    ctx.beginPath(); ctx.ellipse(0, 0, base * 0.12, base * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -base * 0.38, base * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (event === "block") {
    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.ellipse(x, y - base * 0.15, base * 0.14, base * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  }
  const at: VfxAt = { x, y, dx, dy, s: base, power: 0.9, w, h, salt: 7 };
  drawVfx(ctx, event, r, u, at);
  if (event === "trail") {
    // The ball at the head of the arc drawTrailPreview lays down.
    const L = base * 2.4, k = 0.25 + 0.75 * u;
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#111111"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x - L * 0.5 + L * k, y + L * 0.25 - Math.sin(Math.PI * k) * L * 0.35, ballR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (event !== "celebration") {
    const travel = event === "strike" || event === "pass" || event === "header" ? Math.max(0, u - 0.05) * base * 1.8 : 0;
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#111111"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x + (dx / (Math.hypot(dx, dy) || 1)) * travel, y + (dy / (Math.hypot(dx, dy) || 1)) * travel, ballR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ── Leo's picks ──────────────────────────────────────────────────────────

export interface VfxNotes {
  edits: Record<string, Partial<VfxParams>>;
  ratings: Record<string, number>;
  notes: Record<string, string>;
  /** event → the variant id he picked. */
  picks: Partial<Record<VfxEvent, string>>;
}
export const EMPTY_VFX_NOTES: VfxNotes = { edits: {}, ratings: {}, notes: {}, picks: {} };

/** Read stored notes safely (junk becomes empty). */
export function sanitizeNotes(raw: unknown): VfxNotes {
  const j = (raw && typeof raw === "object" ? raw : {}) as Partial<VfxNotes>;
  const obj = (v: unknown) => (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const edits: VfxNotes["edits"] = {};
  for (const [k, v] of Object.entries(obj(j.edits))) if (variantById(k)) edits[k] = v as Partial<VfxParams>;
  const ratings: VfxNotes["ratings"] = {};
  for (const [k, v] of Object.entries(obj(j.ratings))) if (typeof v === "number" && v >= 0 && v <= 5) ratings[k] = Math.round(v);
  const notes: VfxNotes["notes"] = {};
  for (const [k, v] of Object.entries(obj(j.notes))) if (typeof v === "string") notes[k] = v.slice(0, 400);
  const picks: VfxNotes["picks"] = {};
  for (const [k, v] of Object.entries(obj(j.picks))) if (typeof v === "string" && variantById(v)?.event === k) picks[k as VfxEvent] = v;
  return { edits, ratings, notes, picks };
}

/** The dials that differ from the variant's own, as "Size 1.40, Colour #ff0000". */
export function describeEdit(v: VfxVariant, edit?: Partial<VfxParams>): string {
  if (!edit) return "as made";
  const p = editedRecipe(v, edit).params, b = v.recipe.params;
  const parts: string[] = [];
  for (const k of NUM_KEYS) if (Math.abs(p[k] - b[k]) > 1e-9) parts.push(`${PARAM_INFO[k].label} ${k === "count" ? p[k] : +p[k].toFixed(3)}${PARAM_INFO[k].unit && PARAM_INFO[k].unit !== "×" ? PARAM_INFO[k].unit : ""}`);
  if (p.color !== b.color) parts.push(`Colour ${p.color}`);
  if (p.color2 !== b.color2) parts.push(`Colour 2 ${p.color2}`);
  if (p.text !== b.text) parts.push(`Word "${p.text}"`);
  return parts.length ? parts.join(", ") : "as made";
}

/** The recipe the live match should draw for each event: the pick (with edits). */
export function picksToOverride(notes: VfxNotes, editing?: { id: string }): VfxOverride {
  const out: VfxOverride = {};
  for (const e of VFX_EVENTS) {
    const id = notes.picks[e.id];
    const v = id ? variantById(id) : undefined;
    if (v) out[e.id] = editedRecipe(v, notes.edits[v.id]);
  }
  if (editing) {
    const v = variantById(editing.id);
    if (v) out[v.event] = editedRecipe(v, notes.edits[v.id]);
  }
  return out;
}

/** The plain-text summary Leo pastes back to us. */
export function exportVfxPicks(notes: VfxNotes): string {
  const lines: string[] = ["Visual Effects Lab picks (Leo)"];
  for (const e of VFX_EVENTS) {
    const list = VFX_VARIANTS[e.id];
    const pick = notes.picks[e.id];
    const rated = list.filter((v) => (notes.ratings[v.id] ?? 0) > 0 || (notes.notes[v.id] ?? "").trim());
    if (!pick && rated.length === 0) continue;
    lines.push("", `${e.label}:`);
    const pv = pick ? list.find((v) => v.id === pick) : undefined;
    if (pv) {
      lines.push(`  PICK → ${pv.name} [${pv.id}] style=${pv.recipe.style}${notes.ratings[pv.id] ? ` ${"★".repeat(notes.ratings[pv.id])}` : ""}`);
      lines.push(`    dials: ${describeEdit(pv, notes.edits[pv.id])}`);
      const p = editedRecipe(pv, notes.edits[pv.id]).params;
      lines.push(`    recipe: ${JSON.stringify({ style: pv.recipe.style, ...pickUsed(pv.recipe.style, p) })}`);
      if (notes.notes[pv.id]?.trim()) lines.push(`    note: ${notes.notes[pv.id].trim()}`);
    }
    for (const v of rated) {
      if (v.id === pick) continue;
      lines.push(`  ${v.name} [${v.id}] ${"★".repeat(notes.ratings[v.id] ?? 0) || "(no stars)"}${notes.notes[v.id]?.trim() ? ` — ${notes.notes[v.id].trim()}` : ""}${notes.edits[v.id] ? ` (dials: ${describeEdit(v, notes.edits[v.id])})` : ""}`);
    }
  }
  if (lines.length === 1) lines.push("", "(nothing picked or rated yet)");
  return lines.join("\n");
}

/** Only the dials a style listens to. */
export function pickUsed(style: VfxStyle, p: VfxParams): Partial<VfxParams> {
  const out: Partial<VfxParams> = {};
  for (const k of STYLE_PARAMS[style]) (out as Record<string, unknown>)[k] = p[k];
  return out;
}
