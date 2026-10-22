"use client";
import { useEffect, useRef, useState } from "react";
import { gradeContact } from "@/lib/star/shotModel";
import { airContactRead, AIR_CENTRE_R, VOLLEY_SWEET } from "@/lib/star/airborneChance";
import { headerJump } from "@/lib/star/aerial";
import { bicycleBand, bicycleContactRead, bicycleMotionAt, bicyclePeriodS, BICYCLE_CENTRE_R } from "@/lib/star/bicycle";

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
  /** `lift` (0 grass … 1 top of the arc) only for a ball in the air
   *  (float/bounce): how high it was when you hit it (lib/star/airborneChance.ts). */
  onContact: (contact: { cx: number; cy: number; lift?: number; bicycle?: boolean }) => void;
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
  /** Your Aerial & Acrobatics, 0-100: read instead of technique for how a
   *  header or volley comes off (airborneChance.ts). Absent = technique, as before. */
  aerial?: number;
  /** A header: how high the cross reaches you (m, airDrawings.ts airZOf). With
   *  `aerial`, the screen says your jump ("Jump 0.62 m") and a ball above
   *  your reach comes off at a stretch. Absent: as before. */
  ballZ?: number;
  /** A feature's teaching pause (CanvasMatch `holdAt`): the clock waits
   *  until this goes false. Absent in the real match. */
  hold?: boolean;
  /** Shots: New (lib/star/shotModel.ts) — say how the strike came off the
   *  boot (CLEAN, SLICED, TOPPED, SCUFFED, KNUCKLEBALL) where it was hit.
   *  Absent: exactly the old screen. */
  grades?: boolean;
  /** A hard strike through the dead centre knuckles (only with `grades`). */
  knuckles?: boolean;
  /** Contact field on (lib/star/shotFeel.ts, Oct 13): a faint guide on the
   *  ball — the up/down lines fade out toward the sides, where a strike is a
   *  low curler. Absent: exactly the old screen. */
  field?: boolean;
  /** A cross above your head, coming across you (lib/star/bicycle.ts
   *  bicycleOffered): a BICYCLE button shows. Pressed, the ball drops across
   *  you through a stricter height meter and the tap is a bicycle kick
   *  (onContact's `bicycle: true`). `fromLeft`: the side the cross comes from.
   *  Absent: exactly the screen as before. */
  bicycle?: { fromLeft: boolean };
}

/** How long "TOO SLOW" shows before the scuffed kick is taken. */
const TOO_SLOW_MS = 350;

/** How far out from the ball's centre a touch still strikes it, in ball
 *  radii: the ball plus a margin reaching the countdown ring (1.14). */
export const STRIKE_ZONE_R = 1.18;

// Phase 2 — pick where on the ball to strike.
export default function ContactBall({ power, onContact, tutorial, timeLimitS, onTimeout, motion = "still", technique = 50, aerial, ballZ, hold = false, grades = false, knuckles = false, field = false, bicycle }: Props) {
  const ballRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef(0);
  // B10: the volley's height meter (its marker follows the ball's height).
  const meterRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  // One sweep across takes 2.2s at technique 40, 3.4s at 100.
  const period = 2.2 + Math.max(0, Math.min(100, technique) - 40) / 60 * 1.2;
  // Bicycle mode (the BICYCLE button pressed): the cross drops across you.
  const [bike, setBike] = useState(false);
  const bikeOn = bike && !!bicycle;
  const bikeBand = bicycleBand(aerial);
  const bikePeriod = bicyclePeriodS(aerial);
  const bikeFromLeft = bicycle?.fromLeft ?? true;
  useEffect(() => {
    if (motion === "still") return;
    let raf = 0;
    const t0 = performance.now();
    const step = () => {
      raf = requestAnimationFrame(step);
      if (locked.current) return; // freeze where it was hit
      const area = areaRef.current, mover = moverRef.current;
      if (!area || !mover) return;
      if (bikeOn) {
        const b = bicycleMotionAt((performance.now() - t0) / 1000, bikePeriod, bikeFromLeft);
        mover.style.transform = `translate(${b.x * area.clientWidth}px, ${b.y * area.clientHeight}px)`;
        liftRef.current = b.lift;
        if (meterRef.current) meterRef.current.style.bottom = `calc(${(b.lift * 100).toFixed(1)}% - 3px)`;
        const sh = shadowRef.current;
        if (sh) {
          const k = 1 - 0.45 * b.lift;
          sh.style.transform = `translateX(calc(-50% + ${b.x * area.clientWidth}px)) scale(${k})`;
          sh.style.opacity = String(0.35 + 0.65 * k);
        }
        return;
      }
      const { x, y } = ballMotionAt(motion, (performance.now() - t0) / 1000, period);
      mover.style.transform = `translate(${x * area.clientWidth}px, ${y * area.clientHeight}px)`;
      // How high it is now, 0..1 of this motion's top (float sits ~0.42-0.5 up).
      const top = motion === "float" ? 0.5 : motion === "bounce" ? 0.26 : 0.05;
      liftRef.current = Math.max(0, Math.min(1, -y / top));
      if (meterRef.current) meterRef.current.style.bottom = `calc(${(liftRef.current * 100).toFixed(1)}% - 3px)`;
      const sh = shadowRef.current;
      if (sh) {
        // The shadow stays on the grass, under the ball, smaller and fainter the higher it is.
        const k = 1 - 0.45 * Math.min(1, -y / 0.5);
        sh.style.transform = `translateX(calc(-50% + ${x * area.clientWidth}px)) scale(${k})`;
        sh.style.opacity = String(0.35 + 0.65 * k);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [motion, period, bikeOn, bikePeriod, bikeFromLeft]);
  const [spark, setSpark] = useState<{ left: number; top: number } | null>(null);
  const [graded, setGraded] = useState<{ label: string; good: boolean } | null>(null);
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

  /**
   * A touch anywhere on this screen, measured against where the ball is drawn
   * right now.
   *
   * Harry, 5 Oct 2026 (iPhone): "the ball has like opacity around it and I
   * can hit the bottom like 25% of the ball". The tap used to be heard only by
   * the ball's own element, so anything iOS put in front of it (the match
   * canvas underneath is tipped back in 3D, and Safari can let a 3D layer
   * catch touches over a flat overlay; the moving ball's transformed wrapper)
   * swallowed it. Now the whole overlay listens and the ball's own on-screen
   * box decides, so no layer can sit between your thumb and the ball.
   *
   * The zone is the ball plus a margin out to the countdown ring (114% of the
   * ball): a touch in the margin strikes the edge of the ball it is nearest.
   * Inside the ball, cx/cy are exactly what they always were.
   */
  const handleTap = (e: React.PointerEvent) => {
    if (locked.current || !ballRef.current) return;
    const rect = ballRef.current.getBoundingClientRect();
    const r = rect.width / 2;
    if (!(r > 0)) return;
    const dx = e.clientX - (rect.left + r);
    const dy = e.clientY - (rect.top + r);
    let cx = dx / r; // +right
    let cy = dy / r; // +down (bottom of ball)
    const d = Math.hypot(cx, cy);
    if (d > STRIKE_ZONE_R) return; // well off the ball — ignore
    if (d > 1) { cx /= d; cy /= d; } // the margin: the edge of the ball

    locked.current = true;
    setSpark({ left: r + cx * r, top: r + cy * r });
    const air = motion === "float" || motion === "bounce";
    const lift = liftRef.current;
    if (bikeOn) {
      // A bicycle kick says how it came off (the same read the strike uses: bicycle.ts).
      const rd = bicycleContactRead({ cx, cy, lift, aerial: aerial ?? technique });
      setGraded({ label: rd.label, good: rd.good });
      setTimeout(() => onContact({ cx, cy, lift, bicycle: true }), 520);
      return;
    }
    if (air) {
      // B10: a header or volley says how it came off (the same read the strike uses).
      const rd = airContactRead({ kind: motion === "float" ? "header" : "volley", lift, cx, cy, tech: technique, aerial },
        motion === "float" && ballZ !== undefined ? ballZ * (0.85 + 0.15 * lift) : undefined);
      setGraded({ label: rd.label, good: rd.good });
    } else if (grades) {
      const g = gradeContact({ cx, cy }, power, knuckles, field);
      if (g.label) setGraded({ label: g.label, good: g.grade === "clean" || g.grade === "knuckle" || g.label === "CURLER" });
    }
    // A graded strike holds a beat longer so the verdict can be read.
    setTimeout(() => onContact(air ? { cx, cy, lift } : { cx, cy }), grades || air ? 420 : 200);
  };

  const jump = motion === "float" && ballZ !== undefined && aerial !== undefined ? headerJump(ballZ, aerial) : null;
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
      onPointerDown={handleTap}
      style={{
        background: "linear-gradient(to bottom, #4a71b8 0%, #a8c4e8 100%)",
        touchAction: "none",
        // Its own flat layer, lifted in front: the match canvas under it is
        // tipped back in 3D, and iOS Safari can otherwise draw or hit-test
        // the near half of that tipped picture through this overlay.
        transform: "translateZ(400px)",
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
          {bikeOn ? "Bicycle kick!" : motion === "float" ? "Head it?" : motion === "bounce" ? "Volley it?" : "Strike it?"}
        </div>
        {/* B10: what matters for a ball in the air, in one line. */}
        {(motion === "float" || motion === "bounce") && (
          <div data-air-hint className="mt-1.5 text-[11px] font-bold text-white/90" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            {bikeOn ? "Dead centre, as it drops through the green" : motion === "float" ? "Top nods it down · the sides glance it · under loops it up" : "Hit the middle as it drops through the green"}
          </div>
        )}
        {/* The jump (Aerial sets how high you go): the cross's height against your reach. */}
        {jump && !bikeOn && (
          <div data-header-jump className="mt-1 text-[12px] font-black tracking-wide" style={{ color: jump.overM > 0.02 ? "#fca5a5" : "#bbf7d0", textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}>
            {jump.jumpM < 0.03 ? "No jump needed" : `Jump ${jump.jumpM.toFixed(2)} m`}
            {jump.overM > 0.02 ? ` · ${jump.overM.toFixed(2)} m over your reach` : ` · max ${jump.maxJumpM.toFixed(2)} m`}
          </div>
        )}

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

      {/* B10: a volley's height meter — the ball's height now, and the green
          band where it is met sweetly as it drops (VOLLEY_SWEET). */}
      {bikeOn && (
        <div data-bicycle-meter className="absolute left-2.5 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 pointer-events-none">
          <span className="text-white text-[9px] font-black uppercase tracking-[0.15em]" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            Height
          </span>
          <div className="relative h-28 w-3 rounded-full bg-black/50 border border-white/10">
            <div className="absolute left-0 right-0 rounded-sm bg-emerald-400/80"
              style={{ bottom: `${bikeBand[0] * 100}%`, height: `${(bikeBand[1] - bikeBand[0]) * 100}%` }} />
            <div ref={meterRef} className="absolute -left-1 -right-1 h-1.5 rounded-full bg-white shadow" style={{ bottom: "-3px" }} />
          </div>
        </div>
      )}
      {/* The BICYCLE button (and back to a header): only when this cross is
          above your head and coming across you (bicycle.ts bicycleOffered). */}
      {bicycle && !spark && (
        <button
          type="button"
          data-bicycle-button={bikeOn ? "on" : "off"}
          onPointerDown={(e) => { e.stopPropagation(); if (!locked.current) setBike((v) => !v); }}
          className={`absolute left-3 bottom-[5%] z-50 rounded-xl border-2 px-3.5 py-2 font-black italic uppercase tracking-wide shadow-lg active:scale-95 ${
            bikeOn ? "border-white/70 bg-black/60 text-white text-[13px]" : "border-amber-200 bg-gradient-to-b from-amber-400 to-orange-600 text-white text-[15px]"}`}
          style={{ textShadow: "0 2px 3px rgba(0,0,0,0.55)", touchAction: "none" }}
        >
          {bikeOn ? "← Head it" : "Bicycle!"}
        </button>
      )}

      {motion === "bounce" && (
        <div data-volley-meter className="absolute left-2.5 top-1/2 z-40 -translate-y-1/2 flex flex-col items-center gap-1.5 pointer-events-none">
          <span className="text-white text-[9px] font-black uppercase tracking-[0.15em]" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
            Height
          </span>
          <div className="relative h-28 w-3 rounded-full bg-black/50 border border-white/10">
            <div className="absolute left-0 right-0 rounded-sm bg-emerald-400/70"
              style={{ bottom: `${VOLLEY_SWEET[0] * 100}%`, height: `${(VOLLEY_SWEET[1] - VOLLEY_SWEET[0]) * 100}%` }} />
            <div ref={meterRef} className="absolute -left-1 -right-1 h-1.5 rounded-full bg-white shadow" style={{ bottom: "-3px" }} />
          </div>
        </div>
      )}

      {/* The ball — sitting ON the grass. It used to float in the middle of the
          sky with the turf a long way below it, which reads as a ball in the
          air, and this screen is you standing over a ball at your feet. */}
      <div ref={areaRef} className="relative z-30 flex-1 flex items-end justify-center pb-[10%]">
        {/* A ball in the air (header/volley): its shadow on the grass below it. */}
        {(motion === "float" || motion === "bounce") && <div
          ref={shadowRef}
          className="absolute left-1/2 pointer-events-none"
          style={{
            bottom: "calc(10% - 3%)",
            width: "32%",
            height: "6%",
            borderRadius: "50%",
            transform: "translateX(-50%)",
            background: "radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 72%)",
          }}
        />}
        <div ref={moverRef} className="flex w-full items-end justify-center" style={{ willChange: motion === "still" ? undefined : "transform" }}>
        <div
          ref={ballRef}
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
              public/star/ball.webp) and dropped straight in. */}
          {/* The ball's own shadow, as a plain round shadow behind it. It was
              a CSS drop-shadow filter on the picture, which iOS Safari can
              draw as a see-through box round a moving or layered picture. */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: "0 10px 14px rgba(0,0,0,0.55)" }}
          />
          <img
            src="/star/ball.webp"
            alt=""
            draggable={false}
            className="relative w-full h-full object-cover rounded-full select-none pointer-events-none"
          />

          {/* B10: a ball in the air — the middle of it, where a header or a
              volley is struck clean (AIR_CENTRE_R either side). */}
          {(motion === "float" || motion === "bounce") && (
            <svg data-air-centre className="absolute inset-0 pointer-events-none" viewBox="-1 -1 2 2" aria-hidden="true">
              <circle cx="0" cy="0" r={(bikeOn ? BICYCLE_CENTRE_R : AIR_CENTRE_R) + 0.08} fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="0.035" strokeDasharray="0.07 0.05" />
            </svg>
          )}

          {/* Contact field guide (Oct 13): height lines that fade out toward
              the sides, and a curl mark at each edge. One faint layer. */}
          {field && (
            <svg data-contact-field className="absolute inset-0 pointer-events-none" viewBox="-1 -1 2 2" aria-hidden="true">
              <defs>
                <linearGradient id="kibFieldFade" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.3" stopColor="#fff" stopOpacity="0.55" />
                  <stop offset="0.7" stopColor="#fff" stopOpacity="0.55" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[-0.5, 0, 0.5].map((y) => (
                <line key={y} x1={-Math.sqrt(1 - y * y)} x2={Math.sqrt(1 - y * y)} y1={y} y2={y}
                  stroke="url(#kibFieldFade)" strokeWidth="0.025" strokeDasharray="0.06 0.05" />
              ))}
              <path d="M -0.86 -0.28 Q -0.98 0 -0.86 0.28" fill="none" stroke="#fde047" strokeOpacity="0.7" strokeWidth="0.04" strokeLinecap="round" />
              <path d="M 0.86 -0.28 Q 0.98 0 0.86 0.28" fill="none" stroke="#fde047" strokeOpacity="0.7" strokeWidth="0.04" strokeLinecap="round" />
            </svg>
          )}

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
          {spark && graded && (
            <div
              data-contact-grade={graded.label}
              className={`kib-pop absolute left-1/2 -translate-x-1/2 ${bikeOn ? "top-[108%]" : "-top-[22%]"} whitespace-nowrap rounded-lg px-3 py-1 text-lg font-black italic tracking-wider pointer-events-none select-none ${
                graded.good ? "bg-emerald-500/90 text-white" : "bg-red-600/90 text-white"}`}
              style={{ textShadow: "0 2px 4px rgba(0,0,0,0.6)" }}
            >
              {graded.label}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
