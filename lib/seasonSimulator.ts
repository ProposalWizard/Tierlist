export interface PlayerAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  finishing: number;
  positioning: number;
  crossing: number;
  vision: number;
  longShots: number;
  shortPassing: number;
  longPassing: number;
  heading: number;
  interceptions: number;
  standingTackle: number;
  marking: number;
  reactions: number;
  sprintSpeed: number;
  gkDiving: number;
  gkPositioning: number;
  gkReflexes: number;
}

export interface DraftPlayer {
  name: string;
  overall: number;
  positions: string;
  club: string;
  clubYear: string;
  assignedPosition: string;
  age: number;
  isSub?: boolean;
  attrs?: PlayerAttributes;
  image_url?: string | null;
}

export interface MatchResult {
  opponent: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  goalScorers: { player: string; minute: number }[];
  assistProviders: { player: string; minute: number }[];
  result: 'W' | 'D' | 'L';
}

export interface FaCupMatch {
  round: string;
  opponent: string;
  goalsFor: number;
  goalsAgainst: number;
  extraTime: boolean;
  penalties: boolean;
  penaltyScore?: { player: number; opponent: number };
  goalScorers: { player: string; minute: number }[];
  assistProviders: { player: string; minute: number }[];
  result: 'W' | 'L';
  // Two-legged tie (League Cup semi-final): leg2 holds the second leg details
  leg2?: {
    goalsFor: number;
    goalsAgainst: number;
    isHome: boolean;
    extraTime: boolean;
    penalties: boolean;
    penaltyScore?: { player: number; opponent: number };
    goalScorers: { player: string; minute: number }[];
  };
  isHome?: boolean; // which leg was home for leg1 in a 2-legged tie
}

export interface FaCupResult {
  matches: FaCupMatch[];
  winner: boolean;
  exitRound: string | null;
  faCupWinner: string;
}

export interface UCLMatch {
  opponent: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'D' | 'L';
  goalScorers: { player: string; minute: number }[];
  assistProviders: { player: string; minute: number }[];
  extraTime?: boolean;
  penalties?: boolean;
  penaltyScore?: { player: number; opponent: number };
}

export interface UCLKnockoutTie {
  round: string;
  opponent: string;
  leg1: UCLMatch;
  leg2?: UCLMatch;
  result: 'W' | 'L';
}

export interface UCLLeagueStanding {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isPlayer: boolean;
  strength: number;
}

export interface UCLResult {
  qualified: boolean;
  leagueMatches: UCLMatch[];
  leaguePosition: number;
  leagueTable: UCLLeagueStanding[];
  knockoutTies: UCLKnockoutTie[];
  winner: boolean;
  exitStage: string | null;
  tournamentWinner: string;
}

export interface PlayerStats {
  name: string;
  assignedPosition: string;
  goals: number;
  assists: number;
  cleanSheets: number;
  appearances: number;
  avgRating: number;
  image_url?: string | null;
}

export interface LeagueTeam {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isPlayer: boolean;
}

export interface SuperCupResult {
  played: boolean;
  opponent: string;
  opponentRole: 'UCL Winner' | 'UEL Winner';
  playerRole: 'UCL Winner' | 'UEL Winner';
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'L';
  goalScorers: { player: string; minute: number }[];
  assistProviders: { player: string; minute: number }[];
  extraTime?: boolean;
  penalties?: boolean;
  penaltyScore?: { player: number; opponent: number };
}

export interface CharityShieldResult {
  played: boolean;
  opponent: string;
  opponentRole: 'PL Winner' | 'FA Cup Winner' | 'PL Runner-Up';
  playerRole: 'PL Winner' | 'FA Cup Winner';
  goalsFor: number;
  goalsAgainst: number;
  result: 'W' | 'L';
  goalScorers: { player: string; minute: number }[];
  assistProviders: { player: string; minute: number }[];
  extraTime?: boolean;
  penalties?: boolean;
  penaltyScore?: { player: number; opponent: number };
}

export interface SeasonResult {
  matches: MatchResult[];
  playerStats: PlayerStats[];
  plPlayerStats: PlayerStats[];
  leagueTable: LeagueTeam[];
  teamRecord: {
    wins: number;
    draws: number;
    losses: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
  };
  awards: {
    goldenBoot: { name: string; goals: number };
    playmaker: { name: string; assists: number };
    goldenGlove: { name: string; cleanSheets: number };
    playerOfSeason: { name: string; avgRating: number };
  };
  biggestWin: { opponent: string; score: string };
  worstDefeat: { opponent: string; score: string };
  highestScoring: { opponent: string; score: string };
  longestWinStreak: number;
  longestUnbeatenRun: number;
  trailingWinStreak: number;
  trailingUnbeatenRun: number;
  leadingWinStreak: number;
  leadingUnbeatenRun: number;
  projectedFinish: number;
  actualFinish: number;
  performance: 'OVERPERFORMED' | 'AS EXPECTED' | 'UNDERPERFORMED';
  phaseRatings: PhaseRatings;
  faCup: FaCupResult;
  leagueCup: FaCupResult;
  ucl?: UCLResult;
  uel?: UCLResult;
  superCup?: SuperCupResult;
  charityShield?: CharityShieldResult;
  uclTournamentWinner?: string;
  uelTournamentWinner?: string;
  allFixtures?: SeasonWeek[];
}

// --- Seeded PRNG (mulberry32) ---

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Default PL teams ---

// Fixed English representatives for Season 1 European competitions (no previous table yet)
export const SEASON1_UCL_PL_TEAMS: { name: string; strength: number }[] = [
  { name: 'Arsenal', strength: 88.5 },
  { name: 'Man City', strength: 88.5 },
  { name: 'Liverpool', strength: 87 },
  { name: 'Man United', strength: 85 },
  { name: 'Aston Villa', strength: 82.5 },
];
export const SEASON1_UEL_PL_TEAMS: { name: string; strength: number }[] = [
  { name: 'Bournemouth', strength: 80 },
  { name: 'Crystal Palace', strength: 79 },
  { name: 'Sunderland', strength: 70 },
];

export const DEFAULT_PL_TEAMS: { name: string; strength: number }[] = [
  { name: 'Man City', strength: 88.5 },
  { name: 'Arsenal', strength: 88.5 },
  { name: 'Liverpool', strength: 87 },
  { name: 'Man United', strength: 85 },
  { name: 'Chelsea', strength: 83 },
  { name: 'Aston Villa', strength: 82.5 },
  { name: 'Tottenham', strength: 82.5 },
  { name: 'Newcastle', strength: 81 },
  { name: 'Bournemouth', strength: 80 },
  { name: 'Brighton', strength: 80 },
  { name: 'Crystal Palace', strength: 79 },
  { name: 'Brentford', strength: 79 },
  { name: 'Everton', strength: 78 },
  { name: 'Nottm Forest', strength: 78 },
  { name: 'Fulham', strength: 78 },
  { name: 'Leeds', strength: 78 },
  { name: 'Coventry', strength: 76 },
  { name: 'Ipswich', strength: 75 },
  { name: 'Hull', strength: 74 },
];

export const RESERVE_TEAMS: { name: string; strength: number }[] = [
  { name: 'Wolves', strength: 76 },
  { name: 'Millwall', strength: 76 },
  { name: 'Southampton', strength: 76 },
  { name: 'Middlesbrough', strength: 76 },
  { name: 'Wrexham', strength: 76 },
  { name: 'Burnley', strength: 75 },
  { name: 'West Ham', strength: 75 },
  { name: 'Stoke', strength: 75 },
  { name: 'Norwich', strength: 75 },
  { name: 'Swansea', strength: 75 },
  { name: 'Sheffield', strength: 75 },
  { name: 'Watford', strength: 75 },
];

const ALL_TEAMS_POOL: { name: string; strength: number }[] = [...DEFAULT_PL_TEAMS, ...RESERVE_TEAMS];

// True when a (user-chosen) team name collides with any AI club that can
// appear in the league or cups. The shared league table is keyed by team
// name, so a human team named "Arsenal" would merge with the AI Arsenal into
// one corrupted row (19-team table, doubled stats) for every player.
export function isReservedTeamName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return [...ALL_TEAMS_POOL, ...LOWER_LEAGUE_CLUBS].some(t => t.name.toLowerCase() === n);
}

const LOWER_LEAGUE_CLUBS: { name: string; strength: number }[] = [
  { name: 'Sunderland', strength: 70 },
  { name: 'Bristol City', strength: 69 },
  { name: 'QPR', strength: 69 },
  { name: 'Derby', strength: 68 },
  { name: 'Cardiff', strength: 68 },
  { name: 'Plymouth', strength: 67 },
  { name: 'Luton', strength: 67 },
  { name: 'Blackburn', strength: 67 },
  { name: 'Preston', strength: 66 },
  { name: 'Oxford Utd', strength: 66 },
  { name: 'Portsmouth', strength: 66 },
  { name: 'Wigan', strength: 65 },
  { name: 'Bolton', strength: 65 },
  { name: 'Charlton', strength: 65 },
  { name: 'Reading', strength: 64 },
  { name: 'Barnsley', strength: 64 },
  { name: 'Exeter City', strength: 63 },
  { name: 'Stockport', strength: 63 },
  { name: 'MK Dons', strength: 62 },
  { name: 'Mansfield', strength: 62 },
];

export function getSeasonTeams(
  previousLeagueTable?: LeagueTeam[] | { name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; isPlayer?: boolean }[],
  promotionSeed?: number,
): { name: string; strength: number }[] {
  if (!previousLeagueTable || previousLeagueTable.length === 0) {
    return DEFAULT_PL_TEAMS;
  }

  const poolNames = new Set(ALL_TEAMS_POOL.map(t => t.name));
  const isAiTeam = (name: string) => poolNames.has(name);

  const aiTeamsInTable = previousLeagueTable.filter(t => isAiTeam(t.name));
  const relegated = aiTeamsInTable.slice(-3).map(t => t.name);

  const currentAiNames = new Set(aiTeamsInTable.map(t => t.name));
  const candidates = ALL_TEAMS_POOL.filter(t => !currentAiNames.has(t.name));

  // Weighted random promotion: higher strength = higher chance
  const rng = createRng(promotionSeed ?? 12345);
  const promoted: { name: string; strength: number }[] = [];
  const remaining = [...candidates];
  for (let i = 0; i < Math.min(relegated.length, remaining.length); i++) {
    const totalWeight = remaining.reduce((sum, t) => sum + t.strength, 0);
    let roll = rng() * totalWeight;
    let picked = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].strength;
      if (roll <= 0) { picked = j; break; }
    }
    promoted.push(remaining[picked]);
    remaining.splice(picked, 1);
  }

  const relegatedSet = new Set(relegated);
  const remainingTeams = aiTeamsInTable
    .filter(t => !relegatedSet.has(t.name))
    .map(t => {
      const pool = ALL_TEAMS_POOL.find(p => p.name === t.name);
      return { name: t.name, strength: pool?.strength ?? 75 };
    });

  return [...remainingTeams, ...promoted];
}

// --- UCL team data ---

const UCL_TEAMS: { pot: number; name: string; strength: number }[] = [
  // Pot 1 (7 non-PL slots; PL 1st+2nd fill the other 2)
  { pot: 1, name: 'Real Madrid', strength: 88 },
  { pot: 1, name: 'Bayern Munich', strength: 86 },
  { pot: 1, name: 'PSG', strength: 86 },
  { pot: 1, name: 'Barcelona', strength: 86 },
  { pot: 1, name: 'Inter Milan', strength: 83 },
  { pot: 1, name: 'Borussia Dortmund', strength: 82 },
  { pot: 1, name: 'Celtic', strength: 77 },
  // Pot 2 (8 non-PL slots; PL 3rd fills the other 1)
  { pot: 2, name: 'Atlético Madrid', strength: 83 },
  { pot: 2, name: 'Bayer Leverkusen', strength: 79 },
  { pot: 2, name: 'Juventus', strength: 81 },
  { pot: 2, name: 'Benfica', strength: 80 },
  { pot: 2, name: 'Roma', strength: 77 },
  { pot: 2, name: 'Villarreal', strength: 78 },
  { pot: 2, name: 'Eintracht Frankfurt', strength: 76 },
  { pot: 2, name: 'Club Brugge', strength: 75 },
  // Pot 3 (8 non-PL slots; PL 4th fills the other 1)
  { pot: 3, name: 'Napoli', strength: 80 },
  { pot: 3, name: 'Sporting CP', strength: 79 },
  { pot: 3, name: 'PSV Eindhoven', strength: 76 },
  { pot: 3, name: 'Marseille', strength: 78 },
  { pot: 3, name: 'Ajax', strength: 79 },
  { pot: 3, name: 'Olympiacos', strength: 75 },
  { pot: 3, name: 'Slavia Prague', strength: 75 },
  { pot: 3, name: 'Bodø/Glimt', strength: 74 },
  // Pot 4 (8 non-PL slots; PL 5th fills the other 1)
  { pot: 4, name: 'Athletic Bilbao', strength: 77 },
  { pot: 4, name: 'Monaco', strength: 78 },
  { pot: 4, name: 'Galatasaray', strength: 79 },
  { pot: 4, name: 'Copenhagen', strength: 71 },
  { pot: 4, name: 'Union Saint-Gilloise', strength: 69 },
  { pot: 4, name: 'Como', strength: 76 },
  { pot: 4, name: 'Qarabağ', strength: 65 },
  { pot: 4, name: 'Pafos', strength: 70 },
];

const UEL_TEAMS: { pot: number; name: string; strength: number }[] = [
  // Pot 1 (8 non-PL slots; PL 6th fills the other 1)
  { pot: 1, name: 'Atalanta', strength: 78 },
  { pot: 1, name: 'Porto', strength: 77 },
  { pot: 1, name: 'Rangers', strength: 72 },
  { pot: 1, name: 'Feyenoord', strength: 75 },
  { pot: 1, name: 'Lille', strength: 76 },
  { pot: 1, name: 'Dinamo Zagreb', strength: 70 },
  { pot: 1, name: 'Real Betis', strength: 74 },
  { pot: 1, name: 'Red Bull Salzburg', strength: 73 },
  // Pot 2 (8 non-PL slots; PL 7th fills the other 1)
  { pot: 2, name: 'Fenerbahçe', strength: 74 },
  { pot: 2, name: 'Braga', strength: 73 },
  { pot: 2, name: 'Lyon', strength: 75 },
  { pot: 2, name: 'PAOK', strength: 70 },
  { pot: 2, name: 'Viktoria Plzeň', strength: 67 },
  { pot: 2, name: 'Ferencváros', strength: 68 },
  { pot: 2, name: 'Celtic UEL', strength: 72 },
  { pot: 2, name: 'Maccabi', strength: 66 },
  // Pot 3
  { pot: 3, name: 'Young Boys', strength: 67 },
  { pot: 3, name: 'Basel', strength: 68 },
  { pot: 3, name: 'Midtjylland', strength: 66 },
  { pot: 3, name: 'SC Freiburg', strength: 72 },
  { pot: 3, name: 'Ludogorets', strength: 64 },
  { pot: 3, name: 'Sturm Graz', strength: 65 },
  { pot: 3, name: 'FCSB', strength: 64 },
  { pot: 3, name: 'Belgrade', strength: 66 },
  { pot: 3, name: 'Rennes', strength: 71 },
  // Pot 4
  { pot: 4, name: 'Bologna', strength: 72 },
  { pot: 4, name: 'Celta Vigo', strength: 70 },
  { pot: 4, name: 'Stuttgart', strength: 73 },
  { pot: 4, name: 'Panathinaikos', strength: 66 },
  { pot: 4, name: 'Malmö', strength: 63 },
  { pot: 4, name: 'AZ', strength: 69 },
  { pot: 4, name: 'Utrecht', strength: 66 },
  { pot: 4, name: 'Genk', strength: 68 },
  { pot: 4, name: 'Brann', strength: 62 },
];

const HOME_ADVANTAGE = 3;

// --- Position classification ---

type PositionRole = 'GK' | 'DEF' | 'MID' | 'ATT';

function classifyPosition(pos: string): PositionRole {
  const p = pos.toUpperCase().trim();
  if (p === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'RWB', 'LWB', 'SW'].includes(p)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'RM', 'LM', 'DM'].includes(p)) return 'MID';
  return 'ATT';
}

// --- Position fitness ---

export function positionFitness(player: DraftPlayer): number {
  const assigned = player.assignedPosition.toUpperCase().trim();
  const natural = (player.positions || '').split(',').map(p => p.trim().toUpperCase()).filter(Boolean);

  if (natural.length === 0) return 1.0;

  if (natural.includes(assigned)) return 1.0;

  // Winger ↔ wide mid natural equivalence, but only when the player has no fullback
  // on that side (a pure LM/LW is essentially a winger; LM who also plays LB is a utility player)
  const conditionalNatural: Array<{ pair: [string, string]; excludes: string[] }> = [
    { pair: ['LM', 'LW'], excludes: ['LB', 'LWB'] },
    { pair: ['RM', 'RW'], excludes: ['RB', 'RWB'] },
  ];
  for (const { pair, excludes } of conditionalNatural) {
    const [posA, posB] = pair;
    if (natural.some(p => excludes.includes(p))) continue;
    if ((assigned === posA && natural.includes(posB)) || (assigned === posB && natural.includes(posA))) return 1.0;
  }

  const assignedRole = classifyPosition(assigned);
  if (natural.some(p => classifyPosition(p) === assignedRole)) return 0.98;

  const mediumPairs: [string[], string[]][] = [
    [['LB', 'LWB'], ['LM']],
    [['RB', 'RWB'], ['RM']],
    [['CDM', 'DM'], ['CB']],
  ];
  for (const [groupA, groupB] of mediumPairs) {
    if (groupA.includes(assigned) && natural.some(p => groupB.includes(p))) return 0.93;
    if (groupB.includes(assigned) && natural.some(p => groupA.includes(p))) return 0.93;
  }

  const adjacent: Record<PositionRole, PositionRole[]> = {
    ATT: ['MID'],
    MID: ['ATT', 'DEF'],
    DEF: ['MID'],
    GK: [],
  };
  if (natural.some(p => adjacent[assignedRole]?.includes(classifyPosition(p)))) return 0.85;

  return 0.68;
}

// --- Attribute helpers ---

function hasAttrs(p: DraftPlayer): p is DraftPlayer & { attrs: PlayerAttributes } {
  if (!p.attrs) return false;
  const a = p.attrs;
  return (a.shooting > 0 || a.passing > 0 || a.defending > 0 || a.pace > 0);
}

function statOr(val: number, ovr: number): number { return val > 0 ? val : ovr; }

// --- Position-based attack/defense contributions ---

function playerContributions(p: DraftPlayer, fitness: number): { attack: number; defense: number } {
  const pos = p.assignedPosition.toUpperCase().trim();
  const o = p.overall;

  if (!hasAttrs(p)) {
    const role = classifyPosition(pos);
    if (role === 'GK') return { attack: 0, defense: o * fitness };
    if (role === 'DEF') return { attack: 0, defense: o * fitness };
    if (role === 'ATT') return { attack: o * fitness, defense: 0 };
    return { attack: o * 0.5 * fitness, defense: o * 0.5 * fitness };
  }

  const a = p.attrs;
  const def = statOr(a.defending, o);
  const phy = statOr(a.physical, o);
  const pac = statOr(a.pace, o);
  const crs = statOr(a.crossing, o);
  const pas = statOr(a.passing, o);
  const sho = statOr(a.shooting, o);
  const dri = statOr(a.dribbling, o);

  const blend = (statAvg: number) => (statAvg * 0.3 + o * 0.7) * fitness;

  if (pos === 'GK') {
    return { attack: 0, defense: o * fitness };
  }
  if (pos === 'CB') {
    return { attack: 0, defense: blend((def + phy + pac) / 3) };
  }
  if (['RB', 'LB', 'RWB', 'LWB'].includes(pos)) {
    return {
      attack: blend((crs + pac) / 2),
      defense: blend((def + pac) / 2),
    };
  }
  if (['CDM', 'DM'].includes(pos)) {
    return {
      attack: blend(pas),
      defense: blend((def + phy) / 2),
    };
  }
  if (pos === 'CM') {
    return {
      attack: blend((pas + sho) / 2),
      defense: blend(def),
    };
  }
  if (pos === 'CAM') {
    return {
      attack: blend((pas + dri + sho) / 3),
      defense: 0,
    };
  }
  if (['RM', 'LM'].includes(pos)) {
    return {
      attack: blend((pac + dri) / 2),
      defense: blend((pac + def) / 2),
    };
  }
  if (pos === 'ST') {
    return {
      attack: blend((sho + dri + phy) / 3),
      defense: 0,
    };
  }
  if (pos === 'RW' || pos === 'LW') {
    return {
      attack: blend((pac + dri + sho) / 3),
      defense: 0,
    };
  }

  // Fallback
  const role = classifyPosition(pos);
  if (role === 'ATT') return { attack: blend((sho + dri + phy) / 3), defense: 0 };
  if (role === 'DEF') return { attack: 0, defense: blend((def + phy + pac) / 3) };
  return { attack: blend((pas + sho) / 2), defense: blend(def) };
}

// --- Team phase ratings ---

export interface PhaseRatings {
  attack: number;
  midfield: number;
  defense: number;
  gk: number;
  teamStrength: number;
}

function computePhaseRatings(players: DraftPlayer[]): PhaseRatings {
  // Defensive coercion: force overall and all attrs to numbers.
  // After JSON.parse (e.g. localStorage resume), values may arrive as strings.
  for (const p of players) {
    p.overall = Number(p.overall) || 0;
    if (p.attrs) {
      const a = p.attrs;
      a.pace = Number(a.pace) || 0;
      a.shooting = Number(a.shooting) || 0;
      a.passing = Number(a.passing) || 0;
      a.dribbling = Number(a.dribbling) || 0;
      a.defending = Number(a.defending) || 0;
      a.physical = Number(a.physical) || 0;
      a.finishing = Number(a.finishing) || 0;
      a.positioning = Number(a.positioning) || 0;
      a.crossing = Number(a.crossing) || 0;
      a.vision = Number(a.vision) || 0;
      a.longShots = Number(a.longShots) || 0;
      a.shortPassing = Number(a.shortPassing) || 0;
      a.longPassing = Number(a.longPassing) || 0;
      a.heading = Number(a.heading) || 0;
      a.interceptions = Number(a.interceptions) || 0;
      a.standingTackle = Number(a.standingTackle) || 0;
      a.marking = Number(a.marking) || 0;
      a.reactions = Number(a.reactions) || 0;
      a.sprintSpeed = Number(a.sprintSpeed) || 0;
      a.gkDiving = Number(a.gkDiving) || 0;
      a.gkPositioning = Number(a.gkPositioning) || 0;
      a.gkReflexes = Number(a.gkReflexes) || 0;
    }
  }

  // Safety: estimate OVR from attributes if missing
  for (const p of players) {
    if (p.overall === 0 && p.attrs) {
      const a = p.attrs;
      const main = [a.pace, a.shooting, a.passing, a.dribbling, a.defending, a.physical].filter(v => v > 0);
      if (main.length >= 3) {
        p.overall = Math.round(main.reduce((s, v) => s + v, 0) / main.length);
      } else if (p.overall === 0) {
        p.overall = 70;
      }
    } else if (p.overall === 0) {
      p.overall = 70;
    }
  }

  const attackValues: number[] = [];
  const defenseValues: number[] = [];
  let gkRating = 65;

  for (const p of players) {
    const fit = positionFitness(p);
    const contrib = playerContributions(p, fit);

    if (contrib.attack > 0) attackValues.push(contrib.attack);
    if (contrib.defense > 0) defenseValues.push(contrib.defense);

    if (classifyPosition(p.assignedPosition) === 'GK') {
      gkRating = contrib.defense;
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 70;

  const attack = avg(attackValues);
  const defense = avg(defenseValues);
  const midfield = (attack + defense) / 2;
  const teamStrength = attack * 0.45 + defense * 0.40 + gkRating * 0.15;

  return { attack, midfield, defense, gk: gkRating, teamStrength };
}

// --- Goal scoring weights based on attributes ---

function goalScoringWeight(p: DraftPlayer): number {
  const role = classifyPosition(p.assignedPosition);
  const fit = positionFitness(p);
  const qualityMult = (p.overall / 80) * (p.overall / 80);

  if (hasAttrs(p)) {
    const a = p.attrs;
    const o = p.overall;
    const sho = statOr(a.shooting, o);
    const dri = statOr(a.dribbling, o);
    const pac = statOr(a.pace, o);
    const phy = statOr(a.physical, o);
    const head = a.heading;

    switch (role) {
      case 'ATT':
        return (sho * 3 + dri * 1 + pac * 0.5) * fit * qualityMult / 80;
      case 'MID':
        return (sho * 2 + dri * 0.5) * fit * qualityMult / 150;
      case 'DEF': {
        const base = (phy * 1.2 + sho * 0.3) * fit * qualityMult / 600;
        // Aerial / set-piece threat: defenders with high heading score from
        // corners and free kicks. An elite header (Van Dijk ~90, Ramos ~85)
        // expects ~3 PL goals per season; a fullback with heading ~55 barely
        // benefits. Threshold at 50 so only genuine aerial threats get the
        // bonus. Falls back to base-only when heading data is missing (=0).
        const aerialBonus = head > 0
          ? Math.max(0, head - 50) * (phy / 80) * 0.014 * fit * qualityMult
          : 0;
        return base + aerialBonus;
      }
      case 'GK':
        return 0.02;
    }
  }

  const ratingFactor = 0.5 + (p.overall / 99) * 0.5;
  const roleWeights: Record<PositionRole, number> = { ATT: 10, MID: 3, DEF: 0.5, GK: 0.02 };
  return roleWeights[role] * ratingFactor * fit * qualityMult;
}

function assistWeight(p: DraftPlayer): number {
  const role = classifyPosition(p.assignedPosition);
  const pos = p.assignedPosition.toUpperCase().trim();
  const fit = positionFitness(p);

  if (hasAttrs(p)) {
    const a = p.attrs;
    const o = p.overall;
    const pas = statOr(a.passing, o);
    const crs = statOr(a.crossing, o);
    const dri = statOr(a.dribbling, o);

    const isFullback = ['RB', 'LB', 'RWB', 'LWB'].includes(pos);
    if (isFullback) {
      return (crs * 3 + pas * 1) * fit / 40;
    }

    switch (role) {
      case 'MID':
        return (pas * 2 + crs * 1 + dri * 0.5) * fit / 30;
      case 'ATT':
        return (pas * 1.5 + dri * 1 + crs * 0.5) * fit / 40;
      case 'DEF':
        return (pas * 0.5) * fit / 100;
      case 'GK':
        return 0.1;
    }
  }

  const ratingFactor = 0.5 + (p.overall / 99) * 0.5;
  const roleWeights: Record<PositionRole, number> = { ATT: 5, MID: 8, DEF: 2, GK: 0.1 };
  return roleWeights[role] * ratingFactor * fit;
}

// --- Weighted pick ---

function weightedPick(
  players: DraftPlayer[],
  weightFn: (p: DraftPlayer) => number,
  rng: () => number,
): DraftPlayer {
  const weights = players.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return players[Math.floor(rng() * players.length)];

  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

function randomMinute(rng: () => number): number {
  return Math.floor(rng() * 90) + 1;
}

// Poisson-distributed random variable via inverse transform
function poisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

// --- Expected goals using phase ratings ---

function computeExpectedGoals(
  attackPower: number,
  midfieldPower: number,
  oppDefensePower: number,
): number {
  const offensiveStrength = attackPower * 0.55 + midfieldPower * 0.45;
  const diff = offensiveStrength - oppDefensePower;
  const base = 1.5;
  const xg = base + diff * 0.065;
  return Math.max(0.4, Math.min(3.5, xg));
}

// --- Match simulation ---

function simulateMatch(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  opponent: { name: string; strength: number },
  isHome: boolean,
  rng: () => number,
  mySeasonForm: number = 0,
  oppSeasonForm: number = 0,
): MatchResult {
  const homeBonus = isHome ? HOME_ADVANTAGE : 0;
  const awayPenalty = isHome ? 0 : HOME_ADVANTAGE;

  const myAttack = ratings.attack + homeBonus * 0.6 + mySeasonForm;
  const myMidfield = ratings.midfield + homeBonus * 0.4 + mySeasonForm * 0.7;
  const myDefense = ratings.defense + homeBonus * 0.3 + mySeasonForm * 0.5;
  const myGk = ratings.gk + mySeasonForm * 0.3;

  const effOppStrength = opponent.strength + awayPenalty + oppSeasonForm;
  const oppDefPower = effOppStrength;
  const oppAtkPower = effOppStrength;

  const myXg = computeExpectedGoals(myAttack, myMidfield, oppDefPower);

  const ourDefensivePower = myDefense * 0.55 + myGk * 0.30 + myMidfield * 0.15;
  const oppXg = computeExpectedGoals(oppAtkPower, effOppStrength * 0.95, ourDefensivePower);

  // Per-match form factor: teams can over/under-perform on the day (0.85–1.15)
  const myForm = 0.85 + rng() * 0.30;
  const oppForm = 0.85 + rng() * 0.30;

  const goalsFor = poisson(myXg * myForm, rng);
  const goalsAgainst = poisson(oppXg * oppForm, rng);

  const goalScorers: { player: string; minute: number }[] = [];
  const assistProviders: { player: string; minute: number }[] = [];

  const subAdjGoal = (p: DraftPlayer) => goalScoringWeight(p) * (p.isSub ? 0.35 : 1.0);
  const subAdjAssist = (p: DraftPlayer) => assistWeight(p) * (p.isSub ? 0.5 : 1.0);

  // Penalty taker: best attacker available in this match
  const penaltyTaker = [...players]
    .sort((a, b) => goalScoringWeight(b) - goalScoringWeight(a))[0];

  for (let i = 0; i < goalsFor; i++) {
    const minute = randomMinute(rng);
    const isPenalty = rng() < 0.10;
    const scorer = isPenalty ? penaltyTaker : weightedPick(players, subAdjGoal, rng);
    goalScorers.push({ player: scorer.name, minute });

    if (!isPenalty && rng() < 0.75) {
      const eligible = players.filter(p => p.name !== scorer.name);
      if (eligible.length > 0) {
        const assister = weightedPick(eligible, subAdjAssist, rng);
        assistProviders.push({ player: assister.name, minute });
      }
    }
  }

  goalScorers.sort((a, b) => a.minute - b.minute);
  assistProviders.sort((a, b) => a.minute - b.minute);

  let result: 'W' | 'D' | 'L';
  if (goalsFor > goalsAgainst) result = 'W';
  else if (goalsFor < goalsAgainst) result = 'L';
  else result = 'D';

  return { opponent: opponent.name, isHome, goalsFor, goalsAgainst, goalScorers, assistProviders, result };
}

// --- Neutral match simulation (for the rest of the league) ---

function simulateNeutralMatch(
  home: { name: string; strength: number },
  away: { name: string; strength: number },
  rng: () => number,
  homeSeasonForm: number = 0,
  awaySeasonForm: number = 0,
): { homeGoals: number; awayGoals: number } {
  const homeEff = home.strength + HOME_ADVANTAGE + homeSeasonForm;
  const awayEff = away.strength + awaySeasonForm;

  const homeXg = computeExpectedGoals(homeEff, homeEff * 0.95, awayEff);
  const awayXg = computeExpectedGoals(awayEff, awayEff * 0.95, homeEff);

  const homeForm = 0.85 + rng() * 0.30;
  const awayForm = 0.85 + rng() * 0.30;

  return {
    homeGoals: poisson(homeXg * homeForm, rng),
    awayGoals: poisson(awayXg * awayForm, rng),
  };
}

// --- League simulation ---

function simulateLeague(
  playerTeamName: string,
  playerTeamStrength: number,
  opponents: { name: string; strength: number }[],
  playerMatches: MatchResult[],
  rng: () => number,
  oppSeasonMods?: Record<string, number>,
  outScores?: Map<string, { homeGoals: number; awayGoals: number }>,
): LeagueTeam[] {
  const allTeams = [
    { name: playerTeamName, strength: playerTeamStrength },
    ...opponents,
  ];

  const table: Record<string, LeagueTeam> = {};
  for (const team of allTeams) {
    table[team.name] = {
      name: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      isPlayer: team.name === playerTeamName,
    };
  }

  for (const match of playerMatches) {
    const pt = table[playerTeamName];
    pt.played++;
    pt.goalsFor += match.goalsFor;
    pt.goalsAgainst += match.goalsAgainst;
    if (match.result === 'W') { pt.won++; pt.points += 3; }
    else if (match.result === 'D') { pt.drawn++; pt.points += 1; }
    else { pt.lost++; }

    const ot = table[match.opponent];
    ot.played++;
    ot.goalsFor += match.goalsAgainst;
    ot.goalsAgainst += match.goalsFor;
    if (match.result === 'L') { ot.won++; ot.points += 3; }
    else if (match.result === 'D') { ot.drawn++; ot.points += 1; }
    else { ot.lost++; }
  }

  for (let i = 0; i < opponents.length; i++) {
    for (let j = 0; j < opponents.length; j++) {
      if (i === j) continue;

      const home = opponents[i];
      const away = opponents[j];
      const homeMod = oppSeasonMods?.[home.name] ?? 0;
      const awayMod = oppSeasonMods?.[away.name] ?? 0;
      const { homeGoals, awayGoals } = simulateNeutralMatch(home, away, rng, homeMod, awayMod);
      outScores?.set(`${home.name}|${away.name}`, { homeGoals, awayGoals });

      const ht = table[home.name];
      ht.played++;
      ht.goalsFor += homeGoals;
      ht.goalsAgainst += awayGoals;
      if (homeGoals > awayGoals) { ht.won++; ht.points += 3; }
      else if (homeGoals === awayGoals) { ht.drawn++; ht.points += 1; }
      else { ht.lost++; }

      const at = table[away.name];
      at.played++;
      at.goalsFor += awayGoals;
      at.goalsAgainst += homeGoals;
      if (awayGoals > homeGoals) { at.won++; at.points += 3; }
      else if (awayGoals === homeGoals) { at.drawn++; at.points += 1; }
      else { at.lost++; }
    }
  }

  const sorted = Object.values(table);
  for (const t of sorted) {
    t.goalDifference = t.goalsFor - t.goalsAgainst;
  }

  sorted.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  return sorted;
}

export interface WeekFixture {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

export interface SeasonWeek {
  week: number;
  matches: WeekFixture[];
}

/**
 * Slots the player's 38 already-simulated matches and the already-simulated
 * opponent-vs-opponent results into a valid 38-matchweek round-robin schedule
 * (circle method) so a live, all-20-team table can be derived as matches are
 * revealed. Purely a re-bucketing of existing results — does not change any
 * outcome, just orders/groups them into simultaneous matchweeks.
 */
function buildAllFixtures(
  playerTeamName: string,
  playerMatches: MatchResult[],
  opponents: { name: string; strength: number }[],
  oppScores: Map<string, { homeGoals: number; awayGoals: number }>,
  scheduleSeed: number,
): SeasonWeek[] {
  const rng = createRng(scheduleSeed);
  const teamNames = [playerTeamName, ...opponents.map(o => o.name)];
  const N = teamNames.length;

  const playerHomeLeg = new Map<string, MatchResult>();
  const playerAwayLeg = new Map<string, MatchResult>();
  for (const m of playerMatches) {
    if (m.isHome) playerHomeLeg.set(m.opponent, m);
    else playerAwayLeg.set(m.opponent, m);
  }

  const rotating = Array.from({ length: N - 1 }, (_, i) => i + 1);
  const firstHalfRounds: { home: number; away: number }[][] = [];
  for (let r = 0; r < N - 1; r++) {
    const round: { home: number; away: number }[] = [];
    if (rng() > 0.5) round.push({ home: 0, away: rotating[0] });
    else round.push({ home: rotating[0], away: 0 });
    for (let i = 1; i < N / 2; i++) {
      const mirrorIdx = N - 1 - i;
      if (rng() > 0.5) round.push({ home: rotating[i], away: rotating[mirrorIdx] });
      else round.push({ home: rotating[mirrorIdx], away: rotating[i] });
    }
    firstHalfRounds.push(round);
    rotating.unshift(rotating.pop()!);
  }
  for (let i = firstHalfRounds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [firstHalfRounds[i], firstHalfRounds[j]] = [firstHalfRounds[j], firstHalfRounds[i]];
  }
  const secondHalfRounds = firstHalfRounds.map(round => round.map(m => ({ home: m.away, away: m.home })));
  for (let i = secondHalfRounds.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [secondHalfRounds[i], secondHalfRounds[j]] = [secondHalfRounds[j], secondHalfRounds[i]];
  }
  const fullSchedule = [...firstHalfRounds, ...secondHalfRounds];

  const allFixtures: SeasonWeek[] = [];
  for (let mw = 0; mw < fullSchedule.length; mw++) {
    const weekMatches: WeekFixture[] = [];
    for (const fx of fullSchedule[mw]) {
      const homeName = teamNames[fx.home];
      const awayName = teamNames[fx.away];
      if (fx.home === 0 || fx.away === 0) {
        const isPlayerHome = fx.home === 0;
        const oppName = isPlayerHome ? awayName : homeName;
        const m = isPlayerHome ? playerHomeLeg.get(oppName) : playerAwayLeg.get(oppName);
        if (m) {
          weekMatches.push({
            home: isPlayerHome ? playerTeamName : oppName,
            away: isPlayerHome ? oppName : playerTeamName,
            homeGoals: isPlayerHome ? m.goalsFor : m.goalsAgainst,
            awayGoals: isPlayerHome ? m.goalsAgainst : m.goalsFor,
          });
        }
      } else {
        const sc = oppScores.get(`${homeName}|${awayName}`);
        if (sc) weekMatches.push({ home: homeName, away: awayName, homeGoals: sc.homeGoals, awayGoals: sc.awayGoals });
      }
    }
    allFixtures.push({ week: mw + 1, matches: weekMatches });
  }

  // Align the matchweek order to the reveal order. The live reveal streams the
  // player's PL results in `playerMatches` order and derives the live 20-team
  // table by slicing these weeks up to the current matchweek. The circle-method
  // schedule above is shuffled, so without this the player's game in week r is a
  // random opponent — meaning after N revealed results the table's player row
  // reflects a DIFFERENT subset of the player's games than the N results shown
  // (the reported "table is ahead / shows wins as draws" bug). Each week is a
  // full round (every team plays exactly once), so reordering whole weeks keeps
  // every team's games-played balanced while making week r contain exactly
  // playerMatches[r-1].
  const playerMatchIndex = new Map<string, number>();
  playerMatches.forEach((m, i) => {
    playerMatchIndex.set(`${m.opponent}|${m.isHome ? 'H' : 'A'}`, i);
  });
  const playerWeekIndex = (wk: SeasonWeek): number => {
    for (const fx of wk.matches) {
      if (fx.home === playerTeamName) {
        const k = playerMatchIndex.get(`${fx.away}|H`);
        if (k != null) return k;
      } else if (fx.away === playerTeamName) {
        const k = playerMatchIndex.get(`${fx.home}|A`);
        if (k != null) return k;
      }
    }
    return Number.MAX_SAFE_INTEGER; // no player fixture (shouldn't happen) — sink to the end
  };
  allFixtures.sort((a, b) => playerWeekIndex(a) - playerWeekIndex(b));
  allFixtures.forEach((wk, i) => { wk.week = i + 1; });

  return allFixtures;
}

// --- Projected finish ---

function calculateProjectedFinish(
  teamStrength: number,
  allTeams: { name: string; strength: number }[],
): number {
  const sorted = [...allTeams].sort((a, b) => b.strength - a.strength);
  const idx = sorted.findIndex(t => t.strength <= teamStrength);
  return idx === -1 ? sorted.length : idx + 1;
}

// --- Match rating for a player (used for avg rating stat) ---

function matchRating(
  player: DraftPlayer,
  match: MatchResult,
  seasonForm: number,
  rng: () => number,
): number {
  const role = classifyPosition(player.assignedPosition);
  const ovrBonus = (player.overall - 70) * 0.025;
  let base = 6.5 + ovrBonus + seasonForm + (rng() * 1.0 - 0.5);

  // Attribute-based contribution (key passes, dribbles, tackles, saves, etc.)
  if (hasAttrs(player)) {
    const a = player.attrs;
    const o = player.overall;
    let keyAvg: number;
    switch (role) {
      case 'ATT':
        keyAvg = (statOr(a.dribbling, o) + statOr(a.pace, o) + statOr(a.shooting, o)) / 3;
        break;
      case 'MID':
        keyAvg = (statOr(a.passing, o) + statOr(a.dribbling, o) + (a.vision > 0 ? a.vision : statOr(a.passing, o))) / 3;
        break;
      case 'DEF':
        keyAvg = (statOr(a.defending, o) + statOr(a.physical, o) + (a.interceptions > 0 ? a.interceptions : statOr(a.defending, o))) / 3;
        break;
      case 'GK':
        keyAvg = (statOr(a.gkReflexes, o) + statOr(a.gkPositioning, o) + statOr(a.gkDiving, o)) / 3;
        break;
    }
    base += Math.max(0, (keyAvg - 65) * 0.01);
  }

  const scored = match.goalScorers.filter(g => g.player === player.name).length;
  const assisted = match.assistProviders.filter(a => a.player === player.name).length;
  base += scored * 2.0 + assisted * 1.2;

  if (match.goalsAgainst === 0 && (role === 'GK' || role === 'DEF')) {
    base += 0.8;
  }

  if (match.result === 'W') base += 0.3;
  else if (match.result === 'L') base -= 0.3;

  return Math.max(4.0, Math.min(10.0, Math.round(base * 10) / 10));
}

// --- FA Cup simulation ---

// Lightweight knockout to determine a tournament winner without player involvement.
// Used to always show UCL/UEL winners even when the player didn't qualify.
function pickBackgroundKnockoutWinner(
  teams: { name: string; strength: number }[],
  rng: () => number
): string {
  if (teams.length === 0) return '';
  let remaining = [...teams];
  // Fisher-Yates shuffle
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  while (remaining.length > 1) {
    const next: { name: string; strength: number }[] = [];
    for (let i = 0; i + 1 < remaining.length; i += 2) {
      const a = remaining[i], b = remaining[i + 1];
      const winner = simulateAIvAIKnockoutTie(a, b, rng, remaining.length === 2);
      next.push(winner === a.name ? a : b);
    }
    if (remaining.length % 2 === 1) next.push(remaining[remaining.length - 1]);
    remaining = next;
  }
  return remaining[0]?.name ?? '';
}

const FA_CUP_ROUNDS = ['Round of 32', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final'];
function simulateAIvAICupMatch(
  teamA: { name: string; strength: number },
  teamB: { name: string; strength: number },
  rng: () => number,
): { winner: string; scoreA: number; scoreB: number; extraTime: boolean; penalties: boolean } {
  const homeBonus = HOME_ADVANTAGE;
  const aStr = teamA.strength + homeBonus * 0.5;
  const bStr = teamB.strength;
  const aXg = computeExpectedGoals(aStr, aStr * 0.95, bStr);
  const bXg = computeExpectedGoals(bStr, bStr * 0.95, aStr);

  let scoreA = poisson(aXg, rng);
  let scoreB = poisson(bXg, rng);
  let extraTime = false;
  let penalties = false;

  if (scoreA === scoreB) {
    extraTime = true;
    scoreA += poisson(aXg * 0.33, rng);
    scoreB += poisson(bXg * 0.33, rng);
    if (scoreA === scoreB) {
      penalties = true;
      if (rng() > 0.5) scoreA++; else scoreB++;
    }
  }

  return { winner: scoreA > scoreB ? teamA.name : teamB.name, scoreA, scoreB, extraTime, penalties };
}

function simulateFaCup(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  allCupTeams: { name: string; strength: number }[],
  rng: () => number,
  playerTeamOverride?: string,
): FaCupResult {
  const playerTeamName = playerTeamOverride ?? 'KNOWITBALL FC';

  // Build 32-team bracket with random seeded draw
  const bracket = allCupTeams.map(t => ({ ...t }));
  // Shuffle bracket
  for (let i = bracket.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bracket[i], bracket[j]] = [bracket[j], bracket[i]];
  }

  // Ensure we have exactly 32 teams; pad with real lower-league clubs
  { const usedNames = new Set(bracket.map(t => t.name));
  let padIdx = 0;
  while (bracket.length < 32) {
    const club = LOWER_LEAGUE_CLUBS[padIdx % LOWER_LEAGUE_CLUBS.length];
    padIdx++;
    if (usedNames.has(club.name)) continue;
    usedNames.add(club.name);
    bracket.push({ name: club.name, strength: club.strength });
  } }

  const playerMatches: FaCupMatch[] = [];
  let remaining = bracket.map(t => ({ name: t.name, strength: t.strength }));
  let playerEliminated = false;

  for (let roundIdx = 0; roundIdx < 5; roundIdx++) {
    const roundName = FA_CUP_ROUNDS[roundIdx];
    const nextRound: { name: string; strength: number }[] = [];

    for (let i = 0; i < remaining.length; i += 2) {
      const teamA = remaining[i];
      const teamB = remaining[i + 1];

      const isPlayerMatch = teamA.name === playerTeamName || teamB.name === playerTeamName;

      if (isPlayerMatch && !playerEliminated) {
        const opponent = teamA.name === playerTeamName ? teamB : teamA;
        const match = simulateFaCupMatchForHuman(players, ratings, opponent, roundIdx, rng);
        playerMatches.push(match);

        if (match.result === 'W') {
          nextRound.push({ name: playerTeamName, strength: ratings.teamStrength });
        } else {
          playerEliminated = true;
          nextRound.push(opponent);
        }
      } else {
        const result = simulateAIvAICupMatch(teamA, teamB, rng);
        nextRound.push(remaining.find(t => t.name === result.winner) ?? teamA);
      }
    }

    remaining = nextRound;
  }

  const faCupWinner = remaining[0].name;

  return {
    matches: playerMatches,
    winner: faCupWinner === playerTeamName,
    exitRound: playerEliminated ? playerMatches[playerMatches.length - 1]?.round ?? null : null,
    faCupWinner,
  };
}

// League Cup: same structure as FA Cup but semi-final is a 2-legged tie
const LEAGUE_CUP_ROUNDS = ['Round of 32', 'Round of 16', 'Quarter-Final', 'Semi-Final', 'Final'];

function simulateLeagueCup(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  allCupTeams: { name: string; strength: number }[],
  rng: () => number,
  playerTeamOverride?: string,
): FaCupResult {
  const playerTeamName = playerTeamOverride ?? 'KNOWITBALL FC';
  const bracket = allCupTeams.map(t => ({ ...t }));
  for (let i = bracket.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bracket[i], bracket[j]] = [bracket[j], bracket[i]];
  }
  { const usedNames = new Set(bracket.map(t => t.name));
  let padIdx = 0;
  while (bracket.length < 32) {
    const club = LOWER_LEAGUE_CLUBS[padIdx % LOWER_LEAGUE_CLUBS.length];
    padIdx++;
    if (usedNames.has(club.name)) continue;
    usedNames.add(club.name);
    bracket.push({ name: club.name, strength: club.strength });
  } }

  const playerMatches: FaCupMatch[] = [];
  let remaining = bracket.map(t => ({ name: t.name, strength: t.strength }));
  let playerEliminated = false;

  for (let roundIdx = 0; roundIdx < 5; roundIdx++) {
    const roundName = LEAGUE_CUP_ROUNDS[roundIdx];
    const isSemiFinal = roundIdx === 3;
    const nextRound: { name: string; strength: number }[] = [];

    for (let i = 0; i < remaining.length; i += 2) {
      const teamA = remaining[i];
      const teamB = remaining[i + 1];
      const isPlayerMatch = teamA.name === playerTeamName || teamB.name === playerTeamName;

      if (isPlayerMatch && !playerEliminated) {
        const opponent = teamA.name === playerTeamName ? teamB : teamA;

        if (isSemiFinal) {
          // Two-legged semi: leg1 away, leg2 home (or vice versa randomly)
          const leg1IsHome = rng() > 0.5;
          const leg1 = simulateFaCupLeg(players, ratings, opponent, roundIdx, rng, leg1IsHome, LEAGUE_CUP_ROUNDS);
          const leg2 = simulateFaCupLeg(players, ratings, opponent, roundIdx, rng, !leg1IsHome, LEAGUE_CUP_ROUNDS);

          const aggFor = leg1.goalsFor + leg2.goalsFor;
          const aggAgainst = leg1.goalsAgainst + leg2.goalsAgainst;

          let result: 'W' | 'L';
          let extraTime = false;
          let penalties = false;
          let penaltyScore: { player: number; opponent: number } | undefined;

          if (aggFor > aggAgainst) {
            result = 'W';
          } else if (aggAgainst > aggFor) {
            result = 'L';
          } else {
            // Aggregate level — AET then penalties on the night of leg2
            extraTime = true;
            const etFor = poisson(leg2.xg * 0.33, rng);
            const etAgainst = poisson(leg2.oppXg * 0.33, rng);
            if (etFor > etAgainst) {
              result = 'W';
              leg2.goalsFor += etFor;
              leg2.goalsAgainst += etAgainst;
            } else if (etAgainst > etFor) {
              result = 'L';
              leg2.goalsFor += etFor;
              leg2.goalsAgainst += etAgainst;
            } else {
              leg2.goalsFor += etFor;
              leg2.goalsAgainst += etAgainst;
              penalties = true;
              const myPens = Math.floor(rng() * 3) + 3;
              const oppPens = Math.floor(rng() * 3) + 3;
              if (myPens === oppPens) {
                penaltyScore = rng() > 0.5 ? { player: myPens + 1, opponent: oppPens } : { player: myPens, opponent: oppPens + 1 };
              } else {
                penaltyScore = { player: myPens, opponent: oppPens };
              }
              result = (penaltyScore!.player > penaltyScore!.opponent) ? 'W' : 'L';
            }
          }

          const allScorers = [...leg1.scorers.goals, ...leg2.scorers.goals];
          const allAssists = [...leg1.scorers.assists, ...leg2.scorers.assists];

          playerMatches.push({
            round: roundName, opponent: opponent.name,
            goalsFor: leg1.goalsFor, goalsAgainst: leg1.goalsAgainst,
            extraTime: false, penalties: false,
            goalScorers: leg1.scorers.goals, assistProviders: leg1.scorers.assists,
            result,
            isHome: leg1IsHome,
            leg2: {
              goalsFor: leg2.goalsFor, goalsAgainst: leg2.goalsAgainst,
              isHome: !leg1IsHome, extraTime, penalties, penaltyScore,
              goalScorers: leg2.scorers.goals,
            },
          });
          // unused vars suppressed
          void allScorers; void allAssists;

          if (result === 'W') {
            nextRound.push({ name: playerTeamName, strength: ratings.teamStrength });
          } else {
            playerEliminated = true;
            nextRound.push(opponent);
          }
        } else {
          const match = simulateFaCupMatchForHumanNamed(players, ratings, opponent, roundIdx, rng, LEAGUE_CUP_ROUNDS);
          playerMatches.push(match);
          if (match.result === 'W') {
            nextRound.push({ name: playerTeamName, strength: ratings.teamStrength });
          } else {
            playerEliminated = true;
            nextRound.push(opponent);
          }
        }
      } else {
        const result = simulateAIvAICupMatch(teamA, teamB, rng);
        nextRound.push(remaining.find(t => t.name === result.winner) ?? teamA);
      }
    }
    remaining = nextRound;
  }

  const winner = remaining[0].name;
  return {
    matches: playerMatches,
    winner: winner === playerTeamName,
    exitRound: playerEliminated ? playerMatches[playerMatches.length - 1]?.round ?? null : null,
    faCupWinner: winner,
  };
}

// Simulate a single cup leg, returning goals + xg for aggregate resolution
function simulateFaCupLeg(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  opponent: { name: string; strength: number },
  round: number,
  rng: () => number,
  isHome: boolean,
  roundNames: string[],
): { goalsFor: number; goalsAgainst: number; xg: number; oppXg: number; scorers: { goals: { player: string; minute: number }[]; assists: { player: string; minute: number }[] } } {
  const homeBonus = isHome ? HOME_ADVANTAGE : 0;
  const myAttack = ratings.attack + homeBonus * 0.6;
  const myMidfield = ratings.midfield + homeBonus * 0.4;
  const myDefense = ratings.defense + homeBonus * 0.3;
  const myGk = ratings.gk;
  const oppStrength = opponent.strength + (isHome ? 0 : HOME_ADVANTAGE);
  const xg = computeExpectedGoals(myAttack, myMidfield, oppStrength);
  const ourDefPower = myDefense * 0.55 + myGk * 0.30 + myMidfield * 0.15;
  const oppXg = computeExpectedGoals(oppStrength, oppStrength * 0.95, ourDefPower);
  const goalsFor = poisson(xg, rng);
  const goalsAgainst = poisson(oppXg, rng);
  const scorers = generateGoalScorers(players, goalsFor, rng);
  void round; void roundNames;
  return { goalsFor, goalsAgainst, xg, oppXg, scorers };
}

// Same as simulateFaCupMatchForHuman but accepts a custom round names array
function simulateFaCupMatchForHumanNamed(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  opponent: { name: string; strength: number },
  round: number,
  rng: () => number,
  roundNames: string[],
): FaCupMatch {
  const roundName = roundNames[round];
  const isHome = round < 4 ? rng() > 0.5 : false;
  const homeBonus = isHome ? HOME_ADVANTAGE : 0;
  const myAttack = ratings.attack + homeBonus * 0.6;
  const myMidfield = ratings.midfield + homeBonus * 0.4;
  const myDefense = ratings.defense + homeBonus * 0.3;
  const myGk = ratings.gk;
  const oppStrength = opponent.strength + (isHome ? 0 : HOME_ADVANTAGE);
  const myXg = computeExpectedGoals(myAttack, myMidfield, oppStrength);
  const ourDefPower = myDefense * 0.55 + myGk * 0.30 + myMidfield * 0.15;
  const oppXg = computeExpectedGoals(oppStrength, oppStrength * 0.95, ourDefPower);
  let goalsFor = poisson(myXg, rng);
  let goalsAgainst = poisson(oppXg, rng);
  let extraTime = false;
  let penalties = false;
  let penaltyScore: { player: number; opponent: number } | undefined;
  const scorers = generateGoalScorers(players, goalsFor, rng);
  if (goalsFor === goalsAgainst) {
    extraTime = true;
    const etFor = poisson(myXg * 0.33, rng);
    const etAgainst = poisson(oppXg * 0.33, rng);
    goalsFor += etFor;
    goalsAgainst += etAgainst;
    const etScorers = generateGoalScorers(players, etFor, rng, 90);
    scorers.goals.push(...etScorers.goals);
    scorers.assists.push(...etScorers.assists);
    if (goalsFor === goalsAgainst) {
      penalties = true;
      const myPens = Math.floor(rng() * 3) + 3;
      const oppPens = Math.floor(rng() * 3) + 3;
      if (myPens === oppPens) {
        penaltyScore = rng() > 0.5 ? { player: myPens + 1, opponent: oppPens } : { player: myPens, opponent: oppPens + 1 };
      } else {
        penaltyScore = { player: myPens, opponent: oppPens };
      }
    }
  }
  scorers.goals.sort((a, b) => a.minute - b.minute);
  scorers.assists.sort((a, b) => a.minute - b.minute);
  let result: 'W' | 'L';
  if (penalties && penaltyScore) {
    result = penaltyScore.player > penaltyScore.opponent ? 'W' : 'L';
  } else {
    result = goalsFor > goalsAgainst ? 'W' : 'L';
  }
  return {
    round: roundName, opponent: opponent.name,
    goalsFor, goalsAgainst, extraTime, penalties, penaltyScore,
    goalScorers: scorers.goals, assistProviders: scorers.assists,
    result,
  };
}

// Number of teams in each FA Cup round (Round of 32 through Final)
const FA_CUP_TEAMS_IN_ROUND = [32, 16, 8, 4, 2];

function simulateSharedFaCup(
  humanTeams: {
    userId: string;
    displayName: string;
    teamName: string;
    starters: DraftPlayer[];
    ratings: PhaseRatings;
    rng: () => number;
  }[],
  allCupTeams: { name: string; strength: number }[],
  drawRng: () => number,
): { results: Map<string, FaCupResult>; faCupWinner: string } {
  // Build 32-team bracket: human teams + AI teams
  type BracketEntry = { name: string; strength: number; userId?: string };
  const humanMap = new Map(humanTeams.map(h => [h.teamName, h]));

  const bracket: BracketEntry[] = allCupTeams.map(t => {
    const human = humanMap.get(t.name);
    return { name: t.name, strength: t.strength, userId: human?.userId };
  });

  // Shuffle bracket
  for (let i = bracket.length - 1; i > 0; i--) {
    const j = Math.floor(drawRng() * (i + 1));
    [bracket[i], bracket[j]] = [bracket[j], bracket[i]];
  }

  // Pad to 32 with real lower-league clubs
  { const usedNames = new Set(bracket.map(t => t.name));
  let padIdx = 0;
  while (bracket.length < 32) {
    const club = LOWER_LEAGUE_CLUBS[padIdx % LOWER_LEAGUE_CLUBS.length];
    padIdx++;
    if (usedNames.has(club.name)) continue;
    usedNames.add(club.name);
    bracket.push({ name: club.name, strength: club.strength });
  } }

  const humanMatches = new Map<string, FaCupMatch[]>();
  const humanEliminated = new Map<string, string>(); // userId -> exitRound
  for (const h of humanTeams) {
    humanMatches.set(h.userId, []);
  }

  let remaining = bracket.slice(0, 32);

  for (let roundIdx = 0; roundIdx < 5; roundIdx++) {
    const roundName = FA_CUP_ROUNDS[roundIdx];
    const nextRound: BracketEntry[] = [];

    for (let i = 0; i < remaining.length; i += 2) {
      const teamA = remaining[i];
      const teamB = remaining[i + 1];

      const humanA = teamA.userId ? humanTeams.find(h => h.userId === teamA.userId) : undefined;
      const humanB = teamB.userId ? humanTeams.find(h => h.userId === teamB.userId) : undefined;

      if (humanA && humanB) {
        // Human vs Human
        const isH1Home = roundIdx < 4 ? drawRng() > 0.5 : false;
        const homeBonus = HOME_ADVANTAGE;

        const h1Atk = humanA.ratings.attack + (isH1Home ? homeBonus * 0.6 : 0);
        const h1Mid = humanA.ratings.midfield + (isH1Home ? homeBonus * 0.4 : 0);
        const h1Def = humanA.ratings.defense + (isH1Home ? homeBonus * 0.3 : 0);
        const h1Gk = humanA.ratings.gk;
        const h2Atk = humanB.ratings.attack + (isH1Home ? 0 : homeBonus * 0.6);
        const h2Mid = humanB.ratings.midfield + (isH1Home ? 0 : homeBonus * 0.4);
        const h2Def = humanB.ratings.defense + (isH1Home ? 0 : homeBonus * 0.3);
        const h2Gk = humanB.ratings.gk;

        const h1DefPower = h1Def * 0.55 + h1Gk * 0.30 + h1Mid * 0.15;
        const h2DefPower = h2Def * 0.55 + h2Gk * 0.30 + h2Mid * 0.15;

        const h1Xg = computeExpectedGoals(h1Atk, h1Mid, h2DefPower);
        const h2Xg = computeExpectedGoals(h2Atk, h2Mid, h1DefPower);

        const h1Form = 0.85 + drawRng() * 0.30;
        const h2Form = 0.85 + drawRng() * 0.30;

        let h1Goals = poisson(h1Xg * h1Form, drawRng);
        let h2Goals = poisson(h2Xg * h2Form, drawRng);

        const h1Scorers = generateGoalScorers(humanA.starters, h1Goals, humanA.rng);
        const h2Scorers = generateGoalScorers(humanB.starters, h2Goals, humanB.rng);

        let extraTime = false;
        let penalties = false;
        let penaltyScore: { player: number; opponent: number } | undefined;

        if (h1Goals === h2Goals) {
          extraTime = true;
          const etH1 = poisson(h1Xg * 0.33, drawRng);
          const etH2 = poisson(h2Xg * 0.33, drawRng);
          h1Goals += etH1;
          h2Goals += etH2;
          const etH1Scorers = generateGoalScorers(humanA.starters, etH1, humanA.rng, 90);
          const etH2Scorers = generateGoalScorers(humanB.starters, etH2, humanB.rng, 90);
          h1Scorers.goals.push(...etH1Scorers.goals);
          h1Scorers.assists.push(...etH1Scorers.assists);
          h2Scorers.goals.push(...etH2Scorers.goals);
          h2Scorers.assists.push(...etH2Scorers.assists);

          if (h1Goals === h2Goals) {
            penalties = true;
            const p1 = Math.floor(drawRng() * 3) + 3;
            const p2 = Math.floor(drawRng() * 3) + 3;
            if (p1 === p2) {
              penaltyScore = drawRng() > 0.5 ? { player: p1 + 1, opponent: p2 } : { player: p1, opponent: p2 + 1 };
            } else {
              penaltyScore = { player: p1, opponent: p2 };
            }
          }
        }

        let h1Result: 'W' | 'L';
        if (penalties && penaltyScore) {
          h1Result = penaltyScore.player > penaltyScore.opponent ? 'W' : 'L';
        } else {
          h1Result = h1Goals > h2Goals ? 'W' : 'L';
        }

        h1Scorers.goals.sort((a, b) => a.minute - b.minute);
        h1Scorers.assists.sort((a, b) => a.minute - b.minute);
        h2Scorers.goals.sort((a, b) => a.minute - b.minute);
        h2Scorers.assists.sort((a, b) => a.minute - b.minute);

        humanMatches.get(humanA.userId)!.push({
          round: roundName, opponent: humanB.displayName,
          goalsFor: h1Goals, goalsAgainst: h2Goals,
          extraTime, penalties, penaltyScore,
          goalScorers: h1Scorers.goals, assistProviders: h1Scorers.assists,
          result: h1Result,
        });
        humanMatches.get(humanB.userId)!.push({
          round: roundName, opponent: humanA.displayName,
          goalsFor: h2Goals, goalsAgainst: h1Goals,
          extraTime, penalties,
          penaltyScore: penaltyScore ? { player: penaltyScore.opponent, opponent: penaltyScore.player } : undefined,
          goalScorers: h2Scorers.goals, assistProviders: h2Scorers.assists,
          result: h1Result === 'W' ? 'L' : 'W',
        });

        if (h1Result === 'W') {
          nextRound.push(teamA);
          humanEliminated.set(humanB.userId, roundName);
        } else {
          nextRound.push(teamB);
          humanEliminated.set(humanA.userId, roundName);
        }
      } else if (humanA || humanB) {
        // Human vs AI
        const human = (humanA ?? humanB)!;
        const aiTeam = humanA ? teamB : teamA;
        const match = simulateFaCupMatchForHuman(human.starters, human.ratings, aiTeam, roundIdx, human.rng);
        humanMatches.get(human.userId)!.push(match);

        if (match.result === 'W') {
          nextRound.push(humanA ? teamA : teamB);
        } else {
          nextRound.push(aiTeam);
          humanEliminated.set(human.userId, roundName);
        }
      } else {
        // AI vs AI
        const result = simulateAIvAICupMatch(teamA, teamB, drawRng);
        nextRound.push(result.winner === teamA.name ? teamA : teamB);
      }
    }

    remaining = nextRound;
  }

  const faCupWinner = remaining[0].name;

  // Build results for each human
  const results = new Map<string, FaCupResult>();
  for (const h of humanTeams) {
    const matches = humanMatches.get(h.userId)!;
    const exitRound = humanEliminated.get(h.userId);
    const isWinner = faCupWinner === h.teamName;
    results.set(h.userId, {
      matches,
      winner: isWinner,
      exitRound: exitRound ?? null,
      faCupWinner,
    });
  }

  return { results, faCupWinner };
}

function simulateSharedLeagueCup(
  humanTeams: {
    userId: string;
    displayName: string;
    teamName: string;
    starters: DraftPlayer[];
    ratings: PhaseRatings;
    rng: () => number;
  }[],
  allCupTeams: { name: string; strength: number }[],
  drawRng: () => number,
): { results: Map<string, FaCupResult>; leagueCupWinner: string } {
  type BracketEntry = { name: string; strength: number; userId?: string };
  const humanMap = new Map(humanTeams.map(h => [h.teamName, h]));

  const bracket: BracketEntry[] = allCupTeams.map(t => ({
    name: t.name,
    strength: t.strength,
    userId: humanMap.get(t.name)?.userId,
  }));

  for (let i = bracket.length - 1; i > 0; i--) {
    const j = Math.floor(drawRng() * (i + 1));
    [bracket[i], bracket[j]] = [bracket[j], bracket[i]];
  }

  { const usedNames = new Set(bracket.map(t => t.name));
  let padIdx = 0;
  while (bracket.length < 32) {
    const club = LOWER_LEAGUE_CLUBS[padIdx % LOWER_LEAGUE_CLUBS.length];
    padIdx++;
    if (usedNames.has(club.name)) continue;
    usedNames.add(club.name);
    bracket.push({ name: club.name, strength: club.strength });
  } }

  const humanMatches = new Map<string, FaCupMatch[]>();
  const humanEliminated = new Map<string, string>();
  for (const h of humanTeams) humanMatches.set(h.userId, []);

  let remaining = bracket.slice(0, 32);

  for (let roundIdx = 0; roundIdx < 5; roundIdx++) {
    const roundName = LEAGUE_CUP_ROUNDS[roundIdx];
    const isSemiFinal = roundIdx === 3;
    const nextRound: BracketEntry[] = [];

    for (let i = 0; i < remaining.length; i += 2) {
      const teamA = remaining[i];
      const teamB = remaining[i + 1];
      const humanA = teamA.userId ? humanTeams.find(h => h.userId === teamA.userId) : undefined;
      const humanB = teamB.userId ? humanTeams.find(h => h.userId === teamB.userId) : undefined;

      if (humanA && humanB) {
        if (isSemiFinal) {
          // Two-legged semi: Human vs Human
          const leg1AIsHome = drawRng() > 0.5;
          const hb = HOME_ADVANTAGE;

          const l1AAtk = humanA.ratings.attack + (leg1AIsHome ? hb * 0.6 : 0);
          const l1AMid = humanA.ratings.midfield + (leg1AIsHome ? hb * 0.4 : 0);
          const l1ADef = humanA.ratings.defense + (leg1AIsHome ? hb * 0.3 : 0);
          const l1BAtk = humanB.ratings.attack + (leg1AIsHome ? 0 : hb * 0.6);
          const l1BMid = humanB.ratings.midfield + (leg1AIsHome ? 0 : hb * 0.4);
          const l1BDef = humanB.ratings.defense + (leg1AIsHome ? 0 : hb * 0.3);
          const l1ADefPow = l1ADef * 0.55 + humanA.ratings.gk * 0.30 + l1AMid * 0.15;
          const l1BDefPow = l1BDef * 0.55 + humanB.ratings.gk * 0.30 + l1BMid * 0.15;
          const l1AXg = computeExpectedGoals(l1AAtk, l1AMid, l1BDefPow);
          const l1BXg = computeExpectedGoals(l1BAtk, l1BMid, l1ADefPow);
          let l1AGoals = poisson(l1AXg * (0.85 + drawRng() * 0.30), drawRng);
          let l1BGoals = poisson(l1BXg * (0.85 + drawRng() * 0.30), drawRng);
          const l1AScorers = generateGoalScorers(humanA.starters, l1AGoals, humanA.rng);
          const l1BScorers = generateGoalScorers(humanB.starters, l1BGoals, humanB.rng);

          const leg2AIsHome = !leg1AIsHome;
          const l2AAtk = humanA.ratings.attack + (leg2AIsHome ? hb * 0.6 : 0);
          const l2AMid = humanA.ratings.midfield + (leg2AIsHome ? hb * 0.4 : 0);
          const l2ADef = humanA.ratings.defense + (leg2AIsHome ? hb * 0.3 : 0);
          const l2BAtk = humanB.ratings.attack + (leg2AIsHome ? 0 : hb * 0.6);
          const l2BMid = humanB.ratings.midfield + (leg2AIsHome ? 0 : hb * 0.4);
          const l2BDef = humanB.ratings.defense + (leg2AIsHome ? 0 : hb * 0.3);
          const l2ADefPow = l2ADef * 0.55 + humanA.ratings.gk * 0.30 + l2AMid * 0.15;
          const l2BDefPow = l2BDef * 0.55 + humanB.ratings.gk * 0.30 + l2BMid * 0.15;
          const l2AXg = computeExpectedGoals(l2AAtk, l2AMid, l2BDefPow);
          const l2BXg = computeExpectedGoals(l2BAtk, l2BMid, l2ADefPow);
          let l2AGoals = poisson(l2AXg * (0.85 + drawRng() * 0.30), drawRng);
          let l2BGoals = poisson(l2BXg * (0.85 + drawRng() * 0.30), drawRng);
          const l2AScorers = generateGoalScorers(humanA.starters, l2AGoals, humanA.rng);
          const l2BScorers = generateGoalScorers(humanB.starters, l2BGoals, humanB.rng);

          let aggA = l1AGoals + l2AGoals;
          let aggB = l1BGoals + l2BGoals;
          let extraTime = false;
          let penalties = false;
          let penaltyScore: { player: number; opponent: number } | undefined;
          let aResult: 'W' | 'L';

          if (aggA > aggB) {
            aResult = 'W';
          } else if (aggB > aggA) {
            aResult = 'L';
          } else {
            extraTime = true;
            const etA = poisson(l2AXg * 0.33, drawRng);
            const etB = poisson(l2BXg * 0.33, drawRng);
            l2AGoals += etA; l2BGoals += etB;
            aggA = l1AGoals + l2AGoals; aggB = l1BGoals + l2BGoals;
            const etAScorers = generateGoalScorers(humanA.starters, etA, humanA.rng, 90);
            const etBScorers = generateGoalScorers(humanB.starters, etB, humanB.rng, 90);
            l2AScorers.goals.push(...etAScorers.goals);
            l2AScorers.assists.push(...etAScorers.assists);
            l2BScorers.goals.push(...etBScorers.goals);
            l2BScorers.assists.push(...etBScorers.assists);
            if (aggA > aggB) {
              aResult = 'W';
            } else if (aggB > aggA) {
              aResult = 'L';
            } else {
              penalties = true;
              const pA = Math.floor(drawRng() * 3) + 3;
              const pB = Math.floor(drawRng() * 3) + 3;
              if (pA === pB) {
                penaltyScore = drawRng() > 0.5 ? { player: pA + 1, opponent: pB } : { player: pA, opponent: pB + 1 };
              } else {
                penaltyScore = { player: pA, opponent: pB };
              }
              aResult = penaltyScore.player > penaltyScore.opponent ? 'W' : 'L';
            }
          }

          l1AScorers.goals.sort((a, b) => a.minute - b.minute);
          l1AScorers.assists.sort((a, b) => a.minute - b.minute);
          l1BScorers.goals.sort((a, b) => a.minute - b.minute);
          l1BScorers.assists.sort((a, b) => a.minute - b.minute);
          l2AScorers.goals.sort((a, b) => a.minute - b.minute);
          l2BScorers.goals.sort((a, b) => a.minute - b.minute);

          humanMatches.get(humanA.userId)!.push({
            round: roundName, opponent: humanB.displayName,
            goalsFor: l1AGoals, goalsAgainst: l1BGoals,
            extraTime: false, penalties: false,
            goalScorers: l1AScorers.goals, assistProviders: l1AScorers.assists,
            result: aResult, isHome: leg1AIsHome,
            leg2: { goalsFor: l2AGoals, goalsAgainst: l2BGoals, isHome: leg2AIsHome, extraTime, penalties, penaltyScore, goalScorers: l2AScorers.goals },
          });
          humanMatches.get(humanB.userId)!.push({
            round: roundName, opponent: humanA.displayName,
            goalsFor: l1BGoals, goalsAgainst: l1AGoals,
            extraTime: false, penalties: false,
            goalScorers: l1BScorers.goals, assistProviders: l1BScorers.assists,
            result: aResult === 'W' ? 'L' : 'W', isHome: !leg1AIsHome,
            leg2: {
              goalsFor: l2BGoals, goalsAgainst: l2AGoals, isHome: !leg2AIsHome,
              extraTime, penalties,
              penaltyScore: penaltyScore ? { player: penaltyScore.opponent, opponent: penaltyScore.player } : undefined,
              goalScorers: l2BScorers.goals,
            },
          });

          if (aResult === 'W') {
            nextRound.push(teamA);
            humanEliminated.set(humanB.userId, roundName);
          } else {
            nextRound.push(teamB);
            humanEliminated.set(humanA.userId, roundName);
          }
        } else {
          // Single-leg round: Human vs Human
          const isH1Home = drawRng() > 0.5;
          const hb = HOME_ADVANTAGE;
          const h1Atk = humanA.ratings.attack + (isH1Home ? hb * 0.6 : 0);
          const h1Mid = humanA.ratings.midfield + (isH1Home ? hb * 0.4 : 0);
          const h1Def = humanA.ratings.defense + (isH1Home ? hb * 0.3 : 0);
          const h2Atk = humanB.ratings.attack + (isH1Home ? 0 : hb * 0.6);
          const h2Mid = humanB.ratings.midfield + (isH1Home ? 0 : hb * 0.4);
          const h2Def = humanB.ratings.defense + (isH1Home ? 0 : hb * 0.3);
          const h1DefPow = h1Def * 0.55 + humanA.ratings.gk * 0.30 + h1Mid * 0.15;
          const h2DefPow = h2Def * 0.55 + humanB.ratings.gk * 0.30 + h2Mid * 0.15;
          const h1Xg = computeExpectedGoals(h1Atk, h1Mid, h2DefPow);
          const h2Xg = computeExpectedGoals(h2Atk, h2Mid, h1DefPow);
          let h1Goals = poisson(h1Xg * (0.85 + drawRng() * 0.30), drawRng);
          let h2Goals = poisson(h2Xg * (0.85 + drawRng() * 0.30), drawRng);
          const h1Scorers = generateGoalScorers(humanA.starters, h1Goals, humanA.rng);
          const h2Scorers = generateGoalScorers(humanB.starters, h2Goals, humanB.rng);

          let extraTime = false;
          let penalties = false;
          let penaltyScore: { player: number; opponent: number } | undefined;
          if (h1Goals === h2Goals) {
            extraTime = true;
            const etH1 = poisson(h1Xg * 0.33, drawRng);
            const etH2 = poisson(h2Xg * 0.33, drawRng);
            h1Goals += etH1; h2Goals += etH2;
            const etH1Sc = generateGoalScorers(humanA.starters, etH1, humanA.rng, 90);
            const etH2Sc = generateGoalScorers(humanB.starters, etH2, humanB.rng, 90);
            h1Scorers.goals.push(...etH1Sc.goals); h1Scorers.assists.push(...etH1Sc.assists);
            h2Scorers.goals.push(...etH2Sc.goals); h2Scorers.assists.push(...etH2Sc.assists);
            if (h1Goals === h2Goals) {
              penalties = true;
              const p1 = Math.floor(drawRng() * 3) + 3;
              const p2 = Math.floor(drawRng() * 3) + 3;
              if (p1 === p2) {
                penaltyScore = drawRng() > 0.5 ? { player: p1 + 1, opponent: p2 } : { player: p1, opponent: p2 + 1 };
              } else {
                penaltyScore = { player: p1, opponent: p2 };
              }
            }
          }
          const h1Result: 'W' | 'L' = (penalties && penaltyScore)
            ? (penaltyScore.player > penaltyScore.opponent ? 'W' : 'L')
            : (h1Goals > h2Goals ? 'W' : 'L');

          h1Scorers.goals.sort((a, b) => a.minute - b.minute);
          h1Scorers.assists.sort((a, b) => a.minute - b.minute);
          h2Scorers.goals.sort((a, b) => a.minute - b.minute);
          h2Scorers.assists.sort((a, b) => a.minute - b.minute);

          humanMatches.get(humanA.userId)!.push({
            round: roundName, opponent: humanB.displayName,
            goalsFor: h1Goals, goalsAgainst: h2Goals,
            extraTime, penalties, penaltyScore,
            goalScorers: h1Scorers.goals, assistProviders: h1Scorers.assists,
            result: h1Result,
          });
          humanMatches.get(humanB.userId)!.push({
            round: roundName, opponent: humanA.displayName,
            goalsFor: h2Goals, goalsAgainst: h1Goals,
            extraTime, penalties,
            penaltyScore: penaltyScore ? { player: penaltyScore.opponent, opponent: penaltyScore.player } : undefined,
            goalScorers: h2Scorers.goals, assistProviders: h2Scorers.assists,
            result: h1Result === 'W' ? 'L' : 'W',
          });

          if (h1Result === 'W') {
            nextRound.push(teamA);
            humanEliminated.set(humanB.userId, roundName);
          } else {
            nextRound.push(teamB);
            humanEliminated.set(humanA.userId, roundName);
          }
        }
      } else if (humanA || humanB) {
        // Human vs AI
        const human = (humanA ?? humanB)!;
        const aiTeam = humanA ? teamB : teamA;
        if (isSemiFinal) {
          // Two-legged semi: Human vs AI
          const leg1IsHome = human.rng() > 0.5;
          const leg1 = simulateFaCupLeg(human.starters, human.ratings, aiTeam, roundIdx, human.rng, leg1IsHome, LEAGUE_CUP_ROUNDS);
          const leg2 = simulateFaCupLeg(human.starters, human.ratings, aiTeam, roundIdx, human.rng, !leg1IsHome, LEAGUE_CUP_ROUNDS);

          const aggFor = leg1.goalsFor + leg2.goalsFor;
          const aggAgainst = leg1.goalsAgainst + leg2.goalsAgainst;
          let result: 'W' | 'L';
          let extraTime = false;
          let penalties = false;
          let penaltyScore: { player: number; opponent: number } | undefined;

          if (aggFor > aggAgainst) {
            result = 'W';
          } else if (aggAgainst > aggFor) {
            result = 'L';
          } else {
            extraTime = true;
            const etFor = poisson(leg2.xg * 0.33, human.rng);
            const etAgainst = poisson(leg2.oppXg * 0.33, human.rng);
            if (etFor > etAgainst) {
              result = 'W'; leg2.goalsFor += etFor; leg2.goalsAgainst += etAgainst;
            } else if (etAgainst > etFor) {
              result = 'L'; leg2.goalsFor += etFor; leg2.goalsAgainst += etAgainst;
            } else {
              leg2.goalsFor += etFor; leg2.goalsAgainst += etAgainst;
              penalties = true;
              const myPens = Math.floor(human.rng() * 3) + 3;
              const oppPens = Math.floor(human.rng() * 3) + 3;
              if (myPens === oppPens) {
                penaltyScore = human.rng() > 0.5 ? { player: myPens + 1, opponent: oppPens } : { player: myPens, opponent: oppPens + 1 };
              } else {
                penaltyScore = { player: myPens, opponent: oppPens };
              }
              result = (penaltyScore!.player > penaltyScore!.opponent) ? 'W' : 'L';
            }
          }

          humanMatches.get(human.userId)!.push({
            round: roundName, opponent: aiTeam.name,
            goalsFor: leg1.goalsFor, goalsAgainst: leg1.goalsAgainst,
            extraTime: false, penalties: false,
            goalScorers: leg1.scorers.goals, assistProviders: leg1.scorers.assists,
            result, isHome: leg1IsHome,
            leg2: { goalsFor: leg2.goalsFor, goalsAgainst: leg2.goalsAgainst, isHome: !leg1IsHome, extraTime, penalties, penaltyScore, goalScorers: leg2.scorers.goals },
          });

          if (result === 'W') {
            nextRound.push(humanA ? teamA : teamB);
          } else {
            nextRound.push(aiTeam);
            humanEliminated.set(human.userId, roundName);
          }
        } else {
          const match = simulateFaCupMatchForHumanNamed(human.starters, human.ratings, aiTeam, roundIdx, human.rng, LEAGUE_CUP_ROUNDS);
          humanMatches.get(human.userId)!.push(match);
          if (match.result === 'W') {
            nextRound.push(humanA ? teamA : teamB);
          } else {
            nextRound.push(aiTeam);
            humanEliminated.set(human.userId, roundName);
          }
        }
      } else {
        // AI vs AI
        const aiResult = simulateAIvAICupMatch(teamA, teamB, drawRng);
        nextRound.push(aiResult.winner === teamA.name ? teamA : teamB);
      }
    }

    remaining = nextRound;
  }

  const leagueCupWinner = remaining[0].name;
  const results = new Map<string, FaCupResult>();
  for (const h of humanTeams) {
    const matches = humanMatches.get(h.userId)!;
    const exitRound = humanEliminated.get(h.userId);
    const isWinner = leagueCupWinner === h.teamName;
    results.set(h.userId, {
      matches,
      winner: isWinner,
      exitRound: exitRound ?? null,
      faCupWinner: leagueCupWinner,
    });
  }

  return { results, leagueCupWinner };
}

function simulateFaCupMatchForHuman(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  opponent: { name: string; strength: number },
  round: number,
  rng: () => number,
): FaCupMatch {
  const roundName = FA_CUP_ROUNDS[round];
  const isHome = round < 4 ? rng() > 0.5 : false;
  const homeBonus = isHome ? HOME_ADVANTAGE : 0;

  const myAttack = ratings.attack + homeBonus * 0.6;
  const myMidfield = ratings.midfield + homeBonus * 0.4;
  const myDefense = ratings.defense + homeBonus * 0.3;
  const myGk = ratings.gk;
  const oppStrength = opponent.strength + (isHome ? 0 : HOME_ADVANTAGE);

  const myXg = computeExpectedGoals(myAttack, myMidfield, oppStrength);
  const ourDefPower = myDefense * 0.55 + myGk * 0.30 + myMidfield * 0.15;
  const oppXg = computeExpectedGoals(oppStrength, oppStrength * 0.95, ourDefPower);

  let goalsFor = poisson(myXg, rng);
  let goalsAgainst = poisson(oppXg, rng);
  let extraTime = false;
  let penalties = false;
  let penaltyScore: { player: number; opponent: number } | undefined;

  const scorers = generateGoalScorers(players, goalsFor, rng);

  if (goalsFor === goalsAgainst) {
    extraTime = true;
    const etFor = poisson(myXg * 0.33, rng);
    const etAgainst = poisson(oppXg * 0.33, rng);
    goalsFor += etFor;
    goalsAgainst += etAgainst;
    const etScorers = generateGoalScorers(players, etFor, rng, 90);
    scorers.goals.push(...etScorers.goals);
    scorers.assists.push(...etScorers.assists);

    if (goalsFor === goalsAgainst) {
      penalties = true;
      const myPens = Math.floor(rng() * 3) + 3;
      const oppPens = Math.floor(rng() * 3) + 3;
      if (myPens === oppPens) {
        penaltyScore = rng() > 0.5 ? { player: myPens + 1, opponent: oppPens } : { player: myPens, opponent: oppPens + 1 };
      } else {
        penaltyScore = { player: myPens, opponent: oppPens };
      }
    }
  }

  scorers.goals.sort((a, b) => a.minute - b.minute);
  scorers.assists.sort((a, b) => a.minute - b.minute);

  let result: 'W' | 'L';
  if (penalties && penaltyScore) {
    result = penaltyScore.player > penaltyScore.opponent ? 'W' : 'L';
  } else {
    result = goalsFor > goalsAgainst ? 'W' : 'L';
  }

  return {
    round: roundName, opponent: opponent.name,
    goalsFor, goalsAgainst, extraTime, penalties, penaltyScore,
    goalScorers: scorers.goals, assistProviders: scorers.assists,
    result,
  };
}

function generateGoalScorers(
  players: DraftPlayer[],
  goalCount: number,
  rng: () => number,
  minuteOffset: number = 0,
): { goals: { player: string; minute: number }[]; assists: { player: string; minute: number }[] } {
  const goals: { player: string; minute: number }[] = [];
  const assists: { player: string; minute: number }[] = [];
  const penaltyTaker = [...players].sort((a, b) => goalScoringWeight(b) - goalScoringWeight(a))[0];

  for (let i = 0; i < goalCount; i++) {
    const minute = minuteOffset + Math.floor(rng() * (minuteOffset > 0 ? 30 : 90)) + 1;
    const isPenalty = rng() < 0.10;
    const scorer = isPenalty ? penaltyTaker : weightedPick(players, goalScoringWeight, rng);
    goals.push({ player: scorer.name, minute });
    if (!isPenalty && rng() < 0.75) {
      const eligible = players.filter(p => p.name !== scorer.name);
      if (eligible.length > 0) {
        assists.push({ player: weightedPick(eligible, assistWeight, rng).name, minute });
      }
    }
  }
  return { goals, assists };
}

// --- AI vs AI knockout tie (two-legged or single final) ---

function simulateAIvAIKnockoutTie(
  teamA: { name: string; strength: number },
  teamB: { name: string; strength: number },
  rng: () => number,
  isFinal: boolean,
): string {
  if (isFinal) {
    const result = simulateAIvAICupMatch(teamA, teamB, rng);
    return result.winner;
  }
  const leg1 = simulateNeutralMatch(teamA, teamB, rng);
  const leg2 = simulateNeutralMatch(teamB, teamA, rng);
  let aggA = leg1.homeGoals + leg2.awayGoals;
  let aggB = leg1.awayGoals + leg2.homeGoals;
  if (aggA === aggB) {
    const et1 = poisson(computeExpectedGoals(teamB.strength, teamB.strength * 0.95, teamA.strength) * 0.33, rng);
    const et2 = poisson(computeExpectedGoals(teamA.strength, teamA.strength * 0.95, teamB.strength) * 0.33, rng);
    aggA += et2;
    aggB += et1;
    if (aggA === aggB) {
      return rng() > 0.5 ? teamA.name : teamB.name;
    }
  }
  return aggA > aggB ? teamA.name : teamB.name;
}

// --- UCL knockout tie simulation ---

function simulateUCLKnockoutTie(
  round: string,
  opponentName: string,
  opponentStrength: number,
  players: DraftPlayer[],
  ratings: PhaseRatings,
  rng: () => number,
  isFinal: boolean,
): UCLKnockoutTie {
  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);
  const opp = { name: opponentName, strength: opponentStrength };

  const makeUCLMatch = (m: MatchResult): UCLMatch => ({
    opponent: m.opponent,
    isHome: m.isHome,
    goalsFor: m.goalsFor,
    goalsAgainst: m.goalsAgainst,
    result: m.result,
    goalScorers: [...m.goalScorers],
    assistProviders: [...m.assistProviders],
  });

  const addExtraTime = (match: UCLMatch, matchPlayers: DraftPlayer[]): void => {
    match.extraTime = true;
    const etXg = computeExpectedGoals(ratings.attack, ratings.midfield, opp.strength) * 0.33;
    const ourDef = ratings.defense * 0.55 + ratings.gk * 0.30 + ratings.midfield * 0.15;
    const etOppXg = computeExpectedGoals(opp.strength, opp.strength * 0.95, ourDef) * 0.33;
    const etFor = poisson(etXg, rng);
    const etAgainst = poisson(etOppXg, rng);
    match.goalsFor += etFor;
    match.goalsAgainst += etAgainst;
    for (let i = 0; i < etFor; i++) {
      const minute = 90 + Math.floor(rng() * 30) + 1;
      const scorer = weightedPick(matchPlayers, goalScoringWeight, rng);
      match.goalScorers.push({ player: scorer.name, minute });
      if (rng() < 0.75) {
        const eligible = matchPlayers.filter(p => p.name !== scorer.name);
        if (eligible.length > 0) {
          match.assistProviders.push({ player: weightedPick(eligible, assistWeight, rng).name, minute });
        }
      }
    }
  };

  const addPenalties = (match: UCLMatch): 'W' | 'L' => {
    match.penalties = true;
    const myPens = Math.floor(rng() * 3) + 3;
    const oppPens = Math.floor(rng() * 3) + 3;
    if (myPens === oppPens) {
      match.penaltyScore = rng() > 0.5
        ? { player: myPens + 1, opponent: oppPens }
        : { player: myPens, opponent: oppPens + 1 };
    } else {
      match.penaltyScore = { player: myPens, opponent: oppPens };
    }
    return match.penaltyScore.player > match.penaltyScore.opponent ? 'W' : 'L';
  };

  if (isFinal) {
    const activeSubs = subs.filter(() => rng() < 0.6);
    const matchPlayers = [...starters, ...activeSubs];
    const m = simulateMatch(matchPlayers, ratings, opp, rng() > 0.5, rng);
    const match = makeUCLMatch(m);

    if (match.goalsFor === match.goalsAgainst) {
      addExtraTime(match, matchPlayers);
      if (match.goalsFor === match.goalsAgainst) {
        const penResult = addPenalties(match);
        return { round, opponent: opponentName, leg1: match, result: penResult };
      }
      match.result = match.goalsFor > match.goalsAgainst ? 'W' : 'L';
    }
    return { round, opponent: opponentName, leg1: match, result: match.result as 'W' | 'L' };
  }

  // Two-legged tie
  const isHomeLeg1 = rng() > 0.5;

  const leg1Subs = subs.filter(() => rng() < 0.6);
  const leg1Players = [...starters, ...leg1Subs];
  const leg1 = makeUCLMatch(simulateMatch(leg1Players, ratings, opp, isHomeLeg1, rng));

  const leg2Subs = subs.filter(() => rng() < 0.6);
  const leg2Players = [...starters, ...leg2Subs];
  const leg2 = makeUCLMatch(simulateMatch(leg2Players, ratings, opp, !isHomeLeg1, rng));

  let aggFor = leg1.goalsFor + leg2.goalsFor;
  let aggAgainst = leg1.goalsAgainst + leg2.goalsAgainst;

  if (aggFor === aggAgainst) {
    addExtraTime(leg2, leg2Players);
    aggFor = leg1.goalsFor + leg2.goalsFor;
    aggAgainst = leg1.goalsAgainst + leg2.goalsAgainst;

    if (aggFor === aggAgainst) {
      const penResult = addPenalties(leg2);
      return { round, opponent: opponentName, leg1, leg2, result: penResult };
    }
  }

  const tieResult: 'W' | 'L' = aggFor > aggAgainst ? 'W' : 'L';
  return { round, opponent: opponentName, leg1, leg2, result: tieResult };
}

// --- Champions League simulation ---

function simulateChampionsLeague(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  previousLeagueTable: LeagueTeam[],
  opponents: { name: string; strength: number }[],
  rng: () => number,
  uelWinnerQualifies?: boolean,
  playerTeamOverride?: string,
): UCLResult {
  const playerTeamName = playerTeamOverride ?? 'KNOWITBALL FC';
  const playerFinish = previousLeagueTable.findIndex(t => t.isPlayer) + 1;

  const qualifiesThroughLeague = playerFinish >= 1 && playerFinish <= 5;
  if (!qualifiesThroughLeague && !uelWinnerQualifies) {
    return {
      qualified: false, leagueMatches: [], leaguePosition: 0,
      leagueTable: [], knockoutTies: [], winner: false, exitStage: null, tournamentWinner: '',
    };
  }

  const potForFinish = (f: number) => f <= 2 ? 1 : f === 3 ? 2 : f === 4 ? 3 : 4;
  const playerPot = qualifiesThroughLeague ? potForFinish(playerFinish) : 4;

  // Build 4 pots of 9 teams each: the player, the other PL qualifiers
  // (previous season's top 5), then the UCL pool. A used-name set makes
  // duplicates impossible — the old two-pass fill could re-add an
  // already-placed pot-4 team when the player entered as UEL winner (giving
  // it doubled fixtures and a 35-name league table) and silently dropped the
  // 5th-place PL qualifier.
  const pots: { name: string; strength: number; isPlayer: boolean }[][] = [[], [], [], []];
  const used = new Set<string>([playerTeamName]);
  pots[playerPot - 1].push({ name: playerTeamName, strength: ratings.teamStrength, isPlayer: true });

  // Other PL qualifiers (top 5 excluding player)
  const opponentMap = new Map(opponents.map(o => [o.name, o.strength]));
  for (let i = 0; i < Math.min(5, previousLeagueTable.length); i++) {
    const team = previousLeagueTable[i];
    if (team.isPlayer || used.has(team.name)) continue;
    used.add(team.name);
    pots[potForFinish(i + 1) - 1].push({ name: team.name, strength: opponentMap.get(team.name) || 75, isPlayer: false });
  }

  // Fill the remaining slots from the UCL pool. Pot 4 fills strongest-first
  // so when the player enters as UEL winner (taking a pot-4 slot) it's the
  // weakest team that misses the cut.
  const poolByPot: Record<number, { name: string; strength: number }[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const t of UCL_TEAMS) poolByPot[t.pot].push({ name: t.name, strength: t.strength });
  poolByPot[4].sort((a, b) => b.strength - a.strength);
  for (let potNo = 1; potNo <= 4; potNo++) {
    for (const t of poolByPot[potNo]) {
      if (pots[potNo - 1].length >= 9) break;
      if (used.has(t.name)) continue;
      used.add(t.name);
      pots[potNo - 1].push({ name: t.name, strength: t.strength, isPlayer: false });
    }
  }

  const allUCLTeams = [...pots[0], ...pots[1], ...pots[2], ...pots[3]];
  const strengthMap = new Map(allUCLTeams.map(t => [t.name, t.strength]));

  // Draw player's 8 opponents (2 per pot, 1H 1A per pot)
  const playerOpponents: { name: string; strength: number; isHome: boolean }[] = [];
  for (const pot of pots) {
    const available = pot.filter(t => !t.isPlayer);
    const shuffled = [...available].sort(() => rng() - 0.5);
    const homeFirst = rng() > 0.5;
    playerOpponents.push({ ...shuffled[0], isHome: homeFirst });
    playerOpponents.push({ ...shuffled[1], isHome: !homeFirst });
  }
  playerOpponents.sort(() => rng() - 0.5);

  // Simulate player's 8 league phase matches
  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);
  const leagueMatches: UCLMatch[] = [];

  for (const opp of playerOpponents) {
    const activeSubs = subs.filter(() => rng() < 0.5);
    const matchPlayers = [...starters, ...activeSubs];
    const m = simulateMatch(matchPlayers, ratings, { name: opp.name, strength: opp.strength }, opp.isHome, rng);
    leagueMatches.push({
      opponent: m.opponent, isHome: m.isHome,
      goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst,
      result: m.result, goalScorers: m.goalScorers, assistProviders: m.assistProviders,
    });
  }

  // Build league table — player's results already simulated
  const tableData: Record<string, UCLLeagueStanding> = {};
  for (const team of allUCLTeams) {
    tableData[team.name] = {
      name: team.name, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      isPlayer: team.isPlayer, strength: team.strength,
    };
  }

  for (const m of leagueMatches) {
    const pt = tableData[playerTeamName];
    pt.played++;
    pt.goalsFor += m.goalsFor;
    pt.goalsAgainst += m.goalsAgainst;
    if (m.result === 'W') { pt.won++; pt.points += 3; }
    else if (m.result === 'D') { pt.drawn++; pt.points += 1; }
    else { pt.lost++; }
  }

  // Simulate 8 matches for each other team
  for (const team of allUCLTeams) {
    if (team.isPlayer) continue;
    const td = tableData[team.name];
    for (const pot of pots) {
      const available = pot.filter(t => t.name !== team.name);
      const shuffled = [...available].sort(() => rng() - 0.5);
      const picked = shuffled.slice(0, 2);
      for (let k = 0; k < picked.length; k++) {
        const isHome = k === 0;
        const home = isHome ? team : picked[k];
        const away = isHome ? picked[k] : team;
        const { homeGoals, awayGoals } = simulateNeutralMatch(
          { name: home.name, strength: home.strength },
          { name: away.name, strength: away.strength }, rng,
        );
        const gf = isHome ? homeGoals : awayGoals;
        const ga = isHome ? awayGoals : homeGoals;
        td.played++;
        td.goalsFor += gf;
        td.goalsAgainst += ga;
        if (gf > ga) { td.won++; td.points += 3; }
        else if (gf === ga) { td.drawn++; td.points += 1; }
        else { td.lost++; }
      }
    }
  }

  const leagueTable = Object.values(tableData);
  for (const t of leagueTable) t.goalDifference = t.goalsFor - t.goalsAgainst;
  leagueTable.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  const leaguePosition = leagueTable.findIndex(t => t.isPlayer) + 1;

  const notQualified: UCLResult = {
    qualified: true, leagueMatches, leaguePosition, leagueTable,
    knockoutTies: [], winner: false, exitStage: 'League Phase', tournamentWinner: '',
  };

  if (leaguePosition > 24) {
    // Player eliminated in league phase — simulate rest of bracket to find winner
    const r32Teams: { name: string; strength: number }[] = [];
    for (let i = 8; i < 24; i++) {
      r32Teams.push({ name: leagueTable[i].name, strength: strengthMap.get(leagueTable[i].name) || 75 });
    }
    let r16Survivors: { name: string; strength: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const hi = r32Teams[i];
      const lo = r32Teams[15 - i];
      const w = simulateAIvAIKnockoutTie(hi, lo, rng, false);
      r16Survivors.push(w === hi.name ? hi : lo);
    }
    for (let i = 0; i < 8; i++) {
      r16Survivors.push({ name: leagueTable[i].name, strength: strengthMap.get(leagueTable[i].name) || 75 });
    }
    r16Survivors.sort(() => rng() - 0.5);
    let qfSurvivors: { name: string; strength: number }[] = [];
    for (let i = 0; i < r16Survivors.length; i += 2) {
      const w = simulateAIvAIKnockoutTie(r16Survivors[i], r16Survivors[i + 1], rng, false);
      qfSurvivors.push(w === r16Survivors[i].name ? r16Survivors[i] : r16Survivors[i + 1]);
    }
    let sfSurvivors: { name: string; strength: number }[] = [];
    for (let i = 0; i < qfSurvivors.length; i += 2) {
      const w = simulateAIvAIKnockoutTie(qfSurvivors[i], qfSurvivors[i + 1], rng, false);
      sfSurvivors.push(w === qfSurvivors[i].name ? qfSurvivors[i] : qfSurvivors[i + 1]);
    }
    let finalSurvivors: { name: string; strength: number }[] = [];
    for (let i = 0; i < sfSurvivors.length; i += 2) {
      const w = simulateAIvAIKnockoutTie(sfSurvivors[i], sfSurvivors[i + 1], rng, false);
      finalSurvivors.push(w === sfSurvivors[i].name ? sfSurvivors[i] : sfSurvivors[i + 1]);
    }
    const champion = simulateAIvAIKnockoutTie(finalSurvivors[0], finalSurvivors[1], rng, true);
    notQualified.tournamentWinner = champion;
    return notQualified;
  }

  // --- Knockout phase (full bracket) ---
  const knockoutTies: UCLKnockoutTie[] = [];

  // R32: positions 9-24 paired: 9v24, 10v23, etc.
  type BracketTeam = { name: string; strength: number };
  const r32Pairs: [BracketTeam, BracketTeam][] = [];
  for (let i = 0; i < 8; i++) {
    const hiPos = 8 + i;
    const loPos = 23 - i;
    r32Pairs.push([
      { name: leagueTable[hiPos].name, strength: strengthMap.get(leagueTable[hiPos].name) || 75 },
      { name: leagueTable[loPos].name, strength: strengthMap.get(leagueTable[loPos].name) || 75 },
    ]);
  }

  // Simulate all R32 ties
  const r32Winners: BracketTeam[] = [];
  let playerEliminated = false;
  let playerExitStage: string | null = null;
  for (const [hi, lo] of r32Pairs) {
    const playerInvolved = hi.name === playerTeamName || lo.name === playerTeamName;
    if (playerInvolved) {
      const oppName = hi.name === playerTeamName ? lo.name : hi.name;
      const oppStr = hi.name === playerTeamName ? lo.strength : hi.strength;
      const tie = simulateUCLKnockoutTie('Round of 32', oppName, oppStr, players, ratings, rng, false);
      knockoutTies.push(tie);
      if (tie.result === 'L') {
        playerEliminated = true;
        playerExitStage = 'Round of 32';
        r32Winners.push({ name: oppName, strength: oppStr });
      } else {
        r32Winners.push({ name: playerTeamName, strength: ratings.teamStrength });
      }
    } else {
      const w = simulateAIvAIKnockoutTie(hi, lo, rng, false);
      r32Winners.push(w === hi.name ? hi : lo);
    }
  }

  // R16: top 8 auto-qualifiers paired with R32 winners (8v R32W[0], 7v R32W[1], etc.)
  const r16Pairs: [BracketTeam, BracketTeam][] = [];
  for (let i = 0; i < 8; i++) {
    const autoQ: BracketTeam = { name: leagueTable[7 - i].name, strength: strengthMap.get(leagueTable[7 - i].name) || 75 };
    if (leagueTable[7 - i].isPlayer) {
      r16Pairs.push([{ name: playerTeamName, strength: ratings.teamStrength }, r32Winners[i]]);
    } else if (r32Winners[i].name === playerTeamName) {
      r16Pairs.push([r32Winners[i], autoQ]);
    } else {
      r16Pairs.push([autoQ, r32Winners[i]]);
    }
  }

  const r16Winners: BracketTeam[] = [];
  for (const [a, b] of r16Pairs) {
    const playerInvolved = a.name === playerTeamName || b.name === playerTeamName;
    if (playerInvolved && !playerEliminated) {
      const oppName = a.name === playerTeamName ? b.name : a.name;
      const oppStr = a.name === playerTeamName ? b.strength : a.strength;
      const tie = simulateUCLKnockoutTie('Round of 16', oppName, oppStr, players, ratings, rng, false);
      knockoutTies.push(tie);
      if (tie.result === 'L') {
        playerEliminated = true;
        playerExitStage = 'Round of 16';
        r16Winners.push({ name: oppName, strength: oppStr });
      } else {
        r16Winners.push({ name: playerTeamName, strength: ratings.teamStrength });
      }
    } else {
      const w = simulateAIvAIKnockoutTie(a, b, rng, false);
      r16Winners.push(w === a.name ? a : b);
    }
  }

  // QF, SF, Final — same pattern
  const roundNames = ['Quarter-Final', 'Semi-Final', 'Final'];
  let currentRound = r16Winners;
  for (let ri = 0; ri < roundNames.length; ri++) {
    const roundName = roundNames[ri];
    const isFinal = ri === 2;
    const nextRound: BracketTeam[] = [];
    for (let i = 0; i < currentRound.length; i += 2) {
      const a = currentRound[i];
      const b = currentRound[i + 1];
      const playerInvolved = (a.name === playerTeamName || b.name === playerTeamName) && !playerEliminated;
      if (playerInvolved) {
        const oppName = a.name === playerTeamName ? b.name : a.name;
        const oppStr = a.name === playerTeamName ? b.strength : a.strength;
        const tie = simulateUCLKnockoutTie(roundName, oppName, oppStr, players, ratings, rng, isFinal);
        knockoutTies.push(tie);
        if (tie.result === 'L') {
          playerEliminated = true;
          playerExitStage = roundName;
          nextRound.push({ name: oppName, strength: oppStr });
        } else {
          nextRound.push({ name: playerTeamName, strength: ratings.teamStrength });
        }
      } else {
        const w = simulateAIvAIKnockoutTie(a, b, rng, isFinal);
        nextRound.push(w === a.name ? a : b);
      }
    }
    currentRound = nextRound;
  }

  const tournamentWinner = currentRound[0].name;
  const playerWon = tournamentWinner === playerTeamName;

  return {
    qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies,
    winner: playerWon,
    exitStage: playerWon ? null : playerExitStage,
    tournamentWinner,
  };
}

function simulateEuropaLeague(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  previousLeagueTable: LeagueTeam[],
  opponents: { name: string; strength: number }[],
  rng: () => number,
  faCupWinnerQualifies?: boolean,
  playerTeamOverride?: string,
): UCLResult {
  const playerTeamName = playerTeamOverride ?? 'KNOWITBALL FC';
  const playerFinish = previousLeagueTable.findIndex(t => t.isPlayer) + 1;

  if (!faCupWinnerQualifies && (playerFinish < 6 || playerFinish > 7)) {
    return {
      qualified: false, leagueMatches: [], leaguePosition: 0,
      leagueTable: [], knockoutTies: [], winner: false, exitStage: null, tournamentWinner: '',
    };
  }

  const playerPot = faCupWinnerQualifies ? 2 : (playerFinish === 6 ? 1 : 2);

  const pots: { name: string; strength: number; isPlayer: boolean }[][] = [[], [], [], []];
  pots[playerPot - 1].push({ name: playerTeamName, strength: ratings.teamStrength, isPlayer: true });

  const opponentMap = new Map(opponents.map(o => [o.name, o.strength]));
  if (!faCupWinnerQualifies) {
    const otherPLSlot = playerFinish === 6 ? 7 : 6;
    const otherPLPot = otherPLSlot === 6 ? 1 : 2;
    for (let i = 0; i < previousLeagueTable.length; i++) {
      const team = previousLeagueTable[i];
      if (team.isPlayer) continue;
      if (i + 1 === otherPLSlot) {
        const strength = opponentMap.get(team.name) || 75;
        pots[otherPLPot - 1].push({ name: team.name, strength, isPlayer: false });
        break;
      }
    }
  } else {
    for (const slot of [6, 7]) {
      const team = previousLeagueTable[slot - 1];
      if (team && !team.isPlayer) {
        const pot = slot === 6 ? 1 : 2;
        const strength = opponentMap.get(team.name) || 75;
        pots[pot - 1].push({ name: team.name, strength, isPlayer: false });
      }
    }
  }

  for (const uelTeam of UEL_TEAMS) {
    if (pots[uelTeam.pot - 1].length < 9) {
      pots[uelTeam.pot - 1].push({ name: uelTeam.name, strength: uelTeam.strength, isPlayer: false });
    }
  }

  const allUELTeams = [...pots[0], ...pots[1], ...pots[2], ...pots[3]];
  const strengthMap = new Map(allUELTeams.map(t => [t.name, t.strength]));

  const playerOpponents: { name: string; strength: number; isHome: boolean }[] = [];
  for (const pot of pots) {
    const available = pot.filter(t => !t.isPlayer);
    const shuffled = [...available].sort(() => rng() - 0.5);
    const homeFirst = rng() > 0.5;
    playerOpponents.push({ ...shuffled[0], isHome: homeFirst });
    playerOpponents.push({ ...shuffled[1], isHome: !homeFirst });
  }
  playerOpponents.sort(() => rng() - 0.5);

  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);
  const leagueMatches: UCLMatch[] = [];

  for (const opp of playerOpponents) {
    const activeSubs = subs.filter(() => rng() < 0.5);
    const matchPlayers = [...starters, ...activeSubs];
    const m = simulateMatch(matchPlayers, ratings, { name: opp.name, strength: opp.strength }, opp.isHome, rng);
    leagueMatches.push({
      opponent: m.opponent, isHome: m.isHome,
      goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst,
      result: m.result, goalScorers: m.goalScorers, assistProviders: m.assistProviders,
    });
  }

  const tableData: Record<string, UCLLeagueStanding> = {};
  for (const team of allUELTeams) {
    tableData[team.name] = {
      name: team.name, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      isPlayer: team.isPlayer, strength: team.strength,
    };
  }

  for (const m of leagueMatches) {
    const pt = tableData[playerTeamName];
    pt.played++;
    pt.goalsFor += m.goalsFor;
    pt.goalsAgainst += m.goalsAgainst;
    if (m.result === 'W') { pt.won++; pt.points += 3; }
    else if (m.result === 'D') { pt.drawn++; pt.points += 1; }
    else { pt.lost++; }
  }

  for (const team of allUELTeams) {
    if (team.isPlayer) continue;
    const td = tableData[team.name];
    for (const pot of pots) {
      const available = pot.filter(t => t.name !== team.name);
      const shuffled = [...available].sort(() => rng() - 0.5);
      const picked = shuffled.slice(0, 2);
      for (let k = 0; k < picked.length; k++) {
        const isHome = k === 0;
        const home = isHome ? team : picked[k];
        const away = isHome ? picked[k] : team;
        const { homeGoals, awayGoals } = simulateNeutralMatch(
          { name: home.name, strength: home.strength },
          { name: away.name, strength: away.strength }, rng,
        );
        const gf = isHome ? homeGoals : awayGoals;
        const ga = isHome ? awayGoals : homeGoals;
        td.played++;
        td.goalsFor += gf;
        td.goalsAgainst += ga;
        if (gf > ga) { td.won++; td.points += 3; }
        else if (gf === ga) { td.drawn++; td.points += 1; }
        else { td.lost++; }
      }
    }
  }

  const leagueTable = Object.values(tableData);
  for (const t of leagueTable) t.goalDifference = t.goalsFor - t.goalsAgainst;
  leagueTable.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  const leaguePosition = leagueTable.findIndex(t => t.isPlayer) + 1;

  const uelNotQualified: UCLResult = {
    qualified: true, leagueMatches, leaguePosition, leagueTable,
    knockoutTies: [], winner: false, exitStage: 'League Phase', tournamentWinner: '',
  };

  if (leaguePosition > 24) {
    const r32Teams: { name: string; strength: number }[] = [];
    for (let i = 8; i < 24; i++) {
      r32Teams.push({ name: leagueTable[i].name, strength: strengthMap.get(leagueTable[i].name) || 70 });
    }
    let r16Survivors: { name: string; strength: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const hi = r32Teams[i];
      const lo = r32Teams[15 - i];
      const w = simulateAIvAIKnockoutTie(hi, lo, rng, false);
      r16Survivors.push(w === hi.name ? hi : lo);
    }
    for (let i = 0; i < 8; i++) {
      r16Survivors.push({ name: leagueTable[i].name, strength: strengthMap.get(leagueTable[i].name) || 70 });
    }
    r16Survivors.sort(() => rng() - 0.5);
    let qfSurvivors: { name: string; strength: number }[] = [];
    for (let i = 0; i < r16Survivors.length; i += 2) {
      const w = simulateAIvAIKnockoutTie(r16Survivors[i], r16Survivors[i + 1], rng, false);
      qfSurvivors.push(w === r16Survivors[i].name ? r16Survivors[i] : r16Survivors[i + 1]);
    }
    let sfSurvivors: { name: string; strength: number }[] = [];
    for (let i = 0; i < qfSurvivors.length; i += 2) {
      const w = simulateAIvAIKnockoutTie(qfSurvivors[i], qfSurvivors[i + 1], rng, false);
      sfSurvivors.push(w === qfSurvivors[i].name ? qfSurvivors[i] : qfSurvivors[i + 1]);
    }
    let finalSurvivors: { name: string; strength: number }[] = [];
    for (let i = 0; i < sfSurvivors.length; i += 2) {
      const w = simulateAIvAIKnockoutTie(sfSurvivors[i], sfSurvivors[i + 1], rng, false);
      finalSurvivors.push(w === sfSurvivors[i].name ? sfSurvivors[i] : sfSurvivors[i + 1]);
    }
    const champion = simulateAIvAIKnockoutTie(finalSurvivors[0], finalSurvivors[1], rng, true);
    uelNotQualified.tournamentWinner = champion;
    return uelNotQualified;
  }

  // --- Knockout phase (full bracket) ---
  const knockoutTies: UCLKnockoutTie[] = [];

  type UELBracketTeam = { name: string; strength: number };
  const r32Pairs: [UELBracketTeam, UELBracketTeam][] = [];
  for (let i = 0; i < 8; i++) {
    const hiPos = 8 + i;
    const loPos = 23 - i;
    r32Pairs.push([
      { name: leagueTable[hiPos].name, strength: strengthMap.get(leagueTable[hiPos].name) || 70 },
      { name: leagueTable[loPos].name, strength: strengthMap.get(leagueTable[loPos].name) || 70 },
    ]);
  }

  const r32Winners: UELBracketTeam[] = [];
  let playerEliminated = false;
  let playerExitStage: string | null = null;
  for (const [hi, lo] of r32Pairs) {
    const playerInvolved = hi.name === playerTeamName || lo.name === playerTeamName;
    if (playerInvolved) {
      const oppName = hi.name === playerTeamName ? lo.name : hi.name;
      const oppStr = hi.name === playerTeamName ? lo.strength : hi.strength;
      const tie = simulateUCLKnockoutTie('Round of 32', oppName, oppStr, players, ratings, rng, false);
      knockoutTies.push(tie);
      if (tie.result === 'L') {
        playerEliminated = true;
        playerExitStage = 'Round of 32';
        r32Winners.push({ name: oppName, strength: oppStr });
      } else {
        r32Winners.push({ name: playerTeamName, strength: ratings.teamStrength });
      }
    } else {
      const w = simulateAIvAIKnockoutTie(hi, lo, rng, false);
      r32Winners.push(w === hi.name ? hi : lo);
    }
  }

  const r16Pairs: [UELBracketTeam, UELBracketTeam][] = [];
  for (let i = 0; i < 8; i++) {
    const autoQ: UELBracketTeam = { name: leagueTable[7 - i].name, strength: strengthMap.get(leagueTable[7 - i].name) || 70 };
    if (leagueTable[7 - i].isPlayer) {
      r16Pairs.push([{ name: playerTeamName, strength: ratings.teamStrength }, r32Winners[i]]);
    } else if (r32Winners[i].name === playerTeamName) {
      r16Pairs.push([r32Winners[i], autoQ]);
    } else {
      r16Pairs.push([autoQ, r32Winners[i]]);
    }
  }

  const r16Winners: UELBracketTeam[] = [];
  for (const [a, b] of r16Pairs) {
    const playerInvolved = (a.name === playerTeamName || b.name === playerTeamName) && !playerEliminated;
    if (playerInvolved) {
      const oppName = a.name === playerTeamName ? b.name : a.name;
      const oppStr = a.name === playerTeamName ? b.strength : a.strength;
      const tie = simulateUCLKnockoutTie('Round of 16', oppName, oppStr, players, ratings, rng, false);
      knockoutTies.push(tie);
      if (tie.result === 'L') {
        playerEliminated = true;
        playerExitStage = 'Round of 16';
        r16Winners.push({ name: oppName, strength: oppStr });
      } else {
        r16Winners.push({ name: playerTeamName, strength: ratings.teamStrength });
      }
    } else {
      const w = simulateAIvAIKnockoutTie(a, b, rng, false);
      r16Winners.push(w === a.name ? a : b);
    }
  }

  const roundNames = ['Quarter-Final', 'Semi-Final', 'Final'];
  let currentRound = r16Winners;
  for (let ri = 0; ri < roundNames.length; ri++) {
    const roundName = roundNames[ri];
    const isFinal = ri === 2;
    const nextRound: UELBracketTeam[] = [];
    for (let i = 0; i < currentRound.length; i += 2) {
      const a = currentRound[i];
      const b = currentRound[i + 1];
      const playerInvolved = (a.name === playerTeamName || b.name === playerTeamName) && !playerEliminated;
      if (playerInvolved) {
        const oppName = a.name === playerTeamName ? b.name : a.name;
        const oppStr = a.name === playerTeamName ? b.strength : a.strength;
        const tie = simulateUCLKnockoutTie(roundName, oppName, oppStr, players, ratings, rng, isFinal);
        knockoutTies.push(tie);
        if (tie.result === 'L') {
          playerEliminated = true;
          playerExitStage = roundName;
          nextRound.push({ name: oppName, strength: oppStr });
        } else {
          nextRound.push({ name: playerTeamName, strength: ratings.teamStrength });
        }
      } else {
        const w = simulateAIvAIKnockoutTie(a, b, rng, isFinal);
        nextRound.push(w === a.name ? a : b);
      }
    }
    currentRound = nextRound;
  }

  const tournamentWinner = currentRound[0].name;
  const playerWon = tournamentWinner === playerTeamName;

  return {
    qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies,
    winner: playerWon,
    exitStage: playerWon ? null : playerExitStage,
    tournamentWinner,
  };
}

// --- Super Cup simulation ---

function determinePreviousWinners(
  prevResult: SeasonResult | undefined,
  opponents: { name: string; strength: number }[],
  rng: () => number,
): { uclWinner: string | null; uelWinner: string | null; uclWinnerStrength: number; uelWinnerStrength: number } {
  if (!prevResult) return { uclWinner: null, uelWinner: null, uclWinnerStrength: 0, uelWinnerStrength: 0 };

  let uclWinner: string | null = null;
  let uclWinnerStrength = 80;
  if (prevResult.ucl?.winner) {
    uclWinner = 'KNOWITBALL FC';
    uclWinnerStrength = prevResult.phaseRatings.teamStrength;
  } else if (prevResult.ucl?.tournamentWinner) {
    uclWinner = prevResult.ucl.tournamentWinner;
    const oppStrength = opponents.find(o => o.name === uclWinner)?.strength;
    uclWinnerStrength = oppStrength ?? UCL_TEAMS.find(t => t.name === uclWinner)?.strength ?? 82;
  }
  if (!uclWinner) {
    const topUcl = [...UCL_TEAMS].sort((a, b) => b.strength - a.strength);
    uclWinner = topUcl[Math.floor(rng() * Math.min(3, topUcl.length))].name;
    uclWinnerStrength = topUcl.find(t => t.name === uclWinner)?.strength ?? 85;
  }

  let uelWinner: string | null = null;
  let uelWinnerStrength = 74;
  if (prevResult.uel?.winner) {
    uelWinner = 'KNOWITBALL FC';
    uelWinnerStrength = prevResult.phaseRatings.teamStrength;
  } else if (prevResult.uel?.tournamentWinner) {
    uelWinner = prevResult.uel.tournamentWinner;
    const oppStrength = opponents.find(o => o.name === uelWinner)?.strength;
    uelWinnerStrength = oppStrength ?? UEL_TEAMS.find(t => t.name === uelWinner)?.strength ?? 74;
  }
  if (!uelWinner) {
    const topUel = [...UEL_TEAMS].sort((a, b) => b.strength - a.strength);
    uelWinner = topUel[Math.floor(rng() * Math.min(3, topUel.length))].name;
    uelWinnerStrength = topUel.find(t => t.name === uelWinner)?.strength ?? 76;
  }

  return { uclWinner, uelWinner, uclWinnerStrength, uelWinnerStrength };
}

function simulateSuperCup(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  prevResult: SeasonResult,
  opponents: { name: string; strength: number }[],
  rng: () => number,
  playerTeamOverride?: string,
): SuperCupResult | undefined {
  const { uclWinner, uelWinner, uclWinnerStrength, uelWinnerStrength } = determinePreviousWinners(prevResult, opponents, rng);
  if (!uclWinner || !uelWinner) return undefined;

  const playerWonUCL = prevResult.ucl?.winner === true;
  const playerWonUEL = prevResult.uel?.winner === true;
  if (!playerWonUCL && !playerWonUEL) return undefined;

  const playerRole: 'UCL Winner' | 'UEL Winner' = playerWonUCL ? 'UCL Winner' : 'UEL Winner';
  const opponentName = playerWonUCL ? uelWinner : uclWinner;
  const opponentStrength = playerWonUCL ? uelWinnerStrength : uclWinnerStrength;
  const opponentRole: 'UCL Winner' | 'UEL Winner' = playerWonUCL ? 'UEL Winner' : 'UCL Winner';

  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);
  const activeSubs = subs.filter(() => rng() < 0.5);
  const matchPlayers = [...starters, ...activeSubs];

  const m = simulateMatch(matchPlayers, ratings, { name: opponentName, strength: opponentStrength }, true, rng);

  const result: SuperCupResult = {
    played: true,
    opponent: opponentName,
    opponentRole,
    playerRole,
    goalsFor: m.goalsFor,
    goalsAgainst: m.goalsAgainst,
    result: m.result === 'D' ? 'W' : m.result,
    goalScorers: m.goalScorers,
    assistProviders: m.assistProviders,
  };

  if (m.result === 'D') {
    // Penalties for a draw — a fair shootout (the old formula could never let
    // the opponent outscore the player, and a tie was coin-flipped while
    // displaying the still-tied score next to a decided result).
    const playerPens = 3 + Math.floor(rng() * 3);
    const oppPens = 3 + Math.floor(rng() * 3);
    if (playerPens === oppPens) {
      // Sudden death: winner takes one extra so the score matches the outcome
      if (rng() > 0.5) result.result = 'W';
      else result.result = 'L';
      result.penaltyScore = result.result === 'W'
        ? { player: playerPens + 1, opponent: oppPens }
        : { player: playerPens, opponent: oppPens + 1 };
    } else {
      result.result = playerPens > oppPens ? 'W' : 'L';
      result.penaltyScore = { player: playerPens, opponent: oppPens };
    }
    result.penalties = true;
  }

  return result;
}

// --- Charity Shield simulation ---

function simulateCharityShield(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  previousLeagueTable: LeagueTeam[] | undefined,
  previousFaCupWinner: string | undefined,
  opponents: { name: string; strength: number }[],
  rng: () => number,
  playerTeamOverride?: string,
): CharityShieldResult | undefined {
  if (!previousLeagueTable || !previousFaCupWinner) return undefined;

  const playerTeamName = playerTeamOverride ?? 'KNOWITBALL FC';
  const plWinner = previousLeagueTable[0]?.name;
  const plRunnerUp = previousLeagueTable[1]?.name;
  if (!plWinner) return undefined;

  const playerWonPL = previousLeagueTable[0]?.isPlayer === true;
  const playerWonFACup = previousFaCupWinner === playerTeamName;

  if (!playerWonPL && !playerWonFACup) return undefined;

  let opponent: string;
  let opponentRole: 'PL Winner' | 'FA Cup Winner' | 'PL Runner-Up';
  let playerRole: 'PL Winner' | 'FA Cup Winner';

  if (playerWonPL && playerWonFACup) {
    // Player won both: play vs PL runner-up
    opponent = plRunnerUp ?? 'Arsenal';
    opponentRole = 'PL Runner-Up';
    playerRole = 'PL Winner';
  } else if (playerWonPL) {
    opponent = previousFaCupWinner;
    opponentRole = 'FA Cup Winner';
    playerRole = 'PL Winner';
  } else {
    opponent = plWinner;
    opponentRole = 'PL Winner';
    playerRole = 'FA Cup Winner';
  }

  const oppStrength = opponents.find(o => o.name === opponent)?.strength ?? 80;
  const isHome = rng() > 0.5;
  const homeBonus = isHome ? HOME_ADVANTAGE : 0;

  const myAttack = ratings.attack + homeBonus * 0.6;
  const myMidfield = ratings.midfield + homeBonus * 0.4;
  const myDefense = ratings.defense + homeBonus * 0.3;
  const myGk = ratings.gk;
  const oppStr = oppStrength + (isHome ? 0 : HOME_ADVANTAGE);

  const myXg = computeExpectedGoals(myAttack, myMidfield, oppStr);
  const ourDefPower = myDefense * 0.55 + myGk * 0.30 + myMidfield * 0.15;
  const oppXg = computeExpectedGoals(oppStr, oppStr * 0.95, ourDefPower);

  let goalsFor = poisson(myXg, rng);
  let goalsAgainst = poisson(oppXg, rng);
  let extraTime = false;
  let penalties = false;
  let penaltyScore: { player: number; opponent: number } | undefined;

  const goalScorers: { player: string; minute: number }[] = [];
  const assistProviders: { player: string; minute: number }[] = [];
  const starters = players.filter(p => !p.isSub);

  for (let i = 0; i < goalsFor; i++) {
    const minute = Math.floor(rng() * 90) + 1;
    goalScorers.push({ player: weightedPick(starters, goalScoringWeight, rng).name, minute });
    if (rng() < 0.75) {
      const scorer = goalScorers[goalScorers.length - 1].player;
      const eligible = starters.filter(p => p.name !== scorer);
      if (eligible.length > 0) {
        assistProviders.push({ player: weightedPick(eligible, assistWeight, rng).name, minute });
      }
    }
  }

  if (goalsFor === goalsAgainst) {
    extraTime = true;
    const etFor = poisson(myXg * 0.33, rng);
    const etAgainst = poisson(oppXg * 0.33, rng);
    goalsFor += etFor;
    goalsAgainst += etAgainst;
    for (let i = 0; i < etFor; i++) {
      const minute = 90 + Math.floor(rng() * 30) + 1;
      goalScorers.push({ player: weightedPick(starters, goalScoringWeight, rng).name, minute });
      if (rng() < 0.75) {
        const scorer = goalScorers[goalScorers.length - 1].player;
        const eligible = starters.filter(p => p.name !== scorer);
        if (eligible.length > 0) {
          assistProviders.push({ player: weightedPick(eligible, assistWeight, rng).name, minute });
        }
      }
    }
    if (goalsFor === goalsAgainst) {
      penalties = true;
      const myPens = Math.floor(rng() * 3) + 3;
      const oppPens = Math.floor(rng() * 3) + 3;
      if (myPens === oppPens) {
        penaltyScore = rng() > 0.5 ? { player: myPens + 1, opponent: oppPens } : { player: myPens, opponent: oppPens + 1 };
      } else {
        penaltyScore = { player: myPens, opponent: oppPens };
      }
    }
  }

  goalScorers.sort((a, b) => a.minute - b.minute);
  assistProviders.sort((a, b) => a.minute - b.minute);

  let result: 'W' | 'L';
  if (penalties && penaltyScore) {
    result = penaltyScore.player > penaltyScore.opponent ? 'W' : 'L';
  } else {
    result = goalsFor > goalsAgainst ? 'W' : 'L';
  }

  return {
    played: true,
    opponent,
    opponentRole,
    playerRole,
    goalsFor,
    goalsAgainst,
    result,
    goalScorers,
    assistProviders,
    extraTime,
    penalties,
    penaltyScore,
  };
}

// --- Main export ---

function rollInjuryLength(rng: () => number): number {
  const r = rng();
  if (r < 0.45) return 1;
  if (r < 0.65) return 2;
  if (r < 0.78) return 3;
  if (r < 0.86) return 4;
  if (r < 0.92) return 5;
  if (r < 0.95) return 7;
  if (r < 0.98) return 9;
  return 12;
}

export function simulateSeason(
  players: DraftPlayer[],
  otherTeams?: { name: string; strength: number }[],
  seasonNumber?: number,
  previousLeagueTable?: LeagueTeam[],
  previousSeasonResult?: SeasonResult,
  teamNameOverride?: string,
): SeasonResult {
  const seasonSeed = (seasonNumber ?? 1) * 100;
  const seed = players.reduce((acc, p) => acc + p.overall * 7 + p.name.length * 13, 42 + seasonSeed);
  const rng = createRng(seed);

  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);
  // Bench GK handled separately: excluded from random sub pool,
  // starts all FA Cup games, covers PL games if starter GK is injured.
  const benchGk = subs.find(p => classifyPosition(p.assignedPosition) === 'GK');

  const opponents = otherTeams && otherTeams.length === 19
    ? otherTeams
    : getSeasonTeams(previousLeagueTable);

  const ratings = computePhaseRatings(starters);

  const playerTeamName = teamNameOverride ?? 'KNOWITBALL FC';

  // Season-wide form modifiers: each team (including player) gets a random
  // modifier that persists all season, simulating good/bad campaigns.
  // Gaussian-ish via sum of two uniforms, range roughly -6 to +6, centered at 0.
  const genSeasonMod = () => (rng() - 0.5) * 8 + (rng() - 0.5) * 4;
  const playerSeasonMod = genSeasonMod();
  const oppSeasonMods: Record<string, number> = {};
  for (const opp of opponents) oppSeasonMods[opp.name] = genSeasonMod();

  // Simulate 38 matches (home and away vs each opponent)
  // Structured as two halves: MW 1-19 and MW 20-38
  const subAppearances: Record<string, number> = {};
  for (const sub of subs) subAppearances[sub.name] = 0;

  // First half: one match per opponent, randomly home or away
  const firstHalf: MatchResult[] = [];
  const firstHalfSubs: Set<string>[] = [];
  for (const opp of opponents) {
    const isHome = rng() > 0.5;
    // Call rng() for every sub (including bench GK) to keep RNG stream stable,
    // but exclude bench GK from active subs — they have a dedicated role.
    const activeSubs = subs.filter(sub => rng() < 0.6 && sub !== benchGk);
    const matchPlayers = [...starters, ...activeSubs];
    firstHalf.push(simulateMatch(matchPlayers, ratings, opp, isHome, rng, playerSeasonMod, oppSeasonMods[opp.name] ?? 0));
    firstHalfSubs.push(new Set(activeSubs.map(s => s.name)));
    for (const sub of activeSubs) subAppearances[sub.name]++;
  }
  // Shuffle first half
  for (let i = firstHalf.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [firstHalf[i], firstHalf[j]] = [firstHalf[j], firstHalf[i]];
    [firstHalfSubs[i], firstHalfSubs[j]] = [firstHalfSubs[j], firstHalfSubs[i]];
  }

  // Second half: opposite home/away from first half
  const secondHalf: MatchResult[] = [];
  const secondHalfSubs: Set<string>[] = [];
  for (let i = 0; i < firstHalf.length; i++) {
    const oppName = firstHalf[i].opponent;
    const opp = opponents.find(o => o.name === oppName)!;
    const isHome = !firstHalf[i].isHome;
    const activeSubs = subs.filter(sub => rng() < 0.6 && sub !== benchGk);
    const matchPlayers = [...starters, ...activeSubs];
    secondHalf.push(simulateMatch(matchPlayers, ratings, opp, isHome, rng, playerSeasonMod, oppSeasonMods[opp.name] ?? 0));
    secondHalfSubs.push(new Set(activeSubs.map(s => s.name)));
    for (const sub of activeSubs) subAppearances[sub.name]++;
  }
  // Shuffle second half
  for (let i = secondHalf.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [secondHalf[i], secondHalf[j]] = [secondHalf[j], secondHalf[i]];
    [secondHalfSubs[i], secondHalfSubs[j]] = [secondHalfSubs[j], secondHalfSubs[i]];
  }

  const matches = [...firstHalf, ...secondHalf];
  const matchSubSets = [...firstHalfSubs, ...secondHalfSubs];

  // Determine starter GK injury (only if a bench GK exists)
  // Affects stat tracking only — team performance is unchanged.
  let gkInjuryStart = -1;
  let gkInjuryLen = 0;
  if (benchGk && rng() < 0.25) {
    gkInjuryLen = rollInjuryLength(rng);
    gkInjuryStart = Math.floor(rng() * Math.max(1, 39 - gkInjuryLen));
  }
  const gkInjuredMatchIndices = new Set<number>();
  for (let i = gkInjuryStart; i < gkInjuryStart + gkInjuryLen && i < 38; i++) {
    if (i >= 0) gkInjuredMatchIndices.add(i);
  }

  // FA Cup: all 32 teams (20 PL + championship) compete
  const allFaCupTeams: { name: string; strength: number }[] = [
    { name: playerTeamName, strength: ratings.teamStrength },
    ...opponents,
    ...RESERVE_TEAMS.filter(t => !opponents.some(o => o.name === t.name) && t.name !== playerTeamName),
  ];
  { const usedNames = new Set(allFaCupTeams.map(t => t.name));
  let padIdx = 0;
  while (allFaCupTeams.length < 32) {
    const club = LOWER_LEAGUE_CLUBS[padIdx % LOWER_LEAGUE_CLUBS.length];
    padIdx++;
    if (usedNames.has(club.name)) continue;
    usedNames.add(club.name);
    allFaCupTeams.push({ name: club.name, strength: club.strength });
  } }
  const faCup = simulateFaCup(starters, ratings, allFaCupTeams.slice(0, 32), rng, playerTeamName);

  // League Cup: same 32 teams, separate draw via rng; semi-final is 2-legged
  const leagueCup = simulateLeagueCup(starters, ratings, allFaCupTeams.slice(0, 32), rng, playerTeamName);

  // Super Cup (if won UCL or UEL last season)
  let superCup: SuperCupResult | undefined;
  if (previousSeasonResult) {
    superCup = simulateSuperCup(players, ratings, previousSeasonResult, opponents, rng, playerTeamName);
  }

  // Charity Shield (PL Winner vs FA Cup Winner from previous season)
  let charityShield: CharityShieldResult | undefined;
  if (previousLeagueTable && previousSeasonResult) {
    charityShield = simulateCharityShield(
      players, ratings, previousLeagueTable,
      previousSeasonResult.faCup.faCupWinner,
      opponents, rng, playerTeamName,
    );
  }

  // Champions League / Europa League (if qualified from previous season)
  let ucl: UCLResult | undefined;
  let uel: UCLResult | undefined;
  let uclTournamentWinner: string | undefined;
  let uelTournamentWinner: string | undefined;
  if (previousLeagueTable) {
    const playerFinish = previousLeagueTable.findIndex(t => t.isPlayer) + 1;
    const wonUELLastSeason = previousSeasonResult?.uel?.winner === true;
    const wonUCLLastSeason = previousSeasonResult?.ucl?.winner === true;
    const wonFACupLastSeason = previousSeasonResult?.faCup?.winner === true;
    const wonLeagueCupLastSeason = previousSeasonResult?.leagueCup?.winner === true;
    const qualifiesThroughLeague = playerFinish >= 1 && playerFinish <= 5;
    const uelWinnerQualifies = wonUELLastSeason && !qualifiesThroughLeague;
    const uclWinnerQualifies = wonUCLLastSeason && !qualifiesThroughLeague;
    const faCupWinnerQualifiesForEL = wonFACupLastSeason && playerFinish > 7;
    const leagueCupWinnerQualifiesForEL = wonLeagueCupLastSeason && playerFinish > 7;

    ucl = simulateChampionsLeague(players, ratings, previousLeagueTable, opponents, rng, uelWinnerQualifies || uclWinnerQualifies, playerTeamName);
    if (!ucl.qualified) {
      if (playerFinish >= 6 && playerFinish <= 7) {
        uel = simulateEuropaLeague(players, ratings, previousLeagueTable, opponents, rng, false, playerTeamName);
      } else if (faCupWinnerQualifiesForEL || leagueCupWinnerQualifiesForEL) {
        uel = simulateEuropaLeague(players, ratings, previousLeagueTable, opponents, rng, true, playerTeamName);
      }
    }

    // Always determine tournament winners so the results screen can always show them.
    // When the player participated, use the actual result; otherwise run a background bracket.
    uclTournamentWinner = ucl.tournamentWinner || (() => {
      const plQualifiers = opponents.filter(o => {
        const pos = previousLeagueTable!.findIndex(t => t.name === o.name) + 1;
        return pos >= 1 && pos <= 5;
      });
      return pickBackgroundKnockoutWinner(
        [...UCL_TEAMS.map(t => ({ name: t.name, strength: t.strength })), ...plQualifiers],
        rng
      );
    })() || undefined;

    uelTournamentWinner = uel?.tournamentWinner || (() => {
      const plQualifiers = opponents.filter(o => {
        const pos = previousLeagueTable!.findIndex(t => t.name === o.name) + 1;
        return pos === 6 || pos === 7;
      });
      return pickBackgroundKnockoutWinner(
        [...UEL_TEAMS.map(t => ({ name: t.name, strength: t.strength })), ...plQualifiers],
        rng
      );
    })() || undefined;
  } else {
    // Season 1: no previous table — run background European brackets with predetermined English teams
    uclTournamentWinner = pickBackgroundKnockoutWinner(
      [...UCL_TEAMS.map(t => ({ name: t.name, strength: t.strength })), ...SEASON1_UCL_PL_TEAMS],
      rng
    ) || undefined;
    uelTournamentWinner = pickBackgroundKnockoutWinner(
      [...UEL_TEAMS.map(t => ({ name: t.name, strength: t.strength })), ...SEASON1_UEL_PL_TEAMS],
      rng
    ) || undefined;
  }

  // Player stats
  const statsMap: Record<string, PlayerStats> = {};
  for (const p of starters) {
    statsMap[p.name] = {
      name: p.name,
      assignedPosition: p.assignedPosition,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      appearances: 38,
      avgRating: 0,
      image_url: p.image_url ?? null,
    };
  }
  for (const p of subs) {
    statsMap[p.name] = {
      name: p.name,
      assignedPosition: p.assignedPosition,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      appearances: subAppearances[p.name] || 0,
      avgRating: 0,
      image_url: p.image_url ?? null,
    };
  }

  const allPlayers = [...starters, ...subs];
  const gk = starters.find(p => classifyPosition(p.assignedPosition) === 'GK');
  const defenders = starters.filter(p => classifyPosition(p.assignedPosition) === 'DEF');
  const defSubs = subs.filter(p => classifyPosition(p.assignedPosition) === 'DEF' || classifyPosition(p.assignedPosition) === 'GK');

  // Adjust starter GK appearances down and bench GK up for injury period
  if (gk && benchGk && gkInjuredMatchIndices.size > 0) {
    statsMap[gk.name].appearances = Math.max(0, 38 - gkInjuredMatchIndices.size);
    statsMap[benchGk.name].appearances = gkInjuredMatchIndices.size;
  }

  // Season form: each player gets a persistent bonus/penalty for the entire season.
  // Most players get a small form shift, but occasionally someone has a breakout
  // or poor season. Lower-rated players have a wider range to allow surprise seasons.
  const seasonForm: Record<string, number> = {};
  for (const p of allPlayers) {
    const r = rng();
    const ovrFactor = Math.max(0.5, (90 - p.overall) / 25);
    if (r < 0.08) seasonForm[p.name] = 0.4 * ovrFactor;
    else if (r < 0.20) seasonForm[p.name] = 0.2 * ovrFactor;
    else if (r < 0.80) seasonForm[p.name] = (rng() * 0.2 - 0.1) * ovrFactor;
    else if (r < 0.92) seasonForm[p.name] = -0.15 * ovrFactor;
    else seasonForm[p.name] = -0.3 * ovrFactor;
  }

  const playerRatings: Record<string, number[]> = {};
  for (const p of allPlayers) playerRatings[p.name] = [];

  for (let mi = 0; mi < matches.length; mi++) {
    const m = matches[mi];
    const subsInMatch = matchSubSets[mi];
    const benchGkPlayingThisMatch = benchGk !== undefined && gkInjuredMatchIndices.has(mi);

    for (const gs of m.goalScorers) {
      if (statsMap[gs.player]) statsMap[gs.player].goals++;
    }
    for (const ap of m.assistProviders) {
      if (statsMap[ap.player]) statsMap[ap.player].assists++;
    }
    if (m.goalsAgainst === 0) {
      // Clean sheet goes to bench GK if they're covering an injury game
      if (benchGkPlayingThisMatch && benchGk && statsMap[benchGk.name]) {
        statsMap[benchGk.name].cleanSheets++;
      } else if (gk) {
        statsMap[gk.name].cleanSheets++;
      }
      for (const def of defenders) {
        statsMap[def.name].cleanSheets++;
      }
      for (const sub of defSubs) {
        if (subsInMatch.has(sub.name)) statsMap[sub.name].cleanSheets++;
      }
    }

    for (const p of starters) {
      if (p === gk && benchGkPlayingThisMatch) continue; // starter GK is injured/out
      playerRatings[p.name].push(matchRating(p, m, seasonForm[p.name] || 0, rng));
    }
    if (benchGkPlayingThisMatch && benchGk) {
      playerRatings[benchGk.name].push(matchRating(benchGk, m, seasonForm[benchGk.name] || 0, rng));
    }
    for (const p of subs) {
      if (subsInMatch.has(p.name)) {
        playerRatings[p.name].push(matchRating(p, m, seasonForm[p.name] || 0, rng));
      }
    }
  }

  // Compute PL-only avg rating
  for (const p of allPlayers) {
    const ratings = playerRatings[p.name];
    statsMap[p.name].avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 6.0;
  }

  // Snapshot PL-only stats before adding cup competitions
  const plPlayerStats = Object.values(statsMap).map(s => ({ ...s })).sort(
    (a, b) => (b.goals + b.assists) - (a.goals + a.assists),
  );

  // All-comps ratings — start from PL ratings, append cup match ratings.
  // Use a separate seeded rng so cup ratings don't shift the main rng stream.
  const allCompsRatings: Record<string, number[]> = {};
  for (const p of allPlayers) allCompsRatings[p.name] = [...playerRatings[p.name]];
  const cupRng = createRng(seed + 77777);

  const rateMatchForPlayer = (p: DraftPlayer, m: { goalScorers: { player: string; minute: number }[]; assistProviders: { player: string; minute: number }[]; goalsAgainst: number; result: 'W' | 'D' | 'L'; goalsFor: number; opponent: string; isHome: boolean }) => {
    allCompsRatings[p.name].push(matchRating(p, m as MatchResult, seasonForm[p.name] || 0, cupRng));
  };

  // Bench GK plays FA Cup only if team won a trophy last season (cup rotation).
  // Otherwise the starting GK plays all rounds (bench GK still covers if starter is injured).
  const wonTrophyLastSeason = previousSeasonResult && (
    previousSeasonResult.actualFinish === 1 ||
    previousSeasonResult.faCup.winner ||
    previousSeasonResult.ucl?.winner ||
    previousSeasonResult.uel?.winner
  );
  const benchGkPlaysFaCup = !!benchGk && !!wonTrophyLastSeason;

  // Count FA Cup stats (added to all-comps totals)
  for (const cm of faCup.matches) {
    const matchForRating = { goalScorers: cm.goalScorers, assistProviders: cm.assistProviders, goalsAgainst: cm.goalsAgainst, result: cm.result as 'W' | 'D' | 'L', goalsFor: cm.goalsFor, opponent: cm.opponent, isHome: false };
    for (const p of starters) {
      if (p === gk && benchGkPlaysFaCup) continue; // bench GK rotated in when team won trophy
      statsMap[p.name].appearances++;
      rateMatchForPlayer(p, matchForRating);
    }
    if (benchGkPlaysFaCup && benchGk && statsMap[benchGk.name]) {
      statsMap[benchGk.name].appearances++;
      rateMatchForPlayer(benchGk, matchForRating);
    }
    for (const gs of cm.goalScorers) {
      if (statsMap[gs.player]) statsMap[gs.player].goals++;
    }
    for (const ap of cm.assistProviders) {
      if (statsMap[ap.player]) statsMap[ap.player].assists++;
    }
    if (cm.goalsAgainst === 0) {
      if (benchGkPlaysFaCup && benchGk && statsMap[benchGk.name]) {
        statsMap[benchGk.name].cleanSheets++;
      } else if (gk) {
        statsMap[gk.name].cleanSheets++;
      }
      for (const def of defenders) {
        statsMap[def.name].cleanSheets++;
      }
    }
  }

  // Count League Cup stats (added to all-comps totals)
  for (const cm of leagueCup.matches) {
    const matchForRating = { goalScorers: cm.goalScorers, assistProviders: cm.assistProviders, goalsAgainst: cm.goalsAgainst, result: cm.result as 'W' | 'D' | 'L', goalsFor: cm.goalsFor, opponent: cm.opponent, isHome: false };
    for (const p of starters) {
      if (p === gk && benchGkPlaysFaCup) continue;
      statsMap[p.name].appearances++;
      rateMatchForPlayer(p, matchForRating);
    }
    if (benchGkPlaysFaCup && benchGk && statsMap[benchGk.name]) {
      statsMap[benchGk.name].appearances++;
      rateMatchForPlayer(benchGk, matchForRating);
    }
    for (const gs of cm.goalScorers) {
      if (statsMap[gs.player]) statsMap[gs.player].goals++;
    }
    for (const ap of cm.assistProviders) {
      if (statsMap[ap.player]) statsMap[ap.player].assists++;
    }
    if (cm.goalsAgainst === 0) {
      if (benchGkPlaysFaCup && benchGk && statsMap[benchGk.name]) {
        statsMap[benchGk.name].cleanSheets++;
      } else if (gk) {
        statsMap[gk.name].cleanSheets++;
      }
      for (const def of defenders) {
        statsMap[def.name].cleanSheets++;
      }
    }
    if (cm.leg2) {
      const mr2 = { goalScorers: cm.leg2.goalScorers, assistProviders: [] as { player: string; minute: number }[], goalsAgainst: cm.leg2.goalsAgainst, result: cm.result as 'W' | 'D' | 'L', goalsFor: cm.leg2.goalsFor, opponent: cm.opponent, isHome: cm.leg2.isHome };
      for (const p of starters) {
        if (p === gk && benchGkPlaysFaCup) continue;
        statsMap[p.name].appearances++;
        rateMatchForPlayer(p, mr2);
      }
      if (benchGkPlaysFaCup && benchGk && statsMap[benchGk.name]) {
        statsMap[benchGk.name].appearances++;
        rateMatchForPlayer(benchGk, mr2);
      }
      for (const gs of cm.leg2.goalScorers) {
        if (statsMap[gs.player]) statsMap[gs.player].goals++;
      }
      if (cm.leg2.goalsAgainst === 0) {
        if (benchGkPlaysFaCup && benchGk && statsMap[benchGk.name]) {
          statsMap[benchGk.name].cleanSheets++;
        } else if (gk) {
          statsMap[gk.name].cleanSheets++;
        }
        for (const def of defenders) {
          statsMap[def.name].cleanSheets++;
        }
      }
    }
  }

  // Count UCL stats (added to all-comps totals)
  if (ucl?.qualified) {
    const countUCLMatch = (m: UCLMatch) => {
      const mr = { goalScorers: m.goalScorers, assistProviders: m.assistProviders, goalsAgainst: m.goalsAgainst, result: m.result, goalsFor: m.goalsFor, opponent: m.opponent, isHome: m.isHome };
      for (const p of starters) {
        statsMap[p.name].appearances++;
        rateMatchForPlayer(p, mr);
      }
      // Subs can feature in these matches (the sim fields random active
      // subs) — credit involved subs with an appearance/rating so a scorer
      // can't end the season with goals but 0 apps.
      const involved = new Set([...m.goalScorers.map(g => g.player), ...m.assistProviders.map(a => a.player)]);
      for (const p of subs) {
        if (involved.has(p.name) && statsMap[p.name]) {
          statsMap[p.name].appearances++;
          rateMatchForPlayer(p, mr);
        }
      }
      for (const gs of m.goalScorers) {
        if (statsMap[gs.player]) statsMap[gs.player].goals++;
      }
      for (const ap of m.assistProviders) {
        if (statsMap[ap.player]) statsMap[ap.player].assists++;
      }
      if (m.goalsAgainst === 0) {
        if (gk) statsMap[gk.name].cleanSheets++;
        for (const def of defenders) statsMap[def.name].cleanSheets++;
      }
    };
    for (const m of ucl.leagueMatches) countUCLMatch(m);
    for (const tie of ucl.knockoutTies) {
      countUCLMatch(tie.leg1);
      if (tie.leg2) countUCLMatch(tie.leg2);
    }
  }

  // Count UEL stats (added to all-comps totals)
  if (uel?.qualified) {
    const countUELMatch = (m: UCLMatch) => {
      const mr = { goalScorers: m.goalScorers, assistProviders: m.assistProviders, goalsAgainst: m.goalsAgainst, result: m.result, goalsFor: m.goalsFor, opponent: m.opponent, isHome: m.isHome };
      for (const p of starters) {
        statsMap[p.name].appearances++;
        rateMatchForPlayer(p, mr);
      }
      // Subs can feature in these matches (the sim fields random active
      // subs) — credit involved subs with an appearance/rating so a scorer
      // can't end the season with goals but 0 apps.
      const involved = new Set([...m.goalScorers.map(g => g.player), ...m.assistProviders.map(a => a.player)]);
      for (const p of subs) {
        if (involved.has(p.name) && statsMap[p.name]) {
          statsMap[p.name].appearances++;
          rateMatchForPlayer(p, mr);
        }
      }
      for (const gs of m.goalScorers) {
        if (statsMap[gs.player]) statsMap[gs.player].goals++;
      }
      for (const ap of m.assistProviders) {
        if (statsMap[ap.player]) statsMap[ap.player].assists++;
      }
      if (m.goalsAgainst === 0) {
        if (gk) statsMap[gk.name].cleanSheets++;
        for (const def of defenders) statsMap[def.name].cleanSheets++;
      }
    };
    for (const m of uel.leagueMatches) countUELMatch(m);
    for (const tie of uel.knockoutTies) {
      countUELMatch(tie.leg1);
      if (tie.leg2) countUELMatch(tie.leg2);
    }
  }

  // Count Super Cup stats (added to all-comps totals)
  if (superCup?.played) {
    const scMatch = {
      goalScorers: superCup.goalScorers, assistProviders: superCup.assistProviders,
      goalsAgainst: superCup.goalsAgainst, result: superCup.result as 'W' | 'D' | 'L',
      goalsFor: superCup.goalsFor, opponent: superCup.opponent, isHome: true,
    };
    for (const p of starters) {
      statsMap[p.name].appearances++;
      rateMatchForPlayer(p, scMatch);
    }
    {
      const involved = new Set([...superCup.goalScorers.map(g => g.player), ...superCup.assistProviders.map(a => a.player)]);
      for (const p of subs) {
        if (involved.has(p.name) && statsMap[p.name]) {
          statsMap[p.name].appearances++;
          rateMatchForPlayer(p, scMatch);
        }
      }
    }
    for (const gs of superCup.goalScorers) {
      if (statsMap[gs.player]) statsMap[gs.player].goals++;
    }
    for (const ap of superCup.assistProviders) {
      if (statsMap[ap.player]) statsMap[ap.player].assists++;
    }
    if (superCup.goalsAgainst === 0) {
      if (gk) statsMap[gk.name].cleanSheets++;
      for (const def of defenders) statsMap[def.name].cleanSheets++;
    }
  }

  // Count Charity Shield stats (added to all-comps totals) — previously this
  // match's goals/assists/appearances never reached statsMap, so records and
  // golden-boot totals disagreed with the displayed scorers.
  if (charityShield?.played) {
    const csMatch = {
      goalScorers: charityShield.goalScorers, assistProviders: charityShield.assistProviders,
      goalsAgainst: charityShield.goalsAgainst, result: charityShield.result as 'W' | 'D' | 'L',
      goalsFor: charityShield.goalsFor, opponent: charityShield.opponent, isHome: true,
    };
    for (const p of starters) {
      statsMap[p.name].appearances++;
      rateMatchForPlayer(p, csMatch);
    }
    {
      const involved = new Set([...charityShield.goalScorers.map(g => g.player), ...charityShield.assistProviders.map(a => a.player)]);
      for (const p of subs) {
        if (involved.has(p.name) && statsMap[p.name]) {
          statsMap[p.name].appearances++;
          rateMatchForPlayer(p, csMatch);
        }
      }
    }
    for (const gs of charityShield.goalScorers) {
      if (statsMap[gs.player]) statsMap[gs.player].goals++;
    }
    for (const ap of charityShield.assistProviders) {
      if (statsMap[ap.player]) statsMap[ap.player].assists++;
    }
    if (charityShield.goalsAgainst === 0) {
      if (gk) statsMap[gk.name].cleanSheets++;
      for (const def of defenders) statsMap[def.name].cleanSheets++;
    }
  }

  // Update statsMap with all-comps avg rating
  for (const p of allPlayers) {
    const r = allCompsRatings[p.name];
    statsMap[p.name].avgRating = r.length > 0
      ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10
      : 6.0;
  }

  const playerStats = Object.values(statsMap).sort(
    (a, b) => (b.goals + b.assists) - (a.goals + a.assists),
  );

  // Team record
  const wins = matches.filter(m => m.result === 'W').length;
  const draws = matches.filter(m => m.result === 'D').length;
  const losses = matches.filter(m => m.result === 'L').length;
  const goalsFor = matches.reduce((s, m) => s + m.goalsFor, 0);
  const goalsAgainst = matches.reduce((s, m) => s + m.goalsAgainst, 0);
  const points = wins * 3 + draws;

  const teamRecord = { wins, draws, losses, points, goalsFor, goalsAgainst };

  // League table
  const oppMatchScores = new Map<string, { homeGoals: number; awayGoals: number }>();
  const leagueTable = simulateLeague(
    playerTeamName,
    ratings.teamStrength,
    opponents,
    matches,
    rng,
    oppSeasonMods,
    oppMatchScores,
  );
  const allFixtures = buildAllFixtures(playerTeamName, matches, opponents, oppMatchScores, seed ^ 0x5C4ED01E);

  const actualFinish = leagueTable.findIndex(t => t.isPlayer) + 1;

  const allTeamsForProjection = [
    { name: playerTeamName, strength: ratings.teamStrength },
    ...opponents,
  ];
  const projectedFinish = calculateProjectedFinish(ratings.teamStrength, allTeamsForProjection);

  const diff = projectedFinish - actualFinish;
  let performance: 'OVERPERFORMED' | 'AS EXPECTED' | 'UNDERPERFORMED';
  if (diff >= 3) performance = 'OVERPERFORMED';
  else if (diff <= -3) performance = 'UNDERPERFORMED';
  else performance = 'AS EXPECTED';

  // Awards
  const topScorer = [...playerStats].sort((a, b) => b.goals - a.goals)[0];
  const topAssister = [...playerStats].sort((a, b) => b.assists - a.assists)[0];
  const topGk = gk ? statsMap[gk.name] : playerStats[0];
  const pots = [...playerStats].sort((a, b) => b.avgRating - a.avgRating)[0];

  const awards = {
    goldenBoot: { name: topScorer.name, goals: topScorer.goals },
    playmaker: { name: topAssister.name, assists: topAssister.assists },
    goldenGlove: { name: topGk.name, cleanSheets: topGk.cleanSheets },
    playerOfSeason: { name: pots.name, avgRating: pots.avgRating },
  };

  // Biggest win
  const winsOnly = matches.filter(m => m.result === 'W');
  let biggestWin = winsOnly.length > 0 ? winsOnly[0] : matches[0];
  let biggestWinGd = biggestWin.goalsFor - biggestWin.goalsAgainst;
  for (const m of winsOnly) {
    const gd = m.goalsFor - m.goalsAgainst;
    if (gd > biggestWinGd || (gd === biggestWinGd && m.goalsFor > biggestWin.goalsFor)) {
      biggestWin = m;
      biggestWinGd = gd;
    }
  }

  // Highest-scoring game
  let highestScoring = matches[0];
  let highestTotal = matches[0].goalsFor + matches[0].goalsAgainst;
  for (const m of matches) {
    const total = m.goalsFor + m.goalsAgainst;
    if (total > highestTotal) {
      highestScoring = m;
      highestTotal = total;
    }
  }

  // Worst defeat
  const lossesOnly = matches.filter(m => m.result === 'L');
  let worstDefeat = lossesOnly.length > 0 ? lossesOnly[0] : matches[0];
  let worstDefeatGd = worstDefeat.goalsAgainst - worstDefeat.goalsFor;
  for (const m of lossesOnly) {
    const gd = m.goalsAgainst - m.goalsFor;
    if (gd > worstDefeatGd || (gd === worstDefeatGd && m.goalsAgainst > worstDefeat.goalsAgainst)) {
      worstDefeat = m;
      worstDefeatGd = gd;
    }
  }

  // Longest win streak
  let longestWinStreak = 0;
  let currentStreak = 0;
  for (const m of matches) {
    if (m.result === 'W') {
      currentStreak++;
      longestWinStreak = Math.max(longestWinStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  // Longest unbeaten run
  let longestUnbeatenRun = 0;
  let unbeatenStreak = 0;
  for (const m of matches) {
    if (m.result !== 'L') {
      unbeatenStreak++;
      longestUnbeatenRun = Math.max(longestUnbeatenRun, unbeatenStreak);
    } else {
      unbeatenStreak = 0;
    }
  }

  // Trailing streaks (from end of season — for cross-season records)
  let trailingWinStreak = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i].result === 'W') trailingWinStreak++;
    else break;
  }
  let trailingUnbeatenRun = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i].result !== 'L') trailingUnbeatenRun++;
    else break;
  }

  // Leading streaks (from start of season)
  let leadingWinStreak = 0;
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].result === 'W') leadingWinStreak++;
    else break;
  }
  let leadingUnbeatenRun = 0;
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].result !== 'L') leadingUnbeatenRun++;
    else break;
  }

  const formatScore = (m: MatchResult) =>
    m.isHome
      ? `${m.goalsFor}-${m.goalsAgainst}`
      : `${m.goalsAgainst}-${m.goalsFor}`;

  return {
    matches,
    playerStats,
    plPlayerStats,
    leagueTable,
    teamRecord,
    awards,
    biggestWin: { opponent: biggestWin.opponent, score: formatScore(biggestWin) },
    worstDefeat: { opponent: worstDefeat.opponent, score: formatScore(worstDefeat) },
    highestScoring: { opponent: highestScoring.opponent, score: formatScore(highestScoring) },
    longestWinStreak,
    longestUnbeatenRun,
    trailingWinStreak,
    trailingUnbeatenRun,
    leadingWinStreak,
    leadingUnbeatenRun,
    projectedFinish,
    actualFinish,
    performance,
    phaseRatings: ratings,
    faCup,
    leagueCup,
    ucl,
    uel,
    superCup,
    charityShield,
    uclTournamentWinner,
    uelTournamentWinner,
    allFixtures,
  };
}

// --- Pre-season odds calculation (Monte Carlo) ---

export interface SeasonOdds {
  winLeague: number;
  top4: number;
  top7: number;
  relegation: number;
  avgPoints: number;
  avgFinish: number;
  perfectSeason: number;
  unbeaten: number;
  centurion: number;
  avgWins: number;
}

export function calculateSeasonOdds(
  players: DraftPlayer[],
  otherTeams?: { name: string; strength: number }[],
  seasonNumber?: number,
  simCount: number = 500,
): SeasonOdds {
  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);

  const opponents = otherTeams && otherTeams.length === 19
    ? otherTeams
    : DEFAULT_PL_TEAMS;

  const ratings = computePhaseRatings(starters);
  const playerTeamName = 'KNOWITBALL FC';

  let winCount = 0;
  let top4Count = 0;
  let top7Count = 0;
  let relegationCount = 0;
  let perfectCount = 0;
  let unbeatenCount = 0;
  let centurionCount = 0;
  let totalPoints = 0;
  let totalFinish = 0;
  let totalWins = 0;

  for (let sim = 0; sim < simCount; sim++) {
    const seed = (seasonNumber ?? 1) * 100 + sim * 7919 + 31;
    const rng = createRng(seed);

    const matches: MatchResult[] = [];
    const subAppearances: Record<string, number> = {};
    for (const sub of subs) subAppearances[sub.name] = 0;

    // Season form
    const allPlayers = [...starters, ...subs];
    const seasonForm: Record<string, number> = {};
    for (const p of allPlayers) {
      const r = rng();
      const ovrFactor = Math.max(0.5, (90 - p.overall) / 25);
      if (r < 0.08) seasonForm[p.name] = 0.4 * ovrFactor;
      else if (r < 0.20) seasonForm[p.name] = 0.2 * ovrFactor;
      else if (r < 0.80) seasonForm[p.name] = (rng() * 0.2 - 0.1) * ovrFactor;
      else if (r < 0.92) seasonForm[p.name] = -0.15 * ovrFactor;
      else seasonForm[p.name] = -0.3 * ovrFactor;
    }
    // consume seasonForm RNG draws but don't use them — just advance the RNG state
    void seasonForm;

    // Season-wide team modifiers for this sim run
    const simPlayerMod = (rng() - 0.5) * 8 + (rng() - 0.5) * 4;
    const simOppMods: Record<string, number> = {};
    for (const opp of opponents) simOppMods[opp.name] = (rng() - 0.5) * 8 + (rng() - 0.5) * 4;

    for (const opp of opponents) {
      const homeActiveSubs = subs.filter(() => rng() < 0.6);
      const homePlayers = [...starters, ...homeActiveSubs];
      matches.push(simulateMatch(homePlayers, ratings, opp, true, rng, simPlayerMod, simOppMods[opp.name] ?? 0));

      const awayActiveSubs = subs.filter(() => rng() < 0.6);
      const awayPlayers = [...starters, ...awayActiveSubs];
      matches.push(simulateMatch(awayPlayers, ratings, opp, false, rng, simPlayerMod, simOppMods[opp.name] ?? 0));
    }

    // Shuffle
    for (let i = matches.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [matches[i], matches[j]] = [matches[j], matches[i]];
    }

    const wins = matches.filter(m => m.result === 'W').length;
    const draws = matches.filter(m => m.result === 'D').length;
    const points = wins * 3 + draws;

    const leagueTable = simulateLeague(playerTeamName, ratings.teamStrength, opponents, matches, rng, simOppMods);
    const finish = leagueTable.findIndex(t => t.isPlayer) + 1;

    const losses = matches.filter(m => m.result === 'L').length;

    totalPoints += points;
    totalFinish += finish;
    totalWins += wins;
    if (finish === 1) winCount++;
    if (finish <= 4) top4Count++;
    if (finish <= 7) top7Count++;
    if (finish >= 18) relegationCount++;
    if (wins === 38) perfectCount++;
    if (losses === 0) unbeatenCount++;
    if (points >= 100) centurionCount++;
  }

  return {
    winLeague: Math.round((winCount / simCount) * 1000) / 10,
    top4: Math.round((top4Count / simCount) * 1000) / 10,
    top7: Math.round((top7Count / simCount) * 1000) / 10,
    relegation: Math.round((relegationCount / simCount) * 1000) / 10,
    avgPoints: Math.round(totalPoints / simCount),
    avgFinish: Math.round((totalFinish / simCount) * 10) / 10,
    perfectSeason: Math.round((perfectCount / simCount) * 1000) / 10,
    unbeaten: Math.round((unbeatenCount / simCount) * 1000) / 10,
    centurion: Math.round((centurionCount / simCount) * 1000) / 10,
    avgWins: Math.round((totalWins / simCount) * 10) / 10,
  };
}

export function computeTeamStrength(players: DraftPlayer[]): { teamStrength: number; avgOvr: number } {
  const starters = players.filter(p => !p.isSub);
  const starterSource = starters.length > 0 ? starters : players;
  const ratings = computePhaseRatings(starterSource);
  const total = starterSource.reduce((sum, p) => sum + (Number(p.overall) || 70), 0);
  const avgOvr = Math.round(total / (starterSource.length || 1));
  return { teamStrength: Math.round(ratings.teamStrength * 10) / 10, avgOvr };
}

// --- Shared league simulation (multiplayer: all teams play in the same league) ---

// Simulate a match scoreline using full phase ratings for both teams
function simulateScoreline(
  homeRat: PhaseRatings,
  awayRat: PhaseRatings,
  rng: () => number,
  homeSeasonMod: number = 0,
  awaySeasonMod: number = 0,
): { homeGoals: number; awayGoals: number } {
  const ha = HOME_ADVANTAGE;
  const hAtk = homeRat.attack + ha * 0.6 + homeSeasonMod;
  const hMid = homeRat.midfield + ha * 0.4 + homeSeasonMod * 0.7;
  const hDef = homeRat.defense + ha * 0.3 + homeSeasonMod * 0.5;
  const hGk  = homeRat.gk + homeSeasonMod * 0.3;
  const aAtk = awayRat.attack + awaySeasonMod;
  const aMid = awayRat.midfield + awaySeasonMod * 0.7;
  const aDef = awayRat.defense + awaySeasonMod * 0.5;
  const aGk  = awayRat.gk + awaySeasonMod * 0.3;

  const hDefPower = hDef * 0.55 + hGk * 0.30 + hMid * 0.15;
  const aDefPower = aDef * 0.55 + aGk * 0.30 + aMid * 0.15;

  const homeXg = computeExpectedGoals(hAtk, hMid, aDefPower);
  const awayXg = computeExpectedGoals(aAtk, aMid, hDefPower);

  const homeForm = 0.85 + rng() * 0.30;
  const awayForm = 0.85 + rng() * 0.30;

  return { homeGoals: poisson(homeXg * homeForm, rng), awayGoals: poisson(awayXg * awayForm, rng) };
}

// Build a MatchResult from a pre-computed scoreline, assigning goal scorers from the given players
function buildMatchFromScoreline(
  players: DraftPlayer[],
  goalsFor: number,
  goalsAgainst: number,
  opponentName: string,
  isHome: boolean,
  rng: () => number,
): MatchResult {
  const goalScorers: { player: string; minute: number }[] = [];
  const assistProviders: { player: string; minute: number }[] = [];

  const subAdjGoal = (p: DraftPlayer) => goalScoringWeight(p) * (p.isSub ? 0.35 : 1.0);
  const subAdjAssist = (p: DraftPlayer) => assistWeight(p) * (p.isSub ? 0.5 : 1.0);
  const penaltyTaker = [...players].sort((a, b) => goalScoringWeight(b) - goalScoringWeight(a))[0];

  for (let i = 0; i < goalsFor; i++) {
    const minute = randomMinute(rng);
    const isPenalty = rng() < 0.10;
    const scorer = isPenalty ? penaltyTaker : weightedPick(players, subAdjGoal, rng);
    goalScorers.push({ player: scorer.name, minute });
    if (!isPenalty && rng() < 0.75) {
      const eligible = players.filter(p => p.name !== scorer.name);
      if (eligible.length > 0) {
        assistProviders.push({ player: weightedPick(eligible, subAdjAssist, rng).name, minute });
      }
    }
  }

  goalScorers.sort((a, b) => a.minute - b.minute);
  assistProviders.sort((a, b) => a.minute - b.minute);

  const result = goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D';
  return { opponent: opponentName, isHome, goalsFor, goalsAgainst, goalScorers, assistProviders, result };
}

// Convert AI team strength to synthetic PhaseRatings for the shared scoreline sim
function aiRatings(strength: number): PhaseRatings {
  return { attack: strength, midfield: strength * 0.95, defense: strength, gk: strength, teamStrength: strength };
}

export interface SharedSeasonInput {
  userId: string;
  displayName: string;
  teamName?: string;
  squad: DraftPlayer[];
}

// --- Shared European competition helpers (multiplayer opponent dedup) ---

interface UCLLeaguePhaseResult {
  qualified: boolean;
  leagueMatches: UCLMatch[];
  leaguePosition: number;
  leagueTable: UCLLeagueStanding[];
  strengthMap: Map<string, number>;
}

interface OwnRecord {
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; points: number;
}

interface UCLPersonalPhaseResult {
  qualified: boolean;
  teamName: string;
  leagueMatches: UCLMatch[];
  pots: { name: string; strength: number }[][];
  allTeams: { name: string; strength: number }[];
  strengthMap: Map<string, number>;
  ownRecord: OwnRecord;
}

const emptyOwnRecord = (): OwnRecord => ({ played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });

/**
 * Run a human's own UCL league-phase matches only (no filler/background
 * simulation, no knockout). Pot composition uses every team's REAL name
 * (including other co-qualified humans), built in a perspective-independent
 * order (finish-position order, not "self pushed first"), so two different
 * humans calling this for the same room produce byte-identical pots/allTeams
 * — required for the shared background filler simulation in
 * buildUCLLeagueTable to stay in sync across viewers.
 */
function simulateUCLPersonalPhase(
  teamName: string,
  players: DraftPlayer[],
  ratings: PhaseRatings,
  previousLeagueTable: LeagueTeam[],
  opponents: { name: string; strength: number }[],
  rng: () => number,
): UCLPersonalPhaseResult {
  const myFinish = previousLeagueTable.findIndex(t => t.name === teamName) + 1;

  if (myFinish < 1 || myFinish > 5) {
    return {
      qualified: false, teamName, leagueMatches: [],
      pots: [[], [], [], []], allTeams: [], strengthMap: new Map(), ownRecord: emptyOwnRecord(),
    };
  }

  const potForFinish = (f: number) => f <= 2 ? 1 : f === 3 ? 2 : f === 4 ? 3 : 4;
  const opponentMap = new Map(opponents.map(o => [o.name, o.strength]));

  const pots: { name: string; strength: number }[][] = [[], [], [], []];
  for (let i = 0; i < previousLeagueTable.length && i < 5; i++) {
    const team = previousLeagueTable[i];
    const isSelf = team.name === teamName;
    const strength = isSelf ? ratings.teamStrength : (opponentMap.get(team.name) ?? 75);
    pots[potForFinish(i + 1) - 1].push({ name: team.name, strength });
  }

  for (const uclTeam of UCL_TEAMS) {
    if (pots[uclTeam.pot - 1].length < 9) {
      pots[uclTeam.pot - 1].push({ name: uclTeam.name, strength: uclTeam.strength });
    }
  }

  const allTeams = [...pots[0], ...pots[1], ...pots[2], ...pots[3]];
  const strengthMap = new Map(allTeams.map(t => [t.name, t.strength]));

  const myOpponents: { name: string; strength: number; isHome: boolean }[] = [];
  for (const pot of pots) {
    const available = pot.filter(t => t.name !== teamName);
    const shuffled = [...available].sort(() => rng() - 0.5);
    const homeFirst = rng() > 0.5;
    myOpponents.push({ ...shuffled[0], isHome: homeFirst });
    myOpponents.push({ ...shuffled[1], isHome: !homeFirst });
  }
  myOpponents.sort(() => rng() - 0.5);

  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);
  const leagueMatches: UCLMatch[] = [];

  for (const opp of myOpponents) {
    const activeSubs = subs.filter(() => rng() < 0.5);
    const matchPlayers = [...starters, ...activeSubs];
    const m = simulateMatch(matchPlayers, ratings, { name: opp.name, strength: opp.strength }, opp.isHome, rng);
    leagueMatches.push({
      opponent: m.opponent, isHome: m.isHome,
      goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst,
      result: m.result, goalScorers: m.goalScorers, assistProviders: m.assistProviders,
    });
  }

  const ownRecord = emptyOwnRecord();
  for (const m of leagueMatches) {
    ownRecord.played++;
    ownRecord.goalsFor += m.goalsFor;
    ownRecord.goalsAgainst += m.goalsAgainst;
    if (m.result === 'W') { ownRecord.won++; ownRecord.points += 3; }
    else if (m.result === 'D') { ownRecord.drawn++; ownRecord.points += 1; }
    else { ownRecord.lost++; }
  }

  return { qualified: true, teamName, leagueMatches, pots, allTeams, strengthMap, ownRecord };
}

/**
 * Build a human's full UCL league table from their own personal-phase result.
 * Other co-qualified humans' rows are copied directly from their own
 * precomputed ownRecord (NOT re-simulated), so every viewer sees the exact
 * same record for them. Only genuinely-AI rows run the background filler
 * simulation, using a freshly-seeded bgRng so the iteration is identical
 * (same skip-set, same pot order) regardless of who's viewing.
 */
function buildUCLLeagueTable(
  phase: UCLPersonalPhaseResult,
  otherHumanRecords: Map<string, OwnRecord>,
  bgRng: () => number,
): { leagueTable: UCLLeagueStanding[]; leaguePosition: number } {
  const tableData: Record<string, UCLLeagueStanding> = {};
  for (const team of phase.allTeams) {
    tableData[team.name] = {
      name: team.name, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      isPlayer: team.name === phase.teamName, strength: team.strength,
    };
  }

  Object.assign(tableData[phase.teamName], phase.ownRecord);
  otherHumanRecords.forEach((rec, name) => {
    if (tableData[name]) Object.assign(tableData[name], rec);
  });

  const humanNames = new Set<string>([phase.teamName]);
  otherHumanRecords.forEach((_rec, name) => humanNames.add(name));
  for (const team of phase.allTeams) {
    if (humanNames.has(team.name)) continue;
    const td = tableData[team.name];
    for (const pot of phase.pots) {
      const available = pot.filter(t => t.name !== team.name);
      const shuffled = [...available].sort(() => bgRng() - 0.5);
      const picked = shuffled.slice(0, 2);
      for (let k = 0; k < picked.length; k++) {
        const isHome = k === 0;
        const home = isHome ? team : picked[k];
        const away = isHome ? picked[k] : team;
        const { homeGoals, awayGoals } = simulateNeutralMatch(
          { name: home.name, strength: home.strength },
          { name: away.name, strength: away.strength }, bgRng,
        );
        const gf = isHome ? homeGoals : awayGoals;
        const ga = isHome ? awayGoals : homeGoals;
        td.played++;
        td.goalsFor += gf;
        td.goalsAgainst += ga;
        if (gf > ga) { td.won++; td.points += 3; }
        else if (gf === ga) { td.drawn++; td.points += 1; }
        else { td.lost++; }
      }
    }
  }

  const leagueTable = Object.values(tableData);
  for (const t of leagueTable) t.goalDifference = t.goalsFor - t.goalsAgainst;
  leagueTable.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name);
  });

  const leaguePosition = leagueTable.findIndex(t => t.name === phase.teamName) + 1;

  return { leagueTable, leaguePosition };
}

/**
 * UEL equivalent of simulateUCLPersonalPhase. See that function's comment
 * for why pot order must be perspective-independent.
 */
function simulateUELPersonalPhase(
  teamName: string,
  players: DraftPlayer[],
  ratings: PhaseRatings,
  previousLeagueTable: LeagueTeam[],
  opponents: { name: string; strength: number }[],
  rng: () => number,
): UCLPersonalPhaseResult {
  const myFinish = previousLeagueTable.findIndex(t => t.name === teamName) + 1;

  if (myFinish < 6 || myFinish > 7) {
    return {
      qualified: false, teamName, leagueMatches: [],
      pots: [[], [], [], []], allTeams: [], strengthMap: new Map(), ownRecord: emptyOwnRecord(),
    };
  }

  const myPot = myFinish === 6 ? 1 : 2;
  const opponentMap = new Map(opponents.map(o => [o.name, o.strength]));

  const pots: { name: string; strength: number }[][] = [[], [], [], []];
  pots[myPot - 1].push({ name: teamName, strength: ratings.teamStrength });

  const otherPLSlot = myFinish === 6 ? 7 : 6;
  const otherPLPot = otherPLSlot === 6 ? 1 : 2;
  if (previousLeagueTable.length >= otherPLSlot) {
    const team = previousLeagueTable[otherPLSlot - 1];
    const strength = team.name === teamName ? ratings.teamStrength : (opponentMap.get(team.name) ?? 75);
    pots[otherPLPot - 1].push({ name: team.name, strength });
  }

  for (const uelTeam of UEL_TEAMS) {
    if (pots[uelTeam.pot - 1].length < 9) {
      pots[uelTeam.pot - 1].push({ name: uelTeam.name, strength: uelTeam.strength });
    }
  }

  const allTeams = [...pots[0], ...pots[1], ...pots[2], ...pots[3]];
  const strengthMap = new Map(allTeams.map(t => [t.name, t.strength]));

  const myOpponents: { name: string; strength: number; isHome: boolean }[] = [];
  for (const pot of pots) {
    const available = pot.filter(t => t.name !== teamName);
    const shuffled = [...available].sort(() => rng() - 0.5);
    const homeFirst = rng() > 0.5;
    myOpponents.push({ ...shuffled[0], isHome: homeFirst });
    myOpponents.push({ ...shuffled[1], isHome: !homeFirst });
  }
  myOpponents.sort(() => rng() - 0.5);

  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);
  const leagueMatches: UCLMatch[] = [];

  for (const opp of myOpponents) {
    const activeSubs = subs.filter(() => rng() < 0.5);
    const matchPlayers = [...starters, ...activeSubs];
    const m = simulateMatch(matchPlayers, ratings, { name: opp.name, strength: opp.strength }, opp.isHome, rng);
    leagueMatches.push({
      opponent: m.opponent, isHome: m.isHome,
      goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst,
      result: m.result, goalScorers: m.goalScorers, assistProviders: m.assistProviders,
    });
  }

  const ownRecord = emptyOwnRecord();
  for (const m of leagueMatches) {
    ownRecord.played++;
    ownRecord.goalsFor += m.goalsFor;
    ownRecord.goalsAgainst += m.goalsAgainst;
    if (m.result === 'W') { ownRecord.won++; ownRecord.points += 3; }
    else if (m.result === 'D') { ownRecord.drawn++; ownRecord.points += 1; }
    else { ownRecord.lost++; }
  }

  return { qualified: true, teamName, leagueMatches, pots, allTeams, strengthMap, ownRecord };
}

/** UEL equivalent of buildUCLLeagueTable. */
function buildUELLeagueTable(
  phase: UCLPersonalPhaseResult,
  otherHumanRecords: Map<string, OwnRecord>,
  bgRng: () => number,
): { leagueTable: UCLLeagueStanding[]; leaguePosition: number } {
  return buildUCLLeagueTable(phase, otherHumanRecords, bgRng);
}

interface SharedEuropeanHuman {
  userId: string;
  displayName: string;
  teamName: string;
  squad: DraftPlayer[];
  ratings: PhaseRatings;
  rng: () => number;
}

/**
 * Shared UCL knockout simulation for multiplayer.
 * League phase runs independently per human; knockout draws are coordinated
 * so no AI team faces multiple humans in the same round.
 * Follows the same pattern as simulateSharedFaCup.
 */
function simulateSharedUCL(
  humanEntrants: (SharedEuropeanHuman & {
    previousLeagueTable: LeagueTeam[];
    oppForCups: { name: string; strength: number }[];
  })[],
  drawRng: () => number,
  // Seed (same for every human) for background match results — a fresh RNG
  // instance is created from it per human so each call starts at the same
  // point in the sequence, instead of one shared closure drifting out of
  // sync as it's consumed across humans. Otherwise the same filler team's
  // record diverges per viewer.
  bgSeed: number,
): Map<string, UCLResult> {
  const results = new Map<string, UCLResult>();

  if (humanEntrants.length === 0) return results;

  // 1a. Run each human's own personal league matches (their own rng).
  // Pot composition is perspective-independent (see simulateUCLPersonalPhase),
  // so every qualified human's ownRecord can be safely shared with everyone
  // else's table-build pass without re-simulating it.
  const personalPhases = new Map<string, UCLPersonalPhaseResult>();
  for (const h of humanEntrants) {
    personalPhases.set(h.userId, simulateUCLPersonalPhase(h.teamName, h.squad, h.ratings, h.previousLeagueTable, h.oppForCups, h.rng));
  }
  const allRecordsByName = new Map<string, OwnRecord>();
  for (const h of humanEntrants) {
    const phase = personalPhases.get(h.userId)!;
    if (phase.qualified) allRecordsByName.set(phase.teamName, phase.ownRecord);
  }

  // 1b. Build each qualified human's full table, sharing other humans'
  // records and a freshly-seeded bgRng for the genuinely-AI filler teams.
  const phaseResults = new Map<string, UCLLeaguePhaseResult>();
  for (const h of humanEntrants) {
    const phase = personalPhases.get(h.userId)!;
    if (!phase.qualified) {
      phaseResults.set(h.userId, {
        qualified: false, leagueMatches: [], leaguePosition: 0,
        leagueTable: [], strengthMap: new Map(),
      });
      results.set(h.userId, {
        qualified: false, leagueMatches: [], leaguePosition: 0,
        leagueTable: [], knockoutTies: [], winner: false, exitStage: null, tournamentWinner: '',
      });
      continue;
    }
    const otherRecords = new Map(allRecordsByName);
    otherRecords.delete(phase.teamName);
    const { leagueTable, leaguePosition } = buildUCLLeagueTable(phase, otherRecords, createRng(bgSeed));
    phaseResults.set(h.userId, {
      qualified: true, leagueMatches: phase.leagueMatches, leaguePosition,
      leagueTable, strengthMap: phase.strengthMap,
    });
  }

  // Filter to qualified humans who survived league phase
  const qualifiedHumans = humanEntrants.filter(h => {
    const lp = phaseResults.get(h.userId)!;
    if (!lp.qualified) return false;
    if (lp.leaguePosition > 24) {
      results.set(h.userId, {
        qualified: true, leagueMatches: lp.leagueMatches, leaguePosition: lp.leaguePosition,
        leagueTable: lp.leagueTable, knockoutTies: [], winner: false, exitStage: 'League Phase', tournamentWinner: '',
      });
      return false;
    }
    return true;
  });

  // 2. Knockout phase — coordinated draws (or solo if only 1 human)
  const humanKnockoutTies = new Map<string, UCLKnockoutTie[]>();
  const humanEliminated = new Map<string, Set<string>>(); // AI teams each human has already faced
  const surviving = new Map<string, typeof qualifiedHumans[0]>();

  for (const h of qualifiedHumans) {
    humanKnockoutTies.set(h.userId, []);
    humanEliminated.set(h.userId, new Set());
    surviving.set(h.userId, h);
  }

  // R32: deterministic based on league position (9-24 paired with 33-pos)
  for (const h of qualifiedHumans) {
    const lp = phaseResults.get(h.userId)!;
    if (lp.leaguePosition >= 9) {
      const r32OppPos = 33 - lp.leaguePosition;
      const r32Opp = lp.leagueTable[r32OppPos - 1];
      const r32Str = lp.strengthMap.get(r32Opp.name) || 75;
      const r32 = simulateUCLKnockoutTie('Round of 32', r32Opp.name, r32Str, h.squad, h.ratings, h.rng, false);
      humanKnockoutTies.get(h.userId)!.push(r32);
      humanEliminated.get(h.userId)!.add(r32Opp.name);
      if (r32.result === 'L') {
        surviving.delete(h.userId);
        results.set(h.userId, {
          qualified: true, leagueMatches: lp.leagueMatches, leaguePosition: lp.leaguePosition,
          leagueTable: lp.leagueTable, knockoutTies: humanKnockoutTies.get(h.userId)!,
          winner: false, exitStage: 'Round of 32', tournamentWinner: '',
        });
      }
    }
  }

  // R16 through Final: coordinated draws
  const roundPoolSizes = [16, 8, 4, 3]; // pool slice sizes for R16, QF, SF, Final
  const knockoutRoundNames = ['Round of 16', 'Quarter-Final', 'Semi-Final', 'Final'];

  for (let ri = 0; ri < knockoutRoundNames.length; ri++) {
    const roundName = knockoutRoundNames[ri];
    const poolSize = roundPoolSizes[ri];
    const isFinal = roundName === 'Final';
    const survivorIds = Array.from(surviving.keys());
    if (survivorIds.length === 0) break;

    const pairedHumans = new Set<string>();
    const humanVsHuman: [string, string][] = [];

    // From QF onwards, surviving humans can draw each other
    // Higher probability than pure random to make H2H exciting in multiplayer
    if (survivorIds.length >= 2 && ri >= 1) {
      // Fisher-Yates (not .sort(() => rng() - 0.5), which is a biased shuffle whose
      // RNG-consumption pattern depends on the JS engine's sort implementation —
      // that desynced the shared draw between players' clients)
      const shuffled = [...survivorIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(drawRng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const teamsInRound = poolSize * 2;
      // Base probability = 1/(teams-1), boosted so human matchups happen more often
      const baseProbability = 1 / Math.max(1, teamsInRound - 1);
      const boostedProbability = Math.min(0.8, baseProbability * 1.5);
      for (let i = 0; i + 1 < shuffled.length; i += 2) {
        if (drawRng() < boostedProbability) {
          humanVsHuman.push([shuffled[i], shuffled[i + 1]]);
          pairedHumans.add(shuffled[i]);
          pairedHumans.add(shuffled[i + 1]);
        }
      }
    }

    // Draw AI opponents for unpaired humans (no overlap across humans)
    const usedAIThisRound = new Set<string>();
    const humansVsAI = survivorIds.filter(id => !pairedHumans.has(id));

    for (const userId of humansVsAI) {
      const h = surviving.get(userId)!;
      const lp = phaseResults.get(userId)!;
      const eliminated = humanEliminated.get(userId)!;

      // Pool: non-player, non-eliminated teams from this human's league table
      let pool = lp.leagueTable.filter(t => !t.isPlayer && !eliminated.has(t.name) && !usedAIThisRound.has(t.name)).slice(0, poolSize);
      if (pool.length === 0) {
        // Fallback: allow reuse if pool is exhausted
        pool = lp.leagueTable.filter(t => !t.isPlayer && !eliminated.has(t.name)).slice(0, poolSize);
      }
      if (pool.length === 0) {
        pool = lp.leagueTable.filter(t => !t.isPlayer).slice(0, poolSize);
      }

      const opp = pool[Math.floor(drawRng() * pool.length)];
      const oppStr = lp.strengthMap.get(opp.name) || 75;
      usedAIThisRound.add(opp.name);
      eliminated.add(opp.name);

      const tie = simulateUCLKnockoutTie(roundName, opp.name, oppStr, h.squad, h.ratings, h.rng, isFinal);
      humanKnockoutTies.get(userId)!.push(tie);

      if (tie.result === 'L') {
        surviving.delete(userId);
        results.set(userId, {
          qualified: true, leagueMatches: lp.leagueMatches, leaguePosition: lp.leaguePosition,
          leagueTable: lp.leagueTable, knockoutTies: humanKnockoutTies.get(userId)!,
          winner: false, exitStage: roundName, tournamentWinner: '',
        });
      }
    }

    // Human-vs-human matches
    for (const [id1, id2] of humanVsHuman) {
      if (!surviving.has(id1) || !surviving.has(id2)) continue;
      const h1 = surviving.get(id1)!;
      const h2 = surviving.get(id2)!;

      // Simulate using h1's RNG for the tie, with h2's team strength as opponent
      const tie1 = simulateUCLKnockoutTie(roundName, h2.displayName, h2.ratings.teamStrength, h1.squad, h1.ratings, h1.rng, isFinal);

      // Build mirrored result for h2
      const mirrorLeg = (leg: UCLMatch): UCLMatch => ({
        opponent: h1.displayName,
        isHome: !leg.isHome,
        goalsFor: leg.goalsAgainst,
        goalsAgainst: leg.goalsFor,
        result: leg.result === 'W' ? 'L' : leg.result === 'L' ? 'W' : 'D',
        goalScorers: [], // h2's scorers would need separate generation
        assistProviders: [],
        extraTime: leg.extraTime,
        penalties: leg.penalties,
        penaltyScore: leg.penaltyScore ? { player: leg.penaltyScore.opponent, opponent: leg.penaltyScore.player } : undefined,
      });

      // Generate h2's goal scorers for each leg
      const h2Leg1Scorers = generateGoalScorers(h2.squad, tie1.leg1.goalsAgainst, h2.rng);
      const mirroredLeg1 = mirrorLeg(tie1.leg1);
      mirroredLeg1.goalScorers = h2Leg1Scorers.goals;
      mirroredLeg1.assistProviders = h2Leg1Scorers.assists;

      let mirroredLeg2: UCLMatch | undefined;
      if (tie1.leg2) {
        const h2Leg2Scorers = generateGoalScorers(h2.squad, tie1.leg2.goalsAgainst, h2.rng);
        mirroredLeg2 = mirrorLeg(tie1.leg2);
        mirroredLeg2.goalScorers = h2Leg2Scorers.goals;
        mirroredLeg2.assistProviders = h2Leg2Scorers.assists;
      }

      const tie2: UCLKnockoutTie = {
        round: roundName,
        opponent: h1.displayName,
        leg1: mirroredLeg1,
        leg2: mirroredLeg2,
        result: tie1.result === 'W' ? 'L' : 'W',
      };

      humanKnockoutTies.get(id1)!.push(tie1);
      humanKnockoutTies.get(id2)!.push(tie2);

      const loserId = tie1.result === 'W' ? id2 : id1;
      const loserLp = phaseResults.get(loserId)!;
      surviving.delete(loserId);
      results.set(loserId, {
        qualified: true, leagueMatches: loserLp.leagueMatches, leaguePosition: loserLp.leaguePosition,
        leagueTable: loserLp.leagueTable, knockoutTies: humanKnockoutTies.get(loserId)!,
        winner: false, exitStage: roundName, tournamentWinner: '',
      });
    }
  }

  // Finalize surviving humans (winners or still standing after final)
  surviving.forEach((_, userId) => {
    if (!results.has(userId)) {
      const lp = phaseResults.get(userId)!;
      const ties = humanKnockoutTies.get(userId)!;
      const lastTie = ties[ties.length - 1];
      const isWinner = lastTie?.round === 'Final' && lastTie.result === 'W';
      results.set(userId, {
        qualified: true, leagueMatches: lp.leagueMatches, leaguePosition: lp.leaguePosition,
        leagueTable: lp.leagueTable, knockoutTies: ties,
        winner: isWinner, exitStage: isWinner ? null : lastTie?.round ?? null, tournamentWinner: '',
      });
    }
  });

  return results;
}

/**
 * Shared UEL knockout simulation for multiplayer.
 * Same pattern as simulateSharedUCL but for Europa League (6th-7th qualify).
 */
function simulateSharedUEL(
  humanEntrants: (SharedEuropeanHuman & {
    previousLeagueTable: LeagueTeam[];
    oppForCups: { name: string; strength: number }[];
  })[],
  drawRng: () => number,
  // Seed (same for every human) for background match results — a fresh RNG
  // instance is created from it per human so each call starts at the same
  // point in the sequence, instead of one shared closure drifting out of
  // sync as it's consumed across humans. Otherwise the same filler team's
  // record diverges per viewer.
  bgSeed: number,
): Map<string, UCLResult> {
  const results = new Map<string, UCLResult>();

  if (humanEntrants.length === 0) return results;

  // 1a. Run each human's own personal league matches (their own rng).
  const personalPhases = new Map<string, UCLPersonalPhaseResult>();
  for (const h of humanEntrants) {
    personalPhases.set(h.userId, simulateUELPersonalPhase(h.teamName, h.squad, h.ratings, h.previousLeagueTable, h.oppForCups, h.rng));
  }
  const allRecordsByName = new Map<string, OwnRecord>();
  for (const h of humanEntrants) {
    const phase = personalPhases.get(h.userId)!;
    if (phase.qualified) allRecordsByName.set(phase.teamName, phase.ownRecord);
  }

  // 1b. Build each qualified human's full table, sharing other humans'
  // records and a freshly-seeded bgRng for the genuinely-AI filler teams.
  const phaseResults = new Map<string, UCLLeaguePhaseResult>();
  for (const h of humanEntrants) {
    const phase = personalPhases.get(h.userId)!;
    if (!phase.qualified) {
      phaseResults.set(h.userId, {
        qualified: false, leagueMatches: [], leaguePosition: 0,
        leagueTable: [], strengthMap: new Map(),
      });
      results.set(h.userId, {
        qualified: false, leagueMatches: [], leaguePosition: 0,
        leagueTable: [], knockoutTies: [], winner: false, exitStage: null, tournamentWinner: '',
      });
      continue;
    }
    const otherRecords = new Map(allRecordsByName);
    otherRecords.delete(phase.teamName);
    const { leagueTable, leaguePosition } = buildUELLeagueTable(phase, otherRecords, createRng(bgSeed));
    phaseResults.set(h.userId, {
      qualified: true, leagueMatches: phase.leagueMatches, leaguePosition,
      leagueTable, strengthMap: phase.strengthMap,
    });
  }

  const qualifiedHumans = humanEntrants.filter(h => {
    const lp = phaseResults.get(h.userId)!;
    if (!lp.qualified) return false;
    if (lp.leaguePosition > 24) {
      results.set(h.userId, {
        qualified: true, leagueMatches: lp.leagueMatches, leaguePosition: lp.leaguePosition,
        leagueTable: lp.leagueTable, knockoutTies: [], winner: false, exitStage: 'League Phase', tournamentWinner: '',
      });
      return false;
    }
    return true;
  });

  // 2. Knockout phase — coordinated draws (or solo if only 1 human)
  const humanKnockoutTies = new Map<string, UCLKnockoutTie[]>();
  const humanEliminated = new Map<string, Set<string>>();
  const surviving = new Map<string, typeof qualifiedHumans[0]>();

  for (const h of qualifiedHumans) {
    humanKnockoutTies.set(h.userId, []);
    humanEliminated.set(h.userId, new Set());
    surviving.set(h.userId, h);
  }

  // R32
  for (const h of qualifiedHumans) {
    const lp = phaseResults.get(h.userId)!;
    if (lp.leaguePosition >= 9) {
      const r32OppPos = 33 - lp.leaguePosition;
      const r32Opp = lp.leagueTable[r32OppPos - 1];
      const r32Str = lp.strengthMap.get(r32Opp.name) || 70;
      const r32 = simulateUCLKnockoutTie('Round of 32', r32Opp.name, r32Str, h.squad, h.ratings, h.rng, false);
      humanKnockoutTies.get(h.userId)!.push(r32);
      humanEliminated.get(h.userId)!.add(r32Opp.name);
      if (r32.result === 'L') {
        surviving.delete(h.userId);
        results.set(h.userId, {
          qualified: true, leagueMatches: lp.leagueMatches, leaguePosition: lp.leaguePosition,
          leagueTable: lp.leagueTable, knockoutTies: humanKnockoutTies.get(h.userId)!,
          winner: false, exitStage: 'Round of 32', tournamentWinner: '',
        });
      }
    }
  }

  const roundPoolSizes = [16, 8, 4, 3];
  const knockoutRoundNames = ['Round of 16', 'Quarter-Final', 'Semi-Final', 'Final'];

  for (let ri = 0; ri < knockoutRoundNames.length; ri++) {
    const roundName = knockoutRoundNames[ri];
    const poolSize = roundPoolSizes[ri];
    const isFinal = roundName === 'Final';
    const survivorIds = Array.from(surviving.keys());
    if (survivorIds.length === 0) break;

    const pairedHumans = new Set<string>();
    const humanVsHuman: [string, string][] = [];

    if (survivorIds.length >= 2 && ri >= 1) {
      // Fisher-Yates (not .sort(() => rng() - 0.5) — see comment in simulateSharedUCL)
      const shuffled = [...survivorIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(drawRng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const teamsInRound = poolSize * 2;
      const baseProbability = 1 / Math.max(1, teamsInRound - 1);
      const boostedProbability = Math.min(0.8, baseProbability * 1.5);
      for (let i = 0; i + 1 < shuffled.length; i += 2) {
        if (drawRng() < boostedProbability) {
          humanVsHuman.push([shuffled[i], shuffled[i + 1]]);
          pairedHumans.add(shuffled[i]);
          pairedHumans.add(shuffled[i + 1]);
        }
      }
    }

    const usedAIThisRound = new Set<string>();
    const humansVsAI = survivorIds.filter(id => !pairedHumans.has(id));

    for (const userId of humansVsAI) {
      const h = surviving.get(userId)!;
      const lp = phaseResults.get(userId)!;
      const eliminated = humanEliminated.get(userId)!;

      let pool = lp.leagueTable.filter(t => !t.isPlayer && !eliminated.has(t.name) && !usedAIThisRound.has(t.name)).slice(0, poolSize);
      if (pool.length === 0) pool = lp.leagueTable.filter(t => !t.isPlayer && !eliminated.has(t.name)).slice(0, poolSize);
      if (pool.length === 0) pool = lp.leagueTable.filter(t => !t.isPlayer).slice(0, poolSize);

      const opp = pool[Math.floor(drawRng() * pool.length)];
      const oppStr = lp.strengthMap.get(opp.name) || 70;
      usedAIThisRound.add(opp.name);
      eliminated.add(opp.name);

      const tie = simulateUCLKnockoutTie(roundName, opp.name, oppStr, h.squad, h.ratings, h.rng, isFinal);
      humanKnockoutTies.get(userId)!.push(tie);

      if (tie.result === 'L') {
        surviving.delete(userId);
        results.set(userId, {
          qualified: true, leagueMatches: lp.leagueMatches, leaguePosition: lp.leaguePosition,
          leagueTable: lp.leagueTable, knockoutTies: humanKnockoutTies.get(userId)!,
          winner: false, exitStage: roundName, tournamentWinner: '',
        });
      }
    }

    // Human-vs-human
    for (const [id1, id2] of humanVsHuman) {
      if (!surviving.has(id1) || !surviving.has(id2)) continue;
      const h1 = surviving.get(id1)!;
      const h2 = surviving.get(id2)!;

      const tie1 = simulateUCLKnockoutTie(roundName, h2.displayName, h2.ratings.teamStrength, h1.squad, h1.ratings, h1.rng, isFinal);

      const mirrorLeg = (leg: UCLMatch): UCLMatch => ({
        opponent: h1.displayName, isHome: !leg.isHome,
        goalsFor: leg.goalsAgainst, goalsAgainst: leg.goalsFor,
        result: leg.result === 'W' ? 'L' : leg.result === 'L' ? 'W' : 'D',
        goalScorers: [], assistProviders: [],
        extraTime: leg.extraTime, penalties: leg.penalties,
        penaltyScore: leg.penaltyScore ? { player: leg.penaltyScore.opponent, opponent: leg.penaltyScore.player } : undefined,
      });

      const h2Leg1Scorers = generateGoalScorers(h2.squad, tie1.leg1.goalsAgainst, h2.rng);
      const mirroredLeg1 = mirrorLeg(tie1.leg1);
      mirroredLeg1.goalScorers = h2Leg1Scorers.goals;
      mirroredLeg1.assistProviders = h2Leg1Scorers.assists;

      let mirroredLeg2: UCLMatch | undefined;
      if (tie1.leg2) {
        const h2Leg2Scorers = generateGoalScorers(h2.squad, tie1.leg2.goalsAgainst, h2.rng);
        mirroredLeg2 = mirrorLeg(tie1.leg2);
        mirroredLeg2.goalScorers = h2Leg2Scorers.goals;
        mirroredLeg2.assistProviders = h2Leg2Scorers.assists;
      }

      const tie2: UCLKnockoutTie = {
        round: roundName, opponent: h1.displayName,
        leg1: mirroredLeg1, leg2: mirroredLeg2,
        result: tie1.result === 'W' ? 'L' : 'W',
      };

      humanKnockoutTies.get(id1)!.push(tie1);
      humanKnockoutTies.get(id2)!.push(tie2);

      const loserId = tie1.result === 'W' ? id2 : id1;
      const loserLp = phaseResults.get(loserId)!;
      surviving.delete(loserId);
      results.set(loserId, {
        qualified: true, leagueMatches: loserLp.leagueMatches, leaguePosition: loserLp.leaguePosition,
        leagueTable: loserLp.leagueTable, knockoutTies: humanKnockoutTies.get(loserId)!,
        winner: false, exitStage: roundName, tournamentWinner: '',
      });
    }
  }

  surviving.forEach((_, userId) => {
    if (!results.has(userId)) {
      const lp = phaseResults.get(userId)!;
      const ties = humanKnockoutTies.get(userId)!;
      const lastTie = ties[ties.length - 1];
      const isWinner = lastTie?.round === 'Final' && lastTie.result === 'W';
      results.set(userId, {
        qualified: true, leagueMatches: lp.leagueMatches, leaguePosition: lp.leaguePosition,
        leagueTable: lp.leagueTable, knockoutTies: ties,
        winner: isWinner, exitStage: isWinner ? null : lastTie?.round ?? null, tournamentWinner: '',
      });
    }
  });

  return results;
}

/**
 * Simulate a full shared Premier League season for N human teams.
 * All 20 teams (N human + 20-N AI) play in the same round-robin league
 * using a single shared RNG seed, so every team's results are consistent.
 * FA Cup and European competitions are still simulated independently per player.
 */
export function simulateSharedSeason(
  humanTeams: SharedSeasonInput[],
  aiTeams: { name: string; strength: number }[],
  sharedSeed: number,
  seasonNumber: number = 1,
  previousLeagueTable?: { name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number; isPlayer?: boolean }[],
  previousResults?: Record<string, { uclWinner: boolean; uelWinner: boolean; faCupWinner: boolean; leagueCupWinner?: boolean }>,
): Map<string, SeasonResult> {
  const sharedRng = createRng(sharedSeed);

  // Compute phase ratings for every human team
  const humanData = humanTeams.map(ht => {
    const starters = ht.squad.filter(p => !p.isSub);
    const subs     = ht.squad.filter(p => p.isSub);
    return {
      ...ht,
      teamName: ht.teamName?.trim() || `${ht.displayName} FC`,
      ratings: computePhaseRatings(starters.length > 0 ? starters : ht.squad),
      starters,
      subs,
    };
  });

  // Full 20-team roster
  type TeamEntry = { name: string; ratings: PhaseRatings; isHuman: boolean; userId?: string };
  const allTeams: TeamEntry[] = [
    ...humanData.map(hd => ({ name: hd.teamName, ratings: hd.ratings, isHuman: true, userId: hd.userId })),
    ...aiTeams.map(ai => ({ name: ai.name, ratings: aiRatings(ai.strength), isHuman: false })),
  ];
  const N = allTeams.length;

  // Season-wide form modifiers for each team (shared RNG so all players see same table)
  const teamSeasonMods: number[] = allTeams.map(() => (sharedRng() - 0.5) * 8 + (sharedRng() - 0.5) * 4);

  // Simulate ALL match scorelines with the shared RNG
  // matchScores[i][j] = { homeGoals, awayGoals } when team i plays at home vs team j
  const matchScores: { homeGoals: number; awayGoals: number }[][] = Array.from({ length: N }, () => new Array(N).fill(null));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      matchScores[i][j] = simulateScoreline(allTeams[i].ratings, allTeams[j].ratings, sharedRng, teamSeasonMods[i], teamSeasonMods[j]);
    }
  }

  // Generate a shared round-robin schedule using the circle method
  // For N=20 teams: first half has 19 rounds of 10 matches each, second half mirrors with opposite H/A
  const firstHalfRounds: { home: number; away: number }[][] = [];
  const rotating = Array.from({ length: N - 1 }, (_, i) => i + 1); // [1, 2, ..., N-1]
  for (let r = 0; r < N - 1; r++) {
    const round: { home: number; away: number }[] = [];
    // Match: team 0 vs rotating[0]
    if (sharedRng() > 0.5) {
      round.push({ home: 0, away: rotating[0] });
    } else {
      round.push({ home: rotating[0], away: 0 });
    }
    // Match: rotating[i] vs rotating[N-1-1-i] for i = 1..N/2-1
    for (let i = 1; i < N / 2; i++) {
      const mirrorIdx = N - 1 - i;
      if (sharedRng() > 0.5) {
        round.push({ home: rotating[i], away: rotating[mirrorIdx] });
      } else {
        round.push({ home: rotating[mirrorIdx], away: rotating[i] });
      }
    }
    firstHalfRounds.push(round);
    // Rotate: move last element to position 0
    rotating.unshift(rotating.pop()!);
  }
  // Shuffle the first-half round order
  for (let i = firstHalfRounds.length - 1; i > 0; i--) {
    const j = Math.floor(sharedRng() * (i + 1));
    [firstHalfRounds[i], firstHalfRounds[j]] = [firstHalfRounds[j], firstHalfRounds[i]];
  }

  // Second half: same pairings, opposite H/A, independently shuffled
  const secondHalfRounds = firstHalfRounds.map(round =>
    round.map(m => ({ home: m.away, away: m.home }))
  );
  for (let i = secondHalfRounds.length - 1; i > 0; i--) {
    const j = Math.floor(sharedRng() * (i + 1));
    [secondHalfRounds[i], secondHalfRounds[j]] = [secondHalfRounds[j], secondHalfRounds[i]];
  }

  // fullSchedule[matchweek] = array of fixtures for that matchweek
  const fullSchedule: { home: number; away: number }[][] = [...firstHalfRounds, ...secondHalfRounds];

  // Build the shared league table from all 380 scorelines
  const table: Record<string, LeagueTeam> = {};
  for (const t of allTeams) {
    table[t.name] = { name: t.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, isPlayer: false };
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const { homeGoals, awayGoals } = matchScores[i][j];
      const ht = table[allTeams[i].name];
      const at = table[allTeams[j].name];
      ht.played++; ht.goalsFor += homeGoals; ht.goalsAgainst += awayGoals;
      at.played++; at.goalsFor += awayGoals; at.goalsAgainst += homeGoals;
      if (homeGoals > awayGoals) { ht.won++; ht.points += 3; at.lost++; }
      else if (homeGoals === awayGoals) { ht.drawn++; ht.points += 1; at.drawn++; at.points += 1; }
      else { ht.lost++; at.won++; at.points += 3; }
    }
  }
  for (const t of Object.values(table)) t.goalDifference = t.goalsFor - t.goalsAgainst;
  const sharedTable = Object.values(table).sort((a, b) =>
    b.points !== a.points ? b.points - a.points :
    b.goalDifference !== a.goalDifference ? b.goalDifference - a.goalDifference :
    b.goalsFor - a.goalsFor
  );

  // Build the live-table fixture-by-matchweek breakdown from the same schedule/scores
  // already computed above — every human team shares this identical array.
  const sharedAllFixtures: SeasonWeek[] = fullSchedule.map((round, mwIdx) => ({
    week: mwIdx + 1,
    matches: round.map(fx => {
      const { homeGoals, awayGoals } = matchScores[fx.home][fx.away];
      return { home: allTeams[fx.home].name, away: allTeams[fx.away].name, homeGoals, awayGoals };
    }),
  }));

  // Shared FA Cup: include ALL teams (human + AI) so human teams appear in the bracket
  const faCupDrawRng = createRng(sharedSeed ^ 0xFAC09);
  const allCupTeams = allTeams.map(t => ({ name: t.name, strength: t.ratings.teamStrength }));

  const sharedFaCupTeams = humanData.map(hd => {
    const playerSeed = hd.squad.reduce((acc, p) => acc + p.overall * 7 + p.name.length * 13, 42 + seasonNumber * 100);
    return {
      userId: hd.userId,
      displayName: hd.displayName,
      teamName: hd.teamName,
      starters: hd.starters,
      ratings: hd.ratings,
      rng: createRng(playerSeed + 55555),
    };
  });
  const { results: sharedFaCupResultsMap, faCupWinner: sharedFaCupWinner } = simulateSharedFaCup(sharedFaCupTeams, allCupTeams, faCupDrawRng);

  // Shared League Cup: same bracket for all players
  const leagueCupDrawRng = createRng(sharedSeed ^ 0xCA5C09);
  const sharedLeagueCupTeams = humanData.map(hd => {
    const playerSeed = hd.squad.reduce((acc, p) => acc + p.overall * 7 + p.name.length * 13, 42 + seasonNumber * 100);
    return {
      userId: hd.userId,
      displayName: hd.displayName,
      teamName: hd.teamName,
      starters: hd.starters,
      ratings: hd.ratings,
      rng: createRng(playerSeed + 77777),
    };
  });
  const { results: sharedLeagueCupResultsMap } = simulateSharedLeagueCup(sharedLeagueCupTeams, allCupTeams, leagueCupDrawRng);

  // Shared European competitions (only from season 2+ when previousLeagueTable is provided)
  // Convert previousLeagueTable to LeagueTeam[] format, mapping human team names back
  let sharedUCLResults = new Map<string, UCLResult>();
  let sharedUELResults = new Map<string, UCLResult>();

  if (previousLeagueTable) {
    // Build per-human previousLeagueTable with isPlayer set for each
    const buildPrevTable = (forHd: typeof humanData[0]): LeagueTeam[] =>
      previousLeagueTable.map(row => ({
        name: row.name,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.gf,
        goalsAgainst: row.ga,
        goalDifference: row.gf - row.ga,
        points: row.points,
        isPlayer: row.name === forHd.teamName,
      }));

    // Determine which humans qualify for UCL (top 5) vs UEL (6th-7th) from previous table
    const uclEntrants: (SharedEuropeanHuman & { previousLeagueTable: LeagueTeam[]; oppForCups: { name: string; strength: number }[] })[] = [];
    const uelEntrants: (SharedEuropeanHuman & { previousLeagueTable: LeagueTeam[]; oppForCups: { name: string; strength: number }[] })[] = [];

    for (const hd of humanData) {
      const prevTable = buildPrevTable(hd);
      const myFinish = prevTable.findIndex(t => t.isPlayer) + 1;
      const myIdx = allTeams.findIndex(t => t.name === hd.teamName);
      const opponents = allTeams.filter((_, i) => i !== myIdx);
      const oppForCups = opponents.map(o => ({ name: o.name, strength: o.ratings.teamStrength }));
      const playerSeed = hd.squad.reduce((acc, p) => acc + p.overall * 7 + p.name.length * 13, 42 + seasonNumber * 100);

      const entrant = {
        userId: hd.userId,
        displayName: hd.displayName,
        teamName: hd.teamName,
        squad: hd.squad,
        ratings: hd.ratings,
        rng: createRng(playerSeed + 88888), // separate RNG for European comps
        previousLeagueTable: prevTable,
        oppForCups,
      };

      const prevResults = previousResults?.[hd.userId];
      const wonUELLast = prevResults?.uelWinner === true;
      const wonFACupLast = prevResults?.faCupWinner === true;
      const wonLeagueCupLast = prevResults?.leagueCupWinner === true;
      const qualifiesThroughLeague = myFinish >= 1 && myFinish <= 5;
      const uelWinnerQualifiesForUCL = wonUELLast && !qualifiesThroughLeague;
      const faCupWinnerQualifiesForEL = wonFACupLast && myFinish > 7;
      const leagueCupWinnerQualifiesForEL = wonLeagueCupLast && myFinish > 7;

      if (qualifiesThroughLeague || uelWinnerQualifiesForUCL) {
        uclEntrants.push(entrant);
      } else if (myFinish >= 6 && myFinish <= 7) {
        uelEntrants.push(entrant);
      } else if (faCupWinnerQualifiesForEL || leagueCupWinnerQualifiesForEL) {
        uelEntrants.push(entrant);
      }
    }

    const uclDrawRng = createRng(sharedSeed ^ 0xDC101);
    const uelDrawRng = createRng(sharedSeed ^ 0xDE102);
    // Shared background seed: drives non-player ("filler") match results inside
    // the UCL/UEL league phase, so the same filler team shows an identical
    // record to every human in the room instead of diverging per-viewer.
    const uclBgSeed = sharedSeed ^ 0xB6C101;
    const uelBgSeed = sharedSeed ^ 0xB6C102;
    sharedUCLResults = simulateSharedUCL(uclEntrants, uclDrawRng, uclBgSeed);
    sharedUELResults = simulateSharedUEL(uelEntrants, uelDrawRng, uelBgSeed);
  }

  // Season 1 background European competitions (no previous table yet)
  let season1UclWinner: string | undefined;
  let season1UelWinner: string | undefined;
  if (!previousLeagueTable) {
    const s1UclRng = createRng(sharedSeed ^ 0xDC101);
    const s1UelRng = createRng(sharedSeed ^ 0xDE102);
    season1UclWinner = pickBackgroundKnockoutWinner(
      [...UCL_TEAMS.map(t => ({ name: t.name, strength: t.strength })), ...SEASON1_UCL_PL_TEAMS],
      s1UclRng
    ) || undefined;
    season1UelWinner = pickBackgroundKnockoutWinner(
      [...UEL_TEAMS.map(t => ({ name: t.name, strength: t.strength })), ...SEASON1_UEL_PL_TEAMS],
      s1UelRng
    ) || undefined;
  }

  // Simulate Super Cup per player (if they won UCL or UEL last season)
  const sharedSuperCupResults = new Map<string, SuperCupResult>();
  const sharedCharityShieldResults = new Map<string, CharityShieldResult>();
  if (previousResults && previousLeagueTable) {
    const superCupRng = createRng(sharedSeed ^ 0x5C09);
    const charityShieldRng = createRng(sharedSeed ^ 0xC5AD);
    const aiOpponentsForCups = aiTeams;

    for (const hd of humanData) {
      const prevRes = previousResults[hd.userId];
      if (!prevRes) continue;
      const prevTable = previousLeagueTable.map(row => ({
        name: row.name, played: row.played, won: row.won, drawn: row.drawn, lost: row.lost,
        goalsFor: row.gf, goalsAgainst: row.ga, goalDifference: row.gf - row.ga,
        points: row.points, isPlayer: row.name === hd.teamName,
      }));

      if (prevRes.uclWinner || prevRes.uelWinner) {
        const uclWinnerTeam = prevRes.uclWinner ? hd.teamName : (aiOpponentsForCups.sort((a, b) => b.strength - a.strength)[0]?.name ?? 'Real Madrid');
        const uelWinnerTeam = prevRes.uelWinner ? hd.teamName : (UCL_TEAMS.slice().sort((a, b) => b.strength - a.strength)[2]?.name ?? 'Atletico Madrid');
        const uclStr = prevRes.uclWinner ? hd.ratings.teamStrength : (aiOpponentsForCups.find(o => o.name === uclWinnerTeam)?.strength ?? 84);
        const uelStr = prevRes.uelWinner ? hd.ratings.teamStrength : (UEL_TEAMS.find(t => t.name === uelWinnerTeam)?.strength ?? 76);

        const playerRole: 'UCL Winner' | 'UEL Winner' = prevRes.uclWinner ? 'UCL Winner' : 'UEL Winner';
        const oppName = prevRes.uclWinner ? uelWinnerTeam : uclWinnerTeam;
        const oppStr = prevRes.uclWinner ? uelStr : uclStr;
        const oppRole: 'UCL Winner' | 'UEL Winner' = prevRes.uclWinner ? 'UEL Winner' : 'UCL Winner';
        const starters = hd.starters;
        const superBenchGk = hd.subs.find(p => classifyPosition(p.assignedPosition) === 'GK');
        const activeSubs = hd.subs.filter(s => { const r = superCupRng(); return s !== superBenchGk && r < 0.5; });
        const matchPlayers = [...starters, ...activeSubs];
        const m = simulateMatch(matchPlayers, hd.ratings, { name: oppName, strength: oppStr }, superCupRng() > 0.5, superCupRng);
        let result: 'W' | 'D' | 'L' = m.result;
        if (result === 'D') {
          const etFor = poisson(computeExpectedGoals(hd.ratings.attack, hd.ratings.midfield, oppStr) * 0.33, superCupRng);
          const etAg = poisson(computeExpectedGoals(oppStr, oppStr * 0.95, hd.ratings.defense) * 0.33, superCupRng);
          result = etFor > etAg ? 'W' : etFor < etAg ? 'L' : (superCupRng() > 0.5 ? 'W' : 'L');
        }
        sharedSuperCupResults.set(hd.userId, {
          played: true, opponent: oppName, playerRole, opponentRole: oppRole,
          goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst,
          goalScorers: m.goalScorers, assistProviders: m.assistProviders, result,
        });
      }

      if (prevRes.faCupWinner) {
        const plWinner = prevTable[0]?.name ?? '';
        const plRunnerUp = prevTable[1]?.name ?? '';
        const playerWonPL = prevTable[0]?.isPlayer === true;
        const opponent = playerWonPL ? plRunnerUp : plWinner;
        const oppStr = aiOpponentsForCups.find(o => o.name === opponent)?.strength ?? 80;
        const opponentIsPlayer = !playerWonPL;
        if (!opponentIsPlayer || !opponent) {
          const starters = hd.starters;
          const charBenchGk = hd.subs.find(p => classifyPosition(p.assignedPosition) === 'GK');
          const activeSubs = hd.subs.filter(s => { const r = charityShieldRng(); return s !== charBenchGk && r < 0.5; });
          const matchPlayers = [...starters, ...activeSubs];
          const m = simulateMatch(matchPlayers, hd.ratings, { name: opponent || 'Unknown', strength: oppStr }, charityShieldRng() > 0.5, charityShieldRng);
          let result: 'W' | 'D' | 'L' = m.result;
          if (result === 'D') result = charityShieldRng() > 0.5 ? 'W' : 'L';
          const playerRole: 'PL Winner' | 'FA Cup Winner' = playerWonPL ? 'PL Winner' : 'FA Cup Winner';
          const oppRole: 'PL Winner' | 'FA Cup Winner' = playerRole === 'PL Winner' ? 'FA Cup Winner' : 'PL Winner';
          sharedCharityShieldResults.set(hd.userId, {
            played: true, opponent, playerRole, opponentRole: oppRole,
            goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst,
            goalScorers: m.goalScorers, assistProviders: m.assistProviders, result,
          });
        }
      }
    }
  }

  // Build SeasonResult for each human team
  const results = new Map<string, SeasonResult>();

  for (const hd of humanData) {
    const myIdx = allTeams.findIndex(t => t.name === hd.teamName);
    const opponents = allTeams.filter((_, i) => i !== myIdx);

    // Per-player seed for goal scorer assignment, sub selection
    const playerSeed = hd.squad.reduce((acc, p) => acc + p.overall * 7 + p.name.length * 13, 42 + seasonNumber * 100);
    const playerRng = createRng(playerSeed);

    const subAppearances: Record<string, number> = {};
    for (const s of hd.subs) subAppearances[s.name] = 0;

    // Bench GK excluded from PL/cup rotation — only plays when starting GK is injured
    const plBenchGk = hd.subs.find(p => classifyPosition(p.assignedPosition) === 'GK');

    // Build 38 matches from the shared round-robin schedule
    const matches: MatchResult[] = [];
    const matchSubSets: Set<string>[] = [];
    for (let mw = 0; mw < 38; mw++) {
      const round = fullSchedule[mw];
      const fixture = round.find(f => f.home === myIdx || f.away === myIdx)!;
      const isHome = fixture.home === myIdx;
      const oppIdx = isHome ? fixture.away : fixture.home;
      const oppName = allTeams[oppIdx].name;
      // Always advance RNG for bench GK to keep deterministic seed stream, but don't include them
      const activeSubs = hd.subs.filter(s => { const r = playerRng(); return s !== plBenchGk && r < 0.6; });
      const matchPlayers = [...hd.starters, ...activeSubs];
      if (isHome) {
        const sc = matchScores[myIdx][oppIdx];
        matches.push(buildMatchFromScoreline(matchPlayers, sc.homeGoals, sc.awayGoals, oppName, true, playerRng));
      } else {
        const sc = matchScores[oppIdx][myIdx];
        matches.push(buildMatchFromScoreline(matchPlayers, sc.awayGoals, sc.homeGoals, oppName, false, playerRng));
      }
      matchSubSets.push(new Set(activeSubs.map(s => s.name)));
      for (const s of activeSubs) subAppearances[s.name]++;
    }

    // FA Cup and League Cup from shared simulations (same bracket/winner for all players)
    const faCup = sharedFaCupResultsMap.get(hd.userId) ?? { matches: [], winner: false, exitRound: 'Round of 32', faCupWinner: sharedFaCupWinner };
    const leagueCupShared = sharedLeagueCupResultsMap.get(hd.userId);
    const leagueCup = leagueCupShared ?? simulateLeagueCup(hd.starters, hd.ratings, allCupTeams.slice(0, 32), playerRng, hd.teamName);
    const ucl = sharedUCLResults.get(hd.userId);
    const uel = sharedUELResults.get(hd.userId);

    // Player stats
    const statsMap: Record<string, PlayerStats> = {};
    for (const p of hd.starters) {
      statsMap[p.name] = { name: p.name, assignedPosition: p.assignedPosition, goals: 0, assists: 0, cleanSheets: 0, appearances: 38, avgRating: 0, image_url: p.image_url ?? null };
    }
    for (const p of hd.subs) {
      statsMap[p.name] = { name: p.name, assignedPosition: p.assignedPosition, goals: 0, assists: 0, cleanSheets: 0, appearances: subAppearances[p.name] || 0, avgRating: 0, image_url: p.image_url ?? null };
    }
    const allPlayers = [...hd.starters, ...hd.subs];
    const gk = hd.starters.find(p => classifyPosition(p.assignedPosition) === 'GK');
    const defenders = hd.starters.filter(p => classifyPosition(p.assignedPosition) === 'DEF');
    const defSubs = hd.subs.filter(p => classifyPosition(p.assignedPosition) === 'DEF' || classifyPosition(p.assignedPosition) === 'GK');

    const seasonForm: Record<string, number> = {};
    for (const p of allPlayers) {
      const r = playerRng();
      const ovrF = Math.max(0.5, (90 - p.overall) / 25);
      if (r < 0.08) seasonForm[p.name] = 0.4 * ovrF;
      else if (r < 0.20) seasonForm[p.name] = 0.2 * ovrF;
      else if (r < 0.80) seasonForm[p.name] = (playerRng() * 0.2 - 0.1) * ovrF;
      else if (r < 0.92) seasonForm[p.name] = -0.15 * ovrF;
      else seasonForm[p.name] = -0.3 * ovrF;
    }

    const playerRatingsMap: Record<string, number[]> = {};
    for (const p of allPlayers) playerRatingsMap[p.name] = [];

    for (let mi = 0; mi < matches.length; mi++) {
      const m = matches[mi];
      const subsInMatch = matchSubSets[mi];
      for (const gs of m.goalScorers) { if (statsMap[gs.player]) statsMap[gs.player].goals++; }
      for (const ap of m.assistProviders) { if (statsMap[ap.player]) statsMap[ap.player].assists++; }
      if (m.goalsAgainst === 0) {
        if (gk) statsMap[gk.name].cleanSheets++;
        for (const d of defenders) statsMap[d.name].cleanSheets++;
        for (const s of defSubs) { if (subsInMatch.has(s.name)) statsMap[s.name].cleanSheets++; }
      }
      for (const p of hd.starters) playerRatingsMap[p.name].push(matchRating(p, m, seasonForm[p.name] || 0, playerRng));
      for (const p of hd.subs) { if (subsInMatch.has(p.name)) playerRatingsMap[p.name].push(matchRating(p, m, seasonForm[p.name] || 0, playerRng)); }
    }

    for (const p of allPlayers) {
      const rs = playerRatingsMap[p.name];
      statsMap[p.name].avgRating = rs.length > 0 ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : 6.0;
    }
    const plPlayerStats = Object.values(statsMap).map(s => ({ ...s })).sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));

    const allCompsRatings: Record<string, number[]> = {};
    for (const p of allPlayers) allCompsRatings[p.name] = [...playerRatingsMap[p.name]];
    const cupRng = createRng(playerSeed + 77777);

    const rateMatchForPlayer = (p: DraftPlayer, m: MatchResult) => { allCompsRatings[p.name].push(matchRating(p, m, seasonForm[p.name] || 0, cupRng)); };

    for (const cm of faCup.matches) {
      const mr: MatchResult = { goalScorers: cm.goalScorers, assistProviders: cm.assistProviders, goalsAgainst: cm.goalsAgainst, result: cm.result as 'W' | 'D' | 'L', goalsFor: cm.goalsFor, opponent: cm.opponent, isHome: false };
      for (const p of hd.starters) { statsMap[p.name].appearances++; rateMatchForPlayer(p, mr); }
      for (const gs of cm.goalScorers) { if (statsMap[gs.player]) statsMap[gs.player].goals++; }
      for (const ap of cm.assistProviders) { if (statsMap[ap.player]) statsMap[ap.player].assists++; }
      if (cm.goalsAgainst === 0) { if (gk) statsMap[gk.name].cleanSheets++; for (const d of defenders) statsMap[d.name].cleanSheets++; }
    }

    for (const cm of leagueCup.matches) {
      const mr: MatchResult = { goalScorers: cm.goalScorers, assistProviders: cm.assistProviders, goalsAgainst: cm.goalsAgainst, result: cm.result as 'W' | 'D' | 'L', goalsFor: cm.goalsFor, opponent: cm.opponent, isHome: false };
      for (const p of hd.starters) { statsMap[p.name].appearances++; rateMatchForPlayer(p, mr); }
      for (const gs of cm.goalScorers) { if (statsMap[gs.player]) statsMap[gs.player].goals++; }
      for (const ap of cm.assistProviders) { if (statsMap[ap.player]) statsMap[ap.player].assists++; }
      if (cm.goalsAgainst === 0) { if (gk) statsMap[gk.name].cleanSheets++; for (const d of defenders) statsMap[d.name].cleanSheets++; }
      if (cm.leg2) {
        const mr2: MatchResult = { goalScorers: cm.leg2.goalScorers, assistProviders: [], goalsAgainst: cm.leg2.goalsAgainst, result: cm.result as 'W' | 'D' | 'L', goalsFor: cm.leg2.goalsFor, opponent: cm.opponent, isHome: cm.leg2.isHome };
        for (const p of hd.starters) { statsMap[p.name].appearances++; rateMatchForPlayer(p, mr2); }
        for (const gs of cm.leg2.goalScorers) { if (statsMap[gs.player]) statsMap[gs.player].goals++; }
        if (cm.leg2.goalsAgainst === 0) { if (gk) statsMap[gk.name].cleanSheets++; for (const d of defenders) statsMap[d.name].cleanSheets++; }
      }
    }

    const countUCLMatch = (m: UCLMatch) => {
      const mr: MatchResult = { goalScorers: m.goalScorers, assistProviders: m.assistProviders, goalsAgainst: m.goalsAgainst, result: m.result, goalsFor: m.goalsFor, opponent: m.opponent, isHome: m.isHome };
      for (const p of hd.starters) { statsMap[p.name].appearances++; rateMatchForPlayer(p, mr); }
      for (const gs of m.goalScorers) { if (statsMap[gs.player]) statsMap[gs.player].goals++; }
      for (const ap of m.assistProviders) { if (statsMap[ap.player]) statsMap[ap.player].assists++; }
      if (m.goalsAgainst === 0) { if (gk) statsMap[gk.name].cleanSheets++; for (const d of defenders) statsMap[d.name].cleanSheets++; }
    };
    if (ucl?.qualified) {
      for (const m of ucl.leagueMatches) countUCLMatch(m);
      for (const tie of ucl.knockoutTies) { countUCLMatch(tie.leg1); if (tie.leg2) countUCLMatch(tie.leg2); }
    }
    if (uel?.qualified) {
      for (const m of uel.leagueMatches) countUCLMatch(m);
      for (const tie of uel.knockoutTies) { countUCLMatch(tie.leg1); if (tie.leg2) countUCLMatch(tie.leg2); }
    }

    for (const p of allPlayers) {
      const rs = allCompsRatings[p.name];
      statsMap[p.name].avgRating = rs.length > 0 ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : 6.0;
    }
    const playerStats = Object.values(statsMap).sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists));

    // Team record
    const wins = matches.filter(m => m.result === 'W').length;
    const draws = matches.filter(m => m.result === 'D').length;
    const losses = matches.filter(m => m.result === 'L').length;
    const goalsFor = matches.reduce((s, m) => s + m.goalsFor, 0);
    const goalsAgainst = matches.reduce((s, m) => s + m.goalsAgainst, 0);
    const points = wins * 3 + draws;

    // Shared table with isPlayer flag for this human
    const leagueTable = sharedTable.map(t => ({ ...t, isPlayer: t.name === hd.teamName }));
    const actualFinish = leagueTable.findIndex(t => t.isPlayer) + 1;

    const allTeamsForProjection = allTeams.map(t => ({ name: t.name, strength: t.ratings.teamStrength }));
    const projectedFinish = calculateProjectedFinish(hd.ratings.teamStrength, allTeamsForProjection);
    const diff = projectedFinish - actualFinish;
    const performance: 'OVERPERFORMED' | 'AS EXPECTED' | 'UNDERPERFORMED' = diff >= 3 ? 'OVERPERFORMED' : diff <= -3 ? 'UNDERPERFORMED' : 'AS EXPECTED';

    const topScorer = [...playerStats].sort((a, b) => b.goals - a.goals)[0];
    const topAssister = [...playerStats].sort((a, b) => b.assists - a.assists)[0];
    const topGk = gk ? statsMap[gk.name] : playerStats[0];
    const pots = [...playerStats].sort((a, b) => b.avgRating - a.avgRating)[0];
    const awards = {
      goldenBoot: { name: topScorer.name, goals: topScorer.goals },
      playmaker: { name: topAssister.name, assists: topAssister.assists },
      goldenGlove: { name: topGk.name, cleanSheets: topGk.cleanSheets },
      playerOfSeason: { name: pots.name, avgRating: pots.avgRating },
    };

    // Match highlights
    const winsOnly = matches.filter(m => m.result === 'W');
    let biggestWin = winsOnly.length > 0 ? winsOnly[0] : matches[0];
    for (const m of winsOnly) { if ((m.goalsFor - m.goalsAgainst) > (biggestWin.goalsFor - biggestWin.goalsAgainst)) biggestWin = m; }

    const lossesOnly = matches.filter(m => m.result === 'L');
    let worstDefeat = lossesOnly.length > 0 ? lossesOnly[0] : matches[0];
    for (const m of lossesOnly) { if ((m.goalsAgainst - m.goalsFor) > (worstDefeat.goalsAgainst - worstDefeat.goalsFor)) worstDefeat = m; }

    let highestScoring = matches[0];
    for (const m of matches) { if (m.goalsFor + m.goalsAgainst > highestScoring.goalsFor + highestScoring.goalsAgainst) highestScoring = m; }

    let longestWinStreak = 0, curWin = 0, longestUnbeatenRun = 0, curUnbeaten = 0;
    let trailingWinStreak = 0, trailingUnbeatenRun = 0;
    let trailingWinEnded = false;
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i].result === 'W') { if (!trailingWinEnded) trailingWinStreak++; trailingUnbeatenRun++; }
      else if (matches[i].result === 'D') { trailingWinEnded = true; trailingUnbeatenRun++; }
      else break; // a loss ends both the win streak and the unbeaten run
    }
    for (const m of matches) {
      if (m.result === 'W') { curWin++; longestWinStreak = Math.max(longestWinStreak, curWin); curUnbeaten++; longestUnbeatenRun = Math.max(longestUnbeatenRun, curUnbeaten); }
      else if (m.result === 'D') { curWin = 0; curUnbeaten++; longestUnbeatenRun = Math.max(longestUnbeatenRun, curUnbeaten); }
      else { curWin = 0; curUnbeaten = 0; }
    }
    let leadingWinStreak = 0, leadingUnbeatenRun = 0;
    let leadingWinEnded = false;
    for (const m of matches) {
      if (m.result === 'W') { if (!leadingWinEnded) leadingWinStreak++; leadingUnbeatenRun++; }
      else if (m.result === 'D') { leadingWinEnded = true; leadingUnbeatenRun++; }
      else break; // a loss ends both the win streak and the unbeaten run
    }

    const formatScore = (m: MatchResult) => m.isHome ? `${m.goalsFor}-${m.goalsAgainst}` : `${m.goalsAgainst}-${m.goalsFor}`;

    results.set(hd.userId, {
      matches, playerStats, plPlayerStats, leagueTable,
      teamRecord: { wins, draws, losses, points, goalsFor, goalsAgainst },
      awards,
      biggestWin: { opponent: biggestWin.opponent, score: formatScore(biggestWin) },
      worstDefeat: { opponent: worstDefeat.opponent, score: formatScore(worstDefeat) },
      highestScoring: { opponent: highestScoring.opponent, score: formatScore(highestScoring) },
      longestWinStreak, longestUnbeatenRun, trailingWinStreak, trailingUnbeatenRun, leadingWinStreak, leadingUnbeatenRun,
      projectedFinish, actualFinish, performance,
      phaseRatings: hd.ratings,
      faCup, leagueCup, ucl, uel,
      uclTournamentWinner: ucl?.tournamentWinner || season1UclWinner,
      uelTournamentWinner: uel?.tournamentWinner || season1UelWinner,
      superCup: sharedSuperCupResults.get(hd.userId),
      charityShield: sharedCharityShieldResults.get(hd.userId),
      allFixtures: sharedAllFixtures,
    });
  }

  return results;
}
