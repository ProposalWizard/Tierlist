import { extraTimeScore, simulateShootout } from "./shootout";
import type { EuroTie } from "./euro";

/**
 * THE REAL UEFA KNOCKOUT BRACKET (Champions League and Europa League).
 *
 * Mikey, 8 Oct 2026: "i thought we already used the real uefa bracket
 * system … use this from now". Before this, settleEuro drew your next
 * opponent at random from a band of the league-phase table, nobody else's
 * knockout tie was ever played, and when you went out the winner was a
 * weighted pick. Now the whole knockout is a fixed bracket off the table, as
 * UEFA has run it since 2024/25:
 *
 *   1st–8th:   straight into the round of 16 (seeds)
 *   9th–24th:  the knockout play-off (the game calls it "Round of 32"),
 *              9/10 v 23/24 · 11/12 v 21/22 · 13/14 v 19/20 · 15/16 v 17/18
 *   25th–36th: out
 *   Round of 16: 1/2 v the 15/16–17/18 winners · 3/4 v 13/14–19/20 ·
 *                5/6 v 11/12–21/22 · 7/8 v 9/10–23/24
 *   Then fixed: the 1/2 tie meets the 7/8 tie, the 3/4 tie meets the 5/6 tie,
 *   and 1 and 2 are in different halves, so they can only meet in the final.
 *
 * Two legs, the better league-phase finisher at home in the second; no away
 * goals; extra time, then penalties. The final is one match.
 *
 * Every tie you are not in is played the moment both sides are known; the
 * round-up screen only shows a result once its date has come. Your own tie
 * waits for you (settleYourTie).
 */

export const EURO_KO_ROUNDS = ["Round of 32", "Round of 16", "Quarter-Final", "Semi-Final", "Final"] as const;

export interface KoLeg {
  /** Goals for the tie's `a` and `b` clubs. */
  a: number;
  b: number;
  /** Was `a` at home in this leg? */
  aHome: boolean;
}

export interface KoTie {
  /** The better league-phase finisher. Set once both sides are known. */
  a?: string;
  b?: string;
  legs: KoLeg[];
  /** Extra-time goals (already inside the last leg's score). */
  et?: { a: number; b: number };
  pens?: { a: number; b: number };
  winner?: string;
}

export interface EuroBracket {
  /** League-phase finish of every knockout club, 1-based. */
  finish: Record<string, number>;
  /**
   * EURO_KO_ROUNDS order. Round of 16 tie j is seed j against the winner of
   * play-off tie j; from there tie j of a round is fed by ties 2j and 2j+1.
   */
  rounds: { name: string; ties: KoTie[] }[];
  /** The round of 16 seeds, in tie order. */
  seeds: string[];
  winner?: string;
}

type Sim = (a: number, b: number, rng: () => number) => [number, number];

/** Build the bracket off the final league-phase table (names, best first). */
export function openEuroBracket(table: string[], rng: () => number): EuroBracket {
  const pos = (n: number) => table[n - 1];
  const finish: Record<string, number> = {};
  table.slice(0, 24).forEach((c, i) => { finish[c] = i + 1; });
  const swap = <T,>(p: [T, T]): [T, T] => (rng() < 0.5 ? p : [p[1], p[0]]);

  // For each band k (0: 9/10 v 23/24 … 3: 15/16 v 17/18): the two play-off
  // ties, and the pair of seeds they lead to.
  const seedPairFor = [[7, 8], [5, 6], [3, 4], [1, 2]] as const;
  const band = (k: number) => {
    const [u0, u1] = swap([23 - 2 * k, 24 - 2 * k]);
    const ties: [[number, number], [number, number]] = [[9 + 2 * k, u0], [10 + 2 * k, u1]];
    const seeds = swap([seedPairFor[k][0], seedPairFor[k][1]]);
    return { ties: swap(ties), seeds };
  };
  const b = [0, 1, 2, 3].map(band);
  // Halves: each takes one seed of every pair. Order inside a half:
  // 1/2, 7/8, 3/4, 5/6 — so 1/2 meets 7/8 and 3/4 meets 5/6 in the quarters.
  const order = [3, 0, 2, 1]; // bands for the 1/2, 7/8, 3/4, 5/6 seeds
  const seeds: string[] = [];
  const playOff: KoTie[] = [];
  for (const half of [0, 1]) {
    for (const k of order) {
      seeds.push(pos(b[k].seeds[half]));
      const [hi, lo] = b[k].ties[half];
      playOff.push({ a: pos(hi), b: pos(lo), legs: [] });
    }
  }
  const empty = (n: number): KoTie[] => Array.from({ length: n }, () => ({ legs: [] }));
  return {
    finish,
    seeds,
    rounds: [
      { name: EURO_KO_ROUNDS[0], ties: playOff },
      { name: EURO_KO_ROUNDS[1], ties: seeds.map(s => ({ a: s, legs: [] as KoLeg[] })) },
      { name: EURO_KO_ROUNDS[2], ties: empty(4) },
      { name: EURO_KO_ROUNDS[3], ties: empty(2) },
      { name: EURO_KO_ROUNDS[4], ties: empty(1) },
    ],
  };
}

/** Play one tie nobody is watching. */
function playTie(t: KoTie, single: boolean, str: (c: string) => number, sim: Sim, rng: () => number): KoTie {
  const sa = str(t.a!), sb = str(t.b!);
  const legs: KoLeg[] = [];
  if (single) {
    const [x, y] = sim(sa, sb, rng);
    legs.push({ a: x, b: y, aHome: true });
  } else {
    const [h1, a1] = sim(sb, sa, rng); // first leg at b's ground
    legs.push({ a: a1, b: h1, aHome: false });
    const [h2, a2] = sim(sa, sb, rng);
    legs.push({ a: h2, b: a2, aHome: true });
  }
  let ta = legs.reduce((s, l) => s + l.a, 0);
  let tb = legs.reduce((s, l) => s + l.b, 0);
  const out: KoTie = { ...t, legs };
  if (ta === tb) {
    const et = extraTimeScore(sa, sb, rng);
    out.et = { a: et.hs, b: et.as };
    const last = legs[legs.length - 1];
    legs[legs.length - 1] = { ...last, a: last.a + et.hs, b: last.b + et.as };
    ta += et.hs; tb += et.as;
    if (ta === tb) {
      const p = simulateShootout(sa, sb, rng);
      out.pens = { a: p.home, b: p.away };
    }
  }
  out.winner = ta !== tb ? (ta > tb ? t.a : t.b) : (out.pens!.a > out.pens!.b ? t.a : t.b);
  return out;
}

function ordered(br: EuroBracket, x: string, y: string): [string, string] {
  const fx = br.finish[x] ?? 99, fy = br.finish[y] ?? 99;
  return fx <= fy ? [x, y] : [y, x];
}

/**
 * Play every tie whose two sides are known and that you are not in, and fill
 * the next rounds from the winners. Repeats until nothing changes, so once you
 * are out it plays the whole thing to a winner.
 */
export function advanceEuroBracket(
  br: EuroBracket, you: string, str: (c: string) => number, sim: Sim, rng: () => number,
): EuroBracket {
  const rounds = br.rounds.map(r => ({ ...r, ties: r.ties.map(t => ({ ...t, legs: [...t.legs] })) }));
  let winner = br.winner;
  for (let guard = 0; guard < 12; guard++) {
    let changed = false;
    rounds.forEach((r, ri) => {
      r.ties.forEach((t, ti) => {
        if (t.a && t.b && !t.winner && t.a !== you && t.b !== you) {
          r.ties[ti] = playTie(t, r.name === "Final", str, sim, rng);
          changed = true;
        }
      });
      const next = rounds[ri + 1];
      if (!next) return;
      next.ties.forEach((nt, j) => {
        if (nt.a && nt.b) return;
        if (ri === 0) {
          // Round of 16: seed j v play-off tie j's winner.
          const w = r.ties[j]?.winner;
          if (w && nt.a) { const [x, y] = ordered(br, nt.a, w); next.ties[j] = { ...nt, a: x, b: y }; changed = true; }
          return;
        }
        const w1 = r.ties[2 * j]?.winner, w2 = r.ties[2 * j + 1]?.winner;
        if (w1 && w2) { const [x, y] = ordered(br, w1, w2); next.ties[j] = { ...nt, a: x, b: y }; changed = true; }
      });
    });
    const fin = rounds[rounds.length - 1].ties[0];
    if (fin.winner && fin.winner !== winner) { winner = fin.winner; changed = true; }
    if (!changed) break;
  }
  return { ...br, rounds, winner };
}

/** Your tie still to be played, with its round. */
export function yourKoTie(br: EuroBracket, you: string): { round: string; tie: KoTie } | null {
  for (const r of br.rounds) {
    const t = r.ties.find(x => !x.winner && x.a && x.b && (x.a === you || x.b === you));
    if (t) return { round: r.name, tie: t };
  }
  return null;
}

/** Your next EuroTie (the shape the fixtures and the match read), off the bracket. */
export function euroTieFromBracket(br: EuroBracket, you: string, str: (c: string) => number): EuroTie | null {
  const mine = yourKoTie(br, you);
  if (!mine) return null;
  const opponent = mine.tie.a === you ? mine.tie.b! : mine.tie.a!;
  const youHigher = mine.tie.a === you;
  const single = mine.round === "Final";
  return {
    round: mine.round,
    opponent,
    opponentStrength: str(opponent),
    // The better finisher is at home in the second leg.
    legs: single ? [{ home: false }] : [{ home: !youHigher }, { home: youHigher }],
  };
}

/** Write your settled EuroTie into the bracket, then play on around it. */
export function settleYourKoTie(
  br: EuroBracket, you: string, decided: EuroTie, str: (c: string) => number, sim: Sim, rng: () => number,
): EuroBracket {
  const rounds = br.rounds.map(r => ({ ...r, ties: [...r.ties] }));
  for (const r of rounds) {
    const i = r.ties.findIndex(x => !x.winner && x.a && x.b && (x.a === you || x.b === you));
    if (i < 0 || r.name !== decided.round) continue;
    const t = r.ties[i];
    const youA = t.a === you;
    const legs: KoLeg[] = decided.legs.map(l => {
      const us = l.us ?? 0, them = l.them ?? 0;
      return youA ? { a: us, b: them, aHome: l.home } : { a: them, b: us, aHome: !l.home };
    });
    const flip = (p?: { us: number; them: number }) => p && (youA ? { a: p.us, b: p.them } : { a: p.them, b: p.us });
    r.ties[i] = {
      ...t, legs, et: flip(decided.extraTime), pens: flip(decided.pens),
      winner: decided.result === "W" ? you : decided.opponent,
    };
    break;
  }
  return advanceEuroBracket({ ...br, rounds }, you, str, sim, rng);
}

/** Aggregate of a played tie, `a` then `b`. */
export function koAggregate(t: KoTie): { a: number; b: number } | null {
  if (!t.legs.length) return null;
  return { a: t.legs.reduce((s, l) => s + l.a, 0), b: t.legs.reduce((s, l) => s + l.b, 0) };
}
