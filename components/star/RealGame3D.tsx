"use client";

/**
 * THE REAL GAME, IN A STYLE — the Style Testing page's "Real game" scene.
 *
 * Harry, 9 Oct 2026: "remake the style testing with the base game (Infinite
 * Highlights style) and then have this new 3D game style as an option too."
 *
 * The game is the real one, untouched: EnginePlay (the one way a test screen
 * plays football) serving Infinite Highlights' chances — the match's own
 * `selectChance` → `buildScenario` path, one after another, seeded. The same
 * drag, contact screen, flight, keeper and scoring as a career.
 *
 * On top, the 3D view (lib/star/style3d/engineView.ts) draws each frame the
 * match has just drawn, in the chosen style. It reads; it never decides. The
 * 2D canvas keeps running underneath, invisible in 3D view, and takes every
 * touch: the 3D view hands each touch to it at the same spot of grass (a
 * shot's drag keeps the finger's own travel, so it kicks as hard).
 *
 * Toggle "2D | 3D view" to see the 2D game it is drawn from.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EnginePlay from "./EnginePlay";
import { EngineFrameContext, type EngineFrame, type EngineFrameObserver } from "@/lib/star/engineFrame";
import { SCENARIO_KINDS, type Scenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { isSwitchedOff } from "@/lib/star/switchedOffKinds";
import { nextHighlight, newSimMemory, buildSimScenario } from "@/lib/star/gallerySim";
import { mulberry32 } from "@/lib/star/season";
import type { StyleDef } from "@/lib/star/style3d/styles";
import type { TimeOfDay } from "@/lib/star/style3d/real/assets";
import type { EngineView } from "@/lib/star/style3d/engineView";
import { installVirtualClock } from "@/lib/star/virtualClock";

// Filming (scripts/film/frames3d.mjs): `?clock=virtual` freezes the page's
// clock so the match can be stepped frame by frame. Installed as this file
// loads, before the match's loop starts. Never without the query.
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("clock") === "virtual") {
  installVirtualClock(Number(new URLSearchParams(window.location.search).get("seed")) || 7);
}

/** Every chance kind the game serves (the switched-off ones stay off, as in the game). */
const KINDS: ScenarioKind[] = SCENARIO_KINDS.filter((k) => !isSwitchedOff(k));

export default function RealGame3D({ def, tod, tilt, view, seed = 7, kinds }: {
  def: StyleDef;
  tod: TimeOfDay | null;
  /** Degrees from straight down: the 3D TV camera's angle. */
  tilt: number;
  view: "3d" | "2d";
  seed?: number;
  /** Only these chances (?kinds=one_on_one,penalty). Absent: all of them. */
  kinds?: ScenarioKind[];
}) {
  const ev = useRef<EngineView | null>(null);
  const defRef = useRef(def); defRef.current = def;
  const todRef = useRef(tod); todRef.current = tod;
  const viewRef = useRef(view); viewRef.current = view;
  const tiltRef = useRef(tilt); tiltRef.current = tilt;
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");

  // Infinite Highlights' own stream: seeded, one chance after another
  const stream = useRef<{ rng: () => number; mem: ReturnType<typeof newSimMemory>; last?: string } | null>(null);
  if (!stream.current) stream.current = { rng: mulberry32(seed), mem: newSimMemory() };
  const pool = kinds?.length ? kinds : KINDS;
  const poolRef = useRef(pool); poolRef.current = pool;
  const openOn = useCallback((): Scenario => {
    const st = stream.current!;
    const spec = nextHighlight(poolRef.current, st.rng, st.mem, st.last);
    if (!spec) return buildSimScenario({ kind: "one_on_one", seed: 1, planId: null });
    st.last = `${spec.kind}:${spec.seed}`;
    return buildSimScenario(spec);
  }, []);

  const attach = useCallback((wrap: HTMLDivElement, canvas: HTMLCanvasElement) => {
    const box = document.createElement("div");
    box.setAttribute("data-real3d", "");
    Object.assign(box.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    canvas.insertAdjacentElement("afterend", box);
    let dead = false;
    void import("@/lib/star/style3d/engineView").then(({ createEngineView }) =>
      createEngineView(box, { def: defRef.current, tod: todRef.current ?? undefined, tilt: tiltRef.current, canvas2d: canvas }))
      .then((v) => {
        if (dead) { v.dispose(); return; }
        ev.current = v;
        v.setVisible(viewRef.current === "3d");
        setStatus("ready");
      })
      .catch((e) => { console.error("Real game 3D failed to load", e); if (!dead) setStatus("off"); });
    return () => { dead = true; ev.current?.dispose(); ev.current = null; box.remove(); };
  }, []);

  const firstFrame = useRef(false);
  const onFrame = useCallback((f: EngineFrame) => {
    // dev: the last frame, for test pages and filming tools to read
    (window as unknown as { __engineFrame?: EngineFrame }).__engineFrame = f;
    const v = ev.current;
    if (!v) return;
    v.frame(f);
    // Test bots find the ball through window.__starMatch.ball() (CanvasMatch's
    // dev hook, 2D coordinates). With the 3D view on, the ball they must press
    // is the 3D one: answer with that while it is drawn, else the 2D answer.
    const w = window as unknown as { __starMatch?: { ball?: () => unknown; __ball2d?: () => unknown }; __engineView3dBall?: unknown };
    const sm = w.__starMatch;
    if (sm?.ball && !sm.__ball2d) {
      const ball2d = sm.ball;
      sm.__ball2d = ball2d;
      sm.ball = () => w.__engineView3dBall ?? ball2d();
    }
    if (!firstFrame.current) {
      firstFrame.current = true;
      (window as unknown as { __styleReady?: boolean }).__styleReady = true;
    }
  }, []);

  // The 2D game keeps its own camera angle (Settings), so its framing and play
  // area are exactly the real game's; the dial turns the 3D TV camera only.
  const obs = useMemo<EngineFrameObserver>(() => ({ hide2D: view === "3d" && status !== "off", attach, onFrame }), [view, status, attach, onFrame]);
  useEffect(() => { ev.current?.setTilt(tilt); }, [tilt, status]);

  // the style the 3D view already wears (no second build on load)
  const worn = useRef<StyleDef | null>(null);
  useEffect(() => {
    if (!ev.current) return;
    if (worn.current === null) { worn.current = def; return; }
    if (worn.current === def) return;
    worn.current = def;
    ev.current.setStyle(def);
  }, [def, status]);
  useEffect(() => { if (tod) ev.current?.setTod(tod); }, [tod, status]);
  useEffect(() => { ev.current?.setVisible(view === "3d"); }, [view, status]);
  useEffect(() => {
    (window as unknown as { __styleReady?: boolean }).__styleReady = false;
    return () => { (window as unknown as { __styleReady?: boolean }).__styleReady = undefined; };
  }, []);

  return (
    <div className="relative w-full" data-real-game={status}>
      <EngineFrameContext.Provider value={obs}>
        {/* Not bare: the real match's own scoreboard and commentary, as in a career. */}
        <EnginePlay openOn={openOn} seed={seed} />
      </EngineFrameContext.Provider>
      {status === "off" && view === "3d" && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-40 text-center text-[13px] font-bold text-amber-200">This device can&apos;t draw the 3D view — showing the 2D game.</div>
      )}
    </div>
  );
}
