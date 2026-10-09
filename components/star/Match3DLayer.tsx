"use client";

/**
 * THE CAREER MATCH IN 3D — Settings → Look → "Match view 3D: On | Off"
 * (lib/star/matchView3d.ts). Harry, 9 Oct 2026: "I can't see the new top down
 * in game?"
 *
 * Wraps the career's own <CanvasMatch> (app/star-dev/page.tsx) and nothing
 * else: no prop on the match changes, so it is the same real match, mounted
 * the same approved way. When On it provides EngineFrameContext, exactly as
 * the Style Testing page's "Real game" does (components/star/RealGame3D.tsx):
 * the 2D match keeps running underneath, invisible, and takes every touch;
 * the 3D view (lib/star/style3d/engineView.ts) draws each frame it hands over.
 * It reads; it never decides.
 *
 * If this phone can't draw 3D, the 2D match shows as normal.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { EngineFrameContext, type EngineFrame, type EngineFrameObserver } from "@/lib/star/engineFrame";
import type { EngineView } from "@/lib/star/style3d/engineView";
import { resolveStyle } from "@/lib/star/style3d/styles";
import { useMatchView3d } from "@/lib/star/matchView3d";

/** The TV camera's angle, degrees from straight down (the Style Testing page's default). */
const CAREER_3D_TILT = 45;

export default function Match3DLayer({ children }: { children: ReactNode }) {
  const on = useMatchView3d() === "on";
  // Read once per match: switching mid-match would remount the match.
  const [use3d] = useState(on);
  if (!use3d) return <>{children}</>;
  return <Match3D>{children}</Match3D>;
}

function Match3D({ children }: { children: ReactNode }) {
  const ev = useRef<EngineView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");

  const attach = useCallback((wrap: HTMLDivElement, canvas: HTMLCanvasElement) => {
    const box = document.createElement("div");
    box.setAttribute("data-real3d", "");
    Object.assign(box.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    canvas.insertAdjacentElement("afterend", box);
    let dead = false;
    void import("@/lib/star/style3d/engineView").then(({ createEngineView }) =>
      createEngineView(box, { def: resolveStyle("real", "play"), tod: "golden", tilt: CAREER_3D_TILT, canvas2d: canvas }))
      .then((v) => {
        if (dead) { v.dispose(); return; }
        ev.current = v;
        setStatus("ready");
      })
      .catch((e) => { console.error("Career match 3D failed to load", e); if (!dead) setStatus("off"); });
    return () => { dead = true; ev.current?.dispose(); ev.current = null; box.remove(); };
  }, []);

  const onFrame = useCallback((f: EngineFrame) => {
    const v = ev.current;
    if (!v) return;
    v.frame(f);
    // Test bots find the ball through window.__starMatch.ball() (a dev-only
    // hook): with 3D drawn, the ball to press is the 3D one.
    const w = window as unknown as { __starMatch?: { ball?: () => unknown; __ball2d?: () => unknown }; __engineView3dBall?: unknown };
    const sm = w.__starMatch;
    if (sm?.ball && !sm.__ball2d) {
      const ball2d = sm.ball;
      sm.__ball2d = ball2d;
      sm.ball = () => w.__engineView3dBall ?? ball2d();
    }
  }, []);

  // Until the 3D picture is ready the 2D match shows, so the screen is never blank.
  const obs = useMemo<EngineFrameObserver>(() => ({ hide2D: status === "ready", attach, onFrame }), [status, attach, onFrame]);

  return (
    <div className="relative" data-career-3d={status}>
      <EngineFrameContext.Provider value={obs}>{children}</EngineFrameContext.Provider>
    </div>
  );
}
