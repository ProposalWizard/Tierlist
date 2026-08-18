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
            breath before you had even picked a spot. */}
        <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
          {badge("↕", "Bottom = high & far")}
          {badge("↔", "Sides = curl")}
          {badge("↓", "Top = low drive")}
        </div>

        {/* Power meter */}
        <div className="mt-3 mx-auto w-40 max-w-full">
          <div className="text-white text-[11px] font-black uppercase tracking-[0.15em] mb-1">
            Power
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 rounded-full bg-black/50 border border-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-100"
                style={{
                  width: `${powerPct}%`,
                  background: "linear-gradient(to right, #22c55e, #eab308, #ef4444)",
                  boxShadow: `0 0 8px ${powerColor}99`,
                }}
              />
            </div>
            <span className="text-white font-black text-sm tabular-nums w-11 text-right">
              {powerPct}%
            </span>
          </div>
        </div>
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
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]">
            <defs>
              {/* Lit from the upper-left, the way the reference is, and dark
                  enough at the rim to actually read as a sphere rather than a
                  flat white disc with pentagons drawn on it. */}
              <radialGradient id="ballShade" cx="36%" cy="30%" r="80%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="55%" stopColor="#f4f6f9" />
                <stop offset="82%" stopColor="#d7dee8" />
                <stop offset="100%" stopColor="#9aa7ba" />
              </radialGradient>
              <radialGradient id="ballSpecular" cx="32%" cy="24%" r="20%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="url(#ballShade)" stroke="#7b8798" strokeWidth="0.6" />
            {/* Centre pentagon */}
            <polygon points="50,34 62,43 57,57 43,57 38,43" fill="#111827" />
            {/* Surrounding partial pentagons */}
            <polygon points="50,10 62,18 57,30 43,30 38,18" fill="#111827" opacity="0.92" />
            <polygon points="14,40 26,32 34,42 28,54 16,52" fill="#111827" opacity="0.9" />
            <polygon points="86,40 74,32 66,42 72,54 84,52" fill="#111827" opacity="0.9" />
            <polygon points="30,86 24,72 36,66 46,74 42,88" fill="#111827" opacity="0.88" />
            <polygon points="70,86 76,72 64,66 54,74 58,88" fill="#111827" opacity="0.88" />
            {/* Seam stitching — faint curved lines between the panels, the
                detail that separates a diagram of a ball from a photo of one. */}
            <g stroke="#94a1b5" strokeWidth="0.35" fill="none" opacity="0.5">
              <path d="M 50,10 L 50,34" />
              <path d="M 14,40 L 38,43" />
              <path d="M 86,40 L 62,43" />
              <path d="M 30,86 L 43,57" />
              <path d="M 70,86 L 57,57" />
            </g>
            {/* The specular highlight that sells it as glossy leather under
                lights, not matte plastic. */}
            <circle cx="34" cy="26" r="14" fill="url(#ballSpecular)" />
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
