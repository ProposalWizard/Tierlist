"use client";

/**
 * MATCH DAY — the screen the bar's big green Play button opens.
 *
 * Harry, 28 Sep 2026: "the next screen that needs a refresh is matchday, you
 * have to scroll to get to play, everything about it just needs a refresh
 * same with home". Lifted out of app/star-dev/page.tsx unchanged in what it
 * does — same handlers, same selection rules, same edge cases (injured, out
 * of the squad, international fixtures, cup rounds) — and re-laid out in the
 * home screen's style (HomeHub.tsx):
 *
 *   1. the match-day hero: both crests big, competition and round, the date
 *      and how far away, home/away, the ground, the crowd and the weather,
 *      under floodlights in both clubs' colours;
 *   2. your status: selection, position, energy and sharpness as bars, small
 *      warning pills, the KIB cans (Use / Buy) right under energy, and who is
 *      on penalties;
 *   3. the opposition: their last five, where they sit, their key man, your
 *      head-to-head, and the full scout report;
 *   4. the action — Team sheets / Play / Watch from the stands, and Sim —
 *      PINNED to the bottom of the screen, so it is always there without
 *      scrolling. Everything else scrolls behind it.
 *
 * Harry, 28 Sep 2026 ("this is cool"), round 2: three swipe pages like the
 * home screens (SwipePages.tsx) — Fixtures · Match · Scout — opening on
 * Match, with the pinned bar under all three. Fixtures carries a bell on
 * every other game in your division, for live-score pop-ups from that one
 * game (matchDayPrefs.ts's followed fixtures, the same pop-ups Settings →
 * Live scores ticks drive).
 *
 * The team sheets (VersusScreen) still come between this and kick-off
 * whenever your XI can be drawn — see `teamsReady`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import type { SelectionVerdict } from "@/lib/star/selection";
import { MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB, SUB_LADDER } from "@/lib/star/selection";
import type { Role } from "@/lib/star/formations";
import { formationOf } from "@/lib/star/formations";
import { KIB_CANS, type KibCan } from "@/lib/star/shopData";
import { kitsFor, kitsOf } from "@/lib/star/kits";
import { groundFor, crowdFor } from "@/lib/star/stadiums";
import { conditionsFor, type Conditions } from "@/lib/star/weather";
import { fixtureLabel, nationOf, competitionAbbrev } from "@/lib/star/competitions";
import { fixtureDateLabel, divisionOf, leagueNameFor, fixtureTimestamp } from "@/lib/star/calendar";
import { matchdayFor, offeredPositions, POSITION_NAMES, formationForClub } from "@/lib/star/teamsheet";
import { liveWeekFor } from "@/lib/star/liveScores";
import { followedClubs, isFixtureFollowed, toggleFollowedFixture, setLiveScoreWeek } from "@/lib/star/matchDayPrefs";
import { loadLineup } from "@/lib/star/lineupStore";
import { scoutReportFor, type ScoutReport } from "@/lib/star/scoutReport";
import { faceOrFake } from "@/lib/star/fakeFaces";
import { shortNameOf } from "@/lib/star/realSquad";
import { rgba } from "@/lib/star/heroFigure";
import ClubBadge from "./ClubBadge";
import ImageWithFallback from "@/components/ImageWithFallback";
import SwipePages from "./SwipePages";
import PenaltyDutyLine from "./PenaltyDutyLine";
import ScoutReportCard from "./ScoutReport";
import VersusScreen from "./VersusScreen";
import { CanTile, cardStyle, glowOf, short } from "./HomeHub";
import { HomeFxStyles, useCountUp } from "./HomeFx";

interface Props {
  career: CareerState;
  nextFixture: Fixture;
  /** What your energy will be at kick-off (page.tsx's `preMatchEnergy`). */
  preMatchEnergy: number;
  /** The manager's team sheet, read off that energy. */
  preMatchSelection: SelectionVerdict | null;
  /** Settings → Developer tools → "Show developer info". */
  showDevInfo: boolean;
  playAs: Role | null;
  onPlayAs: (role: Role | null) => void;
  /** The team-sheet screen is open (page.tsx owns this so it resets with the match). */
  showTeams: boolean;
  onShowTeams: (open: boolean) => void;
  onBack: () => void;
  onPlayMatch: () => void;
  onWatchFromStands: () => void;
  onSimMatch: () => void;
  onUseCan: (id: KibCan["id"]) => void;
  onBuyCan: (can: KibCan) => void;
}

const WEATHER_ICON: Record<Conditions["weather"], string> = { clear: "✨", wind: "💨", rain: "🌧️", heavy: "🌧️" };
const ordinal = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");

export default function MatchdayScreen(p: Props) {
  const { career, nextFixture, preMatchEnergy, preMatchSelection, showTeams } = p;
  // Fixtures · Match · Scout — always opens on Match.
  const [page, setPage] = useState(1);
  // Tell the live-score pop-ups which week is being played, so a bell rung
  // on the Fixtures page for one of this week's other games reaches the match.
  useEffect(() => { setLiveScoreWeek(career.season, nextFixture.week); }, [career.season, nextFixture.week]);

  // ── The team sheets ── (moved as-is from page.tsx)
  // Between this screen and kick-off, because the eleven you are about to play
  // against is the last thing worth knowing. Only for club football: an
  // international squad is not in `leagueSquads` and there is nothing honest
  // to draw. The side you actually picked, shape and all — see teamsheet.ts's
  // SavedXI.
  const saved = loadLineup(career.player.club);
  const savedXI = saved && saved.xi.some(Boolean)
    ? { formation: formationOf(saved.formation), xi: saved.xi }
    : undefined;
  const matchday = nextFixture.kind === "international"
    ? null
    : matchdayFor(career, nextFixture, preMatchSelection?.status === "1st Team", p.playAs ?? undefined, saved?.bench, savedXI, preMatchSelection?.status === "Substitute");
  // Whether YOUR side is drawable — the bar the button decides on. An
  // under-scouted opponent gets its own "Unable to scout" half instead (see
  // VersusScreen); only an international fixture or your own squad falling
  // short sends the button straight past the team sheets.
  const teamsReady = !!matchday && (matchday.home.yours ? matchday.home : matchday.away).xi.length >= 9;

  if (showTeams && matchday && teamsReady) {
    return (
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
        onKickOff={() => { p.onShowTeams(false); p.onPlayMatch(); }}
        onBack={() => p.onShowTeams(false)}
      />
    );
  }

  const intl = nextFixture.kind === "international";
  const mine = intl ? nationOf(career) : career.player.club;
  const myKit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  const glow = glowOf(myKit.shirt, myKit.trim);
  const status = preMatchSelection?.status;
  const watching = status === "Squad" || status === "Injured";
  const rise = (i: number): React.CSSProperties => ({ animationDelay: `${i * 80}ms` });

  return (
    <FullHeight>
      <HomeFxStyles />
      <style>{`
        .kib-shell-noscroll::-webkit-scrollbar, .kib-md-noscroll::-webkit-scrollbar { display: none; }
        .kib-shell-noscroll, .kib-md-noscroll { scrollbar-width: none; -ms-overflow-style: none; overscroll-behavior: contain; }
        .kib-bar-fill { transition: width 1000ms cubic-bezier(.2,.8,.2,1); }
        @keyframes kibRoleFlip { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
        .kib-role-flip { display: inline-block; animation: kibRoleFlip 0.45s cubic-bezier(0.2,0.9,0.3,1.35) both; }
        @media (prefers-reduced-motion: reduce) { .kib-bar-fill { transition: none; } .kib-role-flip { animation: none; } }
      `}</style>
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-3 pt-2">
        <SwipePages index={page} onIndex={setPage} labels={["Fixtures", "Match", "Scout"]}>
          {[
            <div key="fixtures" className="space-y-2.5 pb-4">
              <div className="kib-rise" style={rise(0)}><FixturesPage career={career} next={nextFixture} /></div>
            </div>,
            <div key="match" className="space-y-2.5 pb-4">
              <div className="kib-rise" style={rise(0)}>
                <Hero career={career} fixture={nextFixture} mine={mine} />
              </div>
              {preMatchSelection && (
                <div className="kib-rise" style={rise(1)}>
                  <StatusCard {...p} preMatchSelection={preMatchSelection} glow={glow} intl={intl} />
                </div>
              )}
            </div>,
            <div key="scout" className="space-y-2.5 pb-4">
              <div className="kib-rise" style={rise(0)}><Conditions career={career} fixture={nextFixture} /></div>
              <div className="kib-rise" style={rise(1)}>
                {intl ? (
                  <div className="rounded-2xl p-4 text-center text-[12px] font-bold text-white/70" style={cardStyle(glow)}>
                    No scout report for an international — {short(nextFixture.opponent)} are a nation, not a squad on file.
                  </div>
                ) : (
                  <Opposition career={career} fixture={nextFixture} />
                )}
              </div>
            </div>,
          ]}
        </SwipePages>
      </div>

      {/* ── The action, pinned ── */}
      <div
        className="relative z-10 border-t border-black/50 bg-gradient-to-b from-gray-800/95 to-gray-900 px-3 pt-2.5 shadow-[0_-10px_24px_-10px_rgba(0,0,0,.85)]"
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-md items-stretch gap-2">
          <button
            onClick={p.onBack}
            aria-label="Back"
            className="kib-press grid w-[52px] shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-gray-600 to-gray-700 text-[20px] font-black text-white"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), 0 3px 8px -3px rgba(0,0,0,.7)" }}
          >
            ←
          </button>
          {watching ? (
            <button
              onClick={p.onWatchFromStands}
              className="kib-press min-h-[54px] flex-1 rounded-2xl bg-gradient-to-b from-slate-500 to-slate-600 px-3 text-[16px] font-black text-white"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.22), 0 4px 12px -4px rgba(0,0,0,.8)" }}
            >
              🏟️ Watch from the stands
            </button>
          ) : (
            <button
              onClick={() => (teamsReady ? p.onShowTeams(true) : p.onPlayMatch())}
              className="kib-press kib-play-pulse min-h-[54px] flex-1 rounded-2xl px-3 text-[17px] font-black leading-tight text-white"
              style={{ background: "linear-gradient(180deg, #34d399 0%, #10b981 55%, #059669 100%)", textShadow: "0 1px 2px rgba(0,0,0,.35)" }}
            >
              {/* Gated on YOUR side only — an under-scouted opponent still
                  gets a team-sheet screen with "Unable to scout" on their
                  half. Only an international fixture, or your own squad
                  falling short, skips the screen entirely. */}
              {teamsReady
                ? "Team sheets →"
                : status === "Substitute" ? "Take your place on the bench ⚽" : "Play Match ⚽"}
            </button>
          )}
          {/* Item 36: sim it instead of playing it — starter or sub. One row
              with the main button, so the screen above it gets the height. */}
          {(status === "1st Team" || status === "Substitute") && (
            <button
              onClick={p.onSimMatch}
              aria-label="Sim this match"
              className="kib-press flex w-[74px] shrink-0 flex-col items-center justify-center rounded-2xl bg-sky-500/10 leading-tight text-sky-200 ring-1 ring-sky-300/35"
            >
              <span className="text-[13px] font-black">⏩ Sim</span>
              <span className="text-[9.5px] font-bold text-sky-200/75">this match</span>
            </button>
          )}
        </div>
      </div>
    </FullHeight>
  );
}

/** Fills the viewport under the site's own nav bar, exactly like
 *  DashboardShell does, so the pinned action is always on screen and only
 *  the middle scrolls. */
function FullHeight({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      setH(Math.max(400, window.innerHeight - (rect.top + window.scrollY)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return (
    <div
      ref={ref}
      className="flex flex-col overflow-hidden text-white"
      style={{
        height: h !== null ? `${h}px` : "calc(100dvh - 64px)",
        background: "radial-gradient(120% 50% at 50% 0%, rgba(16,185,129,.16), transparent 60%), linear-gradient(180deg, #111827, #0a0f1a)",
      }}
    >
      {children}
    </div>
  );
}

// ── 1. The match-day hero ───────────────────────────────────────────────────

function Hero({ career, fixture, mine }: { career: CareerState; fixture: Fixture; mine: string }) {
  // Harry, 28 Sep 2026: "doesnt need to be nearly as big because its also in
  // the home screen" — one compact band, so the role card, energy and the
  // cans all show above the pinned bar. The ground, crowd and weather live on
  // the Scout page now (Conditions).
  const home = fixture.home ? mine : fixture.opponent;
  const away = fixture.home ? fixture.opponent : mine;
  const kits = kitsFor(home, away);
  const hg = glowOf(kits.home.shirt, kits.home.trim), ag = glowOf(kits.away.shirt, kits.away.trim);
  // Europe's three nights get the UEFA-branded photo; everything else the
  // ordinary floodlit ground.
  const europe = fixture.competition === "Champions League" || fixture.competition === "Europa League" || fixture.competition === "Super Cup";
  const photo = europe ? "/star/stadium-europe.png" : "/star/stadium-domestic.png";
  const date = fixtureDateLabel(career.player.startYear, career.season, fixture.week, fixture.kind, divisionOf(career));
  const league = !fixture.kind || fixture.kind === "league";
  const comp = league ? `${leagueNameFor(divisionOf(career))} · Wk ${fixture.week}`
    : fixture.round && fixture.kind !== "international" ? `${fixture.competition ?? "Cup"}` : fixtureLabel(fixture);
  const pill = league
    ? "bg-yellow-400/15 text-yellow-200 ring-yellow-300/35"
    : fixture.kind === "international" ? "bg-sky-400/15 text-sky-200 ring-sky-300/35" : "bg-violet-400/15 text-violet-200 ring-violet-300/35";
  // The derby or the round is a small tag now, not a headline.
  const tag = fixture.derby ? "Derby" : !league && fixture.kind !== "international" && fixture.round ? fixture.round : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      title={fixture.derby ? "The one that counts. Everything is worth more today." : undefined}
      style={{
        backgroundImage: `radial-gradient(70% 120% at 0% 60%, ${rgba(hg, 0.5)} 0%, transparent 62%), radial-gradient(70% 120% at 100% 60%, ${rgba(ag, 0.5)} 0%, transparent 62%), linear-gradient(180deg, rgba(6,10,20,.55), rgba(6,10,20,.8)), url(${photo})`,
        backgroundSize: "cover",
        backgroundPosition: "center 35%",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.08), 0 10px 22px -14px rgba(0,0,0,.9)",
      }}
    >
      <Floodlights />
      <div className="relative px-2.5 pb-2 pt-2">
        <div className="flex items-center gap-1.5">
          <span className={`min-w-0 truncate rounded-full px-2 py-[1px] text-[9.5px] font-black uppercase tracking-[0.12em] ring-1 ${pill}`}>
            {/* A narrow phone gets the short name, so the tags still fit. */}
            {league ? <><span className="min-[380px]:hidden">{competitionAbbrev(fixture, divisionOf(career))} · Wk {fixture.week}</span><span className="hidden min-[380px]:inline">{comp}</span></> : comp}
          </span>
          {tag && (
            <span className={`shrink-0 truncate rounded-full px-2 py-[1px] text-[9.5px] font-black uppercase tracking-wider ${fixture.derby ? "bg-red-500/25 text-red-200 ring-1 ring-red-400/40" : "bg-white/10 text-white/85 ring-1 ring-white/15"}`}>
              {fixture.derby ? "🔥 " : ""}{tag}
            </span>
          )}
          {/* The game has no kick-off times, so no time is shown — only that
              this is the one you are about to play. */}
          <span className="ml-auto shrink-0 rounded-full bg-amber-400 px-2 py-[1px] text-[9.5px] font-black uppercase tracking-wider text-gray-950" style={{ boxShadow: "0 0 10px rgba(251,191,36,.5)" }}>⚽ Kick-off</span>
        </div>
        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          <HeroSide club={home} kit={kits.home} side="left" you={home === mine} />
          <div className="flex flex-col items-center">
            <span
              className="bg-gradient-to-b from-white to-white/55 bg-clip-text text-[20px] font-black italic leading-none tracking-tighter text-transparent"
              style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,.7))" }}
            >VS</span>
            <span className="mt-0.5 whitespace-nowrap text-[10px] font-black text-white/85">{date}</span>
          </div>
          <HeroSide club={away} kit={kits.away} side="right" you={away === mine} />
        </div>
      </div>
    </div>
  );
}

function HeroSide({ club, kit, side, you }: { club: string; kit: { shirt: string; trim: string }; side: "left" | "right"; you: boolean }) {
  const crest = (
    <div className="relative grid h-[42px] w-[42px] shrink-0 place-items-center">
      <div className="absolute inset-1 rounded-full blur-md" style={{ background: rgba(glowOf(kit.shirt, kit.trim), 0.6) }} />
      <div className="relative" style={{ filter: "drop-shadow(0 3px 5px rgba(0,0,0,.6))" }}>
        <ClubBadge club={club} kit={kit} size={40} />
      </div>
    </div>
  );
  const name = (
    <div className={`min-w-0 ${side === "right" ? "text-right" : ""}`}>
      <div className="truncate text-[13px] font-black leading-tight text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>{short(club)}</div>
      <div className={`flex items-center gap-1 ${side === "right" ? "justify-end" : ""}`}>
        <span className="text-[8.5px] font-black uppercase tracking-widest text-white/55">{side === "left" ? "Home" : "Away"}</span>
        {you && <span className="rounded-full bg-emerald-400/20 px-1 text-[8.5px] font-black uppercase tracking-widest text-emerald-300">You</span>}
      </div>
    </div>
  );
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${side === "right" ? "justify-end" : ""}`}>
      {side === "left" ? <>{crest}{name}</> : <>{name}{crest}</>}
    </div>
  );
}

/** Two floodlight banks in the top corners — the home screen's lamps. */
function Floodlights() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {["6%", "94%"].map((x) => (
        <div key={x} className="kib-flood absolute top-0" style={{ left: x }}>
          <div className="absolute -left-14 -top-12 h-28 w-28 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(220,235,255,.35), rgba(220,235,255,0))" }} />
        </div>
      ))}
    </div>
  );
}

// ── 2. Your status ──────────────────────────────────────────────────────────

function StatusCard(p: Props & { preMatchSelection: SelectionVerdict; glow: string; intl: boolean }) {
  const { career, nextFixture, preMatchEnergy, preMatchSelection: sel, showDevInfo } = p;
  const e = Math.max(0, Math.min(100, Math.round(preMatchEnergy)));
  const fit = Math.max(0, Math.min(100, Math.round(career.matchFitness)));
  const tone = sel.status === "1st Team"
    ? { label: "Starting XI", cls: "from-emerald-300 to-emerald-500 text-gray-950", glow: "#10b981" }
    : sel.status === "Substitute"
      ? { label: "On the bench", cls: "from-amber-200 to-amber-400 text-gray-950", glow: "#f59e0b" }
      : sel.status === "Injured"
        ? { label: "Injured", cls: "from-red-400 to-red-600 text-white", glow: "#dc2626" }
        : { label: "Out of squad", cls: "from-red-400 to-red-600 text-white", glow: "#dc2626" };
  // The bench minute is not shown (Harry, 28 Sep 2026: the badge alone is
  // enough). The sub ladder below stays developer info.

  const boot = career.currentBoot;
  const pills: { text: string; tone: "warn" | "bad" | "ok" | "info" }[] = [];
  if (!career.injury && preMatchEnergy < MIN_ENERGY_TO_SUB) pills.push({ text: "⚠ Too tired for squad", tone: "bad" });
  else if (!career.injury && preMatchEnergy < MIN_ENERGY_TO_START) pills.push({ text: "⚠ Too tired to start", tone: "warn" });
  if (boot.matches <= 0) pills.push({ text: "🥾 Boots worn out", tone: "bad" });
  else pills.push({ text: `🥾 ${boot.matches} left`, tone: boot.matches <= 2 ? "warn" : "info" });
  if (career.kibAbility?.curve) pills.push({ text: "🌀 Curve ready", tone: "ok" });
  if (career.kibAbility?.extraTouch) pills.push({ text: "👟 Touch ready", tone: "ok" });

  return (
    <div className="rounded-2xl p-3" style={cardStyle(tone.glow, 0.26)}>
      {/* One row: who you are today, and where you play. */}
      <div className="flex items-center gap-2">
        <span
          key={sel.status}
          className={`kib-role-flip shrink-0 rounded-full bg-gradient-to-b px-3 py-1.5 text-[12.5px] font-black uppercase tracking-wide ${tone.cls}`}
          style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.5), 0 4px 12px -4px ${rgba(tone.glow, 0.8)}` }}
        >
          {tone.label}
        </span>
        <PositionSelect career={career} playAs={p.playAs} onChange={p.onPlayAs} fixed={p.intl} />
      </div>

      {career.injury && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-red-500/15 px-2.5 py-1.5 ring-1 ring-red-400/40">
          <span className="text-[16px]">🩹</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-black text-red-200">{career.injury.note}</div>
            <div className="text-[10.5px] font-bold text-white/80">
              Out {career.injury.weeksRemaining} more week{career.injury.weeksRemaining === 1 ? "" : "s"} — can&apos;t be picked until fit
            </div>
          </div>
        </div>
      )}

      {/* Item 24: the substitute's ladder — developer info only. */}
      {showDevInfo && sel.status === "Substitute" && (
        <div className="mt-2">
          <div className="flex gap-1">
            {[...SUB_LADDER.map((m) => `${m}'`), "Start"].map((rung, i) => {
              const here = i < SUB_LADDER.length && SUB_LADDER[i] === sel.onAt;
              return (
                <div key={rung} className={`flex-1 rounded-md py-1 text-center text-[11px] font-black ${here ? "bg-amber-400 text-gray-950" : "bg-black/30 text-white/70"}`}>{rung}</div>
              );
            })}
          </div>
          <div className="mt-1 text-[10px] font-bold text-white/80">
            Goals and good ratings off the bench move you up. On from 70&apos;, you&apos;re guaranteed a chance.
          </div>
        </div>
      )}

      {/* The two bars share one grid, so the labels, bars and numbers line up. */}
      <div className="mt-2.5 grid grid-cols-[82px_1fr_40px] items-center gap-x-2">
        <Bar
          label="Energy"
          value={e}
          fill={e >= MIN_ENERGY_TO_START ? ["#34d399", "#a3e635"] : e >= MIN_ENERGY_TO_SUB ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"]}
          marks={[MIN_ENERGY_TO_SUB, MIN_ENERGY_TO_START]}
        />
        <div className="col-span-2 col-start-2 mb-1.5 mt-0.5 text-[9px] font-bold text-white/45">
          Lines: bench {MIN_ENERGY_TO_SUB}% · start {MIN_ENERGY_TO_START}%
        </div>
        {/* Harry, 28 Sep 2026: "fitness probably should be sharpness". The
            label only — the field is still `matchFitness` (+3 a full match
            played, −7 a week missed; careerFlow.ts / selection.ts). */}
        <Bar label="Sharpness" value={fit} fill={["#38bdf8", "#818cf8"]} />
        <div className="col-span-2 col-start-2 mt-0.5 text-[8.5px] font-bold leading-tight text-white/45">
          Goes up by playing, drops each week you don&apos;t
        </div>
      </div>

      {/* v0.15 item 28: a can before kick-off. Enough to clear the starting
          line and "On the bench" flips to "Starting XI" above, on the spot. */}
      {/* The warnings share the cans' header row: a can is what fixes the
          first one. */}
      <div className="mt-2.5 flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-white/55">KIB cans</span>
        <div className="kib-md-noscroll flex min-w-0 flex-1 justify-end gap-1.5 overflow-x-auto">
          {pills.map((pl) => (
            <span
              key={pl.text}
              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${
                pl.tone === "bad" ? "bg-red-500/15 text-red-200 ring-red-400/40"
                  : pl.tone === "warn" ? "bg-amber-400/15 text-amber-200 ring-amber-300/40"
                    : pl.tone === "ok" ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/40"
                      : "bg-white/[0.07] text-white/80 ring-white/15"}`}
            >
              {pl.text}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {KIB_CANS.map((c) => <CanTile key={c.id} can={c} career={career} e={e} onUse={p.onUseCan} onBuy={p.onBuyCan} compact />)}
      </div>

      <PenaltyDutyLine career={career} fixture={nextFixture} status={sel.status} />
    </div>
  );
}

/**
 * Where you play, as one compact control: "Striker ▾" opens the positions
 * this club's real shape can seat (the same list PositionPicker.tsx offers,
 * read the same way — the saved lineup's formation first).
 */
function PositionSelect({ career, playAs, onChange, fixed }: { career: CareerState; playAs: Role | null; onChange: (r: Role | null) => void; fixed: boolean }) {
  const [open, setOpen] = useState(false);
  const real = career.player.position;
  const saved = loadLineup(career.player.club)?.formation;
  const formation = saved ? formationOf(saved) : formationForClub(career.player.club);
  const alternates = fixed ? [] : offeredPositions(real, formation);
  const name = (r: string) => POSITION_NAMES[r as Role] ?? r;
  const current = playAs ?? real;
  const options: { role: Role | null; label: string }[] = [{ role: null, label: name(real) }, ...alternates.map((a) => ({ role: a.role, label: a.label }))];
  const canPick = options.length > 1;
  return (
    <div className="relative min-w-0 flex-1">
      <button
        onClick={() => canPick && setOpen((o) => !o)}
        disabled={!canPick}
        aria-expanded={open}
        className="kib-press flex h-[34px] w-full items-center justify-between gap-1 rounded-full bg-white/[0.08] pl-3 pr-2 text-left ring-1 ring-white/15 disabled:opacity-100"
      >
        <span className="min-w-0 truncate text-[12.5px] font-black text-white">
          <span className="mr-1 text-[9px] uppercase tracking-[0.18em] text-white/50">Pos</span>
          {name(current)}
          {playAs && <span className="ml-1 text-[9px] font-black uppercase text-amber-300">asked</span>}
        </span>
        {canPick && <span className={`shrink-0 text-[11px] text-white/70 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-[38px] z-30 w-full min-w-[170px] overflow-hidden rounded-xl bg-gray-900 p-1 ring-1 ring-white/15" style={{ boxShadow: "0 14px 28px -10px rgba(0,0,0,.9)" }}>
          {options.map((o) => {
            const on = (o.role ?? null) === (playAs ?? null);
            return (
              <button
                key={o.label}
                onClick={() => { onChange(o.role); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] font-black ${on ? "bg-emerald-500/20 text-emerald-200" : "text-white hover:bg-white/10"}`}
              >
                <span>{o.label}{o.role === null && <span className="ml-1 text-[9px] uppercase text-white/45">your position</span>}</span>
                {on && <span>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One bar row in a 3-column grid (label · bar · number). */
function Bar({ label, value, fill, marks = [] }: { label: string; value: number; fill: [string, string]; marks?: number[] }) {
  const shown = useCountUp(value, 900);
  // Fill from empty on first paint (and to the new value after a can).
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <>
      <span className="truncate text-[10px] font-black uppercase tracking-[0.05em] text-white/70">{label}</span>
      <div className="relative h-3.5 overflow-hidden rounded-full bg-black/55" style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.06)" }}>
        <div
          className="kib-bar-fill relative h-full overflow-hidden rounded-full"
          style={{ width: `${w}%`, background: `linear-gradient(90deg, ${fill[0]}, ${fill[1]})`, boxShadow: `0 0 12px ${rgba(fill[0], 0.7)}` }}
        >
          <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/35" />
          <div className="kib-sheen absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>
        {/* The real selection lines: bench and starting. */}
        {marks.map((m) => (
          <div key={m} className="absolute inset-y-0 w-[2px] bg-white/55" style={{ left: `${m}%` }} />
        ))}
      </div>
      <span className="text-right text-[15px] font-black leading-none tabular-nums text-white" style={{ textShadow: `0 0 10px ${rgba(fill[0], 0.6)}` }}>{Math.round(shown)}%</span>
    </>
  );
}

// ── 3. The opposition ───────────────────────────────────────────────────────

function Opposition({ career, fixture }: { career: CareerState; fixture: Fixture }) {
  const report: ScoutReport = scoutReportFor(career, fixture.opponent, fixture.week, fixture);
  const kit = kitsOf(fixture.opponent, career.clubKits?.[fixture.opponent]).home;
  const oppGlow = glowOf(kit.shirt, kit.trim);
  const five = report.recentResults.slice(-5);
  const key = report.topScorer && report.topScorer.goals > 0 ? { p: report.topScorer, role: "Top scorer" } : report.bestPlayer ? { p: report.bestPlayer, role: "Best player" } : null;
  const where = report.cupRun !== null
    ? (report.table ? `${report.table.position}${ordinal(report.table.position)} in your league` : report.cupRun.length ? `Won ${report.cupRun.filter((r) => r.result === "W").length} in this cup` : "First round of the cup")
    : report.table ? `${report.table.position}${ordinal(report.table.position)} of ${report.table.of}` : null;
  const tone = { W: "from-emerald-400 to-emerald-600", D: "from-gray-400 to-gray-600", L: "from-red-500 to-red-700" } as const;

  return (
    <>
    <div className="rounded-2xl p-3" style={cardStyle(oppGlow, 0.3)}>
      <div className="flex items-center gap-2.5">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center">
          <div className="absolute inset-0.5 rounded-full blur-md" style={{ background: rgba(oppGlow, 0.55) }} />
          <div className="relative"><ClubBadge club={fixture.opponent} kit={kit} size={40} /></div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="whitespace-nowrap text-[9.5px] font-black uppercase tracking-[0.2em] text-white/55">The opposition</div>
          <div className="truncate text-[17px] font-black leading-tight text-white">{short(fixture.opponent)}</div>
        </div>
      </div>
      {where && (
        <div className="mt-1.5 inline-block rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-black text-white ring-1 ring-white/15">{where}</div>
      )}
      <div className="mt-1 truncate text-[10.5px] font-bold text-white/65">
        {report.tactics.formationName} · {report.tactics.playstyleName} · {report.tactics.lineHeight} line
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[9.5px] font-black uppercase tracking-[0.2em] text-white/55">Their last 5</span>
        {report.headToHead && (
          <span className="text-[10px] font-black text-white/70">
            You v them <span className="text-emerald-300">{report.headToHead.wins}W</span> <span className="text-white/80">{report.headToHead.draws}D</span> <span className="text-red-300">{report.headToHead.losses}L</span>
          </span>
        )}
      </div>
      {five.length === 0 ? (
        <div className="mt-1 text-[11px] font-bold text-white/50">No games played yet.</div>
      ) : (
        <div className="mt-1 grid grid-cols-5 gap-1">
          {Array.from({ length: 5 }, (_, i) => five[i - (5 - five.length)]).map((f, i) => f ? (
            <div key={i} className="flex min-w-0 flex-col items-center rounded-lg bg-white/[0.06] px-0.5 pb-1 pt-1 ring-1 ring-white/5" title={`v ${short(f.opponent)}`}>
              <div className="flex items-center gap-1">
                <span className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-md bg-gradient-to-b text-[10px] font-black text-white shadow ${tone[f.result]}`}>{f.result}</span>
                <span className="text-[12px] font-black leading-none tabular-nums text-white">{f.scoreFor}-{f.scoreAgainst}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-0.5">
                <span className="text-[8px] font-black text-white/40">v</span>
                <ClubBadge club={f.opponent} kit={kitsOf(f.opponent).home} size={14} />
              </div>
            </div>
          ) : (
            <div key={i} className="rounded-lg border border-dashed border-white/10" />
          ))}
        </div>
      )}

      {key && (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-black/30 px-2.5 py-2 ring-1 ring-white/[.08]">
          <ImageWithFallback
            src={faceOrFake(key.p.image, key.p.name)}
            fallbackSrc={faceOrFake(null, key.p.name)}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full bg-white/10 object-cover ring-2 ring-amber-300/60"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">Key man · {key.role}</div>
            <div className="truncate text-[14px] font-black text-white">{shortNameOf(key.p.name)}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[15px] font-black leading-none text-amber-300">{key.p.overall}</div>
            <div className="text-[9px] font-black uppercase text-white/55">{key.p.position} · {key.p.goals}G {key.p.assists}A</div>
          </div>
        </div>
      )}

    </div>
    {/* The full report, opened out, under the summary. */}
    <ScoutReportCard report={report} />
    </>
  );
}

// ── 4. Fixtures (left page) ─────────────────────────────────────────────────

/**
 * Your upcoming fixtures (league and cup together, each with its competition
 * badge), your recent results, and the rest of the division's games for each
 * upcoming league week — each with a bell for live-score pop-ups from that
 * one game during your match (matchDayPrefs.ts's followed fixtures).
 */
function FixturesPage({ career, next }: { career: CareerState; next: Fixture }) {
  const div = divisionOf(career);
  const ts = (f: Fixture) => fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, div);
  const upcoming = career.fixtures.filter((f) => !f.played).sort((a, b) => ts(a) - ts(b)).slice(0, 8);
  const recent = career.fixtures.filter((f) => f.played && f.homeScore !== undefined).sort((a, b) => ts(b) - ts(a)).slice(0, 5);
  const leagueWeeks = upcoming.filter((f) => (f.kind ?? "league") === "league").slice(0, 5);
  const [weekIdx, setWeekIdx] = useState(0);
  const pick = leagueWeeks[Math.min(weekIdx, Math.max(0, leagueWeeks.length - 1))];
  const [, bump] = useState(0);
  const others = useMemo(() => {
    if (!pick) return [];
    try { return liveWeekFor(career, pick).fixtures; } catch { return []; }
    // The pairings only depend on the week and the division.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick?.week, career.season, career.player.club]);
  const clubTicks = followedClubs();

  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl p-3" style={cardStyle("#34d399", 0.16)}>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Upcoming</div>
        <div className="mt-1.5 space-y-1">
          {upcoming.map((f) => (
            <FixtureRow key={`${f.kind ?? "l"}-${f.week}-${f.opponent}`} career={career} f={f} next={f === next} />
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="rounded-2xl p-3" style={cardStyle("#60a5fa", 0.14)}>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Recent results</div>
          <div className="mt-1.5 space-y-1">
            {recent.map((f) => <FixtureRow key={`r-${f.kind ?? "l"}-${f.week}-${f.opponent}`} career={career} f={f} next={false} />)}
          </div>
        </div>
      )}

      {pick && (
        <div className="rounded-2xl p-3" style={cardStyle("#fbbf24", 0.14)}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Other games</span>
            <span className="text-[10px] font-bold text-white/45">🔔 = live score in your match</span>
          </div>
          <div className="kib-md-noscroll -mx-3 mt-1.5 flex gap-1.5 overflow-x-auto px-3">
            {leagueWeeks.map((f, i) => (
              <button
                key={f.week}
                onClick={() => setWeekIdx(i)}
                className={`kib-press shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${
                  f === pick ? "bg-amber-400 text-gray-950 ring-amber-300" : "bg-white/[0.06] text-white/75 ring-white/15"}`}
              >
                Week {f.week}{f === next ? " · today" : ""}
              </button>
            ))}
          </div>
          {others.length === 0 ? (
            <div className="mt-2 text-[11px] font-bold text-white/50">No other games to show.</div>
          ) : (
            <div className="mt-2 space-y-1">
              {others.map((g) => {
                const key = { season: career.season, week: pick.week, home: g.home, away: g.away };
                const on = isFixtureFollowed(key);
                const ticked = clubTicks.includes(g.home) || clubTicks.includes(g.away);
                return (
                  <div key={`${g.home}-${g.away}`} className="flex items-center gap-2 rounded-xl bg-black/25 px-2 py-1.5 ring-1 ring-white/[.06]">
                    <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                      <div className="flex min-w-0 items-center justify-end gap-1.5">
                        <span className="truncate text-[12px] font-black text-white">{short(g.home)}</span>
                        <ClubBadge club={g.home} kit={kitsOf(g.home, career.clubKits?.[g.home]).home} size={20} />
                      </div>
                      <span className="text-[9px] font-black text-white/40">v</span>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <ClubBadge club={g.away} kit={kitsOf(g.away, career.clubKits?.[g.away]).home} size={20} />
                        <span className="truncate text-[12px] font-black text-white">{short(g.away)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => { toggleFollowedFixture(key); bump((n) => n + 1); }}
                      aria-pressed={on}
                      aria-label={`${on ? "Stop" : "Get"} live scores for ${g.home} v ${g.away}`}
                      title={ticked && !on ? "A club in this game is already ticked in Settings → Live scores" : undefined}
                      className={`kib-press grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] ring-1 ${
                        on ? "bg-amber-400 text-gray-950 ring-amber-300 shadow-[0_0_12px_rgba(251,191,36,.6)]"
                          : ticked ? "bg-white/[0.08] text-amber-200 ring-amber-300/40" : "bg-white/[0.06] text-white/55 ring-white/15"}`}
                    >
                      <span className={on ? "" : "opacity-40 grayscale"}>🔔</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 text-[10px] font-bold leading-snug text-white/50">
            Clubs ticked in Settings → Live scores still pop up every week. A bell here is for that one game.
          </div>
        </div>
      )}
    </div>
  );
}

function FixtureRow({ career, f, next }: { career: CareerState; f: Fixture; next: boolean }) {
  const div = divisionOf(career);
  const league = (f.kind ?? "league") === "league";
  const badge = competitionAbbrev(f, div);
  const badgeCls = league ? "bg-yellow-400/15 text-yellow-200 ring-yellow-300/35"
    : f.kind === "international" ? "bg-sky-400/15 text-sky-200 ring-sky-300/35" : "bg-violet-400/15 text-violet-200 ring-violet-300/35";
  const date = fixtureDateLabel(career.player.startYear, career.season, f.week, f.kind, div);
  const played = f.played && f.homeScore !== undefined && f.awayScore !== undefined;
  const us = played ? (f.home ? f.homeScore! : f.awayScore!) : 0, them = played ? (f.home ? f.awayScore! : f.homeScore!) : 0;
  const res = us > them ? "W" : us === them ? "D" : "L";
  const resCls = { W: "from-emerald-400 to-emerald-600", D: "from-gray-400 to-gray-600", L: "from-red-500 to-red-700" }[res];
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ring-1 ${next ? "bg-emerald-400/10 ring-emerald-300/40" : "bg-black/25 ring-white/[.06]"}`}>
      <span className={`w-[50px] shrink-0 truncate rounded-md px-1 py-0.5 text-center text-[9px] font-black uppercase ring-1 ${badgeCls}`}>{badge}</span>
      <span className="w-[66px] shrink-0 whitespace-nowrap text-[10px] font-bold text-white/70">{date}</span>
      <ClubBadge club={f.opponent} kit={kitsOf(f.opponent, career.clubKits?.[f.opponent]).home} size={20} />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-black text-white">
        {short(f.opponent)} <span className="text-[9.5px] font-black text-white/45">{f.home ? "H" : "A"}</span>
      </span>
      {played ? (
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-[12px] font-black tabular-nums text-white">{us}-{them}</span>
          <span className={`grid h-[17px] w-[17px] place-items-center rounded-md bg-gradient-to-b text-[10px] font-black text-white ${resCls}`}>{res}</span>
        </span>
      ) : next ? (
        <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-[1px] text-[9px] font-black uppercase text-gray-950">Next</span>
      ) : f.round ? (
        <span className="max-w-[70px] shrink-0 truncate text-[9.5px] font-bold text-white/50">{f.round}</span>
      ) : null}
    </div>
  );
}

/** The ground, the crowd and the weather in full — the hero only has room
 *  for one line of it. */
function Conditions({ career, fixture }: { career: CareerState; fixture: Fixture }) {
  const home = fixture.home ? (fixture.kind === "international" ? nationOf(career) : career.player.club) : fixture.opponent;
  const ground = groundFor(home);
  const crowd = crowdFor(home, fixture.week);
  const wx = conditionsFor(career.season, fixture.week, career.homeCity);
  return (
    <div className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5" style={cardStyle("#38bdf8", 0.16)}>
      <span className="text-[22px] leading-none">{WEATHER_ICON[wx.weather]}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[9.5px] font-black uppercase tracking-[0.16em] text-white/55">🏟️ {ground.name} · 👥 {crowd.toLocaleString()}</div>
        <div className="text-[12px] font-black text-white">{wx.label}<span className="font-bold text-white/70"> — {wx.note}</span></div>
      </div>
    </div>
  );
}
