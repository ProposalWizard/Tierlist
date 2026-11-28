"use client";

/**
 * THE DRIVE (driving phase 1, 28 Nov 2026; docs/plans/DRIVING_PLAN.md). Test page only
 * (/star-drive3d-dev): garden gate → your car → your street, the roundabout, the country lane →
 * the compound (the arrival) — or, on the way back, a fork: Home / Casino / Shop.
 *
 * On a phone: the car drives itself. HOLD anywhere = faster. TAP the left or right half = change
 * lane (overtake). Settings "Steer": Lanes (that) | Stick (a thumb stick, bottom left) | Tilt
 * (tilt the phone). Skip is there from the first frame. The camera button cycles chase → bumper
 * → in the car. A call rings on the dash: answer Yes or No.
 */
import { useEffect, useRef, useState } from "react";
import type { DriveController, DriveSceneOptions, DriveUi } from "@/lib/star/drive3d/scene";
import type { CallMemory } from "@/lib/star/drive3d/calls";
import type { DriveEffect } from "@/lib/star/drive3d/events";
import type { ForkChoice } from "@/lib/star/drive3d/drive";
import LoadingCurtain from "@/components/star/loading/LoadingCurtain";
import { afterLoss, newHealState, HEAL_DELAY_MS } from "@/lib/star/three3d/autoHeal";

export interface Drive3DProps {
  options: DriveSceneOptions;
  clean?: boolean;
  /** `handover`: the drive in ended on the compound road: open the compound with its arrival (World3D options.arrive). */
  /** `effects`: what the drive's event changes in the career (dilemmas.ts applyEffects, one each). */
  onDone?: (r: { skipped: boolean; fork: ForkChoice | null; memories: CallMemory[]; handover: boolean; effects: DriveEffect[] }) => void;
  onMemory?: (m: CallMemory) => void;
}

const TAP_MS = 230;

export default function Drive3D({ options, clean, onDone, onMemory }: Drive3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const ctrl = useRef<DriveController | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [ui, setUi] = useState<DriveUi | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;
  const cbRef = useRef({ onDone, onMemory });
  cbRef.current = { onDone, onMemory };
  const key = `${options.car}|${options.leg}|${options.quality ?? ""}|${options.mode}|${options.call ?? ""}|${options.seed ?? ""}|${options.event ?? ""}`;

  // the phone took the 3D away: rebuilt quietly (at Low) up to autoHeal's limit, then the message (3D places audit)
  const heal = useRef(newHealState());
  const [build, setBuild] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false, wait = 0;
    setState("loading"); setUi(null); setDone(null);
    const lost = () => {
      if (gone) return;
      ctrl.current?.dispose(); ctrl.current = null;
      if (afterLoss(heal.current, Date.now()) === "give-up") { setState("failed"); return; }
      setState("loading");
      wait = window.setTimeout(async () => {
        const m = await import("@/lib/star/three3d/perf");
        if (gone) return;
        m.dropSharedRenderer();
        el.replaceChildren();
        setBuild((n) => n + 1);
      }, HEAL_DELAY_MS);
    };
    const go = window.setTimeout(() => import("@/lib/star/drive3d/scene")
      .then(({ startDrive }) => startDrive(el, {
        onUi: (u) => { if (!gone) setUi(u); },
        onDone: (r) => { if (gone) return; if (!r.handover) setDone(r.fork ? `→ ${r.fork[0].toUpperCase()}${r.fork.slice(1)}` : r.skipped ? "Skipped: at training" : "At training"); cbRef.current.onDone?.(r); },
        onMemory: (m) => cbRef.current.onMemory?.(m),
        onContextLost: lost,
      }, { ...optsRef.current, quality: build > 0 ? "low" : optsRef.current.quality, isDead: () => gone }))
      .then((c) => {
        if (gone) { c.dispose(); return; }
        ctrl.current = c; setState("ready");
        // the drive in hands over to the compound: fetch its code while you drive, so its loading screen is short
        if (optsRef.current.leg === "in") window.setTimeout(() => { void import("@/lib/star/world3d/testScene"); void import("@/lib/star/world3d/compoundPlace"); }, 4000);
      })
      .catch((e) => { if (gone) return; console.error("drive3d", e); lost(); }), 0);
    return () => { gone = true; window.clearTimeout(go); window.clearTimeout(wait); ctrl.current?.dispose(); ctrl.current = null; };
  }, [key, build]);

  // a computer: space = hold, ←/→ = lanes (or steer), C = camera, S = skip
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const c = ctrl.current; if (!c) return;
      if (e.code === "Space") { e.preventDefault(); c.hold(true); }
      if (e.code === "ArrowLeft") { if (options.mode === "lanes") c.tap(-1); else c.side(1); }
      if (e.code === "ArrowRight") { if (options.mode === "lanes") c.tap(1); else c.side(-1); }
      if (e.code === "KeyC") c.cam();
    };
    const ku = (e: KeyboardEvent) => { const c = ctrl.current; if (!c) return; if (e.code === "Space") c.hold(false); if (e.code === "ArrowLeft" || e.code === "ArrowRight") c.side(0); };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [options.mode]);

  // tilt: the phone's left-right tilt slides you across (20° = full)
  useEffect(() => {
    if (options.mode !== "tilt") return;
    const f = (e: DeviceOrientationEvent) => { const g = e.gamma ?? 0; ctrl.current?.side(Math.max(-1, Math.min(1, -g / 20))); };
    window.addEventListener("deviceorientation", f);
    return () => window.removeEventListener("deviceorientation", f);
  }, [options.mode]);

  // the thumb: down = hold (faster); a quick tap on a half = a lane change
  const down = useRef<{ t: number; x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (!ctrl.current) return;
    down.current = { t: performance.now(), x: e.clientX, y: e.clientY };
    ctrl.current.hold(true);
  };
  const onUp = (e: React.PointerEvent) => {
    const c = ctrl.current, d = down.current; down.current = null;
    if (!c || !d) return;
    c.hold(false);
    if (options.mode === "lanes" && performance.now() - d.t < TAP_MS && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 18) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      c.tap(e.clientX < r.left + r.width / 2 ? -1 : 1);
    }
  };

  // the thumb stick (Steer: Stick)
  const stick = useRef<{ x0: number } | null>(null);
  const [knob, setKnob] = useState(0);
  const stickDown = (e: React.PointerEvent) => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); stick.current = { x0: e.clientX }; };
  const stickMove = (e: React.PointerEvent) => { if (!stick.current) return; const v = Math.max(-1, Math.min(1, (e.clientX - stick.current.x0) / 44)); setKnob(v); ctrl.current?.side(-v); };
  const stickUp = () => { stick.current = null; setKnob(0); ctrl.current?.side(0); };

  const driving = ui && (ui.phase === "drive" || ui.phase === "intro");
  const call = ui?.call;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0b0d12", overflow: "hidden", fontFamily: "system-ui, sans-serif", userSelect: "none", WebkitUserSelect: "none" }} data-drive3d={state}>
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
      {/* the thumb area: the whole screen under the buttons */}
      {state === "ready" && <div data-drive-pad onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} style={{ position: "absolute", inset: 0, touchAction: "none" }} />}
      <LoadingCurtain section="drive" loading={state === "loading"} box />
      {state === "failed" && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#cbd5e1", fontWeight: 800 }}>3D could not open on this device.</div>}

      {/* black for the door moment, the fork and a skip */}
      {ui && ui.fade > 0 && <div style={{ position: "absolute", inset: 0, background: "#000", opacity: ui.fade, pointerEvents: "none" }} />}
      {ui?.caption && (
        <div data-drive-caption style={{ position: "absolute", left: 20, right: 20, bottom: "38%", textAlign: "center", color: "#fff", fontSize: 21, fontWeight: 900, lineHeight: 1.3, textShadow: "0 2px 10px rgba(0,0,0,.6)", pointerEvents: "none" }}>
          {ui.caption}
          <div style={{ fontSize: 12, fontWeight: 800, color: "#facc15", marginTop: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>Training ground</div>
        </div>
      )}

      {state === "ready" && ui && !clean && (
        <>
          {/* top: Skip (from the first frame) and the camera */}
          <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 8 }}>
            {driving && <button data-drive-cam onClick={() => ctrl.current?.cam()} style={pill("rgba(8,10,16,.72)", "#f8fafc")}>🎥 {ui.cam === "chase" ? "Behind" : ui.cam === "bumper" ? "Bumper" : "In the car"}</button>}
            {ui.phase !== "done" && <button data-drive-skip onClick={() => ctrl.current?.skip()} style={pill("rgba(8,10,16,.72)", "#f8fafc")}>Skip ›</button>}
          </div>
          {driving && (
            <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6, pointerEvents: "none" }}>
              <span data-drive-mph style={pill("rgba(8,10,16,.72)", "#f8fafc")}>{ui.mph} mph</span>
              {ui.blocked && <span style={pill("#dc2626", "#fff")}>📯 Not now</span>}
            </div>
          )}
          {driving && options.mode === "lanes" && ui.t < 6 && !call && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, textAlign: "center", color: "rgba(255,255,255,.88)", fontSize: 12.5, fontWeight: 800, textShadow: "0 1px 6px rgba(0,0,0,.7)", pointerEvents: "none" }}>
              Hold to go faster · tap a side to change lane
            </div>
          )}
          {driving && options.mode === "stick" && (
            <div onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}
              style={{ position: "absolute", left: 22, bottom: 30, width: 120, height: 56, borderRadius: 28, background: "rgba(8,10,16,.5)", border: "2px solid rgba(255,255,255,.35)", touchAction: "none" }}>
              <div style={{ position: "absolute", top: 6, left: 38 + knob * 34, width: 40, height: 40, borderRadius: 20, background: "#facc15" }} />
            </div>
          )}

          {/* the call on the dash */}
          {call && (call.state === "ringing" || call.state === "answered") && (
            <div data-drive-call data-bubble-clear style={{ position: "absolute", left: 12, right: 12, bottom: 18, maxWidth: 420, margin: "0 auto", padding: "12px 14px", borderRadius: 16, background: "rgba(8,10,16,.92)", color: "#f8fafc", borderTop: "3px solid #22c55e", boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: "#16a34a", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 18 }}>{call.caller[0]}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{call.caller}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "#86efac" }}>{call.state === "ringing" ? "On the dash · calling" : "On the phone"}</div>
                </div>
              </div>
              {call.state === "ringing" && (
                <>
                  {call.lines.map((l, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.35, marginTop: i ? 3 : 9 }}>{l}</div>)}
                  <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                    <button data-drive-answer="no" onPointerDown={(e) => e.stopPropagation()} onClick={() => ctrl.current?.answer("no")} style={btn(false)}>{call.no}</button>
                    <button data-drive-answer="yes" onPointerDown={(e) => e.stopPropagation()} onClick={() => ctrl.current?.answer("yes")} style={btn(true)}>{call.yes}</button>
                  </div>
                </>
              )}
              {call.state === "answered" && (
                <>
                  <div style={{ fontSize: 14, marginTop: 9 }}>“{call.reply}”</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#facc15", marginTop: 6 }}>{call.effect}</div>
                </>
              )}
            </div>
          )}

          {/* the event's card (lib/star/drive3d/events.ts): a choice, the camera's Slow down, or a notice */}
          {ui.event && !(call && (call.state === "ringing" || call.state === "answered")) && (
            <div data-drive-event={ui.event.id} data-bubble-clear style={{ position: "absolute", left: 12, right: 12, bottom: 18, maxWidth: 420, margin: "0 auto", padding: "12px 14px", borderRadius: 16, background: "rgba(8,10,16,.92)", color: "#f8fafc", borderTop: "3px solid #f59e0b", boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: "#b45309", display: "grid", placeItems: "center", fontSize: 20 }}>{ui.event.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{ui.event.title}</div>
              </div>
              {ui.event.state === "open" && (
                <>
                  {ui.event.lines.map((l, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.35, marginTop: i ? 3 : 9 }}>{l}</div>)}
                  {ui.event.helping ? (
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#facc15", marginTop: 10 }}>Pulling over to help…</div>
                  ) : ui.event.racing ? (
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#facc15", marginTop: 10 }}>Foot down! Racing to the car park…</div>
                  ) : ui.event.kind === "brake" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                      <button data-drive-event-answer="yes" disabled={ui.event.slowing} onPointerDown={(e) => e.stopPropagation()} onClick={() => ctrl.current?.event("yes")} style={{ ...btn(!ui.event.slowing), opacity: ui.event.slowing ? 0.7 : 1 }}>{ui.event.slowing ? "Slowing to 37…" : ui.event.yes}</button>
                    </div>
                  ) : ui.event.kind === "choice" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                      <button data-drive-event-answer="no" onPointerDown={(e) => e.stopPropagation()} onClick={() => ctrl.current?.event("no")} style={btn(false)}>{ui.event.no}</button>
                      <button data-drive-event-answer="yes" onPointerDown={(e) => e.stopPropagation()} onClick={() => ctrl.current?.event("yes")} style={btn(true)}>{ui.event.yes}</button>
                    </div>
                  ) : null}
                </>
              )}
              {ui.event.state === "done" && (
                <>
                  {ui.event.kind === "notice" && ui.event.lines.map((l, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.35, marginTop: i ? 3 : 9 }}>{l}</div>)}
                  <div style={{ fontSize: 14, marginTop: 9 }}>{ui.event.line}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#facc15", marginTop: 6 }}>{ui.event.effect}</div>
                </>
              )}
            </div>
          )}
          {ui.event?.flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.75, pointerEvents: "none" }} />}

          {/* the fork (the way back) */}
          {ui.fork && !ui.forkChoice && (
            <div data-drive-fork data-bubble-clear style={{ position: "absolute", left: 12, right: 12, bottom: 22, maxWidth: 420, margin: "0 auto", display: "flex", gap: 8 }}>
              {(["home", "casino", "shop"] as ForkChoice[]).map((f) => (
                <button key={f} data-fork={f} onPointerDown={(e) => e.stopPropagation()} onClick={() => ctrl.current?.fork(f)} style={{ ...btn(f === "home"), flex: 1, height: 52, fontSize: 16 }}>
                  {f === "home" ? "← Home" : f === "casino" ? "↑ Casino" : "Shop →"}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {done && !clean && <div data-drive-done style={{ position: "absolute", left: 0, right: 0, top: "45%", textAlign: "center", color: "#fff", fontWeight: 900, fontSize: 22 }}>{done}</div>}
    </div>
  );
}

const pill = (bg: string, fg: string): React.CSSProperties => ({ padding: "7px 11px", borderRadius: 999, background: bg, color: fg, fontSize: 12.5, fontWeight: 900, border: "none", cursor: "pointer" });
const btn = (primary: boolean): React.CSSProperties => ({ flex: primary ? 2 : 1, height: 42, borderRadius: 11, border: primary ? "none" : "1px solid rgba(255,255,255,.28)", background: primary ? "#facc15" : "transparent", color: primary ? "#111" : "#f8fafc", fontWeight: 900, fontSize: 14, cursor: "pointer" });
