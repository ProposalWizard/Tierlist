"use client";

/**
 * THE SHOPPING STREET (phase 1, 28 Nov 2026): a short high street you walk down from your
 * garden's gate. The 3D is lib/star/street3d/scene.ts, its plan (doors, what each opens, the
 * windows) lib/star/street3d/plan.ts. This is the screen round it: the stick (or tap where to go),
 * Back to the garden, the eye button, and a small card at each door:
 *
 *   KNOWITBALL   → the 3D shop (its own front doors bring you back out here)
 *   KIB MOTORS   → the shop's Cars aisle
 *   THE DRIP     → the shop's Drip aisle
 *   BARBER       → the barber's shop (components/star/Barber3D.tsx): the chair, a style, a cut
 *
 * Walking through an open door goes in (as the garden's doors do); the card's button does the same.
 * A lost 3D rebuilds itself (three3d/autoHeal.ts): twice a minute, Low after the first, then a plain
 * screen with "Tap to reload 3D" and the way back. Nothing is saved here.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { StreetController, StreetData } from "@/lib/star/street3d/scene";
import { boutiqueWindow, showroomCar, type StreetArrive, type StreetDoor } from "@/lib/star/street3d/plan";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { wornAt } from "@/lib/star/home3d/outfits";
import { afterLoss, healReset, newHealState, HEAL_DELAY_MS } from "@/lib/star/three3d/autoHeal";
import { parseQuality3d, quality3dTier } from "@/lib/star/three3d/quality";
import { isAbandonedScene } from "@/lib/star/three3d/perf";
import { Stick, pill } from "./Shop3D";
import Reload3dPill from "./Reload3d";
import LoadingCurtain from "./loading/LoadingCurtain";
import ViewToggle3D from "./ViewToggle3D";

const GOLD = "#facc15";
const INK = "#f7f1e8";
const BG = "#0d1420";

/** The card at each door: an icon and what the button says. */
export const DOOR_CARD: Record<StreetDoor, { icon: string; label: string }> = {
  shop: { icon: "🛍️", label: "Shop" },
  cars: { icon: "🚗", label: "Cars" },
  drip: { icon: "🧥", label: "Drip" },
  barber: { icon: "💈", label: "Barber" },
};

export interface Street3DProps {
  career: CareerState;
  /** Where you appear: the lane from the garden, or outside the door you came out of. */
  arrive?: StreetArrive;
  onBack: () => void;
  backLabel?: string;
  /** Went through a door. */
  onDoor: (id: StreetDoor) => void;
  /** Walked off the south end, down the lane to the garden. Absent: Back only. */
  onLeave?: () => void;
  /** Test page: fill its box on the admin frame instead of the whole screen. */
  embedded?: boolean;
}

/** What the street is built from, off a career (the screen and the test page). */
export function streetSceneData(career: CareerState, arrive: StreetArrive): StreetData {
  const kits = kitsOf(career.player.club);
  return {
    kits: { home: kits.home, away: kits.away },
    number: career.squadNumber ?? 10,
    player: { skin: skinToneHex(career.player.skinTone), hair: hairColourHex(career.player.hairColour), hairStyle: resolveHairStyle(career.player.hairStyle) },
    // the clothes from your house's wardrobe, as in the garden and the 3D shop
    worn: wornAt(career, "shop"),
    arrive,
    showroom: showroomCar(career),
    boutique: boutiqueWindow(career),
  };
}

export default function Street3D({ career, arrive = "gate", onBack, backLabel = "Garden", onDoor, onLeave, embedded = false }: Street3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const ctrl = useRef<StreetController | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [near, setNear] = useState<StreetDoor | "lane" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [build, setBuild] = useState(0);
  const heal = useRef(newHealState());
  const doorRef = useRef(onDoor);
  doorRef.current = onDoor;
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  // built once per visit, from the career as it was on the way in
  const data = useMemo(() => streetSceneData(career, arrive), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (embedded) return;
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, [embedded]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    let wait = 0;
    setState("loading");
    setNear(null);
    const lost = () => {
      if (gone) return;
      console.error("3D street: the phone took the 3D away");
      ctrl.current?.dispose();
      ctrl.current = null;
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
    const q = new URLSearchParams(window.location.search);
    const quality = build > 0 ? "low" : parseQuality3d(q.get("q")) ?? quality3dTier();
    const fixedStep = q.get("film") === "1" ? 1 / 30 : undefined;
    // a tick later, so React's dev double-mount never builds a second street
    const go = window.setTimeout(() => import("@/lib/star/street3d/scene")
      .then(({ startStreet }) => startStreet(el, {
        onNear: (s) => { if (!gone) setNear(s); },
        onDoor: (id) => {
          if (gone) return;
          setLeaving(true);
          doorRef.current(id);
        },
        onLeave: () => { if (gone || !leaveRef.current) return; setLeaving(true); leaveRef.current(); },
        onContextLost: lost,
      }, data, { quality, fixedStep, isDead: () => gone }))
      .then((c) => {
        if (gone) { c.dispose(); return; }
        ctrl.current = c;
        (window as unknown as { __street3d?: StreetController }).__street3d = c;
        setState("ready");
      })
      .catch((e) => { if (gone || isAbandonedScene(e)) return; console.error("3D street failed to load", e); lost(); }), 0);
    return () => {
      gone = true;
      window.clearTimeout(go); window.clearTimeout(wait);
      ctrl.current?.dispose(); ctrl.current = null;
      delete (window as unknown as { __street3d?: StreetController }).__street3d;
    };
  }, [build, data]);

  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);

  if (state === "failed") {
    return (
      <div style={{ position: embedded ? "absolute" : "fixed", inset: 0, zIndex: embedded ? 1 : 80, background: BG, color: INK, display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif" }} data-street3d="failed">
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>The street could not open its 3D on this phone</div>
          <button onClick={onBack} style={{ ...pill, marginTop: 16, cursor: "pointer" }}>&#8249; {backLabel}</button>
        </div>
        <Reload3dPill onReload={() => { healReset(heal.current); setState("loading"); setBuild((n) => n + 1); }} />
      </div>
    );
  }

  const card: React.CSSProperties = {
    position: "absolute", right: 12, bottom: "max(24px, calc(env(safe-area-inset-bottom) + 16px))", maxWidth: "min(66vw, 300px)",
    background: "rgba(14,12,10,0.86)", border: "1px solid rgba(250,204,21,0.25)", borderRadius: 18, padding: 12,
    backdropFilter: "blur(8px)", boxShadow: "0 16px 36px -14px rgba(0,0,0,.85)", display: "flex", alignItems: "center", gap: 10,
  };
  const goBtn: React.CSSProperties = { height: 38, padding: "0 16px", borderRadius: 12, border: "none", background: GOLD, color: "#111", fontWeight: 900, fontSize: 15, cursor: "pointer" };
  return (
    <div style={{ position: embedded ? "absolute" : "fixed", inset: 0, zIndex: embedded ? 1 : 80, background: BG, color: INK, overflow: "hidden", touchAction: "none", userSelect: "none", fontFamily: "system-ui, sans-serif" }} data-street3d={state}>
      <div
        ref={host}
        style={{ position: "absolute", inset: 0 }}
        onPointerDown={(e) => { drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          if (host.current?.dataset.pinching) { d.moved += 99; d.x = e.clientX; d.y = e.clientY; return; }
          d.moved += Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y);
          ctrl.current?.orbit(e.clientX - d.x, e.clientY - d.y);
          d.x = e.clientX; d.y = e.clientY;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && d.id === e.pointerId && d.moved < 10) ctrl.current?.tap(e.clientX, e.clientY);
        }}
        onPointerCancel={() => { drag.current = null; }}
      />

      {/* top bar: back to the garden */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "max(12px, env(safe-area-inset-top)) 12px 0", pointerEvents: "none" }}>
        <button onClick={onBack} aria-label="Back" data-street-back style={{ ...pill, pointerEvents: "auto", cursor: "pointer", gap: 4, paddingLeft: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>&#8249;</span>{backLabel}
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ ...pill, gap: 6 }} aria-label="High Street"><span aria-hidden>🛍️</span><b>High Street</b></div>
      </div>

      {state === "loading" && <div style={{ position: "absolute", inset: 0, background: BG }} />}
      <LoadingCurtain section="street" loading={state === "loading"} box={embedded} />

      {state === "ready" && <ViewToggle3D onChange={(m) => ctrl.current?.setView(m)} />}
      {state === "ready" && <Stick onMove={(x, y) => ctrl.current?.setStick(x, y)} />}

      {state === "ready" && near && near !== "lane" && (
        <div style={card} data-street-card={near}>
          <span aria-hidden style={{ fontSize: 24 }}>{DOOR_CARD[near].icon}</span>
          <button onClick={() => { setLeaving(true); onDoor(near); }} style={near === "barber" ? { ...goBtn, background: "#f4e3b5" } : goBtn}>{DOOR_CARD[near].label} &#8250;</button>
        </div>
      )}
      {state === "ready" && near === "lane" && onLeave && (
        <div style={card} data-street-card="lane">
          <span aria-hidden style={{ fontSize: 24 }}>🌳</span>
          <button onClick={() => { setLeaving(true); onLeave(); }} style={goBtn}>{backLabel} &#8250;</button>
        </div>
      )}

      {/* a quick fade as you step through a door */}
      <div style={{ position: "absolute", inset: 0, background: "#120e0b", opacity: leaving ? 1 : 0, pointerEvents: "none" }} />
    </div>
  );
}
