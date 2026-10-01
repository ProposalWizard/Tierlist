"use client";

/**
 * BREAKING NEWS — its own full-screen page, a TV news moment.
 *
 * Harry, 1 Oct 2026 (v0.23): "the breaking news should be its own page with
 * the top and bottom breaking news animated more like in the old UI style.
 * Some stuff should be a bit more clean, and some stuff a bit more not clean."
 *
 * Clean: the type, the layout, the crisp red/white/black bands.
 * Not clean: the skewed bands, the tilted headline strip with a torn edge, the
 * scan-lines and grain, the blinking LIVE tag — a broadcast, not a card.
 *
 * Still short (P28, "not spoon-fed too much"): a headline, one line, a
 * picture, tap to continue. Tapping is ignored for the first half-second so
 * the band slide-in is seen and a stray tap from the screen before can't skip it.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Anton } from "next/font/google";
import ClubBadge from "./ClubBadge";
import { kitsOf } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import type { BreakingNews as News } from "@/lib/star/breakingNews";
import { sfx } from "@/lib/star/sfx";

const anton = Anton({ subsets: ["latin"], weight: "400", display: "swap" });

const CSS = `
@keyframes bn-band-in { from { transform: translateX(-110%) skewX(-8deg); } to { transform: translateX(0) skewX(-8deg); } }
@keyframes bn-tick-in { from { transform: translateY(120%); } to { transform: translateY(0); } }
@keyframes bn-tick-run { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes bn-card-in { 0% { transform: translateX(120%) rotate(4deg); opacity: 0; } 70% { transform: translateX(-3%) rotate(-2.4deg); opacity: 1; } 100% { transform: translateX(0) rotate(-1.6deg); opacity: 1; } }
@keyframes bn-pic-in { 0% { transform: scale(.4) rotate(-10deg); opacity: 0; } 70% { transform: scale(1.06) rotate(2deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes bn-line-in { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes bn-blink { 0%, 55% { opacity: 1; } 56%, 100% { opacity: .25; } }
@keyframes bn-flash { 0% { opacity: .85; } 100% { opacity: 0; } }
@keyframes bn-sweep { from { transform: translateX(-130%) skewX(-20deg); } to { transform: translateX(330%) skewX(-20deg); } }
@keyframes bn-tap { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .bn * { animation-duration: .01s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; } }
`;

export default function BreakingNews({ news, onClose }: { news: News; onClose: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), 600); return () => clearTimeout(t); }, []);
  useEffect(() => { sfx("breaking-news"); }, []);
  if (typeof document === "undefined") return null;

  const kit = news.club ? kitsOf(news.club).home : undefined;
  const tint = kit?.shirt ?? "#1d4ed8";
  const ticker = `BREAKING NEWS  •  ${news.headline}  •  ${news.line}  •  `;

  return createPortal(
    <div
      className={`bn ${anton.className} fixed inset-0 z-[92] flex cursor-pointer select-none flex-col overflow-hidden text-white`}
      style={{ background: "#05070d" }}
      onClick={() => armed && onClose()}
      role="button"
      aria-label="Continue"
    >
      <style>{CSS}</style>

      {/* ground: the club's colour wash on night, grain and scan-lines on top */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(120% 70% at 50% 42%, ${tint}66 0%, #0a0f1c 55%, #04060b 100%)` }} />
      <div className="absolute inset-0 opacity-[.18]" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.5) 0 1px, transparent 1px 4px)" }} />
      <div className="absolute inset-0 opacity-[.5]" style={{ backgroundImage: "repeating-linear-gradient(115deg, transparent 0 22px, rgba(255,255,255,.035) 22px 44px)" }} />
      {/* the camera flash as the page cuts in */}
      <div className="pointer-events-none absolute inset-0 bg-white" style={{ animation: "bn-flash .5s ease-out forwards" }} />

      {/* ── TOP BAND ── slides in from the left, a little crooked ── */}
      <div className="relative z-10 pt-[max(12px,env(safe-area-inset-top))]">
        <div className="relative mr-6 overflow-hidden bg-red-600" style={{ animation: "bn-band-in .45s cubic-bezier(.2,.9,.25,1) both", boxShadow: "0 6px 0 #fff, 0 10px 24px rgba(0,0,0,.6)", marginLeft: "-14px" }}>
          <div className="flex items-center gap-3 py-2.5 pl-8 pr-6" style={{ transform: "skewX(8deg)" }}>
            <span className="inline-block h-3 w-3 rounded-full bg-white" style={{ animation: "bn-blink 1s steps(1) infinite" }} />
            <span className="text-[34px] leading-none tracking-[0.06em]">BREAKING NEWS</span>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-white/70" style={{ animation: "bn-sweep 1.4s .5s ease-in-out both" }} />
        </div>
        <div className="mt-3 flex items-center justify-between px-5 text-[13px] tracking-[0.2em] text-white/80" style={{ animation: "bn-line-in .4s .35s both" }}>
          <span className="bg-white px-2 py-0.5 text-black" style={{ animation: "bn-blink 1.2s steps(1) infinite" }}>LIVE</span>
          <span>KNOWITBALL NEWS 24</span>
        </div>
      </div>

      {/* ── MIDDLE ── the picture, the headline strip, the one line ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-5">
        {(news.face || news.club) && (
          <div className="relative flex items-center justify-center" style={{ animation: "bn-pic-in .5s .25s cubic-bezier(.2,.9,.25,1) both" }}>
            {news.face && (
              <div className="h-[136px] w-[136px] overflow-hidden rounded-full" style={{ border: "4px solid #fff", boxShadow: `0 0 0 4px ${tint}, 0 14px 30px rgba(0,0,0,.7)`, background: "#111827" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={news.face} alt="" className="h-full w-full object-cover" draggable={false} />
              </div>
            )}
            {news.club && (
              <div className={news.face ? "absolute -bottom-3 -right-8 rounded-full bg-[#05070d] p-1" : "rounded-full bg-[#05070d] p-1"} style={{ boxShadow: "0 0 0 3px #fff" }}>
                <ClubBadge club={news.club} kit={kit} size={news.face ? 52 : 96} />
              </div>
            )}
          </div>
        )}

        {/* the headline strip: white, tilted, torn at the foot */}
        <div className="w-full max-w-[380px]" style={{ animation: "bn-card-in .6s .45s cubic-bezier(.2,.9,.25,1) both" }}>
          <div className="bg-white px-4 pb-5 pt-3 text-black" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 94% 97%, 88% 91%, 80% 98%, 71% 92%, 62% 97%, 52% 91%, 44% 98%, 33% 92%, 24% 97%, 14% 91%, 6% 97%, 0 92%)", boxShadow: "0 0 0 0 #000" }}>
            <div className="text-[40px] uppercase leading-[1.02] tracking-[0.01em]">{news.headline}</div>
            <div className="mt-2 h-[5px] w-24 bg-red-600" />
          </div>
        </div>

        <div className="max-w-[340px] text-center font-sans text-[16px] font-bold leading-snug text-white" style={{ animation: "bn-line-in .45s 1s both", textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>
          {news.line}
        </div>
      </div>

      {/* ── BOTTOM: tap hint above a scrolling ticker ── */}
      <div className="relative z-10">
        <div className="pb-2 text-center font-sans text-[12px] font-black uppercase tracking-[0.3em] text-white" style={{ animation: armed ? "bn-tap 1.4s ease-in-out infinite" : undefined, opacity: armed ? undefined : 0 }}>
          Tap to continue
        </div>
        <div className="flex items-stretch overflow-hidden pb-[max(0px,env(safe-area-inset-bottom))]" style={{ animation: "bn-tick-in .45s .1s cubic-bezier(.2,.9,.25,1) both", background: "#000", boxShadow: "0 -4px 0 #fff, 0 -8px 0 #dc2626" }}>
          <div className="z-10 grid shrink-0 place-items-center bg-red-600 px-4 text-[20px] tracking-[0.08em]">{shortClub(news.club ?? "NEWS").toUpperCase().slice(0, 14)}</div>
          <div className="relative flex-1 overflow-hidden py-3 text-[20px] tracking-[0.05em] text-white">
            <div className="flex w-max whitespace-nowrap" style={{ animation: "bn-tick-run 14s linear infinite" }}>
              <span>{ticker.repeat(3)}</span>
              <span>{ticker.repeat(3)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
