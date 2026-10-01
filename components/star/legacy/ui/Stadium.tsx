"use client";
import type React from "react";
import { rgba } from "@/components/star/legacy/ui/theme";

/**
 * THE NIGHT STADIUM behind the home hero: sky warming into the club colour,
 * a crowd of tiny lit faces, two floodlight banks with beams, a spotlight
 * and a mown pitch. Fills its `relative` parent.
 *
 *   <div className="relative overflow-hidden …"><Stadium glow={theme.glow} /> …</div>
 *
 * `intro` flickers the floodlights on as the screen opens (the title
 * screen); `big` makes the banks larger for a full-screen backdrop; `pitch`
 * off when the screen puts its own <Pitch> under the player.
 */
export default function Stadium({ glow, intro = false, big = false, pitch = true }: { glow: string; intro?: boolean; big?: boolean; pitch?: boolean }) {
  const floods = big
    ? [{ side: "left", x: "14%", rot: -30, delay: 0 }, { side: "right", x: "86%", rot: 30, delay: 260 }]
    : [{ side: "left", x: "10%", rot: -26, delay: 0 }, { side: "right", x: "90%", rot: 26, delay: 260 }];
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Night sky warming into the club colour at the bottom. */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(80% 60% at 50% 78%, ${rgba(glow, 0.55)} 0%, transparent 70%), linear-gradient(180deg, #060a14 0%, #0b1322 55%, #0b1322 100%)` }} />
      {/* The stand: a crowd of tiny lit faces, fading into the dark. */}
      <div
        className="absolute inset-x-0 top-[9%] h-[48%]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,.28) 0.9px, transparent 1.4px), radial-gradient(circle, ${rgba(glow, 0.6)} 0.9px, transparent 1.4px)`,
          backgroundSize: "7px 6px, 11px 9px",
          backgroundPosition: "0 0, 3px 2px",
          maskImage: "linear-gradient(180deg, transparent, #000 25%, #000 55%, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, transparent, #000 25%, #000 55%, transparent)",
          opacity: 0.5,
        }}
      />
      {/* The stand's roof line. */}
      <div className="absolute inset-x-0 top-[8%] h-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {/* Two floodlight banks: a grid of lamps, a soft halo, and a faint
          blurred beam falling towards him. */}
      {floods.map((f) => {
        const bank = (
          <>
            <div className={`absolute rounded-full ${big ? "-left-28 -top-24 h-56 w-56" : "-left-16 -top-14 h-32 w-32"}`} style={{ background: "radial-gradient(closest-side, rgba(220,235,255,.40), rgba(220,235,255,0))" }} />
            <div
              className={`absolute top-1 origin-top ${big ? "-left-[110px] h-[520px] w-[220px]" : "-left-[60px] h-[230px] w-[120px]"}`}
              style={{
                transform: `rotate(${f.rot}deg)`,
                background: "linear-gradient(180deg, rgba(220,235,255,.15), rgba(220,235,255,0) 80%)",
                clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)",
                filter: "blur(6px)",
              }}
            />
            <div className={`relative rounded-[3px] bg-slate-800 p-[2px] ${big ? "-left-[22px] h-[18px] w-[44px]" : "-left-[14px] h-[12px] w-[28px]"}`} style={{ boxShadow: "0 0 10px 3px rgba(235,245,255,.55)" }}>
              <div className="h-full w-full rounded-[2px]" style={{ backgroundImage: "radial-gradient(circle, #fff 1.2px, rgba(255,255,255,.35) 1.7px, transparent 2.2px)", backgroundSize: "6px 4px" }} />
            </div>
          </>
        );
        return (
          <div key={f.side} className={`kib-flood absolute ${big ? "top-[20%]" : "top-[3%]"}`} style={{ left: f.x }}>
            {intro ? <div className="kit-flicker" style={{ animationDelay: `${f.delay}ms` } as React.CSSProperties}>{bank}</div> : bank}
          </div>
        );
      })}
      {/* Spotlight on him. */}
      <div className="kib-glow-pulse absolute left-1/2 top-[8%] h-[70%] w-[70%] -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(255,255,255,.16), transparent)" }} />
      {/* The pitch he stands on, with mowing stripes. */}
      {pitch && <Pitch className="inset-x-[-10%] bottom-[22%] h-[24%]" />}
    </div>
  );
}

/** A patch of mown pitch, an ellipse fading at its edges. Place it with
 *  `className` inside a `relative` box (under a player's feet). */
export function Pitch({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-[50%] ${className}`}
      style={{
        background: "repeating-linear-gradient(90deg, #1f7a3a 0 22px, #1a6d33 22px 44px)",
        boxShadow: "inset 0 10px 24px rgba(0,0,0,.55), inset 0 -2px 12px rgba(0,0,0,.4)",
        maskImage: "radial-gradient(closest-side, #000 55%, transparent)",
        WebkitMaskImage: "radial-gradient(closest-side, #000 55%, transparent)",
        opacity: 0.85,
      }}
    />
  );
}
