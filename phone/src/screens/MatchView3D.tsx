/**
 * THE 3D MATCH VIEW OVER THE PHONE'S MATCH (the website's components/star/Match3DLayer.tsx).
 *
 * The match stays the phone's one driver (src/match/driver.ts) drawn by its 2D picture, which keeps running underneath and takes every
 * touch. This is a layer over it that only DRAWS: every frame the pitch draws, Match.tsx hands it to `feedMatchView`, which builds the
 * frame (src/three/matchFrame.ts, read only) and gives it to the website's own 3D view (lib/star/style3d/engineView.ts) through the
 * walk host. It runs no football and has no loop of its own; it never changes the match.
 *
 * As on the website: Off by default (Settings → Match view 3D, and the "3D | 2D" button on the match's stats plate write the same
 * switch). Built the first time it is wanted. Until it is ready, and in the commentary, the full time and the top-down dribble, the
 * 2D match shows, so the pitch is never blank. If the 3D cannot start, the plain 2D match shows and the button goes away; if it
 * draws badly (3 frames in a row throwing) or the phone takes the GL away, the 2D shows at once and the button turns amber "3D ↻":
 * a tap builds it again.
 *
 * Lag: nothing is drawn unless the layer is on AND ready AND a chance is in play (the commentary, the pause and the full-time screen
 * hand over no frames, so the GL rests); a phone that opens the 3D at Low gets at most 30 a second, and any phone no more often than the 3D frame's own cost allows (about a third of the time); never above Medium;
 * the website's own governor lowers the picture further if frames run slow; the app going to the background pauses it (Walk3D).
 */
import { memo, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { View } from "react-native";
import type { TimeOfDay } from "@/lib/star/style3d/real/assets";
import type { Quality3d } from "@/lib/star/three3d/quality";
import type { MatchKits } from "@/lib/star/kits";
import type { MatchDriver } from "../match/driver";
import { Walk3D, walkTier } from "../three/Walk3D";
import { loadMatchViewStart, type MatchViewController } from "../three/matchViewScene";
import { engineFrameOf, viewDrawsPhase } from "../three/matchFrame";
import { usePrefs } from "../game/prefs";

export type ViewStatus = "idle" | "loading" | "ready" | "off" | "lost";
/** The 3D picture failing this many frames in a row hands the match back to 2D (the website's MAX_FRAME_ERRORS). */
export const MAX_FRAME_ERRORS = 3;

// ── the one status and what the pitch shows, shared by the layer, the plate's button and the pitch ──
let status: ViewStatus = "idle";
let shown = false; // the 3D picture is up (ready, and a chance is in play)
let retry = 0;
const subs = new Set<() => void>();
const bump = () => subs.forEach((f) => f());
const sub = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
function setStatus(s: ViewStatus) { if (s !== status) { status = s; if (s !== "ready") shown = false; bump(); } }
export const useViewStatus = (): ViewStatus => useSyncExternalStore(sub, () => status, () => "idle");
/** True while the 3D picture covers the 2D one (the pitch then need not hand its picture to the screen). */
export const useViewShown = (): boolean => useSyncExternalStore(sub, () => shown, () => false);
export const viewRetry = () => { retry++; errRun = 0; setStatus("idle"); };

let ctrl: MatchViewController | null = null;
let errRun = 0;
let lastAt = 0;
/** The 3D frame's own JS cost, ms (a running average). */
let cost = 0;
/** The tier the match opens at: the walk-around rule, never above Medium (the match is the busiest screen). */
export function matchViewTier(): Quality3d {
  const t = walkTier(0);
  return t === "high" ? "medium" : t;
}

/** Called by Match.tsx for every frame the pitch draws. Builds and hands over the frame when the 3D is up; costs nothing otherwise. */
export function feedMatchView(d: MatchDriver, kits: MatchKits, W: number, H: number) {
  const c = ctrl;
  if (!c || status !== "ready") return;
  const draws = viewDrawsPhase(d.phase);
  if (draws !== shown) { shown = draws; bump(); }
  if (!draws) return;
  // PACING (the 3D must never starve the match): at most 30 a second on Low and 60 on Medium, and never more often than the
  // 3D frame's own cost allows: it may use at most about a third of the time (a slow phone draws the 3D less often; the match
  // itself, drawn by the 2D picture underneath, is stepped every frame as before).
  const now = performance.now();
  if (now - lastAt < Math.max(matchViewTier() === "low" ? 32 : 15, cost * 2.2)) return;
  lastAt = now;
  try {
    c.frame(engineFrameOf(d, kits, W, H));
    const took = performance.now() - now;
    cost = cost ? cost * 0.8 + took * 0.2 : took;
    errRun = 0;
  } catch (e) {
    // a frame the 3D could not draw: skip it; several in a row go back to 2D (never a blank pitch)
    if (++errRun === 1) console.warn("[match 3D] a frame failed to draw", e);
    if (errRun >= MAX_FRAME_ERRORS) { console.warn("[match 3D] kept failing: showing 2D"); setStatus("lost"); }
  }
}

/** Matches only: forget the last match's controller (a new match builds its own view). */
export function resetMatchView() { ctrl = null; errRun = 0; lastAt = 0; cost = 0; shown = false; if (status !== "off") status = "idle"; bump(); }

// the look check's hook (the web build reads it; harmless on a phone): where the 3D view is
(globalThis as unknown as Record<string, unknown>).__matchView3d = { get status() { return status; }, get shown() { return shown; }, get errRun() { return errRun; } };

const NO_CB = () => ({});
/** The layer: put it over the pitch's picture. Renders nothing while the 3D is off. */
export const MatchView3DLayer = memo(function MatchView3DLayer({ tod, showSpeed }: { tod: TimeOfDay; showSpeed?: boolean }) {
  const prefs = usePrefs();
  const st = useViewStatus();
  const up = useViewShown();
  const data = useRef({ tod }).current;
  useEffect(() => () => { ctrl = null; }, []);
  const onController = useCallback((c: MatchViewController | null) => {
    ctrl = c; errRun = 0;
    if (c) setStatus("ready"); else if (status === "ready") setStatus("idle");
  }, []);
  const onFail = useCallback((why: string) => { console.warn("[match 3D] off:", why); ctrl = null; setStatus("off"); }, []);
  // wanted: build it (once); not wanted: let the GL go (the website keeps it hidden; a phone's memory is kept for the 2D match)
  useEffect(() => { if (prefs.matchView3d && status === "idle") setStatus("loading"); }, [prefs.matchView3d, st, retry]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!prefs.matchView3d || st === "off" || st === "lost") return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, opacity: st === "ready" && up ? 1 : 0 }}>
      <Walk3D<{ tod: TimeOfDay }, Record<string, never>, MatchViewController>
        key={retry}
        inert
        load={loadMatchViewStart}
        data={data}
        callbacks={NO_CB}
        name="the 3D match"
        tierFor={matchViewTier}
        showSpeed={showSpeed && st === "ready" && up}
        speedTop
        onBack={() => { /* a layer: no Back */ }}
        onController={onController}
        onFail={onFail}
      />
    </View>
  );
});

