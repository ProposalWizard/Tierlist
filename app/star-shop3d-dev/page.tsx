"use client";

/**
 * 3D SHOP — a test area (Harry, 1 Oct 2026): "still kinda had a different
 * idea of actually playing a 3d person going shopping but you can go ahead
 * and do that in the test area maybe".
 *
 * You walk a 3D footballer round a small shop (on-screen stick on a phone,
 * WASD / arrows on a computer). Walk up to a display — boots wall, car,
 * KIB fridge, counter — and its card opens with the item's five levels and
 * prices from the real shop data. Buying is pretend: "Bought (test only)".
 * Nothing reaches a career and nothing is saved.
 *
 * The 3D itself is lib/star/shop3d/scene.ts (three.js, fetched from a CDN at
 * runtime — not a dependency of the site).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageGuide from "@/components/admin/PageGuide";
import { shopDisplays, type DisplayId } from "@/lib/star/shop3d/catalogue";
import type { ShopController } from "@/lib/star/shop3d/scene";
import { CLUB_KITS } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";

const INK = "#f2f5f9";
const MUTED = "#9aa6b8";
const CLUBS = ["Chelsea", "Arsenal", "Liverpool", "Manchester City", "Tottenham Hotspur", "Newcastle United", "Aston Villa"]
  .filter((c) => CLUB_KITS[c]);

export default function Shop3DPage() {
  const holder = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<ShopController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fps, setFps] = useState(0);
  const [near, setNear] = useState<DisplayId | null>(null);
  const [dismissed, setDismissed] = useState<DisplayId | null>(null);
  const [club, setClub] = useState(0);
  const [itemIx, setItemIx] = useState(0);
  const [levelIx, setLevelIx] = useState(0);
  const [bought, setBought] = useState<Record<string, true>>({});
  const displays = useMemo(() => shopDisplays(), []);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // Start the 3D once. Fails to a plain message (three.js comes from a CDN).
  useEffect(() => {
    let dead = false;
    const el = holder.current;
    if (!el) return;
    (async () => {
      try {
        const { startShop } = await import("@/lib/star/shop3d/scene");
        const kit = CLUB_KITS[CLUBS[0]].home;
        // ?q=low: no shadows, fewer pixels. ?film=1: for filming (see scene.ts).
        const q = new URLSearchParams(window.location.search);
        const c = await startShop(el, {
          onNear: (id) => setNear(id),
          onFps: (f) => {
            setFps(f);
            (window as unknown as { __shop3dFps?: number }).__shop3dFps = f;
          },
        }, kit, {
          quality: q.get("q") === "low" ? "low" : "high",
          fixedStep: q.get("film") === "1" ? 1 / 30 : undefined,
        });
        if (dead) { c.dispose(); return; }
        ctrlRef.current = c;
        c.setBootColours(displays.boots.items.map((i) => i.colour));
        c.select("car", 0, displays.car.items[0].colour);
        (window as unknown as { __shop3d?: ShopController }).__shop3d = c;
        setStatus("ready");
      } catch (e) {
        console.error("3D shop failed to load", e);
        if (!dead) setStatus("error");
      }
    })();
    return () => { dead = true; ctrlRef.current?.dispose(); ctrlRef.current = null; };
  }, [displays]);

  // Kit follows the club picked.
  useEffect(() => { ctrlRef.current?.setKit(CLUB_KITS[CLUBS[club]].home); }, [club, status]);

  // Arriving at a display: pick the item you're standing at, level 1.
  useEffect(() => {
    if (!near) { setDismissed(null); return; }
    const c = ctrlRef.current;
    const ix = c ? c.nearestItem(near) : 0;
    setItemIx(ix);
    setLevelIx(0);
    ctrlRef.current?.setStick(0, 0);
  }, [near]);

  const open = near && dismissed !== near ? displays[near] : null;
  const item = open ? open.items[Math.min(itemIx, open.items.length - 1)] : null;
  const level = item ? item.levels[Math.min(levelIx, item.levels.length - 1)] : null;
  const buyKey = item && level ? `${item.id}:${level.label}` : "";

  useEffect(() => {
    if (open && item) ctrlRef.current?.select(open.id, itemIx, item.colour);
  }, [open, item, itemIx]);
  const isOpen = !!open;
  useEffect(() => { ctrlRef.current?.setCardOpen(isOpen); }, [isOpen]);
  const [filming, setFilming] = useState(false);
  useEffect(() => { setFilming(new URLSearchParams(window.location.search).get("film") === "1"); }, []);

  const step = (d: number) => {
    if (!open) return;
    const n = open.items.length;
    setItemIx((i) => (i + d + n) % n);
    setLevelIx(0);
  };
  const buy = () => {
    if (!buyKey) return;
    setBought((b) => ({ ...b, [buyKey]: true }));
    ctrlRef.current?.playBuy();
  };
  const close = () => { if (near) setDismissed(near); ctrlRef.current?.setStick(0, 0); };

  // Drag on the view (not the stick or the card) swings the camera.
  const drag = useRef<{ id: number; x: number } | null>(null);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0d12", color: INK, overflow: "hidden", touchAction: "none", userSelect: "none" }}>
      <div
        ref={holder}
        style={{ position: "absolute", inset: 0 }}
        onPointerDown={(e) => { drag.current = { id: e.pointerId, x: e.clientX }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          ctrlRef.current?.orbit(e.clientX - d.x);
          d.x = e.clientX;
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      />

      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "12px 12px 0", pointerEvents: "none" }}>
        <Link href="/star-3d-area-dev" aria-label="Back" style={{ ...pill, pointerEvents: "auto", width: 36, justifyContent: "center", fontSize: 18 }}>&#8249;</Link>
        <div style={{ ...pill, fontWeight: 900, fontSize: 15 }}>3D Shop</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setClub((c) => (c + 1) % CLUBS.length)} style={{ ...pill, pointerEvents: "auto", cursor: "pointer", gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: CLUB_KITS[CLUBS[club]].home.shirt, border: `2px solid ${CLUB_KITS[CLUBS[club]].home.trim}` }} />
          {CLUBS[club]}
        </button>
      </div>
      {status === "ready" && !filming && (
        <div style={{ position: "absolute", top: 54, right: 12, fontSize: 11, fontWeight: 800, color: MUTED, background: "rgba(0,0,0,0.35)", padding: "2px 7px", borderRadius: 999 }}>
          {fps} fps
        </div>
      )}

      {status !== "ready" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          {status === "loading" ? (
            <div style={{ fontWeight: 800, color: MUTED }}>Opening the shop…</div>
          ) : (
            <div style={{ maxWidth: 300 }}>
              <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 6 }}>The 3D shop didn&apos;t load</div>
              <div style={{ fontWeight: 600, color: MUTED, fontSize: 14, lineHeight: 1.5 }}>
                It needs the internet to fetch its 3D engine. Check the connection and reload.
              </div>
            </div>
          )}
        </div>
      )}

      {status === "ready" && !open && <Stick onMove={(x, y) => ctrlRef.current?.setStick(x, y)} />}
      {status === "ready" && !open && !near && (
        <div style={{ position: "absolute", bottom: 92, right: 16, maxWidth: 170, textAlign: "right", fontSize: 12, fontWeight: 700, color: MUTED, lineHeight: 1.4, pointerEvents: "none" }}>
          Walk up to a display to see it. Drag the view to look round.
        </div>
      )}

      {open && item && level && (
        <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, background: "rgba(14,17,24,0.94)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 14, backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{open.title}</div>
            <div style={{ flex: 1 }} />
            <button onClick={close} aria-label="Close" style={{ ...round, fontSize: 15 }}>&#10005;</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 10px" }}>
            {open.items.length > 1 && <button onClick={() => step(-1)} aria-label="Previous" style={round}>&#8249;</button>}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: item.colour, flex: "none", border: "1px solid rgba(255,255,255,0.3)" }} />
              <div style={{ fontSize: 21, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
            </div>
            {open.items.length > 1 && <button onClick={() => step(1)} aria-label="Next" style={round}>&#8250;</button>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${item.levels.length}, 1fr)`, gap: 6 }}>
            {item.levels.map((l, i) => {
              const on = i === levelIx;
              return (
                <button key={l.label} onClick={() => setLevelIx(i)} style={{
                  borderRadius: 12, padding: "7px 2px", cursor: "pointer", textAlign: "center",
                  border: on ? "2px solid #facc15" : "1px solid rgba(255,255,255,0.12)",
                  background: on ? "rgba(250,204,21,0.12)" : "rgba(255,255,255,0.04)", color: INK,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>{l.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#fde047" }}>★{formatMoney(l.price)}</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, margin: "9px 2px 10px", minHeight: 18 }}>
            {level.rung && <span style={{ color: INK }}>{level.rung} · </span>}{level.gives}
          </div>
          {bought[buyKey] ? (
            <div style={{ ...buyBtn, background: "rgba(34,197,94,0.16)", color: "#86efac", border: "1px solid rgba(134,239,172,0.4)" }}>
              &#10003; Bought (test only)
            </div>
          ) : (
            <button onClick={buy} style={{ ...buyBtn, cursor: "pointer" }}>Buy {level.label} · ★{formatMoney(level.price)}</button>
          )}
        </div>
      )}

      <PageGuide page="/star-shop3d-dev" />
    </div>
  );
}

/** The on-screen stick: drag inside the circle; the further, the faster. */
function Stick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const id = useRef<number | null>(null);
  const R = 52;
  const move = (cx: number, cy: number) => {
    const b = base.current!.getBoundingClientRect();
    let dx = cx - (b.left + b.width / 2), dy = cy - (b.top + b.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy });
    onMove(dx / R, -dy / R);
  };
  const end = () => { id.current = null; setKnob({ x: 0, y: 0 }); onMove(0, 0); };
  return (
    <div
      ref={base}
      aria-label="Walk"
      onPointerDown={(e) => { e.stopPropagation(); id.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (id.current === e.pointerId) move(e.clientX, e.clientY); }}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        position: "absolute", left: 22, bottom: 28, width: 132, height: 132, borderRadius: 999, touchAction: "none",
        background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.22)",
      }}
    >
      <div style={{
        position: "absolute", left: "50%", top: "50%", width: 56, height: 56, margin: "-28px 0 0 -28px", borderRadius: 999,
        background: "rgba(255,255,255,0.85)", boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        transform: `translate(${knob.x}px, ${knob.y}px)`, pointerEvents: "none",
      }} />
    </div>
  );
}

const pill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 36, padding: "0 12px", borderRadius: 999,
  background: "rgba(10,12,18,0.6)", border: "1px solid rgba(255,255,255,0.12)", color: INK,
  fontSize: 13, fontWeight: 800, textDecoration: "none", backdropFilter: "blur(6px)",
};
const round: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 999, flex: "none", cursor: "pointer", fontSize: 20, fontWeight: 900, lineHeight: 1,
  border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: INK,
};
const buyBtn: React.CSSProperties = {
  width: "100%", height: 48, borderRadius: 14, border: "none", background: "#facc15", color: "#111",
  fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
};
