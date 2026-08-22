import type { LeagueTeam } from "./types";
import type { CareerDivision } from "./calendar";
import { CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS } from "./clubs";

/**
 * THE CUPS.
 *
 * Thirty-two clubs, a fresh draw every round, and every tie played. Round of 32,
 * round of 16, quarter-final, semi-final, final — five rounds, thirty-one ties,
 * one winner.
 *
 * What it replaced was not a cup. A "run" was a counter: at each round the game
 * picked a random club out of the division, played you against it, and moved the
 * counter on. Nobody else was in it, there was no draw, no bracket, and no
 * answer to "who else is left" — because there was nobody else. Winning the
 * final meant beating four random opponents in a row.
 *
 * ── Why a draw rather than a bracket ──
 *
 * Because that is how these two cups work. A bracket is fixed at the start and
 * you can read your route to the final off it; the FA Cup and the League Cup
 * redraw from a hat after every round, so the only thing you know is who you
 * have got THIS time. That is the whole character of the thing, and it is also
 * simpler: a round is a list of survivors, shuffled and paired.
 */

export type CupId = "FA Cup" | "League Cup";

export const CUP_ROUND_NAMES = ["Round of 32", "Round of 16", "Quarter-Final", "Semi-Final", "Final"];

export interface CupTie {
  home: string;
  away: string;
  /** Absent until the tie is played. */
  hs?: number;
  as?: number;
  /** A knockout cannot be drawn. Set when it went to spot kicks. */
  pens?: { home: number; away: number };
}

export interface CupRound {
  name: string;
  ties: CupTie[];
}

export interface CupState {
  competition: CupId;
  /** The rounds drawn so far. The last one is the round being played. */
  rounds: CupRound[];
  /** Whoever lifted it. Absent until the final is played. */
  winner?: string;
}

/** How many clubs a cup holds. Five rounds of halving. */
export const CUP_FIELD = 32;

// ── Who comes up from below ──────────────────────────────────────────────────

/**
 * This used to be a flat, hardcoded list of twelve clubs — written before the
 * Championship was a real, live 24-club division with its own promotion and
 * relegation (see lib/star/clubs.ts, lib/star/promotion.ts). It had gone
 * quietly wrong: three of its twelve names (Coventry City, Ipswich Town, Hull
 * City) are now in the PREMIER LEAGUE, so a Championship career's cup draw
 * could field actual top-flight clubs as fake "lower-tier" opposition, and
 * the other nine were simply appended on top of `league` with no draw at
 * all — every Championship season saw the exact same twelve names, in the
 * exact same cup, forever.
 *
 * Below draws for real now, from the two real pools this game actually
 * tracks: the Championship's other twenty-four clubs (real strength when the
 * career itself is playing the Championship and this file has synced
 * numbers for them; a stable estimate otherwise) and the five-club
 * promotion pool. The pool is weighted far lower — a National League side
 * reaching the FA Cup proper happens in real life, but it is the exception,
 * not twelve automatic slots.
 *
 * This reads the STATIC club lists in lib/star/clubs.ts, not
 * `membershipOf(career)` — a save several seasons into promotion/relegation
 * drift draws its cup opposition from the divisions the game shipped with,
 * not this season's actual Championship. Fully tracking that would mean
 * threading the whole CareerState through every function below instead of
 * just a league table and a division, for a candidate pool that only ever
 * decides who a cup upset comes from — more plumbing than this file's job
 * is worth.
 */
function belowStrength(club: string, tier: "championship" | "pool"): number {
  // Deliberately well under a real division's own numbers — the same
  // baseline+noise idea lib/star/promotion.ts uses for an estimate, pitched
  // lower on purpose: a cup upset should be an upset, not a coin flip.
  const baseline = tier === "championship" ? 58 : 50;
  let h = 2166136261;
  for (let i = 0; i < club.length; i++) { h ^= club.charCodeAt(i); h = Math.imul(h, 16777619); }
  return baseline + ((h >>> 0) % 700) / 100; // baseline .. baseline + 6.99
}

/** One weighted draw, without replacement, stopping at `count` or when the
 *  pool runs dry. */
function weightedDrawN(
  candidates: { name: string; weight: number }[], count: number, rng: () => number,
): string[] {
  const remaining = [...candidates];
  const picked: string[] = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, c) => sum + c.weight, 0);
    let roll = rng() * total;
    let at = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) { at = i; break; }
    }
    picked.push(remaining[at].name);
    remaining.splice(at, 1);
  }
  return picked;
}

/**
 * Fill `needed` places from below `names` (the division actually being
 * played — twenty clubs guaranteed for a Premier League season, twenty-four
 * for a Championship one, never in question and never part of this draw).
 *
 * A Premier League season draws from BOTH pools: the real Championship,
 * weighted by an estimated strength so a stronger side is likelier, and the
 * five-club promotion pool, weighted the same way but multiplied hard down —
 * these five should be an occasional story, not a regular fixture. A
 * Championship season draws from the pool alone, since this game does not
 * model a real division below it.
 */
function belowField(
  names: string[], division: CareerDivision, needed: number, rng: () => number,
): string[] {
  const isPremier = division === "premier";
  const championshipCandidates = isPremier
    ? CHAMPIONSHIP_CLUBS.filter(c => !names.includes(c))
        .map(name => ({ name, weight: belowStrength(name, "championship") }))
    : [];
  const poolCandidates = PROMOTION_POOL_CLUBS.filter(c => !names.includes(c))
    .map(name => ({
      name,
      weight: belowStrength(name, "pool") * (isPremier ? 0.25 : 1),
    }));
  const drawn = weightedDrawN([...championshipCandidates, ...poolCandidates], needed, rng);
  // A division this small (chiefly a test fixture) can run both pools dry
  // before reaching `needed` — pad the same way a short division always
  // has, rather than ship a cup with fewer than thirty-two clubs in it.
  let i = 0;
  while (drawn.length < needed) {
    drawn.push(`${PROMOTION_POOL_CLUBS[i % PROMOTION_POOL_CLUBS.length]} B`);
    i++;
  }
  return drawn;
}

// ── The draw ────────────────────────────────────────────────────────────────

/**
 * Shuffle, honestly.
 *
 * `sort(() => rng() - 0.5)` is the one everybody writes and it does not produce
 * a uniform permutation — the comparator is not a valid ordering, so the result
 * depends on the sort implementation. It is already in this codebase deciding
 * which clubs play each other. A draw out of a hat has to actually be one.
 */
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pair a hatful of clubs off. The first name out of the hat is at home. */
export function drawRound(name: string, survivors: string[], rng: () => number): CupRound {
  const hat = shuffle(survivors, rng);
  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < hat.length; i += 2) {
    ties.push({ home: hat[i], away: hat[i + 1] });
  }
  return { name, ties };
}

/**
 * Open a cup: everybody in, first round drawn.
 *
 * The field is the division actually being played — guaranteed, whichever
 * one it is — plus a weighted draw filling out the rest to thirty-two. See
 * belowField for what that draw actually is.
 */
export function openCup(
  competition: CupId, league: LeagueTeam[], division: CareerDivision, rng: () => number,
): CupState {
  const field = cupField(league, division, rng);
  return { competition, rounds: [drawRound(CUP_ROUND_NAMES[0], field, rng)] };
}

/** Who is in it. Exported so the strength lookup can agree with the draw. */
export function cupField(league: LeagueTeam[], division: CareerDivision, rng: () => number): string[] {
  const names = league.map(t => t.name);
  const needed = Math.max(0, CUP_FIELD - names.length);
  const below = belowField(names, division, needed, rng);
  return [...names, ...below].slice(0, CUP_FIELD);
}

/** How good a club in the hat is, whichever division or pool it came from. */
export function cupStrength(club: string, league: LeagueTeam[]): number {
  const inLeague = league.find(t => t.name === club);
  if (inLeague) return inLeague.strength;
  if (CHAMPIONSHIP_CLUBS.includes(club)) return belowStrength(club, "championship");
  if (PROMOTION_POOL_CLUBS.includes(club)) return belowStrength(club, "pool");
  // A padded filler name ("X B") from a division too small to fill the
  // field on real clubs alone.
  const base = club.replace(/ B$/, "");
  if (PROMOTION_POOL_CLUBS.includes(base)) return belowStrength(base, "pool") - 3;
  return 55;
}

// ── Playing a round ─────────────────────────────────────────────────────────

function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

/** A scoreline between two clubs, from the same model the league uses. */
function tieScore(homeStr: number, awayStr: number, rng: () => number): { hs: number; as: number } {
  const h = homeStr + 3;   // the same home advantage the division gets
  return {
    hs: poisson(Math.max(0.3, (h / awayStr) * 1.4), rng),
    as: poisson(Math.max(0.2, (awayStr / h) * 1.1), rng),
  };
}

/**
 * A knockout cannot be drawn.
 *
 * Level after ninety and it goes to spot kicks, decided on a coin weighted by
 * quality — bounded well inside a flip, because the better side really is a
 * little likelier and a run that ends on a pure toss reads as arbitrary.
 */
function shootout(homeStr: number, awayStr: number, rng: () => number): { home: number; away: number } {
  const edge = Math.max(0.32, Math.min(0.68, 0.5 + (homeStr - awayStr) / 200));
  const homeWins = rng() < edge;
  const loser = 3 + Math.floor(rng() * 2);
  return homeWins ? { home: loser + 1 + Math.floor(rng() * 2), away: loser }
    : { home: loser, away: loser + 1 + Math.floor(rng() * 2) };
}

export function tieWinner(tie: CupTie): string | null {
  if (tie.hs === undefined || tie.as === undefined) return null;
  if (tie.hs !== tie.as) return tie.hs > tie.as ? tie.home : tie.away;
  if (!tie.pens) return null;
  return tie.pens.home > tie.pens.away ? tie.home : tie.away;
}

/**
 * Play every tie in the current round except the one that is YOURS, then draw
 * the next round from the winners.
 *
 * Your own tie is handed in already settled — you played it, or it was
 * simulated for you because you were left out — because it is the one result
 * the cup does not get to decide.
 */
export function playCupRound(
  state: CupState,
  league: LeagueTeam[],
  yourClub: string,
  yourResult: { hs: number; as: number } | null,
  rng: () => number,
): CupState {
  const round = state.rounds[state.rounds.length - 1];
  if (!round || round.ties.every(t => t.hs !== undefined)) return state;

  const played: CupTie[] = round.ties.map((tie) => {
    if (tie.hs !== undefined) return tie;
    const yours = tie.home === yourClub || tie.away === yourClub;
    const hStr = cupStrength(tie.home, league);
    const aStr = cupStrength(tie.away, league);
    let hs: number, as: number;
    if (yours && yourResult) {
      hs = yourResult.hs; as = yourResult.as;
    } else {
      ({ hs, as } = tieScore(hStr, aStr, rng));
    }
    const out: CupTie = { ...tie, hs, as };
    if (hs === as) out.pens = shootout(hStr, aStr, rng);
    return out;
  });

  const rounds = [...state.rounds.slice(0, -1), { ...round, ties: played }];
  const winners = played.map(tieWinner).filter((w): w is string => !!w);

  // The final: somebody has won it and there is nothing left to draw.
  if (round.name === CUP_ROUND_NAMES[CUP_ROUND_NAMES.length - 1] || winners.length < 2) {
    return { ...state, rounds, winner: winners[0] };
  }

  const nextName = CUP_ROUND_NAMES[Math.min(rounds.length, CUP_ROUND_NAMES.length - 1)];
  return { ...state, rounds: [...rounds, drawRound(nextName, winners, rng)] };
}

/**
 * Play the rest of the country's cup out once you are not part of it any more.
 *
 * playCupRound() already plays every OTHER tie in your round the moment yours
 * is settled — that part was never missing. What stopped was the next call:
 * nothing ever asked who won the round after you went out, so a cup you lost
 * in the third round simply had no winner for the rest of that season. No FA
 * Cup holder to defend it the following year, no Community Shield or Super
 * Cup fixture for whoever actually won it, because nothing recorded that they
 * had.
 *
 * `yourClub` here is deliberately whoever is already out — passing your own
 * name is safe and normal, it just will not match any tie left in the draw,
 * so every remaining round plays out exactly as it would with nobody special
 * in it. Bounded at six rounds: the competition is five rounds long end to
 * end, so a hat with only one round left to draw can never take more passes
 * than that to reach a winner.
 */
export function finishCupToWinner(
  state: CupState,
  league: LeagueTeam[],
  yourClub: string,
  rng: () => number,
): CupState {
  let s = state;
  for (let guard = 0; guard < 6 && !s.winner; guard++) {
    const next = playCupRound(s, league, yourClub, null, rng);
    if (next === s) break; // nothing left to play — already resolved
    s = next;
  }
  return s;
}

// ── Reading it ──────────────────────────────────────────────────────────────

/** The round being played, or the one just finished. */
export function currentRound(state: CupState): CupRound | null {
  return state.rounds[state.rounds.length - 1] ?? null;
}

/** Your tie in the round being played, if you are still in it. */
export function yourTie(state: CupState, club: string): CupTie | null {
  const round = currentRound(state);
  if (!round) return null;
  return round.ties.find(t => t.home === club || t.away === club) ?? null;
}

/** Are you still in this cup? */
export function stillIn(state: CupState, club: string): boolean {
  if (state.winner) return state.winner === club;
  return yourTie(state, club) !== null;
}

/** Which round you went out in, for the record. */
export function exitRound(state: CupState, club: string): string | null {
  for (const round of state.rounds) {
    const tie = round.ties.find(t => t.home === club || t.away === club);
    if (!tie) continue;
    const w = tieWinner(tie);
    if (w && w !== club) return round.name;
  }
  return null;
}
