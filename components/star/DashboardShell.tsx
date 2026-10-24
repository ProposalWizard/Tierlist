"use client";
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { HomeFxStyles } from "./HomeFx";
import GameBar from "./ui/GameBar";
import MainBar, { type NavTab } from "./MainBar";
import type { BarBadges } from "@/lib/star/needsYou";
import { preloadSfx, sfx } from "@/lib/star/sfx";

/** Whether the Phone had something unread last time a shell looked — kept
 *  across screens, so a message that lands while you are elsewhere still
 *  pings when you come back, and opening the page never does. */
let phoneWasUnread: boolean | undefined;

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
  /** No longer used: Home is always the middle of the bar (MainBar.tsx). Kept
   *  so a caller that still passes it compiles. */
  homeSlot?: { active: boolean; onClick: () => void; /** v0.24 (P2-68, P2-89): the slot can be Achievements through the first steps. Default Home. */ label?: string; icon?: string };
  /** The top HUD (ui/TopHud.tsx): replaces the Star/Energy bars, the Age
   *  strip and the header's money chip, on every screen but the phone. */
  hud?: React.ReactNode;
  /** The swipe home screens carry their own side padding (the Home page
   *  bleeds to both edges), so the body adds none. */
  swipe?: boolean;
  /** The small "?" in the header: replays this screen's pointers (never forced). */
  onHelp?: () => void;
  /** "Needs you" (lib/star/needsYou.ts): a count or a dot on each button. */
  badges?: BarBadges;
}

export type { NavTab };

export default function DashboardShell({ career, children, onNavigate, onSettings, activeNav = null, nextMatchLabel, nextMatchDate, fullBleed = false, compact = false, onHome, atHome = false, locked, hud, swipe = false, mediaUnread = false, onHelp, badges }: Props) {
  // A new message on the phone pings (lib/star/sfx.ts).
  useEffect(() => { preloadSfx(); }, []);
  useEffect(() => {
    if (phoneWasUnread === false && mediaUnread) sfx("phone-notification");
    phoneWasUnread = mediaUnread;
  }, [mediaUnread]);
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
        {/* The top bar and the HUD under it are the same on every screen,
            the phone included (Harry, 1 Oct 2026: "the pills at the top
            aren't uniform across every page") — ui/GameBar.tsx, ui/TopHud.tsx. */}
        <GameBar career={career} onHome={onHome ?? (() => onNavigate("home"))} atHome={atHome} onHelp={onHelp} onSettings={onSettings} />
        {hud}
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
        <div data-tour="screen" className={`kib-shell-noscroll flex-1 min-h-0 overflow-y-auto ${fullBleed ? "" : swipe ? "pt-2" : "px-3 py-2"}`}>
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

        {/* The bottom bar (MainBar.tsx), the same on every screen. */}
        <MainBar activeNav={activeNav} onNavigate={onNavigate} onHome={onHome ?? (() => onNavigate("home"))} atHome={atHome} locked={locked} badges={badges} mediaUnread={mediaUnread} />
      </div>
    </div>
  );
}
