"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { KIB_CANS } from "@/lib/star/shopData";
import { starStatus } from "@/lib/star/starPoints";
import { hasSeen } from "@/lib/star/unlocks";
import KibCanIcon from "../KibCanIcon";
import StarRatingSheet from "../StarRatingSheet";
import { SquareBar } from "./Flat";
import { Shake } from "./juice";
import { useCountUp, prefersReducedMotion } from "./motion";
import { levelColors } from "./StatBar";

/**
 * THE TOP HUD (Harry, 1 Oct 2026, P80/P81/P86: "your energy never leaves").
 * Modelled on New Star Soccer's Star Rating | Energy strip, in our own flat,
 * square look — no floating pills.
 *
 *   <TopHud career={career} screen="home" onUseCan={use} onOpenCans={() => setPhase("shop-kib")} />
 *
 * ONE block, the same on every screen: star rating on the left, energy with
 * its can on the right (USE when you hold a can, BUY — the cans shop — when
 * you do not). Harry: "the star rating and the energy need to be more
 * encapsulated … put the money next to the name and the age next to the name
 * at the very top bar", then "the pills at the top aren't uniform across
 * every page". So money and age live in the top bar (ui/GameBar.tsx), and
 * nothing here changes with the screen. `screen` only labels the block.
 */
export type HudScreen = "home" | "stats" | "training" | "shop" | "relations" | "league" | "other" | "casino" | "settings";

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
  const [starPass, setStarPass] = useState(false);
  return (
    <div data-hud={screen} className={`shrink-0 px-2 pb-1 pt-1.5 ${className}`}>
      {starPass && <StarRatingSheet career={career} onClose={() => setStarPass(false)} />}
      {/* One encapsulated block: rating | energy, a hairline between. */}
      <div data-hud-block className="grid grid-cols-2 gap-px overflow-hidden bg-black/55" style={{ borderRadius: 3, boxShadow: "inset 0 0 0 1px var(--sk-edge, rgba(255,255,255,.22))" }}>
        <RatingCell career={career} onOpen={() => setStarPass(true)} />
        <EnergyCell career={career} onUseCan={onUseCan} onOpenCans={onOpenCans} />
      </div>
    </div>
  );
}

// A cell is a flat, square block on a dark wash; the 1px gap shows the divider.
const CELL = "relative flex min-w-0 items-center gap-1.5 px-2";
const WASH = { background: "linear-gradient(180deg, rgba(var(--sk-flat-rgb),.78), rgba(var(--sk-flat-rgb),.58))" } as const;

function RatingCell({ career, onOpen }: { career: CareerState; onOpen: () => void }) {
  const star = starStatus(career);
  const shown = useCountUp(star.stars);
  // The Star Pass stays locked until the tutorial is done (Harry, P15).
  const open = hasSeen(career, "tutorial");
  return (
    <button onClick={open ? onOpen : undefined} data-tour="rating" aria-label={open ? "Star Pass" : "Star rating"} className={`kib-press ${CELL} h-[34px] text-left`} style={WASH}>
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
    <div data-tour="energy" className={`${CELL} h-[34px]`} style={WASH}>
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
