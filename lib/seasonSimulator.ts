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

const DEFAULT_PL_TEAMS: { name: string; strength: number }[] = [
  { name: 'Man City', strength: 85 },
  { name: 'Arsenal', strength: 84 },
  { name: 'Liverpool', strength: 83 },
  { name: 'Chelsea', strength: 80 },
  { name: 'Man United', strength: 79 },
  { name: 'Tottenham', strength: 78 },
  { name: 'Newcastle', strength: 78 },
  { name: 'Aston Villa', strength: 77 },
  { name: 'Brighton', strength: 75 },
  { name: 'West Ham', strength: 74 },
  { name: 'Bournemouth', strength: 73 },
  { name: 'Crystal Palace', strength: 73 },
  { name: 'Fulham', strength: 72 },
  { name: 'Brentford', strength: 72 },
  { name: 'Wolves', strength: 71 },
  { name: 'Everton', strength: 70 },
  { name: 'Nottm Forest', strength: 70 },
  { name: 'Leicester', strength: 69 },
  { name: 'Ipswich', strength: 68 },
];

const HOME_ADVANTAGE = 3;

// --- Position classification ---

type PositionRole = 'GK' | 'DEF' | 'MID' | 'ATT';

function classifyPosition(pos: string): PositionRole {
  const p = pos.toUpperCase().trim();
  if (p === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'RWB', 'LWB', 'SW'].includes(p)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'RM', 'LM', 'DM', 'RAM', 'LAM'].includes(p)) return 'MID';
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

  const blend = (statAvg: number) => (statAvg * 0.35 + o * 0.65) * fitness;

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

// --- Main export ---

export function simulateSeason(
  players: DraftPlayer[],
  otherTeams?: { name: string; strength: number }[],
  seasonNumber?: number,
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
  const matches: MatchResult[] = [];
  const matchSubSets: Set<string>[] = [];
  const subAppearances: Record<string, number> = {};
  for (const sub of subs) subAppearances[sub.name] = 0;

  for (const opp of opponents) {
    const homeActiveSubs = subs.filter(() => rng() < 0.6);
    const homePlayers = [...starters, ...homeActiveSubs];
    matches.push(simulateMatch(homePlayers, ratings, opp, true, rng));
    matchSubSets.push(new Set(homeActiveSubs.map(s => s.name)));
    for (const sub of homeActiveSubs) subAppearances[sub.name]++;

    const awayActiveSubs = subs.filter(() => rng() < 0.6);
    const awayPlayers = [...starters, ...awayActiveSubs];
    matches.push(simulateMatch(awayPlayers, ratings, opp, false, rng));
    matchSubSets.push(new Set(awayActiveSubs.map(s => s.name)));
    for (const sub of awayActiveSubs) subAppearances[sub.name]++;
  }

  // Shuffle match order to feel like a real season schedule
  for (let i = matches.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [matches[i], matches[j]] = [matches[j], matches[i]];
    [matchSubSets[i], matchSubSets[j]] = [matchSubSets[j], matchSubSets[i]];
  }

  // FA Cup
  const faCup = simulateFaCup(starters, ratings, opponents, rng);

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

  // Compute avg rating (PL matches only — same for both views)
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

  // Count FA Cup stats (added to all-comps totals)
  for (const cm of faCup.matches) {
    for (const p of starters) statsMap[p.name].appearances++;
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
  };
}
