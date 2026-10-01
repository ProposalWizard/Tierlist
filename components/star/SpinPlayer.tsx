"use client";

/**
 * YOUR PLAYER ON HOME: drag him round, tap him to celebrate.
 *
 * Harry, 1 Oct 2026 (P52, P77): the drag-to-turn spin from the v0.20 page
 * "is exactly how it should look … add that to the home screen", and "tap on
 * him and he does different little celebrations". The turn is the one built
 * in app/star-spin-dev (front and back are the real A2 avatar; side-on the
 * body narrows to 42% and the head to 80%). A tap (a press that barely
 * moves) plays the next celebration from a short list; they never repeat
 * back to back. A win in your last match still plays one on its own
 * (`autoCelebrate`).
 *
 * Dragging him does not turn the Home page (the swipe pages only start on a
 * press that is NOT on him); everywhere else on the page still swipes.
 */
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { AvatarStyle } from "@/lib/star/heroFigure";
import PlayerAvatar from "./PlayerAvatar";
import { Burst, FloatText, prefersReducedMotion } from "./ui";

/** Where the neck is, as % of the avatar's height: above it is the head,
 *  which narrows far less than the body as he turns side-on. */
const HEAD_CUT = 25;

export type Celebration = "hop" | "twirl" | "flip" | "pump" | "slide";
const CELEBRATIONS: Celebration[] = ["hop", "twirl", "flip", "pump", "slide"];
/** How long each lasts (ms): arms are up for this long. */
const LENGTH: Record<Celebration, number> = { hop: 1300, twirl: 1100, flip: 1000, pump: 1400, slide: 1200 };

const CSS = `
@keyframes sp-flip { 0% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-34px) rotate(-120deg); } 50% { transform: translateY(-44px) rotate(-240deg); } 78% { transform: translateY(-8px) rotate(-345deg); } 100% { transform: translateY(0) rotate(-360deg); } }
@keyframes sp-pump { 0%,100% { transform: scale(1); } 15% { transform: scale(1.12,.92); } 30% { transform: scale(.94,1.1) translateY(-10px); } 45% { transform: scale(1.1,.94); } 60% { transform: scale(.96,1.08) translateY(-10px); } 80% { transform: scale(1.06,.96); } }
@keyframes sp-slide { 0% { transform: translateX(-34px) skewX(0); } 20% { transform: translateX(-24px) skewX(-9deg) translateY(10px); } 70% { transform: translateX(26px) skewX(-9deg) translateY(10px); } 100% { transform: translateX(0) skewX(0); } }
.sp-flip { animation: sp-flip 1s cubic-bezier(.35,.1,.4,1) 1 both; transform-origin: 50% 62%; }
.sp-pump { animation: sp-pump 1.4s ease-in-out 1 both; transform-origin: 50% 100%; }
.sp-slide { animation: sp-slide 1.2s cubic-bezier(.3,.6,.4,1) 1 both; transform-origin: 50% 100%; }
@media (prefers-reduced-motion: reduce) { .sp-flip, .sp-pump, .sp-slide { animation: none; } }
`;

export default function SpinPlayer({ career, width, height, look, kitShirt, kitTrim, autoCelebrate = false, className = "" }: {
  career: CareerState;
  width: number;
  height: number;
  look: AvatarStyle;
  kitShirt: string;
  kitTrim: string;
  /** Play a celebration on its own (a win in your last match). */
  autoCelebrate?: boolean;
  className?: string;
}) {
  // angle in degrees; 0 = facing you. Velocity keeps a flick turning.
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0), velRef = useRef(0);
  const dragRef = useRef<{ x: number; a: number; t: number; x0: number; y0: number; id: number; moved: boolean } | null>(null);
  const setA = (a: number) => { angleRef.current = a; setAngle(a); };
  const [fx, setFx] = useState<{ kind: Celebration; n: number } | null>(null);
  const lastKind = useRef<Celebration | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const twirlRaf = useRef(0);
  const twirling = useRef(false);

  const play = (kind?: Celebration) => {
    const pool = CELEBRATIONS.filter((k) => k !== lastKind.current);
    const k = kind ?? pool[Math.floor(Math.random() * pool.length)];
    lastKind.current = k;
    setFx((p) => ({ kind: k, n: (p?.n ?? 0) + 1 }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFx(null), LENGTH[k]);
    if (k === "twirl" && !prefersReducedMotion()) {
      // A quick full turn on the spot, eased out.
      cancelAnimationFrame(twirlRaf.current);
      twirling.current = true;
      const t0 = performance.now(), a0 = Math.round(angleRef.current / 360) * 360;
      const step = (now: number) => {
        const u = Math.min(1, (now - t0) / 900);
        setA(a0 + 360 * (1 - Math.pow(1 - u, 3)));
        if (u < 1) twirlRaf.current = requestAnimationFrame(step); else twirling.current = false;
      };
      twirlRaf.current = requestAnimationFrame(step);
    }
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); cancelAnimationFrame(twirlRaf.current); }, []);
  // The win celebration HomeHub decides on.
  const autoOn = useRef(false);
  useEffect(() => {
    if (autoCelebrate && !autoOn.current) { autoOn.current = true; play("hop"); }
    if (!autoCelebrate) autoOn.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCelebrate]);

  // Let go: keep the flick's spin, slow down, then settle back to the front.
  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!dragRef.current && angleRef.current !== 0 && !twirling.current) {
        let a = angleRef.current, v = velRef.current;
        if (Math.abs(v) > 20) { a += v * dt; v *= Math.pow(0.12, dt); }
        else {
          v = 0;
          const target = Math.round(a / 360) * 360; // the nearest "facing you"
          a += (target - a) * Math.min(1, dt * 5);
          if (Math.abs(target - a) < 0.3) a = target;
        }
        velRef.current = v;
        if (a !== angleRef.current) setA(a);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    // The swipe pages must not take this press.
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, a: angleRef.current, t: performance.now(), x0: e.clientX, y0: e.clientY, id: e.pointerId, moved: false };
    velRef.current = 0;
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 7) d.moved = true;
    if (!d.moved) return;
    const a = d.a + (e.clientX - d.x) * 1.2; // 300px of drag is about one full turn
    const now = performance.now();
    velRef.current = ((a - angleRef.current) / Math.max(1, now - d.t)) * 1000;
    d.t = now;
    setA(a);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved && d.id === e.pointerId) play();
  };

  const rad = (angle * Math.PI) / 180;
  const c = Math.cos(rad);
  const ac = Math.abs(c);
  const bodyW = 0.42 + 0.58 * ac;
  const headW = 0.8 + 0.2 * ac;
  const back = Math.min(1, Math.max(0, (0.1 - c) / 0.2)); // 0 = front, 1 = back
  const spin = look === "A2";
  const kind = fx?.kind;
  const armsUp = kind === "hop" || kind === "pump" || kind === "slide" || kind === "twirl";
  const wrapClass = kind === "hop" ? "kib-hop" : kind === "flip" ? "sp-flip" : kind === "pump" ? "sp-pump" : kind === "slide" ? "sp-slide" : "kib-breathe";

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ width, height, touchAction: "pan-y", cursor: "grab" }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { dragRef.current = null; }}
      aria-label="Your player. Drag to turn him, tap to celebrate."
    >
      <style>{CSS}</style>
      <div key={fx ? `${fx.kind}${fx.n}` : "idle"} className={wrapClass} style={{ width, height }}>
        {!spin ? (
          // The flat 2D figure has no back view: tap-to-celebrate only.
          <PlayerAvatar career={career} width={width} height={height} look={look} celebrate={armsUp} />
        ) : (
          <div className="relative" style={{ width, height }}>
            {(["front", "back"] as const).map((v) => {
              // The front stays solid underneath and the back fades in over
              // it, so mid-turn he is never see-through. The back is always
              // mounted (drawn once, invisible) so a turn never shows a blank.
              const o = v === "back" ? back : 1;
              return (["head", "body"] as const).map((part) => (
                <div key={v + part} className="pointer-events-none absolute inset-0" style={{
                  opacity: o,
                  visibility: o <= 0 ? "hidden" : "visible",
                  transform: `scaleX(${part === "head" ? headW : bodyW})`,
                  clipPath: part === "head" ? `inset(0 0 ${100 - HEAD_CUT}% 0)` : `inset(${HEAD_CUT}% 0 0 0)`,
                }}>
                  <PlayerAvatar career={career} width={width} height={height} look="A2" view={v} celebrate={armsUp && v === "front"} />
                </div>
              ));
            })}
          </div>
        )}
      </div>
      {fx && (kind === "hop" || kind === "pump" || kind === "twirl") && <Burst key={`b${fx.n}`} colors={[kitShirt, kitTrim, "#fde047", "#ffffff"]} className="left-1/2 top-[38%]" round={kind === "pump"} />}
      {fx && kind === "slide" && <FloatText key={`f${fx.n}`} trigger={fx.n} motion="tick" text="SIUUU" className="left-1/2 top-[8%] text-[15px] text-white" style={{ textShadow: "0 0 8px rgba(0,0,0,.9)" }} />}
    </div>
  );
}
