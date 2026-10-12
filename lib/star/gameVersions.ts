/**
 * GAME VERSIONS — Settings → Version: Classic | Standard (Harry, 8 Oct 2026;
 * trimmed 12 Oct 2026). One tap sets every row below at once. Each row is
 * still stored on this phone only (its own localStorage key, in its own file);
 * saves are never touched.
 *
 *   Standard  what a brand-new player gets (each row's own default).
 *   Classic   every row's OLD option.
 *
 * 12 Oct 2026 (Harry): "decide things and be done with it". Every look that
 * was settled lost its row and is now just the game (see CLAUDE.md →
 * "Decided, no toggle"). What is left here: the v0.15 gameplay round still
 * being tested, the cut scenes being reworked, and UI: Old | New. (The 3D
 * camera row went the same day, in another builder's camera round.) Preview is gone: something becomes a
 * "Preview" only when someone asks for that in those words; everything else
 * just goes into the game.
 *
 * The picker NEVER changes preferences: sound, full screen, 3D quality,
 * Match view 3D, skip the line-up, names. Those are not in this list on purpose.
 */
import { useSyncExternalStore } from "react";
import { uiVersion, setUiVersion, UI_VERSION_DEFAULT } from "./uiLook";
import { cutscenePeopleLook, setCutscenePeopleLook, cutsceneCameraLook, setCutsceneCameraLook } from "./cutscene/look";
import { gameplayVersion, setGameplayVersion, defaultVersion } from "./gameplayVersion";
import { matchRadarLook, setMatchRadarLook } from "./matchRadarLook";

export type GameVersion = "classic" | "standard";
export const GAME_VERSIONS: readonly GameVersion[] = ["classic", "standard"];
/** The names on screen. Rename a version here, in one line. */
export const GAME_VERSION_LABEL: Record<GameVersion, string> = { classic: "Classic", standard: "Standard" };

/** One New | Old switch: how to read it, how to set it, and its old value. */
export interface LookRow {
  label: string;
  /** Its two options, NEW first, OLD second. */
  newValue: string;
  oldValue: string;
  /** What a brand-new phone reads. */
  standard: string;
  get: () => string;
  set: (v: string) => void;
}

const row = <V extends string>(
  label: string, newValue: V, oldValue: V, standard: V, get: () => V, set: (v: V) => void,
): LookRow => ({ label, newValue, oldValue, standard, get, set: (v) => set(v as V) });

const gp = (label: string, s: "keeperPro" | "shotsPro" | "knucklePower" | "ballPhysics" | "matchFlow") =>
  row(label, "new", "old", defaultVersion(s), () => gameplayVersion(s), (v) => setGameplayVersion(s, v));

/** Every row the Version picker sets, keyed by a short id. */
export const LOOK_ROWS = {
  // The v0.15 gameplay round, still being tested (Old by default).
  keeperPro: gp("Keeper pro", "keeperPro"),
  shotsPro: gp("Shots", "shotsPro"),
  knucklePower: gp("Knuckleball & power shot", "knucklePower"),
  ballPhysics: gp("Ball physics", "ballPhysics"),
  matchFlow: gp("Match flow", "matchFlow"),
  matchRadar: row("Match radar (testing)", "new", "old", "old", matchRadarLook, setMatchRadarLook),
  // Cut scenes: no decision yet, being reworked (Harry, 12 Oct 2026).
  cutscenePeople: row("Cut-scene people", "new", "old", "old", cutscenePeopleLook, setCutscenePeopleLook),
  cutsceneCamera: row("Cut-scene camera", "new", "old", "new", cutsceneCameraLook, setCutsceneCameraLook),
  ui: row("UI", "new", "old", UI_VERSION_DEFAULT, uiVersion, setUiVersion),
} as const satisfies Record<string, LookRow>;

export type LookRowId = keyof typeof LOOK_ROWS;
export const LOOK_ROW_IDS = Object.keys(LOOK_ROWS) as LookRowId[];

const build = (f: (id: LookRowId) => string) =>
  Object.fromEntries(LOOK_ROW_IDS.map((id) => [id, f(id)])) as Record<LookRowId, string>;

/** THE TWO VERSIONS, row by row. */
export const VERSION_PRESETS: Record<GameVersion, Record<LookRowId, string>> = {
  classic: build((id) => LOOK_ROWS[id].oldValue),
  standard: build((id) => LOOK_ROWS[id].standard),
};

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

/** Which version the switches add up to. Ties go to Standard. */
export function gameVersionOf(look = readLook()): VersionState {
  const order: GameVersion[] = ["standard", "classic"];
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
