"use client";
import { useState, useEffect, useCallback } from "react";
import { FORMATIONS, getPositionColor } from "@/components/draft/formations";
import { playerPrice } from "@/lib/matchEvents";
import type { DraftPlayer } from "@/app/draft/page";
import type { PlayerAttributes } from "@/lib/seasonSimulator";

const BUDGET_START = 500; // £M

interface Option {
  player: DraftPlayer;
  price: number;
  club: string;
  year: number;
}

interface SlotState {
  options: Option[] | null;
  loading: boolean;
  picked: DraftPlayer | null;
}

interface Props {
  formationName: string;
  onComplete: (squad: DraftPlayer[], budgetLeft: number) => void;
}

function buildAttrs(p: Record<string, number>): PlayerAttributes {
  return {
    pace: p.pace, shooting: p.shooting, passing: p.passing, dribbling: p.dribbling,
    defending: p.defending, physical: p.physical, finishing: p.finishing,
    positioning: p.positioning, crossing: p.crossing, vision: p.vision,
    longShots: p.longShots, shortPassing: p.shortPassing, longPassing: p.longPassing,
    heading: p.heading, interceptions: p.interceptions, standingTackle: p.standingTackle,
    marking: p.marking, reactions: p.reactions, sprintSpeed: p.sprintSpeed,
    gkDiving: p.gkDiving, gkPositioning: p.gkPositioning, gkReflexes: p.gkReflexes,
  };
}

export default function TransferMarket({ formationName, onComplete }: Props) {
  const formation = FORMATIONS.find(f => f.name === formationName) ?? FORMATIONS[0];
  const totalSlots = formation.slots.length + 3; // 11 + 3 subs
  const [currentSlot, setCurrentSlot] = useState(0);
  const [slotStates, setSlotStates] = useState<SlotState[]>(
    Array.from({ length: totalSlots }, () => ({ options: null, loading: false, picked: null }))
  );
  const [budget, setBudget] = useState(BUDGET_START);
  const [availableClubs, setAvailableClubs] = useState<{ name: string; seasons: number[] }[] | null>(null);
  const [usedClubYears, setUsedClubYears] = useState<Set<string>>(new Set());
  const [squad, setSquad] = useState<DraftPlayer[]>([]);

  useEffect(() => {
    fetch("/api/draft/clubs")
      .then(r => r.json())
      .then(d => setAvailableClubs(d.clubs ?? []));
  }, []);

  const pickClubYear = useCallback((used: Set<string>): { club: string; year: number } | null => {
    if (!availableClubs) return null;
    const pairs: { club: string; year: number }[] = [];
    for (const c of availableClubs) {
      for (const y of c.seasons) {
        if (!used.has(`${c.name}-${y}`)) pairs.push({ club: c.name, year: y });
      }
    }
    if (pairs.length === 0) return null;
    const byYear = new Map<number, typeof pairs>();
    for (const p of pairs) {
      if (!byYear.has(p.year)) byYear.set(p.year, []);
      byYear.get(p.year)!.push(p);
    }
    const years = Array.from(byYear.keys());
    const year = years[Math.floor(Math.random() * years.length)];
    const pool = byYear.get(year)!;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [availableClubs]);

  const loadOptions = useCallback(async (slotIdx: number) => {
    if (!availableClubs || slotStates[slotIdx].options !== null) return;

    const isSub = slotIdx >= formation.slots.length;
    const slot = !isSub ? formation.slots[slotIdx] : null;

    setSlotStates(prev => {
      const next = [...prev];
      next[slotIdx] = { ...next[slotIdx], loading: true };
      return next;
    });

    const newUsed = new Set(usedClubYears);
    const options: Option[] = [];

    for (let i = 0; i < 3; i++) {
      let roster: Record<string, unknown>[] = [];
      let clubYear: { club: string; year: number } | null = null;
      let retries = 0;
      while (roster.length === 0 && retries < 5) {
        clubYear = pickClubYear(newUsed);
        if (!clubYear) break;
        newUsed.add(`${clubYear.club}-${clubYear.year}`);
        try {
          const res = await fetch(`/api/draft/roster?club=${encodeURIComponent(clubYear.club)}&year=${clubYear.year}`);
          const data = await res.json();
          roster = Array.isArray(data.roster) ? data.roster : [];
        } catch { }
        retries++;
      }
      if (!clubYear || roster.length === 0) continue;

      // Pick best compatible player
      let pool = roster;
      if (slot) {
        const compatible = roster.filter(p => {
          const pos = String((p as Record<string, unknown>).positions ?? "").split(",").map(s => s.trim());
          return pos.some(pp => slot.compatiblePositions.includes(pp));
        });
        if (compatible.length > 0) pool = compatible;
      }

      const best = pool.reduce((a, b) =>
        Number((b as Record<string, unknown>).overall ?? 0) > Number((a as Record<string, unknown>).overall ?? 0) ? b : a
      , pool[0]) as Record<string, unknown>;

      const abbr = clubYear.club.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3);
      const ovr = Number(best.overall ?? 0);

      const player: DraftPlayer = {
        name: String(best.name ?? ""),
        overall: ovr,
        positions: String(best.positions ?? ""),
        club: clubYear.club,
        clubYear: `${abbr} ${clubYear.year}`,
        assignedPosition: slot ? slot.label : (String(best.positions ?? "CM").split(",")[0].trim() || "CM"),
        sofifa_id: String(best.sofifa_id ?? ""),
        image_url: best.image_url as string | null,
        nationality: String(best.nationality ?? ""),
        age: Number(best.age ?? 0),
        isSub: isSub,
        attrs: buildAttrs(best as Record<string, number>),
      };

      options.push({ player, price: playerPrice(ovr), club: clubYear.club, year: clubYear.year });
    }

    setUsedClubYears(newUsed);
    setSlotStates(prev => {
      const next = [...prev];
      next[slotIdx] = { options, loading: false, picked: null };
      return next;
    });
  }, [availableClubs, formation.slots, pickClubYear, slotStates, usedClubYears]);

  useEffect(() => {
    if (availableClubs && slotStates[currentSlot]?.options === null && !slotStates[currentSlot]?.loading) {
      loadOptions(currentSlot);
    }
  }, [availableClubs, currentSlot, slotStates, loadOptions]);

  const handlePick = (slotIdx: number, option: Option) => {
    if (option.price > budget) return;

    const newSquad = [...squad, option.player];
    setSquad(newSquad);
    setBudget(b => b - option.price);
    setSlotStates(prev => {
      const next = [...prev];
      next[slotIdx] = { ...next[slotIdx], picked: option.player };
      return next;
    });

    if (slotIdx + 1 >= totalSlots) {
      setTimeout(() => onComplete(newSquad, budget - option.price), 400);
    } else {
      setTimeout(() => setCurrentSlot(slotIdx + 1), 400);
    }
  };

  const slotLabel = (idx: number): string => {
    if (idx < formation.slots.length) return formation.slots[idx].label;
    return `SUB ${idx - formation.slots.length + 1}`;
  };

  const isSub = (idx: number) => idx >= formation.slots.length;

  const currentState = slotStates[currentSlot];

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/5 mb-3">
          <span className="text-xs font-bold tracking-widest uppercase text-green-400">Transfer Market</span>
        </div>
        <h1 className="text-2xl font-black text-white">Build Your Squad</h1>
        <p className="text-gray-200 text-sm mt-1">Choose one player per position</p>
      </div>

      {/* Budget bar */}
      <div className="bg-gray-900 rounded-xl p-4 mb-5 border border-gray-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-200 uppercase tracking-widest">Budget Remaining</span>
          <span className={`text-xl font-black ${budget < 50 ? "text-red-400" : budget < 150 ? "text-yellow-400" : "text-emerald-400"}`}>
            £{budget}M
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${budget < 50 ? "bg-red-500" : budget < 150 ? "bg-yellow-500" : "bg-emerald-500"}`}
            style={{ width: `${(budget / BUDGET_START) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-300">£0</span>
          <span className="text-[10px] text-gray-300">£{BUDGET_START}M</span>
        </div>
      </div>

      {/* Slot progress */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {Array.from({ length: totalSlots }, (_, i) => {
          const picked = slotStates[i].picked;
          const isActive = i === currentSlot;
          const isSub_ = isSub(i);
          return (
            <div
              key={i}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                picked
                  ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-400"
                  : isActive
                    ? "bg-amber-500/10 border-amber-500/50 text-amber-400 animate-pulse"
                    : "bg-gray-900 border-gray-800 text-gray-300"
              }`}
            >
              <span className={`px-1 py-0.5 rounded text-[9px] ${isSub_ ? "bg-purple-700" : getPositionColor(slotLabel(i))} text-white`}>
                {slotLabel(i)}
              </span>
              {picked && <span className="truncate max-w-[60px]">{picked.name.split(" ").slice(-1)[0]}</span>}
            </div>
          );
        })}
      </div>

      {/* Current slot */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[10px] font-bold px-2 py-1 rounded ${isSub(currentSlot) ? "bg-purple-700" : getPositionColor(slotLabel(currentSlot))} text-white`}>
            {slotLabel(currentSlot)}
          </span>
          <span className="text-sm font-bold text-white">
            {isSub(currentSlot) ? "Pick a Substitute" : `Pick your ${slotLabel(currentSlot)}`}
          </span>
          <span className="text-xs text-gray-300 ml-auto">
            {currentSlot + 1} / {totalSlots}
          </span>
        </div>

        {currentState?.loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-300">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading options...</span>
          </div>
        )}

        {currentState?.options && !currentState.picked && (
          <div className="space-y-3">
            {currentState.options.map((opt, i) => {
              const canAfford = opt.price <= budget;
              return (
                <button
                  key={i}
                  onClick={() => canAfford && handlePick(currentSlot, opt)}
                  disabled={!canAfford}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 ${
                    canAfford
                      ? "border-gray-700/50 bg-gray-900 hover:border-emerald-500/60 hover:bg-gray-800/80 hover:scale-[1.01] active:scale-[0.99]"
                      : "border-gray-800 bg-gray-900/40 opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* OVR badge */}
                    <div className={`shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center font-black border ${
                      opt.player.overall >= 90 ? "bg-amber-500/20 border-amber-500/40 text-amber-400" :
                      opt.player.overall >= 85 ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" :
                      opt.player.overall >= 80 ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
                      "bg-gray-800 border-gray-700 text-white"
                    }`}>
                      <span className="text-lg leading-none">{opt.player.overall}</span>
                      <span className="text-[9px] text-current opacity-60">OVR</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-white">{opt.player.name}</div>
                      <div className="text-xs text-gray-200 mt-0.5">{opt.club} · {opt.year} · Age {opt.player.age}</div>
                      {/* Key stats */}
                      {opt.player.attrs && (
                        <div className="flex gap-3 mt-2">
                          {isSub(currentSlot) || slotLabel(currentSlot) === "GK" ? (
                            opt.player.attrs.gkReflexes > 0 ? (
                              <>
                                <span className="text-[10px] text-gray-200">DIV <span className="text-gray-300 font-bold">{opt.player.attrs.gkDiving}</span></span>
                                <span className="text-[10px] text-gray-200">REF <span className="text-gray-300 font-bold">{opt.player.attrs.gkReflexes}</span></span>
                              </>
                            ) : (
                              <>
                                <span className="text-[10px] text-gray-200">PAC <span className="text-gray-300 font-bold">{opt.player.attrs.pace}</span></span>
                                <span className="text-[10px] text-gray-200">SHO <span className="text-gray-300 font-bold">{opt.player.attrs.shooting}</span></span>
                                <span className="text-[10px] text-gray-200">PAS <span className="text-gray-300 font-bold">{opt.player.attrs.passing}</span></span>
                              </>
                            )
                          ) : (
                            <>
                              <span className="text-[10px] text-gray-200">PAC <span className="text-gray-300 font-bold">{opt.player.attrs.pace}</span></span>
                              <span className="text-[10px] text-gray-200">SHO <span className="text-gray-300 font-bold">{opt.player.attrs.shooting}</span></span>
                              <span className="text-[10px] text-gray-200">PAS <span className="text-gray-300 font-bold">{opt.player.attrs.passing}</span></span>
                              <span className="text-[10px] text-gray-200">DEF <span className="text-gray-300 font-bold">{opt.player.attrs.defending}</span></span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="shrink-0 text-right">
                      <div className={`text-base font-black ${canAfford ? "text-emerald-400" : "text-red-400"}`}>
                        £{opt.price}M
                      </div>
                      {!canAfford && <div className="text-[9px] text-red-600 mt-0.5">Over budget</div>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {currentState?.picked && (
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-bold text-sm text-emerald-400">{currentState.picked.name} signed!</div>
              <div className="text-xs text-gray-200">{currentState.picked.overall} OVR · {currentState.picked.clubYear}</div>
            </div>
          </div>
        )}
      </div>

      {/* Squad so far */}
      {squad.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800/50">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-200 uppercase mb-2">Squad So Far</h3>
          <div className="space-y-1">
            {squad.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.isSub ? "bg-purple-700" : getPositionColor(p.assignedPosition)} text-white w-8 text-center`}>
                  {p.assignedPosition}
                </span>
                <span className="flex-1 text-gray-300 truncate">{p.name}</span>
                <span className="text-gray-200">{p.overall}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
