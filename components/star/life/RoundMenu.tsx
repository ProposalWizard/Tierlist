"use client";
/**
 * THE ROUND MENU — tap a person, choose what to do with him (Sims style;
 * Harry, 20 Nov 2026, 15:35: "I love the sims round bar to decide what to
 * interact on"). Six bubbles round his head (Friendly, Banter, Football,
 * Business, See you, Mean), his name plate above (mood, Bond, Respect), then
 * a short list of lines, each tagged with what it is likely to do.
 *
 * HOW THE 3D WORLD USES IT (world kit, later; this file draws nothing 3D):
 *   <div style={{ position: "relative" }}>            ← an overlay the size of the canvas
 *     <canvas … />
 *     <RoundMenu menu={roundMenuFor(career, id)}      ← lib/star/life/roundMenu.ts
 *       anchor={{ x, y }}                             ← his head projected to overlay px
 *       size={{ w, h }}                               ← the overlay's size
 *       onPick={(line) => { const r = playRoundLine(career, id, line, rng); setCareer(r.career); setReply({ text: r.reply, delta: r.delta, key: Date.now() }); }}
 *       onClose={() => …}                             ← "See you", Esc, right-click
 *       reply={reply} />
 *   </div>
 * Keep the camera so he stands near the middle (the bubbles need room).
 * Keys on a computer: 1-6 a bubble, then 1-3 a line, Esc goes back.
 */
import { useEffect, useState } from "react";
import type { RoundCategory, RoundLine, RoundMenuData, RoundTag } from "@/lib/star/life/roundMenu";
import "./decision.css";

export interface RoundReply { text: string; delta: { bond: number; respect: number; grudge: number }; key: number }

const ANGLES = [-150, -90, -30, 30, 90, 150];
const TAG: Record<RoundTag, [string, string]> = {
  bond: ["▲ BOND", "#3ddc84"], respect: ["▲ RESPECT", "#4aa8ff"], risky: ["▲▼ RISKY", "#f5b942"], mean: ["▼ BOND", "#ff5a4d"], bye: ["", ""],
};

export default function RoundMenu({ menu, anchor, size, onPick, onClose, reply, others = [] }: {
  menu: RoundMenuData;
  anchor: { x: number; y: number };
  size: { w: number; h: number };
  onPick: (line: RoundLine, cat: RoundCategory) => void;
  onClose: () => void;
  reply?: RoundReply | null;
  /** Picture bubbles over other people (what they chat about on their own). */
  others?: { x: number; y: number; icon: string }[];
}) {
  const [open, setOpen] = useState<RoundCategory | null>(null);
  const wide = size.w >= 900;
  const R = wide ? 128 : 112;
  const cx = Math.max(R + 44, Math.min(size.w - R - 44, anchor.x));
  // Room under the ring for three lines and the hint.
  const cy = Math.max(R + 150, Math.min(size.h - R - 312, anchor.y));
  const listW = Math.min(size.w - 32, 440);
  const listTop = Math.min(cy + R + 52, size.h - 3 * 56 - 70);

  const choose = (c: RoundCategory) => { if (c.id === "bye") { onClose(); return; } setOpen((o) => (o?.id === c.id ? null : c)); };

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") { e.preventDefault(); if (open) setOpen(null); else onClose(); return; }
      const n = Number(e.key);
      if (!n) return;
      if (open) { const l = open.lines[n - 1]; if (l) { e.preventDefault(); onPick(l, open); } }
      else { const c = menu.categories[n - 1]; if (c) { e.preventDefault(); choose(c); } }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, menu, onPick, onClose]);

  const plateTop = cy - R - 124;
  const float = reply && (reply.delta.bond || reply.delta.respect)
    ? (reply.delta.bond ? `${reply.delta.bond > 0 ? "+" : ""}${reply.delta.bond} bond` : `${reply.delta.respect > 0 ? "+" : ""}${reply.delta.respect} respect`)
    : null;
  const floatGood = reply ? (reply.delta.bond || reply.delta.respect) > 0 : false;

  return (
    <div className="dd dd-rm" data-round-menu={menu.id} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div className="dd-rm-dim" style={{ background: `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) ${R * 0.62}px, rgba(3,8,18,.38) ${R * 1.8}px)` }} />
      <div className="dd-rm-dim" style={{ top: "auto", height: 280, background: "linear-gradient(180deg, rgba(4,10,20,0), rgba(4,10,20,.85))" }} />
      {others.map((o, i) => <div key={i} className="dd-chatbub" style={{ left: Math.max(28, Math.min(size.w - 28, o.x)), top: o.y }} aria-hidden>{o.icon}</div>)}

      {/* His plate: name, mood, bond and respect */}
      <div className="dd-plate dd-glass" style={{ left: cx, top: plateTop }} data-plate>
        <div className="top"><span style={{ fontSize: 17 }}>{menu.mood.face}</span>{menu.name}<span className="mood">{menu.mood.word}</span></div>
        <div className="bars">
          Bond<div className="bar"><i style={{ width: `${menu.bond}%`, background: "#3ddc84" }} /></div>
          Respect<div className="bar"><i style={{ width: `${menu.respect}%`, background: "#4aa8ff" }} /></div>
        </div>
        {float && <span key={reply!.key} className="dd-float" style={{ color: floatGood ? "#6ee7a0" : "#ff8a80" }}>{float}</span>}
      </div>
      {reply && <div className="dd-bubble" style={{ left: cx, top: plateTop - 12 }} data-reply><div key={reply.key} className="dd-pop">{reply.text}</div></div>}

      {/* The ring */}
      <svg className="absolute left-0 top-0" width={size.w} height={size.h} style={{ pointerEvents: "none" }} aria-hidden>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" strokeDasharray="3 7" />
        <circle cx={cx} cy={cy} r={R * 0.46} fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2.5" />
      </svg>
      {menu.categories.map((c, i) => {
        const a = (ANGLES[i % 6] * Math.PI) / 180;
        const state = open ? (open.id === c.id ? "on" : "dim") : undefined;
        return (
          <button key={c.id} type="button" className="dd-node dd-pop" style={{ "--c": c.color, left: cx + Math.cos(a) * R, top: cy + Math.sin(a) * R, animationDelay: `${i * 30}ms` } as React.CSSProperties}
            data-state={state} data-cat={c.id} aria-label={c.label} onClick={() => choose(c)}>
            <div><div className="i">{c.icon}</div><div className="n">{c.label}</div></div>
          </button>
        );
      })}

      {open && (
        <div className="dd-opts" style={{ top: listTop, left: (size.w - listW) / 2, right: "auto", width: listW }} data-lines>
          <div className="dd-kick" style={{ textAlign: "center", color: open.color, textShadow: "0 1px 6px #000" }}>Pick a line</div>
          {open.lines.map((l) => {
            const [t, col] = TAG[l.tag];
            return (
              <button key={l.id} type="button" className="dd-opt dd-pop" style={{ "--c": `${open.color}c0` } as React.CSSProperties} onClick={() => onPick(l, open)} data-line={l.id}>
                <span className="e">{l.icon}</span>{l.text}<small style={{ color: col }}>{t}</small>
              </button>
            );
          })}
        </div>
      )}
      <div className="dd-rm-hint">{open || /bubble/i.test(menu.hint) ? menu.hint : `${menu.hint}. Tap a bubble.`}</div>
    </div>
  );
}
