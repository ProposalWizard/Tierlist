"use client";

/**
 * THE MATCH WEEK PAGE — fixtures and the league on ONE page (v0.23, W7;
 * Harry, 1 Oct 2026, P90: "we could do this fixture page with the league, and
 * you have a bell, like maybe in the middle somewhere, a bell to see if you
 * want to get notifications. Straight in, no yap at all.").
 *
 * One thin row of edge arrows flips between Results · Fixtures · Table ·
 * Scout · Awards · Squad (the league's own views, with Fixtures and Scout
 * brought back from the match-day page the line-up animation replaced). The
 * bottom bar is Back · 🔔 · Play: the bell opens the live-score list (the
 * same clubs as Settings → Live scores), with a dot while any are ticked.
 * The top HUD keeps your energy on screen.
 */
import { useEffect, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import { followedClubs, followedFixtures, toggleFollowedClub, setLiveScoreWeek } from "@/lib/star/matchDayPrefs";
import LeagueScreen from "./LeagueScreen";
import ClubBadge from "./ClubBadge";
import { FixturesPane, ScoutPane } from "./MatchWeekPanes";
import { short } from "./HomeHub";
import { BarButton, BottomBar, Chev, EdgeArrows, ScreenShell, useClubTheme } from "./ui";

export const WEEK_VIEWS = [
  { id: "results", label: "Results", icon: "📋" },
  { id: "fixtures", label: "Fixtures", icon: "📅" },
  { id: "table", label: "Table", icon: "🏆" },
  { id: "scout", label: "Scout", icon: "🔍" },
  { id: "awards", label: "Awards", icon: "🥇" },
  { id: "squad", label: "Squad", icon: "👥" },
] as const;
export type WeekView = (typeof WEEK_VIEWS)[number]["id"];
let lastView: WeekView = "table";

export default function MatchWeek({ career, hud, nextFixture, onBack, onPlay, initialView }: {
  career: CareerState;
  /** The top HUD, so energy never leaves. */
  hud: React.ReactNode;
  nextFixture: Fixture | null;
  onBack: () => void;
  onPlay: () => void;
  initialView?: WeekView;
}) {
  const { glow } = useClubTheme(career);
  const [view, setViewState] = useState<WeekView>(initialView ?? lastView);
  const setView = (v: WeekView) => { lastView = v; setViewState(v); };
  const [bell, setBell] = useState(false);
  const [ticks, setTicks] = useState<string[]>(() => followedClubs());
  const i = WEEK_VIEWS.findIndex((v) => v.id === view);
  const here = WEEK_VIEWS[i];
  const prev = WEEK_VIEWS[i - 1], next = WEEK_VIEWS[i + 1];

  // Tell the live-score pop-ups which week is coming, so a bell rung here for
  // one of this week's other games reaches the match.
  useEffect(() => { if (nextFixture) setLiveScoreWeek(career.season, nextFixture.week); }, [career.season, nextFixture]);
  const rung = ticks.length > 0 || followedFixtures().some((f) => f.season === career.season);

  return (
    <ScreenShell
      bare
      glow={glow}
      title="League"
      hud={hud}
      bottomBar={
        <BottomBar cols="1fr 1fr 1fr">
          <BarButton icon={<Chev dir="left" size={16} className="text-amber-300" />} label="Back" onClick={onBack} />
          <BarButton icon="🔔" label="Alerts" onClick={() => setBell(true)} dot={rung} ariaLabel="Live score alerts" />
          <BarButton primary icon="▶" label="Play" onClick={onPlay} disabled={!nextFixture} />
        </BottomBar>
      }
    >
      <div data-matchweek={view}>
        <EdgeArrows
          className="mb-2"
          prev={prev ? { icon: prev.icon, label: prev.label, onClick: () => setView(prev.id) } : undefined}
          next={next ? { icon: next.icon, label: next.label, onClick: () => setView(next.id) } : undefined}
        >
          {here.label}
        </EdgeArrows>

        {view === "fixtures" ? <FixturesPane career={career} next={nextFixture} />
          : view === "scout" ? <ScoutPane career={career} fixture={nextFixture} />
          : <LeagueScreen career={career} view={view} hideTabs />}
      </div>

      {bell && <AlertsSheet career={career} ticks={ticks} onTick={(c) => setTicks(toggleFollowedClub(c))} onClose={() => setBell(false)} />}
    </ScreenShell>
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
