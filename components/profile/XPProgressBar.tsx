"use client";

import { useState, useEffect } from "react";
import { getTitleForLevel } from "@/lib/xp";
import type { UserProgression } from "@/lib/xp";

interface Props {
  progression: UserProgression | null;
}

export default function XPProgressBar({ progression }: Props) {
  const level = progression?.level ?? 1;
  const currentXp = progression?.currentLevelXp ?? 0;
  const xpToNext = progression?.xpToNext ?? 100;
  const totalXp = progression?.xp ?? 0;

  const [animatedProgress, setAnimatedProgress] = useState(0);
  const targetProgress = xpToNext > 0 ? (currentXp / xpToNext) * 100 : 100;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(targetProgress), 200);
    return () => clearTimeout(timer);
  }, [targetProgress]);

  const nextTitle = getTitleForLevel(level + 1);
  const currentTitle = getTitleForLevel(level);
  const titleChangesNextLevel = nextTitle.id !== currentTitle.id;

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-gray-400">Level</span>
          <span className="text-2xl font-black text-amber-400 leading-none">{level}</span>
        </div>
        <div className="text-right flex items-baseline gap-2">
          <span className="text-2xl font-black text-gray-600 leading-none">{level + 1}</span>
          <span className="text-xs font-bold text-gray-600">Level</span>
        </div>
      </div>

      {/* XP bar */}
      <div className="relative h-3.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${Math.min(animatedProgress, 100)}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-full pointer-events-none" />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400 font-bold tabular-nums">
          {currentXp.toLocaleString()} / {xpToNext.toLocaleString()} XP
        </span>
        <span className="text-[10px] text-gray-600 font-medium tabular-nums">
          {totalXp.toLocaleString()} total
        </span>
      </div>

      {/* Next reward hint */}
      {titleChangesNextLevel && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px]">
          <span className="text-gray-600">Next level unlocks:</span>
          <span className="font-bold text-amber-400/80">{nextTitle.name}</span>
        </div>
      )}
    </div>
  );
}
