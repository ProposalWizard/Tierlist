"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";

interface Props {
  career: CareerState;
}

export default function DashboardStats({ career }: Props) {
  const [tab, setTab] = useState<"stats" | "contract" | "status">("stats");

  const avgSeasonRating = career.seasonStats.ratingCount > 0
    ? career.seasonStats.totalRating / career.seasonStats.ratingCount
    : 0;
  const avgCareerRating = career.careerStats.ratingCount > 0
    ? career.careerStats.totalRating / career.careerStats.ratingCount
    : 0;

  return (
    <div className="mt-2">
      {/* Tab bar */}
      <div className="grid grid-cols-3 gap-1 mb-2">
        {(["stats", "contract", "status"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-1.5 rounded-t-lg font-black text-xs uppercase tracking-wider transition ${
              tab === t ? "bg-yellow-500 text-white" : "bg-gray-700 text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "stats" && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          <div className="grid grid-cols-3 gap-0 bg-gray-800 py-1.5 border-b border-black/50">
            <div className="font-black text-xs text-white text-center">Stats</div>
            <div className="font-black text-xs text-white text-center">Season</div>
            <div className="font-black text-xs text-white text-center">Career</div>
          </div>
          {[
            ["Appearances", career.seasonStats.appearances, career.careerStats.appearances],
            ["Goals", career.seasonStats.goals, career.careerStats.goals],
            ["Hat Tricks", career.seasonStats.hatTricks, career.careerStats.hatTricks],
            ["Passes", career.seasonStats.passes, career.careerStats.passes],
            ["Assists", career.seasonStats.assists, career.careerStats.assists],
            ["Star Man", career.seasonStats.starMan, career.careerStats.starMan],
            ["Average Rating", avgSeasonRating.toFixed(1), avgCareerRating.toFixed(1)],
          ].map(([label, s, c], i) => (
            <div key={String(label)} className={`grid grid-cols-3 py-1 ${i % 2 === 0 ? "bg-gray-700" : "bg-gray-800"}`}>
              <div className="font-bold text-xs text-white pl-3">{label}</div>
              <div className="font-black text-xs text-white text-center">{s}</div>
              <div className="font-black text-xs text-white text-center">{c}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "contract" && (
        <div className="bg-gray-700 rounded-lg overflow-hidden border border-gray-600 shadow-md">
          {[
            ["Club", career.contract.club],
            ["League", "Premier League"],
            ["Position", career.player.position],
            ["Wage", `★ ${career.contract.wage} / match`],
            ["Goal Bonus", `★ ${career.contract.goalBonus}`],
            ["Assist Bonus", `★ ${career.contract.assistBonus}`],
            ["Seasons Left", career.contract.seasonsRemaining],
          ].map(([label, val], i) => (
            <div key={String(label)} className={`flex items-center py-2 px-3 ${i % 2 === 0 ? "bg-gray-700" : "bg-gray-800"}`}>
              <div className="font-black text-xs text-white flex-1">{label}</div>
              <div className="font-black text-xs text-white">{val}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "status" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className={`py-2 rounded-lg font-black text-sm text-center ${career.status === "1st Team" ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"}`}>
              1st Team
            </div>
            <div className={`py-2 rounded-lg font-black text-sm text-center ${career.matchFitness >= 70 ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"}`}>
              Match Fit ({Math.round(career.matchFitness)}%)
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
            <div className="font-black text-xs text-white mb-1">NRG Drinks: {career.nrgDrinks}</div>
            <div className="text-[10px] text-gray-300">Restores energy before a match. Buy on the Life screen (coming soon).</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
            <div className="font-black text-xs text-white mb-1">Boots</div>
            <div className="text-[10px] text-gray-300">{career.bootsMatches} matches remaining. Basic boots (no bonus).</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
            <div className="font-black text-xs text-white mb-2">Skills</div>
            <div className="grid grid-cols-5 gap-1 text-center">
              {(["pace", "power", "technique", "vision", "freeKick"] as const).map((k) => (
                <div key={k}>
                  <div className="text-[9px] text-gray-400 uppercase font-bold">{k === "freeKick" ? "FK" : k.slice(0, 4)}</div>
                  <div className="text-sm font-black text-emerald-400">{career.skills[k]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
