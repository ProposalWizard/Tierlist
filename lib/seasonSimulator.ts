export interface DraftPlayer {
  name: string;
  overall: number;
  positions: string;
  club: string;
  clubYear: string;
  assignedPosition: string;
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
  highestScoring: { opponent: string; score: string };
  longestWinStreak: number;
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
  if (['CDM', 'CM', 'CAM', 'RM', 'LM', 'DM'].includes(p)) return 'MID';
  return 'ATT';
}

// Scoring weight by role — how likely a player in this role is to score
const GOAL_WEIGHTS: Record<PositionRole, number> = {
  ATT: 10,
  MID: 3,
  DEF: 0.5,
  GK: 0.02,
};

// Assist weight by role
const ASSIST_WEIGHTS: Record<PositionRole, number> = {
  ATT: 5,
  MID: 8,
  DEF: 2,
  GK: 0.1,
};

// --- Helpers ---

function weightedPick(
  players: DraftPlayer[],
  weights: Record<PositionRole, number>,
  rng: () => number,
): DraftPlayer {
  const playerWeights = players.map((p) => {
    const role = classifyPosition(p.assignedPosition);
    // Boost higher-rated players slightly
    const ratingFactor = 0.5 + (p.overall / 99) * 0.5;
    return weights[role] * ratingFactor;
  });

  const total = playerWeights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < players.length; i++) {
    r -= playerWeights[i];
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

// --- Match simulation ---

/**
 * Converts a strength difference into expected goals.
 * A team with +10 strength advantage at home might expect ~2.2 goals,
 * while the weaker team might expect ~0.8.
 *
 * Base expected goals: 1.3 per team (PL average ~1.35 per team).
 * Each point of strength difference shifts ~0.04 expected goals.
 */
function expectedGoals(teamStrength: number, opponentStrength: number): number {
  const diff = teamStrength - opponentStrength;
  const base = 1.3;
  const xg = base + diff * 0.04;
  return Math.max(0.15, xg);
}

function simulateMatch(
  players: DraftPlayer[],
  teamStrength: number,
  opponent: { name: string; strength: number },
  isHome: boolean,
  rng: () => number,
): MatchResult {
  const homeBonus = isHome ? HOME_ADVANTAGE : 0;
  const awayPenalty = isHome ? 0 : HOME_ADVANTAGE;

  const myEffective = teamStrength + homeBonus;
  const oppEffective = opponent.strength + awayPenalty;

  const myXg = expectedGoals(myEffective, oppEffective);
  const oppXg = expectedGoals(oppEffective, myEffective);

  const goalsFor = poisson(myXg, rng);
  const goalsAgainst = poisson(oppXg, rng);

  const goalScorers: { player: string; minute: number }[] = [];
  const assistProviders: { player: string; minute: number }[] = [];

  for (let i = 0; i < goalsFor; i++) {
    const minute = randomMinute(rng);
    const scorer = weightedPick(players, GOAL_WEIGHTS, rng);
    goalScorers.push({ player: scorer.name, minute });

    // 75% chance of an assist on each goal
    if (rng() < 0.75) {
      const eligibleAssisters = players.filter((p) => p.name !== scorer.name);
      if (eligibleAssisters.length > 0) {
        const assister = weightedPick(eligibleAssisters, ASSIST_WEIGHTS, rng);
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

  return {
    opponent: opponent.name,
    isHome,
    goalsFor,
    goalsAgainst,
    goalScorers,
    assistProviders,
    result,
  };
}

// --- Neutral match simulation (for the rest of the league) ---

function simulateNeutralMatch(
  home: { name: string; strength: number },
  away: { name: string; strength: number },
  rng: () => number,
): { homeGoals: number; awayGoals: number } {
  const homeEffective = home.strength + HOME_ADVANTAGE;
  const awayEffective = away.strength;

  const homeXg = expectedGoals(homeEffective, awayEffective);
  const awayXg = expectedGoals(awayEffective, homeEffective);

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

  // Record player team's matches
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

  // Simulate matches between all other teams (home and away)
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

  // Calculate GD and sort
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
  const idx = sorted.findIndex((t) => t.strength <= teamStrength);
  return idx === -1 ? sorted.length : idx + 1;
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

  const teamStrength = Math.round(
    players.reduce((sum, p) => sum + p.overall, 0) / players.length,
  );

  const playerTeamName = 'Your Team';

  // Simulate 38 matches (home and away vs each opponent)
  const matches: MatchResult[] = [];
  for (const opp of opponents) {
    matches.push(simulateMatch(players, teamStrength, opp, true, rng));
    matches.push(simulateMatch(players, teamStrength, opp, false, rng));
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
    };
  }

  const gk = players.find((p) => classifyPosition(p.assignedPosition) === 'GK');

  for (const match of matches) {
    for (const gs of match.goalScorers) {
      if (statsMap[gs.player]) statsMap[gs.player].goals++;
    }
    for (const ap of match.assistProviders) {
      if (statsMap[ap.player]) statsMap[ap.player].assists++;
    }
    if (gk && match.goalsAgainst === 0) {
      statsMap[gk.name].cleanSheets++;
    }
  }

  const playerStats = Object.values(statsMap).sort(
    (a, b) => (b.goals + b.assists) - (a.goals + a.assists),
  );

  // Team record
  const wins = matches.filter((m) => m.result === 'W').length;
  const draws = matches.filter((m) => m.result === 'D').length;
  const losses = matches.filter((m) => m.result === 'L').length;
  const goalsFor = matches.reduce((s, m) => s + m.goalsFor, 0);
  const goalsAgainst = matches.reduce((s, m) => s + m.goalsAgainst, 0);
  const points = wins * 3 + draws;

  const teamRecord = { wins, draws, losses, points, goalsFor, goalsAgainst };

  // League table
  const leagueTable = simulateLeague(
    playerTeamName,
    teamStrength,
    opponents,
    matches,
    rng,
  );

  const actualFinish = leagueTable.findIndex((t) => t.isPlayer) + 1;

  const allTeamsForProjection = [
    { name: playerTeamName, strength: teamStrength },
    ...opponents,
  ];
  const projectedFinish = calculateProjectedFinish(teamStrength, allTeamsForProjection);

  // Performance assessment
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

  // Biggest win (largest GD in your favor)
  let biggestWin = matches[0];
  let biggestWinGd = matches[0].goalsFor - matches[0].goalsAgainst;
  for (const m of matches) {
    const gd = m.goalsFor - m.goalsAgainst;
    if (gd > biggestWinGd || (gd === biggestWinGd && m.goalsFor > biggestWin.goalsFor)) {
      biggestWin = m;
      biggestWinGd = gd;
    }
  }

  // Highest-scoring game (most total goals)
  let highestScoring = matches[0];
  let highestTotal = matches[0].goalsFor + matches[0].goalsAgainst;
  for (const m of matches) {
    const total = m.goalsFor + m.goalsAgainst;
    if (total > highestTotal) {
      highestScoring = m;
      highestTotal = total;
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
    highestScoring: { opponent: highestScoring.opponent, score: formatScore(highestScoring) },
    longestWinStreak,
    projectedFinish,
    actualFinish,
    performance,
  };
}
