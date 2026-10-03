/**
 * THE MATCH'S "LOOK" SWITCHES — Settings → Look. One phone at a time.
 *
 * Harry's standing rule (3 Oct 2026): every new look gets its own toggle and
 * the old one stays playable. These three sit beside "Match view: New |
 * Classic" (matchView.ts) and, like it, are module-level values read inside
 * the match screen — never props, so every screen that mounts the real match
 * follows them and the one-engine guard has nothing new to compare.
 *
 *   Players in the match   3D (baked sprites, lib/star/sprites.ts) | Drawn
 *                          (the outlined figures drawMatchFigure paints)
 *   Ball                   New (a clean drawn match ball) | Classic (the photo)
 *   Your player in open play  Hidden | Shown
 *
 * All three only change the NEW match view. In the Classic view the match is
 * drawn exactly as it always was.
 */
import { useSyncExternalStore } from "react";

export type MatchPlayersLook = "3d" | "drawn";
export type MatchBallLook = "new" | "classic";
export type YouInOpenPlay = "hidden" | "shown";

interface LookSetting<T extends string> {
  key: string;
  values: readonly T[];
  fallback: T;
}
const PLAYERS: LookSetting<MatchPlayersLook> = { key: "star-look-players", values: ["3d", "drawn"], fallback: "3d" };
const BALL: LookSetting<MatchBallLook> = { key: "star-look-ball", values: ["new", "classic"], fallback: "new" };
const YOU: LookSetting<YouInOpenPlay> = { key: "star-look-you", values: ["hidden", "shown"], fallback: "hidden" };

const cache = new Map<string, string | null>();
const overrides = new Map<string, string>();
const listeners = new Set<() => void>();

function read<T extends string>(s: LookSetting<T>): T {
  const o = overrides.get(s.key);
  if (o) return o as T;
  if (!cache.has(s.key)) {
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(s.key); } catch { v = null; }
    cache.set(s.key, v && (s.values as readonly string[]).includes(v) ? v : null);
  }
  return (cache.get(s.key) as T | null) ?? s.fallback;
}
function write<T extends string>(s: LookSetting<T>, v: T): void {
  try { localStorage.setItem(s.key, v); } catch { /* in-memory still changes */ }
  cache.set(s.key, v);
  listeners.forEach((f) => f());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key && [PLAYERS.key, BALL.key, YOU.key].includes(e.key)) { cache.delete(e.key); listeners.forEach((f) => f()); }
  });
}
function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

export const matchPlayersLook = (): MatchPlayersLook => read(PLAYERS);
export const matchBallLook = (): MatchBallLook => read(BALL);
export const youInOpenPlay = (): YouInOpenPlay => read(YOU);
export const setMatchPlayersLook = (v: MatchPlayersLook) => write(PLAYERS, v);
export const setMatchBallLook = (v: MatchBallLook) => write(BALL, v);
export const setYouInOpenPlay = (v: YouInOpenPlay) => write(YOU, v);

export const useMatchPlayersLook = () => useSyncExternalStore(subscribe, matchPlayersLook, () => PLAYERS.fallback);
export const useMatchBallLook = () => useSyncExternalStore(subscribe, matchBallLook, () => BALL.fallback);
export const useYouInOpenPlay = () => useSyncExternalStore(subscribe, youInOpenPlay, () => YOU.fallback);

/** Force the switches while a dev screen is open. Returns the undo. */
export function setLookOverride(o: { players?: MatchPlayersLook; ball?: MatchBallLook; you?: YouInOpenPlay }): () => void {
  const before = new Map(overrides);
  if (o.players) overrides.set(PLAYERS.key, o.players);
  if (o.ball) overrides.set(BALL.key, o.ball);
  if (o.you) overrides.set(YOU.key, o.you);
  listeners.forEach((f) => f());
  return () => { overrides.clear(); before.forEach((v, k) => overrides.set(k, v)); listeners.forEach((f) => f()); };
}

/** The set pieces: the man over the ball is drawn, because he takes it. */
export const SET_PIECE_KINDS: ReadonlySet<string> = new Set(["penalty", "free_kick", "corner"]);

/**
 * THE ONE RULE for whether your own man is drawn (Harry, 3 Oct 2026):
 * "Remove the user's player from non-set-piece highlights and drills."
 *
 *  - A feature that has taken you off the picture (`scene.you === false`)
 *    keeps you off, as before.
 *  - The Classic view, or "Your player in open play: Shown": drawn.
 *  - Penalties, free kicks and corners (you are the taker): drawn — which
 *    covers the trial and training penalty and free-kick drills too.
 *  - Everything else (open play and the other drills): not drawn. The ball,
 *    with the ring under it, is "you". The drag, the aim, the strike and the
 *    captain's taps are untouched: only the picture of the man is left out.
 */
export function showYouFigure(kind: string, ctx: { newView: boolean; sceneYou?: boolean }): boolean {
  if (ctx.sceneYou === false) return false;
  if (!ctx.newView) return true;
  if (youInOpenPlay() === "shown") return true;
  return SET_PIECE_KINDS.has(kind);
}
