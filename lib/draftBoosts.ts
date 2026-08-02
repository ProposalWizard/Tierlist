import type { DraftPlayer, PlayerAttributes } from "@/lib/seasonSimulator";

/**
 * Stat boost applied to a newly signed replacement, growing each season.
 *
 * Extracted from app/draft/page.tsx so the American replacement draft can apply
 * the same boost server-side. Signings are boosted because in the normal game
 * they are spun at random rather than chosen; the American draft keeps the
 * boost so a career's squad inflation curve stays identical between modes.
 */
export function getSigningBoost(season: number): number {
  if (season >= 5) return Math.floor(Math.random() * 4) + 4; // +4 to +7
  if (season >= 4) return Math.floor(Math.random() * 3) + 3; // +3 to +5
  if (season >= 2) return Math.floor(Math.random() * 3) + 2; // +2 to +4
  return Math.floor(Math.random() * 3) + 1;                  // +1 to +3
}

/** Apply a flat delta to a player's overall and every non-zero attribute. */
export function applyStatChange(player: DraftPlayer, change: number): DraftPlayer {
  if (change === 0) return player;
  const newPlayer = {
    ...player,
    overall: Math.max(1, Math.min(100, player.overall + change)),
  };
  if (newPlayer.attrs) {
    const attrs = { ...newPlayer.attrs };
    for (const key of Object.keys(attrs) as (keyof PlayerAttributes)[]) {
      const val = attrs[key] as number;
      // val === 0 means "attribute not imported" — leave as 0 so hasAttrs()
      // stays false and the OVR-based simulation fallback is preserved.
      if (val > 0) {
        attrs[key] = Math.max(1, Math.min(100, val + change));
      }
    }
    newPlayer.attrs = attrs;
  }
  return newPlayer;
}
