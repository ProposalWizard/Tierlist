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
import type { WorldController, WorldOptions, WorldStatus } from "@/lib/star/world3d/testScene";

export default function World3D({ options, clean }: { options: WorldOptions; clean?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const ctrl = useRef<WorldController | null>(null);
  const [card, setCard] = useState<InteractCard | null>(null);
  const [status, setStatus] = useState<WorldStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const optsRef = useRef(options);
  optsRef.current = options;
  const key = `${options.place}|${options.demo ?? ""}|${options.quality ?? ""}`;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    setState("loading");
    setCard(null);
    import("@/lib/star/world3d/testScene")
      .then(({ startWorld3d }) => startWorld3d(el, {
        onCard: (c) => { if (!gone) setCard(c); },
        onStatus: (s) => { if (!gone) setStatus(s); },
        onContextLost: () => { if (!gone) setState("failed"); },
      }, { ...optsRef.current, chat: (id) => optsRef.current.chat?.(id) ?? null }))
      .then((c) => { if (gone) { c.dispose(); return; } ctrl.current = c; setState("ready"); })
      .catch((e) => { console.error("world3d", e); if (!gone) setState("failed"); });
    return () => { gone = true; ctrl.current?.dispose(); ctrl.current = null; };
  }, [key]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#0b0d12", overflow: "hidden", fontFamily: "system-ui, sans-serif" }} data-world3d={state}>
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
      {state !== "ready" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#cbd5e1", fontWeight: 800, fontSize: 14, background: "#0b0d12" }}>
          {state === "loading" ? "Opening…" : "3D could not open on this device."}
        </div>
      )}
      {state === "ready" && status && !clean && (
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 6, flexWrap: "wrap", pointerEvents: "none" }} data-world3d-status>
          <span style={chip("#facc15", "#111")}>{status.clock}</span>
          {status.people.map((p) => <span key={p.id} style={chip("rgba(8,10,16,.78)", "#f8fafc")}>{p.name}: {p.doing}</span>)}
        </div>
      )}
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
