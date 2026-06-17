"use client";

import { useState } from "react";
import { RARITY_COLORS } from "@/lib/xp";
import type { Reward } from "@/lib/xp";

interface RewardWithStatus extends Reward {
  unlocked: boolean;
  unlocked_at: string | null;
}

interface Props {
  rewards: RewardWithStatus[];
}

type FilterCategory = "all" | "trophy" | "frame" | "title";

export default function TrophyCabinet({ rewards }: Props) {
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [selectedReward, setSelectedReward] = useState<RewardWithStatus | null>(null);

  const filtered = filter === "all" ? rewards : rewards.filter(r => r.category === filter);
  const unlockedCount = rewards.filter(r => r.unlocked).length;

  const filters: { key: FilterCategory; label: string }[] = [
    { key: "all", label: "All" },
    { key: "trophy", label: "Trophies" },
    { key: "frame", label: "Frames" },
    { key: "title", label: "Titles" },
  ];

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
          Trophy Cabinet
        </h3>
        <span className="text-[10px] font-bold text-amber-400">
          {unlockedCount}/{rewards.length}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
              filter === f.key
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-gray-500 hover:text-gray-300 border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Rewards grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
        {filtered.map((reward) => {
          const rarity = RARITY_COLORS[reward.rarity as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.bronze;
          return (
            <button
              key={reward.id}
              onClick={() => setSelectedReward(reward)}
              className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                reward.unlocked
                  ? `${rarity.bg} ${rarity.border} hover:scale-105`
                  : "bg-gray-800/30 border-gray-800/50 opacity-40"
              }`}
            >
              <div className={`text-2xl ${reward.unlocked ? "" : "grayscale"}`}>
                {getRewardIcon(reward)}
              </div>
              <span className={`text-[9px] font-bold text-center leading-tight truncate w-full ${
                reward.unlocked ? rarity.text : "text-gray-600"
              }`}>
                {reward.unlocked ? reward.name : "???"}
              </span>
              {!reward.unlocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail modal */}
      {selectedReward && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedReward(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const rarity = RARITY_COLORS[selectedReward.rarity as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.bronze;
              return (
                <>
                  <div className="text-center mb-4">
                    <div className={`text-5xl mb-2 ${selectedReward.unlocked ? "" : "grayscale opacity-40"}`}>
                      {getRewardIcon(selectedReward)}
                    </div>
                    <h4 className={`text-lg font-black ${selectedReward.unlocked ? rarity.text : "text-gray-500"}`}>
                      {selectedReward.unlocked ? selectedReward.name : "???"}
                    </h4>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1 uppercase tracking-wider ${rarity.bg} ${rarity.text} ${rarity.border} border`}>
                      {selectedReward.rarity}
                    </span>
                  </div>

                  {selectedReward.unlocked ? (
                    <>
                      <p className="text-sm text-gray-400 text-center">{selectedReward.description}</p>
                      {selectedReward.unlocked_at && (
                        <p className="text-[10px] text-gray-600 text-center mt-2">
                          Unlocked {new Date(selectedReward.unlocked_at).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 text-center">
                      {getUnlockHint(selectedReward)}
                    </p>
                  )}

                  <button
                    onClick={() => setSelectedReward(null)}
                    className="w-full mt-4 py-2 rounded-lg border border-gray-700 text-sm font-bold text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                  >
                    Close
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function getRewardIcon(reward: Reward): string {
  const icons: Record<string, string> = {
    trophy_first_draft: "\u{1F4CB}",
    trophy_10_drafts: "\u{1F4CB}",
    trophy_50_drafts: "\u{1F3C5}",
    trophy_first_win: "\u{1F3C6}",
    trophy_10_wins: "\u{1F3C6}",
    trophy_50_wins: "\u{1F451}",
    trophy_invincible: "\u{1F6E1}",
    trophy_100_goals: "\u{26BD}",
    trophy_500_goals: "\u{26A1}",
    trophy_1000_goals: "\u{1F525}",
    trophy_tierlist_maker: "\u{1F5BC}",
    trophy_popular: "\u{2764}",
    trophy_voter: "\u{1F5F3}",
    trophy_streak_7: "\u{1F525}",
    trophy_streak_30: "\u{1F4A5}",
    frame_default: "\u{1F5BC}",
    frame_silver: "\u{1FA9F}",
    frame_gold: "\u{1F7E8}",
    frame_champions: "\u{2B50}",
    frame_diamond: "\u{1F48E}",
    frame_invincibles: "\u{1F6E1}",
    frame_future_stars: "\u{2728}",
    frame_ballon_dor: "\u{1F3C6}",
    title_rookie: "\u{1F464}",
    title_rising: "\u{1F4C8}",
    title_promising: "\u{1F3C5}",
    title_established: "\u{1F6E1}",
    title_tactical: "\u{1F9E0}",
    title_elite: "\u{1F451}",
    title_mastermind: "\u{2728}",
    title_world_class: "\u{1F30D}",
    title_legend: "\u{1F3C6}",
  };
  return icons[reward.id] ?? "\u{2753}";
}

function getUnlockHint(reward: Reward): string {
  if (reward.unlock_type === "level") {
    return `Reach Level ${reward.unlock_value} to unlock`;
  }
  const statLabels: Record<string, string> = {
    drafts_played: "drafts",
    draft_wins: "league wins",
    draft_invincibles: "invincible season",
    total_goals_scored: "goals scored",
    tierlists_created: "tierlists created",
    tierlists_likes_received: "likes received",
    votes_cast: "votes cast",
    longest_streak: "day login streak",
  };
  const label = reward.unlock_stat ? statLabels[reward.unlock_stat] ?? reward.unlock_stat : "???";
  return `${reward.unlock_value} ${label} to unlock`;
}
