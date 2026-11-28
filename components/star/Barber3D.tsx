"use client";

/**
 * THE BARBER'S (28 Nov 2026; plan docs/plans/STAR_PASS_BARBER_FOOD_PLAN.md section 2): through the shopping street's
 * BARBER door. The 3D is lib/star/barber3d/scene.ts; the rules (styles by hair type, price, growth, caps, the save)
 * are lib/star/barber.ts. This is the screen round it:
 *
 *   walking in   nothing but Back (you walk to the chair and sit)
 *   in the chair your hair type, the styles that suit it (each one put on your own head at once, the chair turning
 *                so you see it from every side; drag to turn it yourself), the beard, and Pay · Cut
 *   the cut      the barber's line while he works, then you in the mirror and what it did (Mood +1, 45 minutes)
 *   Back / Leave you stand up and walk out of the door, back onto the street at the barber's
 *
 * Nothing is saved until you pay (onCareer). Leaving without paying puts your own look back.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { BarberController, BarberState } from "@/lib/star/barber3d/scene";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex, hairColourHex } from "@/lib/star/playerIdentity";
import { wornAt } from "@/lib/star/home3d/outfits";
import { yourToonHead, setToonYou } from "@/lib/star/style3d/toon/bodies";
import { parseQuality3d, quality3dTier } from "@/lib/star/three3d/quality";
import { isAbandonedScene } from "@/lib/star/three3d/perf";
import { formatMoney, MONEY_SIGN } from "@/lib/star/money";
import {
  BEARD_LABEL, BARBER_NAME, STYLES, TEXTURES, TEXTURE_LABEL, barberCut, barberLine, cutMins, cutPrice, hairLook3d, hairNow,
  hairState, priceText, stylesFor, yourHairLook3d, type HairStyleId,
} from "@/lib/star/barber";
import type { HairTexture } from "@/lib/star/style3d/toon/hairStyles";
import { pill } from "./Shop3D";
import LoadingCurtain from "./loading/LoadingCurtain";

const GOLD = "#facc15";
const INK = "#f7f1e8";
const BG = "#1b1512";
const RED = "#8b1a1a";

export interface Barber3DProps {
  career: CareerState;
  onBack: () => void;
  backLabel?: string;
  /** You paid for a cut: the career with the new hair, the money gone, the clock on. */
  onCareer: (c: CareerState) => void;
  /** Test page: fill its box instead of the whole screen. */
  embedded?: boolean;
  /** Start in the chair (stills). */
  seated?: boolean;
}

export default function Barber3D({ career, onBack, backLabel = "Street", onCareer, embedded = false, seated = false }: Barber3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const ctrl = useRef<BarberController | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "failed">("loading");
  const [state, setState] = useState<BarberState>(seated ? "seated" : "walking");
  const ownHead = yourToonHead(career.player);
  const [c, setC] = useState(career);
  const cRef = useRef(c);
  cRef.current = c;
  const saved = hairState(c, ownHead);
  const now = hairNow(c, ownHead);
  const [texture, setTexture] = useState<HairTexture>(saved.texture);
  const [style, setStyle] = useState<HairStyleId>(now.style);
  const [beard, setBeard] = useState<number | "keep">("keep");
  const [turn, setTurn] = useState(true);
  const [done, setDone] = useState<{ text: string; line: string } | null>(null);
  const [cutting, setCutting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const beardNow = beard === "keep" ? now.beard : beard;
  const look = useMemo(() => hairLook3d(style, beardNow, ownHead), [style, beardNow, ownHead]);
  // built once, with your look as you walk in
  const data = useMemo(() => {
    const kits = kitsOf(career.player.club);
    return {
      kits: { home: kits.home, away: kits.away },
      player: { skin: skinToneHex(career.player.skinTone), hair: hairColourHex(career.player.hairColour) },
      worn: wornAt(career, "shop"),
      look: yourHairLook3d(career, ownHead),
      seated,
      club: career.player.club,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (embedded) return;
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, [embedded]);

  // leaving the screen: your own look back (what the career says), whatever was tried on
  useEffect(() => () => { setToonYou({ hairLook: yourHairLook3d(cRef.current, ownHead) }); }, [ownHead]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let gone = false;
    const q = new URLSearchParams(window.location.search);
    const quality = parseQuality3d(q.get("q")) ?? quality3dTier();
    const fixedStep = q.get("film") === "1" ? 1 / 30 : undefined;
    const go = window.setTimeout(() => import("@/lib/star/barber3d/scene")
      .then(({ startBarber }) => startBarber(el, {
        onState: (s) => { if (!gone) setState(s); },
        onLeft: () => { if (!gone) backRef.current(); },
        onContextLost: () => { if (!gone) setLoad("failed"); },
      }, data, { quality, fixedStep, isDead: () => gone }))
      .then((k) => {
        if (gone) { k.dispose(); return; }
        ctrl.current = k;
        (window as unknown as { __barber3d?: BarberController }).__barber3d = k;
        setLoad("ready");
      })
      .catch((e) => { if (gone || isAbandonedScene(e)) return; console.error("3D barber failed to load", e); setLoad("failed"); }), 0);
    return () => {
      gone = true;
      window.clearTimeout(go);
      ctrl.current?.dispose(); ctrl.current = null;
      delete (window as unknown as { __barber3d?: BarberController }).__barber3d;
    };
  }, [data]);

  // the style on your head as you pick it; the chair turns while you look
  useEffect(() => { if (state === "seated" && !cutting && !done) void ctrl.current?.preview(look); }, [look, state, cutting, done]);
  useEffect(() => { ctrl.current?.setTurn(turn && state === "seated" && !done && !cutting); }, [turn, state, done, cutting]);

  const list = stylesFor(texture);
  const price = cutPrice(style, c.contract?.wage ?? 0);
  const canPay = (c.money ?? 0) >= price;
  const pay = async () => {
    setError(null);
    const r = barberCut(c, style, beard, ownHead, texture);
    if (!r.ok) { setError(r.text); return; }
    setCutting(barberLine(c, now.untidy));
    await ctrl.current?.cut(look, 3.6);
    setC(r.career);
    onCareer(r.career);
    setCutting(null);
    const mins = cutMins(style);
    setDone({ text: `${r.text.replace(/\.$/, "")} · ${MONEY_SIGN}${formatMoney(r.price)} · ${mins} minutes`, line: "Looking sharp." });
  };
  const leave = () => { setDone(null); setCutting(null); if (ctrl.current && load === "ready") ctrl.current.leave(); else onBack(); };

  const drag = useRef<{ id: number; x: number } | null>(null);
  const seatedUi = load === "ready" && state === "seated" && !cutting && !done;

  if (load === "failed") {
    return (
      <div style={{ position: embedded ? "absolute" : "fixed", inset: 0, zIndex: embedded ? 1 : 80, background: BG, color: INK, display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif" }} data-barber3d="failed">
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>The barber&apos;s could not open its 3D on this phone</div>
          <button onClick={onBack} style={{ ...pill, marginTop: 16, cursor: "pointer" }}>&#8249; {backLabel}</button>
        </div>
      </div>
    );
  }

  const chip = (on: boolean): React.CSSProperties => ({
    height: 34, padding: "0 10px", borderRadius: 10, border: on ? `2px solid ${GOLD}` : "1px solid rgba(255,230,200,0.18)",
    background: on ? "rgba(250,204,21,0.16)" : "rgba(255,255,255,0.05)", color: INK, fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
  });
  return (
    <div style={{ position: embedded ? "absolute" : "fixed", inset: 0, zIndex: embedded ? 1 : 80, background: BG, color: INK, overflow: "hidden", touchAction: "none", userSelect: "none", fontFamily: "system-ui, sans-serif" }} data-barber3d={load} data-barber-state={state}>
      <div
        ref={host}
        style={{ position: "absolute", inset: 0 }}
        onPointerDown={(e) => { drag.current = { id: e.pointerId, x: e.clientX }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { const d = drag.current; if (!d || d.id !== e.pointerId) return; ctrl.current?.spin(e.clientX - d.x); d.x = e.clientX; if (turn) setTurn(false); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      />

      {/* top bar: back out to the street, your money */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", gap: 8, padding: "max(12px, env(safe-area-inset-top)) 12px 0", pointerEvents: "none" }}>
        <button onClick={leave} aria-label="Back" data-barber-back style={{ ...pill, pointerEvents: "auto", cursor: "pointer", gap: 4, paddingLeft: 10 }}>
          <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>&#8249;</span>{backLabel}
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ ...pill, gap: 6 }} data-barber-money><span aria-hidden>💷</span><b>{MONEY_SIGN}{formatMoney(c.money ?? 0)}</b></div>
        <div style={{ ...pill, gap: 6 }}><span aria-hidden>💈</span><b>Barber</b></div>
      </div>

      {load === "loading" && <div style={{ position: "absolute", inset: 0, background: BG }} />}
      <LoadingCurtain section="street" loading={load === "loading"} box={embedded} />

      {/* the chair: the styles that suit your hair, the beard, pay */}
      {seatedUi && (
        <div data-barber-picker data-bubble-clear style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "48%", display: "flex", flexDirection: "column", gap: 8, padding: "12px 12px max(14px, calc(env(safe-area-inset-bottom) + 10px))", background: "linear-gradient(to top, rgba(14,10,8,0.97) 70%, rgba(14,10,8,0.82))", borderTop: `3px solid ${RED}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.75, marginRight: 2 }}>Your hair</span>
            {TEXTURES.map((t) => (
              <button key={t} data-barber-texture={t} onClick={() => { setTexture(t); if (!stylesFor(t).includes(style)) setStyle("own"); }} style={{ ...chip(t === texture), height: 28, padding: "0 8px", fontSize: 12 }}>{TEXTURE_LABEL[t]}</button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => setTurn((v) => !v)} aria-label="Turn the chair" title="Turn the chair (or drag)" style={{ ...chip(turn), height: 28, width: 34, padding: 0, fontSize: 16 }}>&#10227;</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, overflowY: "auto", touchAction: "pan-y", minHeight: 0 }} data-barber-styles>
            {list.map((s) => {
              const on = s === style;
              return (
                <button key={s} data-barber-style={s} onClick={() => setStyle(s)} style={{ ...chip(on), height: "auto", minHeight: 44, padding: "6px 10px", display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", whiteSpace: "normal" }}>
                  <span style={{ display: "flex", width: "100%", gap: 6, alignItems: "baseline" }}><b style={{ fontSize: 14 }}>{STYLES[s].label}</b><span style={{ flex: 1 }} /><span style={{ fontSize: 12, color: GOLD }}>{priceText(cutPrice(s, c.contract?.wage ?? 0))}</span></span>
                  <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>{s === now.style && s !== "own" ? "What you have now" : STYLES[s].line}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", overflowX: "auto", touchAction: "pan-x" }} data-barber-beards>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.75, marginRight: 2 }}>Beard</span>
            {(["keep", 0, 1, 2, 3] as const).map((b) => (
              <button key={String(b)} data-barber-beard={String(b)} onClick={() => setBeard(b)} style={{ ...chip(beard === b), height: 30, fontSize: 12 }}>{b === "keep" ? "As it is" : BEARD_LABEL[b]}</button>
            ))}
          </div>
          {error && <div style={{ fontSize: 13, fontWeight: 800, color: "#fca5a5" }}>{error}</div>}
          <button data-barber-pay disabled={!canPay} onClick={pay} style={{ height: 48, borderRadius: 14, border: "none", background: canPay ? GOLD : "rgba(255,255,255,0.15)", color: canPay ? "#111" : "rgba(255,255,255,0.6)", fontWeight: 900, fontSize: 16, cursor: canPay ? "pointer" : "default" }}>
            {canPay ? `Pay ${priceText(price)} · Cut` : `Not enough money (${priceText(price)})`}
          </button>
        </div>
      )}

      {/* the cut: the barber's line, like a TV caption */}
      {cutting && (
        <div data-barber-cutting data-bubble-clear style={{ position: "absolute", left: 12, right: 12, bottom: "max(28px, calc(env(safe-area-inset-bottom) + 20px))", padding: "10px 14px", borderRadius: 14, background: "rgba(14,10,8,0.86)", borderLeft: `4px solid ${RED}` }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: GOLD, letterSpacing: 0.2 }}>{BARBER_NAME}</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>&ldquo;{cutting}&rdquo;</div>
        </div>
      )}

      {/* the mirror: a gilt frame round the screen, what it did, and the way out */}
      {done && (
        <>
          <div aria-hidden style={{ position: "absolute", inset: 10, borderRadius: 16, border: "6px solid #c9a14f", boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.35), 0 0 0 2px rgba(0,0,0,0.35)", pointerEvents: "none", top: "max(58px, calc(env(safe-area-inset-top) + 50px))" }} />
          <div data-barber-done data-bubble-clear style={{ position: "absolute", left: 12, right: 12, bottom: "max(20px, calc(env(safe-area-inset-bottom) + 14px))", padding: 14, borderRadius: 16, background: "rgba(14,10,8,0.9)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div><div style={{ fontSize: 18, fontWeight: 900 }}>{done.line}</div><div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>{done.text}</div></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setDone(null)} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid rgba(255,230,200,0.25)", background: "rgba(255,255,255,0.06)", color: INK, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Another style</button>
              <button data-barber-leave onClick={leave} style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: GOLD, color: "#111", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>Leave &#8250;</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
