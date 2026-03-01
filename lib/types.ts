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
// User-created tierlists (new feature)
// ---------------------------------------------------------------

/** A user-created tierlist template (stored in DB) */
export interface Tierlist {
  id: string;
  created_by: string;
  title: string;
  slug: string;
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
// User-created tierlists (new feature: create / play flow)
// ---------------------------------------------------------------

export interface Tierlist {
  id: string;
  created_by: string;
  title: string;
  slug: string;
  cover_image_url: string | null;
  created_at: string;
}

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
