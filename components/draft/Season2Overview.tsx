"use client";
import { useState, useEffect, useMemo } from "react";
import { getPositionColor } from "./formations";
import type { DraftPlayer } from "@/app/draft/page";

interface DepartedPlayer {
  player: DraftPlayer;
  reason: string;
}

interface RatingChange {
  player: DraftPlayer;
  oldOverall: number;
  newOverall: number;
  change: number;
}

interface Props {
  departedPlayers: DepartedPlayer[];
  ratingChanges: RatingChange[];
  season2Players: DraftPlayer[];
  onContinue: (trainingPlayerName: string) => void;
}

export default function Season2Overview({
  departedPlayers,
  ratingChanges,
  season2Players,
  onContinue,
}: Props) {
  const [revealStep, setRevealStep] = useState(0);
  const [selectedTraining, setSelectedTraining] = useState<string | null>(null);

  const youngestTwo = useMemo(() => {
    const sorted = [...season2Players]
      .filter((p) => p.age > 0)
      .sort((a, b) => a.age - b.age);
    return sorted.slice(0, 2);
  }, [season2Players]);

  const totalRevealSteps = ratingChanges.length + departedPlayers.length + 1;

  useEffect(() => {
    if (revealStep < totalRevealSteps) {
      const timer = setTimeout(() => setRevealStep((s) => s + 1), 400);
      return () => clearTimeout(timer);
    }
  }, [revealStep, totalRevealSteps]);

  const allRevealed = revealStep >= totalRevealSteps;

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 mb-4">
          <span className="text-xs font-bold tracking-widest uppercase text-amber-400">
            Pre-Season
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight">
          <span className="text-white">SEASON</span>{" "}
          <span className="text-amber-400">2</span>
        </h1>
        <p className="text-gray-500 text-sm mt-1">Off-season changes to your squad</p>
      </div>

      {/* Departures */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-red-400 uppercase mb-3">
          Departures
        </h3>
        <div className="space-y-2">
          {departedPlayers.map((dp, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 bg-red-900/10 border border-red-800/30 rounded-lg px-4 py-3 transition-all duration-500 ${
                revealStep > i ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
              }`}
            >
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(dp.player.assignedPosition)} text-white`}>
                {dp.player.assignedPosition}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">{dp.player.name}</div>
                <div className="text-xs text-gray-500">{dp.player.clubYear} &middot; OVR {dp.player.overall}</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">
                  {dp.reason}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rating Changes */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
          Season Review &mdash; Rating Changes
        </h3>
        <div className="space-y-1">
          {ratingChanges.map((rc, i) => {
            const revealed = revealStep > i + departedPlayers.length;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm py-2 px-2 rounded-lg transition-all duration-500 ${
                  revealed ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                } ${
                  rc.change > 0
                    ? "bg-emerald-900/10"
                    : rc.change < 0
                      ? "bg-red-900/10"
                      : ""
                }`}
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(rc.player.assignedPosition)} text-white w-8 text-center`}>
                  {rc.player.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium">{rc.player.name}</span>
                <span className="text-gray-500 text-sm font-bold w-7 text-right">
                  {rc.oldOverall}
                </span>
                <span className="text-gray-600 mx-1">&rarr;</span>
                <span className={`text-sm font-black w-7 text-right ${
                  rc.change > 0 ? "text-emerald-400" :
                  rc.change < 0 ? "text-red-400" : "text-gray-400"
                }`}>
                  {rc.newOverall}
                </span>
                <span className={`text-xs font-bold w-8 text-right ${
                  rc.change > 0 ? "text-emerald-500" :
                  rc.change < 0 ? "text-red-500" : "text-gray-600"
                }`}>
                  {rc.change > 0 ? `+${rc.change}` : rc.change < 0 ? `${rc.change}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-800/50 text-[10px] text-gray-600">
          Based on season 1 avg ratings: 8.5+ = +3, 7.7+ = +2, 7.0+ = +1, &le;6.5 = -1
        </div>
      </div>

      {/* Off-Season Training */}
      {allRevealed && youngestTwo.length >= 2 && (
        <div className="bg-cyan-900/10 border border-cyan-700/30 rounded-xl p-4 mb-4 animate-[fadeIn_0.5s_ease-in]">
          <h3 className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-1">
            Off-Season Training
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Choose one of your youngest players for intensive training (+3 all attributes)
          </p>
          <div className="grid grid-cols-2 gap-3">
            {youngestTwo.map((p) => {
              const isSelected = selectedTraining === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => setSelectedTraining(p.name)}
                  className={`relative rounded-xl p-4 text-left transition-all duration-300 border-2 ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-900/30 shadow-lg shadow-cyan-900/30 scale-[1.02]"
                      : selectedTraining && !isSelected
                        ? "border-gray-800 bg-gray-900/50 opacity-50"
                        : "border-gray-700/50 bg-gray-900 hover:border-cyan-600/50 hover:bg-gray-800/80"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                    {p.assignedPosition}
                  </span>
                  <div className="mt-2">
                    <div className="font-bold text-sm">{p.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Age {p.age} &middot; OVR {p.overall}</div>
                  </div>
                  {isSelected && (
                    <div className="mt-2 text-xs font-bold text-cyan-400">
                      {p.overall} &rarr; {p.overall + 3} OVR
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Info about replacements */}
      <div className="bg-amber-900/10 border border-amber-700/30 rounded-xl p-4 mb-6 text-center">
        <p className="text-sm text-amber-300 font-medium">
          You need to sign <span className="font-black">2 replacement players</span> to fill your squad.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          New signings receive a random +1 to +3 boost on all attributes.
        </p>
      </div>

      {/* Continue button */}
      <button
        onClick={() => selectedTraining && onContinue(selectedTraining)}
        disabled={!allRevealed || !selectedTraining}
        className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-gray-700 disabled:to-gray-700 rounded-xl font-bold text-lg transition-all shadow-lg shadow-amber-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        Sign Replacements
      </button>
    </div>
  );
}
