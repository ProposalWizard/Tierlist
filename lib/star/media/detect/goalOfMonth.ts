/**
 * GOAL OF THE MONTH — the pure part (Leo, 22 Oct 2026, plan part 10, option B:
 * "yours against 2 goals from other players in the league … it can be lost,
 * so winning means something").
 *
 * Nothing here reads the career. It is handed goals, results and numbers and
 * hands back entries, votes and a winner, so every rule is testable on its own
 * (tests/star/goalOfMonth.mts). The glue that reads the career and writes the
 * posts is ../goalOfMonth.ts.
 *
 * THE RULES
 * - "Best" = hardest. A goal's quality (0-100) is its kind (a penalty is
 *   easy, a free kick or a long shot is hard), plus distance (each yard past
 *   12 adds 1.5, up to +25; a close one loses up to 10), plus a chip (+10) or
 *   a curler (+8). The match does not record where in the goal it went or the
 *   chance's xG, so neither counts.
 * - Your best 3 of the month (fewer if you scored fewer; none, no poll).
 * - Against 2 by other players in your league that month: one per match, a
 *   long shot or a solo run, never your club's.
 * - Fans vote once, when the poll opens, seeded by season and month. Weight =
 *   (0.35 + quality/100)² × a wobble (0.75-1.25), and your goals × (1 + 0.8 ×
 *   fame/100). Your own tap adds 6% of the fans' total to your pick.
 */
import type { LeagueResult } from "../../types";
import type { SynthGoal, SynthKind } from "../../goalClip/synth";
import type { GotmEntry } from "../types";
import { rngFor } from "../grammar";

/** What a goal of yours needs to be judged. Matches GoalEvent's fields. */
export interface JudgedGoal {
  how?: string;
  distance?: number;
  finish?: "chip" | "curl";
}

const KIND_BASE: Record<string, number> = {
  penalty: 10, rebound: 25, corner: 35, cutback: 35, byline_cross: 35,
  through_ball: 40, midfield_pass: 40, buildup: 40, header: 45, one_on_one: 45,
  tight_angle: 60, volley: 65, solo: 70, long_range: 70, free_kick: 75,
};

/** How hard a goal was, 0-100. */
export function goalQuality(g: JudgedGoal): number {
  const base = KIND_BASE[g.how ?? ""] ?? 40;
  const d = typeof g.distance === "number" && isFinite(g.distance) ? g.distance : null;
  const far = d === null ? 0 : Math.max(-10, Math.min(25, (d - 12) * 1.5));
  const shape = g.finish === "chip" ? 10 : g.finish === "curl" ? 8 : 0;
  return Math.round(Math.max(0, Math.min(100, base + far + shape)));
}

const KIND_WORD: Record<string, string> = {
  penalty: "Penalty", rebound: "Rebound", corner: "From a corner", cutback: "Cut-back finish",
  byline_cross: "Finish from a cross", through_ball: "Through on goal", midfield_pass: "Finish",
  buildup: "Team move", header: "Header", one_on_one: "One-on-one", tight_angle: "Tight angle",
  volley: "Volley", solo: "Solo run", long_range: "Long shot", free_kick: "Free kick",
};

/** "25-yard curler v Spurs". Short, plain, one line. */
export function describeGoal(g: JudgedGoal, opponent: string): string {
  const d = typeof g.distance === "number" && g.distance >= 16 ? `${Math.round(g.distance)}-yard ` : "";
  const what = g.finish === "chip" ? "chip" : g.finish === "curl" ? "curler"
    : d ? (KIND_WORD[g.how ?? ""] ?? "strike").toLowerCase() : (KIND_WORD[g.how ?? ""] ?? "Finish");
  const text = `${d}${what}`;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} v ${opponent}`;
}

/** Which made-video move fits the goal, so a made one looks like what happened. */
export function synthKindFor(how?: string): SynthKind {
  if (how === "penalty") return "penalty";
  if (how === "header") return "header";
  if (how === "long_range" || how === "free_kick" || how === "volley") return "long_range";
  if (how === "solo" || how === "one_on_one" || how === "through_ball") return "run_in";
  return "tap_in";
}

/** Your best `n` by quality; the earlier goal wins a tie. */
export function bestOf<T extends { quality: number }>(goals: T[], n = 3): T[] {
  return goals.map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.quality - a.g.quality || a.i - b.i)
    .slice(0, n)
    .map(x => x.g);
}

/**
 * Two goals by other players in your league this month.
 *
 * Their matches were simulated (a score and scorers), so the goal itself is
 * made up: a long shot or a solo run, made into a video by goalClip/synth.ts
 * exactly like the England tab's other-match videos. Picked from different
 * matches, real names first (`full`), seeded so the same month always picks
 * the same two.
 */
export function pickRivalGoals(
  results: LeagueResult[],
  yourClub: string,
  inMonth: (week: number) => boolean,
  seed: string,
  competition: string,
  season: number,
  n = 2,
  shortName: (club: string) => string = c => c,
): GotmEntry[] {
  const rng = rngFor("gotm-rivals", seed);
  type Cand = { r: LeagueResult; g: NonNullable<LeagueResult["hg"]>[number]; home: boolean; roll: number };
  const cands: Cand[] = [];
  for (const r of results) {
    if (!inMonth(r.week) || r.home === yourClub || r.away === yourClub) continue;
    for (const [list, home] of [[r.hg, true], [r.ag, false]] as const) {
      for (const g of list ?? []) cands.push({ r, g, home, roll: rng() + (g.full ? 1 : 0) });
    }
  }
  cands.sort((a, b) => b.roll - a.roll);
  const out: GotmEntry[] = [];
  const usedMatch = new Set<string>();
  for (const c of cands) {
    if (out.length >= n) break;
    const key = `${c.r.week}-${c.r.home}-${c.r.away}`;
    if (usedMatch.has(key)) continue;
    usedMatch.add(key);
    const long = rng() < 0.5;
    const kind: SynthKind = long ? "long_range" : "run_in";
    const quality = Math.round(long ? 70 + rng() * 20 : 58 + rng() * 22);
    const club = c.home ? c.r.home : c.r.away;
    const opp = c.home ? c.r.away : c.r.home;
    // The score once it went in, counting goals in minute order.
    const all = [...(c.r.hg ?? []).map(g => ({ g, h: true })), ...(c.r.ag ?? []).map(g => ({ g, h: false }))]
      .sort((a, b) => a.g.m - b.g.m);
    let hs = 0, as = 0;
    for (const x of all) { if (x.h) hs++; else as++; if (x.g === c.g) break; }
    const yards = long ? 22 + Math.round(rng() * 10) : 0;
    const synth: GotmEntry["synth"] = {
      home: c.r.home, away: c.r.away, scorerHome: c.home,
      minute: c.g.m, scoreAfter: [hs, as], competition,
      seed: `g${season}.${c.r.week}.${c.g.m}${c.g.s}`,
      kind,
    };
    out.push({
      scorer: c.g.full ?? c.g.s,
      scorerShort: c.g.s,
      club,
      isYou: false,
      detail: long ? `${yards}-yard strike v ${shortName(opp)}` : `Solo run v ${shortName(opp)}`,
      quality,
      synth,
    });
  }
  return out;
}

/** How many fans vote: more the more famous you are. */
export function fanTotal(fame: number, seed: string): number {
  const rng = rngFor("gotm-total", seed);
  const f = Math.max(0, Math.min(100, fame));
  return Math.round((2000 + f * 300) * (0.9 + rng() * 0.2));
}

/** The fans' votes for each entry. Deterministic for a seed. */
export function fanVotes(entries: GotmEntry[], fame: number, seed: string): number[] {
  if (!entries.length) return [];
  const rng = rngFor("gotm-votes", seed);
  const f = Math.max(0, Math.min(100, fame)) / 100;
  const w = entries.map(e => {
    const q = 0.35 + Math.max(0, Math.min(100, e.quality)) / 100;
    const wobble = 0.75 + rng() * 0.5;
    return q * q * wobble * (e.isYou ? 1 + 0.8 * f : 1);
  });
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const total = fanTotal(fame, seed);
  return w.map(x => Math.round(total * x / sum));
}

/** What your one tap is worth: 6% of the fans' total. */
export function userWeightFor(fanVotesList: number[]): number {
  return Math.max(1, Math.round(fanVotesList.reduce((a, b) => a + b, 0) * 0.06));
}

/** The totals with your tap counted. */
export function tally(poll: { fanVotes: number[]; userVote?: number; userWeight: number }): number[] {
  return poll.fanVotes.map((v, i) => v + (poll.userVote === i ? poll.userWeight : 0));
}

/** The winning entry: most votes; the earlier entry wins a tie. */
export function winnerOf(poll: { fanVotes: number[]; userVote?: number; userWeight: number }): number {
  const t = tally(poll);
  let best = 0;
  for (let i = 1; i < t.length; i++) if (t[i] > t[best]) best = i;
  return best;
}

/** An entry's made video, whole (its names are kept once, on the entry). */
export function synthOf(e: GotmEntry): SynthGoal | undefined {
  return e.synth ? { ...e.synth, scorer: e.scorer, scorerShort: e.scorerShort } : undefined;
}

/** Fans points for winning it (relationships.fans, a 0-100 bar). */
export const GOTM_FANS_BOOST = 3;
