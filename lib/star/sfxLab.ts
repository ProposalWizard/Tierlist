/**
 * SOUND LAB — candidate sounds for the match, as editable recipes.
 *
 * Leo, 14 Oct 2026: "make a testing area where I can view and edit loads of
 * different sounds for loads of different things (ball kick, goalie save, ball
 * hits net, ball blocked, pass, goal, etc). Like make like 5–10 different
 * effects I can view and edit and tell you about what I prefer."
 *
 * Every candidate is a small recipe: a few layers (a tone that glides, or a
 * filtered noise burst), each with its own envelope. `renderRecipe` turns a
 * recipe plus the page's edit dials into samples with a pure function — no
 * browser, no Web Audio, seeded noise — so the same recipe always sounds the
 * same and the tests can check every one in node. The page plays the samples
 * through an AudioBuffer.
 *
 * "Current (match)" recipes copy the live match's own synthesised sounds
 * (lib/star/matchSound.ts) layer for layer, so the lab starts from what the
 * game plays today. Nothing here is wired into the game.
 *
 * Pure data and maths — no imports — so node and the browser share it.
 */

export type Wave = "sine" | "triangle" | "square" | "saw";
export type FilterKind = "lowpass" | "highpass" | "bandpass";

interface LayerBase {
  /** Seconds from the start of the sound. */
  delay?: number;
  /** Seconds the layer lasts (attack + hold + decay). */
  dur: number;
  /** Peak level, 0–1. */
  gain: number;
  /** Seconds to reach the peak. */
  attack?: number;
  /** Fraction (0–1) of the time after the attack held at the peak before the decay. */
  hold?: number;
  /** Wobble in the level: rate in Hz and depth 0–1 (crowd chatter, net ripple). */
  amRate?: number;
  amDepth?: number;
}
export interface ToneLayer extends LayerBase {
  type: "tone";
  wave: Wave;
  /** Start pitch, Hz. */
  f0: number;
  /** End pitch, Hz (an exponential glide); same as f0 when left out. */
  f1?: number;
  /** Pitch wobble (whistle trill, a ringing bar): rate in Hz, depth as a fraction of the pitch. */
  vibRate?: number;
  vibDepth?: number;
}
export interface NoiseLayer extends LayerBase {
  type: "noise";
  filter: FilterKind;
  /** Filter centre/corner, Hz. */
  freq: number;
  /** Filter frequency at the end (an exponential sweep). */
  freqEnd?: number;
  q?: number;
  /** Seed for this layer's noise, so it is the same every time. */
  seed?: number;
}
export type Layer = ToneLayer | NoiseLayer;

export interface Recipe {
  layers: Layer[];
  /** Built-in room (0–1); the Room dial adds to it. */
  room?: number;
}

/** The page's edit dials. Neutral values change nothing. */
export interface Tweak {
  /** Level ×, 0–2. */
  volume: number;
  /** Semitones, −12…+12. */
  pitch: number;
  /** Length ×, 0.5–2. */
  length: number;
  /** −1 (dark) … +1 (bright). */
  brightness: number;
  /** −1 (soft attack) … +1 (hard hit). */
  punch: number;
  /** −1 (thin) … +1 (heavy low end). */
  body: number;
  /** Reverb added, 0–1. */
  room: number;
}
export const NEUTRAL: Tweak = { volume: 1, pitch: 0, length: 1, brightness: 0, punch: 0, body: 0, room: 0 };

export const TWEAK_DIALS: { key: keyof Tweak; label: string; min: number; max: number; step: number }[] = [
  { key: "volume", label: "Volume", min: 0, max: 2, step: 0.05 },
  { key: "pitch", label: "Pitch", min: -12, max: 12, step: 1 },
  { key: "length", label: "Length", min: 0.5, max: 2, step: 0.05 },
  { key: "brightness", label: "Brightness", min: -1, max: 1, step: 0.05 },
  { key: "punch", label: "Punch", min: -1, max: 1, step: 0.05 },
  { key: "body", label: "Body (low end)", min: -1, max: 1, step: 0.05 },
  { key: "room", label: "Room (echo)", min: 0, max: 1, step: 0.05 },
];

export interface Candidate {
  id: string;
  name: string;
  /** One line: what it is meant to sound like. */
  about: string;
  recipe?: Recipe;
  /** A real file (public/sfx/<name>.mp3, or its Sound Board replacement). */
  file?: string;
  /** "match" = the live match's sound today; "file" = the game's recorded file. */
  current?: "match" | "file";
}

export interface LabEvent {
  id: string;
  label: string;
  emoji: string;
  candidates: Candidate[];
}

// ── Building blocks for the table below ──────────────────────────────────────
const t = (wave: Wave, f0: number, f1: number, dur: number, gain: number, x: Partial<ToneLayer> = {}): ToneLayer =>
  ({ type: "tone", wave, f0, f1, dur, gain, ...x });
const n = (filter: FilterKind, freq: number, dur: number, gain: number, x: Partial<NoiseLayer> = {}): NoiseLayer =>
  ({ type: "noise", filter, freq, dur, gain, attack: 0.002, ...x });
const R = (layers: Layer[], room = 0): Recipe => ({ layers, room });

// The live match's sounds today, layer for layer (lib/star/matchSound.ts).
const MATCH_KICK = R([t("sine", 120, 55, 0.12, 0.55, { attack: 0.006 }), n("bandpass", 1800, 0.08, 0.22, { q: 0.7 })]);
const MATCH_STRIKE = R([ // playStrike(power 1, gain 1, bass 0.5, clean)
  t("sine", 117.5, 45, 0.22, 0.85, { attack: 0.006 }),
  t("sine", 60, 32, 0.24, 0.35, { attack: 0.006 }),
  n("bandpass", 4200, 0.065, 0.5, { q: 0.9 }),
  n("lowpass", 900, 0.07, 0.12, { q: 0.7 }),
]);
const MATCH_THUD = R([t("sine", 110, 55, 0.11, 0.24, { attack: 0.006 }), n("lowpass", 600, 0.06, 0.098, { q: 0.8 })]); // playThud(0.4)
const MATCH_SAVE = R([t("sine", 180, 90, 0.14, 0.4, { attack: 0.006 }), n("lowpass", 700, 0.1, 0.25, { q: 1.2 })]);
const MATCH_GLOVE_PARRY = R([t("sine", 190, 100, 0.1, 0.54, { attack: 0.006 }), n("bandpass", 1800, 0.05, 0.42, { q: 1.1 })]);
const MATCH_GLOVE_HELD = R([t("sine", 140, 70, 0.16, 0.54, { attack: 0.006 }), n("bandpass", 900, 0.05, 0.42, { q: 1.1 })]);
const MATCH_CLANG = R([
  t("triangle", 640, 600, 0.7, 0.35, { attack: 0.006 }),
  t("sine", 1710, 1650, 0.5, 0.18, { attack: 0.006 }),
  t("sine", 2930, 2900, 0.3, 0.08, { attack: 0.006 }),
  n("bandpass", 3500, 0.04, 0.3, { q: 1.2 }),
]);
const MATCH_POST = R([t("triangle", 880, 760, 0.5, 0.4, { attack: 0.006 }), t("sine", 1320, 1180, 0.45, 0.22, { attack: 0.006 })]);
const MATCH_NET = R([n("bandpass", 2600, 0.32, 0.35, { q: 0.5 }), n("highpass", 5200, 0.22, 0.18, { q: 0.4, seed: 2 })]);
const MATCH_WHISTLE = R([t("square", 2325, 2325, 0.22, 0.18, { attack: 0.01, vibRate: 10, vibDepth: 0.054 })]);
const MATCH_CHEER = R([n("bandpass", 1400, 1.6, 0.28, { q: 0.6 }), n("highpass", 3080, 1.28, 0.168, { q: 0.4, seed: 2 })]);
const MATCH_GROAN = R([n("bandpass", 500, 0.9, 0.16, { q: 0.6 })]);

/** A crowd: several voices (filtered noise bands) chattering at different rates. */
function crowd(o: { dur: number; gain: number; attack: number; hold: number; centre: number; spread?: number; voices?: number; chatter?: number; seed?: number }): Layer[] {
  const voices = o.voices ?? 5;
  const spread = o.spread ?? 1;
  const out: Layer[] = [];
  for (let i = 0; i < voices; i++) {
    const k = voices === 1 ? 0 : i / (voices - 1) - 0.5; // −0.5 … 0.5
    out.push(n("bandpass", o.centre * Math.pow(2, k * 2.4 * spread), o.dur * (1 - 0.06 * i), o.gain / Math.sqrt(voices) * (1 - Math.abs(k) * 0.6), {
      q: 0.9, attack: o.attack * (1 + 0.15 * i), hold: o.hold,
      amRate: (o.chatter ?? 6) * (0.7 + 0.17 * i), amDepth: 0.35, seed: (o.seed ?? 11) + i,
    }));
  }
  out.push(n("lowpass", 260, o.dur, o.gain * 0.35, { attack: o.attack, hold: o.hold, seed: (o.seed ?? 11) + 50 }));
  return out;
}
/** A crowd "ooh": a vowel made of formant bands that rise then fall. */
function ooh(o: { dur: number; gain: number; attack: number; from: number; to: number; seed?: number }): Layer[] {
  return [
    n("bandpass", o.from, o.dur, o.gain, { freqEnd: o.to, q: 5, attack: o.attack, hold: 0.25, amRate: 5.5, amDepth: 0.2, seed: o.seed ?? 21 }),
    n("bandpass", o.from * 2.1, o.dur, o.gain * 0.5, { freqEnd: o.to * 2, q: 5, attack: o.attack, hold: 0.25, amRate: 7, amDepth: 0.25, seed: (o.seed ?? 21) + 1 }),
    n("bandpass", 2600, o.dur * 0.9, o.gain * 0.12, { q: 2, attack: o.attack, hold: 0.2, seed: (o.seed ?? 21) + 2 }),
    n("lowpass", 300, o.dur, o.gain * 0.45, { attack: o.attack, hold: 0.25, seed: (o.seed ?? 21) + 3 }),
  ];
}
/** A pea whistle blast. */
const blast = (delay: number, dur: number, gain = 0.32, f = 2800): Layer[] => [
  t("sine", f, f, dur, gain, { delay, attack: 0.012, hold: 0.75, vibRate: 34, vibDepth: 0.035 }),
  t("sine", f * 2, f * 2, dur, gain * 0.12, { delay, attack: 0.012, hold: 0.75, vibRate: 34, vibDepth: 0.035 }),
  n("bandpass", f, dur, gain * 0.25, { delay, q: 3, attack: 0.01, hold: 0.7, seed: 31 + Math.round(delay * 10) }),
];

const file = (id: string, name: string, about: string, fileName: string): Candidate =>
  ({ id, name, about, file: fileName, current: "file" });

// ── The events and their candidates ──────────────────────────────────────────
export const LAB_EVENTS: LabEvent[] = [
  {
    id: "kick-soft", label: "Pass (soft kick)", emoji: "🦶",
    candidates: [
      { id: "kick-soft/match", name: "Current (match)", about: "What the live match plays for a pass today.", recipe: MATCH_KICK, current: "match" },
      file("kick-soft/file", "Current file", "The recorded file used in goal videos.", "kick-soft"),
      { id: "kick-soft/leather", name: "Soft leather", about: "A rounder, gentler side-foot.", recipe: R([t("sine", 140, 70, 0.09, 0.5), n("bandpass", 1200, 0.05, 0.25, { q: 1 })]) },
      { id: "kick-soft/grass", name: "Grass side-foot", about: "Boot brushing the turf as it hits.", recipe: R([t("sine", 110, 60, 0.1, 0.45), n("lowpass", 700, 0.09, 0.3), n("highpass", 4000, 0.02, 0.08, { seed: 2 })]) },
      { id: "kick-soft/crisp", name: "Crisp tap", about: "Short and clean, a sharp click.", recipe: R([t("sine", 180, 90, 0.06, 0.4), n("bandpass", 2600, 0.03, 0.35, { q: 1.4 })]) },
      { id: "kick-soft/hollow", name: "Hollow pop", about: "You can hear the air in the ball.", recipe: R([t("sine", 220, 120, 0.08, 0.45), t("triangle", 440, 300, 0.04, 0.12), n("bandpass", 1500, 0.03, 0.2)]) },
      { id: "kick-soft/tv", name: "Muffled TV", about: "As heard through a broadcast mic.", recipe: R([t("sine", 100, 55, 0.11, 0.5), n("lowpass", 500, 0.08, 0.3)]) },
      { id: "kick-soft/studio", name: "Studio click", about: "A tidy game-style tick.", recipe: R([t("sine", 160, 80, 0.05, 0.4), n("highpass", 5000, 0.015, 0.25), n("bandpass", 2000, 0.04, 0.2, { seed: 2 })]) },
      { id: "kick-soft/wet", name: "Wet pitch", about: "A rainy night: a little splash after the hit.", recipe: R([t("sine", 120, 60, 0.1, 0.45), n("bandpass", 900, 0.12, 0.25, { q: 0.6 }), n("highpass", 6000, 0.08, 0.07, { delay: 0.01, seed: 2 })]) },
    ],
  },
  {
    id: "kick-hard", label: "Shot (hard kick)", emoji: "💥",
    candidates: [
      { id: "kick-hard/match", name: "Current (match)", about: "The live match's full-power clean strike today.", recipe: MATCH_STRIKE, current: "match" },
      file("kick-hard/file", "Current file", "The recorded file used in goal videos.", "kick-hard"),
      { id: "kick-hard/boom", name: "Big boom", about: "Deep and heavy, a thunderous hit.", recipe: R([t("sine", 90, 35, 0.3, 0.9), t("sine", 55, 30, 0.35, 0.5), n("bandpass", 3000, 0.06, 0.5)]) },
      { id: "kick-hard/crack", name: "Leather crack", about: "A bright whip on top of the thump.", recipe: R([t("sine", 130, 50, 0.18, 0.7), n("bandpass", 4500, 0.04, 0.7, { q: 1.2 }), n("highpass", 7000, 0.02, 0.3, { seed: 2 })]) },
      { id: "kick-hard/thwack", name: "Thwack", about: "Mid-heavy, like the TV effects mic.", recipe: R([t("sine", 150, 60, 0.15, 0.75), n("bandpass", 2000, 0.07, 0.55, { q: 0.8 }), n("lowpass", 600, 0.12, 0.3, { seed: 2 })]) },
      { id: "kick-hard/volley", name: "Volley smash", about: "Big hit with a bit of stadium around it.", recipe: R([t("sine", 110, 40, 0.25, 0.85), n("bandpass", 3500, 0.08, 0.6, { q: 0.7 })], 0.3) },
      { id: "kick-hard/echo", name: "Stadium echo", about: "Today's strike in a big empty stadium.", recipe: { ...MATCH_STRIKE, room: 0.5 } },
      { id: "kick-hard/thump", name: "Dull thump", about: "All body, no crack.", recipe: R([t("sine", 80, 40, 0.28, 0.9), n("lowpass", 800, 0.12, 0.45)]) },
      { id: "kick-hard/sting", name: "Sharp sting", about: "Thin and stinging, a toe-poke rocket.", recipe: R([t("triangle", 200, 70, 0.12, 0.55), n("bandpass", 5500, 0.03, 0.6, { q: 1.5 }), n("bandpass", 1500, 0.05, 0.3, { seed: 2 })]) },
    ],
  },
  {
    id: "touch", label: "First touch (pass received)", emoji: "🎯",
    candidates: [
      { id: "touch/match", name: "Current (match)", about: "The match has no touch sound; this is its ball-landing thud.", recipe: MATCH_THUD, current: "match" },
      { id: "touch/cushion", name: "Cushioned", about: "Killed dead on the instep.", recipe: R([t("sine", 120, 70, 0.08, 0.3), n("lowpass", 500, 0.07, 0.2)]) },
      { id: "touch/sticky", name: "Sticky stop", about: "Short and firm, under the sole.", recipe: R([t("sine", 150, 90, 0.05, 0.35), n("bandpass", 900, 0.05, 0.25)]) },
      { id: "touch/laces", name: "Laces trap", about: "A little click off the boot.", recipe: R([t("sine", 130, 65, 0.07, 0.32), n("bandpass", 1600, 0.03, 0.22, { q: 1.2 })]) },
      { id: "touch/chest", name: "Chest down", about: "Soft and padded, off the shirt.", recipe: R([t("sine", 90, 50, 0.12, 0.35), n("lowpass", 350, 0.1, 0.28)]) },
      { id: "touch/dribble", name: "Dribble tap", about: "A quick light touch on the run.", recipe: R([t("sine", 200, 110, 0.04, 0.25), n("bandpass", 2400, 0.02, 0.2)]) },
      { id: "touch/bounce", name: "Bounce then stop", about: "Ball bounces once, then the touch.", recipe: R([t("sine", 130, 70, 0.06, 0.25), n("lowpass", 600, 0.05, 0.15), t("sine", 120, 65, 0.06, 0.18, { delay: 0.12 }), n("lowpass", 600, 0.05, 0.1, { delay: 0.12, seed: 2 })]) },
    ],
  },
  {
    id: "save", label: "Keeper save (parry)", emoji: "🧤",
    candidates: [
      { id: "save/match", name: "Current (match)", about: "Today's glove sound for a parry.", recipe: MATCH_GLOVE_PARRY, current: "match" },
      { id: "save/match-old", name: "Current (old feel)", about: "The older, plainer save sound the match still uses in places.", recipe: MATCH_SAVE, current: "match" },
      file("save/file", "Current file", "The recorded file used in goal videos.", "keeper-save"),
      { id: "save/slap", name: "Glove slap", about: "Bright smack of foam glove on ball.", recipe: R([t("sine", 220, 110, 0.07, 0.45), n("bandpass", 2400, 0.04, 0.55, { q: 1.3 }), n("highpass", 6000, 0.02, 0.15, { seed: 2 })]) },
      { id: "save/palm", name: "Strong palm", about: "A firm, solid push away.", recipe: R([t("sine", 160, 80, 0.12, 0.6), n("bandpass", 1400, 0.06, 0.45)]) },
      { id: "save/fingertip", name: "Fingertip", about: "Just a touch on it — light and high.", recipe: R([t("sine", 260, 150, 0.05, 0.25), n("bandpass", 3200, 0.03, 0.35, { q: 1.6 })]) },
      { id: "save/punch", name: "Punch clear", about: "Fist through the ball, heavy.", recipe: R([t("sine", 140, 60, 0.15, 0.65), n("lowpass", 900, 0.1, 0.4), n("bandpass", 2000, 0.04, 0.3, { seed: 2 })]) },
      { id: "save/rubber", name: "Rubbery smack", about: "Bouncy, a bit cartoon.", recipe: R([t("triangle", 300, 140, 0.06, 0.3), n("bandpass", 1800, 0.05, 0.45, { q: 2 })]) },
    ],
  },
  {
    id: "catch", label: "Keeper catch (held)", emoji: "🫴",
    candidates: [
      { id: "catch/match", name: "Current (match)", about: "Today's glove sound when he holds it.", recipe: MATCH_GLOVE_HELD, current: "match" },
      file("catch/file", "Current file", "The recorded keeper file (also used for saves).", "keeper-save"),
      { id: "catch/soft", name: "Soft grab", about: "Quiet and safe.", recipe: R([t("sine", 130, 70, 0.12, 0.4), n("lowpass", 700, 0.1, 0.3)]) },
      { id: "catch/chest", name: "Clutched to chest", about: "Gathered in, padded thump.", recipe: R([t("sine", 100, 55, 0.18, 0.55), n("lowpass", 400, 0.15, 0.35), n("bandpass", 1200, 0.04, 0.15, { seed: 2 })]) },
      { id: "catch/squeak", name: "Leather squeak", about: "Grip on the ball, a little squeak.", recipe: R([t("sine", 150, 80, 0.1, 0.4), n("bandpass", 1000, 0.06, 0.3), t("sine", 1800, 2400, 0.08, 0.04, { delay: 0.02 })]) },
      { id: "catch/safe", name: "Safe hands", about: "Firm, mid-weight catch.", recipe: R([t("sine", 120, 60, 0.14, 0.5), n("bandpass", 700, 0.08, 0.35, { q: 0.9 })]) },
      { id: "catch/dive", name: "Diving catch", about: "Catch, then he lands on the grass.", recipe: R([t("sine", 140, 70, 0.1, 0.45), n("bandpass", 900, 0.05, 0.3), t("sine", 80, 40, 0.2, 0.4, { delay: 0.18 }), n("lowpass", 300, 0.2, 0.35, { delay: 0.18, seed: 2 })]) },
    ],
  },
  {
    id: "post", label: "Ball hits post / bar", emoji: "🥅",
    candidates: [
      { id: "post/match", name: "Current (match)", about: "Today's woodwork clang.", recipe: MATCH_CLANG, current: "match" },
      { id: "post/match-old", name: "Current (old feel)", about: "The older, higher ping.", recipe: MATCH_POST, current: "match" },
      { id: "post/ring", name: "Big ring", about: "Long metal ring, keeps going.", recipe: R([t("sine", 520, 515, 1.2, 0.35), t("sine", 1385, 1380, 0.9, 0.2), t("sine", 2460, 2455, 0.6, 0.1), n("bandpass", 3000, 0.03, 0.4)]) },
      { id: "post/thunk", name: "Dull thunk", about: "Solid and short, a thick post.", recipe: R([t("sine", 300, 250, 0.3, 0.4), t("triangle", 900, 880, 0.2, 0.15), n("lowpass", 1200, 0.06, 0.4)]) },
      { id: "post/ping", name: "Ping", about: "High and thin, the classic 'off the bar'.", recipe: R([t("sine", 1200, 1180, 0.6, 0.3), t("sine", 3100, 3080, 0.4, 0.12), n("highpass", 5000, 0.02, 0.3)]) },
      { id: "post/shudder", name: "Bar shudder", about: "The crossbar wobbles after it.", recipe: R([t("triangle", 450, 440, 0.9, 0.3, { vibRate: 9, vibDepth: 0.01, amRate: 9, amDepth: 0.4 }), t("sine", 1150, 1140, 0.7, 0.15, { vibRate: 9, vibDepth: 0.01 }), n("bandpass", 2500, 0.05, 0.35)]) },
      { id: "post/gasp", name: "Clang + crowd gasp", about: "Today's clang, the crowd gasps after.", recipe: R([...MATCH_CLANG.layers, ...ooh({ dur: 1.0, gain: 0.14, attack: 0.15, from: 450, to: 600, seed: 40 }).map(l => ({ ...l, delay: 0.12 }))]) },
    ],
  },
  {
    id: "net", label: "Ball hits net", emoji: "🕸️",
    candidates: [
      { id: "net/match", name: "Current (match)", about: "Today's net rustle.", recipe: MATCH_NET, current: "match" },
      file("net/file", "Current file", "The recorded file used in goal videos.", "goal-net"),
      { id: "net/swish", name: "Swish", about: "One smooth swoosh into the net.", recipe: R([n("bandpass", 3500, 0.4, 0.35, { freqEnd: 1500, q: 0.6, attack: 0.03 })]) },
      { id: "net/ripple", name: "Rippling", about: "The net shakes and ripples.", recipe: R([n("bandpass", 2200, 0.5, 0.3, { amRate: 22, amDepth: 0.6, q: 0.5 }), n("highpass", 6000, 0.3, 0.1, { seed: 2 })]) },
      { id: "net/thump", name: "Thump into net", about: "Ball hits the back, then the rustle.", recipe: R([t("sine", 120, 60, 0.1, 0.4), n("bandpass", 2000, 0.35, 0.3, { freqEnd: 900 })]) },
      { id: "net/rattle", name: "Rope rattle", about: "Rattly, like the net's ropes.", recipe: R([n("bandpass", 1500, 0.4, 0.3, { amRate: 35, amDepth: 0.8, q: 1.5 }), n("highpass", 4000, 0.2, 0.12, { seed: 2 })]) },
      { id: "net/bulge", name: "Bulge", about: "Soft and deep, the net balloons out.", recipe: R([n("lowpass", 1200, 0.5, 0.4, { attack: 0.05, freqEnd: 400 }), n("highpass", 5000, 0.25, 0.12, { seed: 2 })]) },
      { id: "net/mesh", name: "Crisp mesh", about: "Bright, tight new net.", recipe: R([n("highpass", 5000, 0.25, 0.3), n("bandpass", 8000, 0.15, 0.15, { q: 2, seed: 2 })]) },
    ],
  },
  {
    id: "block", label: "Ball blocked (body)", emoji: "🛡️",
    candidates: [
      { id: "block/match", name: "Current (match)", about: "The match plays its plain save sound for a block.", recipe: MATCH_SAVE, current: "match" },
      { id: "block/thud", name: "Body thud", about: "Into the stomach — deep, dull.", recipe: R([t("sine", 110, 50, 0.15, 0.6), n("lowpass", 500, 0.12, 0.4)]) },
      { id: "block/shin", name: "Shin block", about: "Off a shin pad: harder, clackier.", recipe: R([t("sine", 170, 80, 0.08, 0.5), n("bandpass", 1800, 0.04, 0.45, { q: 1.2 }), n("lowpass", 600, 0.08, 0.2, { seed: 2 })]) },
      { id: "block/oof", name: "Thud + 'oof'", about: "Hit, and the defender grunts.", recipe: R([t("sine", 100, 50, 0.14, 0.55), n("lowpass", 400, 0.1, 0.35), n("bandpass", 600, 0.25, 0.15, { delay: 0.05, freqEnd: 400, q: 3, attack: 0.03, seed: 2 })]) },
      { id: "block/slap", name: "Slap block", about: "Off a thigh, a sharp slap.", recipe: R([t("sine", 200, 100, 0.06, 0.4), n("bandpass", 3000, 0.04, 0.5, { q: 1 })]) },
      { id: "block/heavy", name: "Heavy deflection", about: "Big hit, ball flies off.", recipe: R([t("sine", 90, 40, 0.2, 0.7), n("bandpass", 1200, 0.08, 0.35)], 0.2) },
      { id: "block/muffled", name: "Muffled", about: "Soft, mostly low end.", recipe: R([t("sine", 120, 60, 0.12, 0.5), n("lowpass", 350, 0.12, 0.4)]) },
    ],
  },
  {
    id: "header", label: "Header", emoji: "🗣️",
    candidates: [
      { id: "header/match", name: "Current (match)", about: "The match has no header sound: it plays the kick.", recipe: MATCH_KICK, current: "match" },
      { id: "header/thock", name: "Head thock", about: "Hard forehead, a higher knock.", recipe: R([t("sine", 250, 140, 0.07, 0.45), n("bandpass", 1400, 0.04, 0.3, { q: 1.3 })]) },
      { id: "header/nod", name: "Firm nod", about: "Solid, mid-weight.", recipe: R([t("sine", 180, 90, 0.1, 0.55), n("bandpass", 1800, 0.05, 0.35)]) },
      { id: "header/glance", name: "Glance", about: "Just a flick off the hair.", recipe: R([t("sine", 300, 180, 0.05, 0.3), n("highpass", 3000, 0.03, 0.25)]) },
      { id: "header/power", name: "Power header", about: "Attacked with the whole body.", recipe: R([t("sine", 160, 70, 0.14, 0.65), n("bandpass", 2200, 0.06, 0.45), n("lowpass", 700, 0.1, 0.25, { seed: 2 })]) },
      { id: "header/bonk", name: "Hollow bonk", about: "Comedy-hollow, ball on skull.", recipe: R([t("sine", 330, 220, 0.1, 0.4), t("triangle", 660, 500, 0.06, 0.12), n("bandpass", 1200, 0.03, 0.2)]) },
      { id: "header/grunt", name: "Thud + grunt", about: "Head hits it and he grunts.", recipe: R([t("sine", 180, 90, 0.08, 0.45), n("bandpass", 1500, 0.04, 0.3), n("bandpass", 500, 0.2, 0.12, { delay: 0.03, q: 4, freqEnd: 350, attack: 0.02, seed: 2 })]) },
    ],
  },
  {
    id: "whistle", label: "Referee whistle", emoji: "📣",
    candidates: [
      { id: "whistle/match", name: "Current (match)", about: "Today's synthesised whistle.", recipe: MATCH_WHISTLE, current: "match" },
      file("whistle/file-start", "Current file: kick-off", "The recorded kick-off whistle (not played in the game yet).", "whistle-start"),
      file("whistle/file-full", "Current file: full time", "The recorded full-time whistle (not played yet).", "whistle-full"),
      { id: "whistle/pea", name: "Pea whistle", about: "A real ref's trill, short.", recipe: R(blast(0, 0.32)) },
      { id: "whistle/long", name: "Long blast", about: "One long one — stop play.", recipe: R(blast(0, 0.9)) },
      { id: "whistle/two", name: "Two short", about: "Half time style.", recipe: R([...blast(0, 0.22), ...blast(0.32, 0.22)]) },
      { id: "whistle/three", name: "Three blasts", about: "Full time: short, short, long.", recipe: R([...blast(0, 0.22), ...blast(0.33, 0.22), ...blast(0.66, 0.8)]) },
      { id: "whistle/fox", name: "No-pea whistle", about: "Clean, pure, no trill.", recipe: R([t("triangle", 3100, 3100, 0.4, 0.3, { attack: 0.01, hold: 0.7 }), t("sine", 3150, 3150, 0.4, 0.2, { attack: 0.01, hold: 0.7 })]) },
      { id: "whistle/distant", name: "Distant ref", about: "Across a big stadium.", recipe: R(blast(0, 0.35, 0.25, 2500), 0.6) },
    ],
  },
  {
    id: "goal", label: "Goal (crowd roar)", emoji: "🎉",
    candidates: [
      { id: "goal/match", name: "Current (match)", about: "Today's goal cheer in the match.", recipe: MATCH_CHEER, current: "match" },
      file("goal/file-stadium", "Current file: stadium", "The recorded big-stadium roar (goal videos).", "crowd-cheer-stadium"),
      file("goal/file-small", "Current file: small ground", "The recorded small-ground cheer (not played yet).", "crowd-cheer-small"),
      { id: "goal/stadium", name: "Stadium roar", about: "A full stadium going up.", recipe: R(crowd({ dur: 2.8, gain: 0.55, attack: 0.25, hold: 0.35, centre: 1100, voices: 6 }), 0.35) },
      { id: "goal/small", name: "Small ground", about: "A few thousand, thinner.", recipe: R(crowd({ dur: 1.8, gain: 0.35, attack: 0.15, hold: 0.25, centre: 1300, voices: 3, chatter: 8, seed: 70 }), 0.15) },
      { id: "goal/erupt", name: "Eruption", about: "Instant explosion of noise.", recipe: R([n("bandpass", 1600, 0.25, 0.4, { q: 0.5, seed: 90 }), ...crowd({ dur: 2.5, gain: 0.6, attack: 0.05, hold: 0.4, centre: 1200, voices: 6, seed: 80 })], 0.3) },
      { id: "goal/claps", name: "Roar + claps", about: "Roar with clapping underneath.", recipe: R([...crowd({ dur: 2.6, gain: 0.45, attack: 0.2, hold: 0.35, centre: 1000, voices: 5, seed: 100 }), n("bandpass", 2400, 2.4, 0.18, { q: 1, attack: 0.4, hold: 0.4, amRate: 4.5, amDepth: 0.95, seed: 120 })], 0.3) },
      { id: "goal/far", name: "Far away", about: "Heard from outside the ground.", recipe: R(crowd({ dur: 2.8, gain: 0.4, attack: 0.3, hold: 0.35, centre: 600, voices: 5, spread: 0.6, seed: 130 }), 0.7) },
      { id: "goal/wave", name: "Rising wave", about: "Builds and builds.", recipe: R(crowd({ dur: 3.4, gain: 0.55, attack: 1.2, hold: 0.2, centre: 1100, voices: 6, seed: 140 }), 0.35) },
      { id: "goal/away", name: "Away end", about: "Only the travelling fans cheer.", recipe: R(crowd({ dur: 2.0, gain: 0.3, attack: 0.15, hold: 0.3, centre: 1500, voices: 3, spread: 0.5, chatter: 9, seed: 150 }), 0.5) },
    ],
  },
  {
    id: "ooh", label: "Near miss (crowd 'ooh')", emoji: "😮",
    candidates: [
      { id: "ooh/match", name: "Current (match)", about: "Today's near-miss crowd sound.", recipe: MATCH_GROAN, current: "match" },
      file("ooh/file", "Current file", "The recorded groan (not played in the game yet).", "crowd-groan"),
      { id: "ooh/classic", name: "Classic 'ooh'", about: "Rises, then falls away.", recipe: R(ooh({ dur: 1.4, gain: 0.32, attack: 0.15, from: 400, to: 550 }), 0.3) },
      { id: "ooh/aah", name: "'Ooh-aah'", about: "Ooh into a disappointed aah.", recipe: R([...ooh({ dur: 0.8, gain: 0.3, attack: 0.12, from: 380, to: 480, seed: 160 }), ...ooh({ dur: 1.0, gain: 0.26, attack: 0.1, from: 700, to: 520, seed: 170 }).map(l => ({ ...l, delay: 0.55 }))], 0.3) },
      { id: "ooh/gasp", name: "Sharp gasp", about: "A sudden intake of breath.", recipe: R([n("highpass", 1500, 0.5, 0.25, { attack: 0.04, freqEnd: 2500, amRate: 6, amDepth: 0.3, seed: 180 }), ...ooh({ dur: 0.7, gain: 0.18, attack: 0.05, from: 500, to: 600, seed: 190 })], 0.25) },
      { id: "ooh/groan", name: "Groan", about: "Falls away, fed up.", recipe: R(ooh({ dur: 1.5, gain: 0.32, attack: 0.1, from: 600, to: 280, seed: 200 }), 0.3) },
      { id: "ooh/stadium", name: "Big stadium 'ooh'", about: "Huge and echoing.", recipe: R([...ooh({ dur: 1.8, gain: 0.35, attack: 0.2, from: 420, to: 560, seed: 210 }), ...crowd({ dur: 1.8, gain: 0.15, attack: 0.2, hold: 0.2, centre: 900, voices: 3, seed: 220 })], 0.6) },
      { id: "ooh/murmur", name: "Murmur", about: "Quiet, a buzz through the crowd.", recipe: R(crowd({ dur: 1.6, gain: 0.22, attack: 0.3, hold: 0.2, centre: 500, voices: 4, spread: 0.5, chatter: 4, seed: 230 }), 0.3) },
    ],
  },
];

export function eventById(id: string): LabEvent | undefined {
  return LAB_EVENTS.find(e => e.id === id);
}
export function candidateById(id: string): Candidate | undefined {
  for (const e of LAB_EVENTS) for (const c of e.candidates) if (c.id === id) return c;
  return undefined;
}

// ── The synthesis ────────────────────────────────────────────────────────────

/** Seeded noise (mulberry32), −1…1. */
function noiseGen(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** RBJ biquad, coefficients recomputed as the frequency moves. */
class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(private kind: FilterKind | "lowshelf" | "highshelf", private sr: number) {}
  set(freq: number, q: number, gainDb = 0): void {
    const f = Math.max(10, Math.min(this.sr * 0.45, freq));
    const w = (2 * Math.PI * f) / this.sr;
    const cw = Math.cos(w), sw = Math.sin(w);
    const alpha = sw / (2 * Math.max(0.05, q));
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    if (this.kind === "lowpass") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
    else if (this.kind === "highpass") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
    else if (this.kind === "bandpass") { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
    else {
      const A = Math.pow(10, gainDb / 40);
      const s = 2 * Math.sqrt(A) * (sw / (2 * 0.707));
      if (this.kind === "lowshelf") {
        b0 = A * ((A + 1) - (A - 1) * cw + s); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s);
        a0 = (A + 1) + (A - 1) * cw + s; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s;
      } else {
        b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s);
        a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s;
      }
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  step(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Attack, hold, then an exponential fall to silence at `dur` (like matchSound's envGain). */
function envAt(tt: number, dur: number, attack: number, hold: number): number {
  if (tt < 0 || tt > dur) return 0;
  const a = Math.min(attack, dur * 0.9);
  if (tt < a) return tt / Math.max(1e-4, a);
  const rest = dur - a;
  const h = rest * Math.max(0, Math.min(0.95, hold));
  if (tt < a + h) return 1;
  const d = rest - h;
  return Math.exp(Math.log(0.001) * (tt - a - h) / Math.max(1e-4, d));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function fullTweak(t?: Partial<Tweak>): Tweak {
  const o = { ...NEUTRAL, ...(t ?? {}) };
  for (const d of TWEAK_DIALS) {
    const v = Number(o[d.key]);
    o[d.key] = Number.isFinite(v) ? clamp(v, d.min, d.max) : NEUTRAL[d.key];
  }
  return o;
}

/** Seconds a recipe lasts after the dials (before the room tail). */
export function recipeLength(recipe: Recipe, tweak?: Partial<Tweak>): number {
  const tw = fullTweak(tweak);
  let end = 0;
  for (const l of recipe.layers) end = Math.max(end, (l.delay ?? 0) + l.dur);
  return end * tw.length;
}

/**
 * Render a recipe with the dials into mono samples, −1…1. Pure: same input,
 * same output, in node or a browser.
 */
export function renderRecipe(recipe: Recipe, tweak?: Partial<Tweak>, sampleRate = 44100): Float32Array {
  const tw = fullTweak(tweak);
  const pitchMul = Math.pow(2, tw.pitch / 12);
  const lenMul = tw.length;
  const brightMul = Math.pow(2, tw.brightness * 1.2);
  const attackMul = Math.pow(2, -2 * tw.punch);
  const bodyMul = Math.pow(2, tw.body * 1.3);
  const room = clamp((recipe.room ?? 0) + tw.room, 0, 1);
  const tail = room > 0 ? 0.25 + room * 1.6 : 0.02;
  const len = Math.max(1, Math.ceil((recipeLength(recipe, tw) + tail) * sampleRate));
  const out = new Float32Array(len);

  recipe.layers.forEach((l, li) => {
    const start = Math.floor((l.delay ?? 0) * lenMul * sampleRate);
    const dur = l.dur * lenMul;
    const attack = (l.attack ?? (l.type === "tone" ? 0.006 : 0.002)) * attackMul;
    const hold = l.hold ?? 0;
    const count = Math.ceil(dur * sampleRate);
    const amRate = l.amRate ?? 0, amDepth = l.amDepth ?? 0;
    if (l.type === "tone") {
      const f0 = l.f0 * pitchMul, f1 = (l.f1 ?? l.f0) * pitchMul;
      const gain = l.gain * (l.f0 < 400 ? bodyMul : 1);
      let phase = 0;
      for (let i = 0; i < count && start + i < len; i++) {
        const tt = i / sampleRate;
        const frac = dur > 0 ? tt / dur : 0;
        let f = f0 * Math.pow(f1 / f0, frac);
        if (l.vibRate) f *= 1 + (l.vibDepth ?? 0) * Math.sin(2 * Math.PI * l.vibRate * tt);
        phase += f / sampleRate;
        phase -= Math.floor(phase);
        let s: number;
        if (l.wave === "sine") s = Math.sin(2 * Math.PI * phase);
        else if (l.wave === "triangle") s = 1 - 4 * Math.abs(phase - 0.5);
        else if (l.wave === "square") s = phase < 0.5 ? 1 : -1;
        else s = 2 * phase - 1;
        const am = amRate ? 1 - amDepth * 0.5 * (1 + Math.sin(2 * Math.PI * amRate * tt)) : 1;
        out[start + i] += s * gain * am * envAt(tt, dur, attack, hold);
      }
    } else {
      const rnd = noiseGen((l.seed ?? 1) * 1009 + li * 7919);
      const filt = new Biquad(l.filter, sampleRate);
      const fA = l.freq * brightMul, fB = (l.freqEnd ?? l.freq) * brightMul;
      const q = l.q ?? 1;
      // A bandpass at 0 dB peak loses level as Q grows wide; make up for narrow bands.
      const makeup = l.filter === "bandpass" ? Math.sqrt(Math.max(1, q)) : 1;
      const am2 = amRate * 1.618;
      for (let i = 0; i < count && start + i < len; i++) {
        if ((i & 31) === 0) filt.set(fA * Math.pow(fB / fA, dur > 0 ? i / sampleRate / dur : 0), q);
        const tt = i / sampleRate;
        const am = amRate
          ? 1 - amDepth * 0.5 * (1 + 0.6 * Math.sin(2 * Math.PI * amRate * tt + li) + 0.4 * Math.sin(2 * Math.PI * am2 * tt + 2 * li)) : 1;
        out[start + i] += filt.step(rnd()) * l.gain * makeup * am * envAt(tt, dur, attack, hold);
      }
    }
  });
  return postProcess(out, sampleRate, tw, room);
}

/**
 * The shared finishing chain (also used on the real files): body (a low
 * shelf), brightness (a high shelf or a dark lowpass), punch (a short boost
 * of the first hit), room (a small reverb), volume, and a soft limit.
 */
export function postProcess(samples: Float32Array, sampleRate: number, tweak: Tweak, room: number): Float32Array {
  const out = samples;
  if (Math.abs(tweak.body) > 0.001) {
    const f = new Biquad("lowshelf", sampleRate); f.set(220, 0.707, tweak.body * 9);
    for (let i = 0; i < out.length; i++) out[i] = f.step(out[i]);
  }
  if (tweak.brightness > 0.001) {
    const f = new Biquad("highshelf", sampleRate); f.set(3000, 0.707, tweak.brightness * 10);
    for (let i = 0; i < out.length; i++) out[i] = f.step(out[i]);
  } else if (tweak.brightness < -0.001) {
    const f = new Biquad("lowpass", sampleRate); f.set(16000 * Math.pow(2, tweak.brightness * 5), 0.707);
    for (let i = 0; i < out.length; i++) out[i] = f.step(out[i]);
  }
  if (tweak.punch > 0.001) {
    let peakAt = 0, peak = 0;
    for (let i = 0; i < Math.min(out.length, sampleRate * 0.4); i++) { const a = Math.abs(out[i]); if (a > peak) { peak = a; peakAt = i; } }
    const w = Math.floor(sampleRate * 0.03);
    for (let i = peakAt; i < Math.min(out.length, peakAt + w); i++) out[i] *= 1 + tweak.punch * (1 - (i - peakAt) / w);
  }
  if (room > 0.001) reverbInPlace(out, sampleRate, room);
  for (let i = 0; i < out.length; i++) {
    const x = out[i] * tweak.volume;
    const a = Math.abs(x);
    out[i] = a <= 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2));
  }
  return out;
}

/** A small Schroeder reverb (four combs, two all-passes), mixed in place. */
function reverbInPlace(buf: Float32Array, sr: number, room: number): void {
  const scale = sr / 44100;
  const combs = [1557, 1617, 1491, 1422].map(d => Math.floor(d * scale * (0.8 + room * 0.6)));
  const fb = 0.7 + room * 0.22;
  const wet = new Float32Array(buf.length);
  for (const d of combs) {
    const line = new Float32Array(d);
    let p = 0, lp = 0;
    for (let i = 0; i < buf.length; i++) {
      const y = line[p];
      lp = y * 0.6 + lp * 0.4; // damping
      line[p] = buf[i] + lp * fb;
      wet[i] += y / combs.length;
      p = (p + 1) % d;
    }
  }
  for (const d of [225, 556].map(x => Math.floor(x * scale))) {
    const line = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < wet.length; i++) {
      const y = line[p];
      const x = wet[i];
      line[p] = x + y * 0.5;
      wet[i] = y - x * 0.5;
      p = (p + 1) % d;
    }
  }
  const mix = room * 0.75;
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] * (1 - mix * 0.35) + wet[i] * mix;
}

/** A real file's samples through the same dials: pitch (resampled, so length moves with it) and the finishing chain. */
export function processFile(samples: Float32Array, sampleRate: number, tweak?: Partial<Tweak>): Float32Array {
  const tw = fullTweak(tweak);
  const rate = Math.pow(2, tw.pitch / 12) / tw.length;
  const tailS = tw.room > 0 ? 0.25 + tw.room * 1.6 : 0;
  const len = Math.max(1, Math.floor(samples.length / rate + tailS * sampleRate));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const x = i * rate;
    const k = Math.floor(x);
    if (k + 1 >= samples.length) break;
    out[i] = samples[k] + (samples[k + 1] - samples[k]) * (x - k);
  }
  return postProcess(out, sampleRate, tw, tw.room);
}

// ── Pictures and numbers ─────────────────────────────────────────────────────

export function peakOf(s: Float32Array): number {
  let p = 0;
  for (let i = 0; i < s.length; i++) { const a = Math.abs(s[i]); if (a > p) p = a; }
  return p;
}
export function rmsOf(s: Float32Array): number {
  let e = 0;
  for (let i = 0; i < s.length; i++) e += s[i] * s[i];
  return s.length ? Math.sqrt(e / s.length) : 0;
}

/** Min/max per column, for the waveform picture. */
export function waveformColumns(s: Float32Array, columns = 96): { min: number; max: number }[] {
  const out: { min: number; max: number }[] = [];
  const per = Math.max(1, Math.floor(s.length / columns));
  for (let c = 0; c < columns; c++) {
    let lo = 0, hi = 0;
    for (let i = c * per; i < Math.min(s.length, (c + 1) * per); i++) { if (s[i] < lo) lo = s[i]; if (s[i] > hi) hi = s[i]; }
    out.push({ min: lo, max: hi });
  }
  return out;
}

/** Loudness in `bands` log-spaced bands 50 Hz–14 kHz (0–1), from a window at the loudest moment. */
export function spectrumBands(s: Float32Array, sampleRate: number, bands = 20): number[] {
  const N = 2048;
  let peakAt = 0, peak = 0;
  for (let i = 0; i < s.length; i++) { const a = Math.abs(s[i]); if (a > peak) { peak = a; peakAt = i; } }
  const from = Math.max(0, Math.min(s.length - N, peakAt - 256));
  const mags: number[] = [];
  for (let b = 0; b < bands; b++) {
    const f = 50 * Math.pow(14000 / 50, (b + 0.5) / bands);
    const w = (2 * Math.PI * f) / sampleRate;
    let re = 0, im = 0;
    for (let i = 0; i < N && from + i < s.length; i++) {
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
      const x = s[from + i] * hann;
      re += x * Math.cos(w * i); im -= x * Math.sin(w * i);
    }
    mags.push(Math.sqrt(re * re + im * im));
  }
  const top = Math.max(1e-9, ...mags);
  return mags.map(m => clamp(1 + (20 * Math.log10(m / top + 1e-9)) / 50, 0, 1));
}

/** 16-bit mono WAV bytes, for "Save as WAV". */
export function encodeWav(s: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + s.length * 2);
  const v = new DataView(bytes.buffer);
  const str = (o: number, x: string) => { for (let i = 0; i < x.length; i++) v.setUint8(o + i, x.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + s.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, s.length * 2, true);
  for (let i = 0; i < s.length; i++) v.setInt16(44 + i * 2, Math.round(clamp(s[i], -1, 1) * 32767), true);
  return bytes;
}

// ── Leo's picks ──────────────────────────────────────────────────────────────

export interface LabNotes {
  tweaks: Record<string, Partial<Tweak>>;
  ratings: Record<string, number>;
  notes: Record<string, string>;
  /** event id → the candidate he picked. */
  picks: Record<string, string>;
}
export const EMPTY_NOTES: LabNotes = { tweaks: {}, ratings: {}, notes: {}, picks: {} };

/** The dials that are not at neutral, as "Pitch +2, Room 0.3". */
export function describeTweak(t?: Partial<Tweak>): string {
  const tw = fullTweak(t);
  const parts: string[] = [];
  for (const d of TWEAK_DIALS) {
    if (Math.abs(tw[d.key] - NEUTRAL[d.key]) < 1e-6) continue;
    const v = tw[d.key];
    parts.push(`${d.label} ${d.key === "pitch" ? (v > 0 ? "+" : "") + v + " semitones" : d.key === "volume" || d.key === "length" ? "×" + v.toFixed(2) : (v > 0 ? "+" : "") + v.toFixed(2)}`);
  }
  return parts.length ? parts.join(", ") : "no changes";
}

/** The short plain-text summary Leo pastes back to us. */
export function exportPicks(notes: LabNotes): string {
  const lines: string[] = ["Sound Lab picks (Leo)"];
  for (const e of LAB_EVENTS) {
    const pick = notes.picks[e.id];
    const rated = e.candidates.filter(c => (notes.ratings[c.id] ?? 0) > 0 || (notes.notes[c.id] ?? "").trim());
    if (!pick && rated.length === 0) continue;
    lines.push("", `${e.label}:`);
    if (pick) {
      const c = e.candidates.find(x => x.id === pick);
      if (c) {
        lines.push(`  PICK → ${c.name} [${c.id}]${notes.ratings[c.id] ? ` ${"★".repeat(notes.ratings[c.id])}` : ""}`);
        lines.push(`    dials: ${describeTweak(notes.tweaks[c.id])}`);
        if (notes.notes[c.id]?.trim()) lines.push(`    note: ${notes.notes[c.id].trim()}`);
      }
    }
    for (const c of rated) {
      if (c.id === pick) continue;
      lines.push(`  ${c.name} [${c.id}] ${"★".repeat(notes.ratings[c.id] ?? 0) || "(no stars)"}${notes.notes[c.id]?.trim() ? ` — ${notes.notes[c.id].trim()}` : ""}${notes.tweaks[c.id] ? ` (dials: ${describeTweak(notes.tweaks[c.id])})` : ""}`);
    }
  }
  if (lines.length === 1) lines.push("", "(nothing picked or rated yet)");
  return lines.join("\n");
}

/** The candidate a sequence uses for an event: the pick, else the best rated, else the first made-up one. */
export function chosenFor(eventId: string, notes: LabNotes): Candidate | undefined {
  const e = eventById(eventId);
  if (!e) return undefined;
  const pick = e.candidates.find(c => c.id === notes.picks[eventId]);
  if (pick) return pick;
  const rated = [...e.candidates].filter(c => (notes.ratings[c.id] ?? 0) > 0).sort((a, b) => (notes.ratings[b.id] ?? 0) - (notes.ratings[a.id] ?? 0));
  return rated[0] ?? e.candidates[0];
}

/** "Play in a sequence": which event at what second. */
export const SEQUENCES: { id: string; label: string; steps: { event: string; at: number }[] }[] = [
  { id: "goal", label: "Pass → shot → GOAL", steps: [{ event: "kick-soft", at: 0 }, { event: "touch", at: 0.75 }, { event: "kick-hard", at: 1.35 }, { event: "net", at: 1.68 }, { event: "goal", at: 1.78 }] },
  { id: "save", label: "Pass → shot → save", steps: [{ event: "kick-soft", at: 0 }, { event: "touch", at: 0.75 }, { event: "kick-hard", at: 1.35 }, { event: "save", at: 1.66 }, { event: "ooh", at: 1.8 }] },
  { id: "catch", label: "Shot → caught", steps: [{ event: "kick-hard", at: 0 }, { event: "catch", at: 0.35 }] },
  { id: "post", label: "Shot → post → ooh", steps: [{ event: "kick-hard", at: 0 }, { event: "post", at: 0.32 }, { event: "ooh", at: 0.5 }] },
  { id: "block", label: "Shot → blocked", steps: [{ event: "kick-hard", at: 0 }, { event: "block", at: 0.18 }, { event: "ooh", at: 0.35 }] },
  { id: "header", label: "Cross → header → GOAL", steps: [{ event: "kick-hard", at: 0 }, { event: "header", at: 0.9 }, { event: "net", at: 1.2 }, { event: "goal", at: 1.3 }] },
  { id: "full", label: "Full-time whistle", steps: [{ event: "whistle", at: 0 }] },
];
