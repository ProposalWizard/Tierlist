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
import { Form } from "./HomeHub";

type Tab = "season" | "all" | "records";
const short = (club: string) => CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
const seasonLabel = (c: CareerState, s: number) => {
  const y = c.player.startYear + s - 1;
  return `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
};

export default function StatsTabs({ career, onRenew, onOpen }: { career: CareerState; onRenew: () => void; onOpen?: (ph: "achievements" | "trophies") => void }) {
  const [tab, setTab] = useState<Tab>("season");
  return (
    <div className="pb-2">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/30 p-1">
        {([["season", "Season"], ["all", "All seasons"], ["records", "Records"]] as [Tab, string][]).map(([t, l]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-1.5 text-[11px] font-black transition ${tab === t ? "bg-yellow-500 text-gray-950" : "text-white/75"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "season" && (
        <div className="space-y-2">
          <DashboardStats career={career} onRenew={onRenew} />
          <Form career={career} />
        </div>
      )}
      {tab === "all" && <AllSeasons career={career} />}
      {tab === "records" && <Records career={career} />}
      {tab === "records" && onOpen && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => onOpen("achievements")} className="rounded-xl border border-white/10 bg-gray-800/80 py-2 text-[11px] font-black text-white">⭐ Achievements →</button>
          <button onClick={() => onOpen("trophies")} className="rounded-xl border border-white/10 bg-gray-800/80 py-2 text-[11px] font-black text-white">🏆 Trophy cabinet →</button>
        </div>
      )}
    </div>
  );
}

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-gray-800/80 p-2.5">
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/70">{title}</div>
      {children}
      {note && <div className="mt-1.5 text-[10px] font-bold text-white/45">{note}</div>}
    </div>
  );
}

function Big({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-black/25 px-1 py-1.5 text-center">
      <div className="text-[18px] font-black leading-tight tabular-nums text-white">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-wider text-white/60">{label}</div>
    </div>
  );
}

function AllSeasons({ career }: { career: CareerState }) {
  const c = career.careerStats;
  const avg = c.ratingCount > 0 ? (c.totalRating / c.ratingCount).toFixed(2) : "—";
  const clubs = perClubTotals(career);
  const seasons = allSeasons(career);
  const noHistory = !(career.seasonArchive?.length);
  return (
    <>
      <Card title="Career totals">
        <div className="grid grid-cols-5 gap-1">
          <Big label="Apps" value={c.appearances} />
          <Big label="Goals" value={c.goals} />
          <Big label="Assists" value={c.assists} />
          <Big label="Avg" value={avg} />
          <Big label="MOTM" value={c.starMan} />
        </div>
      </Card>
      <Card title="Per club" note={noHistory ? "Club and season history starts counting from this season." : undefined}>
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
      <Card title="Season by season">
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
      <span className="w-6 text-center text-[16px]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-black text-white">{label}</div>
        {sub && <div className="truncate text-[10px] font-bold text-white/50">{sub}</div>}
      </div>
      <div className="shrink-0 text-[15px] font-black tabular-nums text-yellow-200">{value}</div>
    </div>
  );
}

function Records({ career }: { career: CareerState }) {
  const b = career.careerBests ?? {};
  const s = (n: number) => `Season ${seasonLabel(career, n)}`;
  const potmWon = (career.potm ?? []).filter((m) => m.isYou);
  const troph = trophiesByCompetition(career);
  const fresh = !career.careerBests;
  return (
    <>
      <Card title="Your bests" note={fresh ? "Furthest goal/assist and match bests start counting from now on this save." : undefined}>
        <Row icon="🚀" label="Furthest goal" value={b.furthestGoal ? `${b.furthestGoal.metres} m` : "—"} sub={b.furthestGoal ? `v ${short(b.furthestGoal.opponent)} · ${s(b.furthestGoal.season)}` : undefined} />
        <Row icon="🎯" label="Furthest assist (your pass)" value={b.furthestAssist ? `${b.furthestAssist.metres} m` : "—"} sub={b.furthestAssist ? `v ${short(b.furthestAssist.opponent)} · ${s(b.furthestAssist.season)}` : undefined} />
        <Row icon="⚽" label="Most goals in a game" value={b.mostGoalsMatch ? String(b.mostGoalsMatch.goals) : "—"} sub={b.mostGoalsMatch ? `v ${short(b.mostGoalsMatch.opponent)} · ${s(b.mostGoalsMatch.season)}` : undefined} />
        <Row icon="📈" label="Most goals in a season" value={b.mostGoalsSeason ? String(b.mostGoalsSeason.goals) : "—"} sub={b.mostGoalsSeason ? s(b.mostGoalsSeason.season) : undefined} />
        <Row icon="🅰️" label="Most assists in a season" value={b.mostAssistsSeason ? String(b.mostAssistsSeason.assists) : "—"} sub={b.mostAssistsSeason ? s(b.mostAssistsSeason.season) : undefined} />
      </Card>
      <Card title="Awards">
        <Row icon="⭐" label="Man of the match" value={String(career.careerStats.starMan)} sub="Star Man — rating 8.5+ or two goals" />
        <Row icon="📅" label="Player of the Month" value={String(potmWon.length)} sub={potmWon.slice(-2).map((m) => `${m.monthName} ${seasonLabel(career, m.season)}`).join(" · ") || undefined} />
        <Row icon="🏅" label="Ballon d'Or" value={String(career.ballonDorWins)} />
      </Card>
      <Card title={`Trophies · ${career.trophies.length}`}>
        {troph.length === 0 ? (
          <div className="text-[11px] font-bold text-white/50">None yet.</div>
        ) : troph.map((t) => (
          <Row key={t.competition} icon="🏆" label={t.competition} value={`×${t.seasons.length}`} sub={t.seasons.map((n) => seasonLabel(career, n)).join(" · ")} />
        ))}
      </Card>
      <Card title="Premier League records">
        {RECORDS.map((r) => {
          const p = r.progress(career);
          const pct = Math.min(100, Math.round((p / r.value) * 100));
          return (
            <div key={r.id} className="border-t border-white/5 py-1.5 first:border-t-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] font-black text-white">{r.label.replace("Premier League", "PL")}</span>
                <span className="shrink-0 text-[11px] font-black tabular-nums text-white/80">{p} / {r.value}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40">
                <div className={`h-full rounded-full ${p >= r.value ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.max(3, pct)}%` }} />
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}
