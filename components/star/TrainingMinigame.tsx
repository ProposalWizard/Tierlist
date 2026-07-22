"use client";
import { useEffect, useRef, useState } from "react";
import type { Skills } from "@/lib/star/types";

interface Props {
  skill: keyof Skills;
  onComplete: (xpGained: number) => void;
}

const SKILL_TITLES: Record<keyof Skills, string> = {
  pace: "Pace Sprint",
  power: "Power Meter",
  technique: "Curl Around the Poles",
  vision: "Spot the Runner",
  freeKick: "Set Piece Target",
};

// Simple mini-game shared across skills:
// A small yellow goal appears in a random position on a concentric-ring pitch.
// User taps to release the ball. Ball drifts to where they tapped (with skill-based accuracy).
// 3 lives (attempts). Successful hits = xp.
export default function TrainingMinigame({ skill, onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lives, setLives] = useState(3);
  const [hits, setHits] = useState(0);
  const [goal, setGoal] = useState({ x: 50, y: 40 });
  const [ballAnim, setBallAnim] = useState<{ x: number; y: number } | null>(null);
  const [feedback, setFeedback] = useState<string>("");

  useEffect(() => {
    randomiseGoal();
  }, []);

  useEffect(() => {
    if (lives === 0) {
      const xp = hits * 12 + 3;
      const t = setTimeout(() => onComplete(xp), 1200);
      return () => clearTimeout(t);
    }
  }, [lives, hits, onComplete]);

  const randomiseGoal = () => {
    const x = 15 + Math.random() * 70;
    const y = 15 + Math.random() * 50;
    setGoal({ x, y });
  };

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (lives === 0 || ballAnim) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    let cx = 0, cy = 0;
    if ("touches" in e) {
      cx = e.changedTouches[0].clientX;
      cy = e.changedTouches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    const tx = ((cx - rect.left) / rect.width) * 100;
    const ty = ((cy - rect.top) / rect.height) * 100;
    setBallAnim({ x: tx, y: ty });
    setTimeout(() => {
      const dx = tx - goal.x;
      const dy = ty - goal.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10) {
        setHits((h) => h + 1);
        setFeedback("✓ HIT!");
      } else {
        setFeedback("✗ MISSED");
      }
      setLives((l) => l - 1);
      setTimeout(() => {
        setBallAnim(null);
        setFeedback("");
        randomiseGoal();
      }, 700);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-600">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={`text-lg ${i < lives ? "opacity-100" : "opacity-20"}`}>⚽</span>
            ))}
          </div>
          <div className="text-center">
            <div className="text-[10px] font-black text-emerald-300 uppercase">{SKILL_TITLES[skill]}</div>
            <div className="text-xs text-emerald-400 font-bold">Hits: {hits}</div>
          </div>
        </div>

        <div
          ref={containerRef}
          onClick={handleTap}
          onTouchEnd={handleTap}
          className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-700 shadow-2xl cursor-crosshair select-none"
          style={{
            background: "radial-gradient(circle at 50% 40%, #16a34a 0%, #15803d 40%, #14532d 100%)",
          }}
        >
          {/* Concentric rings */}
          {[15, 30, 45, 60].map((r) => (
            <div
              key={r}
              className="absolute left-1/2 top-[40%] rounded-full border border-emerald-500/40 -translate-x-1/2 -translate-y-1/2"
              style={{ width: `${r}%`, height: `${r * 1.3}%` }}
            />
          ))}

          {/* Yellow goal target */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${goal.x}%`, top: `${goal.y}%` }}
          >
            <svg width="32" height="18" viewBox="0 0 32 18">
              <path d="M4 2 L4 16 M28 2 L28 16 M4 2 L28 2" stroke="#fbbf24" strokeWidth="3" fill="none" />
            </svg>
          </div>

          {/* Ball animation */}
          {ballAnim && (
            <div
              className="absolute w-4 h-4 rounded-full bg-white border-2 border-black -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out pointer-events-none"
              style={{ left: `${ballAnim.x}%`, top: `${ballAnim.y}%` }}
            />
          )}

          {/* Feedback */}
          {feedback && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`text-3xl font-black ${feedback.startsWith("✓") ? "text-emerald-300" : "text-red-400"} drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}>
                {feedback}
              </div>
            </div>
          )}

          {/* Instruction */}
          {!ballAnim && lives > 0 && (
            <div className="absolute bottom-3 left-3 right-3 bg-gray-800/90 border border-gray-600 rounded-lg px-3 py-2">
              <div className="text-xs font-black text-white text-center">Tap the goal!</div>
            </div>
          )}
        </div>

        {lives === 0 && (
          <div className="mt-4 bg-emerald-500/20 border border-emerald-400 rounded-lg p-3 text-center">
            <div className="text-xs font-black text-emerald-300 uppercase">Session Complete</div>
            <div className="text-lg font-black text-white mt-1">{hits}/3 hits</div>
            <div className="text-xs text-emerald-300 mt-1">+{hits * 12 + 3} XP</div>
          </div>
        )}
      </div>
    </div>
  );
}
