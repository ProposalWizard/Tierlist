import type { SeasonWinners } from "./careerFlow";
import type { CareerState } from "./types";
import { poolFor } from "./euro";
import { seasonQualifiers } from "./competitions";
import { ruleBookFor } from "./ruleBook";
import { calendarMonthOf, divisionOf } from "./calendar";
import { getTuning } from "./tuningStore";

/**
 * THE CASINO'S BOOK — BETTING ON WHO WINS THE ACTUAL COMPETITIONS.
 *
 * Requested directly: "you could bet on the winner of any competition, and
 * it would provide good odds as well based upon the team ratings for each
 * team." Not an invented mini-game — the same five competitions
 * `resolveSeasonWinners` (careerFlow.ts) already resolves every season,
 * using the same real club strengths the league table and the European
 * pools already carry. This file is the odds and the settlement; nothing
 * here decides who actually wins anything — that stays entirely
 * `resolveSeasonWinners`'s job, so a bet always settles against the exact
 * same result the trophy cabinet and the Ballon d'Or race already agree on.
 *
 * Pure, no React, no CareerState mutation — same split every other engine
 * module in this codebase keeps (dribble.ts, leagueTransfers.ts): the caller
 * reads/writes `career.competitionBets`/`career.money`, this only computes.
 */

/**
 * Betting is only open early in the season — reported directly: without a
 * cutoff, a bet placed on the last day of the season (once the title is
 * already effectively decided) is a free win, not a real bet. Gated on the
 * summer transfer window closing rather than a fixed matchweek count,
 * matching the same real calendar boundary `careerFlow.ts`'s own deadline-
 * day event fires on — `transferWindowFor` treats August and September as
 * "summer," closing the moment October arrives (see calendar.ts's own
 * note), so this closes betting at exactly that same boundary. Read
 * straight off the live calendar rather than `career.lastTransferWindowKey`
 * because season 1's own summer window is deliberately never run at all
 * (the hand-curated starting rosters aren't immediately overwritten — see
 * `runDueTransferWindow`'s own note), which would otherwise leave season 1
 * with no real "window closed" signal to key off.
 */
export function canPlaceCompetitionBet(career: CareerState): boolean {
  const month = calendarMonthOf(career.player.startYear, career.season, career.week, divisionOf(career));
  return month < 7; // before August
}

export type BetCompetition = "league" | "faCup" | "leagueCup" | "championsLeague" | "europaLeague";

export const BET_COMPETITIONS: { id: BetCompetition; label: string }[] = [
  { id: "league", label: "League Title" },
  { id: "faCup", label: "FA Cup" },
  { id: "leagueCup", label: "League Cup" },
  { id: "championsLeague", label: "Champions League" },
  { id: "europaLeague", label: "Europa League" },
];

export interface CompetitionBet {
  id: string;
  competition: BetCompetition;
  club: string;
  /** Decimal odds at the moment the bet was placed — locked in, not
   *  recomputed at settlement, exactly like a real bookmaker's price. */
  odds: number;
  stake: number;
  /** The season the bet was placed in. Settles at THAT season's rollover —
   *  the moment `resolveSeasonWinners` establishes a real, final result. */
  season: number;
}

export interface BetEntrant {
  name: string;
  odds: number;
}

/** Never a price so short it stops feeling like a bet, however dominant a
 *  favourite the strength gap makes them. */
const MIN_ODDS = 1.15;

/**
 * Strength → win-weight, the same SHAPE (and, for the two European
 * competitions, close to the same numbers) `crownEurope`/`crownWithoutYou`
 * already use in euro.ts to decide who actually lifts a trophy you didn't
 * contest — so the price on offer reflects the same model of "how likely is
 * this club to win the whole thing" the game itself resolves by. A flat
 * strength difference matters much more at the top of a field (a 92-rated
 * side is a real favourite) than at the bottom (a 55 and a 60 are both
 * miles off winning anything), which is what the exponent buys over a
 * straight linear weighting.
 *
 * Reported directly, with real numbers: a genuinely huge gap between the
 * best and worst squad in the division (this game's own strengths run
 * roughly 55-90) was barely showing up in the odds — a runaway favourite
 * priced around 10/1 next to a relegation-bound no-hoper at 35/1, when a
 * real division with that big a talent gap prices its favourite at 2-4/1
 * and its rank outsider in the hundreds or thousands (Leicester City's
 * real 5000/1 title win is the extreme end of exactly this). The exponent
 * and the overround/cap below are now real, tunable numbers
 * (`betting.*` in tuning.ts) rather than baked-in constants, precisely so
 * this can be recalibrated again without another code change if it still
 * reads wrong.
 */
function winWeight(strength: number): number {
  return Math.pow(Math.max(1, strength - getTuning("betting.strengthBaseline")), getTuning("betting.strengthExponent"));
}

/**
 * Turn a field of real clubs into a priced market.
 *
 * Duplicate names are folded together (a club appearing in both the pool and
 * the qualifier list, say) so the book is never longer than the actual
 * number of contenders.
 */
export function oddsFor(entrants: { name: string; strength: number }[]): BetEntrant[] {
  const maxOdds = getTuning("betting.maxOdds");
  const overround = getTuning("betting.overround");
  const byName = new Map<string, number>();
  for (const e of entrants) {
    const prev = byName.get(e.name);
    if (prev === undefined || e.strength > prev) byName.set(e.name, e.strength);
  }
  const weights = Array.from(byName.entries()).map(([name, strength]) => ({ name, weight: winWeight(strength) }));
  const total = weights.reduce((s, w) => s + w.weight, 0) || 1;
  return weights
    .map(w => {
      const prob = w.weight / total;
      const fair = prob > 0 ? 1 / prob : maxOdds;
      const priced = fair / overround;
      return { name: w.name, odds: Math.max(MIN_ODDS, Math.min(maxOdds, Math.round(priced * 10) / 10)) };
    })
    .sort((a, b) => a.odds - b.odds);
}

/**
 * Who's actually in the field for a given market, right now, mid-season —
 * for pricing the book the moment the casino screen opens, not just for
 * settling it at the end.
 *
 * League/FA Cup/League Cup: the real division, all twenty clubs, off their
 * live table strengths — always known, whatever week it is.
 *
 * Champions/Europa League: if you're actually IN that competition this
 * season, its real 36-club field (`career.euroState.clubs`) — the exact
 * same clubs the knockout draw and the live table already use. Otherwise
 * nobody has told this career who else is in it this year (only YOUR club's
 * own European qualification is tracked from season to season, never the
 * other nineteen's), so it falls back to the same estimate
 * `resolveSeasonWinners`'s own `crownWithoutYou` call already leans on for
 * exactly this situation: this season's live table position via
 * `seasonQualifiers` (cup winners unknown mid-season, so passed as null —
 * a table-position-only read, same as every other live standing this
 * screen shows) combined with the competition's fixed foreign+English seed
 * pool (`poolFor`, euro.ts) — the same two ingredients `crownWithoutYou`
 * itself combines to pick a winner when you're not there to watch.
 */
export function entrantsFor(competition: BetCompetition, career: CareerState): { name: string; strength: number }[] {
  if (competition === "league" || competition === "faCup" || competition === "leagueCup") {
    return career.league.map(t => ({ name: t.name, strength: t.strength }));
  }
  const euroId = competition === "championsLeague" ? "Champions League" : "Europa League";
  if (career.euroState?.competition === euroId) {
    return career.euroState.clubs.map(c => ({ name: c.name, strength: c.strength }));
  }
  const strengthOf = (name: string) => career.league.find(t => t.name === name)?.strength ?? 75;
  const uefaRules = ruleBookFor(career, "UEFA");
  const qualifiers = seasonQualifiers(career.league, null, null, uefaRules.extraChampionsLeagueSlots, uefaRules.extraEuropaLeagueSlots);
  const domestic = (competition === "championsLeague" ? qualifiers.champions : qualifiers.europa)
    .map(name => ({ name, strength: strengthOf(name) }));
  const foreign = poolFor(euroId).map(c => ({ name: c.name, strength: c.strength }));
  return [...domestic, ...foreign];
}

export interface BetSettlement {
  bet: CompetitionBet;
  won: boolean;
  payout: number;
}

/**
 * Settle every bet placed in `season` against that season's real winners.
 *
 * A bet from an EARLIER season that somehow never settled (a save loaded
 * mid-way through a change, say) is left exactly alone rather than resolved
 * against a result from a different year — `advanceSeason` calls this once
 * per rollover with its own current `career.season`, so under normal play
 * every bet is placed and settled inside the same call's window and this
 * guard never has anything to do.
 */
export function settleBets(
  bets: CompetitionBet[],
  winners: SeasonWinners,
  season: number,
): { settled: BetSettlement[]; stillPending: CompetitionBet[]; totalPayout: number } {
  const settled: BetSettlement[] = [];
  const stillPending: CompetitionBet[] = [];
  let totalPayout = 0;
  for (const bet of bets) {
    if (bet.season !== season) { stillPending.push(bet); continue; }
    const winner = winners[bet.competition];
    const won = winner === bet.club;
    const payout = won ? Math.round(bet.stake * bet.odds) : 0;
    settled.push({ bet, won, payout });
    totalPayout += payout;
  }
  return { settled, stillPending, totalPayout };
}

/** One line per settled bet, for the same kind of end-of-season news feed
 *  `sponsorNews` already is (careerFlow.ts) — read once on the home screen,
 *  then cleared like any other season's news. */
export function betNewsLines(settlements: BetSettlement[]): string[] {
  return settlements.map(s => {
    const comp = BET_COMPETITIONS.find(c => c.id === s.bet.competition)?.label ?? s.bet.competition;
    return s.won
      ? `${comp}: ${s.bet.club} won! ★${s.bet.stake} @ ${s.bet.odds.toFixed(2)} → ★${s.payout}`
      : `${comp}: ${s.bet.club} didn't win it — ★${s.bet.stake} stake lost.`;
  });
}
