"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { getTitleForLevel, RARITY_COLORS, FRAME_STYLES } from "@/lib/xp";
import type { UserProgression } from "@/lib/xp";

interface Props {
  progression: UserProgression | null;
}

const SEASON_EXPIRY = new Date("2026-09-16T00:00:00Z");
const CARDS_PER_PAGE = 3;

function getDaysLeft(): number {
  const diff = SEASON_EXPIRY.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function getRarityAccent(rarity: string) {
  switch (rarity) {
    case "diamond": return { glow: "shadow-cyan-400/60", ring: "ring-cyan-400", fill: "bg-cyan-400", text: "text-cyan-300" };
    case "gold": return { glow: "shadow-amber-400/60", ring: "ring-amber-400", fill: "bg-amber-400", text: "text-amber-400" };
    case "silver": return { glow: "shadow-gray-300/50", ring: "ring-gray-300", fill: "bg-gray-300", text: "text-gray-300" };
    default: return { glow: "shadow-orange-500/50", ring: "ring-orange-600", fill: "bg-orange-500", text: "text-orange-500" };
  }
}

export default function XPProgressBar({ progression }: Props) {
  const level = progression?.level ?? 1;
  const currentXp = progression?.currentLevelXp ?? 0;
  const xpToNext = progression?.xpToNext ?? 100;
  const totalXp = progression?.xp ?? 0;

  const currentTitle = getTitleForLevel(level);
  const rarityAccent = getRarityAccent(currentTitle.rarity);
  const levelProgress = xpToNext > 0 ? (currentXp / xpToNext) * 100 : 100;

  const [animatedLevelProgress, setAnimatedLevelProgress] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [expandedFrameId, setExpandedFrameId] = useState<string | null>(null);
  const [daysLeft] = useState(getDaysLeft);

  useEffect(() => {
    const t = setTimeout(() => setAnimatedLevelProgress(levelProgress), 200);
    return () => clearTimeout(t);
  }, [levelProgress]);

  const frameRewards = useMemo(() =>
    (progression?.rewards ?? [])
      .filter(r => r.category === "frame")
      .sort((a, b) => (a.unlock_value ?? 0) - (b.unlock_value ?? 0)),
    [progression?.rewards]
  );

  const totalPages = Math.max(1, Math.ceil(frameRewards.length / CARDS_PER_PAGE));
  const visibleFrames = frameRewards.slice(pageIndex * CARDS_PER_PAGE, (pageIndex + 1) * CARDS_PER_PAGE);

  const expandedReward = expandedFrameId ? frameRewards.find(r => r.id === expandedFrameId) ?? null : null;
  const expandedStyle = expandedFrameId ? (FRAME_STYLES[expandedFrameId] ?? FRAME_STYLES.frame_default) : null;

  return (
    <>
      <div className="rounded-xl border border-gray-800/60 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-5 overflow-hidden relative">
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(251,191,36,0.3) 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, rgba(251,191,36,0.15) 0%, transparent 40%)`,
          }}
        />

        {/* Title + expiry */}
        <div className="relative mb-5 flex items-center justify-between">
          <h3 className="text-[10px] font-bold tracking-[0.25em] text-amber-500/90 uppercase">
            Road to Legend Season 1
          </h3>
          <span className={`text-[10px] font-semibold tabular-nums ${daysLeft <= 14 ? "text-red-400" : "text-gray-500"}`}>
            {daysLeft}d left
          </span>
        </div>

        {/* Current level display */}
        <div className="relative flex items-center gap-4 mb-6">
          <div className="relative flex-shrink-0">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center
                bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent
                border-2 border-amber-500/40 ${rarityAccent.glow} shadow-lg`}
            >
              <span className="text-2xl font-black text-amber-400 leading-none">{level}</span>
            </div>
            <div className="absolute -inset-1 rounded-full border border-amber-500/20 animate-pulse pointer-events-none" />
          </div>

          <div className="flex-1 min-w-0">
            <div className={`text-lg font-bold ${RARITY_COLORS[currentTitle.rarity as keyof typeof RARITY_COLORS]?.text ?? "text-amber-400"} leading-tight`}>
              {currentTitle.name}
            </div>
            <div className="text-[11px] text-gray-500 font-medium mt-0.5">
              {totalXp.toLocaleString()} total XP
            </div>
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

        {/* Card rewards carousel */}
        {frameRewards.length > 0 && (
          <div>
            {/* Carousel header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">
                Card Rewards
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPageIndex(p => Math.max(0, p - 1))}
                    disabled={pageIndex === 0}
                    className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-[9px] text-gray-600 tabular-nums">{pageIndex + 1}/{totalPages}</span>
                  <button
                    onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
                    disabled={pageIndex === totalPages - 1}
                    className="w-5 h-5 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-3 gap-2">
              {visibleFrames.map(reward => {
                const frameStyle = FRAME_STYLES[reward.id] ?? FRAME_STYLES.frame_default;
                const isUnlocked = reward.unlocked;
                const rarity = RARITY_COLORS[reward.rarity as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.bronze;

                return (
                  <button
                    key={reward.id}
                    onClick={() => setExpandedFrameId(reward.id)}
                    className={`relative flex flex-col items-center rounded-xl border p-2 transition-all duration-200 w-full ${
                      isUnlocked
                        ? "border-amber-500/40 bg-amber-950/10 hover:bg-amber-950/25 hover:scale-105"
                        : "border-gray-800/60 bg-gray-900/40 hover:border-gray-700/60 hover:scale-105"
                    }`}
                  >
                    {/* Card image */}
                    <div className={`relative w-full aspect-[4/5] rounded-lg overflow-hidden mb-2 ${!isUnlocked ? "grayscale opacity-40" : ""}`}>
                      {frameStyle.image ? (
                        <Image
                          src={frameStyle.image}
                          alt={isUnlocked ? reward.name : "Locked"}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : (
                        <div className={`absolute inset-0 bg-gradient-to-br ${frameStyle.gradient ?? "from-gray-700 to-gray-900"} opacity-50`} />
                      )}
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-lg">
                          <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {isUnlocked && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center shadow-sm">
                          <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <p className={`text-[9px] font-bold text-center leading-tight mb-1 ${isUnlocked ? "text-gray-200" : "text-gray-600"}`}>
                      {isUnlocked ? reward.name : "???"}
                    </p>

                    {/* Level badge */}
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${rarity.text} ${rarity.border} ${rarity.bg}`}>
                      Lv {reward.unlock_value}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Pagination dots */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-1 mt-3">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPageIndex(i)}
                    className={`rounded-full transition-all duration-200 ${
                      i === pageIndex ? "w-4 h-1.5 bg-amber-400" : "w-1.5 h-1.5 bg-gray-700 hover:bg-gray-600"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend achieved */}
        {level >= 50 && (
          <div className="relative mt-4 px-3 py-3 rounded-lg bg-gradient-to-r from-cyan-900/20 via-cyan-800/10 to-cyan-900/20 border border-cyan-500/30">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <div>
                <div className="text-xs font-bold text-cyan-300">Legend Status Achieved</div>
                <div className="text-[10px] text-cyan-500/70 mt-0.5">You have reached the pinnacle of management.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expanded card modal */}
      {expandedReward && expandedStyle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6"
          onClick={() => setExpandedFrameId(null)}
        >
          <div
            className="flex flex-col items-center gap-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative w-52 h-[272px] rounded-2xl overflow-hidden shadow-2xl">
              {expandedStyle.image ? (
                <Image
                  src={expandedStyle.image}
                  alt={expandedReward.unlocked ? expandedReward.name : "Locked"}
                  fill
                  className="object-cover"
                  sizes="208px"
                />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${expandedStyle.gradient ?? "from-gray-700 to-gray-900"}`} />
              )}
              {!expandedReward.unlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/65 rounded-2xl">
                  <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-white font-bold text-base">
                {expandedReward.unlocked ? expandedReward.name : "???"}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {expandedReward.unlocked
                  ? "Unlocked!"
                  : `Unlocks at Level ${expandedReward.unlock_value}`}
              </p>
            </div>

            <button
              onClick={() => setExpandedFrameId(null)}
              className="px-6 py-2 rounded-xl bg-gray-800 border border-gray-700 text-sm font-semibold text-gray-300 hover:text-white hover:border-gray-500 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
