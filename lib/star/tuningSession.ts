/**
 * TUNING · WHAT YOU'VE SEEN THIS SESSION.
 *
 * Harry, 14 Oct 2026: "make tuning somehow visible in the scenario
 * gallery/play area". The team tunes by playing: they play chances and say in
 * plain words what feels off. This file is the memory of what they were
 * shown, so the Tuning panel (components/star/TuningSessionPanel.tsx) can put
 * it next to the DRAFT fun ranges (lib/star/funTargets.ts).
 *
 * One list per browser tab (sessionStorage), shared by the Scenario Gallery,
 * Infinite Highlights and Infinite Match, so going from one page to the next
 * keeps the count. It reads nothing from the match and changes nothing in it:
 * each page reports a chance after it has been served.
 *
 * Where the ball starts decides "how deep" and "which wing". The pitch is
 * the engine's (lib/star/pitch.ts): y = 0 is the goal you attack, growing
 * up the field; x = 0 is the left touchline.
 */
import { BOX_DEPTH, BOX_L, BOX_R, HALF_LEN, PITCH_W } from "./pitch";
import { FUN_LEVELS, FUN_TARGETS, type Band, type FunLevel, type FunPosition } from "./funTargets";

export type TuningPage = "gallery" | "highlights" | "match";

export interface SeenChance {
  /** Dedupe key: the same card opened twice counts once. */
  id?: string;
  page: TuningPage;
  kind: string;
  /** Where the ball started, pitch metres. Absent for a dribble run. */
  ball?: { x: number; y: number };
  /** Infinite Match only: the match minute and which match. */
  minute?: number;
  match?: string;
  /** Infinite Match only: the position and division played. */
  position?: string;
  league?: string;
  seed?: number;
  at: number;
}

const KEY = "star-tuning-session-v1";
const MAX = 600;
const EVENT = "star-tuning-session";

export function loadSeen(): SeenChance[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as SeenChance[]).filter((s) => s && typeof s.kind === "string") : [];
  } catch {
    return [];
  }
}

function store(list: SeenChance[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); } catch { /* private window: memory only */ }
  memory = list.slice(-MAX);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Fallback when sessionStorage throws: the list still lives for this page. */
let memory: SeenChance[] | null = null;
export function currentSeen(): SeenChance[] {
  const s = loadSeen();
  return s.length || !memory ? s : memory;
}

export function recordSeen(c: Omit<SeenChance, "at">) {
  const list = currentSeen();
  if (c.id && list.some((s) => s.id === c.id)) return;
  store([...list, { ...c, at: Date.now() }]);
}

export function clearSeen() { store([]); }

/** Calls back whenever any page records a chance. Returns the unsubscribe. */
export function onSeenChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

// ─────────────────────────────────────────────────────────────────────────
//  WHAT IT ADDS UP TO
// ─────────────────────────────────────────────────────────────────────────

export type Zone = "box" | "final_third" | "middle" | "own_half";
export function zoneOf(b: { x: number; y: number }): Zone {
  if (b.y < BOX_DEPTH && b.x >= BOX_L && b.x <= BOX_R) return "box";
  if (b.y < 35) return "final_third";
  if (b.y < HALF_LEN) return "middle";
  return "own_half";
}
/** Same split sim90.ts uses to place a wide ball: left of 28 m, right of 40 m. */
export function laneOf(b: { x: number; y: number }): "left" | "centre" | "right" {
  const third = PITCH_W / 2 - 6;
  return b.x < third ? "left" : b.x > PITCH_W - third ? "right" : "centre";
}

export const funPositionOf = (p?: string): FunPosition | null =>
  p === "ST" ? "ST" : p === "CAM" ? "AM" : p === "LW" || p === "RW" ? "W" : p === "CM" ? "CM" : null;

export const funLevelOf = (l?: string): FunLevel =>
  (FUN_LEVELS as string[]).includes(l ?? "") ? (l as FunLevel) : "premier";

export type Feel = "about right" | "a lot" | "a little" | "too few to tell";

/** Under this many chances a share is noise, so it says so. */
export const MIN_SAMPLE = 5;
/** A mix of several kinds needs more: 4 of 15 can be luck. */
export const MIX_MIN_SAMPLE = 20;

export function feelOf(v: number, b: Band, n: number): Feel {
  if (n < MIN_SAMPLE) return "too few to tell";
  if (v > b.high + 1e-9) return "a lot";
  if (v < b.low - 1e-9) return "a little";
  return "about right";
}

export interface Line {
  key: "mix" | "finalThird" | "ownWing" | "perMatch" | "longestWait";
  label: string;
  /** One plain sentence: what was measured. */
  plain: string;
  value: number;
  unit: "pct" | "n" | "min";
  /** The DRAFT range drawn on the bar. */
  band: Band;
  /** The bar's full width. */
  scale: number;
  feel: Feel;
  n: number;
}

export interface Summary {
  total: number;
  byPage: Record<TuningPage, number>;
  mix: { kind: string; n: number; share: number }[];
  level: FunLevel;
  position: FunPosition | null;
  lines: Line[];
}

export function summarise(seen: SeenChance[]): Summary {
  const byPage: Record<TuningPage, number> = { gallery: 0, highlights: 0, match: 0 };
  for (const s of seen) byPage[s.page] = (byPage[s.page] ?? 0) + 1;
  const counts = new Map<string, number>();
  for (const s of seen) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  const mix = Array.from(counts, ([kind, n]) => ({ kind, n, share: n / Math.max(1, seen.length) }))
    .sort((a, b) => b.n - a.n);

  const last = [...seen].reverse();
  const level = funLevelOf(last.find((s) => s.league)?.league);
  const position = funPositionOf(last.find((s) => s.position)?.position);
  const cellFor = (p: FunPosition) => FUN_TARGETS[level][p];
  const lines: Line[] = [];

  // 1. The mix. The game's decided rule is an even mix of the team's drawn
  //    chances (CLAUDE.md, "Chance mix: the basic even mix"), so the most
  //    common kind is held against an even share of the kinds seen.
  if (mix.length) {
    const even = 1 / mix.length;
    lines.push({
      key: "mix", label: `Top: ${mix[0].kind.replace(/_/g, " ")}`,
      plain: "Its share against an even mix of the kinds you've seen.",
      value: mix[0].share, unit: "pct", scale: 1,
      band: { low: 0, target: even, high: Math.min(1, even * 2), mark: "designed" },
      feel: mix.length < 2 || seen.length < MIX_MIN_SAMPLE ? "too few to tell" : feelOf(mix[0].share, { low: 0, target: even, high: Math.min(1, even * 2), mark: "designed" }, seen.length),
      n: seen.length,
    });
  }

  // 2. How deep: the share that starts up the pitch.
  const placed = seen.filter((s) => s.ball);
  if (placed.length) {
    const up = placed.filter((s) => { const z = zoneOf(s.ball!); return z === "box" || z === "final_third"; }).length;
    const band = cellFor(position ?? "ST").finalThird!;
    lines.push({
      key: "finalThird", label: "Up the pitch", plain: "Chances that start in the final third or the box.",
      value: up / placed.length, unit: "pct", scale: 1, band, feel: feelOf(up / placed.length, band, placed.length), n: placed.length,
    });
  }

  // 3. Your wing (Infinite Match on the left or right wing only).
  const wide = seen.filter((s) => s.ball && (s.position === "LW" || s.position === "RW"));
  if (wide.length) {
    const own = wide.filter((s) => laneOf(s.ball!) === (s.position === "RW" ? "right" : "left")).length;
    const band = cellFor("W").ownWing!;
    lines.push({
      key: "ownWing", label: "On your wing", plain: "Chances that come down your own side.",
      value: own / wide.length, unit: "pct", scale: 1, band, feel: feelOf(own / wide.length, band, wide.length), n: wide.length,
    });
  }

  // 4 + 5. How often, and the longest wait (Infinite Match only: it is the
  //    one page with a clock).
  const timed = seen.filter((s) => s.page === "match" && typeof s.minute === "number");
  if (timed.length) {
    const matches = new Map<string, number[]>();
    for (const s of timed) {
      const k = s.match ?? "match";
      matches.set(k, [...(matches.get(k) ?? []), s.minute!]);
    }
    let minutes = 0, longest = 0;
    for (const mins of Array.from(matches.values())) {
      const sorted = [...mins].sort((a, b) => a - b);
      minutes += sorted[sorted.length - 1];
      let prev = 0;
      for (const m of sorted) { longest = Math.max(longest, m - prev); prev = m; }
    }
    const cell = cellFor(position ?? "ST");
    const per90 = minutes > 0 ? (timed.length / minutes) * 90 : 0;
    lines.push({
      key: "perMatch", label: "Chances a match", plain: "Your chances per 90 minutes of Infinite Match.",
      value: per90, unit: "n", scale: 14, band: cell.chances!, feel: minutes < 45 ? "too few to tell" : feelOf(per90, cell.chances!, timed.length), n: timed.length,
    });
    lines.push({
      key: "longestWait", label: "Longest wait", plain: "The longest stretch with no chance for you.",
      value: longest, unit: "min", scale: 60, band: cell.longestWait!, feel: timed.length < 2 ? "too few to tell" : longest > cell.longestWait!.high ? "a lot" : "about right", n: timed.length,
    });
  }

  return { total: seen.length, byPage, mix, level, position, lines };
}
