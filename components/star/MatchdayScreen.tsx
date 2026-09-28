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
 *   2. your status: selection, position, energy and fitness as bars, small
 *      warning pills, the KIB cans (Use / Buy) right under energy, and who is
 *      on penalties;
 *   3. the opposition: their last five, where they sit, their key man, your
 *      head-to-head, and the full scout report one tap away;
 *   4. the action — Team sheets / Play / Watch from the stands, and Sim —
 *      PINNED to the bottom of the screen, so it is always there without
 *      scrolling. Everything else scrolls behind it.
 *
 * The team sheets (VersusScreen) still come between this and kick-off
 * whenever your XI can be drawn — see `teamsReady`.
 */
import { useEffect, useRef, useState } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import type { SelectionVerdict } from "@/lib/star/selection";
import { MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB, SUB_LADDER } from "@/lib/star/selection";
import type { Role } from "@/lib/star/formations";
import { formationOf } from "@/lib/star/formations";
import { KIB_CANS, type KibCan } from "@/lib/star/shopData";
import { kitsFor, kitsOf } from "@/lib/star/kits";
import { groundFor, crowdFor } from "@/lib/star/stadiums";
import { conditionsFor, type Conditions } from "@/lib/star/weather";
import { fixtureLabel, nationOf } from "@/lib/star/competitions";
import { fixtureDateLabel, divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { matchdayFor } from "@/lib/star/teamsheet";
import { loadLineup } from "@/lib/star/lineupStore";
import { scoutReportFor, type ScoutReport } from "@/lib/star/scoutReport";
import { faceOrFake } from "@/lib/star/fakeFaces";
import { shortNameOf } from "@/lib/star/realSquad";
import { rgba } from "@/lib/star/heroFigure";
import ClubBadge from "./ClubBadge";
import ImageWithFallback from "@/components/ImageWithFallback";
import PositionPicker from "./PositionPicker";
import PenaltyDutyLine from "./PenaltyDutyLine";
import ScoutReportCard from "./ScoutReport";
import VersusScreen from "./VersusScreen";
import { CanTile, cardStyle, glowOf, short, daysToNext } from "./HomeHub";
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
        .kib-md-noscroll::-webkit-scrollbar { display: none; }
        .kib-md-noscroll { scrollbar-width: none; -ms-overflow-style: none; }
        .kib-bar-fill { transition: width 1000ms cubic-bezier(.2,.8,.2,1); }
        @keyframes kibRoleFlip { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
        .kib-role-flip { display: inline-block; animation: kibRoleFlip 0.45s cubic-bezier(0.2,0.9,0.3,1.35) both; }
        @media (prefers-reduced-motion: reduce) { .kib-bar-fill { transition: none; } .kib-role-flip { animation: none; } }
      `}</style>
      <div data-page-active="true" className="kib-md-noscroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-md space-y-2.5 px-3 pb-4 pt-2.5">
          <div className="kib-rise" style={rise(0)}>
            <Hero career={career} fixture={nextFixture} mine={mine} />
          </div>
          {preMatchSelection && (
            <div className="kib-rise" style={rise(1)}>
              <StatusCard {...p} preMatchSelection={preMatchSelection} glow={glow} intl={intl} />
            </div>
          )}
          {!intl && (
            <div className="kib-rise" style={rise(2)}>
              <Opposition career={career} fixture={nextFixture} glow={glow} />
            </div>
          )}
        </div>
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
        </div>
        {/* Item 36: sim it instead of playing it — starter or sub. */}
        {(status === "1st Team" || status === "Substitute") && (
          <div className="mx-auto mt-2 w-full max-w-md">
            <button
              onClick={p.onSimMatch}
              className="kib-press h-10 w-full rounded-xl bg-sky-500/10 text-[13px] font-black text-sky-200 ring-1 ring-sky-300/35"
            >
              ⏩ Sim this match
            </button>
          </div>
        )}
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
  const home = fixture.home ? mine : fixture.opponent;
  const away = fixture.home ? fixture.opponent : mine;
  const kits = kitsFor(home, away);
  const hg = glowOf(kits.home.shirt, kits.home.trim), ag = glowOf(kits.away.shirt, kits.away.trim);
  // Whoever is HOME hosts it.
  const ground = groundFor(home);
  const crowd = crowdFor(home, fixture.week);
  const wx = conditionsFor(career.season, fixture.week, career.homeCity);
  // Europe's three nights get the UEFA-branded photo; everything else the
  // ordinary floodlit ground (see git history for why both were re-cropped).
  const europe = fixture.competition === "Champions League" || fixture.competition === "Europa League" || fixture.competition === "Super Cup";
  const photo = europe ? "/star/stadium-europe.png" : "/star/stadium-domestic.png";
  const date = fixtureDateLabel(career.player.startYear, career.season, fixture.week, fixture.kind, divisionOf(career));
  const days = daysToNext(career, fixture);
  const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  const league = !fixture.kind || fixture.kind === "league";
  const comp = league ? `${leagueNameFor(divisionOf(career))} · Week ${fixture.week}`
    : fixture.round && fixture.kind !== "international" ? `${fixture.competition ?? "Cup"} · Week ${fixture.week}` : fixtureLabel(fixture);
  const pill = league
    ? "bg-yellow-400/15 text-yellow-200 ring-yellow-300/35"
    : fixture.kind === "international" ? "bg-sky-400/15 text-sky-200 ring-sky-300/35" : "bg-violet-400/15 text-violet-200 ring-violet-300/35";
  const title = fixture.derby ? "Derby Day" : !league && fixture.kind !== "international" && fixture.round ? fixture.round : "Match Day";

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        backgroundImage: `radial-gradient(80% 90% at 0% 60%, ${rgba(hg, 0.5)} 0%, transparent 60%), radial-gradient(80% 90% at 100% 60%, ${rgba(ag, 0.5)} 0%, transparent 60%), linear-gradient(180deg, rgba(6,10,20,.55) 0%, rgba(6,10,20,.25) 40%, rgba(6,10,20,.85) 100%), url(${photo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.08), 0 12px 26px -14px rgba(0,0,0,.9), 0 2px 6px rgba(0,0,0,.35)",
      }}
    >
      <Floodlights />
      <div className="relative px-3 pb-2.5 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ring-1 ${pill}`}>{comp}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${days <= 1 ? "bg-amber-400 text-gray-950" : "bg-black/40 text-amber-200 ring-1 ring-white/15"}`}>⏱ {when}</span>
        </div>
        <div className="mt-1.5 text-center text-[22px] font-black uppercase italic leading-none tracking-tight text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,.7)" }}>
          {title}
        </div>
        {fixture.derby && (
          <div className="mt-0.5 text-center text-[11px] font-bold text-red-300">The one that counts. Everything is worth more today.</div>
        )}
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-1">
          <HeroSide club={home} kit={kits.home} tag="Home" you={home === mine} />
          <div className="flex flex-col items-center px-1">
            <span
              className="bg-gradient-to-b from-white to-white/55 bg-clip-text text-[30px] font-black italic leading-none tracking-tighter text-transparent"
              style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.7))" }}
            >VS</span>
            <span className="mt-1 whitespace-nowrap text-[12px] font-black text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>{date}</span>
          </div>
          <HeroSide club={away} kit={kits.away} tag="Away" you={away === mine} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <Chip>🏟️ {ground.name}</Chip>
          <Chip>👥 {crowd.toLocaleString()}</Chip>
          <Chip>{WEATHER_ICON[wx.weather]} {wx.label}</Chip>
        </div>
        {wx.weather !== "clear" && (
          <div className="mt-1 text-center text-[10px] font-bold leading-snug text-white/70">{wx.note}</div>
        )}
      </div>
    </div>
  );
}

function HeroSide({ club, kit, tag, you }: { club: string; kit: { shirt: string; trim: string }; tag: string; you: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center">
      <div className="relative grid h-[68px] w-[68px] place-items-center">
        <div className="absolute inset-1 rounded-full blur-md" style={{ background: rgba(glowOf(kit.shirt, kit.trim), 0.6) }} />
        <div className="relative" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,.6))" }}>
          <ClubBadge club={club} kit={kit} size={60} />
        </div>
      </div>
      <div className="mt-0.5 w-full truncate text-center text-[14px] font-black text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>{short(club)}</div>
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{tag}</span>
        {you && <span className="rounded-full bg-emerald-400/20 px-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-300">You</span>}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="max-w-full truncate rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-bold text-white ring-1 ring-white/[.12] backdrop-blur-[2px]">
      {children}
    </span>
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
  const { career, nextFixture, preMatchEnergy, preMatchSelection: sel, showDevInfo, glow } = p;
  const e = Math.max(0, Math.min(100, Math.round(preMatchEnergy)));
  const fit = Math.max(0, Math.min(100, Math.round(career.matchFitness)));
  const tone = sel.status === "1st Team"
    ? { label: "Starting XI", cls: "from-emerald-300 to-emerald-500 text-gray-950", glow: "#10b981" }
    : sel.status === "Substitute"
      ? { label: "On the bench", cls: "from-amber-200 to-amber-400 text-gray-950", glow: "#f59e0b" }
      : sel.status === "Injured"
        ? { label: "Injured", cls: "from-red-400 to-red-600 text-white", glow: "#dc2626" }
        : { label: "Out of squad", cls: "from-red-400 to-red-600 text-white", glow: "#dc2626" };
  // Item 24: the substitute's planned minute is developer info only.
  const subLine = sel.status === "Substitute"
    ? (showDevInfo ? `Coming on around ${sel.onAt}'` : "On when the game needs you")
    : null;

  const boot = career.currentBoot;
  const pills: { text: string; tone: "warn" | "bad" | "ok" | "info" }[] = [];
  if (!career.injury && preMatchEnergy < MIN_ENERGY_TO_SUB) pills.push({ text: "⚠ Too tired for the squad", tone: "bad" });
  else if (!career.injury && preMatchEnergy < MIN_ENERGY_TO_START) pills.push({ text: "⚠ Too tired to start", tone: "warn" });
  if (boot.matches <= 0) pills.push({ text: "🥾 Boots worn out", tone: "bad" });
  else if (boot.matches <= 2) pills.push({ text: `🥾 Boots: ${boot.matches} left`, tone: "warn" });
  else pills.push({ text: `🥾 ${boot.name} · ${boot.matches} left`, tone: "info" });
  if (career.kibAbility?.curve) pills.push({ text: "🌀 Curve ready", tone: "ok" });
  if (career.kibAbility?.extraTouch) pills.push({ text: "👟 Extra touch ready", tone: "ok" });

  return (
    <div className="rounded-2xl p-3" style={cardStyle(tone.glow, 0.26)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Your role</span>
        <span
          key={sel.status}
          className={`kib-role-flip rounded-full bg-gradient-to-b px-3 py-1 text-[13px] font-black uppercase tracking-wide ${tone.cls}`}
          style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,.5), 0 4px 12px -4px ${rgba(tone.glow, 0.8)}` }}
        >
          {tone.label}
        </span>
      </div>
      {subLine && <div className="mt-1 text-right text-[11px] font-bold text-amber-200">{subLine}</div>}

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

      {!p.intl && (
        <div className="mt-2.5">
          <div className="text-[9.5px] font-black uppercase tracking-[0.2em] text-white/55">Position</div>
          <PositionPicker club={career.player.club} realPosition={career.player.position} playAs={p.playAs} onChange={p.onPlayAs} embedded />
        </div>
      )}

      <div className="mt-3 space-y-2">
        <Bar
          label="⚡ Energy"
          value={e}
          fill={e >= MIN_ENERGY_TO_START ? ["#34d399", "#a3e635"] : e >= MIN_ENERGY_TO_SUB ? ["#f59e0b", "#fde047"] : ["#dc2626", "#fb7185"]}
          marks={[MIN_ENERGY_TO_SUB, MIN_ENERGY_TO_START]}
        />
        <Bar label="💪 Match fitness" value={fit} fill={["#38bdf8", "#818cf8"]} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {pills.map((pl) => (
          <span
            key={pl.text}
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-black ring-1 ${
              pl.tone === "bad" ? "bg-red-500/15 text-red-200 ring-red-400/40"
                : pl.tone === "warn" ? "bg-amber-400/15 text-amber-200 ring-amber-300/40"
                  : pl.tone === "ok" ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/40"
                    : "bg-white/[0.07] text-white/80 ring-white/15"}`}
          >
            {pl.text}
          </span>
        ))}
      </div>

      {/* v0.15 item 28: a can before kick-off. Enough to clear the starting
          line and "On the bench" flips to "Starting XI" above, on the spot. */}
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">KIB cans</span>
        <span className="text-[10px] font-bold text-white/45">Drink one before kick-off</span>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {KIB_CANS.map((c) => <CanTile key={c.id} can={c} career={career} e={e} onUse={p.onUseCan} onBuy={p.onBuyCan} />)}
      </div>

      <PenaltyDutyLine career={career} fixture={nextFixture} status={sel.status} />
    </div>
  );
}

function Bar({ label, value, fill, marks = [] }: { label: string; value: number; fill: [string, string]; marks?: number[] }) {
  const shown = useCountUp(value, 900);
  // Fill from empty on first paint (and to the new value after a can).
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">{label}</span>
        <span className="text-[17px] font-black leading-none tabular-nums text-white" style={{ textShadow: `0 0 10px ${rgba(fill[0], 0.6)}` }}>{Math.round(shown)}%</span>
      </div>
      <div className="relative mt-1 h-3.5 overflow-hidden rounded-full bg-black/55" style={{ boxShadow: "inset 0 2px 4px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.06)" }}>
        <div
          className="kib-bar-fill relative h-full overflow-hidden rounded-full"
          style={{ width: `${w}%`, background: `linear-gradient(90deg, ${fill[0]}, ${fill[1]})`, boxShadow: `0 0 12px ${rgba(fill[0], 0.7)}` }}
        >
          <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/35" />
          <div className="kib-sheen absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        </div>
        {/* The real selection lines: bench and starting. */}
        {marks.map((m) => (
          <div key={m} className="absolute inset-y-0 w-[2px] bg-white/45" style={{ left: `${m}%` }} />
        ))}
      </div>
      {marks.length > 0 && (
        <div className="relative mt-0.5 h-3 text-[8.5px] font-black uppercase tracking-wider text-white/45">
          <span className="absolute -translate-x-1/2" style={{ left: `${marks[0]}%` }}>Bench</span>
          {marks[1] !== undefined && <span className="absolute -translate-x-1/2" style={{ left: `${marks[1]}%` }}>Start</span>}
        </div>
      )}
    </div>
  );
}

// ── 3. The opposition ───────────────────────────────────────────────────────

function Opposition({ career, fixture, glow }: { career: CareerState; fixture: Fixture; glow: string }) {
  const [open, setOpen] = useState(false);
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

      <button
        onClick={() => setOpen((o) => !o)}
        className="kib-press mt-2.5 w-full rounded-xl bg-white/[0.06] py-2 text-[12px] font-black text-white/85 ring-1 ring-white/[.12]"
        style={{ boxShadow: `0 4px 10px -8px ${rgba(glow, 0.8)}` }}
      >
        {open ? "Hide full scout report ▴" : "Full scout report ▾"}
      </button>
      {open && <ScoutReportCard report={report} />}
    </div>
  );
}
