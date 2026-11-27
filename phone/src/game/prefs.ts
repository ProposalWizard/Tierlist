/**
 * The player's own preferences on this phone. Settings keeps only real player
 * preferences (FACT-UI-001 / FACT-UI-013): sound, game music, skip the line-up,
 * player names. Other areas read them with getPrefs() / usePrefs().
 * (Post-match reactions are decided, no toggle: lib/star/postMatchPrefs.ts.)
 */
import { useSyncExternalStore } from "react";
import { loadJson, saveJson } from "./save";
import { closedWhileFresh, closedWhileInfo, partOff } from "../safety";

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
// Why Live 3D scenes is OFF when the app (not the player) switched it off: Settings shows one line about it until it is turned on again.
const OFF_KEY = "live3d-off-by-crash-v1";
let offByCrash: string | null = (() => { try { return loadJson<string>(OFF_KEY) ?? null; } catch { return null; } })();
/** Called after the app turned Live 3D scenes off by itself ("the app closed in the signing", "a 3D error in the office"). */
export function markLive3dOffByCrash(why: string) {
  offByCrash = why;
  try { saveJson(OFF_KEY, why); } catch { /* the note is lost, the switch stays off */ }
  subs.forEach((f) => f());
}
/** The reason the app switched Live 3D scenes off, or null (the player's own choice, or it is on). */
export function live3dOffByCrash(): string | null { return current.live3dScenes ? null : offByCrash; }
// 24 Nov 2026: the last run closed in the middle of a live 3D scene (the signing, the office, a night, a reward: src/safety.ts left a
// trail). The switch goes OFF now, so the same scene cannot close the app again on the next try (the signing used to replay and close at
// the same moment every time). Settings → Live 3D scenes turns it back on. Only the launch that FOUND the trail does this.
try {
  if (current.live3dScenes && closedWhileFresh() && /signing|office|night|reward|headshot|player/i.test(closedWhileInfo()?.place ?? "")) {
    current = { ...current, live3dScenes: false };
    saveJson(KEY, current);
    markLive3dOffByCrash(`the app closed in ${closedWhileInfo()?.place ?? "a 3D scene"}`);
  }
} catch { /* the switch stays as it was */ }

export function getPrefs(): Prefs { return current; }
export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  current = { ...current, [k]: v };
  saveJson(KEY, current);
  if (k === "live3dScenes" && v === true && offByCrash) { offByCrash = null; try { saveJson(OFF_KEY, null); } catch { /* as it was */ } }
  subs.forEach((f) => f());
}
/** True when the automatic 3D scenes may start (Settings → Live 3D scenes). */
export function live3dScenesOn(): boolean { return current.live3dScenes === true; }
/**
 * THE ONE GATE FOR EVERYTHING 3D THAT STARTS BY ITSELF (news report headshots, the title's and Home's player, the signing, the office,
 * the nights, the rewards): Live 3D scenes ON, the crash guard has "3d" on, and this is not a safe start (src/safety.ts).
 * With it false nothing makes a GL view, a GL context or a headshot.
 */
export function automatic3dAllowed(): boolean { return current.live3dScenes === true && !partOff("3d"); }
export function usePrefs(): Prefs {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => current, () => current);
}
