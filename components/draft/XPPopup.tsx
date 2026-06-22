"use client";

import { useState, useEffect } from "react";

interface XPEvent {
  label: string;
  xp: number;
}

interface Props {
  events: XPEvent[];
  oldLevel: number;
  newLevel: number;
  newRewards: string[];
  onDismiss: () => void;
}

export default function XPPopup({ events, oldLevel, newLevel, newRewards, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const totalXp = events.reduce((s, e) => s + e.xp, 0);
  const leveledUp = newLevel > oldLevel;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 400);
    }, leveledUp ? 3000 : 1500);
    return () => clearTimeout(timer);
  }, [onDismiss, leveledUp]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 400);
  };

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
        className={`fixed top-4 right-4 z-50 ${exiting ? "toast-exit" : visible ? "toast-enter" : "opacity-0 translate-x-full"}`}
        style={{ pointerEvents: "auto" }}
      >
        <div className="relative w-72 rounded-xl border border-amber-500/30 bg-gray-900/95 backdrop-blur-sm shadow-2xl shadow-amber-900/20 overflow-hidden">
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
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/20">
                <span className="text-base">&#9889;</span>
              </div>
              <div>
                <div className="text-lg font-black text-amber-400 leading-none">
                  +{totalXp} XP
                </div>
                <div className="text-[10px] text-white font-medium mt-0.5">
                  {events.map(e => e.label).join(" + ")}
                </div>
              </div>
            </div>

            {/* Level up notification */}
            {leveledUp && (
              <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2">
                <span className="text-sm">&#127942;</span>
                <span className="text-xs font-bold text-amber-400">
                  Level {oldLevel} &rarr; Level {newLevel}!
                </span>
              </div>
            )}

            {/* New rewards */}
            {newRewards.length > 0 && (
              <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-2">
                <span className="text-sm">&#127775;</span>
                <span className="text-xs font-bold text-emerald-400">
                  {newRewards.length} New Reward{newRewards.length > 1 ? "s" : ""} Unlocked!
                </span>
              </div>
            )}

            {/* XP progress bar animation */}
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300 rounded-full xp-bar-fill"
                style={{ width: 0 }}
              />
            </div>
          </div>

          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/60 via-amber-400 to-amber-500/60" />
        </div>
      </div>
    </>
  );
}
