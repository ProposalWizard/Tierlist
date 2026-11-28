"use client";

/**
 * THE WORLD KIT'S TEST SCREEN (phase 1, /star-world3d-dev only): the house
 * lounge or the garden, alive (lib/star/world3d/testScene.ts). Tap the floor
 * to walk, tap a thing or a person to walk up to it; its card opens at the
 * bottom (one card for everything: lib/star/world3d/interact.ts). The clock
 * and who is doing what sit in a strip at the top. Not in the real game yet.
 */
import { useEffect, useRef, useState } from "react";
import type { InteractCard } from "@/lib/star/world3d/interact";
import { GymHud, type GymHudHandle } from "@/components/star/GymHud";
import type { WorldArrival, WorldController, WorldOptions, WorldStatus } from "@/lib/star/world3d/testScene";
import ViewToggle3D from "./ViewToggle3D";
import LoadingCurtain from "./loading/LoadingCurtain";
import { afterLoss, newHealState, HEAL_DELAY_MS } from "@/lib/star/three3d/autoHeal";

export default function World3D({ options, clean, onGo, onBack, backLabel = "Back", noStatus, onArrival }: { options: WorldOptions; clean?: boolean; onGo?: (place: WorldOptions["place"]) => void; /** A "‹ back" pill (the gym reached through the compound's door: back out of it). */ onBack?: () => void; backLabel?: string; /** the career: no clock-and-people strip at the top */ noStatus?: boolean; /** the drive's arrival, as it goes */ onArrival?: (a: WorldArrival) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const ctrl = useRef<WorldController | null>(null);
  const [card, setCard] = useState<InteractCard | null>(null);
  const [status, setStatus] = useState<WorldStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const hud = useRef<GymHudHandle>(null);
  const [gymOn, setGymOn] = useState(false);
  // the drive's arrival (options.arrive): Skip while the car comes in, then the team-mate's line
  const [arrival, setArrival] = useState<WorldArrival | null>(null);
  const arrivalRef = useRef(onArrival);
  arrivalRef.current = onArrival;
  const arriving = !!options.arrive && (!arrival || arrival.phase === "roll" || arrival.phase === "door");
  const optsRef = useRef(options);
  optsRef.current = options;
  const goRef = useRef(onGo);
  goRef.current = onGo;
  const key = `${options.place}|${options.demo ?? ""}|${options.quality ?? ""}|${options.homeGym ?? ""}|${options.startAt ?? ""}|${options.arrive?.car ?? ""}`;

  // the phone took the 3D away: rebuilt quietly (at Low) up to autoHeal's limit, then the message (3D places audit P2/P3)
  const heal = useRef(newHealState());
  const [build, setBuild] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false, wait = 0;
    setState("loading");
    setCard(null);
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
    // started a tick later, so React's dev double-mount never builds a second scene
    // (the first, thrown away, would still publish the film hook and the debug handle)
    const go = window.setTimeout(() => import("@/lib/star/world3d/testScene")
      .then(({ startWorld3d }) => startWorld3d(el, {
        onCard: (c) => { if (!gone) setCard(c); },
        onStatus: (s) => { if (!gone) setStatus(s); },
        onContextLost: lost,
        onGo: (p) => { if (!gone) goRef.current?.(p); },
        onArrive: (a) => { if (gone) return; setArrival(a); arrivalRef.current?.(a); },
        onGym: (f) => { if (gone) return; hud.current?.frame(f); const on = !!f.kind; setGymOn((was) => (was === on ? was : on)); },
      // a rebuild after a loss: at Low, and the arrival not played again (you are at your car)
      }, { ...optsRef.current, quality: build > 0 ? "low" : optsRef.current.quality, arrive: build > 0 && optsRef.current.arrive ? { ...optsRef.current.arrive, skip: true } : optsRef.current.arrive, chat: (id) => optsRef.current.chat?.(id) ?? null }))
      .then((c) => { if (gone) { c.dispose(); return; } ctrl.current = c; setState("ready"); })
      .catch((e) => { if (gone) return; console.error("world3d", e); lost(); }), 0);
    return () => { gone = true; window.clearTimeout(go); window.clearTimeout(wait); ctrl.current?.dispose(); ctrl.current = null; };
  }, [key, build]);

  // the gym on a computer: the space bar is your thumb
  useEffect(() => {
    if (options.place !== "gym") return;
    const kd = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); ctrl.current?.gymHold(true); } };
    const ku = (e: KeyboardEvent) => { if (e.code === "Space") ctrl.current?.gymHold(false); };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [options.place]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0b0d12", overflow: "hidden", fontFamily: "system-ui, sans-serif" }} data-world3d={state}>
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
      {/* the compound opens behind its own loading screen (keepie-uppies over a still of the compound) */}
      {options.place === "compound" && !options.demo && <LoadingCurtain section="compound" loading={state === "loading"} box />}
      {state !== "ready" && (options.place !== "compound" || options.demo || state === "failed") && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#cbd5e1", fontWeight: 800, fontSize: 14, background: "#0b0d12" }}>
          {state === "loading" ? "Opening…" : "3D could not open on this device."}
        </div>
      )}
      {state === "ready" && onBack && !gymOn && !arriving && (
        <button onClick={onBack} aria-label={`Back to ${backLabel}`} data-world3d-back
          style={{ position: "absolute", top: options.place === "gym" && !clean ? 146 : 10, left: 10, zIndex: 2, display: "inline-flex", alignItems: "center", gap: 4, height: 36, padding: "0 12px 0 10px", borderRadius: 999, background: "rgba(8,10,16,.78)", color: "#f8fafc", fontWeight: 800, fontSize: 14, border: "1px solid rgba(255,255,255,.14)", cursor: "pointer" }}>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>&#8249;</span>{backLabel}
        </button>
      )}
      {state === "ready" && !clean && arriving && (
        <button data-arrive-skip onClick={() => ctrl.current?.skipArrive()} style={{ position: "absolute", top: 12, right: 12, padding: "7px 11px", borderRadius: 999, background: "rgba(8,10,16,.72)", color: "#f8fafc", fontSize: 12.5, fontWeight: 900, border: "none", cursor: "pointer" }}>Skip ›</button>
      )}
      {arrival?.caption && (
        <div data-arrive-caption style={{ position: "absolute", left: 20, right: 20, top: "30%", textAlign: "center", color: "#fff", fontSize: 21, fontWeight: 900, lineHeight: 1.3, textShadow: "0 2px 10px rgba(0,0,0,.6)", pointerEvents: "none" }}>
          {arrival.caption}
          <div style={{ fontSize: 12, fontWeight: 800, color: "#facc15", marginTop: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>Training ground</div>
        </div>
      )}
      {state === "ready" && status && !clean && !noStatus && !gymOn && !arriving && (
        <div style={{ position: "absolute", top: onBack && options.place !== "gym" ? 52 : 10, left: 10, right: 10, display: "flex", gap: 6, flexWrap: "wrap", pointerEvents: "none" }} data-world3d-status>
          <span style={chip("#facc15", "#111")}>{status.clock}</span>
          {status.people.map((p) => <span key={p.id} style={chip("rgba(8,10,16,.78)", "#f8fafc")}>{p.name}: {p.doing}</span>)}
        </div>
      )}
      {state === "ready" && options.place === "gym" && (
        <GymHud ref={hud} fitness={clean ? undefined : status?.fitness} body={status?.fitness?.body ?? null} film={!!options.demo} onHold={(on) => ctrl.current?.gymHold(on)} onAct={(id) => ctrl.current?.act(id)} />
      )}
      {state === "ready" && !(options.place === "gym" && gymOn) && !arriving && <ViewToggle3D onChange={(m) => ctrl.current?.setView(m)} style={{ top: "auto", bottom: card ? 200 : 16 }} />}
      {card && (
        <div data-world3d-card style={{ position: "absolute", left: 12, right: 12, bottom: 16, maxWidth: 460, margin: "0 auto", padding: "12px 14px", borderRadius: 14, background: "rgba(8,10,16,.9)", color: "#f8fafc", borderTop: "3px solid #facc15", boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>
          {card.sub && <div style={{ fontSize: 11, fontWeight: 900, color: "#facc15", textTransform: "uppercase", letterSpacing: 0.5 }}>{card.sub}</div>}
          <div style={{ fontSize: 18, fontWeight: 900 }}>{card.title}</div>
          {card.lines.map((l, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.35, marginTop: 4, color: i ? "#cbd5e1" : "#f8fafc" }}>{l}</div>)}
          {card.change && <div style={{ fontSize: 12, fontWeight: 800, color: "#86efac", marginTop: 6 }}>{card.change}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {card.actions.map((a) => (
              <button key={a.id} onClick={() => ctrl.current?.act(a.id)} data-act={a.id}
                style={{ flex: a.primary ? 2 : 1, height: 40, borderRadius: 10, border: a.primary ? "none" : "1px solid rgba(255,255,255,.25)", background: a.primary ? "#facc15" : "transparent", color: a.primary ? "#111" : "#f8fafc", fontWeight: 900, fontSize: 14, cursor: "pointer" }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const chip = (bg: string, fg: string): React.CSSProperties => ({ padding: "4px 8px", borderRadius: 999, background: bg, color: fg, fontSize: 11.5, fontWeight: 800 });
