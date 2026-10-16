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
 * Keepers: New | Old row kept, default New (Harry, 12 Oct 2026: "keep the
 * keeper toggle on but default it to new … haven't tested enough yet").
 *
 * Decided, no toggle (12 Oct 2026): Dribble runs (New),
 * Clearances (always on), Chance mix (removed: the basic mix), Match camera
 * (Old until the rebuilt camera lands), Dribble duels (Old) and Kane drawings
 * (Old: the game's own drawings) are no longer switches. Their old localStorage keys (star-gameplay-keepers etc.) are
 * simply never read. See CLAUDE.md → "Decided, no toggle".
 */

export type GameplayVersion = "new" | "old";

export const GAMEPLAY_SWITCHES = {
  keepers: {
    label: "Keepers",
    newText: "Top corners beat them more, weaker keepers are slower, players in front block their view, trial free kicks and penalties easier.",
    oldText: "The keepers from before 5 Oct 2026.",
  },
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
  shotPower: {
    label: "Shot power (testing)",
    // Oct 13 gameplay update (Leo: "at 40 shooting is WAYYY too high … at 100 it's literally insane").
    defaultVersion: "old",
    newText: "Shots at goal leave the boot slower: a 60 hits it like a 40 used to, a 100 like a 70 (96 km/h, not 103). A 100 rarely blazes it over the bar. Passes and crosses keep their pace.",
    oldText: "Shot pace from before 13 Oct 2026: 79 km/h at power 40, 103 at 100.",
  },
  contactField: {
    label: "Contact field (testing)",
    // Oct 13 gameplay update (Mikey: max curve came out as a shot aimed up).
    defaultVersion: "old",
    newText: "Hit the ball on its side for a low curler along the floor: toward the edges, up/down barely matters. The middle is the same (top = low drive, bottom = lifted); the bottom corners give curl and some lift.",
    oldText: "Contact from before 13 Oct 2026: the side of the ball at mid-height curls AND lifts it.",
  },
  mateShots: {
    label: "Team-mate shots (testing)",
    // Oct 13 gameplay update ("teammates shooting sometimes"): measured, a
    // team-mate put through on goal shot from where he got it (through balls: 25 m).
    defaultVersion: "old",
    newText: "A team-mate who gets the ball in space far from goal runs on with it first (about 1-2 seconds), then shoots from nearer — unless a defender or the keeper comes to him.",
    oldText: "Team-mates from before 13 Oct 2026: whoever gets it shoots from right there after one touch, even 25 m out with nobody near him.",
  },
  keeperFeel: {
    label: "Keeper feel (testing)",
    // Oct 13 gameplay update ("goalies need to be better and more realistic, diving and catching").
    defaultVersion: "old",
    newText: "Builds on Keeper pro (turns it on too). Keepers read a shot better the nearer it gets, take a ball coming at them on their feet instead of lunging, hold more of the soft ones, and fewer parries drop back in front of goal.",
    oldText: "Keepers' dives and hands from before 13 Oct 2026.",
  },
  hitboxes: {
    label: "Hitboxes & jumping (Leo)",
    // Leo, 14 Oct 2026: "hitboxes are too high … I want jumping to actually affect the hitbox".
    newText: "Players are the shape of a man: widest at the feet, narrow at the head, nothing above the head unless they jump. Men really jump for a ball in the air (a team-mate for a ball played to him gets a little extra). A shot or chip over a team-mate's head goes over him; a chip over a keeper off his line has a real chance.",
    oldText: "Hitboxes from before 14 Oct 2026: a tall cylinder as wide at the head as at the feet; any team-mate within 2 m took a ball below 2.6 m, whoever it was for.",
  },
  keeperFinish: {
    label: "Keeper realism (Leo)",
    // Leo, 14 Oct 2026 (round 16): "there are not enough ways to score … the
    // goalie seems to save almost everything if he's close to it." Default New:
    // he asked for it directly. keeperBrain.ts KEEPER_FINISH.
    newText: "A low ball across the keeper to the far post (the Henry finish) beats him far more often, a harder top-corner shot is harder to reach, and the bottom corners from distance go in at real rates. Shots at him stay his.",
    oldText: "The keeper's reach from before 14 Oct 2026.",
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
export const oldBallPhysics = () => gameplayVersion("ballPhysics") === "old";
export const oldShots = () => gameplayVersion("shotsPro") === "old";
export const oldMatchFlow = () => gameplayVersion("matchFlow") === "old";
export const oldKeeperFeel = () => gameplayVersion("keeperFeel") === "old";
export const oldHitboxes = () => gameplayVersion("hitboxes") === "old";
export const oldKeeperFinish = () => gameplayVersion("keeperFinish") === "old";
