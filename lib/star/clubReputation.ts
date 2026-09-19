import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS,
  LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS, NATIONAL_LEAGUE_POOL_CLUBS,
} from "./clubs";
import { CLUB_DATABASE } from "./data/footballClubDatabase";
import type { CareerDivision } from "./calendar";

/**
 * HOW BIG A CLUB IS — PER CLUB, ACROSS ALL FIVE DIVISIONS.
 *
 * ── Why this file exists ──
 *
 * Until now there was no per-club reputation anywhere on the English
 * ladder below the Premier League. `scoutOffers.ts` carried ONE `strength`
 * per DIVISION (80/68/58/50/42) and every wage was `baseWage(division) ×
 * trialQuality`, so every club in a division was literally the same club
 * with a different badge: Wrexham offered exactly what Worthing offered,
 * and Leicester City offered exactly what Bromley offered.
 *
 * `investments.ts`'s `realPrestigeFactor` reads a genuine researched figure
 * (`CLUB_DATABASE.currentReputation`, footballClubDatabase.ts) — but that
 * dataset was built for the 125 clubs the game had at the time, and it
 * does not reach this problem:
 *
 *   - the Premier League is genuinely differentiated there (6-9);
 *   - the ENTIRE Championship is a flat 5 — Southampton, West Ham and
 *     Wrexham score the same as Lincoln City;
 *   - League One has five clubs in it, all 5, and League Two and the
 *     National League have none at all.
 *
 * Measured directly before writing a line of this (see the coverage sweep
 * in `tests/star/clubReputation.mts`), so the gap is a fact rather than an
 * assumption. This file is therefore a real table rather than a mapping of
 * an existing one: a 0-100 figure per club, hand-set from real-world
 * stature, for every club on all five rungs of the playable ladder plus
 * the holding pool below it.
 *
 * ── What the number means ──
 *
 * RAW real-world stature, judged across the whole game and NOT relative to
 * the division the club happens to be in this season. That is deliberate,
 * and it is why the bands below overlap: a relegated West Ham is genuinely
 * a bigger club than a promoted Bournemouth, and Leicester City in League
 * One is genuinely a bigger club than Lincoln City in the Championship.
 * Flattening that away would throw out the only real information here.
 *
 * Anything that needs a number which must NOT overlap across divisions —
 * a wage, most obviously — asks for `clubStanding` instead, which ranks a
 * club WITHIN its own division and returns 0-1. See economy.ts, which is
 * where every magnitude derived from either of these lives.
 *
 * ── Confidence, stated rather than implied ──
 *
 * These are real-world judgements, not a sourced dataset: fan base, history,
 * recent top-flight time, global name recognition. The order is the part
 * worth trusting (Carlisle United above Hornchurch; Sheffield Wednesday
 * above Bromley; Leicester City the biggest name outside the top two
 * tiers). The exact gaps are a reasonable reading and are meant to be
 * retuned, not defended to the point.
 */

/** A club nobody has an opinion about — genuinely small, not unknown. */
export const DEFAULT_CLUB_REPUTATION = 20;

export const CLUB_REPUTATION: Record<string, number> = {
  // ── Premier League ─────────────────────────────────────────────────────
  "Manchester United": 97, "Liverpool": 97, "Manchester City": 95,
  "Arsenal": 94, "Chelsea": 93, "Tottenham Hotspur": 87,
  "Newcastle United": 82, "Aston Villa": 78, "Everton": 75,
  "Leeds United": 74, "Nottingham Forest": 70, "Sunderland": 70,
  "Crystal Palace": 68, "Brighton & Hove Albion": 68, "Fulham FC": 66,
  "Ipswich Town": 64, "Brentford": 63, "AFC Bournemouth": 62,
  "Hull City": 62, "Coventry City": 62,

  // ── Championship ───────────────────────────────────────────────────────
  // Overlaps the Premier League band on purpose — a just-relegated West Ham
  // is a bigger club than half the division above it.
  "West Ham United": 78, "Wolverhampton Wanderers": 70, "Southampton": 66,
  "Norwich City": 63, "Stoke City": 60, "Derby County": 60,
  "Sheffield United": 60, "West Bromwich Albion": 60, "Middlesbrough": 58,
  "Burnley": 58, "Birmingham City": 56, "Portsmouth": 56,
  "Blackburn Rovers": 55, "Watford": 54, "Swansea City": 53,
  "Cardiff City": 52, "Queens Park Rangers": 50, "Bristol City": 50,
  // Wrexham's number is real-world FAME, not league standing — the
  // documentary genuinely made it one of the best-known names at this level
  // anywhere in the world, which is exactly the kind of thing a flat
  // per-division figure could never express.
  "Wrexham": 50, "Preston North End": 48, "Bolton Wanderers": 48,
  "Millwall FC": 46, "Charlton Athletic": 46, "Lincoln City": 38,

  // ── League One ─────────────────────────────────────────────────────────
  // Leicester City is the outlier the whole file exists for: a Premier
  // League champion and a European quarter-finalist inside living memory,
  // two divisions down, and until now paid exactly what Bromley paid.
  "Leicester City": 62, "Sheffield Wednesday": 52, "Luton Town": 46,
  "Huddersfield Town": 44, "Reading FC": 44, "Wigan Athletic": 42,
  "Blackpool": 42, "Barnsley": 40, "Plymouth Argyle": 40,
  "Bradford City": 40, "Oxford United": 38, "Notts County": 38,
  "Peterborough United": 36, "Doncaster Rovers": 34, "AFC Wimbledon": 34,
  "Stockport County": 32, "Leyton Orient": 32, "Mansfield Town": 30,
  "Milton Keynes Dons": 30, "Wycombe Wanderers": 30, "Cambridge United": 30,
  "Stevenage": 26, "Burton Albion": 26, "Bromley": 24,

  // ── League Two ─────────────────────────────────────────────────────────
  "Rotherham United": 36, "Bristol Rovers": 34, "Port Vale": 32,
  "Oldham Athletic": 32, "Swindon Town": 32, "Grimsby Town": 30,
  "Shrewsbury Town": 28, "Walsall": 28, "Gillingham": 28,
  "Northampton Town": 28, "Exeter City": 28, "Crewe Alexandra": 28,
  "Chesterfield": 28, "Tranmere Rovers": 28, "Colchester United": 26,
  "Rochdale": 26, "York City": 26, "Cheltenham Town": 24,
  "Newport County": 24, "Salford City": 24, "Fleetwood Town": 22,
  "Crawley Town": 22, "Accrington Stanley": 22, "Barnet": 20,

  // ── National League ────────────────────────────────────────────────────
  "Carlisle United": 26, "Southend United": 26, "Yeovil Town": 24,
  "Scunthorpe United": 24, "Hartlepool United": 24, "Forest Green Rovers": 22,
  "Barrow": 20, "Gateshead": 18, "Woking": 18, "FC Halifax Town": 18,
  "Kidderminster Harriers": 18, "Aldershot Town": 18, "Harrogate Town": 18,
  "Sutton United": 16, "Altrincham": 16, "Solihull Moors": 16,
  "Boston United": 16, "Eastleigh": 14, "AFC Fylde": 12,
  "Tamworth": 12, "Wealdstone": 12, "Boreham Wood": 12,
  "Worthing": 10, "Hornchurch": 8,

  // ── The holding pool below the National League ─────────────────────────
  "Torquay United": 14, "Chorley": 8, "Scarborough Athletic": 8,
  "Dorking Wanderers": 8,
};

/**
 * How big this club is, 0-100, on the one scale.
 *
 * Falls back — in order — to the researched `CLUB_DATABASE` figure mapped
 * onto this scale (which covers every European/"Other" club the table above
 * deliberately doesn't repeat), and then to a plain small number for a club
 * neither knows about (a custom club, most likely). Never returns 0: a club
 * nobody has heard of still exists, and a zero would silently collapse
 * every formula that multiplies by this.
 */
export function clubReputation(club: string): number {
  const own = CLUB_REPUTATION[club];
  if (own !== undefined) return own;

  // CLUB_DATABASE's own 1-10 figure, stretched across the same 0-100 scale.
  // 1 → 10 and 10 → 100, so a European giant this table doesn't list still
  // reads as a European giant rather than as a default nobody.
  const rated = CLUB_DATABASE[club]?.currentReputation;
  if (rated !== undefined) return Math.round(10 + ((rated - 1) / 9) * 90);

  return DEFAULT_CLUB_REPUTATION;
}

const DIVISION_CLUBS: Record<CareerDivision, readonly string[]> = {
  premier: PREMIER_LEAGUE_CLUBS,
  championship: CHAMPIONSHIP_CLUBS,
  league_one: LEAGUE_ONE_CLUBS,
  league_two: LEAGUE_TWO_CLUBS,
  national_league: NATIONAL_LEAGUE_CLUBS,
};

/** Every club a division opened the game with. Exported because the wage
 *  bands and the tests both need the same list, and a second copy of it is
 *  exactly the kind of drift clubs.ts's own header warns about. */
export function clubsInDivision(division: CareerDivision): readonly string[] {
  return DIVISION_CLUBS[division] ?? PREMIER_LEAGUE_CLUBS;
}

/**
 * Where this club sits WITHIN its division: 0 for the smallest club in it,
 * 1 for the biggest, linear in reputation in between.
 *
 * This — not `clubReputation` — is what a wage should read, and the reason
 * is the guarantee the rework asks for: a division's best club must never
 * out-pay the division above's worst. Raw reputation cannot give that,
 * because raw reputation genuinely overlaps across divisions (Leicester
 * City is a bigger club than Lincoln City, and it should be). Ranking
 * within the division first and mapping into that division's own disjoint
 * wage band afterwards gives the guarantee BY CONSTRUCTION rather than by
 * choosing numbers carefully and hoping — see economy.ts's `weeklyWageFor`
 * and the test that asserts it across every club in the game.
 *
 * A club that isn't in the division it's being asked about (promoted since,
 * a custom club, the free-agent case) is scored against that division's
 * real range anyway and clamped into it, which is the honest answer: it is
 * being paid like a club of that size at that level.
 */
export function clubStanding(club: string, division: CareerDivision): number {
  const clubs = clubsInDivision(division);
  let lo = Infinity, hi = -Infinity;
  for (const c of clubs) {
    const r = clubReputation(c);
    if (r < lo) lo = r;
    if (r > hi) hi = r;
  }
  if (!Number.isFinite(lo) || hi <= lo) return 0.5;
  const raw = (clubReputation(club) - lo) / (hi - lo);
  return Math.max(0, Math.min(1, raw));
}
