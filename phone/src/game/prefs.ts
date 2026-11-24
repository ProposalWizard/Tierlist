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
}
const DEFAULTS: Prefs = { sound: true, gameMusic: false, skipLineup: false, playerNames: true, show3dSpeed: false, matchView3d: false, matchRadar: false };
const KEY = "prefs-v1";
let current: Prefs = { ...DEFAULTS, ...(loadJson<Partial<Prefs>>(KEY) ?? {}) };
const subs = new Set<() => void>();

export function getPrefs(): Prefs { return current; }
export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  current = { ...current, [k]: v };
  saveJson(KEY, current);
  subs.forEach((f) => f());
}
export function usePrefs(): Prefs {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current, () => current);
}
