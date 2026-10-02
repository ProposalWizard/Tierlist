"use client";

/**
 * THE STAR PASS (Mikey, 2 Oct 2026) — opened from the star rating in the top
 * HUD. Laid out like Clash Royale's Trophy Road: a road you climb from level 1
 * at the bottom to level 100 at the top, with your progress up a rail on the
 * left and a reward platform at every 5th level (medium rewards on the 5s,
 * great rewards on the 10s), each centred on its level. The road changes look
 * every 20 levels (a painted floodlit pitch in that stretch's colours); level
 * 100 has its own golden stand.
 *
 * Art, all made in tools/star-pass-art/ → public/star/star-pass/: platforms,
 * boxes and the level-100 stand (render_star_pass.py), the gold header star
 * and the test rewards standing on their podiums (render_star_pass_items.py),
 * the backgrounds (make_backgrounds.py). Rewards are placeholders until Mikey
 * decides them (lib/star/starPassRewards.ts); 5, 10 and 15 hold design tests.
 * Star Points and gates are read from lib/star/starPoints.ts.
 *
 * Mikey's pass on the first version (1 Oct 2026): the header redone round a
 * gold star, no "Level N · Reward / Coming soon" labels (the rail already says
 * the level), each podium centred on its level, the rail's numbers in the
 * display font right beside the rail, and real backgrounds.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CareerState } from "@/lib/star/types";
import { starStatus, STAR_GATES, ledgerOf, starTitle, MAX_LEVEL } from "@/lib/star/starPoints";
import { REWARD_LEVELS, STAR_PASS_STEP, STAR_PASS_THEMES, rewardTier, themeFor } from "@/lib/star/starPassRewards";
import { findCard, type CatalogueItem } from "@/lib/star/rewardCatalogue";
import { usePassLayout } from "@/lib/star/starPassStore";
import { claimableLevels, claimLevel, equipCard, isClaimed } from "@/lib/star/starPassClaim";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { BottomBar, BarButton, Chev } from "./ui";
import Podium3D from "./Podium3D";
import RewardReveal from "./RewardReveal";
import LockerSheet from "./LockerSheet";

const ART = "/star/star-pass";
const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

/** Space per level on the road, in px. The five levels leading up to a great
 *  (10th) reward get more room, since its platform is bigger. */
const GAP = 46;
const GAP_GREAT = 60;
const ROAD_TOP = 210;    // room above level 100 for its stand
const ROAD_BOTTOM = 60;  // room below level 1
const RAIL_X = 50;
const HEADER_H = 92;
/** How far each stretch's background blends into the next, in px. */
const FADE = 130;

/** How tall a level's podium (and its reward) is drawn, in px. */
function stopHeight(level: number, card: CatalogueItem | undefined): number {
  const great = rewardTier(level) === "great";
  if (level === MAX_LEVEL) return 240 * (392 / 442);
  const a = card?.art;
  if (a?.live) return a.live.h;
  const plinthW = great ? 236 : 186;
  if (a?.scene) return (plinthW / (a.sceneFit ?? 1)) * (a.sceneAspect ?? 0.7);
  return great ? plinthW * (322 / 556) : plinthW * (217 / 468);
}

/** Height from the bottom of the road to every level. The five levels before
 *  a reward share out enough room for it and the one below it not to touch
 *  (a tall reward, like a footballer on his podium, gets more road). */
function buildY(cardAt: (n: number) => CatalogueItem | undefined): number[] {
  const y = [0, ROAD_BOTTOM];
  for (let i = 2; i <= MAX_LEVEL; i++) {
    const r = Math.ceil(i / 5) * 5;
    const base = r % 10 === 0 ? GAP_GREAT : GAP;
    const below = r - 5 >= STAR_PASS_STEP ? stopHeight(r - 5, cardAt(r - 5)) / 2 : 40;
    const need = (below + stopHeight(r, cardAt(r)) / 2 + 22) / 5;
    y[i] = y[i - 1] + Math.max(base, need);
  }
  return y;
}

export default function StarRatingSheet({ career, onClose, onCareer }: {
  career: CareerState;
  onClose: () => void;
  /** Saves a claimed reward / a Locker change into the career. */
  onCareer?: (c: CareerState) => void;
}) {
  const { layout, catalogue } = usePassLayout();
  const cardAt = (n: number) => findCard(layout.levels[n], catalogue);
  const Y = useMemo(() => buildY((n) => findCard(layout.levels[n], catalogue)), [layout, catalogue]);
  const yOf = (n: number) => Y[Math.max(1, Math.min(MAX_LEVEL, n))];
  const [reveal, setReveal] = useState<number | null>(null);
  const [locker, setLocker] = useState(false);
  const st = starStatus(career);
  const claimable = new Set(claimableLevels(career, layout.levels, st.stars));
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
  const digits = String(st.stars).length;

  return createPortal(
    <div data-star-pass className="fixed inset-0 z-[70] bg-[#05080f] text-white">
      {/* The road: level 1 at the bottom, 100 at the top. */}
      <div ref={scrollRef} data-star-road className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: "none", paddingBottom: 84 }}>
        <div className="relative mx-auto w-full max-w-md overflow-hidden" style={{ height: roadH }}>
          {/* Each stretch's look, a new one every 20 levels, blended into the next. */}
          {STAR_PASS_THEMES.map((t, i) => {
            const first = i === 0, last = t.to >= MAX_LEVEL;
            const bottom = first ? 0 : yOf(t.from) - FADE / 2;
            const top = last ? roadH : yOf(t.to) + FADE / 2;
            const mask = first
              ? `linear-gradient(0deg, #000 calc(100% - ${FADE}px), transparent 100%)`
              : last
                ? `linear-gradient(0deg, transparent 0, #000 ${FADE}px)`
                : `linear-gradient(0deg, transparent 0, #000 ${FADE}px, #000 calc(100% - ${FADE}px), transparent 100%)`;
            return (
              <div key={t.key} className="absolute inset-x-0" style={{
                bottom, height: top - bottom,
                backgroundImage: `url(${t.bg})`, backgroundSize: "cover", backgroundPosition: "center",
                maskImage: mask, WebkitMaskImage: mask,
              }} />
            );
          })}

          {/* The rail, filled up to you. */}
          <div className="absolute w-[8px] -translate-x-1/2 bg-black/60" style={{ left: RAIL_X, bottom: ROAD_BOTTOM, height: yOf(MAX_LEVEL) - ROAD_BOTTOM, borderRadius: 2, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }} />
          <div className="absolute w-[8px] -translate-x-1/2" style={{
            left: RAIL_X, bottom: ROAD_BOTTOM, height: Math.max(0, hereY - ROAD_BOTTOM), borderRadius: 2,
            background: "linear-gradient(0deg, #f59e0b, #fde047)", boxShadow: "0 0 12px rgba(251,191,36,.7)",
          }} />

          {/* A mark at every level; the number at 1 and every 5th, right beside the rail. */}
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => {
            const labelled = n === 1 || n % 5 === 0;
            const reached = n <= st.stars;
            return (
              <div key={n} className="absolute inset-x-0" style={{ bottom: yOf(n), height: 0 }}>
                <span className="absolute" style={{
                  left: RAIL_X, bottom: 0, width: labelled ? 11 : 4, height: labelled ? 11 : 4,
                  borderRadius: labelled ? 1 : 999,
                  transform: labelled ? "translate(-50%, 50%) rotate(45deg)" : "translate(-50%, 50%)",
                  background: reached ? "#fde047" : labelled ? "#ffffff" : "rgba(255,255,255,.6)",
                  boxShadow: labelled ? (reached ? "0 0 8px rgba(253,224,71,.9)" : "0 0 0 2px rgba(0,0,0,.45)") : undefined,
                }} />
                {labelled && (
                  <span className="absolute translate-y-1/2 text-right font-display text-[14px] font-black leading-none tabular-nums" style={{
                    left: 0, width: RAIL_X - 12, bottom: 0,
                    color: reached ? "#fde047" : "#ffffff", textShadow: "0 1px 2px #000, 0 0 6px rgba(0,0,0,.8)",
                  }}>
                    {n}
                  </span>
                )}
              </div>
            );
          })}

          {/* A closed gate: a padlock on the rail (what it needs shows in the header). */}
          {gates.filter(g => !g.isOpen).map((g) => (
            <div key={g.cap} className="absolute z-[5] grid h-[22px] w-[22px] -translate-x-1/2 translate-y-1/2 place-items-center text-[12px]" title={g.need}
              style={{ left: RAIL_X, bottom: (yOf(g.cap) + yOf(g.cap + 1)) / 2, borderRadius: 4, background: "#7f1d1d", boxShadow: "0 0 0 2px #f87171, 0 0 10px rgba(248,113,113,.6)" }}>
              🔒
            </div>
          ))}

          {/* A podium and a reward at every 5th level, centred on its level; level 100's stand. */}
          {REWARD_LEVELS.map((n) => (
            <RewardStop key={n} level={n} y={yOf(n)} card={cardAt(n)} reached={n <= st.stars} next={n === nextReward}
              claimable={claimable.has(n) && !!onCareer} claimed={isClaimed(career, n)} onClaim={() => setReveal(n)} />
          ))}

          {/* You. */}
          <div className="absolute z-10 -translate-x-1/2 translate-y-1/2" style={{ left: RAIL_X, bottom: hereY }}>
            <div className="h-[38px] w-[38px] overflow-hidden bg-gray-900" style={{ borderRadius: 4, boxShadow: "0 0 0 2px #fde047, 0 0 14px rgba(253,224,71,.8)" }}>
              <img src={face} alt="You" className="h-full w-full object-cover" draggable={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Where you are: a gold star with your level on it, laid over the top of the road. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20" style={{ height: HEADER_H + 44, background: "linear-gradient(180deg, rgba(4,6,12,.97) 0%, rgba(4,6,12,.9) 55%, rgba(4,6,12,0) 100%)" }} />
      <div className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-2" style={{ height: HEADER_H }}>
          <div className="relative grid h-[70px] w-[73px] shrink-0 place-items-center" style={{ filter: "drop-shadow(0 4px 10px rgba(251,191,36,.35))" }}>
            <img src={`${ART}/star-badge.webp`} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
            <span className="relative mt-[7px] font-display font-black leading-none tabular-nums text-white"
              style={{ fontSize: digits >= 3 ? 17 : digits === 2 ? 22 : 26, textShadow: "0 0 3px #5b3a00, 0 1px 0 #5b3a00, 0 2px 4px rgba(0,0,0,.7)" }}>
              {st.stars}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[23px] font-black uppercase leading-none tracking-[0.12em]" style={{
              background: "linear-gradient(180deg, #fff6c8 0%, #fde047 45%, #f59e0b 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              filter: "drop-shadow(0 1px 0 rgba(0,0,0,.6))",
            }}>Star Pass</div>
            <div className="mt-1.5 truncate text-[12px] font-black uppercase tracking-[0.16em] text-white">{starTitle(st.stars)}</div>
            {st.gate && <div className="mt-1 truncate text-[11px] font-black text-white">🔒 {st.gate.need}</div>}
          </div>
          <button onClick={() => setShowPoints(v => !v)} aria-label="Star Points"
            className="kib-press flex h-[44px] w-[44px] shrink-0 flex-col items-center justify-center" style={{
              borderRadius: 4, background: showPoints ? "linear-gradient(180deg, #fde047, #f59e0b)" : "rgba(255,255,255,.08)",
              boxShadow: "inset 0 0 0 1px rgba(253,224,71,.6)", color: showPoints ? "#111827" : "#fde047",
            }}>
            <span className="text-[15px] leading-none">★</span>
            <span className="mt-0.5 text-[9px] font-black uppercase leading-none tracking-wider">pts</span>
          </button>
        </div>
        <div className="mx-auto h-px w-full max-w-md" style={{ background: "linear-gradient(90deg, transparent, rgba(253,224,71,.85), transparent)" }} />
        {showPoints && (
          <div className="mx-auto mt-2 w-full max-w-md px-4">
            <div className="grid grid-cols-2 gap-px bg-black/60" style={{ borderRadius: 3, boxShadow: "0 8px 24px rgba(0,0,0,.6), inset 0 0 0 1px rgba(253,224,71,.35)" }}>
              <div className="col-span-2 flex items-center justify-between bg-[#0b0f1a] px-3 py-2 text-[12px] font-black uppercase tracking-widest text-amber-300">
                <span>Star Points</span><span className="tabular-nums">{fmt(st.total)}</span>
              </div>
              {rows.map(([label, n]) => (
                <div key={label} className="flex items-center justify-between bg-[#0b0f1a] px-3 py-1.5 text-[12.5px] font-black">
                  <span className="uppercase tracking-wide text-white">{label}</span><span className="tabular-nums">{fmt(n)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomBar cols="1fr 1fr">
        <BarButton icon={<Chev dir="left" size={16} className="text-amber-300" />} label="Back" onClick={onClose} />
        <BarButton icon="🎒" label="Locker" onClick={() => setLocker(true)} />
      </BottomBar>
      {locker && <LockerSheet career={career} catalogue={catalogue} onCareer={onCareer} onClose={() => setLocker(false)} />}
      {reveal != null && cardAt(reveal) && (
        <RewardReveal card={cardAt(reveal)!} level={reveal}
          onLater={() => { onCareer?.(claimLevel(career, reveal, cardAt(reveal), st.stars)); setReveal(null); }}
          onUse={() => { onCareer?.(equipCard(claimLevel(career, reveal, cardAt(reveal), st.stars), cardAt(reveal)!)); setReveal(null); }} />
      )}
    </div>,
    document.body,
  );
}

function RewardStop({ level, y, card, reached, next, claimable, claimed, onClaim }: {
  level: number; y: number; card: CatalogueItem | undefined; reached: boolean; next: boolean;
  claimable: boolean; claimed: boolean; onClaim: () => void;
}) {
  const tier = rewardTier(level);
  const great = tier === "great";
  const top = level === MAX_LEVEL;
  const theme = themeFor(level);
  const art = card?.art;
  const plinthW = top ? 240 : great ? 236 : 186;
  const scene = art?.scene;
  const plinth = top ? `${ART}/crown-100.webp` : `${ART}/plinth-${theme.key}-${tier}.webp`;
  const box = art?.image ?? `${ART}/box-${tier}.webp`;
  const boxW = great ? 84 : 62;
  const live = art?.live;
  // A scene picture is wider than its podium (room for a ball in flight); size
  // it so the podium itself matches the plain ones.
  const w = live ? live.w : scene ? plinthW / (art?.sceneFit ?? 1) : plinthW;
  const lit = reached || next;
  return (
    <>
      {/* A faint line from the rail out to the podium, so each one reads as its level's. */}
      <div className="absolute h-[2px] translate-y-1/2" style={{
        left: RAIL_X + 8, width: 150, bottom: y,
        background: `linear-gradient(90deg, ${reached ? "#fde047" : theme.accent}, transparent)`, opacity: lit ? 0.85 : 0.4,
      }} />
      <div className="absolute flex justify-center" style={{
        left: RAIL_X + 22, right: 8, bottom: y, transform: "translateY(50%)",
        filter: lit ? undefined : "saturate(.85) brightness(.85)",
      }}>
        <div className="relative shrink-0" style={{ width: w }}>
          {/* The glow round a reached podium, or the next one, in this stretch's colour (gold when there's something to claim). */}
          {lit && (
            <div className={`absolute inset-x-[10%] bottom-[4%] top-[35%] ${next || claimable ? "animate-pulse" : ""}`} style={{ background: `radial-gradient(closest-side, ${claimable ? "#fde047" : theme.accent}88, transparent)`, filter: "blur(12px)" }} />
          )}
          {live ? (
            <div className="relative"><Podium3D cfg={live} /></div>
          ) : (
            <img src={scene ?? plinth} alt={card?.name ?? ""} className="relative block w-full" draggable={false} />
          )}
          {!top && !scene && !live && (
            <img src={box} alt="" draggable={false} className={`absolute left-1/2 -translate-x-1/2 ${next || claimable ? "animate-bounce" : ""}`}
              style={{ width: boxW, bottom: great ? "52%" : "46%", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.55))", animationDuration: "1.6s" }} />
          )}
          {claimed && !top && (
            <span className="absolute grid h-6 w-6 place-items-center text-[13px] font-black text-gray-950" style={{ right: "6%", top: "8%", borderRadius: 4, background: "#4ade80", boxShadow: "0 0 10px rgba(74,222,128,.8)" }}>✓</span>
          )}
          {claimable && (
            <button onClick={onClaim} data-claim={level} className="kib-press absolute bottom-[2%] left-1/2 z-[6] h-[38px] -translate-x-1/2 px-5 text-[14px] font-black uppercase tracking-[0.18em] text-gray-950" style={{
              borderRadius: 3, background: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "0 0 18px rgba(251,191,36,.75), inset 0 1px 0 rgba(255,255,255,.6)",
            }}>Claim</button>
          )}
        </div>
      </div>
    </>
  );
}
