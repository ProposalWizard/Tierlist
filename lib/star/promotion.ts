import type { CareerState, LeagueTeam } from "./types";
import { sortLeague, simulateFixtureScore } from "./season";
import { divisionOf, divisionRank, type CareerDivision } from "./calendar";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS,
  LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS,
  NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS, STEP3_NORTH_CLUBS, STEP3_SOUTH_CLUBS,
} from "./clubs";
import { splitByRegion, latitudeOf } from "./nonLeagueRegions";

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
  /**
   * Three tiers below the Championship, extended (given directly) 17
   * September 2026. None of the three is ever a division a career actually
   * PLAYS a season in — see clubs.ts's own note on LEAGUE_ONE_CLUBS for why
   * that stayed a deliberate scope decision rather than something this pass
   * built — but all three are real, richly detailed hats: real clubs, real
   * kits, real generated squads, and a real weighted promotion/relegation
   * flow every season, below.
   *
   * Replaces the OLD five-club "pool" that used to sit directly below the
   * Championship (PROMOTION_POOL_CLUBS in clubs.ts) — that constant still
   * exists (cups.ts's belowField still reads it, and it's still shown in
   * the Lineups picker's "Other" tab) but is no longer part of the ladder's
   * promotion/relegation arithmetic at all; five of its members are now
   * ALSO League One's five "already exists in the game" clubs.
   */
  leagueOne: string[];
  leagueTwo: string[];
  nationalLeague: string[];
  /**
   * The two regional divisions under the National League — playable, 24
   * clubs each (Harry, 1 Oct 2026, P62). They replace the old four-club
   * "National League pool", which had no fixtures. Two go up from each every
   * season (champion + play-off winner); the National League's four
   * relegated clubs are split between them by where they are (see
   * nonLeagueRegions.ts). Nothing below them, so nobody goes down out of
   * them.
   */
  nationalLeagueNorth: string[];
  nationalLeagueSouth: string[];
  /**
   * Step 3: four clubs waiting below each region (Mikey, 2 Oct 2026). Not
   * divisions: each season all four go up, and their region's bottom four
   * (21st-24th) come down to wait in their place.
   */
  step3North: string[];
  step3South: string[];
}

/**
 * 2026/27's real North/South line-up (Mikey, 2 Oct 2026) replaced nine
 * clubs the first build had. A save from before that (no Step 3 lists yet)
 * swaps them for the joiners at its next rollover — never your own club,
 * which carries on wherever it is.
 */
const RETIRED_REGIONAL = new Set([
  "Alfreton Town", "Curzon Ashton", "Leamington", "Peterborough Sports",
  "Bath City", "Chippenham Town", "Eastbourne Borough", "Enfield Town", "St Albans City",
]);
const JOINERS = {
  north: ["Harborough Town", "Hebburn Town", "Oxford City", "Spalding United"],
  south: ["Billericay Town", "Dover Athletic", "Farnham Town", "Folkestone Invicta", "Walton & Hersham"],
};

function catchUpRegional(m: DivisionMembership, you: string): DivisionMembership {
  const everywhere = new Set(Object.values(m).flat());
  const swap = (list: string[], joiners: string[]) => {
    const spare = joiners.filter(j => !everywhere.has(j));
    return list.map(c => {
      if (!RETIRED_REGIONAL.has(c) || c === you || spare.length === 0) return c;
      const j = spare.shift()!;
      everywhere.add(j);
      return j;
    });
  };
  const next = {
    ...m,
    nationalLeagueNorth: swap(m.nationalLeagueNorth, JOINERS.north),
    nationalLeagueSouth: swap(m.nationalLeagueSouth, JOINERS.south),
  };
  // Step 3 starts as given, minus anybody already somewhere on the ladder.
  const placed = new Set([
    ...next.premier, ...next.championship, ...next.leagueOne, ...next.leagueTwo,
    ...next.nationalLeague, ...next.nationalLeagueNorth, ...next.nationalLeagueSouth,
  ]);
  return {
    ...next,
    step3North: STEP3_NORTH_CLUBS.filter(c => !placed.has(c)),
    step3South: STEP3_SOUTH_CLUBS.filter(c => !placed.has(c)),
  };
}

export function membershipOf(career: CareerState): DivisionMembership {
  const d = career.divisions;
  // Per-field fallback, not "the whole object or nothing" — an OLD save's
  // `career.divisions` genuinely only ever had {premier, championship,
  // pool}; reading it as a whole would either crash on the missing new
  // fields or (with `??` at the object level) discard that save's real,
  // already-drifted premier/championship membership just because it predates
  // these three new tiers. A save like that starts these three tiers fresh
  // from the season-1 lists, exactly the same "absent means not caught up
  // yet" convention every other schema addition in this game already uses.
  const m: DivisionMembership = {
    premier: d?.premier ?? [...PREMIER_LEAGUE_CLUBS],
    championship: d?.championship ?? [...CHAMPIONSHIP_CLUBS],
    leagueOne: d?.leagueOne ?? [...LEAGUE_ONE_CLUBS],
    leagueTwo: d?.leagueTwo ?? [...LEAGUE_TWO_CLUBS],
    nationalLeague: d?.nationalLeague ?? [...NATIONAL_LEAGUE_CLUBS],
    nationalLeagueNorth: d?.nationalLeagueNorth ?? [...NATIONAL_LEAGUE_NORTH_CLUBS],
    nationalLeagueSouth: d?.nationalLeagueSouth ?? [...NATIONAL_LEAGUE_SOUTH_CLUBS],
    step3North: d?.step3North ?? [],
    step3South: d?.step3South ?? [],
  };
  // No Step 3 yet: a save from before 2 Oct 2026 (or a fresh career, whose
  // lists are already the new ones and come through unchanged).
  return d?.step3North === undefined ? catchUpRegional(m, career.player.club) : m;
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
  return tier === "premier" ? 78
    : tier === "championship" ? 70
    : tier === "leagueOne" ? 63
    : tier === "leagueTwo" ? 58
    : tier === "nationalLeague" ? 55
    : tier === "step3North" || tier === "step3South" ? 45
    : 50; // nationalLeagueNorth / nationalLeagueSouth — one rung, side by side
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
  for (const tier of ["premier", "championship", "leagueOne", "leagueTwo", "nationalLeague", "nationalLeagueNorth", "nationalLeagueSouth", "step3North", "step3South"] as const) {
    for (const club of members[tier]) out.set(club, baselineFor(tier) + nameNoise(club));
  }
  // Anything this career genuinely knows about beats the estimate.
  for (const t of career.league) out.set(t.name, t.strength);
  return out;
}

/**
 * The same estimate `strengthTable` builds for the whole ladder at once, for
 * a single club — used by lib/star/relegationOffers.ts to price an offer
 * from a club this career has never actually simulated (a Premier League
 * side, while you have spent the season in the Championship).
 */
export function estimateClubStrength(career: CareerState, club: string): number {
  const real = career.league.find(t => t.name === club)?.strength;
  if (real !== undefined) return real;
  const members = membershipOf(career);
  const tier: keyof DivisionMembership =
    members.premier.includes(club) ? "premier"
    : members.championship.includes(club) ? "championship"
    : members.leagueOne.includes(club) ? "leagueOne"
    : members.leagueTwo.includes(club) ? "leagueTwo"
    : members.nationalLeague.includes(club) ? "nationalLeague"
    : members.nationalLeagueNorth.includes(club) ? "nationalLeagueNorth"
    : members.nationalLeagueSouth.includes(club) ? "nationalLeagueSouth"
    : members.step3North.includes(club) ? "step3North"
    : "step3South";
  return baselineFor(tier) + nameNoise(club);
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
  /** North/South only: 4th v 7th, then 5th v 6th, one match each. */
  qualifiers?: PlayOffTie[];
  /** 3rd v 6th, then 4th v 5th (North/South: 2nd and 3rd v the qualifiers' winners, one match). */
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
  /** How many went up automatically; the play-offs are the next four
   *  (League Two: 3, so 4th-7th). */
  auto = 2,
): PlayOffResult | null {
  const sorted = sortLeague(table);
  if (sorted.length < auto + 4) return null;
  const [third, fourth, fifth, sixth] = [sorted[auto].name, sorted[auto + 1].name, sorted[auto + 2].name, sorted[auto + 3].name];

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

/**
 * One match, the higher seed at home (a regional play-off). Level after 90
 * minutes: extra time, then penalties. Extra time is a 35% chance of a goal,
 * weighted to the stronger side; penalties are a coin flip.
 */
export function singleMatchTie(
  high: string, low: string, strength: Map<string, number>, rng: () => number,
): PlayOffTie {
  const sh = strength.get(high) ?? 50, sl = strength.get(low) ?? 50;
  const score = simulateFixtureScore(sh, sl, rng);
  let hs = score.home, as = score.away;
  let winner: string;
  if (hs !== as) winner = hs > as ? high : low;
  else if (rng() < 0.35) {
    winner = rng() < sh / (sh + sl) ? high : low;
    if (winner === high) hs++; else as++;
  } else winner = rng() < 0.5 ? high : low;
  return { home: high, away: low, legs: [{ hs, as }], winner };
}

/**
 * NATIONAL LEAGUE NORTH / SOUTH PLAY-OFFS (2026/27 rules, given by Mikey,
 * 2 Oct 2026). 2nd-7th, one place:
 *   Qualifying round: 4th v 7th, 5th v 6th (4th and 5th at home).
 *   Semi-finals: 2nd v winner of 5th/6th, 3rd v winner of 4th/7th (2nd and
 *   3rd at home).
 *   Final: one match, at the higher-finishing finalist's ground.
 * Every tie is one match, extra time and penalties if level.
 */
export function resolveRegionalPlayOffs(
  table: LeagueTeam[], strength: Map<string, number>, rng: () => number,
): PlayOffResult | null {
  const sorted = sortLeague(table).map(t => t.name);
  if (sorted.length < 7) return null;
  const [, second, third, fourth, fifth, sixth, seventh] = sorted;
  const q1 = singleMatchTie(fourth, seventh, strength, rng);
  const q2 = singleMatchTie(fifth, sixth, strength, rng);
  const s1 = singleMatchTie(second, q2.winner, strength, rng);
  const s2 = singleMatchTie(third, q1.winner, strength, rng);
  const higher = sorted.indexOf(s1.winner) < sorted.indexOf(s2.winner) ? s1.winner : s2.winner;
  const lower = higher === s1.winner ? s2.winner : s1.winner;
  const f = singleMatchTie(higher, lower, strength, rng);
  return {
    qualifiers: [q1, q2],
    semiFinals: [s1, s2],
    final: { home: f.home, away: f.away, hs: f.legs[0].hs, as: f.legs[0].as, winner: f.winner },
    promoted: f.winner,
  };
}

// ── Self-healing: a division is always exactly the right size ──────────────

const PREMIER_SIZE = PREMIER_LEAGUE_CLUBS.length;
const CHAMPIONSHIP_SIZE = CHAMPIONSHIP_CLUBS.length;
const LEAGUE_ONE_SIZE = LEAGUE_ONE_CLUBS.length;
const LEAGUE_TWO_SIZE = LEAGUE_TWO_CLUBS.length;
const NATIONAL_LEAGUE_SIZE = NATIONAL_LEAGUE_CLUBS.length;
const NORTH_SIZE = NATIONAL_LEAGUE_NORTH_CLUBS.length;
const SOUTH_SIZE = NATIONAL_LEAGUE_SOUTH_CLUBS.length;
const STEP3_SIZE = STEP3_NORTH_CLUBS.length;

// How many move at each of the three new boundaries, given directly:
//   League One <-> Championship: 3 up (top 2 automatic + 1 playoff-modeled
//     slot), 3 down — unchanged from the Championship's own existing "three
//     up, three down" shape, just against League One instead of the old pool.
//   League One <-> League Two: 4 each way (top 3 automatic + 1 modeled up;
//     21st-24th down).
//   League Two <-> National League: 2 each way (1 automatic + 1 modeled up;
//     23rd-24th down).
//   National League <-> North and South (1 Oct 2026, P62): 4 down, split
//     two and two by region (nonLeagueRegions.ts); 2 up from EACH region —
//     the champion and the play-off winner, as in real life.
// None of these tiers is ever a division a career actually plays a season
// in (see clubs.ts's own note), so — same as the existing Championship<->pool
// shape already did — every count here is a genuine table position ONLY for
// whichever real division the career is playing; every other boundary is a
// pure weighted draw, same fidelity as the ladder already had.
const CHAMP_LEAGUE_ONE_COUNT = 3;
const LEAGUE_ONE_TWO_COUNT = 4;
const LEAGUE_TWO_NATIONAL_COUNT = 2;
/** Up from each regional division: the champion and the play-off winner. */
const REGIONAL_UP_COUNT = 2;
/** Down from the National League, into the two regions together. */
const NATIONAL_DOWN_COUNT = REGIONAL_UP_COUNT * 2;
/** Down from each region into its Step 3 (21st-24th), and up from each Step 3. */
const REGIONAL_DOWN_COUNT = 4;

/**
 * Fix a ladder that has drifted from the shape it's supposed to have —
 * see `resolveLadder`'s own note on why this exists at all. Two distinct
 * problems, handled in order:
 *
 * 1. The SAME club name sitting in more than one tier at once. Kept in
 *    whichever tier is checked first (premier, then championship, then
 *    pool) — an arbitrary but deterministic tie-break, and the direction
 *    that matches the likeliest real cause: a promotion that updated the
 *    destination tier correctly but failed to strip the name out of the
 *    tier it left.
 * 2. A tier that is the wrong SIZE once de-duplicated. Too many: the
 *    weakest excess members are pushed down a tier, same direction (and
 *    same weighted logic) an ordinary relegation already uses. Too few:
 *    the strongest available members are pulled up from the tier below,
 *    same as an ordinary promotion. The pool has no tier below it to draw
 *    from, so a pool shortfall is left as a last-resort no-op rather than
 *    inventing a club that was never part of this world at all.
 *
 * A fourth, optional input: `limbo` — clubs forced out of the ladder by a
 * governing-body's forced-movement rule (Phase 6 of
 * STAR_POWER_POLITICS.md, §4.4 #10 — see forcedMovement.ts), waiting to
 * re-enter League One (the tier directly below the Championship — this used
 * to be the old five-club pool; forcedMovement.ts always displaces into
 * "whatever's directly below the Championship", so it moved with the rest
 * of that mechanism when League One took over that spot). Folded straight
 * into League One's candidates before dedup/resize, so an oversized League
 * One (a real limbo return, or any other drift) sheds its own weakest back
 * OUT into limbo rather than growing past its own fixed size — the exact
 * same shrink logic every other tier already uses, just with nowhere lower
 * to shrink INTO at that one spot.
 *
 * Extended 17 September 2026 to cascade three tiers further down — League
 * One, League Two, the National League, and its own four-club pool — using
 * the exact same dedupe/shrink/grow shape the premier/championship/pool
 * chain already had, just run twice more.
 */
function reconcileLadder(
  premier: string[], championship: string[], leagueOne: string[], leagueTwo: string[],
  nationalLeague: string[], north: string[], south: string[], limbo: string[],
  strength: Map<string, number>, rng: () => number,
  step3North: string[] = [], step3South: string[] = [],
): {
  premier: string[]; championship: string[]; leagueOne: string[]; leagueTwo: string[];
  nationalLeague: string[]; nationalLeagueNorth: string[]; nationalLeagueSouth: string[];
  step3North: string[]; step3South: string[]; limbo: string[];
} {
  const seen = new Set<string>();
  const dedupe = (list: string[]) => list.filter(c => (seen.has(c) ? false : (seen.add(c), true)));
  let p = dedupe(premier), c = dedupe(championship);
  let l1 = dedupe([...leagueOne, ...limbo]);
  let l2 = dedupe(leagueTwo), nl = dedupe(nationalLeague);
  let nn = dedupe(north), ns = dedupe(south);
  let s3n = dedupe(step3North), s3s = dedupe(step3South);

  const byStrengthAsc = (list: string[]) => [...list].sort((a, b) => (strength.get(a) ?? 70) - (strength.get(b) ?? 70));

  const shrink = (list: string[], target: number, demoteTo: string[]): [string[], string[]] => {
    if (list.length <= target) return [list, demoteTo];
    const weakestFirst = byStrengthAsc(list);
    const demoted = weakestFirst.slice(0, list.length - target);
    const kept = list.filter(x => !demoted.includes(x));
    return [kept, [...demoteTo, ...demoted]];
  };
  const grow = (list: string[], target: number, sourcePool: string[]): [string[], string[]] => {
    if (list.length >= target || sourcePool.length === 0) return [list, sourcePool];
    const promoted = weightedDraw(sourcePool, strength, Math.min(target - list.length, sourcePool.length), rng);
    const remaining = sourcePool.filter(x => !promoted.includes(x));
    return [[...list, ...promoted], remaining];
  };

  // Oversized tiers spill downward first, top to bottom, before anything is
  // topped back up — so a genuinely-too-big tier doesn't get read as "the
  // tier below needs bodies" a step too early.
  [p, c] = shrink(p, PREMIER_SIZE, c);
  [c, l1] = shrink(c, CHAMPIONSHIP_SIZE, l1);
  [l1, l2] = shrink(l1, LEAGUE_ONE_SIZE, l2);
  [l2, nl] = shrink(l2, LEAGUE_TWO_SIZE, nl);
  // The National League's overflow lands in the regions as one group; the
  // sideways balance below sorts out which region.
  let regional: string[] = [...nn, ...ns];
  [nl, regional] = shrink(nl, NATIONAL_LEAGUE_SIZE, regional);
  const spilled = regional.filter(x => !nn.includes(x) && !ns.includes(x));
  const spill = splitByRegion(spilled, Math.max(0, NORTH_SIZE - nn.length));
  nn = [...nn, ...spill.north];
  ns = [...ns, ...spill.south];

  // Then undersized tiers pull upward from whatever the tier below now has
  // spare, same direction an ordinary promotion already moves in, bottom to
  // top so a shortfall doesn't get "fixed" from a tier that hasn't itself
  // been topped up yet. The National League draws from both regions at once.
  [nl, regional] = grow(nl, NATIONAL_LEAGUE_SIZE, [...nn, ...ns]);
  nn = nn.filter(x => regional.includes(x));
  ns = ns.filter(x => regional.includes(x));
  [l2, nl] = grow(l2, LEAGUE_TWO_SIZE, nl);
  [l1, l2] = grow(l1, LEAGUE_ONE_SIZE, l2);
  [c, l1] = grow(c, CHAMPIONSHIP_SIZE, l1);
  [p, c] = grow(p, PREMIER_SIZE, c);

  // North and South: a sideways move evens them up, as the real FA does —
  // the southernmost club of an oversized North goes South, the
  // northernmost of an oversized South goes North.
  while (nn.length > NORTH_SIZE && ns.length < SOUTH_SIZE) {
    const mover = [...nn].sort((a, b) => latitudeOf(a) - latitudeOf(b))[0];
    nn = nn.filter(x => x !== mover); ns = [...ns, mover];
  }
  while (ns.length > SOUTH_SIZE && nn.length < NORTH_SIZE) {
    const mover = [...ns].sort((a, b) => latitudeOf(b) - latitudeOf(a))[0];
    ns = ns.filter(x => x !== mover); nn = [...nn, mover];
  }
  // Each region tops up from, or spills into, its own Step 3. Step 3 holds
  // exactly four; anything beyond that is a broken save and waits in limbo
  // (which re-enters at League One, see forcedMovement.ts).
  [nn, s3n] = shrink(nn, NORTH_SIZE, s3n);
  [ns, s3s] = shrink(ns, SOUTH_SIZE, s3s);
  [nn, s3n] = grow(nn, NORTH_SIZE, s3n);
  [ns, s3s] = grow(ns, SOUTH_SIZE, s3s);
  const [step3NorthFinal, northOut] = shrink(s3n, STEP3_SIZE, []);
  const [step3SouthFinal, southOut] = shrink(s3s, STEP3_SIZE, []);

  return {
    premier: p, championship: c, leagueOne: l1, leagueTwo: l2, nationalLeague: nl,
    nationalLeagueNorth: nn, nationalLeagueSouth: ns,
    step3North: step3NorthFinal, step3South: step3SouthFinal, limbo: [...northOut, ...southOut],
  };
}

// ── The whole ladder, once a season ─────────────────────────────────────────

export interface LadderOutcome {
  /** The division you will be playing in NEXT season. */
  division: CareerDivision;
  /** Its clubs, next season. */
  clubs: string[];
  divisions: DivisionMembership;
  /** Set when your own club went up or down — any adjacent-tier crossover,
   *  not just Premier League <-> Championship. */
  yourMove: "promoted" | "relegated" | null;
  promotedToPremier: string[];
  relegatedFromPremier: string[];
  promotedToChampionship: string[];
  relegatedFromChampionship: string[];
  /** The three tiers below the Championship — added 18 September 2026
   *  alongside the rest of the League One/Two/National League generalization.
   *  `relegatedFromNationalLeague` moves into its own four-club pool, not a
   *  playable division. */
  promotedToLeagueOne: string[];
  relegatedFromLeagueOne: string[];
  promotedToLeagueTwo: string[];
  relegatedFromLeagueTwo: string[];
  /** Both regions' promoted clubs together (two from North, two from South). */
  promotedToNationalLeague: string[];
  relegatedFromNationalLeague: string[];
  /** The National League's relegated clubs, by which region they went to. */
  relegatedToNorth: string[];
  relegatedToSouth: string[];
  promotedFromNorth: string[];
  promotedFromSouth: string[];
  /** North/South's bottom four, down to Step 3; and Step 3's four, up. */
  relegatedFromNorth: string[];
  relegatedFromSouth: string[];
  promotedFromStep3North: string[];
  promotedFromStep3South: string[];
  /** Only when the season being played ends in real play-offs — every
   *  division except the Premier League (see playoffs.ts). */
  playOffs: PlayOffResult | null;
  /** Clubs still in limbo after this season's reconciliation — a forced
   *  movement that happened DURING this same rollover before the ladder
   *  resolved lands here too, not just returns from a previous one. Persist
   *  onto `career.limboClubs`. See forcedMovement.ts. */
  limbo: string[];
}

/**
 * Move everybody up and down, and work out where that leaves you.
 *
 * Read the doc at the top of this file first — the short version is that
 * your own division's three are decided by its real table (and, in the
 * Championship, by real play-offs), and the other division's three are drawn
 * weighted by strength because there is no table to read.
 */
/**
 * Which tier key (DivisionMembership's own field names) a CareerDivision
 * corresponds to — the ladder itself always deals in the five real English
 * tiers below, "premier" through "nationalLeague", in this loop; North and
 * South sit side by side under the National League and are handled on their
 * own below the loop.
 */
const TIER_KEYS = ["premier", "championship", "leagueOne", "leagueTwo", "nationalLeague"] as const;
type TierKey = typeof TIER_KEYS[number];
const TIER_TO_DIVISION: Record<TierKey, CareerDivision> = {
  premier: "premier", championship: "championship", leagueOne: "league_one",
  leagueTwo: "league_two", nationalLeague: "national_league",
};

/**
 * Each adjacent pair on the real English ladder, and how many clubs move
 * across it each season. Generalized 18 September 2026 from a Premier
 * League <-> Championship-only chain — League One, League Two and the
 * National League are now genuinely playable careers, so their own
 * boundaries need the exact same "your own division's table is a fact,
 * everybody else is a weighted draw" treatment the top boundary always had.
 */
const BOUNDARIES: { above: TierKey; below: TierKey; count: number }[] = [
  { above: "premier", below: "championship", count: 3 },
  { above: "championship", below: "leagueOne", count: CHAMP_LEAGUE_ONE_COUNT },
  { above: "leagueOne", below: "leagueTwo", count: LEAGUE_ONE_TWO_COUNT },
  { above: "leagueTwo", below: "nationalLeague", count: LEAGUE_TWO_NATIONAL_COUNT },
];

export function resolveLadder(career: CareerState, rng: () => number): LadderOutcome {
  const members = membershipOf(career);
  const strength = strengthTable(career, members);
  const you = career.player.club;
  const division = divisionOf(career);
  const table = sortLeague(career.league);
  const names = table.map(t => t.name);

  const working: Record<TierKey, string[]> = {
    premier: [...members.premier], championship: [...members.championship],
    leagueOne: [...members.leagueOne], leagueTwo: [...members.leagueTwo],
    nationalLeague: [...members.nationalLeague],
  };
  const promotedInto: Record<TierKey, string[]> = {
    premier: [], championship: [], leagueOne: [], leagueTwo: [], nationalLeague: [],
  };
  const relegatedFrom: Record<TierKey, string[]> = {
    premier: [], championship: [], leagueOne: [], leagueTwo: [], nationalLeague: [],
  };
  let playOffs: PlayOffResult | null = null;

  // Top boundary to bottom — every tier's "who left" is decided (real table
  // or weighted draw) before it's asked to top itself back up, same order
  // the original two-tier version always used.
  for (const { above, below, count } of BOUNDARIES) {
    const playingAbove = TIER_TO_DIVISION[above] === division;
    const playingBelow = TIER_TO_DIVISION[below] === division;

    // ── Who goes DOWN, from `above` into `below` ──
    const relegated = playingAbove
      // Your table is real, so its bottom N is a fact.
      ? names.slice(-count)
      // Nobody played this tier, so who came down is a draw — weighted the
      // other way, since it is the weak who go.
      : weightedDraw(working[above], strength, count, rng, true);
    relegatedFrom[above] = relegated;

    // ── Who goes UP, from `below` into `above` ──
    let promoted: string[];
    if (playingBelow) {
      // You played this tier: the top (count - 1) go up automatically, and
      // the play-offs decide the last place. A play-off your own club
      // reached was PLAYED, not simulated — see lib/star/playoffs — so its
      // result is the truth and must not be re-rolled here. Everybody
      // else's is simulated as normal.
      const played = career.playOffState?.promoted;
      playOffs = played ? null : resolvePlayOffs(career.league, strength, rng, count - 1);
      const auto = names.slice(0, count - 1);
      const last = played ?? playOffs?.promoted;
      promoted = last ? [...auto, last] : auto;
    } else {
      // Nobody played this tier, so who came up is a draw.
      promoted = weightedDraw(working[below], strength, count, rng);
    }
    promotedInto[above] = promoted;

    working[above] = working[above].filter(c => !relegated.includes(c));
    working[below] = working[below].filter(c => !promoted.includes(c));
  }

  // ── National League <-> North and South ──
  //
  // Four down, two up from each region. Same rule as every boundary above:
  // the division you played is decided by its real table (and, in a region,
  // by its real play-offs — 2nd to 5th, one place, see playoffs.ts); every
  // other is a weighted draw.
  const playingNationalLeague = division === "national_league";
  const relegatedFromNationalLeague = playingNationalLeague
    ? names.slice(-NATIONAL_DOWN_COUNT)
    : weightedDraw(working.nationalLeague, strength, NATIONAL_DOWN_COUNT, rng, true);
  const regionUp = (key: "nationalLeagueNorth" | "nationalLeagueSouth", div: CareerDivision): string[] => {
    if (division !== div) return weightedDraw(members[key], strength, REGIONAL_UP_COUNT, rng);
    // The champion up, and the 2nd-7th play-off winner (resolveRegionalPlayOffs).
    const played = career.playOffState?.promoted;
    playOffs = played ? null : resolveRegionalPlayOffs(career.league, strength, rng);
    const last = played ?? playOffs?.promoted;
    const auto = names.slice(0, REGIONAL_UP_COUNT - 1);
    return last ? [...auto, last] : auto;
  };
  const promotedFromNorth = regionUp("nationalLeagueNorth", "national_league_north");
  const promotedFromSouth = regionUp("nationalLeagueSouth", "national_league_south");
  // 21st-24th go down to Step 3: a fact in the region you played, a weighted
  // draw (the weak likelier) in the other.
  const regionDown = (key: "nationalLeagueNorth" | "nationalLeagueSouth", div: CareerDivision, up: string[]): string[] =>
    division === div
      // Step 3 has no fixtures, so your own club never goes down there: a
      // bottom-four finish forces a move first (page.tsx, "relegation-move");
      // if that somehow didn't happen, the club above you goes instead.
      ? names.filter(c => c !== career.player.club).slice(-REGIONAL_DOWN_COUNT)
      : weightedDraw(members[key].filter(c => !up.includes(c)), strength, REGIONAL_DOWN_COUNT, rng, true);
  const relegatedFromNorth = regionDown("nationalLeagueNorth", "national_league_north", promotedFromNorth);
  const relegatedFromSouth = regionDown("nationalLeagueSouth", "national_league_south", promotedFromSouth);
  // Step 3's four all go up.
  const promotedFromStep3North = [...members.step3North];
  const promotedFromStep3South = [...members.step3South];
  const promotedToNationalLeague = [...promotedFromNorth, ...promotedFromSouth];
  const { north: relegatedToNorth, south: relegatedToSouth } =
    splitByRegion(relegatedFromNationalLeague, promotedFromNorth.length);
  working.nationalLeague = working.nationalLeague.filter(c => !relegatedFromNationalLeague.includes(c));

  const premierRaw = [...working.premier, ...promotedInto.premier];
  const championshipRaw = [
    ...working.championship, ...relegatedFrom.premier, ...promotedInto.championship,
  ];
  // Relegated Championship clubs join League One, and the clubs drawn up
  // out of it leave — which is what puts a relegated club back in the hat
  // for next time round. Same shape cascades three more times below.
  const leagueOneRaw = [
    ...working.leagueOne, ...relegatedFrom.championship, ...promotedInto.leagueOne,
  ];
  const leagueTwoRaw = [
    ...working.leagueTwo, ...relegatedFrom.leagueOne, ...promotedInto.leagueTwo,
  ];
  const nationalLeagueRaw = [
    ...working.nationalLeague, ...relegatedFrom.leagueTwo, ...promotedToNationalLeague,
  ];
  const northRaw = [
    ...members.nationalLeagueNorth.filter(c => !promotedFromNorth.includes(c) && !relegatedFromNorth.includes(c)),
    ...relegatedToNorth, ...promotedFromStep3North,
  ];
  const southRaw = [
    ...members.nationalLeagueSouth.filter(c => !promotedFromSouth.includes(c) && !relegatedFromSouth.includes(c)),
    ...relegatedToSouth, ...promotedFromStep3South,
  ];

  // Reported directly, from a real save at season 3: the Premier League
  // held 21 clubs. Twenty seasons of this exact arithmetic, run through
  // `advanceSeason` and not just this function in isolation, are checked
  // by tests/star/promotion.mts and hold — so this is defensive, guarding
  // a shape that shouldn't be reachable from clean code rather than one
  // proven to happen from it. But a save is a JSON blob forever: whatever
  // produced a 21st club (an already-fixed historical bug, most likely,
  // given the math above checks out today) is now baked into that one
  // save regardless of what today's code does, and the fix that actually
  // reaches a player is one that heals the shape it finds, not one that
  // only proves it wouldn't have happened starting from scratch.
  const {
    premier, championship, leagueOne, leagueTwo, nationalLeague,
    nationalLeagueNorth, nationalLeagueSouth, step3North, step3South, limbo,
  } = reconcileLadder(
    premierRaw, championshipRaw, leagueOneRaw, leagueTwoRaw, nationalLeagueRaw, northRaw, southRaw,
    career.limboClubs ?? [], strength, rng, relegatedFromNorth, relegatedFromSouth,
  );

  const NEXT_TIERS: { division: CareerDivision; clubs: string[] }[] = [
    { division: "premier", clubs: premier },
    { division: "championship", clubs: championship },
    { division: "league_one", clubs: leagueOne },
    { division: "league_two", clubs: leagueTwo },
    { division: "national_league", clubs: nationalLeague },
    { division: "national_league_north", clubs: nationalLeagueNorth },
    { division: "national_league_south", clubs: nationalLeagueSouth },
  ];

  // Your club is in exactly one of these seven by now — every boundary,
  // including the National League's, is now down into a playable division.
  // Falling back to the division you were already in only matters for a
  // save from before any of this existed.
  const next = NEXT_TIERS.find(t => t.clubs.includes(you));
  const nextDivision: CareerDivision = next?.division ?? division;
  const nextClubs = next?.clubs ?? (division === "premier" ? premier : championship);

  const yourMove = nextDivision === division ? null
    : divisionRank(nextDivision) < divisionRank(division) ? "promoted" : "relegated";

  return {
    division: nextDivision,
    clubs: nextClubs,
    divisions: { premier, championship, leagueOne, leagueTwo, nationalLeague, nationalLeagueNorth, nationalLeagueSouth, step3North, step3South },
    yourMove,
    promotedToPremier: promotedInto.premier, relegatedFromPremier: relegatedFrom.premier,
    promotedToChampionship: promotedInto.championship, relegatedFromChampionship: relegatedFrom.championship,
    promotedToLeagueOne: promotedInto.leagueOne, relegatedFromLeagueOne: relegatedFrom.leagueOne,
    promotedToLeagueTwo: promotedInto.leagueTwo, relegatedFromLeagueTwo: relegatedFrom.leagueTwo,
    promotedToNationalLeague, relegatedFromNationalLeague,
    relegatedToNorth, relegatedToSouth, promotedFromNorth, promotedFromSouth,
    relegatedFromNorth, relegatedFromSouth, promotedFromStep3North, promotedFromStep3South,
    playOffs,
    limbo,
  };
}
