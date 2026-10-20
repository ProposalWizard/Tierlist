/**
 * THE NEW | OLD ROWS STILL IN SETTINGS (Harry, 12 Oct 2026).
 *
 * The Version picker (Classic | Standard) is gone: "the new cut scenes will be
 * staying", and every other settled look is just the game (CLAUDE.md →
 * "Decided, no toggle"). What is left: the v0.15 gameplay round still being
 * tested (Old by default) and Settings → UI: Old | New. Each row is stored on
 * this phone only (its own localStorage key, in its own file); saves are never
 * touched.
 */
import { useSyncExternalStore } from "react";
import { uiVersion, setUiVersion, UI_VERSION_DEFAULT } from "./uiLook";
import { gameplayVersion, setGameplayVersion, defaultVersion } from "./gameplayVersion";
import { matchRadarLook, setMatchRadarLook } from "./matchRadarLook";
import { matchFeelLook, setMatchFeelLook } from "./matchFeel";
import { mikeyPopupsLook, setMikeyPopupsLook } from "./mikeyPopups";
import { fhrMode, setFhrMode } from "./fhr/toggle";

/** One New | Old switch: how to read it, how to set it, and its default. */
export interface LookRow {
  label: string;
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

const gp = (label: string, s: "keepers" | "keeperPro" | "shotsPro" | "knucklePower" | "ballPhysics" | "matchFlow"
  | "shotPower" | "contactField" | "keeperFeel" | "mateShots" | "hitboxes" | "keeperFinish") =>
  row(label, "new", "old", defaultVersion(s), () => gameplayVersion(s), (v) => setGameplayVersion(s, v));

/** Every New | Old row left in Settings, keyed by a short id. */
export const LOOK_ROWS = {
  // Harry, 12 Oct 2026: kept as a row, default New, until he has tested it more.
  keepers: gp("Keepers", "keepers"),
  // The v0.15 gameplay round, still being tested (Old by default).
  keeperPro: gp("Keeper pro", "keeperPro"),
  shotsPro: gp("Shots", "shotsPro"),
  knucklePower: gp("Knuckleball & power shot", "knucklePower"),
  ballPhysics: gp("Ball physics", "ballPhysics"),
  matchFlow: gp("Match flow", "matchFlow"),
  // The Oct 13 gameplay update, still being tested (Old by default).
  shotPower: gp("Shot power", "shotPower"),
  contactField: gp("Contact field", "contactField"),
  keeperFeel: gp("Keeper feel", "keeperFeel"),
  mateShots: gp("Team-mate shots", "mateShots"),
  // Leo, 14 Oct 2026: hitboxes the shape of a man, and real jumps (lib/star/hitbox.ts). Default New.
  hitboxes: gp("Hitboxes & jumping (Leo)", "hitboxes"),
  // Leo, 14 Oct 2026 (round 16): the Henry finish and top corners. Default New.
  keeperFinish: gp("Keeper realism (Leo)", "keeperFinish"),
  matchRadar: row("Match radar (testing)", "new", "old", "old", matchRadarLook, setMatchRadarLook),
  // Leo, 13 Oct 2026: impact, hit-stop, sounds, keeper dives (lib/star/matchFeel.ts). Old while tested.
  matchFeel: row("Match feel (testing)", "new", "old", "old", matchFeelLook, setMatchFeelLook),
  // Mikey, 20 Oct 2026: TV-style pop-ups (components/star/MikeyPopup.tsx). Old by default.
  mikeyPopups: row("Mikey's new pop-ups", "new", "old", "old", mikeyPopupsLook, setMikeyPopupsLook),
  // Harry, 19 Oct 2026: the Full Highlights Rebuild's test switch, Off by
  // default; On includes Chances: New (lib/star/fhr/toggle.ts). Shown in
  // Settings → Harry changes as "Off | On (test)".
  fhr: row("Full highlights rebuild", "on", "off", "off", fhrMode, setFhrMode),
  ui: row("UI", "new", "old", UI_VERSION_DEFAULT, uiVersion, setUiVersion),
} as const satisfies Record<string, LookRow>;

export type LookRowId = keyof typeof LOOK_ROWS;
export const LOOK_ROW_IDS = Object.keys(LOOK_ROWS) as LookRowId[];

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
if (typeof window !== "undefined") window.addEventListener("storage", () => notify());

/** Every row's value on this phone now. */
export function readLook(): Record<LookRowId, string> {
  return Object.fromEntries(LOOK_ROW_IDS.map((id) => [id, LOOK_ROWS[id].get()])) as Record<LookRowId, string>;
}

/** Set one row. */
export function setLookRow(id: LookRowId, v: string): void {
  LOOK_ROWS[id].set(v);
  notify();
}

/** Has this phone moved a row off its default? (The amber dot in Settings.) */
export function changedFromDefault(id: LookRowId, look = readLook()): boolean {
  return look[id] !== LOOK_ROWS[id].standard;
}

const snapshot = () => LOOK_ROW_IDS.map((id) => LOOK_ROWS[id].get()).join("|");
const serverSnapshot = () => LOOK_ROW_IDS.map((id) => LOOK_ROWS[id].standard).join("|");
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/** The live row values, re-read whenever a row changes. */
export function useLook(): Record<LookRowId, string> {
  const s = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const parts = s.split("|");
  return Object.fromEntries(LOOK_ROW_IDS.map((id, i) => [id, parts[i]])) as Record<LookRowId, string>;
}
