import type { CareerState } from "./types";
import { divisionOf, inLowerLeagueTrophy, type CareerDivision } from "./calendar";
import { membershipOf, estimateClubStrength } from "./promotion";
import { sortLeague } from "./season";
import { openCupWithByes, roundNamesFor, type CupState } from "./cups";

/**
 * THE LOWER LEAGUE TROPHY (Mikey asked, Harry answered, 20 Oct 2026).
 *
 * Who:   every club in League One, League Two, the National League and
 *        National League North and South this season — 24 each, 120 clubs.
 *        This season's ladder (career.divisions), not the starting lists:
 *        clubs move divisions every summer.
 * Draw:  a 128-place draw, straight knockout, a fresh draw every round (the
 *        same hat as the FA Cup and League Cup, lib/star/cups.ts).
 *        128 − 120 = 8 byes, to the top 8 of LAST season's League One still
 *        in it (the clubs promoted to the Championship have left, so it is
 *        the best 8 who stayed). First season: the 8 strongest League One
 *        clubs. Round 1 is the other 112: 56 ties.
 * Rounds: Round 1, Round of 64, 32, 16, quarter-final, semi-final, final.
 *        56 + 32 + 16 + 8 + 4 + 2 + 1 = 119 matches.
 * Level: before the quarter-finals, straight to penalties; from the
 *        quarter-finals on, extra time then penalties (shootout.ts
 *        hasExtraTime).
 * When:  midweek, Wednesdays clear of every league and FA Cup game for these
 *        clubs (calendar.ts LOWER_LEAGUE_TROPHY_WEEKENDS).
 * You:   you play it only when your club is in one of the five divisions.
 *        Otherwise it is played out round by round on the same dates and
 *        crowned at the season's end, like any cup you are out of.
 */

export const LOWER_LEAGUE_TROPHY = "Lower League Trophy" as const;

/** The draw's size: 128 places, so the field's shortfall is byes. */
export const LOWER_LEAGUE_TROPHY_DRAW = 128;

/**
 * The prize for winning it: a few weeks of your own wage. No other cup pays a
 * cash prize (the League Cup's money is only the match wage and bonuses), so
 * this is kept small on purpose: 2 weeks' wage. XP: 30,000, against the
 * League Cup's 108,000 (xpConfig.ts).
 */
export const LOWER_LEAGUE_TROPHY_PRIZE_WEEKS = 2;

/**
 * A good run catches the eye of clubs in these five divisions, and only
 * them (transferInterest.ts adds this to how much each of those clubs wants
 * you, on the same scale as a division: 1.0 = one division).
 *   reached the semi-final: +0.05
 *   won it:                 +0.1
 * Small on purpose: a gap in your position is worth +0.25 and one grade of
 * season (C → B) is worth 1.0.
 */
export const TROPHY_INTEREST_SEMI = 0.05;
export const TROPHY_INTEREST_WIN = 0.1;

const LOWER_KEYS = ["leagueOne", "leagueTwo", "nationalLeague", "nationalLeagueNorth", "nationalLeagueSouth"] as const;

/** Every club in the Trophy this season, League One first. */
export function lowerLeagueTrophyField(career: CareerState): string[] {
  const m = membershipOf(career);
  const own = divisionOf(career);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (c: string) => { if (!seen.has(c)) { seen.add(c); out.push(c); } };
  for (const key of LOWER_KEYS) for (const c of m[key]) add(c);
  // Your own club is in your own division's live table even when the stored
  // membership lags behind it (a custom club, an old save).
  if (inLowerLeagueTrophy(own)) for (const t of career.league) add(t.name);
  // Never a Premier League or Championship club, even if a list is stale.
  const higher = new Set([...m.premier, ...m.championship]);
  if (!inLowerLeagueTrophy(own)) for (const t of career.league) higher.add(t.name);
  return out.filter(c => !higher.has(c));
}

/**
 * League One, best first, for the season that has just ended: the real table
 * when you played in it, the clubs' strength otherwise (nobody else's table
 * is played out week by week). Call it on the career BEFORE the rollover.
 */
export function leagueOneOrder(career: CareerState): string[] {
  if (divisionOf(career) === "league_one") return sortLeague(career.league).map(t => t.name);
  return [...membershipOf(career).leagueOne]
    .sort((a, b) => estimateClubStrength(career, b) - estimateClubStrength(career, a));
}

/** The byes: the top of `order` still in the field, topped up by strength. */
export function lowerLeagueTrophyByes(career: CareerState, field: string[], order?: string[]): string[] {
  const count = Math.max(0, Math.min(field.length, LOWER_LEAGUE_TROPHY_DRAW - field.length));
  const inField = new Set(field);
  const byes: string[] = [];
  for (const c of order ?? leagueOneOrder(career)) {
    if (byes.length >= count) break;
    if (inField.has(c) && !byes.includes(c)) byes.push(c);
  }
  if (byes.length < count) {
    const rest = field.filter(c => !byes.includes(c))
      .sort((a, b) => estimateClubStrength(career, b) - estimateClubStrength(career, a));
    byes.push(...rest.slice(0, count - byes.length));
  }
  return byes;
}

/** Open this season's Trophy: the field, the byes, Round 1 drawn. */
export function openLowerLeagueTrophy(
  career: CareerState, rng: () => number, lastLeagueOneOrder?: string[],
): CupState {
  const field = lowerLeagueTrophyField(career);
  const byes = lowerLeagueTrophyByes(career, field, lastLeagueOneOrder);
  return openCupWithByes(LOWER_LEAGUE_TROPHY, field, byes, rng);
}

/** How far you went in this season's Trophy: "won", "semi" or null. */
export function lowerLeagueTrophyRun(career: CareerState): "won" | "semi" | null {
  const st = career.cupState?.find(s => s.competition === LOWER_LEAGUE_TROPHY);
  if (!st) return null;
  const club = career.player.club;
  const tied = !!career.cupTied && career.cupTied.season === career.season
    && career.cupTied.competitions.includes(LOWER_LEAGUE_TROPHY);
  if (tied) return null;
  if (st.winner === club) return "won";
  const names = roundNamesFor(st.competition);
  const semi = names.indexOf("Semi-Final");
  const reached = st.rounds.slice(semi).some(r => r.ties.some(t => t.home === club || t.away === club));
  return reached ? "semi" : null;
}

/** The interest bonus for clubs in `division` (0 outside the five). */
export function lowerLeagueTrophyInterest(career: CareerState, division: CareerDivision): number {
  if (!inLowerLeagueTrophy(division)) return 0;
  const run = lowerLeagueTrophyRun(career);
  return run === "won" ? TROPHY_INTEREST_WIN : run === "semi" ? TROPHY_INTEREST_SEMI : 0;
}

/** The cash prize for winning it, from your own wage. */
export function lowerLeagueTrophyPrize(career: CareerState): number {
  return Math.max(1, Math.round(career.contract.wage * LOWER_LEAGUE_TROPHY_PRIZE_WEEKS));
}
