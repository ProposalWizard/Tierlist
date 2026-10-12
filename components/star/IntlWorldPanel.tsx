"use client";

/**
 * THE INTERNATIONAL PAGE (Stats → Country): your nation in the world the game
 * plays out (lib/star/intl) — the national manager, the FIFA ranking, your
 * nation's group tables, its last and next matches, and every final played
 * since the game began (the "Who won" list).
 *
 * Built from the League and Training screens' pieces (IntlKit.tsx; Mikey,
 * 12 Oct 2026): glass cards, League-table rows, the results rows, the stat
 * card, a tab strip.
 */
import { useMemo, useState } from "react";
import type React from "react";
import type { CareerState } from "@/lib/star/types";
import {
  intlOf, managerLine, myGroups, myMatches, myRanking, topRanking, whoWon,
} from "@/lib/star/intl/career";
import NationFlag from "./NationFlag";
import { ClubCard, RiseIn } from "./ui";
import { SegTabs, CardTitle, youRowStyle } from "./screenKit";
import { ManagerCard, NationTable, MatchRow, nationGlow } from "./IntlKit";

const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Card({ title, right, glow, children }: { title: string; right?: React.ReactNode; glow: string; children: React.ReactNode }) {
  return (
    <ClubCard glow={glow} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-2.5 py-1.5">
        <CardTitle tone="text-amber-300">{title}</CardTitle>
        {right}
      </div>
      <div className="p-1.5">{children}</div>
    </ClubCard>
  );
}

export default function IntlWorldPanel({ career }: { career: CareerState }) {
  const data = useMemo(() => ({
    s: intlOf(career), line: managerLine(career), groups: myGroups(career, 2), matches: myMatches(career),
    rank: myRanking(career), top: topRanking(career, 10), won: whoWon(career),
  }), [career]);
  const [tab, setTab] = useState<"overview" | "matches" | "ranking" | "winners">("overview");
  const [allWinners, setAllWinners] = useState(false);
  const { s, line, groups, matches, rank, top, won } = data;
  const nation = s.nation;
  const glow = nationGlow(nation);
  return (
    <div data-intl-world className="space-y-2">
      <RiseIn index={0}>
        <ClubCard glow={glow} strength={0.45} className="flex items-center gap-3 p-3">
          <NationFlag nation={nation} width={52} rounded={4} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[24px] font-black uppercase leading-none text-white">{nation}</div>
            <div className="mt-1 text-[12px] font-bold text-white/85">FIFA ranking <span className="font-black text-amber-300">#{rank.rank}</span> · {rank.points.toLocaleString("en-GB")} pts</div>
          </div>
          <div className="shrink-0 text-center">
            <div className="text-[22px] font-black leading-none text-white tabular-nums">{career.caps ?? 0}</div>
            <div className="text-[9.5px] font-black uppercase tracking-wide text-white/75">caps</div>
            <div className="mt-1 text-[13px] font-black leading-none text-emerald-300 tabular-nums">{career.internationalGoals ?? 0}</div>
            <div className="text-[9.5px] font-black uppercase tracking-wide text-white/75">goals</div>
          </div>
        </ClubCard>
      </RiseIn>
      <RiseIn index={1}><ManagerCard value={s.manager} nation={nation} line={line} /></RiseIn>
      <SegTabs value={tab} onChange={setTab} tabs={[["overview", "Tables"], ["matches", "Matches"], ["ranking", "Ranking"], ["winners", "Who won"]] as const} />

      {tab === "overview" && (
        <RiseIn key="o" className="space-y-2">
          {groups.length ? groups.map((g) => (
            <NationTable key={g.title} group={{ ...g, rows: g.rows.map((r) => ({ ...r })) }} nation={nation} glow={glow} through={1} />
          )) : (
            <ClubCard glow={glow} className="p-3 text-[12px] font-bold text-white">No group games yet. {nation}&apos;s first is in the September–October break.</ClubCard>
          )}
        </RiseIn>
      )}

      {tab === "matches" && (
        <RiseIn key="m" className="space-y-2">
          <Card title="Next" glow={glow}>
            {matches.next.length ? matches.next.map((m, i) => (
              <div key={i}>
                <div className="px-1 pb-0.5 pt-1 text-[9.5px] font-bold text-white/75">{day(m.date)} · {m.comp} · {m.stage}</div>
                <MatchRow m={m} glow={glow} nation={nation} />
              </div>
            )) : <div className="p-1.5 text-[11.5px] font-bold text-white/85">Not drawn yet.</div>}
          </Card>
          <Card title="Last results" glow={glow}>
            {matches.last.length ? matches.last.map((m, i) => (
              <div key={i}>
                <div className="px-1 pb-0.5 pt-1 text-[9.5px] font-bold text-white/75">{day(m.date)} · {m.comp} · {m.stage}</div>
                <MatchRow m={m} glow={glow} nation={nation} />
              </div>
            )) : <div className="p-1.5 text-[11.5px] font-bold text-white/85">None played yet.</div>}
          </Card>
        </RiseIn>
      )}

      {tab === "ranking" && (
        <RiseIn key="r">
          <Card title="FIFA ranking · top 10" glow={glow} right={<span className="text-[10px] font-black text-white/80">{nation} #{rank.rank}</span>}>
            {top.map((t, i) => {
              const you = t.name === nation;
              return (
                <div key={t.name} className={`grid grid-cols-[24px_1fr_auto] items-center gap-1.5 rounded-md px-1.5 py-1.5 text-[11.5px] font-bold text-white ${you ? "" : i % 2 === 0 ? "bg-white/[0.035]" : ""}`} style={you ? youRowStyle(glow) : undefined}>
                  <span className="text-center font-black">{i + 1}</span>
                  <span className="flex min-w-0 items-center gap-1.5"><NationFlag nation={t.name} width={18} rounded={2} /><span className="truncate">{t.name}</span></span>
                  <span className="font-black tabular-nums text-white/85">{t.points.toLocaleString("en-GB")}</span>
                </div>
              );
            })}
          </Card>
        </RiseIn>
      )}

      {tab === "winners" && (
        <RiseIn key="w">
          <Card title={`Who won · ${won.length} finals`} glow={glow}>
            {won.length === 0 ? (
              <div className="p-1.5 text-[11.5px] font-bold text-white/85">No finals yet. The first are the Asian Cup (5 Feb 2027) and the CONCACAF and UEFA Nations Leagues.</div>
            ) : (
              <>
                {(allWinners ? won : won.slice(0, 10)).map((f, i) => {
                  const mine = f.winner === nation || f.runnerUp === nation;
                  return (
                    <div key={i} className={`rounded-md px-1.5 py-1.5 text-[11px] font-bold text-white ${mine ? "" : i % 2 === 0 ? "bg-white/[0.035]" : ""}`} style={mine ? youRowStyle(glow) : undefined}>
                      <div className="flex items-center justify-between text-[9.5px] font-black uppercase tracking-wide text-amber-300"><span>{f.comp}</span><span>{f.year}</span></div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span>🏆</span><NationFlag nation={f.winner} width={18} rounded={2} />
                        <span className="min-w-0 flex-1 truncate font-black">{f.winner}</span>
                        <span className="shrink-0 tabular-nums text-white/85">{f.score}</span>
                        <span className="max-w-[6rem] truncate text-white/75">{f.runnerUp}</span>
                      </div>
                    </div>
                  );
                })}
                {won.length > 10 && (
                  <button onClick={() => setAllWinners(!allWinners)} className="kib-press mt-1 w-full rounded-lg bg-white/10 py-1 text-[10.5px] font-black uppercase text-white">
                    {allWinners ? "Show fewer" : `Show all ${won.length}`}
                  </button>
                )}
              </>
            )}
          </Card>
        </RiseIn>
      )}
    </div>
  );
}
