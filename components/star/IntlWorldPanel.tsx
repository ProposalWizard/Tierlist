"use client";

/**
 * THE INTERNATIONAL PAGE (Stats → Country): your nation in the world the game
 * plays out (lib/star/intl) — the national manager's bar, the FIFA ranking,
 * your nation's group tables, its last and next matches, and every final
 * played since the game began (the "Who won" list).
 */
import { useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import {
  intlOf, managerLine, myGroups, myMatches, myRanking, topRanking, whoWon,
} from "@/lib/star/intl/career";
import { nationKits } from "@/lib/star/international";
import NationFlag from "./NationFlag";
import { ManagerBar } from "./CallUpScreen";
import { FlatPanel, RiseIn, glowOf } from "./ui";

const day = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A flat panel in the Home kit: full width, fades into the page (no floating card). */
function Box({ title, glow, index = 0, children }: { title: string; glow?: string; index?: number; children: React.ReactNode }) {
  return (
    <RiseIn index={index}>
      <FlatPanel bleed edge glow={glow} className="mt-2 px-4 py-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/80">{title}</div>
        {children}
      </FlatPanel>
    </RiseIn>
  );
}

export default function IntlWorldPanel({ career }: { career: CareerState }) {
  const data = useMemo(() => ({
    s: intlOf(career), line: managerLine(career), groups: myGroups(career, 2), matches: myMatches(career),
    rank: myRanking(career), top: topRanking(career, 10), won: whoWon(career),
  }), [career]);
  const [allWinners, setAllWinners] = useState(false);
  const { s, line, groups, matches, rank, top, won } = data;
  const nation = s.nation;
  const kit = nationKits(nation).home;
  const glow = glowOf(kit.shirt, kit.trim);
  return (
    <div data-intl-world>
      <Box title="International" glow={glow} index={0}>
        <div className="mb-3 flex items-center gap-3">
          <NationFlag nation={nation} width={44} rounded={3} />
          <div className="min-w-0">
            <div className="text-[24px] font-black uppercase leading-none">{nation}</div>
            <div className="mt-1 text-[12px] font-semibold text-white/80">FIFA ranking <span className="font-black text-amber-300">#{rank.rank}</span> · {rank.points} points</div>
          </div>
        </div>
        <ManagerBar value={s.manager} nation={nation} />
        <div className="mt-1.5 text-[13px] font-semibold text-white">{line}</div>
      </Box>

      <Box title="FIFA ranking · top 10" index={1}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {top.map((t, i) => (
            <div key={t.name} className="flex items-center gap-1.5 text-[12.5px] font-bold text-white">
              <span className="w-4 text-right text-white/70">{i + 1}</span><NationFlag nation={t.name} width={16} />
              <span className="truncate">{t.name}</span>
            </div>
          ))}
        </div>
      </Box>

      {groups.map((g) => (
        <Box key={g.title} title={g.title} index={2}>
          <div className="grid grid-cols-[1fr_repeat(5,1.6rem)] text-[10px] font-black text-white/70">
            <span /> <span className="text-center">P</span><span className="text-center">W</span><span className="text-center">D</span><span className="text-center">GD</span><span className="text-center">Pts</span>
          </div>
          {g.rows.map((r, i) => (
            <div key={r.name} className={`grid grid-cols-[1fr_repeat(5,1.6rem)] items-center py-0.5 text-[13px] font-bold ${r.name === nation ? "text-amber-300" : "text-white"}`}>
              <span className="flex min-w-0 items-center gap-1.5"><span className="w-3 text-white/60">{i + 1}</span><NationFlag nation={r.name} width={16} /><span className="truncate">{r.name}</span></span>
              <span className="text-center">{r.p}</span><span className="text-center">{r.w}</span><span className="text-center">{r.d}</span>
              <span className="text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</span><span className="text-center">{r.pts}</span>
            </div>
          ))}
        </Box>
      ))}

      <Box title={`${nation}'s matches`} index={3}>
        {matches.next.length + matches.last.length === 0 && (
          <div className="text-[12.5px] font-semibold text-white/80">None yet. {nation}'s matches show here once the first squad of the season is named.</div>
        )}
        {[...matches.next.map((m) => ({ ...m, upcoming: true })), ...matches.last.map((m) => ({ ...m, upcoming: false }))].map((m, i) => (
          <div key={i} className="border-t border-white/5 py-1 first:border-t-0">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[13.5px] font-bold text-white">
              <span className="flex min-w-0 items-center justify-end gap-1.5"><span className="truncate">{m.home}</span><NationFlag nation={m.home} width={16} /></span>
              <span className={m.upcoming ? "text-white/60" : "text-amber-300"}>{m.upcoming ? "v" : `${m.hs}–${m.as}`}</span>
              <span className="flex min-w-0 items-center gap-1.5"><NationFlag nation={m.away} width={16} /><span className="truncate">{m.away}</span></span>
            </div>
            <div className="text-center text-[11px] font-semibold text-white/75">{day(m.date)} · {m.comp} · {m.stage}{m.pens ? ` · ${m.pens}` : ""}{m.upcoming ? " · to come" : ""}</div>
          </div>
        ))}
      </Box>

      <Box title="Who won" index={4}>
        {won.length === 0 ? (
          <div className="text-[11px] font-bold text-white/75">No finals yet. The first are the Asian Cup (5 Feb 2027) and the CONCACAF and UEFA Nations Leagues.</div>
        ) : (
          <>
            {(allWinners ? won : won.slice(0, 8)).map((f, i) => (
              <div key={i} className={`flex items-center gap-1.5 border-t border-white/5 py-1 text-[13px] font-bold first:border-t-0 ${f.winner === nation || f.runnerUp === nation ? "text-amber-300" : "text-white"}`}>
                <span className="w-9 text-white/70">{f.year}</span>
                <span className="min-w-0 flex-1 truncate">{f.comp}</span>
                <NationFlag nation={f.winner} width={16} /><span className="max-w-[6.5rem] truncate font-black">{f.winner}</span>
                <span className="text-white/70">{f.score}</span>
                <span className="max-w-[5.5rem] truncate text-white/75">{f.runnerUp}</span>
              </div>
            ))}
            {won.length > 8 && (
              <button onClick={() => setAllWinners(!allWinners)} className="mt-1 text-[11px] font-black text-sky-300">
                {allWinners ? "Show fewer" : `Show all ${won.length}`}
              </button>
            )}
          </>
        )}
      </Box>
    </div>
  );
}
