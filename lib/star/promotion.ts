import type { CareerState, LeagueTeam } from "./types";
import { sortLeague, simulateFixtureScore } from "./season";
import { divisionOf, type CareerDivision } from "./calendar";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS,
  LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS, NATIONAL_LEAGUE_POOL_CLUBS,
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
  /** Below the National League. Not a division, same idea as the old pool —
   *  exactly four clubs, and (see resolveLadder) ALL FOUR rotate out every
   *  season, since the National League relegates four with nowhere else to
   *  go. */
  nationalLeaguePool: string[];
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
  return {
    premier: d?.premier ?? [...PREMIER_LEAGUE_CLUBS],
    championship: d?.championship ?? [...CHAMPIONSHIP_CLUBS],
    leagueOne: d?.leagueOne ?? [...LEAGUE_ONE_CLUBS],
    leagueTwo: d?.leagueTwo ?? [...LEAGUE_TWO_CLUBS],
    nationalLeague: d?.nationalLeague ?? [...NATIONAL_LEAGUE_CLUBS],
    nationalLeaguePool: d?.nationalLeaguePool ?? [...NATIONAL_LEAGUE_POOL_CLUBS],
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
  return tier === "premier" ? 78
    : tier === "championship" ? 70
    : tier === "leagueOne" ? 63
    : tier === "leagueTwo" ? 58
    : 55; // nationalLeague, nationalLeaguePool — same tier, given directly
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
  for (const tier of ["premier", "championship", "leagueOne", "leagueTwo", "nationalLeague", "nationalLeaguePool"] as const) {
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
    : "nationalLeaguePool";
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

// ── Self-healing: a division is always exactly the right size ──────────────

const PREMIER_SIZE = PREMIER_LEAGUE_CLUBS.length;
const CHAMPIONSHIP_SIZE = CHAMPIONSHIP_CLUBS.length;
const LEAGUE_ONE_SIZE = LEAGUE_ONE_CLUBS.length;
const LEAGUE_TWO_SIZE = LEAGUE_TWO_CLUBS.length;
const NATIONAL_LEAGUE_SIZE = NATIONAL_LEAGUE_CLUBS.length;
const NATIONAL_POOL_SIZE = NATIONAL_LEAGUE_POOL_CLUBS.length;

// How many move at each of the three new boundaries, given directly:
//   League One <-> Championship: 3 up (top 2 automatic + 1 playoff-modeled
//     slot), 3 down — unchanged from the Championship's own existing "three
//     up, three down" shape, just against League One instead of the old pool.
//   League One <-> League Two: 4 each way (top 3 automatic + 1 modeled up;
//     21st-24th down).
//   League Two <-> National League: 2 each way (1 automatic + 1 modeled up;
//     23rd-24th down).
//   National League <-> its 4-club pool: 4 each way — the whole pool turns
//     over every season, since the National League relegates four and this
//     game has no National League North/South to send them to instead.
// None of these tiers is ever a division a career actually plays a season
// in (see clubs.ts's own note), so — same as the existing Championship<->pool
// shape already did — every count here is a genuine table position ONLY for
// whichever real division the career is playing; every other boundary is a
// pure weighted draw, same fidelity as the ladder already had.
const CHAMP_LEAGUE_ONE_COUNT = 3;
const LEAGUE_ONE_TWO_COUNT = 4;
const LEAGUE_TWO_NATIONAL_COUNT = 2;
const NATIONAL_POOL_COUNT = 4;

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
  nationalLeague: string[], nationalPool: string[], limbo: string[],
  strength: Map<string, number>, rng: () => number,
): {
  premier: string[]; championship: string[]; leagueOne: string[]; leagueTwo: string[];
  nationalLeague: string[]; nationalLeaguePool: string[]; limbo: string[];
} {
  const seen = new Set<string>();
  const dedupe = (list: string[]) => list.filter(c => (seen.has(c) ? false : (seen.add(c), true)));
  let p = dedupe(premier), c = dedupe(championship);
  let l1 = dedupe([...leagueOne, ...limbo]);
  let l2 = dedupe(leagueTwo), nl = dedupe(nationalLeague), np = dedupe(nationalPool);

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
  [nl, np] = shrink(nl, NATIONAL_LEAGUE_SIZE, np);

  // Then undersized tiers pull upward from whatever the tier below now has
  // spare, same direction an ordinary promotion already moves in, bottom to
  // top so a shortfall doesn't get "fixed" from a tier that hasn't itself
  // been topped up yet.
  [nl, np] = grow(nl, NATIONAL_LEAGUE_SIZE, np);
  [l2, nl] = grow(l2, LEAGUE_TWO_SIZE, nl);
  [l1, l2] = grow(l1, LEAGUE_ONE_SIZE, l2);
  [c, l1] = grow(c, CHAMPIONSHIP_SIZE, l1);
  [p, c] = grow(p, PREMIER_SIZE, c);

  // An oversized National League pool (nowhere lower than it) sheds its own
  // weakest back into limbo — the one tier with nowhere lower to shrink
  // into, same as League One's own shortfall case above has nowhere lower
  // to grow FROM once League Two, National League and its pool are all
  // already exhausted.
  const [poolFinal, limboOut] = shrink(np, NATIONAL_POOL_SIZE, []);

  return {
    premier: p, championship: c, leagueOne: l1, leagueTwo: l2,
    nationalLeague: nl, nationalLeaguePool: poolFinal, limbo: limboOut,
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
    promotedToChampionship = weightedDraw(members.leagueOne, strength, CHAMP_LEAGUE_ONE_COUNT, rng);
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
    // ── Your own club really can go down ──
    //
    // The pool is a hat, not a division — no fixtures, no table, no season —
    // so relegation out of the Championship cannot just drop you into it and
    // carry on: there is nowhere for the career to play next. That is handled
    // upstream of here, not by reprieving you. Before this ever runs, the page
    // notices your club is in the bottom three and makes you sign for a new
    // one — a genuine Championship survivor always, occasionally a Premier
    // League side if the season was good enough (lib/star/relegationOffers.ts,
    // RelegationMove.tsx) — so by the time resolveLadder runs, `you` already
    // names a club with a real division to be placed in. Bottom three is
    // simply the table's, exactly like every other club's.
    relegatedFromChampionship = names.slice(-3);
    // Nobody played the Premier League, so who came down is a draw — weighted
    // the other way, since it is the weak who go.
    relegatedFromPremier = weightedDraw(members.premier, strength, 3, rng, true);
    promotedToChampionship = weightedDraw(members.leagueOne, strength, CHAMP_LEAGUE_ONE_COUNT, rng);
  }

  // ── League One down to the National League pool — none of this is your
  // own division, so every one of these is a weighted draw, same fidelity
  // as the old Championship<->pool boundary always had. `promotedToChampionship`
  // above already drew League One's "went up" clubs; here is the rest of
  // League One's own movement, then the same shape cascaded three more
  // times. ──
  const l1Left = members.leagueOne.filter(c => !promotedToChampionship.includes(c));
  const relegatedFromLeagueOne = weightedDraw(l1Left, strength, LEAGUE_ONE_TWO_COUNT, rng, true);
  const promotedToLeagueOne = weightedDraw(members.leagueTwo, strength, LEAGUE_ONE_TWO_COUNT, rng);

  const l2Left = members.leagueTwo.filter(c => !promotedToLeagueOne.includes(c));
  const relegatedFromLeagueTwo = weightedDraw(l2Left, strength, LEAGUE_TWO_NATIONAL_COUNT, rng, true);
  const promotedToLeagueTwo = weightedDraw(members.nationalLeague, strength, LEAGUE_TWO_NATIONAL_COUNT, rng);

  const nlLeft = members.nationalLeague.filter(c => !promotedToLeagueTwo.includes(c));
  const relegatedFromNationalLeague = weightedDraw(nlLeft, strength, NATIONAL_POOL_COUNT, rng, true);
  // The whole 4-club pool turns over every season — see clubs.ts's own note
  // on NATIONAL_LEAGUE_POOL_CLUBS.
  const promotedToNationalLeague = weightedDraw(
    members.nationalLeaguePool, strength, Math.min(NATIONAL_POOL_COUNT, members.nationalLeaguePool.length), rng);

  const premierRaw = [
    ...members.premier.filter(c => !relegatedFromPremier.includes(c)),
    ...promotedToPremier,
  ];
  const championshipRaw = [
    ...members.championship.filter(
      c => !promotedToPremier.includes(c) && !relegatedFromChampionship.includes(c)),
    ...relegatedFromPremier,
    ...promotedToChampionship,
  ];
  // Relegated Championship clubs join League One, and the three drawn up
  // out of it leave — which is what puts a relegated club back in the hat
  // for next time round. This replaces the old Championship<->pool
  // rotation entirely (see clubs.ts/DivisionMembership's own notes).
  const leagueOneRaw = [
    ...members.leagueOne.filter(
      c => !promotedToChampionship.includes(c) && !relegatedFromLeagueOne.includes(c)),
    ...relegatedFromChampionship,
    ...promotedToLeagueOne,
  ];
  const leagueTwoRaw = [
    ...members.leagueTwo.filter(
      c => !promotedToLeagueOne.includes(c) && !relegatedFromLeagueTwo.includes(c)),
    ...relegatedFromLeagueOne,
    ...promotedToLeagueTwo,
  ];
  const nationalLeagueRaw = [
    ...members.nationalLeague.filter(
      c => !promotedToLeagueTwo.includes(c) && !relegatedFromNationalLeague.includes(c)),
    ...relegatedFromLeagueTwo,
    ...promotedToNationalLeague,
  ];
  const nationalPoolRaw = [
    ...members.nationalLeaguePool.filter(c => !promotedToNationalLeague.includes(c)),
    ...relegatedFromNationalLeague,
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
  const { premier, championship, leagueOne, leagueTwo, nationalLeague, nationalLeaguePool, limbo } =
    reconcileLadder(
      premierRaw, championshipRaw, leagueOneRaw, leagueTwoRaw, nationalLeagueRaw, nationalPoolRaw,
      career.limboClubs ?? [], strength, rng,
    );

  // Your club is one of the two by now — either it was never in the relegated
  // three, or the page already moved you to a new one before this ran (see
  // the note on relegatedFromChampionship above). Falling back to the
  // division you were already in only matters for a save from before any of
  // this existed, where nothing upstream has done that swap.
  const nextDivision: CareerDivision = premier.includes(you) ? "premier"
    : championship.includes(you) ? "championship"
    : division;

  const yourMove = nextDivision === division ? null
    : nextDivision === "premier" ? "promoted" : "relegated";

  return {
    division: nextDivision,
    clubs: nextDivision === "premier" ? premier : championship,
    divisions: { premier, championship, leagueOne, leagueTwo, nationalLeague, nationalLeaguePool },
    yourMove,
    promotedToPremier, relegatedFromPremier,
    promotedToChampionship, relegatedFromChampionship,
    playOffs,
    limbo,
  };
}
