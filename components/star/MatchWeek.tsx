"use client";

/**
 * THE LEAGUE PAGE. Was the match-week page (v0.23, W7; Harry, 1 Oct 2026,
 * P90) with edge arrows through Results · Fixtures · Table · Scout · Awards ·
 * Squad. Since 22 Oct 2026 (master plan step 3, Mikey) it is one page: every
 * league, cup and international competition from one picker (WorldPane), the
 * live-score bell beside the title, the game's own bottom bar under it.
 */
import { useEffect, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import { followedClubs, followedFixtures, toggleFollowedClub, setLiveScoreWeek } from "@/lib/star/matchDayPrefs";
import WorldPane from "./WorldPane";
import ClubBadge from "./ClubBadge";
import { short } from "./HomeHub";
import { BarButton, BottomBar, Chev, ScreenShell, useClubTheme } from "./ui";


/** League is one page since 22 Oct 2026 (master plan step 3, Mikey): every
 *  league, cup and international competition, from one picker (WorldPane).
 *  The old views left: Table (the same as All leagues), Fixtures (the phone's
 *  Fixtures & results app), Scout (a message from the gaffer), Awards (Goals
 *  and Assists show it), Squad (the phone's Squad app). */
export default function MatchWeek({ career, hud, nextFixture, onBack, onPlay, onHelp, bar }: {
  career: CareerState;
  /** The top HUD, so energy never leaves. */
  hud: React.ReactNode;
  nextFixture: Fixture | null;
  onBack: () => void;
  onPlay: () => void;
  /** The "?": replays this page's pointer tour (same as the dashboard's "?"). */
  onHelp?: () => void;
  /** The game's own bottom bar (MainBar.tsx). Given: it replaces Back · Alerts ·
   *  Play (master plan 1, 22 Oct 2026), and the bell moves up beside the title. */
  bar?: React.ReactNode;
}) {
  const { glow } = useClubTheme(career);
  const [bell, setBell] = useState(false);
  const [ticks, setTicks] = useState<string[]>(() => followedClubs());

  // Tell the live-score pop-ups which week is coming, so a bell rung here for
  // one of this week's other games reaches the match.
  useEffect(() => { if (nextFixture) setLiveScoreWeek(career.season, nextFixture.week); }, [career.season, nextFixture]);
  const rung = ticks.length > 0 || followedFixtures().some((f) => f.season === career.season);

  return (
    <>
    <div>
    <ScreenShell
      bare
      tone="pitch"
      glow={glow}
      title="League"
      hud={hud}
      bottomBar={bar ?? (
        <BottomBar cols="1fr 1fr 1fr">
          <BarButton icon={<Chev dir="left" size={16} className="text-amber-300" />} label="Back" onClick={onBack} />
          <BarButton icon="🔔" label="Alerts" onClick={() => setBell(true)} dot={rung} ariaLabel="Live score alerts" />
          <BarButton primary icon="▶" label="Play" onClick={onPlay} disabled={!nextFixture} />
        </BottomBar>
      )}
    >
      <div data-matchweek="league" data-tour="screen">
        <div className="mb-2 flex items-center justify-center gap-1.5 text-[15px] font-black uppercase tracking-wide text-white">
          League
          <button onClick={() => setBell(true)} data-alerts-bell aria-label="Live score alerts" className="kib-press relative flex h-[22px] w-[22px] shrink-0 items-center justify-center bg-gray-600 text-[13px] leading-none hover:bg-gray-500" style={{ borderRadius: 3 }}>
            <span aria-hidden className="absolute -inset-[9px]" />🔔
            {rung && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />}
          </button>
          {onHelp && (
            <button onClick={onHelp} data-help-button aria-label="Help — show me around" className="kib-press relative flex h-[22px] w-[22px] shrink-0 items-center justify-center bg-gray-600 text-[14px] font-black leading-none text-amber-300 hover:bg-gray-500" style={{ borderRadius: 3 }}><span aria-hidden className="absolute -inset-[9px]" />?</button>
          )}
        </div>
        <WorldPane career={career} />
      </div>

      {bell && <AlertsSheet career={career} ticks={ticks} onTick={(c) => setTicks(toggleFollowedClub(c))} onClose={() => setBell(false)} />}
    </ScreenShell>
    </div>
    </>
  );
}

/** The bell: tick a club to see its goals pop up during your match. A square
 *  grid of crests, no sentences (Settings → Live scores is the same list). */
function AlertsSheet({ career, ticks, onTick, onClose }: { career: CareerState; ticks: string[]; onTick: (club: string) => void; onClose: () => void }) {
  const clubs = career.league.map((t) => t.name).filter((n) => n !== career.player.club).sort();
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65" onClick={onClose} role="dialog" aria-modal="true" aria-label="Live score alerts">
      <div
        data-alerts-sheet
        className="kit-rise w-full max-w-md bg-[#07110c]"
        style={{ boxShadow: "inset 0 2px 0 var(--sk-edge, rgba(255,255,255,.3))", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/20 px-3 py-2">
          <span className="text-[20px] leading-none">🔔</span>
          <span className="flex-1 text-[18px] font-black uppercase tracking-wide text-white">Live scores</span>
          <span className="text-[16px] font-black tabular-nums text-amber-300">{ticks.length}</span>
          <button onClick={onClose} aria-label="Close" className="kib-press grid h-8 w-8 place-items-center bg-white/10 text-[16px] font-black text-white" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)" }}>✕</button>
        </div>
        <div className="grid max-h-[62dvh] grid-cols-2 gap-px overflow-y-auto bg-black/40 p-px">
          {clubs.map((club) => {
            const on = ticks.includes(club);
            return (
              <button
                key={club}
                onClick={() => onTick(club)}
                role="checkbox"
                aria-checked={on}
                className={`kib-press flex items-center gap-2 px-2 py-2 text-left ${on ? "bg-amber-400 text-gray-950" : "bg-[#0c1a12] text-white"}`}
              >
                <ClubBadge club={club} size={22} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-black uppercase leading-none">{short(club)}</span>
                <span aria-hidden className={`text-[15px] ${on ? "" : "opacity-35 grayscale"}`}>🔔</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
