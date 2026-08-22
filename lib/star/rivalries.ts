/**
 * WHO DOESN'T LIKE WHO.
 *
 * Given directly, club by club, with a tier for how much IT matters to that
 * club and whether it's a geographical derby. Deliberately one-directional
 * rather than a single symmetric table: a rivalry's intensity is not always
 * mutual — Hull City rate Leeds United their biggest rivalry (R1) without
 * Leeds listing Hull among theirs at all, which is a real, asymmetric
 * football fact and not an oversight to "fix" into agreement.
 *
 * Not wired into anything yet. The data is saved so it survives between
 * sessions; every place it was asked for — transfer strategy (a club selling
 * or loaning to a direct rival is rare), match previews and social media
 * (naming a derby, raising the stakes of the commentary), a Derby day label
 * before kickoff — is still to build. Start there when asked, reading off
 * this file rather than re-deriving the list.
 *
 * Club names match lib/star/clubs.ts's spellings exactly (PREMIER_LEAGUE_
 * CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS — all forty-nine English
 * clubs this game currently models), not the shorthand they were given in
 * ("Bournemouth" here is "AFC Bournemouth", "QPR" is "Queens Park Rangers",
 * and so on) — the same lesson the Lineups club-name bugs this session
 * already taught the hard way: a lookup against these lists only works if
 * the spelling actually matches what the rest of the game calls the club.
 */

export type RivalryTier = "R1" | "R2" | "R3";

export interface Rivalry {
  /** The rival club, spelled the way lib/star/clubs.ts spells it. */
  club: string;
  /**
   * How much THIS club (the key this rivalry sits under) rates it.
   * R1 primary, R2 major, R3 lesser/historical. Absent when a club is
   * geographically close enough to be a derby without being rated a real
   * rivalry (Chelsea–Fulham, Chelsea–Brentford — both derby-only, no tier).
   */
  tier?: RivalryTier;
  /** A geographical derby, independent of how fierce the rivalry is rated. */
  derby: boolean;
  /** The name the derby actually goes by, when it has one. */
  derbyName?: string;
}

export const CLUB_RIVALRIES: Record<string, Rivalry[]> = {
  "Arsenal": [
    { club: "Tottenham Hotspur", tier: "R1", derby: true, derbyName: "North London Derby" },
    { club: "Chelsea", tier: "R2", derby: true },
    { club: "Manchester United", tier: "R2", derby: false },
    { club: "Manchester City", tier: "R3", derby: false },
  ],
  "Aston Villa": [
    { club: "Birmingham City", tier: "R1", derby: true, derbyName: "Second City Derby" },
    { club: "West Bromwich Albion", tier: "R2", derby: true },
    { club: "Wolverhampton Wanderers", tier: "R2", derby: true },
    { club: "Coventry City", tier: "R3", derby: true },
  ],
  "AFC Bournemouth": [
    { club: "Southampton", tier: "R1", derby: true, derbyName: "New Forest / South Coast rivalry" },
  ],
  "Brentford": [
    { club: "Fulham FC", tier: "R1", derby: true },
    { club: "Queens Park Rangers", tier: "R2", derby: true },
    { club: "Chelsea", tier: "R3", derby: true },
  ],
  "Brighton & Hove Albion": [
    { club: "Crystal Palace", tier: "R1", derby: true, derbyName: "M23 Derby" },
  ],
  "Chelsea": [
    { club: "Tottenham Hotspur", tier: "R1", derby: true },
    { club: "Arsenal", tier: "R2", derby: true },
    { club: "West Ham United", tier: "R2", derby: true },
    { club: "Leeds United", tier: "R3", derby: false },
    { club: "Fulham FC", derby: true },
    { club: "Brentford", derby: true },
  ],
  "Crystal Palace": [
    { club: "Brighton & Hove Albion", tier: "R1", derby: true, derbyName: "M23 Derby" },
    { club: "Millwall FC", tier: "R2", derby: true },
    { club: "Charlton Athletic", tier: "R2", derby: true },
    { club: "Chelsea", tier: "R3", derby: true },
    { club: "Fulham FC", derby: true },
  ],
  "Everton": [
    { club: "Liverpool", tier: "R1", derby: true, derbyName: "Merseyside Derby" },
    { club: "Manchester United", tier: "R2", derby: false },
  ],
  "Fulham FC": [
    { club: "Queens Park Rangers", tier: "R1", derby: true },
    { club: "Chelsea", tier: "R2", derby: true },
    { club: "Brentford", tier: "R2", derby: true },
    { club: "Crystal Palace", tier: "R3", derby: true },
  ],
  "Hull City": [
    { club: "Leeds United", tier: "R1", derby: false },
    { club: "Sheffield United", tier: "R2", derby: false },
  ],
  "Ipswich Town": [
    { club: "Norwich City", tier: "R1", derby: true, derbyName: "East Anglian Derby" },
    { club: "West Ham United", tier: "R3", derby: false },
  ],
  "Leeds United": [
    { club: "Manchester United", tier: "R1", derby: false, derbyName: "Roses rivalry" },
    { club: "Chelsea", tier: "R2", derby: false },
    { club: "Millwall FC", tier: "R2", derby: false },
    { club: "Sheffield United", tier: "R2", derby: true },
    { club: "Huddersfield Town", tier: "R2", derby: true },
    { club: "Derby County", tier: "R3", derby: false },
    { club: "Leicester City", tier: "R3", derby: false },
    { club: "Birmingham City", tier: "R3", derby: false },
  ],
  "Liverpool": [
    // Given directly as a special note: rated by both sets of supporters as
    // one of the biggest rivalries in English football full stop — often
    // considered bigger to both than either club's own local derby.
    { club: "Manchester United", tier: "R1", derby: false, derbyName: "North West rivalry" },
    { club: "Everton", tier: "R1", derby: true, derbyName: "Merseyside Derby" },
    { club: "Manchester City", tier: "R2", derby: false },
    { club: "Chelsea", tier: "R2", derby: false },
  ],
  "Manchester City": [
    { club: "Manchester United", tier: "R1", derby: true, derbyName: "Manchester Derby" },
    { club: "Liverpool", tier: "R2", derby: false },
    { club: "Arsenal", tier: "R3", derby: false },
  ],
  "Manchester United": [
    { club: "Liverpool", tier: "R1", derby: false, derbyName: "North West rivalry" },
    { club: "Manchester City", tier: "R1", derby: true, derbyName: "Manchester Derby" },
    { club: "Leeds United", tier: "R1", derby: false, derbyName: "Roses rivalry" },
    { club: "Arsenal", tier: "R2", derby: false },
    { club: "Chelsea", tier: "R2", derby: false },
  ],
  "Newcastle United": [
    { club: "Sunderland", tier: "R1", derby: true, derbyName: "Tyne-Wear Derby" },
    { club: "Middlesbrough", tier: "R2", derby: true },
  ],
  "Nottingham Forest": [
    { club: "Derby County", tier: "R1", derby: true, derbyName: "East Midlands Derby" },
    { club: "Leicester City", tier: "R2", derby: true },
    { club: "Birmingham City", tier: "R3", derby: false },
  ],
  "Sunderland": [
    { club: "Newcastle United", tier: "R1", derby: true, derbyName: "Tyne-Wear Derby" },
    { club: "Middlesbrough", tier: "R2", derby: true },
  ],
  "Tottenham Hotspur": [
    { club: "Arsenal", tier: "R1", derby: true, derbyName: "North London Derby" },
    { club: "Chelsea", tier: "R2", derby: true },
    { club: "West Ham United", tier: "R2", derby: true },
    { club: "Manchester United", tier: "R3", derby: false },
  ],
  "Coventry City": [
    { club: "Birmingham City", tier: "R1", derby: true },
    { club: "Leicester City", tier: "R2", derby: true },
    { club: "Aston Villa", tier: "R3", derby: true },
    { club: "Wolverhampton Wanderers", tier: "R3", derby: true },
    { club: "West Bromwich Albion", tier: "R3", derby: false },
  ],
  "Queens Park Rangers": [
    { club: "Fulham FC", tier: "R1", derby: true },
    { club: "Chelsea", tier: "R2", derby: true },
    { club: "Brentford", tier: "R2", derby: true },
    { club: "Millwall FC", tier: "R2", derby: true },
    { club: "Watford", tier: "R3", derby: true },
    { club: "Luton Town", tier: "R3", derby: true },
  ],
  "Millwall FC": [
    { club: "West Ham United", tier: "R1", derby: true },
    { club: "Crystal Palace", tier: "R2", derby: true },
    { club: "Charlton Athletic", tier: "R2", derby: true },
    { club: "Leeds United", tier: "R2", derby: false },
  ],
  "Bolton Wanderers": [
    { club: "Wigan Athletic", tier: "R1", derby: true },
    { club: "Blackburn Rovers", tier: "R2", derby: false },
    { club: "Burnley", tier: "R2", derby: false },
    { club: "Preston North End", tier: "R2", derby: false },
  ],
  "Watford": [
    { club: "Luton Town", tier: "R1", derby: true, derbyName: "Beds-Herts Derby" },
    { club: "Queens Park Rangers", tier: "R2", derby: true },
    { club: "Crystal Palace", tier: "R3", derby: false },
  ],
  "Middlesbrough": [
    { club: "Sunderland", tier: "R1", derby: true },
    { club: "Newcastle United", tier: "R2", derby: true },
  ],
  "Charlton Athletic": [
    { club: "Millwall FC", tier: "R1", derby: true },
    { club: "Crystal Palace", tier: "R2", derby: true },
  ],
  "Swansea City": [
    { club: "Cardiff City", tier: "R1", derby: true, derbyName: "South Wales Derby" },
    { club: "Bristol City", tier: "R2", derby: false },
  ],
  "West Bromwich Albion": [
    { club: "Wolverhampton Wanderers", tier: "R1", derby: true, derbyName: "Black Country Derby" },
    { club: "Aston Villa", tier: "R2", derby: true },
    { club: "Birmingham City", tier: "R2", derby: true },
    { club: "Stoke City", tier: "R3", derby: false },
  ],
  "Blackburn Rovers": [
    { club: "Burnley", tier: "R1", derby: true, derbyName: "East Lancashire Derby" },
    { club: "Bolton Wanderers", tier: "R2", derby: false },
    { club: "Preston North End", tier: "R2", derby: false },
    { club: "Wigan Athletic", tier: "R3", derby: false },
  ],
  "Burnley": [
    { club: "Blackburn Rovers", tier: "R1", derby: true, derbyName: "East Lancashire Derby" },
    { club: "Preston North End", tier: "R2", derby: false },
    { club: "Bolton Wanderers", tier: "R3", derby: false },
  ],
  "West Ham United": [
    { club: "Millwall FC", tier: "R1", derby: true },
    { club: "Tottenham Hotspur", tier: "R2", derby: true },
    { club: "Chelsea", tier: "R2", derby: true },
    { club: "Ipswich Town", tier: "R3", derby: false },
  ],
  "Wolverhampton Wanderers": [
    { club: "West Bromwich Albion", tier: "R1", derby: true, derbyName: "Black Country Derby" },
    { club: "Aston Villa", tier: "R2", derby: true },
    { club: "Birmingham City", tier: "R2", derby: true },
    { club: "Stoke City", tier: "R3", derby: false },
  ],
  "Cardiff City": [
    { club: "Swansea City", tier: "R1", derby: true, derbyName: "South Wales Derby" },
    { club: "Bristol City", tier: "R2", derby: true },
    { club: "Wrexham", tier: "R3", derby: false },
  ],
  "Wrexham": [
    { club: "Cardiff City", tier: "R1", derby: false },
  ],
  "Birmingham City": [
    { club: "Aston Villa", tier: "R1", derby: true, derbyName: "Second City Derby" },
    { club: "Coventry City", tier: "R2", derby: true },
    { club: "West Bromwich Albion", tier: "R2", derby: true },
    { club: "Wolverhampton Wanderers", tier: "R2", derby: true },
    { club: "Leeds United", tier: "R3", derby: false },
  ],
  "Sheffield United": [
    { club: "Leeds United", tier: "R1", derby: true },
    { club: "Hull City", tier: "R2", derby: false },
  ],
  // No major rivalry given within the game's forty-nine.
  "Lincoln City": [],
  "Preston North End": [
    { club: "Blackburn Rovers", tier: "R1", derby: false },
    { club: "Burnley", tier: "R1", derby: true },
    { club: "Bolton Wanderers", tier: "R2", derby: false },
    { club: "Wigan Athletic", tier: "R2", derby: false },
  ],
  "Norwich City": [
    { club: "Ipswich Town", tier: "R1", derby: true, derbyName: "East Anglian Derby" },
  ],
  "Stoke City": [
    { club: "Wolverhampton Wanderers", tier: "R2", derby: false },
    { club: "West Bromwich Albion", tier: "R2", derby: false },
  ],
  "Derby County": [
    { club: "Nottingham Forest", tier: "R1", derby: true, derbyName: "East Midlands Derby" },
    { club: "Leicester City", tier: "R2", derby: true },
    { club: "Leeds United", tier: "R3", derby: false },
  ],
  "Portsmouth": [
    { club: "Southampton", tier: "R1", derby: true, derbyName: "South Coast Derby" },
  ],
  "Bristol City": [
    { club: "Cardiff City", tier: "R1", derby: true, derbyName: "Severnside Derby" },
    { club: "Swansea City", tier: "R2", derby: false },
  ],
  "Southampton": [
    { club: "Portsmouth", tier: "R1", derby: true, derbyName: "South Coast Derby" },
    { club: "AFC Bournemouth", tier: "R2", derby: true },
  ],
  "Leicester City": [
    { club: "Nottingham Forest", tier: "R1", derby: true, derbyName: "East Midlands Derby" },
    { club: "Derby County", tier: "R2", derby: true },
    { club: "Coventry City", tier: "R2", derby: true },
    { club: "Leeds United", tier: "R3", derby: false },
  ],
  "Luton Town": [
    { club: "Watford", tier: "R1", derby: true, derbyName: "Beds-Herts Derby" },
    { club: "Queens Park Rangers", tier: "R3", derby: false },
  ],
  "Huddersfield Town": [
    { club: "Leeds United", tier: "R1", derby: true },
    { club: "Nottingham Forest", tier: "R3", derby: false },
  ],
  // No major rivalry given within the game's forty-nine.
  "Reading FC": [],
  "Wigan Athletic": [
    { club: "Bolton Wanderers", tier: "R1", derby: true },
    { club: "Blackburn Rovers", tier: "R2", derby: false },
    { club: "Preston North End", tier: "R2", derby: false },
    { club: "Manchester City", tier: "R3", derby: false },
  ],
};

/** Everything `club` feels about `opponent` — absent if nothing was given. */
export function rivalryOf(club: string, opponent: string): Rivalry | null {
  return CLUB_RIVALRIES[club]?.find(r => r.club === opponent) ?? null;
}

/**
 * Is this fixture a derby at all, from either side?
 *
 * Checked both directions on purpose — the source data is one-directional by
 * intensity (a rivalry can matter more to one side than the other), but a
 * geographical derby is a fact about two clubs' grounds, not an opinion, so a
 * derby flagged on only one side is far more likely a gap in that club's own
 * list than a real disagreement. Confirmed in the source data itself: every
 * derby pairing checked so far agrees on both sides.
 */
export function isDerby(clubA: string, clubB: string): boolean {
  return !!rivalryOf(clubA, clubB)?.derby || !!rivalryOf(clubB, clubA)?.derby;
}

/** The name this fixture actually goes by, when it has one, from either side. */
export function derbyName(clubA: string, clubB: string): string | null {
  return rivalryOf(clubA, clubB)?.derbyName ?? rivalryOf(clubB, clubA)?.derbyName ?? null;
}

/**
 * The strongest tier either side rates this fixture — R1 if either club
 * calls it their primary rivalry, even if the other side rates it lower or
 * doesn't list it at all (Hull City's biggest rivalry is Leeds United; Leeds
 * do not list Hull among theirs — this fixture is still an R1 occasion for
 * one dressing room and the stands on that side).
 */
export function strongestTier(clubA: string, clubB: string): RivalryTier | null {
  const tiers = [rivalryOf(clubA, clubB)?.tier, rivalryOf(clubB, clubA)?.tier].filter(Boolean) as RivalryTier[];
  if (tiers.includes("R1")) return "R1";
  if (tiers.includes("R2")) return "R2";
  if (tiers.includes("R3")) return "R3";
  return null;
}
