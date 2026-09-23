/**
 * THE PLAY AREA'S OWN SETTINGS — one set, shared by everything in it.
 *
 * Asked for directly: "I think we should have a play area hub, with infinite
 * highlights, infinite match and then tuning added on top (power, curve,
 * boots, opposition level etc.)".
 *
 * The point of the word "shared" is that a number set once applies to every
 * mode in the hub, so what you saw in one is what you get in the other. A
 * second copy per screen would mean tuning power in the match and wondering
 * why a highlight still felt the same.
 *
 * Deliberately localStorage-only, and deliberately NOT on `CareerState`.
 * Nothing here is part of a career — it is what a dev tool is currently set
 * to, on this device, for looking at the game. The same reasoning as
 * `faceStyle.ts` and the match's own mute/speed keys.
 *
 * Every field maps onto a prop `CanvasMatch` already takes. Nothing here
 * invents a mechanic: it is the existing dials, in one place, with a name a
 * non-coder can read.
 */

import type { CareerDivision } from "./calendar";

export interface PlaySettings {
  /** `CanvasMatch`'s `skills.power` — how hard the same drag hits. */
  power: number;
  /** `CanvasMatch`'s `skills.technique` — placement, and how much curl you
   *  can generate at all (see `curlRange`). */
  technique: number;
  /** Boots that bend it — `canCurve`. */
  curve: boolean;
  /** Boots that let you take an extra touch — `canExtraTouch`. */
  extraTouch: boolean;
  /** How good the side you are playing is — `oppStrength`. */
  oppStrength: number;
  /** The one number the keeper's reach scales off — `keeperStrength`. */
  keeperStrength: number;
  /** Which chances you are likeliest to be the one taking. One of the four
   *  the game actually offers (`OFFERABLE_ROLES`, teamsheet.ts). */
  position: "ST" | "CAM" | "LW" | "RW";
  /** Which division the synthetic career plays in — sets the standard of
   *  club around you, and so the strength your own side turns up with. */
  division: CareerDivision;
  /** How long an Infinite Match runs for, in real match minutes. */
  matchMinutes: number;
}

export const DEFAULT_PLAY_SETTINGS: PlaySettings = {
  power: 55,
  technique: 55,
  curve: false,
  extraTouch: false,
  oppStrength: 65,
  keeperStrength: 62,
  position: "ST",
  division: "premier",
  matchMinutes: 10000,
};

/** Every dial's real range, exported so the sliders and the clamp read the
 *  one set of numbers rather than two that can drift apart. */
export const PLAY_RANGES = {
  power: [1, 99] as const,
  technique: [1, 99] as const,
  oppStrength: [20, 99] as const,
  keeperStrength: [20, 99] as const,
  /** A match has to be long enough to be worth watching and short enough to
   *  end. 10,000 is what was asked for; the ceiling is well past it so a
   *  longer run is possible without another code change. */
  matchMinutes: [90, 50000] as const,
};

export const PLAY_POSITIONS: PlaySettings["position"][] = ["ST", "CAM", "LW", "RW"];

export const PLAY_DIVISIONS: { id: CareerDivision; label: string }[] = [
  { id: "premier", label: "Premier League" },
  { id: "championship", label: "Championship" },
  { id: "league_one", label: "League One" },
  { id: "league_two", label: "League Two" },
  { id: "national_league", label: "National League" },
];

const KEY = "star-play-settings-v1";

const clampTo = (v: unknown, [lo, hi]: readonly [number, number], fallback: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

/**
 * Every field checked and clamped on the way in.
 *
 * A stored value can be from an older version with a field missing, or
 * hand-edited, or corrupt. None of those should be able to feed NaN into a
 * match — so each one falls back to the real default rather than through.
 */
export function sanitizePlaySettings(raw: unknown): PlaySettings {
  const o = (raw ?? {}) as Partial<Record<keyof PlaySettings, unknown>>;
  const d = DEFAULT_PLAY_SETTINGS;
  const position = PLAY_POSITIONS.includes(o.position as PlaySettings["position"])
    ? (o.position as PlaySettings["position"])
    : d.position;
  const division = PLAY_DIVISIONS.some((x) => x.id === o.division)
    ? (o.division as CareerDivision)
    : d.division;
  return {
    power: clampTo(o.power, PLAY_RANGES.power, d.power),
    technique: clampTo(o.technique, PLAY_RANGES.technique, d.technique),
    curve: !!o.curve,
    extraTouch: !!o.extraTouch,
    oppStrength: clampTo(o.oppStrength, PLAY_RANGES.oppStrength, d.oppStrength),
    keeperStrength: clampTo(o.keeperStrength, PLAY_RANGES.keeperStrength, d.keeperStrength),
    position,
    division,
    matchMinutes: clampTo(o.matchMinutes, PLAY_RANGES.matchMinutes, d.matchMinutes),
  };
}

export function loadPlaySettings(): PlaySettings {
  if (typeof window === "undefined") return { ...DEFAULT_PLAY_SETTINGS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PLAY_SETTINGS };
    return sanitizePlaySettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PLAY_SETTINGS };
  }
}

export function savePlaySettings(s: PlaySettings): PlaySettings {
  const clean = sanitizePlaySettings(s);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* private mode */ }
  }
  return clean;
}
