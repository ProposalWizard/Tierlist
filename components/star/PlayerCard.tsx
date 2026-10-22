"use client";

/**
 * YOUR PLAYER CARD — FIFA style (Harry, 22 Oct 2026: "we should be building a
 * 'card' with the players stats as we go"; picked: FIFA-style card).
 *
 * Overall, position, flag and badge down the left; your drawn head (photo
 * faces are off, FACT-UI-015); name; the six skills. Colour by tier
 * (lib/star/playerCard.ts CARD_TIERS: bronze, silver, gold, special).
 *
 * Live: it reads the career, so it changes after every match and training.
 * A stat that went UP since this device last showed the card gets one green
 * "+2" flash (once; remembered in localStorage, so the next look is quiet).
 *
 * "Save image" photographs the card (html2canvas) to a PNG. The card's shape
 * is an SVG behind the content, not a CSS clip, because html2canvas cannot
 * draw clip-path.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { CARD_STATS, cardData, cardGains, type CardStatKey, type CardTier } from "@/lib/star/playerCard";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex, shortDisplayName } from "@/lib/star/playerIdentity";
import ClubBadge from "./ClubBadge";
import NationFlag from "./NationFlag";
import DrawnHeadChip from "./DrawnHeadChip";

/** Each tier's paint: the card's gradient, its edge, its ink. */
const LOOK: Record<CardTier, { stops: [string, string, string]; edge: string; ink: string; soft: string; line: string }> = {
  bronze: { stops: ["#e0a878", "#b5794a", "#7c4a26"], edge: "#5a3417", ink: "#2e1a0b", soft: "rgba(46,26,11,.7)", line: "rgba(46,26,11,.28)" },
  silver: { stops: ["#f4f7fa", "#c3cbd3", "#8b959f"], edge: "#5f6973", ink: "#1b232b", soft: "rgba(27,35,43,.68)", line: "rgba(27,35,43,.24)" },
  gold: { stops: ["#fff1b0", "#f2c94c", "#b7861a"], edge: "#7a5608", ink: "#2f2200", soft: "rgba(47,34,0,.7)", line: "rgba(47,34,0,.26)" },
  special: { stops: ["#3b1d8f", "#1a0f45", "#0b4e6b"], edge: "#f5c84c", ink: "#fde68a", soft: "rgba(253,230,138,.78)", line: "rgba(253,230,138,.35)" },
};

export const TIER_NAME: Record<CardTier, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", special: "Special" };

const W = 216;
const H = 306;
/** The FUT shield: notched top corners, a point at the bottom. */
const SHIELD = `M 26 4 L ${W - 26} 4 Q ${W - 20} 18 ${W - 4} 22 L ${W - 4} ${H - 58} Q ${W - 6} ${H - 40} ${W - 34} ${H - 30} L ${W / 2 + 8} ${H - 6} Q ${W / 2} ${H - 2} ${W / 2 - 8} ${H - 6} L 34 ${H - 30} Q 6 ${H - 40} 4 ${H - 58} L 4 22 Q 20 18 26 4 Z`;

const seenKey = (c: CareerState) => `star-card-seen:${c.player.firstName}|${c.player.lastName}|${c.player.startYear}`;

function readSeen(key: string): Partial<Record<CardStatKey | "overall", number>> | null {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
function writeSeen(key: string, v: Record<string, number>) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: no flash memory */ }
}

export default function PlayerCard({ career, saveButton = true }: { career: CareerState; saveButton?: boolean }) {
  const data = useMemo(() => cardData(career), [career]);
  const look = LOOK[data.tier];
  const kit = kitsOf(career.player.club).home;
  const nation = career.player.nationality || "England";
  const name = shortDisplayName(career.player).toUpperCase();
  const cardRef = useRef<HTMLDivElement>(null);
  const [gains, setGains] = useState<Partial<Record<CardStatKey | "overall", number>>>({});
  const [flashId, setFlashId] = useState(0);
  const [saving, setSaving] = useState(false);

  // The flash: compare with what this device last showed, flash the rises once.
  const sig = JSON.stringify({ ...data.stats, overall: data.overall });
  useEffect(() => {
    const key = seenKey(career);
    const before = readSeen(key);
    const now = { ...data.stats, overall: data.overall };
    const g: Partial<Record<CardStatKey | "overall", number>> = cardGains(before, data.stats);
    if (before && typeof before.overall === "number" && data.overall > before.overall) g.overall = data.overall - before.overall;
    writeSeen(key, now);
    if (Object.keys(g).length === 0) return;
    setGains(g);
    setFlashId((n) => n + 1);
    const t = window.setTimeout(() => setGains({}), 2200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const save = async () => {
    const el = cardRef.current;
    if (!el || saving) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, { backgroundColor: null, scale: 3, useCORS: true, logging: false });
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (!blob) return;
      const file = `knowitball-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${data.overall}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch { /* a failed photo leaves the card as it is */ } finally {
      setSaving(false);
    }
  };

  const half = (keys: typeof CARD_STATS) => (
    <div className="flex flex-col gap-[3px]">
      {keys.map((s) => {
        const up = gains[s.key];
        return (
          <div key={s.key} data-card-stat={s.key} className="relative flex items-baseline gap-1.5" title={s.name}>
            <span
              key={up ? `u${flashId}` : "n"}
              className={`w-[26px] text-right text-[19px] leading-none tabular-nums ${up ? "pc-flash" : ""}`}
              style={{ fontFamily: "var(--sk-display)", color: look.ink }}
            >{data.stats[s.key]}</span>
            <span className="text-[13px] font-bold leading-none tracking-wide" style={{ color: look.soft }}>{s.label}</span>
            {up ? <span key={`p${flashId}`} data-card-gain={s.key} className="pc-plus absolute -right-1 -top-1 text-[11px] font-black leading-none">+{up}</span> : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="relative flex justify-center py-1" data-player-card={data.tier}>
      <style>{`
        @keyframes pcFlash { 0% { color: #16a34a; text-shadow: 0 0 10px rgba(34,197,94,.9); } 70% { color: #16a34a; text-shadow: 0 0 6px rgba(34,197,94,.6); } 100% { text-shadow: none; } }
        @keyframes pcPlus { 0% { opacity: 0; transform: translateY(4px); } 12% { opacity: 1; transform: translateY(0); } 75% { opacity: 1; } 100% { opacity: 0; transform: translateY(-4px); } }
        .pc-flash { animation: pcFlash 2s ease-out 1 both; }
        .pc-plus { color: #fff; background: #16a34a; padding: 2px 4px; border-radius: 4px; animation: pcPlus 2.1s ease-out 1 both; }
        @media (prefers-reduced-motion: reduce) { .pc-flash { animation: none; color: #16a34a !important; } .pc-plus { animation: none; } }
      `}</style>
      <div ref={cardRef} className="relative shrink-0" style={{ width: W, height: H }} aria-label={`${TIER_NAME[data.tier]} card, overall ${data.overall}`}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0" aria-hidden>
          <defs>
            <linearGradient id={`pc-g-${data.tier}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={look.stops[0]} />
              <stop offset="0.5" stopColor={look.stops[1]} />
              <stop offset="1" stopColor={look.stops[2]} />
            </linearGradient>
            <linearGradient id={`pc-s-${data.tier}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity={data.tier === "special" ? 0.18 : 0.5} />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={SHIELD} fill={`url(#pc-g-${data.tier})`} stroke={look.edge} strokeWidth="3" />
          <path d={SHIELD} fill={`url(#pc-s-${data.tier})`} />
          {data.tier === "special" && (
            <g opacity="0.22" stroke="#67e8f9" strokeWidth="1.2" fill="none">
              <path d={`M 10 ${H * 0.62} L ${W - 10} ${H * 0.2}`} />
              <path d={`M 10 ${H * 0.72} L ${W - 10} ${H * 0.3}`} />
              <path d={`M 30 ${H * 0.8} L ${W - 10} ${H * 0.42}`} />
            </g>
          )}
          <path d={`M 26 ${H * 0.36 + 70} L ${W - 26} ${H * 0.36 + 70}`} stroke={look.line} strokeWidth="1" />
        </svg>

        {/* Left column: overall, position, flag, badge. */}
        <div className="absolute flex flex-col items-center" style={{ left: 22, top: 30, width: 50 }}>
          <span key={gains.overall ? `o${flashId}` : "o"} data-card-overall className={`text-[44px] leading-[0.9] tabular-nums ${gains.overall ? "pc-flash" : ""}`} style={{ fontFamily: "var(--sk-display)", color: look.ink }}>{data.overall}</span>
          <span className="mt-0.5 text-[15px] leading-none" style={{ fontFamily: "var(--sk-display)", color: look.ink }}>{data.position}</span>
          <span className="my-1.5 block h-px w-8" style={{ background: look.line }} />
          <NationFlag nation={nation} width={28} rounded={2} />
          <span className="mt-1.5 block"><ClubBadge club={career.player.club} kit={kit} size={28} /></span>
        </div>

        {/* The face: the same drawn head the match draws on you. */}
        <div className="absolute overflow-hidden" style={{ right: 16, top: 26, width: 124, height: 124 }}>
          <DrawnHeadChip id="you" shirt={kit.shirt} shorts={kit.trim} trim={kit.trim} size={124} skin={skinToneHex(career.player.skinTone)} />
        </div>

        {/* Name. */}
        <div className="absolute left-0 right-0 text-center" style={{ top: 156 }}>
          <div className="mx-auto truncate px-6 text-[19px] leading-none tracking-wide" style={{ fontFamily: "var(--sk-display)", color: look.ink }}>{name}</div>
        </div>

        {/* The six. */}
        <div className="absolute flex justify-center gap-5" style={{ left: 0, right: 0, top: 190 }}>
          {half(CARD_STATS.slice(0, 3))}
          <span className="block w-px self-stretch" style={{ background: look.line }} />
          {half(CARD_STATS.slice(3))}
        </div>
      </div>

      {saveButton && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          data-card-save
          className="kib-press absolute bottom-2 right-0 flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-black uppercase leading-none text-white"
          style={{ background: "rgba(var(--sk-flat-rgb),.75)", boxShadow: "inset 0 0 0 1px var(--sk-edge)" }}
          aria-label="Save image"
        >
          <span className="text-[16px] leading-none">⤓</span>
          <span>{saving ? "Saving" : "Save"}</span>
          <span>image</span>
        </button>
      )}
    </div>
  );
}
