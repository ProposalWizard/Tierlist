import { matchdayFor, formationForClub } from "../../lib/star/teamsheet";
import { formationOf } from "../../lib/star/formations";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, Fixture, SquadPlayer, LeagueSquad } from "../../lib/star/types";

/**
 * THE SIDE YOU PICKED IS THE SIDE THAT PLAYS.
 *
 * Reported: "I have changed the Bournemouth team multiple times and it's not
 * registering, it seems to just be choosing the same best 11 each time with
 * the 4-3-2-1 formation."
 *
 * It was. `build()` ran `autoPick` unconditionally and `matchdayFor` only ever
 * read the saved lineup's BENCH — the saved formation and the saved eleven
 * were loaded from localStorage, passed nowhere, and dropped. So the sheet was
 * always the highest-rated eleven in whatever shape the club's NAME hashes to,
 * no matter what you arranged.
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

/** A squad with deliberately DESCENDING ratings, so "the best eleven" is a
 *  knowable, specific set of ids and any departure from it is visible. */
function squad(): SquadPlayer[] {
  return POSITIONS.map((position, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    shortName: `P${i}`,
    position,
    overall: 90 - i,
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
  }));
}

function careerWith(sq: SquadPlayer[]): CareerState {
  const base = makeInitialCareer(
    {
      firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
      club: "AFC Bournemouth", clubBadge: null, position: "ST",
      nationality: "England", startYear: 2027,
    },
    CLUBS,
  );
  const leagueSquads: LeagueSquad[] = [{
    club: "Liverpool",
    players: sq.map(p => ({
      id: `l-${p.id}`, name: p.name, position: p.position,
      overall: p.overall ?? 70, goals: 0, assists: 0,
    })),
  }];
  return { ...base, squad: sq, leagueSquads };
}

const FIXTURE: Fixture = {
  week: 1, opponent: "Liverpool", home: true, played: false, kind: "league",
};

// ── Without a saved lineup, nothing changes ────────────────────────────────
{
  const sq = squad();
  const md = matchdayFor(careerWith(sq), FIXTURE, false);
  const ours = md.home;
  check(ours.formation.id === formationForClub("AFC Bournemouth").id,
    "with nothing saved, the club still plays the shape its name picks");
  check(ours.xi.length === 11, `and still fields eleven (${ours.xi.length})`);
}

// ── A saved shape is the shape that plays ──────────────────────────────────
{
  const sq = squad();
  const auto = formationForClub("AFC Bournemouth");
  // Deliberately a DIFFERENT shape from the auto one, whatever that is.
  const wanted = formationOf(auto.id === "442" ? "433" : "442");
  const md = matchdayFor(careerWith(sq), FIXTURE, false, undefined, undefined, {
    formation: wanted,
    xi: wanted.slots.map(() => null),
  });
  check(md.home.formation.id === wanted.id,
    `a saved formation overrides the club's default shape (${md.home.formation.id}, wanted ${wanted.id})`);
  check(md.home.xi.length === 11,
    `and an all-empty saved eleven is still auto-filled to eleven (${md.home.xi.length})`);
}

// ── A saved ELEVEN is the eleven that plays ────────────────────────────────
{
  const sq = squad();
  const shape = formationOf("433");
  const auto = matchdayFor(careerWith(sq), FIXTURE, false, undefined, undefined, {
    formation: shape, xi: shape.slots.map(() => null),
  }).home;

  // Put the WORST goalkeeper in goal and the worst striker up front —
  // precisely what autoPick would never do.
  const keepers = sq.filter(p => p.position === "GK");
  const strikers = sq.filter(p => p.position === "ST");
  const worstKeeper = keepers[keepers.length - 1];
  const worstStriker = strikers[strikers.length - 1];

  const gkSlot = shape.slots.findIndex(s => s.role === "GK");
  const stSlot = shape.slots.findIndex(s => s.role === "ST");

  const chosen: (string | null)[] = shape.slots.map(() => null);
  chosen[gkSlot] = worstKeeper.id;
  chosen[stSlot] = worstStriker.id;

  const picked = matchdayFor(careerWith(sq), FIXTURE, false, undefined, undefined, {
    formation: shape, xi: chosen,
  }).home;

  check(picked.xi[gkSlot]?.id === worstKeeper.id,
    `the keeper you picked is the keeper who plays (${picked.xi[gkSlot]?.id}, wanted ${worstKeeper.id})`);
  check(picked.xi[stSlot]?.id === worstStriker.id,
    `and so is the striker (${picked.xi[stSlot]?.id}, wanted ${worstStriker.id})`);
  check(auto.xi[gkSlot]?.id !== worstKeeper.id,
    "…and this is a real change: autoPick would not have chosen him");
  check(picked.xi.length === 11, `still eleven men (${picked.xi.length})`);
  check(new Set(picked.xi.map(p => p.id)).size === picked.xi.length,
    "and nobody is in the side twice");
}

// ── A saved slot naming somebody who has left costs one place, not the shape ──
{
  const sq = squad();
  const shape = formationOf("433");
  const chosen: (string | null)[] = shape.slots.map(() => null);
  chosen[0] = "someone-who-was-sold";
  const md = matchdayFor(careerWith(sq), FIXTURE, false, undefined, undefined, {
    formation: shape, xi: chosen,
  }).home;
  check(md.formation.id === "433", "a stale id does not throw the saved shape away");
  check(md.xi.length === 11, `and the empty slot is auto-filled (${md.xi.length})`);
  check(new Set(md.xi.map(p => p.id)).size === 11, "without duplicating anybody");
}

// ── The opposition is untouched by YOUR saved lineup ───────────────────────
{
  const sq = squad();
  const shape = formationOf("352");
  const md = matchdayFor(careerWith(sq), FIXTURE, false, undefined, undefined, {
    formation: shape, xi: shape.slots.map(() => null),
  });
  check(md.away.formation.id === formationForClub("Liverpool").id,
    "the opponent still plays their own shape, not yours");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the eleven you picked, in the shape you picked, is the one that takes the field");
