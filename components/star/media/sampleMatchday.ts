import { matchdayFor } from "@/lib/star/teamsheet";
import { buildLeagueSquad, type RosterRow } from "@/lib/star/leagueSquads";
import type { CareerState, Fixture } from "@/lib/star/types";

/**
 * A matchday for the bench, built the way a real one is.
 *
 * Deliberately NOT a hand-written pair of elevens: the whole risk in this screen
 * is that the two sides come out of `autoPick` looking wrong — four centre-halves,
 * a striker at left-back, a shape that is not a shape — and a hard-coded sample
 * would be the one arrangement that never shows you that.
 *
 * So it runs the same function the game runs, over invented squads of the same
 * shape the database produces.
 */

const CLUBS = [
  "Liverpool", "Arsenal", "Manchester City", "Chelsea", "Tottenham Hotspur",
  "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
  "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "AFC Bournemouth", "Leeds United",
  "Burnley", "Sunderland",
];

const FIRST = ["James", "Marcus", "Leo", "Tomas", "Andre", "Kai", "Nico", "Ruben", "Ollie", "Sam", "Theo", "Dan"];
/**
 * Enough surnames that two clubs in the same match do not share any.
 *
 * A squad of twenty-four drawn from a list of twenty-four means every club uses
 * every name, so Castillo turned out in both sides at once — which reads as the
 * renderer drawing the wrong squad rather than as sample data being sample data.
 * Each club takes its own window of the list instead.
 */
const LAST = ["Whitmore", "Okafor", "Beckett", "Halvorsen", "Duarte", "Lindqvist", "Ferrera", "Novak",
  "Ashworth", "Ibrahim", "Renard", "Castillo", "Pemberton", "Vasquez", "Andersen", "Kovac",
  "Delgado", "Stanton", "Moreau", "Brennan", "Sanchez", "Ellington", "Rahman", "Torvald",
  "Aldridge", "Bianchi", "Corveau", "Dunmore", "Eriksen", "Fairweather", "Grimaldi", "Hollis",
  "Iversen", "Jansen", "Kalu", "Lachlan", "Marchetti", "Nyland", "Ostrowski", "Petit",
  "Quintero", "Rosales", "Sorenson", "Thackery", "Ulloa", "Vandal", "Wexley", "Ziegler"];
const NATIONS = ["England", "France", "Brazil", "Spain", "Portugal", "Netherlands", "Argentina", "Germany"];

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function roster(club: string): RosterRow[] {
  let a = seedOf(club);
  const rng = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const POS = ["GK", "GK", "CB", "CB", "CB,LB", "RB", "LB", "CDM", "CDM", "CM", "CM", "CM,CAM",
    "CAM", "LW", "LW", "RW", "RW", "ST", "ST", "CB", "RB", "CM", "ST", "LB"];
  // A whole BUCKET of the list per club rather than a sliding window: windows
  // four apart still share twenty names, which is how Corveau ended up in one
  // side's midfield and the other side's bench.
  const buckets = Math.floor(LAST.length / POS.length);
  const start = (seedOf(club) % buckets) * POS.length;
  const surnames = LAST.slice(start, start + POS.length);
  return POS.map((positions, i) => ({
    id: `${club}-${i}`,
    name: `${FIRST[Math.floor(rng() * FIRST.length)]} ${surnames[i % surnames.length]}`,
    positions,
    overall: 62 + Math.floor(rng() * 28),
    nation: NATIONS[Math.floor(rng() * NATIONS.length)],
  }));
}

// Exported alongside the pre-built matchday so the bench can exercise the
// "play as" picker too, which needs to call matchdayFor again itself.
export const SAMPLE_CAREER = {
  player: {
    firstName: "Mikey", lastName: "Vass", age: 19, position: "ST",
    club: "Liverpool", nationality: "England", startYear: 2027,
    skinTone: "light", clubBadge: null,
  },
  starRating: 4,
  squad: buildLeagueSquad("Liverpool", roster("Liverpool")).players.map(p => ({
    id: p.id, name: p.name, shortName: p.name.split(" ").pop() ?? p.name,
    position: p.position, seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
    overall: p.overall, nationality: p.nation,
  })),
  leagueSquads: CLUBS.map(c => buildLeagueSquad(c, roster(c))),
} as unknown as CareerState;

export const SAMPLE_FIXTURE: Fixture = { week: 3, opponent: "Manchester United", home: true, played: false };

export const SAMPLE_MATCHDAY = matchdayFor(SAMPLE_CAREER, SAMPLE_FIXTURE, true);
