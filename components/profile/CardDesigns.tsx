"use client";

import { useState } from "react";
import Image from "next/image";
import { RARITY_COLORS, FRAME_STYLES } from "@/lib/xp";
import type { Reward } from "@/lib/xp";

interface RewardWithStatus extends Reward {
  unlocked: boolean;
  unlocked_at: string | null;
}

interface Props {
  rewards: RewardWithStatus[];
  equippedFrame: string;
  onEquip: (type: "frame", id: string) => void;
}

export default function CardDesigns({ rewards, equippedFrame, onEquip }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const frameRewards = rewards.filter((r) => r.category === "frame");
  const equippedReward = frameRewards.find((r) => r.id === equippedFrame);

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative">
        <h3 className="text-[10px] font-bold tracking-[0.2em] text-amber-400/80 uppercase">
          Collection
        </h3>
        {equippedReward && (
          <span className="text-[10px] font-bold text-gray-500">
            Equipped:{" "}
            <span className="text-amber-400">{equippedReward.name}</span>
          </span>
        )}
      </div>

      {/* Frame grid */}
      <div className="grid grid-cols-2 gap-3 relative">
        {frameRewards.map((reward) => {
          const rarity =
            RARITY_COLORS[reward.rarity as keyof typeof RARITY_COLORS] ??
            RARITY_COLORS.bronze;
          const frameStyle = FRAME_STYLES[reward.id] ?? FRAME_STYLES.frame_default;
          const isEquipped = equippedFrame === reward.id;
          const isHovered = hoveredId === reward.id;
          const isLocked = !reward.unlocked;

          return (
            <div
              key={reward.id}
              className={`relative group rounded-xl border transition-all duration-200 ${
                isEquipped
                  ? "border-amber-500/60 bg-amber-950/20"
                  : isLocked
                  ? "border-gray-800/50 bg-gray-900/50"
                  : "border-gray-700/50 bg-gray-800/30 hover:border-gray-600/60 hover:bg-gray-800/50"
              }`}
              onMouseEnter={() => setHoveredId(reward.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Equipped badge */}
              {isEquipped && (
                <div className="absolute -top-1.5 -right-1.5 z-10 bg-amber-500 rounded-full w-5 h-5 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <svg
                    className="w-3 h-3 text-black"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}

              {/* Card preview area */}
              <div className="flex items-center justify-center pt-4 pb-2 px-3 bg-gray-900 rounded-t-xl">
                <div
                  className={`relative w-32 h-44 rounded-lg overflow-hidden bg-gray-900 transition-transform duration-200 ${
                    isLocked ? "grayscale opacity-40" : ""
                  } ${isHovered && !isLocked ? "scale-105" : ""}`}
                >
                  {frameStyle.image ? (
                    <>
                      <Image
                        src={frameStyle.image}
                        alt={reward.name}
                        fill
                        className="object-cover"
                        sizes="128px"
                      />
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-900/60">
                          <svg className="w-7 h-7 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Card body */}
                      <div
                        className={`absolute inset-0 rounded-lg ${frameStyle.border} ${
                          frameStyle.shadow
                        } overflow-hidden`}
                      >
                        {/* Card gradient background */}
                        <div
                          className={`absolute inset-0 ${
                            frameStyle.gradient
                              ? frameStyle.gradient
                              : "bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900"
                          } opacity-30`}
                        />

                        {/* Inner card structure */}
                        <div className="relative h-full flex flex-col items-center justify-between p-1.5">
                          {/* Rating box */}
                          <div className="self-start">
                            <div className="text-[8px] font-black text-white/60 leading-none">
                              88
                            </div>
                            <div className="text-[5px] font-bold text-white/40 leading-none mt-0.5">
                              ST
                            </div>
                          </div>

                          {/* Player silhouette */}
                          <div className="flex-1 flex items-center justify-center">
                            <svg
                              className="w-8 h-8 text-white/20"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                          </div>

                          {/* Name bar */}
                          <div className="w-full">
                            <div className="h-0.5 bg-white/10 rounded-full mb-0.5" />
                            <div className="flex justify-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <div
                                  key={i}
                                  className="w-1 h-0.5 bg-white/10 rounded-full"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Lock overlay */}
                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-900/60">
                          <svg
                            className="w-7 h-7 text-gray-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Info section */}
              <div className="px-3 pb-3 text-center">
                {/* Frame name */}
                <p
                  className={`text-[11px] font-bold leading-tight mb-1 ${
                    isLocked ? "text-gray-600" : "text-gray-200"
                  }`}
                >
                  {isLocked ? "???" : reward.name}
                </p>

                {/* Rarity badge */}
                <span
                  className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                    isLocked
                      ? "text-gray-600 border-gray-700/50 bg-gray-800/30"
                      : `${rarity.text} ${rarity.border} ${rarity.bg}`
                  }`}
                >
                  {reward.rarity}
                </span>

                {/* Equipped label */}
                {isEquipped && (
                  <p className="text-[9px] font-bold text-amber-400 mt-1.5 tracking-wider uppercase">
                    Equipped
                  </p>
                )}

                {/* Unlock requirement for locked items */}
                {isLocked && (
                  <p className="text-[8px] text-gray-600 mt-1.5 leading-tight">
                    {getUnlockText(reward)}
                  </p>
                )}

                {/* Equip button on hover for unlocked, non-equipped items */}
                {!isLocked && !isEquipped && (
                  <button
                    onClick={() => onEquip("frame", reward.id)}
                    className={`mt-1.5 w-full py-1 rounded-md text-[10px] font-bold transition-all duration-200 ${
                      isHovered
                        ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                        : "bg-gray-700/50 text-gray-400 hover:bg-amber-600 hover:text-white"
                    }`}
                  >
                    EQUIP
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getUnlockText(reward: Reward): string {
  if (reward.unlock_type === "level") {
    return `Reach Level ${reward.unlock_value}`;
  }
  const statLabels: Record<string, string> = {
    drafts_played: "drafts",
    draft_wins: "league wins",
    draft_invincibles: "invincible seasons",
    total_goals_scored: "goals scored",
    tierlists_created: "tierlists created",
    tierlists_likes_received: "likes received",
    votes_cast: "votes cast",
    longest_streak: "day streak",
  };
  const label = reward.unlock_stat
    ? statLabels[reward.unlock_stat] ?? reward.unlock_stat
    : "???";
  return `${reward.unlock_value} ${label}`;
}
