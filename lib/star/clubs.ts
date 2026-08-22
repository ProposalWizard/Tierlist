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
 *
 * Also carries thirteen standalone clubs by explicit request — not part of
 * any promotion/relegation cycle, just clubs with their own real squad,
 * shown in the Lineups picker's "Other" tab alongside the pool.
 */
export const PROMOTION_POOL_CLUBS: readonly string[] = [
  "Luton Town", "Huddersfield Town", "Leicester City", "Reading", "Wigan Athletic",
  // "Villarreal" was given here too ("Villareal"), but it's already the
  // Champions League club above — treated as one mention, not two.
  // "Ajax" moved to the Europa League list below — the first Europa League
  // list was short seven clubs of the real thirty-six, and Ajax was one of
  // the seven named to fill it in.
  "Sevilla", "Eintracht Frankfurt", "Schalke", "Monaco",
  "Strasbourg", "Atalanta", "Lazio", "Al Hilal", "Al Nassr",
  "Al Ahli", "Al Ittihad",
];

/**
 * This season's European cast — real clubs with real squads, the same as
 * every other list here, but not part of the Premier League/Championship
 * promotion ladder at all; they never get relegated or promoted by this
 * game, only whichever real competition sends them here again or doesn't.
 *
 * Name matching against the database is exact-string (see
 * app/api/star/league-squads), so every name below needs to be confirmed
 * against supabase/migrations/fc27_clone_european_clubs.sql's own
 * diagnostic query once it's been run — these are the best full names I
 * could resolve from shorthand ("Man City", "Inter", "Atleti"), not yet
 * verified against what SoFIFA itself calls each club.
 */
export const CHAMPIONS_LEAGUE_CLUBS: readonly string[] = [
  "Arsenal", "Aston Villa", "Atlético Madrid", "Borussia Dortmund", "Barcelona",
  "Bayern München", "Club Brugge", "Como", "Feyenoord", "Galatasaray", "Inter",
  "RB Leipzig", "Lens", "Lille", "Liverpool", "Manchester City", "Manchester United",
  "Napoli", "Paris Saint-Germain", "Porto", "PSV Eindhoven", "Real Betis",
  "Real Madrid", "Roma", "Shakhtar Donetsk", "Slavia Praha", "Sporting CP",
  "VfB Stuttgart", "Villarreal", "Bodø/Glimt", "Celtic", "AEK Athens", "Lyon",
  "Fenerbahçe", "Dinamo Zagreb", "Slovan Bratislava",
];

export const EUROPA_LEAGUE_CLUBS: readonly string[] = [
  "AZ Alkmaar", "Bournemouth", "Celta Vigo", "Crystal Palace", "Hoffenheim",
  "Juventus", "Bayer Leverkusen", "Marseille", "AC Milan", "Olympiacos",
  "Real Sociedad", "Rennes", "Sparta Praha", "Sturm Graz", "Sunderland",
  "Torreense", "Union SG", "Ferencváros", "Anderlecht", "Lech Poznań",
  "Trabzonspor", "Benfica", "Crvena Zvezda", "Omonia Nicosia", "Beşiktaş",
  "Salzburg", "Rangers", "Hearts", "Shamrock Rovers",
  // The first list was seven short of the real thirty-six.
  "Pafos", "Ajax", "Midtjylland", "Genk", "Young Boys", "Basel", "Malmö",
];

export type Division = "premier" | "championship" | "pool" | "champions" | "europa";

const DIVISION_BY_CLUB = new Map<string, Division>([
  ...PREMIER_LEAGUE_CLUBS.map(c => [c, "premier"] as const),
  ...CHAMPIONSHIP_CLUBS.map(c => [c, "championship"] as const),
  ...PROMOTION_POOL_CLUBS.map(c => [c, "pool"] as const),
  ...CHAMPIONS_LEAGUE_CLUBS.map(c => [c, "champions"] as const),
  ...EUROPA_LEAGUE_CLUBS.map(c => [c, "europa"] as const),
]);

export function divisionOf(club: string): Division | null {
  return DIVISION_BY_CLUB.get(club) ?? null;
}
