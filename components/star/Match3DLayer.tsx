"use client";

/**
 * THE CAREER MATCH IN 3D — Settings → Look → "Match view 3D: On | Off"
 * (lib/star/matchView3d.ts). Harry, 9 Oct 2026: "I can't see the new top down
 * in game?"
 *
 * Wraps the career's own <CanvasMatch> (app/star-dev/page.tsx) and nothing
 * else: no prop on the match changes, so it is the same real match, mounted
 * the same approved way. It provides EngineFrameContext, exactly as the Style
 * Testing page's "Real game" does (components/star/RealGame3D.tsx): the 2D
 * match keeps running underneath, invisible, and takes every touch; the 3D
 * view (lib/star/style3d/engineView.ts) draws each frame it hands over. It
 * reads; it never decides.
 *
 * In the match's stats bar, by the speaker (Harry, 9 Oct 2026: "we need a
 * 3d/2d toggle in game and a setting cog whilst match commentary is on"):
 *   - 3D | 2D: flips the picture at once, mid-chance, nothing restarts. It
 *     writes the same setting as Settings → Look → "Match view 3D". The 3D
 *     view is built the first time it is wanted and then only hidden.
 *   - ⚙: this phone's Settings over the match (sound, the Look rows). The
 *     match is held while it is open (EngineFrameObserver.hold) and carries
 *     on where it stopped when it closes.
 *
 * If this phone can't draw 3D, the 2D match shows as normal.
 *
 * NEVER A BLANK PITCH (Harry's iPhone, 9 Oct 2026: "3D just stopped working
 * mid game" — the 3D picture went, and the 2D one was still hidden under it).
 * If the phone takes the 3D away (WebGL context lost, iOS does it when memory
 * runs short) or the 3D picture keeps failing to draw, the 2D match shows at
 * once and the stats bar's 3D button turns amber "3D ↻": a tap builds the 3D again. If
 * the phone hands the 3D back by itself, it is rebuilt by itself (twice at most
 * a match, so a phone that keeps losing it stays on 2D until tapped).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EngineFrameContext, type EngineFrame, type EngineFrameObserver } from "@/lib/star/engineFrame";
import type { EngineView } from "@/lib/star/style3d/engineView";
import { resolveStyle } from "@/lib/star/style3d/styles";
import { useMatchView3d, setMatchView3d } from "@/lib/star/matchView3d";
import { useSfxOn, setSfxOn, sfx } from "@/lib/star/sfx";
import { SettingsGroups } from "./DeviceSettings";
import { SetCard, SetToggle } from "./settingsKit";

/** The TV camera's angle, degrees from straight down (the Style Testing page's default). */
const CAREER_3D_TILT = 45;
const GLOW = "#10b981";
/** The 3D picture failing this many frames in a row hands the match back to 2D. */
export const MAX_FRAME_ERRORS = 3;
/** Rebuilds a match does by itself after the phone gives the 3D back. */
const AUTO_RETRIES = 2;

export default function Match3DLayer({ children }: { children: ReactNode }) {
  const on = useMatchView3d() === "on";
  const ev = useRef<EngineView | null>(null);
  const box = useRef<{ wrap: HTMLDivElement; canvas: HTMLCanvasElement } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "off" | "lost">("idle");
  const statusRef = useRef(status);
  statusRef.current = status;
  const errRun = useRef(0);
  const autoLeft = useRef(AUTO_RETRIES);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const killRef = useRef<(() => void) | null>(null);
  /** Bumped when the match hands over its pitch box (it can mount after this layer). */
  const [boxN, setBoxN] = useState(0);

  /** Build the 3D view into the pitch box (once). */
  const build = useCallback(() => {
    const b = box.current;
    if (!b || killRef.current) return;
    const holder = document.createElement("div");
    holder.setAttribute("data-real3d", "");
    Object.assign(holder.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    b.canvas.insertAdjacentElement("afterend", holder);
    let dead = false;
    let lost = false;
    errRun.current = 0;
    setStatus("loading");
    const onContextLost = () => {
      if (dead) return;
      lost = true;
      console.warn("Career match 3D: the phone took the 3D away (context lost) — showing 2D");
      ev.current?.setVisible(false);
      setStatus("lost");
    };
    const onContextRestored = () => {
      if (dead || autoLeft.current <= 0) return;
      autoLeft.current--;
      rebuildRef.current?.();
    };
    void import("@/lib/star/style3d/engineView").then(({ createEngineView }) =>
      createEngineView(holder, { def: resolveStyle("real", "play"), tod: "golden", tilt: CAREER_3D_TILT, canvas2d: b.canvas, onContextLost, onContextRestored }))
      .then((v) => {
        if (dead) { v.dispose(); return; }
        ev.current = v;
        if (lost) { v.setVisible(false); return; }
        setStatus("ready");
      })
      .catch((e) => { console.error("Career match 3D failed to load", e); if (!dead) setStatus("off"); });
    killRef.current = () => { dead = true; try { ev.current?.dispose(); } catch (e) { console.error("Career match 3D: dispose failed", e); } ev.current = null; holder.remove(); };
  }, []);

  /** Throw the 3D view away and build it again (the amber "3D ↻" tap, or the phone giving it back). */
  const rebuildRef = useRef<(() => void) | null>(null);
  const rebuild = useCallback(() => {
    killRef.current?.(); killRef.current = null;
    build();
  }, [build]);
  rebuildRef.current = rebuild;

  const attach = useCallback((wrap: HTMLDivElement, canvas: HTMLCanvasElement) => {
    box.current = { wrap, canvas };
    setBoxN((n) => n + 1);
    return () => { killRef.current?.(); killRef.current = null; box.current = null; };
  }, []);

  // 3D wanted: build it the first time, show it after; 2D wanted: hide it (kept, so flipping back is instant)
  useEffect(() => {
    if (on && !killRef.current) build();
    ev.current?.setVisible(on && status !== "lost");
  }, [on, status, build, boxN]);

  const onFrame = useCallback((f: EngineFrame) => {
    const v = ev.current;
    if (!v || statusRef.current === "lost") return;
    try {
      v.frame(f);
      errRun.current = 0;
    } catch (e) {
      // a frame the 3D could not draw: skip it; several in a row → back to 2D
      if (++errRun.current === 1) console.error("Career match 3D: a frame failed to draw", e);
      if (errRun.current >= MAX_FRAME_ERRORS) {
        console.error("Career match 3D: kept failing — showing 2D");
        v.setVisible(false);
        statusRef.current = "lost";
        setStatus("lost");
      }
      return;
    }
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

  const can3d = status !== "off";
  const chrome = (
    <>
      {on && status === "lost" && (
        <button
          data-match-3d-retry
          onClick={() => { autoLeft.current = AUTO_RETRIES; rebuild(); }}
          aria-label="3D paused: tap to try 3D again"
          className="px-2 flex items-center border-l border-white/10 text-[10px] font-black tracking-wide text-amber-300 hover:text-amber-200 transition"
        >
          3D ↻
        </button>
      )}
      {can3d && !(on && status === "lost") && (
        <button
          data-match-view-toggle
          onClick={() => setMatchView3d(on ? "off" : "on")}
          aria-label={on ? "Switch to the 2D view" : "Switch to the 3D view"}
          className="px-2 flex items-center border-l border-white/10 text-[10px] font-black tracking-wide text-white/85 hover:text-amber-300 transition"
        >
          {on ? "3D" : "2D"}
        </button>
      )}
      <button
        data-match-settings
        onClick={() => setSettingsOpen(true)}
        aria-label="Settings"
        className="px-2 flex items-center border-l border-white/10 text-white/80 hover:text-amber-300 transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </button>
    </>
  );

  // Until the 3D picture is ready the 2D match shows, so the screen is never blank.
  const obs = useMemo<EngineFrameObserver>(() => ({
    hide2D: on && status === "ready", attach, onFrame, hold: settingsOpen, chrome,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [on, status, attach, onFrame, settingsOpen, can3d, rebuild]);

  return (
    <div className="relative" data-career-3d={on ? status : "2d"}>
      <EngineFrameContext.Provider value={obs}>{children}</EngineFrameContext.Provider>
      {settingsOpen && <MatchSettings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

/** This phone's Settings over the held match: sound, then the Look groups. */
function MatchSettings({ onClose }: { onClose: () => void }) {
  const sfxNow = useSfxOn();
  return (
    <div data-match-settings-sheet className="fixed inset-0 z-[80] flex flex-col bg-gray-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-[17px] font-black text-white">Settings</div>
        <button onClick={onClose} className="kib-press rounded-lg bg-emerald-500 px-3.5 py-1.5 text-[14px] font-black text-gray-950">
          Back to the match
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-10 pt-3">
        <div className="mx-auto max-w-md space-y-2">
          <div className="text-[12px] font-bold text-white/85">The match is paused.</div>
          <SetCard tone={GLOW} className="px-3 py-1">
            <SetToggle label="Sound effects" on={sfxNow} onClick={() => { const v = !sfxNow; setSfxOn(v); if (v) sfx("ui-confirm"); }} last />
          </SetCard>
          <SettingsGroups glow={GLOW} />
        </div>
      </div>
    </div>
  );
}
