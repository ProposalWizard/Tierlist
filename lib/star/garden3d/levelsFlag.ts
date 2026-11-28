/**
 * THE GARDEN-LEVELS SETTING — one switch, OFF until Harry tries it (28 Nov 2026 build brief: "wired into the real
 * garden behind one setting that is OFF until Harry tries it").
 *
 * Off: Home → Garden is exactly the garden as before (level 1, no gate, no riding), whatever XP the career has.
 * XP still adds up quietly on the career (lib/star/gardenLevels.ts), so nothing is lost when it is switched on.
 * On (this device only): the garden opens at the career's garden level, with the chip, the new areas and riding.
 *
 * Switched on from the test page (/star-garden-levels-dev → "In my garden: On"), or ?gardenlevels=1 on any page.
 * GARDEN_LEVELS_IN_GAME = true later turns it on for everyone.
 */
export const GARDEN_LEVELS_IN_GAME = false;
export const GARDEN_LEVELS_KEY = "kib-garden-levels";

export function gardenLevelsOn(): boolean {
  if (GARDEN_LEVELS_IN_GAME) return true;
  try {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search).get("gardenlevels");
    if (q === "1") return true;
    if (q === "0") return false;
    return localStorage.getItem(GARDEN_LEVELS_KEY) === "on";
  } catch { return false; }
}

export function setGardenLevelsOn(on: boolean) {
  try { if (on) localStorage.setItem(GARDEN_LEVELS_KEY, "on"); else localStorage.removeItem(GARDEN_LEVELS_KEY); } catch { /* private window: nothing kept */ }
}
