"use client";
import { useEffect, useState } from "react";
import { figureSkin, onFigureSkinChange, setStoredFigureSkin, type FigureSkin } from "@/lib/star/figureSkin";

/**
 * The 3D / Classic flip for the players' look (lib/star/figureSkin.ts).
 * Harry, 28 Sep 2026: 3D "should be the base with a flip setting in the
 * homescreen and in match settings". Used on the home hero and in the match
 * bar; Settings → Player look is the same switch. Every renderer reads the
 * look each frame, so flipping it mid-match redraws the next frame in the
 * other look with no restart.
 */
export function useFigureSkin(): [FigureSkin, (s: FigureSkin) => void] {
  const [skin, setSkin] = useState<FigureSkin>("3d");
  useEffect(() => {
    setSkin(figureSkin());
    return onFigureSkinChange(() => setSkin(figureSkin()));
  }, []);
  return [skin, (s) => setStoredFigureSkin(s)];
}

/** A small "3D / 2D" pill. `compact` fits the match bar. */
export default function FigureSkinToggle({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const [skin, set] = useFigureSkin();
  const next: FigureSkin = skin === "3d" ? "classic" : "3d";
  return (
    <button
      type="button"
      onClick={() => set(next)}
      aria-label={skin === "3d" ? "Players in 3D. Switch to Classic" : "Players in Classic. Switch to 3D"}
      title="Player look"
      className={`flex items-center gap-0.5 rounded-full font-black uppercase tracking-wide transition active:scale-95 ${
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"
      } ${className}`}
      style={{ background: "rgba(0,0,0,.55)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}
    >
      <span className={skin === "3d" ? "text-amber-300" : "text-white/45"}>3D</span>
      <span className="text-white/30">/</span>
      <span className={skin === "classic" ? "text-amber-300" : "text-white/45"}>2D</span>
    </button>
  );
}
