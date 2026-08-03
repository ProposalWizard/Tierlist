import { makeFakeDb } from "./fakeSupabase.mjs";
import { fetchRoundPlayers } from "../../lib/americanDraft";

/**
 * Weak players should be RARE, not absent — and "weak" must be judged against
 * the player's own season, because FIFA ratings drift upward and a fixed cutoff
 * would quietly make old seasons rarer.
 *
 * In prime mode the judgement uses the player's PEAK rating, since that is what
 * the card shows: a teenager who later became a star is not a weak card.
 */
const POSN = ["GK","GK","GK","RB","RB","CB","CB","CB","CB","LB","LB","CDM","CDM",
              "CM","CM","CM","CAM","CAM","RW","RW","LW","LW","ST","ST","ST"];

function build() {
  const rows: any[] = []; let id = 1;
  for (let year = 2007; year <= 2026; year++) {
    const infl = (year - 2007) * 0.35;            // ratings inflate over time
    for (let club = 0; club < 20; club++) {
      const strength = 82 - club * 0.9 + infl;
      for (let i = 0; i < 33; i++) {
        const youth = i >= 22;                     // ~a third are academy
        const ovr = youth ? Math.round(47 + Math.random() * 17 + infl * 0.5)
                          : Math.round(strength + (Math.random() - 0.5) * 8);
        rows.push({ id: id++, sofifa_id: `p${year}_${club}_${i}`, name: `P ${year}-${club}-${i}`,
          overall: Math.max(45, Math.min(94, ovr)), manual_overall: null,
          positions: POSN[i % POSN.length], manual_positions: null, age: youth ? 18 : 27,
          image_url: null, nationality: "England", manual_nationality: null,
          club: `Club ${club}`, league: "Premier League",
          fifa_edition: `FIFA ${year}`, fifa_year: year });
      }
    }
  }
  return rows;
}

const rows = build();
const problems: string[] = [];

async function measure(prime: boolean) {
  const db = makeFakeDb({ rows });
  let weak = 0, total = 0;
  const seasons = new Map<number, number>();
  for (let i = 0; i < 800; i++) {
    for (const p of await fetchRoundPlayers(db as never, "CB", [], { prime })) {
      total++; if (p.ovr < 65) weak++;
      seasons.set(p.fifa_year, (seasons.get(p.fifa_year) ?? 0) + 1);
    }
  }
  let older = 0, newer = 0;
  for (const [y, c] of Array.from(seasons.entries())) {
    if (y <= 2011) older += c;
    if (y >= 2022) newer += c;
  }
  return { weakPct: weak / total * 100, ratio: newer / Math.max(1, older), seasons: seasons.size };
}

const normal = await measure(false);
const prime = await measure(true);

console.log(`normal  weak ${normal.weakPct.toFixed(0)}%   newer/older ${normal.ratio.toFixed(2)}x   seasons ${normal.seasons}/20`);
console.log(`prime   weak ${prime.weakPct.toFixed(0)}%   newer/older ${prime.ratio.toFixed(2)}x   seasons ${prime.seasons}/20`);

// Weak players must be rare but must NOT be eliminated.
if (normal.weakPct > 15) problems.push(`too many weak cards (${normal.weakPct.toFixed(0)}%)`);
if (normal.weakPct < 1) problems.push(`weak players effectively removed (${normal.weakPct.toFixed(1)}%) — they should stay possible`);
// No season may be squeezed out by the weighting.
for (const [label, m] of [["normal", normal], ["prime", prime]] as const) {
  if (m.seasons < 20) problems.push(`${label}: only ${m.seasons}/20 seasons appeared`);
  if (m.ratio < 0.85 || m.ratio > 1.15) problems.push(`${label}: season bias ${m.ratio.toFixed(2)}x (want ~1.00x)`);
}

// A late bloomer — poor early, world class later — must NOT be treated as weak
// in prime mode, because prime shows his peak.
const bloomer = rows.filter(r => r.sofifa_id === "p2010_0_25");
bloomer.forEach(r => { r.positions = "CB"; r.overall = 52; });
rows.push({ ...bloomer[0], id: 999999, sofifa_id: "p2010_0_25", fifa_year: 2024,
            fifa_edition: "FC 24", overall: 89, positions: "CB" });
// A DIFFERENT era range, so this gets a fresh pool: the era pool is cached in
// module scope and the runs above already cached 2007-2026 without this player.
const db2 = makeFakeDb({ rows });
let seenInPrime = 0;
for (let i = 0; i < 400; i++) {
  const pool = await fetchRoundPlayers(db2 as never, "CB", [], { prime: true, eraStart: 2008, eraEnd: 2026 });
  if (pool.some(p => p.sofifa_id === "p2010_0_25")) seenInPrime++;
}
console.log(`late bloomer (52 early, 89 peak) appeared in ${seenInPrime}/400 prime rounds`);
if (seenInPrime === 0) problems.push("late bloomer never appeared in prime mode — peak rating is being ignored");

console.log(problems.length === 0 ? "\nPASS" : "\nFAILED:\n" + problems.map(p => "  - " + p).join("\n"));
if (problems.length) process.exit(1);
