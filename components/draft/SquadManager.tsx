"use client";
import { useState, useMemo } from "react";
import { FORMATIONS, getPositionColor } from "./formations";
import type { DraftPlayer } from "@/app/draft/page";

interface Props {
  players: DraftPlayer[];
  onConfirm: (players: DraftPlayer[]) => void;
  title?: string;
  subtitle?: string;
  formationName?: string;
}

const positionOrder: Record<string, number> = {
  GK: 0, CB: 1, RB: 2, LB: 3, RWB: 2, LWB: 3, SW: 1,
  CDM: 4, DM: 4, CM: 5, CAM: 6, RM: 7, LM: 7, RAM: 6, LAM: 6,
  RW: 8, LW: 8, ST: 9, CF: 9,
};

export default function SquadManager({ players, onConfirm, title, subtitle, formationName }: Props) {
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
        <p className="text-gray-500 text-sm mt-1">
          Tap two players to swap them
        </p>
      </div>

      {(selectedIdx !== null || selectedVacant !== null) && (
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-2.5 mb-4 text-center">
          <span className="text-sm text-emerald-400 font-medium">
            {selectedVacant !== null && formation ? (
              <>Selected: <span className="font-bold">{formation.slots[selectedVacant].label} (Vacant)</span> — tap a player to fill this position</>
            ) : (
              <>Selected: <span className="font-bold">{squad[selectedIdx!].name}</span> — tap another player to swap{vacantSlots.length > 0 ? " or tap a vacant slot" : ""}</>
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
                <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
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
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 w-9 text-center">
                  {slot.label}
                </span>
                <span className="flex-1 ml-1 font-medium text-gray-600 italic">Vacant</span>
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
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-9 text-center`}>
                  {p.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium">{p.name}</span>
                <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
              </button>
            );
          })}
        </div>
        {subs.length === 0 && (
          <div className="text-gray-600 text-sm text-center py-2">No substitutes</div>
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
