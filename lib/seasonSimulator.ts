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
}

export interface FaCupResult {
  matches: FaCupMatch[];
  winner: boolean;
  exitRound: string | null;
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
}

export interface UCLResult {
  qualified: boolean;
  leagueMatches: UCLMatch[];
  leaguePosition: number;
  leagueTable: UCLLeagueStanding[];
  knockoutTies: UCLKnockoutTie[];
  winner: boolean;
  exitStage: string | null;
}

export interface PlayerStats {
  name: string;
  assignedPosition: string;
  goals: number;
  assists: number;
  cleanSheets: number;
  appearances: number;
  avgRating: number;
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
    playerOfSeason: { name: string; goals: number; assists: number };
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
  ucl?: UCLResult;
  uel?: UCLResult;
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

export const DEFAULT_PL_TEAMS: { name: string; strength: number }[] = [
  { name: 'Man City', strength: 85 },
  { name: 'Arsenal', strength: 85 },
  { name: 'Liverpool', strength: 83 },
  { name: 'Man United', strength: 82 },
  { name: 'Chelsea', strength: 80 },
  { name: 'Aston Villa', strength: 80 },
  { name: 'Tottenham', strength: 78 },
  { name: 'Newcastle', strength: 78 },
  { name: 'Bournemouth', strength: 76 },
  { name: 'Brighton', strength: 75 },
  { name: 'Crystal Palace', strength: 75 },
  { name: 'Brentford', strength: 75 },
  { name: 'Everton', strength: 75 },
  { name: 'Nottm Forest', strength: 74 },
  { name: 'Fulham', strength: 72 },
  { name: 'Leeds', strength: 72 },
  { name: 'Coventry', strength: 70 },
  { name: 'Ipswich', strength: 68 },
  { name: 'Hull', strength: 68 },
];

// --- UCL team data ---

const UCL_TEAMS: { pot: number; name: string; strength: number }[] = [
  // Pot 1 (7 non-PL slots; PL 1st+2nd fill the other 2)
  { pot: 1, name: 'Real Madrid', strength: 86 },
  { pot: 1, name: 'Bayern Munich', strength: 85 },
  { pot: 1, name: 'PSG', strength: 84 },
  { pot: 1, name: 'Barcelona', strength: 84 },
  { pot: 1, name: 'Inter Milan', strength: 83 },
  { pot: 1, name: 'Borussia Dortmund', strength: 80 },
  { pot: 1, name: 'Celtic', strength: 72 },
  // Pot 2 (8 non-PL slots; PL 3rd fills the other 1)
  { pot: 2, name: 'Atlético Madrid', strength: 82 },
  { pot: 2, name: 'Bayer Leverkusen', strength: 81 },
  { pot: 2, name: 'Juventus', strength: 80 },
  { pot: 2, name: 'Benfica', strength: 78 },
  { pot: 2, name: 'Roma', strength: 77 },
  { pot: 2, name: 'Villarreal', strength: 76 },
  { pot: 2, name: 'Eintracht Frankfurt', strength: 76 },
  { pot: 2, name: 'Club Brugge', strength: 73 },
  // Pot 3 (8 non-PL slots; PL 4th fills the other 1)
  { pot: 3, name: 'Napoli', strength: 79 },
  { pot: 3, name: 'Sporting CP', strength: 77 },
  { pot: 3, name: 'PSV Eindhoven', strength: 76 },
  { pot: 3, name: 'Marseille', strength: 76 },
  { pot: 3, name: 'Ajax', strength: 75 },
  { pot: 3, name: 'Olympiacos', strength: 72 },
  { pot: 3, name: 'Slavia Prague', strength: 70 },
  { pot: 3, name: 'Bodø/Glimt', strength: 68 },
  // Pot 4 (8 non-PL slots; PL 5th fills the other 1)
  { pot: 4, name: 'Athletic Bilbao', strength: 77 },
  { pot: 4, name: 'Monaco', strength: 76 },
  { pot: 4, name: 'Galatasaray', strength: 74 },
  { pot: 4, name: 'Copenhagen', strength: 71 },
  { pot: 4, name: 'Union Saint-Gilloise', strength: 69 },
  { pot: 4, name: 'Como', strength: 68 },
  { pot: 4, name: 'Qarabağ', strength: 65 },
  { pot: 4, name: 'Pafos', strength: 63 },
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

function positionFitness(player: DraftPlayer): number {
  const assigned = player.assignedPosition.toUpperCase().trim();
  const natural = (player.positions || '').split(',').map(p => p.trim().toUpperCase()).filter(Boolean);

  if (natural.length === 0) return 1.0;

  if (natural.includes(assigned)) return 1.0;

  const assignedRole = classifyPosition(assigned);
  if (natural.some(p => classifyPosition(p) === assignedRole)) return 0.92;

  const mediumPairs: [string[], string[]][] = [
    [['LB', 'LWB'], ['LM']],
    [['RB', 'RWB'], ['RM']],
    [['CDM', 'DM'], ['CB']],
  ];
  for (const [groupA, groupB] of mediumPairs) {
    if (groupA.includes(assigned) && natural.some(p => groupB.includes(p))) return 0.77;
    if (groupB.includes(assigned) && natural.some(p => groupA.includes(p))) return 0.77;
  }

  const adjacent: Record<PositionRole, PositionRole[]> = {
    ATT: ['MID'],
    MID: ['ATT', 'DEF'],
    DEF: ['MID'],
    GK: [],
  };
  if (natural.some(p => adjacent[assignedRole]?.includes(classifyPosition(p)))) return 0.70;

  return 0.4;
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
    const fin = a.finishing > 0 ? a.finishing : sho;
    const pos = a.positioning > 0 ? a.positioning : sho * 0.7;
    const head = a.heading > 0 ? a.heading : o * 0.5;

    switch (role) {
      case 'ATT':
        return (fin * 3 + pos * 2 + sho * 1.5 + head * 0.8 + statOr(a.pace, o) * 0.5) * fit * qualityMult / 80;
      case 'MID':
        return ((statOr(a.longShots, o) || sho * 0.7) * 1.5 + sho * 1 + pos * 0.5 + head * 0.3) * fit * qualityMult / 150;
      case 'DEF':
        return (head * 1.2 + sho * 0.3 + statOr(a.physical, o) * 0.2) * fit * qualityMult / 600;
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
  const fit = positionFitness(p);

  if (hasAttrs(p)) {
    const a = p.attrs;
    const o = p.overall;
    const pas = statOr(a.passing, o);
    const vis = a.vision > 0 ? a.vision : pas * 0.8;
    const cross = a.crossing > 0 ? a.crossing : pas * 0.7;
    const sp = a.shortPassing > 0 ? a.shortPassing : pas;
    const lp = a.longPassing > 0 ? a.longPassing : pas * 0.7;

    const baseW = (vis * 2 + cross * 1.5 + sp * 1 + lp * 0.5) / 5;
    const roleMult: Record<PositionRole, number> = { ATT: 1.0, MID: 1.3, DEF: 0.4, GK: 0.02 };
    return baseW * roleMult[role] * fit / 10;
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
  const base = 1.3;
  const xg = base + diff * 0.04;
  return Math.max(0.15, Math.min(4.5, xg));
}

// --- Match simulation ---

function simulateMatch(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  opponent: { name: string; strength: number },
  isHome: boolean,
  rng: () => number,
): MatchResult {
  const homeBonus = isHome ? HOME_ADVANTAGE : 0;
  const awayPenalty = isHome ? 0 : HOME_ADVANTAGE;

  const myAttack = ratings.attack + homeBonus * 0.6;
  const myMidfield = ratings.midfield + homeBonus * 0.4;
  const myDefense = ratings.defense + homeBonus * 0.3;
  const myGk = ratings.gk;

  const oppStrength = opponent.strength + awayPenalty;
  const oppDefPower = oppStrength;
  const oppAtkPower = oppStrength;

  const myXg = computeExpectedGoals(myAttack, myMidfield, oppDefPower);

  const ourDefensivePower = myDefense * 0.55 + myGk * 0.30 + myMidfield * 0.15;
  const oppXg = computeExpectedGoals(oppAtkPower, oppStrength * 0.95, ourDefensivePower);

  const goalsFor = poisson(myXg, rng);
  const goalsAgainst = poisson(oppXg, rng);

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
): { homeGoals: number; awayGoals: number } {
  const homeEff = home.strength + HOME_ADVANTAGE;
  const awayEff = away.strength;

  const homeXg = computeExpectedGoals(homeEff, homeEff * 0.95, awayEff);
  const awayXg = computeExpectedGoals(awayEff, awayEff * 0.95, homeEff);

  return {
    homeGoals: poisson(homeXg, rng),
    awayGoals: poisson(awayXg, rng),
  };
}

// --- League simulation ---

function simulateLeague(
  playerTeamName: string,
  playerTeamStrength: number,
  opponents: { name: string; strength: number }[],
  playerMatches: MatchResult[],
  rng: () => number,
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
      const { homeGoals, awayGoals } = simulateNeutralMatch(home, away, rng);

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

const FA_CUP_ROUNDS = ['Round 3', 'Round 4', 'Round 5', 'Quarter-Final', 'Semi-Final', 'Final'];
const BIG_CLUBS = ['Liverpool', 'Man City', 'Man United', 'Arsenal', 'Chelsea'];

function simulateFaCup(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  opponents: { name: string; strength: number }[],
  rng: () => number,
): FaCupResult {
  const matches: FaCupMatch[] = [];

  for (let round = 0; round < 6; round++) {
    const roundName = FA_CUP_ROUNDS[round];
    let opponent: { name: string; strength: number };

    if (round === 5) {
      // Final: 75% chance of a big club
      if (rng() < 0.75) {
        const bigName = BIG_CLUBS[Math.floor(rng() * BIG_CLUBS.length)];
        opponent = opponents.find(o => o.name === bigName) ?? opponents[0];
      } else {
        opponent = opponents[Math.floor(rng() * opponents.length)];
      }
    } else {
      opponent = opponents[Math.floor(rng() * opponents.length)];
    }

    const isHome = round < 5 ? rng() > 0.5 : false;
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

    const goalScorers: { player: string; minute: number }[] = [];
    const assistProviders: { player: string; minute: number }[] = [];

    const cupPenaltyTaker = [...players]
      .sort((a, b) => goalScoringWeight(b) - goalScoringWeight(a))[0];

    for (let i = 0; i < goalsFor; i++) {
      const minute = Math.floor(rng() * 90) + 1;
      const isPenalty = rng() < 0.10;
      const scorer = isPenalty ? cupPenaltyTaker : weightedPick(players, goalScoringWeight, rng);
      goalScorers.push({ player: scorer.name, minute });
      if (!isPenalty && rng() < 0.75) {
        const eligible = players.filter(p => p.name !== scorer.name);
        if (eligible.length > 0) {
          assistProviders.push({ player: weightedPick(eligible, assistWeight, rng).name, minute });
        }
      }
    }

    if (goalsFor === goalsAgainst) {
      extraTime = true;
      const etMyXg = myXg * 0.33;
      const etOppXg = oppXg * 0.33;
      const etFor = poisson(etMyXg, rng);
      const etAgainst = poisson(etOppXg, rng);
      goalsFor += etFor;
      goalsAgainst += etAgainst;

      for (let i = 0; i < etFor; i++) {
        const minute = 90 + Math.floor(rng() * 30) + 1;
        const isPenalty = rng() < 0.10;
        const scorer = isPenalty ? cupPenaltyTaker : weightedPick(players, goalScoringWeight, rng);
        goalScorers.push({ player: scorer.name, minute });
        if (!isPenalty && rng() < 0.75) {
          const eligible = players.filter(p => p.name !== scorer.name);
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
          penaltyScore = rng() > 0.5
            ? { player: myPens + 1, opponent: oppPens }
            : { player: myPens, opponent: oppPens + 1 };
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

    matches.push({
      round: roundName,
      opponent: opponent.name,
      goalsFor,
      goalsAgainst,
      extraTime,
      penalties,
      penaltyScore,
      goalScorers,
      assistProviders,
      result,
    });

    if (result === 'L') {
      return { matches, winner: false, exitRound: roundName };
    }
  }

  return { matches, winner: true, exitRound: null };
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
): UCLResult {
  const playerTeamName = 'Knowitball FC';
  const playerFinish = previousLeagueTable.findIndex(t => t.isPlayer) + 1;

  if (playerFinish < 1 || playerFinish > 5) {
    return {
      qualified: false, leagueMatches: [], leaguePosition: 0,
      leagueTable: [], knockoutTies: [], winner: false, exitStage: null,
    };
  }

  const potForFinish = (f: number) => f <= 2 ? 1 : f === 3 ? 2 : f === 4 ? 3 : 4;
  const playerPot = potForFinish(playerFinish);

  // Build 4 pots of 9 teams each
  const pots: { name: string; strength: number; isPlayer: boolean }[][] = [[], [], [], []];
  pots[playerPot - 1].push({ name: playerTeamName, strength: ratings.teamStrength, isPlayer: true });

  // Add other PL qualifiers (top 5 excluding player)
  const opponentMap = new Map(opponents.map(o => [o.name, o.strength]));
  let plAdded = 0;
  for (let i = 0; i < previousLeagueTable.length && plAdded < 4; i++) {
    const team = previousLeagueTable[i];
    if (team.isPlayer) continue;
    if (i + 1 > 5) break;
    const strength = opponentMap.get(team.name) || 75;
    const pot = potForFinish(i + 1);
    pots[pot - 1].push({ name: team.name, strength, isPlayer: false });
    plAdded++;
  }

  // Fill pots with UCL non-PL teams
  for (const uclTeam of UCL_TEAMS) {
    if (pots[uclTeam.pot - 1].length < 9) {
      pots[uclTeam.pot - 1].push({ name: uclTeam.name, strength: uclTeam.strength, isPlayer: false });
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
      isPlayer: team.isPlayer,
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

  if (leaguePosition > 24) {
    return {
      qualified: true, leagueMatches, leaguePosition, leagueTable,
      knockoutTies: [], winner: false, exitStage: 'League Phase',
    };
  }

  // --- Knockout phase ---
  const knockoutTies: UCLKnockoutTie[] = [];
  const eliminatedTeams = new Set<string>();

  // Round of 32 (positions 9–24, paired: 9th vs 24th, 10th vs 23rd, etc.)
  if (leaguePosition >= 9) {
    const r32OppPos = 33 - leaguePosition;
    const r32Opp = leagueTable[r32OppPos - 1];
    const r32Str = strengthMap.get(r32Opp.name) || 75;
    const r32 = simulateUCLKnockoutTie('Round of 32', r32Opp.name, r32Str, players, ratings, rng, false);
    knockoutTies.push(r32);
    eliminatedTeams.add(r32Opp.name);
    if (r32.result === 'L') {
      return { qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies, winner: false, exitStage: 'Round of 32' };
    }
  }

  // Round of 16
  const r16Pool = leagueTable.filter(t => !t.isPlayer && !eliminatedTeams.has(t.name)).slice(0, 16);
  const r16Opp = r16Pool[Math.floor(rng() * r16Pool.length)];
  const r16Str = strengthMap.get(r16Opp.name) || 75;
  const r16 = simulateUCLKnockoutTie('Round of 16', r16Opp.name, r16Str, players, ratings, rng, false);
  knockoutTies.push(r16);
  eliminatedTeams.add(r16Opp.name);
  if (r16.result === 'L') {
    return { qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies, winner: false, exitStage: 'Round of 16' };
  }

  // Quarter-Final
  const qfPool = leagueTable.filter(t => !t.isPlayer && !eliminatedTeams.has(t.name)).slice(0, 8);
  const qfOpp = qfPool[Math.floor(rng() * qfPool.length)];
  const qfStr = strengthMap.get(qfOpp.name) || 75;
  const qf = simulateUCLKnockoutTie('Quarter-Final', qfOpp.name, qfStr, players, ratings, rng, false);
  knockoutTies.push(qf);
  eliminatedTeams.add(qfOpp.name);
  if (qf.result === 'L') {
    return { qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies, winner: false, exitStage: 'Quarter-Final' };
  }

  // Semi-Final
  const sfPool = leagueTable.filter(t => !t.isPlayer && !eliminatedTeams.has(t.name)).slice(0, 4);
  const sfOpp = sfPool[Math.floor(rng() * sfPool.length)];
  const sfStr = strengthMap.get(sfOpp.name) || 75;
  const sf = simulateUCLKnockoutTie('Semi-Final', sfOpp.name, sfStr, players, ratings, rng, false);
  knockoutTies.push(sf);
  eliminatedTeams.add(sfOpp.name);
  if (sf.result === 'L') {
    return { qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies, winner: false, exitStage: 'Semi-Final' };
  }

  // Final (single match)
  const finalPool = leagueTable.filter(t => !t.isPlayer && !eliminatedTeams.has(t.name)).slice(0, 3);
  const finalOpp = finalPool[Math.floor(rng() * finalPool.length)];
  const finalStr = strengthMap.get(finalOpp.name) || 75;
  const final_ = simulateUCLKnockoutTie('Final', finalOpp.name, finalStr, players, ratings, rng, true);
  knockoutTies.push(final_);

  return {
    qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies,
    winner: final_.result === 'W',
    exitStage: final_.result === 'L' ? 'Final' : null,
  };
}

function simulateEuropaLeague(
  players: DraftPlayer[],
  ratings: PhaseRatings,
  previousLeagueTable: LeagueTeam[],
  opponents: { name: string; strength: number }[],
  rng: () => number,
): UCLResult {
  const playerTeamName = 'Knowitball FC';
  const playerFinish = previousLeagueTable.findIndex(t => t.isPlayer) + 1;

  if (playerFinish < 6 || playerFinish > 7) {
    return {
      qualified: false, leagueMatches: [], leaguePosition: 0,
      leagueTable: [], knockoutTies: [], winner: false, exitStage: null,
    };
  }

  const playerPot = playerFinish === 6 ? 1 : 2;

  const pots: { name: string; strength: number; isPlayer: boolean }[][] = [[], [], [], []];
  pots[playerPot - 1].push({ name: playerTeamName, strength: ratings.teamStrength, isPlayer: true });

  const opponentMap = new Map(opponents.map(o => [o.name, o.strength]));
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
      isPlayer: team.isPlayer,
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

  if (leaguePosition > 24) {
    return {
      qualified: true, leagueMatches, leaguePosition, leagueTable,
      knockoutTies: [], winner: false, exitStage: 'League Phase',
    };
  }

  const knockoutTies: UCLKnockoutTie[] = [];
  const eliminatedTeams = new Set<string>();

  if (leaguePosition >= 9) {
    const r32OppPos = 33 - leaguePosition;
    const r32Opp = leagueTable[r32OppPos - 1];
    const r32Str = strengthMap.get(r32Opp.name) || 70;
    const r32 = simulateUCLKnockoutTie('Round of 32', r32Opp.name, r32Str, players, ratings, rng, false);
    knockoutTies.push(r32);
    eliminatedTeams.add(r32Opp.name);
    if (r32.result === 'L') {
      return { qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies, winner: false, exitStage: 'Round of 32' };
    }
  }

  const r16Pool = leagueTable.filter(t => !t.isPlayer && !eliminatedTeams.has(t.name)).slice(0, 16);
  const r16Opp = r16Pool[Math.floor(rng() * r16Pool.length)];
  const r16Str = strengthMap.get(r16Opp.name) || 70;
  const r16 = simulateUCLKnockoutTie('Round of 16', r16Opp.name, r16Str, players, ratings, rng, false);
  knockoutTies.push(r16);
  eliminatedTeams.add(r16Opp.name);
  if (r16.result === 'L') {
    return { qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies, winner: false, exitStage: 'Round of 16' };
  }

  const qfPool = leagueTable.filter(t => !t.isPlayer && !eliminatedTeams.has(t.name)).slice(0, 8);
  const qfOpp = qfPool[Math.floor(rng() * qfPool.length)];
  const qfStr = strengthMap.get(qfOpp.name) || 70;
  const qf = simulateUCLKnockoutTie('Quarter-Final', qfOpp.name, qfStr, players, ratings, rng, false);
  knockoutTies.push(qf);
  eliminatedTeams.add(qfOpp.name);
  if (qf.result === 'L') {
    return { qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies, winner: false, exitStage: 'Quarter-Final' };
  }

  const sfPool = leagueTable.filter(t => !t.isPlayer && !eliminatedTeams.has(t.name)).slice(0, 4);
  const sfOpp = sfPool[Math.floor(rng() * sfPool.length)];
  const sfStr = strengthMap.get(sfOpp.name) || 70;
  const sf = simulateUCLKnockoutTie('Semi-Final', sfOpp.name, sfStr, players, ratings, rng, false);
  knockoutTies.push(sf);
  eliminatedTeams.add(sfOpp.name);
  if (sf.result === 'L') {
    return { qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies, winner: false, exitStage: 'Semi-Final' };
  }

  const finalPool = leagueTable.filter(t => !t.isPlayer && !eliminatedTeams.has(t.name)).slice(0, 3);
  const finalOpp = finalPool[Math.floor(rng() * finalPool.length)];
  const finalStr = strengthMap.get(finalOpp.name) || 70;
  const final_ = simulateUCLKnockoutTie('Final', finalOpp.name, finalStr, players, ratings, rng, true);
  knockoutTies.push(final_);

  return {
    qualified: true, leagueMatches, leaguePosition, leagueTable, knockoutTies,
    winner: final_.result === 'W',
    exitStage: final_.result === 'L' ? 'Final' : null,
  };
}

// --- Main export ---

export function simulateSeason(
  players: DraftPlayer[],
  otherTeams?: { name: string; strength: number }[],
  seasonNumber?: number,
  previousLeagueTable?: LeagueTeam[],
): SeasonResult {
  const seasonSeed = (seasonNumber ?? 1) * 100;
  const seed = players.reduce((acc, p) => acc + p.overall * 7 + p.name.length * 13, 42 + seasonSeed);
  const rng = createRng(seed);

  const starters = players.filter(p => !p.isSub);
  const subs = players.filter(p => p.isSub);

  const opponents = otherTeams && otherTeams.length === 19
    ? otherTeams
    : DEFAULT_PL_TEAMS;

  const ratings = computePhaseRatings(starters);

  const playerTeamName = 'Knowitball FC';

  // Simulate 38 matches (home and away vs each opponent)
  // Structured as two halves: MW 1-19 and MW 20-38
  const subAppearances: Record<string, number> = {};
  for (const sub of subs) subAppearances[sub.name] = 0;

  // First half: one match per opponent, randomly home or away
  const firstHalf: MatchResult[] = [];
  const firstHalfSubs: Set<string>[] = [];
  for (const opp of opponents) {
    const isHome = rng() > 0.5;
    const activeSubs = subs.filter(() => rng() < 0.6);
    const matchPlayers = [...starters, ...activeSubs];
    firstHalf.push(simulateMatch(matchPlayers, ratings, opp, isHome, rng));
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
    const activeSubs = subs.filter(() => rng() < 0.6);
    const matchPlayers = [...starters, ...activeSubs];
    secondHalf.push(simulateMatch(matchPlayers, ratings, opp, isHome, rng));
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

  // FA Cup
  const faCup = simulateFaCup(starters, ratings, opponents, rng);

  // Champions League / Europa League (if qualified from previous season)
  let ucl: UCLResult | undefined;
  let uel: UCLResult | undefined;
  if (previousLeagueTable) {
    ucl = simulateChampionsLeague(players, ratings, previousLeagueTable, opponents, rng);
    if (!ucl.qualified) {
      uel = simulateEuropaLeague(players, ratings, previousLeagueTable, opponents, rng);
    }
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
    };
  }

  const allPlayers = [...starters, ...subs];
  const gk = starters.find(p => classifyPosition(p.assignedPosition) === 'GK');
  const defenders = starters.filter(p => classifyPosition(p.assignedPosition) === 'DEF');
  const defSubs = subs.filter(p => classifyPosition(p.assignedPosition) === 'DEF' || classifyPosition(p.assignedPosition) === 'GK');

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

    for (const gs of m.goalScorers) {
      if (statsMap[gs.player]) statsMap[gs.player].goals++;
    }
    for (const ap of m.assistProviders) {
      if (statsMap[ap.player]) statsMap[ap.player].assists++;
    }
    if (m.goalsAgainst === 0) {
      if (gk) statsMap[gk.name].cleanSheets++;
      for (const def of defenders) {
        statsMap[def.name].cleanSheets++;
      }
      for (const sub of defSubs) {
        if (subsInMatch.has(sub.name)) statsMap[sub.name].cleanSheets++;
      }
    }

    for (const p of starters) {
      playerRatings[p.name].push(matchRating(p, m, seasonForm[p.name] || 0, rng));
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

  // Count FA Cup stats (added to all-comps totals)
  for (const cm of faCup.matches) {
    const matchForRating = { goalScorers: cm.goalScorers, assistProviders: cm.assistProviders, goalsAgainst: cm.goalsAgainst, result: cm.result as 'W' | 'D' | 'L', goalsFor: cm.goalsFor, opponent: cm.opponent, isHome: false };
    for (const p of starters) {
      statsMap[p.name].appearances++;
      rateMatchForPlayer(p, matchForRating);
    }
    for (const gs of cm.goalScorers) {
      if (statsMap[gs.player]) statsMap[gs.player].goals++;
    }
    for (const ap of cm.assistProviders) {
      if (statsMap[ap.player]) statsMap[ap.player].assists++;
    }
    if (cm.goalsAgainst === 0) {
      if (gk) statsMap[gk.name].cleanSheets++;
      for (const def of defenders) {
        statsMap[def.name].cleanSheets++;
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
  const leagueTable = simulateLeague(
    playerTeamName,
    ratings.teamStrength,
    opponents,
    matches,
    rng,
  );

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
  const pots = [...playerStats].sort(
    (a, b) => (b.goals + b.assists) - (a.goals + a.assists),
  )[0];

  const awards = {
    goldenBoot: { name: topScorer.name, goals: topScorer.goals },
    playmaker: { name: topAssister.name, assists: topAssister.assists },
    goldenGlove: { name: topGk.name, cleanSheets: topGk.cleanSheets },
    playerOfSeason: { name: pots.name, goals: pots.goals, assists: pots.assists },
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
    ucl,
    uel,
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
  const playerTeamName = 'Knowitball FC';

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

    for (const opp of opponents) {
      const homeActiveSubs = subs.filter(() => rng() < 0.6);
      const homePlayers = [...starters, ...homeActiveSubs];
      matches.push(simulateMatch(homePlayers, ratings, opp, true, rng));

      const awayActiveSubs = subs.filter(() => rng() < 0.6);
      const awayPlayers = [...starters, ...awayActiveSubs];
      matches.push(simulateMatch(awayPlayers, ratings, opp, false, rng));
    }

    // Shuffle
    for (let i = matches.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [matches[i], matches[j]] = [matches[j], matches[i]];
    }

    const wins = matches.filter(m => m.result === 'W').length;
    const draws = matches.filter(m => m.result === 'D').length;
    const points = wins * 3 + draws;

    const leagueTable = simulateLeague(playerTeamName, ratings.teamStrength, opponents, matches, rng);
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
    winLeague: Math.round((winCount / simCount) * 100),
    top4: Math.round((top4Count / simCount) * 100),
    top7: Math.round((top7Count / simCount) * 100),
    relegation: Math.round((relegationCount / simCount) * 100),
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
  const ratings = computePhaseRatings(starters.length > 0 ? starters : players);
  const total = players.reduce((sum, p) => sum + (Number(p.overall) || 70), 0);
  const avgOvr = Math.round(total / (players.length || 1));
  return { teamStrength: Math.round(ratings.teamStrength * 10) / 10, avgOvr };
}

// --- Shared league simulation (multiplayer: all teams play in the same league) ---

// Simulate a match scoreline using full phase ratings for both teams
function simulateScoreline(
  homeRat: PhaseRatings,
  awayRat: PhaseRatings,
  rng: () => number,
): { homeGoals: number; awayGoals: number } {
  const ha = HOME_ADVANTAGE;
  const hAtk = homeRat.attack + ha * 0.6;
  const hMid = homeRat.midfield + ha * 0.4;
  const hDef = homeRat.defense + ha * 0.3;
  const hGk  = homeRat.gk;
  const aAtk = awayRat.attack;
  const aMid = awayRat.midfield;
  const aDef = awayRat.defense;
  const aGk  = awayRat.gk;

  const hDefPower = hDef * 0.55 + hGk * 0.30 + hMid * 0.15;
  const aDefPower = aDef * 0.55 + aGk * 0.30 + aMid * 0.15;

  const homeXg = computeExpectedGoals(hAtk, hMid, aDefPower);
  const awayXg = computeExpectedGoals(aAtk, aMid, hDefPower);

  return { homeGoals: poisson(homeXg, rng), awayGoals: poisson(awayXg, rng) };
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
  squad: DraftPlayer[];
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
): Map<string, SeasonResult> {
  const sharedRng = createRng(sharedSeed);

  // Compute phase ratings for every human team
  const humanData = humanTeams.map(ht => {
    const starters = ht.squad.filter(p => !p.isSub);
    const subs     = ht.squad.filter(p => p.isSub);
    return {
      ...ht,
      teamName: `${ht.displayName}'s XI`,
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

  // Simulate ALL match scorelines with the shared RNG
  // matchScores[i][j] = { homeGoals, awayGoals } when team i plays at home vs team j
  const matchScores: { homeGoals: number; awayGoals: number }[][] = Array.from({ length: N }, () => new Array(N).fill(null));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      matchScores[i][j] = simulateScoreline(allTeams[i].ratings, allTeams[j].ratings, sharedRng);
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
    // Match: rotating[i] vs rotating[N-2-i] for i = 1..N/2-1
    for (let i = 1; i < N / 2; i++) {
      if (sharedRng() > 0.5) {
        round.push({ home: rotating[i], away: rotating[N - 2 - i] });
      } else {
        round.push({ home: rotating[N - 2 - i], away: rotating[i] });
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

  // Build SeasonResult for each human team
  const results = new Map<string, SeasonResult>();

  for (const hd of humanData) {
    const myIdx = allTeams.findIndex(t => t.name === hd.teamName);
    const opponents = allTeams.filter((_, i) => i !== myIdx);

    // Per-player seed for goal scorer assignment, sub selection, FA Cup/UCL/UEL
    const playerSeed = hd.squad.reduce((acc, p) => acc + p.overall * 7 + p.name.length * 13, 42 + seasonNumber * 100);
    const playerRng = createRng(playerSeed);

    const subAppearances: Record<string, number> = {};
    for (const s of hd.subs) subAppearances[s.name] = 0;

    // Build 38 matches from the shared round-robin schedule
    const matches: MatchResult[] = [];
    const matchSubSets: Set<string>[] = [];
    for (let mw = 0; mw < 38; mw++) {
      const round = fullSchedule[mw];
      const fixture = round.find(f => f.home === myIdx || f.away === myIdx)!;
      const isHome = fixture.home === myIdx;
      const oppIdx = isHome ? fixture.away : fixture.home;
      const oppName = allTeams[oppIdx].name;
      const activeSubs = hd.subs.filter(() => playerRng() < 0.6);
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

    // FA Cup + European competitions (independent per player)
    const oppForCups = opponents.map(o => ({ name: o.name, strength: o.ratings.teamStrength }));
    const faCup = simulateFaCup(hd.starters, hd.ratings, oppForCups, playerRng);
    const ucl = simulateChampionsLeague(hd.squad, hd.ratings, [], oppForCups, playerRng);
    const uel = !ucl.qualified
      ? simulateEuropaLeague(hd.squad, hd.ratings, [], oppForCups, playerRng)
      : undefined;

    // Player stats
    const statsMap: Record<string, PlayerStats> = {};
    for (const p of hd.starters) {
      statsMap[p.name] = { name: p.name, assignedPosition: p.assignedPosition, goals: 0, assists: 0, cleanSheets: 0, appearances: 38, avgRating: 0 };
    }
    for (const p of hd.subs) {
      statsMap[p.name] = { name: p.name, assignedPosition: p.assignedPosition, goals: 0, assists: 0, cleanSheets: 0, appearances: subAppearances[p.name] || 0, avgRating: 0 };
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
    const pots = [...playerStats].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))[0];
    const awards = {
      goldenBoot: { name: topScorer.name, goals: topScorer.goals },
      playmaker: { name: topAssister.name, assists: topAssister.assists },
      goldenGlove: { name: topGk.name, cleanSheets: topGk.cleanSheets },
      playerOfSeason: { name: pots.name, goals: pots.goals, assists: pots.assists },
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
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i].result === 'W') { trailingWinStreak++; trailingUnbeatenRun++; }
      else if (matches[i].result === 'D') { trailingWinStreak = 0; trailingUnbeatenRun++; }
      else break;
    }
    for (const m of matches) {
      if (m.result === 'W') { curWin++; longestWinStreak = Math.max(longestWinStreak, curWin); curUnbeaten++; longestUnbeatenRun = Math.max(longestUnbeatenRun, curUnbeaten); }
      else if (m.result === 'D') { curWin = 0; curUnbeaten++; longestUnbeatenRun = Math.max(longestUnbeatenRun, curUnbeaten); }
      else { curWin = 0; curUnbeaten = 0; }
    }
    let leadingWinStreak = 0, leadingUnbeatenRun = 0;
    for (const m of matches) {
      if (m.result === 'W') { leadingWinStreak++; leadingUnbeatenRun++; }
      else if (m.result === 'D') { leadingWinStreak = 0; leadingUnbeatenRun++; }
      else break;
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
      faCup, ucl, uel,
    });
  }

  return results;
}
