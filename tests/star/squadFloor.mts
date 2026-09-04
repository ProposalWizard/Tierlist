import { runTransferWindow } from "../../lib/star/leagueTransfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * A CLUB NEVER SELLS ITSELF BELOW A FIELDABLE SQUAD.
 *
 * Reported directly, with a real match: an opponent (Everton) kicking off a
 * league game with only ten men, because the one real specialist left at a
 * position had been sold with nothing bought in to replace him. Root cause:
 * `runTransferWindow`'s sale (`pool.splice`) never had a matching signing to
 * offset it, and `sellability`'s existing "thin squad" dampener was only
 * ever LOWER odds, not zero — over a career-length run of windows a club
 * could still random-walk past any squad size, one unlucky roll at a time.
 * `MIN_SQUAD_SIZE` (leagueTransfers.ts) is the actual floor: below it, a
 * club is never sellable at all, full stop, however the dice land.
 *
 * teamsheet.mts covers the OTHER half of this fix — a save that was already
 * this thin before the floor existed still fields eleven, via a real free
 * agent as a last resort.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 22, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

const POSITIONS = [
  "GK", "GK", "CB", "CB", "CB", "LB", "RB", "CDM", "CM", "CM",
  "CAM", "LW", "RW", "ST", "ST", "CM", "CB", "LB", "RW", "ST",
];

function squadFor(club: string, size = 20): LeagueSquad {
  return {
    club,
    players: POSITIONS.slice(0, size).map((position, i) => ({
      id: `${club}-${i}`, name: `${club} Player ${i}`, position: position as LeaguePlayer["position"],
      overall: 65 + (i % 15), goals: 0, assists: 0,
    })),
  };
}

const CLUBS = [...PREMIER_LEAGUE_CLUBS];

function careerWith(squads: LeagueSquad[]): CareerState {
  const base = makeInitialCareer(player(), CLUBS);
  return { ...base, leagueSquads: squads };
}

// ── A club already at the floor is never sold from, across many windows ───
{
  const thin = squadFor("Everton", 15); // exactly MIN_SQUAD_SIZE
  const squads = CLUBS.map(c => (c === "Everton" ? thin : squadFor(c)));
  let career = careerWith(squads);

  for (let week = 1; week <= 200; week++) {
    const rng = mulberry32(week * 97 + 3);
    const window = week % 26 === 0 ? "summer" : week % 26 === 13 ? "january" : null;
    if (!window) continue;
    const result = runTransferWindow(career, window, rng);
    career = result.career;
  }

  const everton = career.leagueSquads!.find(s => s.club === "Everton")!;
  check(everton.players.length >= 15,
    `two hundred weeks of transfer windows never sold Everton below the floor (${everton.players.length})`);
}

// ── A well-stocked club can still sell down TOWARD the floor, just not ────
// ── past it — the floor is a hard stop, not a general freeze on selling. ──
{
  const squads = CLUBS.map(c => squadFor(c, 20));
  let career = careerWith(squads);

  let minEverSeen = 20;
  for (let week = 1; week <= 400; week++) {
    const rng = mulberry32(week * 131 + 7);
    const window = week % 26 === 0 ? "summer" : week % 26 === 13 ? "january" : null;
    if (!window) continue;
    const result = runTransferWindow(career, window, rng);
    career = result.career;
    for (const sq of career.leagueSquads ?? []) {
      if (sq.players.length < minEverSeen) minEverSeen = sq.players.length;
    }
  }

  check(minEverSeen >= 15, `no club, across four hundred weeks of activity, was ever sold below the floor (lowest seen: ${minEverSeen})`);
  check(minEverSeen < 20, `…but selling itself still genuinely happens — squads do shrink toward the floor (lowest seen: ${minEverSeen})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — a club can be sold down toward a thin squad, never past a fieldable one");
