/**
 * REAL CLUB DATA — stadium, capacity, training/youth facility quality, and
 * world reputation for every one of this game's 125 real clubs.
 *
 * Requested directly, 14 Sep 2026: sourced from a real spreadsheet the user
 * built and handed over (`lib/star/data/football-club-database.csv` is the
 * exact original, kept verbatim for reference/audit) — stadium/capacity
 * figures grounded in current real-world usage, training/youth ratings and
 * reputation scored 1-10 by the user's own methodology (see that sheet's
 * "Methodology" tab), trophy counts sourced from UEFA/Premier League
 * material (see its "Sources" tab). This file is a straight, generated
 * mirror of that spreadsheet's "Club Database" sheet — every one of its 125
 * rows, cross-checked directly against clubs.ts's own combined roster
 * (PREMIER_LEAGUE_CLUBS/CHAMPIONSHIP_CLUBS/PROMOTION_POOL_CLUBS/OTHER_CLUBS/
 * CHAMPIONS_LEAGUE_CLUBS/EUROPA_LEAGUE_CLUBS) before ever being wired into
 * anything: exactly 125 distinct names on each side, a perfect 1:1 match,
 * no drift, no near-miss spelling. That match is exactly why this file can
 * be trusted as a lookup keyed by the game's own real club names, not a
 * name close to them — this game already has hard-won scars (see clubs.ts's
 * own header, euro.ts's) from exactly that class of silent mismatch.
 *
 * Ratings are 1-10, as given — this file does not decide what a "6" means
 * to any particular system; `facilities.ts`/`investments.ts` (the two real
 * consumers so far) each do their own mapping from these raw numbers into
 * whatever scale they actually need, documented at each call site.
 *
 * Currently wired into:
 *   - `facilities.ts`'s `defaultFacilities` — real stadium name/capacity,
 *     and training/youth tiers derived from `trainingRating`/`youthRating`.
 *   - `investments.ts`'s `realPrestigeFactor` — a real prestige multiplier
 *     derived from `currentReputation`, for all 125 clubs instead of the
 *     ~30 hand-typed ones this replaced.
 * Not yet used: `historicalReputation` (kept for a future feature that
 * actually wants it — nothing currently reads it).
 */

export interface ClubProfile {
  stadium: string;
  capacity: number;
  /** 1-10, this club's own real-world training-facility quality. */
  trainingRating: number;
  /** 1-10, this club's own real-world youth-academy quality. */
  youthRating: number;
  /** 1-10, current real-world global reputation/prestige. */
  currentReputation: number;
  /** 1-10, historical reputation — not yet read anywhere. */
  historicalReputation: number;
}

export const CLUB_DATABASE: Record<string, ClubProfile> = {
  "Arsenal": { stadium: "Emirates Stadium", capacity: 60704, trainingRating: 10, youthRating: 10, currentReputation: 9, historicalReputation: 8 },
  "AFC Bournemouth": { stadium: "Vitality Stadium", capacity: 11307, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Liverpool": { stadium: "Anfield", capacity: 61276, trainingRating: 9, youthRating: 10, currentReputation: 9, historicalReputation: 10 },
  "Leeds United": { stadium: "Elland Road", capacity: 40204, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Crystal Palace": { stadium: "Selhurst Park", capacity: 26309, trainingRating: 7, youthRating: 8, currentReputation: 6, historicalReputation: 6 },
  "Brentford": { stadium: "Gtech Community Stadium", capacity: 17250, trainingRating: 8, youthRating: 9, currentReputation: 6, historicalReputation: 5 },
  "Hull City": { stadium: "MKM Stadium", capacity: 25586, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Brighton & Hove Albion": { stadium: "Amex Stadium", capacity: 31872, trainingRating: 9, youthRating: 9, currentReputation: 6, historicalReputation: 5 },
  "Everton": { stadium: "Hill Dickinson Stadium", capacity: 52769, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Newcastle United": { stadium: "St James' Park", capacity: 52305, trainingRating: 8, youthRating: 8, currentReputation: 6, historicalReputation: 5 },
  "Nottingham Forest": { stadium: "The City Ground", capacity: 30576, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Ipswich Town": { stadium: "Portman Road", capacity: 30311, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Manchester City": { stadium: "Etihad Stadium", capacity: 55097, trainingRating: 10, youthRating: 10, currentReputation: 9, historicalReputation: 8 },
  "Tottenham Hotspur": { stadium: "Tottenham Hotspur Stadium", capacity: 62062, trainingRating: 9, youthRating: 9, currentReputation: 8, historicalReputation: 7 },
  "Aston Villa": { stadium: "Villa Park", capacity: 42657, trainingRating: 8, youthRating: 8, currentReputation: 7, historicalReputation: 7 },
  "Chelsea": { stadium: "Stamford Bridge", capacity: 40341, trainingRating: 10, youthRating: 10, currentReputation: 9, historicalReputation: 8 },
  "Fulham FC": { stadium: "Craven Cottage", capacity: 29589, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Sunderland": { stadium: "Stadium of Light", capacity: 49000, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Manchester United": { stadium: "Old Trafford", capacity: 75543, trainingRating: 9, youthRating: 9, currentReputation: 9, historicalReputation: 10 },
  "Coventry City": { stadium: "Coventry Building Society Arena", capacity: 32609, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Queens Park Rangers": { stadium: "Loftus Road", capacity: 18439, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Millwall FC": { stadium: "The Den", capacity: 20146, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Bolton Wanderers": { stadium: "Toughsheet Community Stadium", capacity: 28723, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Watford": { stadium: "Vicarage Road", capacity: 22200, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Middlesbrough": { stadium: "Riverside Stadium", capacity: 34642, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Charlton Athletic": { stadium: "The Valley", capacity: 27111, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Swansea City": { stadium: "Swansea.com Stadium", capacity: 21088, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "West Bromwich Albion": { stadium: "The Hawthorns", capacity: 26688, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Blackburn Rovers": { stadium: "Ewood Park", capacity: 31154, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Burnley": { stadium: "Turf Moor", capacity: 22546, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "West Ham United": { stadium: "London Stadium", capacity: 62500, trainingRating: 8, youthRating: 8, currentReputation: 5, historicalReputation: 5 },
  "Wolverhampton Wanderers": { stadium: "Molineux", capacity: 34624, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Cardiff City": { stadium: "Cardiff City Stadium", capacity: 33280, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Wrexham": { stadium: "STōK Cae Ras", capacity: 12565, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Birmingham City": { stadium: "St Andrew's @ Knighthead Park", capacity: 29309, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Sheffield United": { stadium: "Bramall Lane", capacity: 30369, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Lincoln City": { stadium: "LNER Stadium", capacity: 10120, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Preston North End": { stadium: "Deepdale", capacity: 23408, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Norwich City": { stadium: "Carrow Road", capacity: 27244, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Stoke City": { stadium: "bet365 Stadium", capacity: 30089, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Derby County": { stadium: "Pride Park Stadium", capacity: 33597, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Portsmouth": { stadium: "Fratton Park", capacity: 20899, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Bristol City": { stadium: "Ashton Gate", capacity: 27699, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Southampton": { stadium: "St Mary's Stadium", capacity: 32384, trainingRating: 8, youthRating: 9, currentReputation: 5, historicalReputation: 5 },
  "Luton Town": { stadium: "Kenilworth Road", capacity: 12056, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Huddersfield Town": { stadium: "John Smith's Stadium", capacity: 24121, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Leicester City": { stadium: "King Power Stadium", capacity: 32261, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Reading FC": { stadium: "Select Car Leasing Stadium", capacity: 24161, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "Wigan Athletic": { stadium: "DW Stadium", capacity: 25138, trainingRating: 5, youthRating: 5, currentReputation: 5, historicalReputation: 5 },
  "FC Schalke 04": { stadium: "Veltins-Arena", capacity: 62271, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "AS Monaco": { stadium: "Stade Louis II", capacity: 18523, trainingRating: 8, youthRating: 9, currentReputation: 8, historicalReputation: 7 },
  "RC Strasbourg Alsace": { stadium: "Stade de la Meinau", capacity: 29320, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Atalanta": { stadium: "Gewiss Stadium", capacity: 24900, trainingRating: 8, youthRating: 9, currentReputation: 6, historicalReputation: 5 },
  "Al Hilal": { stadium: "Kingdom Arena", capacity: 26262, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Al Nassr": { stadium: "Al-Awwal Park", capacity: 26700, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Al Ahli SFC": { stadium: "King Abdullah Sports City", capacity: 62345, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Al Ittihad": { stadium: "King Abdullah Sports City", capacity: 62345, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Sevilla FC": { stadium: "Ramón Sánchez-Pizjuán", capacity: 42714, trainingRating: 8, youthRating: 8, currentReputation: 8, historicalReputation: 7 },
  "Rangers FC": { stadium: "Ibrox Stadium", capacity: 50817, trainingRating: 8, youthRating: 8, currentReputation: 8, historicalReputation: 8 },
  "Hearts": { stadium: "Tynecastle Park", capacity: 19852, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Vitória SC": { stadium: "Estádio D. Afonso Henriques", capacity: 30514, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 5 },
  "Atlético Madrid": { stadium: "Riyadh Air Metropolitano", capacity: 70300, trainingRating: 8, youthRating: 8, currentReputation: 8, historicalReputation: 7 },
  "Borussia Dortmund": { stadium: "Signal Iduna Park", capacity: 81365, trainingRating: 9, youthRating: 10, currentReputation: 8, historicalReputation: 7 },
  "FC Barcelona": { stadium: "Spotify Camp Nou", capacity: 99354, trainingRating: 10, youthRating: 10, currentReputation: 9, historicalReputation: 10 },
  "FC Bayern München": { stadium: "Allianz Arena", capacity: 75024, trainingRating: 10, youthRating: 10, currentReputation: 9, historicalReputation: 10 },
  "Club Brugge KV": { stadium: "Jan Breydel Stadium", capacity: 29022, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Como": { stadium: "Stadio Giuseppe Sinigaglia", capacity: 13500, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Feyenoord": { stadium: "De Kuip", capacity: 51117, trainingRating: 8, youthRating: 9, currentReputation: 8, historicalReputation: 7 },
  "Galatasaray SK": { stadium: "Rams Park", capacity: 53200, trainingRating: 8, youthRating: 8, currentReputation: 8, historicalReputation: 7 },
  "Inter": { stadium: "San Siro", capacity: 75817, trainingRating: 8, youthRating: 8, currentReputation: 9, historicalReputation: 10 },
  "RB Leipzig": { stadium: "Red Bull Arena", capacity: 47069, trainingRating: 9, youthRating: 9, currentReputation: 7, historicalReputation: 7 },
  "RC Lens": { stadium: "Stade Bollaert-Delelis", capacity: 38223, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Lille OSC": { stadium: "Decathlon Arena – Stade Pierre-Mauroy", capacity: 50186, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Napoli": { stadium: "Stadio Diego Armando Maradona", capacity: 54726, trainingRating: 8, youthRating: 8, currentReputation: 8, historicalReputation: 7 },
  "Paris Saint-Germain": { stadium: "Parc des Princes", capacity: 47929, trainingRating: 9, youthRating: 8, currentReputation: 9, historicalReputation: 8 },
  "FC Porto": { stadium: "Estádio do Dragão", capacity: 50033, trainingRating: 9, youthRating: 9, currentReputation: 9, historicalReputation: 8 },
  "PSV": { stadium: "Philips Stadion", capacity: 35000, trainingRating: 9, youthRating: 10, currentReputation: 8, historicalReputation: 7 },
  "Real Betis Balompié": { stadium: "Estadio Benito Villamarín", capacity: 60721, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Real Madrid": { stadium: "Santiago Bernabéu", capacity: 83186, trainingRating: 10, youthRating: 10, currentReputation: 9, historicalReputation: 10 },
  "Roma": { stadium: "Stadio Olimpico", capacity: 70634, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Shakhtar Donetsk": { stadium: "Arena Lviv", capacity: 34915, trainingRating: 9, youthRating: 9, currentReputation: 7, historicalReputation: 7 },
  "SK Slavia Praha": { stadium: "Fortuna Arena", capacity: 19370, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Sporting CP": { stadium: "Estádio José Alvalade", capacity: 50195, trainingRating: 9, youthRating: 10, currentReputation: 8, historicalReputation: 7 },
  "VfB Stuttgart": { stadium: "MHPArena", capacity: 60449, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Villarreal CF": { stadium: "Estadio de la Cerámica", capacity: 23500, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "FK Bodø/Glimt": { stadium: "Aspmyra Stadion", capacity: 8270, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Celtic": { stadium: "Celtic Park", capacity: 60411, trainingRating: 8, youthRating: 8, currentReputation: 8, historicalReputation: 8 },
  "AEK Athens": { stadium: "OPAP Arena", capacity: 32500, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Olympique Lyonnais": { stadium: "Groupama Stadium", capacity: 59186, trainingRating: 9, youthRating: 9, currentReputation: 8, historicalReputation: 7 },
  "Fenerbahçe SK": { stadium: "Şükrü Saracoğlu Stadium", capacity: 47700, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Dinamo Zagreb": { stadium: "Stadion Maksimir", capacity: 35423, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "Eintracht Frankfurt": { stadium: "Deutsche Bank Park", capacity: 58000, trainingRating: 7, youthRating: 7, currentReputation: 7, historicalReputation: 7 },
  "AZ Alkmaar": { stadium: "AFAS Stadion", capacity: 19759, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "RC Celta": { stadium: "Abanca-Balaídos", capacity: 29000, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "TSG 1899 Hoffenheim": { stadium: "PreZero Arena", capacity: 30150, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Juventus": { stadium: "Allianz Stadium", capacity: 41507, trainingRating: 8, youthRating: 8, currentReputation: 9, historicalReputation: 10 },
  "Bayer 04 Leverkusen": { stadium: "BayArena", capacity: 30210, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Olympique de Marseille": { stadium: "Orange Vélodrome", capacity: 67394, trainingRating: 8, youthRating: 8, currentReputation: 8, historicalReputation: 7 },
  "AC Milan": { stadium: "San Siro", capacity: 75817, trainingRating: 8, youthRating: 8, currentReputation: 9, historicalReputation: 10 },
  "Olympiacos FC": { stadium: "Karaiskakis Stadium", capacity: 32115, trainingRating: 8, youthRating: 8, currentReputation: 8, historicalReputation: 7 },
  "Real Sociedad": { stadium: "Reale Arena", capacity: 39500, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Stade Rennais FC": { stadium: "Roazhon Park", capacity: 29778, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Sparta Praha": { stadium: "epet ARENA", capacity: 18944, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "SK Sturm Graz": { stadium: "Merkur Arena", capacity: 16764, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Union Saint-Gilloise": { stadium: "Stade Joseph Marien", capacity: 9400, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Ferencvárosi Torna Club": { stadium: "Groupama Arena", capacity: 22300, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "RSC Anderlecht": { stadium: "Lotto Park", capacity: 21500, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Lech Poznań": { stadium: "Stadion Poznań", capacity: 42000, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Trabzonspor": { stadium: "Papara Park", capacity: 41061, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "SL Benfica": { stadium: "Estádio da Luz", capacity: 65647, trainingRating: 9, youthRating: 10, currentReputation: 9, historicalReputation: 10 },
  "Beşiktaş JK": { stadium: "Tüpraş Stadium", capacity: 42590, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "FC Red Bull Salzburg": { stadium: "Red Bull Arena", capacity: 30188, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Shamrock Rovers": { stadium: "Tallaght Stadium", capacity: 10500, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Ajax": { stadium: "Johan Cruyff Arena", capacity: 55865, trainingRating: 10, youthRating: 10, currentReputation: 9, historicalReputation: 10 },
  "FC Midtjylland": { stadium: "MCH Arena", capacity: 11809, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "KRC Genk": { stadium: "Cegeka Arena", capacity: 23500, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "BSC Young Boys": { stadium: "Wankdorf Stadium", capacity: 31895, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "FC Basel 1893": { stadium: "St. Jakob-Park", capacity: 38512, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Malmö FF": { stadium: "Eleda Stadion", capacity: 22500, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Sporting Clube de Braga": { stadium: "Estádio Municipal de Braga", capacity: 30286, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "PAOK": { stadium: "Toumba Stadium", capacity: 28703, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Viktoria Plzeň": { stadium: "Doosan Arena", capacity: 12000, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Legia Warszawa": { stadium: "Stadion Wojska Polskiego", capacity: 31800, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "Lazio": { stadium: "Stadio Olimpico", capacity: 70634, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
  "FC København": { stadium: "Parken", capacity: 38065, trainingRating: 6, youthRating: 6, currentReputation: 6, historicalReputation: 6 },
};
