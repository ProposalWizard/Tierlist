"use client";

import { useState, useEffect } from "react";
import type { BDCareer, BDSeason as BDSeasonData } from "@/lib/ballonDorTypes";
import { initSeason, finalizeSeason, developPlayer, PL_CLUBS } from "@/lib/ballonDorEngine";
import BDSetup from "./BDSetup";
import BDSeason from "./BDSeason";
import BDCeremony from "./BDCeremony";

const STORAGE_KEY = "ballon-dor-career";

function loadCareer(): BDCareer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCareer(career: BDCareer) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(career));
}

export default function BallonDorGame() {
  const [career, setCareer] = useState<BDCareer | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCareer(loadCareer());
    setLoaded(true);
  }, []);

  function handleSetupComplete(newCareer: BDCareer) {
    saveCareer(newCareer);
    setCareer(newCareer);
  }

  function handleSeasonUpdate(updated: BDSeasonData) {
    if (!career) return;
    const allDone = updated.events.every(e => e.chosenId);
    let finalSeason = updated;
    if (allDone && updated.phase !== 'ceremony' && updated.phase !== 'done') {
      finalSeason = finalizeSeason(career.player, updated);
    }
    const newCareer: BDCareer = { ...career, current: finalSeason };
    saveCareer(newCareer);
    setCareer(newCareer);
  }

  function handleCeremonyComplete() {
    if (!career?.current?.ceremony) return;
    const season = career.current;
    const rank = season.ceremony!.playerRank;
    const won = rank === 1;
    const completedSeason = { ...season, phase: 'done' as const };
    const newPlayer = developPlayer(career.player, season);
    const newCareer: BDCareer = {
      ...career,
      player: newPlayer,
      seasons: [...career.seasons, completedSeason],
      current: null,
      bdoWins: career.bdoWins + (won ? 1 : 0),
      lastBdoRank: rank,
    };
    saveCareer(newCareer);
    setCareer(newCareer);
  }

  function startNextSeason(clubId?: string) {
    if (!career) return;
    const club = clubId
      ? PL_CLUBS.find((c: { id: string }) => c.id === clubId) ?? career.seasons.at(-1)?.club ?? PL_CLUBS[0]
      : career.seasons.at(-1)?.club ?? PL_CLUBS[0];
    const nextNum = career.seasons.length + 1;
    const season = initSeason(career.player, club, nextNum);
    const newCareer: BDCareer = { ...career, current: season };
    saveCareer(newCareer);
    setCareer(newCareer);
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY);
    setCareer(null);
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  // No career — setup
  if (!career) {
    return <BDSetup onComplete={handleSetupComplete} />;
  }

  // Season in progress
  if (career.current && career.current.phase !== 'done') {
    if (career.current.phase === 'ceremony') {
      return (
        <BDCeremony
          season={career.current}
          player={career.player}
          onComplete={handleCeremonyComplete}
        />
      );
    }
    return (
      <BDSeason
        season={career.current}
        player={career.player}
        onUpdate={handleSeasonUpdate}
      />
    );
  }

  // Between seasons — show recap and start next
  const lastSeason = career.seasons.at(-1);
  const bdoWins = career.bdoWins;
  const lastRank = career.lastBdoRank;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 py-12">
      <div className="w-full max-w-md text-center">
        {bdoWins > 0 && (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2">
            <span className="text-xl">🏅</span>
            <span className="text-sm font-bold text-amber-400">{bdoWins}× Ballon d'Or Winner</span>
          </div>
        )}

        <h1 className="mb-2 text-3xl font-black text-white">{career.player.name}</h1>
        <p className="mb-1 text-sm text-gray-400">
          Age {career.player.age} · {career.player.position} · OVR {career.player.overall}
        </p>
        <p className="mb-8 text-sm text-gray-500">
          {career.seasons.length} season{career.seasons.length !== 1 ? 's' : ''} played
          {lastRank > 0 ? ` · Last BdO: ${lastRank === 1 ? '🥇 Winner' : `#${lastRank}`}` : ''}
        </p>

        {lastSeason && (
          <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">Last Season — {lastSeason.year}</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {lastSeason.trophies.length > 0 && (
                <div className="col-span-3 flex flex-wrap justify-center gap-2">
                  {lastSeason.trophies.map(t => (
                    <span key={t.name} className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-400">
                      {t.emoji} {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={() => startNextSeason()}
          className="mb-3 w-full rounded-xl bg-amber-500 py-3.5 text-sm font-black text-black transition hover:bg-amber-400"
        >
          Start Season {career.seasons.length + 1} →
        </button>
        <button
          onClick={handleReset}
          className="w-full rounded-xl border border-gray-800 py-3 text-sm text-gray-500 transition hover:border-gray-600 hover:text-gray-300"
        >
          Start a new career
        </button>
      </div>
    </div>
  );
}
