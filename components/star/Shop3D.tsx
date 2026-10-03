"use client";

/**
 * WALK THE 3D SHOP (beta) — one screen, used twice:
 *   - in a career, from the Shop page's "Walk the 3D shop (beta)" button
 *     (app/star-dev/page.tsx, phase "shop-3d"). It shows the career's own
 *     prices and what it owns, and tapping "See it in the shop" jumps to that
 *     item in the normal shop to buy it. Nothing is bought in 3D.
 *   - on the test page /star-shop3d-dev (`dev`), with a club-kit switch and a
 *     pretend Buy button.
 *
 * Harry, 2 Oct 2026: "the old 3D shop thing that we made, I want that put
 * into the game as well, just so we can test it out … Don't replace the
 * current store area with the new 3D one. Just have it as maybe a button."
 *
 * The 3D is lib/star/shop3d/scene.ts; three.js only loads when this opens.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { shopDisplays, type DisplayId, type ShopPrices } from "@/lib/star/shop3d/catalogue";
import type { ShopController, KitColours } from "@/lib/star/shop3d/scene";
import { CLUB_KITS, kitsOf } from "@/lib/star/kits";
import { formatMoney } from "@/lib/star/money";
import { baseIdOf, kibCanPrice, KIB_CANS } from "@/lib/star/shopData";
import { hasBootDeal, bootPrice } from "@/lib/star/sponsorDeals";
import { SHOP_TIERS } from "@/lib/star/economy";
import { divisionOf } from "@/lib/star/calendar";
import { shop3dPlayerLook } from "@/lib/star/signing3d";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";

const INK = "#f7f1e8";
const MUTED = "#c9bba8";
const GOLD = "#facc15";
const DEV_CLUBS = ["Chelsea", "Arsenal", "Liverpool", "Manchester City", "Tottenham Hotspur", "Newcastle United", "Aston Villa"]
  .filter((c) => CLUB_KITS[c]);

export interface Shop3DProps {
  /** In a career: its prices, what it owns, its kit. Absent on the test page. */
  career?: CareerState | null;
  /** Test page: club switch, fps, pretend Buy. */
  dev?: boolean;
  onBack: () => void;
  backLabel?: string;
  /** Jump to this item in the normal shop (career only). */
  onGoToItem?: (display: DisplayId, itemId: string, level: number) => void;
  /** Walking out through the front doors: into the 3D garden (career only). */
  onDoor?: () => void;
  /** Start just inside the front doors (arriving from the garden). */
  atDoor?: boolean;
}

export default function Shop3D({ career, dev = false, onBack, backLabel = "Shop", onGoToItem, onDoor, atDoor = false }: Shop3DProps) {
  const doorRef = useRef(onDoor);
  doorRef.current = onDoor;
  const holder = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<ShopController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fps, setFps] = useState(0);
  const [near, setNear] = useState<DisplayId | null>(null);
  const [dismissed, setDismissed] = useState<DisplayId | null>(null);
  const [tapped, setTapped] = useState<{ display: DisplayId; index: number } | null>(null);
  const [club, setClub] = useState(0);
  const [itemIx, setItemIx] = useState(0);
  const [levelIx, setLevelIx] = useState(0);
  const [bought, setBought] = useState<Record<string, true>>({});

  // Prices: the career's own (boot sponsor, cans off your wage) or the list prices.
  const careerKey = career ? `${career.contract.wage}|${hasBootDeal(career)}` : "";
  const displays = useMemo(() => {
    if (!career) return shopDisplays();
    const prices: ShopPrices = {
      boot: (p) => bootPrice(career, p),
      can: (c) => kibCanPrice(c, career.contract.wage),
    };
    return shopDisplays(prices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careerKey]);
  // The level the shop opens on: the one priced for your league.
  const homeLevel = career ? Math.max(1, SHOP_TIERS.findIndex((t) => t.anchor === divisionOf(career)) + 1) : 1;
  const kit: KitColours = career ? kitsOf(career.player.club).home : CLUB_KITS[DEV_CLUBS[club]].home;

  /** What the career has of each item, for the "Owned" chip. */
  const owned = useMemo(() => {
    const o: Record<string, string> = {};
    if (!career) return o;
    const b = career.currentBoot;
    if (b && b.matches > 0) o[baseIdOf(b)] = `Wearing L${b.level ?? 1}`;
    for (const it of career.ownedItems) o[baseIdOf(it)] = `Owned L${it.level ?? 1}`;
    const cans = KIB_CANS.reduce((n, c) => n + (career.kibCans[c.id] ?? 0), 0);
    if (cans > 0) o.kib = `×${cans}`;
    return o;
  }, [career]);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // Start the 3D once.
  useEffect(() => {
    let dead = false;
    const el = holder.current;
    if (!el) return;
    (async () => {
      try {
        const { startShop } = await import("@/lib/star/shop3d/scene");
        const q = new URLSearchParams(window.location.search);
        const c = await startShop(el, {
          onNear: (id) => setNear(id),
          onFps: (f) => {
            setFps(f);
            (window as unknown as { __shop3dFps?: number }).__shop3dFps = f;
          },
          ...(onDoor ? { onDoor: () => doorRef.current?.() } : {}),
        }, kit, displays, {
          atDoor,
          quality: q.get("q") === "low" ? "low" : "high",
          fixedStep: q.get("film") === "1" ? 1 / 30 : undefined,
          // Settings → "3D shop player": the new character in your skin, hair
          // and kit, or the old one exactly as it was. (?player=old on the test page.)
          player: {
            look: q.get("player") === "old" || q.get("player") === "new" ? (q.get("player") as "old" | "new") : shop3dPlayerLook(),
            skin: career ? skinToneHex(career.player.skinTone) : undefined,
            hair: career ? hairColourHex(career.player.hairColour) : undefined,
            hairStyle: career ? resolveHairStyle(career.player.hairStyle) : undefined,
          },
        });
        if (dead) { c.dispose(); return; }
        ctrlRef.current = c;
        (window as unknown as { __shop3d?: ShopController }).__shop3d = c;
        setStatus("ready");
      } catch (e) {
        console.error("3D shop failed to load", e);
        if (!dead) setStatus("error");
      }
    })();
    return () => {
      dead = true;
      ctrlRef.current?.dispose();
      ctrlRef.current = null;
      delete (window as unknown as { __shop3d?: ShopController }).__shop3d;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { ctrlRef.current?.setKit(kit); }, [kit.shirt, kit.trim, status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ctrlRef.current?.setOwned(owned); }, [owned, status]);

  // Arriving at a display: pick the item you're standing at.
  useEffect(() => {
    if (!near) { setDismissed(null); return; }
    if (tapped) return;
    const c = ctrlRef.current;
    setItemIx(c ? c.nearestItem(near) : 0);
    setLevelIx(Math.max(0, homeLevel - 1));
    c?.setStick(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);

  const openId: DisplayId | null = tapped ? tapped.display : near && dismissed !== near ? near : null;
  const open = openId ? displays[openId] : null;
  const item = open ? open.items[Math.min(itemIx, open.items.length - 1)] : null;
  const level = item ? item.levels[Math.min(levelIx, item.levels.length - 1)] : null;
  const levelNo = Math.min(levelIx, (item?.levels.length ?? 1) - 1) + 1;
  const buyKey = item && level ? `${item.id}:${level.label}` : "";

  useEffect(() => {
    if (open && item) ctrlRef.current?.select(open.id, Math.min(itemIx, open.items.length - 1));
  }, [open, item, itemIx]);
  useEffect(() => {
    if (open && item) ctrlRef.current?.setLevel(open.id, Math.min(itemIx, open.items.length - 1), levelNo);
  }, [open, item, itemIx, levelNo]);
  const isOpen = !!open;
  useEffect(() => { ctrlRef.current?.setCardOpen(isOpen); }, [isOpen]);

  const step = (d: number) => {
    if (!open) return;
    const n = open.items.length;
    setItemIx((i) => (i + d + n) % n);
  };
  const close = () => {
    if (tapped) setTapped(null);
    if (near) setDismissed(near);
    ctrlRef.current?.setStick(0, 0);
  };
  const buy = () => {
    if (!buyKey) return;
    setBought((b) => ({ ...b, [buyKey]: true }));
    ctrlRef.current?.playBuy();
  };

  // Drag on the view swings the camera; a tap on something opens its card.
  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);
  const onTap = (x: number, y: number) => {
    const p = ctrlRef.current?.pick(x, y);
    if (!p) return;
    setTapped(p);
    setItemIx(p.index);
    setLevelIx(Math.max(0, Math.min(homeLevel, displays[p.display].items[p.index].levels.length) - 1));
    ctrlRef.current?.setStick(0, 0);
  };

  const ownTag = item ? owned[item.id] : undefined;
  const isModel = !!item?.model;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "#120e0b", color: INK, overflow: "hidden", touchAction: "none", userSelect: "none" }} data-shop3d>
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
        onPointerUp={(e) => { const d = drag.current; drag.current = null; if (d && d.moved < 8) onTap(e.clientX, e.clientY); }}
        onPointerCancel={() => { drag.current = null; }}
      />

      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "max(12px, env(safe-area-inset-top)) 12px 0", pointerEvents: "none" }}>
        <button onClick={onBack} aria-label={`Back to the ${backLabel}`} style={{ ...pill, pointerEvents: "auto", cursor: "pointer", gap: 4, paddingLeft: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>&#8249;</span>{backLabel}
        </button>
        <div style={{ ...pill, fontWeight: 900, fontSize: 14, gap: 6 }}>
          3D Shop <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: "#111", background: GOLD, borderRadius: 999, padding: "2px 6px" }}>BETA</span>
        </div>
        <div style={{ flex: 1 }} />
        {career && <div style={{ ...pill, color: "#fde047", fontWeight: 900 }}>★{formatMoney(career.money)}</div>}
        {dev && (
          <button onClick={() => setClub((c) => (c + 1) % DEV_CLUBS.length)} style={{ ...pill, pointerEvents: "auto", cursor: "pointer", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: kit.shirt, border: `2px solid ${kit.trim}` }} />
            {DEV_CLUBS[club]}
          </button>
        )}
      </div>
      {status === "ready" && dev && (
        <div style={{ position: "absolute", top: 56, right: 12, fontSize: 11, fontWeight: 800, color: MUTED, background: "rgba(0,0,0,0.35)", padding: "2px 7px", borderRadius: 999 }}>
          {fps} fps
        </div>
      )}

      {status !== "ready" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          {status === "loading" ? (
            <div>
              <div style={{ fontWeight: 900, fontSize: 17 }}>Opening the shop…</div>
              <div style={{ fontWeight: 700, color: MUTED, fontSize: 13, marginTop: 6 }}>Loading the 3D models</div>
            </div>
          ) : (
            <div style={{ maxWidth: 300 }}>
              <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 6 }}>The 3D shop didn&apos;t load</div>
              <div style={{ fontWeight: 600, color: MUTED, fontSize: 14, lineHeight: 1.5 }}>
                This phone or browser may not run 3D. The normal shop still works.
              </div>
              <button onClick={onBack} style={{ ...cta, marginTop: 14 }}>Back to the {backLabel}</button>
            </div>
          )}
        </div>
      )}

      {status === "ready" && !open && <Stick onMove={(x, y) => ctrlRef.current?.setStick(x, y)} />}
      {status === "ready" && !open && !near && (
        <div style={{ position: "absolute", bottom: 40, right: 16, maxWidth: 176, textAlign: "right", fontSize: 12.5, fontWeight: 800, color: INK, lineHeight: 1.4, pointerEvents: "none", textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>
          Walk up to anything, or tap it. Drag the view to look round.
        </div>
      )}

      {open && item && level && (
        <div style={{ position: "absolute", left: 10, right: 10, bottom: "max(10px, env(safe-area-inset-bottom))", background: "rgba(20,15,11,0.94)", border: "1px solid rgba(250,204,21,0.25)", borderRadius: 20, padding: 14, backdropFilter: "blur(8px)", boxShadow: "0 18px 40px -12px rgba(0,0,0,.8)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{open.title}</div>
            {ownTag && <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", background: "#16a34a", borderRadius: 999, padding: "2px 8px" }}>{ownTag}</span>}
            <div style={{ flex: 1 }} />
            <button onClick={close} aria-label="Close" style={{ ...round, fontSize: 15 }}>&#10005;</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 10px" }}>
            {open.items.length > 1 && <button onClick={() => step(-1)} aria-label="Previous" style={round}>&#8249;</button>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: item.colour, flex: "none", border: "1px solid rgba(255,255,255,0.3)" }} />
                <div style={{ fontSize: 21, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: MUTED, marginTop: 1 }}>
                {isModel ? `3D model · level ${item.modelLevel} shown` : item.picture ? `Picture of level ${levelNo}` : `${open.items.length > 1 ? "" : "Three cans"}`}
                {open.items.length > 1 ? ` · ${Math.min(itemIx, open.items.length - 1) + 1} of ${open.items.length}` : ""}
              </div>
            </div>
            {open.items.length > 1 && <button onClick={() => step(1)} aria-label="Next" style={round}>&#8250;</button>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${item.levels.length}, 1fr)`, gap: 6 }}>
            {item.levels.map((l, i) => {
              const on = i === Math.min(levelIx, item.levels.length - 1);
              return (
                <button key={l.label} onClick={() => setLevelIx(i)} style={{
                  borderRadius: 12, padding: "7px 2px", cursor: "pointer", textAlign: "center",
                  border: on ? `2px solid ${GOLD}` : "1px solid rgba(255,255,255,0.12)",
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
          {onGoToItem ? (
            <button onClick={() => onGoToItem(open.id, item.id, levelNo)} style={cta}>See it in the shop &#8250;</button>
          ) : bought[buyKey] ? (
            <div style={{ ...cta, background: "rgba(34,197,94,0.16)", color: "#86efac", border: "1px solid rgba(134,239,172,0.4)" }}>
              &#10003; Bought (test only)
            </div>
          ) : (
            <button onClick={buy} style={cta}>Buy {level.label} · ★{formatMoney(level.price)} (test)</button>
          )}
        </div>
      )}
    </div>
  );
}

/** The on-screen stick: drag inside the circle; the further, the faster. */
export function Stick({ onMove }: { onMove: (x: number, y: number) => void }) {
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
        position: "absolute", left: 22, bottom: "max(28px, calc(env(safe-area-inset-bottom) + 16px))", width: 132, height: 132, borderRadius: 999, touchAction: "none",
        background: "rgba(255,240,220,0.08)", border: "2px solid rgba(255,230,200,0.25)",
      }}
    >
      <div style={{
        position: "absolute", left: "50%", top: "50%", width: 56, height: 56, margin: "-28px 0 0 -28px", borderRadius: 999,
        background: "rgba(255,248,236,0.9)", boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        transform: `translate(${knob.x}px, ${knob.y}px)`, pointerEvents: "none",
      }} />
    </div>
  );
}

export const pill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 36, padding: "0 12px", borderRadius: 999,
  background: "rgba(18,13,10,0.62)", border: "1px solid rgba(255,230,200,0.14)", color: INK,
  fontSize: 13, fontWeight: 800, textDecoration: "none", backdropFilter: "blur(6px)",
};
export const round: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 999, flex: "none", cursor: "pointer", fontSize: 20, fontWeight: 900, lineHeight: 1,
  border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: INK,
};
export const cta: React.CSSProperties = {
  width: "100%", height: 48, borderRadius: 14, border: "none", background: GOLD, color: "#111", cursor: "pointer",
  fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
};
