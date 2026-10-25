"use client";
/**
 * THE MOMENT OF A HEADER OR A VOLLEY (lib/star/airPick.ts; Harry, 25 Oct 2026:
 * "you see the chance, angle - the animation happens and then you get the
 * timer to hit the ball in the right direction").
 *
 * See-through: the match stays on screen behind it, in slow motion, with your
 * man up at the ball. Two things on it, at the bottom where your thumb is:
 *  - the timer: a bar that fills left to right, with a green band at its end
 *    (wider with a better Aerial). Tap while it is in the green for a clean
 *    contact; earlier is early; run out and you meet it late.
 *  - the goal: tap where you want it to go. The keeper is shown where he stands.
 * One tap does both: where in the goal, and when.
 *
 * The clock is the match's (CanvasMatch steps it with the slow motion), read
 * through `clock`, so the bar and the picture never disagree. Pure drawing +
 * one tap; the strike itself is CanvasMatch's (airPickStrike → handleContact).
 */
import { useEffect, useRef, useState } from "react";
import type { AirKind, AirPick as Pick } from "@/lib/star/airPick";

interface Props {
  kind: AirKind;
  /** The timer's length, seconds. */
  windowS: number;
  /** Where the green band starts, as a share of the timer (it runs to the end). */
  bandFrom: number;
  /** 0..1 through the timer now (1 = ran out). The match's own clock. */
  clock: () => number;
  /** The keeper across the goal: -1 left post … 1 right post. */
  keeperGx: number;
  /** A feature's teaching pause: no tap counts until it lets go. */
  hold?: boolean;
  /** How a pick would come off, for the word shown after the tap. */
  readOf: (p: Pick) => { label: string; good: boolean };
  onPick: (p: Pick) => void;
}

/** How long the verdict shows before the ball goes. */
const VERDICT_MS = 220;
/** How long "TOO LATE!" shows before the late touch is struck. */
const LATE_MS = 300;

export default function AirPick({ kind, windowS, bandFrom, clock, keeperGx, hold = false, readOf, onPick }: Props) {
  const fillRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const goalRef = useRef<HTMLDivElement>(null);
  const locked = useRef(false);
  const [tap, setTap] = useState<{ gx: number; gy: number; label: string; good: boolean } | null>(null);
  const [late, setLate] = useState(false);
  const [inBand, setInBand] = useState(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    let raf = 0;
    let wasIn = false;
    const step = () => {
      raf = requestAnimationFrame(step);
      if (locked.current) return;
      const u = Math.max(0, Math.min(1, clock()));
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${u.toFixed(4)})`;
      if (markRef.current) markRef.current.style.left = `${(u * 100).toFixed(2)}%`;
      const isIn = u >= bandFrom;
      if (isIn !== wasIn) { wasIn = isIn; setInBand(isIn); }
      if (u >= 1) {
        locked.current = true;
        setLate(true);
        window.setTimeout(() => onPickRef.current({ tS: null, gx: 0, gy: 0.5 }), LATE_MS);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [clock, bandFrom]);

  const handleTap = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (locked.current || hold) return;
    const g = goalRef.current?.getBoundingClientRect();
    if (!g || !(g.width > 0)) return;
    // The goal plus a margin round it: a tap just outside the frame aims at its edge.
    const mx = g.width * 0.08, my = g.height * 0.2;
    const x = e.clientX, y = e.clientY;
    if (x < g.left - mx || x > g.right + mx || y < g.top - my || y > g.bottom + my) return;
    const gx = Math.max(-1, Math.min(1, ((x - g.left) / g.width) * 2 - 1));
    const gy = Math.max(0, Math.min(1, (g.bottom - y) / g.height));
    const tS = Math.max(0, Math.min(1, clock())) * windowS;
    locked.current = true;
    const p: Pick = { tS, gx, gy };
    const r = readOf(p);
    setTap({ gx, gy, label: r.label, good: r.good });
    window.setTimeout(() => onPickRef.current(p), VERDICT_MS);
  };

  const title = kind === "header" ? "HEAD IT!" : "VOLLEY IT!";
  const bandPct = Math.max(0, Math.min(100, (1 - bandFrom) * 100));
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end" data-air-pick={kind}>
      {/* A flat band across the bottom, fading up into the pitch (no floating card): the words read on any grass. */}
      <div className="pointer-events-auto w-full pt-8 pb-[5%]" style={{ touchAction: "none", background: "linear-gradient(to bottom, rgba(2,6,23,0) 0%, rgba(2,6,23,0.62) 28%, rgba(2,6,23,0.7) 100%)" }} onPointerDown={handleTap}>
      <div className="mx-auto flex w-[90%] max-w-[420px] flex-col items-center gap-2">
        {/* What to do, in one line. */}
        <div className="flex items-baseline gap-2" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.85)" }}>
          <span className="text-[26px] font-black italic leading-none tracking-wide" style={{ color: "#fff" }}>{title}</span>
          <span className="text-[13px] font-bold" style={{ color: "#fff" }}>tap the goal in the green</span>
        </div>

        {/* The timer: fills left to right; the green band is the clean contact. */}
        <div ref={barRef} data-air-timer className="relative h-4 w-full overflow-visible rounded-full border-2 border-white/70 bg-black/55 shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          <div className="absolute inset-y-0 right-0 rounded-r-full" style={{ width: `${bandPct}%`, background: inBand ? "#22c55e" : "rgba(34,197,94,0.75)", boxShadow: inBand ? "0 0 12px #4ade80" : undefined }} />
          <div ref={fillRef} className="absolute inset-y-0 left-0 w-full origin-left rounded-full" style={{ transform: "scaleX(0)", background: "linear-gradient(90deg, rgba(253,224,71,0.55), rgba(251,146,60,0.7))" }} />
          <div ref={markRef} className="absolute -top-1.5 -bottom-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.9)]" style={{ left: "0%" }} />
        </div>

        {/* The goal you aim at: as the keeper sees it, from in front. */}
        <div className="relative w-full pt-1">
          <div ref={goalRef} data-air-goal className="relative mx-auto w-[92%]" style={{ aspectRatio: "3 / 1" }}>
            {/* net */}
            <div className="absolute inset-0" style={{
              background: "rgba(15,23,42,0.55)",
              backgroundImage: "linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.22) 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }} />
            {/* posts and bar */}
            <div className="absolute -left-1.5 -right-1.5 -top-1.5 h-1.5 rounded-sm bg-white shadow" />
            <div className="absolute -left-1.5 -top-1.5 bottom-0 w-1.5 rounded-sm bg-white shadow" />
            <div className="absolute -right-1.5 -top-1.5 bottom-0 w-1.5 rounded-sm bg-white shadow" />
            {/* the keeper, where he stands */}
            <div className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${((Math.max(-1, Math.min(1, keeperGx)) + 1) / 2) * 100}%`, height: "78%" }}>
              <div className="aspect-square h-[22%] rounded-full bg-amber-300" />
              <div className="mt-[2%] h-[74%] w-[18px] rounded-t-md bg-amber-400/90" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.4)" }} />
            </div>
            {/* the corners, the places worth aiming */}
            {[[-0.85, 0.78], [0.85, 0.78], [-0.85, 0.2], [0.85, 0.2]].map(([gx, gy]) => (
              <div key={`${gx},${gy}`} className="absolute h-6 w-6 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-dashed border-yellow-300/90"
                style={{ left: `${((gx + 1) / 2) * 100}%`, bottom: `${gy * 100}%` }} />
            ))}
            {/* your tap */}
            {tap && (
              <>
                <img src="/star/ball.webp" alt="" draggable={false} className="absolute h-6 w-6 -translate-x-1/2 translate-y-1/2 select-none rounded-full"
                  style={{ left: `${((tap.gx + 1) / 2) * 100}%`, bottom: `${tap.gy * 100}%` }} />
                <div className="absolute inset-x-0 -top-10 flex justify-center">
                  <div data-contact-grade={tap.label} className={`kib-pop whitespace-nowrap rounded-lg px-3 py-0.5 text-lg font-black italic tracking-wider ${tap.good ? "bg-emerald-500" : "bg-red-600"}`} style={{ color: "#fff" }}>
                    {tap.label}
                  </div>
                </div>
              </>
            )}
            {late && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div data-contact-grade="TOO LATE" className="kib-pop whitespace-nowrap rounded-xl bg-black/80 px-4 py-1 text-2xl font-black italic tracking-wider" style={{ color: "#fca5a5" }}>
                  TOO LATE!
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
