"use client";

import { useState, useEffect, useRef } from "react";
import type { BDSeason, BDPlayer, CeremonyEntry } from "@/lib/ballonDorTypes";

interface Props {
  season: BDSeason;
  player: BDPlayer;
  onComplete: () => void;
}

type Phase = 'intro' | 'nominated_check' | 'reveal_start' | 'revealing' | 'complete';

const POS_LABEL: Record<string, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', ATT: 'FWD' };

function keyStat(entry: CeremonyEntry): string {
  if (entry.position === 'GK') return `${entry.stats.cleanSheets} CS`;
  if (entry.position === 'DEF') return `${entry.stats.cleanSheets} CS`;
  return `${entry.stats.goals}G ${entry.stats.assists}A`;
}

export default function BDCeremony({ season, player, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [revealed, setRevealed] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const ceremony = season.ceremony!;
  const { entries, playerNominated, playerRank } = ceremony;
  const playerWon = playerRank === 1;

  // Auto-advance intro → nominated_check
  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => setPhase('nominated_check'), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  // Auto-advance nominated_check → reveal_start
  useEffect(() => {
    if (phase !== 'nominated_check') return;
    const t = setTimeout(() => setPhase('reveal_start'), 4000);
    return () => clearTimeout(t);
  }, [phase]);

  // Start revealing
  useEffect(() => {
    if (phase !== 'reveal_start') return;
    setPhase('revealing');
  }, [phase]);

  // Chain reveals
  useEffect(() => {
    if (phase !== 'revealing') return;
    if (revealed >= entries.length) {
      setPhase('complete');
      if (playerWon) setShowConfetti(true);
      return;
    }
    const entry = entries[revealed];
    // Longer pause on player's entry and on the winner
    const delay = entry.isPlayer ? 2000 : entry.rank === 1 ? 2000 : entry.rank <= 5 ? 900 : 650;
    const t = setTimeout(() => {
      setRevealed(r => r + 1);
      // Scroll to bottom as entries appear
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, delay);
    return () => clearTimeout(t);
  }, [phase, revealed, entries, playerWon]);

  if (phase === 'intro') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <div className="text-center animate-pulse">
          <div className="mb-6 text-6xl">🏅</div>
          <h1 className="text-4xl font-black text-amber-400" style={{ fontVariant: 'small-caps', letterSpacing: '0.05em' }}>
            Ballon d'Or
          </h1>
          <p className="mt-3 text-lg text-gray-400">Cérémonie {ceremony.year}</p>
          <p className="mt-6 text-sm text-gray-600 italic">Paris. The Théâtre du Châtelet. October.</p>
        </div>
      </div>
    );
  }

  if (phase === 'nominated_check') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <div className="text-center max-w-sm">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/60">
            Ballon d'Or {ceremony.year}
          </p>
          <h2 className="mb-6 text-2xl font-black text-white leading-tight">
            The nominations have been announced.
          </h2>
          <div className="mb-8 h-px w-16 mx-auto bg-amber-400/30" />
          {playerNominated ? (
            <>
              <div className="mb-4 text-5xl animate-bounce">🎉</div>
              <p className="text-xl font-black text-amber-400">{player.name}</p>
              <p className="mt-2 text-base text-white">
                You have been nominated for the Ballon d'Or.
              </p>
              <p className="mt-3 text-sm text-gray-500">
                The ceremony is about to begin. Twenty-five names will be revealed,<br/>
                from twenty-fifth to first.
              </p>
            </>
          ) : (
            <>
              <div className="mb-4 text-5xl">😔</div>
              <p className="text-xl font-black text-white">{player.name}</p>
              <p className="mt-2 text-base text-gray-400">
                You were not nominated this year.
              </p>
              <p className="mt-3 text-sm text-gray-600">
                Extraordinary seasons win this award. Keep pushing.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const visibleEntries = entries.slice(0, revealed);

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Confetti layer */}
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-ping rounded-sm"
              style={{
                left: `${(i * 17.3) % 100}%`,
                top: `${(i * 13.7) % 60}%`,
                width: `${6 + (i % 4) * 3}px`,
                height: `${6 + (i % 3) * 4}px`,
                background: ['#F0C040','#FF6B35','#4ADE80','#60A5FA','#F472B6','#A78BFA'][i % 6],
                animationDelay: `${(i * 0.07) % 2}s`,
                animationDuration: `${0.8 + (i % 5) * 0.3}s`,
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      )}

      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-amber-400/10 bg-black/95 px-4 py-4 text-center backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400/50">Ballon d'Or</p>
        <h1 className="text-xl font-black text-amber-400">{ceremony.year}</h1>
        {phase === 'revealing' && (
          <p className="mt-0.5 text-xs text-gray-600">
            Revealing {revealed}/{entries.length}
            {playerNominated && playerRank > 0 && revealed < 26 - playerRank && (
              <span className="ml-2 text-amber-400/60">· Your reveal is coming...</span>
            )}
          </p>
        )}
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4 space-y-2">
        {visibleEntries.map((entry, idx) => (
          <CeremonyCard key={`${entry.name}-${entry.rank}`} entry={entry} playerName={player.name} />
        ))}

        {/* Waiting pulse for next reveal */}
        {phase === 'revealing' && revealed < entries.length && (
          <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3">
            <div className="flex gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-gray-500">
              {entries.length - revealed} nominees remaining...
            </span>
          </div>
        )}

        {phase === 'complete' && (
          <div className="pt-4 space-y-4">
            {/* Player's result */}
            <div className={`rounded-2xl border p-5 text-center ${
              playerWon
                ? 'border-amber-400 bg-amber-400/5'
                : playerNominated
                ? 'border-gray-700 bg-gray-900'
                : 'border-red-800/30 bg-red-950/20'
            }`}>
              {playerWon ? (
                <>
                  <div className="mb-3 text-5xl">🏅</div>
                  <h2 className="text-2xl font-black text-amber-400">Ballon d'Or Winner</h2>
                  <p className="mt-1 text-white font-bold">{player.name}</p>
                  <p className="mt-2 text-sm text-gray-400">
                    You have won the greatest individual award in football. Congratulations.
                  </p>
                </>
              ) : playerNominated ? (
                <>
                  <h2 className="text-lg font-black text-white">Your Result</h2>
                  <p className="mt-1 text-3xl font-black text-amber-400">#{playerRank}</p>
                  <p className="mt-1 text-sm text-gray-400">
                    {playerRank <= 3 ? 'Incredible. On the podium.' :
                     playerRank <= 10 ? 'A fantastic season. Top 10 in the world.' :
                     'Nominated. You belong among the elite.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-2 text-3xl">💪</div>
                  <h2 className="text-base font-black text-white">Not Nominated</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Win trophies, score goals, build your fame. Next season is your chance.
                  </p>
                </>
              )}
            </div>

            {/* Season stats summary */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Your {ceremony.year} Season
              </p>
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div>
                  <p className="text-xs text-gray-500">{player.position === 'DEF' || player.position === 'GK' ? 'Clean Sheets' : 'Goals'}</p>
                  <p className="text-xl font-black text-white">
                    {entries.find(e => e.isPlayer)?.stats.goals ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Assists</p>
                  <p className="text-xl font-black text-white">
                    {entries.find(e => e.isPlayer)?.stats.assists ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Rating</p>
                  <p className="text-xl font-black text-amber-400">
                    {(entries.find(e => e.isPlayer)?.stats.avgRating ?? 0).toFixed(1)}
                  </p>
                </div>
              </div>
              {season.trophies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {season.trophies.map(t => (
                    <span key={t.name} className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-400">
                      {t.emoji} {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onComplete}
              className="w-full rounded-xl bg-amber-500 py-4 text-sm font-black text-black transition hover:bg-amber-400"
            >
              Continue to next season →
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function CeremonyCard({ entry, playerName }: { entry: CeremonyEntry; playerName: string }) {
  const isWinner = entry.rank === 1;
  const isPlayer = entry.isPlayer;
  const isPodium = entry.rank <= 3;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 animate-[fadeSlideIn_0.4s_ease-out] ${
        isPlayer && isWinner
          ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-400/10'
          : isPlayer
          ? 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30'
          : isWinner
          ? 'border-yellow-600/50 bg-yellow-900/10'
          : isPodium
          ? 'border-gray-700 bg-gray-900'
          : 'border-gray-800 bg-gray-900/70'
      }`}
      style={{ animationFillMode: 'both' }}
    >
      {/* Rank */}
      <div className={`w-8 text-center font-black tabular-nums ${
        isWinner ? 'text-lg text-amber-400' :
        isPodium ? 'text-base text-gray-300' :
        'text-sm text-gray-600'
      }`}>
        {isWinner ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${isPlayer ? 'text-amber-300' : isWinner ? 'text-yellow-300' : 'text-white'}`}>
            {entry.name}
          </span>
          {isPlayer && (
            <span className="rounded-full bg-amber-500 px-1.5 py-px text-[9px] font-black text-black">YOU</span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {entry.leagueFlag} {entry.club} · {POS_LABEL[entry.position] ?? entry.position}
        </p>
      </div>

      {/* Stats */}
      <div className="text-right">
        <p className={`text-xs font-semibold ${isPlayer ? 'text-amber-400' : 'text-gray-400'}`}>
          {keyStat(entry)}
        </p>
        {entry.trophies.length > 0 && (
          <p className="text-[10px] text-gray-600">
            {entry.trophies.map(t => t.emoji).join(' ')}
          </p>
        )}
      </div>
    </div>
  );
}
