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
}
const DEFAULTS: Prefs = { sound: true, gameMusic: false, skipLineup: false, playerNames: true };
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
