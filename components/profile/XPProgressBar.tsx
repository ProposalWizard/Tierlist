"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { getTitleForLevel, RARITY_COLORS, FRAME_STYLES, cumulativeXpForLevel } from "@/lib/xp";
import type { UserProgression } from "@/lib/xp";

interface Props {
  progression: UserProgression | null;
}

const SEASON_EXPIRY = new Date("2026-09-16T00:00:00Z");

function getDaysLeft(): number {
  return Math.max(0, Math.ceil((SEASON_EXPIRY.getTime() - Date.now()) / 86400000));
}

export default function XPProgressBar({ progression }: Props) {
  const level = progression?.level ?? 1;
  const totalXp = progression?.xp ?? 0;
  const currentXp = progression?.currentLevelXp ?? 0;
  const xpToNext = progression?.xpToNext ?? 100;

  const currentTitle = getTitleForLevel(level);
  const titleColor =
    RARITY_COLORS[currentTitle.rarity as keyof typeof RARITY_COLORS]?.text ?? "text-amber-400";

  const [daysLeft] = useState(getDaysLeft);
  const [pageIndex, setPageIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [animatedLevelPct, setAnimatedLevelPct] = useState(0);
  const [animatedMilestonePct, setAnimatedMilestonePct] = useState(0);

  // Sorted frame rewards from progression — only level-based cards contribute to Road to Legend
  const frameRewards = useMemo(
    () =>
      (progression?.rewards ?? [])
        .filter((r) => r.category === "frame" && r.unlock_type === "level")
        .sort((a, b) => (a.unlock_value ?? 0) - (b.unlock_value ?? 0)),
    [progression?.rewards]
  );

  // Pairs: (frameRewards[0],frameRewards[1]), (frameRewards[1],frameRewards[2]), …
  // Each pair = one page showing left card, bar, right card
  const pairs = useMemo(() => {
    const out: [typeof frameRewards[0], typeof frameRewards[0] | null][] = [];
    for (let i = 0; i < frameRewards.length; i++) {
      out.push([frameRewards[i], frameRewards[i + 1] ?? null]);
    }
    return out;
  }, [frameRewards]);

  // Auto-navigate to the pair containing the current level
  useEffect(() => {
    if (pairs.length === 0) return;
    let idx = pairs.length - 1;
    for (let i = 0; i < pairs.length; i++) {
      const [, right] = pairs[i];
      if (right === null || level < (right.unlock_value ?? Infinity)) {
        idx = i;
        break;
      }
    }
    setPageIndex(idx);
  }, [level, pairs]);

  const [leftCard, rightCard] = pairs[pageIndex] ?? [null, null];

  // Progress between the two milestone levels shown on the current page
  const milestonePct = useMemo(() => {
    if (!leftCard) return 0;
    const lv0 = leftCard.unlock_value ?? 0;
    const lv1 = rightCard?.unlock_value ?? lv0 + 1;
    if (level >= lv1) return 1;
    if (level < lv0) return 0;
    const xp0 = cumulativeXpForLevel(lv0);
    const xp1 = cumulativeXpForLevel(lv1);
    return xp1 > xp0 ? Math.min((totalXp - xp0) / (xp1 - xp0), 1) : 1;
  }, [leftCard, rightCard, level, totalXp]);

  // Per-level bar fill
  const levelPct = xpToNext > 0 ? Math.min(currentXp / xpToNext, 1) : 1;

  useEffect(() => {
    const t1 = setTimeout(() => setAnimatedLevelPct(levelPct * 100), 200);
    const t2 = setTimeout(() => setAnimatedMilestonePct(milestonePct * 100), 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [levelPct, milestonePct]);

  const expandedReward = expandedId ? frameRewards.find((r) => r.id === expandedId) ?? null : null;
  const expandedStyle = expandedId ? (FRAME_STYLES[expandedId] ?? FRAME_STYLES.frame_default) : null;

  return (
    <>
      <div className="rounded-xl border border-gray-800/60 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-5 relative overflow-hidden h-full">
        {/* Background glow */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 50%, rgba(251,191,36,0.5) 0%, transparent 45%), radial-gradient(circle at 85% 15%, rgba(251,191,36,0.25) 0%, transparent 40%)",
          }}
        />

        {/* Header row */}
        <div className="relative flex items-start justify-between mb-5">
          <div>
            <h3 className="text-xs font-black tracking-[0.2em] text-amber-500/80 uppercase">
              Road to Legend Season 1
            </h3>
            <div className={`text-base sm:text-2xl font-medium italic mt-0.5 leading-tight ${titleColor}`}>
              {currentTitle.name}
            </div>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
              <div className="text-3xl font-black text-amber-400 leading-none">Lv {level}</div>
              <div className="text-[11px] text-white mt-0.5">
                {totalXp.toLocaleString()} XP total
              </div>
            </div>
            <span
              className={`text-[10px] font-bold tabular-nums ${daysLeft <= 14 ? "text-red-400" : "text-white"}`}
            >
              {daysLeft}d left
            </span>
          </div>
        </div>

        {/* Milestone pair view */}
        {pairs.length > 0 && leftCard && (
          <div className="relative flex items-center gap-2 sm:gap-4 mb-5">
            {/* Prev arrow */}
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-white hover:text-white hover:border-gray-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Left card */}
            <MilestoneCard
              reward={leftCard}
              onClick={() => setExpandedId(leftCard.id)}
            />

            {/* Bar column */}
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <div className="flex justify-between text-xs font-black">
                <span className="text-amber-400">Lv {leftCard.unlock_value}</span>
                {rightCard && <span className="text-white">Lv {rightCard.unlock_value}</span>}
              </div>
              <div className="relative h-3.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${animatedMilestonePct}%` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-full pointer-events-none" />
              </div>
              <div className="text-center text-[11px] font-semibold">
                {rightCard && level < (rightCard.unlock_value ?? 999) ? (
                  <span className="text-white">
                    {(rightCard.unlock_value ?? 0) - level} level
                    {(rightCard.unlock_value ?? 0) - level !== 1 ? "s" : ""} to next card
                  </span>
                ) : (
                  <span className="text-amber-400">✓ Reward unlocked!</span>
                )}
              </div>
            </div>

            {/* Right card */}
            {rightCard ? (
              <MilestoneCard
                reward={rightCard}
                onClick={() => setExpandedId(rightCard.id)}
              />
            ) : (
              <div className="flex-shrink-0 w-28" />
            )}

            {/* Next arrow */}
            <button
              onClick={() => setPageIndex((p) => Math.min(pairs.length - 1, p + 1))}
              disabled={pageIndex === pairs.length - 1}
              className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-white hover:text-white hover:border-gray-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Per-level XP bar */}
        <div className="relative pt-4 border-t border-gray-800/40">
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px] text-white font-semibold">
              {currentXp.toLocaleString()} / {xpToNext.toLocaleString()} XP this level
            </span>
            <span className="text-[11px] text-white">
              Lv {level} &rarr; {level + 1}
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${animatedLevelPct}%` }}
            />
          </div>
        </div>

        {/* Legend achieved */}
        {level >= 50 && (
          <div className="relative mt-4 px-3 py-3 rounded-lg bg-gradient-to-r from-cyan-900/20 via-cyan-800/10 to-cyan-900/20 border border-cyan-500/30">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <div>
                <div className="text-xs font-bold text-cyan-300">Legend Status Achieved</div>
                <div className="text-[10px] text-cyan-500/70 mt-0.5">
                  You have reached the pinnacle of management.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expanded card modal */}
      {expandedReward && expandedStyle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6"
          onClick={() => setExpandedId(null)}
        >
          <div className="flex flex-col items-center gap-5" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-56 h-[290px] rounded-2xl overflow-hidden shadow-2xl">
              {expandedStyle.image ? (
                <Image
                  src={expandedStyle.image}
                  alt={expandedReward.unlocked ? expandedReward.name : "Locked"}
                  fill
                  className="object-cover"
                  sizes="224px"
                  quality={100}
                />
              ) : (
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${expandedStyle.gradient ?? "from-gray-700 to-gray-900"}`}
                />
              )}
              {!expandedReward.unlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/65 rounded-2xl">
                  <svg className="w-14 h-14 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">
                {expandedReward.unlocked ? expandedReward.name : "???"}
              </p>
              <p className="text-white text-sm mt-1">
                {expandedReward.unlocked
                  ? "Unlocked!"
                  : `Unlocks at Level ${expandedReward.unlock_value}`}
              </p>
            </div>
            <button
              onClick={() => setExpandedId(null)}
              className="px-7 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-sm font-semibold text-white hover:text-white hover:border-gray-500 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function MilestoneCard({
  reward,
  onClick,
}: {
  reward: { id: string; name: string; unlock_value: number | null; unlocked: boolean; rarity: string };
  onClick: () => void;
}) {
  const frameStyle = FRAME_STYLES[reward.id] ?? FRAME_STYLES.frame_default;
  const isUnlocked = reward.unlocked;
  const rarity = RARITY_COLORS[reward.rarity as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.bronze;

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
    >
      <div
        className={`relative w-[72px] h-24 sm:w-28 sm:h-36 rounded-xl overflow-hidden shadow-xl transition-transform duration-200 group-hover:scale-105 ${
          !isUnlocked ? "opacity-40" : ""
        }`}
      >
        {frameStyle.image ? (
          <Image
            src={frameStyle.image}
            alt={isUnlocked ? reward.name : "Locked"}
            fill
            className="object-cover"
            sizes="112px"
            quality={100}
          />
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${frameStyle.gradient ?? "from-gray-700 to-gray-900"}`}
          />
        )}
        {!isUnlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/55 rounded-xl">
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
        {isUnlocked && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
            <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
      <p
        className={`text-[10px] font-bold text-center leading-tight max-w-[72px] sm:max-w-[112px] ${
          isUnlocked ? "text-white" : "text-white"
        }`}
      >
        {isUnlocked ? reward.name : "???"}
      </p>
      <span
        className={`text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded border ${rarity.text} ${rarity.border} ${rarity.bg}`}
      >
        Lv {reward.unlock_value}
      </span>
    </button>
  );
}
