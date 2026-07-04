"use client";

import { useState, useEffect } from "react";
import type { BDSeason, BDPlayer, CeremonyEntry } from "@/lib/ballonDorTypes";

interface Props {
  season: BDSeason;
  player: BDPlayer;
  onComplete: () => void;
}

type CeremonyPhase =
  | 'intro'
  | 'nominated_check'
  | 'bulk'        // reveals entries[0..14] = ranks 25 → 11
  | 'break_mid'   // interlude: "The Top 10"
  | 'mid'         // reveals entries[15..19] = ranks 10 → 6
  | 'break_top5'  // interlude: "The Top 5"
  | 'spotlight'   // entries[20..22] = ranks 5, 4, 3 (one at a time)
  | 'runner_up'   // entries[23] = rank 2
  | 'winner_build'// "And the winner is..."
  | 'winner'      // entries[24] = rank 1 — full screen
  | 'result';     // season complete, player result + next button

const POS_LABEL: Record<string, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', ATT: 'FWD' };

function keyStat(entry: CeremonyEntry): string {
  if (entry.position === 'GK') return `${entry.stats.cleanSheets} CS · ${entry.stats.manOfTheMatch} MOTM`;
  if (entry.position === 'DEF') return `${entry.stats.cleanSheets} CS · ${entry.stats.assists}A`;
  return `${entry.stats.goals}G · ${entry.stats.assists}A`;
}

function keyStatShort(entry: CeremonyEntry): string {
  if (entry.position === 'GK') return `${entry.stats.cleanSheets} CS`;
  if (entry.position === 'DEF') return `${entry.stats.cleanSheets} CS`;
  return `${entry.stats.goals}G ${entry.stats.assists}A`;
}

function RatingBadge({ rating }: { rating: number }) {
  return (
    <span className={`text-xs font-black ${rating >= 8.0 ? 'text-amber-400' : 'text-gray-400'}`}>
      {rating.toFixed(1)}
    </span>
  );
}

export default function BDCeremony({ season, player, onComplete }: Props) {
  const [phase, setPhase] = useState<CeremonyPhase>('intro');
  const [bulkRevealed, setBulkRevealed] = useState(0);
  const [midRevealed, setMidRevealed] = useState(0);
  const [spotlightIdx, setSpotlightIdx] = useState(0); // 0 = rank 5 reveal, 1 = rank 4, 2 = rank 3
  const [showWinnerContinue, setShowWinnerContinue] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const ceremony = season.ceremony!;
  const { entries, playerNominated, playerRank } = ceremony;
  const playerWon = playerRank === 1;

  // ── Phase transitions ──────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'intro') return;
    const t = setTimeout(() => setPhase('nominated_check'), 3500);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'nominated_check') return;
    const t = setTimeout(() => setPhase('bulk'), 4200);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'bulk') return;
    if (bulkRevealed >= 15) {
      const t = setTimeout(() => setPhase('break_mid'), 700);
      return () => clearTimeout(t);
    }
    const isPlayerEntry = entries[bulkRevealed]?.isPlayer;
    const delay = isPlayerEntry ? 1800 : 370;
    const t = setTimeout(() => setBulkRevealed(r => r + 1), delay);
    return () => clearTimeout(t);
  }, [phase, bulkRevealed, entries]);

  useEffect(() => {
    if (phase !== 'break_mid') return;
    const t = setTimeout(() => setPhase('mid'), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'mid') return;
    if (midRevealed >= 5) {
      const t = setTimeout(() => setPhase('break_top5'), 700);
      return () => clearTimeout(t);
    }
    const isPlayerEntry = entries[15 + midRevealed]?.isPlayer;
    const delay = isPlayerEntry ? 2400 : 950;
    const t = setTimeout(() => setMidRevealed(r => r + 1), delay);
    return () => clearTimeout(t);
  }, [phase, midRevealed, entries]);

  useEffect(() => {
    if (phase !== 'break_top5') return;
    const t = setTimeout(() => setPhase('spotlight'), 3200);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'spotlight') return;
    if (spotlightIdx >= 3) {
      const t = setTimeout(() => setPhase('runner_up'), 700);
      return () => clearTimeout(t);
    }
    const isPlayerEntry = entries[20 + spotlightIdx]?.isPlayer;
    const delay = isPlayerEntry ? 4500 : 3000;
    const t = setTimeout(() => setSpotlightIdx(i => i + 1), delay);
    return () => clearTimeout(t);
  }, [phase, spotlightIdx, entries]);

  useEffect(() => {
    if (phase !== 'runner_up') return;
    const isPlayerRunnerUp = entries[23]?.isPlayer;
    const t = setTimeout(() => setPhase('winner_build'), isPlayerRunnerUp ? 6000 : 4500);
    return () => clearTimeout(t);
  }, [phase, entries]);

  useEffect(() => {
    if (phase !== 'winner_build') return;
    const t = setTimeout(() => setPhase('winner'), 4000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'winner') return;
    if (playerWon) setShowConfetti(true);
    const t = setTimeout(() => setShowWinnerContinue(true), 4000);
    return () => clearTimeout(t);
  }, [phase, playerWon]);

  // ── RENDER ────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <div className="text-center" style={{ animation: 'fadeIn 1.2s ease-out' }}>
          <div
            className="mb-8 text-8xl"
            style={{ filter: 'drop-shadow(0 0 50px rgba(251,191,36,0.5))' }}
          >
            🏅
          </div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.45em] text-amber-400/50">
            France Football
          </p>
          <h1 className="text-5xl font-black text-white" style={{ letterSpacing: '-0.02em' }}>
            Ballon d'Or
          </h1>
          <p className="mt-3 text-xl font-light text-gray-400 tracking-wide">{ceremony.year}</p>
          <div className="mt-10 h-px w-32 mx-auto bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          <p className="mt-5 text-xs text-gray-700 italic">Théâtre du Châtelet · Paris · October</p>
        </div>
      </div>
    );
  }

  if (phase === 'nominated_check') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <div className="max-w-sm w-full text-center" style={{ animation: 'fadeIn 0.8s ease-out' }}>
          <p className="mb-8 text-[11px] font-semibold uppercase tracking-[0.4em] text-amber-400/40">
            The Nominations
          </p>
          {playerNominated ? (
            <>
              <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-8">
                <p className="text-xs uppercase tracking-widest text-amber-400/60 mb-3">Nominated</p>
                <p className="text-3xl font-black text-white leading-tight">{player.name}</p>
                <p className="mt-2 text-sm text-amber-400/80">Ballon d'Or {ceremony.year}</p>
              </div>
              <p className="mt-6 text-xs text-gray-600 leading-relaxed">
                Twenty-five names will be announced tonight,<br />
                from twenty-fifth to first. The world is watching.
              </p>
            </>
          ) : (
            <>
              <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900/60 px-6 py-8">
                <p className="text-2xl mb-3">😔</p>
                <p className="text-2xl font-black text-white leading-tight">{player.name}</p>
                <p className="mt-2 text-sm text-gray-500">was not nominated this year.</p>
              </div>
              <p className="mt-4 text-xs text-gray-600 leading-relaxed">
                Extraordinary seasons win this award.<br />
                Keep building your legacy.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'bulk') {
    const visible = entries.slice(0, bulkRevealed);
    return (
      <div className="min-h-screen bg-black pb-16">
        <div className="sticky top-0 z-10 border-b border-white/5 bg-black/95 backdrop-blur px-4 py-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-amber-400/50">
            Ballon d'Or {ceremony.year}
          </p>
          <h2 className="text-base font-black text-white">Positions 25 – 11</h2>
        </div>
        <div className="mx-auto max-w-lg px-4 pt-5">
          <div className="grid grid-cols-3 gap-2">
            {visible.map((entry) => (
              <BulkCard key={entry.rank} entry={entry} />
            ))}
          </div>
          {bulkRevealed < 15 && (
            <div className="mt-5 flex justify-center gap-1.5">
              {[0, 150, 300].map(d => (
                <div
                  key={d}
                  className="h-1 w-1 rounded-full bg-amber-400/60 animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'break_mid') {
    return (
      <InterlùdeScreen year={ceremony.year}>
        <h2 className="text-4xl font-black text-white">The Top Ten.</h2>
        <p className="mt-3 text-sm text-gray-400">The best footballers on the planet.</p>
      </InterlùdeScreen>
    );
  }

  if (phase === 'mid') {
    const midVisible = entries.slice(15, 15 + midRevealed);
    return (
      <div className="min-h-screen bg-black pb-16">
        <div className="sticky top-0 z-10 border-b border-white/5 bg-black/95 backdrop-blur px-4 py-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-amber-400/50">
            Ballon d'Or {ceremony.year}
          </p>
          <h2 className="text-base font-black text-white">The Top Ten</h2>
        </div>
        <div className="mx-auto max-w-lg px-4 pt-5 space-y-5">
          {/* Collapsed bulk */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-700">
              Positions 25 – 11
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {entries.slice(0, 15).map(entry => (
                <div
                  key={entry.rank}
                  className={`rounded-lg border px-1 py-1.5 text-center ${
                    entry.isPlayer ? 'border-amber-500/30 bg-amber-500/8' : 'border-gray-800 bg-gray-900/60'
                  }`}
                >
                  <p className="text-[9px] font-bold text-gray-600">#{entry.rank}</p>
                  <p className={`text-[9px] font-semibold leading-tight truncate ${entry.isPlayer ? 'text-amber-400' : 'text-gray-400'}`}>
                    {entry.name.split(' ').slice(-1)[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Mid reveals */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Positions 10 – 6
            </p>
            <div className="space-y-2.5">
              {midVisible.map((entry) => (
                <MidCard key={entry.rank} entry={entry} />
              ))}
            </div>
            {midRevealed < 5 && midRevealed > 0 && (
              <div className="mt-4 flex justify-center gap-1.5">
                {[0, 160, 320].map(d => (
                  <div
                    key={d}
                    className="h-1 w-1 rounded-full bg-amber-400/60 animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'break_top5') {
    return (
      <InterlùdeScreen year={ceremony.year}>
        <h2 className="text-5xl font-black text-white">The Top Five.</h2>
        <p className="mt-4 text-sm text-gray-400 leading-relaxed">
          Five players. One award.<br />
          The greatest individual prize in football.
        </p>
      </InterlùdeScreen>
    );
  }

  if (phase === 'spotlight') {
    const alreadyRevealed = entries.slice(20, 20 + spotlightIdx);
    const current = spotlightIdx < 3 ? entries[20 + spotlightIdx] : null;
    return (
      <div className="flex min-h-screen flex-col bg-black">
        <div className="border-b border-white/5 px-4 py-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-amber-400/50">
            Ballon d'Or {ceremony.year}
          </p>
          <h2 className="text-base font-black text-white">The Top Five</h2>
        </div>
        <div className="flex-1 px-4 py-6">
          <div className="mx-auto max-w-sm space-y-3">
            {/* Already announced (compact) */}
            {alreadyRevealed.map(entry => (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  entry.isPlayer ? 'border-amber-500/40 bg-amber-500/8' : 'border-gray-800 bg-gray-900/60'
                }`}
              >
                <span className={`text-sm font-black tabular-nums w-8 text-center ${
                  entry.rank === 3 ? 'text-amber-600' : 'text-gray-500'
                }`}>
                  {entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold truncate ${entry.isPlayer ? 'text-amber-300' : 'text-white'}`}>
                    {entry.name}
                  </p>
                  <p className="text-xs text-gray-600">{entry.leagueFlag} {entry.club}</p>
                </div>
                <p className="text-xs text-gray-500 shrink-0">{keyStatShort(entry)}</p>
              </div>
            ))}
            {/* Current spotlight */}
            {current && <SpotlightCard key={current.rank} entry={current} />}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'runner_up') {
    const runnerUp = entries[23];
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <div className="w-full max-w-sm text-center" style={{ animation: 'dropIn 0.7s ease-out' }}>
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.35em] text-gray-600">
            And finishing in second place...
          </p>
          <div className={`rounded-2xl border p-7 ${
            runnerUp.isPlayer
              ? 'border-amber-400/40 bg-amber-400/5'
              : 'border-gray-700 bg-gray-900'
          }`}>
            <div className="mb-3 text-5xl">🥈</div>
            <p className={`text-2xl font-black leading-tight ${runnerUp.isPlayer ? 'text-amber-300' : 'text-white'}`}>
              {runnerUp.name}
            </p>
            <p className="mt-1.5 text-sm text-gray-400">{runnerUp.leagueFlag} {runnerUp.club}</p>
            <p className="mt-0.5 text-xs text-gray-600">{POS_LABEL[runnerUp.position] ?? runnerUp.position}</p>
            <div className="mt-5 h-px bg-gray-800" />
            <p className="mt-4 text-sm font-semibold text-gray-300">{keyStat(runnerUp)}</p>
            <div className="mt-2 flex justify-center">
              <RatingBadge rating={runnerUp.stats.avgRating} />
            </div>
            {runnerUp.trophies.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {runnerUp.trophies.map(t => (
                  <span key={t.name} className="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300">
                    {t.emoji} {t.name}
                  </span>
                ))}
              </div>
            )}
            {runnerUp.isPlayer && (
              <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-3">
                <p className="text-sm font-black text-amber-400">That's you.</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Second in the world. One of the greatest seasons in football. You'll be back.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'winner_build') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <div className="text-center max-w-xs" style={{ animation: 'fadeIn 0.8s ease-out' }}>
          <div
            className="mb-8 text-6xl"
            style={{ filter: 'drop-shadow(0 0 30px rgba(251,191,36,0.6))' }}
          >
            🏅
          </div>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.4em] text-amber-400/50">
            Ballon d'Or {ceremony.year}
          </p>
          <h2 className="text-2xl font-black text-white">And the winner is...</h2>
          <div className="mt-8 flex justify-center gap-2">
            {[0, 250, 500].map(d => (
              <div
                key={d}
                className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-bounce"
                style={{ animationDelay: `${d}ms`, animationDuration: '1s' }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'winner') {
    const winner = entries[24];
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 relative overflow-hidden">
        {showConfetti && <ConfettiLayer />}
        <div
          className="relative z-10 w-full max-w-sm text-center"
          style={{ animation: 'dropIn 0.8s ease-out' }}
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.4em] text-amber-400/50">
            Ballon d'Or {ceremony.year}
          </p>
          <div
            className="mb-6 text-8xl"
            style={{ filter: 'drop-shadow(0 0 60px rgba(251,191,36,0.8))' }}
          >
            🏅
          </div>
          <h1
            className="text-4xl font-black text-amber-400 leading-tight"
            style={{
              letterSpacing: '-0.02em',
              textShadow: '0 0 60px rgba(251,191,36,0.5)',
            }}
          >
            {winner.name}
          </h1>
          <p className="mt-2 text-base text-gray-300">{winner.leagueFlag} {winner.club}</p>
          <p className="mt-0.5 text-xs text-gray-600">{POS_LABEL[winner.position] ?? winner.position}</p>

          <div className="mt-7 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 py-3">
              <p className="text-[10px] text-gray-600 mb-1">
                {winner.position === 'GK' || winner.position === 'DEF' ? 'Clean Sheets' : 'Goals'}
              </p>
              <p className="text-2xl font-black text-white">
                {winner.position === 'GK' || winner.position === 'DEF'
                  ? winner.stats.cleanSheets
                  : winner.stats.goals}
              </p>
            </div>
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 py-3">
              <p className="text-[10px] text-gray-600 mb-1">
                {winner.position === 'GK' ? 'MOTM' : 'Assists'}
              </p>
              <p className="text-2xl font-black text-white">
                {winner.position === 'GK' ? winner.stats.manOfTheMatch : winner.stats.assists}
              </p>
            </div>
            <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 py-3">
              <p className="text-[10px] text-gray-600 mb-1">Rating</p>
              <p className="text-2xl font-black text-amber-400">
                {winner.stats.avgRating.toFixed(1)}
              </p>
            </div>
          </div>

          {winner.trophies.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {winner.trophies.map(t => (
                <span
                  key={t.name}
                  className="rounded-full border border-amber-400/20 bg-amber-400/8 px-3 py-1 text-xs font-bold text-amber-400"
                >
                  {t.emoji} {t.name}
                </span>
              ))}
            </div>
          )}

          {winner.isPlayer && (
            <div className="mt-6 rounded-2xl border border-amber-400 bg-amber-400/8 px-5 py-5">
              <p className="text-xl font-black text-amber-300">You did it.</p>
              <p className="mt-2 text-sm text-gray-300 leading-relaxed">
                Ballon d'Or champion. The greatest individual honour in football.
                Your name joins the legends of the game.
              </p>
            </div>
          )}

          {showWinnerContinue && (
            <button
              onClick={() => setPhase('result')}
              className="mt-8 w-full rounded-xl border border-gray-700 bg-gray-900/80 py-3.5 text-sm font-black text-white transition hover:border-gray-500 hover:bg-gray-800"
              style={{ animation: 'fadeIn 0.5s ease-out' }}
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT SCREEN ────────────────────────────────────────────────
  const playerEntry = entries.find(e => e.isPlayer);
  const winnerEntry = entries[24];

  return (
    <div className="min-h-screen bg-black pb-16">
      <div className="mx-auto max-w-sm px-4 pt-10 space-y-4">

        {/* Player result */}
        <div className={`rounded-2xl border p-6 text-center ${
          playerWon
            ? 'border-amber-400 bg-amber-400/8'
            : playerNominated && playerRank <= 3
            ? 'border-gray-600 bg-gray-900'
            : playerNominated
            ? 'border-gray-800 bg-gray-900'
            : 'border-gray-800 bg-gray-900/40'
        }`}>
          {playerWon ? (
            <>
              <div className="mb-3 text-5xl">🏅</div>
              <h2 className="text-2xl font-black text-amber-400">Ballon d'Or Winner</h2>
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                History will remember this season.
              </p>
            </>
          ) : playerNominated ? (
            <>
              <p className="text-xs text-gray-600 mb-2 uppercase tracking-widest">Your Finish</p>
              <p className="text-5xl font-black text-white">
                {playerRank === 2 ? '🥈' : playerRank === 3 ? '🥉' : `#${playerRank}`}
              </p>
              {playerRank > 3 && (
                <p className="mt-1 text-sm text-gray-500">in the World</p>
              )}
              <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                {playerRank === 2 ? 'Runner-up. One of the greatest seasons in the world.' :
                 playerRank === 3 ? 'On the podium. A legendary season.' :
                 playerRank <= 5 ? 'Top five in the world. An extraordinary campaign.' :
                 playerRank <= 10 ? 'Top ten in the world. Elite company.' :
                 'Nominated. You belong among the very best.'}
              </p>
            </>
          ) : (
            <>
              <div className="mb-2 text-3xl">💪</div>
              <h2 className="text-base font-black text-white">Not Nominated</h2>
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                Trophies. Consistency. Fame. Next season is your moment.
              </p>
            </>
          )}
        </div>

        {/* Season stats */}
        {playerEntry && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Your {ceremony.year} Season
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-gray-500 mb-1">
                  {player.position === 'GK' || player.position === 'DEF' ? 'Clean Sheets' : 'Goals'}
                </p>
                <p className="text-xl font-black text-white">
                  {player.position === 'GK' || player.position === 'DEF'
                    ? playerEntry.stats.cleanSheets
                    : playerEntry.stats.goals}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-1">
                  {player.position === 'GK' ? 'MOTM' : 'Assists'}
                </p>
                <p className="text-xl font-black text-white">
                  {player.position === 'GK' ? playerEntry.stats.manOfTheMatch : playerEntry.stats.assists}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-1">Rating</p>
                <p className="text-xl font-black text-amber-400">
                  {playerEntry.stats.avgRating.toFixed(1)}
                </p>
              </div>
            </div>
            {season.trophies.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2">
                {season.trophies.map(t => (
                  <span
                    key={t.name}
                    className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-400"
                  >
                    {t.emoji} {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Winner (if not the player) */}
        {!playerWon && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">Winner</p>
            <div className="flex items-center gap-3">
              <span className="text-xl">🏅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white">{winnerEntry.name}</p>
                <p className="text-xs text-gray-500">{winnerEntry.leagueFlag} {winnerEntry.club}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">{keyStatShort(winnerEntry)}</p>
                {winnerEntry.trophies.length > 0 && (
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {winnerEntry.trophies.map(t => t.emoji).join(' ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onComplete}
          className="w-full rounded-xl bg-amber-500 py-4 text-sm font-black text-black transition hover:bg-amber-400"
        >
          Continue to next season →
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function InterlùdeScreen({ year, children }: { year: number; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
      <div className="text-center max-w-xs" style={{ animation: 'fadeIn 0.7s ease-out' }}>
        <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.4em] text-amber-400/40">
          Ballon d'Or {year}
        </p>
        {children}
        <div className="mt-7 h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
      </div>
    </div>
  );
}

function BulkCard({ entry }: { entry: CeremonyEntry }) {
  return (
    <div
      className={`rounded-lg border px-2 py-2.5 text-center ${
        entry.isPlayer
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-gray-800 bg-gray-900/80'
      }`}
      style={{ animation: 'fadeSlideIn 0.35s ease-out' }}
    >
      <p className={`text-[10px] font-bold tabular-nums ${entry.isPlayer ? 'text-amber-400/70' : 'text-gray-600'}`}>
        #{entry.rank}
      </p>
      <p className={`mt-0.5 text-xs font-bold leading-tight ${entry.isPlayer ? 'text-amber-300' : 'text-white'}`}>
        {entry.name.split(' ').slice(-1)[0]}
      </p>
      <p className="mt-0.5 text-[9px] text-gray-600">{entry.leagueFlag}</p>
      {entry.isPlayer && (
        <span className="mt-1 inline-block rounded-full bg-amber-500 px-1 py-px text-[8px] font-black text-black">
          YOU
        </span>
      )}
    </div>
  );
}

function MidCard({ entry }: { entry: CeremonyEntry }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${
        entry.isPlayer ? 'border-amber-500/50 bg-amber-500/8' : 'border-gray-700 bg-gray-900'
      }`}
      style={{ animation: 'slideUp 0.5s ease-out' }}
    >
      <div className="w-8 text-center shrink-0">
        <span className={`text-base font-black ${entry.rank <= 3 ? 'text-amber-400' : 'text-gray-400'}`}>
          #{entry.rank}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-black truncate ${entry.isPlayer ? 'text-amber-300' : 'text-white'}`}>
            {entry.name}
          </p>
          {entry.isPlayer && (
            <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-px text-[9px] font-black text-black">
              YOU
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{entry.leagueFlag} {entry.club}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold text-gray-400">{keyStatShort(entry)}</p>
        {entry.trophies.length > 0 && (
          <p className="mt-0.5 text-[10px] text-gray-600">{entry.trophies.map(t => t.emoji).join(' ')}</p>
        )}
      </div>
    </div>
  );
}

function SpotlightCard({ entry }: { entry: CeremonyEntry }) {
  const rankEmoji = entry.rank === 3 ? '🥉' : entry.rank === 4 ? '' : '';
  return (
    <div
      className={`rounded-2xl border p-5 ${
        entry.isPlayer ? 'border-amber-400/60 bg-amber-400/8' : 'border-gray-600 bg-gray-900'
      }`}
      style={{ animation: 'dropIn 0.6s ease-out' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`text-xl font-black ${
            entry.rank === 3 ? 'text-amber-600' :
            entry.rank === 4 ? 'text-gray-300' :
            'text-gray-400'
          }`}>
            {rankEmoji || `#${entry.rank}`}
          </span>
        </div>
        {entry.isPlayer && (
          <span className="rounded-full bg-amber-500 px-2 py-1 text-xs font-black text-black">YOU</span>
        )}
      </div>
      <p className={`text-2xl font-black leading-tight ${entry.isPlayer ? 'text-amber-300' : 'text-white'}`}>
        {entry.name}
      </p>
      <p className="mt-1.5 text-sm text-gray-400">
        {entry.leagueFlag} {entry.club} · {POS_LABEL[entry.position] ?? entry.position}
      </p>
      <div className="mt-4 h-px bg-gray-800" />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-300">{keyStat(entry)}</p>
        <RatingBadge rating={entry.stats.avgRating} />
      </div>
      {entry.trophies.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.trophies.map(t => (
            <span key={t.name} className="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300">
              {t.emoji} {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfettiLayer() {
  const pieces = Array.from({ length: 70 }, (_, i) => ({
    left: `${(i * 13.7 + 4) % 100}%`,
    color: ['#F0C040', '#FF6B35', '#4ADE80', '#60A5FA', '#F472B6', '#A78BFA', '#FBBF24'][i % 7],
    width: `${6 + (i % 4) * 2}px`,
    height: `${10 + (i % 5) * 3}px`,
    delay: `${((i * 0.11) % 2.5).toFixed(2)}s`,
    duration: `${(2.2 + (i % 6) * 0.35).toFixed(2)}s`,
    rotate: `${(i * 47) % 360}deg`,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-sm animate-bounce"
          style={{
            left: p.left,
            top: `${-5 - (i * 6) % 15}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotate})`,
            opacity: 0.88,
          }}
        />
      ))}
    </div>
  );
}
