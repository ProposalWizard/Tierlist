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
 * Not yet in the Championship. Five clubs — kept here unchanged (see the note
 * below) even though all five are now ALSO the five League One overlap clubs
 * (they carry real squad data, so they became League One's five "already
 * exists in the game" members — see LEAGUE_ONE_CLUBS just below).
 *
 * Why this list isn't emptied even though its old job (feeding the
 * Championship<->pool rotation in promotion.ts) is gone, replaced by
 * Championship<->League One directly: `lib/star/cups.ts`'s `belowField`
 * indexes into this array with `i % PROMOTION_POOL_CLUBS.length` to fill
 * out a cup's below-tier field — emptying it would divide by zero there.
 * Left exactly as-is on purpose, still real, still shown in the Lineups
 * picker's "Other" tab — DIVISION_BY_CLUB below tags these five clubs
 * "league_one" (LEAGUE_ONE_CLUBS is spread after this list, so its tag
 * wins), the same "last spread wins, and that's fine" pattern this file's
 * own OTHER_CLUBS/CHAMPIONS_LEAGUE_CLUBS notes already document for
 * Arsenal-in-two-lists.
 *
 * Also carries thirteen standalone clubs by explicit request — not part of
 * any promotion/relegation cycle, just clubs with their own real squad,
 * shown in the Lineups picker's "Other" tab alongside the pool.
 */
export const PROMOTION_POOL_CLUBS: readonly string[] = [
  "Luton Town", "Huddersfield Town", "Leicester City", "Reading FC", "Wigan Athletic",
];

/**
 * LEAGUE ONE, LEAGUE TWO, THE NATIONAL LEAGUE — AND THE HOLDING POOL BELOW IT.
 *
 * Extends the ladder three tiers further down than the Championship, given
 * directly with real club names and real kit/badge colours (see kits.ts).
 * Five League One clubs already existed in this game with real squad/kit
 * data as PROMOTION_POOL_CLUBS's five members — given directly, they MOVE
 * division (their real data is untouched; only which tier they're tagged as
 * changes, via DIVISION_BY_CLUB below). Every other club across these three
 * tiers plus the four-club National League pool is genuinely new to this
 * game and has no real squad on file — `leagueSquads.ts`'s `generatedSquad`
 * fallback fires for every one of them, targeted at a real average rating
 * per tier (63 / 58 / 55 / 55) rather than the flat ~73 every other
 * generated club defaults to — see `AVG_RATING_BY_DIVISION` there.
 *
 * None of these three tiers is ever a division a career actually PLAYS a
 * season in — `CareerDivision` (calendar.ts) is still exactly
 * "premier" | "championship", by deliberate scope decision (see this
 * session's own report): threading a third playable division through
 * fixtures/cups/transfer-window/every screen that assumes those two is a
 * much larger, separate project. These three tiers are real, richly
 * detailed hats exactly the way the Championship's old five-club
 * PROMOTION_POOL_CLUBS always was — not simulated with a live table, but
 * real clubs, real kits, real generated squads, and a real weighted
 * promotion/relegation flow every season (lib/star/promotion.ts).
 */
export const LEAGUE_ONE_CLUBS: readonly string[] = [
  "AFC Wimbledon", "Barnsley", "Blackpool", "Bradford City", "Bromley",
  "Burton Albion", "Cambridge United", "Doncaster Rovers", "Huddersfield Town",
  "Leicester City", "Leyton Orient", "Luton Town", "Mansfield Town",
  "Milton Keynes Dons", "Notts County", "Oxford United", "Peterborough United",
  "Plymouth Argyle", "Reading FC", "Sheffield Wednesday", "Stevenage",
  "Stockport County", "Wigan Athletic", "Wycombe Wanderers",
];

export const LEAGUE_TWO_CLUBS: readonly string[] = [
  "Accrington Stanley", "Barnet", "Bristol Rovers", "Cheltenham Town",
  "Chesterfield", "Colchester United", "Crawley Town", "Crewe Alexandra",
  "Exeter City", "Fleetwood Town", "Gillingham", "Grimsby Town",
  "Newport County", "Northampton Town", "Oldham Athletic", "Port Vale",
  "Rochdale", "Rotherham United", "Salford City", "Shrewsbury Town",
  "Swindon Town", "Tranmere Rovers", "Walsall", "York City",
];

export const NATIONAL_LEAGUE_CLUBS: readonly string[] = [
  "AFC Fylde", "Aldershot Town", "Altrincham", "Barrow", "Boreham Wood",
  "Boston United", "Carlisle United", "Eastleigh", "FC Halifax Town",
  "Forest Green Rovers", "Gateshead", "Harrogate Town", "Hartlepool United",
  "Hornchurch", "Kidderminster Harriers", "Scunthorpe United", "Solihull Moors",
  "Southend United", "Sutton United", "Tamworth", "Wealdstone", "Woking",
  "Worthing", "Yeovil Town",
];

/**
 * Below the National League. Not a division — nobody plays a season in it,
 * same idea as PROMOTION_POOL_CLUBS below the Championship. Exactly four
 * clubs, and (per lib/star/promotion.ts) ALL four rotate out every season —
 * the National League relegates four (nowhere for them to go but here, since
 * this game has no National League North/South) and this pool sends
 * (weighted-drawn) replacements up to fill every one of those four places,
 * so the pool turns over completely rather than partially the way the
 * Championship's five-club pool only ever loses three of five.
 */
export const NATIONAL_LEAGUE_POOL_CLUBS: readonly string[] = [
  "Chorley", "Scarborough Athletic", "Dorking Wanderers", "Torquay United",
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
 *
 * "Sevilla FC"/"Eintracht Frankfurt"/"Lazio" moved out to
 * CHAMPIONS_LEAGUE_CLUBS/EUROPA_LEAGUE_CLUBS below — reported directly from
 * a real save: these three (plus several already-misfiled entries within
 * those two lists) turned up as the player's live Champions League
 * opponents despite this file calling them something else entirely
 * (Europa League, or not a European club at all per this list). euro.ts's
 * CHAMPIONS_POOL/EUROPA_POOL — who you can actually be drawn against — had
 * drifted from this file's own tabs without either ever being checked
 * against the other. See euro.ts's own header for the full account.
 */
export const OTHER_CLUBS: readonly string[] = [
  "FC Schalke 04", "AS Monaco", "RC Strasbourg Alsace", "Atalanta",
  "Al Hilal", "Al Nassr", "Al Ahli SFC", "Al Ittihad",
  // Moved out of CHAMPIONS_LEAGUE_CLUBS/EUROPA_LEAGUE_CLUBS directly below —
  // given directly, to correct both lists down to the real 36 UEFA uses
  // (they'd drifted to 38 apiece). See those two lists' own notes.
  "Sevilla FC", "Rangers FC", "Hearts", "Vitória SC",
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
/**
 * Exactly 36 — the real UEFA Swiss-model field size, confirmed directly
 * after this list drifted to 38. Two were moved out to correct it: "FC
 * København" dropped to EUROPA_LEAGUE_CLUBS (its own note there), "Sevilla
 * FC" dropped to OTHER_CLUBS (Spain already has its full fixed allocation
 * without it — see euro.ts's MAIN_NATION_ALLOCATION). This is now the
 * literal season-1 Champions League roster `euro.ts` builds its simulation
 * from directly — not a separate hand-typed seed list that can drift from
 * this one again, which is exactly how it reached 38 last time.
 */
export const CHAMPIONS_LEAGUE_CLUBS: readonly string[] = [
  "Arsenal", "Aston Villa", "Atlético Madrid", "Borussia Dortmund", "FC Barcelona",
  "FC Bayern München", "Club Brugge KV", "Como", "Feyenoord", "Galatasaray SK", "Inter",
  "RB Leipzig", "RC Lens", "Lille OSC", "Liverpool", "Manchester City", "Manchester United",
  "Napoli", "Paris Saint-Germain", "FC Porto", "PSV", "Real Betis Balompié",
  "Real Madrid", "Roma", "Shakhtar Donetsk", "SK Slavia Praha", "Sporting CP",
  "VfB Stuttgart", "Villarreal CF", "FK Bodø/Glimt", "Celtic", "AEK Athens", "Olympique Lyonnais",
  "Fenerbahçe SK", "Dinamo Zagreb", "Eintracht Frankfurt",
];

/**
 * Exactly 36 — see CHAMPIONS_LEAGUE_CLUBS's own note; this list had drifted
 * to 38 the same way. "Rangers FC", "Hearts", and "Vitória SC" moved out to
 * OTHER_CLUBS (Scotland/Portugal already have real representation without
 * them — same "real, but sitting out this season" pool the general reshuffle
 * draws from, see euro.ts). "FC København" moved IN from
 * CHAMPIONS_LEAGUE_CLUBS, given directly.
 */
export const EUROPA_LEAGUE_CLUBS: readonly string[] = [
  "AZ Alkmaar", "AFC Bournemouth", "RC Celta", "Crystal Palace", "TSG 1899 Hoffenheim",
  "Juventus", "Bayer 04 Leverkusen", "Olympique de Marseille", "AC Milan", "Olympiacos FC",
  "Real Sociedad", "Stade Rennais FC", "Sparta Praha", "SK Sturm Graz", "Sunderland",
  "Union Saint-Gilloise", "Ferencvárosi Torna Club", "RSC Anderlecht", "Lech Poznań",
  "Trabzonspor", "SL Benfica", "Beşiktaş JK",
  "FC Red Bull Salzburg", "Shamrock Rovers",
  // The first list was seven short of the real thirty-six.
  "Ajax", "FC Midtjylland", "KRC Genk", "BSC Young Boys", "FC Basel 1893", "Malmö FF",
  // Torreense, Crvena Zvezda, Omonia Nicosia, Pafos and Slovan Bratislava were
  // given directly but confirmed absent from the FC26 table under any close
  // spelling (see fc27_clone_european_clubs.sql) — not just unlicensed, in
  // Crvena Zvezda's case the only near-hit was an unrelated French club that
  // happens to share its nickname's English translation. Swapped for five
  // other clubs with a genuine European pedigree, each from a league already
  // confirmed present in the table by a club above that matched clean.
  "Sporting Clube de Braga", "PAOK", "Viktoria Plzeň", "Legia Warszawa",
  // Moved in from OTHER_CLUBS — real Europa League pedigree, and euro.ts's
  // EUROPA_POOL already (correctly) treated it as one; this file just never
  // agreed until now.
  "Lazio",
  // Moved in from CHAMPIONS_LEAGUE_CLUBS, given directly, correcting both
  // lists down to the real 36.
  "FC København",
];

/**
 * Whichever of the twenty Premier League clubs actually start this real
 * 2026/27 season already qualified for Europe — the English entries drawn
 * straight out of CHAMPIONS_LEAGUE_CLUBS/EUROPA_LEAGUE_CLUBS above, not a
 * second hand-typed list that could quietly drift from them.
 *
 * Read once, at career creation (`makeInitialCareer`, careerFlow.ts) — a
 * season-1 career used to never have a European campaign at all, even for a
 * club that has genuinely already qualified in real life, because
 * `europeanQualification` otherwise only ever gets computed from a season
 * this career hasn't played yet. Every later season's qualification is
 * still earned properly through the league table — this only seeds the
 * ONE season that has no table to earn it from.
 */
export const STARTING_EUROPEAN_QUALIFICATION: Record<string, "Champions League" | "Europa League"> = {
  "Arsenal": "Champions League",
  "Aston Villa": "Champions League",
  "Liverpool": "Champions League",
  "Manchester City": "Champions League",
  "Manchester United": "Champions League",
  "AFC Bournemouth": "Europa League",
  "Crystal Palace": "Europa League",
  "Sunderland": "Europa League",
};

/**
 * The shortened name for every club on the English ladder, given directly —
 * not the generic "drop United/City/Town" heuristic `shortClub` (grammar.ts)
 * otherwise falls back to, which gets Nottingham Forest ("Forest" was never
 * going to fall out of a suffix-stripping rule) and a few others wrong. This
 * is now the authoritative source `shortClub` reads first; update THIS list
 * alone if a shortened name ever needs to change; the heuristic still covers
 * international clubs (Champions League/Europa League/Other) not listed here.
 */
export const CLUB_SHORT_NAMES: Record<string, string> = {
  "Arsenal": "Arsenal",
  "Aston Villa": "Villa",
  "AFC Bournemouth": "Bournemouth",
  "Brentford": "Brentford",
  "Brighton & Hove Albion": "Brighton",
  "Chelsea": "Chelsea",
  "Coventry City": "Coventry",
  "Crystal Palace": "Palace",
  "Everton": "Everton",
  "Fulham FC": "Fulham",
  "Hull City": "Hull",
  "Ipswich Town": "Ipswich",
  "Leeds United": "Leeds",
  "Liverpool": "Liverpool",
  "Manchester City": "Man City",
  "Manchester United": "Man United",
  "Newcastle United": "Newcastle",
  "Nottingham Forest": "Forest",
  "Sunderland": "Sunderland",
  "Tottenham Hotspur": "Spurs",
  "Birmingham City": "Birmingham",
  "Blackburn Rovers": "Blackburn",
  "Bolton Wanderers": "Bolton",
  "Bristol City": "Bristol",
  "Burnley": "Burnley",
  "Cardiff City": "Cardiff",
  "Charlton Athletic": "Charlton",
  "Derby County": "Derby",
  "Lincoln City": "Lincoln",
  "Middlesbrough": "Boro",
  "Millwall FC": "Millwall",
  "Norwich City": "Norwich",
  "Portsmouth": "Portsmouth",
  "Preston North End": "PNE",
  "Queens Park Rangers": "QPR",
  "Sheffield United": "Sheffield",
  "Southampton": "Southampton",
  "Stoke City": "Stoke",
  "Swansea City": "Swansea",
  "Watford": "Watford",
  "West Bromwich Albion": "West Brom",
  "West Ham United": "West Ham",
  "Wolverhampton Wanderers": "Wolves",
  "Wrexham": "Wrexham",
  "Leicester City": "Leicester",
  "Luton Town": "Luton",
  "Huddersfield Town": "Huddersfield",
  "Wigan Athletic": "Wigan",
  "Reading FC": "Reading",

  // ── League One / League Two / National League ──
  "AFC Wimbledon": "Wimbledon", "Barnsley": "Barnsley", "Blackpool": "Blackpool",
  "Bradford City": "Bradford", "Bromley": "Bromley", "Burton Albion": "Burton",
  "Cambridge United": "Cambridge", "Doncaster Rovers": "Doncaster",
  "Leyton Orient": "Orient", "Mansfield Town": "Mansfield",
  "Milton Keynes Dons": "MK Dons", "Notts County": "Notts County",
  "Oxford United": "Oxford", "Peterborough United": "Peterborough",
  "Plymouth Argyle": "Plymouth", "Sheffield Wednesday": "Sheff Wed",
  "Stevenage": "Stevenage", "Stockport County": "Stockport",
  "Wycombe Wanderers": "Wycombe",
  "Accrington Stanley": "Accrington", "Barnet": "Barnet",
  "Bristol Rovers": "Bristol Rovers", "Cheltenham Town": "Cheltenham",
  "Chesterfield": "Chesterfield", "Colchester United": "Colchester",
  "Crawley Town": "Crawley", "Crewe Alexandra": "Crewe",
  "Exeter City": "Exeter", "Fleetwood Town": "Fleetwood",
  "Gillingham": "Gillingham", "Grimsby Town": "Grimsby",
  "Newport County": "Newport", "Northampton Town": "Northampton",
  "Oldham Athletic": "Oldham", "Port Vale": "Port Vale",
  "Rochdale": "Rochdale", "Rotherham United": "Rotherham",
  "Salford City": "Salford", "Shrewsbury Town": "Shrewsbury",
  "Swindon Town": "Swindon", "Tranmere Rovers": "Tranmere",
  "Walsall": "Walsall", "York City": "York",
  "AFC Fylde": "Fylde", "Aldershot Town": "Aldershot", "Altrincham": "Altrincham",
  "Barrow": "Barrow", "Boreham Wood": "Boreham Wood", "Boston United": "Boston",
  "Carlisle United": "Carlisle", "Eastleigh": "Eastleigh",
  "FC Halifax Town": "Halifax", "Forest Green Rovers": "Forest Green",
  "Gateshead": "Gateshead", "Harrogate Town": "Harrogate",
  "Hartlepool United": "Hartlepool", "Hornchurch": "Hornchurch",
  "Kidderminster Harriers": "Kidderminster", "Scunthorpe United": "Scunthorpe",
  "Solihull Moors": "Solihull", "Southend United": "Southend",
  "Sutton United": "Sutton", "Tamworth": "Tamworth", "Wealdstone": "Wealdstone",
  "Woking": "Woking", "Worthing": "Worthing", "Yeovil Town": "Yeovil",
  "Chorley": "Chorley", "Scarborough Athletic": "Scarborough",
  "Dorking Wanderers": "Dorking", "Torquay United": "Torquay",
};

export type Division =
  | "premier" | "championship" | "pool" | "champions" | "europa"
  | "league_one" | "league_two" | "national_league" | "national_league_pool";

const DIVISION_BY_CLUB = new Map<string, Division>([
  ...PREMIER_LEAGUE_CLUBS.map(c => [c, "premier"] as const),
  ...CHAMPIONSHIP_CLUBS.map(c => [c, "championship"] as const),
  ...PROMOTION_POOL_CLUBS.map(c => [c, "pool"] as const),
  ...OTHER_CLUBS.map(c => [c, "pool"] as const),
  ...CHAMPIONS_LEAGUE_CLUBS.map(c => [c, "champions"] as const),
  ...EUROPA_LEAGUE_CLUBS.map(c => [c, "europa"] as const),
  // Spread after PROMOTION_POOL_CLUBS on purpose — five of these clubs are
  // also in that list (see its own note above); this tag wins for them,
  // same "last spread wins" pattern the Champions/Europa lists already rely
  // on for a club like Arsenal.
  ...LEAGUE_ONE_CLUBS.map(c => [c, "league_one"] as const),
  ...LEAGUE_TWO_CLUBS.map(c => [c, "league_two"] as const),
  ...NATIONAL_LEAGUE_CLUBS.map(c => [c, "national_league"] as const),
  ...NATIONAL_LEAGUE_POOL_CLUBS.map(c => [c, "national_league_pool"] as const),
]);

export function divisionOf(club: string): Division | null {
  return DIVISION_BY_CLUB.get(club) ?? null;
}

/**
 * Every club this career could plausibly FACE OR TRADE WITH beyond its own
 * division — Champions League, Europa League, the "Other"/promotion-pool
 * clubs the Lineups screen already offers, AND the other English tier
 * (Championship when you play the Premier League, the Premier League when
 * you play the Championship) — minus whichever of them happen to also be in
 * the player's own division (Arsenal is both a Premier League club and a
 * Champions League one; fetching and tracking it twice would be pointless
 * and would let it silently diverge between the two).
 *
 * The other English tier belongs here too — reported directly, a real FA
 * Cup tie against Blackburn Rovers (a Championship club, for a Premier
 * League career) still showed "Unable to scout opponent's team". Root
 * cause: the FA Cup/League Cup draw genuinely pulls from the other domestic
 * tier as real opposition (see cups.ts's belowField, "always the real OTHER
 * English tier first"), but this list — the only thing that decides whose
 * squad actually gets fetched into `externalSquads` — never included it,
 * only Europe/promotion-pool/other. A cup opponent from the tier below (or
 * above) was always a name with no roster to resolve a saved lineup or
 * scout report against, no matter what.
 *
 * See lib/star/leagueTransfers.ts's runInternationalWindow for the other
 * thing that reads this list, called from app/star-dev/page.tsx — a
 * Championship↔Premier League transfer during that window is a real,
 * previously-unsimulated transfer type this incidentally also makes
 * possible, not a regression.
 */
export function externalClubsFor(domesticClubs: string[]): string[] {
  const domestic = new Set(domesticClubs);
  const world = new Set([
    ...CHAMPIONS_LEAGUE_CLUBS, ...EUROPA_LEAGUE_CLUBS, ...OTHER_CLUBS, ...PROMOTION_POOL_CLUBS,
    ...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS,
    // The FA Cup's Round of 64 (cups.ts's faCupField) now genuinely draws
    // from League One, League Two, AND the National League — not just the
    // tier immediately below, the way the League Cup's belowField still
    // does. All three need their squads fetchable here too, or an FA Cup
    // opponent from League Two/the National League hits the exact
    // "Unable to scout opponent's team" bug this list's own history
    // already records for a Championship club once.
    ...LEAGUE_ONE_CLUBS, ...LEAGUE_TWO_CLUBS, ...NATIONAL_LEAGUE_CLUBS,
  ]);
  return Array.from(world).filter(c => !domestic.has(c));
}
