"use client";

import { useState } from "react";
import { XP_AWARDS } from "@/lib/xp";

interface Activity {
  key: keyof typeof XP_AWARDS;
  label: string;
  icon: string;
  xp: number;
  accent: string;
  note?: string;
}

// Sorted by XP (highest first)
const ACTIVITIES: Activity[] = [
  { key: "hall_of_fame_record",   label: "Get a Record in Draft Hall of Fame",        icon: "🏅", xp: XP_AWARDS.hall_of_fame_record,   accent: "bg-amber-400", note: "Max 10/day" },
  { key: "daily_login",           label: "Daily Login",                                icon: "📅", xp: XP_AWARDS.daily_login,           accent: "bg-blue-500", note: "Once per day" },
  { key: "tierlist_likes_10",     label: "Create a Tierlist & Get 10 Likes",           icon: "❤️", xp: XP_AWARDS.tierlist_likes_10,     accent: "bg-pink-500", note: "Max 10/day" },
  { key: "online_draft_complete", label: "Play an Online Draft (complete 1 season)",   icon: "🌐", xp: XP_AWARDS.online_draft_complete, accent: "bg-purple-500", note: "Max 10/day" },
  { key: "draft_win",             label: "Win the Prem on Draft",                      icon: "🏆", xp: XP_AWARDS.draft_win,             accent: "bg-amber-500", note: "Max 10/day" },
  { key: "live_tierlist_complete",label: "Complete a Live Tier List (75% of items)",   icon: "🗳️", xp: XP_AWARDS.live_tierlist_complete, accent: "bg-emerald-500", note: "Max 10/day" },
  { key: "daily_tictactoe",       label: "Attempt Daily Tic-Tac-Toe",                  icon: "⚽", xp: XP_AWARDS.daily_tictactoe,       accent: "bg-green-500", note: "Max 10/day" },
  { key: "draft_complete",        label: "Play a Full Draft (all 5 seasons)",           icon: "🎮", xp: XP_AWARDS.draft_complete,        accent: "bg-blue-400", note: "Max 10/day" },
  { key: "tenable_perfect",       label: "Get 10/10 on TenAble",                       icon: "🧠", xp: XP_AWARDS.tenable_perfect,       accent: "bg-cyan-500", note: "Max 10/day" },
  { key: "blind_ranking_complete",label: "Play a Blind Ranking",                        icon: "🙈", xp: XP_AWARDS.blind_ranking_complete, accent: "bg-gray-400", note: "Max 10/day" },
];

export default function WaysToEarnXP({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  const trigger = compact ? (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800/60 bg-gray-900/40 hover:bg-gray-900 hover:border-gray-700/60 transition-all group text-xs font-bold text-white hover:text-gray-300 whitespace-nowrap"
    >
      <span className="text-amber-400/70">✨</span>
      Ways to Earn XP
    </button>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-gray-800/60 bg-gray-900/60 hover:border-gray-700/60 hover:bg-gray-900 transition-all duration-200 group"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-amber-400/70 text-sm">✨</span>
        <span className="text-[11px] font-bold tracking-wider text-white group-hover:text-gray-200 transition-colors uppercase">
          Ways to Earn XP
        </span>
      </div>
      <svg className="w-3.5 h-3.5 text-white group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
      </svg>
    </button>
  );

  return (
    <>
      {trigger}

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
                className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-white hover:text-white hover:bg-gray-700 transition-all"
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
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white font-medium leading-tight">{activity.label}</span>
                    {activity.note && <div className="text-[10px] text-white/50 leading-tight mt-0.5">{activity.note}</div>}
                  </div>
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
