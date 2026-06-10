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
  projectedFinish: number;
  actualFinish: number;
  performance: 'OVERPERFORMED' | 'AS EXPECTED' | 'UNDERPERFORMED';
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

  if (natural.includes(assigned)) return 1.0;

  const assignedRole = classifyPosition(assigned);
  if (natural.some(p => classifyPosition(p) === assignedRole)) return 0.92;

  const adjacent: Record<PositionRole, PositionRole[]> = {
    ATT: ['MID'],
    MID: ['ATT', 'DEF'],
    DEF: ['MID'],
    GK: [],
  };
  if (natural.some(p => adjacent[assignedRole]?.includes(classifyPosition(p)))) return 0.78;

  return 0.6;
}

// --- Attribute helpers ---

function hasAttrs(p: DraftPlayer): p is DraftPlayer & { attrs: PlayerAttributes } {
  if (!p.attrs) return false;
  const a = p.attrs;
  return (a.shooting > 0 || a.passing > 0 || a.defending > 0 || a.pace > 0);
}

function playerAttackRating(p: DraftPlayer, fitness: number): number {
  if (hasAttrs(p)) {
    const a = p.attrs;
    const fin = a.finishing || a.shooting;
    const pos = a.positioning || a.shooting * 0.8;
    return (a.shooting * 0.25 + fin * 0.20 + pos * 0.15 + a.pace * 0.15 + a.dribbling * 0.15 + a.physical * 0.10) * fitness;
  }
  return p.overall * fitness;
}

function playerMidfieldRating(p: DraftPlayer, fitness: number): number {
  if (hasAttrs(p)) {
    const a = p.attrs;
    const sp = a.shortPassing || a.passing;
    const vis = a.vision || a.passing * 0.8;
    return (a.passing * 0.25 + sp * 0.15 + vis * 0.15 + a.dribbling * 0.15 + a.shooting * 0.10 + a.defending * 0.10 + a.physical * 0.10) * fitness;
  }
  return p.overall * fitness;
}

function playerDefenseRating(p: DraftPlayer, fitness: number): number {
  if (hasAttrs(p)) {
    const a = p.attrs;
    const tackle = a.standingTackle || a.defending;
    const mark = a.marking || a.defending * 0.9;
    const intc = a.interceptions || a.defending * 0.85;
    return (a.defending * 0.20 + tackle * 0.15 + mark * 0.15 + intc * 0.15 + a.physical * 0.15 + a.pace * 0.10 + a.reactions * 0.10) * fitness;
  }
  return p.overall * fitness;
}

function playerGkRating(p: DraftPlayer, fitness: number): number {
  if (hasAttrs(p)) {
    const a = p.attrs;
    if (a.gkDiving > 0 || a.gkReflexes > 0 || a.gkPositioning > 0) {
      return (a.gkDiving * 0.30 + a.gkReflexes * 0.30 + a.gkPositioning * 0.25 + (a.reactions || p.overall) * 0.15) * fitness;
    }
  }
  return p.overall * fitness;
}

// --- Team phase ratings ---

interface PhaseRatings {
  attack: number;
  midfield: number;
  defense: number;
  gk: number;
  teamStrength: number;
}

function computePhaseRatings(players: DraftPlayer[]): PhaseRatings {
  const byRole: Record<PositionRole, DraftPlayer[]> = { GK: [], DEF: [], MID: [], ATT: [] };
  for (const p of players) {
    byRole[classifyPosition(p.assignedPosition)].push(p);
  }

  const avgRating = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 70;

  const attackRatings = byRole.ATT.map(p => playerAttackRating(p, positionFitness(p)));
  const midAttackContrib = byRole.MID.map(p => playerAttackRating(p, positionFitness(p)) * 0.4);
  const attack = avgRating([...attackRatings, ...midAttackContrib]);

  const midRatings = byRole.MID.map(p => playerMidfieldRating(p, positionFitness(p)));
  const midfield = avgRating(midRatings);

  const defRatings = byRole.DEF.map(p => playerDefenseRating(p, positionFitness(p)));
  const midDefContrib = byRole.MID.map(p => playerDefenseRating(p, positionFitness(p)) * 0.3);
  const defense = avgRating([...defRatings, ...midDefContrib]);

  const gkPlayers = byRole.GK;
  const gk = gkPlayers.length > 0
    ? avgRating(gkPlayers.map(p => playerGkRating(p, positionFitness(p))))
    : 65;

  const teamStrength = attack * 0.30 + midfield * 0.28 + defense * 0.27 + gk * 0.15;

  return { attack, midfield, defense, gk, teamStrength };
}

// --- Goal scoring weights based on attributes ---

function goalScoringWeight(p: DraftPlayer): number {
  const role = classifyPosition(p.assignedPosition);
  const fit = positionFitness(p);

  if (hasAttrs(p)) {
    const a = p.attrs;
    const fin = a.finishing || a.shooting;
    const pos = a.positioning || a.shooting * 0.7;
    const head = a.heading || p.overall * 0.5;

    switch (role) {
      case 'ATT':
        return (fin * 3 + pos * 2 + a.shooting * 1.5 + head * 0.8 + a.pace * 0.5) * fit / 80;
      case 'MID':
        return ((a.longShots || a.shooting * 0.7) * 1.5 + a.shooting * 1 + pos * 0.5 + head * 0.3) * fit / 250;
      case 'DEF':
        return (head * 1.2 + a.shooting * 0.3 + a.physical * 0.2) * fit / 600;
      case 'GK':
        return 0.02;
    }
  }

  const ratingFactor = 0.5 + (p.overall / 99) * 0.5;
  const roleWeights: Record<PositionRole, number> = { ATT: 10, MID: 3, DEF: 0.5, GK: 0.02 };
  return roleWeights[role] * ratingFactor * fit;
}

function assistWeight(p: DraftPlayer): number {
  const role = classifyPosition(p.assignedPosition);
  const fit = positionFitness(p);

  if (hasAttrs(p)) {
    const a = p.attrs;
    const vis = a.vision || a.passing * 0.8;
    const cross = a.crossing || a.passing * 0.7;
    const sp = a.shortPassing || a.passing;
    const lp = a.longPassing || a.passing * 0.7;

    const baseW = (vis * 2 + cross * 1.5 + sp * 1 + lp * 0.5) / 5;
    const roleMult: Record<PositionRole, number> = { ATT: 0.7, MID: 1.3, DEF: 0.4, GK: 0.02 };
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

  for (let i = 0; i < goalsFor; i++) {
    const minute = randomMinute(rng);
    const scorer = weightedPick(players, goalScoringWeight, rng);
    goalScorers.push({ player: scorer.name, minute });

    if (rng() < 0.75) {
      const eligible = players.filter(p => p.name !== scorer.name);
      if (eligible.length > 0) {
        const assister = weightedPick(eligible, assistWeight, rng);
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
  rng: () => number,
): number {
  const role = classifyPosition(player.assignedPosition);
  let base = 6.0 + (rng() * 1.5 - 0.5);

  const scored = match.goalScorers.filter(g => g.player === player.name).length;
  const assisted = match.assistProviders.filter(a => a.player === player.name).length;
  base += scored * 1.0 + assisted * 0.6;

  if (match.goalsAgainst === 0 && (role === 'GK' || role === 'DEF')) {
    base += 0.8;
  }

  if (match.result === 'W') base += 0.3;
  else if (match.result === 'L') base -= 0.3;

  return Math.max(4.0, Math.min(10.0, Math.round(base * 10) / 10));
}

// --- Main export ---

export function simulateSeason(
  players: DraftPlayer[],
  otherTeams?: { name: string; strength: number }[],
): SeasonResult {
  const seed = players.reduce((acc, p) => acc + p.overall * 7 + p.name.length * 13, 42);
  const rng = createRng(seed);

  const opponents = otherTeams && otherTeams.length === 19
    ? otherTeams
    : DEFAULT_PL_TEAMS;

  const ratings = computePhaseRatings(players);

  const playerTeamName = 'Your Team';

  // Simulate 38 matches (home and away vs each opponent)
  const matches: MatchResult[] = [];
  for (const opp of opponents) {
    matches.push(simulateMatch(players, ratings, opp, true, rng));
    matches.push(simulateMatch(players, ratings, opp, false, rng));
  }

  // Shuffle match order to feel like a real season schedule
  for (let i = matches.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [matches[i], matches[j]] = [matches[j], matches[i]];
  }

  // Player stats
  const statsMap: Record<string, PlayerStats> = {};
  for (const p of players) {
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

  const gk = players.find(p => classifyPosition(p.assignedPosition) === 'GK');
  const defenders = players.filter(p => classifyPosition(p.assignedPosition) === 'DEF');

  const playerRatings: Record<string, number[]> = {};
  for (const p of players) playerRatings[p.name] = [];

  for (const m of matches) {
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
    }

    for (const p of players) {
      playerRatings[p.name].push(matchRating(p, m, rng));
    }
  }

  for (const p of players) {
    const ratings = playerRatings[p.name];
    statsMap[p.name].avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
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

  const formatScore = (m: MatchResult) =>
    m.isHome
      ? `${m.goalsFor}-${m.goalsAgainst}`
      : `${m.goalsAgainst}-${m.goalsFor}`;

  return {
    matches,
    playerStats,
    leagueTable,
    teamRecord,
    awards,
    biggestWin: { opponent: biggestWin.opponent, score: formatScore(biggestWin) },
    worstDefeat: { opponent: worstDefeat.opponent, score: formatScore(worstDefeat) },
    highestScoring: { opponent: highestScoring.opponent, score: formatScore(highestScoring) },
    longestWinStreak,
    longestUnbeatenRun,
    projectedFinish,
    actualFinish,
    performance,
  };
}
