import { SCENARIO_KINDS, type ScenarioKind } from "./canvasEngine";
import { isSwitchedOff } from "./switchedOffKinds";
import type { SimSpec } from "./gallerySim";

/**
 * INFINITE HIGHLIGHTS — what the browser remembers between visits.
 *
 * Two things, both localStorage and deliberately so: which kinds are in the
 * pool, and which chances someone has flagged as looking wrong. A flag is a
 * note to yourself while you flick, not a record anyone else reads — a table
 * can come later if it ever needs to.
 *
 * A flag stores the chance's whole `SimSpec` (kind + seed + plan id), never a
 * picture. `buildSimScenario(spec)` rebuilds the exact same chance from it, so
 * a flagged one can always be got back to.
 */

const KINDS_KEY = "star-highlights-kinds-v1";
const FLAGS_KEY = "star-highlights-flags-v1";
const RUN_KEY = "star-highlights-run-v1";

export interface FlaggedChance {
  /** `kind-seed-planId` — stable, so flagging twice is not two entries. */
  id: string;
  kind: ScenarioKind;
  seed: number;
  planId: string | null;
  /** When it was flagged, so the list reads newest first. */
  at: number;
}

export function flagId(spec: SimSpec): string {
  return `${spec.kind}-${spec.seed}-${spec.planId ?? "base"}`;
}

export function specOf(f: FlaggedChance): SimSpec {
  return { kind: f.kind, seed: f.seed, planId: f.planId };
}

// A switched-off kind (volley, header — lib/star/switchedOffKinds.ts) is never
// in the pool, even if an older saved selection still lists it.
const isKind = (v: unknown): v is ScenarioKind =>
  typeof v === "string" && (SCENARIO_KINDS as readonly string[]).includes(v) && !isSwitchedOff(v as ScenarioKind);

// ── Which kinds are in the pool ──

/** Every kind, which is the default — you turn things OFF, not on. */
export function allKinds(): ScenarioKind[] {
  return SCENARIO_KINDS.filter(k => !isSwitchedOff(k));
}

export function loadKinds(): ScenarioKind[] {
  if (typeof window === "undefined") return allKinds();
  try {
    const raw = window.localStorage.getItem(KINDS_KEY);
    if (!raw) return allKinds();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return allKinds();
    // An empty saved list is a real choice (nothing selected), so it is kept.
    // A list with nothing RECOGNISABLE in it is corruption, and falls back.
    const kept = parsed.filter(isKind);
    if (kept.length === 0 && parsed.length > 0) return allKinds();
    return kept;
  } catch {
    return allKinds();
  }
}

export function saveKinds(kinds: ScenarioKind[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KINDS_KEY, JSON.stringify(kinds)); } catch { /* dev tool */ }
}

// ── Flags ──

export function loadFlags(): FlaggedChance[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FLAGS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is FlaggedChance =>
        !!f && typeof f === "object" && isKind(f.kind) && Number.isFinite(f.seed) && typeof f.id === "string",
    );
  } catch {
    return [];
  }
}

export function saveFlags(flags: FlaggedChance[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(FLAGS_KEY, JSON.stringify(flags)); } catch { /* dev tool */ }
}

// ── The run counter ──

/**
 * Which run this page load is.
 *
 * The stream is seeded, never `Math.random()` — so without this every visit
 * would open on the same first chance and show the same hundred after it. The
 * run number is mixed into the seed instead: each visit is fresh material, and
 * every chance in it is still re-derivable from the run number alone.
 */
export function nextRun(): number {
  if (typeof window === "undefined") return 1;
  try {
    const now = Number(window.localStorage.getItem(RUN_KEY) ?? 0);
    const next = Number.isFinite(now) ? now + 1 : 1;
    window.localStorage.setItem(RUN_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

/** The seed a run's stream starts from. Fixed base, mixed with the run. */
export function seedForRun(run: number): number {
  return (0x5f1e_3a21 ^ Math.imul(run, 2654435761)) >>> 0;
}
