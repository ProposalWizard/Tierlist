"use client";

import { XP_AWARDS } from "@/lib/xp";

interface Activity {
  key: keyof typeof XP_AWARDS;
  label: string;
  icon: string;
  xp: number;
  accent: string;
}

const ACTIVITIES: Activity[] = [
  { key: "draft_invincible", label: "Invincible Season", icon: "\u{1F6E1}️", xp: XP_AWARDS.draft_invincible, accent: "bg-emerald-500" },
  { key: "streak_30", label: "30-Day Login Streak", icon: "\u{1F4A5}", xp: XP_AWARDS.streak_30, accent: "bg-red-500" },
  { key: "draft_win", label: "Win the League Title", icon: "\u{1F3C6}", xp: XP_AWARDS.draft_win, accent: "bg-amber-500" },
  { key: "streak_7", label: "7-Day Login Streak", icon: "\u{1F525}", xp: XP_AWARDS.streak_7, accent: "bg-orange-500" },
  { key: "draft_complete", label: "Complete a Draft Season", icon: "\u{1F3AE}", xp: XP_AWARDS.draft_complete, accent: "bg-blue-500" },
  { key: "tierlist_likes_10", label: "Get 10 Likes on a Tierlist", icon: "❤️", xp: XP_AWARDS.tierlist_likes_10, accent: "bg-pink-500" },
  { key: "tierlist_create", label: "Create a Tierlist", icon: "\u{1F5BC}️", xp: XP_AWARDS.tierlist_create, accent: "bg-purple-500" },
  { key: "vote_cast", label: "Cast a Vote", icon: "\u{1F5F3}️", xp: XP_AWARDS.vote_cast, accent: "bg-cyan-500" },
];

// Already sorted by XP descending in the array above

export default function WaysToEarnXP() {
  return (
    <div className="rounded-xl border border-gray-800/50 bg-gray-900 p-4">
      <h3 className="text-[10px] font-bold tracking-widest text-amber-400/80 uppercase mb-3">
        Ways to Earn XP
      </h3>
      <div className="space-y-1">
        {ACTIVITIES.map((activity) => {
          const isHighValue = activity.xp >= 500;
          return (
            <div
              key={activity.key}
              className="group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-800/40 transition-colors relative overflow-hidden"
            >
              {/* Left accent line */}
              <div className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${activity.accent} opacity-50 group-hover:opacity-80 transition-opacity`} />

              {/* Icon */}
              <span className="text-lg flex-shrink-0 w-7 text-center">{activity.icon}</span>

              {/* Activity name */}
              <span className="flex-1 text-sm text-gray-300 font-medium min-w-0 truncate">
                {activity.label}
              </span>

              {/* XP amount + optional sparkle */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isHighValue && (
                  <span className="text-amber-400/60 text-xs">{"✨"}</span>
                )}
                <span className="text-sm font-black text-amber-400">
                  +{activity.xp} XP
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
