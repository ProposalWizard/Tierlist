import { setupKind } from "./kindRules";
import {
  buildScenario,
  type Scenario,
  type ScenarioKind,
} from "./canvasEngine";
import { mulberry32 } from "./season";
import { fixBaseScenario, scenarioFaults } from "./baseScenario";
import { applyAuthoredShape, nextAuthoredShape } from "./authoredChance";
import {
  allPlans,
  applyChancePlan,
  planFaults,
  COUPLING,
  ZONE_BANDS,
  type ChancePlan,
} from "./chanceFormula";
import { selectChance, newSelectionMemory, type SelectionMemory } from "./scenarioSelect";
import type { Lane, Zone, ChancePattern } from "./hiddenMatch";

/**
 * THE GALLERY'S SIMULATE BUTTON — one press, one chance, exactly as the match
 * would have generated it.
 *
 * Asked for directly: "I'd like to be able to click on any of these
 * one-on-ones and then have it simulate a different one-on-one option… If I
 * press that 100 times, it should never be the same scenario two times in a
 * row."
 *
 * Nothing about HOW a chance is generated lives here. The match's own path is
 * `selectChance` (scenarioSelect.ts) → `buildScenario` → `fixBaseScenario` →
 * `applyChancePlan` (see CanvasMatch.tsx's request branch), and this file walks
 * exactly that path with exactly those functions. The anti-repeat is
 * `selectChance`'s own 8-deep `SelectionMemory`, reused rather than restated —
 * there is one anti-repeat in this codebase and it is not in here.
 *
 * The only thing this file adds is what a GALLERY needs and a match does not:
 *
 *  - Which request to make. A match knows where the ball is; the gallery is
 *    asked for "another one of THESE", so the zone/lane/pattern are derived
 *    from the kind's own COUPLING row rather than invented.
 *  - A SEED per press, so a simulated picture is re-derivable. Nothing a person
 *    is asked to judge may come from `Math.random()` — a sim is rebuilt from
 *    `{ kind, seed, planId }` and is the same picture on every refresh.
 */

export interface SimSpec {
  kind: ScenarioKind;
  /** The seed both the base build and the plan's own jitter run from. */
  seed: number;
  /** `ChancePlan.id`, or null for a kind the formula has no cells for. */
  planId: string | null;
}

/** Which hidden-match zones can put this kind's ball where the kind lives. */
export function zonesForKind(kind: ScenarioKind): Zone[] {
  const bands = COUPLING[kind]?.distance;
  if (!bands) return [];
  const out: Zone[] = [];
  for (const zone of ["box", "attacking", "middle"] as Zone[]) {
    const zb = ZONE_BANDS[zone] ?? [];
    if (zb.some((b) => bands.includes(b))) out.push(zone);
  }
  return out;
}

/**
 * Which channels the ball can have been worked down for this kind.
 *
 * `selectChance` filters a centre-lane request to plans whose lateral band is
 * `centre` or `half_space`; a left/right request filters on `side` instead and
 * always has something to draw from. So the centre is the only lane that a
 * kind can genuinely be unable to offer (a tight angle is never central).
 */
export function lanesForKind(kind: ScenarioKind): Lane[] {
  const lat = COUPLING[kind]?.lateral ?? [];
  const out: Lane[] = ["left", "right"];
  if (lat.includes("centre") || lat.includes("half_space")) out.unshift("centre");
  return out;
}

export function patternsForKind(kind: ScenarioKind): ChancePattern[] {
  const p = COUPLING[kind]?.pattern ?? [];
  return p.length ? [...p] : ["settled"];
}

/** Does the chance formula have any cells for this kind at all? */
export function formulaCoversKind(kind: string): boolean {
  return !!COUPLING[kind];
}

export function newSimMemory(): SelectionMemory {
  return newSelectionMemory();
}

const pick = <T,>(rng: () => number, xs: T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];

/**
 * One press of Simulate.
 *
 * `rng` is the session's own seeded stream — the caller keeps it, so pressing
 * the button a hundred times is a hundred re-derivable draws rather than a
 * hundred coin flips. `memory` is carried between presses; that is the whole
 * anti-repeat.
 *
 * A kind the formula does not own (a corner, a penalty, a build-up) comes back
 * with `planId: null` — that is the match's own fallback path, which builds the
 * base at a fresh seed and nothing more.
 */
export function nextSim(
  kind: ScenarioKind,
  rng: () => number,
  memory: SelectionMemory,
  lastPicture?: string,
  position = "ST",
): SimSpec {
  let planId: string | null = null;
  const zones = zonesForKind(kind);

  if (formulaCoversKind(kind) && zones.length) {
    const lanes = lanesForKind(kind);
    const patterns = patternsForKind(kind);
    // Up to a handful of attempts: `selectChance` returns null when the only
    // cell left in a narrow pool is the one just shown, which is the
    // anti-repeat doing its job — a different lane or zone is a real second
    // chance at a genuinely different picture, not a way round it.
    for (let i = 0; i < 8; i++) {
      const plan = selectChance({
        request: {
          zone: pick(rng, zones),
          kinds: [kind],
          reason: "gallery sim",
          lane: pick(rng, lanes),
          pattern: pick(rng, patterns),
        },
        position,
        rng,
        memory,
        shape: null,
      });
      if (plan) { planId = plan.id; break; }
    }
  }

  // The last guard, and a different thing from the anti-repeat above: that one
  // stops the same SITUATION being served twice; this one stops the same
  // PICTURE. They are not the same check — a penalty has no plan and only one
  // situation, so the only variety it has is which seed the builder ran on,
  // and two seeds can land the keeper in the same spot. Re-rolls the seed
  // alone (never the plan, which is already settled) until the picture is not
  // the one just shown.
  let spec: SimSpec = { kind, seed: seedFrom(rng), planId };
  for (let i = 0; i < 8 && lastPicture; i++) {
    if (pictureKey(buildSimScenario(spec)) !== lastPicture) return spec;
    spec = { kind, seed: seedFrom(rng), planId };
  }
  return spec;
}

const seedFrom = (rng: () => number) => Math.floor(rng() * 2_000_000_000) + 1;

/** What "the same picture" means: every body on the pitch, to the metre,
 *  plus the frame it is seen through. */
export function pictureKey(sc: Scenario): string {
  const r = (v: number) => Math.round(v);
  return [
    `b${r(sc.ball.x)},${r(sc.ball.y)}`,
    `p${r(sc.player.x)},${r(sc.player.y)}`,
    `k${r(sc.keeper.x)},${r(sc.keeper.y)}`,
    ...sc.defenders.map((d) => `d${r(d.x)},${r(d.y)}`),
    ...(sc.runner ? [`r${r(sc.runner.pos.x)},${r(sc.runner.pos.y)}`] : []),
    `v${r(sc.viewport.x1)},${r(sc.viewport.y1)},${r(sc.viewport.x2)},${r(sc.viewport.y2)}`,
  ].join("|");
}

let PLAN_INDEX: Map<string, ChancePlan> | null = null;
export function planById(id: string | null): ChancePlan | null {
  if (!id) return null;
  if (!PLAN_INDEX) {
    PLAN_INDEX = new Map();
    for (const p of allPlans()) PLAN_INDEX.set(p.id, p);
  }
  return PLAN_INDEX.get(id) ?? null;
}

/**
 * Rebuild a simulated scenario from its spec — the same picture every time.
 *
 * Two independent streams off the one seed: the base builder's, and the
 * plan's own band jitter. Same order as the match (base, repair, expand), so
 * the base always has the last word.
 */
export function buildSimScenario(spec: SimSpec): Scenario {
  const sc = buildScenario(spec.kind, mulberry32(spec.seed));
  fixBaseScenario(sc);
  const plan = planById(spec.planId);
  if (plan) applyChancePlan(sc, plan, mulberry32(spec.seed ^ 0x9e3779b9));
  // ── Then the pictures that were actually DRAWN ──
  //
  // "When I press Simulate on one-on-ones, it should be scanning the current
  // one-on-ones in that section… if I add 5 new ones, it should just
  // automatically scan, and that should be taken into account while
  // simulating new randomizers."
  //
  // So a Simulate for a kind with authored scenarios serves a nudged variant
  // of one of them, checked against the rule set those same scenarios
  // produce. The pool is read live (lib/star/authoredChance.ts), so saving a
  // scenario changes what the very next press produces.
  //
  // Its own stream off the same seed, so a spec still rebuilds to the exact
  // same picture every time — which the gallery relies on to repaint without
  // the scenario shifting under it.
  // The seed is passed as the STABLE KEY: this cell keeps the same base
  // drawing as the pool grows, so an edit made on it stays on the picture it
  // was made for. See stableBase().
  const shape = authoredShapeFor(spec);
  if (shape) applyAuthoredShape(sc, shape);
  // The kind's hard ruleset, exactly as the match applies it (CanvasMatch's
  // loadScenario), so Simulate shows what the game actually serves.
  setupKind(sc, mulberry32(spec.seed ^ 0x7e11), { appliedAuthored: !!shape, appliedPlan: !!plan, keeperStrength: 62 });
  return sc;
}

/** Which authored drawing this spec is built from, if any — so a binned
 *  the draw `buildSimScenario` makes, so the answer is the real one. */
export function authoredShapeFor(spec: SimSpec) {
  return nextAuthoredShape(spec.kind, mulberry32(spec.seed ^ 0x5bf03635), [], spec.seed);
}

/** What is wrong with a simulated picture, in plain English. */
export function simFaults(sc: Scenario, planId: string | null): string[] {
  const plan = planById(planId);
  return plan ? planFaults(sc, plan) : scenarioFaults(sc);
}

/** The anti-repeat key a sim is counted as "the same scenario" by. */
export function simSignature(spec: SimSpec): string {
  const plan = planById(spec.planId);
  return plan ? plan.signature : `${spec.kind}|base`;
}

/**
 * INFINITE HIGHLIGHTS — one press, one chance, drawn from a POOL of kinds.
 *
 * The only thing this adds over `nextSim` is which kind to ask for. Every
 * chance still comes off the match's own path (`selectChance` → `buildScenario`
 * → `fixBaseScenario` → `applyChancePlan`) through `nextSim` itself, and still
 * carries the same `SelectionMemory` between presses, so the anti-repeat spans
 * the whole stream rather than restarting each time the kind changes.
 *
 * The pick is UNIFORM across the selected kinds, deliberately — this is a
 * review tool, not a match. A kind is toggled on because someone wants to LOOK
 * at it, so each selected kind should come round about as often as any other,
 * rather than at the rate the real game serves it (`FREQ`, scenarioSelect.ts).
 */
export function nextHighlight(
  kinds: ScenarioKind[],
  rng: () => number,
  memory: SelectionMemory,
  lastPicture?: string,
  position = "ST",
): SimSpec | null {
  if (!kinds.length) return null;
  return nextSim(pick(rng, kinds), rng, memory, lastPicture, position);
}
