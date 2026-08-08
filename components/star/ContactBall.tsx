"use client";
import { useRef, useState } from "react";

interface Props {
  power: number;
  onContact: (contact: { cx: number; cy: number }) => void;
}

// Phase 2 — pick where on the ball to strike.
export default function ContactBall({ power, onContact }: Props) {
  const ballRef = useRef<HTMLDivElement>(null);
  const [spark, setSpark] = useState<{ left: number; top: number } | null>(null);
  const locked = useRef(false);

  const handleTap = (e: React.PointerEvent) => {
    if (locked.current || !ballRef.current) return;
    const rect = ballRef.current.getBoundingClientRect();
    const r = rect.width / 2;
    const dx = e.clientX - (rect.left + r);
    const dy = e.clientY - (rect.top + r);
    const cx = dx / r; // +right
    const cy = dy / r; // +down (bottom of ball)
    if (cx * cx + cy * cy > 1.1) return; // outside the ball — ignore

    locked.current = true;
    setSpark({ left: e.clientX - rect.left, top: e.clientY - rect.top });
    setTimeout(() => onContact({ cx, cy }), 200);
  };

  const powerPct = Math.round(power * 100);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col"
      style={{
        background: "linear-gradient(to bottom, #4a71b8 0%, #a8c4e8 100%)",
        touchAction: "none",
      }}
    >
      {/* Grass strip */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: "22%", background: "linear-gradient(to bottom, #16a34a, #15803d)" }}
      />

      {/* No way back. You have chosen your angle and your power; all that is
          left is where on the ball you hit it. A footballer does not get to
          reconsider his run-up halfway through it. */}

      {/* Header */}
      <div className="relative z-40 pt-2 px-3 text-center pointer-events-none">
        <div className="text-white font-black text-lg drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          Where do you strike it?
        </div>
        <div className="text-white/90 text-[10px] mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          ⬇ Bottom = high &amp; far • ⬅➡ Sides = curl • ⬆ Top = low drive
        </div>
        {/* Power meter */}
        <div className="mt-1.5 mx-auto w-32 max-w-full">
          <div className="flex items-center justify-between text-[9px] text-white/90 font-bold mb-0.5">
            <span>Power</span>
            <span>{powerPct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${powerPct}%`,
                background: "linear-gradient(to right, #22c55e, #eab308, #ef4444)",
              }}
            />
          </div>
        </div>
      </div>

      {/* The ball — sitting ON the grass. It used to float in the middle of the
          sky with the turf a long way below it, which reads as a ball in the
          air, and this screen is you standing over a ball at your feet. */}
      <div className="relative z-30 flex-1 flex items-end justify-center pb-[12%]">
        <div
          ref={ballRef}
          onPointerDown={handleTap}
          className="relative cursor-pointer"
          style={{ width: "58%", aspectRatio: "1 / 1", touchAction: "none" }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.4)]">
            <defs>
              <radialGradient id="ballShade" cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="70%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="url(#ballShade)" stroke="#94a3b8" strokeWidth="1" />
            {/* Centre pentagon */}
            <polygon points="50,34 62,43 57,57 43,57 38,43" fill="#111827" />
            {/* Surrounding partial pentagons */}
            <polygon points="50,10 62,18 57,30 43,30 38,18" fill="#111827" opacity="0.9" />
            <polygon points="14,40 26,32 34,42 28,54 16,52" fill="#111827" opacity="0.9" />
            <polygon points="86,40 74,32 66,42 72,54 84,52" fill="#111827" opacity="0.9" />
            <polygon points="30,86 24,72 36,66 46,74 42,88" fill="#111827" opacity="0.9" />
            <polygon points="70,86 76,72 64,66 54,74 58,88" fill="#111827" opacity="0.9" />
          </svg>

          {spark && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl pointer-events-none select-none"
              style={{ left: spark.left, top: spark.top }}
            >
              ⚡
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
