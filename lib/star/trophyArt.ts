/**
 * THE TROPHY PICTURES — one real image per trophy, keyed by the exact name the
 * game already gives it (a `Trophy.competition`, an award's `kind`).
 *
 * Supplied by Mikey (24 Sep 2026) as 14 images in `public/trophies/`; cut out
 * of their backgrounds and shrunk to `public/star/trophies/*.webp` (27-81 KB
 * each, from ~2 MB). A trophy with no picture yet — Community Shield, Super
 * Cup, Conference League, European Championship, Play-Offs — returns null and
 * its screen keeps the emoji it always had, so nothing ever shows a gap.
 */

const ART: Record<string, string> = {
  "Premier League": "premier-league",
  "Championship": "championship",
  "League One": "league-one",
  "League Two": "league-two",
  "National League": "national-league",
  "FA Cup": "fa-cup",
  "League Cup": "league-cup",
  "Champions League": "champions-league",
  "Europa League": "europa-league",
  "World Cup": "world-cup",
  "Ballon d'Or": "ballon-dor",
  "Golden Boot": "golden-boot",
  "Player of the Month": "player-of-the-month",
  "Player of the Season": "player-of-the-season",
};

/** The picture for a trophy or award, or null when there isn't one yet. */
export function trophyArt(name: string): string | null {
  const slug = ART[name];
  return slug ? `/star/trophies/${slug}.webp` : null;
}

/** Every name that has a picture — for tests and the dev preview. */
export const TROPHY_ART_NAMES = Object.keys(ART);
