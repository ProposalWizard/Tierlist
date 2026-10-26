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
 * Watch from the stands. A squad too thin to draw goes straight into the
 * match. An international shows both nations' squads (international.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CareerState, Fixture } from "@/lib/star/types";
import { useSfxOn, setSfxOn, sfx } from "@/lib/star/sfx";
import { SetCard, SetToggle } from "./settingsKit";
import FhrSwitchRow from "./FhrSwitchRow";
import type { SelectionVerdict } from "@/lib/star/selection";
import { MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB, selectionFor } from "@/lib/star/selection";
import type { Role } from "@/lib/star/formations";
import { formationOf } from "@/lib/star/formations";
import { offeredPositions, POSITION_NAMES, formationForClub } from "@/lib/star/teamsheet";
import { KIB_CANS, kibCanPrice, type KibCan } from "@/lib/star/shopData";
import { loadLineup } from "@/lib/star/lineupStore";
import { getSkipLineup } from "@/lib/star/lineupPrefs";
import { matchdayFor } from "@/lib/star/teamsheet";
import { internationalCareer } from "@/lib/star/international";
import { fixtureDateLabel, divisionOf, leagueNameFor } from "@/lib/star/calendar";
import VersusScreen from "./VersusScreen";
import KibCanIcon from "./KibCanIcon";
import { PressButton, SquareBar, KitStyles, levelColors, useClubTheme } from "./ui";
import dynamic from "next/dynamic";
import { useBossRoomLook } from "@/lib/star/look3d";
import { benchMomentFor } from "@/lib/star/managerMoments";
import { ManagerSays } from "./ManagerMoments";
import { useLeoUpdate } from "@/lib/star/leoUpdate";
import { matchDials, weatherLine } from "@/lib/star/matchWeather";

// Left out of the squad: told in the manager's office when Settings → Look →
// "Talk to your manager" is "3D office" (MANAGER_PLAN.md §2). The card's own
// buttons carry on exactly as before; "Old" is the card alone.
const Office3DCareer = dynamic(() => import("./Office3D").then((m) => m.Office3DCareer), { ssr: false });

/** How long the line-up draws in before it kicks off by itself. */
const LINEUP_MS = 3800;

export default function LineupIntro({ career, nextFixture, preMatchEnergy, preMatchSelection, playAs, onPlayAs, onBack, onPlayMatch, onWatchFromStands, onSimMatch, onUseCan, onBuyAndUseCan, onBenchMomentSeen }: {
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
  /** Buy one can and drink it at once (the not-in-the-squad card). */
  onBuyAndUseCan?: (can: KibCan) => void;
  /** The "dropped to the bench" moment was seen for this fixture (saved, so
   *  Back and Play again doesn't say it twice). */
  onBenchMomentSeen?: (key: string) => void;
}) {
  const status = preMatchSelection?.status;
  const watching = status === "Squad" || status === "Injured";
  const e = Math.max(0, Math.min(100, Math.round(preMatchEnergy)));
  const tired = !watching && e < MIN_ENERGY_TO_START;
  // The prompt shows once per press of Play; answering it moves on.
  const [asked, setAsked] = useState(false);
  const { glow } = useClubTheme(career);
  const room = useBossRoomLook();
  const [room3dFailed, setRoom3dFailed] = useState(false);

  // Dropped to the bench (started last time, on the bench now): the manager
  // says why before the line-up — in his office, or the same words on a plain
  // card (lib/star/managerMoments.ts). Nothing kicks off until Continue.
  const [benchHeard, setBenchHeard] = useState(false);
  const benchMoment = useMemo(
    () => benchMomentFor(career, preMatchSelection, nextFixture, preMatchEnergy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nextFixture, preMatchSelection?.status],
  );
  const benchHold = !!benchMoment && !benchHeard;

  const saved = loadLineup(career.player.club);
  const savedXI = saved && saved.xi.some(Boolean) ? { formation: formationOf(saved.formation), xi: saved.xi } : undefined;
  // An international: the sheet is drawn off the stand-in career the match is
  // handed — your nation's squad against the other nation's (international.ts).
  const intlCareer = useMemo(
    () => (nextFixture.kind === "international" ? internationalCareer(career, nextFixture) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [career.season, nextFixture],
  );
  const matchday = useMemo(
    () => (intlCareer
      ? matchdayFor(intlCareer, nextFixture, true, playAs ?? undefined)
      : matchdayFor(career, nextFixture, preMatchSelection?.status === "1st Team", playAs ?? undefined, saved?.bench, savedXI, preMatchSelection?.status === "Substitute")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [career.player.club, nextFixture, preMatchSelection?.status, playAs, intlCareer],
  );
  const teamsReady = !!matchday && (matchday.home.yours ? matchday.home : matchday.away).xi.length >= 9;
  // "Skip the line-up" in Settings (v0.23.1, P30/P75): straight into the match.
  const skipIt = useRef(typeof window !== "undefined" && getSkipLineup());
  const showLineup = !benchHold && !watching && (!tired || asked) && teamsReady && !skipIt.current;

  // Nothing to draw (an international, or a squad too thin): straight in.
  const went = useRef(false);
  const go = () => { if (went.current) return; went.current = true; onPlayMatch(); };
  useEffect(() => {
    if (benchHold || watching || (tired && !asked) || (teamsReady && !skipIt.current)) return;
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchHold, watching, tired, asked, teamsReady]);

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canPick = !!onPlayAs && alternates.length > 0 && (status === "1st Team" || status === "Substitute");
  const here = playAs ?? (career.player.position as Role);

  // The line-up draws in, then kicks off by itself (not while choosing).
  useEffect(() => {
    if (!showLineup || held) return;
    const t = setTimeout(go, LINEUP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLineup, held]);

  // In the pitch's top-right corner, beside the home keeper (Harry, 2 Oct
  // 2026, v0.24 P1-51: it sat on top of the VS between the crests; "maybe
  // just put it here"). The list opens down and to the left, over the pitch.
  const playAsPicker = canPick ? (
    <div className="relative">
      <button
        onClick={() => { setPicking((o) => !o); setHeld(true); }}
        aria-label="Play as"
        aria-expanded={picking}
        className="kib-press flex h-8 items-center gap-1.5 px-2.5 text-[14px] font-black uppercase leading-none text-white"
        style={{ background: "rgba(3,32,15,.9)", borderRadius: 2, boxShadow: `inset 0 0 0 1px ${playAs ? "#fbbf24" : "rgba(255,255,255,.45)"}, 0 3px 8px rgba(0,0,0,.45)` }}
      >
        <span className="text-[11px] text-white/75">Play as</span>
        <span className={playAs ? "text-amber-300" : "text-white"}>{here}</span>
        <span className="text-[10px] text-amber-300">▾</span>
      </button>
      {picking && (
        <div data-playas-picker className="absolute right-0 top-[36px] flex gap-px bg-black/60 p-px" style={{ boxShadow: "0 8px 20px rgba(0,0,0,.6)" }}>
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
  ) : null;

  // Boots warning (Harry, 5 Oct 2026: "fix the boots warning"). The old
  // match-day page had it, but that page is gone since v0.23, so the line-up
  // is the last screen before kick-off. Top-left of the pitch, mirroring Play as.
  const bootsLeft = career.currentBoot.matches;
  const bootsWarning = bootsLeft <= 1 ? (
    <div
      data-boots-warning
      className="flex h-8 items-center gap-1.5 px-2 text-[10.5px] font-black uppercase leading-[1.05] text-amber-100"
      style={{ background: "rgba(3,32,15,.9)", borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(251,191,36,.7), 0 3px 8px rgba(0,0,0,.45)" }}
    >
      <span aria-hidden className="text-[14px]">🥾</span>
      <span>{bootsLeft === 1 ? <>Last match<br />in these boots</> : <>No boots<br />buy in the Shop</>}</span>
    </div>
  ) : null;

  const fixesOn = useLeoUpdate("bugFixes");
  const weatherOn = useLeoUpdate("weather");
  // Sim and Settings sit in the header's top-right corner, mirroring Back.
  // They floated fixed on the right edge at 116/160 px, over the away crest
  // and the Play as pill ("PLAY AS ST" cut off at 390 px, 22 Oct 2026).
  // Settings before kick-off (Harry, 20 Oct 2026: "before a game, I can
  // press settings and turn on full highlights rebuild"). Opening it stops
  // the auto kick-off, like Play as.
  const headerButtons = (
    <>
      {(status === "1st Team" || status === "Substitute") && (
        <button
          onClick={() => { went.current = true; onSimMatch(); }}
          aria-label="Sim this match"
          className="kib-press grid h-8 w-8 place-items-center text-[15px] font-black text-sky-100"
          style={{ background: "rgba(3,7,18,.82)", borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(125,211,252,.55)" }}
        >⏩</button>
      )}
      <button
        data-prematch-settings
        onClick={() => { setSettingsOpen(true); setHeld(true); }}
        aria-label="Settings"
        className="kib-press grid h-8 w-8 place-items-center text-white"
        style={{ background: "rgba(3,7,18,.82)", borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45)" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </button>
    </>
  );

  if (benchHold && benchMoment) {
    return (
      <div data-bench-moment={benchMoment.reason}>
        <ManagerSays career={career} title="Team news" text={benchMoment.text}
          onContinue={() => { setBenchHeard(true); onBenchMomentSeen?.(benchMoment.key); }} />
      </div>
    );
  }

  if (showLineup && matchday) {
    return (
      // A tap anywhere that is not a button kicks off (P75: "you can just tap
      // and you get through it"); while the position list is open it closes it.
      <div
        data-lineup-intro
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button, a, [role=button]")) return;
          if (picking) { setPicking(false); return; }
          go();
        }}
      >
        {/* The timer along the top: the line-up kicks off when it fills. */}
        {!held && (
          <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[4px] bg-black/60">
            <div className="h-full bg-emerald-400" style={{ width: "100%", transformOrigin: "left", animation: `kib-lineup-fill ${LINEUP_MS}ms linear 1 both`, boxShadow: "0 0 8px rgba(52,211,153,.9)" }} />
          </div>
        )}
        <style>{`@keyframes kib-lineup-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } } @media (prefers-reduced-motion: reduce) { [data-lineup-intro] [style*="kib-lineup-fill"] { animation: none !important; } }`}</style>
        {/* Switch off (Leo's 24 Oct update, bug fixes): the old floating buttons. */}
        {!fixesOn && (status === "1st Team" || status === "Substitute") && (
          <button
            onClick={() => { went.current = true; onSimMatch(); }}
            aria-label="Sim this match"
            className="kib-press fixed right-3 top-[116px] z-50 grid h-9 w-9 place-items-center text-[16px] font-black text-sky-100"
            style={{ background: "rgba(3,7,18,.82)", borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(125,211,252,.55)" }}
          >⏩</button>
        )}
        {!fixesOn && (
        <button
          data-prematch-settings
          onClick={() => { setSettingsOpen(true); setHeld(true); }}
          aria-label="Settings"
          className={`kib-press fixed right-3 ${(status === "1st Team" || status === "Substitute") ? "top-[160px]" : "top-[116px]"} z-50 grid h-9 w-9 place-items-center text-white`}
          style={{ background: "rgba(3,7,18,.82)", borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45)" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
        )}
        {settingsOpen && <PreMatchSettings glow={glow} onClose={() => setSettingsOpen(false)} />}
        <VersusScreen
          matchday={matchday}
          date={weatherOn
            // Leo's update, "weather": the day's weather and the home pitch on the date line.
            ? `${fixtureDateLabel(career.player.startYear, career.season, nextFixture.week, nextFixture.kind, divisionOf(career))} · ${weatherLine(matchDials(career, nextFixture))}`
            : fixtureDateLabel(career.player.startYear, career.season, nextFixture.week, nextFixture.kind, divisionOf(career))}
          results={career.results}
          clubKits={(intlCareer ?? career).clubKits}
          managers={fixesOn && career.manager ? { [career.player.club]: career.manager.name } : undefined}
          competition={
            !nextFixture.kind || nextFixture.kind === "league"
              ? `${leagueNameFor(divisionOf(career))} · Matchday ${nextFixture.week}`
              : `${nextFixture.competition}${nextFixture.round ? ` · ${nextFixture.round}` : ""}`
          }
          onKickOff={go}
          onBack={onBack}
          pitchCorner={playAsPicker}
          pitchCornerLeft={bootsWarning}
          headerRight={fixesOn ? headerButtons : undefined}
        />
      </div>
    );
  }

  // Going straight in (skip setting, or nothing to draw): no prompt flashes up.
  if (!watching && !(tired && !asked)) return <div className="min-h-[100dvh] bg-[#05080f]" />;

  // The one prompt: low energy as you press Play, or left out of the squad.
  const can = KIB_CANS.find((c) => !c.effect) ?? KIB_CANS[0];
  const have = career.kibCans[can.id] ?? 0;
  const price = kibCanPrice(can, career.contract.wage);
  // Out of the squad only because of energy: with full legs he would be in.
  const tiredOut = status === "Squad" && e < MIN_ENERGY_TO_SUB && !preMatchSelection?.away
    && selectionFor({ ...career, energy: 100 }).status !== "Squad" && can.restore > 0;
  const cansNeeded = Math.max(1, Math.ceil((MIN_ENERGY_TO_SUB - e) / Math.max(1, can.restore)));
  return (
    <div className="relative min-h-[100dvh] bg-[#05080f] text-white">
      <KitStyles />
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(90% 45% at 50% -8%, ${glow}55 0%, transparent 70%), linear-gradient(180deg, #0a1120 0%, #05080f 60%)` }} />
      <div className="relative mx-auto flex min-h-[70dvh] w-full max-w-md flex-col justify-center px-4">
        <div data-prematch-prompt={watching ? "squad" : "energy"} className="bg-black/55 p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }}>
          {watching ? (
            <>
              {status === "Squad" && room === "3d" && !room3dFailed && (
                <Office3DCareer career={career} speaker="boss" onFail={() => setRoom3dFailed(true)}
                  className="mb-3 w-full" style={{ height: "34vh", borderRadius: 4 }} />
              )}
              <div className="text-center text-[34px] leading-none">{status === "Injured" ? "🩹" : preMatchSelection?.away ? "✈️" : "📋"}</div>
              <div className="mt-2 text-center text-[20px] font-black uppercase tracking-wide">{status === "Injured" ? "You're injured" : preMatchSelection?.away ? "Away with your country" : "Not in the squad"}</div>
              {preMatchSelection?.away && <div className="mt-1 text-center text-[13px] font-bold text-white">{preMatchSelection.reason}</div>}
              <PressButton variant="secondary" size="none" onClick={onWatchFromStands} className="mt-4 w-full py-3 text-[15px] font-black uppercase tracking-wide">🏟️ Watch from the stands</PressButton>
              {/* Left out for energy alone (Mikey's playtest, 21 Oct 2026): the
                  door stays, and under it a can gets you back in. Each can is
                  drunk now; enough of them and the squad picks you again. */}
              {tiredOut && (
                <div data-squad-can className="mt-3 border-t border-white/15 pt-3">
                  <div className="text-center text-[12px] font-bold text-white/85">
                    Energy {e}. You need {MIN_ENERGY_TO_SUB} to be involved: {cansNeeded} {cansNeeded === 1 ? "can" : "cans"} (+{can.restore} each).
                  </div>
                  {have > 0 ? (
                    <PressButton variant="gold" size="none" onClick={() => onUseCan(can.id)} className="mt-2 flex w-full items-center justify-center gap-2 py-3 text-[14px] font-black uppercase tracking-wide">
                      <KibCanIcon can={can} className="h-7 w-[18px]" />Drink a can ×{have}
                    </PressButton>
                  ) : onBuyAndUseCan ? (
                    <PressButton variant="gold" size="none" disabled={career.money < price} onClick={() => onBuyAndUseCan(can)} className="mt-2 flex w-full items-center justify-center gap-2 py-3 text-[14px] font-black uppercase tracking-wide">
                      <KibCanIcon can={can} className="h-7 w-[18px]" />{career.money < price ? `Can ★${price}: not enough money` : `Buy & drink a can ★${price}`}
                    </PressButton>
                  ) : null}
                </div>
              )}
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

/**
 * Settings before kick-off: sound, and Full highlights rebuild with its "?".
 * Over the line-up; nothing kicks off while it is open. Taps inside never
 * reach the line-up (it kicks off on a tap anywhere else).
 */
function PreMatchSettings({ glow, onClose }: { glow: string; onClose: () => void }) {
  const sfxNow = useSfxOn();
  return createPortal(
    <div
      data-prematch-settings-sheet
      className="fixed inset-0 z-[90] flex flex-col bg-gray-950/95 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-[17px] font-black text-white">Settings</div>
        <button onClick={onClose} className="kib-press rounded-lg bg-emerald-500 px-3.5 py-1.5 text-[14px] font-black text-gray-950">
          Back to the line-up
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-10 pt-3">
        <div className="mx-auto max-w-md space-y-2">
          <SetCard tone={glow} className="px-3 py-1">
            <SetToggle label="Sound effects" on={sfxNow} onClick={() => { const v = !sfxNow; setSfxOn(v); if (v) sfx("ui-confirm"); }} />
            <div className="py-2.5"><FhrSwitchRow /></div>
          </SetCard>
          <div className="text-[12px] font-bold text-white">More in Settings on the home screen.</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
