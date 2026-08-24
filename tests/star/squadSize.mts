import { runTransferWindow } from "../../lib/star/leagueTransfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * SQUAD SIZE GOVERNS WHO SELLS, AND WHO BUYS.
 *
 * Reported directly: eleven players start a match, nine more make the bench
 * — twenty, full stop. A club sitting at twenty or fewer is not going to
 * thin itself further over an ordinary squad-depth transfer; it sells over
 * that only when a player forces the issue (`unhappy`). The flip side of
 * the same fact: a club that has actually dropped BELOW twenty cannot even
 * fill its own bench off its current numbers, so it goes and gets bodies —
 * more urgently than its bare per-position gaps alone would suggest — and a
 * club that DOES lose someone off an exact-twenty squad becomes exactly
 * that club next window, which is the mechanism "almost always replaces
 * him" actually runs on here, not a hardcoded guarantee.
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

/** A normal, evenly-spread squad of a given size, all players a similar
 *  mid-table quality so nobody is an "elite starter" — isolates the
 *  squad-size effect from the separate elite-club-starter gate. */
function squadOfSize(seed: number, size: number): LeaguePlayer[] {
  const roles: LeaguePlayer["position"][] = [
    "GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST",
    "GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST", "CAM", "CAM", "CAM", "CAM",
  ];
  const rng = mulberry32(seed);
  return Array.from({ length: size }, (_, i) => ({
    id: `s${seed}-${i}`, name: `Player ${seed}-${i}`, position: roles[i % roles.length],
    positions: [roles[i % roles.length]], overall: 68 + Math.floor(rng() * 6), goals: 0, assists: 0,
  }));
}

function realCareer(season = 1): CareerState {
  const career = makeInitialCareer(player({ club: "Arsenal" }), CLUBS);
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

// ── A club at exactly twenty sells far less than one carrying real depth ────
{
  let soldAt20 = 0, soldAt24 = 0, windows = 0;
  for (let season = 1; season <= 200; season++) {
    const base = realCareer(season);
    const career: CareerState = {
      ...base,
      leagueSquads: base.leagueSquads!.map(sq => {
        if (sq.club === "Chelsea") return { club: "Chelsea", players: squadOfSize(season * 13 + 1, 20) };
        if (sq.club === "Liverpool") return { club: "Liverpool", players: squadOfSize(season * 13 + 2, 24) };
        return sq;
      }),
    };
    const rng = mulberry32(season * 4021 + 7);
    const { moves, loans } = runTransferWindow(career, "summer", rng);
    windows++;
    if (moves.some(m => m.from === "Chelsea" && !m.unhappy) || loans.some(l => l.parentClub === "Chelsea")) soldAt20++;
    if (moves.some(m => m.from === "Liverpool" && !m.unhappy) || loans.some(l => l.parentClub === "Liverpool")) soldAt24++;
  }
  check(soldAt24 > soldAt20 * 2,
    `a club carrying twenty-four sells or loans out far more often than an otherwise-identical club sitting at exactly twenty (${soldAt24} vs ${soldAt20} of ${windows} windows)`);
}

// ── …but an unhappy departure still slips through at exactly twenty ─────────
{
  let unhappySales = 0, windows = 0;
  for (let season = 1; season <= 400; season++) {
    const base = realCareer(season);
    const career: CareerState = {
      ...base,
      leagueSquads: base.leagueSquads!.map(sq =>
        sq.club === "Chelsea" ? { club: "Chelsea", players: squadOfSize(season * 17 + 3, 20) } : sq),
    };
    const rng = mulberry32(season * 3301 + 11);
    const { moves } = runTransferWindow(career, "summer", rng);
    windows++;
    if (moves.some(m => m.from === "Chelsea" && m.unhappy)) unhappySales++;
  }
  check(unhappySales > 0,
    `a club sitting at exactly twenty still occasionally loses a player who is genuinely unhappy, across four hundred windows (${unhappySales})`);
}

// ── A club that has actually dropped below twenty goes and gets bodies ──────
{
  let signedShort = 0, signedFull = 0, windows = 0;
  for (let season = 1; season <= 200; season++) {
    const base = realCareer(season);
    const career: CareerState = {
      ...base,
      leagueSquads: base.leagueSquads!.map(sq => {
        if (sq.club === "Everton") return { club: "Everton", players: squadOfSize(season * 19 + 5, 16) };
        if (sq.club === "Brighton & Hove Albion") return { club: "Brighton & Hove Albion", players: squadOfSize(season * 19 + 6, 20) };
        return sq;
      }),
      freeAgents: [
        { id: "fa-cb", name: "Available Centre-Back", position: "CB", positions: ["CB"], overall: 70, goals: 0, assists: 0 },
      ],
    };
    const rng = mulberry32(season * 5501 + 2);
    const { moves } = runTransferWindow(career, "summer", rng);
    windows++;
    if (moves.some(m => m.player === "Available Centre-Back" && m.to === "Everton")) signedShort++;
    if (moves.some(m => m.player === "Available Centre-Back" && m.to === "Brighton & Hove Albion")) signedFull++;
  }
  check(signedShort > signedFull,
    `a club sixteen strong signs an available centre-back more readily than an otherwise-identical club already at twenty (${signedShort} vs ${signedFull} of ${windows} windows)`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a full squad barely sells, an undermanned one goes and buys");
