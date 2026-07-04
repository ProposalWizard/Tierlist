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
}

export interface BDCareer {
  player: BDPlayer;
  seasons: BDSeason[];
  current: BDSeason | null;
  bdoWins: number;
  lastBdoRank: number;
}
