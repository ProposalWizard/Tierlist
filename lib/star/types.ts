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

/** Every competition a career can play in. */
export type Competition =
  | "FA Cup"
  | "Champions League"
  | "Europa League"
  | "World Cup"
  | "European Championship";

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
  // ── Knockout football. Absent on a league fixture, which is what every
  //    fixture was until cups existed — so absent means league. ──
  competition?: Competition;
  kind?: "league" | "cup" | "europe" | "international";
  round?: string;
  /** For opponents that are not in your division. */
  opponentStrength?: number;
}

/** A knockout the player is in, or was in. */
export interface CupRun {
  competition: Competition;
  kind: "cup" | "europe" | "international";
  roundIndex: number;
  eliminated: boolean;
  won: boolean;
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

export interface SquadPlayer {
  id: string;
  name: string;
  shortName: string;
  position: "GK" | "CB" | "LB" | "RB" | "CDM" | "CM" | "CAM" | "LW" | "RW" | "ST";
  seasonGoals: number;
  seasonAssists: number;
  careerGoals: number;
  careerAssists: number;
}

export interface GoalEvent {
  minute: number;
  scorer: string;   // full player name
  assist?: string;  // full player name, or undefined
  isUserGoal: boolean;
}

export interface MatchStats {
  /** Minutes actually played. Under 90 when you came off the bench. */
  minutes?: number;
  /** Why you were taken off, when you were. */
  hooked?: "form" | "legs" | "rested" | null;
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
  goalEvents?: GoalEvent[];
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
  squad: SquadPlayer[];
  // Mid-season contract offer tracking (optional for backward-compat with saved careers)
  contractStarMilestones?: number[]; // star thresholds that have already triggered an early offer
  contractFormOfferSeason?: number;  // season when the last form-based early offer fired (-1 = never)
  // ── Cups, Europe and the national team. All optional so a career saved before
  //    they existed still loads; they fill in at the next season rollover. ──
  cups?: CupRun[];
  /** Earned by LAST season's finish, played THIS season. */
  europeanQualification?: Competition | null;
  caps?: number;
  internationalGoals?: number;
  /** What the last knockout tie did to the run, for the post-match screen. */
  knockoutMessage?: string | null;
  /** Things you can still do before the next match. Refills every week. */
  weekActions?: number;
  /** Every move you made, for the legacy screen. */
  transfers?: { season: number; from: string; to: string; fee: number }[];
  /** Hung up. The career is over and only the legacy screen remains. */
  retired?: boolean;
  /** How the board saw last season. Shown on the dashboard. */
  lastSeasonJudgement?: { score: number; bossChange: number; headline: string; detail: string };
  /** Individual honours. The Ballon d'Or was the only one that existed. */
  awards?: { season: number; kind: string; week?: number; detail: string }[];
  /** Wearing the armband at your current club. */
  captain?: boolean;
  /** The number on your back. Reassigned when you sign for someone. */
  squadNumber?: number;
  /** Appearances at the CURRENT club, reset on a transfer. */
  clubAppearances?: number;
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
  | "retirement"
  | "legacy";
