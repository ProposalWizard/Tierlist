"use client";

import { useState, useEffect, useMemo } from "react";
import { getTitleForLevel, MANAGER_TITLES, RARITY_COLORS } from "@/lib/xp";
import type { UserProgression } from "@/lib/xp";

interface Props {
  progression: UserProgression | null;
}

// Milestone levels corresponding to MANAGER_TITLES
const MILESTONE_LEVELS = MANAGER_TITLES.map((t) => t.level);

function getRarityAccent(rarity: string): {
  glow: string;
  ring: string;
  fill: string;
  text: string;
} {
  switch (rarity) {
    case "diamond":
      return {
        glow: "shadow-cyan-400/60",
        ring: "ring-cyan-400",
        fill: "bg-cyan-400",
        text: "text-cyan-300",
      };
    case "gold":
      return {
        glow: "shadow-amber-400/60",
        ring: "ring-amber-400",
        fill: "bg-amber-400",
        text: "text-amber-400",
      };
    case "silver":
      return {
        glow: "shadow-gray-300/50",
        ring: "ring-gray-300",
        fill: "bg-gray-300",
        text: "text-gray-300",
      };
    default:
      return {
        glow: "shadow-orange-500/50",
        ring: "ring-orange-600",
        fill: "bg-orange-500",
        text: "text-orange-500",
      };
  }
}

export default function XPProgressBar({ progression }: Props) {
  const level = progression?.level ?? 1;
  const currentXp = progression?.currentLevelXp ?? 0;
  const xpToNext = progression?.xpToNext ?? 100;
  const totalXp = progression?.xp ?? 0;

  const currentTitle = getTitleForLevel(level);

  // Determine the next milestone (next MANAGER_TITLES entry after current level)
  const nextMilestone = useMemo(() => {
    return MANAGER_TITLES.find((t) => t.level > level) ?? null;
  }, [level]);

  // Calculate the progress fraction for the current level's XP bar
  const levelProgress = xpToNext > 0 ? (currentXp / xpToNext) * 100 : 100;

  // Animated progress for the current-level XP bar
  const [animatedLevelProgress, setAnimatedLevelProgress] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedLevelProgress(levelProgress), 200);
    return () => clearTimeout(timer);
  }, [levelProgress]);

  // Calculate global journey progress (0..1) across all milestones
  // We map the current level+fraction onto the milestone track
  const journeyProgress = useMemo(() => {
    const milestones = MILESTONE_LEVELS;
    if (level >= milestones[milestones.length - 1]) return 1;
    if (level < milestones[0]) return 0;

    // Find which segment we're in
    for (let i = 0; i < milestones.length - 1; i++) {
      const start = milestones[i];
      const end = milestones[i + 1];
      if (level >= start && level < end) {
        const segmentFraction = (level - start + (xpToNext > 0 ? currentXp / xpToNext : 0)) / (end - start);
        const baseProgress = i / (milestones.length - 1);
        const segmentWidth = 1 / (milestones.length - 1);
        return baseProgress + segmentFraction * segmentWidth;
      }
    }
    return 1;
  }, [level, currentXp, xpToNext]);

  // Animated journey progress for the track fill
  const [animatedJourney, setAnimatedJourney] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedJourney(journeyProgress), 300);
    return () => clearTimeout(timer);
  }, [journeyProgress]);

  // Find which milestone index corresponds to the current position (for the glowing marker)
  const currentMilestoneIdx = useMemo(() => {
    for (let i = MANAGER_TITLES.length - 1; i >= 0; i--) {
      if (level >= MANAGER_TITLES[i].level) return i;
    }
    return 0;
  }, [level]);

  const rarityAccent = getRarityAccent(currentTitle.rarity);

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-5 overflow-hidden relative">
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(251,191,36,0.3) 0%, transparent 50%),
                            radial-gradient(circle at 80% 20%, rgba(251,191,36,0.15) 0%, transparent 40%)`,
        }}
      />

      {/* Title */}
      <div className="relative mb-5">
        <h3 className="text-[10px] font-bold tracking-[0.25em] text-amber-500/90 uppercase">
          Road to Legend
        </h3>
      </div>

      {/* Current level display */}
      <div className="relative flex items-center gap-4 mb-6">
        {/* Level badge */}
        <div className="relative flex-shrink-0">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center
              bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent
              border-2 border-amber-500/40 ${rarityAccent.glow} shadow-lg`}
          >
            <span className="text-2xl font-black text-amber-400 leading-none">{level}</span>
          </div>
          {/* Glow ring */}
          <div className="absolute -inset-1 rounded-full border border-amber-500/20 animate-pulse pointer-events-none" />
        </div>

        {/* Title and XP */}
        <div className="flex-1 min-w-0">
          <div className={`text-lg font-bold ${RARITY_COLORS[currentTitle.rarity as keyof typeof RARITY_COLORS]?.text ?? "text-amber-400"} leading-tight`}>
            {currentTitle.name}
          </div>
          <div className="text-[11px] text-gray-500 font-medium mt-0.5">
            {totalXp.toLocaleString()} total XP
          </div>

          {/* Current level XP bar */}
          <div className="mt-2 relative">
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(animatedLevelProgress, 100)}%` }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-full pointer-events-none" />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-500 font-semibold tabular-nums">
                {currentXp.toLocaleString()} / {xpToNext.toLocaleString()} XP
              </span>
              <span className="text-[10px] text-gray-600 tabular-nums">
                Lv {level} &rarr; {level + 1}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Milestone path */}
      <div className="relative mb-4">
        {/* Track background */}
        <div className="relative mx-3">
          {/* Background track line */}
          <div className="absolute top-3 left-0 right-0 h-1 bg-gray-800 rounded-full" />

          {/* Filled progress track */}
          <div
            className="absolute top-3 left-0 h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 rounded-full transition-all duration-1200 ease-out"
            style={{ width: `${Math.min(animatedJourney * 100, 100)}%` }}
          >
            {/* Shimmer effect on the filled track */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full animate-pulse" />
          </div>

          {/* Milestone nodes */}
          <div className="relative flex justify-between items-start">
            {MANAGER_TITLES.map((milestone, idx) => {
              const reached = level >= milestone.level;
              const isCurrent = idx === currentMilestoneIdx;
              const accent = getRarityAccent(milestone.rarity);

              return (
                <div
                  key={milestone.id}
                  className="flex flex-col items-center relative"
                  style={{ width: 0, flexShrink: 0, flexGrow: 0 }}
                >
                  {/* Node circle */}
                  <div className="relative">
                    {/* Glow behind current milestone */}
                    {isCurrent && (
                      <div
                        className={`absolute -inset-2 rounded-full ${accent.fill} opacity-30 blur-md animate-pulse`}
                      />
                    )}
                    <div
                      className={`relative w-6 h-6 rounded-full flex items-center justify-center
                        transition-all duration-500 z-10
                        ${reached
                          ? `${accent.fill} shadow-md ${isCurrent ? `${accent.glow} shadow-lg ring-2 ${accent.ring} ring-offset-1 ring-offset-gray-900` : ""}`
                          : "bg-gray-800 border-2 border-gray-700"
                        }`}
                    >
                      {reached ? (
                        <svg className="w-3 h-3 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <span className="text-[8px] font-bold text-gray-600">
                          {milestone.level}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Level number */}
                  <span
                    className={`text-[9px] font-bold mt-1.5 whitespace-nowrap
                      ${reached ? accent.text : "text-gray-600"}`}
                  >
                    Lv {milestone.level}
                  </span>

                  {/* Title name - show on every other node or if current/first/last to avoid overlap */}
                  <span
                    className={`text-[7px] leading-tight text-center whitespace-nowrap
                      ${reached ? "text-gray-400" : "text-gray-700"}
                      ${isCurrent ? "font-bold" : "font-medium"}`}
                  >
                    {milestone.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Next milestone callout */}
      {nextMilestone && (
        <div className="relative mt-4 px-3 py-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-8 rounded-full bg-gradient-to-b from-amber-500 to-amber-700" />
              <div>
                <div className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">
                  Next Milestone
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-sm font-bold text-amber-400">
                    Level {nextMilestone.level}
                  </span>
                  <span className="text-[10px] text-gray-500">&mdash;</span>
                  <span
                    className={`text-xs font-bold ${
                      RARITY_COLORS[nextMilestone.rarity as keyof typeof RARITY_COLORS]?.text ?? "text-gray-300"
                    }`}
                  >
                    {nextMilestone.name}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-gray-600 font-medium">
                {nextMilestone.level - level} level{nextMilestone.level - level !== 1 ? "s" : ""} away
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reached Legend state */}
      {!nextMilestone && (
        <div className="relative mt-4 px-3 py-3 rounded-lg bg-gradient-to-r from-cyan-900/20 via-cyan-800/10 to-cyan-900/20 border border-cyan-500/30">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <div>
              <div className="text-xs font-bold text-cyan-300">
                Legend Status Achieved
              </div>
              <div className="text-[10px] text-cyan-500/70 mt-0.5">
                You have reached the pinnacle of management.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
