"use client";
import { useState } from "react";
import { FORMATIONS, getPositionColor } from "@/components/draft/formations";
import type { DraftPlayer } from "@/app/draft/page";

interface Props {
  squad: DraftPlayer[];
  formationName: string;
  budgetLeft: number;
  onConfirm: (squad: DraftPlayer[]) => void;
}

export default function SquadArrange({ squad: initialSquad, formationName, budgetLeft, onConfirm }: Props) {
  const formation = FORMATIONS.find(f => f.name === formationName) ?? FORMATIONS[0];
  const [squad, setSquad] = useState<DraftPlayer[]>([...initialSquad]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const starters = squad.filter(p => !p.isSub);
  const subs = squad.filter(p => p.isSub);
  const avgOvr = squad.length > 0 ? Math.round(squad.reduce((s, p) => s + p.overall, 0) / squad.length) : 0;
  const starterAvg = starters.length > 0 ? Math.round(starters.reduce((s, p) => s + p.overall, 0) / starters.length) : 0;

  const handleSwap = (idx: number) => {
    if (selectedIdx === null) {
      setSelectedIdx(idx);
      return;
    }
    if (selectedIdx === idx) {
      setSelectedIdx(null);
      return;
    }
    const a = squad[selectedIdx];
    const b = squad[idx];
    const newSquad = [...squad];
    newSquad[selectedIdx] = { ...b, isSub: a.isSub, assignedPosition: a.assignedPosition };
    newSquad[idx] = { ...a, isSub: b.isSub, assignedPosition: b.assignedPosition };
    setSquad(newSquad);
    setSelectedIdx(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950 pb-32">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center mb-5">
          <div className="inline-block px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/5 mb-2">
            <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Pre-Season</span>
          </div>
          <h1 className="text-2xl font-black text-white">Arrange Your Squad</h1>
          <p className="text-gray-200 text-xs mt-1">Tap two players to swap positions</p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800/50 text-center">
            <div className="text-[9px] text-gray-300 uppercase tracking-wider">Squad OVR</div>
            <div className="text-xl font-black text-white">{avgOvr}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800/50 text-center">
            <div className="text-[9px] text-gray-300 uppercase tracking-wider">Starters</div>
            <div className="text-xl font-black text-emerald-400">{starterAvg}</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-800/50 text-center">
            <div className="text-[9px] text-gray-300 uppercase tracking-wider">Budget Left</div>
            <div className="text-xl font-black text-amber-400">£{budgetLeft}M</div>
          </div>
        </div>

        {/* Formation pitch */}
        <div className="bg-gradient-to-b from-emerald-950/40 to-emerald-900/20 rounded-xl border border-emerald-900/30 p-3 mb-5 relative" style={{ aspectRatio: "0.72" }}>
          <div className="absolute inset-3 border border-white/5 rounded" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-white/5 rounded-full" />
          <div className="absolute left-1/2 top-3 right-3 bottom-3 -translate-x-1/2 w-px bg-white/5" />

          {starters.map((p) => {
            const slot = formation.slots.find(s => s.label === p.assignedPosition);
            const squadIdx = squad.indexOf(p);
            const isSelected = selectedIdx === squadIdx;
            if (!slot) return null;
            return (
              <button
                key={squadIdx}
                onClick={() => handleSwap(squadIdx)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all ${isSelected ? "scale-110 z-10" : "hover:scale-105"}`}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black border-2 ${
                  isSelected
                    ? "bg-amber-500 border-amber-300 text-black ring-4 ring-amber-500/30"
                    : `${getPositionColor(p.assignedPosition)} border-white/20 text-white`
                }`}>
                  {p.overall}
                </div>
                <div className="mt-1 text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded whitespace-nowrap max-w-[80px] truncate">
                  {p.name.split(" ").slice(-1)[0]}
                </div>
              </button>
            );
          })}
        </div>

        {/* Subs */}
        <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-200 uppercase mb-3">Substitutes</h3>
          <div className="grid grid-cols-3 gap-2">
            {subs.map((p) => {
              const squadIdx = squad.indexOf(p);
              const isSelected = selectedIdx === squadIdx;
              return (
                <button
                  key={squadIdx}
                  onClick={() => handleSwap(squadIdx)}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10 scale-105"
                      : "border-gray-800 bg-gray-950 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                      {p.assignedPosition}
                    </span>
                    <span className="text-[10px] font-bold text-white ml-auto">{p.overall}</span>
                  </div>
                  <div className="text-[10px] text-gray-300 truncate text-left">{p.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirm CTA */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-black via-black to-transparent pt-6 pb-4 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => onConfirm(squad)}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black py-3.5 rounded-xl text-base tracking-wide transition-all shadow-xl shadow-black/40 hover:scale-[1.01] active:scale-[0.99]"
          >
            Start the Season →
          </button>
        </div>
      </div>
    </div>
  );
}
