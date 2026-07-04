"use client";

import { useState, useEffect } from "react";
import type { BDCareer, BDSeason as BDSeasonData, TransferOffer } from "@/lib/ballonDorTypes";
import { initSeason, finalizeSeason, developPlayer, PL_CLUBS } from "@/lib/ballonDorEngine";
import BDSetup from "./BDSetup";
import BDSeason from "./BDSeason";
import BDCeremony from "./BDCeremony";

const STORAGE_KEY = "ballon-dor-career";

function migrateCareer(raw: BDCareer): BDCareer {
  // Patch missing fields added in the remaster
  const player = {
    ...raw.player,
    archetype: raw.player.archetype ?? ('world_class' as const),
    reputation: raw.player.reputation ?? 0,
  };
  return { ...raw, player };
}

function loadCareer(): BDCareer | null {
  try {
    const rawStr = localStorage.getItem(STORAGE_KEY);
    if (!rawStr) return null;
    const raw = JSON.parse(rawStr) as BDCareer;
    return migrateCareer(raw);
  } catch { return null; }
}

function saveCareer(career: BDCareer) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(career));
}

function StatPill({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-center">
      <p className="text-[10px] text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-black ${gold ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function BallonDorGame() {
  const [career, setCareer] = useState<BDCareer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showingTransfer, setShowingTransfer] = useState(false);

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

    // If there are transfer offers, show the transfer screen
    if (completedSeason.transferOffers && completedSeason.transferOffers.length > 0) {
      setShowingTransfer(true);
    }
  }

  function startNextSeason(clubId?: string) {
    if (!career) return;
    const lastClub = career.seasons.at(-1)?.club ?? PL_CLUBS[0];
    const club = clubId
      ? (PL_CLUBS.find((c) => c.id === clubId) ?? lastClub)
      : lastClub;
    const nextNum = career.seasons.length + 1;
    const season = initSeason(career.player, club, nextNum);
    const newCareer: BDCareer = { ...career, current: season };
    saveCareer(newCareer);
    setCareer(newCareer);
    setShowingTransfer(false);
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

  if (!career) {
    return <BDSetup onComplete={handleSetupComplete} />;
  }

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

  const lastSeason = career.seasons.at(-1);
  const bdoWins = career.bdoWins;
  const lastRank = career.lastBdoRank;
  const transferOffers = lastSeason?.transferOffers ?? [];

  // Transfer screen — shown after ceremony complete when offers exist
  if (showingTransfer && transferOffers.length > 0) {
    return (
      <TransferScreen
        career={career}
        offers={transferOffers}
        onAccept={(clubId) => startNextSeason(clubId)}
        onStay={() => startNextSeason()}
      />
    );
  }

  // Between-seasons lobby
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 py-12">
      <div className="w-full max-w-md">

        {/* BdO wins banner */}
        {bdoWins > 0 && (
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2">
              <span className="text-xl">🏅</span>
              <span className="text-sm font-bold text-amber-400">
                {bdoWins}× Ballon d'Or Winner
              </span>
            </div>
          </div>
        )}

        {/* Player identity */}
        <div className="mb-6 text-center">
          {career.player.imageUrl && (
            <img
              src={career.player.imageUrl}
              alt={career.player.name}
              className="h-16 w-16 rounded-full object-cover mx-auto mb-3 border-2 border-gray-700"
            />
          )}
          <h1 className="text-3xl font-black text-white">{career.player.name}</h1>
          <p className="mt-1 text-sm text-gray-400">
            Age {career.player.age} · {career.player.position} · {career.player.nationality}
          </p>
          <p className="text-sm text-gray-500">
            OVR {career.player.overall} · {career.seasons.length} season{career.seasons.length !== 1 ? 's' : ''} played
            {lastRank > 0
              ? ` · Last BdO: ${lastRank === 1 ? '🥇 Winner' : `#${lastRank}`}`
              : ''}
          </p>
        </div>

        {/* Last season recap */}
        {lastSeason && (
          <div className="mb-5 rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Season {lastSeason.number} · {lastSeason.year} · {lastSeason.club.name}
            </p>
            {/* Trophies */}
            {lastSeason.trophies.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {lastSeason.trophies.map(t => (
                  <span key={t.name} className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-400">
                    {t.emoji} {t.name}
                  </span>
                ))}
              </div>
            )}
            {/* Key stats */}
            <div className="grid grid-cols-3 gap-2.5">
              <StatPill
                label={career.player.position === 'GK' || career.player.position === 'DEF' ? 'Clean Sheets' : 'Goals'}
                value={career.player.position === 'GK' || career.player.position === 'DEF'
                  ? (lastSeason.baseStats.cleanSheets + lastSeason.eventStats.cleanSheets)
                  : (lastSeason.baseStats.goals + lastSeason.eventStats.goals)}
              />
              <StatPill
                label={career.player.position === 'GK' ? 'MOTM' : 'Assists'}
                value={career.player.position === 'GK'
                  ? (lastSeason.baseStats.manOfTheMatch + lastSeason.eventStats.manOfTheMatch)
                  : (lastSeason.baseStats.assists + lastSeason.eventStats.assists)}
              />
              <StatPill
                label="Rating"
                value={(lastSeason.baseStats.avgRating + lastSeason.eventStats.avgRating).toFixed(1)}
                gold
              />
            </div>
            {/* BdO result */}
            {lastRank > 0 && (
              <div className={`mt-3 rounded-lg px-3 py-2.5 text-center ${
                lastRank === 1 ? 'bg-amber-400/10 border border-amber-400/20' :
                lastRank <= 3 ? 'bg-gray-800' : 'bg-gray-800/60'
              }`}>
                <p className="text-xs text-gray-500">Ballon d'Or finish</p>
                <p className={`text-lg font-black ${lastRank === 1 ? 'text-amber-400' : 'text-white'}`}>
                  {lastRank === 1 ? '🥇 Winner' : lastRank === 2 ? '🥈 Runner-up' : lastRank === 3 ? '🥉 Third' : `#${lastRank}`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Transfer offers teaser (if any) */}
        {transferOffers.length > 0 && (
          <div className="mb-5 rounded-xl border border-blue-800/40 bg-blue-950/20 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">
              {transferOffers.length} Transfer Offer{transferOffers.length > 1 ? 's' : ''} Waiting
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Clubs are interested in signing you this summer. Review the offers before starting next season.
            </p>
            <button
              onClick={() => setShowingTransfer(true)}
              className="mt-3 w-full rounded-lg bg-blue-500/20 border border-blue-500/30 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-500/30"
            >
              Review offers →
            </button>
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

// ── Transfer Screen ────────────────────────────────────────────────

interface TransferScreenProps {
  career: BDCareer;
  offers: TransferOffer[];
  onAccept: (clubId: string) => void;
  onStay: () => void;
}

function TransferScreen({ career, offers, onAccept, onStay }: TransferScreenProps) {
  const [selectedOffer, setSelectedOffer] = useState<TransferOffer | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const lastClub = career.seasons.at(-1)?.club;

  function handleAccept() {
    if (!selectedOffer) return;
    setConfirmed(true);
    setTimeout(() => onAccept(selectedOffer.clubId), 1200);
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">
            Summer Transfer Window
          </p>
          <h1 className="text-3xl font-black text-white">Transfer Offers</h1>
          <p className="mt-2 text-sm text-gray-500">
            {career.player.name} · Age {career.player.age} · {career.player.overall} OVR
          </p>
        </div>

        {/* Current club */}
        {lastClub && (
          <div className="mb-5 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
            <p className="text-xs text-gray-600 mb-0.5">Current club</p>
            <p className="font-bold text-white">{lastClub.name}</p>
            <p className="text-xs text-gray-500">{lastClub.tierLabel}</p>
          </div>
        )}

        {/* Offers */}
        <div className="space-y-3 mb-6">
          {offers.map(offer => (
            <button
              key={offer.clubId}
              onClick={() => setSelectedOffer(prev => prev?.clubId === offer.clubId ? null : offer)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                selectedOffer?.clubId === offer.clubId
                  ? 'border-amber-500/60 bg-amber-500/8'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-white">{offer.clubName}</p>
                    {offer.hasCL && (
                      <span className="rounded-full bg-blue-500/20 px-1.5 py-px text-[9px] font-bold text-blue-400 uppercase">
                        CL
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{offer.tierLabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  {selectedOffer?.clubId === offer.clubId && (
                    <span className="text-amber-400 text-sm">✓</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {selectedOffer && (
            <button
              onClick={handleAccept}
              disabled={confirmed}
              className={`w-full rounded-xl py-4 text-sm font-black transition ${
                confirmed
                  ? 'bg-green-600 text-white opacity-80'
                  : 'bg-amber-500 text-black hover:bg-amber-400'
              }`}
            >
              {confirmed
                ? `Joining ${selectedOffer.clubName}...`
                : `Accept — Join ${selectedOffer.clubName} →`}
            </button>
          )}
          <button
            onClick={onStay}
            disabled={confirmed}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 py-3.5 text-sm font-bold text-gray-300 transition hover:border-gray-500 hover:text-white disabled:opacity-40"
          >
            Stay at {lastClub?.name ?? 'current club'}
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-gray-700">
          Your choice will take effect from Season {career.seasons.length + 1}.
        </p>
      </div>
    </div>
  );
}
