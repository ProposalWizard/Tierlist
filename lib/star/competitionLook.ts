/**
 * Each knockout competition's colours: the glow and the floodlit backdrop of
 * its round-up (KnockoutRoundup.tsx) and its own cup screen (CupScreen.tsx).
 * Kept here, not in a screen, so a light screen can read them without
 * pulling the round-up's code in with it.
 */
export const COMPETITION_GLOW: Record<string, { glow: string; bg: string }> = {
  "FA Cup": { glow: "#dc2626", bg: "radial-gradient(120% 80% at 50% 25%, #7f1d1d 0%, #3b0a0a 60%, #1a0505 100%)" },
  "League Cup": { glow: "#16a34a", bg: "radial-gradient(120% 80% at 50% 25%, #1f7a43 0%, #0f4a28 55%, #082a17 100%)" },
  "Lower League Trophy": { glow: "#d97706", bg: "radial-gradient(120% 80% at 50% 25%, #7c4a0b 0%, #4a2c06 55%, #241503 100%)" },
  "Champions League": { glow: "#2563eb", bg: "radial-gradient(120% 80% at 50% 25%, #1e3a8a 0%, #0b1a4a 60%, #050b24 100%)" },
  "Europa League": { glow: "#f97316", bg: "radial-gradient(120% 80% at 50% 25%, #9a3412 0%, #431407 60%, #1c0802 100%)" },
};

/** A competition's colours, the League Cup's for one without its own. */
export function competitionLook(competition: string): { glow: string; bg: string } {
  return COMPETITION_GLOW[competition] ?? COMPETITION_GLOW["League Cup"];
}
