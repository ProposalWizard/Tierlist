import type { CareerState, LeagueTeam } from "./types";
import { sortLeague, simulateFixtureScore } from "./season";
import { divisionOf, type CareerDivision } from "./calendar";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS,
} from "./clubs";

/**
 * UP AND DOWN.
 *
 * Three clubs leave each division every season and three arrive, and after a
 * few seasons the two divisions should look genuinely different from the ones
 * the career started in.
 *
 * ── The thing that makes this awkward ──
 *
 * A career only ever simulates ONE division: the one you play in. There is no
 * Championship table sitting behind a Premier League career, so "who came up"
 * has no real answer to read — only your own division's bottom three is a
 * fact. Everything on the other side of the ladder is therefore drawn rather
 * than played, weighted by club strength so the draw is plausible rather than
 * uniform: a strong Championship club is likelier to come up, a weak Premier
 * League club likelier to go down.
 *
 * That is exactly the shape Draft mode already uses for the same problem
 * (lib/seasonSimulator.ts's `getSeasonTeams`) — the pattern is borrowed, the
 * code is not, because that one is tied to Draft's own club spellings and
 * data model.
 *
 * ── Where the membership lives ──
 *
 * On the career (`CareerState.divisions`), because it changes: the club lists
 * in lib/star/clubs.ts are this season's, and a save three seasons deep no
 * longer matches them. Absent means a career that started before any of this
 * existed, which is a career whose divisions ARE still those lists.
 */

export interface DivisionMembership {
  premier: string[];
  championship: string[];
  /** Below the Championship. Not a division — nobody plays a season in it. */
  pool: string[];
}

export function membershipOf(career: CareerState): DivisionMembership {
  return career.divisions ?? {
    premier: [...PREMIER_LEAGUE_CLUBS],
    championship: [...CHAMPIONSHIP_CLUBS],
    pool: [...PROMOTION_POOL_CLUBS],
  };
}

// ── Strength, for a club that may not be in your division ───────────────────

/**
 * How good a club is, for the purpose of drawing lots.
 *
 * Real squad strength when this career actually holds the squad — which is
 * only ever true of your own division. For everybody else, a stable number
 * derived from the club's name and its tier: the point is that the draw is
 * weighted and repeatable, not that it is accurate about a division nobody
 * is simulating.
 */
function baselineFor(tier: keyof DivisionMembership): number {
  return tier === "premier" ? 78 : tier === "championship" ? 70 : 63;
}

function nameNoise(club: string): number {
  let h = 2166136261;
  for (let i = 0; i < club.length; i++) {
    h ^= club.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 900) / 100; // 0.00 - 8.99
}

function strengthTable(career: CareerState, members: DivisionMembership): Map<string, number> {
  const out = new Map<string, number>();
  for (const tier of ["premier", "championship", "pool"] as const) {
    for (const club of members[tier]) out.set(club, baselineFor(tier) + nameNoise(club));
  }
  // Anything this career genuinely knows about beats the estimate.
  for (const t of career.league) out.set(t.name, t.strength);
  return out;
}

// ── Drawing lots ────────────────────────────────────────────────────────────

/**
 * Pick `count` clubs, likelier the stronger they are — or, with `invert`,
 * likelier the weaker. One draw removes its winner, so nobody is picked
 * twice.
 */
function weightedDraw(
  clubs: string[], strength: Map<string, number>, count: number,
  rng: () => number, invert = false,
): string[] {
  const remaining = [...clubs];
  const picked: string[] = [];
  const weightOf = (c: string) => {
    const s = strength.get(c) ?? 70;
    // Inverted, a weaker club weighs more — floored so even the strongest
    // club in the division is never completely safe.
    return Math.max(1, invert ? 100 - s : s);
  };
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, c) => sum + weightOf(c), 0);
    let roll = rng() * total;
    let at = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= weightOf(remaining[i]);
      if (roll <= 0) { at = i; break; }
    }
    picked.push(remaining[at]);
    remaining.splice(at, 1);
  }
  return picked;
}

// ── The play-offs ───────────────────────────────────────────────────────────

export interface PlayOffTie {
  home: string;
  away: string;
  /** Aggregate, first leg then second. */
  legs: { hs: number; as: number }[];
  winner: string;
}

export interface PlayOffResult {
  /** 3rd v 6th, then 4th v 5th. */
  semiFinals: PlayOffTie[];
  final: { home: string; away: string; hs: number; as: number; winner: string };
  promoted: string;
}

function twoLeggedWinner(
  a: string, b: string, strength: Map<string, number>, rng: () => number,
): PlayOffTie {
  // a is the higher seed, so a is at home in the SECOND leg — which is how
  // the real thing rewards finishing above your opponent.
  const first = simulateFixtureScore(strength.get(b) ?? 70, strength.get(a) ?? 70, rng);
  const second = simulateFixtureScore(strength.get(a) ?? 70, strength.get(b) ?? 70, rng);
  const aggA = first.away + second.home;
  const aggB = first.home + second.away;
  let winner: string;
  if (aggA !== aggB) winner = aggA > aggB ? a : b;
  // Level on aggregate: extra time and penalties, which nothing here models —
  // the higher seed edges it more often than not, and that is the whole of it.
  else winner = rng() < 0.58 ? a : b;
  return {
    home: b, away: a,
    legs: [{ hs: first.home, as: first.away }, { hs: second.away, as: second.home }],
    winner,
  };
}

/**
 * Third through sixth, for the last promotion place.
 *
 * 3rd v 6th and 4th v 5th over two legs, then a single final. Returns the
 * whole thing rather than only the winner, so it can be shown as results
 * rather than announced as an outcome.
 */
export function resolvePlayOffs(
  table: LeagueTeam[], strength: Map<string, number>, rng: () => number,
): PlayOffResult | null {
  const sorted = sortLeague(table);
  if (sorted.length < 6) return null;
  const [third, fourth, fifth, sixth] = [sorted[2].name, sorted[3].name, sorted[4].name, sorted[5].name];

  const semiFinals = [
    twoLeggedWinner(third, sixth, strength, rng),
    twoLeggedWinner(fourth, fifth, strength, rng),
  ];
  const [w1, w2] = semiFinals.map(t => t.winner);
  // Wembley: one match, no second leg, no home advantage to give.
  const score = simulateFixtureScore(strength.get(w1) ?? 70, strength.get(w2) ?? 70, rng);
  let winner: string;
  if (score.home !== score.away) winner = score.home > score.away ? w1 : w2;
  else winner = rng() < 0.5 ? w1 : w2;

  return {
    semiFinals,
    final: { home: w1, away: w2, hs: score.home, as: score.away, winner },
    promoted: winner,
  };
}

// ── The whole ladder, once a season ─────────────────────────────────────────

export interface LadderOutcome {
  /** The division you will be playing in NEXT season. */
  division: CareerDivision;
  /** Its clubs, next season. */
  clubs: string[];
  divisions: DivisionMembership;
  /** Set when your own club went up or down. */
  yourMove: "promoted" | "relegated" | null;
  promotedToPremier: string[];
  relegatedFromPremier: string[];
  promotedToChampionship: string[];
  relegatedFromChampionship: string[];
  /** Only when a Championship season was the one being played. */
  playOffs: PlayOffResult | null;
}

/**
 * Move everybody up and down, and work out where that leaves you.
 *
 * Read the doc at the top of this file first — the short version is that
 * your own division's three are decided by its real table (and, in the
 * Championship, by real play-offs), and the other division's three are drawn
 * weighted by strength because there is no table to read.
 */
export function resolveLadder(career: CareerState, rng: () => number): LadderOutcome {
  const members = membershipOf(career);
  const strength = strengthTable(career, members);
  const you = career.player.club;
  const division = divisionOf(career);
  const table = sortLeague(career.league);
  const names = table.map(t => t.name);

  let relegatedFromPremier: string[];
  let promotedToPremier: string[];
  let relegatedFromChampionship: string[];
  let promotedToChampionship: string[];
  let playOffs: PlayOffResult | null = null;

  if (division === "premier") {
    // Your table is the Premier League's, so its bottom three is a fact.
    relegatedFromPremier = names.slice(-3);
    // Nobody played the Championship, so who came up is a draw.
    promotedToPremier = weightedDraw(members.championship, strength, 3, rng);
    const champLeft = members.championship.filter(c => !promotedToPremier.includes(c));
    relegatedFromChampionship = weightedDraw(champLeft, strength, 3, rng, true);
    promotedToChampionship = weightedDraw(members.pool, strength, 3, rng);
  } else {
    // You played the Championship: first and second go up automatically, and
    // the play-offs decide the third.
    // A play-off your own club reached was PLAYED, not simulated — see
    // lib/star/playoffs — so its result is the truth and must not be
    // re-rolled here. Everybody else's is simulated as normal.
    const played = career.playOffState?.promoted;
    playOffs = played ? null : resolvePlayOffs(career.league, strength, rng);
    const auto = names.slice(0, 2);
    const third = played ?? playOffs?.promoted;
    promotedToPremier = third ? [...auto, third] : auto;
    // ── There is nothing below the Championship to play in ──
    //
    // The pool is a hat, not a division: it has no fixtures, no table and no
    // season, so a career relegated into it would have nowhere to play. Your
    // club therefore survives the drop and the next one up goes instead —
    // the one concession this whole file makes to the game not modelling a
    // third tier. Everybody else's bottom three is exactly the table's.
    const bottom = names.slice(-3);
    if (bottom.includes(you)) {
      const reprieved = bottom.filter(c => c !== you);
      const nextUp = names[names.length - 4];
      relegatedFromChampionship = nextUp ? [...reprieved, nextUp] : reprieved;
    } else {
      relegatedFromChampionship = bottom;
    }
    // Nobody played the Premier League, so who came down is a draw — weighted
    // the other way, since it is the weak who go.
    relegatedFromPremier = weightedDraw(members.premier, strength, 3, rng, true);
    promotedToChampionship = weightedDraw(members.pool, strength, 3, rng);
  }

  const premier = [
    ...members.premier.filter(c => !relegatedFromPremier.includes(c)),
    ...promotedToPremier,
  ];
  const championship = [
    ...members.championship.filter(
      c => !promotedToPremier.includes(c) && !relegatedFromChampionship.includes(c)),
    ...relegatedFromPremier,
    ...promotedToChampionship,
  ];
  // Relegated Championship clubs join the pool, and the three that came up
  // out of it leave — which is what puts a relegated club back in the hat for
  // next time round.
  const pool = [
    ...members.pool.filter(c => !promotedToChampionship.includes(c)),
    ...relegatedFromChampionship,
  ];

  // Your club is always in one of the two by now — the reprieve above is what
  // guarantees it — but falling back to the division you are already in is
  // cheaper than trusting that from a distance.
  const nextDivision: CareerDivision = premier.includes(you) ? "premier"
    : championship.includes(you) ? "championship"
    : division;

  const yourMove = nextDivision === division ? null
    : nextDivision === "premier" ? "promoted" : "relegated";

  return {
    division: nextDivision,
    clubs: nextDivision === "premier" ? premier : championship,
    divisions: { premier, championship, pool },
    yourMove,
    promotedToPremier, relegatedFromPremier,
    promotedToChampionship, relegatedFromChampionship,
    playOffs,
  };
}
