import { makeFakeDb } from "../americanDraft/fakeSupabase.mjs";
import {
  allBriefs,
  briefById,
  briefMatcher,
  buildBriefSequence,
  CHALLENGE_ROUNDS,
  fetchChallengeRound,
  MIN_BRIEF_POOL,
  STAT_BRIEF_MIN_OVERALL,
} from "../../lib/challengeDraft";
import { playerNameKey } from "../../lib/americanDraft";

/**
 * The Challenge draft: fourteen rounds, each a randomly drawn brief rather than
 * a formation slot.
 *
 * What has to hold for a run to be playable:
 *   - every round can fill a board;
 *   - every card actually satisfies the brief it was drawn for;
 *   - nobody is offered twice across a whole draft;
 *   - there is always a goalkeeper round, and it is not the last one;
 *   - a draft can be played start to finish without a round coming up empty.
 */

const NATIONS = ["England", "France", "Brazil", "Spain", "Portugal", "Netherlands", "Argentina", "Belgium"];
const CLUBS = ["Manchester United", "Manchester City", "Liverpool", "Chelsea", "Arsenal",
  "Tottenham Hotspur", "Everton", "Newcastle United", "Aston Villa", "West Ham United"];
const POSN = ["GK", "GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CM", "CAM", "RM", "LM", "RW", "LW", "ST", "ST"];

/** ~500 PL players per edition across 20 editions, with attributes. */
function buildRows() {
  const rows: Record<string, unknown>[] = [];
  let id = 1;
  for (let year = 2007; year <= 2026; year++) {
    for (let club = 0; club < 10; club++) {
      for (let i = 0; i < 50; i++) {
        const ovr = Math.max(48, Math.min(94, Math.round(82 - club * 1.2 + (Math.random() - 0.5) * 18)));
        const age = 17 + ((i * 3 + club) % 21);
        rows.push({
          id: id++,
          sofifa_id: `p${year}_${club}_${i}`,
          name: `Player ${year}-${club}-${i}`,
          overall: ovr, manual_overall: null,
          positions: POSN[i % POSN.length], manual_positions: null,
          age,
          image_url: null,
          nationality: NATIONS[(i + club) % NATIONS.length], manual_nationality: null,
          club: CLUBS[club],
          league: "Premier League",
          fifa_edition: `FIFA ${year}`, fifa_year: year,
          attributes: {
            Pace: Math.min(99, ovr + ((i * 7) % 15) - 5),
            Shooting: Math.min(99, ovr + ((i * 5) % 13) - 6),
            Passing: Math.min(99, ovr + ((i * 3) % 11) - 4),
            Dribbling: Math.min(99, ovr + ((i * 11) % 14) - 6),
            Defending: Math.min(99, ovr + ((i * 13) % 16) - 7),
            Physical: Math.min(99, ovr + ((i * 17) % 12) - 5),
          },
        });
      }
    }
  }
  return rows;
}

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const rows = buildRows();
const db = makeFakeDb({ rows });
const opts = { eraStart: 2007, eraEnd: 2026 };

// ── The catalogue is well formed ────────────────────────────────────────────
const catalogue = allBriefs();
check(catalogue.length > 40, `catalogue has plenty of briefs (${catalogue.length})`);
check(new Set(catalogue.map(b => b.id)).size === catalogue.length, "every brief id is unique");
check(catalogue.every(b => !!b.title && !!b.detail), "every brief has a title and description");
check(catalogue.every(b => !!briefById(b.id)), "every brief can be looked up by id");

// ── A generated sequence is playable ────────────────────────────────────────
const briefs = await buildBriefSequence(db as never, opts);
check(briefs.length === CHALLENGE_ROUNDS, `sequence is ${CHALLENGE_ROUNDS} rounds (got ${briefs.length})`);
check(new Set(briefs.map(b => b.id)).size === briefs.length, "no brief repeats within a run");

const gkRounds = briefs.filter(b => b.kind === "position" && b.params.parts === "GK");
check(gkRounds.length === 1, `exactly one keepers round (got ${gkRounds.length})`);
const gkIdx = briefs.findIndex(b => b.kind === "position" && b.params.parts === "GK");
check(gkIdx < CHALLENGE_ROUNDS - 1, `the keepers round is not last (index ${gkIdx})`);

const kindCounts = new Map<string, number>();
for (const b of briefs) kindCounts.set(b.kind, (kindCounts.get(b.kind) ?? 0) + 1);
check(
  Array.from(kindCounts.values()).every(n => n <= 4),
  `no kind dominates a run (${JSON.stringify(Object.fromEntries(kindCounts))})`,
);

// ── Play a full draft: every round fills, every card fits its brief ─────────
const taken = new Set<string>();
const drafted: { title: string; ovr: number; positions: string }[] = [];

for (let r = 0; r < briefs.length; r++) {
  const brief = briefs[r];
  const board = await fetchChallengeRound(db as never, brief, taken, opts, MIN_BRIEF_POOL);

  if (board.length === 0) {
    problems.push(`round ${r + 1} (${brief.title}) came up empty`);
    drafted.push({ title: brief.title, ovr: 0, positions: "—" });
    continue;
  }
  if (board.length < MIN_BRIEF_POOL) {
    problems.push(`round ${r + 1} (${brief.title}) offered only ${board.length} cards`);
  }

  // Nobody already drafted may reappear.
  for (const p of board) {
    if (taken.has(`id:${p.sofifa_id}`) || taken.has(`name:${playerNameKey(p.name)}`)) {
      problems.push(`round ${r + 1} re-offered ${p.name}, who is already drafted`);
    }
  }
  // No duplicate footballer within one board.
  const names = board.map(p => playerNameKey(p.name));
  if (new Set(names).size !== names.length) problems.push(`round ${r + 1} had a duplicate on the board`);

  // Every card must satisfy the brief.
  const match = briefMatcher(brief);
  for (const p of board) {
    const ok = match({
      sofifa_id: p.sofifa_id, name: p.name, ovr: p.ovr, positions: p.positions,
      nationality: p.nationality, club: p.club, age: p.age, fifa_year: p.fifa_year,
    });
    if (!ok) problems.push(`round ${r + 1} (${brief.title}) offered ${p.name}, who does not fit`);
  }
  // Stat briefs are enforced beyond the rating floor the matcher can see.
  if (brief.kind === "stat") {
    for (const p of board) {
      if (p.ovr < STAT_BRIEF_MIN_OVERALL) {
        problems.push(`stat round ${r + 1} offered ${p.name} at ${p.ovr}, below the floor`);
      }
      const src = rows.find(x => x.sofifa_id === p.sofifa_id && x.fifa_year === p.fifa_year) as
        { attributes?: Record<string, number> } | undefined;
      const statName = { pace: "Pace", shooting: "Shooting", passing: "Passing",
        dribbling: "Dribbling", defending: "Defending", physical: "Physical" }[String(brief.params.stat)]!;
      const val = src?.attributes?.[statName] ?? 0;
      if (val < Number(brief.params.min)) {
        problems.push(`stat round ${r + 1} (${brief.title}) offered ${p.name} with ${statName} ${val}`);
      }
    }
  }

  const choice = board[Math.floor(Math.random() * board.length)];
  taken.add(`id:${choice.sofifa_id}`);
  const nk = playerNameKey(choice.name);
  if (nk) taken.add(`name:${nk}`);
  drafted.push({ title: brief.title, ovr: choice.ovr, positions: choice.positions });
}

check(drafted.length === CHALLENGE_ROUNDS, `drafted ${drafted.length} players`);
check(
  drafted.some(d => d.positions.toUpperCase().includes("GK")),
  "the finished squad contains at least one goalkeeper",
);

console.log(`briefs available: ${catalogue.length}`);
console.log("a generated run:");
for (let i = 0; i < briefs.length; i++) {
  console.log(`  ${String(i + 1).padStart(2)}. ${briefs[i].title.padEnd(22)} -> ${drafted[i]?.ovr ?? "-"} ${drafted[i]?.positions ?? ""}`);
}
console.log(`queries for a full draft: ${(db as unknown as { __stats: { queries: number } }).__stats.queries}`);

if (problems.length) {
  console.error("\nFAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("\nPASS — every round fills, every card fits its brief, nobody repeats");
