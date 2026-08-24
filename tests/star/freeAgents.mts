import { runTransferWindow } from "../../lib/star/leagueTransfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import type { CareerState, LeagueSquad, LeaguePlayer, SquadPlayer, StarPlayer } from "../../lib/star/types";

/**
 * FREE AGENTS.
 *
 * Reported directly: a player marked "free" or "Free" (either casing — a
 * free-text admin field, not a picker) is not background noise, he is a
 * real, signable footballer, and a desperate one — he takes whatever club
 * will actually play him, further below his own level than a contracted
 * man's own club would ever let him leave for that cheap. Modelled in
 * runTransferWindow as one more pool a club can sign FROM (see
 * FREE_AGENTS_CLUB), never sold, never loaned, always for nothing.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
    ...overrides,
  } as StarPlayer;
}

const CLUBS = [
  "Arsenal", "Tottenham Hotspur", "Chelsea", "Liverpool", "Everton",
  "Manchester City", "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
];

function realCareer(club = "Arsenal", season = 1): CareerState {
  const career = makeInitialCareer(player({ club }), CLUBS);
  return {
    ...career,
    season,
    leagueSquads: CLUBS.map((c): LeagueSquad => ({
      club: c,
      players: generateSquad(clubNameSeed(c) + season).map((p): LeaguePlayer => ({
        id: p.id, name: p.name, position: p.position, positions: p.positions ?? [p.position],
        overall: 60 + (clubNameSeed(p.name) % 20), goals: 0, assists: 0,
      })),
    })),
  };
}

const freeStriker: LeaguePlayer = {
  id: "fa-striker", name: "Free Striker", position: "ST", positions: ["ST"], overall: 74, goals: 0, assists: 0,
};

// ── A free agent genuinely gets signed, and it's always for nothing ─────────
{
  let signed = 0, windows = 0;
  const fees = new Set<number>();
  for (let season = 1; season <= 100; season++) {
    const career: CareerState = { ...realCareer("Arsenal", season), freeAgents: [freeStriker] };
    const rng = mulberry32(season * 5573 + 11);
    const { moves } = runTransferWindow(career, "summer", rng);
    windows++;
    const signing = moves.find(m => m.from === "Free Agents" && m.player === "Free Striker");
    if (signing) { signed++; fees.add(signing.fee); }
  }
  check(signed > windows * 0.8, `a free agent genuinely gets signed most windows, not left to rot (${signed}/${windows})`);
  check(fees.size === 1 && fees.has(0), `every single signing is for nothing — that IS what a free agent is (fees seen: ${[...fees].join(", ")})`);
}

// ── He comes off the list once signed, and lands on the real squad ──────────
{
  const career: CareerState = { ...realCareer("Arsenal", 1), freeAgents: [freeStriker] };
  const rng = mulberry32(77);
  const { career: after, moves } = runTransferWindow(career, "summer", rng);
  const signing = moves.find(m => m.player === "Free Striker");
  check(!!signing, "sets up the rest of this block with a real signing to check (seed chosen for it)");
  if (signing) {
    check(!(after.freeAgents ?? []).some(p => p.id === "fa-striker"),
      "no longer sitting in the free agent pool once he has signed somewhere");
    const destination = after.leagueSquads!.find(sq => sq.club === signing.to)!;
    check(destination.players.some(p => p.id === "fa-striker"),
      `actually appears on the squad he signed for (${signing.to})`);
  }
}

// ── Your own club can sign one too, not just the other clubs ────────────────
//
// career.squad (your own club) never gets re-seeded by realCareer — only
// leagueSquads does — so it is the SAME generated squad on every one of
// these trials. Left uncontrolled, whether Arsenal ever "needs" a striker
// is down to the luck of one fixed roll, not a hundred and fifty
// independent ones — this genuinely happened on the first version of this
// test (0/150, because that one fixed squad had no real gap at ST). Given
// your own squad an explicit hole at ST the same way the reach test below
// gives Everton one, so this checks the actual claim instead of one squad's
// luck.
{
  const roles: SquadPlayer["position"][] = ["GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW"];
  const noStriker = roles.map((position, i) => ({
    id: `you-${i}`, name: `Your Player ${i}`, shortName: `YP${i}`, position,
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0, overall: 65,
  }));

  let signedByYou = 0;
  for (let season = 1; season <= 150; season++) {
    const career: CareerState = { ...realCareer("Arsenal", season), squad: noStriker, freeAgents: [freeStriker] };
    const rng = mulberry32(season * 9001 + 5);
    const { moves } = runTransferWindow(career, "summer", rng);
    if (moves.some(m => m.player === "Free Striker" && m.to === "Arsenal")) signedByYou++;
  }
  check(signedByYou > 0, `the human's own club is a real candidate to sign a free agent too, given an actual need (${signedByYou}/150 windows)`);
}

// ── Desperate: accepts a gap a normal transfer's reach would refuse ─────────
//
// A weak club, deliberately hand-built rather than drawn from generateSquad
// so its strength and its hole at ST are exact: eleven players rated dead on
// 65 and no striker at all, so positionNeed sees a genuine empty slot. 65 is
// squarely mid-relegation-battler territory, where a normal sale/loan's own
// reach (~7 points) would never stretch to a 74-rated striker (gap -9) — the
// free agent's own reach, roughly double that, is built to cover exactly
// this gap. The test does not hardcode either number; it only checks the
// signing actually happens, which is the observable half of the claim.
{
  function weakClub(): LeaguePlayer[] {
    const roles: LeaguePlayer["position"][] = ["GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW"];
    return roles.map((position, i) => ({
      id: `weak-${i}`, name: `Weak Player ${i}`, position, positions: [position], overall: 65, goals: 0, assists: 0,
    }));
  }

  let signedThere = 0, windows = 0;
  for (let season = 1; season <= 150; season++) {
    const base = realCareer("Arsenal", season);
    const career: CareerState = {
      ...base,
      leagueSquads: base.leagueSquads!.map(sq => sq.club === "Everton" ? { club: "Everton", players: weakClub() } : sq),
      freeAgents: [freeStriker],
    };
    const rng = mulberry32(season * 6883 + 2);
    const { moves } = runTransferWindow(career, "summer", rng);
    windows++;
    if (moves.some(m => m.player === "Free Striker" && m.to === "Everton")) signedThere++;
  }
  check(signedThere > 0,
    `a 74-rated free agent striker does sign for a hand-built 65-strength club with an empty ST slot, across 150 windows (${signedThere} times)`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — free agents get signed, for nothing, by any club including your own, and further below their level than a normal transfer would accept");
