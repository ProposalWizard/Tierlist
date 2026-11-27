"use client";

/**
 * THE GYM'S SCREEN (/star-world3d-dev?place=gym): the mini-game's meter over the 3D picture, and your
 * Strength / Cardio / Focus strip. One thumb: press and hold ANYWHERE to push (the bar up, run on the
 * belt, the cursor right), let go to ease off. The game itself runs in the 3D scene's one frame
 * (lib/star/world3d/gymPlace.ts GymSession); each frame it hands this screen its numbers and the
 * screen writes them straight onto the page (no React update per frame, so a mid Android keeps up).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { GymHudFrame } from "@/lib/star/world3d/gymPlace";
import type { GymFitness } from "@/lib/star/world3d/testScene";
import { BENCH } from "@/lib/star/gym/games";

export interface GymHudHandle { frame: (f: GymHudFrame) => void }

const PANEL: React.CSSProperties = { background: "rgba(8,10,16,.82)", color: "#f8fafc", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,.35)" };

export const GymHud = forwardRef<GymHudHandle, { onHold: (on: boolean) => void; onAct: (id: string) => void; fitness?: GymFitness; film?: boolean }>(function GymHud({ onHold, onAct, fitness, film }, ref) {
  const [kind, setKind] = useState<GymHudFrame["kind"]>(null);
  const root = useRef<HTMLDivElement>(null);
  const fade = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLDivElement>(null);
  const big = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const timer = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const tempo = useRef<HTMLDivElement>(null);
  const tempoTxt = useRef<HTMLDivElement>(null);
  const strikes = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const lastKind = useRef<GymHudFrame["kind"]>(null);
  const last = useRef<GymHudFrame | null>(null);
  const api = useRef<GymHudHandle | null>(null);
  // the meter's pieces appear a moment after a game starts: draw the last frame onto them then
  useEffect(() => { if (last.current) api.current?.frame(last.current); }, [kind]);

  useImperativeHandle(ref, () => (api.current = {
    frame: (f) => {
      last.current = f;
      if (f.kind !== lastKind.current) { lastKind.current = f.kind; setKind(f.kind); }
      if (fade.current) fade.current.style.opacity = String(f.fade);
      if (!f.kind || !f.game) return;
      const g = f.game;
      if (count.current) { count.current.style.opacity = f.phase === "count" ? "1" : "0"; count.current.textContent = f.phase === "count" ? (f.count > 0.4 ? "Get ready" : "Go!") : ""; }
      if (timer.current) timer.current.textContent = `${Math.ceil(f.left)} s`;
      if (pad.current) { pad.current.style.background = f.hold ? "rgba(250,204,21,.95)" : "rgba(255,255,255,.14)"; pad.current.style.color = f.hold ? "#111" : "#f8fafc"; pad.current.textContent = f.phase === "count" ? "Get ready…" : f.hold ? "Holding" : "Hold anywhere"; }
      const setFlash = (txt: string, colour: string, age: number) => { if (!flash.current) return; flash.current.textContent = txt; flash.current.style.color = colour; flash.current.style.opacity = String(Math.max(0, 1 - age / 0.9)); flash.current.style.transform = `translate(-50%, ${-age * 30}px) scale(${1 + Math.max(0, 0.25 - age) })`; };
      if (g.kind === "bench") {
        if (marker.current) marker.current.style.bottom = `${g.bar * 100}%`;
        if (big.current) big.current.textContent = `${g.reps}/${BENCH.reps}`;
        // the tempo: how fast the bar is coming down (green = slow and safe, red = too fast)
        const down = Math.max(0, -g.v), share = Math.min(1, down / (BENCH.safeLand * 1.6));
        if (tempo.current) { tempo.current.style.width = `${share * 100}%`; tempo.current.style.background = down > BENCH.safeLand ? "#ef4444" : down > BENCH.safeLand * 0.7 ? "#f59e0b" : "#22c55e"; }
        if (tempoTxt.current) tempoTxt.current.textContent = g.phase === "up" ? "PUSH" : down > BENCH.safeLand ? "TOO FAST" : "LOWER SLOWLY";
        if (strikes.current) strikes.current.textContent = g.strikes ? "✖".repeat(g.strikes) + "○".repeat(Math.max(0, BENCH.strikesOut - g.strikes)) : "";
        const fw = g.flash.what;
        if (fw === "click") setFlash(`Rep ${g.reps}`, "#facc15", g.flash.age);
        else if (fw === "bounce") setFlash("Bounced!", "#ef4444", g.flash.age);
        else if (fw === "clean") setFlash("Slow ✓", "#86efac", g.flash.age);
        else if (fw === "fast") setFlash("Bit quick", "#f59e0b", g.flash.age);
      } else if (g.kind === "treadmill") {
        // the belt drawn top (the console) to bottom (the back edge)
        if (marker.current) marker.current.style.top = `${Math.min(1, g.pos) * 100}%`;
        if (zone.current) { zone.current.style.top = `${(g.zone - g.half) * 100}%`; zone.current.style.height = `${g.half * 200}%`; }
        if (big.current) big.current.textContent = `${g.kmh} km/h`;
        if (g.fell) setFlash("WHOA!", "#ef4444", Math.max(0, g.fellT - 0.1));
        else if (flash.current) flash.current.style.opacity = "0";
      } else {
        if (marker.current) marker.current.style.left = `${g.x * 100}%`;
        if (zone.current) { zone.current.style.left = `${(g.zone - g.half) * 100}%`; zone.current.style.width = `${g.half * 200}%`; }
        if (big.current) big.current.textContent = g.combo > 1 ? `×${g.combo}` : `${g.hits}`;
        if (g.since < 0.6 && g.combo > 2) setFlash(g.combo % 10 === 0 ? `${g.combo} combo!` : "", "#f472b6", g.since);
      }
    },
  }), []);


  const down = (e: React.PointerEvent) => { e.preventDefault(); onHold(true); };
  const up = () => onHold(false);
  const playing = !!kind;
  return (
    <div ref={root} style={{ position: "absolute", inset: 0, pointerEvents: "none", fontFamily: "system-ui, sans-serif" }} data-gym-hud={kind ?? "none"}>
      {/* the fitness strip (no game on) */}
      {!playing && fitness && (
        <div style={{ ...PANEL, position: "absolute", left: 10, right: 10, top: 40, maxWidth: 420, margin: "0 auto", padding: "8px 10px", pointerEvents: "auto" }} data-gym-fitness>
          <div style={{ display: "flex", gap: 8 }}>
            {fitness.stats.map((s) => (
              <div key={s.stat} style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#cbd5e1" }}>{s.name} <span style={{ color: "#facc15" }}>L{s.level}</span></div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.15)", marginTop: 3 }}><div style={{ width: `${s.share * 100}%`, height: "100%", borderRadius: 3, background: s.stat === "strength" ? "#f472b6" : s.stat === "cardio" ? "#4ade80" : "#a78bfa" }} /></div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 11.5, fontWeight: 800, color: "#e2e8f0" }}>
            <span>Ring {(["bench", "treadmill", "bag"] as const).map((k) => (fitness.ring.done.includes(k) ? "●" : "○")).join("")}{fitness.ring.closed ? " closed" : ""}</span>
            <span style={{ color: fitness.window >= 0 ? "#86efac" : "#fca5a5" }}>{fitness.window >= 0 ? `Window: ${fitness.window + 1} wk` : "No window"}</span>
            {!film && <button onClick={() => onAct("gym:nextWeek")} style={{ marginLeft: "auto", height: 24, borderRadius: 8, border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#f8fafc", fontWeight: 900, fontSize: 11, cursor: "pointer" }}>Play a match ▸</button>}
          </div>
        </div>
      )}
      {playing && (
        <>
          {/* the whole screen is the button: hold anywhere */}
          <div onPointerDown={down} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onContextMenu={(e) => e.preventDefault()}
            style={{ position: "absolute", inset: 0, pointerEvents: "auto", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }} data-gym-pad />
          <div style={{ ...PANEL, position: "absolute", left: 10, right: 10, top: 10, maxWidth: 440, margin: "0 auto", padding: "8px 12px", pointerEvents: "none" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{kind === "bench" ? "Bench press" : kind === "treadmill" ? "Treadmill" : "Heavy bag"}</div>
              <div ref={big} style={{ fontSize: 17, fontWeight: 900, color: "#facc15" }} />
              <div ref={timer} style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: "#cbd5e1" }} />
            </div>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>{kind === "bench" ? "Hold to push. Let go to lower: tap to brake." : kind === "treadmill" ? "Hold to run. Let go and the belt takes you back." : "Hold to push the cursor right. Keep it in the pink."}</div>
          </div>
          {!film && <button onClick={() => onAct("gym:quit")} style={{ position: "absolute", top: 76, right: 14, pointerEvents: "auto", width: 34, height: 34, borderRadius: 17, border: "none", background: "rgba(8,10,16,.8)", color: "#f8fafc", fontWeight: 900, fontSize: 16 }} aria-label="Stop">✕</button>}
          {/* the meter */}
          {kind === "bench" && (
            <>
              <div style={{ position: "absolute", right: 18, top: "24%", height: "40%", width: 22, borderRadius: 11, background: "rgba(8,10,16,.7)", border: "2px solid rgba(255,255,255,.25)" }}>
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 6, background: "#facc15", borderRadius: "9px 9px 0 0" }} />
                <div ref={marker} style={{ position: "absolute", left: -7, width: 32, height: 8, marginBottom: -4, borderRadius: 4, background: "#f8fafc", boxShadow: "0 0 8px rgba(255,255,255,.7)" }} />
              </div>
              <div style={{ ...PANEL, position: "absolute", left: 16, right: 16, bottom: 92, maxWidth: 380, margin: "0 auto", padding: "8px 10px" }}>
                <div style={{ display: "flex", fontSize: 12, fontWeight: 900 }}><span ref={tempoTxt}>LOWER SLOWLY</span><span ref={strikes} style={{ marginLeft: "auto", color: "#ef4444" }} /></div>
                <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,.15)", marginTop: 5, position: "relative", overflow: "hidden" }}>
                  <div ref={tempo} style={{ height: "100%", width: "0%", background: "#22c55e" }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: `${100 / 1.6}%`, width: 2, background: "#fff" }} />
                </div>
              </div>
            </>
          )}
          {kind === "treadmill" && (
            <div style={{ position: "absolute", right: 18, top: "22%", height: "44%", width: 26, borderRadius: 8, background: "rgba(8,10,16,.75)", border: "2px solid rgba(255,255,255,.25)", overflow: "visible" }}>
              <div ref={zone} style={{ position: "absolute", left: 0, right: 0, background: "rgba(34,197,94,.75)", borderRadius: 4 }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, background: "#ef4444", borderRadius: "0 0 6px 6px" }} />
              <div ref={marker} style={{ position: "absolute", left: -6, width: 34, height: 8, marginTop: -4, borderRadius: 4, background: "#f8fafc", boxShadow: "0 0 8px rgba(255,255,255,.7)" }} />
            </div>
          )}
          {kind === "bag" && (
            <div style={{ position: "absolute", left: 24, right: 24, bottom: 100, maxWidth: 380, margin: "0 auto", height: 22, borderRadius: 11, background: "rgba(8,10,16,.75)", border: "2px solid rgba(255,255,255,.25)" }}>
              <div ref={zone} style={{ position: "absolute", top: 0, bottom: 0, background: "rgba(244,114,182,.85)", borderRadius: 9 }} />
              <div ref={marker} style={{ position: "absolute", top: -6, width: 8, height: 30, marginLeft: -4, borderRadius: 4, background: "#f8fafc", boxShadow: "0 0 8px rgba(255,255,255,.7)" }} />
            </div>
          )}
          <div ref={flash} style={{ position: "absolute", left: "50%", top: "40%", transform: "translate(-50%, 0)", fontSize: 30, fontWeight: 900, textShadow: "0 3px 12px rgba(0,0,0,.6)", opacity: 0, whiteSpace: "nowrap" }} />
          <div ref={count} style={{ position: "absolute", left: 0, right: 0, top: "33%", textAlign: "center", fontSize: 36, fontWeight: 900, color: "#facc15", textShadow: "0 3px 14px rgba(0,0,0,.7)", opacity: 0 }} />
          <div ref={pad} style={{ position: "absolute", left: "50%", bottom: 28, transform: "translateX(-50%)", padding: "12px 22px", borderRadius: 999, fontWeight: 900, fontSize: 15, background: "rgba(255,255,255,.14)", color: "#f8fafc", border: "2px solid rgba(255,255,255,.35)" }}>Hold anywhere</div>
        </>
      )}
      <div ref={fade} style={{ position: "absolute", inset: 0, background: "#000", opacity: 0, pointerEvents: "none" }} />
    </div>
  );
});
