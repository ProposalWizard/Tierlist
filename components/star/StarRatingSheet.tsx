"use client";

/**
 * THE STAR PASS (Mikey, 2 Oct 2026) — opened from the star rating in the top
 * HUD. Laid out like Clash Royale's Trophy Road: a road you climb from level 1
 * at the bottom to level 100 at the top, with your progress up a rail on the
 * left and a reward platform at every 5th level (medium rewards on the 5s,
 * great rewards on the 10s). The road changes look every 20 levels; the top
 * stretch is royal gold and level 100 has its own golden stand.
 *
 * The platforms, reward boxes and the level-100 stand are rendered in Blender
 * (tools/star-pass-art/render_star_pass.py → public/star/star-pass/). The
 * rewards themselves are placeholders until Mikey decides them
 * (lib/star/starPassRewards.ts). Star Points and gates are read from
 * lib/star/starPoints.ts exactly as before.
 *
 * Replaced Harry's sideways strip of level cards (1 Oct 2026, P11), which also
 * showed the Style items each level opens; that unlock still happens
 * (lib/star/unlocks.ts) but is no longer pictured here.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CareerState } from "@/lib/star/types";
import { starStatus, STAR_GATES, ledgerOf, starTitle, MAX_LEVEL } from "@/lib/star/starPoints";
import { REWARD_LEVELS, STAR_PASS_REWARDS, STAR_PASS_THEMES, rewardTier, themeFor } from "@/lib/star/starPassRewards";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { SquareBar, BottomBar, BarButton, Chev } from "./ui";

const ART = "/star/star-pass";
const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

/** Space per level on the road, in px. The five levels leading up to a great
 *  (10th) reward get more room, since its platform is bigger. */
const GAP = 46;
const GAP_GREAT = 60;
const ROAD_TOP = 320;    // room above level 100 for its stand
const ROAD_BOTTOM = 60;  // room below level 1
const RAIL_X = 34;

/** Height from the bottom of the road to level n. */
function yOf(n: number): number {
  let y = ROAD_BOTTOM;
  for (let i = 2; i <= n; i++) y += (Math.ceil(i / 5) * 5) % 10 === 0 ? GAP_GREAT : GAP;
  return y;
}

export default function StarRatingSheet({ career, onClose }: { career: CareerState; onClose: () => void }) {
  const st = starStatus(career);
  const led = ledgerOf(career);
  const [showPoints, setShowPoints] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const roadH = yOf(MAX_LEVEL) + ROAD_TOP;
  // Where your marker sits: your level, plus the way to the next one.
  const lv = Math.min(MAX_LEVEL, st.stars);
  const frac = lv < MAX_LEVEL && !st.gate ? Math.max(0, Math.min(1, st.toNext)) : 0;
  const hereY = yOf(lv) + frac * (yOf(Math.min(MAX_LEVEL, lv + 1)) - yOf(lv));
  const face = career.player.portrait ?? DEFAULT_FAKE_FACE;
  const gates = useMemo(() => STAR_GATES.map(g => ({ ...g, isOpen: g.open(career, led) })), [career, led]);

  useEffect(() => setMounted(true), []);
  // Open on you: your marker a little below the middle of the screen.
  useEffect(() => {
    const el = scrollRef.current;
    if (!mounted || !el) return;
    el.scrollTop = Math.max(0, roadH - hereY - el.clientHeight * 0.6);
  }, [mounted, roadH, hereY]);
  if (!mounted) return null;

  const rows: [string, number][] = [
    ["Matches", st.points.match], ["Trophies", st.points.trophies], ["Awards", st.points.awards],
    ["Milestones", st.points.milestones], ["Fame", st.points.status],
    ...(st.carry > 0 ? [["Carried", st.carry] as [string, number]] : []),
  ];
  const nextReward = REWARD_LEVELS.find(n => n > st.stars);

  return createPortal(
    <div data-star-pass className="fixed inset-0 z-[70] flex flex-col bg-[#05080f] text-white">
      {/* Where you are. */}
      <div className="relative z-10 mx-auto w-full max-w-md px-3 pb-2 pt-3">
        <div className="flex items-center gap-3">
          <div className="flex h-[54px] shrink-0 items-center gap-1 px-2.5 text-gray-950" style={{ background: "linear-gradient(180deg, #fde047, #f59e0b)", borderRadius: 2, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5), 0 0 18px rgba(251,191,36,.45)" }}>
            <span className="text-[22px] leading-none">★</span>
            <span className="text-[38px] font-black leading-none tabular-nums">{st.stars}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="truncate text-[18px] font-black uppercase leading-none tracking-wide">Star Pass</div>
              <button onClick={() => setShowPoints(v => !v)} className="kib-press shrink-0 text-[11px] font-black uppercase tracking-wider text-amber-300">
                {showPoints ? "Hide points" : "Star Points"}
              </button>
            </div>
            <div className="mt-1 truncate text-[12px] font-black uppercase tracking-wide text-white">{starTitle(st.stars)}</div>
            <SquareBar value={Math.max(3, st.toNext * 100)} colors={["#f59e0b", "#fde047"]} className="mt-1.5 h-[14px]" animate>
              {st.stars >= MAX_LEVEL ? "MAX" : st.gate ? "🔒" : null}
            </SquareBar>
          </div>
        </div>
        {(nextReward || st.gate) && (
          <div className="mt-1.5 text-[12px] font-black text-white">
            {nextReward && <>Next reward at level <span className="text-amber-300">{nextReward}</span></>}
            {st.gate && <>{nextReward ? " · " : ""}🔒 {st.gate.need}</>}
          </div>
        )}
        {showPoints && (
          <div className="mt-2 grid grid-cols-2 gap-px bg-black/50" style={{ borderRadius: 2 }}>
            <div className="col-span-2 flex items-center justify-between bg-white/[0.07] px-2.5 py-1.5 text-[12px] font-black uppercase tracking-widest text-amber-300">
              <span>Star Points</span><span className="tabular-nums">{fmt(st.total)}</span>
            </div>
            {rows.map(([label, n]) => (
              <div key={label} className="flex items-center justify-between bg-white/[0.07] px-2.5 py-1.5 text-[12.5px] font-black">
                <span className="uppercase tracking-wide text-white">{label}</span><span className="tabular-nums">{fmt(n)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The road: level 1 at the bottom, 100 at the top. */}
      <div ref={scrollRef} data-star-road className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", paddingBottom: 84 }}>
        <div className="relative mx-auto w-full max-w-md overflow-hidden" style={{ height: roadH }}>
          {/* Each stretch's look, a new one every 20 levels, blended into the next. */}
          {STAR_PASS_THEMES.map((t, i) => {
            const bottom = i === 0 ? 0 : yOf(t.from) - GAP;
            const top = t.to >= MAX_LEVEL ? roadH : yOf(t.to) + GAP;
            const fade = "linear-gradient(0deg, transparent 0, #000 60px, #000 calc(100% - 60px), transparent 100%)";
            return (
              <div key={t.key} className="absolute inset-x-0" style={{
                bottom, height: top - bottom, background: t.bg,
                maskImage: i === 0 ? undefined : fade, WebkitMaskImage: i === 0 ? undefined : fade,
              }} />
            );
          })}

          {/* The rail, filled up to you. */}
          <div className="absolute w-[8px] -translate-x-1/2 bg-black/55" style={{ left: RAIL_X, bottom: ROAD_BOTTOM, height: yOf(MAX_LEVEL) - ROAD_BOTTOM, borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18)" }} />
          <div className="absolute w-[8px] -translate-x-1/2" style={{
            left: RAIL_X, bottom: ROAD_BOTTOM, height: Math.max(0, hereY - ROAD_BOTTOM), borderRadius: 2,
            background: "linear-gradient(0deg, #f59e0b, #fde047)", boxShadow: "0 0 12px rgba(251,191,36,.7)",
          }} />

          {/* A mark at every level; the number at 1 and every 5th. */}
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => {
            const labelled = n === 1 || n % 5 === 0;
            const reached = n <= st.stars;
            return (
              <div key={n} className="absolute" style={{ left: 0, width: RAIL_X * 2, bottom: yOf(n), height: 0 }}>
                <span className="absolute -translate-x-1/2 translate-y-1/2" style={{
                  left: RAIL_X, bottom: 0, width: labelled ? 14 : 6, height: labelled ? 14 : 6, borderRadius: labelled ? 3 : 999,
                  background: reached ? "#fde047" : "rgba(255,255,255,.4)",
                  boxShadow: reached && labelled ? "0 0 8px rgba(253,224,71,.8)" : undefined,
                }} />
                {labelled && (
                  <span className="absolute translate-y-1/2 text-[12px] font-black tabular-nums" style={{ left: 2, bottom: 0, color: reached ? "#fde047" : "#ffffff", textShadow: "0 1px 3px rgba(0,0,0,.9)" }}>
                    {n}
                  </span>
                )}
              </div>
            );
          })}

          {/* A closed gate: a padlock on the rail (what it needs is in the header). */}
          {gates.filter(g => !g.isOpen).map((g) => (
            <div key={g.cap} className="absolute z-[5] grid h-[22px] w-[22px] -translate-x-1/2 translate-y-1/2 place-items-center text-[12px]" title={g.need}
              style={{ left: RAIL_X, bottom: (yOf(g.cap) + yOf(g.cap + 1)) / 2, borderRadius: 4, background: "#7f1d1d", boxShadow: "0 0 0 2px #f87171, 0 0 10px rgba(248,113,113,.6)" }}>
              🔒
            </div>
          ))}

          {/* A platform and a reward at every 5th level; level 100's stand. */}
          {REWARD_LEVELS.map((n) => <RewardStop key={n} level={n} reached={n <= st.stars} next={n === nextReward} />)}

          {/* You. */}
          <div className="absolute z-10 -translate-x-1/2 translate-y-1/2" style={{ left: RAIL_X, bottom: hereY }}>
            <div className="h-[38px] w-[38px] overflow-hidden bg-gray-900" style={{ borderRadius: 4, boxShadow: "0 0 0 2px #fde047, 0 0 14px rgba(253,224,71,.8)" }}>
              <img src={face} alt="You" className="h-full w-full object-cover" draggable={false} />
            </div>
          </div>
        </div>
      </div>

      <BottomBar cols="1fr">
        <BarButton icon={<Chev dir="left" size={16} className="text-amber-300" />} label="Back" onClick={onClose} />
      </BottomBar>
    </div>,
    document.body,
  );
}

function RewardStop({ level, reached, next }: { level: number; reached: boolean; next: boolean }) {
  const tier = rewardTier(level);
  const great = tier === "great";
  const top = level === MAX_LEVEL;
  const theme = themeFor(level);
  const reward = STAR_PASS_REWARDS[level];
  const plinthW = top ? 240 : great ? 236 : 186;
  const plinth = top ? `${ART}/crown-100.webp` : `${ART}/plinth-${theme.key}-${tier}.webp`;
  const box = reward?.image ?? `${ART}/box-${tier}.webp`;
  const boxW = great ? 84 : 62;
  const gold = great || top;
  return (
    <div className="absolute flex flex-col items-center" style={{
      left: RAIL_X + 22, right: 8, bottom: yOf(level), transform: `translateY(${top ? 22 : 40}%)`,
      filter: reached || next ? undefined : "saturate(.55) brightness(.6)",
    }}>
      <div className="relative" style={{ width: plinthW }}>
        {/* The glow round a reached platform, or the next one, in this stretch's colour. */}
        {(reached || next) && (
          <div className={`absolute inset-x-[6%] bottom-[6%] top-[28%] ${next ? "animate-pulse" : ""}`} style={{ background: `radial-gradient(closest-side, ${theme.accent}99, transparent)`, filter: "blur(10px)" }} />
        )}
        <img src={plinth} alt="" className="relative block w-full" draggable={false} />
        {!top && (
          <img src={box} alt="" draggable={false} className={`absolute left-1/2 -translate-x-1/2 ${next ? "animate-bounce" : ""}`}
            style={{ width: boxW, bottom: great ? "52%" : "46%", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.55))", animationDuration: "1.6s" }} />
        )}
        {reached && !top && (
          <span className="absolute grid h-6 w-6 place-items-center text-[13px] font-black text-gray-950" style={{ right: great ? "20%" : "18%", top: great ? "2%" : "-4%", borderRadius: 4, background: "#4ade80", boxShadow: "0 0 10px rgba(74,222,128,.8)" }}>✓</span>
        )}
      </div>
      <div className="-mt-1 flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider" style={{
        borderRadius: 2,
        background: gold ? "linear-gradient(180deg, #fde047, #f59e0b)" : "rgba(0,0,0,.65)",
        color: gold ? "#111827" : "#ffffff",
        boxShadow: gold ? "0 0 12px rgba(251,191,36,.5)" : `inset 0 0 0 1px ${theme.accent}`,
      }}>
        <span>Level {level}</span>
        <span>·</span>
        <span className="normal-case tracking-normal">{reward?.name ?? (top ? "The final reward" : great ? "Great reward" : "Reward")}</span>
      </div>
      {!reward && <div className="mt-0.5 text-[10.5px] font-black text-white" style={{ textShadow: "0 1px 3px #000" }}>Coming soon</div>}
    </div>
  );
}
