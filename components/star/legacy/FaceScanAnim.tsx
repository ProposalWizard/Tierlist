"use client";
import { useEffect, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Pt } from "@/lib/star/faceScan";
import { FACE_OVAL } from "@/lib/star/faceScan";
import PlayerAvatar from "@/components/star/legacy/PlayerAvatar";

/**
 * THE "SCANNING" MOMENT — the photo you just picked, a line sweeping down
 * it, the face points lighting up as they are found, then your head popping
 * onto your player.
 *
 * Harry, 28 Sep 2026: "maybe we need to do some sort of face scan
 * technique" — so it should feel like one (FIFA's face scan). It is honest:
 * the dots are the real points the scan found (faceScan.ts), drawn where
 * they are on your photo, and the reveal is the real result on the real
 * home-screen avatar (PlayerAvatar), not a mock-up.
 *
 * Reduced motion: no sweep, no pop — the dots fade in and the result
 * appears.
 */

/** Which face points to show: the outline, and a sparse sprinkle inside. */
const SHOWN = Array.from(new Set([...FACE_OVAL, 33, 133, 159, 145, 362, 263, 386, 374, 70, 105, 107, 336, 334, 300, 1, 4, 98, 327, 61, 291, 0, 17, 13, 14, 168, 6, 197, 50, 280, 205, 425, 468, 473]));

export function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setR(mq.matches);
    const on = () => setR(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return r;
}

export function ScanningPhoto({ src, size, box, points, reduced }: {
  src: string; box: number; size: { w: number; h: number }; points: Pt[] | null; reduced: boolean;
}) {
  // The photo fills the box (cover), so the points are mapped the same way.
  const s = Math.max(box / (size.w || 1), box / (size.h || 1));
  const ox = (box - size.w * s) / 2, oy = (box - size.h * s) / 2;
  return (
    <div className="kib-scan relative mx-auto overflow-hidden rounded-xl border border-emerald-400/40 bg-black" style={{ width: box, height: box }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute max-w-none" style={{ left: ox, top: oy, width: size.w * s, height: size.h * s, filter: "saturate(0.85) brightness(0.9)" }} />
      {/* A faint grid, like a scanner bed. */}
      <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(52,211,153,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,.10) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
      {!reduced && <div className="kib-scan-line absolute inset-x-0 h-[3px]" />}
      {points && (
        <svg className="absolute inset-0" width={box} height={box}>
          {SHOWN.map((id) => {
            const p = points[id];
            if (!p) return null;
            const x = ox + p.x * size.w * s, y = oy + p.y * size.h * s;
            return (
              <circle
                key={id} cx={x} cy={y} r={id >= 468 ? 2.6 : 1.7}
                className="kib-scan-dot"
                style={{ animationDelay: reduced ? "0ms" : `${Math.round((y / box) * 700)}ms` }}
              />
            );
          })}
        </svg>
      )}
      <div className="absolute bottom-2 left-0 right-0 text-center text-[11px] font-black uppercase tracking-[0.25em] text-emerald-200" style={{ textShadow: "0 1px 4px rgba(0,0,0,.9)" }}>
        {points ? "Face found — fitting" : "Scanning"}
        <span className="kib-scan-ellipsis" />
      </div>
      <style>{SCAN_CSS}</style>
    </div>
  );
}

/** The result on your player: the real home-screen avatar, with a pop. */
export function ScanReveal({ portrait, club, number, reduced }: { portrait: string; club: string; number?: number; reduced: boolean }) {
  // PlayerAvatar only reads these fields; a stand-in career keeps the
  // preview drawn by exactly the same code as the home screen.
  const stand = { player: { club, portrait, firstName: "", lastName: "" }, squadNumber: number ?? null } as unknown as CareerState;
  return (
    <div className="relative mx-auto overflow-hidden rounded-xl" style={{ width: 224, height: 224, background: "radial-gradient(70% 60% at 50% 45%, rgba(16,185,129,.35), transparent 70%), linear-gradient(180deg,#060a14,#0b1322)" }}>
      {!reduced && <div className="kib-reveal-flash absolute inset-0" />}
      {/* Zoomed in on head and shoulders: the avatar is drawn big and the
          box shows its top half, so the new face is what you look at. */}
      <div className={`absolute left-1/2 top-0 -ml-[180px] ${reduced ? "" : "kib-reveal-pop"}`}>
        <PlayerAvatar career={stand} width={360} height={428} ball={false} look="A2" />
      </div>
      <style>{SCAN_CSS}</style>
    </div>
  );
}

const SCAN_CSS = `
.kib-scan-line { top: 0; background: linear-gradient(90deg, transparent, #34d399 15%, #a7f3d0 50%, #34d399 85%, transparent);
  box-shadow: 0 0 12px 3px rgba(52,211,153,.7), 0 0 40px 8px rgba(52,211,153,.25); animation: kibScanSweep 1.3s cubic-bezier(.45,0,.55,1) infinite alternate; }
@keyframes kibScanSweep { from { transform: translateY(0); } to { transform: translateY(221px); } }
.kib-scan-dot { fill: #6ee7b7; filter: drop-shadow(0 0 2px rgba(52,211,153,.9)); opacity: 0; transform-box: fill-box; transform-origin: center;
  animation: kibScanDot .35s ease-out forwards; }
@keyframes kibScanDot { 0% { opacity: 0; transform: scale(2.4); } 100% { opacity: .95; transform: scale(1); } }
.kib-scan-ellipsis::after { content: "…"; }
.kib-reveal-pop { animation: kibRevealPop .7s cubic-bezier(.2,1.4,.4,1) both; transform-origin: 50% 25%; }
@keyframes kibRevealPop { 0% { opacity: 0; transform: scale(.55) translateY(18px); } 60% { opacity: 1; transform: scale(1.07); } 100% { transform: scale(1); } }
.kib-reveal-flash { background: radial-gradient(circle at 50% 28%, rgba(255,255,255,.85), rgba(110,231,183,.35) 25%, transparent 55%); animation: kibRevealFlash .8s ease-out both; pointer-events: none; }
@keyframes kibRevealFlash { 0% { opacity: 0; transform: scale(.4); } 25% { opacity: 1; } 100% { opacity: 0; transform: scale(1.6); } }
@media (prefers-reduced-motion: reduce) {
  .kib-scan-line, .kib-reveal-pop, .kib-reveal-flash { animation: none !important; }
  .kib-scan-dot { animation-duration: .01s; }
}
`;
