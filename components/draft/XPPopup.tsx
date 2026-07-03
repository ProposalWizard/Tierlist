"use client";

import { useState, useEffect } from "react";

interface SeasonCardUnlock {
  name: string;
  image_url: string | null;
}

interface Props {
  index: number;
  title: string;
  xp: number;
  oldLevel: number;
  newLevel: number;
  newRewards: string[];
  newSeasonCards?: SeasonCardUnlock[];
  onDismiss: () => void;
}

export default function XPPopup({ index, title, xp, oldLevel, newLevel, newRewards, newSeasonCards = [], onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const leveledUp = newLevel > oldLevel;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 400);
    }, (leveledUp || newSeasonCards.length > 0) ? 6000 : 4500);
    return () => clearTimeout(timer);
  }, [onDismiss, leveledUp, newSeasonCards.length]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 400);
  };

  const topOffset = 64 + index * 210;

  return (
    <>
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(120%); opacity: 0; }
        }
        @keyframes xpFill {
          from { width: 0%; }
          to { width: 100%; }
        }
        .toast-enter {
          animation: slideIn 0.3s ease-out forwards;
        }
        .toast-exit {
          animation: slideOut 0.3s ease-in forwards;
        }
        .xp-bar-fill {
          animation: xpFill 1.2s ease-out 0.3s forwards;
        }
      `}</style>

      <div
        className={`fixed right-4 z-40 ${exiting ? "toast-exit" : visible ? "toast-enter" : "opacity-0 translate-x-full"}`}
        style={{ top: `${topOffset}px`, pointerEvents: "auto" }}
      >
        <div className="relative w-72 rounded-xl border border-emerald-500/30 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-emerald-900/20 overflow-hidden">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center rounded-full text-white hover:text-white hover:bg-gray-700 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="p-3">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider leading-none mb-0.5">
                  Objective Complete!
                </div>
                <div className="text-sm font-bold text-white leading-tight line-clamp-2">
                  {title}
                </div>
              </div>
            </div>

            {/* XP reward */}
            {xp > 0 && (
              <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2">
                <span className="text-sm">&#9889;</span>
                <span className="text-xs font-bold text-amber-400">+{xp} XP</span>
              </div>
            )}

            {/* Level up notification */}
            {leveledUp && (
              <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2">
                <span className="text-sm">&#127942;</span>
                <span className="text-xs font-bold text-amber-400">
                  Level {oldLevel} &rarr; Level {newLevel}!
                </span>
              </div>
            )}

            {/* New frame rewards */}
            {newRewards.length > 0 && (
              <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-2">
                <span className="text-sm">&#127775;</span>
                <span className="text-xs font-bold text-purple-400">
                  {newRewards.length} New Reward{newRewards.length > 1 ? "s" : ""} Unlocked!
                </span>
              </div>
            )}

            {/* Season card unlocks */}
            {newSeasonCards.map((sc, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-2">
                {sc.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sc.image_url}
                    alt={sc.name}
                    className="w-8 h-[42px] rounded-lg object-cover flex-shrink-0 ring-1 ring-amber-400/40"
                  />
                ) : (
                  <span className="text-sm flex-shrink-0">🃏</span>
                )}
                <div>
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Season Card Unlocked!</div>
                  <div className="text-xs font-bold text-white">{sc.name}</div>
                </div>
              </div>
            ))}

            {/* XP progress bar animation */}
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 rounded-full xp-bar-fill"
                style={{ width: 0 }}
              />
            </div>
          </div>

          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/60 via-emerald-400 to-emerald-500/60" />
        </div>
      </div>
    </>
  );
}
