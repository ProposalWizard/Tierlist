"use client";

/**
 * One picture of the full-match replay (lib/star/sim90.ts) at replay time `t`,
 * drawn by the goal-video renderer (lib/star/goalClip/render.ts) from its
 * whole-match camera ("match": the main stand, halfway line).
 *
 * It draws when `t` changes and at no other time: it has no clock and no
 * animation loop of its own. The page owns the clock; this only draws the
 * recorded positions the replay already holds. Nothing moves here.
 */
import { useEffect, useRef, useState } from "react";
import { drawScene, prepareClipSprites } from "@/lib/star/goalClip/render";
import type { GoalTrack } from "@/lib/star/goalClip/track";

export default function Sim90View({ track, t, aspect = 0.62 }: { track: GoalTrack; t: number; aspect?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let live = true;
    prepareClipSprites("new").then(() => { if (live) setReady((n) => n + 1); }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const measure = () => setW(c.parentElement?.clientWidth ?? 360);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c || !w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(w * dpr), H = Math.round(w * aspect * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    try {
      drawScene(ctx, W, H, track, "match", t, "new");
    } catch {
      // A frame that fails to draw is skipped; the next one tries again.
    }
  }, [track, t, w, aspect, ready]);

  return (
    <canvas
      ref={ref}
      data-sim90-view
      style={{ width: "100%", height: w ? w * aspect : 220, display: "block", borderRadius: 12, background: "#24702d" }}
    />
  );
}
