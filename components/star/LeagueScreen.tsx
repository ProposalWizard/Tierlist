"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { sortLeague } from "@/lib/star/season";

interface Props {
  career: CareerState;
}

export default function LeagueScreen({ career }: Props) {
  const [view, setView] = useState<"table" | "fixtures">("table");
  const sorted = sortLeague(career.league);

  return (
    <div className="mt-2">
      <div className="grid grid-cols-2 gap-1 mb-2">
        {(["table", "fixtures"] as const).map((v) => (
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
    </div>
  );
}
