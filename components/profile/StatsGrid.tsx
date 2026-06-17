"use client";

import type { UserStats } from "@/lib/xp";

interface Props {
  stats: UserStats | null;
  loginStreak: number;
  longestStreak: number;
  tierlistsCreated: number;
}

export default function StatsGrid({ stats, loginStreak, longestStreak, tierlistsCreated }: Props) {
  const items = [
    { label: "Drafts Played", value: stats?.drafts_played ?? 0, color: "text-blue-400" },
    { label: "Draft Wins", value: stats?.draft_wins ?? 0, color: "text-emerald-400" },
    { label: "Goals Scored", value: stats?.total_goals_scored ?? 0, color: "text-red-400" },
    { label: "Tierlists Created", value: tierlistsCreated, color: "text-purple-400" },
    { label: "Login Streak", value: loginStreak, color: "text-orange-400" },
    { label: "Longest Streak", value: longestStreak, color: "text-amber-400" },
  ];

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">Stats</h3>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="text-center py-2 px-1 rounded-lg bg-gray-800/50">
            <div className={`text-xl font-black ${item.color}`}>
              {item.value.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
