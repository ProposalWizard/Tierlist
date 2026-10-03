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
    // v0.25 (Harry and Mikey, 2 Oct 2026, P7/P8): the top area is a light grey
    // that blends with the HUD under it, no outline, after New Star Soccer's
    // home screen. Colours are the --sk-top-* tokens in ui/flat.css.
    <div data-game-bar className="sk-bar sk-top flex h-[48px] shrink-0 items-center gap-1.5 px-3" style={{ background: "var(--sk-top-bg)" }}>
      {/* Home, top left. Lit green when you are off the home screens, so the way back is obvious. */}
      <button
        data-home-button
        data-tour="home"
        onClick={onHome}
        aria-label="Home"
        className={`kib-press flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] transition-colors ${
          atHome ? "sk-top-btn" : "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_1px_3px_rgba(0,0,0,.25)]"
        }`}
      >
        <HouseIcon />
      </button>
      <div className="sk-display min-w-0 flex-1 truncate text-[15px] font-black uppercase leading-tight tracking-wide" style={{ color: "var(--sk-top-ink)" }}>
        {fullName}
      </div>
      {/* Age and money, next to the name. */}
      <div data-age-chip aria-label={`Age ${career.player.age}`} className="sk-top-chip flex shrink-0 items-baseline gap-1 rounded-[3px] px-1.5 py-1">
        <span className="text-[9px] font-black uppercase leading-none tracking-[0.12em]" style={{ color: "var(--sk-top-soft)" }}>Age</span>
        <span className="sk-num text-[13px] font-black leading-none tabular-nums" style={{ color: "var(--sk-top-ink)" }}>{career.player.age}</span>
      </div>
      <div data-money-chip data-tour="money" aria-label={`Money ${formatMoney(career.money)}`} className="sk-top-chip flex shrink-0 items-center gap-1 rounded-[3px] px-1.5 py-1">
        <span className="text-[12px] leading-none text-amber-500">★</span>
        <span className="sk-num text-[13px] font-black leading-none tabular-nums" style={{ color: "var(--sk-top-ink)" }}>{formatMoney(Math.round(money))}</span>
      </div>
      {onHelp ? (
        <button onClick={onHelp} data-help-button aria-label="Help — show me around" className="kib-press sk-top-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] text-[17px] font-black leading-none" style={{ color: "#b45309" }}>?</button>
      ) : (
        <span aria-hidden className="h-8 w-8 shrink-0" />
      )}
      <button onClick={onSettings} aria-label="Settings" className="kib-press sk-top-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px]">
        <GearIcon />
      </button>
    </div>
  );
}

function HouseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9v11h13V9" />
      <path d="M10 20v-5.5h4V20" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
