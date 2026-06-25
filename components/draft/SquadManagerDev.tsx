"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { FORMATIONS, getPositionColor } from "./formations";
import { calculateSeasonOdds } from "@/lib/seasonSimulator";
import ImageWithFallback from "@/components/ImageWithFallback";
import type { DraftPlayer } from "@/app/draft/page";

interface Props {
  players: DraftPlayer[];
  onConfirm: (players: DraftPlayer[]) => void;
  title?: string;
  subtitle?: string;
  formationName?: string;
  seasonNumber?: number;
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function SquadManagerDev({ players, onConfirm, title, subtitle, formationName, seasonNumber = 1 }: Props) {
  const [squad, setSquad] = useState<DraftPlayer[]>(() => [...players]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const formation = formationName ? FORMATIONS.find(f => f.name === formationName) : null;

  const starters = useMemo(
    () => squad
      .map((p, i) => ({ player: p, idx: i }))
      .filter(({ player }) => !player.isSub),
    [squad]
  );

  const subs = useMemo(
    () => squad
      .map((p, i) => ({ player: p, idx: i }))
      .filter(({ player }) => player.isSub),
    [squad]
  );

  // Map each formation slot to the starter occupying it
  const slotMap = useMemo(() => {
    if (!formation) return new Map<number, { player: DraftPlayer; idx: number }>();
    const map = new Map<number, { player: DraftPlayer; idx: number }>();
    const usedSlots = new Set<number>();
    for (const s of starters) {
      const slotIdx = formation.slots.findIndex((slot, i) =>
        !usedSlots.has(i) && slot.label === s.player.assignedPosition
      );
      if (slotIdx >= 0) {
        usedSlots.add(slotIdx);
        map.set(slotIdx, s);
      }
    }
    // Any starters that didn't match a slot exactly — place in first available
    for (const s of starters) {
      if (!Array.from(map.values()).some(v => v.idx === s.idx)) {
        const emptySlotIdx = formation.slots.findIndex((_, i) => !usedSlots.has(i));
        if (emptySlotIdx >= 0) {
          usedSlots.add(emptySlotIdx);
          map.set(emptySlotIdx, s);
        }
      }
    }
    return map;
  }, [squad, starters, formation]);

  const naturalPositions = (p: DraftPlayer) =>
    (p.positions || "").split(",").map(s => s.trim()).filter(Boolean);

  const isFit = (p: DraftPlayer) => {
    const nat = naturalPositions(p);
    return nat.length === 0 || nat.includes(p.assignedPosition);
  };

  const handleTap = (idx: number) => {
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

    setSquad(prev => {
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

  const handleTapVacantSlot = (slotIdx: number) => {
    if (!formation) return;
    if (selectedIdx === null) return;
    const player = squad[selectedIdx];
    if (!player.isSub) return; // only subs can fill vacant slots
    const slot = formation.slots[slotIdx];
    setSquad(prev => {
      const next = [...prev];
      next[selectedIdx] = { ...player, assignedPosition: slot.label, isSub: false };
      return next;
    });
    setSelectedIdx(null);
  };

  // Season odds
  const [odds, setOdds] = useState<ReturnType<typeof calculateSeasonOdds> | null>(null);
  const oddsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (oddsTimer.current) clearTimeout(oddsTimer.current);
    oddsTimer.current = setTimeout(() => {
      setOdds(calculateSeasonOdds(squad, undefined, seasonNumber, 200));
    }, 400);
    return () => { if (oddsTimer.current) clearTimeout(oddsTimer.current); };
  }, [squad, seasonNumber]);

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

      {selectedIdx !== null && (
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-4 py-2.5 mb-4 text-center">
          <span className="text-xs sm:text-sm text-emerald-400 font-medium">
            Selected: <span className="font-bold truncate inline-block max-w-[150px] sm:max-w-none align-bottom">{squad[selectedIdx].name}</span> — tap another player to swap
          </span>
        </div>
      )}

      {/* ────── PITCH VIEW ────── */}
      {formation && (
        <div className="mb-4">
          <div className="relative w-full aspect-[3/4] max-h-[60vh] mx-auto rounded-xl overflow-hidden border border-emerald-800/40">
            {/* Pitch gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/80 via-emerald-900/40 to-emerald-950/80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-800/20 via-transparent to-transparent" />

            {/* Pitch lines */}
            <div className="absolute inset-x-[10%] top-[5%] bottom-[5%] border border-emerald-600/30 rounded" />
            <div className="absolute inset-x-[10%] top-[5%] h-[18%] border-b border-emerald-600/30" />
            <div className="absolute inset-x-[10%] bottom-[5%] h-[18%] border-t border-emerald-600/30" />
            <div className="absolute left-1/2 top-[5%] bottom-[5%] w-px bg-emerald-600/30" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-emerald-600/30" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-600/40" />

            {formation.slots.map((slot, i) => {
              const entry = slotMap.get(i);
              const isVacant = !entry;
              const isSelected = entry ? selectedIdx === entry.idx : false;

              if (isVacant) {
                return (
                  <div
                    key={i}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer`}
                    style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                    onClick={() => handleTapVacantSlot(i)}
                  >
                    <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-2 border-dashed border-gray-500/50 bg-gray-800/60 ${
                      selectedIdx !== null ? "hover:border-emerald-400 hover:bg-emerald-900/30" : ""
                    }`}>
                      <span className="text-[10px] sm:text-xs font-bold text-gray-400">{slot.label}</span>
                    </div>
                  </div>
                );
              }

              const p = entry.player;
              const fit = isFit(p);

              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  onClick={() => handleTap(entry.idx)}
                >
                  {/* Player face circle */}
                  <div className={`relative w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? "border-emerald-400 ring-2 ring-emerald-400/50 scale-110 shadow-lg shadow-emerald-500/30"
                      : !fit
                        ? "border-amber-400/70"
                        : "border-white/60"
                  }`}>
                    {p.image_url ? (
                      <ImageWithFallback
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        fallbackText={p.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${getPositionColor(p.assignedPosition)}`}>
                        <span className="text-xs sm:text-sm font-black text-white">
                          {p.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                    )}
                    {/* OOP badge */}
                    {!fit && (
                      <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-amber-500 flex items-center justify-center">
                        <span className="text-[6px] sm:text-[7px] font-black text-black">!</span>
                      </div>
                    )}
                  </div>
                  {/* Name + Rating */}
                  <div className="flex flex-col items-center mt-0.5 max-w-[60px] sm:max-w-[72px]">
                    <span className="text-[8px] sm:text-[10px] font-bold text-white truncate w-full text-center leading-tight">
                      {p.name.split(" ").pop()}
                    </span>
                    <span className="text-[8px] sm:text-[10px] font-bold text-emerald-400 leading-tight">
                      {p.overall}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────── BENCH ────── */}
      <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
        <h3 className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-3">
          Substitutes
        </h3>
        <div className="flex gap-3 flex-wrap justify-center">
          {subs.map(({ player: p, idx }) => {
            const isSelected = selectedIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => handleTap(idx)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                  isSelected
                    ? "bg-purple-900/40 ring-2 ring-purple-400 scale-105"
                    : selectedIdx !== null
                      ? "bg-gray-800/50 hover:bg-gray-800 hover:ring-1 hover:ring-gray-600"
                      : "bg-gray-800/30 hover:bg-gray-800/50"
                }`}
              >
                {/* Face */}
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 overflow-hidden ${
                  isSelected ? "border-purple-400" : "border-gray-600/60"
                }`}>
                  {p.image_url ? (
                    <ImageWithFallback
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      fallbackText={p.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-purple-900/50">
                      <span className="text-xs font-black text-white">
                        {p.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                      </span>
                    </div>
                  )}
                </div>
                {/* Position badge */}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                  {naturalPositions(p).join("/") || p.assignedPosition}
                </span>
                {/* Name + OVR */}
                <span className="text-[9px] sm:text-[10px] font-bold text-white truncate max-w-[64px] text-center">
                  {p.name.split(" ").pop()}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400">
                  {p.overall}
                </span>
              </button>
            );
          })}
          {subs.length === 0 && (
            <div className="text-white text-sm text-center py-2 w-full">No substitutes</div>
          )}
        </div>
      </div>

      {/* ────── PRE-SEASON PREDICTIONS ────── */}
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
                ].map(m => (
                  <div key={m.label} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white">{m.label}</div>
                      <div className="w-full h-1 bg-gray-800 rounded-full mt-0.5 overflow-hidden">
                        <div className={`h-full rounded-full ${m.pct > 0 ? "bg-gradient-to-r from-gray-600 to-gray-500" : ""}`}
                          style={{ width: `${Math.min(100, Math.max(m.pct > 0 ? 2 : 0, m.pct))}%` }} />
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

      {/* ────── CONFIRM ────── */}
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
