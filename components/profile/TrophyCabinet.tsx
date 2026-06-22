"use client";

import { useState } from "react";
import { RARITY_COLORS, FRAME_STYLES } from "@/lib/xp";
import type { Reward, UserStats } from "@/lib/xp";

interface RewardWithStatus extends Reward {
  unlocked: boolean;
  unlocked_at: string | null;
}

interface Props {
  rewards: RewardWithStatus[];
  stats: UserStats | null;
  level: number;
  equippedFrame: string;
  equippedTitle: string;
  onEquip: (type: "frame" | "title", id: string) => void;
}

type FilterCategory = "all" | "trophy" | "frame" | "title";

export default function TrophyCabinet({ rewards, stats, level, equippedFrame, equippedTitle, onEquip }: Props) {
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [selectedReward, setSelectedReward] = useState<RewardWithStatus | null>(null);
  const [showAll, setShowAll] = useState(false);

  const filtered = filter === "all" ? rewards : rewards.filter(r => r.category === filter);
  const unlockedCount = rewards.filter(r => r.unlocked).length;

  const INITIAL_VISIBLE = Math.max(8, Math.ceil(filtered.length / 3));
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_VISIBLE);

  const filters: { key: FilterCategory; label: string; count: number }[] = [
    { key: "all", label: "All", count: rewards.length },
    { key: "trophy", label: "Trophies", count: rewards.filter(r => r.category === "trophy").length },
    { key: "frame", label: "Frames", count: rewards.filter(r => r.category === "frame").length },
    { key: "title", label: "Titles", count: rewards.filter(r => r.category === "title").length },
  ];

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold tracking-[0.25em] text-amber-400/80 uppercase">
          Trophy Cabinet
        </h3>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${rewards.length > 0 ? (unlockedCount / rewards.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-amber-400">
            {unlockedCount}/{rewards.length}
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-3">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setShowAll(false); }}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
              filter === f.key
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "text-white hover:text-gray-300 border border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Rewards grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
        {visible.map((reward) => {
          const rarity = RARITY_COLORS[reward.rarity as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.bronze;
          const isEquipped = (reward.category === "frame" && equippedFrame === reward.id) ||
                             (reward.category === "title" && equippedTitle === reward.id);
          return (
            <button
              key={reward.id}
              onClick={() => setSelectedReward(reward)}
              className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all duration-200 ${
                reward.unlocked
                  ? isEquipped
                    ? `${rarity.bg} border-amber-400 ring-1 ring-amber-400/50 scale-[1.02]`
                    : `${rarity.bg} ${rarity.border} hover:scale-105`
                  : "bg-gray-800/30 border-gray-800/50 opacity-40 hover:opacity-50"
              }`}
            >
              {isEquipped && (
                <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  <svg className="w-2 h-2 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className={`text-2xl ${reward.unlocked ? "" : "grayscale"}`}>
                {getRewardIcon(reward)}
              </div>
              <span className={`text-[9px] font-bold text-center leading-tight truncate w-full ${
                reward.unlocked ? rarity.text : "text-white"
              }`}>
                {reward.unlocked ? reward.name : "???"}
              </span>
              {!reward.unlocked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-900/40">
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Show more / less */}
      {filtered.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full mt-3 py-2 text-[11px] font-bold text-white hover:text-gray-300 border border-gray-800/60 hover:border-gray-700/60 rounded-lg transition-colors"
        >
          {showAll ? "Show less ↑" : `Show more (${filtered.length - INITIAL_VISIBLE} hidden) ↓`}
        </button>
      )}

      {/* Detail modal */}
      {selectedReward && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedReward(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const rarity = RARITY_COLORS[selectedReward.rarity as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.bronze;
              const isEquipped = (selectedReward.category === "frame" && equippedFrame === selectedReward.id) ||
                                 (selectedReward.category === "title" && equippedTitle === selectedReward.id);
              const canEquip = selectedReward.unlocked && (selectedReward.category === "frame" || selectedReward.category === "title");
              const progress = getProgress(selectedReward, stats, level);

              return (
                <>
                  <div className="text-center mb-4">
                    <div className={`text-5xl mb-2 ${selectedReward.unlocked ? "" : "grayscale opacity-40"}`}>
                      {getRewardIcon(selectedReward)}
                    </div>
                    <h4 className={`text-lg font-black ${selectedReward.unlocked ? rarity.text : "text-white"}`}>
                      {selectedReward.unlocked ? selectedReward.name : "???"}
                    </h4>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1 uppercase tracking-wider ${rarity.bg} ${rarity.text} ${rarity.border} border`}>
                      {selectedReward.rarity}
                    </span>
                  </div>

                  {selectedReward.unlocked ? (
                    <>
                      <p className="text-sm text-white text-center">{selectedReward.description}</p>
                      {selectedReward.unlocked_at && (
                        <p className="text-[10px] text-white text-center mt-2">
                          Unlocked {new Date(selectedReward.unlocked_at).toLocaleDateString()}
                        </p>
                      )}

                      {/* Frame preview */}
                      {selectedReward.category === "frame" && (
                        <div className="mt-3 flex justify-center">
                          <div className={`w-24 h-16 rounded-lg ${FRAME_STYLES[selectedReward.id]?.border ?? "border-2 border-gray-700"} ${FRAME_STYLES[selectedReward.id]?.shadow ?? ""} bg-gray-800 flex items-center justify-center`}>
                            <span className="text-[9px] text-white font-bold">Preview</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-white text-center">
                        {getUnlockHint(selectedReward)}
                      </p>
                      {/* Progress bar */}
                      {progress !== null && (
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-white mb-1">
                            <span>{progress.current}</span>
                            <span>{progress.target}</span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${rarity.bg.replace("/20", "/60")} bg-gradient-to-r from-gray-600 to-gray-500`}
                              style={{ width: `${Math.min(progress.percent, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-white text-center mt-1">
                            {Math.round(progress.percent)}% complete
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="mt-4 flex gap-2">
                    {canEquip && (
                      <button
                        onClick={() => {
                          onEquip(selectedReward.category as "frame" | "title", selectedReward.id);
                          setSelectedReward(null);
                        }}
                        disabled={isEquipped}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                          isEquipped
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-default"
                            : "bg-amber-600 text-white hover:bg-amber-500"
                        }`}
                      >
                        {isEquipped ? "Equipped" : "Equip"}
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedReward(null)}
                      className={`${canEquip ? "" : "flex-1"} py-2 px-4 rounded-lg border border-gray-700 text-sm font-bold text-white hover:text-white hover:border-gray-500 transition-colors`}
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function getProgress(reward: Reward, stats: UserStats | null, level: number): { current: number; target: number; percent: number } | null {
  if (reward.unlock_type === "level" && reward.unlock_value) {
    return { current: level, target: reward.unlock_value, percent: (level / reward.unlock_value) * 100 };
  }
  if (reward.unlock_type === "stat" && reward.unlock_stat && reward.unlock_value && stats) {
    const val = stats[reward.unlock_stat as keyof UserStats];
    if (typeof val === "number") {
      return { current: val, target: reward.unlock_value, percent: (val / reward.unlock_value) * 100 };
    }
  }
  return null;
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
