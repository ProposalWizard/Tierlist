/**
 * GROUNDS.
 *
 * Real stadium names and rough capacities for the clubs this game actually
 * plays — the Premier League and Championship lists in clubs.ts, plus the
 * standalone promotion-pool sides. Traditional/common names rather than
 * whatever a naming-rights deal currently says, the same call the rest of
 * the codebase makes for anything that changes hands more often than the
 * football does (a shirt sponsor, a stand's naming rights) — it ages better
 * and it's still how most fans actually say it.
 *
 * A club missing from this table (a European or international opponent,
 * mainly) gets a generic fallback rather than breaking the scout report —
 * see groundFor below.
 */

export interface Ground {
  name: string;
  capacity: number;
}

export const GROUNDS: Record<string, Ground> = {
  // ── Premier League ──
  "Arsenal": { name: "Emirates Stadium", capacity: 60704 },
  "AFC Bournemouth": { name: "Vitality Stadium", capacity: 11364 },
  "Liverpool": { name: "Anfield", capacity: 61276 },
  "Leeds United": { name: "Elland Road", capacity: 37890 },
  "Crystal Palace": { name: "Selhurst Park", capacity: 25486 },
  "Brentford": { name: "Gtech Community Stadium", capacity: 17250 },
  "Hull City": { name: "MKM Stadium", capacity: 25586 },
  "Brighton & Hove Albion": { name: "Amex Stadium", capacity: 31800 },
  "Everton": { name: "Hill Dickinson Stadium", capacity: 52888 },
  "Newcastle United": { name: "St James' Park", capacity: 52305 },
  "Nottingham Forest": { name: "The City Ground", capacity: 30445 },
  "Ipswich Town": { name: "Portman Road", capacity: 30311 },
  "Manchester City": { name: "Etihad Stadium", capacity: 53400 },
  "Tottenham Hotspur": { name: "Tottenham Hotspur Stadium", capacity: 62850 },
  "Aston Villa": { name: "Villa Park", capacity: 42682 },
  "Chelsea": { name: "Stamford Bridge", capacity: 40343 },
  "Fulham FC": { name: "Craven Cottage", capacity: 29600 },
  "Sunderland": { name: "Stadium of Light", capacity: 46000 },
  "Manchester United": { name: "Old Trafford", capacity: 74310 },
  "Coventry City": { name: "Coventry Building Society Arena", capacity: 32609 },

  // ── Championship ──
  "Queens Park Rangers": { name: "Loftus Road", capacity: 18439 },
  "Millwall FC": { name: "The Den", capacity: 20146 },
  "Bolton Wanderers": { name: "University of Bolton Stadium", capacity: 28723 },
  "Watford": { name: "Vicarage Road", capacity: 22200 },
  "Middlesbrough": { name: "Riverside Stadium", capacity: 34742 },
  "Charlton Athletic": { name: "The Valley", capacity: 27111 },
  "Swansea City": { name: "Swansea.com Stadium", capacity: 21088 },
  "West Bromwich Albion": { name: "The Hawthorns", capacity: 26688 },
  "Blackburn Rovers": { name: "Ewood Park", capacity: 31367 },
  "Burnley": { name: "Turf Moor", capacity: 21944 },
  "West Ham United": { name: "London Stadium", capacity: 62500 },
  "Wolverhampton Wanderers": { name: "Molineux Stadium", capacity: 31750 },
  "Cardiff City": { name: "Cardiff City Stadium", capacity: 33280 },
  "Wrexham": { name: "The Racecourse Ground", capacity: 13500 },
  "Birmingham City": { name: "St Andrew's", capacity: 29409 },
  "Sheffield United": { name: "Bramall Lane", capacity: 32050 },
  "Lincoln City": { name: "LNER Stadium", capacity: 10669 },
  "Preston North End": { name: "Deepdale", capacity: 23408 },
  "Norwich City": { name: "Carrow Road", capacity: 27359 },
  "Stoke City": { name: "bet365 Stadium", capacity: 30089 },
  "Derby County": { name: "Pride Park Stadium", capacity: 33597 },
  "Portsmouth": { name: "Fratton Park", capacity: 20899 },
  "Bristol City": { name: "Ashton Gate", capacity: 27000 },
  "Southampton": { name: "St Mary's Stadium", capacity: 32384 },

  // ── Promotion pool / standalone ──
  "Luton Town": { name: "Kenilworth Road", capacity: 12300 },
  "Huddersfield Town": { name: "Accu Stadium", capacity: 24121 },
  "Leicester City": { name: "King Power Stadium", capacity: 32261 },
  "Reading FC": { name: "Select Car Leasing Stadium", capacity: 24161 },
  "Wigan Athletic": { name: "The DW Stadium", capacity: 25133 },
};

/** A generic ground for anyone missing from the table above (European and
 *  international opponents, mainly) — a fallback rather than a crash. */
export function groundFor(club: string): Ground {
  return GROUNDS[club] ?? { name: `${club} Stadium`, capacity: 28000 };
}

/**
 * A crowd for the day — most of capacity, not all of it. Seeded off the
 * club and week so it's stable across renders of the same fixture rather
 * than jumping around, but still varies match to match.
 */
export function crowdFor(club: string, week: number): number {
  const g = groundFor(club);
  let seed = week * 7919;
  for (let i = 0; i < club.length; i++) seed = (seed * 31 + club.charCodeAt(i)) | 0;
  const frac = ((seed >>> 0) % 1000) / 1000; // 0..1, deterministic
  const attendance = 0.82 + frac * 0.16; // 82%-98% full
  return Math.round(g.capacity * attendance / 50) * 50; // round to the nearest 50
}
