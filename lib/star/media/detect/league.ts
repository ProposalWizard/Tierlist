import { ev } from "./kit";
import type { FootballEvent, Subject, Tag } from "../types";
import type { LeagueResult } from "../../types";

/**
 * THE REST OF THE DIVISION.
 *
 * Every other detector in this folder reads a match YOU played, or a moment
 * that happened to YOU. This is the one exception: `playLeagueWeek`
 * (../../season.ts) already simulates every other fixture in the division
 * each week, complete with named scorers off each club's real roster — that
 * data just never went anywhere before this. Requested directly: an
 * "England" tab that shows real news about other clubs and other players,
 * not just yours.
 *
 * Deliberately narrow. This does not try to be a second, parallel media
 * engine — it produces the same handful of event ids `detect/result.ts`
 * and `detect/goals.ts` already produce for your own match ("win", "rout",
 * "hat-trick", …), with the same fact shape those already write, aimed at a
 * different club. That is what lets the existing "club" and "league"
 * archetype templates (already club-name-generic — a club account's own
 * "FULL TIME | {homeClub} {hs}-{as} {awayClub}" has never actually said
 * "you") cover another club's afternoon for free, with no new templates and
 * no new accounts, once `select.ts`'s `allegiance()` knows to let a club's
 * own account speak for itself and to keep everyone else's fans out of it.
 *
 * No table-position drama (went-top, champions, relegated) and no chants —
 * those stay exactly as narrow as they already were (your own club, your
 * own supporters) rather than growing twenty clubs' worth of new accounts.
 * A real result and a real hat-trick elsewhere is already the thing that
 * was asked for.
 */

function clubSubject(name: string): Subject {
  return { kind: "club", name };
}

/** One side's own afternoon, in the same vocabulary (`win`/`rout`/`draw`/
 *  `loss`/`hammered`) and the same importance formula `detect/result.ts`
 *  already uses for yours — see that file's FULL_TIME/ROUT/HAMMERED. */
function sideResultEvent(
  club: string, opponent: string, us: number, them: number, home: boolean,
  competition: string, season: number, week: number,
): FootballEvent {
  const diff = us - them;
  let id: string;
  let importance: number;
  let tags: Tag[];
  if (diff === 0) {
    id = "draw"; importance = 22; tags = ["table"];
  } else if (diff > 0) {
    if (diff >= 3) { id = "rout"; importance = 54 + diff * 4; tags = ["table", "drama"]; }
    else { id = "win"; importance = 34; tags = ["table"]; }
  } else {
    const margin = -diff;
    if (margin >= 3) { id = "hammered"; importance = 50 + margin * 5; tags = ["shame", "drama"]; }
    else { id = "loss"; importance = 26; tags = ["table"]; }
  }
  return ev(id, clubSubject(club), importance, tags, {
    club, opponent, competition, season, week,
    us, them, score: `${us}-${them}`,
    result: diff === 0 ? "draw" : diff > 0 ? "win" : "loss",
    home, venue: home ? "at home" : "away",
    homeClub: home ? club : opponent,
    awayClub: home ? opponent : club,
    hs: home ? us : them,
    as: home ? them : us,
    margin: Math.abs(diff),
  }, "instant");
}

/** Any scorer who got two or more in this one match, named exactly — the
 *  same `brace`/`hat-trick`/`four-goals`/`five-goals` ids and importance
 *  `detect/goals.ts`'s HAUL uses for yours, aimed at whichever real player
 *  actually scored them this week. A brace (n===2) used to be silently
 *  dropped here (the loop only fired at n>=3) — reported directly, with a
 *  real example (Cole Palmer's brace in a Chelsea win) that this detector
 *  simply never covered. */
function hatTrickEvents(
  club: string, opponent: string,
  goals: LeagueResult["hg"] | undefined, home: boolean,
  competition: string, season: number, week: number,
): FootballEvent[] {
  if (!goals?.length) return [];
  const counts = new Map<string, { n: number; short: string; role?: string }>();
  for (const g of goals) {
    if (!g.full) continue;
    const cur = counts.get(g.full) ?? { n: 0, short: g.s, role: g.role };
    cur.n += 1;
    counts.set(g.full, cur);
  }
  const out: FootballEvent[] = [];
  for (const [full, { n, short, role }] of Array.from(counts)) {
    if (n < 2) continue;
    const id = n >= 5 ? "five-goals" : n === 4 ? "four-goals" : n === 3 ? "hat-trick" : "brace";
    const importance = n >= 5 ? 96 : n === 4 ? 88 : n === 3 ? 76 : 52;
    out.push(ev(id, clubSubject(club), importance, ["goal", n >= 3 ? "record" : "goal"], {
      club, opponent, competition, season, week, home,
      player: full, short, goals: n,
      ...(role ? { role } : {}),
    }, "instant"));
  }
  return out;
}

/**
 * The goal that actually decided it, named — mirroring `detect/goals.ts`'s
 * EQUALISER/WINNER for your own match. `LeagueResult.hg`/`.ag` carry a
 * minute per goal but no running score, so it is reconstructed here by
 * walking every goal (both sides, chronologically) the same way
 * `isWinner`/`isEqualiser` (detect/kit.ts) read it off `MatchRecord.goals`.
 * Requested directly: "Chelsea beat Man City 3-2 away, and Palmer scored
 * two goals including the winning goal… I'd expect to see praise for that"
 * — this is what makes a decisive goal, not just a brace, show up.
 */
function decisiveGoalEvents(
  home: string, away: string,
  hg: LeagueResult["hg"], ag: LeagueResult["ag"],
  hs: number, as: number,
  competition: string, season: number, week: number,
): FootballEvent[] {
  if (hs === as) return decisiveDrawEvent(home, away, hg, ag, competition, season, week);
  if (!hg?.length && !ag?.length) return [];
  const winnerIsHome = hs > as;
  const winnerClub = winnerIsHome ? home : away;
  const opponent = winnerIsHome ? away : home;
  const winnerGoals = (winnerIsHome ? hg : ag) ?? [];
  const loserFinal = winnerIsHome ? as : hs;
  const sorted = [...winnerGoals].sort((a, b) => a.m - b.m);
  // The goal that put the eventual winner exactly `loserFinal + 1` ahead —
  // the last lead the loser never overturned. If several goals happen to
  // tie that (shouldn't, since scores only go up), the latest one wins.
  let running = 0;
  let decider: (typeof sorted)[number] | undefined;
  for (const g of sorted) {
    running += 1;
    if (running === loserFinal + 1) decider = g;
  }
  if (!decider?.full) return [];
  const late = decider.m >= 85;
  return [ev(late ? "late-winner" : "winner", clubSubject(winnerClub), late ? 86 : 58,
    late ? ["goal", "drama"] : ["goal"], {
      club: winnerClub, opponent, competition, season, week,
      player: decider.full, short: decider.s, minute: decider.m,
      ...(decider.role ? { role: decider.role } : {}),
    }, "instant")];
}

/** A drawn match's equalising goal — the last goal that made it level,
 *  named exactly, same as `detect/goals.ts`'s EQUALISER. */
function decisiveDrawEvent(
  home: string, away: string,
  hg: LeagueResult["hg"], ag: LeagueResult["ag"],
  competition: string, season: number, week: number,
): FootballEvent[] {
  const merged = [
    ...(hg ?? []).map(g => ({ ...g, side: "home" as const })),
    ...(ag ?? []).map(g => ({ ...g, side: "away" as const })),
  ].sort((a, b) => a.m - b.m);
  if (!merged.length) return [];
  let homeScore = 0, awayScore = 0;
  let lastEqualiser: (typeof merged)[number] | undefined;
  for (const g of merged) {
    if (g.side === "home") homeScore += 1; else awayScore += 1;
    if (homeScore === awayScore && homeScore > 0) lastEqualiser = g;
  }
  if (!lastEqualiser?.full) return [];
  const club = lastEqualiser.side === "home" ? home : away;
  const opponent = lastEqualiser.side === "home" ? away : home;
  const late = lastEqualiser.m >= 80;
  return [ev("equaliser", clubSubject(club), late ? 62 : 44, late ? ["goal", "drama"] : ["goal"], {
    club, opponent, competition, season, week,
    player: lastEqualiser.full, short: lastEqualiser.s, minute: lastEqualiser.m,
    ...(lastEqualiser.role ? { role: lastEqualiser.role } : {}),
  }, "instant")];
}

/**
 * This week's news from everyone else.
 *
 * `results` is the WHOLE division's week — the same `career.results` the
 * fixtures/table screens already read — and `excludeClub` is your own:
 * your match already went through the real match-day pipeline
 * (`generateForMatch`), so it is skipped here rather than covered twice.
 */
export function detectLeagueWeek(
  results: LeagueResult[],
  excludeClub: string,
  week: number,
  competition: string,
  season: number,
): FootballEvent[] {
  const out: FootballEvent[] = [];
  for (const r of results) {
    if (r.week !== week) continue;
    if (r.home === excludeClub || r.away === excludeClub) continue;

    out.push(sideResultEvent(r.home, r.away, r.hs, r.as, true, competition, season, week));
    out.push(sideResultEvent(r.away, r.home, r.as, r.hs, false, competition, season, week));
    out.push(...hatTrickEvents(r.home, r.away, r.hg, true, competition, season, week));
    out.push(...hatTrickEvents(r.away, r.home, r.ag, false, competition, season, week));
    out.push(...decisiveGoalEvents(r.home, r.away, r.hg, r.ag, r.hs, r.as, competition, season, week));
  }
  return out;
}
