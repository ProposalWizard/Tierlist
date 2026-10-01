"use client";

/**
 * PLAY → THE LINE-UP → THE MATCH (v0.23; Harry, 1 Oct 2026, P91/P93).
 *
 * "Information overload: energy, sharpness … maybe if they're low on energy,
 * as they go to press play, we prompt them. But the only thing I would say is
 * maybe like a pre-match animation where it shows the line-up, and then you
 * just click and you're in the game." This replaces the whole match-day page
 * (components/star/MatchdayScreen.tsx: Fixtures · Match · Scout pages, the
 * status card, the bars, the cans, the position picker) with:
 *
 *   1. Pressing Play: if your energy is below the starting line, ONE prompt
 *      (a can, play anyway, or back). Otherwise nothing.
 *   2. The line-up animation: the team sheet (VersusScreen) with both elevens
 *      drawing in, a thin timer along the top, and Kick Off always under your
 *      thumb. It kicks off by itself after a few seconds, or when you tap.
 *   3. The match.
 *
 * A player left out of the squad (or injured) gets a small card instead, with
 * Watch from the stands. An international, or a squad too thin to draw, goes
 * straight into the match: there is no line-up to show.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import type { SelectionVerdict } from "@/lib/star/selection";
import { MIN_ENERGY_TO_START } from "@/lib/star/selection";
import type { Role } from "@/lib/star/formations";
import { formationOf } from "@/lib/star/formations";
import { offeredPositions, POSITION_NAMES, formationForClub } from "@/lib/star/teamsheet";
import { KIB_CANS, type KibCan } from "@/lib/star/shopData";
import { loadLineup } from "@/lib/star/lineupStore";
import { matchdayFor } from "@/lib/star/teamsheet";
import { fixtureDateLabel, divisionOf, leagueNameFor } from "@/lib/star/calendar";
import VersusScreen from "./VersusScreen";
import KibCanIcon from "./KibCanIcon";
import { PressButton, SquareBar, KitStyles, levelColors, useClubTheme } from "./ui";

/** How long the line-up draws in before it kicks off by itself. */
const LINEUP_MS = 3800;

export default function LineupIntro({ career, nextFixture, preMatchEnergy, preMatchSelection, playAs, onPlayAs, onBack, onPlayMatch, onWatchFromStands, onSimMatch, onUseCan }: {
  career: CareerState;
  nextFixture: Fixture;
  preMatchEnergy: number;
  preMatchSelection: SelectionVerdict | null;
  playAs: Role | null;
  /** Ask to play somewhere else (stays on the career until you change it). */
  onPlayAs?: (role: Role | null) => void;
  onBack: () => void;
  onPlayMatch: () => void;
  onWatchFromStands: () => void;
  onSimMatch: () => void;
  onUseCan: (id: KibCan["id"]) => void;
}) {
  const status = preMatchSelection?.status;
  const watching = status === "Squad" || status === "Injured";
  const e = Math.max(0, Math.min(100, Math.round(preMatchEnergy)));
  const tired = !watching && e < MIN_ENERGY_TO_START;
  // The prompt shows once per press of Play; answering it moves on.
  const [asked, setAsked] = useState(false);
  const { glow } = useClubTheme(career);

  const saved = loadLineup(career.player.club);
  const savedXI = saved && saved.xi.some(Boolean) ? { formation: formationOf(saved.formation), xi: saved.xi } : undefined;
  const matchday = useMemo(
    () => (nextFixture.kind === "international"
      ? null
      : matchdayFor(career, nextFixture, preMatchSelection?.status === "1st Team", playAs ?? undefined, saved?.bench, savedXI, preMatchSelection?.status === "Substitute")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [career.player.club, nextFixture, preMatchSelection?.status, playAs],
  );
  const teamsReady = !!matchday && (matchday.home.yours ? matchday.home : matchday.away).xi.length >= 9;
  const showLineup = !watching && (!tired || asked) && teamsReady;

  // Nothing to draw (an international, or a squad too thin): straight in.
  const went = useRef(false);
  const go = () => { if (went.current) return; went.current = true; onPlayMatch(); };
  useEffect(() => {
    if (watching || (tired && !asked) || teamsReady) return;
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, tired, asked, teamsReady]);

  // "Play as ▾" — the position picker the match-day page used to hold
  // (v0.23 W7, P90 brought back what the line-up animation dropped). It sits
  // on the line-up, where the choice shows at once; opening it stops the
  // auto-kick-off so there is time to choose.
  const alternates = useMemo(
    () => offeredPositions(career.player.position, savedXI?.formation ?? formationForClub(career.player.club)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [career.player.club, career.player.position, saved?.formation],
  );
  const [picking, setPicking] = useState(false);
  const [held, setHeld] = useState(false);
  const canPick = !!onPlayAs && alternates.length > 0 && (status === "1st Team" || status === "Substitute");
  const here = playAs ?? (career.player.position as Role);

  // The line-up draws in, then kicks off by itself (not while choosing).
  useEffect(() => {
    if (!showLineup || held) return;
    const t = setTimeout(go, LINEUP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLineup, held]);

  if (showLineup && matchday) {
    return (
      <div data-lineup-intro>
        {/* The timer along the top: the line-up kicks off when it fills. */}
        {!held && (
          <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[4px] bg-black/60">
            <div className="h-full bg-emerald-400" style={{ width: "100%", transformOrigin: "left", animation: `kib-lineup-fill ${LINEUP_MS}ms linear 1 both`, boxShadow: "0 0 8px rgba(52,211,153,.9)" }} />
          </div>
        )}
        {canPick && (
          <div className="fixed left-1/2 top-[116px] z-50 -translate-x-1/2">
            <button
              onClick={() => { setPicking((o) => !o); setHeld(true); }}
              aria-label="Play as"
              aria-expanded={picking}
              className="kib-press flex h-9 items-center gap-1.5 px-3 text-[15px] font-black uppercase leading-none text-white"
              style={{ background: "rgba(3,32,15,.88)", borderRadius: 2, boxShadow: `inset 0 0 0 1px ${playAs ? "#fbbf24" : "rgba(255,255,255,.45)"}` }}
            >
              <span className="text-[12px] text-white/70">Play as</span>
              <span className={playAs ? "text-amber-300" : "text-white"}>{here}</span>
              <span className="text-[10px] text-amber-300">▾</span>
            </button>
            {picking && (
              <div data-playas-picker className="absolute left-1/2 top-[42px] flex -translate-x-1/2 gap-px bg-black/60 p-px" style={{ boxShadow: "0 8px 20px rgba(0,0,0,.6)" }}>
                {[{ role: null as Role | null, label: career.player.position }, ...alternates.map((a) => ({ role: a.role as Role | null, label: a.role as string }))].map(({ role, label }) => {
                  const on = (playAs ?? null) === role;
                  return (
                    <button
                      key={role ?? "own"}
                      onClick={() => { onPlayAs?.(role); setPicking(false); }}
                      aria-pressed={on}
                      title={role ? POSITION_NAMES[role] : undefined}
                      className={`kib-press min-w-[46px] px-2.5 py-2 text-[15px] font-black uppercase leading-none ${on ? "bg-amber-400 text-gray-950" : "bg-[#0c2a18] text-white"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <style>{`@keyframes kib-lineup-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } } @media (prefers-reduced-motion: reduce) { [data-lineup-intro] [style*="kib-lineup-fill"] { animation: none !important; } }`}</style>
        {(status === "1st Team" || status === "Substitute") && (
          <button
            onClick={() => { went.current = true; onSimMatch(); }}
            aria-label="Sim this match"
            className="kib-press fixed right-3 top-[116px] z-50 grid h-9 w-9 place-items-center text-[16px] font-black text-sky-100"
            style={{ background: "rgba(3,7,18,.82)", borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(125,211,252,.55)" }}
          >⏩</button>
        )}
        <VersusScreen
          matchday={matchday}
          date={fixtureDateLabel(career.player.startYear, career.season, nextFixture.week, nextFixture.kind, divisionOf(career))}
          results={career.results}
          clubKits={career.clubKits}
          competition={
            !nextFixture.kind || nextFixture.kind === "league"
              ? `${leagueNameFor(divisionOf(career))} · Matchday ${nextFixture.week}`
              : `${nextFixture.competition}${nextFixture.round ? ` · ${nextFixture.round}` : ""}`
          }
          onKickOff={go}
          onBack={onBack}
        />
      </div>
    );
  }

  // The one prompt: low energy as you press Play, or left out of the squad.
  const can = KIB_CANS.find((c) => !c.effect) ?? KIB_CANS[0];
  const have = career.kibCans[can.id] ?? 0;
  return (
    <div className="relative min-h-[100dvh] bg-[#05080f] text-white">
      <KitStyles />
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(90% 45% at 50% -8%, ${glow}55 0%, transparent 70%), linear-gradient(180deg, #0a1120 0%, #05080f 60%)` }} />
      <div className="relative mx-auto flex min-h-[70dvh] w-full max-w-md flex-col justify-center px-4">
        <div data-prematch-prompt={watching ? "squad" : "energy"} className="bg-black/55 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }}>
          {watching ? (
            <>
              <div className="text-center text-[34px] leading-none">{status === "Injured" ? "🩹" : "📋"}</div>
              <div className="mt-2 text-center text-[20px] font-black uppercase tracking-wide">{status === "Injured" ? "You're injured" : "Not in the squad"}</div>
              <PressButton variant="secondary" size="none" onClick={onWatchFromStands} className="mt-4 w-full py-3 text-[15px] font-black uppercase tracking-wide">🏟️ Watch from the stands</PressButton>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[26px] leading-none">⚡</span>
                <div className="text-[20px] font-black uppercase tracking-wide">Low energy</div>
              </div>
              <SquareBar value={e} colors={levelColors(e)} className="mt-3 h-[26px]" animate>{e}</SquareBar>
              <div className="mt-4 grid grid-cols-[1fr_1fr] gap-2">
                {have > 0 ? (
                  <PressButton variant="gold" size="none" onClick={() => onUseCan(can.id)} className="flex items-center justify-center gap-2 py-3 text-[14px] font-black uppercase tracking-wide">
                    <KibCanIcon can={can} className="h-7 w-[18px]" />Use a can ×{have}
                  </PressButton>
                ) : <span />}
                <PressButton variant="primary" size="none" onClick={() => setAsked(true)} className={`${have > 0 ? "" : "col-span-2"} py-3 text-[14px] font-black uppercase tracking-wide`}>Play anyway</PressButton>
              </div>
            </>
          )}
          <PressButton variant="plain" size="none" onClick={onBack} className="mt-2 w-full py-2.5 text-[13px] font-black uppercase tracking-wide text-white">‹ Back</PressButton>
        </div>
      </div>
    </div>
  );
}
