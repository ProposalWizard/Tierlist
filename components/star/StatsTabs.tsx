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
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitsOf } from "@/lib/star/kits";
import DashboardStats from "./DashboardStats";
import ClubBadge from "./ClubBadge";
import { sortLeague } from "@/lib/star/season";
import { divisionOf, leagueNameFor } from "@/lib/star/calendar";
import { ClubCard, StatBar, PressButton, RiseIn, useCountUp, rgba, useClubTheme } from "./ui";
import { SegTabs, CardTitle, youRowStyle } from "./screenKit";

type Tab = "season" | "all" | "records";
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
const seasonLabel = (c: CareerState, s: number) => {
  const y = c.player.startYear + s - 1;
  return `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
};

export default function StatsTabs({ career, onRenew, onOpen, onLeague }: { career: CareerState; onRenew: () => void; onOpen?: (ph: "achievements" | "trophies") => void; onLeague?: () => void }) {
  const [tab, setTab] = useState<Tab>("season");
  const { glow } = useClubTheme(career);
  return (
    <div className="pb-2">
      <SegTabs value={tab} onChange={setTab} tabs={[["season", "Season"], ["all", "All seasons"], ["records", "Records"]] as const} />
      {tab === "season" && (
        <div className="space-y-2">
          {/* Your season first, the league under it (Harry, 30 Sep 2026: "in
              season this should be the first thing you see and then maybe
              underneath that you would have the Prem"). */}
          <RiseIn onPageActive index={0}><DashboardStats career={career} onRenew={onRenew} /></RiseIn>
          <RiseIn onPageActive index={1}><LeagueCard career={career} onLeague={onLeague} glow={glow} /></RiseIn>
        </div>
      )}
      {tab === "all" && <RiseIn key="all"><AllSeasons career={career} glow={glow} /></RiseIn>}
      {tab === "records" && <RiseIn key="records"><Records career={career} glow={glow} /></RiseIn>}
      {tab === "records" && onOpen && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <PressButton variant="secondary" size="none" onClick={() => onOpen("achievements")} className="rounded-xl py-2.5 text-[11px] font-black">⭐ Achievements →</PressButton>
          <PressButton variant="secondary" size="none" onClick={() => onOpen("trophies")} className="rounded-xl py-2.5 text-[11px] font-black">🏆 Trophy cabinet →</PressButton>
        </div>
      )}
    </div>
  );
}

/**
 * WHERE YOU ARE IN THE LEAGUE — Harry, 28 Sep 2026: League moves to the bottom
 * bar, "and then in the stats section keep league there". Your position and
 * points and the clubs either side of you, with the full table one tap away.
 * (Last 5 moved back to Home, under the next match.)
 */
function LeagueCard({ career, onLeague, glow }: { career: CareerState; onLeague?: () => void; glow: string }) {
  const table = sortLeague(career.league);
  const me = table.findIndex((t) => t.name === career.player.club);
  if (me < 0) return null;
  const from = Math.max(0, Math.min(me - 2, table.length - 5));
  const rows = table.slice(from, from + 5);
  const pos = me + 1;
  const suffix = pos % 10 === 1 && pos !== 11 ? "st" : pos % 10 === 2 && pos !== 12 ? "nd" : pos % 10 === 3 && pos !== 13 ? "rd" : "th";
  return (
    // The whole card opens the League screen (Harry, 1 Oct 2026, 07:40: "make
    // this League clickable, the whole thing").
    <div
      role={onLeague ? "button" : undefined}
      tabIndex={onLeague ? 0 : undefined}
      aria-label={onLeague ? "Open the league table" : undefined}
      onClick={onLeague}
      onKeyDown={onLeague ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onLeague(); } } : undefined}
      className={onLeague ? "kib-press cursor-pointer" : undefined}
    >
    <ClubCard glow={glow} className="mt-2 p-2.5">
      <div className="flex items-center justify-between">
        <CardTitle>🏆 {leagueNameFor(divisionOf(career))}</CardTitle>
        {onLeague && (
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white ring-1 ring-white/15">Full table →</span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="relative shrink-0 px-1 text-center">
          <div aria-hidden className="kib-glow-pulse absolute inset-0 rounded-full blur-lg" style={{ background: rgba(glow, 0.45) }} />
          <div className="relative bg-gradient-to-b from-yellow-200 to-amber-500 bg-clip-text text-[34px] font-black leading-none tabular-nums text-transparent" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.6))" }}>
            <PosCount value={pos} /><span className="text-[15px]">{suffix}</span>
          </div>
          <div className="relative mt-0.5 text-[10px] font-black tabular-nums text-white/80">{table[me].points} pts</div>
        </div>
        <div className="min-w-0 flex-1 space-y-[2px]">
          {rows.map((t, i) => {
            const n = from + i + 1, you = t.name === career.player.club;
            return (
              <div
                key={t.name}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-[3px] text-[11px] font-bold ${you ? "text-white" : "text-white/80"}`}
                style={you ? youRowStyle(glow) : undefined}
              >
                <span className="w-4 text-right tabular-nums text-white/55">{n}</span>
                <ClubBadge club={t.name} kit={kitsOf(t.name).home} size={14} />
                <span className="min-w-0 flex-1 truncate">{short(t.name)}</span>
                <span className="w-5 text-right tabular-nums text-white/55">{t.played}</span>
                <span className={`w-6 text-right font-black tabular-nums ${you ? "text-yellow-200" : "text-white"}`}>{t.points}</span>
              </div>
            );
          })}
        </div>
      </div>
    </ClubCard>
    </div>
  );
}

/** The league position counting to its new value. */
function PosCount({ value }: { value: number }) {
  return <>{Math.round(useCountUp(value, 700))}</>;
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

function Records({ career, glow }: { career: CareerState; glow: string }) {
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
