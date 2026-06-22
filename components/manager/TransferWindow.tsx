"use client";
import { useState, useEffect, useCallback } from "react";
import { playerPrice } from "@/lib/matchEvents";
import { getPositionColor } from "@/components/draft/formations";
import type { DraftPlayer } from "@/app/draft/page";
import type { PlayerAttributes } from "@/lib/seasonSimulator";

interface Props {
  squad: DraftPlayer[];
  budget: number;
  onComplete: (squad: DraftPlayer[], newBudget: number) => void;
}

interface MarketPlayer {
  player: DraftPlayer;
  price: number;
  club: string;
  year: number;
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

export default function TransferWindow({ squad: initialSquad, budget: initialBudget, onComplete }: Props) {
  const [squad, setSquad] = useState<DraftPlayer[]>(initialSquad);
  const [budget, setBudget] = useState(initialBudget);
  const [view, setView] = useState<"hub" | "buy" | "sell">("hub");
  const [marketOptions, setMarketOptions] = useState<MarketPlayer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [clubs, setClubs] = useState<{ name: string; seasons: number[] }[]>([]);
  const [replaceTarget, setReplaceTarget] = useState<DraftPlayer | null>(null);
  const [activity, setActivity] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/draft/clubs").then(r => r.json()).then(d => setClubs(d.clubs ?? []));
  }, []);

  const log = (msg: string) => setActivity(prev => [msg, ...prev].slice(0, 8));

  const loadMarketFor = useCallback(async (target: DraftPlayer | null) => {
    if (clubs.length === 0) return;
    setLoading(true);
    setMarketOptions(null);
    const options: MarketPlayer[] = [];
    const usedClubYears = new Set<string>();
    const pairs: { club: string; year: number }[] = [];
    for (const c of clubs) {
      for (const y of c.seasons) {
        pairs.push({ club: c.name, year: y });
      }
    }

    for (let attempt = 0; attempt < 18 && options.length < 4; attempt++) {
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const key = `${pair.club}-${pair.year}`;
      if (usedClubYears.has(key)) continue;
      usedClubYears.add(key);

      let roster: Record<string, unknown>[] = [];
      try {
        const res = await fetch(`/api/draft/roster?club=${encodeURIComponent(pair.club)}&year=${pair.year}`);
        const d = await res.json();
        roster = Array.isArray(d.roster) ? d.roster : [];
      } catch { continue; }

      let pool = roster;
      if (target) {
        const targetPos = target.assignedPosition;
        const compatible = roster.filter(p => {
          const pos = String((p as Record<string, unknown>).positions ?? "").split(",").map(s => s.trim());
          return pos.includes(targetPos);
        });
        if (compatible.length > 0) pool = compatible;
      }

      const best = pool.reduce((a, b) =>
        Number((b as Record<string, unknown>).overall ?? 0) > Number((a as Record<string, unknown>).overall ?? 0) ? b : a
      , pool[0]) as Record<string, unknown>;

      if (!best) continue;

      const abbr = pair.club.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3);
      const ovr = Number(best.overall ?? 0);
      const player: DraftPlayer = {
        name: String(best.name ?? ""),
        overall: ovr,
        positions: String(best.positions ?? ""),
        club: pair.club,
        clubYear: `${abbr} ${pair.year}`,
        assignedPosition: target ? target.assignedPosition : (String(best.positions ?? "CM").split(",")[0].trim() || "CM"),
        sofifa_id: String(best.sofifa_id ?? ""),
        image_url: best.image_url as string | null,
        nationality: String(best.nationality ?? ""),
        age: Number(best.age ?? 0),
        isSub: target ? target.isSub : false,
        attrs: buildAttrs(best as Record<string, number>),
      };
      options.push({ player, price: playerPrice(ovr), club: pair.club, year: pair.year });
    }

    setMarketOptions(options);
    setLoading(false);
  }, [clubs]);

  const handleSell = (p: DraftPlayer) => {
    const price = Math.round(playerPrice(p.overall) * 0.7);
    setBudget(b => b + price);
    setSquad(prev => prev.filter(x => x !== p));
    setReplaceTarget(p);
    log(`💸 Sold ${p.name} for £${price}M`);
    setView("buy");
    loadMarketFor(p);
  };

  const handleBuy = (mp: MarketPlayer) => {
    if (mp.price > budget) return;
    setBudget(b => b - mp.price);
    if (replaceTarget) {
      // Slot replacement into the same role
      setSquad(prev => [...prev, mp.player]);
      log(`✅ Signed ${mp.player.name} for £${mp.price}M`);
      setReplaceTarget(null);
    } else {
      // Free signing
      setSquad(prev => [...prev, mp.player]);
      log(`✅ Signed ${mp.player.name} for £${mp.price}M`);
    }
    setMarketOptions(null);
    setView("hub");
  };

  const starters = squad.filter(p => !p.isSub);
  const subs = squad.filter(p => p.isSub);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950 pb-32">
      <div className="border-b border-gray-900/50">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-block px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/5 mb-2">
                <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400">Transfer Window</span>
              </div>
              <h1 className="text-2xl font-black text-white">Make Moves</h1>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white uppercase tracking-wider">Budget</div>
              <div className="text-xl font-black text-amber-400">£{budget}M</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {view === "hub" && (
          <div className="space-y-4">
            {activity.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-3">
                <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Recent Activity</h3>
                <div className="space-y-0.5">
                  {activity.map((a, i) => (
                    <div key={i} className="text-xs text-white">{a}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setReplaceTarget(null); setView("buy"); loadMarketFor(null); }}
                className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border border-emerald-700/40 hover:border-emerald-500 rounded-xl p-4 text-left transition-all hover:scale-[1.01]"
              >
                <div className="text-2xl mb-1">🛒</div>
                <div className="font-black text-emerald-300">Sign a Player</div>
                <div className="text-[10px] text-white mt-1">Browse the market for a new addition</div>
              </button>
              <button
                onClick={() => setView("sell")}
                className="bg-gradient-to-br from-red-900/40 to-red-950/40 border border-red-700/40 hover:border-red-500 rounded-xl p-4 text-left transition-all hover:scale-[1.01]"
              >
                <div className="text-2xl mb-1">💸</div>
                <div className="font-black text-red-300">Sell a Player</div>
                <div className="text-[10px] text-white mt-1">Free up budget — sells at 70% of value</div>
              </button>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-4">
              <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Current Squad ({squad.length}/14)</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {squad.map(p => (
                  <div key={p.name + p.club + p.clubYear} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-950 text-xs">
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${p.isSub ? "bg-purple-700" : getPositionColor(p.assignedPosition)} text-white w-7 text-center`}>
                      {p.isSub ? "SUB" : p.assignedPosition}
                    </span>
                    <span className="flex-1 text-white truncate">{p.name}</span>
                    <span className="text-white">{p.overall}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "sell" && (
          <div className="space-y-2">
            <button onClick={() => setView("hub")} className="text-xs text-white hover:text-gray-300 mb-3">← Back</button>
            <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Tap a player to sell</h3>
            <div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase mt-3 mb-1">Starters</div>
              {starters.map(p => (
                <button
                  key={p.name + p.club + p.clubYear}
                  onClick={() => handleSell(p)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 mb-1.5 rounded-lg bg-gray-900 hover:bg-red-950/30 border border-gray-800 hover:border-red-700/50 transition-all text-left"
                >
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-9 text-center`}>
                    {p.assignedPosition}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{p.name}</div>
                    <div className="text-[10px] text-white">{p.clubYear} · {p.overall} OVR</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-400">£{Math.round(playerPrice(p.overall) * 0.7)}M</div>
                    <div className="text-[9px] text-white">sell value</div>
                  </div>
                </button>
              ))}
              <div className="text-[10px] font-bold text-purple-400 uppercase mt-3 mb-1">Subs</div>
              {subs.map(p => (
                <button
                  key={p.name + p.club + p.clubYear}
                  onClick={() => handleSell(p)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 mb-1.5 rounded-lg bg-gray-900 hover:bg-red-950/30 border border-gray-800 hover:border-red-700/50 transition-all text-left"
                >
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-700 text-white w-9 text-center">SUB</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{p.name}</div>
                    <div className="text-[10px] text-white">{p.clubYear} · {p.overall} OVR</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-400">£{Math.round(playerPrice(p.overall) * 0.7)}M</div>
                    <div className="text-[9px] text-white">sell value</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "buy" && (
          <div className="space-y-3">
            <button onClick={() => { setView("hub"); setReplaceTarget(null); setMarketOptions(null); }} className="text-xs text-white hover:text-gray-300 mb-3">← Back</button>
            {replaceTarget && (
              <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 text-xs text-amber-200">
                Replacing <span className="font-bold">{replaceTarget.name}</span> ({replaceTarget.assignedPosition}). Pick a replacement below.
              </div>
            )}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-white">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Scouting the market...</span>
              </div>
            )}
            {marketOptions && (
              <div className="space-y-3">
                {marketOptions.map((mp, i) => {
                  const canAfford = mp.price <= budget;
                  return (
                    <button
                      key={i}
                      onClick={() => canAfford && handleBuy(mp)}
                      disabled={!canAfford}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        canAfford
                          ? "border-gray-700/50 bg-gray-900 hover:border-emerald-500/60 hover:scale-[1.01]"
                          : "border-gray-800 bg-gray-900/40 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center font-black border ${
                          mp.player.overall >= 90 ? "bg-amber-500/20 border-amber-500/40 text-amber-400" :
                          mp.player.overall >= 85 ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" :
                          mp.player.overall >= 80 ? "bg-blue-500/20 border-blue-500/40 text-blue-400" :
                          "bg-gray-800 border-gray-700 text-white"
                        }`}>
                          <span className="text-lg leading-none">{mp.player.overall}</span>
                          <span className="text-[9px] text-current opacity-60">OVR</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-white">{mp.player.name}</div>
                          <div className="text-xs text-white mt-0.5">{mp.club} · {mp.year}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-base font-black ${canAfford ? "text-emerald-400" : "text-red-400"}`}>£{mp.price}M</div>
                          {!canAfford && <div className="text-[9px] text-red-600">Over budget</div>}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button onClick={() => loadMarketFor(replaceTarget)} className="w-full text-xs text-white hover:text-gray-300 py-2">↻ Scout again</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Done CTA */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-black via-black to-transparent pt-6 pb-4 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => onComplete(squad, budget)}
            disabled={squad.length !== 14}
            className={`w-full font-black py-3.5 rounded-xl text-base tracking-wide transition-all ${
              squad.length === 14
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:scale-[1.01] shadow-xl shadow-amber-500/20"
                : "bg-gray-800 text-white cursor-not-allowed"
            }`}
          >
            {squad.length === 14 ? "Close Window — Back to Season" : `Squad must be 14 players (currently ${squad.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
