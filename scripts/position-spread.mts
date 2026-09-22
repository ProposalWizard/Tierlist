/**
 * scripts/position-spread.mts — what each playable position actually gets.
 *
 *   npx tsx scripts/position-spread.mts
 *
 * Runs whole matches through the real path (newMatch → advanceUntilInvolved →
 * selectChance → pickScenarioKindFrom), the same one chanceFormula.mts uses,
 * and prints the per-kind share for each position a player can be.
 */
import { newMatch, advanceUntilInvolved, resolveScenario, type HiddenMatchInputs, type ScenarioResult } from "../lib/star/hiddenMatch";
import { selectChance, newSelectionMemory } from "../lib/star/scenarioSelect";
import { pickScenarioKindFrom } from "../lib/star/canvasEngine";
import type { ScenarioKind } from "../lib/star/scenarios";
import { mulberry32 } from "../lib/star/season";

const EVEN: HiddenMatchInputs = { teamStrength: 70, oppStrength: 70, playerSkill: 65, pace: 60 };
const MATCHES = 500;
const POSITIONS = (process.argv[2] ? [process.argv[2]] : ["ST", "CAM", "LW", "RW"]);

function standIn(rng: () => number): ScenarioResult {
  const r = rng();
  return r < 0.12 ? "goal" : r < 0.45 ? "delivered" : r < 0.75 ? "saved" : "lost";
}

function run(position: string, seed = 20260922): string[] {
  const kinds: string[] = [];
  for (let m = 0; m < MATCHES; m++) {
    const rng = mulberry32(seed + m * 7919);
    const state = newMatch(rng);
    const memory = newSelectionMemory();
    const inputs: HiddenMatchInputs = { ...EVEN, position };
    for (let guard = 0; guard < 400; guard++) {
      const step = advanceUntilInvolved(state, inputs, rng, 90);
      if (!step.request) break;
      const request = step.request;
      let kind: ScenarioKind;
      if (request.dribble) kind = "dribble" as ScenarioKind;
      else {
        const plan = selectChance({ request, position, rng, memory });
        kind = plan ? plan.kind : pickScenarioKindFrom(position, rng, request.kinds);
      }
      kinds.push(kind);
      resolveScenario(state, standIn(rng));
      if (state.minute >= 90) break;
    }
  }
  return kinds;
}

const ALL = new Set<string>();
const rows: Record<string, Record<string, number>> = {};
for (const p of POSITIONS) {
  const kinds = run(p);
  const c: Record<string, number> = {};
  for (const k of kinds) c[k] = (c[k] ?? 0) + 1;
  rows[p] = {};
  for (const [k, n] of Object.entries(c)) { rows[p][k] = (n / kinds.length) * 100; ALL.add(k); }
  rows[p].__perMatch = kinds.length / MATCHES;
}

const kindList = Array.from(ALL).sort();
const pad = (s: string, n: number) => s.padEnd(n);
console.log(pad("kind", 16) + POSITIONS.map((p) => p.padStart(8)).join(""));
for (const k of kindList) {
  console.log(pad(k, 16) + POSITIONS.map((p) => ((rows[p][k] ?? 0).toFixed(1) + "%").padStart(8)).join(""));
}
console.log(pad("chances/match", 16) + POSITIONS.map((p) => rows[p].__perMatch.toFixed(1).padStart(8)).join(""));
