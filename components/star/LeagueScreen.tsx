"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { sortLeague } from "@/lib/star/season";

interface Props {
  career: CareerState;
}

export default function LeagueScreen({ career }: Props) {
  const [view, setView] = useState<"table" | "fixtures" | "squad">("table");
  const sorted = sortLeague(career.league);
  const squad = career.squad ?? [];

  return (
    <div className="mt-2">
      <div className="grid grid-cols-3 gap-1 mb-2">
        {(["table", "fixtures", "squad"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`py-1.5 rounded-t-lg font-black text-xs uppercase transition ${view === v ? "bg-yellow-500 text-white" : "bg-gray-700 text-gray-300"}`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "table" && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          <div className="grid grid-cols-[24px_1fr_28px_28px_28px_28px_32px] text-[10px] font-black text-white bg-gray-800 py-1.5 px-2 border-b border-black/50 gap-1">
            <div className="text-center">#</div>
            <div>Name</div>
            <div className="text-center">P</div>
            <div className="text-center">W</div>
            <div className="text-center">D</div>
            <div className="text-center">L</div>
            <div className="text-center">Pts</div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {sorted.map((t, i) => (
              <div
                key={t.name}
                className={`grid grid-cols-[24px_1fr_28px_28px_28px_28px_32px] text-[10px] font-bold py-1.5 px-2 gap-1 items-center border-b border-black/20 ${
                  t.name === career.player.club ? "bg-emerald-600 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
                }`}
              >
                <div className="text-center font-black">{i + 1}</div>
                <div className="truncate">{t.name}</div>
                <div className="text-center">{t.played}</div>
                <div className="text-center">{t.won}</div>
                <div className="text-center">{t.drawn}</div>
                <div className="text-center">{t.lost}</div>
                <div className="text-center font-black">{t.points}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "fixtures" && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md max-h-[460px] overflow-y-auto">
          {career.fixtures.map((f, i) => (
            <div
              key={i}
              className={`grid grid-cols-[36px_1fr_32px_32px_1fr] items-center py-2 px-2 gap-1 text-xs font-bold ${
                f.week === career.week ? "bg-emerald-500 text-white" : i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
              }`}
            >
              <div className="text-center text-[10px] font-black">W{f.week}</div>
              <div className={`text-right ${f.home ? "font-black" : ""}`}>{f.home ? career.player.club : f.opponent}</div>
              <div className="text-center font-black">
                {f.played ? f.homeScore : "-"}
              </div>
              <div className="text-center font-black">
                {f.played ? f.awayScore : "-"}
              </div>
              <div className={`text-left ${!f.home ? "font-black" : ""}`}>{f.home ? f.opponent : career.player.club}</div>
            </div>
          ))}
        </div>
      )}

      {view === "squad" && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          {/* Header */}
          <div className="grid grid-cols-[1fr_36px_26px_26px] text-[10px] font-black text-white bg-gray-800 py-1.5 px-2 border-b border-black/50 gap-1">
            <div>Name</div>
            <div className="text-center">Pos</div>
            <div className="text-center text-yellow-300">G</div>
            <div className="text-center text-blue-300">A</div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {/* User row first — reads from seasonStats */}
            <div className="grid grid-cols-[1fr_36px_26px_26px] text-[10px] font-bold py-1.5 px-2 gap-1 items-center border-b border-black/20 bg-emerald-700 text-white">
              <div className="truncate font-black">{career.player.firstName} {career.player.lastName} ★</div>
              <div className="text-center text-emerald-200">{career.player.position}</div>
              <div className="text-center font-black text-yellow-300">{career.seasonStats.goals}</div>
              <div className="text-center font-black text-blue-300">{career.seasonStats.assists}</div>
            </div>
            {/* Squad sorted by goals+assists descending */}
            {[...squad]
              .sort((a, b) => (b.seasonGoals + b.seasonAssists) - (a.seasonGoals + a.seasonAssists))
              .map((p, i) => (
                <div
                  key={p.id}
                  className={`grid grid-cols-[1fr_36px_26px_26px] text-[10px] font-bold py-1.5 px-2 gap-1 items-center border-b border-black/20 ${
                    i % 2 === 0 ? "bg-gray-700 text-white" : "bg-gray-800 text-white"
                  }`}
                >
                  <div className="truncate">{p.name}</div>
                  <div className="text-center text-gray-400">{p.position}</div>
                  <div className="text-center">
                    {p.seasonGoals > 0
                      ? <span className="text-yellow-300 font-black">{p.seasonGoals}</span>
                      : <span className="text-gray-600">0</span>}
                  </div>
                  <div className="text-center">
                    {p.seasonAssists > 0
                      ? <span className="text-blue-300 font-black">{p.seasonAssists}</span>
                      : <span className="text-gray-600">0</span>}
                  </div>
                </div>
              ))}
          </div>
          {/* Career totals footer for top scorers */}
          {squad.some(p => p.careerGoals > 0 || p.careerAssists > 0) && (
            <div className="bg-gray-800 border-t border-black/30 px-2 py-1.5">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Career Top Scorers</div>
              {[...squad]
                .sort((a, b) => (b.careerGoals + b.careerAssists) - (a.careerGoals + a.careerAssists))
                .slice(0, 3)
                .filter(p => p.careerGoals > 0 || p.careerAssists > 0)
                .map(p => (
                  <div key={p.id} className="flex items-center gap-1 text-[9px] text-gray-300 mb-0.5">
                    <span className="font-black text-white truncate flex-1">{p.shortName}</span>
                    <span className="text-yellow-400 font-black">{p.careerGoals}G</span>
                    <span className="text-blue-400 font-black">{p.careerAssists}A</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
