import type { CupState, CupTie } from "./cups";
import { tieWinner, roundNamesFor, cupStrength } from "./cups";
import type { CareerState, Fixture } from "./types";
import { shortClub } from "./media/grammar";
import type { EuroState } from "./euro";
import { koAggregate, type KoTie } from "./euroBracket";

/**
 * WHAT THE CUP AND EUROPEAN ROUND-UPS SHOW (Mikey, 8 Oct 2026: "something
 * similar to this for all cup competitions … results board every round").
 *
 * Two pictures, shared by the FA Cup, League Cup, Champions League and
 * Europa League:
 *   - a results board: every tie of the round just played, yours first;
 *   - from the last sixteen, a 16-club bracket, mirrored like a cup "Road to
 *     the Final" graphic.
 *
 * A result shows only once its round is behind you (the other ties are
 * played the same night as yours, even though the save already knows them).
 *
 * Domestic cups are redrawn from a hat every round, so their bracket is
 * drawn in hindsight: each round is laid out in the order of the round after
 * it, so the two ties that fed a tie sit next to each other.
 */

export interface BoardTie {
  home: string;
  away: string;
  /** Aggregate for a two-legged tie. Absent until it may be shown. */
  hs?: number;
  as?: number;
  /** Each leg, home/away of THIS tie's clubs (two-legged ties). */
  legs?: { hs: number; as: number }[];
  pens?: { hs: number; as: number };
  aet?: boolean;
  winner?: string;
  yours: boolean;
  /** The winner was clearly the weaker side. */
  upset?: boolean;
}

export interface VTie {
  top?: string;
  bottom?: string;
  topScore?: number;
  bottomScore?: number;
  /** "agg." / "aet" / "pens 4–3" / "1st leg 2–1". */
  note?: string;
  /** Which side won on penalties. */
  pensWinner?: "top" | "bottom";
  winner?: string;
  yours: boolean;
}

export interface BracketView {
  /** Round of 16 (8), quarter-finals (4), semi-finals (2), final (1). */
  rounds: VTie[][];
  champion?: string;
  /** The bracket round whose results pop and whose winners move on now
   *  (0 = round of 16); -1 = the round of 16's lower slots fill from the
   *  European play-off; null when nothing animates. */
  animate: number | null;
}

const BRACKET_ROUNDS = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"];

// ── Domestic cups ────────────────────────────────────────────────────────────

function boardFromCupTie(t: CupTie, you: string, str: (c: string) => number, show: boolean): BoardTie {
  const w = show ? tieWinner(t) ?? undefined : undefined;
  const out: BoardTie = { home: t.home, away: t.away, yours: t.home === you || t.away === you };
  if (show && t.hs !== undefined && t.as !== undefined) {
    out.hs = t.hs; out.as = t.as; out.winner = w;
    if (t.legs) out.legs = t.legs;
    if (t.pens) out.pens = { hs: t.pens.home, as: t.pens.away };
    if (t.wentToExtraTime) out.aet = true;
    if (w) { const l = w === t.home ? t.away : t.home; out.upset = str(w) <= str(l) - 8; }
  }
  return out;
}

/** The results board for one cup round (yours first). */
export function cupBoard(state: CupState, roundIndex: number, you: string, str: (c: string) => number): BoardTie[] {
  const r = state.rounds[roundIndex];
  if (!r) return [];
  const rows = r.ties.map(t => boardFromCupTie(t, you, str, true));
  return [...rows.filter(x => x.yours), ...rows.filter(x => !x.yours)];
}

function cupNote(t: CupTie): { note?: string; pensWinner?: "home" | "away" } {
  if (t.pens) return { note: `pens ${t.pens.home}–${t.pens.away}`, pensWinner: t.pens.home > t.pens.away ? "home" : "away" };
  if (t.legs && t.legs.length > 1) return { note: "agg." };
  if (t.wentToExtraTime) return { note: "aet" };
  return {};
}

/**
 * The cup's bracket from the last sixteen, with `roundIndex` (in the cup's
 * own rounds) the round just played. Null before the last sixteen.
 */
export function cupBracket(state: CupState, roundIndex: number, you: string): BracketView | null {
  const names = roundNamesFor(state.competition);
  const r16 = names.indexOf("Round of 16");
  if (r16 < 0 || roundIndex < r16 || !state.rounds[r16]) return null;

  // Lay each round out in the order of the round after it.
  const drawn = state.rounds.slice(r16);
  const ordered: CupTie[][] = drawn.map(r => [...r.ties]);
  for (let i = ordered.length - 2; i >= 0; i--) {
    const next = ordered[i + 1];
    const pool = [...ordered[i]];
    const out: CupTie[] = [];
    for (const nt of next) {
      for (const club of [nt.home, nt.away]) {
        const k = pool.findIndex(t => tieWinner(t) === club);
        if (k >= 0) out.push(pool.splice(k, 1)[0]);
      }
    }
    ordered[i] = [...out, ...pool];
  }

  const done = roundIndex - r16; // bracket rounds 0..done have results
  const rounds: VTie[][] = BRACKET_ROUNDS.map((_, bi) => {
    const size = 8 >> bi;
    const ties = ordered[bi] ?? [];
    return Array.from({ length: size }, (_, j) => {
      const t = ties[j];
      const v: VTie = { yours: false };
      // Who is in it: drawn ties are known once their feeding round is done
      // (or always, for the round of 16).
      if (t && (bi === 0 || bi - 1 <= done)) {
        v.top = t.home; v.bottom = t.away;
        v.yours = t.home === you || t.away === you;
        if (bi <= done && t.hs !== undefined) {
          v.topScore = t.hs; v.bottomScore = t.as;
          v.winner = tieWinner(t) ?? undefined;
          const n = cupNote(t);
          v.note = n.note;
          if (n.pensWinner) v.pensWinner = n.pensWinner === "home" ? "top" : "bottom";
        }
      }
      return v;
    });
  });
  const champion = done >= 3 ? state.winner : undefined;
  return { rounds, champion, animate: done >= 0 ? done : null };
}

// ── Europe ───────────────────────────────────────────────────────────────────

function koNote(t: KoTie): { note?: string; pensA?: boolean } {
  if (t.pens) return { note: `pens ${t.pens.a}–${t.pens.b}`, pensA: t.pens.a > t.pens.b };
  if (t.et) return { note: t.legs.length > 1 ? "agg. aet" : "aet" };
  if (t.legs.length > 1) return { note: "agg." };
  return {};
}

/** The bracket round (0 = play-off) your last finished tie was in; -1 for none. */
export function euroDoneRound(state: EuroState, you: string): number {
  let done = -1;
  state.bracket?.rounds.forEach((r, i) => {
    if (r.ties.some(t => t.winner && (t.a === you || t.b === you))) done = i;
  });
  return done;
}

/** Results board for a European knockout round (bracket index; 0 = play-off). */
export function euroBoard(state: EuroState, round: number, you: string, show: boolean): BoardTie[] {
  const r = state.bracket?.rounds[round];
  if (!r) return [];
  const str = new Map(state.clubs.map(c => [c.name, c.strength]));
  const rows = r.ties.filter(t => t.a && t.b).map(t => {
    // Shown the way the second leg was played: the better finisher at home.
    const out: BoardTie = { home: t.a!, away: t.b!, yours: t.a === you || t.b === you };
    if (show && t.winner) {
      const agg = koAggregate(t)!;
      out.hs = agg.a; out.as = agg.b; out.winner = t.winner;
      if (t.legs.length > 1) out.legs = t.legs.map(l => ({ hs: l.a, as: l.b }));
      if (t.pens) out.pens = { hs: t.pens.a, as: t.pens.b };
      if (t.et) out.aet = true;
      const l = t.winner === t.a ? t.b! : t.a!;
      out.upset = (str.get(t.winner) ?? 75) <= (str.get(l) ?? 75) - 8;
    }
    return out;
  });
  return [...rows.filter(x => x.yours), ...rows.filter(x => !x.yours)];
}

/**
 * The European bracket from the round of 16. `done` is the last bracket
 * round (0 = play-off) whose results may show.
 */
export function euroBracketView(state: EuroState, you: string, done: number): BracketView | null {
  const br = state.bracket;
  if (!br) return null;
  const rounds: VTie[][] = [1, 2, 3, 4].map((ri, bi) => {
    const r = br.rounds[ri];
    const prev = br.rounds[ri - 1];
    return r.ties.map((t, j) => {
      const v: VTie = { yours: false };
      // Slots in bracket order: R16 = seed on top, play-off winner below;
      // later rounds = winner of feeder 2j on top, 2j+1 below.
      let top: string | undefined, bottom: string | undefined;
      if (ri === 1) { top = br.seeds[j]; bottom = done >= 0 ? prev.ties[j]?.winner : undefined; }
      else if (ri - 1 <= done) { top = prev.ties[2 * j]?.winner; bottom = prev.ties[2 * j + 1]?.winner; }
      v.top = top; v.bottom = bottom;
      v.yours = top === you || bottom === you;
      if (ri <= done && t.winner && top && bottom) {
        const agg = koAggregate(t)!;
        const topIsA = t.a === top;
        v.topScore = topIsA ? agg.a : agg.b;
        v.bottomScore = topIsA ? agg.b : agg.a;
        v.winner = t.winner;
        const n = koNote(t);
        v.note = n.note;
        if (n.pensA !== undefined) v.pensWinner = (n.pensA === topIsA) ? "top" : "bottom";
      }
      return v;
    });
  });
  // -1: the play-off winners arrive into the round of 16.
  return { rounds, champion: done >= 4 ? br.winner : undefined, animate: done >= 1 ? done - 1 : done === 0 ? -1 : null };
}

export const EURO_ROUND_LABEL: Record<string, string> = {
  "Round of 32": "Knockout play-off",
  "Round of 16": "Round of 16",
  "Quarter-Final": "Quarter-finals",
  "Semi-Final": "Semi-finals",
  Final: "Final",
};

// ── What to show after a match ───────────────────────────────────────────────

export type RoundupStage =
  | { kind: "table"; title: string; rows: { name: string; pts: number; gd: number; yours: boolean }[] }
  | { kind: "board"; title: string; ties: BoardTie[] }
  | { kind: "bracket"; title: string; view: BracketView };

export interface Roundup {
  /** Shown once: "season:competition:round". */
  key: string;
  competition: string;
  stages: RoundupStage[];
  nextLine: string;
}

function nextLineFor(next: Fixture | undefined, label: (r: string) => string): string | null {
  if (!next) return null;
  const where = next.home ? "home to" : "away at";
  return `${label(next.round ?? "")}${next.leg === 1 ? " · 1st leg" : next.leg === 2 ? " · 2nd leg" : ""} · ${where} ${shortClub(next.opponent)}`;
}

/**
 * The round-up after this knockout fixture, or null: after every FA Cup /
 * League Cup tie you finish (not a first leg), after the Champions/Europa
 * League league phase ends, and after each European knockout tie you finish.
 */
export function knockoutRoundupFor(c: CareerState, f: Fixture): Roundup | null {
  const you = c.player.club;
  if (f.kind === "cup" && (f.competition === "FA Cup" || f.competition === "League Cup")) {
    if (f.leg === 1) return null;
    const st = c.cupState?.find(x => x.competition === f.competition);
    if (!st) return null;
    let k = -1;
    st.rounds.forEach((r, i) => {
      const t = r.ties.find(x => x.home === you || x.away === you);
      if (t && t.hs !== undefined) k = i;
    });
    if (k < 0) return null;
    const stages: RoundupStage[] = [
      { kind: "board", title: st.rounds[k].name, ties: cupBoard(st, k, you, (x) => cupStrength(x, c.league)) },
    ];
    const br = cupBracket(st, k, you);
    if (br) stages.push({ kind: "bracket", title: "Road to the Final", view: br });
    const next = c.fixtures.find(x => !x.played && x.kind === "cup" && x.competition === f.competition);
    const nextLine = st.winner === you ? "Winners!" : nextLineFor(next, r => r) ?? `Out of the ${f.competition}`;
    return { key: `${c.season}:${f.competition}:${k}`, competition: f.competition, stages, nextLine };
  }

  const es = c.euroState;
  if (f.kind === "europe" && es && es.bracket && f.competition === es.competition) {
    const done = euroDoneRound(es, you);
    const next = c.fixtures.find(x => !x.played && x.kind === "europe" && x.competition === es.competition);
    const nextLine = es.won ? "Winners!"
      : nextLineFor(next, r => EURO_ROUND_LABEL[r] ?? r) ?? (es.eliminated ? `Out of the ${es.competition}` : "");
    if (done === -1) {
      if (!es.table) return null;
      const stages: RoundupStage[] = [{
        kind: "table", title: "League phase",
        rows: es.table.map(r => ({ name: r.name, pts: r.points, gd: r.goalsFor - r.goalsAgainst, yours: r.isYou })),
      }];
      if ((es.position ?? 99) <= 24) {
        stages.push({ kind: "board", title: "Knockout play-off", ties: euroBoard(es, 0, you, false) });
        const v = euroBracketView(es, you, -1);
        if (v) stages.push({ kind: "bracket", title: "Road to the Final", view: v });
      }
      return { key: `${c.season}:${es.competition}:phase`, competition: es.competition, stages, nextLine };
    }
    const name = es.bracket.rounds[done].name;
    const stages: RoundupStage[] = [{ kind: "board", title: EURO_ROUND_LABEL[name] ?? name, ties: euroBoard(es, done, you, true) }];
    const v = euroBracketView(es, you, done);
    if (v) stages.push({ kind: "bracket", title: "Road to the Final", view: v });
    return { key: `${c.season}:${es.competition}:${done}`, competition: es.competition, stages, nextLine };
  }
  return null;
}
