import { PACKED_APP } from "../app/packed";
/**
 * WHERE THE GAME LIVES (Mikey, 3 Nov 2026: "star-dev is clearly like a
 * development link … make it something like /road-to-ballon-dor").
 * Renamed (Harry, 12 Nov 2026): "The new name right now is Road to the Golden
 * Ball". The old /road-to-ballon-dor forwards here for good (next.config.mjs).
 *
 * Players see GAME_PATH. The page itself is still app/star-dev/ (the code,
 * the one-engine guard and the team's notes all point there): next.config.mjs
 * shows /star-dev's page at GAME_PATH, and sends anyone opening /star-dev
 * (old links, home-screen icons) on to GAME_PATH. Saves are kept per site,
 * not per address, so nothing is lost.
 */
export const GAME_PATH = "/road-to-the-golden-ball";
/** The page's own folder name: the old address, still reachable (it forwards). */
export const GAME_PATH_OLD = "/star-dev";

/** Is this address the game itself (either name)? */
export function isGamePath(path: string | null | undefined): boolean {
  // The packed app shows nothing but the game, at "/".
  if (PACKED_APP) return true;
  const p = (path ?? "").replace(/\/+$/, "");
  return p === GAME_PATH || p === GAME_PATH_OLD;
}
