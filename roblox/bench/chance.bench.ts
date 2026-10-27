// Benchmark (not a twin test): how long building a chance takes, per kind.
//   node roblox/tools/bench.mjs chance     (Luau)   |   npx tsx roblox/bench/chance.bench.ts (Node)
import { makeChance, PictureMemory } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import type { ScenarioKind } from "../../lib/star/canvasEngine";
declare const os: { clock(): number } | undefined;
declare const performance: { now(): number } | undefined;
const now = () => (typeof performance !== "undefined" && performance ? performance.now() : 0);
const KINDS: ScenarioKind[] = ["long_range", "tight_angle", "one_on_one", "cutback", "byline_cross", "through_ball", "midfield_pass", "buildup", "free_kick", "corner", "penalty"];
const N = 12;
for (const kind of KINDS) {
  const t0 = now();
  for (let i = 0; i < N; i++) {
    makeChance({ source: { from: "kind", kind }, rng: mulberry32(1000 + i * 77), memory: new PictureMemory("bench", false) });
  }
  console.log(`${kind.padEnd(14)} ${((now() - t0) / N).toFixed(1)} ms`);
}
