import { runTransferWindow, runInternationalWindow } from "../../lib/star/leagueTransfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONS_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";
import type { Role } from "../../lib/star/formations";

/**
 * TRANSFER NEWS SHOWS A PLAYER'S REAL POSITION, NEVER THE FORMATION SLOT.
 *
 * Reported directly, with a real player as the example: someone whose real
 * listed positions were Left Back / Left Mid / Centre Back showed up in his
 * own transfer news as "Left Winger" — a position that wasn't even on his
 * list. Root cause: `buildLeagueSquad`/`buildSquadFromRoster` can greedily
 * fill an empty formation SLOT with a neighbour-fit player who doesn't
 * actually list that position (an LB/LM/CB filling an empty LW slot when
 * nobody better is left) — and that slot label was stored on
 * `LeaguePlayer.position`/`SquadPlayer.position`, the exact same field name
 * a real primary position would use. leagueTransfers.ts's `Candidate.position`
 * copied that slot label straight through into `TransferMove`/`LoanMove`,
 * which is what the Transfers tab actually displays.
 *
 * This fixture deliberately maximises the chance of catching a regression:
 * every player's SLOT (`position`) is set to "ST" — a position genuinely
 * outside every player's own real `positions` list below — so if the fix
 * ever regresses back to reading the slot, at least one generated move
 * would show "ST" for a player who has never played there.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 17, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

// Real positions per roster slot index — deliberately never "ST", so the
// SLOT ("ST", forced below) and the REAL position can never coincide by
// chance, keeping the regression check meaningful.
const REAL_POSITIONS: Role[] = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW"];

function squadFor(club: string, seed: number): LeagueSquad {
  const players: LeaguePlayer[] = Array.from({ length: 20 }, (_, i) => {
    const real = REAL_POSITIONS[i % REAL_POSITIONS.length];
    return {
      id: `${club}:${i}`,
      name: `${club} Player ${i}`,
      // The SLOT this build filled him into — deliberately always "ST",
      // regardless of what he's actually listed for. Exactly the shape a
      // real neighbour-fit mismatch produces (a real position that isn't
      // even in his own `positions` list).
      position: "ST",
      positions: [real],
      overall: 60 + ((i * 7 + seed) % 25),
      goals: 0,
      assists: 0,
    };
  });
  return { club, players };
}

function freshCareer(season: number): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  const domesticSquads = PREMIER_LEAGUE_CLUBS.map(c => squadFor(c, season));
  // career.squad (the player's own club) uses the same shape via SquadPlayer —
  // reuse the same real/slot split so the user's own team-mates are covered
  // too, matching the bug report's "some others on that list" as well.
  const ownSquad = domesticSquads.find(s => s.club === base.player.club)!;
  return {
    ...base,
    season,
    squad: ownSquad.players.map(p => ({
      id: p.id, name: p.name, shortName: p.name, position: p.position, positions: p.positions,
      overall: p.overall, seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
    })),
    leagueSquads: domesticSquads,
  };
}

const externalClubs = CHAMPIONS_LEAGUE_CLUBS.filter(c => !PREMIER_LEAGUE_CLUBS.includes(c));

// ── Domestic window: every move's reported position is real, never "ST" ────
{
  let totalMoves = 0;
  for (let season = 1; season <= 60; season++) {
    const career = freshCareer(season);
    const rng = mulberry32(season * 9781 + 3);
    const { moves, loans } = runTransferWindow(career, "summer", rng);
    totalMoves += moves.length + loans.length;
    for (const m of [...moves, ...loans]) {
      check(m.position !== "ST", `season ${season}: ${m.player}'s reported position is never the forced-mismatched slot ("ST") (got ${m.position})`);
      check(REAL_POSITIONS.includes(m.position), `season ${season}: ${m.player}'s reported position (${m.position}) is one of the fixture's real positions`);
    }
  }
  check(totalMoves > 0, "the sample actually produced real moves to check, not an empty run");
}

// ── International window: same guarantee for cross-border moves ───────────
{
  let totalMoves = 0;
  for (let season = 1; season <= 60; season++) {
    const base = freshCareer(season);
    const career: CareerState = {
      ...base,
      externalSquads: externalClubs.map(c => squadFor(c, season + 500)),
    };
    const rng = mulberry32(season * 6221 + 11);
    const { moves } = runInternationalWindow(career, "summer", rng);
    totalMoves += moves.length;
    for (const m of moves) {
      check(m.position !== "ST", `season ${season}: ${m.player}'s reported international-move position is never the forced-mismatched slot ("ST") (got ${m.position})`);
      check(REAL_POSITIONS.includes(m.position), `season ${season}: ${m.player}'s reported international-move position (${m.position}) is one of the fixture's real positions`);
    }
  }
  check(totalMoves > 0, "the international sample actually produced real moves to check, not an empty run");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 25)) console.log(`  ✗ ${p}`);
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
  process.exit(1);
}
console.log("PASS — transfer news always shows a player's real position, never the formation slot he happened to fill");
