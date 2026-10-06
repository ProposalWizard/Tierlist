"use client";

/**
 * THE LEFT SWIPE PAGE — Season · All seasons · Records.
 *
 * PROTOTYPE (home-screen proto, 27 Sep 2026). Harry: "in the stats area have
 * multiple tabs in there - season stats should also have an all seasons tag
 * which includes stats overall and per club and all of your records (furthest
 * goal, furthest assist, most goals in a game, most in a season, motm awards,
 * potm, balon dors, trophies etc."
 *
 * Numbers come from lib/star/careerRecords.ts. Where a record has no history
 * on an older save, one small line says counting started now.
 */
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { allSeasons, perClubTotals, trophiesByCompetition } from "@/lib/star/careerRecords";
import { RECORDS } from "@/lib/star/records";
import { hallChases, amount, surnameOf, type HallRecord } from "@/lib/star/hallRecords";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import DashboardStats from "./DashboardStats";
import AllSeasonsNew from "./AllSeasonsNew";
import { useAllSeasonsLook } from "@/lib/star/allSeasonsLook";
import ClubBadge from "./ClubBadge";
import { ClubCard, StatBar, PressButton, RiseIn, Chev, useClubTheme } from "./ui";
import { CardTitle } from "./screenKit";

const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
const seasonLabel = (c: CareerState, s: number) => {
  const y = c.player.startYear + s - 1;
  return `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
};

const VIEWS = [
  { id: "season", label: "Season", icon: "📊" },
  { id: "contract", label: "Contract", icon: "📝" },
  { id: "status", label: "Status", icon: "🩺" },
  { id: "all", label: "All seasons", icon: "🗓️" },
  { id: "records", label: "Records", icon: "🏅" },
] as const;
type View = (typeof VIEWS)[number]["id"];
let lastView: View = "season";

/**
 * THE STATS PAGE — one thin row, NSS-style (Harry, 1 Oct 2026, P46/P47/P96).
 * It had three stacked tab rows (Stats · Home · Shop, Season · All seasons ·
 * Records, Stats · Contract · Status): about 100px before any number showed.
 * Now: just "‹ Season ›" to change the view (Season, Contract, Status, All
 * seasons, Records). The League and Home arrows moved to the bottom edge with
 * the other page arrows (SwipePages). The Premier League mini-table is gone from here: Home
 * has it, and the League screen has the full table.
 */
export default function StatsTabs({ career, onRenew, onOpen, hallRecords }: {
  career: CareerState; onRenew: () => void; onOpen?: (ph: "achievements" | "trophies") => void;
  /** Your own retired careers' records (lib/star/hallRecords.ts). */
  hallRecords?: HallRecord[];
}) {
  const [view, setViewState] = useState<View>(lastView);
  const setView = (v: View) => { lastView = v; setViewState(v); };
  const { glow } = useClubTheme(career);
  const allLook = useAllSeasonsLook();
  const i = VIEWS.findIndex((v) => v.id === view);
  const step = (d: number) => setView(VIEWS[(i + d + VIEWS.length) % VIEWS.length].id);
  const here = VIEWS[i];
  return (
    <div className="pb-2">
      <div data-stats-row className="mb-2 grid items-center">
        <div className="flex min-w-0 items-center justify-center gap-1">
          <button onClick={() => step(-1)} aria-label={`Previous view: ${VIEWS[(i + VIEWS.length - 1) % VIEWS.length].label}`} className="kib-press grid h-[30px] w-[26px] shrink-0 place-items-center text-[16px] font-black leading-none text-amber-300" style={{ background: "rgba(var(--sk-flat-rgb),.7)", borderRadius: 2, boxShadow: "inset 0 0 0 1px var(--sk-edge)" }}><Chev dir="left" size={14} /></button>
          <div className="min-w-0 truncate text-center text-[13px] font-black uppercase tracking-wide text-white" style={{ minWidth: 72 }}><span className="mr-1">{here.icon}</span>{here.label}</div>
          <button onClick={() => step(1)} aria-label={`Next view: ${VIEWS[(i + 1) % VIEWS.length].label}`} className="kib-press grid h-[30px] w-[26px] shrink-0 place-items-center text-[16px] font-black leading-none text-amber-300" style={{ background: "rgba(var(--sk-flat-rgb),.7)", borderRadius: 2, boxShadow: "inset 0 0 0 1px var(--sk-edge)" }}><Chev dir="right" size={14} /></button>
        </div>
      </div>
      <RiseIn key={view}>
        {(view === "season" || view === "contract" || view === "status") && <DashboardStats career={career} onRenew={onRenew} view={view === "season" ? "stats" : view} />}
        {view === "all" && (allLook === "new" ? <AllSeasonsNew career={career} /> : <AllSeasons career={career} glow={glow} />)}
        {view === "records" && <Records career={career} glow={glow} hallRecords={hallRecords} />}
        {view === "records" && onOpen && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PressButton variant="secondary" size="none" onClick={() => onOpen("achievements")} className="rounded-xl py-2.5 text-[11px] font-black">⭐ Achievements →</PressButton>
            <PressButton variant="secondary" size="none" onClick={() => onOpen("trophies")} className="rounded-xl py-2.5 text-[11px] font-black">🏆 Trophy cabinet →</PressButton>
          </div>
        )}
      </RiseIn>
    </div>
  );
}

function Card({ title, children, note, glow }: { title: string; children: React.ReactNode; note?: string; glow: string }) {
  return (
    <ClubCard glow={glow} className="mt-2 p-2.5">
      <CardTitle className="mb-1.5">{title}</CardTitle>
      {children}
      {note && <div className="mt-1.5 text-[10px] font-bold text-white/55">{note}</div>}
    </ClubCard>
  );
}

function Big({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-gradient-to-b from-white/[0.14] to-white/[0.04] px-1 py-1.5 text-center" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px rgba(255,255,255,.08)" }}>
      <div className="text-[18px] font-black leading-tight tabular-nums text-white">{value}</div>
      <div className="text-[8.5px] font-black uppercase tracking-wider text-white/60">{label}</div>
    </div>
  );
}

function AllSeasons({ career, glow }: { career: CareerState; glow: string }) {
  const c = career.careerStats;
  const avg = c.ratingCount > 0 ? (c.totalRating / c.ratingCount).toFixed(2) : "—";
  const clubs = perClubTotals(career);
  const seasons = allSeasons(career);
  const noHistory = !(career.seasonArchive?.length);
  return (
    <>
      <Card glow={glow} title="Career totals">
        <div className="grid grid-cols-5 gap-1">
          <Big label="Apps" value={c.appearances} />
          <Big label="Goals" value={c.goals} />
          <Big label="Assists" value={c.assists} />
          <Big label="Avg" value={avg} />
          <Big label="MOTM" value={c.starMan} />
        </div>
      </Card>
      <Card glow={glow} title="Per club" note={noHistory ? "Club and season history starts counting from this season." : undefined}>
        {clubs.length === 0 ? (
          <div className="text-[11px] font-bold text-white/50">No appearances yet.</div>
        ) : (
          <table className="w-full text-[11px] font-bold text-white">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-white/50">
                <th className="py-1 text-left">Club</th><th>Seasons</th><th>Apps</th><th>G</th><th>A</th>
              </tr>
            </thead>
            <tbody>
              {clubs.map((t) => (
                <tr key={t.club} className="border-t border-white/5">
                  <td className="py-1.5">
                    <div className="flex items-center gap-1.5">
                      <ClubBadge club={t.club} kit={kitsOf(t.club).home} size={20} />
                      <span className="truncate">{short(t.club)}</span>
                    </div>
                  </td>
                  <td className="text-center tabular-nums">{t.seasons}</td>
                  <td className="text-center tabular-nums">{t.apps}</td>
                  <td className="text-center tabular-nums">{t.goals}</td>
                  <td className="text-center tabular-nums">{t.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card glow={glow} title="Season by season">
        {seasons.length === 0 ? (
          <div className="text-[11px] font-bold text-white/50">No seasons played yet.</div>
        ) : (
          <table className="w-full text-[11px] font-bold text-white">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-white/50">
                <th className="py-1 text-left">Season</th><th className="text-left">Club</th><th>Apps</th><th>G</th><th>A</th><th>Avg</th>
              </tr>
            </thead>
            <tbody>
              {[...seasons].reverse().map((r) => (
                <tr key={r.season} className="border-t border-white/5">
                  <td className="py-1.5 tabular-nums">{seasonLabel(career, r.season)}{r.live && <span className="ml-1 text-[9px] text-emerald-300">now</span>}</td>
                  <td className="truncate">{short(r.club)}</td>
                  <td className="text-center tabular-nums">{r.apps}</td>
                  <td className="text-center tabular-nums">{r.goals}</td>
                  <td className="text-center tabular-nums">{r.assists}</td>
                  <td className="text-center tabular-nums text-amber-300">{r.avgRating ? r.avgRating.toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
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
      <Card glow={glow} title="Hall of Fame records">
        <div className="text-[11px] font-bold text-white/70">Retire a career: its bests become records for every career after it.</div>
      </Card>
    );
  }
  return (
    <Card glow={glow} title="Hall of Fame records">
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
    </Card>
  );
}

function Records({ career, glow, hallRecords }: { career: CareerState; glow: string; hallRecords?: HallRecord[] }) {
  const b = career.careerBests ?? {};
  const s = (n: number) => `Season ${seasonLabel(career, n)}`;
  const potmWon = (career.potm ?? []).filter((m) => m.isYou);
  const troph = trophiesByCompetition(career);
  const fresh = !career.careerBests;
  return (
    <>
      <Card glow={glow} title="Your bests" note={fresh ? "Furthest goal/assist and match bests start counting from now on this save." : undefined}>
        <Row icon="🚀" label="Furthest goal" value={b.furthestGoal ? `${b.furthestGoal.metres} m` : "—"} sub={b.furthestGoal ? `v ${short(b.furthestGoal.opponent)} · ${s(b.furthestGoal.season)}` : undefined} />
        <Row icon="🎯" label="Furthest assist (your pass)" value={b.furthestAssist ? `${b.furthestAssist.metres} m` : "—"} sub={b.furthestAssist ? `v ${short(b.furthestAssist.opponent)} · ${s(b.furthestAssist.season)}` : undefined} />
        <Row icon="⚽" label="Most goals in a game" value={b.mostGoalsMatch ? String(b.mostGoalsMatch.goals) : "—"} sub={b.mostGoalsMatch ? `v ${short(b.mostGoalsMatch.opponent)} · ${s(b.mostGoalsMatch.season)}` : undefined} />
        <Row icon="📈" label="Most goals in a season" value={b.mostGoalsSeason ? String(b.mostGoalsSeason.goals) : "—"} sub={b.mostGoalsSeason ? s(b.mostGoalsSeason.season) : undefined} />
        <Row icon="🅰️" label="Most assists in a season" value={b.mostAssistsSeason ? String(b.mostAssistsSeason.assists) : "—"} sub={b.mostAssistsSeason ? s(b.mostAssistsSeason.season) : undefined} />
      </Card>
      {hallRecords && <HallRecordsCard career={career} glow={glow} book={hallRecords} />}
      <Card glow={glow} title="Awards">
        <Row icon="⭐" label="Man of the match" value={String(career.careerStats.starMan)} sub="Star Man — rating 8.5+ or two goals" />
        <Row icon="📅" label="Player of the Month" value={String(potmWon.length)} sub={potmWon.slice(-2).map((m) => `${m.monthName} ${seasonLabel(career, m.season)}`).join(" · ") || undefined} />
        <Row icon="🏅" label="Ballon d'Or" value={String(career.ballonDorWins)} />
      </Card>
      <Card glow={glow} title={`Trophies · ${career.trophies.length}`}>
        {troph.length === 0 ? (
          <div className="text-[11px] font-bold text-white/50">None yet.</div>
        ) : troph.map((t) => (
          <Row key={t.competition} icon="🏆" label={t.competition} value={`×${t.seasons.length}`} sub={t.seasons.map((n) => seasonLabel(career, n)).join(" · ")} />
        ))}
      </Card>
      <Card glow={glow} title="Premier League records">
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
      </Card>
    </>
  );
}
