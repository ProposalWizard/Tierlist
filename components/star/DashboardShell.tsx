"use client";
import { starsNow } from "@/lib/star/starPoints";
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { formatMoney } from "@/lib/star/money";
import { HomeFxStyles } from "./HomeFx";

interface Props {
  career: CareerState;
  /** Leave the career for the rest of Knowitball. No longer on the header
   *  (Harry, 28 Sep 2026: "the X in the top left should be replaced with a
   *  home button and a back out completely should be in settings") — it is
   *  the "Exit career" button at the bottom of Settings now. Kept on the
   *  props so a caller that still passes it compiles. */
  onExit?: () => void;
  children: React.ReactNode;
  onNavigate: (tab: NavTab) => void;
  onSettings: () => void;
  activeNav?: NavTab | null;
  /** A dot on the Phone button when there is reaction the player has not read. */
  mediaUnread?: boolean;
  nextMatchLabel?: string;
  /** "Sat 14 Feb" — see lib/star/calendar. */
  nextMatchDate?: string;
  /**
   * Skip the identity header, Star/Energy bars, Age/Cash strip and next-match
   * banner — just `children` (given the full body height) and the bottom nav.
   *
   * Built for the phone (see MediaFeed.tsx): reported directly — "the whole
   * screen should be the phone" — the usual stat strip above it was exactly
   * the room the phone needed to stop looking cramped, and losing the back
   * button it used to need is fine because the bottom nav is right there to
   * leave by instead.
   */
  fullBleed?: boolean;
  /**
   * The swipe home screens (Settings → Home screens) carry their own rating,
   * cash, energy and next match, so the strips that normally repeat them
   * above and below are left off. Header and bottom nav stay.
   */
  compact?: boolean;
  /** Back to the Home swipe screen — the house button, top left. There is no
   *  Home button on the bottom bar (Harry, 28 Sep 2026: "remove Home"). */
  onHome?: () => void;
  /** On one of the three swipe screens already. Off them, the house button
   *  lights up green so the way back is obvious. */
  atHome?: boolean;
  /** Unlock chain (lib/star/unlocks.ts): buttons still locked, each with the
   *  one line that says how to open it. Absent = everything open. */
  locked?: Partial<Record<NavTab, string>>;
  /** Unlock chain: Achievements takes the League button's place on the bar
   *  (Harry, 1 Oct 2026, 07:58). League is then reached from Stats or the phone. */
  achievementsSlot?: { active: boolean; onClick: () => void };
  /** The top HUD (ui/TopHud.tsx): replaces the Star/Energy bars, the Age
   *  strip and the header's money chip, on every screen but the phone. */
  hud?: React.ReactNode;
  /** The swipe home screens carry their own side padding (the Home page
   *  bleeds to both edges), so the body adds none. */
  swipe?: boolean;
}

export type NavTab = "league" | "skills" | "home" | "media" | "play" | "life";

export default function DashboardShell({ career, children, onNavigate, onSettings, activeNav = null, nextMatchLabel, nextMatchDate, fullBleed = false, compact = false, onHome, atHome = false, locked, achievementsSlot, hud, swipe = false }: Props) {
  // A locked button answers a tap with its "how to unlock" line.
  const [lockNote, setLockNote] = useState<{ label: string; hint: string; at: number } | null>(null);
  const tap = (tab: NavTab, label: string) => {
    const hint = locked?.[tab];
    if (hint) {
      const at = Date.now();
      setLockNote({ label, hint, at });
      setTimeout(() => setLockNote((n) => (n && n.at === at ? null : n)), 2600);
      return;
    }
    onNavigate(tab);
  };
  const fullName = `${career.player.firstName} ${career.player.lastName}`;
  const energyPct = Math.max(0, Math.min(100, career.energy));

  // The site's GlobalNav sits above this shell. Measure the shell's own document
  // position and fill exactly the rest of the viewport, so the bottom nav bar is
  // always on screen (no page scroll — only the middle content area scrolls).
  // Measuring ourselves (not the nav) avoids grabbing the wrong element — the
  // page contains a second, viewport-tall <nav> inside the sidebar drawer.
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellH, setShellH] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const rect = shellRef.current?.getBoundingClientRect();
      if (!rect) return;
      const docTop = rect.top + window.scrollY;
      setShellH(Math.max(400, window.innerHeight - docTop));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      ref={shellRef}
      className="sk-shell bg-gradient-to-b from-gray-800 to-gray-900 text-white flex flex-col overflow-hidden"
      style={{ height: shellH !== null ? `${shellH}px` : "calc(100dvh - 64px)" }}
    >
      <div className="flex-1 min-h-0 flex flex-col max-w-md w-full mx-auto">
        {!fullBleed && (
          <>
            {/* Top header */}
            <div className="sk-bar bg-gradient-to-b from-gray-700 to-gray-800 border-b border-black/50 px-3 py-2 flex items-center justify-between shadow-md">
              {/* Home, top left (was a red ✕ that left the career — that is
                  "Exit career" at the bottom of Settings now). Lit green when
                  you are off the home screens, so the way back is obvious. */}
              <button
                data-home-button
                onClick={onHome ?? (() => onNavigate("home"))}
                aria-label="Home"
                className={`kib-press w-8 h-8 rounded-[3px] flex items-center justify-center border transition-colors ${
                  atHome
                    ? "bg-gray-600 hover:bg-gray-500 border-transparent"
                    : "bg-gradient-to-b from-emerald-400 to-emerald-600 border-emerald-300/70 shadow-[0_0_12px_rgba(16,185,129,.55)]"
                }`}
              >
                <HouseIcon />
              </button>
              <div className="flex-1 mx-2 min-w-0 py-1 px-3 font-black text-[17px] leading-tight uppercase tracking-wide truncate text-white text-center" style={{ textShadow: "0 1px 3px rgba(0,0,0,.7)" }}>
                {fullName}
              </div>
              {/* Your money, always on screen, on every page (Harry, 1 Oct
                  2026: "a little pocket at the top that you can always see
                  on any page"). It is the only place money shows now. */}
              {!hud && <div
                data-money-chip
                aria-label={`Money ${formatMoney(career.money)}`}
                className="mr-2 flex shrink-0 items-center gap-1 rounded-full border border-yellow-300/30 bg-black/35 px-2.5 py-1 text-xs font-black tabular-nums text-yellow-200"
              >
                <StarIcon small />
                {formatMoney(career.money)}
              </div>}
              <button onClick={onSettings} aria-label="Settings" className="w-8 h-8 rounded-[3px] bg-gray-600 hover:bg-gray-500 text-white flex items-center justify-center">
                <GearIcon />
              </button>
            </div>

            {/* The HUD: rating, energy (with its can), money, age — which cells
                show depends on the screen (ui/TopHud.tsx). */}
            {hud}

            {/* Star + Energy bars */}
            {!compact && !hud && (<>
            <div className="grid grid-cols-2 gap-2 px-3 pt-2">
              <div className="flex items-center gap-2 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-lg px-2 py-1.5 shadow border border-yellow-400">
                <StarIcon />
                <span className="text-white font-black text-sm">Star Rating</span>
                <span className="ml-auto text-white font-black text-sm">{starsNow(career)}</span>
              </div>
              <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-500" style={{ width: `${energyPct}%` }} />
                <div className="relative flex items-center gap-1 px-2 py-1.5">
                  <HeartIcon />
                  <span className="text-white font-black text-sm">Energy</span>
                  <span className="ml-auto text-white font-black text-sm">{Math.round(energyPct)}</span>
                </div>
              </div>
            </div>

            {/* Age strip (the cash is the chip in the header now) */}
            <div className="flex items-center justify-between px-3 pt-2 gap-2">
              <div className="bg-gray-700 rounded-lg px-3 py-1 text-xs font-black text-white border border-gray-600">
                Age {career.player.age}
              </div>
            </div>
            </>)}
          </>
        )}

        {/* Body — the only scrollable region; header + bottom nav stay fixed.
            No padding in fullBleed — the phone gets every pixel of it.
            Scrollbar hidden, same as the phone's own feed already is
            (PhoneFrame.tsx's .kib-noscroll) — reported directly, again:
            "I never want to see scroll wheels", this time on the shell
            EVERY screen but the phone renders inside (Home, League's
            Table/Results/Fixtures/Squad — none of them scroll on their
            own, see LeagueScreen.tsx's own note, so this one class covers
            all of them). Only now visibly overflowing because the KIB
            Cans card grew taller in its own redesign — the content itself
            still scrolls, only the track/thumb chrome is hidden. */}
        <HomeFxStyles />
        <style>{`
          .kib-shell-noscroll::-webkit-scrollbar { display: none; }
          .kib-shell-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
        `}</style>
        <div className={`kib-shell-noscroll flex-1 min-h-0 overflow-y-auto ${fullBleed ? "" : swipe ? "pt-2" : "px-3 py-2"}`}>
          {children}
        </div>

        {/* Next match banner */}
        {!fullBleed && !compact && nextMatchLabel && (
          <div className="mx-3 mb-1 bg-gradient-to-r from-gray-700 to-gray-600 border border-gray-500 rounded-lg px-3 py-1.5 flex items-center justify-between">
            {/* The date, not just the week. This banner is the most-looked-at
                strip in the game and it read "Week 25", which is a row number.
                "Sat 14 Feb" is where you are in a season. */}
            <div className="shrink-0 text-[10px] font-black text-white">
              {nextMatchDate ?? `Year ${career.season}`}
            </div>
            <div className="mx-2 truncate text-xs font-black text-white">{nextMatchLabel}</div>
            <div className="shrink-0 text-[10px] font-black text-white">Week {career.week}</div>
          </div>
        )}

        {/* Bottom nav — Harry, 28 Sep 2026: "League · Training · Play in the
            middle · Relationships · Phone", no Home button (the swipe tabs
            and the name pill up top take you home). Play is the biggest
            thing on the bar: raised, green, with a slow pulse. */}
        <div className="sk-nav relative grid grid-cols-5 items-end gap-1 px-1.5 pb-1.5 pt-1 bg-gradient-to-b from-gray-700 to-gray-800 border-t border-black/50 shadow-[0_-6px_16px_-8px_rgba(0,0,0,.7)]">
          {lockNote && (
            <div className="pointer-events-none absolute inset-x-3 bottom-full mb-2 flex items-center gap-2 rounded-xl bg-gray-950/95 px-3 py-2 ring-1 ring-amber-300/40 shadow-lg">
              <span className="text-amber-300"><LockGlyph /></span>
              <span className="text-[12px] font-black text-white">{lockNote.label} is locked —</span>
              <span className="text-[12px] font-bold text-amber-300">{lockNote.hint}</span>
            </div>
          )}
          {achievementsSlot
            ? <NavBtn label="Achievements" icon="⭐" active={achievementsSlot.active} onClick={achievementsSlot.onClick} tight />
            : <NavBtn label="League" icon="🏆" active={activeNav === "league"} onClick={() => tap("league", "League")} lockHint={locked?.league} />}
          <NavBtn label="Training" icon="⚽" active={activeNav === "skills"} onClick={() => tap("skills", "Training")} lockHint={locked?.skills} />
          <PlayBtn active={activeNav === "play"} onClick={() => tap("play", "Play")} locked={!!locked?.play} />
          <NavBtn label="Relations" icon="❤️" active={activeNav === "life"} onClick={() => tap("life", "Relations")} lockHint={locked?.life} />
          <NavBtn label="Phone" icon="📱" active={activeNav === "media"} onClick={() => tap("media", "Phone")} lockHint={locked?.media} />
        </div>
      </div>
    </div>
  );
}

function LockGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="currentColor" fillOpacity=".25" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function NavBtn({ label, icon, active, onClick, dot, lockHint, tight }: { label: string; icon: string; active: boolean; onClick: () => void; dot?: boolean; lockHint?: string; /** A long label ("Achievements") set smaller so it is not cut off. */ tight?: boolean }) {
  if (lockHint) return (
    <button
      onClick={onClick}
      aria-label={`${label} — locked: ${lockHint}`}
      className="kib-press relative min-w-0 h-[50px] rounded-[4px] font-black text-[11px] min-[380px]:text-[12px] leading-tight flex flex-col items-center justify-center gap-0.5 bg-gray-800 text-gray-400"
      style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}
    >
      <span className="text-[18px] leading-none opacity-30 grayscale">{icon}</span>
      <span className="max-w-full truncate opacity-60">{label}</span>
      <span className="absolute right-1.5 top-1.5 text-gray-300"><LockGlyph size={12} /></span>
    </button>
  );
  return (
    <button
      onClick={onClick}
      className={`kib-press relative min-w-0 h-[50px] rounded-[4px] font-black text-[11px] min-[380px]:text-[12px] leading-tight flex flex-col items-center justify-center gap-0.5 ${
        active
          ? "bg-gradient-to-b from-gray-400/70 to-gray-500/70 text-white shadow-inner"
          : "bg-gradient-to-b from-gray-600 to-gray-700 text-gray-100 hover:from-gray-500"
      }`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.10), 0 2px 4px rgba(0,0,0,.35)" }}
    >
      <span className="text-[18px] leading-none">{icon}</span>
      <span className={`max-w-full truncate ${tight ? "!text-[9px] min-[380px]:!text-[9.5px] tracking-[-0.03em]" : ""}`}>{label}</span>
      {active && <span className="absolute bottom-1 h-[3px] w-5 rounded-full bg-emerald-400" />}
      {dot && <span className="absolute right-2 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-gray-700" />}
    </button>
  );
}

/** The centre button: bigger than the rest, raised above the bar, green, and
 *  breathing slowly so the eye goes to it. */
function PlayBtn({ active, onClick, locked = false }: { active: boolean; onClick: () => void; locked?: boolean }) {
  if (locked) return (
    <div className="relative flex justify-center">
      <button
        onClick={onClick}
        aria-label="Play — locked"
        className="kib-press -mt-5 flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full border-[3px] border-gray-800 bg-gray-700 font-black text-gray-300"
      >
        <LockGlyph size={22} />
        <span className="text-[11px] uppercase tracking-wider leading-none">Play</span>
      </button>
    </div>
  );
  return (
    <div className="relative flex justify-center">
      <button
        onClick={onClick}
        aria-label="Play"
        className={`kib-press kib-play-pulse -mt-5 flex h-[66px] w-[66px] flex-col items-center justify-center rounded-full border-[3px] font-black text-white ${
          active ? "border-white/80" : "border-gray-800"
        }`}
        style={{ background: "radial-gradient(circle at 35% 28%, #6ee7b7 0%, #10b981 45%, #047857 100%)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" className="ml-0.5 drop-shadow"><path d="M7 4.5v15l13-7.5z" fill="#fff" /></svg>
        <span className="text-[11px] uppercase tracking-wider leading-none">Play</span>
      </button>
    </div>
  );
}

function StarIcon({ small }: { small?: boolean } = {}) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" className="text-white">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#dc2626">
      <path d="M12 21s-7-4.5-9.5-9.5C.5 7 4 3 8 3c2 0 3.5 1 4 2 .5-1 2-2 4-2 4 0 7.5 4 5.5 8.5C19 16.5 12 21 12 21z" />
    </svg>
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
