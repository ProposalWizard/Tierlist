"use client";
import type { CareerState, Skills } from "@/lib/star/types";
import {
  TRAINING_LEVELS, highestUnlocked, starsOf, totalStars, skillFromStars,
} from "@/lib/star/trainingLevels";

/**
 * Pick a training level (Mikey, 25 Sep 2026 — New Star Soccer's ladder).
 * Thirty per skill, stars on each, locked until the one before has a star.
 * Any unlocked level can be replayed to win the stars you missed.
 */

const TITLES: Record<keyof Skills, string> = {
  pace: "Pace", power: "Power", technique: "Technique", vision: "Vision", freeKick: "Free Kick",
};

export default function TrainingLevelSelect({ career, skill, onPlay, onBack }: {
  career: CareerState;
  skill: keyof Skills;
  onPlay: (level: number) => void;
  onBack: () => void;
}) {
  const levels = starsOf(career, skill);
  const open = highestUnlocked(levels);
  const stars = totalStars(levels);
  const value = career.skills[skill];
  const ceiling = skillFromStars(stars);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 text-white px-4 py-4">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm font-black text-white">
            ‹ Back
          </button>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Training</div>
            <div className="text-lg font-black text-white">{TITLES[skill]} {value}</div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-gray-700 bg-gray-800 p-3">
          <div className="flex items-center justify-between text-sm font-black">
            <span className="text-amber-300">★ {stars} / {TRAINING_LEVELS * 3}</span>
            <span className="text-white">Level {open} is next</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${(stars / (TRAINING_LEVELS * 3)) * 100}%` }} />
          </div>
          <div className="mt-2 text-[11px] font-bold text-white">
            3 tries a level: first ★★★, second ★★, third ★. Every 3 new stars is +2 {TITLES[skill]}.
            {value < ceiling && ` You've lost ${ceiling - value} since your best — pass any level to win them back.`}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {levels.map((s, i) => {
            const n = i + 1;
            const locked = n > open;
            const next = n === open && s === 0;
            return (
              <button
                key={n}
                disabled={locked}
                onClick={() => onPlay(n)}
                aria-label={locked ? `Level ${n}, locked` : `Level ${n}, ${s} stars`}
                className={`rounded-lg border px-1 py-2 text-center transition active:scale-95 ${
                  locked
                    ? "border-gray-800 bg-gray-900 opacity-50"
                    : next
                      ? "border-amber-300 bg-gray-700"
                      : "border-gray-600 bg-gray-800 hover:bg-gray-700"
                }`}
              >
                <div className="text-sm font-black text-white">{locked ? "🔒" : n}</div>
                <div className="mt-0.5 text-[11px] tracking-tight">
                  {[0, 1, 2].map(k => (
                    <span key={k} className={k < s ? "text-amber-300" : "text-white/25"}>★</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
