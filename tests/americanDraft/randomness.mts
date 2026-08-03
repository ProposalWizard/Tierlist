import { makeFakeDb, buildRows } from "./fakeSupabase.mjs";
import { fetchRoundPlayers } from "../../lib/americanDraft";

// ── 1. Is the pool loaded COMPLETELY, and is it cached? ──────────────────────
{
  const rows = buildRows();                       // 20 editions x 560 = 11,200
  const db = makeFakeDb({ rows });
  const seen = new Set<number>();
  // Draw many GK rounds; if the pool is complete we should eventually see
  // goalkeepers from every single edition.
  for (let i = 0; i < 400; i++) {
    const pool = await fetchRoundPlayers(db as never, "GK", [], {});
    pool.forEach(p => seen.add(p.fifa_year));
  }
  const missing = [...Array(20)].map((_, i) => 2007 + i).filter(y => !seen.has(y));
  console.log(`POOL COMPLETENESS`);
  console.log(`  editions represented: ${seen.size}/20   missing: ${missing.length ? missing.join(",") : "none"}`);
  console.log(`  queries for 400 rounds: ${(db as any).__stats.queries}  (caching works if this is ~13, not ~5000)`);
}

// ── 2. Uniform data vs skewed data ──────────────────────────────────────────
async function spread(rows: any[], label: string) {
  const db = makeFakeDb({ rows });
  let distinct = 0, clustered = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const pool = await fetchRoundPlayers(db as never, "CB", [], {});
    const years = pool.map(p => p.fifa_year);
    const uniq = new Set(years).size;
    distinct += uniq;
    // "9 of 10 inside a 5-year window" — the pattern reported.
    const sorted = [...years].sort((a, b) => a - b);
    let tight = false;
    for (let a = 0; a + 8 < sorted.length; a++) if (sorted[a + 8] - sorted[a] <= 5) tight = true;
    if (tight) clustered++;
  }
  console.log(`  ${label.padEnd(34)} avg distinct ${(distinct / N).toFixed(1)}/10   "9-in-5-years" ${(clustered / N * 100).toFixed(0)}% of rounds`);
}

console.log(`\nSEASON SPREAD`);
await spread(buildRows(), "uniform imports (ideal)");

// Realistic import gaps: recent editions fully imported, older ones thin.
const skew = buildRows().filter(r => {
  if (r.fifa_year >= 2022) return true;            // fully imported
  if (r.fifa_year >= 2015) return r.id % 3 === 0;  // ~1/3 imported
  return r.id % 8 === 0;                            // ~1/8 imported
});
await spread(skew, `skewed imports (${skew.length} rows)`);
