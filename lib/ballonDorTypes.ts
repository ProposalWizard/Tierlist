export type BDPosition = 'GK' | 'DEF' | 'MID' | 'ATT';
export type SeasonPhase = 'pre_season' | 'first_half' | 'january' | 'second_half' | 'run_in' | 'ceremony' | 'done';

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
}

export interface BDClub {
  id: string;
  name: string;
  prestige: number;
  clChance: number;
  primaryColor: string;
}

export interface BDAttributes {
  fitness: number;
  morale: number;
  fame: number;
}

export interface EventChoice {
  id: string;
  label: string;
  emoji: string;
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
}

export interface BDOCeremony {
  year: number;
  entries: CeremonyEntry[];
  playerRank: number;
  playerNominated: boolean;
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
}

export interface BDCareer {
  player: BDPlayer;
  seasons: BDSeason[];
  current: BDSeason | null;
  bdoWins: number;
  lastBdoRank: number;
}
