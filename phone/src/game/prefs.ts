/**
 * The player's own preferences on this phone. Settings keeps only real player
 * preferences (FACT-UI-001 / FACT-UI-013): sound, game music, skip the line-up,
 * player names. Other areas read them with getPrefs() / usePrefs().
 * (Post-match reactions are decided, no toggle: lib/star/postMatchPrefs.ts.)
 */
import { useSyncExternalStore } from "react";
import { loadJson, saveJson } from "./save";

export interface Prefs {
  /** Sound effects in the match and on screens. */
  sound: boolean;
  /** Settings → Game music (off by default, as on the website). */
  gameMusic: boolean;
  /** Skip the line-up before kick-off. */
  skipLineup: boolean;
  /** Player names over the players in the match. */
  playerNames: boolean;
  /** Settings → Show 3D speed: frames a second, draw calls and triangles in a corner of the 3D places (off by default). */
  show3dSpeed: boolean;
  /** Settings → Match view 3D (and the 3D | 2D button in the match): the website's default is Off. */
  matchView3d: boolean;
  /** Settings → Match radar (testing): the little pitch over the commentary. The website's default is Old (no radar). */
  matchRadar: boolean;
  /**
   * Settings → Live 3D scenes (testing): the scenes that start by themselves in the career (the signing, the manager's office,
   * the two awards nights, the Star Pass rewards) play in 3D. OFF by default (Mikey, 24 Nov 2026: the app closed after the trial's
   * "accept offer"); off, each shows its drawn / plain version and never touches the 3D at all. Places you walk into on purpose
   * (garden, shop, house, training, the match's 3D button, Home's player) do not read it.
   */
  live3dScenes: boolean;
}
const DEFAULTS: Prefs = { sound: true, gameMusic: false, skipLineup: false, playerNames: true, show3dSpeed: false, matchView3d: false, matchRadar: false, live3dScenes: false };
const KEY = "prefs-v1";
let current: Prefs = { ...DEFAULTS, ...(loadJson<Partial<Prefs>>(KEY) ?? {}) };
const subs = new Set<() => void>();

export function getPrefs(): Prefs { return current; }
export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  current = { ...current, [k]: v };
  saveJson(KEY, current);
  subs.forEach((f) => f());
}
/** True when the automatic 3D scenes may start (Settings → Live 3D scenes). */
export function live3dScenesOn(): boolean { return current.live3dScenes === true; }
export function usePrefs(): Prefs {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current, () => current);
}
