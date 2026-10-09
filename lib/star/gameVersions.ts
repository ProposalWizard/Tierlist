/**
 * GAME VERSIONS — Settings → Version: Classic | Standard | Preview (Harry,
 * 8 Oct 2026, the "hybrid" Settings he picked). One tap sets every New | Old
 * look-and-feel switch at once. Each switch is still stored on this phone
 * only (its own localStorage key, in its own file); saves are never touched.
 *
 * THE RULE for adding a look (keep to it):
 *   1. A new look goes into PREVIEW first (its new value there; its old value
 *      in Classic and Standard).
 *   2. When Harry says it has settled, move its new value into STANDARD too,
 *      and make that the switch's real default in its own file.
 *   3. CLASSIC is always every switch's OLD option. Never anything else.
 *   tests/star/gameVersions.mts checks all three: every switch is in every
 *   version, Classic = the old values, Standard = the real defaults.
 *
 * The picker NEVER changes preferences: sound, full screen, camera angle,
 * 3D quality, skip the line-up, faces, names, reactions and "your player in
 * open play". Those are not in this list on purpose.
 */
import { useSyncExternalStore } from "react";
import { uiVersion, setUiVersion, UI_VERSION_DEFAULT } from "./uiLook";
import { storedFigureSkin, setStoredFigureSkin, FIGURE_SKIN_DEFAULT } from "./figureSkin";
import { storedMatchView, setMatchView, MATCH_VIEW_DEFAULT } from "./matchView";
import { signing3dOn, setSigning3d, shop3dPlayerLook, setShop3dPlayerLook } from "./signing3d";
import { people3dLook, setPeople3dLook, bossRoomLook, setBossRoomLook } from "./look3d";
import { garden3dLook, setGarden3dLook } from "./garden3d/look";
import { look3dStyle, setLook3dStyle } from "./look3dStyle";
import { casino3dLook, setCasino3dLook } from "./casino3d/look";
import { badgeLook, setBadgeLook } from "./badgeLook";
import { allSeasonsLook, setAllSeasonsLook } from "./allSeasonsLook";
import { ovationLook, setOvationLook } from "./ovationLook";
import { ovationMoves, setOvationMoves } from "./ovationMoves";
import { chanceSetChoice, setChanceSet, CHANCE_SET_DEFAULT } from "./chanceSet";
import { animationsLook, setAnimationsLook } from "./animLook";
import { matchPlayersLook, setMatchPlayersLook, matchBallLook, setMatchBallLook } from "./newLook";
import { gameplayVersion, setGameplayVersion } from "./gameplayVersion";
import { humanBodyLook, setHumanBodyLook } from "./human3d/look";
import { cutscenePeopleLook, setCutscenePeopleLook } from "./cutscene/look";
import { motionLook, setMotionLook } from "./motionLook";

export type GameVersion = "classic" | "standard" | "preview";
export const GAME_VERSIONS: readonly GameVersion[] = ["classic", "standard", "preview"];
/** The names on screen. Rename a version here, in one line (ids stay classic/standard/preview). */
export const GAME_VERSION_LABEL: Record<GameVersion, string> = { classic: "Classic", standard: "Standard", preview: "Preview" };

/** One New | Old switch: how to read it, how to set it, and its old value. */
export interface LookRow {
  label: string;
  /** Its two options, NEW first, OLD second. */
  newValue: string;
  oldValue: string;
  get: () => string;
  set: (v: string) => void;
}

const row = <V extends string>(
  label: string, newValue: V, oldValue: V, get: () => V, set: (v: V) => void,
): LookRow => ({ label, newValue, oldValue, get, set: (v) => set(v as V) });

/** Every New | Old switch in Settings, keyed by a short id. */
export const LOOK_ROWS = {
  matchView: row("Match view", "new", "classic", storedMatchView, setMatchView),
  matchPlayers: row("Players in the match", "3d", "drawn", matchPlayersLook, setMatchPlayersLook),
  ball: row("Ball", "new", "classic", matchBallLook, setMatchBallLook),
  chances: row("Chances", "new", "classic", chanceSetChoice, setChanceSet),
  animations: row("Animations", "new", "old", animationsLook, setAnimationsLook),
  keepers: row("Keepers", "new", "old", () => gameplayVersion("keepers"), (v) => setGameplayVersion("keepers", v)),
  dribble: row("Dribble runs", "new", "old", () => gameplayVersion("dribble"), (v) => setGameplayVersion("dribble", v)),
  clearances: row("Clearances", "new", "old", () => gameplayVersion("clearances"), (v) => setGameplayVersion("clearances", v)),
  garden: row("3D garden", "new", "old", garden3dLook, setGarden3dLook),
  look3d: row("3D look", "h", "old", look3dStyle, setLook3dStyle),
  shopPlayer: row("3D shop player", "new", "old", shop3dPlayerLook, setShop3dPlayerLook),
  people3d: row("3D people", "new", "old", people3dLook, setPeople3dLook),
  humanBody: row("3D body", "human", "before", humanBodyLook, setHumanBodyLook),
  cutscenePeople: row("Cut-scene people", "new", "old", cutscenePeopleLook, setCutscenePeopleLook),
  motion: row("Motion", "mocap", "old", motionLook, setMotionLook),
  bossRoom: row("Talk to your manager", "3d", "old", bossRoomLook, setBossRoomLook),
  casino: row("Casino", "3d", "classic", casino3dLook, setCasino3dLook),
  signing: row("Signing scene", "3d", "drawn", () => (signing3dOn() ? "3d" : "drawn"), (v) => setSigning3d(v === "3d")),
  ui: row("UI", "new", "old", uiVersion, setUiVersion),
  badges: row("Club badges", "new", "old", badgeLook, setBadgeLook),
  allSeasons: row("All seasons page", "new", "old", allSeasonsLook, setAllSeasonsLook),
  ovation: row("Standing ovation", "new", "old", ovationLook, setOvationLook),
  ovationMoves: row("Ovation greetings", "new", "old", ovationMoves, setOvationMoves),
  drawnStyle: row("Drawn-player style", "3d", "classic", storedFigureSkin, setStoredFigureSkin),
} as const satisfies Record<string, LookRow>;

export type LookRowId = keyof typeof LOOK_ROWS;
export const LOOK_ROW_IDS = Object.keys(LOOK_ROWS) as LookRowId[];

const N = (id: LookRowId) => LOOK_ROWS[id].newValue;
const O = (id: LookRowId) => LOOK_ROWS[id].oldValue;

/** Rows still being tested: new in Preview, old in Standard. Today: Animations, the human 3D body and cut-scene people.
 *  Chances left Preview on 9 Oct 2026 (Harry: "the zoom and scenarios is terrible"). */
export const PREVIEW_ROWS: readonly LookRowId[] = ["animations", "humanBody", "cutscenePeople"];

const build = (f: (id: LookRowId) => string) =>
  Object.fromEntries(LOOK_ROW_IDS.map((id) => [id, f(id)])) as Record<LookRowId, string>;

/**
 * THE THREE VERSIONS, row by row.
 *   Classic  every row's OLD option.
 *   Standard  what a brand-new player gets today (each file's own default).
 *   Preview   Standard, plus the rows in PREVIEW_ROWS on their new option.
 */
export const VERSION_PRESETS: Record<GameVersion, Record<LookRowId, string>> = {
  classic: build(O),
  standard: {
    matchView: MATCH_VIEW_DEFAULT,
    matchPlayers: N("matchPlayers"),
    ball: N("ball"),
    chances: CHANCE_SET_DEFAULT,
    animations: O("animations"),
    keepers: N("keepers"),
    dribble: N("dribble"),
    clearances: N("clearances"),
    garden: N("garden"),
    look3d: N("look3d"),
    shopPlayer: N("shopPlayer"),
    people3d: N("people3d"),
    humanBody: O("humanBody"),
    cutscenePeople: O("cutscenePeople"),
    motion: N("motion"),
    bossRoom: N("bossRoom"),
    casino: N("casino"),
    signing: N("signing"),
    ui: UI_VERSION_DEFAULT,
    badges: N("badges"),
    allSeasons: N("allSeasons"),
    ovation: N("ovation"),
    ovationMoves: N("ovationMoves"),
    drawnStyle: FIGURE_SKIN_DEFAULT,
  },
  preview: build((id) => (PREVIEW_ROWS.includes(id) ? N(id) : "")),
};
// Preview = Standard + the rows being tried.
for (const id of LOOK_ROW_IDS) if (!PREVIEW_ROWS.includes(id)) VERSION_PRESETS.preview[id] = VERSION_PRESETS.standard[id];

// ── Reading and setting ─────────────────────────────────────────────────

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
if (typeof window !== "undefined") window.addEventListener("storage", () => notify());

/** Every row's value on this phone now. */
export function readLook(): Record<LookRowId, string> {
  return build((id) => LOOK_ROWS[id].get());
}

/** Set one row (the single New | Old switch), and tell the version line. */
export function setLookRow(id: LookRowId, v: string): void {
  LOOK_ROWS[id].set(v);
  notify();
}

/** Set every row to a version at once. Preferences and saves are untouched. */
export function applyGameVersion(v: GameVersion): void {
  for (const id of LOOK_ROW_IDS) LOOK_ROWS[id].set(VERSION_PRESETS[v][id]);
  notify();
}

/** Which rows differ from a version. */
export function differencesFrom(v: GameVersion, look = readLook()): LookRowId[] {
  return LOOK_ROW_IDS.filter((id) => look[id] !== VERSION_PRESETS[v][id]);
}

export interface VersionState {
  /** The version this phone is on, or "custom" if any row was changed by hand. */
  version: GameVersion | "custom";
  /** For "custom": the nearest version and how many rows differ from it. */
  nearest: GameVersion;
  changes: number;
}

/** Which version the switches add up to. Ties go to Standard, then Preview. */
export function gameVersionOf(look = readLook()): VersionState {
  const order: GameVersion[] = ["standard", "preview", "classic"];
  let nearest: GameVersion = "standard";
  let changes = Infinity;
  for (const v of order) {
    const d = differencesFrom(v, look).length;
    if (d < changes) { nearest = v; changes = d; }
  }
  return { version: changes === 0 ? nearest : "custom", nearest, changes };
}

// One string so React can tell when anything changed.
const snapshot = () => LOOK_ROW_IDS.map((id) => LOOK_ROWS[id].get()).join("|");
const serverSnapshot = () => LOOK_ROW_IDS.map((id) => VERSION_PRESETS.standard[id]).join("|");
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/** The live row values, re-read whenever the picker or a row changes. */
export function useLook(): Record<LookRowId, string> {
  const s = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const parts = s.split("|");
  return Object.fromEntries(LOOK_ROW_IDS.map((id, i) => [id, parts[i]])) as Record<LookRowId, string>;
}
