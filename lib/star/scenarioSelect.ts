import { pickScenarioKindFrom, type ScenarioKind } from "./canvasEngine";
import type { Zone, ScenarioRequest } from "./hiddenMatch";
import { allChances, type ChanceSpec, type DistanceBand } from "./chanceFormula";

/**
 * WHICH generated chance you get — the selection half of the chance formula.
 *
 * `chanceFormula.ts` says what situations EXIST. This says which of them the
 * match actually hands you, given (a) where the ball is (the hidden match's
 * own ScenarioRequest zone), (b) which kinds make football sense from there
 * (its `kinds` list), (c) the position you play, and (d) what you have just
 * been shown.
 *
 * Position weighting is not re-implemented here: `pickScenarioKindFrom`
 * (canvasEngine.ts) already owns POSITION_WEIGHTS and is exported, so the KIND
 * is rolled through it exactly as today, and this layer only decides which of
 * the many generated variants of that kind you get. A striker still gets the
 * one-on-one far more often than the cutback; he just stops getting the SAME
 * one-on-one every time.
 *
 * ── The anti-repeat ──
 *
 * A short memory of recent `signature`s (kind + distance band + lateral band —
 * "what situation was that", not "which exact variant"). A candidate whose
 * signature is in the memory is skipped while any un-seen candidate remains,
 * so the same situation is never served twice running, and never falls through
 * to nothing when the pool for a zone is genuinely small.
 */

/** How many recent situations are remembered. */
export const RECENT_MEMORY = 4;

export interface SelectionMemory {
  /** Most recent first. */
  recent: string[];
}

export function newSelectionMemory(): SelectionMemory { return { recent: [] }; }

export function rememberChance(mem: SelectionMemory, spec: ChanceSpec): void {
  mem.recent.unshift(spec.signature);
  if (mem.recent.length > RECENT_MEMORY) mem.recent.length = RECENT_MEMORY;
}

/**
 * Which distance bands a zone can put the ball in.
 *
 * The hidden match's zones are coarse ("box", "attacking", "middle"); the
 * formula's distance bands are metres. This is the one mapping between them,
 * and it is deliberately overlapping — the edge of the box is reachable from
 * either side of that boundary, which is exactly what it is in a real match.
 */
export const ZONE_DISTANCES: Record<Zone, DistanceBand[]> = {
  box: ["in_box", "edge_of_box"],
  attacking: ["edge_of_box", "just_outside"],
  middle: ["just_outside", "long_range"],
  defensive: [],
  own_box: [],
};

export interface SelectOptions {
  request: ScenarioRequest;
  position: string;
  rng: () => number;
  memory: SelectionMemory;
  /** Defaults to every generated chance. Injectable for the measurement. */
  pool?: ChanceSpec[];
}

/**
 * Pick a generated chance for this request, or null to fall back to today's
 * behaviour — which is what happens for a dead ball, a dribble, a build-up,
 * or any request whose zone/kind pair the formula has nothing for. That
 * fallback is the whole zero-regression guarantee: nothing this returns null
 * for changes at all.
 */
export function selectChance(opts: SelectOptions): ChanceSpec | null {
  const { request, position, rng, memory } = opts;
  if (request.dribble) return null;
  const bands = ZONE_DISTANCES[request.zone] ?? [];
  if (bands.length === 0) return null;

  const pool = opts.pool ?? allChances();
  // Which situations are genuinely available from here.
  //
  // Two tests, both applied: the hidden match's own "what makes sense from
  // here" kind list (never widened — that is its decision, and widening it
  // measurably collapsed the mix onto whichever kind the position happens to
  // weight highest), and the formula's finer distance-band test on top.
  const usable = pool.filter(s =>
    request.kinds.includes(s.kind) && bands.includes(s.params.distance));
  if (usable.length === 0) return null;

  // Anti-repeat first, so the kind roll itself avoids a kind whose only
  // available situations are ones you have just been shown.
  const freshAll = usable.filter(s => !memory.recent.includes(s.signature));
  const from0 = freshAll.length > 0 ? freshAll : usable;

  const kinds = Array.from(new Set(from0.map(s => s.kind))) as ScenarioKind[];
  const kind = pickScenarioKindFrom(position, rng, kinds);

  const from = from0.filter(s => s.kind === kind);
  if (from.length === 0) return null;
  const pick = from[Math.floor(rng() * from.length)] ?? from[from.length - 1];
  rememberChance(memory, pick);
  return pick;
}
