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
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (revealedCount < events.length + (newLevel > oldLevel ? 1 : 0) + newRewards.length) {
      const t = setTimeout(() => setRevealedCount(c => c + 1), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [visible, revealedCount, events.length, oldLevel, newLevel, newRewards.length, onDismiss]);

  const totalXp = events.reduce((s, e) => s + e.xp, 0);
  const leveledUp = newLevel > oldLevel;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={onDismiss}
    >
      <div
        className={`w-full max-w-xs rounded-2xl border border-amber-500/30 bg-gray-900 p-5 shadow-2xl shadow-amber-900/30 transition-all duration-500 ${visible ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-3">
          <div className="text-[10px] font-bold tracking-widest uppercase text-amber-400 mb-1">
            XP Earned
          </div>
          <div className="text-3xl font-black text-amber-400">
            +{totalXp} XP
          </div>
        </div>

        <div className="space-y-1.5 mb-3">
          {events.map((event, i) => (
            <div
              key={i}
              className={`flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-800/50 transition-all duration-300 ${
                i < revealedCount ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
              }`}
            >
              <span className="text-xs text-gray-300 font-medium">{event.label}</span>
              <span className="text-xs font-bold text-amber-400">+{event.xp}</span>
            </div>
          ))}

          {leveledUp && (
            <div
              className={`flex items-center justify-center py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 transition-all duration-500 ${
                revealedCount > events.length - 1 ? "opacity-100 scale-100" : "opacity-0 scale-90"
              }`}
            >
              <span className="text-sm font-black text-amber-400">
                Level {oldLevel} &rarr; Level {newLevel}!
              </span>
            </div>
          )}

          {newRewards.map((rewardId, i) => (
            <div
              key={rewardId}
              className={`flex items-center justify-center py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 transition-all duration-500 ${
                revealedCount > events.length + (leveledUp ? 1 : 0) + i - 1
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-90"
              }`}
            >
              <span className="text-xs font-bold text-emerald-400">
                New Reward Unlocked!
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-2 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
        >
          Tap to continue
        </button>
      </div>
    </div>
  );
}
