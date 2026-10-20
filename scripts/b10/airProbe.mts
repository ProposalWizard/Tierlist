/**
 * B10 probe: how many header / volley pictures the team's cross drawings
 * give, and what the chance maker serves from them (faults, how made).
 * npx tsx scripts/b10/airProbe.mts
 */
import { authoredPool, playPool, ruleSetFor } from "../../lib/star/authoredChance";
import { makeChance, servesDrawings } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import type { ScenarioKind } from "../../lib/star/canvasEngine";

for (const kind of ["header", "volley"] as ScenarioKind[]) {
  const own = authoredPool(kind).length;
  const pool = playPool(kind);
  const set = ruleSetFor(kind);
  console.log(`${kind}: own drawings ${own}, played from ${pool.length} (${pool.map((s) => s.id.replace(/^air-\w+-/, "")).join(", ")})`);
  console.log(`  serves drawings: ${servesDrawings(kind)}; rule set n=${set?.n}`);
  const faults = new Map<string, number>();
  const how = new Map<string, number>();
  let faulty = 0;
  const N = 400;
  for (let s = 1; s <= N; s++) {
    const m = makeChance({ source: { from: "kind", kind }, rng: mulberry32(s * 7919), memory: null });
    how.set(m.how, (how.get(m.how) ?? 0) + 1);
    if (m.faults.length) faulty++;
    for (const f of m.faults) faults.set(f, (faults.get(f) ?? 0) + 1);
  }
  console.log(`  ${N} served: how ${JSON.stringify(Object.fromEntries(how))}, with a fault ${faulty}`);
  for (const [f, n] of faults) console.log(`    ${n}× ${f}`);
}
