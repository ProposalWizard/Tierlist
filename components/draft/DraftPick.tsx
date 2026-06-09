"use client";
import { useState, useCallback, useEffect } from "react";
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
}

const PL_CLUBS = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton & Hove Albion",
  "Burnley", "Chelsea", "Crystal Palace", "Everton", "Fulham",
  "Ipswich Town", "Leeds United", "Leicester City", "Liverpool",
  "Manchester City", "Manchester United", "Newcastle United",
  "Nottingham Forest", "Sheffield United", "Southampton",
  "Tottenham Hotspur", "Watford", "West Bromwich Albion", "West Ham United",
  "Wolverhampton Wanderers", "Norwich City", "Swansea City",
  "Stoke City", "Sunderland", "Middlesbrough", "Hull City",
  "Cardiff City", "Queens Park Rangers", "Blackburn Rovers",
  "Bolton Wanderers", "Wigan Athletic", "Birmingham City",
  "Blackpool", "Reading", "Portsmouth", "Derby County",
];

export default function DraftPick({ settings, onComplete }: Props) {
  const formation = FORMATIONS.find((f) => f.name === settings.formation) ?? FORMATIONS[0];
  const [pickedPlayers, setPickedPlayers] = useState<DraftPlayer[]>([]);
  const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
  const [phase, setPhase] = useState<"spin" | "spinning" | "pick">("spin");
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinDisplay, setSpinDisplay] = useState<{ club: string; year: number } | null>(null);
  const [usedClubYears, setUsedClubYears] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [availableClubs, setAvailableClubs] = useState<{ name: string; seasons: number[] }[] | null>(null);

  useEffect(() => {
    fetch("/api/draft/clubs")
      .then((r) => r.json())
      .then((d) => {
        if (d.clubs) setAvailableClubs(d.clubs);
      })
      .catch(() => {});
  }, []);

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

    let spinCount = 0;
    const spinInterval = setInterval(() => {
      const randClub = getRandomClubYear();
      if (randClub) setSpinDisplay(randClub);
      spinCount++;
      if (spinCount >= 20) {
        clearInterval(spinInterval);
        setSpinDisplay(target);
        fetchRoster(target.club, target.year);
      }
    }, 100);
  }, [getRandomClubYear]);

  const fetchRoster = async (club: string, year: number) => {
    try {
      const res = await fetch(
        `/api/draft/roster?club=${encodeURIComponent(club)}&year=${year}`
      );
      const data = await res.json();
      if (data.roster && data.roster.length > 0) {
        setSpinResult({ club, year, roster: data.roster });
        setPhase("pick");
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
      const yy = String(spinResult!.year % 100).padStart(2, "0");
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
        (prev) => new Set([...prev, `${spinResult!.club}-${spinResult!.year}`])
      );

      if (newPicked.length >= 11) {
        onComplete(newPicked);
      } else {
        setCurrentSlotIndex(currentSlotIndex + 1);
        setSpinResult(null);
        setSpinDisplay(null);
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Premier League Draft</h1>
          <p className="text-gray-400 text-sm">
            Pick {currentSlotIndex + 1} of 11 — {settings.formation}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Picking for</div>
          <div className={`text-lg font-bold ${getPositionTextColor(currentSlot?.label ?? "")}`}>
            {currentSlot?.label}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pitch with picked players */}
        <div className="lg:col-span-1">
          <div className="relative w-full aspect-[3/4] bg-green-900/30 rounded-xl border border-green-800/50 overflow-hidden">
            <div className="absolute inset-x-[10%] top-[5%] bottom-[5%] border border-green-700/40 rounded" />
            <div className="absolute inset-x-[10%] top-[5%] h-[18%] border-b border-green-700/40" />
            <div className="absolute inset-x-[10%] bottom-[5%] h-[18%] border-t border-green-700/40" />
            <div className="absolute left-1/2 top-[5%] bottom-[5%] w-px bg-green-700/40" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-green-700/40" />

            {formation.slots.map((slot, i) => {
              const picked = pickedPlayers[i];
              const isCurrent = i === currentSlotIndex && !picked;
              return (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-bold border-2 transition ${
                      picked
                        ? `${getPositionColor(slot.label)} border-white text-white`
                        : isCurrent
                          ? "bg-yellow-500/80 border-yellow-300 text-white animate-pulse"
                          : "bg-gray-700/80 border-gray-600 text-gray-400"
                    }`}
                  >
                    {picked ? picked.overall : slot.label}
                  </div>
                  <span
                    className={`text-[8px] mt-0.5 max-w-[60px] truncate text-center ${
                      picked ? "text-white" : "text-gray-500"
                    }`}
                  >
                    {picked ? picked.name.split(" ").pop() : slot.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Picked list */}
          <div className="mt-4 space-y-1">
            {pickedPlayers.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm bg-gray-900/50 rounded px-2 py-1"
              >
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(
                    p.assignedPosition
                  )}`}
                >
                  {p.assignedPosition}
                </span>
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-gray-500 text-xs">{p.clubYear}</span>
                <span className="font-bold text-green-400">{p.overall}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Spin & Pick */}
        <div className="lg:col-span-2">
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {phase === "spin" && (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-gray-400 mb-2 text-sm">
                Position: <span className={`font-bold ${getPositionTextColor(currentSlot?.label ?? "")}`}>{currentSlot?.label}</span>
              </p>
              <p className="text-gray-500 mb-8 text-sm">
                Spin to get a random Premier League club & season
              </p>
              <button
                onClick={handleSpin}
                disabled={!availableClubs}
                className="px-12 py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 rounded-xl text-xl font-bold transition"
              >
                {availableClubs ? "SPIN" : "Loading clubs..."}
              </button>
            </div>
          )}

          {phase === "spinning" && spinDisplay && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="text-4xl font-bold mb-2 animate-pulse">
                {spinDisplay.club}
              </div>
              <div className="text-2xl text-green-400 font-bold">
                {spinDisplay.year}
              </div>
            </div>
          )}

          {phase === "pick" && spinResult && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">{spinResult.club}</h2>
                <p className="text-green-400 text-lg font-bold">
                  {spinResult.year >= 2024 ? "FC" : "FIFA"}{" "}
                  {String(spinResult.year % 100).padStart(2, "0")}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Pick a player for{" "}
                  <span className={`font-bold ${getPositionTextColor(currentSlot?.label ?? "")}`}>
                    {currentSlot?.label}
                  </span>
                </p>
              </div>

              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
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
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                        alreadyPicked
                          ? "opacity-30 cursor-not-allowed bg-gray-900"
                          : isCompatible
                            ? "bg-green-900/30 hover:bg-green-900/50 border border-green-800/50"
                            : "bg-gray-900/50 hover:bg-gray-800"
                      }`}
                    >
                      <div className="w-8 text-center">
                        <span
                          className={`text-lg font-bold ${
                            player.overall >= 85
                              ? "text-green-400"
                              : player.overall >= 75
                                ? "text-yellow-400"
                                : "text-gray-400"
                          }`}
                        >
                          {player.overall}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{player.name}</div>
                        <div className="text-xs text-gray-500">
                          {player.nationality} &middot; Age {player.age}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {playerPositions.map((pos) => (
                          <span
                            key={pos}
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              currentSlot?.compatiblePositions.includes(pos)
                                ? getPositionColor(pos) + " text-white"
                                : "bg-gray-700 text-gray-400"
                            }`}
                          >
                            {pos}
                          </span>
                        ))}
                      </div>
                      {isCompatible && (
                        <span className="text-green-400 text-xs">FIT</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
