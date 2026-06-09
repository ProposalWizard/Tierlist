"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { FORMATIONS, getPositionColor, getPositionTextColor } from "./formations";
import type { DraftSettings, DraftPlayer } from "@/app/draft/page";

interface RosterPlayer {
  sofifa_id: string;
  name: string;
  overall: number;
  potential: number;
  positions: string;
  age: number;
  image_url: string | null;
  nationality: string;
}

interface SpinResult {
  club: string;
  year: number;
  roster: RosterPlayer[];
}

interface Props {
  settings: DraftSettings;
  onComplete: (players: DraftPlayer[]) => void;
  onBack?: () => void;
}

export default function DraftPick({ settings, onComplete, onBack }: Props) {
  const formation = FORMATIONS.find((f) => f.name === settings.formation) ?? FORMATIONS[0];
  const [pickedPlayers, setPickedPlayers] = useState<DraftPlayer[]>([]);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [phase, setPhase] = useState<"spin" | "spinning" | "reveal" | "pick">("spin");
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinDisplay, setSpinDisplay] = useState<{ club: string; year: number } | null>(null);
  const [usedClubYears, setUsedClubYears] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [availableClubs, setAvailableClubs] = useState<{ name: string; seasons: number[] }[] | null>(null);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [spinItems, setSpinItems] = useState<{ club: string; year: number }[]>([]);
  const [spinAnimating, setSpinAnimating] = useState(false);
  const spinContainerRef = useRef<HTMLDivElement>(null);

  const loadClubs = useCallback(() => {
    setClubsLoading(true);
    setError(null);
    fetch("/api/draft/clubs")
      .then((r) => r.json())
      .then((d) => {
        if (d.clubs && d.clubs.length > 0) {
          setAvailableClubs(d.clubs);
        } else if (d.error) {
          setError(`Failed to load clubs: ${d.error}`);
        } else {
          setError("No Premier League clubs found in the database. Import player data first.");
        }
      })
      .catch((e) => {
        setError(`Failed to load clubs: ${e.message}`);
      })
      .finally(() => setClubsLoading(false));
  }, []);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  const getRandomClubYear = useCallback((): { club: string; year: number } | null => {
    if (!availableClubs || availableClubs.length === 0) return null;

    const validClubs = availableClubs.filter((c) => {
      const validSeasons = c.seasons.filter(
        (y) => y >= settings.eraStart && y <= settings.eraEnd
      );
      return validSeasons.some(
        (y) => !usedClubYears.has(`${c.name}-${y}`)
      );
    });

    if (validClubs.length === 0) return null;

    const club = validClubs[Math.floor(Math.random() * validClubs.length)];
    const validSeasons = club.seasons.filter(
      (y) =>
        y >= settings.eraStart &&
        y <= settings.eraEnd &&
        !usedClubYears.has(`${club.name}-${y}`)
    );

    if (validSeasons.length === 0) return null;
    const year = validSeasons[Math.floor(Math.random() * validSeasons.length)];
    return { club: club.name, year };
  }, [availableClubs, settings.eraStart, settings.eraEnd, usedClubYears]);

  const generateSpinItems = useCallback((target: { club: string; year: number }): { club: string; year: number }[] => {
    const items: { club: string; year: number }[] = [];
    // Generate 24 random items, then place target at the end
    for (let i = 0; i < 24; i++) {
      const rand = getRandomClubYear();
      if (rand) {
        items.push(rand);
      } else {
        items.push(target);
      }
    }
    items.push(target);
    return items;
  }, [getRandomClubYear]);

  const handleSpin = useCallback(async () => {
    setError(null);
    setSpinning(true);
    setPhase("spinning");

    const target = getRandomClubYear();
    if (!target) {
      setError("No more available clubs in this era range");
      setSpinning(false);
      setPhase("spin");
      return;
    }

    const items = generateSpinItems(target);
    setSpinItems(items);
    setSpinAnimating(false);
    setSpinDisplay(items[0]);

    // Start the CSS transition after a frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSpinAnimating(true);
      });
    });

    // After the animation ends, show the reveal
    setTimeout(() => {
      setSpinDisplay(target);
      setPhase("reveal");
      fetchRoster(target.club, target.year);
    }, 3000);
  }, [getRandomClubYear, generateSpinItems]);

  const handleRespin = useCallback(() => {
    setSpinResult(null);
    setSpinDisplay(null);
    setSpinAnimating(false);
    setPhase("spin");
    setSpinning(false);
    // Immediately trigger a new spin
    setTimeout(() => {
      handleSpin();
    }, 50);
  }, [handleSpin]);

  const fetchRoster = async (club: string, year: number) => {
    try {
      const res = await fetch(
        `/api/draft/roster?club=${encodeURIComponent(club)}&year=${year}`
      );
      const data = await res.json();
      if (data.roster && data.roster.length > 0) {
        setSpinResult({ club, year, roster: data.roster });
        // Phase stays as "reveal" until user clicks "View Roster"
      } else {
        setError(`No players found for ${club} ${year}`);
        setPhase("spin");
      }
    } catch {
      setError("Failed to fetch roster");
      setPhase("spin");
    }
    setSpinning(false);
  };

  const handlePickPlayer = useCallback(
    (player: RosterPlayer) => {
      const slot = formation.slots[currentSlotIndex];
      const clubAbbr = spinResult!.club
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 3);

      const drafted: DraftPlayer = {
        name: player.name,
        overall: player.overall,
        positions: player.positions,
        club: spinResult!.club,
        clubYear: `${clubAbbr} ${spinResult!.year}`,
        assignedPosition: slot.label,
        sofifa_id: player.sofifa_id,
        image_url: player.image_url,
        nationality: player.nationality,
      };

      const newPicked = [...pickedPlayers, drafted];
      setPickedPlayers(newPicked);
      setUsedClubYears(
        (prev) => new Set([...Array.from(prev), `${spinResult!.club}-${spinResult!.year}`])
      );

      if (newPicked.length >= 11) {
        onComplete(newPicked);
      } else {
        setCurrentSlotIndex(currentSlotIndex + 1);
        setSpinResult(null);
        setSpinDisplay(null);
        setSpinAnimating(false);
        setPhase("spin");
      }
    },
    [
      currentSlotIndex,
      formation.slots,
      onComplete,
      pickedPlayers,
      spinResult,
    ]
  );

  const currentSlot = formation.slots[currentSlotIndex];

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header with progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {onBack && pickedPlayers.length === 0 && (
              <button
                onClick={onBack}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition"
                aria-label="Back to setup"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                <span className="text-white">PL</span>{" "}
                <span className="text-emerald-400">DRAFT</span>
              </h1>
              <p className="text-gray-500 text-xs">{settings.formation}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              Picking for
            </div>
            <div className={`text-lg font-extrabold ${getPositionTextColor(currentSlot?.label ?? "")}`}>
              {currentSlot?.label}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex gap-1">
            {Array.from({ length: 11 }, (_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < pickedPlayers.length
                    ? "bg-emerald-500"
                    : i === currentSlotIndex
                      ? "bg-emerald-500/40 animate-pulse"
                      : "bg-gray-800"
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-bold text-gray-500 tabular-nums">
            {pickedPlayers.length}/11
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pitch with picked players — on mobile, show below the action area */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="relative w-full aspect-[4/3] lg:aspect-[3/4] max-h-[50vh] lg:max-h-none mx-auto rounded-xl overflow-hidden border border-emerald-800/40">
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
              const picked = pickedPlayers[i];
              const isCurrent = i === currentSlotIndex && !picked;
              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-300"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold border-2 transition-all duration-300 ${
                      picked
                        ? `${getPositionColor(slot.label)} border-white/80 text-white shadow-lg`
                        : isCurrent
                          ? "bg-emerald-500/80 border-emerald-300 text-white animate-pulse shadow-lg shadow-emerald-500/30"
                          : "bg-gray-800/80 border-gray-600/50 text-gray-500"
                    }`}
                  >
                    {picked ? (
                      <span className="text-sm font-black">{picked.overall}</span>
                    ) : (
                      slot.label
                    )}
                  </div>
                  <span
                    className={`text-[8px] mt-0.5 max-w-[64px] truncate text-center font-medium ${
                      picked ? "text-white/90" : "text-gray-600"
                    }`}
                  >
                    {picked ? picked.name.split(" ").pop() : ""}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Picked list — compact on mobile, full on desktop */}
          {pickedPlayers.length > 0 && (
            <div className="mt-3 hidden lg:block space-y-1">
              {pickedPlayers.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm bg-gray-900/80 border border-gray-800/50 rounded-lg px-3 py-1.5 hover:bg-gray-800/80 transition"
                >
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(
                      p.assignedPosition
                    )} text-white`}
                  >
                    {p.assignedPosition}
                  </span>
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                  <span className="font-extrabold text-emerald-400 text-sm">{p.overall}</span>
                </div>
              ))}
            </div>
          )}
          {pickedPlayers.length > 0 && (
            <div className="mt-3 lg:hidden flex gap-1.5 overflow-x-auto pb-1">
              {pickedPlayers.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-xs bg-gray-900/80 border border-gray-800/50 rounded-lg px-2 py-1 shrink-0"
                >
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white`}>
                    {p.assignedPosition}
                  </span>
                  <span className="font-medium">{p.name.split(" ").pop()}</span>
                  <span className="font-extrabold text-emerald-400">{p.overall}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Spin & Pick — on mobile, show first */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          {error && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 mb-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {phase === "spin" && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-6 text-center">
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4 ${
                  getPositionTextColor(currentSlot?.label ?? "")
                } border-current/20 bg-current/5`}>
                  <span className="text-xs font-bold tracking-widest uppercase">
                    Pick {currentSlotIndex + 1} of 11
                  </span>
                </div>
                <p className="text-gray-400 text-sm">
                  Spin to get a random Premier League club & season
                </p>
              </div>
              {!availableClubs && !clubsLoading && error ? (
                <button
                  onClick={loadClubs}
                  className="px-10 py-4 bg-red-800 hover:bg-red-700 rounded-2xl text-lg font-extrabold transition-all"
                >
                  Retry Loading Clubs
                </button>
              ) : (
                <button
                  onClick={handleSpin}
                  disabled={!availableClubs || clubsLoading}
                  className="group relative px-16 py-5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-gray-700 disabled:to-gray-700 rounded-2xl text-xl font-extrabold transition-all duration-300 shadow-lg shadow-emerald-900/50 hover:shadow-emerald-800/60 hover:scale-105 active:scale-95"
                >
                  {availableClubs ? (
                    <span className="flex items-center gap-3">
                      <svg className="w-6 h-6 transition-transform group-hover:rotate-180 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      SPIN
                    </span>
                  ) : (
                    "Loading clubs..."
                  )}
                </button>
              )}
            </div>
          )}

          {phase === "spinning" && (
            <div className="flex flex-col items-center justify-center py-16">
              {/* Slot machine container */}
              <div className="relative w-full max-w-md h-24 overflow-hidden rounded-xl border border-emerald-700/40 bg-gray-900/80 mb-6">
                {/* Top fade */}
                <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-gray-900 to-transparent z-10 pointer-events-none" />
                {/* Bottom fade */}
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-900 to-transparent z-10 pointer-events-none" />
                {/* Center highlight line */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 border-y border-emerald-500/40 bg-emerald-500/5 z-10 pointer-events-none" />

                {/* Scrolling items */}
                <div
                  ref={spinContainerRef}
                  className="flex flex-col items-center"
                  style={{
                    transform: spinAnimating
                      ? `translateY(-${(spinItems.length - 1) * 96 - 12}px)`
                      : "translateY(12px)",
                    transition: spinAnimating
                      ? "transform 2.8s cubic-bezier(0.15, 0.85, 0.25, 1)"
                      : "none",
                  }}
                >
                  {spinItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center justify-center h-24 shrink-0"
                    >
                      <div className="text-2xl font-extrabold text-white tracking-tight">
                        {item.club}
                      </div>
                      <div className="text-sm font-bold text-emerald-400">
                        {item.year}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-gray-500 text-sm animate-pulse">Spinning...</p>
            </div>
          )}

          {phase === "reveal" && spinDisplay && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-center mb-8 animate-[fadeScaleIn_0.5s_ease-out]"
                style={{ animation: "fadeScaleIn 0.5s ease-out" }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/30 border border-emerald-700/40 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 tracking-widest uppercase">Result</span>
                </div>
                <h2 className="text-4xl font-black text-white mb-2 tracking-tight">
                  {spinDisplay.club}
                </h2>
                <p className="text-2xl font-bold text-emerald-400">
                  {spinDisplay.year >= 2024 ? "FC" : "FIFA"}{" "}
                  {String(spinDisplay.year % 100).padStart(2, "0")}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleRespin}
                  disabled={spinning}
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 text-gray-300"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Re-spin
                  </span>
                </button>
                <button
                  onClick={() => { if (spinResult) setPhase("pick"); }}
                  disabled={!spinResult}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-gray-700 disabled:to-gray-700 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-900/40"
                >
                  {spinResult ? "View Roster" : "Loading..."}
                </button>
              </div>
            </div>
          )}

          {phase === "pick" && spinResult && (
            <div>
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <h2 className="text-2xl font-extrabold tracking-tight">{spinResult.club}</h2>
                  <span className="px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 text-sm font-bold">
                    {spinResult.year >= 2024 ? "FC" : "FIFA"}{" "}
                    {String(spinResult.year % 100).padStart(2, "0")}
                  </span>
                </div>
                <p className="text-gray-500 text-sm">
                  Pick a player for{" "}
                  <span className={`font-bold ${getPositionTextColor(currentSlot?.label ?? "")}`}>
                    {currentSlot?.label}
                  </span>
                  {" "}&middot;{" "}
                  <span className="text-emerald-500/60 font-medium">compatible positions highlighted</span>
                </p>
              </div>

              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                {spinResult.roster.map((player) => {
                  const playerPositions = player.positions.split(",").map((p) => p.trim());
                  const isCompatible = currentSlot?.compatiblePositions.some((cp) =>
                    playerPositions.includes(cp)
                  );
                  const alreadyPicked = pickedPlayers.some(
                    (p) => p.sofifa_id === player.sofifa_id
                  );

                  return (
                    <button
                      key={player.sofifa_id}
                      onClick={() => handlePickPlayer(player)}
                      disabled={alreadyPicked}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 group ${
                        alreadyPicked
                          ? "opacity-20 cursor-not-allowed bg-gray-900/50"
                          : isCompatible
                            ? "bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-700/40 hover:border-emerald-600/60 hover:scale-[1.01]"
                            : "bg-gray-900/50 hover:bg-gray-800/80 border border-transparent hover:border-gray-700/50"
                      }`}
                    >
                      {/* OVR badge */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-extrabold text-sm shrink-0 ${
                        player.overall >= 85
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : player.overall >= 75
                            ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                            : "bg-gray-800/80 text-gray-400 border border-gray-700/40"
                      }`}>
                        {player.overall}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate group-hover:text-white transition-colors">
                          {player.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {player.nationality} &middot; Age {player.age}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {playerPositions.map((pos) => (
                          <span
                            key={pos}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              currentSlot?.compatiblePositions.includes(pos)
                                ? getPositionColor(pos) + " text-white"
                                : "bg-gray-800 text-gray-500"
                            }`}
                          >
                            {pos}
                          </span>
                        ))}
                      </div>
                      {isCompatible && !alreadyPicked && (
                        <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase shrink-0">
                          FIT
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline keyframes for the reveal animation */}
      <style jsx>{`
        @keyframes fadeScaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
