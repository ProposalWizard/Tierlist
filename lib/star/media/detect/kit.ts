import type { Facts, FootballEvent, MatchRecord, Subject, Tag, Window } from "../types";

/**
 * The shorthand every detector is written in.
 *
 * A detector should be four lines: ask a question about the record, and if the
 * answer is yes, describe what happened as facts and tags. It must never write a
 * sentence, never pick an account and never decide how loud it is — those are
 * three later stages, and a detector that reaches into them is a detector that
 * cannot be reused by the eleven accounts that see the same event differently.
 */
export function ev(
  id: string,
  subject: Subject,
  baseImportance: number,
  tags: Tag[],
  facts: Facts,
  window: Window = "instant",
  threadKey?: string,
): FootballEvent {
  return { id, subject, baseImportance, tags, facts, window, threadKey };
}

export function you(r: MatchRecord): Subject {
  return { kind: "you", name: r.you.name };
}

export function club(r: MatchRecord): Subject {
  return { kind: "club", name: r.club };
}

/** Facts every post about a match can reach for without the detector listing them. */
export function base(r: MatchRecord): Facts {
  return {
    player: r.you.name,
    short: r.you.shortName,
    club: r.club,
    opponent: r.opponent,
    competition: r.competition,
    // Genuinely ABSENT when there is none — not an empty string. `requires`
    // (templates/index.ts's `has`) treats an empty string the same as a
    // missing key, but `excludes` only checks `!== undefined`, so a key that
    // exists but is empty reads as "present" there. Setting it to "" made
    // BOTH the named templates (`requires: ["derbyName"]`) and their generic
    // fallback (`excludes: ["derbyName"]`) refuse to fire whenever there was
    // no real name, and a derby with no rated name — most of them — lost its
    // coverage entirely rather than falling back to the plain "the derby"
    // line. Caught by a 0-in-300 statistical check, not a crash: the event
    // still detected, it simply had nowhere left to go.
    ...(r.derbyName ? { derbyName: r.derbyName } : {}),
    ...(r.rivalryTier ? { rivalryTier: r.rivalryTier } : {}),
    us: r.score.us,
    them: r.score.them,
    score: `${r.score.us}-${r.score.them}`,
    result: r.result,
    home: r.home,
    venue: r.home ? "at home" : "away",
    // ── The same match, written the way a scoreline is written ──
    //
    // `us`/`them` are yours-first, which is right for a sentence about you
    // ("we won 3-0") and wrong for a result line, where football always puts
    // the home side first. A template using {club} {us}-{them} {opponent}
    // reported an away win as "AFC Bournemouth 3-0 West Ham United" while the
    // scoreline graphic directly beneath it — which does read the venue —
    // correctly said "West Ham United 0-3 AFC Bournemouth". Reported as
    // exactly that disagreement.
    homeClub: r.home ? r.club : r.opponent,
    awayClub: r.home ? r.opponent : r.club,
    hs: r.home ? r.score.us : r.score.them,
    as: r.home ? r.score.them : r.score.us,
    rating: r.you.rating.toFixed(1),
    number: r.you.squadNumber,
    // `role` and not `position`: the table detectors use `position` for where
    // the CLUB sits, and one of the two was silently overwriting the other.
    // "Arsenal — NaNth, 43 points" is what a name collision looks like.
    role: r.you.position,
    season: r.season,
    week: r.week,
    manager: r.context.managerName,
    // Running totals and the table, so a template can reach for context without
    // its detector having to remember to pass it. A missing slot is a hole in a
    // sentence, and the cheapest way to never have one is for the common facts
    // to always be there.
    seasonTotal: r.you.seasonGoals,
    seasonAssistTotal: r.you.seasonAssists,
    careerTotal: r.you.careerGoals,
    apps: r.you.careerAppearances,
    points: r.table.after.points,
    left: r.table.matchesLeft,
  };
}

export const userGoals = (r: MatchRecord) => r.goals.filter(g => g.isUser);

/** Was it the goal that won the match? Needs the reconstructed running score. */
export function isWinner(r: MatchRecord, g: { scoreAfter?: { us: number; them: number } }): boolean {
  if (r.result !== "win" || !g.scoreAfter) return false;
  // The goal that put you in front for the last time.
  return g.scoreAfter.us === r.score.them + 1;
}

export function isEqualiser(g: { scoreAfter?: { us: number; them: number } }): boolean {
  return !!g.scoreAfter && g.scoreAfter.us === g.scoreAfter.them && g.scoreAfter.us > 0;
}
