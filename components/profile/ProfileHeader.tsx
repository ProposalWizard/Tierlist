"use client";

import { RARITY_COLORS, getTitleForLevel, MANAGER_TITLES, FRAME_STYLES } from "@/lib/xp";
import type { UserProgression } from "@/lib/xp";

interface Props {
  username: string | null;
  email: string;
  progression: UserProgression | null;
  loginStreak: number;
  tierlistsCreated: number;
  onOpenSettings: () => void;
}

/* ------------------------------------------------------------------ */
/*  Rarity text-shadow maps (CSS values for the glow effect)          */
/* ------------------------------------------------------------------ */
const RARITY_GLOW: Record<string, string> = {
  bronze: "0 0 8px rgba(234,88,12,0.5), 0 0 20px rgba(234,88,12,0.2)",
  silver: "0 0 8px rgba(209,213,219,0.5), 0 0 20px rgba(209,213,219,0.25)",
  gold: "0 0 10px rgba(251,191,36,0.6), 0 0 24px rgba(251,191,36,0.3)",
  diamond: "0 0 10px rgba(103,232,249,0.6), 0 0 28px rgba(103,232,249,0.3)",
};

export default function ProfileHeader({
  username,
  email,
  progression,
  loginStreak,
  onOpenSettings,
}: Props) {
  const level = progression?.level ?? 1;
  const currentXp = progression?.currentLevelXp ?? 0;
  const xpToNext = progression?.xpToNext ?? 100;
  const totalXp = progression?.xp ?? 0;
  const progress = xpToNext > 0 ? (currentXp / xpToNext) * 100 : 100;

  const titleInfo = getTitleForLevel(level);
  const equippedTitle = progression
    ? MANAGER_TITLES.find((t) => t.id === progression.equippedTitle) ?? titleInfo
    : titleInfo;
  const rarity =
    RARITY_COLORS[equippedTitle.rarity as keyof typeof RARITY_COLORS] ??
    RARITY_COLORS.bronze;
  const equippedFrame = progression?.equippedFrame ?? "frame_default";
  const frameStyle = FRAME_STYLES[equippedFrame];

  const unlockedCount =
    progression?.rewards?.filter((r) => r.unlocked).length ?? 0;

  const initial = (username || email[0] || "?")[0].toUpperCase();

  const quickStats = [
    {
      value: level,
      label: "Level",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      gradient: "from-amber-500/20 to-amber-600/5",
      iconColor: "text-amber-400",
      borderColor: "border-amber-500/20",
    },
    {
      value: totalXp.toLocaleString(),
      label: "Total XP",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      gradient: "from-cyan-500/20 to-cyan-600/5",
      iconColor: "text-cyan-400",
      borderColor: "border-cyan-500/20",
    },
    {
      value: unlockedCount,
      label: "Trophies",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14a1 1 0 011 1v2a7 7 0 01-3 5.745V14a3 3 0 01-3 3h-4a3 3 0 01-3-3v-2.255A7 7 0 014 6V4a1 1 0 011-1zM9 17v2a1 1 0 001 1h4a1 1 0 001-1v-2" />
        </svg>
      ),
      gradient: "from-purple-500/20 to-purple-600/5",
      iconColor: "text-purple-400",
      borderColor: "border-purple-500/20",
    },
    {
      value: loginStreak,
      label: "Streak",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      ),
      gradient: "from-orange-500/20 to-orange-600/5",
      iconColor: "text-orange-400",
      borderColor: "border-orange-500/20",
    },
  ];

  return (
    <>
      {/* Inline styles for custom animations */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
        @keyframes avatarPulse {
          0%,
          100% {
            box-shadow: 0 0 12px rgba(251, 191, 36, 0.4),
              0 0 24px rgba(251, 191, 36, 0.15);
          }
          50% {
            box-shadow: 0 0 20px rgba(251, 191, 36, 0.6),
              0 0 40px rgba(251, 191, 36, 0.25);
          }
        }
        @keyframes badgeBounce {
          0%,
          100% {
            transform: translate(-50%, 0) scale(1);
          }
          50% {
            transform: translate(-50%, -2px) scale(1.05);
          }
        }
        .avatar-ring {
          animation: avatarPulse 3s ease-in-out infinite;
        }
        .xp-shimmer::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.25),
            transparent
          );
          animation: shimmer 2.5s ease-in-out infinite;
        }
        .level-badge {
          animation: badgeBounce 3s ease-in-out infinite;
        }
        .card-texture {
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 4px,
            rgba(255, 255, 255, 0.012) 4px,
            rgba(255, 255, 255, 0.012) 5px
          );
        }
      `}</style>

      <div className="relative rounded-2xl border border-gray-700/50 overflow-hidden">
        {/* ---- Background layers ---- */}
        {/* Base dark gradient with radial gold glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 35%, rgba(180,130,30,0.12) 0%, rgba(15,15,25,0) 70%), linear-gradient(180deg, #0d0f17 0%, #111827 40%, #0f1219 100%)",
          }}
        />
        {/* Diagonal stripe texture overlay */}
        <div className="absolute inset-0 card-texture pointer-events-none" />
        {/* Subtle top edge highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

        {/* ---- Card content ---- */}
        <div className="relative z-10 p-5 pb-4">
          {/* Top row: label + gear */}
          <div className="flex items-center justify-between mb-5">
            <span
              className="text-[9px] font-bold tracking-[0.25em] uppercase"
              style={{ color: "rgba(251,191,36,0.55)" }}
            >
              Manager Profile
            </span>
            <button
              onClick={onOpenSettings}
              className="text-white hover:text-amber-400 transition-colors p-2 rounded-lg hover:bg-white/5"
              title="Settings"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>

          {/* ---- Avatar section ---- */}
          <div className="flex flex-col items-center text-center mb-4">
            <div className="relative mb-4">
              {/* Outer gold ring with pulse */}
              <div
                className="avatar-ring w-28 h-28 rounded-full flex items-center justify-center"
                style={{
                  padding: "3.5px",
                  background:
                    "conic-gradient(from 0deg, #f59e0b, #fbbf24, #f59e0b, #d97706, #f59e0b)",
                }}
              >
                {/* Inner avatar circle */}
                <div
                  className={`w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-4xl font-black text-white ${frameStyle?.shadow ?? ""}`}
                >
                  {frameStyle?.image ? (
                    <img
                      src={frameStyle.image}
                      alt="Card"
                      className="w-full h-full"
                      style={{
                        objectFit: "cover",
                        objectPosition: "center 28%",
                        transform: "scale(1.6)",
                        transformOrigin: "center 28%",
                      }}
                    />
                  ) : (
                    initial
                  )}
                </div>
              </div>

              {/* Level badge */}
              <div
                className="level-badge absolute -bottom-1.5 left-1/2 flex items-center justify-center"
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(145deg, #fbbf24, #d97706)",
                  border: "2.5px solid #0d0f17",
                  boxShadow: "0 0 8px rgba(251,191,36,0.4)",
                }}
              >
                <span className="text-[11px] font-black text-gray-900 leading-none">
                  {level}
                </span>
              </div>
            </div>

            {/* Username */}
            <h2 className="text-2xl font-black text-white tracking-tight leading-none">
              {username || "Anonymous"}
            </h2>

            {/* Manager title with rarity glow */}
            <div
              className={`mt-1.5 text-xs font-bold italic ${rarity.text}`}
              style={{
                textShadow:
                  RARITY_GLOW[equippedTitle.rarity] ?? RARITY_GLOW.bronze,
                fontFamily: "Georgia, serif",
              }}
            >
              {equippedTitle.name}
            </div>

            {/* ---- XP progress bar ---- */}
            <div className="w-full max-w-[240px] mt-4">
              <div className="relative h-3 bg-gray-800/80 rounded-full overflow-hidden border border-gray-700/40">
                {/* Filled portion */}
                <div
                  className="xp-shimmer relative h-full rounded-full transition-all duration-1000 ease-out overflow-hidden"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    background:
                      "linear-gradient(90deg, #059669, #10b981, #34d399)",
                  }}
                />
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <span className="text-[10px] font-semibold text-emerald-400/80">
                  {currentXp.toLocaleString()}
                </span>
                <span className="text-[10px] text-white">/</span>
                <span className="text-[10px] font-semibold text-white">
                  {xpToNext.toLocaleString()} XP
                </span>
              </div>
            </div>
          </div>

          {/* ---- Stat mini-cards ---- */}
          <div className="grid grid-cols-4 gap-2">
            {quickStats.map((s) => (
              <div
                key={s.label}
                className={`relative text-center py-3 px-1 rounded-xl border ${s.borderColor} overflow-hidden`}
              >
                {/* Gradient background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-b ${s.gradient} pointer-events-none`}
                />
                <div className="relative z-10">
                  <div
                    className={`flex justify-center mb-1.5 ${s.iconColor}`}
                  >
                    {s.icon}
                  </div>
                  <div className="text-sm font-black text-white leading-none">
                    {s.value}
                  </div>
                  <div className="text-[7px] text-white mt-1.5 font-bold uppercase tracking-widest">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent edge */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      </div>
    </>
  );
}
