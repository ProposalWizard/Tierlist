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
  "Arsenal", "AFC Bournemouth", "Liverpool", "Leeds United", "Crystal Palace", "Brentford",
  "Hull City", "Brighton & Hove Albion", "Everton", "Newcastle United", "Nottingham Forest",
  "Ipswich Town", "Manchester City", "Tottenham Hotspur", "Aston Villa",
  "Chelsea", "Fulham FC", "Sunderland", "Manchester United", "Coventry City",
];

export const CHAMPIONSHIP_CLUBS: readonly string[] = [
  "Queens Park Rangers", "Millwall FC", "Bolton Wanderers", "Watford",
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
  "Luton Town", "Huddersfield Town", "Leicester City", "Reading FC", "Wigan Athletic",
];

/**
 * Clubs with a squad in the game and no place on the English ladder.
 *
 * Kept deliberately apart from PROMOTION_POOL_CLUBS, which these used to
 * share a list with. That was a real bug and not only an untidy one: the
 * promotion pool is drawn from to fill Championship places, so Sevilla,
 * Monaco and Al Hilal were being promoted into the English second tier —
 * caught by printing eight seasons of a ladder rather than by any assertion,
 * because the invariant everything was checked against (the pool stays the
 * same size) held perfectly while its contents made no sense.
 *
 * The Lineups picker shows both lists under "Other"; nothing else should
 * ever put these two together.
 *
 * "Villarreal" was given here too ("Villareal") but is already the Champions
 * League club above — one mention, not two. "Ajax" moved to the Europa
 * League list, which was seven short of the real thirty-six.
 */
export const OTHER_CLUBS: readonly string[] = [
  "Sevilla FC", "Eintracht Frankfurt", "FC Schalke 04", "AS Monaco",
  "RC Strasbourg Alsace", "Atalanta", "Lazio", "Al Hilal", "Al Nassr",
  "Al Ahli SFC", "Al Ittihad",
];

/**
 * This season's European cast — real clubs with real squads, the same as
 * every other list here, but not part of the Premier League/Championship
 * promotion ladder at all; they never get relegated or promoted by this
 * game, only whichever real competition sends them here again or doesn't.
 *
 * Name matching against the database is exact-string (see
 * app/api/star/league-squads).
 *
 * Every name below matches the real SoFIFA spelling confirmed earlier this
 * season — not the shorthand originally given ("Man City", "Inter",
 * "Atleti") that these lists started from. That distinction mattered twice
 * over: the FC26->FC27 clone (fc27_clone_european_clubs.sql) was fixed to
 * MATCH a club under its real spelling months ago, but these two lists kept
 * asking the Lineups picker for the shorthand instead — so the clone had
 * long since copied real Bayern München/Fenerbahçe/Porto/etc. squads into
 * the database correctly, while the game itself was still asking for a name
 * that squad was never stored under. Caught only by a full sweep of every
 * club's exact player count, the same way the English clubs' equivalent bug
 * was — a club sitting at zero players doesn't distinguish "never cloned"
 * from "cloned under a name three characters different from what's asked
 * for", and 36 of these 84 were the second kind.
 */
export const CHAMPIONS_LEAGUE_CLUBS: readonly string[] = [
  "Arsenal", "Aston Villa", "Atlético Madrid", "Borussia Dortmund", "FC Barcelona",
  "FC Bayern München", "Club Brugge KV", "Como", "Feyenoord", "Galatasaray SK", "Inter",
  "RB Leipzig", "RC Lens", "Lille OSC", "Liverpool", "Manchester City", "Manchester United",
  "Napoli", "Paris Saint-Germain", "FC Porto", "PSV", "Real Betis Balompié",
  "Real Madrid", "Roma", "Shakhtar Donetsk", "SK Slavia Praha", "Sporting CP",
  "VfB Stuttgart", "Villarreal CF", "FK Bodø/Glimt", "Celtic", "AEK Athens", "Olympique Lyonnais",
  "Fenerbahçe SK", "Dinamo Zagreb",
  // Slovan Bratislava was given directly but confirmed absent from the FC26
  // table under any close spelling (see fc27_clone_european_clubs.sql) —
  // swapped for a club with genuine recent Champions League pedigree from a
  // league already confirmed present via Midtjylland's match. Danish
  // spelling, not the English one — its own real row is "FC København".
  "FC København",
];

export const EUROPA_LEAGUE_CLUBS: readonly string[] = [
  "AZ Alkmaar", "AFC Bournemouth", "RC Celta", "Crystal Palace", "TSG 1899 Hoffenheim",
  "Juventus", "Bayer 04 Leverkusen", "Olympique de Marseille", "AC Milan", "Olympiacos FC",
  "Real Sociedad", "Stade Rennais FC", "Sparta Praha", "SK Sturm Graz", "Sunderland",
  "Union Saint-Gilloise", "Ferencvárosi Torna Club", "RSC Anderlecht", "Lech Poznań",
  "Trabzonspor", "SL Benfica", "Beşiktaş JK",
  "FC Red Bull Salzburg", "Rangers FC", "Hearts", "Shamrock Rovers",
  // The first list was seven short of the real thirty-six.
  "Ajax", "FC Midtjylland", "KRC Genk", "BSC Young Boys", "FC Basel 1893", "Malmö FF",
  // Torreense, Crvena Zvezda, Omonia Nicosia, Pafos and Slovan Bratislava were
  // given directly but confirmed absent from the FC26 table under any close
  // spelling (see fc27_clone_european_clubs.sql) — not just unlicensed, in
  // Crvena Zvezda's case the only near-hit was an unrelated French club that
  // happens to share its nickname's English translation. Swapped for five
  // other clubs with a genuine European pedigree, each from a league already
  // confirmed present in the table by a club above that matched clean.
  "Sporting Clube de Braga", "PAOK", "Viktoria Plzeň", "Vitória SC", "Legia Warszawa",
];

export type Division = "premier" | "championship" | "pool" | "champions" | "europa";

const DIVISION_BY_CLUB = new Map<string, Division>([
  ...PREMIER_LEAGUE_CLUBS.map(c => [c, "premier"] as const),
  ...CHAMPIONSHIP_CLUBS.map(c => [c, "championship"] as const),
  ...PROMOTION_POOL_CLUBS.map(c => [c, "pool"] as const),
  ...OTHER_CLUBS.map(c => [c, "pool"] as const),
  ...CHAMPIONS_LEAGUE_CLUBS.map(c => [c, "champions"] as const),
  ...EUROPA_LEAGUE_CLUBS.map(c => [c, "europa"] as const),
]);

export function divisionOf(club: string): Division | null {
  return DIVISION_BY_CLUB.get(club) ?? null;
}
