"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { selectionFor } from "@/lib/star/selection";
import { setPieceDuties } from "@/lib/star/setPieces";
import { expectationStatus, personalDuty } from "@/lib/star/expectations";

interface Props {
  career: CareerState;
}

export default function DashboardStats({ career }: Props) {
  const [tab, setTab] = useState<"stats" | "contract" | "status">("stats");
  const selection = selectionFor(career);
  const duties = setPieceDuties(career, selection.status);
  const { pos, exp, onTrack } = expectationStatus(career);
  const duty = personalDuty(career);

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
          {/* Derived, not read off the stored field: an old save was stamped
              "1st Team" when the career was created and never updated. */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`py-2 rounded-lg font-black text-sm text-center ${
              selection.status === "1st Team" ? "bg-emerald-500 text-white"
                : selection.status === "Substitute" ? "bg-amber-500 text-gray-950" : "bg-red-600 text-white"}`}
            >
              {selection.status}
            </div>
            <div className={`py-2 rounded-lg font-black text-sm text-center ${career.matchFitness >= 70 ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"}`}>
              Match Fit ({Math.round(career.matchFitness)}%)
            </div>
          </div>
          {/* What the board actually wants. Finishing sixth used to be worth
              the same at every club in the division. */}
          <div className={`rounded-lg p-3 border ${onTrack ? "border-emerald-600 bg-emerald-600/15" : "border-amber-500 bg-amber-500/10"}`}>
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-white">Board expectation</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${onTrack ? "text-emerald-300" : "text-amber-200"}`}>
                {exp.ambition}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-gray-200">{exp.summary}</div>
            <div className="mt-1 text-[10px] text-white">
              {pos}{pos === 1 ? "st" : pos === 2 ? "nd" : pos === 3 ? "rd" : "th"} of {career.league.length}
              {" · "}target {exp.targetPosition}{exp.targetPosition === 1 ? "st" : exp.targetPosition === 2 ? "nd" : exp.targetPosition === 3 ? "rd" : "th"} or better
            </div>
            <div className="mt-1 text-[10px] text-gray-200">
              <span className="font-black text-white">{duty.duty}.</span> {duty.summary} Target {duty.goalTarget} goals — you have {career.seasonStats.goals}.
            </div>
          </div>

          {career.lastSeasonJudgement && (
            <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
              <div className="font-black text-xs text-white mb-0.5">Last season</div>
              <div className={`text-[11px] font-bold ${career.lastSeasonJudgement.score >= 0 ? "text-emerald-300" : "text-amber-200"}`}>
                {career.lastSeasonJudgement.headline}
              </div>
              <div className="text-[10px] text-gray-200">{career.lastSeasonJudgement.detail}</div>
            </div>
          )}

          <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
            <div className="font-black text-xs text-white mb-1">The manager</div>
            <div className="text-[10px] text-gray-300">{selection.reason}</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-black/30 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  selection.standing >= 55 ? "bg-emerald-400" : selection.standing >= 34 ? "bg-amber-400" : "bg-red-500"}`}
                style={{ width: `${Math.max(3, selection.standing)}%` }}
              />
            </div>
            <div className="mt-1 flex gap-1.5 text-[10px] font-bold">
              <span className={`px-2 py-0.5 rounded-full ${duties.freeKicks ? "bg-emerald-500/25 text-emerald-200" : "bg-black/30 text-gray-300"}`}>
                Free kicks {duties.freeKicks ? "✓" : `need FK ${duties.freeKickNeeded}`}
              </span>
              <span className={`px-2 py-0.5 rounded-full ${duties.penalties ? "bg-emerald-500/25 text-emerald-200" : "bg-black/30 text-gray-300"}`}>
                Penalties {duties.penalties ? "✓" : `need FK ${duties.penaltyNeeded}`}
              </span>
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
            <div className="font-black text-xs text-white mb-1">NRG Drinks: {career.nrgDrinks.basic + career.nrgDrinks.premium + career.nrgDrinks.elite}</div>
            <div className="text-[10px] text-gray-300">Restores energy before a match. Manage on the Life screen.</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3 border border-gray-600">
            <div className="font-black text-xs text-white mb-1">Boots — {career.currentBoot.name}</div>
            <div className="text-[10px] text-gray-300">
              {career.currentBoot.matches} matches remaining · Pace +{career.currentBoot.pace} · Pow +{career.currentBoot.power} · Tec +{career.currentBoot.technique}
            </div>
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
