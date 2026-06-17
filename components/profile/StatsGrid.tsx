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
    { label: "Drafts Played", value: stats?.drafts_played ?? 0, color: "text-blue-400", icon: "\u{1F3AE}" },
    { label: "Draft Wins", value: stats?.draft_wins ?? 0, color: "text-emerald-400", icon: "\u{1F3C6}" },
    { label: "Goals Scored", value: stats?.total_goals_scored ?? 0, color: "text-red-400", icon: "\u{26BD}" },
    { label: "Tierlists", value: tierlistsCreated, color: "text-purple-400", icon: "\u{1F5BC}" },
    { label: "Login Streak", value: loginStreak, color: "text-orange-400", icon: "\u{1F525}" },
    { label: "Best Streak", value: longestStreak, color: "text-amber-400", icon: "\u{2B50}" },
  ];

  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">Stats</h3>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {items.map((item) => (
          <div key={item.label} className="text-center py-3 px-2 rounded-lg bg-gray-800/40 border border-gray-800/30 hover:bg-gray-800/60 transition-colors">
            <div className="text-base mb-0.5">{item.icon}</div>
            <div className={`text-lg font-black ${item.color} leading-none`}>
              {item.value.toLocaleString()}
            </div>
            <div className="text-[9px] text-gray-500 mt-1 leading-tight font-medium">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
