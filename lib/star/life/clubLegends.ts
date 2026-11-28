/**
 * THE 26 CLUB LEGENDS (story world plan part 3, job B, 28 Nov 2026).
 *
 * Harry's answer (plan part 7, question 3, suggested and taken): a FIXED legend at each of the 20
 * English and 6 European hook clubs, the same man in every career ("it makes them feel real"). Every
 * one is invented; no real footballer, brand or stand name. Each club's other club people still come
 * from the pool.
 *
 * Only for a career's NEW club: when a story casts `club:legend@<club code>` at one of these clubs
 * (a club you moved to), pool.ts poolPerson returns this man and arcs.ts pins him in `life.cpool` as
 * usual. The career's FIRST club keeps the plain id and its pool pick, so a save that has already met
 * its first club's legend keeps him; a legend already pinned at a club also stays. The European six
 * cannot be joined (no moves abroad), so theirs are met on European nights only, through stories.
 *
 * Lines read him as any pool person: {legend.short} (his surname, as the pool legends), {legend.name},
 * {legend.age}, {legend.from}, {legend.signoff}. Never write a name into a story (lifeArcs.mts fails).
 */
import type { PoolPerson } from "./pool";

/** A fixed legend: a pool person plus the club slug (unlocks.ts clubSlug) and the club's name. */
export interface ClubLegend extends PoolPerson { slug: string; club: string; detail: string }

const L = (slug: string, club: string, id: string, first: string, last: string, age: number, from: string, look: string, signoff: string, manner: string, detail: string): ClubLegend =>
  ({ slug, club, id, first, last, short: last, age, from, look, signoff, manner, detail });

export const CLUB_LEGENDS: ClubLegend[] = [
  // ── English ──
  L("manchester-united", "Manchester United", "cl-penhale", "Walter", "Penhale", 81, "Salford", "mgr-silver-fox", "W. Penhale", "Inside forward, 1963-74. Courteous, unhurried, never inside the heritage room.", "Keeps a pocket watch stopped at the minute of his first goal."),
  L("liverpool", "Liverpool", "cl-calloway", "Eddie", "Calloway", 73, "Bootle", "mgr-old-pro", "Eddie C", "Centre half, 1971-83. Firm handshake, soft voice, a long memory.", "Tapes his wedding ring before he shakes your hand, out of habit."),
  L("arsenal", "Arsenal", "cl-thorne", "Reggie", "Thorne", 59, "Islington", "mgr-silver-fox", "R. Thorne", "Left back, 1986-98. Neat, precise, notices your shoes.", "Irons his own laces."),
  L("chelsea", "Chelsea", "cl-delacourt", "Frankie", "Delacourt", 76, "Fulham, west London", "mgr-grey-fade", "Frankie D", "Winger, 1969-78. A charmer; still waves to the crowd from his seat.", "Wears a flower in his lapel every home game."),
  L("manchester-city", "Manchester City", "cl-ashby", "Norman", "Ashby", 69, "Stockport", "mgr-old-pro", "Norman", "Keeper, 1976-89, through the lean years. Dry, patient, counts everything.", "Counts the crowd from his seat every match."),
  L("tottenham-hotspur", "Tottenham Hotspur", "cl-marchetti", "Lenny", "Marchetti", 64, "Enfield", "mgr-bald-stubble", "Lenny M", "Playmaker, 1981-92. Warm, theatrical, marks everything out of ten.", "Whistles opera in the tunnel."),
  L("newcastle-united", "Newcastle United", "cl-rennison", "Billy", "Rennison", 76, "Wallsend", "mgr-old-pro", "Billy R", "Centre forward, 1968-79. Proud, talkative, tells the same derby story every week.", "Still walks to the ground from the river every match day."),
  L("everton", "Everton", "cl-gilfoyle", "Tommy", "Gilfoyle", 82, "Walton", "mgr-grey-fade", "Tommy G", "Midfielder, 1962-73. Kind, sly, never without his tin.", "Carries a tin of travel sweets and gives one to every debutant."),
  L("aston-villa", "Aston Villa", "cl-pendry", "Arthur", "Pendry", 68, "Erdington", "mgr-silver-fox", "A. Pendry", "Centre half, 1977-85. Quiet, steady, keeps his best night in his wallet.", "Keeps a European final ticket stub in his wallet."),
  L("west-ham-united", "West Ham United", "cl-fenwick", "Georgie", "Fenwick", 80, "Canning Town", "mgr-bald-stubble", "Georgie", "Full back, 1964-80, academy-made. Chirpy, loyal, smells faintly of the loft.", "Keeps racing pigeons."),
  L("leeds-united", "Leeds United", "cl-ormsby", "Jack", "Ormsby", 76, "Beeston", "mgr-old-pro", "J. Ormsby", "Hard midfielder, 1968-78. Blunt, wary, kinder than he lets on.", "Never sits with his back to a door."),
  L("nottingham-forest", "Nottingham Forest", "cl-tarrant", "Colin", "Tarrant", 68, "Clifton", "mgr-grey-fade", "Colin T", "Winger, 1977-84. Two European nights; modest about both.", "Keeps a tea towel of that team on his kitchen wall."),
  L("sunderland", "Sunderland", "cl-dunstone", "Hal", "Dunstone", 79, "Roker", "mgr-old-pro", "Hal", "Keeper, 1966-79. Gentle, stubborn, a man of habits.", "Does one lap of the pitch on his birthday, every year."),
  L("wolverhampton-wanderers", "Wolverhampton Wanderers", "cl-bickerstaff", "Ronnie", "Bickerstaff", 73, "Bilston", "mgr-bald-stubble", "Ronnie B", "Forward, 1972-82. Funny, restless, runs a charity five-a-side.", "Keeps the floodlight bulb that blew in his best game."),
  L("leicester-city", "Leicester City", "cl-pryor", "Desmond", "Pryor", 54, "Braunstone", "mgr-bald-stubble", "Des", "Striker, 1991-2001. Easy company; every story ends with the fox.", "Tells the same story about a fox in the car park."),
  L("crystal-palace", "Crystal Palace", "cl-abara", "Kenny", "Abara", 57, "Thornton Heath", "mgr-bald-stubble", "Kenny A", "Winger, 1988-96. Loud, joyful, first on the canteen floor.", "Dances in the canteen."),
  L("southampton", "Southampton", "cl-lisle", "Graham", "Lisle", 70, "Woolston", "mgr-silver-fox", "G. Lisle", "Midfielder, 1975-88, then academy coach. Patient, a teacher to the bone.", "Carries a tide table."),
  L("derby-county", "Derby County", "cl-hemsworth", "Clive", "Hemsworth", 75, "Normanton", "mgr-old-pro", "C. Hemsworth", "Centre half, 1970-79. Earthy, proud, grumbles at clean boots.", "Leaves mud on his shoes on purpose."),
  L("middlesbrough", "Middlesbrough", "cl-crane", "Albert", "Crane", 74, "South Bank", "mgr-grey-fade", "Albert", "Striker, 1971-80. Plain, hard-working, keeps scores in a notebook.", "Worked a steel shift before early matches."),
  L("brighton-hove-albion", "Brighton & Hove Albion", "cl-quell", "Maurice", "Quell", 66, "Hove", "mgr-silver-fox", "Maurice Q", "Keeper, 1979-87. Bright, brisk, cold-water cheerful.", "Swims in the sea every morning, any weather."),
  // ── European (met on European nights) ──
  L("real-madrid", "Real Madrid", "cl-arribeta", "Tomás", "Arribeta", 65, "Madrid", "mgr-silver-fox", "T. Arribeta", "Holding midfielder, 1980-91. Grave, gracious, an old-fashioned host.", "Wears a black tie to every match."),
  L("fc-barcelona", "FC Barcelona", "cl-rovellat", "Pau", "Rovellat", 56, "Sabadell", "mgr-grey-fade", "Pau", "Centre half, 1989-99. Thoughtful, slow to speak, quick to see.", "Plays chess in the kit room."),
  L("fc-bayern-munchen", "FC Bayern München", "cl-wendemuth", "Klaus", "Wendemuth", 72, "Rosenheim", "mgr-silver-fox", "K. Wendemuth", "Sweeper, 1972-83. Exact, courteous, early for everything.", "Sets his watch by the stadium clock."),
  L("juventus", "Juventus", "cl-ferrabrini", "Aldo", "Ferrabrini", 62, "Turin", "mgr-silver-fox", "Aldo F", "Full back, 1982-93. Formal, warm once he knows you.", "Wears a tie on match days and folds it into his pocket at kick-off."),
  L("ac-milan", "AC Milan", "cl-liveri", "Sandro", "Liveri", 55, "Monza", "mgr-grey-fade", "Sandro", "Centre half, 1990-2002. Calm, playful, hands always busy.", "Folds paper napkins into swans."),
  L("paris-saint-germain", "Paris Saint-Germain", "cl-doumbe", "Yannick", "Doumbé", 54, "Saint-Denis", "mgr-bald-stubble", "Yannick D", "Winger, 1991-2000. Dreamy, quick-witted, writes everything down.", "Writes poems on the back of team sheets."),
];

/** A club's 4-letter code (the same as people.ts clubCode; copied here so pool.ts needs no people.ts). */
function code(club: string): string {
  let h = 2166136261;
  for (let i = 0; i < club.length; i++) h = Math.imul(h ^ club.charCodeAt(i), 16777619) >>> 0;
  return (h % 36 ** 4).toString(36).padStart(4, "0");
}

const BY_CODE = new Map(CLUB_LEGENDS.map((l) => [code(l.club), l]));
const BY_ID = new Map(CLUB_LEGENDS.map((l) => [l.id, l]));

/** The fixed legend at the club with this code (people.ts clubCode), or undefined. */
export const clubLegendAt = (clubCode: string): ClubLegend | undefined => BY_CODE.get(clubCode);
/** A fixed legend by his id (a pin in life.cpool). */
export const clubLegendById = (id: string): ClubLegend | undefined => BY_ID.get(id);
