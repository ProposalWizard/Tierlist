/**
 * NORTH OR SOUTH — which of the two regional divisions a club drops into.
 *
 * The National League relegates four a season, and they do not all go to the
 * same place: the real FA sends each club to National League North or South
 * by where it is, and moves a club sideways when the two would come out
 * uneven. This file is that rule, made exact: the relegated clubs are sorted
 * by how far north their ground is, and the northernmost go North until North
 * is back to its size; the rest go South. So the two divisions stay 24 each
 * every season, and a club only ever lands in the half of the country it
 * belongs to unless the split forces a club near the line across it — which
 * is also what really happens.
 *
 * Latitudes are each club's town, to one decimal place (degrees north). Every
 * club on the English ladder is listed, because over enough seasons any of
 * them can fall this far. A club with no entry (should one ever be added to
 * clubs.ts without one) sits on the line at 52.5, a coin-flip club.
 */

export const CLUB_LATITUDE: Record<string, number> = {
  // Premier League
  "Arsenal": 51.6, "AFC Bournemouth": 50.7, "Liverpool": 53.4, "Leeds United": 53.8,
  "Crystal Palace": 51.4, "Brentford": 51.5, "Hull City": 53.7, "Brighton & Hove Albion": 50.9,
  "Everton": 53.4, "Newcastle United": 55.0, "Nottingham Forest": 52.9, "Ipswich Town": 52.1,
  "Manchester City": 53.5, "Tottenham Hotspur": 51.6, "Aston Villa": 52.5, "Chelsea": 51.5,
  "Fulham FC": 51.5, "Sunderland": 54.9, "Manchester United": 53.5, "Coventry City": 52.4,
  // Championship
  "Queens Park Rangers": 51.5, "Millwall FC": 51.5, "Bolton Wanderers": 53.6, "Watford": 51.6,
  "Middlesbrough": 54.6, "Charlton Athletic": 51.5, "Swansea City": 51.6, "West Bromwich Albion": 52.5,
  "Blackburn Rovers": 53.7, "Burnley": 53.8, "West Ham United": 51.5, "Wolverhampton Wanderers": 52.6,
  "Cardiff City": 51.5, "Wrexham": 53.1, "Birmingham City": 52.5, "Sheffield United": 53.4,
  "Lincoln City": 53.2, "Preston North End": 53.8, "Norwich City": 52.6, "Stoke City": 53.0,
  "Derby County": 52.9, "Portsmouth": 50.8, "Bristol City": 51.4, "Southampton": 50.9,
  // League One
  "AFC Wimbledon": 51.4, "Barnsley": 53.6, "Blackpool": 53.8, "Bradford City": 53.8,
  "Bromley": 51.4, "Burton Albion": 52.8, "Cambridge United": 52.2, "Doncaster Rovers": 53.5,
  "Huddersfield Town": 53.7, "Leicester City": 52.6, "Leyton Orient": 51.6, "Luton Town": 51.9,
  "Mansfield Town": 53.1, "Milton Keynes Dons": 52.0, "Notts County": 52.9, "Oxford United": 51.7,
  "Peterborough United": 52.6, "Plymouth Argyle": 50.4, "Reading FC": 51.4, "Sheffield Wednesday": 53.4,
  "Stevenage": 51.9, "Stockport County": 53.4, "Wigan Athletic": 53.5, "Wycombe Wanderers": 51.6,
  // League Two
  "Accrington Stanley": 53.8, "Barnet": 51.6, "Bristol Rovers": 51.5, "Cheltenham Town": 51.9,
  "Chesterfield": 53.3, "Colchester United": 51.9, "Crawley Town": 51.1, "Crewe Alexandra": 53.1,
  "Exeter City": 50.7, "Fleetwood Town": 53.9, "Gillingham": 51.4, "Grimsby Town": 53.6,
  "Newport County": 51.6, "Northampton Town": 52.2, "Oldham Athletic": 53.6, "Port Vale": 53.0,
  "Rochdale": 53.6, "Rotherham United": 53.4, "Salford City": 53.5, "Shrewsbury Town": 52.7,
  "Swindon Town": 51.6, "Tranmere Rovers": 53.4, "Walsall": 52.6, "York City": 54.0,
  // National League
  "AFC Fylde": 53.8, "Aldershot Town": 51.2, "Altrincham": 53.4, "Barrow": 54.1,
  "Boreham Wood": 51.7, "Boston United": 53.0, "Carlisle United": 54.9, "Eastleigh": 51.0,
  "FC Halifax Town": 53.7, "Forest Green Rovers": 51.7, "Gateshead": 55.0, "Harrogate Town": 54.0,
  "Hartlepool United": 54.7, "Hornchurch": 51.6, "Kidderminster Harriers": 52.4, "Scunthorpe United": 53.6,
  "Solihull Moors": 52.4, "Southend United": 51.5, "Sutton United": 51.4, "Tamworth": 52.6,
  "Wealdstone": 51.6, "Woking": 51.3, "Worthing": 50.8, "Yeovil Town": 50.9,
  // National League North
  "AFC Telford United": 52.7, "Alfreton Town": 53.1, "Bedford Town": 52.1, "Brackley Town": 52.0,
  "Buxton": 53.3, "Chester": 53.2, "Chorley": 53.7, "Curzon Ashton": 53.5, "Darlington": 54.5,
  "Hednesford Town": 52.7, "Hereford": 52.1, "King's Lynn Town": 52.8, "Leamington": 52.3,
  "Macclesfield": 53.3, "Marine": 53.5, "Merthyr Town": 51.7, "Morecambe": 54.1,
  "Peterborough Sports": 52.6, "Radcliffe": 53.6, "Scarborough Athletic": 54.3, "South Shields": 55.0,
  "Southport": 53.6, "Spennymoor Town": 54.7, "Worksop Town": 53.3,
  // National League South
  "AFC Totton": 50.9, "Bath City": 51.4, "Braintree Town": 51.9, "Chelmsford City": 51.7,
  "Chesham United": 51.7, "Chippenham Town": 51.5, "Dagenham & Redbridge": 51.5, "Dorking Wanderers": 51.2,
  "Eastbourne Borough": 50.8, "Ebbsfleet United": 51.4, "Enfield Town": 51.7, "Farnborough": 51.3,
  "Hampton & Richmond Borough": 51.4, "Hemel Hempstead Town": 51.8, "Horsham": 51.1,
  "Maidenhead United": 51.5, "Maidstone United": 51.3, "St Albans City": 51.8, "Salisbury": 51.1,
  "Slough Town": 51.5, "Tonbridge Angels": 51.2, "Torquay United": 50.5, "Truro City": 50.3,
  "Weston-super-Mare": 51.3,
  // Joined 2026/27 (2 Oct 2026 club sheet; latitudes from each club's town).
  "Harborough Town": 52.5, "Hebburn Town": 55.0, "Oxford City": 51.7, "Spalding United": 52.8,
  "Billericay Town": 51.6, "Dover Athletic": 51.1, "Farnham Town": 51.2, "Folkestone Invicta": 51.1,
  "Walton & Hersham": 51.4,
  // Step 3, waiting below North and South.
  "Guiseley": 53.9, "Bury Town": 52.2, "Cleethorpes Town": 53.6, "Real Bedford": 52.1,
  "Welling United": 51.5, "Lewes": 50.9, "Uxbridge": 51.5,
};

/** The line a club with no latitude on file sits on. */
export const UNKNOWN_LATITUDE = 52.5;

export function latitudeOf(club: string): number {
  return CLUB_LATITUDE[club] ?? UNKNOWN_LATITUDE;
}

/**
 * Split clubs coming down into the two regional divisions.
 *
 * `northPlaces` is how many North needs to get back to its size; the
 * northernmost that many go North, everybody else South. Ties are broken by
 * name so the same clubs always split the same way.
 */
export function splitByRegion(clubs: string[], northPlaces: number): { north: string[]; south: string[] } {
  const byNorth = [...clubs].sort((a, b) => latitudeOf(b) - latitudeOf(a) || a.localeCompare(b));
  const n = Math.max(0, Math.min(byNorth.length, northPlaces));
  return { north: byNorth.slice(0, n), south: byNorth.slice(n) };
}
