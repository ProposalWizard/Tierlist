"use client";

/**
 * THE 3D CASINO (Harry, 8 Oct 2026: "start work on making the casino 3D and
 * adding it to the garden/shop walkable area").
 *
 * The 3D is lib/star/casino3d/scene.ts; this is the screen around it: the
 * stick (or tap where to go), Home, your money, and a small card when you
 * walk up to a station. Each station opens the casino's EXISTING game over
 * the room (components/star/Casino.tsx, opened straight into that one game;
 * Goalie Mode is GoalieMode.tsx inside it). Closing the game brings you back
 * to the room where you stood. Nothing about the games is changed here.
 *
 *   Roulette table  → Roulette        Slot machines   → Slots
 *   Blackjack table → Blackjack       Racing screen   → Horse racing
 *   Betting counter → Competition bets
 *   Arcade cabinet  → Goalie Mode
 *
 * You get here two ways: walk through the casino's doors in the 3D garden,
 * or Home → Casino when Settings → Look → "Casino" is 3D (lib/star/casino3d/
 * look.ts). The doors at the back of you lead out into the garden, at the
 * casino's doors. If the phone can't run the 3D, the classic casino menu
 * shows instead, so nothing is lost.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { CasinoController, CasinoStation, CasinoCallbacks } from "@/lib/star/casino3d/scene";
import type { CasinoGameId } from "./Casino";
import { kitsOf } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";
import { shop3dPlayerLook } from "@/lib/star/signing3d";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { quality3dTier, parseQuality3d } from "@/lib/star/three3d/quality";
import { people3dLook, fallBackToOldPeople } from "@/lib/star/look3d";
import { Stick, pill } from "./Shop3D";

const INK = "#f7f1e8";
const GOLD = "#facc15";
const q0 = (k: string) => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(k));

/** What each station is called and shows on its card. */
export const CASINO_STATIONS: Record<CasinoStation, { icon: string; label: string }> = {
  roulette: { icon: "🎡", label: "Roulette" },
  blackjack: { icon: "🃏", label: "Blackjack" },
  slots: { icon: "🎰", label: "Slots" },
  horses: { icon: "🐎", label: "Horse racing" },
  bets: { icon: "🏆", label: "Bets" },
  goalie: { icon: "🧤", label: "Goalie Mode" },
};

export interface Casino3DProps {
  career: CareerState;
  /** Home (the top-left button). */
  onBack: () => void;
  backLabel?: string;
  /** Walked out through the doors: into the garden at the casino's doors. */
  onDoor?: () => void;
  /** One game over the room (`game`), or the whole classic casino when the
   *  3D can't run (`game` undefined). `done` closes it. The page keeps all
   *  the casino's money handling (app/star-dev/page.tsx). */
  renderGame: (game: CasinoGameId | undefined, done: () => void) => React.ReactNode;
}

export default function Casino3D({ career, onBack, backLabel = "Home", onDoor, renderGame }: Casino3DProps) {
  const holder = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<CasinoController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [near, setNear] = useState<CasinoStation | null>(null);
  const [open, setOpen] = useState<CasinoStation | null>(null);
  const [leaving, setLeaving] = useState(false);
  const doorRef = useRef(onDoor);
  doorRef.current = onDoor;

  // built once per visit (the money changes as you play; the room doesn't)
  const opts = useMemo(() => ({
    kit: kitsOf(career.player.club).home,
    number: career.squadNumber ?? 10,
    player: {
      look: q0("player") === "old" || q0("player") === "new" ? (q0("player") as "old" | "new") : shop3dPlayerLook(),
      skin: skinToneHex(career.player.skinTone),
      hair: hairColourHex(career.player.hairColour),
      hairStyle: resolveHairStyle(career.player.hairStyle),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  const [restarts, setRestarts] = useState(0);
  useEffect(() => {
    let dead = false;
    const el = holder.current;
    if (!el || restarts > 1) return;
    (async () => {
      try {
        const mod = await import("@/lib/star/casino3d/scene");
        const tier = restarts > 0 ? "low" : parseQuality3d(q0("q")) ?? quality3dTier();
        const cbs: CasinoCallbacks = {
          onNear: (s) => setNear(s),
          onArrive: (s) => { if (!dead) setOpen(s); },
          onFps: (f) => { (window as unknown as { __casino3dFps?: number }).__casino3dFps = f; },
          onDoor: () => {
            if (dead || !doorRef.current) return;
            setLeaving(true);
            setTimeout(() => doorRef.current?.(), 350);
          },
          onContextLost: () => {
            if (dead) return;
            console.error("3D casino: the phone took the 3D away");
            ctrlRef.current?.dispose();
            ctrlRef.current = null;
            setStatus("loading");
            setRestarts((n) => n + 1);
          },
        };
        const fixedStep = q0("film") === "1" ? 1 / 30 : undefined;
        const start = () => mod.startCasino(el, onDoor ? cbs : { ...cbs, onDoor: undefined }, { ...opts, quality: tier, fixedStep });
        let c: CasinoController;
        try {
          c = await start();
        } catch (e1) {
          if (dead || people3dLook() !== "new") throw e1;
          console.error("3D casino: one body failed, retrying with the old body", e1);
          fallBackToOldPeople();
          el.replaceChildren();
          c = await start();
        }
        if (dead) { c.dispose(); return; }
        ctrlRef.current = c;
        (window as unknown as { __casino3d?: CasinoController }).__casino3d = c;
        setStatus("ready");
      } catch (e) {
        console.error("3D casino failed to load", e);
        if (!dead) setStatus("error");
      }
    })();
    return () => {
      dead = true;
      ctrlRef.current?.dispose();
      ctrlRef.current = null;
      delete (window as unknown as { __casino3d?: CasinoController }).__casino3d;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restarts]);
  useEffect(() => { if (restarts > 1) setStatus("error"); }, [restarts]);

  // a game over the room: the room stops drawing until it closes. Closing
  // it, he cheers if the money went up while it was open, groans if it fell.
  const moneyNow = useRef(career.money);
  moneyNow.current = career.money;
  const moneyAtOpen = useRef<number | null>(null);
  useEffect(() => {
    const c = ctrlRef.current;
    c?.setPaused(open !== null);
    if (open !== null) { moneyAtOpen.current = moneyNow.current; return; }
    const before = moneyAtOpen.current;
    moneyAtOpen.current = null;
    if (before !== null) c?.react(Math.sign(moneyNow.current - before));
  }, [open]);

  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);

  if (status === "error") return <>{renderGame(undefined, onBack)}</>;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "#14070b", color: INK, overflow: "hidden", touchAction: "none", userSelect: "none" }} data-casino3d>
      <div
        ref={holder}
        style={{ position: "absolute", inset: 0 }}
        onPointerDown={(e) => { drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          d.moved += Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y);
          ctrlRef.current?.orbit(e.clientX - d.x);
          d.x = e.clientX; d.y = e.clientY;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && d.id === e.pointerId && d.moved < 10) ctrlRef.current?.tap(e.clientX, e.clientY);
        }}
        onPointerCancel={() => { drag.current = null; }}
      />

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "max(12px, env(safe-area-inset-top)) 12px 0", pointerEvents: "none" }}>
        <button onClick={onBack} aria-label="Back" style={{ ...pill, pointerEvents: "auto", cursor: "pointer", gap: 4, paddingLeft: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>&#8249;</span>{backLabel}
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ ...pill, gap: 6 }} aria-label="Money">
          <span aria-hidden style={{ fontSize: 15 }}>★</span><b style={{ color: GOLD }}>{formatMoney(career.money)}</b>
        </div>
      </div>

      {status === "loading" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, border: "4px solid rgba(255,255,255,0.15)", borderTopColor: GOLD, animation: "c3dspin 0.9s linear infinite" }} />
          <style>{"@keyframes c3dspin{to{transform:rotate(360deg)}}"}</style>
        </div>
      )}

      {status === "ready" && !open && <Stick onMove={(x, y) => ctrlRef.current?.setStick(x, y)} />}

      {status === "ready" && !open && near && (
        <div
          style={{
            position: "absolute", right: 12, bottom: "max(24px, calc(env(safe-area-inset-bottom) + 16px))", maxWidth: "min(62vw, 300px)",
            background: "rgba(20,8,12,0.88)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 18, padding: 12,
            backdropFilter: "blur(8px)", boxShadow: "0 16px 36px -14px rgba(0,0,0,.85)", display: "flex", alignItems: "center", gap: 10,
          }}
          data-casino-card={near}
        >
          <span aria-hidden style={{ fontSize: 26 }}>{CASINO_STATIONS[near].icon}</span>
          <button onClick={() => setOpen(near)} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "none", background: GOLD, color: "#111", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
            {CASINO_STATIONS[near].label} &#8250;
          </button>
        </div>
      )}

      {/* the station's game, over the room */}
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 95, overflowY: "auto", touchAction: "auto", userSelect: "auto", background: "#05080f" }} data-casino-game={open}>
          {renderGame(open, () => setOpen(null))}
        </div>
      )}

      <div style={{ position: "absolute", inset: 0, background: "#120e0b", opacity: leaving ? 1 : 0, transition: "opacity 0.35s ease", pointerEvents: "none" }} />
    </div>
  );
}
