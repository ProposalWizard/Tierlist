"use client";

/**
 * YOUR HOUSE, IN 3D (Harry, 9 Oct 2026: "imagine you actually had your
 * current house with all your stuff and that's where you change clothes").
 *
 * The 3D is lib/star/home3d/scene.ts; this is the screen round it, built like
 * the 3D shop's (components/star/Shop3D.tsx): the stick (or tap where to go),
 * drag to look round, a "‹ Back" pill, and a card when you stop at something:
 *   - the wardrobe: pick a casual set, a club kit or your boots; you change
 *     into it and see it in the mirror. The choice is saved on the career
 *     (`onOutfit`), and the garden and the 3D shop show the casual set.
 *   - the trophy cabinet: what you have won, and how many times.
 *   - the drive window: the cars you own.
 * Which home you are in comes from the home you own in the shop
 * (lib/star/home3d/homes.ts); before you buy one, a starter flat.
 *
 * Used twice: in a career (app/star-dev/page.tsx, phase "home-3d": from the
 * garden's house door, or Home's "Your house") and on /star-home3d-dev.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { HomeController, HomeData, HomeSpot } from "@/lib/star/home3d/scene";
import { homeTierOf, homeNameOf, roomPreset, cabinetSize, type HomeTier } from "@/lib/star/home3d/homes";
import { cabinetSlots } from "@/lib/star/home3d/trophies";
import { CASUAL_SETS, outfitOf, wornAt, bootChoices, carsOnDrive, type OutfitChoice } from "@/lib/star/home3d/outfits";
import { kitsOf } from "@/lib/star/kits";
import { trophyArt } from "@/lib/star/trophyArt";
import { levelName } from "@/lib/star/lifestyleLevels";
import { baseIdOf } from "@/lib/star/shopData";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { quality3dTier, parseQuality3d } from "@/lib/star/three3d/quality";
import { people3dLook, fallBackToOldPeople } from "@/lib/star/look3d";
import { Stick, pill, round } from "./Shop3D";

const INK = "#f7f1e8";
const MUTED = "#c9bba8";
const GOLD = "#facc15";

export interface Home3DProps {
  career: CareerState;
  onBack: () => void;
  backLabel?: string;
  /** Walked out of the front door: into the 3D garden. Absent: the door is shut. */
  onDoor?: () => void;
  /** The wardrobe's choice, to save on the career. */
  onOutfit?: (choice: OutfitChoice) => void;
  /** Test page: force the home (else the one the career owns). */
  tier?: HomeTier;
  /** Test page: force Look H on or off (?look=h|old). */
  lookH?: boolean;
}

type Tab = "casual" | "kit" | "boots";

export default function Home3D({ career, onBack, backLabel = "Home", onDoor, onOutfit, tier: tierProp, lookH }: Home3DProps) {
  const holder = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<HomeController | null>(null);
  const doorRef = useRef(onDoor);
  doorRef.current = onDoor;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errText, setErrText] = useState("");
  const [near, setNear] = useState<HomeSpot | null>(null);
  const [dismissed, setDismissed] = useState<HomeSpot | null>(null);
  const [choice, setChoice] = useState<OutfitChoice>(() => outfitOf(career));
  const [tab, setTab] = useState<Tab>(() => (outfitOf(career).wear === "casual" ? "casual" : "kit"));
  const [changing, setChanging] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const tier: HomeTier = tierProp ?? homeTierOf(career.ownedItems);
  const room = roomPreset(tier);
  const kits = kitsOf(career.player.club);
  const slots = useMemo(() => cabinetSlots(career, cabinetSize(tier)), [career, tier]);
  const cars = useMemo(() => carsOnDrive(career, room.cars), [career, room.cars]);
  const boots = useMemo(() => bootChoices(career), [career]);
  const homeName = tierProp ? room.label : homeNameOf(career.ownedItems);

  const data: HomeData = useMemo(() => ({
    tier,
    kits,
    number: career.squadNumber ?? 10,
    worn: wornAt({ outfit: choice, currentBoot: career.currentBoot }, "home"),
    skin: skinToneHex(career.player.skinTone),
    hair: hairColourHex(career.player.hairColour),
    hairStyle: resolveHairStyle(career.player.hairStyle),
    slots,
    cars,
    boots,
    casual: CASUAL_SETS,
    // built once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tier]);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  const [restarts, setRestarts] = useState(0);
  useEffect(() => {
    let dead = false;
    const el = holder.current;
    if (!el) return;
    if (restarts > 1) { setErrText("The phone stopped the 3D (out of memory?)"); setStatus("error"); return; }
    (async () => {
      try {
        const { startHome } = await import("@/lib/star/home3d/scene");
        const q = new URLSearchParams(window.location.search);
        const start = () => startHome(el, {
          onNear: (s) => setNear(s),
          onFps: (f) => { (window as unknown as { __home3dFps?: number }).__home3dFps = f; },
          ...(onDoor ? { onDoor: () => { if (dead) return; setLeaving(true); setTimeout(() => doorRef.current?.(), 350); } } : {}),
          onContextLost: () => {
            if (dead) return;
            console.error("3D home: the phone took the 3D away");
            ctrlRef.current?.dispose();
            ctrlRef.current = null;
            setStatus("loading");
            setRestarts((n) => n + 1);
          },
        }, data, {
          quality: restarts > 0 ? "low" : parseQuality3d(q.get("q")) ?? quality3dTier(),
          lookH,
          fixedStep: q.get("film") === "1" ? 1 / 30 : undefined,
        });
        let c: HomeController;
        try {
          c = await start();
        } catch (e1) {
          if (dead || people3dLook() !== "new") throw e1;
          console.error("3D home: one body failed, retrying with the old body", e1);
          fallBackToOldPeople();
          el.replaceChildren();
          c = await start();
        }
        if (dead) { c.dispose(); return; }
        ctrlRef.current = c;
        (window as unknown as { __home3d?: HomeController }).__home3d = c;
        setStatus("ready");
      } catch (e) {
        console.error("3D home failed to load", e);
        if (!dead) { setErrText(e instanceof Error ? `${e.name}: ${e.message}` : String(e)); setStatus("error"); }
      }
    })();
    return () => {
      dead = true;
      ctrlRef.current?.dispose();
      ctrlRef.current = null;
      delete (window as unknown as { __home3d?: HomeController }).__home3d;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, restarts]);

  const open: HomeSpot | null = near && dismissed !== near ? near : null;
  useEffect(() => { if (!near) setDismissed(null); }, [near]);
  useEffect(() => { ctrlRef.current?.setCardOpen(open); if (open) ctrlRef.current?.setStick(0, 0); }, [open, status]);

  /** Pick something in the wardrobe: change into it, save it. */
  const pick = (patch: Partial<OutfitChoice>) => {
    const next: OutfitChoice = { ...choice, ...patch };
    setChoice(next);
    onOutfit?.(next);
    const c = ctrlRef.current;
    if (!c) return;
    setChanging(true);
    c.wear(wornAt({ outfit: next, currentBoot: career.currentBoot }, "home")).finally(() => setChanging(false));
  };

  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);
  const onTap = (x: number, y: number) => {
    const c = ctrlRef.current;
    if (!c) return;
    const s = c.pick(x, y);
    if (s && s === near) { setDismissed(null); return; }
    c.tap(x, y);
  };
  const close = () => { if (near) setDismissed(near); ctrlRef.current?.setStick(0, 0); };
  const casualOn = choice.wear === "casual";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "#1a1612", color: INK, overflow: "hidden", touchAction: "none", userSelect: "none" }} data-home3d>
      <div
        ref={holder}
        style={{ position: "absolute", inset: 0 }}
        onPointerDown={(e) => { drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          d.moved += Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y);
          ctrlRef.current?.orbit(e.clientX - d.x, e.clientY - d.y);
          d.x = e.clientX; d.y = e.clientY;
        }}
        onPointerUp={(e) => { const d = drag.current; drag.current = null; if (d && d.id === e.pointerId && d.moved < 10) onTap(e.clientX, e.clientY); }}
        onPointerCancel={() => { drag.current = null; }}
      />

      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "max(12px, env(safe-area-inset-top)) 12px 0", pointerEvents: "none" }}>
        <button onClick={onBack} aria-label={`Back to ${backLabel}`} style={{ ...pill, pointerEvents: "auto", cursor: "pointer", gap: 4, paddingLeft: 10 }} data-home3d-back>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>&#8249;</span>{backLabel}
        </button>
        <div style={{ ...pill, fontWeight: 900, gap: 6, maxWidth: "52vw", overflow: "hidden" }}>
          <span aria-hidden>🏠</span><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{homeName}</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ ...pill, gap: 6 }} aria-label="Trophies">
          <span aria-hidden style={{ fontSize: 15 }}>🏆</span><b style={{ color: GOLD }}>{slots.filter((s) => s.won).reduce((n, s) => n + s.count, 0)}</b>
        </div>
      </div>

      {status !== "ready" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          {status === "loading" ? (
            <div>
              <div style={{ fontWeight: 900, fontSize: 17 }}>Opening your house…</div>
              <div style={{ fontWeight: 700, color: MUTED, fontSize: 13, marginTop: 6 }}>Loading the 3D</div>
            </div>
          ) : (
            <div style={{ maxWidth: 300 }}>
              <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 6 }}>Your house didn&apos;t load</div>
              <div style={{ fontWeight: 600, color: MUTED, fontSize: 14, lineHeight: 1.5 }}>This phone or browser may not run 3D.</div>
              {errText && <div style={{ fontWeight: 600, color: MUTED, fontSize: 10.5, marginTop: 10, opacity: 0.7, wordBreak: "break-word" }}>{errText.slice(0, 200)}</div>}
              <button onClick={onBack} style={{ ...ctaStyle, marginTop: 14 }}>Back to {backLabel}</button>
            </div>
          )}
        </div>
      )}

      {status === "ready" && !open && <Stick onMove={(x, y) => ctrlRef.current?.setStick(x, y)} />}
      {status === "ready" && !open && (
        <div style={{ position: "absolute", bottom: 40, right: 16, maxWidth: 180, textAlign: "right", fontSize: 12.5, fontWeight: 800, lineHeight: 1.4, pointerEvents: "none", textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>
          Wardrobe and mirror on the left. Trophies at the back. Your cars out of the window.
        </div>
      )}

      {open && (
        <div style={card} data-home3d-card={open}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>
              {open === "wardrobe" ? "Wardrobe" : open === "cabinet" ? "Trophy cabinet" : "Your cars"}
            </div>
            {open === "wardrobe" && changing && <span style={{ fontSize: 11, fontWeight: 900, color: "#111", background: GOLD, borderRadius: 999, padding: "2px 8px" }}>Changing…</span>}
            <div style={{ flex: 1 }} />
            <button onClick={close} aria-label="Close" style={{ ...round, fontSize: 15 }}>&#10005;</button>
          </div>

          {open === "wardrobe" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
                {(["casual", "kit", "boots"] as Tab[]).map((t) => (
                  <button key={t} onClick={() => setTab(t)} style={{ ...tabStyle, ...(tab === t ? tabOn : null) }}>{t === "casual" ? "Clothes" : t === "kit" ? "Kits" : "Boots"}</button>
                ))}
              </div>
              {tab === "casual" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 6 }}>
                  {CASUAL_SETS.map((s) => {
                    const on = casualOn && choice.casual === s.id;
                    const [a, b] = s.swatch(kits.home);
                    return (
                      <button key={s.id} onClick={() => pick({ wear: "casual", casual: s.id })} style={{ ...tile, ...(on ? tileOn : null) }} data-outfit={s.id}>
                        <Swatch top={a} low={b} />
                        <div style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.15 }}>{s.label}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              {tab === "kit" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {(["home", "away"] as const).map((k) => {
                    const on = !casualOn && choice.kit === k;
                    return (
                      <button key={k} onClick={() => pick({ wear: "kit", kit: k })} style={{ ...tile, ...(on ? tileOn : null) }} data-outfit={`kit-${k}`}>
                        <Swatch top={kits[k].shirt} low={kits[k].trim} kit />
                        <div style={{ fontSize: 12, fontWeight: 900 }}>{k === "home" ? "Home kit" : "Away kit"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              {tab === "boots" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {boots.map((b) => {
                    const on = (choice.boots ?? "own") === b.id;
                    return (
                      <button key={b.id} onClick={() => pick({ wear: "kit", boots: b.id })} style={{ ...tile, ...(on ? tileOn : null) }} data-boots={b.id}>
                        <span style={{ width: 40, height: 16, borderRadius: 8, background: b.colour, border: "1px solid rgba(255,255,255,0.35)" }} />
                        <div style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.15 }}>{b.label}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginTop: 8 }}>
                {casualOn ? "You wear these clothes in the garden and the shop. Training is always in kit." : "Boots show with a kit."}
              </div>
            </>
          )}

          {open === "cabinet" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxHeight: "34vh", overflowY: "auto" }}>
              {slots.map((s) => {
                const art = trophyArt(s.name);
                return (
                  <div key={s.name} title={s.name} style={{ display: "grid", justifyItems: "center", gap: 2, opacity: s.won ? 1 : 0.38, position: "relative" }}>
                    {art ? <img src={art} alt="" style={{ width: 40, height: 40, objectFit: "contain", filter: s.won ? undefined : "grayscale(1)" }} /> : <span style={{ fontSize: 28 }}>🏆</span>}
                    <div style={{ fontSize: 10, fontWeight: 800, textAlign: "center", lineHeight: 1.1 }}>{s.name}</div>
                    {s.count > 1 && <span style={{ position: "absolute", right: 2, top: 0, fontSize: 11, fontWeight: 900, color: "#111", background: GOLD, borderRadius: 999, padding: "1px 5px" }}>×{s.count}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {open === "drive" && (
            cars.length === 0 ? (
              <div style={{ fontSize: 14, fontWeight: 800, color: MUTED }}>No cars yet. Buy one in the shop and it parks here.</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {career.ownedItems.filter((it) => cars.some((c) => c.id === baseIdOf(it))).map((it) => (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 14 }}>
                    <span aria-hidden>🚗</span>{levelName(it)}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      <div style={{ position: "absolute", inset: 0, background: "#120e0b", opacity: leaving ? 1 : 0, transition: "opacity 0.35s ease", pointerEvents: "none" }} />
    </div>
  );
}

/** A little outfit drawing: a top over trousers (or shorts for a kit). */
function Swatch({ top, low, kit = false }: { top: string; low: string; kit?: boolean }) {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
      <path d="M12 6 L18 4 Q22 8 26 4 L32 6 L38 13 L33 17 L31 14 L31 25 L13 25 L13 14 L11 17 L6 13 Z" fill={top} stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
      {kit ? <path d="M14 26 L30 26 L31 33 L23 33 L22 30 L21 33 L13 33 Z" fill={low} stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
        : <path d="M14 26 L30 26 L29 42 L24 42 L22 31 L20 42 L15 42 Z" fill={low} stroke="rgba(0,0,0,0.45)" strokeWidth="1" />}
    </svg>
  );
}

const card: React.CSSProperties = {
  position: "absolute", left: 10, right: 10, bottom: "max(10px, env(safe-area-inset-bottom))", background: "rgba(20,15,11,0.94)",
  border: "1px solid rgba(250,204,21,0.25)", borderRadius: 20, padding: 14, backdropFilter: "blur(8px)", boxShadow: "0 18px 40px -12px rgba(0,0,0,.8)",
};
const tabStyle: React.CSSProperties = {
  height: 34, borderRadius: 10, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", color: INK,
  fontWeight: 900, fontSize: 13, cursor: "pointer",
};
const tabOn: React.CSSProperties = { background: "rgba(250,204,21,0.16)", border: `2px solid ${GOLD}` };
const tile: React.CSSProperties = {
  display: "grid", justifyItems: "center", alignContent: "start", gap: 4, padding: "8px 4px", borderRadius: 12, cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: INK, textAlign: "center",
};
const tileOn: React.CSSProperties = { border: `2px solid ${GOLD}`, background: "rgba(250,204,21,0.12)" };
const ctaStyle: React.CSSProperties = {
  width: "100%", height: 48, borderRadius: 14, border: "none", background: GOLD, color: "#111", cursor: "pointer",
  fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center",
};
