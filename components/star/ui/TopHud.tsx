"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { KIB_CANS } from "@/lib/star/shopData";
import { formatMoney } from "@/lib/star/money";
import { starStatus } from "@/lib/star/starPoints";
import KibCanIcon from "../KibCanIcon";
import StarRatingSheet from "../StarRatingSheet";
import { SquareBar } from "./Flat";
import { Shake } from "./juice";
import { useCountUp, prefersReducedMotion } from "./motion";
import { levelColors } from "./StatBar";

/**
 * THE TOP HUD (Harry, 1 Oct 2026, P80/P81/P86: "the pills at the top change
 * based on what screen you're in, so that's kind of like your HUD … but your
 * energy never leaves"). Modelled on New Star Soccer's Star Rating | Energy
 * strip, in our own flat, square look — no floating pills.
 *
 *   <TopHud career={career} screen="home" onUseCan={use} onOpenCans={() => setPhase("shop-kib")} />
 *
 * Two flush rows: two big cells (each half the width, touching), then a thin
 * strip. Which cells show depends on `screen` (HUD_SPEC below); ENERGY is
 * in every one of them, with its can right next to it: USE when you hold a
 * can, BUY (opens the cans shop) when you do not.
 */
export type HudScreen = "home" | "stats" | "training" | "shop" | "relations" | "league" | "other";
export type HudCell = "rating" | "energy" | "money" | "happiness" | "age";

export const HUD_SPEC: Record<HudScreen, { top: HudCell[]; strip: HudCell[] }> = {
  home: { top: ["rating", "energy"], strip: ["money", "age"] },
  stats: { top: ["rating", "energy"], strip: ["money", "age"] },
  training: { top: ["rating", "energy"], strip: ["money"] },
  shop: { top: ["money", "energy"], strip: [] },
  relations: { top: ["happiness", "energy"], strip: ["money"] },
  league: { top: ["energy", "money"], strip: [] },
  other: { top: ["rating", "energy"], strip: ["money", "age"] },
};

/** The can that gives energy is the Basic one (the others are boot abilities). */
const ENERGY_CAN = KIB_CANS.find((c) => !c.effect) ?? KIB_CANS[0];
const CAN_ACCENT = "#fb923c";

export default function TopHud({ career, screen, onUseCan, onOpenCans, className = "" }: {
  career: CareerState;
  screen: HudScreen;
  onUseCan: (id: (typeof KIB_CANS)[number]["id"]) => void;
  /** BUY: take the player to the cans in the shop. */
  onOpenCans: () => void;
  className?: string;
}) {
  const spec = HUD_SPEC[screen];
  const [starPass, setStarPass] = useState(false);
  const cell = (c: HudCell) => {
    switch (c) {
      case "rating": return <RatingCell key={c} career={career} onOpen={() => setStarPass(true)} />;
      case "energy": return <EnergyCell key={c} career={career} onUseCan={onUseCan} onOpenCans={onOpenCans} />;
      case "money": return <MoneyCell key={c} career={career} big />;
      case "happiness": return <HappinessCell key={c} career={career} />;
      default: return null;
    }
  };
  return (
    <div data-hud={screen} className={`shrink-0 ${className}`}>
      {starPass && <StarRatingSheet career={career} onClose={() => setStarPass(false)} />}
      <div className={`grid ${spec.top.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-px bg-black/50`}>
        {spec.top.map(cell)}
      </div>
      {spec.strip.length > 0 && (
        <div className="flex items-stretch gap-px bg-black/50">
          {spec.strip.map((c) => c === "money" ? <MoneyCell key={c} career={career} /> : c === "age" ? <AgeCell key={c} career={career} /> : null)}
        </div>
      )}
    </div>
  );
}

// A cell is a flat, square block on a dark wash; the 1px gap shows the divider.
const CELL = "relative flex min-w-0 items-center gap-1.5 px-2";
const WASH = { background: "linear-gradient(180deg, rgba(var(--sk-flat-rgb),.78), rgba(var(--sk-flat-rgb),.58))" } as const;

function RatingCell({ career, onOpen }: { career: CareerState; onOpen: () => void }) {
  const star = starStatus(career);
  const shown = useCountUp(star.stars);
  return (
    <button onClick={onOpen} aria-label="Star rating — see how it is made up" className={`kib-press ${CELL} h-[34px] text-left`} style={WASH}>
      <span className="flex h-[24px] shrink-0 items-center gap-0.5 px-1.5 text-gray-950" style={{ background: "linear-gradient(180deg, #fde047, #f59e0b)", borderRadius: 2, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}>
        <span className="text-[13px] leading-none">★</span>
        <span className="min-w-[18px] text-[17px] font-black leading-none tabular-nums">{Math.round(shown)}</span>
      </span>
      <SquareBar value={Math.max(3, star.toNext * 100)} colors={["#f59e0b", "#fde047"]} className="h-[14px] min-w-0 flex-1" animate />
      {star.gate && <span className="shrink-0 text-[10px] font-black leading-none text-white">🔒</span>}
    </button>
  );
}

function EnergyCell({ career, onUseCan, onOpenCans }: { career: CareerState; onUseCan: (id: (typeof KIB_CANS)[number]["id"]) => void; onOpenCans: () => void }) {
  const e = Math.max(0, Math.min(100, Math.round(career.energy)));
  const shown = useCountUp(e, 900);
  const count = career.kibCans[ENERGY_CAN.id] ?? 0;
  const full = e >= 100;
  const [drinking, setDrinking] = useState(0);
  const act = () => {
    if (count <= 0) { onOpenCans(); return; }
    if (full) return;
    setDrinking((d) => d + 1);
    // Let the can shake and tip before the numbers move.
    setTimeout(() => onUseCan(ENERGY_CAN.id), typeof window !== "undefined" && prefersReducedMotion() ? 0 : 650);
  };
  return (
    <div className={`${CELL} h-[34px]`} style={WASH}>
      <span className="shrink-0 text-[13px] leading-none" aria-hidden>⚡</span>
      <SquareBar value={e} colors={levelColors(e)} className="h-[16px] min-w-0 flex-1" animate>{Math.round(shown)}</SquareBar>
      <div className="relative h-[26px] w-[16px] shrink-0">
        <Shake trigger={drinking} className="absolute inset-0 flex items-end justify-center" style={{ filter: `drop-shadow(0 2px 4px rgba(251,146,60,.55))` }}>
          <KibCanIcon can={ENERGY_CAN} className="h-[25px] w-[14px]" />
        </Shake>
        <span className="absolute -bottom-1 -right-2 min-w-[14px] bg-amber-400 px-[3px] text-center text-[9px] font-black leading-[12px] tabular-nums text-gray-950" style={{ borderRadius: 2 }}>×{count}</span>
      </div>
      <button
        onClick={act}
        disabled={count > 0 && full}
        aria-label={count > 0 ? (full ? "Energy is full" : "Use a can") : "Buy cans in the shop"}
        className={`kib-press ml-1.5 h-[24px] w-[38px] shrink-0 text-[11px] font-black leading-none text-gray-950 disabled:opacity-45 ${count > 0 ? "" : "animate-none"}`}
        style={{ borderRadius: 2, background: count > 0 ? "linear-gradient(180deg, #fdba74, #fb923c)" : "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}
      >
        {count > 0 ? (full ? "FULL" : "USE") : "BUY"}
      </button>
    </div>
  );
}

function MoneyCell({ career, big = false }: { career: CareerState; big?: boolean }) {
  const shown = useCountUp(career.money, 800);
  return (
    <div data-money-chip aria-label={`Money ${formatMoney(career.money)}`} className={`${CELL} ${big ? "h-[34px]" : "h-[20px] flex-1 justify-center"}`} style={WASH}>
      <span className={`${big ? "text-[15px]" : "text-[12px]"} leading-none text-yellow-300`}>★</span>
      <span className={`${big ? "text-[17px]" : "text-[13px]"} font-black leading-none tabular-nums text-yellow-200`}>{formatMoney(Math.round(shown))}</span>
    </div>
  );
}

function AgeCell({ career }: { career: CareerState }) {
  return (
    <div className={`${CELL} h-[20px] flex-1 justify-center`} style={WASH}>
      <span className="text-[10px] font-black uppercase leading-none tracking-[0.14em] text-white/70">Age</span>
      <span className="text-[13px] font-black leading-none tabular-nums text-white">{career.player.age}</span>
    </div>
  );
}

function HappinessCell({ career }: { career: CareerState }) {
  const h = Math.max(0, Math.min(100, Math.round(career.happiness ?? 0)));
  return (
    <div className={`${CELL} h-[34px]`} style={WASH}>
      <span className="shrink-0 text-[14px] leading-none" aria-hidden>😊</span>
      <SquareBar value={h} colors={levelColors(h)} className="h-[16px] min-w-0 flex-1" animate>{h}</SquareBar>
    </div>
  );
}
