"use client";
import { useEffect, useRef, useState } from "react";

/**
 * How the ball is moving while you pick where to hit it (Mikey, 27 Sep 2026).
 * - still: a ball at your feet or a dead ball (penalty, free kick, corner).
 * - float: a cross hanging in the air for a header, drifting across in a curve.
 * - bounce: bouncing across at half height, for a volley.
 * - bobble: skipping over the grass in small hops.
 * Only WHERE you hit it matters, not when: the tap is read against the ball
 * wherever it is at that moment. Higher technique makes it move slower.
 */
export type BallMotion = "still" | "float" | "bounce" | "bobble";

/** Where the ball is, as fractions of the play area, `t` seconds in. */
export function ballMotionAt(motion: BallMotion, t: number, period: number): { x: number; y: number } {
  if (motion === "still") return { x: 0, y: 0 };
  // Side to side, easing at each end, then back — a slow sweep.
  const phase = (t / period) % 2;
  const sweep = phase < 1 ? phase : 2 - phase;
  // ±12% of the width, so the ball never slides under the power bar on the right.
  const x = -0.12 + 0.24 * (0.5 - 0.5 * Math.cos(Math.PI * sweep));
  if (motion === "float") {
    // An arc high in the air: highest in the middle of the sweep.
    return { x, y: -0.42 - 0.08 * Math.sin(Math.PI * sweep) };
  }
  if (motion === "bounce") {
    // Two and a half bounces per sweep, up to about half height.
    const b = Math.abs(Math.sin(Math.PI * 2.5 * sweep));
    return { x, y: -0.26 * b };
  }
  // bobble: small, quick hops on the grass.
  const b = Math.abs(Math.sin(Math.PI * 6 * sweep));
  return { x: x * 0.6, y: -0.05 * b };
}

interface Props {
  power: number;
  onContact: (contact: { cx: number; cy: number }) => void;
  /** The three "how to read the ball" badges and the explanatory line under
   *  them — the tutorial copy, only actually needed the first time anyone
   *  sees this screen. TrialPenalty (the profile-setup trial) passes true;
   *  a real match leaves it off, having already taught this once. */
  tutorial?: boolean;
  /**
   * The penalty run-up's countdown (lib/star/penaltyRunup.ts): seconds to tap
   * before the kick happens without you. A ring round the ball and a bar
   * under the heading drain over exactly this long. Absent — every screen
   * but a run-up penalty — there is no time limit, exactly as before.
   */
  timeLimitS?: number;
  /** Called once if the countdown runs out before a tap (the kick is scuffed). */
  onTimeout?: () => void;
  /** How the ball moves on this screen; still when not given. */
  motion?: BallMotion;
  /** Your technique, 0-100. Higher = the ball moves slower. */
  technique?: number;
  /** A feature's teaching pause (CanvasMatch `holdAt`): the clock waits
   *  until this goes false. Absent in the real match. */
  hold?: boolean;
}

/** How long "TOO SLOW" shows before the scuffed kick is taken. */
const TOO_SLOW_MS = 350;

// Phase 2 — pick where on the ball to strike.
export default function ContactBall({ power, onContact, tutorial, timeLimitS, onTimeout, motion = "still", technique = 50, hold = false }: Props) {
  const ballRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  // One sweep across takes 2.2s at technique 40, 3.4s at 100.
  const period = 2.2 + Math.max(0, Math.min(100, technique) - 40) / 60 * 1.2;
  useEffect(() => {
    if (motion === "still") return;
    let raf = 0;
    const t0 = performance.now();
    const step = () => {
      raf = requestAnimationFrame(step);
      if (locked.current) return; // freeze where it was hit
      const area = areaRef.current, mover = moverRef.current;
      if (!area || !mover) return;
      const { x, y } = ballMotionAt(motion, (performance.now() - t0) / 1000, period);
      mover.style.transform = `translate(${x * area.clientWidth}px, ${y * area.clientHeight}px)`;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [motion, period]);
  const [spark, setSpark] = useState<{ left: number; top: number } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const locked = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const timed = !!timeLimitS && timeLimitS > 0;

  // The clock starts on the second frame after this screen appears — i.e.
  // once it has actually been drawn — not the instant it mounts. A slow
  // frame here (a recording caught a 0.27 s one) would otherwise come out of
  // your second, with the ring already part-drained the first time you see it.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!timed || hold) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setStarted(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [timed, hold]);

  // The deadline. A tap locks the screen (below) and a locked screen never
  // times out.
  useEffect(() => {
    if (!started || !timeLimitS || !(timeLimitS > 0)) return;
    let fire = 0;
    const id = window.setTimeout(() => {
      if (locked.current) return;
      locked.current = true;
      setTimedOut(true);
      fire = window.setTimeout(() => onTimeoutRef.current?.(), TOO_SLOW_MS);
    }, timeLimitS * 1000);
    return () => { window.clearTimeout(id); window.clearTimeout(fire); };
  }, [started, timeLimitS]);

  // The ring and bar sit full until the clock starts, and stop where they
  // are the moment you tap (or run out).
  const countdownState = started && !spark && !timedOut ? "running" : "paused";

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
      {timed && (
        <style>{`
          @keyframes kibCountRing { from { stroke-dashoffset: 0; stroke: #fde047; } 60% { stroke: #fb923c; } to { stroke-dashoffset: 100; stroke: #ef4444; } }
          @keyframes kibCountBar { from { transform: scaleX(1); background: #fde047; } 60% { background: #fb923c; } to { transform: scaleX(0); background: #ef4444; } }
        `}</style>
      )}
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
          {motion === "float" ? "Head it?" : "Strike it?"}
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

        {/* The run-up's countdown, as a bar that drains — see `timeLimitS`. */}
        {timed && (
          <div className="mx-auto mt-2 h-2 w-3/5 overflow-hidden rounded-full bg-black/40 border border-white/15">
            <div
              className="h-full w-full rounded-full"
              style={timedOut
                ? { transformOrigin: "left center", transform: "scaleX(0)" }
                : {
                  transformOrigin: "left center",
                  animation: `kibCountBar ${timeLimitS}s linear forwards`,
                  animationPlayState: countdownState,
                }}
            />
          </div>
        )}
      </div>

      {/* Ran out: the kick happens without you, and it is a scuff. */}
      {timedOut && (
        <div className="absolute inset-x-0 top-[34%] z-50 flex justify-center pointer-events-none">
          <div className="kib-pop rounded-xl bg-black/70 px-4 py-2 text-3xl font-black italic tracking-wider text-red-300 drop-shadow-[0_3px_10px_rgba(0,0,0,0.9)]">
            TOO SLOW!
          </div>
        </div>
      )}

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
      <div ref={areaRef} className="relative z-30 flex-1 flex items-end justify-center pb-[10%]">
        <div ref={moverRef} className="flex w-full items-end justify-center" style={{ willChange: motion === "still" ? undefined : "transform" }}>
        <div
          ref={ballRef}
          onPointerDown={handleTap}
          className="relative cursor-pointer"
          style={{ width: motion === "still" ? "56%" : "40%", aspectRatio: "1 / 1", touchAction: "none" }}
        >
          {/* A grounding shadow — without it the ball reads as pasted onto the
              grass rather than resting on it. */}
          {(motion === "still" || motion === "bobble") && <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              bottom: "-9%",
              width: "78%",
              height: "16%",
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 72%)",
            }}
          />}
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

          {/* The countdown again, as a ring round the ball itself — where
              your eyes (and thumb) already are. Drains clockwise from the top. */}
          {timed && (
            <svg
              className="absolute pointer-events-none"
              style={{ left: "-7%", top: "-7%", width: "114%", height: "114%" }}
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="4" />
              <circle
                cx="50" cy="50" r="47" fill="none" strokeWidth="4.5" strokeLinecap="round"
                pathLength={100} strokeDasharray="100"
                style={timedOut
                  // Out of time: the ring shows fully empty, never a frozen
                  // sliver left over (Mikey: "it needs to go all the way round").
                  ? { transform: "rotate(-90deg)", transformOrigin: "50% 50%", strokeDashoffset: 100 }
                  : {
                    transform: "rotate(-90deg)", transformOrigin: "50% 50%",
                    animation: `kibCountRing ${timeLimitS}s linear forwards`,
                    animationPlayState: countdownState,
                  }}
              />
            </svg>
          )}

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
    </div>
  );
}
