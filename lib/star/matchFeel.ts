/**
 * MATCH FEEL — Settings → Match → "Match feel: New | Old" (Leo, 13 Oct 2026).
 *
 * Leo, Harry and Mikey: "add game juice to get that game feel flowing, more
 * reactive hits, not just swipe, tap and watch the ball move forward. It needs
 * to feel like we're really connecting with and hitting the ball, linking up
 * with the power too — heavier, crunchier, more reactive."
 *
 * New: every strike is FELT, and how much is read off the ball as it left
 * the boot (its real speed) and how well you hit it (the contact grade):
 *   - a wind-up, then a short freeze at the contact (hit-stop)
 *   - a camera punch, a flash and a turf puff at the boot
 *   - the ball squashes at the hit and stretches with speed, with a streak
 *   - a deeper kick sound (bassier with power, a dull scuff for a bad one)
 *   - a phone buzz where the phone allows it
 * …plus a thud and dust where the ball lands, the net bulging on a goal, a
 * clang and shake off the woodwork, a spark and squash off the keeper's
 * glove, and a keeper who sets, hops and arcs through his dive.
 * Old: exactly the game as before.
 *
 * LOOKS AND SOUND ONLY. Nothing here is read by the ball, the keeper's save
 * maths, the outcome or any random draw. The freeze delays the flight; the
 * flight itself is the same, step for step (the match steps the ball in fixed
 * 1/180 s steps and a frozen frame simply adds no time).
 *
 * One phone at a time (localStorage, every access guarded). Default Old while
 * it is tested. The dials (sizes) live here too and are edited on
 * /star-animations-dev → Feel.
 */
import { useSyncExternalStore } from "react";

// ── The switch ───────────────────────────────────────────────────────────

export type MatchFeelLook = "new" | "old";
export const MATCH_FEEL_KEY = "star-match-feel";
// Harry, 22 Oct 2026: "keep my highlights and match feel toggles on as default but keep the toggle".
export const MATCH_FEEL_DEFAULT: MatchFeelLook = "new";

let stored: MatchFeelLook | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

function readLook(): MatchFeelLook {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(MATCH_FEEL_KEY) : null;
    return v === "new" || v === "old" ? v : MATCH_FEEL_DEFAULT;
  } catch {
    return MATCH_FEEL_DEFAULT;
  }
}

/** Read every frame by the match: cheap (cached). */
export function matchFeelLook(): MatchFeelLook {
  if (stored === undefined) stored = readLook();
  return stored;
}
export const matchFeelOn = (): boolean => matchFeelLook() === "new";

export function setMatchFeelLook(v: MatchFeelLook): void {
  try { localStorage.setItem(MATCH_FEEL_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  notify();
}

// ── The dials ────────────────────────────────────────────────────────────

export interface FeelDials {
  /** Milliseconds of freeze at the contact, for a full-power clean strike. */
  hitStopMs: number;
  /** Milliseconds of wind-up before the contact, for a full-power strike. */
  windUpMs: number;
  /** Pixels of camera punch for a full-power strike. */
  shakePx: number;
  /** Size of the contact flash and turf puff (× the ball). */
  flashSize: number;
  /** Speed streak length (1 = the shipped length; 0 = none). */
  trailLength: number;
  /** Ball squash at a hit and stretch with speed (0 = none). */
  squash: number;
  /** Kick, thud, clang and glove sounds (0 = silent, 1 = shipped). */
  soundGain: number;
  /** Milliseconds of phone buzz for a full-power strike (0 = none). */
  hapticMs: number;
  /** Landing dust and thud (0 = none). */
  landing: number;
  /** How far the net bulges on a goal (0 = none). */
  netBulge: number;
  /** Keeper: set hop at the strike and the arc of his dive (0 = none). */
  keeperMotion: number;
  /** Keeper glove spark and freeze (0 = none). */
  gloveImpact: number;
  /** Team-mates' touches, shots, headers and blocks drawn bigger (× the Animations dials). */
  mateBoost: number;
}

export const DEFAULT_FEEL_DIALS: FeelDials = {
  hitStopMs: 75,
  windUpMs: 90,
  shakePx: 7,
  flashSize: 1,
  trailLength: 1,
  squash: 1,
  soundGain: 1,
  hapticMs: 28,
  landing: 1,
  netBulge: 1,
  keeperMotion: 1,
  gloveImpact: 1,
  mateBoost: 1.2,
};

export const FEEL_DIAL_INFO: Record<keyof FeelDials, { min: number; max: number; step: number; label: string; unit?: string }> = {
  hitStopMs: { min: 0, max: 200, step: 5, label: "Hit-stop (freeze at contact)", unit: "ms" },
  windUpMs: { min: 0, max: 220, step: 5, label: "Wind-up before contact", unit: "ms" },
  shakePx: { min: 0, max: 20, step: 0.5, label: "Camera punch", unit: "px" },
  flashSize: { min: 0, max: 2.5, step: 0.05, label: "Contact flash + turf puff" },
  trailLength: { min: 0, max: 2.5, step: 0.05, label: "Speed streak length" },
  squash: { min: 0, max: 2, step: 0.05, label: "Ball squash / stretch" },
  soundGain: { min: 0, max: 2, step: 0.05, label: "Impact sounds" },
  hapticMs: { min: 0, max: 80, step: 1, label: "Phone buzz", unit: "ms" },
  landing: { min: 0, max: 2, step: 0.05, label: "Landing thud + dust" },
  netBulge: { min: 0, max: 2, step: 0.05, label: "Net bulge" },
  keeperMotion: { min: 0, max: 2, step: 0.05, label: "Keeper set hop + dive arc" },
  gloveImpact: { min: 0, max: 2, step: 0.05, label: "Keeper glove spark + freeze" },
  mateBoost: { min: 1, max: 2, step: 0.05, label: "Team-mate moves bigger" },
};
export const FEEL_DIAL_KEYS = Object.keys(FEEL_DIAL_INFO) as (keyof FeelDials)[];

const DIALS_KEY = "star-feel-dials";
let cachedDials: FeelDials | undefined;

export function sanitizeFeelDials(raw: unknown): FeelDials {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_FEEL_DIALS };
  for (const k of FEEL_DIAL_KEYS) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.max(FEEL_DIAL_INFO[k].min, Math.min(FEEL_DIAL_INFO[k].max, v));
  }
  return out;
}

function readDials(): FeelDials {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_FEEL_DIALS;
    const v = localStorage.getItem(DIALS_KEY);
    return v ? sanitizeFeelDials(JSON.parse(v)) : DEFAULT_FEEL_DIALS;
  } catch {
    return DEFAULT_FEEL_DIALS;
  }
}

/** Read every frame by the match: cheap (cached). */
export function feelDials(): FeelDials {
  if (cachedDials === undefined) cachedDials = readDials();
  return cachedDials;
}

export function setFeelDial(k: keyof FeelDials, v: number): FeelDials {
  const next = sanitizeFeelDials({ ...feelDials(), [k]: v });
  try { localStorage.setItem(DIALS_KEY, JSON.stringify(next)); } catch { /* in-memory still changes */ }
  cachedDials = next;
  notify();
  return next;
}

export function resetFeelDials(): FeelDials {
  try { localStorage.removeItem(DIALS_KEY); } catch { /* ignore */ }
  cachedDials = DEFAULT_FEEL_DIALS;
  notify();
  return cachedDials;
}

/** For tests: forget the cached values. */
export function _forgetMatchFeel(): void { stored = undefined; cachedDials = undefined; }

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === MATCH_FEEL_KEY) stored = undefined;
    if (e.key === DIALS_KEY) cachedDials = undefined;
    if (e.key === MATCH_FEEL_KEY || e.key === DIALS_KEY) notify();
  });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useMatchFeelLook = () => useSyncExternalStore(subscribe, matchFeelLook, () => MATCH_FEEL_DEFAULT);
export const useFeelDials = () => useSyncExternalStore(subscribe, feelDials, () => DEFAULT_FEEL_DIALS);

// ── The maths: how hard was it hit ───────────────────────────────────────

/** A struck ball faster than this (m/s, along the ground and up) is "full". */
export const FULL_STRIKE_MS = 27;
/** Below this it is a touch, not a strike: barely any effect at all. */
export const SOFT_STRIKE_MS = 7;

/** How cleanly it was struck, from the contact grade (lib/star/shotModel.ts). 0-1. */
export function contactQuality(grade: string | undefined): number {
  switch (grade) {
    case "clean": case "knuckle": return 1;
    case "plain": case "chip": return 0.75;
    case "sliced": return 0.45;
    case "topped": return 0.4;
    case "scuffed": return 0.15;
    default: return 0.75;
  }
}

/** Everything one strike is felt with. */
export interface StrikeFeel {
  /** 0-1: how hard (soft touch ≈ 0, full power 1). */
  power: number;
  /** 0-1: how clean. */
  quality: number;
  /** Seconds of wind-up before the contact. */
  windUpS: number;
  /** Seconds the picture freezes at the contact. */
  hitStopS: number;
  /** Pixels of camera punch. */
  shakePx: number;
  /** 0-1.5: the flash and turf puff's size (× the dial). */
  flash: number;
  /** 0-1: squash at the hit. */
  squash: number;
  /** Sound loudness (0-~1.4) and how bassy (0-1). A scuff is a dull thud. */
  gain: number;
  bass: number;
  scuff: boolean;
  /** Milliseconds of phone buzz. 0 = none. */
  hapticMs: number;
  /** A header: play the header thump (matchSound playHeader), not the boot. */
  header: boolean;
}

/** What met the ball in the air, for the strike's feel (headers piece 5). */
export type AirFeel = "header" | "volley" | undefined;

/** A header lands at least this hard (0-1), whatever its pace: a header is
 *  soft by nature (airborneChance HEADER_PACE ×0.72), but a firm one should
 *  still be felt. */
export const HEADER_FEEL_FLOOR = 0.6;
/** × the wind-up, freeze and camera punch for a header / a volley. */
export const HEADER_FEEL = { windUp: 1.6, hitStop: 1.6, shake: 1.5 } as const;
export const VOLLEY_FEEL = { windUp: 1.2, hitStop: 1.25, shake: 1.25 } as const;
/** An air strike's freeze never runs past this (s): subtle, asked for. */
export const AIR_HIT_STOP_MAX_S = 0.15;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * The strike's feel from the ball as it left the boot. `speed` m/s is
 * hypot(vel.x, vel.y, vz). Soft touches stay soft: every amount scales with
 * power squared-ish, so a 6 m/s pass gets a whisper and a 30 m/s strike the lot.
 */
export function strikeFeel(speed: number, grade: string | undefined, D: FeelDials = DEFAULT_FEEL_DIALS, air?: AirFeel): StrikeFeel {
  const lin = clamp01((speed - SOFT_STRIKE_MS) / (FULL_STRIKE_MS - SOFT_STRIKE_MS));
  const power = lin * (0.55 + 0.45 * lin); // eased: soft stays soft
  const quality = contactQuality(grade);
  const scuff = quality < 0.3;
  let hit = power * (0.45 + 0.55 * quality); // a clean strike lands harder
  // A header or volley (headers piece 5, research §7.2): a longer beat before
  // the contact, a bigger freeze (never past AIR_HIT_STOP_MAX_S) and punch.
  const m = air === "header" ? HEADER_FEEL : air === "volley" ? VOLLEY_FEEL : null;
  if (air === "header" && !scuff) hit = Math.max(hit, HEADER_FEEL_FLOOR * (0.45 + 0.55 * quality));
  const windUp = (D.windUpMs / 1000) * (0.25 + 0.75 * (air === "header" ? Math.max(power, HEADER_FEEL_FLOOR) : power));
  const stop = (D.hitStopMs / 1000) * hit;
  return {
    power, quality, scuff,
    windUpS: m ? windUp * m.windUp : windUp,
    hitStopS: m ? Math.min(Math.max(stop, AIR_HIT_STOP_MAX_S), stop * m.hitStop) : stop,
    shakePx: D.shakePx * hit * (m ? m.shake : 1),
    flash: (0.25 + 0.95 * hit) * D.flashSize,
    squash: (0.25 + 0.75 * hit) * D.squash,
    gain: (0.35 + 0.75 * power) * D.soundGain,
    bass: scuff ? 0.2 : clamp01(0.3 + 0.7 * power),
    hapticMs: power < 0.12 && !m ? 0 : Math.round(D.hapticMs * (0.3 + 0.7 * hit)),
    header: air === "header",
  };
}

/** Ball squash/stretch at a hit, `t` seconds after it: flattened along the
 *  hit (sx < 1 along, > 1 across), springing back with a small overshoot. */
export function squashAt(t: number, amount: number): number {
  if (!(amount > 0) || t < 0 || t > 0.22) return 0;
  const u = t / 0.22;
  // -1 squashed at the hit → a small stretch → rest.
  return amount * Math.cos(Math.PI * 2.2 * u) * (1 - u) * (1 - u);
}

/** How long a speed streak is, in metres of the ball's own path behind it. */
export function streakMetres(speed: number, D: FeelDials = DEFAULT_FEEL_DIALS): number {
  if (speed < 9) return 0;
  return Math.min(6, (speed - 9) * 0.22) * D.trailLength;
}

/** Stretch along the flight with speed: 1 = round. */
export function speedStretch(speed: number, D: FeelDials = DEFAULT_FEEL_DIALS): number {
  return 1 + clamp01((speed - 14) / 20) * 0.32 * D.squash;
}

/** A camera punch: a sharp kick in one direction that rings out. Offset in
 *  px `t` seconds into it (dur seconds long), never random. */
export function punchOffset(t: number, dur: number, px: number, dirX: number, dirY: number): { x: number; y: number } {
  if (!(px > 0) || t < 0 || t > dur) return { x: 0, y: 0 };
  const u = t / dur;
  const k = Math.cos(Math.PI * 3 * u) * (1 - u) * (1 - u) * px;
  // Mostly along the strike, a little rattle across it.
  const across = Math.sin(Math.PI * 7 * u) * (1 - u) * px * 0.25;
  return { x: dirX * k - dirY * across, y: dirY * k + dirX * across };
}

/** The keeper's set hop: lifted (in units of his drawn radius) `t` seconds
 *  after the strike. A small bounce onto his toes. */
export function keeperSetHop(t: number, D: FeelDials = DEFAULT_FEEL_DIALS): number {
  const dur = 0.24;
  if (!(D.keeperMotion > 0) || t < 0 || t > dur) return 0;
  return Math.sin(Math.PI * (t / dur)) * 0.22 * D.keeperMotion;
}

/** The dive's flight: lifted (× his radius) at `lunge` 0-1 into it. Push off,
 *  airborne at full stretch, down on the grass by the end. Low saves skim. */
export function keeperDiveArc(lunge: number, low: boolean, D: FeelDials = DEFAULT_FEEL_DIALS): number {
  if (!(D.keeperMotion > 0) || !(lunge > 0)) return 0;
  const u = clamp01(lunge);
  return Math.sin(Math.PI * Math.pow(u, 0.8)) * (low ? 0.18 : 0.55) * D.keeperMotion;
}

/** Phone buzz, where the phone has one. Never throws. */
export function feelHaptic(ms: number): void {
  if (!(ms > 0)) return;
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }) : null;
    if (nav && typeof nav.vibrate === "function") nav.vibrate(Math.round(ms));
  } catch { /* no buzz on this phone */ }
}

/** A tiny fixed sequence of "random" numbers for the dust and sparks, so a
 *  still is the same every time and the match's own random stream is never
 *  touched. */
export function feelNoise(i: number, salt = 0): number {
  let h = (Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
