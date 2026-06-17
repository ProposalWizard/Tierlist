"use client";

import { RARITY_COLORS, getTitleForLevel, MANAGER_TITLES, FRAME_STYLES } from "@/lib/xp";
import type { UserProgression } from "@/lib/xp";

interface Props {
  username: string | null;
  email: string;
  progression: UserProgression | null;
  onOpenSettings: () => void;
}

export default function ProfileHeader({ username, email, progression, onOpenSettings }: Props) {
  const level = progression?.level ?? 1;
  const titleInfo = getTitleForLevel(level);
  const equippedTitle = progression
    ? MANAGER_TITLES.find(t => t.id === progression.equippedTitle) ?? titleInfo
    : titleInfo;
  const rarity = RARITY_COLORS[equippedTitle.rarity as keyof typeof RARITY_COLORS] ?? RARITY_COLORS.bronze;
  const equippedFrame = progression?.equippedFrame ?? "frame_default";
  const frameStyle = FRAME_STYLES[equippedFrame];

  return (
    <div className="relative rounded-xl border border-gray-800/50 bg-gray-900 p-5 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative flex items-center gap-4">
        {/* Avatar with level badge and frame */}
        <div className="relative flex-shrink-0">
          <div className={`w-[72px] h-[72px] rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-2xl font-black text-gray-300 ${frameStyle?.border ?? "border-2 border-gray-600"} ${frameStyle?.shadow ?? ""}`}>
            {(username || email[0] || "?")[0].toUpperCase()}
          </div>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-600 to-amber-400 text-black text-[10px] font-black rounded-full px-2 py-0.5 flex items-center justify-center border-2 border-gray-900 shadow-lg shadow-amber-900/30">
            LV.{level}
          </div>
        </div>

        {/* Name + title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white truncate">
              {username || "Anonymous"}
            </h2>
            <button
              onClick={onOpenSettings}
              className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-gray-800"
              title="Edit profile"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <div className={`inline-flex items-center gap-1.5 mt-1`}>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${rarity.bg} ${rarity.text} ${rarity.border} border`}>
              {equippedTitle.name}
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-1.5">{email}</p>
        </div>

        {/* Quick stats on desktop */}
        <div className="hidden sm:flex items-center gap-4">
          <div className="text-center">
            <div className="text-lg font-black text-amber-400">{progression?.xp?.toLocaleString() ?? 0}</div>
            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Total XP</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black text-emerald-400">{progression?.stats?.draft_wins ?? 0}</div>
            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Wins</div>
          </div>
        </div>
      </div>
    </div>
  );
}
