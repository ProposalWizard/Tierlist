"use client";

/**
 * THE GARDEN, IN 3D (Mikey, 3 Oct 2026, from his recording: "make this
 * garden area also a 3D area … you will actually be able to walk around …
 * it's the same person, you will be the same person in the garden as you are
 * in the store").
 *
 * The 3D is lib/star/garden3d/scene.ts; this is the screen around it: the
 * stick, Back, and a small card when you walk up to something (no
 * sentences: pictures, faces and numbers, the garden's standing rule).
 * The shop stands where the house was: walk through its doors and the 3D
 * shop opens (`onShop`); the shop's own doors bring you back here.
 *
 * If this phone can't run 3D, the old drawn garden (GardenScreen) shows
 * instead, so nothing is lost.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { GardenController, GardenData, GardenSpot } from "@/lib/star/garden3d/scene";
import { kitsOf } from "@/lib/star/kits";
import { gardenData } from "@/lib/star/gardenLevel";
import { homeSkyFor } from "@/lib/star/kickoff";
import { nextFixtureFor } from "@/lib/star/competitions";
import { baseIdOf } from "@/lib/star/shopData";
import { shuffle } from "@/lib/star/cups";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import GardenScreen from "./GardenScreen";
import { Stick, pill } from "./Shop3D";

const INK = "#f7f1e8";
const GOLD = "#facc15";
/** The car families the shop has a 3D model of (lib/star/shop3d/catalogue.ts). */
const CAR_MODELS = ["car-1", "car-2", "suv", "car-3", "classic", "car-4"];

export interface Garden3DProps {
  career: CareerState;
  onBack: () => void;
  /** Walked through the shop's doors. */
  onShop: () => void;
  /** Where you appear: at the shop's doors (coming out of it) or the gate. */
  arrive?: "shop" | "gate";
  /** Test page only: force the time of day. */
  sky?: GardenData["sky"];
}

export default function Garden3D({ career, onBack, onShop, arrive = "gate", sky }: Garden3DProps) {
  const holder = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<GardenController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [near, setNear] = useState<GardenSpot | null>(null);
  const [tapped, setTapped] = useState<GardenSpot | null>(null);
  const [leaving, setLeaving] = useState(false);
  const shopRef = useRef(onShop);
  shopRef.current = onShop;

  // Three real team-mates, picked at random each visit (as before).
  const [visitors] = useState(() => {
    const squad = career.squad ?? [];
    return squad.length <= 3 ? squad : shuffle(squad, Math.random).slice(0, 3);
  });
  const info = useMemo(() => gardenData(career), [career]);

  const data: GardenData = useMemo(() => {
    const yours = career.squadNumber ?? 10;
    const numbers = [7, 4, 9, 11, 6, 8].filter((n) => n !== yours).slice(0, 3);
    const owned = new Set(career.ownedItems.map((it) => baseIdOf(it)));
    return {
      kit: kitsOf(career.player.club).home,
      number: yours,
      tier: info.tier,
      stable: info.stable,
      horse: career.horse ? { name: career.horse.name } : null,
      trophies: info.shelf,
      cars: CAR_MODELS.filter((id) => owned.has(id)).map((id) => `/star/shop3d/items/${id.startsWith("car-") ? id : `car-${id}`}.glb`),
      sky: sky ?? homeSkyFor(career, nextFixtureFor(career)),
      mates: numbers,
      arrive,
      you: { skin: skinToneHex(career.player.skinTone), hair: hairColourHex(career.player.hairColour), hairStyle: resolveHairStyle(career.player.hairStyle) },
    };
    // the garden is built once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  useEffect(() => {
    let dead = false;
    const el = holder.current;
    if (!el) return;
    (async () => {
      try {
        const { startGarden } = await import("@/lib/star/garden3d/scene");
        const q = new URLSearchParams(window.location.search);
        const c = await startGarden(el, {
          onNear: (s) => setNear(s),
          onFps: (f) => { (window as unknown as { __garden3dFps?: number }).__garden3dFps = f; },
          onShopDoor: () => {
            if (dead) return;
            setLeaving(true);
            setTimeout(() => shopRef.current(), 350);
          },
        }, data, {
          quality: q.get("q") === "low" ? "low" : "high",
          fixedStep: q.get("film") === "1" ? 1 / 30 : undefined,
        });
        if (dead) { c.dispose(); return; }
        ctrlRef.current = c;
        (window as unknown as { __garden3d?: GardenController }).__garden3d = c;
        setStatus("ready");
      } catch (e) {
        console.error("3D garden failed to load", e);
        if (!dead) setStatus("error");
      }
    })();
    return () => {
      dead = true;
      ctrlRef.current?.dispose();
      ctrlRef.current = null;
      delete (window as unknown as { __garden3d?: GardenController }).__garden3d;
    };
  }, [data]);

  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);
  const spot = tapped ?? near;

  if (status === "error") return <GardenScreen career={career} onBack={onBack} />;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "#0d1420", color: INK, overflow: "hidden", touchAction: "none", userSelect: "none" }} data-garden3d>
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
          if (d && d.moved < 8) setTapped(ctrlRef.current?.pick(e.clientX, e.clientY) ?? null);
        }}
        onPointerCancel={() => { drag.current = null; }}
      />

      {/* top bar: back, and what your garden holds — pictures and numbers */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "max(12px, env(safe-area-inset-top)) 12px 0", pointerEvents: "none" }}>
        <button onClick={onBack} aria-label="Back" style={{ ...pill, pointerEvents: "auto", cursor: "pointer", gap: 4, paddingLeft: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>&#8249;</span>Home
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ ...pill, gap: 6 }} aria-label="Trophies">
          <span aria-hidden style={{ fontSize: 16 }}>🏆</span><b style={{ color: GOLD }}>{info.trophyCount + (career.ballonDorWins ?? 0)}</b>
        </div>
        {career.horse && (
          <div style={{ ...pill, gap: 6 }} aria-label="Horse">
            <span aria-hidden style={{ fontSize: 16 }}>🐎</span><b>{career.horse.racesWon}</b>
          </div>
        )}
      </div>

      {status === "loading" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ display: "grid", placeItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, border: "4px solid rgba(255,255,255,0.15)", borderTopColor: GOLD, animation: "g3dspin 0.9s linear infinite" }} />
            <style>{"@keyframes g3dspin{to{transform:rotate(360deg)}}"}</style>
          </div>
        </div>
      )}

      {status === "ready" && <Stick onMove={(x, y) => ctrlRef.current?.setStick(x, y)} />}

      {status === "ready" && spot && spot !== "fountain" && (
        <SpotCard spot={spot} career={career} info={info} visitors={visitors} onClose={tapped ? () => setTapped(null) : undefined} onShop={onShop} />
      )}

      {/* a quick fade as you step into the shop */}
      <div style={{ position: "absolute", inset: 0, background: "#120e0b", opacity: leaving ? 1 : 0, transition: "opacity 0.35s ease", pointerEvents: "none" }} />
    </div>
  );
}

/** The small card for wherever you are standing. */
function SpotCard({ spot, career, info, visitors, onClose, onShop }: {
  spot: GardenSpot;
  career: CareerState;
  info: ReturnType<typeof gardenData>;
  visitors: CareerState["squad"];
  onClose?: () => void;
  onShop: () => void;
}) {
  const card: React.CSSProperties = {
    position: "absolute", right: 12, bottom: "max(24px, calc(env(safe-area-inset-bottom) + 16px))", maxWidth: "min(62vw, 300px)",
    background: "rgba(14,12,10,0.86)", border: "1px solid rgba(250,204,21,0.25)", borderRadius: 18, padding: 12,
    backdropFilter: "blur(8px)", boxShadow: "0 16px 36px -14px rgba(0,0,0,.85)",
  };
  const close = onClose && (
    <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", color: INK, fontSize: 16, cursor: "pointer" }}>&#10005;</button>
  );
  if (spot === "shop") {
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ fontSize: 24 }}>🛍️</span>
        <button onClick={onShop} style={{ height: 38, padding: "0 16px", borderRadius: 12, border: "none", background: GOLD, color: "#111", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>Shop &#8250;</button>
        {close}
      </div>
    );
  }
  if (spot === "trophies") {
    const shelf = info.shelf;
    return (
      <div style={card}>
        {close}
        {shelf.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 18 }}>
            <span aria-hidden style={{ fontSize: 22, opacity: 0.5 }}>🏆</span>0
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {shelf.slice(0, 12).map((t) => (
              <div key={t.name} title={t.name} style={{ display: "grid", placeItems: "center", position: "relative" }}>
                {t.art ? <img src={t.art} alt={t.name} style={{ width: 42, height: 42, objectFit: "contain" }} /> : <span style={{ fontSize: 30 }}>🏆</span>}
                {t.count > 1 && <span style={{ position: "absolute", right: -2, bottom: -2, fontSize: 11, fontWeight: 900, color: "#111", background: GOLD, borderRadius: 999, padding: "1px 5px" }}>×{t.count}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (spot === "mates") {
    return (
      <div style={{ ...card, display: "flex", gap: 10 }}>
        {close}
        {visitors.map((p) => (
          <div key={p.id} style={{ display: "grid", justifyItems: "center", gap: 4, width: 64 }}>
            <img src={p.imageUrl ?? fakeFaceFor(p.id)} alt={p.name} style={{ width: 48, height: 48, borderRadius: 999, objectFit: "cover", background: "#2a2622", border: "2px solid rgba(255,255,255,0.25)" }} />
            <div style={{ fontSize: 11, fontWeight: 900, textAlign: "center", lineHeight: 1.1, maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name.split(" ").slice(-1)[0]}</div>
          </div>
        ))}
      </div>
    );
  }
  if (spot === "horse") {
    const h = career.horse;
    return (
      <div style={card}>
        {close}
        {h ? (
          <div style={{ display: "grid", gap: 6, minWidth: 170 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 16 }}><span aria-hidden>🐎</span>{h.name}</div>
            <Bar icon="⚡" v={h.speed} />
            <Bar icon="🫁" v={h.stamina} />
            <div style={{ display: "flex", gap: 12, fontSize: 13, fontWeight: 900 }}>
              <span>🏁 {h.racesRun}</span><span style={{ color: GOLD }}>🥇 {h.racesWon}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, opacity: 0.6 }}><span aria-hidden style={{ fontSize: 22 }}>🐎</span>0</div>
        )}
      </div>
    );
  }
  if (spot === "cars") {
    const n = career.ownedItems.filter((it) => CAR_MODELS.includes(baseIdOf(it))).length;
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 18 }}>
        {close}<span aria-hidden style={{ fontSize: 22 }}>🚗</span>{n}
      </div>
    );
  }
  if (spot === "teqball") {
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
        {close}<span aria-hidden style={{ fontSize: 22 }}>⚽</span>Teqball
      </div>
    );
  }
  return null;
}

function Bar({ icon, v }: { icon: string; v: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span aria-hidden style={{ width: 18 }}>{icon}</span>
      <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: "100%", background: GOLD }} />
      </div>
      <b style={{ fontSize: 12, width: 22, textAlign: "right" }}>{v}</b>
    </div>
  );
}
