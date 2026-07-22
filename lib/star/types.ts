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

export interface CareerState {
  version: 1;
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
  bootsMatches: number;
  nrgDrinks: number;
  form: number[];
}

export type StarPhase =
  | "profile-setup"
  | "dashboard"
  | "stats"
  | "contract"
  | "status"
  | "league"
  | "fixtures"
  | "life"
  | "lifestyle"
  | "skills"
  | "training"
  | "pre-match"
  | "match"
  | "post-match"
  | "ballon-dor"
  | "season-end";
