"use client";
import type { CareerState } from "@/lib/star/types";
import { formatMoney } from "@/lib/star/money";
import { useCountUp } from "./motion";

/**
 * THE TOP BAR — the same on every screen (Harry, 1 Oct 2026: "the pills at
 * the top aren't uniform across every page"). Home button, the player's name,
 * then his age and his money right next to it, a "?" slot and Settings.
 *
 *   <GameBar career={career} onHome={…} atHome={false} onHelp={…} onSettings={…} />
 *
 * Money and age live HERE, not in the HUD under it (his words: "put the money
 * next to the name and the age next to the name at the very top bar"). The
 * "?" slot is always there: with no help for the screen it is an empty
 * spacer, so nothing ever shifts sideways. Rendered by DashboardShell and,
 * through page.tsx's `screenTop`, above every full-screen page.
 */
export default function GameBar({ career, onHome, atHome = false, onHelp, onSettings }: {
  career: CareerState;
  onHome: () => void;
  /** On one of the three swipe screens: the house button is plain; elsewhere it lights green. */
  atHome?: boolean;
  onHelp?: () => void;
  onSettings: () => void;
}) {
  const fullName = `${career.player.firstName} ${career.player.lastName}`;
  const money = useCountUp(career.money, 800);
  return (
    <div data-game-bar className="sk-bar flex h-[48px] shrink-0 items-center gap-1.5 border-b border-black/50 bg-gradient-to-b from-gray-700 to-gray-800 px-3 shadow-md">
      {/* Home, top left. Lit green when you are off the home screens, so the way back is obvious. */}
      <button
        data-home-button
        data-tour="home"
        onClick={onHome}
        aria-label="Home"
        className={`kib-press flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
          atHome
            ? "border-transparent bg-gray-600 hover:bg-gray-500"
            : "border-emerald-300/70 bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,.55)]"
        }`}
      >
        <HouseIcon />
      </button>
      <div className="sk-display min-w-0 flex-1 truncate text-[15px] font-black uppercase leading-tight tracking-wide text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.7)" }}>
        {fullName}
      </div>
      {/* Age and money, next to the name. */}
      <div data-age-chip aria-label={`Age ${career.player.age}`} className="flex shrink-0 items-baseline gap-1 rounded-[3px] bg-black/35 px-1.5 py-1">
        <span className="text-[9px] font-black uppercase leading-none tracking-[0.12em] text-white/70">Age</span>
        <span className="sk-num text-[13px] font-black leading-none tabular-nums text-white">{career.player.age}</span>
      </div>
      <div data-money-chip data-tour="money" aria-label={`Money ${formatMoney(career.money)}`} className="flex shrink-0 items-center gap-1 rounded-[3px] bg-black/35 px-1.5 py-1">
        <span className="text-[12px] leading-none text-yellow-300">★</span>
        <span className="sk-num text-[13px] font-black leading-none tabular-nums text-yellow-200">{formatMoney(Math.round(money))}</span>
      </div>
      {onHelp ? (
        <button onClick={onHelp} data-help-button aria-label="Help — show me around" className="kib-press flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-gray-600 text-[17px] font-black leading-none text-amber-300 hover:bg-gray-500">?</button>
      ) : (
        <span aria-hidden className="h-8 w-8 shrink-0" />
      )}
      <button onClick={onSettings} aria-label="Settings" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-gray-600 text-white hover:bg-gray-500">
        <GearIcon />
      </button>
    </div>
  );
}

function HouseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9v11h13V9" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
