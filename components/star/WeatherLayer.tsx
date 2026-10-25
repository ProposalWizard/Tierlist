"use client";
/**
 * THE WEATHER, DRAWN OVER THE MATCH (Leo's update, part "weather").
 *
 * Light rain streaks (heavier in heavy rain) and a small wind arrow in the
 * corner, pointing the way the wind blows ON SCREEN: the arrow is turned with
 * the camera when a chance is played sideways. Pure CSS over the canvas, no
 * drawing loop; it never takes a touch. Only mounted when the match's
 * conditions say `drawn` (matchWeather.ts / the weather test page).
 */
import type { Conditions } from "@/lib/star/weather";

type Facing = "up" | "left" | "right";

/** The wind on screen (x right, y down) for this camera. Pitch y runs away from the goal, which is at the top when facing up. */
export function windOnScreen(w: { x: number; y: number }, facing: Facing): { x: number; y: number } {
  if (facing === "right") return { x: -w.y, y: w.x };
  if (facing === "left") return { x: w.y, y: -w.x };
  return { x: w.x, y: w.y };
}

export default function WeatherLayer({ cond, facing }: { cond: Conditions; facing: Facing }) {
  const rain = cond.weather === "rain" ? 1 : cond.weather === "heavy" ? 2 : 0;
  const w = cond.windV;
  const speed = w ? Math.hypot(w.x, w.y) : 0;
  const s = w ? windOnScreen(w, facing) : null;
  const deg = s ? (Math.atan2(s.y, s.x) * 180) / Math.PI : 0;
  // Rain falls slanted with the wind across the screen.
  const slant = s ? Math.max(-25, Math.min(25, s.x * 1.6)) : 0;
  return (
    <div data-weather-layer={cond.weather} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {rain > 0 && (
        <>
          <style>{`@keyframes kib-rain { from { background-position: 0 0, 0 0; } to { background-position: ${-slant * 4}px 320px, ${-slant * 4}px 240px; } }
            @media (prefers-reduced-motion: reduce) { [data-weather-layer] .kib-rain { animation: none !important; } }`}</style>
          <div
            className="kib-rain absolute -inset-[20%]"
            style={{
              // Light, but bold enough to survive a phone video (1 px streaks vanished in a recording).
              opacity: rain === 2 ? 0.42 : 0.3,
              transform: `rotate(${slant}deg)`,
              backgroundImage: [
                "repeating-linear-gradient(90deg, transparent 0 13px, rgba(220,235,255,.95) 13px 15px, transparent 15px 31px)",
                "repeating-linear-gradient(90deg, transparent 0 21px, rgba(220,235,255,.75) 21px 23px, transparent 23px 43px)",
              ].join(","),
              WebkitMaskImage: "repeating-linear-gradient(180deg, #000 0 14px, transparent 14px 40px)",
              maskImage: "repeating-linear-gradient(180deg, #000 0 14px, transparent 14px 40px)",
              animation: `kib-rain ${rain === 2 ? 0.45 : 0.7}s linear infinite`,
            }}
          />
          {/* A wet sheen: the pitch reads a touch darker and cooler. */}
          <div className="absolute inset-0" style={{ background: `rgba(20,40,70,${rain === 2 ? 0.16 : 0.09})` }} />
        </>
      )}
      {s && speed > 0.5 && (
        <div data-wind-arrow className="absolute right-2 top-10 flex flex-col items-center gap-0.5 rounded-md px-1.5 py-1" style={{ background: "rgba(3,7,18,.55)" }}>
          <svg width="30" height="30" viewBox="-15 -15 30 30">
            <g transform={`rotate(${deg})`}>
              <line x1={-10} y1={0} x2={6} y2={0} stroke="#fde68a" strokeWidth={3.2} strokeLinecap="round" />
              <path d="M12 0 L4 -6 L4 6 Z" fill="#fde68a" />
            </g>
          </svg>
          <span className="text-[9.5px] font-black leading-none text-amber-100">{Math.round(speed)} m/s</span>
        </div>
      )}
    </div>
  );
}
