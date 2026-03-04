/**
 * lib/types.ts
 * Shared TypeScript types used across the application.
 * These mirror the Supabase DB schema for type-safe data access.
 */

// ---------------------------------------------------------------
// Database row shapes (mirrors Supabase tables)
// ---------------------------------------------------------------

export interface TierlistTopic {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface TierlistPlayer {
  id: string;
  topic_id: string;
  name: string;
  position: string | null;
  club: string | null;
  image_url: string | null;
  created_at: string;
}

export interface TierlistRanking {
  id: string;
  user_id: string;
  topic_id: string;
  player_id: string;
  tier: Tier;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------
// Application-level types
// ---------------------------------------------------------------

/** The five valid tier labels */
export type Tier = "S" | "A" | "B" | "C" | "D";

/** All five tiers in display order */
export const TIERS: Tier[] = ["S", "A", "B", "C", "D"];

/**
 * Maps a Tier to its Tailwind background colour class.
 * Used by TierRow and PlayerCard components.
 */
export const TIER_COLORS: Record<Tier, string> = {
  S: "bg-[#ff7f7f]", // red-pink
  A: "bg-[#ffbf7f]", // orange
  B: "bg-[#ffdf80]", // yellow
  C: "bg-[#bfff7f]", // lime
  D: "bg-[#7fbfff]", // blue
};

/**
 * Client-side state: a map from Tier → array of player IDs.
 * "unranked" is a special bucket for players not yet placed.
 */
export type TierMap = Record<Tier | "unranked", string[]>;

// ---------------------------------------------------------------
// Dynamic tier rows (used in the new editor/board)
// ---------------------------------------------------------------

/** A single tier row with a custom label and colour */
export interface TierRowData {
  id: string;
  label: string;
  color: string;
}

/** Default 5 tiers with the standard green→red colour scheme */
export const DEFAULT_TIER_ROWS: TierRowData[] = [
  { id: "tier-s", label: "S", color: "#4ade80" }, // green-400
  { id: "tier-a", label: "A", color: "#86efac" }, // green-300
  { id: "tier-b", label: "B", color: "#fde047" }, // yellow-300
  { id: "tier-c", label: "C", color: "#fb923c" }, // orange-400
  { id: "tier-d", label: "D", color: "#f87171" }, // red-400
];

/** Palette of colours available in the tier-row settings panel */
export const TIER_COLOR_OPTIONS: string[] = [
  "#f87171", // red-400
  "#fb923c", // orange-400
  "#fbbf24", // amber-400
  "#fde047", // yellow-300
  "#a3e635", // lime-400
  "#4ade80", // green-400
  "#34d399", // emerald-400
  "#22d3ee", // cyan-400
  "#60a5fa", // blue-400
  "#818cf8", // indigo-400
  "#c084fc", // purple-400
  "#f472b6", // pink-400
  "#94a3b8", // slate-400
  "#e2e8f0", // slate-200
];

// ---------------------------------------------------------------
// User-created tierlists (create / play flow)
// ---------------------------------------------------------------

/** A user-created tierlist template (stored in DB) */
export interface Tierlist {
  id: string;
  created_by: string;
  title: string;
  slug: string;
  category: string;
  cover_image_url: string | null;
  created_at: string;
}

/** An image belonging to a user-created tierlist */
export interface TierlistImage {
  id: string;
  tierlist_id: string;
  name: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

// ---------------------------------------------------------------
// API request / response shapes
// ---------------------------------------------------------------

/** Body sent to POST /api/tierlist/save */
export interface SaveRankingPayload {
  topic_id: string;
  /** Each entry assigns exactly one tier to one player */
  rankings: { player_id: string; tier: Tier }[];
}

/** Response from GET /api/tierlist/[topic] */
export interface TopicPageData {
  topic: TierlistTopic;
  players: TierlistPlayer[];
  /** Existing rankings for the authenticated user (empty if none saved yet) */
  existing_rankings: Pick<TierlistRanking, "player_id" | "tier">[];
}
