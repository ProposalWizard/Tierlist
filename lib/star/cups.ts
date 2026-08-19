import type { LeagueTeam } from "./types";

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

/**
 * The twelve who make the field up to thirty-two.
 *
 * The Premier League is twenty, and a cup wants a power of two — so twelve come
 * up from below, which is what makes it a cup rather than a league played
 * knockout. They are the clubs the draft game already uses as promotion
 * candidates, minus the three it lists that are IN the Premier League here
 * (Wolves, Burnley, West Ham), plus three more from its own promoted list.
 *
 * Strengths are lower than every top-flight side on purpose. A cup upset should
 * be an upset.
 */
export const CUP_ENTRANTS_BELOW: { name: string; strength: number }[] = [
  { name: "Millwall", strength: 58 },
  { name: "Southampton", strength: 62 },
  { name: "Middlesbrough", strength: 59 },
  { name: "Wrexham", strength: 55 },
  { name: "Stoke City", strength: 57 },
  { name: "Norwich City", strength: 58 },
  { name: "Swansea City", strength: 56 },
  { name: "Sheffield United", strength: 57 },
  { name: "Watford", strength: 58 },
  { name: "Coventry City", strength: 59 },
  { name: "Ipswich Town", strength: 60 },
  { name: "Hull City", strength: 56 },
];

/** How many clubs a cup holds. Five rounds of halving. */
export const CUP_FIELD = 32;

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
 * The field is the division plus the twelve from below, trimmed or padded to
 * thirty-two so a season played with a smaller division still produces a cup
 * that halves cleanly.
 */
export function openCup(competition: CupId, league: LeagueTeam[], rng: () => number): CupState {
  const field = cupField(league);
  return { competition, rounds: [drawRound(CUP_ROUND_NAMES[0], field, rng)] };
}

/** Who is in it. Exported so the strength lookup can agree with the draw. */
export function cupField(league: LeagueTeam[]): string[] {
  const names = league.map(t => t.name);
  const below = CUP_ENTRANTS_BELOW.map(t => t.name).filter(n => !names.includes(n));
  const all = [...names, ...below];
  if (all.length >= CUP_FIELD) return all.slice(0, CUP_FIELD);
  // A short division: pad from below rather than draw an odd round.
  let i = 0;
  while (all.length < CUP_FIELD) all.push(`${CUP_ENTRANTS_BELOW[i % CUP_ENTRANTS_BELOW.length].name} B`), i++;
  return all;
}

/** How good a club in the hat is, whichever division it came from. */
export function cupStrength(club: string, league: LeagueTeam[]): number {
  const inLeague = league.find(t => t.name === club);
  if (inLeague) return inLeague.strength;
  const below = CUP_ENTRANTS_BELOW.find(t => club === t.name || club.startsWith(`${t.name} `));
  return below?.strength ?? 55;
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
