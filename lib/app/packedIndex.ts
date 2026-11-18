/**
 * lib/app/packedIndex.ts — what the packed app carries inside it, and where.
 *
 * Written by mobile/scripts/pack.mts as /packed/index.json; read by
 * lib/app/offline.ts inside the app. Plain data, no code.
 */

/** The game's own settings routes, packed exactly as the website serves them. */
export const PACK_ROUTES = [
  "/api/star/lineups",
  "/api/star/xp-config",
  "/api/star/star-pass",
  "/api/star/sfx-overrides",
  "/api/star/cutscene-edits",
  "/api/star/cutscene-edits?approved=1",
] as const;

export interface PackedIndex {
  /** When the data was packed (the players are as of this moment). */
  packedAt: string;
  /** The game's player edition (lib/star/edition.ts STAR_FIFA_YEAR). */
  year: number;
  /** Route (path + query, as in PACK_ROUTES) → packed file. */
  routes: Record<string, string>;
  /** Every club's squad for /api/star/league-squads: { club: rows[] }. */
  squads: string;
  /** /api/draft/roster per club → packed file. */
  rosters: Record<string, string>;
  /** Database tables the game reads directly (club_logos, custom_clubs). */
  supabase: Record<string, string>;
  /** Picture address on the internet → packed copy. */
  images: Record<string, string>;
}
