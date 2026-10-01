"use client";

/**
 * REWARD JUICE for money screens — the shop, the store and the casino.
 * Same spirit as the can (juice.tsx): fired by a counter, all CSS, all off
 * for a phone set to reduce motion.
 *
 *   <ShakeX trigger={lost}>…the table…</ShakeX>          a loss: a sideways shudder
 *   <LossFlash trigger={lost} />                          …and a red edge flash
 *   <WinCelebration trigger={won} amount={500} format={(n) => `+★${formatMoney(n)}`} colors={[…]} />
 *   <Badge count={3} />                                   a notification badge that pops in
 *   const [flyLayer, fly] = useFly();  fly(fromEl, toEl, <KibCanIcon …/>)  an item flying into your inventory
 *
 * Nothing here is needed to read a screen: the result text, the count and
 * the balance are all still on the page without the motion.
 */
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Burst } from "@/components/star/ui/juice";
import { prefersReducedMotion, useCountUp } from "@/components/star/legacy/ui/motion";

/** A sideways shudder — a lost bet. Once per trigger. */
export function ShakeX({ trigger, className = "", style, children }: {
  trigger: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div key={trigger} className={`${className}${trigger ? " kit-shake-x" : ""}`} style={style}>
      {children}
    </div>
  );
}

/** A red flash round the edge of the screen — a lost bet. */
export function LossFlash({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  return (
    <div
      key={trigger}
      aria-hidden
      className="kit-loss-flash pointer-events-none fixed inset-0 z-[70]"
      style={{ boxShadow: "inset 0 0 70px 18px rgba(239,68,68,.55)" }}
    />
  );
}

/** A notification badge: a red pill that pops in, and pops again whenever
 *  the count changes. Nothing for 0. Put it inside a `relative` box. */
export function Badge({ count, className = "-right-1.5 -top-1.5", delay = 0 }: { count: number; className?: string; delay?: number }) {
  if (count <= 0) return null;
  return (
    <span
      key={count}
      className={`kit-badge-pop pointer-events-none absolute z-10 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-b from-red-400 to-red-600 px-1 text-[10.5px] font-black leading-none text-white ${className}`}
      style={{ animationDelay: `${delay}ms`, boxShadow: "0 0 0 2px rgba(0,0,0,.55), 0 3px 8px -2px rgba(239,68,68,.8)" }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * A BIG WIN: the screen dims, light rays turn behind a burst of confetti,
 * and the winnings count up from nothing. Fades itself out; a new trigger
 * plays it again. Hidden entirely for a phone set to reduce motion (the
 * game's own result line still says what you won).
 */
export function WinCelebration({ trigger, amount, format, colors, label = "YOU WIN" }: {
  trigger: number;
  amount: number;
  format: (n: number) => string;
  colors: string[];
  label?: string;
}) {
  if (!trigger) return null;
  return <WinInner key={trigger} amount={amount} format={format} colors={colors} label={label} />;
}

function WinInner({ amount, format, colors, label }: { amount: number; format: (n: number) => string; colors: string[]; label: string }) {
  const [target, setTarget] = useState(0);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setTarget(amount), 180);
    const b = setTimeout(() => setGone(true), 2700);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [amount]);
  const shown = useCountUp(target, 1100);
  if (gone) return null;
  return (
    <div aria-hidden className="kit-win-overlay pointer-events-none fixed inset-0 z-[75] grid place-items-center">
      <div className="absolute inset-0" style={{ background: "radial-gradient(60% 45% at 50% 45%, rgba(250,204,21,.28), rgba(0,0,0,.55) 70%)" }} />
      <div
        className="kit-rays absolute left-1/2 top-[45%] h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 opacity-40"
        style={{ background: "repeating-conic-gradient(from 0deg, rgba(253,224,71,.35) 0deg 8deg, transparent 8deg 24deg)", maskImage: "radial-gradient(closest-side, #000 20%, transparent 70%)", WebkitMaskImage: "radial-gradient(closest-side, #000 20%, transparent 70%)" }}
      />
      <div className="relative -mt-[10vh] text-center">
        <Burst colors={colors} count={44} spread={1.7} className="left-1/2 top-1/2" />
        <Burst colors={["#fde047", "#ffffff"]} count={18} spread={1.1} round className="left-1/2 top-1/2" />
        <div className="kit-win-pop">
          <div className="text-[15px] font-black uppercase tracking-[0.3em] text-amber-200" style={{ textShadow: "0 0 14px rgba(251,191,36,.8)" }}>{label}</div>
          <div
            className="mt-1 bg-gradient-to-b from-yellow-100 via-yellow-300 to-amber-500 bg-clip-text text-[52px] font-black leading-none tabular-nums text-transparent"
            style={{ filter: "drop-shadow(0 4px 0 rgba(0,0,0,.45)) drop-shadow(0 0 22px rgba(251,191,36,.7))" }}
          >
            {format(Math.round(shown))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface Flight { id: number; x: number; y: number; dx: number; dy: number; node: React.ReactNode }

/**
 * AN ITEM FLYING INTO YOUR INVENTORY. `fly(from, to, node)` launches a copy
 * of `node` from the centre of `from` along an arc to the centre of `to`;
 * render `layer` once anywhere on the screen. `onLand` runs as it arrives
 * (straight away for a phone set to reduce motion).
 */
export function useFly(ms = 780): [React.ReactNode, (from: Element | null, to: Element | null, node: React.ReactNode, onLand?: () => void) => void] {
  const [flights, setFlights] = useState<Flight[]>([]);
  const next = useRef(1);
  const fly = useCallback((from: Element | null, to: Element | null, node: React.ReactNode, onLand?: () => void) => {
    if (!from || !to || prefersReducedMotion()) { onLand?.(); return; }
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const id = next.current++;
    const f: Flight = { id, x: a.left + a.width / 2, y: a.top + a.height / 2, dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height / 2 - (a.top + a.height / 2), node };
    setFlights((l) => [...l, f]);
    setTimeout(() => onLand?.(), ms * 0.9);
    setTimeout(() => setFlights((l) => l.filter((x) => x.id !== id)), ms + 60);
  }, [ms]);
  const layer = (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80]">
      {flights.map((f) => (
        <div key={f.id} className="kit-fly-x absolute" style={{ left: f.x, top: f.y, animationDuration: `${ms}ms`, ["--tx" as string]: `${f.dx}px` } as React.CSSProperties}>
          <div className="kit-fly-y" style={{ animationDuration: `${ms}ms`, ["--ty" as string]: `${f.dy}px` } as React.CSSProperties}>
            <div className="kit-fly-s -translate-x-1/2 -translate-y-1/2" style={{ animationDuration: `${ms}ms`, filter: "drop-shadow(0 6px 10px rgba(0,0,0,.6)) drop-shadow(0 0 12px rgba(253,224,71,.6))" }}>
              {f.node}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  return [layer, fly];
}
