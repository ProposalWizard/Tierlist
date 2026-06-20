"use client";

import { useState } from "react";
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

export default function WaysToEarnXP() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-800/60 bg-gray-900/60 hover:border-gray-700/60 hover:bg-gray-900 transition-all duration-200 group"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-amber-400/70 text-sm">✨</span>
          <span className="text-[11px] font-bold tracking-wider text-gray-400 group-hover:text-gray-200 transition-colors uppercase">
            Ways to Earn XP
          </span>
        </div>
        <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-amber-400 tracking-wider uppercase">
                Ways to Earn XP
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-3 space-y-0.5">
              {ACTIVITIES.map(activity => (
                <div
                  key={activity.key}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-800/40 transition-colors relative overflow-hidden group"
                >
                  <div className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full ${activity.accent} opacity-50 group-hover:opacity-80 transition-opacity`} />
                  <span className="text-lg flex-shrink-0 w-7 text-center">{activity.icon}</span>
                  <span className="flex-1 text-sm text-gray-300 font-medium min-w-0 truncate">{activity.label}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {activity.xp >= 500 && <span className="text-amber-400/60 text-xs">✨</span>}
                    <span className="text-sm font-black text-amber-400">+{activity.xp} XP</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
