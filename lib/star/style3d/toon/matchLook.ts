/**
 * Settings → Look → "Players in a 3D match: New | Old" (one phone at a time).
 *
 * Harry, 12 Oct 2026, after the Match Lab picture: "for cut scenes the Style A
 * is good and in game the realistic players is good".
 *   New ("real", the default): anything that plays football in 3D — the
 *        career match in 3D, the Real game test, the 3D drills and Free Roam,
 *        training in 3D, dribble runs 3D — draws the realistic players (the
 *        bodies "3D people" / "3D body" choose), never Style A.
 *   Old ("follow"): exactly the code before this row: the match follows
 *        "Player style" (Style A when that is New).
 * Cut scenes, the garden, the shop, the house and Home keep "Player style".
 *
 * Harry, 12 Oct 2026 (later): "I want it in style A but I don't want that blocky
 * minecraft look. I want exactly what the model looks like in the home screen".
 *   New ("styleA", now the default): every 3D football scene draws Style A men,
 *        whatever "Player style" says, dressed like the Home player (engineView's
 *        `homeStyleMen`: ink edge, Home's light, no bloom halo).
 *   "real" stays a choice (Realistic). Old ("follow") is unchanged.
 * The stored key moved (…-style2) so every phone takes the new default once;
 * a phone that had picked Old keeps Old.
 */
import { useSyncExternalStore } from "react";
import { playerStyleLook, type PlayerStyleLook } from "./look";

export type MatchPlayersStyle = "styleA" | "real" | "follow";

const KEY = "star-look-match-player-style2";
/** The key before Style A became the default: only its Old is carried over. */
const KEY_V1 = "star-look-match-player-style";
const VALUES: readonly MatchPlayersStyle[] = ["styleA", "real", "follow"];
export const MATCH_PLAYERS_STYLE_DEFAULT: MatchPlayersStyle = "styleA";
let cached: MatchPlayersStyle | null = null;
const listeners = new Set<() => void>();

export function matchPlayersStyleLook(): MatchPlayersStyle {
  if (cached) return cached;
  let v: string | null = null;
  try {
    v = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    if (v === null && typeof localStorage !== "undefined" && localStorage.getItem(KEY_V1) === "follow") v = "follow";
  } catch { v = null; }
  cached = v && (VALUES as readonly string[]).includes(v) ? (v as MatchPlayersStyle) : MATCH_PLAYERS_STYLE_DEFAULT;
  return cached;
}
/** Has this phone ever stored a choice? (gameVersions: a Classic phone picks up Old once.) */
export function matchPlayersStyleStored(): boolean {
  try { return typeof localStorage !== "undefined" && (localStorage.getItem(KEY) !== null || localStorage.getItem(KEY_V1) === "follow"); } catch { return false; }
}
/** A test page's choice for this page only: nothing is stored on the phone. */
export function previewMatchPlayersStyle(v: MatchPlayersStyle) {
  cached = v;
  listeners.forEach((f) => f());
}
export function setMatchPlayersStyleLook(v: MatchPlayersStyle) {
  try { localStorage.setItem(KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY || e.key === KEY_V1) { cached = null; listeners.forEach((f) => f()); } });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useMatchPlayersStyleLook = () => useSyncExternalStore(subscribe, matchPlayersStyleLook, () => MATCH_PLAYERS_STYLE_DEFAULT);

/** Pure: the Player style a football scene uses, from the two rows. */
export function resolveMatchPlayerStyle(match: MatchPlayersStyle, playerStyle: PlayerStyleLook): PlayerStyleLook {
  return match === "styleA" ? "new" : match === "real" ? "old" : playerStyle;
}

/** The Player style a 3D football scene (match, drills, Free Roam) uses on this phone. */
export function matchPlayerStyle(): PlayerStyleLook {
  return resolveMatchPlayerStyle(matchPlayersStyleLook(), playerStyleLook());
}
