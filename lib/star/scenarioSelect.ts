import { pickScenarioKindFrom, type ScenarioKind } from "./canvasEngine";
import type { Zone, ScenarioRequest, Lane } from "./hiddenMatch";
import {
  generateChance, withShape, ZONE_BANDS,
  type ChancePlan, type ChanceContext,
} from "./chanceFormula";
import type { ShapeInput } from "./formationShape";

/**
 * WHICH generated chance the match hands you — the selection half of the
 * formula (spec §4.2/§4.3).
 *
 * `chanceFormula.ts` says which situations exist. This decides which of them
 * you are actually shown, given where the ball is (the hidden match's own
 * zone + lane), which kinds make sense from there, the position you play, and
 * what you were shown a moment ago.
 *
 * Position weighting is not re-implemented: `pickScenarioKindFrom`
 * (canvasEngine.ts) owns POSITION_WEIGHTS and is exported, so the KIND is
 * rolled through it exactly as today. On top of it sits the spec's realism
 * prior (`FREQ`) so the real frequency of each kind in each zone/lane is not
 * flattened — a cutback from a wide position in the box should be common
 * because it IS common, not because a striker's weight table says so.
 */

/** How many recent situations are remembered (spec §4.3 keeps 8). */
export const RECENT_MEMORY = 8;

export interface SelectionMemory {
  /** Most recent first. */
  recent: string[];
}

export function newSelectionMemory(): SelectionMemory { return { recent: [] }; }

export function rememberChance(mem: SelectionMemory, plan: ChancePlan): void {
  mem.recent.unshift(plan.signature);
  if (mem.recent.length > RECENT_MEMORY) mem.recent.length = RECENT_MEMORY;
}

/**
 * Spec §4.2's realism prior: how often each kind really happens in each
 * zone/lane, independent of who you are. Multiplied by the position weight, so
 * a centre-back still mostly gets headers and a winger still mostly gets
 * crosses — but neither gets a kind that barely exists in that part of the
 * pitch just because his own table happens to rate it.
 */
export const FREQ: Record<string, Partial<Record<ScenarioKind, number>>> = {
  // RETUNED 21 Sep 2026 against the measured mix, after a real report from
  // playing: "I'm getting a lot of long shots. I'm getting a lot of buildup...
  // I'm not getting many one-on-ones, if any. I'm not getting any headers.
  // I'm not getting any by the way [byline crosses]."
  //
  // He was right, and it was this table. Measured for a striker over 400
  // matches, share of highlights against target:
  //   long_range   13.1% (target 7)    through_ball 13.0% (8)
  //   byline_cross  1.5% (target 5)    cutback       6.4% (8)
  //   tight_angle   6.8% (target 9)
  // and the top-3 share had gone the WRONG WAY, 28.2% -> 38.0% against a 32%
  // bar: the formula bought variety WITHIN a kind (14 -> 64 situations) while
  // making the spread BETWEEN kinds worse.
  //
  // These numbers were always the spec's own "realism prior" — reasoned, never
  // measured, and explicitly flagged as such. So they are the right thing to
  // move, rather than reaching for the position weights, which are a different
  // and genuinely tuned table.
  "box|centre": { one_on_one: 1.0, volley: 0.8, header: 0.9, tight_angle: 0.8 },
  "box|wide": { cutback: 1.0, tight_angle: 0.9, byline_cross: 0.9, header: 0.6, volley: 0.5 },
  "attacking|centre": { through_ball: 0.6, long_range: 0.5, one_on_one: 0.5, cutback: 0.4 },
  "attacking|wide": { byline_cross: 1.0, cutback: 0.9, through_ball: 0.4, long_range: 0.3 },
  // The middle third is where most of a match actually happens, so its own row
  // matters more than any other. Without it every middle-zone kind scored the
  // same default and the two the formula has cells for (through_ball,
  // long_range) drifted up by ~5pp each at build-up's expense — measured, and
  // the reason this row exists at all.
  "middle|centre": { buildup: 1.0, midfield_pass: 0.85, through_ball: 0.45, long_range: 0.35 },
  "middle|wide": { buildup: 1.0, midfield_pass: 0.85, through_ball: 0.45, long_range: 0.35 },
};

function freqKey(zone: Zone, lane: Lane): string {
  return `${zone}|${lane === "centre" ? "centre" : "wide"}`;
}

export interface SelectOptions {
  request: ScenarioRequest;
  position: string;
  rng: () => number;
  memory: SelectionMemory;
  /** Formation/playstyle/strength context the plan expands against. */
  shape?: ShapeInput | null;
}

/**
 * Pick a generated chance, or null to fall through to today's untouched path.
 *
 * Null is the zero-regression guarantee: a dead ball, a dribble, a build-up,
 * or any request the formula has no cell for behaves exactly as it always has.
 */
export function selectChance(opts: SelectOptions): ChancePlan | null {
  const { request, position, rng, memory } = opts;
  if (request.dribble) return null;
  const bands = ZONE_BANDS[request.zone] ?? [];
  if (bands.length === 0) return null;
  const lane: Lane = request.lane ?? "centre";

  // The kind is rolled over EVERY kind the match offered, not only the ones
  // the formula has cells for.
  //
  // Measured, doing it the other way round: filtering to formula kinds first
  // sent a midfielder's through-balls from 12.0% to 20.6% and long-range from
  // 9.1% to 14.9%, because build-up and midfield passes — which the formula
  // deliberately has no cells for — could never win the roll. The formula is
  // meant to add variety WITHIN a kind, never to change which kinds the match
  // produces. A rolled kind with no cell simply returns null and falls through
  // to today's untouched path, carrying that same kind.
  const prior = FREQ[freqKey(request.zone, lane)] ?? {};
  const pool: ScenarioKind[] = [];
  for (const k of request.kinds) {
    const entries = Math.max(1, Math.round((prior[k] ?? 0.5) * 4));
    for (let i = 0; i < entries; i++) pool.push(k);
  }
  const kind = pickScenarioKindFrom(position, rng, pool);

  const plan = generateChance(
    { zone: request.zone, kinds: [kind], lane, pattern: request.pattern },
    { position } as ChanceContext,
    rng,
    memory.recent,
  );
  if (!plan) return null;
  rememberChance(memory, plan);
  return withShape(plan, opts.shape);
}
