export type ConditionType = "goals" | "assists" | "clean_sheets" | "squad_count" | "win_event" | "single_match" | "login_streak" | "season_stat";

export type AgeComparison = "at_most" | "at_least";

export type SeasonStatType =
  | "wins"            // total wins in a PL season
  | "losses"          // total losses (use atMost for "fewest defeats")
  | "draws"           // total draws
  | "points"          // total points (e.g. beat the 100-point record)
  | "goals_scored"    // team total goals scored in a season
  | "goals_conceded"  // goals conceded — use atMost for "concede at most X"
  | "goal_difference" // season goal difference
  | "unbeaten_run"    // longest consecutive W/D streak in a season
  | "win_streak";     // longest consecutive W streak in a season

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
  | "treble"
  | "super_cup_win";

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
  continent?: string; // comma-separated continent names (OR), e.g. "Europe,Africa"
  excludeContinent?: string; // comma-separated continents to exclude (OR), e.g. "Europe"
  excludeNationality?: string; // comma-separated nationalities to exclude (OR)
  excludeClub?: string; // comma-separated clubs to exclude (OR)
  excludePosition?: string; // comma-separated positions to exclude (OR)
  event?: WinEvent;
  competition?: Competition;
  withinCompetition?: WithinCompetition;
  matchStat?: MatchStat;
  seasonStat?: SeasonStatType;
  atMost?: boolean;
  seasonCount?: number; // 1 = current season only (default), 2–5 = aggregate across N seasons
  minAge?: number;
  maxAge?: number;
  minOvr?: number;
  maxOvr?: number;
}

export type ObjectiveProgress = Record<string, number>;

// plMatchResults = PL season matches only (no cups/UCL). Used for season_stat conditions.


export interface SeasonCheckData {
  competition: "pl_draft" | "cl_draft";
  squad: SquadPlayer[];
  playerStats: PlayerSeasonStats[];
  plPlayerStats?: PlayerSeasonStats[];
  events: WinEvent[];
  matchResults?: { goalsFor: number; goalsAgainst: number }[];
  plMatchResults?: { goalsFor: number; goalsAgainst: number }[];
  // Previous seasons' PL match results (oldest first). Used for multi-season season_stat conditions.
  historicalPlMatchResults?: { goalsFor: number; goalsAgainst: number }[][];
  // Which season within the current draft run (1–5). Season 1 resets draft-run progress.
  seasonNumber?: number;
}

export interface SquadPlayer {
  name: string;
  nationality: string;
  club: string;
  assignedPosition: string;
  naturalPositions?: string;
  isSub?: boolean;
  age?: number;
  overall?: number;
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
  { value: "efl_cup_win",          label: "Win the League Cup",                 competition: "pl_draft", available: true },
  { value: "super_cup_win",        label: "Win the Super Cup",                  competition: "pl_draft", available: true },
];

export const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  goals:        "Score goals",
  assists:      "Get assists",
  clean_sheets: "Keep clean sheets",
  squad_count:  "Have N players in squad",
  win_event:    "Achieve an event",
  single_match: "Single-match achievement",
  login_streak: "Login streak",
  season_stat:  "Season team stat (wins / goals conceded / etc.)",
};

export const SEASON_STAT_LABELS: Record<SeasonStatType, string> = {
  wins:            "Wins in a season",
  losses:          "Losses in a season (use 'at most' for fewest defeats)",
  draws:           "Draws in a season",
  points:          "Points in a season",
  goals_scored:    "Team goals scored in a season",
  goals_conceded:  "Goals conceded in a season (use 'at most' for best defence records)",
  goal_difference: "Goal difference in a season",
  unbeaten_run:    "Longest unbeaten run in a season (W or D streak)",
  win_streak:      "Longest winning streak in a season",
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
  career: "Within one draft run (5 seasons)",
};
