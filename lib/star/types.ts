export interface StarPlayer {
  firstName: string;
  lastName: string;
  age: number;
  skinTone: "light" | "dark";
  club: string;
  clubBadge: string | null;
  position: string;
  nationality: string;
  startYear: number;
}

export interface Skills {
  pace: number;
  power: number;
  technique: number;
  vision: number;
  freeKick: number;
}

export interface Relationships {
  boss: number;
  team: number;
  fans: number;
  girlfriend: number | null;
  sponsors: number;
}

export interface Contract {
  club: string;
  wage: number;
  goalBonus: number;
  assistBonus: number;
  seasonsRemaining: number;
}

export interface SeasonStats {
  appearances: number;
  goals: number;
  hatTricks: number;
  passes: number;
  assists: number;
  starMan: number;
  totalRating: number;
  ratingCount: number;
}

export interface Fixture {
  week: number;
  opponent: string;
  home: boolean;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
  userGoals?: number;
  userAssists?: number;
  userRating?: number;
}

export interface LeagueTeam {
  name: string;
  strength: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface MatchStats {
  chances: number;
  goals: number;
  assists: number;
  passes: number;
  rating: number;
  starMan: boolean;
  bossChange: number;
  teamChange: number;
  fansChange: number;
  wage: number;
  goalBonus: number;
  sponsorPay: number;
  totalCash: number;
  homeScore: number;
  awayScore: number;
}

export interface Boot {
  id: string;
  name: string;
  pace: number;
  power: number;
  technique: number;
  matches: number;
  price: number;
}

export interface OwnedItem {
  id: string;
  name: string;
  category: "item" | "vehicle" | "property";
  price: number;
  lifestyleValue: number;
}

export interface Girlfriend {
  name: string;
  happiness: number;
  gifts: number;
}

export interface SponsorDeal {
  category: string;
  perMatch: number;
  active: boolean;
}

export interface Trophy {
  season: number;
  competition: string;
  club: string;
}

export interface Horse {
  name: string;
  breed: string;
  speed: number;    // 40-95 rating — top-end pace
  stamina: number;  // 40-95 rating — holds form to the line
  energy: number;   // 0-100, spent racing, regained between matches
  racesRun: number;
  racesWon: number;
  earnings: number; // lifetime prize money won
}

export interface CareerState {
  version: 2;
  player: StarPlayer;
  skills: Skills;
  relationships: Relationships;
  contract: Contract;
  season: number;
  week: number;
  energy: number;
  matchFitness: number;
  happiness: number;
  money: number;
  starRating: number;
  fame: number;
  seasonStats: SeasonStats;
  careerStats: SeasonStats;
  fixtures: Fixture[];
  league: LeagueTeam[];
  achievements: string[];
  status: "1st Team" | "Substitute" | "Squad";
  currentBoot: Boot;
  nrgDrinks: { basic: number; premium: number; elite: number };
  ownedItems: OwnedItem[];
  girlfriend: Girlfriend | null;
  sponsors: SponsorDeal[];
  trophies: Trophy[];
  form: number[];
  kitPrimary: string;
  kitSecondary: string;
  homeCity: string;
  seenDilemmas: string[];
  ballonDorWins: number;
  horse: Horse | null;
}

export type StarPhase =
  | "profile-setup"
  | "dashboard"
  | "league"
  | "life"
  | "skills"
  | "training"
  | "pre-match"
  | "match"
  | "post-match"
  | "ballon-dor"
  | "shop-nrg"
  | "shop-boots"
  | "shop-lifestyle"
  | "casino-menu"
  | "casino-blackjack"
  | "casino-roulette"
  | "casino-slots"
  | "sponsors"
  | "achievements"
  | "trophies"
  | "contract-renewal"
  | "dilemma"
  | "relationship-game"
  | "season-transfer"
  | "horse-stable";
