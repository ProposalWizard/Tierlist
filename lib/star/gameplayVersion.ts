/**
 * NEW vs OLD GAMEPLAY — a per-device switch for each gameplay change that
 * might not be better (Leo, 5 Oct 2026: "not risking losing anything if its
 * not better than before"). Default "new". "old" plays exactly the game from
 * before the change, so the two can be compared on the same phone.
 *
 * Read at the moment it matters (a new chance, a new run), never cached, so
 * flipping it in Settings takes effect on the next chance without a reload.
 */

export type GameplayVersion = "new" | "old";

export const GAMEPLAY_SWITCHES = {
  keepers: {
    label: "Keepers",
    newText: "Top corners beat them more, weaker keepers are slower, players in front block their view, trial free kicks and penalties easier.",
    oldText: "The keepers from before 5 Oct 2026.",
  },
  dribble: {
    label: "Dribble runs",
    newText: "Team-mates to pass to, 3–4 waves, tighter defenders, and a better chance the further you get.",
    oldText: "The dribble run from before 5 Oct 2026: no passes, 2–4 waves.",
  },
} as const;

export type GameplaySwitch = keyof typeof GAMEPLAY_SWITCHES;

const KEY = (s: GameplaySwitch) => `star-gameplay-${s}`;

export function gameplayVersion(s: GameplaySwitch): GameplayVersion {
  try {
    if (typeof localStorage === "undefined") return "new";
    return localStorage.getItem(KEY(s)) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

export function setGameplayVersion(s: GameplaySwitch, v: GameplayVersion): void {
  try {
    if (v === "new") localStorage.removeItem(KEY(s));
    else localStorage.setItem(KEY(s), "old");
  } catch { /* private window: stays on the default */ }
}

export const oldKeepers = () => gameplayVersion("keepers") === "old";
export const oldDribble = () => gameplayVersion("dribble") === "old";
