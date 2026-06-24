export type ConditionType = "goals" | "assists" | "clean_sheets" | "squad_count" | "win_event";

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
  | "unbeaten";

export type Competition = "any" | "pl_draft" | "cl_draft";

export interface ObjectiveCondition {
  id: string;
  type: ConditionType;
  count: number;
  // Optional filters (combinable — all must match)
  nationality?: string;
  club?: string;      // club the player was drafted from (partial match)
  position?: string;  // e.g. "ST", "GK", "CM" (partial match on assignedPosition)
  // For win_event type
  event?: WinEvent;
  // Scope: which game mode this condition applies to
  competition?: Competition;
}

// Stored in user_objectives.progress JSONB
// Keys are condition ids, values are cumulative counts
export type ObjectiveProgress = Record<string, number>;

export interface SeasonCheckData {
  competition: "pl_draft" | "cl_draft";
  squad: SquadPlayer[];
  playerStats: PlayerSeasonStats[];
  events: WinEvent[];
}

export interface SquadPlayer {
  name: string;
  nationality: string;
  club: string;
  assignedPosition: string;
  isSub?: boolean;
}

export interface PlayerSeasonStats {
  name: string;
  goals: number;
  assists: number;
  cleanSheets: number;
}

export const WIN_EVENT_OPTIONS: { value: WinEvent; label: string; competition: Competition }[] = [
  { value: "cl_win",      label: "Win the Champions League",      competition: "cl_draft" },
  { value: "cl_final",    label: "Reach the CL Final",            competition: "cl_draft" },
  { value: "cl_sf",       label: "Reach the CL Semi-Final",       competition: "cl_draft" },
  { value: "cl_qf",       label: "Reach the CL Quarter-Final",    competition: "cl_draft" },
  { value: "cl_r16",      label: "Reach the CL Round of 16",      competition: "cl_draft" },
  { value: "cl_qualify",  label: "Qualify from CL League Phase",  competition: "cl_draft" },
  { value: "cl_complete", label: "Complete a CL Campaign",        competition: "cl_draft" },
  { value: "pl_win",      label: "Win the Premier League",        competition: "pl_draft" },
  { value: "pl_top4",     label: "Finish Top 4 in PL",            competition: "pl_draft" },
  { value: "pl_top_half", label: "Finish Top Half in PL",         competition: "pl_draft" },
  { value: "pl_complete", label: "Complete a PL Season",          competition: "pl_draft" },
  { value: "unbeaten",    label: "Go Unbeaten in a Season",       competition: "any" },
];

export const CONDITION_TYPE_LABELS: Record<ConditionType, string> = {
  goals:        "Score goals",
  assists:      "Get assists",
  clean_sheets: "Keep clean sheets",
  squad_count:  "Have N players in squad",
  win_event:    "Achieve an event",
};
