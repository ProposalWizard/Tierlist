"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { FORMATIONS, getPositionColor, formatSeasonYear } from "@/components/draft/formations";
import type { CLDraftSettings } from "./CLDraftSetup";
import type { PlayerAttributes } from "@/lib/seasonSimulator";

export interface CLDraftPlayer {
  name: string;
  overall: number;
  positions: string;
  club: string;
  clubYear: string;
  assignedPosition: string;
  sofifa_id: string;
  image_url: string | null;
  nationality: string;
  age: number;
  isSub?: boolean;
  attrs?: PlayerAttributes;
}

interface RosterPlayer {
  sofifa_id: string;
  name: string;
  overall: number;
  potential: number;
  positions: string;
  age: number;
  image_url: string | null;
  nationality: string;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  finishing: number;
  positioning: number;
  crossing: number;
  vision: number;
  longShots: number;
  shortPassing: number;
  longPassing: number;
  heading: number;
  interceptions: number;
  standingTackle: number;
  marking: number;
  reactions: number;
  sprintSpeed: number;
  gkDiving: number;
  gkPositioning: number;
  gkReflexes: number;
}

interface CLClubOption {
  name: string;
  displayName: string;
  country: string;
  strength: number;
  seasons: { clSeason: string; fifaYear: number }[];
}

interface SpinResult {
  club: CLClubOption;
  season: { clSeason: string; fifaYear: number };
  roster: RosterPlayer[];
}

interface Props {
  settings: CLDraftSettings;
  onComplete: (players: CLDraftPlayer[]) => void;
}

function classifyPos(pos: string): "GK" | "DEF" | "MID" | "ATT" {
  const p = pos.toUpperCase().trim();
  if (p === "GK") return "GK";
  if (["CB", "RB", "LB", "RWB", "LWB", "SW"].includes(p)) return "DEF";
  if (["CDM", "CM", "CAM", "RM", "LM", "DM"].includes(p)) return "MID";
  return "ATT";
}

function statColor(val: number): string {
  if (val >= 85) return "text-emerald-400";
  if (val >= 75) return "text-yellow-400";
  if (val >= 60) return "text-orange-400";
  return "text-white";
}

export default function CLDraftPick({ settings, onComplete }: Props) {
  const formation = FORMATIONS.find(f => f.name === settings.formation) ?? FORMATIONS[1];
  const maxPicks = 14;

  const [pickedPlayers, setPickedPlayers] = useState<CLDraftPlayer[]>([]);
  const [phase, setPhase] = useState<"spin" | "spinning" | "pick" | "assign">("spin");
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinDisplay, setSpinDisplay] = useState<{ displayName: string; season: string } | null>(null);
  const [spinItems, setSpinItems] = useState<{ displayName: string; season: string }[]>([]);
  const [spinAnimating, setSpinAnimating] = useState(false);
  const [pendingPlayer, setPendingPlayer] = useState<RosterPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clubs, setClubs] = useState<CLClubOption[] | null>(null);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [usedClubYears, setUsedClubYears] = useState<Set<string>>(new Set());
  const spinContainerRef = useRef<HTMLDivElement>(null);

  // Load CL clubs
  useEffect(() => {
    setClubsLoading(true);
    fetch(`/api/cl-draft/clubs?eraStart=${settings.eraStart}&eraEnd=${settings.eraEnd}`)
      .then(r => r.json())
      .then(d => {
        if (d.clubs?.length > 0) setClubs(d.clubs);
        else setError(d.error || "No CL clubs found with roster data");
      })
      .catch(e => setError(e.message))
      .finally(() => setClubsLoading(false));
  }, [settings.eraStart, settings.eraEnd]);

  const getRandomClubSeason = useCallback((): { club: CLClubOption; season: { clSeason: string; fifaYear: number } } | null => {
    if (!clubs || clubs.length === 0) return null;
    const allPairs: { club: CLClubOption; season: { clSeason: string; fifaYear: number } }[] = [];
    for (const club of clubs) {
      for (const season of club.seasons) {
        if (!usedClubYears.has(`${club.name}-${season.fifaYear}`)) {
          allPairs.push({ club, season });
        }
      }
    }
    if (allPairs.length === 0) return null;
    // Balanced: pick a year first, then club
    const byYear = new Map<number, typeof allPairs>();
    for (const p of allPairs) {
      if (!byYear.has(p.season.fifaYear)) byYear.set(p.season.fifaYear, []);
      byYear.get(p.season.fifaYear)!.push(p);
    }
    const years = Array.from(byYear.keys());
    const year = years[Math.floor(Math.random() * years.length)];
    const options = byYear.get(year)!;
    return options[Math.floor(Math.random() * options.length)];
  }, [clubs, usedClubYears]);

  const generateSpinItems = useCallback((target: { displayName: string; season: string }) => {
    const items: { displayName: string; season: string }[] = [];
    for (let i = 0; i < 24; i++) {
      const rand = getRandomClubSeason();
      if (rand) items.push({ displayName: rand.club.displayName, season: rand.season.clSeason });
      else items.push(target);
    }
    items.push(target);
    return items;
  }, [getRandomClubSeason]);

  const handleSpin = useCallback(async () => {
    setError(null);
    setSpinning(true);
    setPhase("spinning");
    const target = getRandomClubSeason();
    if (!target) {
      setError("No more available clubs");
      setSpinning(false);
      setPhase("spin");
      return;
    }

    const displayTarget = { displayName: target.club.displayName, season: target.season.clSeason };
    const items = generateSpinItems(displayTarget);
    setSpinItems(items);
    setSpinAnimating(false);
    setSpinDisplay(items[0]);

    requestAnimationFrame(() => requestAnimationFrame(() => setSpinAnimating(true)));

    setTimeout(async () => {
      setSpinDisplay(displayTarget);
      // Fetch roster
      try {
        const res = await fetch(`/api/draft/roster?club=${encodeURIComponent(target.club.name)}&year=${target.season.fifaYear}`);
        const data = await res.json();
        if (data.roster?.length > 0) {
          setSpinResult({ club: target.club, season: target.season, roster: data.roster });
          setPhase("pick");
        } else {
          setError(`No players found for ${target.club.displayName} ${target.season.clSeason}`);
          setPhase("spin");
        }
      } catch {
        setError("Failed to fetch roster");
        setPhase("spin");
      }
      setSpinning(false);
    }, 2200);
  }, [getRandomClubSeason, generateSpinItems]);

  const buildAttrs = (p: RosterPlayer): PlayerAttributes => ({
    pace: p.pace, shooting: p.shooting, passing: p.passing, dribbling: p.dribbling,
    defending: p.defending, physical: p.physical, finishing: p.finishing, positioning: p.positioning,
    crossing: p.crossing, vision: p.vision, longShots: p.longShots, shortPassing: p.shortPassing,
    longPassing: p.longPassing, heading: p.heading, interceptions: p.interceptions,
    standingTackle: p.standingTackle, marking: p.marking, reactions: p.reactions,
    sprintSpeed: p.sprintSpeed, gkDiving: p.gkDiving, gkPositioning: p.gkPositioning,
    gkReflexes: p.gkReflexes,
  });

  const handlePickPlayer = (player: RosterPlayer) => {
    setPendingPlayer(player);
    setPhase("assign");
  };

  const handleAssignSlot = (slotIdx: number) => {
    if (!pendingPlayer || !spinResult) return;
    const slot = slotIdx < 11 ? formation.slots[slotIdx] : formation.slots[0];
    const isSub = slotIdx >= 11;

    const newPlayer: CLDraftPlayer = {
      name: pendingPlayer.name,
      overall: pendingPlayer.overall,
      positions: pendingPlayer.positions,
      club: spinResult.club.displayName,
      clubYear: spinResult.season.clSeason,
      assignedPosition: isSub ? pendingPlayer.positions.split(",")[0].trim() : slot.position,
      sofifa_id: pendingPlayer.sofifa_id,
      image_url: pendingPlayer.image_url,
      nationality: pendingPlayer.nationality,
      age: pendingPlayer.age,
      isSub,
      attrs: buildAttrs(pendingPlayer),
    };

    const updated = [...pickedPlayers, newPlayer];
    setPickedPlayers(updated);
    setUsedClubYears(prev => new Set(prev).add(`${spinResult.club.name}-${spinResult.season.fifaYear}`));
    setPendingPlayer(null);
    setSpinResult(null);
    setSpinDisplay(null);

    if (updated.length >= maxPicks) {
      onComplete(updated);
    } else {
      setPhase("spin");
    }
  };

  // Determine which slots are still available
  const filledSlots = new Set<number>();
  let subCount = 0;
  for (const p of pickedPlayers) {
    if (p.isSub) {
      subCount++;
    } else {
      const idx = formation.slots.findIndex((s, i) => !filledSlots.has(i) && s.position === p.assignedPosition);
      if (idx >= 0) filledSlots.add(idx);
    }
  }

  const availableSlots: { idx: number; label: string; position: string }[] = [];
  for (let i = 0; i < 11; i++) {
    if (!filledSlots.has(i)) {
      availableSlots.push({ idx: i, label: formation.slots[i].label, position: formation.slots[i].position });
    }
  }
  if (subCount < 3) {
    availableSlots.push({ idx: 11 + subCount, label: "SUB", position: "ANY" });
  }

  if (clubsLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Loading Champions League clubs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Champions League Draft</h1>
          <p className="text-gray-400">Pick {pickedPlayers.length + 1} of {maxPicks}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded p-3 mb-4 text-center text-red-200">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
          </div>
        )}

        {/* Spin phase */}
        {(phase === "spin" || phase === "spinning") && (
          <div className="flex flex-col items-center space-y-6">
            {/* Spin display */}
            <div
              ref={spinContainerRef}
              className="relative w-full max-w-md h-24 overflow-hidden bg-gray-800 rounded-xl border-2 border-blue-500/50"
            >
              {spinItems.length > 0 ? (
                <div
                  className={`flex flex-col transition-transform ${spinAnimating ? "duration-[2200ms] ease-[cubic-bezier(0.15,0.85,0.35,1)]" : ""}`}
                  style={{ transform: spinAnimating ? `translateY(-${(spinItems.length - 1) * 96}px)` : "translateY(0)" }}
                >
                  {spinItems.map((item, i) => (
                    <div key={i} className="h-24 flex items-center justify-center text-center px-4 shrink-0">
                      <div>
                        <div className="text-xl font-bold">{item.displayName}</div>
                        <div className="text-blue-400 text-sm">{item.season}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : spinDisplay ? (
                <div className="h-24 flex items-center justify-center text-center">
                  <div>
                    <div className="text-xl font-bold">{spinDisplay.displayName}</div>
                    <div className="text-blue-400 text-sm">{spinDisplay.season}</div>
                  </div>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-gray-500">
                  Press Spin to get a team
                </div>
              )}
            </div>

            {phase === "spin" && (
              <button
                onClick={handleSpin}
                disabled={spinning}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-lg font-bold transition-colors"
              >
                🎰 Spin
              </button>
            )}
            {phase === "spinning" && (
              <p className="text-gray-400 animate-pulse">Spinning...</p>
            )}
          </div>
        )}

        {/* Pick phase — show roster */}
        {phase === "pick" && spinResult && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold">{spinResult.club.displayName}</h2>
              <p className="text-blue-400">{spinResult.season.clSeason} • {spinResult.club.country}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {spinResult.roster
                .sort((a, b) => b.overall - a.overall)
                .map(player => {
                  const mainPos = player.positions.split(",")[0].trim();
                  const posClass = classifyPos(mainPos);
                  return (
                    <button
                      key={player.sofifa_id}
                      onClick={() => handlePickPlayer(player)}
                      className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-left transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                        posClass === "GK" ? "bg-yellow-500" : posClass === "DEF" ? "bg-blue-500" : posClass === "MID" ? "bg-green-500" : "bg-red-500"
                      }`}>
                        {player.overall}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{player.name}</div>
                        <div className="text-xs text-gray-400">{player.positions} • {player.nationality}</div>
                      </div>
                      <div className="text-right text-xs space-y-0.5">
                        <div>PAC <span className={statColor(player.pace)}>{player.pace || "-"}</span></div>
                        <div>SHO <span className={statColor(player.shooting)}>{player.shooting || "-"}</span></div>
                        <div>DEF <span className={statColor(player.defending)}>{player.defending || "-"}</span></div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Assign phase — pick a slot */}
        {phase === "assign" && pendingPlayer && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold">Assign {pendingPlayer.name}</h2>
              <p className="text-gray-400">{pendingPlayer.positions} • OVR {pendingPlayer.overall}</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-w-md mx-auto">
              {availableSlots.map(slot => (
                <button
                  key={slot.idx}
                  onClick={() => handleAssignSlot(slot.idx)}
                  className="py-3 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-center transition-colors"
                >
                  <div className={`text-sm font-bold ${slot.position !== "ANY" ? getPositionColor(slot.position).replace("bg-", "text-").replace("500", "400") : "text-purple-400"}`}>
                    {slot.label}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setPendingPlayer(null); setPhase("pick"); }}
              className="block mx-auto text-gray-400 hover:text-white text-sm"
            >
              ← Back to roster
            </button>
          </div>
        )}

        {/* Picked players grid */}
        {pickedPlayers.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Your Squad ({pickedPlayers.length}/{maxPicks})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {pickedPlayers.map((p, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                      {p.assignedPosition}
                    </span>
                    <span className="font-semibold truncate">{p.name}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {p.overall} OVR • {p.club} {p.clubYear}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
