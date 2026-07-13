export type BDPosition = 'GK' | 'DEF' | 'MID' | 'ATT';
export type SeasonPhase = 'pre_season' | 'first_half' | 'january' | 'second_half' | 'run_in' | 'ceremony' | 'done';
export type BDArchetype = 'wonderkid' | 'rising_star' | 'world_class' | 'veteran';

export interface BDStats {
  goals: number;
  assists: number;
  appearances: number;
  avgRating: number;
  cleanSheets: number;
  manOfTheMatch: number;
}

export interface BDTrophy {
  name: string;
  bdoBonus: number;
  emoji: string;
}

export interface BDPlayer {
  name: string;
  age: number;
  position: BDPosition;
  overall: number;
  potential: number;
  nationality: string;
  imageUrl?: string;
  isRealPlayer: boolean;
  archetype: BDArchetype;
  reputation: number; // 0-100, grows across career
}

export interface BDClub {
  id: string;
  name: string;
  prestige: number;
  tier: string;
  tierLabel: string;
  clChance: number;
  elChance: number;
  primaryColor: string;
}

export interface BDAttributes {
  fitness: number;
  morale: number;
  fame: number;
}

export interface LeagueTableRow {
  clubId: string;
  name: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
  form: ('W' | 'D' | 'L')[];
  isPlayer: boolean;
}

export interface BDTeammate {
  name: string;
  position: BDPosition;
  role: string;
  goals: number;
  assists: number;
  cleanSheets: number;
  avgRating: number;
  appearances: number;
}

export interface EventChoice {
  id: string;
  label: string;
  emoji: string;
  description?: string;
  hint?: 'safe' | 'risky' | 'selfish' | 'team' | 'media';
  outcome: string;
  effects: Partial<{
    goals: number;
    assists: number;
    cleanSheets: number;
    manOfTheMatch: number;
    avgRating: number;
    appearances: number;
    fitness: number;
    morale: number;
    fame: number;
    overall: number;
    money: number;
    energy: number;
  }>;
}

export interface BDEvent {
  id: string;
  phase: 'pre_season' | 'first_half' | 'january' | 'second_half' | 'run_in';
  category: 'match' | 'career' | 'lifestyle' | 'decision';
  positionFilter?: BDPosition[];
  title: string;
  context: string;
  choices: EventChoice[];
  chosenId?: string;
  outcomeText?: string;
  matchContext?: {
    opponent: string;
    opponentId: string;
    competition: 'Premier League' | 'Champions League' | 'Europa League' | 'FA Cup' | 'Pre-Season';
    isHome: boolean;
    matchweek: number;
    opponentPrestige: number;
    isBigMatch?: boolean;
  };
  matchResult?: {
    teamGoals: number;
    opponentGoals: number;
    isWin: boolean;
    isDraw: boolean;
    playerGoals: number;
    playerAssists: number;
    playerRating: number;
    cleanSheet: boolean;
  };
}

export interface CeremonyEntry {
  rank: number;
  isPlayer: boolean;
  name: string;
  club: string;
  leagueFlag: string;
  position: BDPosition;
  stats: BDStats;
  trophies: BDTrophy[];
  bdoScore: number;
  age?: number;
}

export interface BDOCeremony {
  year: number;
  entries: CeremonyEntry[];
  playerRank: number;
  playerNominated: boolean;
}

export interface TransferOffer {
  clubId: string;
  clubName: string;
  tierLabel: string;
  prestige: number;
  hasCL: boolean;
  reason: string;
}

export interface BDSeason {
  number: number;
  year: number;
  club: BDClub;
  playerAge: number;
  playerOverall: number;
  baseStats: BDStats;
  eventStats: BDStats;
  trophies: BDTrophy[];
  attributes: BDAttributes;
  events: BDEvent[];
  phase: SeasonPhase;
  ceremony?: BDOCeremony;
  inCL: boolean;
  inEL: boolean;
  transferOffers?: TransferOffer[];
  leagueTable?: LeagueTableRow[];
  teammates?: BDTeammate[];
  matchweek: number;
  money: number;
  energy: number;
  // One-shot shop items already bought this season (persisted so the limit survives tab switches)
  purchasedItems?: string[];
}

// A career-long rival — same position, comparable age, a genuine BdO contender.
export interface BDRival {
  name: string;
  position: BDPosition;
  age: number;
  overall: number;
  club: string;
  leagueFlag: string;
  clubPrestige: number;
  hasCL: boolean;
  clWinOdds: number;
  // The rival's finish in the most recent Ballon d'Or ceremony (0 = unranked)
  lastBdoRank?: number;
}

export type LegacyTier = 'GOAT' | 'Legend' | 'Icon' | 'World Class' | 'Cult Hero' | 'Journeyman';

export interface BDLegacy {
  score: number;
  tier: LegacyTier;
  seasonsPlayed: number;
  bdoWins: number;
  bdoWinYears: number[];
  podiums: number;      // rank 2–3 finishes
  topTens: number;      // rank 4–10 finishes
  trophies: BDTrophy[]; // aggregated across the whole career (with counts folded into name)
  totalGoals: number;
  totalAssists: number;
  totalCleanSheets: number;
  peakOverall: number;
  clubs: string[];
  bestSeason?: {
    number: number;
    year: number;
    club: string;
    goals: number;
    assists: number;
    cleanSheets: number;
    rating: number;
    bdoRank: number;
  };
}

// Persisted separately from the career (key: "ballon-dor-legacy-best") so it
// survives starting a new career.
export interface BDLegacyBest {
  bestScore: number;
  bestTier: LegacyTier;
  careers: number;
}

export interface BDCareer {
  player: BDPlayer;
  seasons: BDSeason[];
  current: BDSeason | null;
  bdoWins: number;
  lastBdoRank: number;
  rival?: BDRival;
  retired?: boolean;
}
