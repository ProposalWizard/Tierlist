"use client";

/**
 * THE STATS PAGE (master plan step 2, Mikey 22 Oct 2026). Your card on the
 * left, shown whole; the four tabs stacked in the gap to its right:
 *
 *   Stats        this season and your career side by side (plus trophies),
 *                season by season (tap one: the awards you won in it), the
 *                cabinet, goals and assists by season, per club, one
 *                International row. Sharpness, energy, fame, standing, the
 *                board, the manager, boots and skills are not on this page.
 *   Records      your bests open; real-world records and Hall of Fame folded.
 *   Achievements the whole list, rarity only (no XP), no box of its own.
 *   Contract     on paper, like the one you signed.
 *
 * Numbers come from lib/star/careerOverview.ts and careerRecords.ts.
 */
import { useMemo, useState, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import { careerOverview } from "@/lib/star/careerOverview";
import { RECORDS } from "@/lib/star/records";
import { hallChases, amount, surnameOf, type HallRecord } from "@/lib/star/hallRecords";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import { awardsInSeason } from "@/lib/star/awardText";
import ClubBadge from "./ClubBadge";
import NationFlag from "./NationFlag";
import { nationOf } from "@/lib/star/competitions";
import { ClubCard, StatBar, RiseIn, useClubTheme, clubTheme, rgba } from "./ui";
import { CardTitle } from "./screenKit";
import PlayerCard from "./PlayerCard";
import ContractPaper from "./ContractPaper";
import { AchievementList } from "./SecondaryScreens";
import { ArcChart, CabinetGrid, Heading, SeasonList } from "./CareerOverview";
import CareerGoalsGallery from "./CareerGoalsGallery";
import { useLeoUpdate } from "@/lib/star/leoUpdate";
import { seasonStartYear } from "@/lib/star/calendar";

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
const seasonLabel = (c: CareerState, s: number) => {
  // The same season years as Stats and Goals (calendar.ts seasonStartYear): this read one year ahead.
  const y = seasonStartYear(c.player.startYear, s);
  return `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
};

const VIEWS = [
  { id: "stats", label: "Stats", icon: "📊" },
  { id: "records", label: "Records", icon: "🏅" },
  { id: "achievements", label: "Achievements", icon: "⭐" },
  { id: "contract", label: "Contract", icon: "📝" },
  // Every goal of your career (Leo, 22 Oct 2026). Shown only with Leo's 24 Oct update on (lib/star/leoUpdate.ts).
  { id: "goals", label: "Goals", icon: "⚽" },
] as const;
type View = (typeof VIEWS)[number]["id"];
let lastView: View = "stats";

export default function StatsTabs({ career, onRenew, hallRecords, startView, achievementsTop }: {
  career: CareerState; onRenew: () => void;
  /** Open on this tab. Otherwise the last one. */
  startView?: View;
  /** Your own retired careers' records (lib/star/hallRecords.ts). */
  hallRecords?: HallRecord[];
  /** Above the achievements: your first steps, until they are all done (UnlockChain.tsx). */
  achievementsTop?: ReactNode;
}) {
  const [view, setViewState] = useState<View>(startView ?? lastView);
  const setView = (v: View) => { lastView = v; setViewState(v); };
  const { glow } = useClubTheme(career);
  const goalsOn = useLeoUpdate("goalsGallery");
  const views = VIEWS.filter((v) => v.id !== "goals" || goalsOn);
  // The update switched off while on Goals: back to Stats.
  const shown: View = view === "goals" && !goalsOn ? "stats" : view;
  const tabs = (
    <div data-stats-row role="tablist" aria-label="Stats" className="flex flex-1 flex-col gap-1.5">
      {views.map((v) => {
        const on = v.id === shown;
        return (
          <button
            key={v.id}
            role="tab"
            aria-selected={on}
            data-stats-chip={v.id}
            onClick={() => setView(v.id)}
            className={`kib-press flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 px-1 text-center text-[12px] font-black uppercase leading-none tracking-wide ${on ? "text-gray-950" : "text-white"}`}
            style={on
              ? { background: "linear-gradient(180deg, #fde047, #f59e0b)", borderRadius: 4, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }
              : { background: "rgba(var(--sk-flat-rgb),.7)", borderRadius: 4, boxShadow: "inset 0 0 0 1px var(--sk-edge)" }}
          >
            <span className="text-[18px] leading-none">{v.icon}</span>
            <span className="max-w-full truncate">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="pb-2">
      <PlayerCard career={career} aside={tabs} saveButton={false} scale={0.93} />
      <RiseIn key={shown} className="mt-2">
        {shown === "stats" && <StatsTab career={career} />}
        {shown === "records" && <Records career={career} glow={glow} hallRecords={hallRecords} />}
        {shown === "achievements" && <AchievementList career={career} top={achievementsTop} />}
        {shown === "contract" && <ContractPaper career={career} onRenew={onRenew} />}
        {shown === "goals" && goalsOn && <CareerGoalsGallery career={career} />}
      </RiseIn>
    </div>
  );
}

function Card({ title, children, note, glow }: { title: string; children: ReactNode; note?: string; glow: string }) {
  return (
    <ClubCard glow={glow} className="mt-2 p-2.5">
      <CardTitle className="mb-1.5">{title}</CardTitle>
      {children}
      {note && <div className="mt-1.5 text-[10px] font-bold text-white/55">{note}</div>}
    </ClubCard>
  );
}

/** A block that opens on a tap (Records: real-world and Hall of Fame start closed). */
function Fold({ title, right, children, glow, id, startOpen = false }: { title: string; right?: ReactNode; children: ReactNode; glow: string; id: string; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <ClubCard glow={glow} className="mt-2 p-0">
      <button onClick={() => setOpen(!open)} aria-expanded={open} data-fold={id} className="flex w-full items-center gap-2 px-2.5 py-2.5 text-left">
        <span className="w-3 text-[11px] text-white/70">{open ? "▾" : "▸"}</span>
        <CardTitle className="flex-1">{title}</CardTitle>
        {right}
      </button>
      {open && <div className="px-2.5 pb-2.5">{children}</div>}
    </ClubCard>
  );
}

/** This season big, your career under it (Mikey's drawing: "APPS 9 · 54"). */
function SeasonCareer({ label, season, career, gold = false }: { label: string; season: number; career: number; gold?: boolean }) {
  return (
    <div className="rounded-lg bg-black/30 px-1 py-2 text-center" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
      <div className={`text-[26px] font-black leading-none tabular-nums ${gold && season > 0 ? "text-amber-300" : "text-white"}`}>{season}</div>
      <div className="mt-1 text-[9.5px] font-black uppercase tracking-wider text-white/75">{label}</div>
      <div className="mt-1 text-[11px] font-black tabular-nums text-amber-200">{career} <span className="text-[9px] text-amber-200/70">career</span></div>
    </div>
  );
}

/** The Stats tab: numbers, seasons, cabinet, goals by season, per club, your country. */
function StatsTab({ career }: { career: CareerState }) {
  const calYears = useLeoUpdate("bugFixes"); // Leo's 24 Oct update: calendar season years
  const o = useMemo(() => careerOverview(career, { calendarYears: calYears }), [career, calYears]);
  const team = o.honours.filter((h) => h.competition !== "Ballon d'Or");
  const awards = [...o.honours.filter((h) => h.competition === "Ballon d'Or"), ...o.individual];
  const seasonTrophies = career.trophies.filter((t) => t.season === career.season).length;
  return (
    <div data-stats-tab>
      <div className="mb-1 flex items-baseline justify-between px-0.5">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">This season</span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/90">Career below</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <SeasonCareer label="Apps" season={career.seasonStats.appearances} career={career.careerStats.appearances} />
        <SeasonCareer label="Goals" season={career.seasonStats.goals} career={career.careerStats.goals} />
        <SeasonCareer label="Assists" season={career.seasonStats.assists} career={career.careerStats.assists} />
        <SeasonCareer label="Trophies" season={seasonTrophies} career={career.trophies.length} gold />
      </div>

      <Heading>Season by season</Heading>
      <SeasonList o={o} newestFirst awardsFor={(n) => awardsInSeason(career, n)} />

      <Heading right={<span className="text-[11px] font-black text-amber-200">{o.totals.trophies}</span>}>The cabinet</Heading>
      {team.length > 0 ? <CabinetGrid items={team} /> : <EmptyShelf />}
      {awards.length > 0 && (
        <>
          <div className="mb-1.5 mt-3 text-[9.5px] font-black uppercase tracking-[0.18em] text-white/60">Your awards</div>
          <CabinetGrid items={awards} />
        </>
      )}

      <Heading>Goals &amp; assists by season</Heading>
      <div className="px-1 py-1"><ArcChart o={o} /></div>

      <Heading>Per club</Heading>
      <div className="space-y-1">
        {o.clubs.map((cl) => (
          <div key={cl.club} className="flex items-center gap-2 px-2 py-1.5" style={{ background: `linear-gradient(90deg, ${rgba(clubTheme(cl.club).glow, 0.2)}, rgba(255,255,255,.03) 60%)`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
            <ClubBadge club={cl.club} kit={kitsOf(cl.club).home} size={22} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-black text-white">{short(cl.club)}</div>
              <div className="text-[10px] font-bold text-white/60">{cl.years} · {cl.seasons} season{cl.seasons === 1 ? "" : "s"}</div>
            </div>
            <Nums cells={[["Apps", cl.apps], ["G", cl.goals], ["A", cl.assists]]} />
          </div>
        ))}
      </div>

      <International career={career} />
      <div className="h-2" />
    </div>
  );
}

function Nums({ cells }: { cells: [string, number][] }) {
  return (
    <div className="flex shrink-0 gap-2 text-center">
      {cells.map(([l, v]) => (
        <div key={l} className="w-8">
          <div className="sk-num text-[16px] leading-none tabular-nums text-white">{v}</div>
          <div className="text-[8.5px] font-black uppercase tracking-wider text-white/55">{l}</div>
        </div>
      ))}
    </div>
  );
}

/** One row for your country (Mikey 22:31): the flag, caps, goals, assists, trophies. The
 *  England tables, rankings and qualifiers live in League → International. */
function International({ career }: { career: CareerState }) {
  const nation = nationOf(career);
  const rec = career.international;
  const assists = (rec?.matches ?? []).reduce((s, m) => s + m.assists, 0);
  const trophies = career.trophies.filter((t) => t.club === nation).length;
  return (
    <>
      <Heading>International</Heading>
      <div data-intl-record className="flex items-center gap-2 px-2 py-1.5" style={{ background: "rgba(255,255,255,.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.06)" }}>
        <div className="shrink-0 rounded-[3px] ring-1 ring-white/20"><NationFlag nation={nation} width={30} rounded={3} /></div>
        <div className="min-w-0 flex-1 truncate text-[12.5px] font-black text-white">{nation}</div>
        <Nums cells={[["Caps", career.caps ?? 0], ["G", career.internationalGoals ?? 0], ["A", assists], ["🏆", trophies]]} />
      </div>
    </>
  );
}

/** No trophies yet: four empty shelf places, blacked out (house rule). */
function EmptyShelf() {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {[0, 1, 2, 3].map((k) => (
        <div key={k} className="sk-shelf h-[66px]" style={{ background: "rgba(0,0,0,.5)", boxShadow: "inset 0 -3px 0 rgba(120,72,24,.5), inset 0 0 0 1px rgba(255,255,255,.05)" }} />
      ))}
    </div>
  );
}

function Row({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-white/5 py-1.5 first:border-t-0">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-b from-white/[0.16] to-white/[0.04] text-[15px] ring-1 ring-white/10">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-black text-white">{label}</div>
        {sub && <div className="truncate text-[10px] font-bold text-white/50">{sub}</div>}
      </div>
      <div className="shrink-0 text-[15px] font-black tabular-nums text-yellow-200">{value}</div>
    </div>
  );
}

/**
 * YOUR LEGEND LIVES ON (Leo, 6 Oct 2026): your retired careers' bests, the
 * records this career chases. Its own group, above the real Premier League
 * records, so the two never read as one list.
 */
function HallRecordsCard({ career, glow, book }: { career: CareerState; glow: string; book: HallRecord[] }) {
  if (book.length === 0) {
    return (
      <Fold id="hall" glow={glow} title="Hall of Fame records">
        <div className="text-[11px] font-bold text-white/70">Retire a career: its bests become records for every career after it.</div>
      </Fold>
    );
  }
  return (
    <Fold id="hall" glow={glow} title="Hall of Fame records" right={<span className="text-[10px] font-black text-white/60">{book.length}</span>}>
      {hallChases(career, book).map(({ record, you, beaten, now }) => {
        const { def, holder, history } = record;
        const chase = def.scope === "season" ? now : you;
        const pct = Math.min(100, Math.round((chase / Math.max(1, holder.value)) * 100));
        const before = history[history.length - 1];
        return (
          <div key={def.id} data-hall-record={def.id} className="border-t border-white/5 py-1.5 first:border-t-0">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-b from-white/[0.16] to-white/[0.04] text-[15px] ring-1 ring-white/10">{def.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-black text-white">{def.label}</div>
                <div className="truncate text-[10px] font-bold text-white/55">
                  {beaten
                    ? <span className="text-emerald-300">You · was {surnameOf(holder.name)}, {holder.value}</span>
                    : <>{holder.name}{holder.seasonLabel ? ` · ${holder.seasonLabel}` : ""}{before ? ` · was ${surnameOf(before.name)}, ${before.value}` : ""}</>}
                </div>
              </div>
              <div className={`shrink-0 text-[15px] font-black tabular-nums ${beaten ? "text-emerald-300" : "text-yellow-200"}`}>{beaten ? you : holder.value}{def.unit === "m" ? " m" : ""}</div>
            </div>
            {!beaten && (
              <div className="mt-1 flex items-center gap-2 pl-9">
                <StatBar value={Math.max(3, pct)} colors={["#f59e0b", "#fde047"]} className="h-1.5 flex-1" sheen={false} />
                <span className="shrink-0 text-[10px] font-black tabular-nums text-white/70">{def.scope === "season" ? "this season " : "you "}{amount(def, chase)}</span>
              </div>
            )}
          </div>
        );
      })}
    </Fold>
  );
}

function Records({ career, glow, hallRecords }: { career: CareerState; glow: string; hallRecords?: HallRecord[] }) {
  const b = career.careerBests ?? {};
  const s = (n: number) => `Season ${seasonLabel(career, n)}`;
  const fresh = !career.careerBests;
  const beaten = RECORDS.filter((r) => r.progress(career) >= r.value).length;
  return (
    <>
      {/* Open to start, folds away on a tap (Mikey, 23 Oct 2026). */}
      <Fold id="bests" glow={glow} title="Your bests" startOpen>
        {fresh && <div className="mb-1.5 text-[10px] font-bold text-white/55">Furthest goal/assist and match bests start counting from now on this save.</div>}
        <Row icon="🚀" label="Furthest goal" value={b.furthestGoal ? `${b.furthestGoal.metres} m` : "—"} sub={b.furthestGoal ? `v ${short(b.furthestGoal.opponent)} · ${s(b.furthestGoal.season)}` : undefined} />
        <Row icon="🎯" label="Furthest assist (your pass)" value={b.furthestAssist ? `${b.furthestAssist.metres} m` : "—"} sub={b.furthestAssist ? `v ${short(b.furthestAssist.opponent)} · ${s(b.furthestAssist.season)}` : undefined} />
        <Row icon="⚽" label="Most goals in a game" value={b.mostGoalsMatch ? String(b.mostGoalsMatch.goals) : "—"} sub={b.mostGoalsMatch ? `v ${short(b.mostGoalsMatch.opponent)} · ${s(b.mostGoalsMatch.season)}` : undefined} />
        <Row icon="📈" label="Most goals in a season" value={b.mostGoalsSeason ? String(b.mostGoalsSeason.goals) : "—"} sub={b.mostGoalsSeason ? s(b.mostGoalsSeason.season) : undefined} />
        <Row icon="🅰️" label="Most assists in a season" value={b.mostAssistsSeason ? String(b.mostAssistsSeason.assists) : "—"} sub={b.mostAssistsSeason ? s(b.mostAssistsSeason.season) : undefined} />
        <Row icon="🎁" label="Most assists in a game" value={b.mostAssistsMatch ? String(b.mostAssistsMatch.assists) : "—"} sub={b.mostAssistsMatch ? `v ${short(b.mostAssistsMatch.opponent)} · ${s(b.mostAssistsMatch.season)}` : undefined} />
        <Row icon="⏱️" label="Fastest goal" value={b.fastestGoal ? `${b.fastestGoal.minute}'` : "—"} sub={b.fastestGoal ? `v ${short(b.fastestGoal.opponent)} · ${s(b.fastestGoal.season)}` : undefined} />
        <Row icon="💥" label="Biggest win" value={b.biggestWin ? `${b.biggestWin.us}–${b.biggestWin.them}` : "—"} sub={b.biggestWin ? `v ${short(b.biggestWin.opponent)} · ${s(b.biggestWin.season)}` : undefined} />
        <Row icon="🔥" label="Longest scoring run" value={career.feats?.bestScoringRun ? `${career.feats.bestScoringRun} games` : "—"} sub={career.feats?.bestScoringRunSeason ? s(career.feats.bestScoringRunSeason) : undefined} />
        <Row icon="🧢" label="Caps" value={String(career.caps ?? 0)} sub={(career.internationalGoals ?? 0) > 0 ? `${career.internationalGoals} international goals` : undefined} />
      </Fold>
      <Fold id="real" glow={glow} title="Real-world records" right={<span className="text-[10px] font-black text-white/60">{beaten} / {RECORDS.length}</span>}>
        {RECORDS.map((r) => {
          const p = r.progress(career);
          const pct = Math.min(100, Math.round((p / r.value) * 100));
          return (
            <div key={r.id} className="border-t border-white/5 py-1.5 first:border-t-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] font-black text-white">{r.label.replace("Premier League", "PL")}</span>
                <span className="shrink-0 text-[11px] font-black tabular-nums text-white/80">{p} / {r.value}</span>
              </div>
              <StatBar value={Math.max(3, pct)} colors={p >= r.value ? ["#34d399", "#a3e635"] : ["#f59e0b", "#fde047"]} className="mt-1 h-2" sheen={false} />
            </div>
          );
        })}
      </Fold>
      {hallRecords && <HallRecordsCard career={career} glow={glow} book={hallRecords} />}
    </>
  );
}
