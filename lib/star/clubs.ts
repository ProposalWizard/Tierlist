/**
 * WHO PLAYS WHERE, THIS SEASON.
 *
 * The one place that says which division a club is in — the Premier League,
 * the Championship, or this season's five-club promotion pool (not yet in
 * the Championship, but one relegation away from being drawn into it; see
 * lib/star/promotion.ts). Source of truth for the Lineups picker now, and
 * for profile setup and season rollover once those exist — a club's
 * division should never be duplicated into a second hardcoded list that can
 * quietly drift from this one.
 *
 * Real 2026/27 membership, as given directly: the Premier League already
 * reflects last season's actual relegation/promotion (Burnley, West Ham and
 * Wolves down; Hull, Ipswich and Coventry up) rather than the club list this
 * game shipped with originally.
 */

export const PREMIER_LEAGUE_CLUBS: readonly string[] = [
  "Arsenal", "Bournemouth", "Liverpool", "Leeds", "Crystal Palace", "Brentford",
  "Hull City", "Brighton", "Everton", "Newcastle United", "Nottingham Forest",
  "Ipswich Town", "Manchester City", "Tottenham Hotspur", "Aston Villa",
  "Chelsea", "Fulham", "Sunderland", "Manchester United", "Coventry City",
];

export const CHAMPIONSHIP_CLUBS: readonly string[] = [
  "Queens Park Rangers", "Millwall", "Bolton Wanderers", "Watford",
  "Middlesbrough", "Charlton Athletic", "Swansea City", "West Bromwich Albion",
  "Blackburn Rovers", "Burnley", "West Ham United", "Wolverhampton Wanderers",
  "Cardiff City", "Wrexham", "Birmingham City", "Sheffield United",
  "Lincoln City", "Preston North End", "Norwich City", "Stoke City",
  "Derby County", "Portsmouth", "Bristol City", "Southampton",
];

/**
 * Not yet in the Championship. Five clubs, three of whom get drawn up at
 * each promotion cycle — the same shape as the three clubs relegated FROM
 * the Championship join next time round. See lib/star/promotion.ts.
 */
export const PROMOTION_POOL_CLUBS: readonly string[] = [
  "Luton Town", "Huddersfield Town", "Leicester City", "Reading", "Wigan Athletic",
];

export type Division = "premier" | "championship" | "pool";

const DIVISION_BY_CLUB = new Map<string, Division>([
  ...PREMIER_LEAGUE_CLUBS.map(c => [c, "premier"] as const),
  ...CHAMPIONSHIP_CLUBS.map(c => [c, "championship"] as const),
  ...PROMOTION_POOL_CLUBS.map(c => [c, "pool"] as const),
]);

export function divisionOf(club: string): Division | null {
  return DIVISION_BY_CLUB.get(club) ?? null;
}
