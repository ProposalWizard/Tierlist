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

/** The drops: random but fixed (a seeded roll), so a match always rains the same way. */
function drops(n: number): { x: number; y: number; w: number; h: number; t: number; delay: number; o: number }[] {
  let a = 9137;
  const r = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
  return Array.from({ length: n }, () => ({
    x: r() * 110 - 5, y: r() * 100, w: 2 + r() * 1.4, h: 16 + r() * 26,
    t: 0.55 + r() * 0.5, delay: -r() * 1.2, o: 0.55 + r() * 0.45,
  }));
}

export default function WeatherLayer({ cond, facing }: { cond: Conditions; facing: Facing }) {
  const rain = cond.weather === "rain" ? 1 : cond.weather === "heavy" ? 2 : 0;
  const w = cond.windV;
  const speed = w ? Math.hypot(w.x, w.y) : 0;
  const s = w ? windOnScreen(w, facing) : null;
  const deg = s ? (Math.atan2(s.y, s.x) * 180) / Math.PI : 0;
  // Rain falls slanted with the wind across the screen, and a touch slanted even in still air.
  const slant = s ? Math.max(-25, Math.min(25, 6 + s.x * 1.6)) : 6;
  return (
    <div data-weather-layer={cond.weather} aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {rain > 0 && (
        <>
          <style>{`@keyframes kib-drop { from { transform: translate(0, -60px); } to { transform: translate(${(-slant * 9).toFixed(0)}px, 900px); } }
            @media (prefers-reduced-motion: reduce) { [data-weather-layer] .kib-drop { animation: none !important; } }`}</style>
          {/* Single drops at random spots (fixed per match, no dice per frame), each its
              own length, speed and start, all slanted with the wind: rain, not a grid. */}
          <div className="absolute inset-0" style={{ transform: `rotate(${slant}deg)`, transformOrigin: "50% 0" }}>
            {drops(rain === 2 ? 170 : 100).map((d, i) => (
              <span
                key={i}
                className="kib-drop absolute block rounded-full"
                style={{
                  left: `${d.x}%`, top: `${d.y - 10}%`, width: d.w, height: d.h,
                  background: "linear-gradient(180deg, rgba(220,235,255,0), rgba(225,238,255,.95))",
                  opacity: (rain === 2 ? 0.75 : 0.6) * d.o,
                  animation: `kib-drop ${(d.t * (rain === 2 ? 0.75 : 1)).toFixed(2)}s linear ${d.delay.toFixed(2)}s infinite`,
                }}
              />
            ))}
          </div>
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
