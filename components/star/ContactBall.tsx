"use client";
import { useRef, useState } from "react";

interface Props {
  power: number;
  onContact: (contact: { cx: number; cy: number }) => void;
  /** The three "how to read the ball" badges and the explanatory line under
   *  them — the tutorial copy, only actually needed the first time anyone
   *  sees this screen. TrialPenalty (the profile-setup trial) passes true;
   *  a real match leaves it off, having already taught this once. */
  tutorial?: boolean;
}

// Phase 2 — pick where on the ball to strike.
export default function ContactBall({ power, onContact, tutorial }: Props) {
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
  const powerColor = powerPct < 40 ? "#22c55e" : powerPct < 75 ? "#eab308" : "#ef4444";

  const badge = (icon: string, label: string) => (
    <div className="flex items-center gap-1.5 bg-black/45 border border-white/10 rounded-lg pl-1 pr-2.5 py-1">
      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-sky-600 text-white text-[10px] shrink-0">
        {icon}
      </span>
      <span className="text-white text-[10px] font-bold whitespace-nowrap">{label}</span>
    </div>
  );

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(to bottom, #4a71b8 0%, #a8c4e8 100%)",
        touchAction: "none",
      }}
    >
      {/* Grass strip */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: "24%", background: "linear-gradient(to bottom, #16a34a, #15803d)" }}
      />

      {/* No way back. You have chosen your angle and your power; all that is
          left is where on the ball you hit it. A footballer does not get to
          reconsider his run-up halfway through it. */}

      {/* Header */}
      <div className="relative z-40 pt-3 px-3 text-center pointer-events-none">
        <div
          className="text-white/90 font-black text-[13px] tracking-wide uppercase leading-none"
          style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
        >
          Where do you
        </div>
        <div
          className="font-black uppercase leading-[0.95] mt-0.5"
          style={{
            fontSize: "clamp(28px, 9vw, 40px)",
            fontStyle: "italic",
            letterSpacing: "-0.01em",
            backgroundImage: "linear-gradient(180deg, #ffffff 0%, #cfd8e6 55%, #8f9bb0 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 3px 6px rgba(0,0,0,0.6)",
          }}
        >
          Strike it?
        </div>

        {/* Three ways to read the ball, as chips rather than a run-on line —
            the run-on line asked you to parse three instructions in one
            breath before you had even picked a spot. Tutorial copy — the
            trial only. */}
        {tutorial && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
            {badge("↕", "Bottom = high & far")}
            {badge("↔", "Sides = curl")}
            {badge("↓", "Top = low drive")}
          </div>
        )}
      </div>

      {/* A second tip, in the real gap this layout already leaves between
          the badges above and the ball below — not overlapping the ball's
          own tap target, which starts lower down inside the next block.
          Tutorial copy — the trial only. */}
      {tutorial && (
        <div className="relative z-40 px-6 pt-3 text-center pointer-events-none">
          <p className="text-[11px] font-bold text-white/75" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.7)" }}>
            Now decide the angle — tap the part of the ball you want to send it away from, aiming for a corner the keeper isn&rsquo;t set for.
          </p>
        </div>
      )}

      {/* Power — a vertical bar on the side rather than competing with the
          header's own copy for room, and out of the way of the ball's own
          tap target. */}
      <div className="absolute right-2.5 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 pointer-events-none">
        <span className="text-white text-[9px] font-black uppercase tracking-[0.15em]" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
          Power
        </span>
        <div className="relative h-28 w-3 rounded-full bg-black/50 border border-white/10 overflow-hidden">
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-[height] duration-100"
            style={{
              height: `${powerPct}%`,
              background: "linear-gradient(to top, #22c55e, #eab308, #ef4444)",
              boxShadow: `0 0 8px ${powerColor}99`,
            }}
          />
        </div>
        <span className="text-white font-black text-xs tabular-nums" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
          {powerPct}%
        </span>
      </div>

      {/* The ball — sitting ON the grass. It used to float in the middle of the
          sky with the turf a long way below it, which reads as a ball in the
          air, and this screen is you standing over a ball at your feet. */}
      <div className="relative z-30 flex-1 flex items-end justify-center pb-[10%]">
        <div
          ref={ballRef}
          onPointerDown={handleTap}
          className="relative cursor-pointer"
          style={{ width: "56%", aspectRatio: "1 / 1", touchAction: "none" }}
        >
          {/* A grounding shadow — without it the ball reads as pasted onto the
              grass rather than resting on it. */}
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              bottom: "-9%",
              width: "78%",
              height: "16%",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 72%)",
            }}
          />
          {/* The real thing — a photograph, not a diagram. CSS/SVG cannot fake
              leather grain or an actual reflection, so this is the club's own
              ball, pre-cropped to a circle with a transparent surround (see
              public/star/ball.png) and dropped straight in. */}
          <img
            src="/star/ball.png"
            alt=""
            draggable={false}
            className="w-full h-full object-cover rounded-full select-none pointer-events-none drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]"
          />

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
