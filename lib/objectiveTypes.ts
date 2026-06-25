export type ConditionType = "goals" | "assists" | "clean_sheets" | "squad_count" | "win_event" | "single_match" | "login_streak";

export type StatScope = "any_player" | "squad_total";

export type PositionMatch = "assigned" | "natural";

export type Timeframe = "season" | "career";

export type MatchStat = "goals_scored" | "win_margin";

export type WithinCompetition = "any" | "pl_only";

export type WinEvent =
  | "cl_win"
  | "cl_final"
  | "cl_sf"
  | "cl_qf"
  | "cl_r16"
  | "cl_qualify"
  | "cl_complete"
  | "pl_win"
  | "pl_top4"
  | "pl_top_half"
  | "pl_complete"
  | "unbeaten"
  | "fa_cup_win"
  | "efl_cup_win"
  | "community_shield_win"
  | "europa_win"
  | "europa_final"
  | "europa_sf"
  | "double"
  | "treble";

export type Competition = "any" | "pl_draft" | "cl_draft";

export interface ObjectiveCondition {
  id: string;
  type: ConditionType;
  count: number;
  scope?: StatScope;
  positionMatch?: PositionMatch;
  timeframe?: Timeframe;
  consecutive?: boolean;
  nationality?: string;
  club?: string;
  position?: string;
  event?: WinEvent;
  competition?: Competition;
  withinCompetition?: WithinCompetition;
  matchStat?: MatchStat;
}

export type ObjectiveProgress = Record<string, number>;

export interface SeasonCheckData {
  competition: "pl_draft" | "cl_draft";
  squad: SquadPlayer[];
  playerStats: PlayerSeasonStats[];
  plPlayerStats?: PlayerSeasonStats[];
  events: WinEvent[];
  matchResults?: { goalsFor: number; goalsAgainst: number }[];
}

export interface SquadPlayer {
  name: string;
  nationality: string;
  club: string;
  assignedPosition: string;
  naturalPositions?: string;
  isSub?: boolean;
}

export interface PlayerSeasonStats {
  name: string;
  goals: number;
  assists: number;
  cleanSheets: number;
}

export const WIN_EVENT_OPTIONS: { value: WinEvent; label: string; competition: Competition; available: boolean }[] = [
  { value: "cl_win",      label: "Win the Champions League",           competition: "cl_draft", available: true },
  { value: "cl_final",    label: "Reach the CL Final",                 competition: "cl_draft", available: true },
  { value: "cl_sf",       label: "Reach the CL Semi-Final",            competition: "cl_draft", available: true },
  { value: "cl_qf",       label: "Reach the CL Quarter-Final",         competition: "cl_draft", available: true },
  { value: "cl_r16",      label: "Reach the CL Round of 16",           competition: "cl_draft", available: true },
  { value: "cl_qualify",  label: "Qualify from CL League Phase",       competition: "cl_draft", available: true },
  { value: "cl_complete", label: "Complete a CL Campaign",             competition: "cl_draft", available: true },
  { value: "pl_win",      label: "Win the Premier League",             competition: "pl_draft", available: true },
  { value: "pl_top4",     label: "Finish Top 4 in PL",                 competition: "pl_draft", available: true },
  { value: "pl_top_half", label: "Finish Top Half in PL",              competition: "pl_draft", available: true },
  { value: "pl_complete", label: "Complete a PL Season",               competition: "pl_draft", available: true },
  { value: "unbeaten",    label: "Go Unbeaten in a Season",            competition: "any",      available: true },
  { value: "fa_cup_win",           label: "Win the FA Cup",                     competition: "pl_draft", available: true },
  { value: "community_shield_win", label: "Win the Community Shield",           competition: "pl_draft", available: true },
  { value: "europa_win",           label: "Win the Europa League",              competition: "cl_draft", available: true },
  { value: "europa_final",         label: "Reach the Europa League Final",      competition: "cl_draft", available: true },
  { value: "europa_sf",            label: "Reach the Europa League Semi-Final", competition: "cl_draft", available: true },
  { value: "double",               label: "Win the Double (PL + FA Cup / PL + Europa)", competition: "any",  available: true },
  { value: "treble",               label: "Win the Treble (PL + UCL + ...)",   competition: "cl_draft", available: true },
  { value: "efl_cup_win",          label: "Win the EFL Cup",                    competition: "pl_draft", available: false },
];

export const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  goals:        "Score goals",
  assists:      "Get assists",
  clean_sheets: "Keep clean sheets",
  squad_count:  "Have N players in squad",
  win_event:    "Achieve an event",
  single_match: "Single-match achievement",
  login_streak: "Login streak",
};

export const MATCH_STAT_LABELS: Record<MatchStat, string> = {
  goals_scored: "Goals scored in one match",
  win_margin:   "Win margin in one match",
};

export const STAT_SCOPE_LABELS: Record<StatScope, string> = {
  any_player:  "One player must reach the count individually",
  squad_total: "All matching players combined",
};

export const POSITION_MATCH_LABELS: Record<PositionMatch, string> = {
  assigned: "Playing position (slot in your formation)",
  natural:  "Natural position (any position they can play)",
};

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  season: "In a single season",
  career: "Across all drafts (career total)",
};
