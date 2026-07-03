"use client";

import { useState } from "react";
import type { BDSeason, BDPlayer, BDEvent, BDPosition } from "@/lib/ballonDorTypes";
import { applyChoice } from "@/lib/ballonDorEngine";

interface Props {
  season: BDSeason;
  player: BDPlayer;
  onUpdate: (s: BDSeason) => void;
}

const PHASE_LABELS: Record<string, string> = {
  pre_season: 'Pre-Season',
  first_half: 'Aug – Dec',
  january: 'January',
  second_half: 'Feb – Apr',
  run_in: 'May',
};

const PHASE_ORDER = ['pre_season', 'first_half', 'january', 'second_half', 'run_in'];

function statLabel(position: BDPosition): string {
  if (position === 'DEF' || position === 'GK') return 'Clean Sheets';
  return 'Goals';
}

function primaryStat(season: BDSeason, position: BDPosition): number {
  const b = season.baseStats;
  const e = season.eventStats;
  if (position === 'DEF' || position === 'GK') {
    return (b.cleanSheets + e.cleanSheets);
  }
  return (b.goals + e.goals);
}

function combineStats(season: BDSeason) {
  const b = season.baseStats;
  const e = season.eventStats;
  return {
    goals: b.goals + e.goals,
    assists: b.assists + e.assists,
    cleanSheets: b.cleanSheets + e.cleanSheets,
    avgRating: Math.min(9.9, Number((b.avgRating + e.avgRating).toFixed(2))),
    appearances: Math.max(0, b.appearances + e.appearances),
    manOfTheMatch: b.manOfTheMatch + e.manOfTheMatch,
  };
}

export default function BDSeason({ season, player, onUpdate }: Props) {
  const [showingOutcome, setShowingOutcome] = useState<BDEvent | null>(null);

  const currentEvent = season.events.find(e => !e.chosenId);
  const stats = combineStats(season);
  const doneCount = season.events.filter(e => e.chosenId).length;
  const totalEvents = season.events.length;
  const phaseIdx = PHASE_ORDER.indexOf(season.phase);

  function handleChoice(event: BDEvent, choiceId: string) {
    const updated = applyChoice(season, event.id, choiceId);
    const chosen = updated.events.find(e => e.id === event.id);
    setShowingOutcome(chosen ?? null);
    onUpdate(updated);
  }

  function handleContinue() {
    setShowingOutcome(null);
  }

  const isAllDone = !currentEvent && !showingOutcome;
  const pos = player.position;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-6">
      <div className="mx-auto max-w-lg">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Season {season.number} · {season.year}
            </p>
            <h2 className="text-lg font-black text-white">{player.name}</h2>
            <p className="text-xs text-gray-500">{season.club.name} · {pos}{season.inCL ? ' · 🌟 CL' : season.inEL ? ' · 🏆 EL' : ''}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">OVR</p>
            <p className="text-2xl font-black text-amber-400">{season.playerOverall}</p>
          </div>
        </div>

        {/* Phase progress bar */}
        <div className="mb-5 flex gap-1">
          {PHASE_ORDER.map((p, i) => (
            <div
              key={p}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < phaseIdx ? 'bg-amber-400' :
                i === phaseIdx ? 'bg-amber-500' :
                'bg-gray-800'
              }`}
            />
          ))}
        </div>
        <p className="mb-5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
          {PHASE_LABELS[season.phase] ?? season.phase} — {doneCount}/{totalEvents} events
        </p>

        {/* Stats panel */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-center">
            <p className="text-xs text-gray-500">{pos === 'GK' ? 'Clean Sheets' : pos === 'DEF' ? 'Clean Sheets' : 'Goals'}</p>
            <p className="text-2xl font-black text-white">
              {pos === 'GK' || pos === 'DEF' ? stats.cleanSheets : stats.goals}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-center">
            <p className="text-xs text-gray-500">{pos === 'GK' ? 'MOTM' : 'Assists'}</p>
            <p className="text-2xl font-black text-white">
              {pos === 'GK' ? stats.manOfTheMatch : stats.assists}
            </p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-center">
            <p className="text-xs text-gray-500">Rating</p>
            <p className={`text-2xl font-black ${stats.avgRating >= 7.5 ? 'text-amber-400' : 'text-white'}`}>
              {stats.avgRating.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Attribute bars */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {(['fitness', 'morale', 'fame'] as const).map(attr => {
            const v = season.attributes[attr];
            const color = attr === 'fitness' ? 'bg-green-500' : attr === 'morale' ? 'bg-blue-500' : 'bg-amber-500';
            return (
              <div key={attr} className="rounded-xl border border-gray-800 bg-gray-900 p-2.5">
                <div className="mb-1.5 flex justify-between">
                  <span className="text-xs capitalize text-gray-500">{attr}</span>
                  <span className="text-xs font-bold text-white">{v}</span>
                </div>
                <div className="h-1 rounded-full bg-gray-800">
                  <div className={`h-1 rounded-full ${color} transition-all`} style={{ width: `${v}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Current event or outcome */}
        {showingOutcome ? (
          <div className="rounded-2xl border border-green-800/50 bg-green-950/30 p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-400">Outcome</p>
            <p className="mb-4 text-sm leading-relaxed text-gray-200">{showingOutcome.outcomeText}</p>

            {/* Stat effects from chosen choice */}
            {(() => {
              const ch = showingOutcome.choices.find(c => c.id === showingOutcome.chosenId);
              const fx = ch?.effects ?? {};
              const entries = Object.entries(fx).filter(([k, v]) =>
                v !== undefined && v !== 0 && ['goals','assists','cleanSheets','manOfTheMatch','avgRating','appearances','fitness','morale','fame','overall'].includes(k)
              );
              if (!entries.length) return null;
              const labels: Record<string, string> = {
                goals: 'Goals', assists: 'Assists', cleanSheets: 'Clean Sheets',
                manOfTheMatch: 'MOTM', avgRating: 'Avg Rating', appearances: 'Apps',
                fitness: 'Fitness', morale: 'Morale', fame: 'Fame', overall: 'OVR',
              };
              return (
                <div className="mb-4 flex flex-wrap gap-2">
                  {entries.map(([k, v]) => {
                    const n = v as number;
                    const pos2 = n > 0;
                    return (
                      <span
                        key={k}
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          pos2 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {pos2 ? '+' : ''}{k === 'avgRating' ? n.toFixed(2) : n} {labels[k]}
                      </span>
                    );
                  })}
                </div>
              );
            })()}

            <button
              onClick={handleContinue}
              className="w-full rounded-xl bg-white/10 py-3 text-sm font-bold text-white transition hover:bg-white/15"
            >
              Continue →
            </button>
          </div>
        ) : currentEvent ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                currentEvent.category === 'match' ? 'bg-green-500/20 text-green-400' :
                currentEvent.category === 'career' ? 'bg-blue-500/20 text-blue-400' :
                currentEvent.category === 'lifestyle' ? 'bg-purple-500/20 text-purple-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {currentEvent.category}
              </span>
              <span className="text-xs text-gray-500">{PHASE_LABELS[currentEvent.phase]}</span>
            </div>
            <h3 className="mb-2 text-base font-black text-white">{currentEvent.title}</h3>
            <p className="mb-5 text-sm leading-relaxed text-gray-400">{currentEvent.context}</p>

            <div className="space-y-2.5">
              {currentEvent.choices.map(choice => (
                <button
                  key={choice.id}
                  onClick={() => handleChoice(currentEvent, choice.id)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800/50 p-3.5 text-left transition hover:border-amber-500/50 hover:bg-gray-800"
                >
                  <p className="text-sm font-bold text-white">
                    {choice.emoji} {choice.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{choice.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : isAllDone ? (
          <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 p-5 text-center">
            <p className="mb-2 text-2xl">⏳</p>
            <p className="mb-1 text-sm font-bold text-amber-400">Season complete</p>
            <p className="text-xs text-gray-500">Simulating trophies and Ballon d'Or nominations...</p>
          </div>
        ) : null}

        {/* Past events (compact log) */}
        {season.events.filter(e => e.chosenId).length > 0 && !showingOutcome && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">Season log</p>
            <div className="space-y-1.5">
              {season.events.filter(e => e.chosenId).map(e => {
                const ch = e.choices.find(c => c.id === e.chosenId);
                return (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2">
                    <span className="text-base">{ch?.emoji ?? '•'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-300">{e.title}</p>
                      <p className="truncate text-xs text-gray-600">{ch?.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
