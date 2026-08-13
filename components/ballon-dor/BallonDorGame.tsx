"use client";

import { useState, useEffect, useRef } from "react";
import type { BDCareer, BDSeason as BDSeasonData, TransferOffer, BDLegacyBest } from "@/lib/ballonDorTypes";
import { initSeason, finalizeSeason, developPlayer, generateCareerRival, ageRival, computeLegacy, PL_CLUBS } from "@/lib/ballonDorEngine";
import BDSetup from "./BDSetup";
import BDSeason from "./BDSeason";
import BDCeremony from "./BDCeremony";
import BDLegacy from "./BDLegacy";

const STORAGE_KEY = "ballon-dor-career";
const LEGACY_BEST_KEY = "ballon-dor-legacy-best";

// Fire-and-forget XP award. Anonymous callers get a 401 which we ignore; the
// server dedups on the deterministic event_ref so replays never double-credit.
function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'player';
}
function postXp(event_type: string, event_ref: string) {
  try {
    fetch('/api/xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type, event_ref, xp_amount: 0 }),
    }).catch(() => {});
  } catch { /* ignore */ }
}

// ── Migration ────────────────────────────────────────────────────────
// New seasons have 15+ events (interleaved match + lifestyle events).
// Old saves have ~11 events in the old non-fixture format.
// If an in-progress season is old format, clear it but keep completed seasons.
function isCompatibleSeason(s: unknown): boolean {
  const season = s as { events?: unknown[] };
  return Array.isArray(season?.events) && season.events.length >= 15;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateCareer(raw: any): BDCareer {
  const player = {
    ...raw.player,
    archetype: raw.player.archetype ?? ('world_class' as const),
    reputation: raw.player.reputation ?? 0,
  };

  // Drop incompatible in-progress seasons silently (new season starts fresh)
  const current = raw.current && isCompatibleSeason(raw.current)
    ? { ...raw.current, matchweek: raw.current.matchweek ?? 0, money: raw.current.money ?? 50, energy: raw.current.energy ?? 85 }
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seasons = (raw.seasons ?? []).map((s: any) => ({ ...s, matchweek: s.matchweek ?? 0, money: s.money ?? 0, energy: s.energy ?? 0 }));

  // Older saves predate the career rival — generate one lazily so the feature works.
  const rival = raw.rival ?? generateCareerRival(player);

  return { ...raw, player, current, seasons, bdoWins: raw.bdoWins ?? 0, lastBdoRank: raw.lastBdoRank ?? 0, rival, retired: raw.retired ?? false };
}

function updateLegacyBest(career: BDCareer) {
  try {
    const legacy = computeLegacy(career);
    let prev: BDLegacyBest = { bestScore: 0, bestTier: 'Journeyman', careers: 0 };
    const raw = localStorage.getItem(LEGACY_BEST_KEY);
    if (raw) prev = JSON.parse(raw) as BDLegacyBest;
    const next: BDLegacyBest = {
      bestScore: Math.max(prev.bestScore, legacy.score),
      bestTier: legacy.score >= prev.bestScore ? legacy.tier : prev.bestTier,
      careers: (prev.careers ?? 0) + 1,
    };
    localStorage.setItem(LEGACY_BEST_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("[BallonDor] failed to update legacy best:", e);
  }
}

function loadCareer(): BDCareer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateCareer(JSON.parse(raw));
  } catch { return null; }
}

function saveCareer(career: BDCareer) {
  // Guard against quota errors / Safari private mode, which throw synchronously
  // and would otherwise crash the click handler that completed an event.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(career));
  } catch (e) {
    console.error("[BallonDor] failed to save career:", e);
  }
}

// ── Main component ───────────────────────────────────────────────────

export default function BallonDorGame() {
  const [career, setCareer] = useState<BDCareer | null>(null);
  const [loaded, setLoaded] = useState(false);
  // When true: actively showing BDSeason or BDCeremony.
  // When false: showing the hub (lobby between seasons).
  const [playing, setPlaying] = useState(false);
  const [showingTransfer, setShowingTransfer] = useState(false);

  useEffect(() => {
    const c = loadCareer();
    setCareer(c);
    setLoaded(true);
  }, []);

  function handleSetupComplete(newCareer: BDCareer) {
    saveCareer(newCareer);
    setCareer(newCareer);
    setPlaying(true);
  }

  function handleSeasonUpdate(updated: BDSeasonData) {
    if (!career) return;
    const allDone = updated.events.every(e => e.chosenId);
    let finalSeason = updated;
    if (allDone && updated.phase !== 'ceremony' && updated.phase !== 'done') {
      finalSeason = finalizeSeason(career.player, updated, career.rival);
    }
    const newCareer: BDCareer = { ...career, current: finalSeason };
    saveCareer(newCareer);
    setCareer(newCareer);
  }

  function handleCeremonyComplete() {
    if (!career?.current?.ceremony) return;
    const season = career.current;
    const ceremony = season.ceremony!;
    const rank = ceremony.playerRank;
    const won = rank === 1;
    const completedSeason = { ...season, phase: 'done' as const };
    const newPlayer = developPlayer(career.player, season);

    // Fire-and-forget XP (server dedups on deterministic event_ref)
    const slug = slugifyName(career.player.name);
    const seasonRef = `bdo-${slug}-s${season.number}-${season.year}`;
    postXp('bdo_season', seasonRef);
    if (rank >= 1 && rank <= 3) postXp('bdo_podium', seasonRef);
    if (won) postXp('bdo_win', seasonRef);

    // Age the rival alongside the player and record his ceremony finish
    let nextRival = career.rival;
    if (nextRival) {
      const rivalEntry = ceremony.entries.find(e => !e.isPlayer && e.name === nextRival!.name);
      nextRival = ageRival({ ...nextRival, lastBdoRank: rivalEntry?.rank ?? 0 });
    }

    let newCareer: BDCareer = {
      ...career,
      player: newPlayer,
      rival: nextRival,
      seasons: [...career.seasons, completedSeason],
      current: null,
      bdoWins: career.bdoWins + (won ? 1 : 0),
      lastBdoRank: rank,
    };

    // Forced retirement at 36
    if (newPlayer.age >= 36) {
      newCareer = retire(newCareer);
      saveCareer(newCareer);
      setCareer(newCareer);
      setPlaying(false);
      return;
    }

    saveCareer(newCareer);
    setCareer(newCareer);
    setPlaying(false);
    if (completedSeason.transferOffers && completedSeason.transferOffers.length > 0) {
      setShowingTransfer(true);
    }
  }

  // Retire the player: award career XP, persist best legacy, flag retired.
  function retire(c: BDCareer): BDCareer {
    postXp('bdo_career', `bdo-career-${slugifyName(c.player.name)}-${c.seasons.length}`);
    const retired: BDCareer = { ...c, current: null, retired: true };
    updateLegacyBest(retired);
    return retired;
  }

  function handleRetireNow() {
    if (!career) return;
    if (!window.confirm(`Retire ${career.player.name} now? Your career legacy will be sealed.`)) return;
    const retired = retire(career);
    saveCareer(retired);
    setCareer(retired);
    setPlaying(false);
    setShowingTransfer(false);
  }

  function startNextSeason(clubId?: string) {
    if (!career) return;
    const lastClub = career.seasons.at(-1)?.club ?? PL_CLUBS[0];
    const club = clubId ? (PL_CLUBS.find(c => c.id === clubId) ?? lastClub) : lastClub;
    const nextNum = career.seasons.length + 1;
    const season = initSeason(career.player, club, nextNum, career.rival);
    const newCareer: BDCareer = { ...career, current: season };
    saveCareer(newCareer);
    setCareer(newCareer);
    setShowingTransfer(false);
    setPlaying(true);
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY);
    setCareer(null);
    setPlaying(false);
    setShowingTransfer(false);
  }

  // ── Loading ───────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  // ── Retired: career legacy screen ────────────────────────────────
  if (career && career.retired) {
    return <BDLegacy career={career} onNewCareer={handleReset} />;
  }

  // ── New player setup ─────────────────────────────────────────────
  if (!career) {
    return <BDSetup onComplete={handleSetupComplete} />;
  }

  // ── Active game ──────────────────────────────────────────────────
  if (playing && career.current && career.current.phase !== 'done') {
    if (career.current.phase === 'ceremony') {
      return (
        <BDCeremony
          season={career.current}
          player={career.player}
          rival={career.rival}
          onComplete={handleCeremonyComplete}
        />
      );
    }
    return (
      <BDSeason
        season={career.current}
        player={career.player}
        rival={career.rival}
        onUpdate={handleSeasonUpdate}
        onReturnToHub={() => setPlaying(false)}
      />
    );
  }

  // ── Transfer window ───────────────────────────────────────────────
  const lastSeason = career.seasons.at(-1);
  const transferOffers = lastSeason?.transferOffers ?? [];
  if (showingTransfer && transferOffers.length > 0) {
    return (
      <TransferScreen
        career={career}
        offers={transferOffers}
        onAccept={(clubId) => startNextSeason(clubId)}
        onStay={() => startNextSeason()}
        onBackToHub={() => setShowingTransfer(false)}
      />
    );
  }

  // ── Hub / Lobby ──────────────────────────────────────────────────
  const bdoWins   = career.bdoWins;
  const lastRank  = career.lastBdoRank;
  const isDefOrGK = career.player.position === 'GK' || career.player.position === 'DEF';

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Site nav strip */}
      <div className="border-b border-gray-900 px-4 py-3">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <a href="/" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition">
            <span>←</span> Back to KnowItBall
          </a>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">Ballon d'Or</span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 space-y-4">

        {/* ── Game header ─────────────────────────────────────────── */}
        <div className="text-center mb-2">
          <p className="text-4xl mb-2">🏅</p>
          <h1 className="text-2xl font-black text-white">Ballon d'Or Career</h1>
          <p className="text-sm text-gray-500 mt-1">Win the world's greatest individual award</p>
        </div>

        {/* ── BdO wins banner ──────────────────────────────────────── */}
        {bdoWins > 0 && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-5 py-2">
              <span className="text-lg">🏅</span>
              <span className="text-sm font-black text-amber-400">{bdoWins}× Ballon d'Or Winner</span>
            </div>
          </div>
        )}

        {/* ── Player card ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center gap-4">
            {career.player.imageUrl && (
              <img
                src={career.player.imageUrl}
                alt={career.player.name}
                className="h-14 w-14 rounded-full object-cover border-2 border-gray-700 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-white truncate">{career.player.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Age {career.player.age} · {career.player.position} · {career.player.nationality}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                OVR {career.player.overall} · {career.seasons.length} season{career.seasons.length !== 1 ? 's' : ''} played
                {lastRank > 0 ? ` · Last BdO: ${lastRank === 1 ? '🥇 1st' : `#${lastRank}`}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* ── Career rival card ────────────────────────────────────── */}
        {career.rival && <RivalCard career={career} />}

        {/* ── In-progress season notice ────────────────────────────── */}
        {career.current && !playing && (
          <div className="rounded-xl border border-amber-800/30 bg-amber-950/20 px-4 py-3">
            <p className="text-xs text-amber-400 font-semibold">
              Season {career.current.number} in progress
              {career.current.club ? ` · ${career.current.club.name}` : ''}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {career.current.events.filter(e => e.chosenId).length} / {career.current.events.length} events completed — your progress is saved
            </p>
          </div>
        )}

        {/* ── Last season recap ─────────────────────────────────────── */}
        {lastSeason && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Last Season · {lastSeason.number} · {lastSeason.year} · {lastSeason.club.name}
            </p>
            {lastSeason.trophies.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {lastSeason.trophies.map(t => (
                  <span key={t.name} className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-400">
                    {t.emoji} {t.name}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <StatPill
                label={isDefOrGK ? 'Clean Sheets' : 'Goals'}
                value={isDefOrGK
                  ? lastSeason.baseStats.cleanSheets + lastSeason.eventStats.cleanSheets
                  : lastSeason.baseStats.goals + lastSeason.eventStats.goals}
              />
              <StatPill
                label={career.player.position === 'GK' ? 'MOTM' : 'Assists'}
                value={career.player.position === 'GK'
                  ? lastSeason.baseStats.manOfTheMatch + lastSeason.eventStats.manOfTheMatch
                  : lastSeason.baseStats.assists + lastSeason.eventStats.assists}
              />
              <StatPill
                label="Rating"
                value={(lastSeason.baseStats.avgRating + lastSeason.eventStats.avgRating).toFixed(1)}
                gold
              />
            </div>
            {lastRank > 0 && (
              <div className={`mt-3 rounded-xl px-3 py-2.5 text-center ${
                lastRank === 1 ? 'bg-amber-400/10 border border-amber-400/20' : 'bg-gray-800/60'
              }`}>
                <p className="text-[10px] text-gray-500 mb-0.5">Ballon d'Or finish</p>
                <p className={`text-lg font-black ${lastRank === 1 ? 'text-amber-400' : 'text-white'}`}>
                  {lastRank === 1 ? '🥇 Winner' : lastRank === 2 ? '🥈 Runner-up' : lastRank === 3 ? '🥉 Third' : `#${lastRank}`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Transfer offers ──────────────────────────────────────── */}
        {transferOffers.length > 0 && (
          <div className="rounded-xl border border-blue-800/30 bg-blue-950/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-1">
              {transferOffers.length} Transfer Offer{transferOffers.length > 1 ? 's' : ''} Waiting
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Clubs want to sign you this summer.
            </p>
            <button
              onClick={() => setShowingTransfer(true)}
              className="w-full rounded-lg border border-blue-500/30 bg-blue-500/10 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-500/20"
            >
              Review offers →
            </button>
          </div>
        )}

        {/* ── Primary CTA ──────────────────────────────────────────── */}
        {career.current ? (
          <button
            onClick={() => setPlaying(true)}
            className="w-full rounded-2xl bg-amber-500 py-4 text-sm font-black text-black transition hover:bg-amber-400"
          >
            Continue Season {career.current.number} →
          </button>
        ) : (
          <button
            onClick={() => startNextSeason()}
            className="w-full rounded-2xl bg-amber-500 py-4 text-sm font-black text-black transition hover:bg-amber-400"
          >
            Start Season {career.seasons.length + 1} →
          </button>
        )}

        {/* ── Retire ───────────────────────────────────────────────── */}
        {career.player.age >= 30 && (
          <button
            onClick={handleRetireNow}
            className="w-full rounded-xl border border-amber-800/40 bg-amber-950/10 py-2.5 text-sm font-bold text-amber-500/80 transition hover:border-amber-600/50 hover:text-amber-400"
          >
            🎖️ Retire now &amp; seal your legacy
          </button>
        )}

        {/* ── Danger zone ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2">Danger Zone</p>
          <button
            onClick={() => {
              if (window.confirm('Delete your career and start over? This cannot be undone.')) {
                handleReset();
              }
            }}
            className="w-full rounded-xl border border-red-900/40 py-2.5 text-sm text-red-500/70 transition hover:border-red-700/50 hover:text-red-400"
          >
            Delete career &amp; start over
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function StatPill({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-800/50 p-3 text-center">
      <p className="text-[10px] text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-black ${gold ? 'text-amber-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

// ── Career rival card ─────────────────────────────────────────────────
function RivalCard({ career }: { career: BDCareer }) {
  const rival = career.rival!;
  const yours = career.lastBdoRank;
  const theirs = rival.lastBdoRank ?? 0;
  const rankStr = (r: number) => (r === 1 ? '🥇 1st' : r > 0 ? `#${r}` : '—');

  // A taunt if he beat you last time; a respect line if you beat him.
  let line = 'Your career-long rival. Beat him to the Ballon d\'Or.';
  if (yours > 0 || theirs > 0) {
    const bothRanked = yours > 0 && theirs > 0;
    if (bothRanked && theirs < yours) line = `${lastName(rival.name)} finished above you last season. Respond.`;
    else if (bothRanked && yours < theirs) line = `You edged ${lastName(rival.name)} last season. Keep him behind you.`;
    else if (yours > 0 && theirs === 0) line = `You made the shortlist and ${lastName(rival.name)} didn't. Advantage you.`;
    else if (theirs > 0 && yours === 0) line = `${lastName(rival.name)} made the shortlist and you didn't. Prove them wrong.`;
  }

  return (
    <div className="rounded-2xl border border-red-900/30 bg-red-950/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-red-400">⚔️ Career Rival</p>
        <span className="text-[10px] text-gray-500">{rival.leagueFlag} {rival.club}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-black text-white truncate">{rival.name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Age {rival.age} · {rival.position} · OVR {rival.overall}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] text-gray-500 uppercase">Last BdO</p>
          <p className="text-sm font-black text-white">
            <span className="text-red-300">{rankStr(theirs)}</span>
            <span className="text-gray-600"> vs </span>
            <span className="text-amber-400">{rankStr(yours)}</span>
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">{line}</p>
    </div>
  );
}

function lastName(name: string): string {
  const parts = name.trim().split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

// ── Transfer Screen ───────────────────────────────────────────────────

interface TransferScreenProps {
  career: BDCareer;
  offers: TransferOffer[];
  onAccept: (clubId: string) => void;
  onStay: () => void;
  onBackToHub: () => void;
}

function TransferScreen({ career, offers, onAccept, onStay, onBackToHub }: TransferScreenProps) {
  const [selectedOffer, setSelectedOffer] = useState<TransferOffer | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const lastClub = career.seasons.at(-1)?.club;

  const acceptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (acceptTimer.current) clearTimeout(acceptTimer.current); }, []);

  function handleAccept() {
    if (!selectedOffer || confirmed) return;
    setConfirmed(true);
    acceptTimer.current = setTimeout(() => onAccept(selectedOffer.clubId), 1200);
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Back link */}
      <div className="border-b border-gray-900 px-4 py-3">
        <div className="mx-auto max-w-lg flex items-center">
          <button onClick={onBackToHub} disabled={confirmed} className="text-xs text-gray-500 hover:text-gray-300 transition disabled:opacity-40 disabled:cursor-not-allowed">
            ← Back to hub
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.35em] text-gray-500">Summer Transfer Window</p>
          <h1 className="text-3xl font-black text-white">Transfer Offers</h1>
          <p className="mt-2 text-sm text-gray-500">
            {career.player.name} · Age {career.player.age} · OVR {career.player.overall}
          </p>
        </div>

        {lastClub && (
          <div className="mb-5 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
            <p className="text-xs text-gray-600 mb-0.5">Current club</p>
            <p className="font-bold text-white">{lastClub.name}</p>
            <p className="text-xs text-gray-500">{lastClub.tierLabel}</p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          {offers.map(offer => (
            <button
              key={offer.clubId}
              onClick={() => setSelectedOffer(prev => prev?.clubId === offer.clubId ? null : offer)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                selectedOffer?.clubId === offer.clubId
                  ? 'border-amber-500/60 bg-amber-500/[0.08]'
                  : 'border-gray-700 bg-gray-900 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-white">{offer.clubName}</p>
                    {offer.hasCL && (
                      <span className="rounded-full bg-blue-500/20 px-1.5 py-px text-[9px] font-bold text-blue-400 uppercase">CL</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{offer.tierLabel}</p>
                  <p className={`mt-1.5 text-[11px] leading-snug ${offer.prestige >= 80 ? 'text-blue-300/80' : 'text-green-300/80'}`}>
                    {offer.prestige >= 90
                      ? '🏆 Trophy machine — but you\'ll share the goals'
                      : offer.prestige >= 80
                      ? '⚖️ Strong squad — output is split with stars'
                      : offer.prestige >= 70
                      ? '⚡ You\'d be a leader — plenty of the ball'
                      : '🎯 You\'d be THE man — every goal is yours'}
                  </p>
                </div>
                {selectedOffer?.clubId === offer.clubId && (
                  <span className="text-amber-400 text-sm shrink-0">✓</span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {selectedOffer && (
            <button
              onClick={handleAccept}
              disabled={confirmed}
              className={`w-full rounded-xl py-4 text-sm font-black transition ${
                confirmed ? 'bg-green-600 text-white opacity-80' : 'bg-amber-500 text-black hover:bg-amber-400'
              }`}
            >
              {confirmed ? `Joining ${selectedOffer.clubName}…` : `Accept — Join ${selectedOffer.clubName} →`}
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
          Your choice takes effect from Season {career.seasons.length + 1}.
        </p>
      </div>
    </div>
  );
}
