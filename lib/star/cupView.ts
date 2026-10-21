import type { CareerState, Fixture } from "./types";
import { exitRound, yourEntryRound, cupRoundNames, lastSixteenIndex, tieWinner, type CupId, type CupState } from "./cups";
import { divisionOf, fixtureDateLabel } from "./calendar";
import { shortClub } from "./media/grammar";

/**
 * WHAT A DOMESTIC CUP'S OWN SCREEN SHOWS (components/star/CupScreen.tsx):
 * the FA Cup, the League Cup and the Lower League Trophy (Harry, 20 Oct
 * 2026: "the Lower League Trophy needs its own screen like Mikey's FA Cup
 * one"). Pure: reads the cup and the career, decides nothing.
 *
 *   - marks:  one per round of the cup, for the road along the top
 *             (won / bye / lost / now / played / drawn / future);
 *   - path:   your tie (or bye) in every round you were in;
 *   - left:   the clubs still in it;
 *   - bracketFrom: the round to hand to knockoutView's cupBracket, once the
 *             last sixteen is drawn.
 */

/** A round's name, short, for the road along the top. */
export const ROUND_SHORT: Record<string, string> = {
  "Round 1": "R1",
  // The ten-round FA Cup (Mikey, 19 Oct 2026).
  "Third Qualifying Round": "Q3",
  "Fourth Qualifying Round": "Q4",
  "First Round": "1R",
  "Second Round": "2R",
  "Third Round": "3R",
  "Fourth Round": "4R",
  "Fifth Round": "5R",
  "Round of 64": "R64",
  "Round of 32": "R32",
  "Round of 16": "R16",
  "Quarter-Final": "QF",
  "Semi-Final": "SF",
  Final: "F",
};

export function roundShort(name: string): string {
  return ROUND_SHORT[name] ?? name;
}

export type RoundMark =
  /** You won your tie. */ | "won"
  /** You went through without a game. */ | "bye"
  /** You went out here. */ | "lost"
  /** You are in it and it is not played yet. */ | "now"
  /** Played, without you. */ | "played"
  /** Drawn, not played, without you. */ | "drawn"
  /** Not drawn yet. */ | "future";

export interface PathStep {
  round: string;
  index: number;
  kind: "tie" | "bye";
  opponent?: string;
  /** You are the home side of the tie. */
  home?: boolean;
  /** Your goals and theirs (the aggregate for a two-legged tie). */
  you?: number;
  them?: number;
  pens?: { you: number; them: number };
  aet?: boolean;
  /** Two legs (the League Cup semi-final). */
  legs?: number;
  result: "won" | "lost" | null;
}

export interface CupView {
  competition: CupId;
  /** Every round the cup plays, in order. */
  names: string[];
  /** One per name. */
  marks: RoundMark[];
  path: PathStep[];
  /** Your club was drawn in it (a tie or a bye) at any point. */
  entered: boolean;
  /** Your club is in it but you played in it for another club this season. */
  tied: boolean;
  /** The round your club joins in, when it has not joined yet (the ten-round
   *  FA Cup: a Premier League club joins in the Third Round). */
  joins?: string;
  /** The round you went out in. */
  out: string | null;
  winner?: string;
  /** The clubs still in it (just the winner once it is won). */
  left: string[];
  /** The latest round drawn (an index into the cup's rounds). */
  current: number;
  /** The round index for cupBracket, or null before the last sixteen. */
  bracketFrom: number | null;
  /** Your next fixture in this cup, if one is on the calendar. */
  next?: Fixture;
}

export function cupViewFor(career: CareerState, state: CupState): CupView {
  const you = career.player.club;
  // This cup's own rounds (an old save's FA Cup keeps its six; the ten-round FA Cup
  // and the Lower League Trophy have theirs).
  const names = cupRoundNames(state);
  const tied = !!career.cupTied && career.cupTied.season === career.season
    && career.cupTied.competitions.includes(state.competition);

  const marks: RoundMark[] = names.map((_, i) => {
    const r = state.rounds[i];
    if (!r) return "future";
    const tie = r.ties.find(t => t.home === you || t.away === you);
    if (tie) {
      const w = tieWinner(tie);
      return w === you ? "won" : w ? "lost" : "now";
    }
    if (r.byes?.includes(you)) return "bye";
    return r.ties.length > 0 && r.ties.every(t => t.hs !== undefined) ? "played" : "drawn";
  });

  const path: PathStep[] = [];
  state.rounds.forEach((r, index) => {
    const tie = r.ties.find(t => t.home === you || t.away === you);
    if (tie) {
      const home = tie.home === you;
      const w = tieWinner(tie);
      const step: PathStep = {
        round: r.name, index, kind: "tie", opponent: home ? tie.away : tie.home, home,
        result: w === you ? "won" : w ? "lost" : null,
      };
      if (tie.hs !== undefined && tie.as !== undefined) {
        step.you = home ? tie.hs : tie.as;
        step.them = home ? tie.as : tie.hs;
        if (tie.pens) step.pens = { you: home ? tie.pens.home : tie.pens.away, them: home ? tie.pens.away : tie.pens.home };
        if (tie.wentToExtraTime) step.aet = true;
        if (tie.legs && tie.legs.length > 1) step.legs = tie.legs.length;
      }
      path.push(step);
    } else if (r.byes?.includes(you)) {
      path.push({ round: r.name, index, kind: "bye", result: "won" });
    }
  });

  const last = state.rounds[state.rounds.length - 1];
  const left: string[] = [];
  if (state.winner) left.push(state.winner);
  else if (last) {
    for (const t of last.ties) {
      const w = tieWinner(t);
      if (w) left.push(w); else left.push(t.home, t.away);
    }
    for (const b of last.byes ?? []) left.push(b);
  }

  // The round with sixteen clubs left: "Round of 16" in the League Cup, the Lower
  // League Trophy and the old FA Cup, the Fifth Round in the ten-round FA Cup.
  const r16 = lastSixteenIndex(state);
  let lastPlayed = -1;
  state.rounds.forEach((r, i) => { if (r.ties.length > 0 && r.ties.every(t => t.hs !== undefined)) lastPlayed = i; });
  const bracketFrom = r16 >= 0 && state.rounds.length > r16 ? Math.max(r16, lastPlayed) : null;

  const next = career.fixtures
    .filter(f => !f.played && f.kind === "cup" && f.competition === state.competition)
    .sort((a, b) => a.week - b.week)[0];

  return {
    competition: state.competition,
    names,
    marks,
    path,
    entered: path.length > 0,
    tied,
    ...(yourEntryRound(state, you) ? { joins: yourEntryRound(state, you)! } : {}),
    out: exitRound(state, you),
    winner: state.winner,
    left,
    current: Math.max(0, state.rounds.length - 1),
    bracketFrom,
    next,
  };
}

// ── What the top of the cup's screen says ───────────────────────────────────

export interface CupStatus {
  headline: string;
  sub: string;
  /** Gold for a win, grey once it is over for you, white otherwise. */
  tone: "gold" | "grey" | "white";
}

/** "2–1", "1–1 (4–3 pens)", "2–2 aet": your goals first. */
export function scoreText(s: PathStep): string {
  if (s.you === undefined || s.them === undefined) return "";
  return `${s.you}–${s.them}${s.pens ? ` (${s.pens.you}–${s.pens.them} pens)` : s.aet ? " aet" : ""}`;
}

/** The headline and the line under it: won, out, not in it, a bye, your next tie. */
export function cupStatus(view: CupView, career: CareerState): CupStatus {
  const you = career.player.club;
  const names = view.names;
  if (view.tied) return { headline: "Cup-tied", sub: "You played in it for another club this season.", tone: "grey" };
  if (view.winner && view.winner === you) return { headline: "Winners!", sub: `You won the ${view.competition}.`, tone: "gold" };
  if (!view.entered && view.joins) {
    return { headline: `Joins in the ${view.joins}`, sub: "The earlier rounds are played without you.", tone: "white" };
  }
  if (!view.entered) {
    return {
      headline: "Not in it",
      sub: view.competition === "Lower League Trophy"
        ? "League One down to the National League North and South."
        : "Your club isn't in it this season.",
      tone: "grey",
    };
  }
  const lost = view.path.find(s => s.result === "lost");
  if (view.out && lost) {
    return { headline: "Out", sub: `${lost.round}: lost ${scoreText(lost)} to ${shortClub(lost.opponent ?? "")}`, tone: "grey" };
  }
  const now = view.marks[view.current];
  const round = names[view.current] ?? "";
  if (now === "bye") return { headline: round, sub: `Through on a bye to the ${names[view.current + 1] ?? "next round"}`, tone: "white" };
  if (view.next) {
    const f = view.next;
    const date = fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, divisionOf(career));
    const leg = f.leg === 1 ? " · 1st leg" : f.leg === 2 ? " · 2nd leg" : "";
    return { headline: f.round ?? round, sub: `${date}${leg} · ${f.home ? "home to" : "away at"} ${shortClub(f.opponent)}`, tone: "white" };
  }
  return { headline: round, sub: "", tone: "white" };
}
