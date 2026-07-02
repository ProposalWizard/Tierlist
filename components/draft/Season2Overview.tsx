"use client";
import { useState, useEffect, useMemo } from "react";
import { getPositionColor } from "./formations";
import { computeTeamStrength } from "@/lib/seasonSimulator";
import type { DraftPlayer } from "@/app/draft/page";

interface DepartedPlayer {
  player: DraftPlayer;
  reason: string;
  convinceable?: boolean;
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
  onContinue: (trainingPlayerName: string, retainedPlayer?: DraftPlayer) => void;
  seasonNumber?: number;
  previousFinish?: number;
}

export default function Season2Overview({
  departedPlayers,
  ratingChanges,
  season2Players,
  onContinue,
  seasonNumber = 2,
  previousFinish,
}: Props) {
  const [revealStep, setRevealStep] = useState(0);
  const [selectedTraining, setSelectedTraining] = useState<string | null>(null);
  const [convinceAttempted, setConvinceAttempted] = useState(false);
  const [convinceSuccess, setConvinceSuccess] = useState(false);

  const convinceableIdx = useMemo(
    () => departedPlayers.findIndex(dp => dp.convinceable),
    [departedPlayers],
  );
  const convinceablePlayer = convinceableIdx >= 0 ? departedPlayers[convinceableIdx] : null;

  const handleConvince = () => {
    if (convinceAttempted) return;
    const success = Math.random() < 0.5;
    setConvinceAttempted(true);
    setConvinceSuccess(success);
  };

  const youngestTwo = useMemo(() => {
    const sorted = [...season2Players]
      .filter((p) => p.age > 0)
      .sort((a, b) => a.age - b.age);
    return sorted.slice(0, 2);
  }, [season2Players]);

  const upgradeablePlayers = youngestTwo.filter((p) => p.overall < 100);
  const allMaxed = youngestTwo.length >= 2 && upgradeablePlayers.length === 0;

  const totalRevealSteps = ratingChanges.length + departedPlayers.length + 1;

  useEffect(() => {
    if (revealStep < totalRevealSteps) {
      const timer = setTimeout(() => setRevealStep((s) => s + 1), 400);
      return () => clearTimeout(timer);
    }
  }, [revealStep, totalRevealSteps]);

  const allRevealed = revealStep >= totalRevealSteps;

  // Auto-select if only one player is upgradeable
  useEffect(() => {
    if (allRevealed && upgradeablePlayers.length === 1 && !selectedTraining) {
      setSelectedTraining(upgradeablePlayers[0].name);
    }
  }, [allRevealed, upgradeablePlayers, selectedTraining]);

  // Auto-continue whenever no player can be trained. This covers both maxed
  // squads AND the case where fewer than 2 players have known age (age is 0 for
  // older FIFA imports) — otherwise `selectedTraining` can never be set and the
  // Continue button stays permanently disabled, soft-locking the pre-season.
  useEffect(() => {
    if (allRevealed && upgradeablePlayers.length === 0) {
      const timer = setTimeout(() => onContinue(""), 1500);
      return () => clearTimeout(timer);
    }
  }, [allRevealed, upgradeablePlayers.length, onContinue]);

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
          <span className="text-amber-400">{seasonNumber}</span>
        </h1>
        <p className="text-white text-sm mt-1">Off-season changes to your squad</p>
      </div>

      {/* Departures */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-red-400 uppercase mb-3">
          Departures
        </h3>
        <div className="space-y-2">
          {departedPlayers.map((dp, i) => {
            const isConvinceable = i === convinceableIdx;
            const retained = isConvinceable && convinceAttempted && convinceSuccess;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 border rounded-lg px-4 py-3 transition-all duration-500 ${
                  revealStep > i ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                } ${retained
                  ? "bg-emerald-900/20 border-emerald-700/40"
                  : "bg-red-900/10 border-red-800/30"
                }`}
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${dp.player.isSub ? "bg-purple-600" : getPositionColor(dp.player.assignedPosition)} text-white`}>
                  {dp.player.isSub ? "SUB" : dp.player.assignedPosition}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{dp.player.name}</div>
                  <div className="text-xs text-white">{dp.player.clubYear} &middot; OVR {dp.player.overall}</div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  {!isConvinceable && (
                    <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">
                      {dp.reason}
                    </span>
                  )}
                  {isConvinceable && !convinceAttempted && revealStep > i && (
                    <button
                      onClick={handleConvince}
                      className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 px-2.5 py-1 rounded transition-all active:scale-95"
                    >
                      💬 Convince to stay
                    </button>
                  )}
                  {isConvinceable && convinceAttempted && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      convinceSuccess
                        ? "text-emerald-300 bg-emerald-500/15"
                        : "text-red-400 bg-red-500/10"
                    }`}>
                      {convinceSuccess ? "✓ Changed their mind!" : "✗ Still leaving"}
                    </span>
                  )}
                  {isConvinceable && !convinceAttempted && revealStep <= i && (
                    <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">
                      {dp.reason}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rating Changes */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">
          Season Review &mdash; Rating Changes
        </h3>
        <div className="space-y-1">
          {[...ratingChanges].sort((a, b) => {
            if (a.player.isSub && !b.player.isSub) return 1;
            if (!a.player.isSub && b.player.isSub) return -1;
            const posOrder = (pos: string) => {
              const p = pos.toUpperCase();
              if (p === 'GK') return 0;
              if (['CB','LB','RB','LWB','RWB','SW'].includes(p)) return 1;
              if (['CM','CDM','CAM','LM','RM','DM','AM'].includes(p)) return 2;
              return 3;
            };
            return posOrder(a.player.assignedPosition) - posOrder(b.player.assignedPosition);
          }).map((rc, i) => {
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
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rc.player.isSub ? "bg-purple-600" : getPositionColor(rc.player.assignedPosition)} text-white w-8 text-center`}>
                  {rc.player.isSub ? "SUB" : rc.player.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium truncate">{rc.player.name}</span>
                <span className="text-white text-sm font-bold w-7 text-right">
                  {rc.oldOverall}
                </span>
                <span className="text-white mx-1">&rarr;</span>
                <span className={`text-sm font-black w-7 text-right ${
                  rc.change > 0 ? "text-emerald-400" :
                  rc.change < 0 ? "text-red-400" : "text-white"
                }`}>
                  {rc.newOverall}
                </span>
                <span className={`text-xs font-bold w-8 text-right ${
                  rc.change > 0 ? "text-emerald-500" :
                  rc.change < 0 ? "text-red-500" : "text-white"
                }`}>
                  {rc.change > 0 ? `+${rc.change}` : rc.change < 0 ? `${rc.change}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-gray-800/50 text-[10px] text-white">
          Based on last season&apos;s avg ratings: 8.5+ = +3, 7.7+ = +2, 7.0+ = +1, &le;6.5 = -1
        </div>
      </div>

      {/* Off-Season Training */}
      {allRevealed && youngestTwo.length >= 2 && !allMaxed && (
        <div className="bg-cyan-900/10 border border-cyan-700/30 rounded-xl p-4 mb-4 animate-[fadeIn_0.5s_ease-in]">
          <h3 className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-1">
            Off-Season Training
          </h3>
          <p className="text-xs text-white mb-3">
            Choose one of your youngest players for intensive training (random +1 to +3; max +2 if 90+ OVR)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {youngestTwo.map((p) => {
              const isMaxed = p.overall >= 100;
              const isSelected = selectedTraining === p.name;
              return (
                <button
                  key={p.name}
                  onClick={() => !isMaxed && setSelectedTraining(p.name)}
                  disabled={isMaxed}
                  className={`relative rounded-xl p-4 text-left transition-all duration-300 border-2 ${
                    isMaxed
                      ? "border-gray-800 bg-gray-900/50 opacity-40 cursor-not-allowed"
                      : isSelected
                        ? "border-cyan-400 bg-cyan-900/30 shadow-lg shadow-cyan-900/30 scale-[1.02]"
                        : selectedTraining && !isSelected
                          ? "border-gray-800 bg-gray-900/50 opacity-50"
                          : "border-gray-700/50 bg-gray-900 hover:border-cyan-600/50 hover:bg-gray-800/80"
                  }`}
                >
                  {isSelected && !isMaxed && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.isSub ? "bg-purple-600" : getPositionColor(p.assignedPosition)} text-white`}>
                    {p.isSub ? "SUB" : p.assignedPosition}
                  </span>
                  <div className="mt-2">
                    <div className="font-bold text-sm">{p.name}</div>
                    <div className="text-xs text-white mt-0.5">Age {p.age} &middot; OVR {p.overall}</div>
                  </div>
                  {isMaxed ? (
                    <div className="mt-2 text-xs font-bold text-white">
                      Max rating reached
                    </div>
                  ) : isSelected ? (
                    <div className="mt-2 text-xs font-bold text-cyan-400">
                      +{p.overall >= 90 ? "1–2" : "1–3"} OVR (random)
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Both maxed — auto-skipping */}
      {allRevealed && allMaxed && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50 text-center animate-[fadeIn_0.5s_ease-in]">
          <div className="text-white text-sm font-medium">
            Both training candidates are at max rating &mdash; skipping training
          </div>
        </div>
      )}

      {/* Squad Summary */}
      {allRevealed && season2Players.length > 0 && (() => {
        const { teamStrength, avgOvr } = computeTeamStrength(season2Players);
        return (
          <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50 flex items-center justify-around">
            <div className="text-center">
              <div className="text-2xl font-black text-white">{avgOvr}</div>
              <div className="text-[10px] font-bold tracking-widest text-white uppercase mt-0.5">Avg OVR</div>
            </div>
            <div className="w-px h-10 bg-gray-800" />
            <div className="text-center">
              <div className="text-2xl font-black text-blue-400">{Math.round(teamStrength)}</div>
              <div className="text-[10px] font-bold tracking-widest text-white uppercase mt-0.5">Starting 11</div>
            </div>
          </div>
        );
      })()}

      {/* UCL Qualification Notice */}
      {previousFinish !== undefined && previousFinish <= 5 && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4 mb-4 text-center animate-[fadeIn_0.5s_ease-in]">
          <span className="text-lg">&#9917;</span>
          <p className="text-sm text-blue-300 font-bold mt-1">
            Champions League Qualified!
          </p>
          <p className="text-xs text-white mt-0.5">
            Your team will compete in the UCL this season
          </p>
        </div>
      )}

      {/* UEL Qualification Notice */}
      {previousFinish !== undefined && (previousFinish === 6 || previousFinish === 7) && (
        <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-4 mb-4 text-center animate-[fadeIn_0.5s_ease-in]">
          <span className="text-lg">&#9917;</span>
          <p className="text-sm text-orange-300 font-bold mt-1">
            Europa League Qualified!
          </p>
          <p className="text-xs text-white mt-0.5">
            Your team will compete in the UEL this season
          </p>
        </div>
      )}

      {/* Info about replacements */}
      {(() => {
        const signingsNeeded = convinceAttempted && convinceSuccess
          ? Math.max(0, departedPlayers.length - 1)
          : departedPlayers.length;
        return (
          <div className="bg-amber-900/10 border border-amber-700/30 rounded-xl p-4 mb-6 text-center">
            {signingsNeeded === 0 ? (
              <p className="text-sm text-emerald-300 font-medium">
                No replacement signings needed this window!
              </p>
            ) : (
              <p className="text-sm text-amber-300 font-medium">
                You need to sign <span className="font-black">{signingsNeeded} replacement player{signingsNeeded !== 1 ? "s" : ""}</span> to fill your squad.
              </p>
            )}
            <p className="text-xs text-white mt-1">
              New signings receive a random {
                seasonNumber >= 5 ? "+4 to +7" :
                seasonNumber >= 4 ? "+3 to +5" :
                "+2 to +4"
              } boost. You can also sell a player afterwards.
            </p>
          </div>
        );
      })()}

      {/* Continue button */}
      {!allMaxed && (
        <button
          onClick={() => selectedTraining && onContinue(
            selectedTraining,
            convinceAttempted && convinceSuccess && convinceablePlayer ? convinceablePlayer.player : undefined,
          )}
          disabled={!allRevealed || !selectedTraining}
          className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-gray-700 disabled:to-gray-700 rounded-xl font-bold text-lg transition-all shadow-lg shadow-amber-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Sign Replacements
        </button>
      )}
    </div>
  );
}
