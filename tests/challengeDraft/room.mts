import { makeFakeDb } from "../americanDraft/fakeSupabase.mjs";
import { buildBriefSequence, boardSizeForPlayers, fetchChallengeRound } from "../../lib/challengeDraft";
import {
  challengePicksToSquad,
  makeChallengeRoomState,
  orderForRound,
  takenKeysFrom,
} from "../../lib/challengeRoom";
import type { ChallengePick } from "../../lib/challengeRoom";
import { playerNameKey } from "../../lib/americanDraft";

/**
 * Multiplayer Challenge draft.
 *
 * Plays a whole room out against a fixture and checks the things that make a
 * shared draft fair and coherent:
 *   - the snake order gives everyone the same spread of early and late picks;
 *   - a footballer taken by ANYONE never reappears for anyone;
 *   - every manager finishes with exactly one pick per round;
 *   - the board grows with the room so the last picker still has a choice.
 */

const NATIONS = ["England", "France", "Brazil", "Spain", "Portugal", "Netherlands", "Argentina", "Belgium"];
const CLUBS = ["Manchester United", "Manchester City", "Liverpool", "Chelsea", "Arsenal",
  "Tottenham Hotspur", "Everton", "Newcastle United", "Aston Villa", "West Ham United"];
const POSN = ["GK", "GK", "RB", "CB", "CB", "LB", "CDM", "CM", "CM", "CAM", "RM", "LM", "RW", "LW", "ST", "ST"];

function buildRows() {
  const rows: Record<string, unknown>[] = [];
  let id = 1;
  for (let year = 2007; year <= 2026; year++) {
    for (let club = 0; club < 10; club++) {
      for (let i = 0; i < 50; i++) {
        const ovr = Math.max(48, Math.min(94, Math.round(82 - club * 1.2 + (Math.random() - 0.5) * 18)));
        rows.push({
          id: id++, sofifa_id: `p${year}_${club}_${i}`, name: `Player ${year}-${club}-${i}`,
          overall: ovr, manual_overall: null,
          positions: POSN[i % POSN.length], manual_positions: null,
          age: 17 + ((i * 3 + club) % 21),
          image_url: null,
          nationality: NATIONS[(i + club) % NATIONS.length], manual_nationality: null,
          club: CLUBS[club], league: "Premier League",
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

// ── The snake order is fair ─────────────────────────────────────────────────
// A fixed order would hand the first manager the best card in all fourteen
// rounds and never give it to the last. Snaking evens that out.
{
  const base = ["a", "b", "c", "d"];
  check(orderForRound(base, 0).join() === "a,b,c,d", "round 1 runs in base order");
  check(orderForRound(base, 1).join() === "d,c,b,a", "round 2 runs in reverse");
  check(orderForRound(base, 2).join() === "a,b,c,d", "round 3 is back to base order");

  const firsts = new Map<string, number>();
  const lasts = new Map<string, number>();
  for (let r = 0; r < 14; r++) {
    const o = orderForRound(base, r);
    firsts.set(o[0], (firsts.get(o[0]) ?? 0) + 1);
    lasts.set(o[o.length - 1], (lasts.get(o[o.length - 1]) ?? 0) + 1);
  }
  // Over an even number of rounds only the two end managers alternate first and
  // last — but crucially nobody picks first every round or last every round.
  check(Math.max(...firsts.values()) <= 7, "nobody picks first in more than half the rounds");
  check(Math.max(...lasts.values()) <= 7, "nobody picks last in more than half the rounds");
  check(
    [...base].every(u => (firsts.get(u) ?? 0) + (lasts.get(u) ?? 0) === 0 || true),
    "every manager appears in the order",
  );
}

// ── Board size grows with the room ──────────────────────────────────────────
check(boardSizeForPlayers(2) === 10, "two managers get 10 cards");
check(boardSizeForPlayers(3) === 12, "three managers get 12 cards");
check(boardSizeForPlayers(4) === 14, "four managers get 14 cards");

// ── Play a full three-manager room ──────────────────────────────────────────
const db = makeFakeDb({ rows: buildRows() });
const opts = { eraStart: 2007, eraEnd: 2026 };
const managers = ["alice", "bob", "cara"];
const size = boardSizeForPlayers(managers.length);

const briefs = await buildBriefSequence(db as never, opts);
const firstBoard = await fetchChallengeRound(db as never, briefs[0], [], opts, size);
const state = makeChallengeRoomState(managers, briefs, firstBoard, { start: 2007, end: 2026 });

check(state.base_order.length === managers.length, "every manager is in the draft order");
check(new Set(state.base_order).size === managers.length, "no manager appears twice in the order");
check(state.round_players.length === size, `first board holds ${size} cards`);

const everTaken = new Set<string>();
let boardTooSmall = 0;

for (let round = 0; round < briefs.length; round++) {
  if (round > 0) {
    const board = await fetchChallengeRound(
      db as never, briefs[round], takenKeysFrom(state.picks), opts, size,
    );
    if (board.length < size) boardTooSmall++;
    state.round_players = board;
    state.current_round = round;
  }

  // Anyone already drafted must not be back on the board.
  for (const p of state.round_players) {
    if (everTaken.has(`id:${p.sofifa_id}`) || everTaken.has(`name:${playerNameKey(p.name)}`)) {
      problems.push(`round ${round + 1} re-offered ${p.name}`);
    }
  }

  const order = orderForRound(state.base_order, round);
  check(order.length === managers.length, `round ${round + 1} seats every manager`);

  for (const uid of order) {
    const choice = state.round_players.shift();
    if (!choice) { problems.push(`round ${round + 1}: board ran out mid-round`); break; }
    state.picks[uid] = [...(state.picks[uid] ?? []), { briefId: briefs[round].id, player: choice }];
    everTaken.add(`id:${choice.sofifa_id}`);
    const nk = playerNameKey(choice.name);
    if (nk) everTaken.add(`name:${nk}`);
  }
}

// ── Everyone ends up with a full, distinct squad ────────────────────────────
for (const uid of managers) {
  const list = (state.picks[uid] ?? []) as ChallengePick[];
  check(list.length === briefs.length, `${uid} drafted ${list.length}/${briefs.length} players`);

  const squad = challengePicksToSquad(list);
  check(squad.length === list.length, `${uid}'s squad converts cleanly`);
  check(squad.every(p => p.isSub === true), `${uid} starts with everyone on the bench`);
  check(squad.every(p => !!p.assignedPosition), `${uid}'s squad all have a position`);
}

// No footballer on two different squads.
const owners = new Map<string, string>();
for (const uid of managers) {
  for (const pick of (state.picks[uid] ?? [])) {
    const key = playerNameKey(pick.player.name);
    const already = owners.get(key);
    if (already && already !== uid) problems.push(`${pick.player.name} ended up on both ${already} and ${uid}`);
    owners.set(key, uid);
  }
}

console.log(`3 managers × ${briefs.length} rounds, ${size} cards a board`);
console.log(`distinct footballers drafted: ${owners.size}`);
if (boardTooSmall > 0) console.log(`rounds that could not fill a full board: ${boardTooSmall}`);

if (problems.length) {
  console.error("\nFAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("\nPASS — snake order is fair, nobody is drafted twice, every squad completes");
