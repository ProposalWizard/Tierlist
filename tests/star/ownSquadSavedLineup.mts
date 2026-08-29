// A tiny localStorage so lineupStore.ts (and matchdayFor's read of it) can
// run headless — see tests/star/career.mts for the same pattern.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import { matchdayFor } from "../../lib/star/teamsheet";
import { formationOf } from "../../lib/star/formations";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, Fixture, LeagueSquad } from "../../lib/star/types";

/**
 * A SAVED PLAYER YOUR OWN SQUAD ALREADY DROPPED.
 *
 * Reported directly: a real, 70-rated midfielder, saved into a slot on the
 * /lineups builder, would never appear on the actual team sheet — not
 * starting, not on the bench, no matter where he was placed. Read by the
 * player as the game refusing specific POSITIONS. The real cause: your own
 * `career.squad` is not your whole roster — buildSquadFromRoster
 * (realSquad.ts) keeps only the single best fit per slot in a fixed
 * 20-slot template, so a squad player who loses that competition does not
 * exist in `career.squad` at all, even though the /lineups builder (reading
 * the unrestricted LeagueSquad data) happily offers him. matchdayFor now
 * widens the search to your own club's full roster — already sitting in
 * career.leagueSquads — but only when there is actually something saved to
 * resolve.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "AFC Bournemouth", "Liverpool", "Arsenal", "Chelsea", "Tottenham Hotspur",
  "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
  "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "Manchester City", "Leeds United",
  "Burnley", "Sunderland",
];

function careerWith(): CareerState {
  const base = makeInitialCareer(
    {
      firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
      club: "AFC Bournemouth", clubBadge: null, position: "ST",
      nationality: "England", startYear: 2027,
    },
    CLUBS,
  );
  // The bare sofifa ids already in `career.squad` (fake-generated, "sp_N")
  // never collide with a real sofifa id — this stands in for "the twenty who
  // won the slot competition" without needing a real roster fetch.
  const known = new Set(base.squad.map(p => p.id));
  check(!known.has("70001"), "sanity: the extra man's id is not already in the generated squad");

  // Your club's FULL roster, as career.leagueSquads already carries it — one
  // real man ("70001") who is not among the twenty in career.squad, exactly
  // the situation a depth player who lost the slot competition is in.
  const ownFullRoster: LeagueSquad = {
    club: "AFC Bournemouth",
    players: [
      ...base.squad.map(p => ({ id: p.id, name: p.name, position: p.position, overall: p.overall ?? 65, goals: 0, assists: 0 })),
      { id: "70001", name: "Sean Stern", position: "CM", overall: 70, goals: 0, assists: 0 },
    ],
  };
  return { ...base, leagueSquads: [ownFullRoster] };
}

const FIXTURE: Fixture = { week: 1, opponent: "Liverpool", home: true, played: false, kind: "league" };

// ── Nothing saved: the dropped player stays dropped, exactly as before ─────
{
  const md = matchdayFor(careerWith(), FIXTURE, false);
  const mine = md.home;
  check(!mine.xi.some(p => p.id === "70001") && !mine.bench.some(p => p.id === "70001"),
    "with nothing saved, auto-pick still draws from the same twenty it always has");
}

// ── Saved into the STARTING XI, he actually starts ──────────────────────────
{
  const shape = formationOf("433");
  const cmSlot = shape.slots.findIndex(s => s.role === "CM");
  const xi = shape.slots.map(() => null) as (string | null)[];
  xi[cmSlot] = "70001";

  const md = matchdayFor(careerWith(), FIXTURE, false, undefined, undefined, { formation: shape, xi });
  const mine = md.home;
  check(mine.xi[cmSlot]?.id === "70001",
    `a squad player his own career had dropped still starts when the manager names him (${mine.xi[cmSlot]?.id})`);
  check(mine.xi[cmSlot]?.name === "Sean Stern", "…by name, not just by id surviving the lookup");
  check(mine.xi.length === 11, `still eleven men (${mine.xi.length})`);
}

// ── Saved onto the BENCH ONLY, he actually appears on it ────────────────────
//
// A full, explicit starting XI drawn from the ORIGINAL twenty (not "70001"),
// so there is no slot left for auto-fill to hand him instead — isolating
// bench resolution from the starting-XI case just above.
{
  const shape = formationOf("433");
  const startersOnly = careerWith().squad.slice(0, 11).map(p => p.id);
  const xi = shape.slots.map((_, i) => startersOnly[i]) as (string | null)[];

  const md = matchdayFor(careerWith(), FIXTURE, false, undefined, ["70001"], { formation: shape, xi });
  const mine = md.home;
  check(!mine.xi.some(p => p.id === "70001"), "…he is not accidentally starting in this scenario");
  check(mine.bench.some(p => p.id === "70001"),
    "…and a bench-only save is not silently dropped either — the actual bug report");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a saved lineup can field anyone in your real roster, not just the twenty your own squad kept");
