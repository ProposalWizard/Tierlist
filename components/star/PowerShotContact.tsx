"use client";

import { useEffect, useRef, useState } from "react";
import { POWER_SHOT_PERFECT_S, POWER_SHOT_SLOW_S, powerShotQuality } from "@/lib/star/canvasEngineTest";

/**
 * SANDBOX PROTOTYPE (Leo, 5 Oct 2026) — the power shot's strike screen, used
 * only by CanvasMatchTest (/star-match-dev).
 *
 * Leo: "a little green circle popping up on a random part of the ball that you
 * have to click quickly and the longer you take the worse the accuracy".
 *
 * A green circle appears on a random part of the ball after a short random
 * wait (so you cannot tap early). Tap it fast: up to 1.5x power and dead on
 * your aim. Tap it slowly, or miss it: no extra power, and it drifts off line.
 * Tapping before it appears is a miss. Plain DOM — no canvas, no match loop.
 */

const GIVE_UP_S = 1.2;

interface Props {
  power: number;
  /** quality 0..1, and the reaction time in seconds (NaN for a miss). */
  onStrike: (quality: number, reactionS: number) => void;
}

export default function PowerShotContact({ power, onStrike }: Props) {
  const ballRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const shownAt = useRef<number | null>(null);
  const [spot] = useState(() => {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.55;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  const [shown, setShown] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const onStrikeRef = useRef(onStrike);
  onStrikeRef.current = onStrike;

  const finish = (q: number, rt: number) => {
    if (done.current) return;
    done.current = true;
    setVerdict(q >= 0.95 ? "PERFECT!" : q >= 0.6 ? "GOOD" : q > 0 ? "LATE" : "MISSED");
    window.setTimeout(() => onStrikeRef.current(q, rt), 350);
  };

  useEffect(() => {
    const appear = window.setTimeout(() => {
      shownAt.current = performance.now();
      setShown(true);
    }, 250 + Math.random() * 500);
    const giveUp = window.setTimeout(() => finish(0, NaN), 750 + GIVE_UP_S * 1000);
    return () => { window.clearTimeout(appear); window.clearTimeout(giveUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = (e: React.PointerEvent) => {
    if (done.current || !ballRef.current) return;
    const rect = ballRef.current.getBoundingClientRect();
    const r = rect.width / 2;
    const cx = (e.clientX - (rect.left + r)) / r;
    const cy = (e.clientY - (rect.top + r)) / r;
    if (cx * cx + cy * cy > 1.15) return; // off the ball entirely — ignore
    if (shownAt.current === null) { finish(0, NaN); return; } // too early
    const rt = (performance.now() - shownAt.current) / 1000;
    const hit = Math.hypot(cx - spot.x, cy - spot.y) < 0.3;
    finish(powerShotQuality(rt, hit), hit ? rt : NaN);
  };

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(to bottom, #1f2937 0%, #0f172a 100%)", touchAction: "none" }}
      onPointerDown={handleTap}
    >
      <style>{`
        @keyframes kibPsRing { from { transform: scale(2.2); opacity: 0.9; } to { transform: scale(1); opacity: 1; } }
      `}</style>
      <div className="absolute top-3 inset-x-0 text-center pointer-events-none">
        <div className="text-amber-300 font-black text-[13px] uppercase tracking-widest">Power shot</div>
        <div className="text-white font-black italic text-3xl uppercase leading-none mt-0.5">Smash it!</div>
        <div className="text-white text-[11px] font-bold mt-1">Tap the green circle the moment it shows</div>
      </div>

      <div ref={ballRef} className="relative rounded-full" style={{ width: "62%", aspectRatio: "1 / 1",
        background: "radial-gradient(circle at 35% 30%, #ffffff 0%, #e5e7eb 55%, #9ca3af 100%)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
        {shown && (
          <div
            className="absolute rounded-full"
            style={{
              width: "30%", height: "30%",
              left: `${50 + spot.x * 50 - 15}%`, top: `${50 + spot.y * 50 - 15}%`,
              background: "rgba(34,197,94,0.85)",
              boxShadow: "0 0 0 3px #bbf7d0, 0 0 18px #22c55e",
            }}
          >
            {/* The shrinking ring is the timing window: inside it, the strike is perfect. */}
            <div
              className="absolute inset-0 rounded-full border-4 border-emerald-200"
              style={{ animation: `kibPsRing ${POWER_SHOT_PERFECT_S}s linear forwards` }}
            />
          </div>
        )}
      </div>

      <div className="absolute bottom-4 inset-x-0 text-center pointer-events-none">
        <div className="text-white text-[11px] font-black uppercase tracking-widest">
          Aim power {Math.round(power * 100)}% · perfect within {Math.round(POWER_SHOT_PERFECT_S * 1000)} ms · no bonus after {Math.round(POWER_SHOT_SLOW_S * 1000)} ms
        </div>
      </div>

      {verdict && (
        <div className="absolute inset-x-0 top-[38%] flex justify-center pointer-events-none">
          <div className={`kib-pop rounded-xl bg-black/70 px-4 py-2 text-3xl font-black italic tracking-wider ${
            verdict === "PERFECT!" ? "text-emerald-300" : verdict === "GOOD" ? "text-lime-200" : "text-red-300"}`}>
            {verdict}
          </div>
        </div>
      )}
    </div>
  );
}
