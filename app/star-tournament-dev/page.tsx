"use client";

/**
 * TOURNAMENT TEST PAGE — draw and play a whole Euros or World Cup in seconds.
 *
 * Leo, 12 Oct 2026: "an area where everything new can be … tested and
 * simulated easily (like tournaments etc)". Every result here comes from the
 * real tournament code (lib/star/tournament.ts: the real field, draw, group
 * matches and knockouts with extra time and penalties). It reads and writes
 * nothing but this screen.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import PageGuide from "@/components/admin/PageGuide";
import {
  tournamentField, drawGroups, playMatchday, finishTournament, groupTable, tournamentStrength,
  type TournamentCompetition, type TournamentState,
} from "@/lib/star/tournament";
import { mulberry32 } from "@/lib/star/season";
import { clubNameSeed } from "@/lib/star/squadData";

function fresh(competition: TournamentCompetition, season: number, nation: string): TournamentState {
  const field = tournamentField(competition, season, nation);
  const groups = drawGroups(field, mulberry32(clubNameSeed(`groups|${competition}|${season}`)));
  const strengths: Record<string, number> = {};
  for (const n of field) strengths[n] = tournamentStrength(n);
  const entered = field.includes(nation);
  return { season, competition, nation, entered, selected: entered, chance: entered ? 1 : 0, strengths, groups, matchday: 0, ko: [] };
}

export default function TournamentDev() {
  const [competition, setCompetition] = useState<TournamentCompetition>("European Championship");
  const [nation, setNation] = useState("England");
  const [seed, setSeed] = useState(2);
  const start = useMemo(() => fresh(competition, seed * 2, nation), [competition, seed, nation]);
  const [state, setState] = useState<TournamentState | null>(null);
  const s = state && state.competition === competition && state.season === seed * 2 && state.nation === nation ? state : start;
  const rng = () => mulberry32(clubNameSeed(`dev|${competition}|${seed}|${s.matchday}|${s.ko.length}`));
  const btn = "border-2 border-white/30 px-3 py-2 text-[12px] font-black uppercase text-white";

  return (
    <main className="min-h-screen bg-[#0b100e] px-4 pb-16 pt-4 text-white" data-tournament-dev>
      <PageGuide page="/star-tournament-dev" />
      <div className="flex items-center justify-between">
        <Link href="/star-play-dev" className="text-[13px] font-bold text-emerald-300">‹ Play Area</Link>
        <h1 className="text-lg font-black">Tournament test</h1>
      </div>
      <p className="mt-1 text-[12px] font-bold text-white/80">The real tournament code: draw, groups, knockouts with extra time and penalties. Nothing is saved.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select className="bg-gray-900 px-2 py-2 text-[13px] font-bold" value={competition} onChange={e => { setCompetition(e.target.value as TournamentCompetition); setState(null); }}>
          <option>European Championship</option><option>World Cup</option>
        </select>
        <input className="w-32 bg-gray-900 px-2 py-2 text-[13px] font-bold" value={nation} onChange={e => { setNation(e.target.value); setState(null); }} aria-label="Your nation" />
        <button className={btn} onClick={() => { setSeed(x => x + 1); setState(null); }}>New draw</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className={btn} disabled={s.matchday >= 3} onClick={() => setState(playMatchday(s, s.matchday + 1, rng()))}>Play matchday {Math.min(3, s.matchday + 1)}</button>
        <button className="border-2 border-amber-300 bg-amber-400 px-3 py-2 text-[12px] font-black uppercase text-gray-950" onClick={() => setState(finishTournament(s, rng()))}>Play to the final</button>
        <button className={btn} onClick={() => setState(null)}>Reset</button>
      </div>
      {!s.entered && <p className="mt-2 text-[12px] font-bold text-red-300">{nation} did not qualify for this one.</p>}
      {s.winner && <p className="mt-3 text-xl font-black text-amber-300" data-winner>🏆 {s.winner} win the {competition}</p>}
      <h2 className="mt-4 text-[13px] font-black uppercase tracking-wider text-emerald-300">Groups (after matchday {s.matchday})</h2>
      <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {s.groups.map(g => (
          <table key={g.name} className="w-full text-[12px]">
            <thead><tr className="text-white/70"><th className="text-left">Group {g.name}</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
            <tbody>{groupTable(g).map((r, i) => (
              <tr key={r.name} className={r.name === nation ? "font-black text-amber-300" : i < 2 ? "text-emerald-200" : ""}>
                <td>{r.name}</td><td className="text-center">{r.p}</td><td className="text-center">{r.gf - r.ga}</td><td className="text-center">{r.pts}</td>
              </tr>))}</tbody>
          </table>
        ))}
      </div>
      {s.ko.map(round => (
        <div key={round.name} className="mt-4">
          <h2 className="text-[13px] font-black uppercase tracking-wider text-emerald-300">{round.name}</h2>
          {round.ties.map((t, i) => (
            <p key={i} className={`text-[13px] font-bold ${t.home === nation || t.away === nation ? "text-amber-300" : ""}`}>
              {t.home} {t.hs ?? "–"}–{t.as ?? "–"} {t.away}
              {t.wentToExtraTime ? " (a.e.t.)" : ""}{t.pens ? ` · pens ${t.pens.home}–${t.pens.away}` : ""}
            </p>
          ))}
        </div>
      ))}
    </main>
  );
}
