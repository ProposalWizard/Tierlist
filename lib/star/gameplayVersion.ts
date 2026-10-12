/**
 * NEW vs OLD GAMEPLAY — a per-device switch for each gameplay change that
 * might not be better (Leo, 5 Oct 2026: "not risking losing anything if its
 * not better than before"). Default "new", unless a switch sets
 * `defaultVersion: "old"` (a change still being tested). "old" plays exactly the game from
 * before the change, so the two can be compared on the same phone.
 *
 * Read at the moment it matters (a new chance, a new run), never cached, so
 * flipping it in Settings takes effect on the next chance without a reload.
 *
 * Decided, no toggle (12 Oct 2026): Keepers (New), Dribble runs (New),
 * Clearances (always on), Chance mix (removed: the basic mix), Match camera
 * (Old until the rebuilt camera lands), Dribble duels (Old) and Kane drawings
 * (Old: the game's own drawings) are no longer switches. Their old localStorage keys (star-gameplay-keepers etc.) are
 * simply never read. See CLAUDE.md → "Decided, no toggle".
 */

export type GameplayVersion = "new" | "old";

export const GAMEPLAY_SWITCHES = {
  keeperPro: {
    label: "Keeper pro (testing)",
    // Leo, 12 Oct 2026: "id rather keep things how they are … make em options to test out".
    defaultVersion: "old",
    newText: "Keepers hold the gentle ones and parry the hard ones somewhere believable, rush out at one-on-ones, come for crosses and overhit through balls, read long shots, and can be chipped or nutmegged.",
    oldText: "The keepers from before 11 Oct 2026.",
  },
  ballPhysics: {
    label: "Ball physics (testing)",
    // 12 Oct 2026: off by default until seen on a screen; with Keeper pro it
    // moves the calibrated finishing/keeper numbers (finishing corner floor 68% vs 70%).
    defaultVersion: "old",
    newText: "A real football: air drag that grows with speed, a bounce and roll like cut grass, spin that dies away, round posts and a bar that send it off at the true angle (sometimes in), a net that catches it, and the same result at every frame rate.",
    oldText: "The ball from before 11 Oct 2026.",
  },
  shotsPro: {
    label: "Shots (testing)",
    // Leo, 12 Oct 2026: "id rather keep things how they are … make em options to test out".
    defaultVersion: "old",
    newText: "Where you hit the ball sets how high it arrives (top = low, middle = hip height, below = top corner). Real spread off your aim, shown as a cone on the arrow; harder, volleys, headers, long shots and a man in your face spread more. Clean contact is truer, a sliced or scuffed one is punished.",
    oldText: "Shots from before 11 Oct 2026: a tap in the middle of the ball often flies at the bar, and almost no spread off the arrow.",
  },
  knucklePower: {
    label: "Knuckleball & power shot (testing)",
    // Leo, 12 Oct 2026: "id rather keep things how they are … make em options to test out".
    defaultVersion: "old",
    newText: "Hit a hard shot through the dead centre of the ball and it knuckles (wobbles late). A ⚡ Power shot button on the aim screen: wind up, then hit the green circle fast for up to 1.5x pace.",
    oldText: "No knuckleball and no power shot (test match only).",
  },
  matchFlow: {
    label: "Match flow (testing)",
    // Leo, 12 Oct 2026: "id rather keep things how they are … make em options to test out".
    defaultVersion: "old",
    newText: "The match around you plays like a real one: about 25 shots, 10 corners and 2.8 goals a game, much less of the ball against a far better side, the side behind pushing after a goal, and more happening late.",
    oldText: "The unseen match from before 11 Oct 2026: about 13 shots a game, no corners but yours.",
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

export const oldKeeperPro = () => gameplayVersion("keeperPro") === "old";
export const oldBallPhysics = () => gameplayVersion("ballPhysics") === "old";
export const oldShots = () => gameplayVersion("shotsPro") === "old";
export const oldMatchFlow = () => gameplayVersion("matchFlow") === "old";
