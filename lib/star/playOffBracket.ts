import type { PlayOffState, PlayOffTieState } from "./playoffs";

/**
 * THE PLAY-OFF BRACKET, AS FAR AS YOU ARE ALLOWED TO SEE IT.
 *
 * Mikey, 8 Oct 2026: "a playoff roundup screen before each of your playoff
 * matches … it shows the bracket so far … the lines go and then combine into
 * the next fixture." playoffs.ts plays every tie you are not in the moment
 * the bracket is seeded, so the answers are already in the save. This works
 * out what the screen may show: a round's results only once YOUR match in
 * that round is behind you (the ties are played at the same time), and which
 * round is the one that has just finished, so the screen can animate it.
 *
 * Two shapes, drawn mirrored like a cup "road to the final":
 *   four: 3v6 (side A) and 4v5 (side B), two legs each, then a one-off final.
 *         Championship, League One, League Two (4v7, 5v6), National League (2v5, 3v4).
 *   six:  North/South. 4v7 (A) and 5v6 (B) one match each; 3rd waits on side
 *         A, 2nd on side B; then the final.
 */

export type Stage = 0 | 1 | 2;
export type Slot = "top" | "bottom";

export interface BracketTeam {
  club: string;
  /** League finish, 1-based. */
  pos: number;
  /** The tie this team came out of, when it got here by winning one. */
  from?: string;
}

export interface BracketTie {
  /** qA, qB (qualifiers), sA, sB (semis), f (final). */
  id: string;
  stage: Stage;
  side: "A" | "B" | "C";
  top?: BracketTeam;
  bottom?: BracketTeam;
  /** Only once the result may be shown. */
  topScore?: number;
  bottomScore?: number;
  winner?: string;
  /** "agg." / "pens" / "1st leg 2–1" / "end of season". */
  note?: string;
  /** Where the winner goes. */
  feeds?: { tie: string; slot: Slot } | "promoted";
  /** A team with a bye sits here already (2nd and 3rd in the six format). */
  bye?: Slot;
  yours: boolean;
  /** Your next match. */
  next: boolean;
}

export interface Bracket {
  format: "four" | "six";
  ties: BracketTie[];
  /** Who went up, once it may be shown. */
  promoted?: string;
  /** The round you are about to play (3 = your run is over). */
  current: number;
  /** The first round to animate (its results pop, its winners move on). */
  revealFrom: number;
  /** The last round to animate. */
  revealTo: number;
}

/** The round a play-off fixture belongs to. */
export function stageOfRound(round: string | undefined): Stage | null {
  if (!round) return null;
  if (/final/i.test(round) && !/semi/i.test(round)) return 2;
  if (/semi/i.test(round)) return 1;
  if (/qualif/i.test(round)) return 0;
  return null;
}

function scoresFor(tie: PlayOffTieState | undefined, top: string | undefined) {
  if (!tie || !tie.legs.length || !top) return null;
  let t = 0, b = 0;
  for (const l of tie.legs) {
    if (tie.home === top) { t += l.hs; b += l.as; } else { t += l.as; b += l.hs; }
  }
  return { t, b };
}

/**
 * @param state      the save's play-off state
 * @param you        your club
 * @param pos        league finish of each club (1-based)
 * @param nextRound  the round name of your next play-off fixture, or undefined
 *                   when you have none left (out, or promoted)
 */
export function buildBracket(
  state: PlayOffState, you: string, pos: (club: string) => number, nextRound: string | undefined,
): Bracket {
  const six = state.format === "six";
  const nextStage = stageOfRound(nextRound);
  const current = nextStage ?? 3;
  const seen = (s: Stage) => s < current;
  const team = (club: string | undefined, from?: string): BracketTeam | undefined =>
    club ? { club, pos: pos(club), from } : undefined;
  const ties: BracketTie[] = [];

  const fill = (tie: BracketTie, src: PlayOffTieState | undefined, legsWanted: number) => {
    if (tie.top && tie.bottom) {
      tie.yours = tie.top.club === you || tie.bottom.club === you;
      tie.next = tie.yours && tie.stage === current;
    }
    const sc = scoresFor(src, tie.top?.club);
    if (seen(tie.stage) && src?.winner && sc) {
      tie.topScore = sc.t;
      tie.bottomScore = sc.b;
      tie.winner = src.winner;
      tie.note = sc.t === sc.b ? "pens" : legsWanted === 2 ? "agg." : undefined;
    } else if (tie.next && src && src.legs.length === 1 && legsWanted === 2 && sc) {
      // Your first leg is in: show it, nothing else.
      tie.note = `1st leg ${sc.t}–${sc.b}`;
    }
  };

  if (six) {
    const [second, third, fourth, fifth, sixth, seventh] = state.contenders;
    const [q1, q2] = state.qualifiers ?? [];
    const semiOf = (seed: string) => state.semis.find(s => s.home === seed);
    const qA: BracketTie = { id: "qA", stage: 0, side: "A", top: team(fourth), bottom: team(seventh),
      feeds: { tie: "sA", slot: "bottom" }, yours: false, next: false };
    const qB: BracketTie = { id: "qB", stage: 0, side: "B", top: team(fifth), bottom: team(sixth),
      feeds: { tie: "sB", slot: "bottom" }, yours: false, next: false };
    fill(qA, q1, 1);
    fill(qB, q2, 1);
    const sA: BracketTie = { id: "sA", stage: 1, side: "A", top: team(third), bye: "top",
      bottom: qA.winner ? team(qA.winner, "qA") : undefined,
      feeds: { tie: "f", slot: "top" }, yours: false, next: false };
    const sB: BracketTie = { id: "sB", stage: 1, side: "B", top: team(second), bye: "top",
      bottom: qB.winner ? team(qB.winner, "qB") : undefined,
      feeds: { tie: "f", slot: "bottom" }, yours: false, next: false };
    fill(sA, semiOf(third), 1);
    fill(sB, semiOf(second), 1);
    ties.push(qA, qB, sA, sB);
  } else {
    const [c0, c1, c2, c3] = state.contenders;
    const semiWith = (c: string) => state.semis.find(s => s.home === c || s.away === c);
    const sA: BracketTie = { id: "sA", stage: 1, side: "A", top: team(c0), bottom: team(c3),
      feeds: { tie: "f", slot: "top" }, yours: false, next: false };
    const sB: BracketTie = { id: "sB", stage: 1, side: "B", top: team(c1), bottom: team(c2),
      feeds: { tie: "f", slot: "bottom" }, yours: false, next: false };
    fill(sA, semiWith(c0), 2);
    fill(sB, semiWith(c1), 2);
    ties.push(sA, sB);
  }

  const sA = ties.find(t => t.id === "sA")!;
  const sB = ties.find(t => t.id === "sB")!;
  const f: BracketTie = { id: "f", stage: 2, side: "C",
    top: sA.winner ? team(sA.winner, "sA") : undefined,
    bottom: sB.winner ? team(sB.winner, "sB") : undefined,
    feeds: "promoted", yours: false, next: false };
  const fin = state.final;
  const finTie: PlayOffTieState | undefined = fin && fin.hs !== undefined && fin.as !== undefined && fin.winner
    ? { home: fin.home, away: fin.away, legs: [{ hs: fin.hs, as: fin.as }], winner: fin.winner } : undefined;
  fill(f, finTie, 1);
  if (current === 3 && f.top && f.bottom && !finTie) f.note = "end of season";
  ties.push(f);

  // Which rounds just finished: the one before your next match, or — when
  // your run is over — everything from the round you went out in.
  let revealFrom = current - 1;
  if (current === 3) {
    const mine = ties.filter(t => t.top?.club === you || t.bottom?.club === you);
    revealFrom = mine.length ? Math.max(...mine.map(t => t.stage)) : 2;
  }
  const lowest = six ? 0 : 1;
  revealFrom = Math.max(lowest, revealFrom);
  const revealTo = Math.min(2, current - 1);
  return {
    format: six ? "six" : "four",
    ties,
    promoted: current === 3 ? state.promoted : undefined,
    current,
    revealFrom,
    revealTo,
  };
}
