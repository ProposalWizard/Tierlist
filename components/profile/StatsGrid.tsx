"use client";

import type { UserStats } from "@/lib/xp";

interface Props {
  stats: UserStats | null;
  loginStreak: number;
  longestStreak: number;
  tierlistsCreated: number;
}

export default function StatsGrid({ stats, loginStreak, longestStreak, tierlistsCreated }: Props) {
  const draftsPlayed = stats?.drafts_played ?? 0;
  const draftWins = stats?.draft_wins ?? 0;
  const totalGoals = stats?.total_goals_scored ?? 0;
  const winRate = draftsPlayed > 0 ? Math.round((draftWins / draftsPlayed) * 100) : 0;

  const heroStats = [
    {
      label: "Drafts Played",
      value: draftsPlayed,
      icon: "🎮",
      gradient: "from-blue-500/20 via-blue-600/10 to-transparent",
      border: "border-blue-500/20",
      glow: "text-blue-400",
      glowShadow: "drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]",
      hoverGlow: "hover:shadow-[inset_0_0_20px_rgba(59,130,246,0.15)]",
    },
    {
      label: "Draft Wins",
      value: draftWins,
      icon: "🏆",
      gradient: "from-emerald-500/20 via-emerald-600/10 to-transparent",
      border: "border-emerald-500/20",
      glow: "text-emerald-400",
      glowShadow: "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]",
      hoverGlow: "hover:shadow-[inset_0_0_20px_rgba(16,185,129,0.15)]",
    },
    {
      label: "Goals Scored",
      value: totalGoals,
      icon: "⚽",
      gradient: "from-red-500/20 via-red-600/10 to-transparent",
      border: "border-red-500/20",
      glow: "text-red-400",
      glowShadow: "drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]",
      hoverGlow: "hover:shadow-[inset_0_0_20px_rgba(239,68,68,0.15)]",
    },
  ];

  const secondaryStats = [
    {
      label: "Tierlists Created",
      value: tierlistsCreated,
      icon: "🖼️",
      gradient: "from-purple-500/20 via-purple-600/10 to-transparent",
      border: "border-purple-500/20",
      glow: "text-purple-400",
      glowShadow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]",
      hoverGlow: "hover:shadow-[inset_0_0_20px_rgba(168,85,247,0.15)]",
    },
    {
      label: "Login Streak",
      value: loginStreak,
      icon: "🔥",
      gradient: "from-orange-500/20 via-orange-600/10 to-transparent",
      border: "border-orange-500/20",
      glow: "text-orange-400",
      glowShadow: "drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]",
      hoverGlow: "hover:shadow-[inset_0_0_20px_rgba(249,115,22,0.15)]",
    },
    {
      label: "Best Streak",
      value: longestStreak,
      icon: "⭐",
      gradient: "from-amber-500/20 via-amber-600/10 to-transparent",
      border: "border-amber-500/20",
      glow: "text-amber-400",
      glowShadow: "drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]",
      hoverGlow: "hover:shadow-[inset_0_0_20px_rgba(245,158,11,0.15)]",
    },
  ];

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),inset_0_0_40px_rgba(0,0,0,0.3)]">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold tracking-[0.25em] text-gray-200 uppercase">
          Career Stats
        </h3>
        {draftsPlayed > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20">
            <span className="text-[10px] font-bold tracking-wider text-yellow-500/70 uppercase">
              Win Rate
            </span>
            <span className="text-sm font-black text-yellow-400 drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]">
              {winRate}%
            </span>
          </div>
        )}
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-3 gap-2.5 mb-2.5">
        {heroStats.map((stat) => (
          <div
            key={stat.label}
            className={`
              relative text-center py-4 px-3 rounded-xl
              bg-gradient-to-b ${stat.gradient}
              border ${stat.border}
              ${stat.hoverGlow}
              hover:scale-[1.03]
              transition-all duration-200 ease-out
              cursor-default overflow-hidden
            `}
          >
            <div className="text-2xl mb-1.5">{stat.icon}</div>
            <div className={`text-2xl sm:text-3xl font-black ${stat.glow} ${stat.glowShadow} leading-none`}>
              {stat.value.toLocaleString()}
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-200 mt-1.5 leading-tight font-semibold tracking-wide uppercase">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-3 gap-2.5">
        {secondaryStats.map((stat) => (
          <div
            key={stat.label}
            className={`
              relative text-center py-3 px-2 rounded-xl
              bg-gradient-to-b ${stat.gradient}
              border ${stat.border}
              ${stat.hoverGlow}
              hover:scale-[1.03]
              transition-all duration-200 ease-out
              cursor-default overflow-hidden
            `}
          >
            <div className="text-lg mb-1">{stat.icon}</div>
            <div className={`text-xl sm:text-2xl font-black ${stat.glow} ${stat.glowShadow} leading-none`}>
              {stat.value.toLocaleString()}
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-200 mt-1.5 leading-tight font-semibold tracking-wide uppercase">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
