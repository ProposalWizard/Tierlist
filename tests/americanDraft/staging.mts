import { makeFakeDb } from "./fakeSupabase.mjs";
import {
  fetchRoundPlayers,
  makeAmericanState,
  makeReplacementState,
  stageNextRound,
  takeStagedRound,
  playerNameKey,
} from "../../lib/americanDraft";

/**
 * Round staging: the pool for round N+1 is built DURING round N and parked in
 * storage, so the round-advance request only reads it. These tests pin down
 * the safety properties that make that trick sound:
 *   - a staged pool never repeats anything from the current board
 *   - consuming it is one-shot (the file dies with the read)
 *   - a pool containing a since-taken player is rejected outright
 *   - a replacement stage honours the goalkeeper guarantee
 *   - there is nothing to stage past the final round
 */

const POSN = ["GK","GK","GK","RB","RB","CB","CB","CB","CB","LB","LB","CDM","CDM",
              "CM","CM","CM","CAM","CAM","RW","RW","LW","LW","ST","ST","ST"];

function build() {
  const rows: any[] = []; let id = 1;
  for (let year = 2007; year <= 2026; year++) {
    for (let club = 0; club < 20; club++) {
      for (let i = 0; i < 25; i++) {
        rows.push({
          id: id++, sofifa_id: `p${year}_${club}_${i}`, name: `P ${year}-${club}-${i}`,
          overall: 68 + ((i * 7 + club) % 20), manual_overall: null,
          positions: POSN[i % POSN.length], manual_positions: null, age: 25,
          image_url: null, nationality: "England", manual_nationality: null,
          club: `Club ${club}`, league: "Premier League",
          fifa_edition: `FIFA ${year}`, fifa_year: year,
        });
      }
    }
  }
  return rows;
}

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const idsOf = (ps: { sofifa_id: string }[]) => new Set(ps.map(p => p.sofifa_id));

const db = makeFakeDb({ rows: build(), storage: true });
const room = { id: "room1", settings: {}, season_number: 1 };

// ── Initial draft ────────────────────────────────────────────────────────────
const pool0 = await fetchRoundPlayers(db as never, "GK", []);
const state = makeAmericanState(["alice", "bob"], pool0);

const staged = await stageNextRound(db as never, room, state);
check(!!staged && staged.length === 10, "stages 10 players for the next round");
const current = idsOf(pool0);
check((staged ?? []).every(p => !current.has(p.sofifa_id)), "staged pool is disjoint from the current board");
check((staged ?? []).every(p => p.positions.split(",").some(x => ["RB", "RWB"].includes(x.trim()))),
  "staged pool fits the next round's position (RB)");

const again = await stageNextRound(db as never, room, state);
check(!!again && JSON.stringify(idsOf(again ?? []).size) === JSON.stringify(idsOf(staged ?? []).size)
  && (again ?? []).every(p => idsOf(staged ?? []).has(p.sofifa_id)),
  "restaging returns the SAME parked pool, not a new one");

const taken1 = await takeStagedRound(db as never, room, "initial", 1, new Set<string>());
check(!!taken1 && (taken1 ?? []).every(p => idsOf(staged ?? []).has(p.sofifa_id)), "advance consumes the staged pool");
const taken2 = await takeStagedRound(db as never, room, "initial", 1, new Set<string>());
check(taken2 === null, "a staged pool can only be consumed once");

// A staged player who has somehow been taken since → the whole file is distrusted.
const staged2 = await stageNextRound(db as never, room, state);
const poisoned = new Set<string>([`name:${playerNameKey((staged2 ?? [])[0]?.name ?? "")}`]);
const rejected = await takeStagedRound(db as never, room, "initial", 1, poisoned);
check(rejected === null, "a pool containing a since-taken player is rejected");

// Nothing beyond the final round.
const lastRound = { ...state, current_round: state.position_sequence.length - 1 };
check(await stageNextRound(db as never, room, lastRound) === null, "no staging past the final round");

// ── Replacement draft ────────────────────────────────────────────────────────
const mixed = await fetchRoundPlayers(db as never, "ANY", []);
const rep = makeReplacementState({ alice: 2, bob: 1 }, { alice: true, bob: false }, ["alice", "bob"], mixed);

const repStaged = await stageNextRound(db as never, room, rep);
check(!!repStaged && (repStaged ?? []).length === 10, "replacement stage builds a pool");
const mixedIds = idsOf(mixed);
check((repStaged ?? []).every(p => !mixedIds.has(p.sofifa_id)), "replacement staged pool is disjoint from the board");
const gkCount = (repStaged ?? []).filter(p => p.positions.toUpperCase().includes("GK")).length;
check(gkCount >= 1, "replacement stage honours the goalkeeper guarantee (alice still needs one)");

const repTaken = await takeStagedRound(db as never, room, "replacement", 1, new Set<string>(), 1);
check(!!repTaken, "replacement advance consumes the staged pool");

// Demanding more keepers than the pool carries must force the live-build path.
const repStaged2 = await stageNextRound(db as never, room, rep);
check(!!repStaged2, "restage for the strict-GK check");
check(await takeStagedRound(db as never, room, "replacement", 1, new Set<string>(), 11) === null,
  "a pool short of the goalkeeper guarantee is rejected");

// When this round settles every debt, there is no next round to stage.
const repDone = makeReplacementState({ alice: 1, bob: 1 }, {}, ["alice", "bob"], mixed);
check(await stageNextRound(db as never, room, repDone) === null, "no staging when this round ends the draft");

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — staging builds ahead, consumes once, and rejects anything suspect");
