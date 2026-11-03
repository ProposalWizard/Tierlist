import type { LeagueTeam, LeagueResult } from "../types";
import type { CareerDivision } from "../calendar";
import type { EuroClub, EuroStanding } from "../euro";
import type { EuroBracket } from "../euroBracket";
import type { CupState } from "../cups";
import type { PlayOffResult } from "../promotion";

/**
 * THE REST OF THE WORLD'S SEASON (docs/WORLD_SEASON.md). Everything the
 * career plays without you: every English league you are not in, the
 * Champions League and Europa League you are not in, the League Cup when you
 * are not entered, and both pre-season shields. Kept on the career as
 * `career.world`, played round by round on each round's real date.
 */

/** Goals and assists per player id, for the scorer lists. */
export type ScorerCounts = Record<string, [goals: number, assists: number]>;

export interface WorldLeague {
  division: CareerDivision;
  /** The schedule's own order (the season's membership). */
  clubs: string[];
  /** The table. `strength` is the rating taken when the world opened. */
  teams: LeagueTeam[];
  /** Rounds played so far, and how many there are. */
  played: number;
  rounds: number;
  /** The most recent round's results. */
  last?: LeagueResult[];
  scorers: ScorerCounts;
}

export interface WorldEuro {
  competition: "Champions League" | "Europa League";
  /** The 36, with the rating each was given. */
  clubs: EuroClub[];
  table: EuroStanding[];
  /** League-phase matchdays played (0-8). */
  matchdays: number;
  bracket?: EuroBracket;
  /** Knockout rounds played (Round of 32 … Final, 0-5). */
  koRounds: number;
  last?: LeagueResult[];
  scorers: ScorerCounts;
  winner?: string;
}

export interface ShieldResult {
  competition: "Community Shield" | "Super Cup";
  home: string;
  away: string;
  hs?: number;
  as?: number;
  pens?: { home: number; away: number };
  winner?: string;
}

export interface WorldState {
  /** Bumped if the shape ever changes; an unknown version is rebuilt. */
  v: 1;
  season: number;
  /** Your division when it opened — the one league it does not play. */
  division: CareerDivision;
  leagues: WorldLeague[];
  europe: WorldEuro[];
  /** Only when you are not in the League Cup (National League and below). */
  leagueCup?: CupState;
  shields: ShieldResult[];
}

/** One competition's season leaders, for its History tab. */
export interface CompLeaders {
  competition: string;
  scorers: { player: string; club: string; n: number }[];
  assisters: { player: string; club: string; n: number }[];
  best?: { player: string; club: string };
}

/** One finished competition, kept after the rollover for "last season". */
export interface WorldSummary {
  season: number;
  tables: { name: string; division?: CareerDivision; rows: LeagueTeam[] }[];
  /** Top ten scorers and assisters per league/competition. */
  scorers: { name: string; goals: { player: string; club: string; n: number }[]; assists: { player: string; club: string; n: number }[] }[];
  winners: { competition: string; club: string }[];
  playOffs: { division: CareerDivision; result: PlayOffResult }[];
  /**
   * Each competition's leaders for League → History (Mikey, 2 Nov 2026): the
   * top scorer(s) and assister(s), ties kept, and a player of the season.
   * Leagues and Europe: most goals + assists (your own league: the Season
   * Awards' own winners). Cups: the best player in the final.
   */
  leaders?: CompLeaders[];
  /** Every cup's final (and both shields): who played, the score, who won. */
  finals?: { competition: string; home: string; away: string; hs?: number; as?: number; pens?: { home: number; away: number }; winner?: string }[];
  /** Every round of the FA Cup and League Cup, for tapping a cup on the
   *  season review (Mikey, 2 Nov 2026). Missing on older saves. */
  cups?: { competition: string; winner?: string; rounds: CupState["rounds"] }[];
  /** Who won each division's play-offs, your own included when you played
   *  them (then `playOffs` has no entry for it). Missing on older saves. */
  playOffWinners?: Partial<Record<CareerDivision, string>>;
  /** The Champions and Europa League knockout rounds. Missing on older saves. */
  brackets?: { competition: string; bracket: EuroBracket }[];
}
