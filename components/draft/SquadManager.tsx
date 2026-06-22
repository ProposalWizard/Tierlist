"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { FORMATIONS, getPositionColor } from "./formations";
import { calculateSeasonOdds } from "@/lib/seasonSimulator";
import type { DraftPlayer } from "@/app/draft/page";

interface Props {
  players: DraftPlayer[];
  onConfirm: (players: DraftPlayer[]) => void;
  title?: string;
  subtitle?: string;
  formationName?: string;
  seasonNumber?: number;
}

const positionOrder: Record<string, number> = {
  GK: 0, CB: 1, RB: 2, LB: 3, RWB: 2, LWB: 3, SW: 1,
  CDM: 4, DM: 4, CM: 5, CAM: 6, RM: 7, LM: 7, RAM: 6, LAM: 6,
  RW: 8, LW: 8, ST: 9, CF: 9,
};

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function SquadManager({ players, onConfirm, title, subtitle, formationName, seasonNumber = 1 }: Props) {
  const [squad, setSquad] = useState<DraftPlayer[]>(() => [...players]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedVacant, setSelectedVacant] = useState<number | null>(null);
  const formation = formationName ? FORMATIONS.find(f => f.name === formationName) : null;

  const starters = useMemo(
    () => squad
      .map((p, i) => ({ player: p, idx: i }))
      .filter(({ player }) => !player.isSub)
      .sort((a, b) => (positionOrder[a.player.assignedPosition] ?? 5) - (positionOrder[b.player.assignedPosition] ?? 5)),
    [squad]
  );

  const subs = useMemo(
    () => squad
      .map((p, i) => ({ player: p, idx: i }))
      .filter(({ player }) => player.isSub),
    [squad]
  );

  const vacantSlots = useMemo(() => {
    if (!formation) return [];
    const starterPositions = squad.filter(p => !p.isSub).map(p => p.assignedPosition);
    const usedSlotIndices = new Set<number>();
    for (const pos of starterPositions) {
      const slotIdx = formation.slots.findIndex((slot, i) =>
        !usedSlotIndices.has(i) && slot.label === pos
      );
      if (slotIdx >= 0) usedSlotIndices.add(slotIdx);
    }
    return formation.slots
      .map((slot, i) => ({ slot, slotIdx: i }))
      .filter(({ slotIdx }) => !usedSlotIndices.has(slotIdx));
  }, [squad, formation]);

  const handleTapVacant = (slotIdx: number) => {
    if (selectedVacant === slotIdx) {
      setSelectedVacant(null);
      return;
    }
    if (selectedIdx !== null && formation) {
      const player = squad[selectedIdx];
      const slot = formation.slots[slotIdx];
      setSquad((prev) => {
        const next = [...prev];
        next[selectedIdx] = { ...player, assignedPosition: slot.label, isSub: false };
        return next;
      });
      setSelectedIdx(null);
      setSelectedVacant(null);
      return;
    }
    setSelectedVacant(slotIdx);
    setSelectedIdx(null);
  };

  const handleTap = (idx: number) => {
    if (selectedVacant !== null && formation) {
      const player = squad[idx];
      if (player.isSub) {
        const slot = formation.slots[selectedVacant];
        setSquad((prev) => {
          const next = [...prev];
          next[idx] = { ...player, assignedPosition: slot.label, isSub: false };
          return next;
        });
      }
      setSelectedVacant(null);
      setSelectedIdx(null);
      return;
    }

    if (selectedIdx === null) {
      setSelectedIdx(idx);
      setSelectedVacant(null);
      return;
    }
    if (selectedIdx === idx) {
      setSelectedIdx(null);
      return;
    }

    const a = squad[selectedIdx];
    const b = squad[idx];

    setSquad((prev) => {
      const next = [...prev];
      const aIsStarter = !a.isSub;
      const bIsStarter = !b.isSub;

      if (aIsStarter && bIsStarter) {
        next[selectedIdx] = { ...a, assignedPosition: b.assignedPosition };
        next[idx] = { ...b, assignedPosition: a.assignedPosition };
      } else if (aIsStarter && !bIsStarter) {
        next[selectedIdx] = { ...b, assignedPosition: a.assignedPosition, isSub: false };
        next[idx] = { ...a, isSub: true };
      } else if (!aIsStarter && bIsStarter) {
        next[idx] = { ...a, assignedPosition: b.assignedPosition, isSub: false };
        next[selectedIdx] = { ...b, isSub: true };
      } else {
        next[selectedIdx] = { ...b };
        next[idx] = { ...a };
      }
      return next;
    });
    setSelectedIdx(null);
  };

  const [odds, setOdds] = useState<ReturnType<typeof calculateSeasonOdds> | null>(null);
  const oddsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (oddsTimer.current) clearTimeout(oddsTimer.current);
    oddsTimer.current = setTimeout(() => {
      setOdds(calculateSeasonOdds(squad, undefined, seasonNumber, 200));
    }, 400);
    return () => { if (oddsTimer.current) clearTimeout(oddsTimer.current); };
  }, [squad, seasonNumber]);

  const naturalPositions = (p: DraftPlayer) =>
    (p.positions || "").split(",").map((s) => s.trim()).filter(Boolean);

  const isFit = (p: DraftPlayer) => {
    const nat = naturalPositions(p);
    return nat.length === 0 || nat.includes(p.assignedPosition);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 mb-4">
          <span className="text-xs font-bold tracking-widest uppercase text-emerald-400">
            {title || "Squad Manager"}
          </span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">
          {subtitle || "Arrange Your Squad"}
        </h1>
        <p className="text-white text-sm mt-1">
          Tap two players to swap them
        </p>
      </div>

      {(selectedIdx !== null || selectedVacant !== null) && (
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-2.5 mb-4 text-center">
          <span className="text-xs sm:text-sm text-emerald-400 font-medium">
            {selectedVacant !== null && formation ? (
              <>Selected: <span className="font-bold">{formation.slots[selectedVacant].label} (Vacant)</span> — tap a player to fill this position</>
            ) : (
              <>Selected: <span className="font-bold truncate inline-block max-w-[120px] sm:max-w-none align-bottom">{squad[selectedIdx!].name}</span> — tap another player to swap{vacantSlots.length > 0 ? " or tap a vacant slot" : ""}</>
            )}
          </span>
        </div>
      )}

      {/* Starting XI */}
      <div className="bg-gray-900 rounded-xl p-4 mb-3 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase mb-3">
          Starting XI
        </h3>
        <div className="space-y-1">
          {starters.map(({ player: p, idx }) => {
            const isSelected = selectedIdx === idx;
            const fit = isFit(p);
            return (
              <button
                key={idx}
                onClick={() => handleTap(idx)}
                className={`w-full flex items-center gap-2 text-sm py-2.5 px-3 rounded-lg transition-all text-left ${
                  isSelected
                    ? "bg-emerald-900/40 border-2 border-emerald-400 scale-[1.01]"
                    : selectedIdx !== null || selectedVacant !== null
                      ? "bg-gray-800/50 hover:bg-gray-800 border-2 border-transparent"
                      : "hover:bg-gray-800/50 border-2 border-transparent"
                }`}
              >
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-9 text-center`}>
                  {p.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium">{p.name}</span>
                {!fit && (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    OOP
                  </span>
                )}
                <span className="text-white text-[10px] font-medium">{p.clubYear}</span>
                <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
              </button>
            );
          })}
          {vacantSlots.map(({ slot, slotIdx }) => {
            const isSelected = selectedVacant === slotIdx;
            return (
              <button
                key={`vacant-${slotIdx}`}
                onClick={() => handleTapVacant(slotIdx)}
                className={`w-full flex items-center gap-2 text-sm py-2.5 px-3 rounded-lg transition-all text-left ${
                  isSelected
                    ? "bg-red-900/30 border-2 border-red-400 scale-[1.01]"
                    : selectedIdx !== null || selectedVacant !== null
                      ? "bg-gray-800/30 hover:bg-gray-800 border-2 border-dashed border-gray-600/50"
                      : "hover:bg-gray-800/30 border-2 border-dashed border-gray-600/50"
                }`}
              >
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-white w-9 text-center">
                  {slot.label}
                </span>
                <span className="flex-1 ml-1 font-medium text-white italic">Vacant</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Substitutes */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-3">
          Substitutes
        </h3>
        <div className="space-y-1">
          {subs.map(({ player: p, idx }) => {
            const isSelected = selectedIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => handleTap(idx)}
                className={`w-full flex items-center gap-2 text-sm py-2.5 px-3 rounded-lg transition-all text-left ${
                  isSelected
                    ? "bg-purple-900/40 border-2 border-purple-400 scale-[1.01]"
                    : selectedIdx !== null || selectedVacant !== null
                      ? "bg-gray-800/50 hover:bg-gray-800 border-2 border-transparent"
                      : "hover:bg-gray-800/50 border-2 border-transparent"
                }`}
              >
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-800 text-white w-9 text-center">
                  SUB
                </span>
                <span className="flex-1 ml-1 font-medium">{p.name}</span>
                <span className="text-white text-[9px] font-medium">{naturalPositions(p).join(" / ") || p.assignedPosition}</span>
                <span className="text-white text-[10px] font-medium">{p.clubYear}</span>
                <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
              </button>
            );
          })}
        </div>
        {subs.length === 0 && (
          <div className="text-white text-sm text-center py-2">No substitutes</div>
        )}
      </div>

      {/* Pre-Season Predictions */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">&#128202;</span>
          <h3 className="text-[10px] font-bold tracking-widest text-white uppercase">
            Pre-Season Predictions
          </h3>
          {!odds && <span className="text-[10px] text-white animate-pulse ml-auto">Calculating...</span>}
        </div>
        {odds ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-black ${odds.winLeague >= 50 ? "text-yellow-400" : odds.winLeague >= 20 ? "text-emerald-400" : "text-white"}`}>
                  {odds.winLeague.toFixed(1)}%
                </div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mt-0.5">Win League</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-black ${odds.top4 >= 70 ? "text-blue-400" : odds.top4 >= 40 ? "text-emerald-400" : "text-white"}`}>
                  {odds.top4.toFixed(1)}%
                </div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mt-0.5">Top 4</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-black ${odds.top7 >= 80 ? "text-emerald-400" : odds.top7 >= 50 ? "text-emerald-400/70" : "text-white"}`}>
                  {odds.top7.toFixed(1)}%
                </div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mt-0.5">Top 7</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <div className={`text-2xl font-black ${odds.relegation >= 30 ? "text-red-400" : odds.relegation >= 10 ? "text-orange-400" : "text-white"}`}>
                  {odds.relegation.toFixed(1)}%
                </div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mt-0.5">Relegation</div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-800/50 flex justify-between text-xs text-white">
              <span>Predicted Points</span>
              <span className="font-bold text-white">{odds.avgPoints}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-white">
              <span>Predicted Finish</span>
              <span className="font-bold text-white">{ordinal(Math.round(odds.avgFinish))}</span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-white">
              <span>Avg Wins</span>
              <span className="font-bold text-white">{odds.avgWins}/38</span>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-800/50">
              <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Milestone Odds</div>
              <div className="space-y-1.5">
                {[
                  { label: "100+ Points (Centurion)", pct: odds.centurion, color: "text-yellow-400" },
                  { label: "Unbeaten Season (0 losses)", pct: odds.unbeaten, color: "text-emerald-400" },
                  { label: "Perfect Season (38 wins)", pct: odds.perfectSeason, color: "text-purple-400" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white">{m.label}</div>
                      <div className="w-full h-1 bg-gray-800 rounded-full mt-0.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${m.pct > 0 ? "bg-gradient-to-r from-gray-600 to-gray-500" : ""}`}
                          style={{ width: `${Math.min(100, Math.max(m.pct > 0 ? 2 : 0, m.pct))}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-sm font-black w-14 text-right tabular-nums ${m.pct > 0 ? m.color : "text-white"}`}>
                      {m.pct > 0 ? `${m.pct}%` : "0%"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="py-6 text-center">
            <div className="text-sm text-white animate-pulse">Simulating seasons...</div>
          </div>
        )}
      </div>

      {/* Confirm */}
      <button
        onClick={() => onConfirm(squad)}
        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Confirm Squad
      </button>
    </div>
  );
}
