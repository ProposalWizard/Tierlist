// A tiny localStorage so lineupStore.ts (and matchdayFor's read of it) can
// run headless — see tests/star/career.mts for the same pattern.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import { matchdayFor, formationForClub } from "../../lib/star/teamsheet";
import { formationOf } from "../../lib/star/formations";
import { saveLineup, clearLineup } from "../../lib/star/lineupStore";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, Fixture, SquadPlayer, LeagueSquad } from "../../lib/star/types";

/**
 * A LINEUP SAVED FOR ANOTHER CLUB IS THE ONE THAT CLUB PLAYS.
 *
 * Reported directly, with a real screenshot pair: a Chelsea eleven set by
 * hand in /lineups, and a completely different Chelsea eleven kicking off
 * against it in the actual match. `saveLineup`/`loadLineup` (lineupStore.ts)
 * were always built to work for ANY club — the file's own header explains
 * why a side picked for a club that is not yours is kept separate from the
 * career save — but `matchdayFor` only ever read it back for your own club.
 * An opponent was always auto-picked and rotated, no matter what had been
 * saved for them.
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

const POSITIONS: SquadPlayer["position"][] =
  ["GK", "GK", "CB", "CB", "CB", "LB", "RB", "CDM", "CM", "CM", "CAM", "LW", "RW", "ST", "ST", "CM", "CB", "LB", "RW", "ST"];

function opponentSquad(): LeagueSquad {
  return {
    club: "Liverpool",
    players: POSITIONS.map((position, i) => ({
      id: `l${i}`, name: `Liverpool Player ${i}`, position, overall: 90 - i, goals: 0, assists: 0,
    })),
  };
}

function careerWith(): CareerState {
  const base = makeInitialCareer(
    {
      firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
      club: "AFC Bournemouth", clubBadge: null, position: "ST",
      nationality: "England", startYear: 2027,
    },
    CLUBS,
  );
  return { ...base, leagueSquads: [opponentSquad()] };
}

const FIXTURE: Fixture = { week: 1, opponent: "Liverpool", home: true, played: false, kind: "league" };

// ── Nothing saved for the opponent: auto-picked, exactly as before ─────────
{
  clearLineup("Liverpool");
  const md = matchdayFor(careerWith(), FIXTURE, false);
  check(md.away.formation.id === formationForClub("Liverpool").id,
    "with nothing saved, the opponent still plays the shape their name picks");
  check(md.away.xi.length === 11, `and still fields eleven (${md.away.xi.length})`);
}

// ── A shape saved for the opponent is the shape THEY play ──────────────────
//
// A real saved lineup always has at least one real slot filled — the same
// `.some(Boolean)` gate the player's own saved lineup is read through (see
// app/star-dev/page.tsx) treats an all-empty `xi` as "nothing really
// saved" and falls back to auto-pick, formation included. So this saves
// one real player (the eleven's own best-rated goalkeeper) rather than an
// all-null array, which is what an actual /lineups save always looks like.
{
  const auto = formationForClub("Liverpool");
  const wanted = formationOf(auto.id === "442" ? "433" : "442");
  const gkSlot = wanted.slots.findIndex(s => s.role === "GK");
  const xi = wanted.slots.map(() => null);
  xi[gkSlot] = opponentSquad().players.find(p => p.position === "GK")!.id;
  saveLineup("Liverpool", { formation: wanted.id, xi });
  const md = matchdayFor(careerWith(), FIXTURE, false);
  check(md.away.formation.id === wanted.id,
    `a shape saved for the opponent overrides their own default (${md.away.formation.id}, wanted ${wanted.id})`);
  clearLineup("Liverpool");
}

// ── An ELEVEN saved for the opponent is the eleven THEY field ──────────────
{
  const shape = formationOf("433");
  const auto = matchdayFor(careerWith(), FIXTURE, false).away;
  const sq = opponentSquad().players;

  // The worst keeper and the worst striker — precisely what auto-picking
  // Liverpool's own best XI would never choose.
  const keepers = sq.filter(p => p.position === "GK");
  const strikers = sq.filter(p => p.position === "ST");
  const worstKeeper = keepers[keepers.length - 1];
  const worstStriker = strikers[strikers.length - 1];
  const gkSlot = shape.slots.findIndex(s => s.role === "GK");
  const stSlot = shape.slots.findIndex(s => s.role === "ST");
  const chosen: (string | null)[] = shape.slots.map(() => null);
  chosen[gkSlot] = worstKeeper.id;
  chosen[stSlot] = worstStriker.id;

  saveLineup("Liverpool", { formation: shape.id, xi: chosen });
  const md = matchdayFor(careerWith(), FIXTURE, false).away;

  check(md.xi[gkSlot]?.id === worstKeeper.id,
    `the keeper saved for the opponent is the keeper who plays for them (${md.xi[gkSlot]?.id}, wanted ${worstKeeper.id})`);
  check(md.xi[stSlot]?.id === worstStriker.id,
    `and so is the striker (${md.xi[stSlot]?.id}, wanted ${worstStriker.id})`);
  check(auto.xi[gkSlot]?.id !== worstKeeper.id,
    "…and this is a real change: auto-picking Liverpool would not have chosen him");
  check(md.xi.length === 11, `still eleven men (${md.xi.length})`);
  clearLineup("Liverpool");
}

// ── A saved opponent lineup is never rotated — only an unset one is ────────
{
  const shape = formationOf("433");
  const sq = opponentSquad().players;
  const starters = sq.slice(0, 11).map(p => p.id);
  const chosen: (string | null)[] = shape.slots.map((_, i) => starters[i]);
  saveLineup("Liverpool", { formation: shape.id, xi: chosen });

  let everRotated = false;
  for (let week = 1; week <= 60; week++) {
    const md = matchdayFor(careerWith(), { ...FIXTURE, week }, false).away;
    if (!chosen.every((id, i) => md.xi[i]?.id === id)) { everRotated = true; break; }
  }
  check(!everRotated, "a saved opponent eleven holds across many matchdays instead of being randomly rotated");
  clearLineup("Liverpool");
}

// ── YOUR saved lineup still never bleeds onto the opponent's sheet ─────────
{
  const shape = formationOf("352");
  saveLineup("AFC Bournemouth", { formation: shape.id, xi: shape.slots.map(() => null) });
  clearLineup("Liverpool");
  const md = matchdayFor(careerWith(), FIXTURE, false);
  check(md.away.formation.id === formationForClub("Liverpool").id,
    "the opponent still plays their own shape when it is YOUR club that saved one, not theirs");
  clearLineup("AFC Bournemouth");
}

// ── A cup opponent from OUTSIDE your division still fields its saved lineup ──
//
// Reported directly: a real saved lineup for Wigan Athletic — a
// PROMOTION_POOL_CLUBS club that can turn up as a domestic cup opponent —
// still showed "Unable to scout opponent's team" in a real match. Root
// cause: a club drawn from outside your own division is only ever fetched
// into `career.externalSquads`, never `leagueSquads` — and matchdayFor's
// opponent-squad lookup only ever checked the latter, so the saved lineup's
// player ids had no real roster to resolve against and the sheet came back
// empty regardless of what had actually been saved.
{
  function wiganSquad(): LeagueSquad {
    return {
      club: "Wigan Athletic",
      players: POSITIONS.map((position, i) => ({
        id: `w${i}`, name: `Wigan Player ${i}`, position, overall: 70 - i, goals: 0, assists: 0,
      })),
    };
  }

  function careerWithExternalOnly(): CareerState {
    const base = makeInitialCareer(
      {
        firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
        club: "AFC Bournemouth", clubBadge: null, position: "ST",
        nationality: "England", startYear: 2027,
      },
      CLUBS,
    );
    // Deliberately NOT in leagueSquads — externalSquads is where a
    // promotion-pool/Other club's roster actually lives.
    return { ...base, leagueSquads: [], externalSquads: [wiganSquad()] };
  }

  const cupFixture: Fixture = { week: 5, opponent: "Wigan Athletic", home: true, played: false, kind: "cup" };
  const shape = formationOf("433");
  const sq = wiganSquad().players;
  const worstKeeper = sq.filter(p => p.position === "GK").slice(-1)[0];
  const gkSlot = shape.slots.findIndex(s => s.role === "GK");
  const chosen: (string | null)[] = shape.slots.map(() => null);
  chosen[gkSlot] = worstKeeper.id;

  saveLineup("Wigan Athletic", { formation: shape.id, xi: chosen });
  const md = matchdayFor(careerWithExternalOnly(), cupFixture, false).away;

  check(md.xi.length === 11, `Wigan still fields a full eleven, not an unscouted blank (${md.xi.length})`);
  check(md.xi[gkSlot]?.id === worstKeeper.id,
    `and it is the actual saved lineup, not an auto-pick (${md.xi[gkSlot]?.id}, wanted ${worstKeeper.id})`);
  clearLineup("Wigan Athletic");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a lineup saved for any club, yours or an opponent's, is the one that club actually fields");
