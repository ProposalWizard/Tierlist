"use client";

/**
 * THE GARDEN, IN 3D (Mikey, 3 Oct 2026, from his recording: "make this
 * garden area also a 3D area … you will actually be able to walk around …
 * it's the same person, you will be the same person in the garden as you are
 * in the store").
 *
 * The 3D is lib/star/garden3d/scene.ts; this is the screen around it: the
 * stick (or tap where to go: tap to move), Back, and a small card when you walk up to something (no
 * sentences: pictures, faces and numbers, the garden's standing rule).
 * The shop stands where the house was: walk through its doors and the 3D
 * shop opens (`onShop`); the shop's own doors bring you back here.
 *
 * If this phone can't run 3D, the old drawn garden (GardenScreen) shows
 * instead, so nothing is lost.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { GardenCallbacks, GardenController, GardenData, GardenSpot } from "@/lib/star/garden3d/scene";
import { kitsOf } from "@/lib/star/kits";
import { gardenData } from "@/lib/star/gardenLevel";
import { homeSkyFor } from "@/lib/star/kickoff";
import { nextFixtureFor } from "@/lib/star/competitions";
import { baseIdOf } from "@/lib/star/shopData";
import { shuffle } from "@/lib/star/cups";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { shop3dPlayerLook } from "@/lib/star/signing3d";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { garden3dLook } from "@/lib/star/garden3d/look";
import { quality3dTier, parseQuality3d } from "@/lib/star/three3d/quality";
import { people3dLook, fallBackToOldPeople } from "@/lib/star/look3d";
import GardenScreen from "./GardenScreen";
import { Stick, pill } from "./Shop3D";

const INK = "#f7f1e8";
/** A query parameter, on the client only. */
const q0 = (k: string) => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(k));
const GOLD = "#facc15";
/** The car families the shop has a 3D model of (lib/star/shop3d/catalogue.ts). */
const CAR_MODELS = ["car-1", "car-2", "suv", "car-3", "classic", "car-4"];

export interface Garden3DProps {
  career: CareerState;
  onBack: () => void;
  /** Walked through the shop's doors. */
  onShop: () => void;
  /** Walked through the casino's doors (8 Oct 2026). Absent: the casino's
   *  doors stay shut. */
  onCasino?: () => void;
  /** Walked through the training pitch's gate (8 Oct 2026). */
  onTraining?: () => void;
  /** Where you appear: at the shop's doors (coming out of it), the casino's,
   *  the training pitch's gate, or the garden gate. */
  arrive?: GardenData["arrive"];
  /** Test page only: force the time of day. */
  sky?: GardenData["sky"];
}

export default function Garden3D({ career, onBack, onShop, onCasino, onTraining, arrive = "gate", sky }: Garden3DProps) {
  const holder = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<GardenController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [near, setNear] = useState<GardenSpot | null>(null);
  const [tapped, setTapped] = useState<GardenSpot | null>(null);
  const [leaving, setLeaving] = useState(false);
  const shopRef = useRef(onShop);
  shopRef.current = onShop;
  const casinoRef = useRef(onCasino);
  casinoRef.current = onCasino;
  const trainingRef = useRef(onTraining);
  trainingRef.current = onTraining;

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
      // the 3D shop's own player (Settings → "3D shop player"), so you are
      // the same person in the garden as in the shop (?player=old|new here too)
      player: {
        look: q0("player") === "old" || q0("player") === "new" ? (q0("player") as "old" | "new") : shop3dPlayerLook(),
        skin: skinToneHex(career.player.skinTone),
        hair: hairColourHex(career.player.hairColour),
        hairStyle: resolveHairStyle(career.player.hairStyle),
      },
    };
    // the garden is built once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // The phone took the 3D away (iPhone Safari, short of memory): start the
  // garden again once; a second time, the drawn garden instead.
  const [restarts, setRestarts] = useState(0);
  useEffect(() => {
    let dead = false;
    const el = holder.current;
    if (!el || restarts > 1) return;
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search);
        // Settings → Look → "3D garden": New (the 5 Oct look) or Old, the
        // garden exactly as it was (?look=old|new on the test page)
        const look = q.get("look") === "old" || q.get("look") === "new" ? q.get("look") : garden3dLook();
        const oldMod = look === "old" ? await import("@/lib/star/garden3d/sceneOld") : null;
        const newMod = look === "old" ? null : await import("@/lib/star/garden3d/scene");
        // Settings → Look → "3D quality" (Auto, else the player's pick; ?q=
        // on the test page). After the phone took the 3D away: Low.
        const tier = restarts > 0 ? "low" : parseQuality3d(q.get("q")) ?? quality3dTier();
        const cbs: GardenCallbacks = {
          onNear: (s) => setNear(s),
          onFps: (f) => { (window as unknown as { __garden3dFps?: number }).__garden3dFps = f; },
          onShopDoor: () => {
            if (dead) return;
            setLeaving(true);
            setTimeout(() => shopRef.current(), 350);
          },
          // the casino's doors and the pitch's gate: a fade, then through
          onCasinoDoor: onCasino ? () => {
            if (dead) return;
            setLeaving(true);
            setTimeout(() => casinoRef.current?.(), 350);
          } : undefined,
          onTrainingGate: onTraining ? () => {
            if (dead) return;
            setLeaving(true);
            setTimeout(() => trainingRef.current?.(), 350);
          } : undefined,
          onContextLost: () => {
            if (dead) return;
            console.error("3D garden: the phone took the 3D away");
            ctrlRef.current?.dispose();
            ctrlRef.current = null;
            setStatus("loading");
            setRestarts((n) => n + 1);
          },
        };
        const fixedStep = q.get("film") === "1" ? 1 / 30 : undefined;
        // the Old garden knows only "high" | "low" (sceneOld.ts is frozen)
        const start = (): Promise<GardenController> => newMod
          ? newMod.startGarden(el, cbs, data, { quality: tier, fixedStep })
          // (the Old garden has no casino or pitch: it starts at the gate)
          : oldMod!.startGarden(el, cbs, { ...data, arrive: data.arrive === "shop" ? "shop" : "gate" }, { quality: tier === "low" ? "low" : "high", fixedStep });
        let c: GardenController;
        try {
          c = await start();
        } catch (e1) {
          // The one body failed on this phone (as in the 3D shop on Harry's
          // iPhone): try once more with the old bodies before the drawn garden.
          if (dead || people3dLook() !== "new") throw e1;
          console.error("3D garden: one body failed, retrying with the old body", e1);
          fallBackToOldPeople();
          el.replaceChildren();
          c = await start();
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, restarts]);
  useEffect(() => { if (restarts > 1) setStatus("error"); }, [restarts]);

  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);
  const spot = tapped ?? near;
  /** A tap (not a drag) on the garden: tap to move, where the garden has it. */
  const onTap = (x: number, y: number) => {
    const c = ctrlRef.current;
    if (!c) return;
    if (c.tap) { c.tap(x, y); setTapped(null); return; }
    setTapped(c.pick(x, y)); // the old garden: tap opens the card
  };

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
          ctrlRef.current?.orbit(e.clientX - d.x, e.clientY - d.y);
          d.x = e.clientX; d.y = e.clientY;
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          // a tap, not a drag of the view
          if (d && d.id === e.pointerId && d.moved < 10) onTap(e.clientX, e.clientY);
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
        <SpotCard spot={spot} career={career} info={info} visitors={visitors} onClose={tapped ? () => setTapped(null) : undefined} onShop={onShop} onCasino={onCasino} onTraining={onTraining} />
      )}

      {/* a quick fade as you step into the shop */}
      <div style={{ position: "absolute", inset: 0, background: "#120e0b", opacity: leaving ? 1 : 0, transition: "opacity 0.35s ease", pointerEvents: "none" }} />
    </div>
  );
}

/** The small card for wherever you are standing. */
function SpotCard({ spot, career, info, visitors, onClose, onShop, onCasino, onTraining }: {
  spot: GardenSpot;
  career: CareerState;
  info: ReturnType<typeof gardenData>;
  visitors: CareerState["squad"];
  onClose?: () => void;
  onShop: () => void;
  onCasino?: () => void;
  onTraining?: () => void;
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
  if (spot === "casino" || spot === "training") {
    const go = spot === "casino" ? onCasino : onTraining;
    if (!go) return null;
    return (
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ fontSize: 24 }}>{spot === "casino" ? "🎰" : "⚽"}</span>
        <button onClick={go} style={{ height: 38, padding: "0 16px", borderRadius: 12, border: "none", background: GOLD, color: "#111", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>{spot === "casino" ? "Casino" : "Training"} &#8250;</button>
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
