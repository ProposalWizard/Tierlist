"use client";

import type { UserProgression } from "@/lib/xp";

interface Props {
  progression: UserProgression | null;
}

export default function XPProgressBar({ progression }: Props) {
  const level = progression?.level ?? 1;
  const currentXp = progression?.currentLevelXp ?? 0;
  const xpToNext = progression?.xpToNext ?? 100;
  const progress = progression?.progress ?? 0;
  const totalXp = progression?.xp ?? 0;

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500">Level</span>
          <span className="text-lg font-black text-amber-400">{level}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500">Next Level</span>
          <span className="text-lg font-black text-gray-300 ml-2">{level + 1}</span>
        </div>
      </div>

      {/* XP bar */}
      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-full" />
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-gray-500 font-medium">
          {currentXp.toLocaleString()} / {xpToNext.toLocaleString()} XP
        </span>
        <span className="text-[10px] text-gray-600 font-medium">
          {totalXp.toLocaleString()} total XP
        </span>
      </div>
    </div>
  );
}
