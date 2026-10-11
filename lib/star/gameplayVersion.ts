/**
 * NEW vs OLD GAMEPLAY — a per-device switch for each gameplay change that
 * might not be better (Leo, 5 Oct 2026: "not risking losing anything if its
 * not better than before"). Default "new", unless a switch sets
 * `defaultVersion: "old"` (a change still being tested). "old" plays exactly the game from
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
  keeperPro: {
    label: "Keeper pro",
    newText: "Keepers hold the gentle ones and parry the hard ones somewhere believable, rush out at one-on-ones, come for crosses and overhit through balls, read long shots, and can be chipped or nutmegged.",
    oldText: "The keepers from before 11 Oct 2026.",
  },
  dribble: {
    label: "Dribble runs",
    newText: "Team-mates to pass to, 3–4 waves, tighter defenders, and a better chance the further you get.",
    oldText: "The dribble run from before 5 Oct 2026: no passes, 2–4 waves.",
  },
  dribbleDuels: {
    label: "Dribble duels",
    newText: "Defenders back off and show you one way. Sell a step-over or a drop of the shoulder, then go the other way; or knock it past the moment he plants to tackle. Too early or too late and he takes it (or fouls you). Your dribbling and pace count.",
    oldText: "The duel from before 11 Oct 2026: flick away from the side he dips to.",
  },
  clearances: {
    label: "Clearances",
    newText: "Defenders sometimes miscue, a boot can hit a body and come off loose, and anyone can win that second ball.",
    oldText: "Every clearance is clean (you still see the boot fly off the screen).",
  },
  chanceMix: {
    label: "Chance mix (testing)",
    // Mikey, 9 Oct 2026: "the old system should still be the default and the
    // new system … should be the thing that we are testing."
    defaultVersion: "old",
    newText: "Built from Kane's real touches: about 9 highlights a match, half of them deeper where you pass and can get it back, and half as many one-on-ones.",
    oldText: "About 6 highlights a match, every kind equally often (from before 9 Oct 2026).",
  },
  kaneDrawings: {
    label: "Kane drawings (testing)",
    // Mikey, 9 Oct 2026: "make this a setting you can switch into, don't
    // apply to the current scenarios yet."
    defaultVersion: "old",
    newText: "Chances drawn from real strikers' passes and shots (Harry Kane's dealt most often): everyone near the play stands where they really stood. Mostly easy and normal, a few hard.",
    oldText: "The game's own drawings.",
  },
  actionCamera: {
    label: "Match camera",
    // Harry, 11 Oct 2026: "the camera view shows a huge area of the pitch
    // where no one's at". Camera round 3 (lib/star/matchView.ts fitAction).
    newText: "The camera frames the men the chance is about, so less empty grass. Nobody else is ever cut in half.",
    oldText: "The camera keeps every man on screen (from before 12 Oct 2026).",
  },
} as const;

export type GameplaySwitch = keyof typeof GAMEPLAY_SWITCHES;

const KEY = (s: GameplaySwitch) => `star-gameplay-${s}`;

/** A switch's default: "new" unless the switch says otherwise. */
export function defaultVersion(s: GameplaySwitch): GameplayVersion {
  const d = (GAMEPLAY_SWITCHES[s] as { defaultVersion?: GameplayVersion }).defaultVersion;
  return d ?? "new";
}

export function gameplayVersion(s: GameplaySwitch): GameplayVersion {
  try {
    if (typeof localStorage === "undefined") return defaultVersion(s);
    const v = localStorage.getItem(KEY(s));
    return v === "old" || v === "new" ? v : defaultVersion(s);
  } catch {
    return defaultVersion(s);
  }
}

export function setGameplayVersion(s: GameplaySwitch, v: GameplayVersion): void {
  try {
    if (v === defaultVersion(s)) localStorage.removeItem(KEY(s));
    else localStorage.setItem(KEY(s), v);
  } catch { /* private window: stays on the default */ }
}

export const oldKeepers = () => gameplayVersion("keepers") === "old";
export const oldKeeperPro = () => gameplayVersion("keeperPro") === "old";
export const oldDribble = () => gameplayVersion("dribble") === "old";
export const oldDribbleDuels = () => gameplayVersion("dribbleDuels") === "old";
export const oldClearances = () => gameplayVersion("clearances") === "old";
export const oldChances = () => gameplayVersion("chanceMix") === "old";
/** Has this phone ever picked a chance mix? (For Preview picking it up once.) */
export function chanceMixStored(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(KEY("chanceMix")) !== null; } catch { return false; }
}
export const oldKaneDrawings = () => gameplayVersion("kaneDrawings") === "old";
export const oldActionCamera = () => gameplayVersion("actionCamera") === "old";
