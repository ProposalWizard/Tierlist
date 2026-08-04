import { makeFakeDb, buildRows } from "./fakeSupabase.mjs";
import {
  AM_POSITION_SEQUENCE,
  fetchRoundPlayers,
  isDraftableSlot,
  positionSequenceForFormation,
} from "../../lib/americanDraft";
import { FORMATIONS } from "../../components/draft/formations";

/**
 * Groundwork for drafting formations other than 4-3-3.
 *
 * The draft currently hardcodes a 4-3-3 round sequence. Before that can become
 * a choice, two things have to hold for EVERY formation in the app:
 *   1. every slot label it uses has a pool filter — a slot without one would
 *      offer the entire database for that round;
 *   2. every slot actually has candidates, so no formation can strand a round
 *      on "no players available".
 * These tests pin both down, plus the shape of the generated sequence.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── Every formation produces a usable sequence ───────────────────────────────
for (const f of FORMATIONS) {
  const seq = positionSequenceForFormation(f.slots);
  check(seq !== null, `${f.name}: produces a round sequence`);
  if (!seq) continue;
  check(seq.length === 14, `${f.name}: 14 rounds (11 starters + 3 subs)`);
  check(seq.slice(-3).every(s => s === "ANY"), `${f.name}: last three rounds are bench slots`);
  check(seq[0] === "GK", `${f.name}: keeper is drafted first (back to front)`);
  check(seq.slice(0, 11).every(isDraftableSlot), `${f.name}: every starting slot has a pool filter`);

  // The eleven drafted slots must be exactly the formation's own eleven.
  const want = [...f.slots.map(s => s.label.toUpperCase())].sort();
  const got = [...seq.slice(0, 11)].sort();
  check(JSON.stringify(want) === JSON.stringify(got), `${f.name}: drafts exactly its own eleven slots`);
}

// The live sequence must draft exactly the slots the arrange screen lays out.
// These drifted once — the draft took three CMs while the formation asks for a
// CDM and two CMs, so every squad had a centre-mid stuck in the CDM slot,
// wearing an out-of-position marker and carrying a fitness penalty into the
// simulation. This is the guard against that happening again.
const f433 = FORMATIONS.find(f => f.name === "4-3-3")!;
const want433 = [...f433.slots.map(s => s.label.toUpperCase()), "ANY", "ANY", "ANY"].sort();
check(
  JSON.stringify([...AM_POSITION_SEQUENCE].sort()) === JSON.stringify(want433),
  "the live sequence drafts exactly the 4-3-3 formation's slots",
);
check(
  JSON.stringify([...positionSequenceForFormation(f433.slots)!].sort()) === JSON.stringify(want433),
  "the generated 4-3-3 sequence matches the live one",
);

// ── Rejects anything it cannot safely build a round for ──────────────────────
check(positionSequenceForFormation([{ label: "GK", y: 92 }]) === null, "rejects a short formation");
check(
  positionSequenceForFormation(
    Array.from({ length: 11 }, (_, i) => ({ label: i === 5 ? "SW" : "CB", y: 50 + i })),
  ) === null,
  "rejects a formation using a slot with no pool filter",
);

// ── Every slot in every formation has real candidates ────────────────────────
const db = makeFakeDb({ rows: buildRows() });
const slots = Array.from(new Set(FORMATIONS.flatMap(f => f.slots.map(s => s.label.toUpperCase()))));
const counts: Record<string, number> = {};
for (const slot of slots) {
  try {
    counts[slot] = (await fetchRoundPlayers(db as never, slot, [], {}, 100000)).length;
  } catch {
    counts[slot] = 0;
  }
  check(counts[slot] >= 10, `${slot}: has at least a full round of candidates (got ${counts[slot]})`);
}

console.log("candidates per slot across a 20-season era:");
for (const s of slots.sort()) console.log(`  ${s.padEnd(4)} ${counts[s]}`);

if (problems.length) {
  console.error("\nFAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`\nPASS — all ${FORMATIONS.length} formations draftable, every slot has a pool`);
