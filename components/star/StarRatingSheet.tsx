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
import { STAR_PASS_THEMES, rewardLevelsOf, rewardTier, themeFor } from "@/lib/star/starPassRewards";
import { findCard, SLOT_LABEL, type CatalogueItem } from "@/lib/star/rewardCatalogue";
import { ACCESSORIES } from "@/lib/star/store/catalogue";
import { usePassLayout } from "@/lib/star/starPassStore";
import { claimableLevels, claimLevel, equipCard, isClaimed } from "@/lib/star/starPassClaim";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import Podium3D from "./Podium3D";
import RewardArt from "./RewardArt";
import RewardReveal from "./RewardReveal";
import { SignatureContext } from "./store/AccessoryFigure";
import { signatureOf } from "@/lib/star/signatureBoots";
import LockerSheet from "./LockerSheet";

const ART = "/star/star-pass";
const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

/** The least road per level, in px (levels with no reward between two that
 *  have one share out the room the two need). */
const GAP = 30;
/** Every reward gets the same box (Mikey, 28 Oct 2026: "consistent … the big
 *  rewards every 10 levels are bigger"): one height for the medium rewards,
 *  a bigger one for the great (10th) ones; a tall picture is shrunk to fit. */
const SLOT_MEDIUM = 178;
const SLOT_GREAT = 226;
const SLOT_TOP = 250;
const PLINTH_MEDIUM = 196;
const PLINTH_GREAT = 246;
/** Room between one reward's box and the next. */
const SLOT_GAP = 14;
/** The widest a picture may be beside the rail. */
const MAX_W = 360;
const ROAD_TOP = 210;    // room above level 100 for its stand
const ROAD_BOTTOM = 60;  // room below level 1
const RAIL_X = 50;
const HEADER_H = 92;
/** How far each stretch's background blends into the next, in px. */
const FADE = 130;

/** How tall a level's box is drawn, in px: the same for every medium reward,
 *  bigger for the great ones. */
function stopHeight(level: number): number {
  if (level === MAX_LEVEL) return SLOT_TOP;
  return rewardTier(level) === "great" ? SLOT_GREAT : SLOT_MEDIUM;
}

/** Height from the bottom of the road to every level. The levels between two
 *  rewards share out enough room for both boxes not to touch. Rewards can sit
 *  at any level (5 Oct 2026), so the room is shared over however many levels
 *  lie between them. */
function buildY(stops: number[]): number[] {
  const y = [0, ROAD_BOTTOM];
  if (stops[0] === 1) y[1] = Math.max(ROAD_BOTTOM, stopHeight(1) / 2 + 14);
  for (let i = 2; i <= MAX_LEVEL; i++) {
    const r = stops.find((n) => n >= i) ?? MAX_LEVEL;
    const prev = [...stops].reverse().find((n) => n < i);
    const span = r - (prev ?? 1);
    const below = prev != null ? stopHeight(prev) / 2 : 40;
    const need = (below + stopHeight(r) / 2 + SLOT_GAP) / Math.max(1, span);
    y[i] = y[i - 1] + Math.max(GAP, need);
  }
  return y;
}

export default function StarRatingSheet({ career, onClose, onCareer, bar }: {
  career: CareerState;
  onClose: () => void;
  /** Saves a claimed reward / a Locker change into the career. */
  onCareer?: (c: CareerState) => void;
  /** The game's own bottom bar (Mikey, 28 Oct 2026: "it should be obviously the
   *  same bottom bar"); given `close`, so any button on it shuts the pass first.
   *  Without it (a test page) a ✕ at the top shuts it. */
  bar?: (close: () => void) => React.ReactNode;
}) {
  const { layout, catalogue } = usePassLayout();
  const cardAt = (n: number) => findCard(layout.levels[n], catalogue);
  const stops = useMemo(() => rewardLevelsOf(layout.levels), [layout]);
  const Y = useMemo(() => buildY(stops), [stops]);
  const yOf = (n: number) => Y[Math.max(1, Math.min(MAX_LEVEL, n))];
  const [reveal, setReveal] = useState<number | null>(null);
  const [locker, setLocker] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
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
  const nextReward = stops.find(n => n > st.stars);
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

          {/* A mark at every level; the number only where there is a reward (and 1
              and 100), right beside the rail (Mikey, 28 Oct 2026: 45 and 55 had
              a number and nothing beside them). */}
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => {
            const labelled = n === 1 || n === MAX_LEVEL || stops.includes(n);
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

          {/* A podium and a reward at every level that has one, centred on its level; level 100's stand. */}
          {stops.map((n) => (
            <RewardStop key={n} level={n} y={yOf(n)} card={cardAt(n)} reached={n <= st.stars} next={n === nextReward}
              claimable={claimable.has(n) && !!onCareer} claimed={isClaimed(career, n)} onClaim={() => setReveal(n)} onOpen={() => setPreview(n)} />
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
          {/* The Locker lives up here now (Mikey, 28 Oct 2026); the bottom is the game's own bar. */}
          <button onClick={() => setLocker(true)} aria-label="Locker" data-locker-open
            className="kib-press flex h-[44px] w-[44px] shrink-0 flex-col items-center justify-center" style={{
              borderRadius: 4, background: "rgba(255,255,255,.08)", boxShadow: "inset 0 0 0 1px rgba(253,224,71,.6)", color: "#fde047",
            }}>
            <span className="text-[15px] leading-none">🎒</span>
            <span className="mt-0.5 text-[9px] font-black uppercase leading-none tracking-wider">Locker</span>
          </button>
          <button onClick={() => setShowPoints(v => !v)} aria-label="Star Points"
            className="kib-press flex h-[44px] w-[44px] shrink-0 flex-col items-center justify-center" style={{
              borderRadius: 4, background: showPoints ? "linear-gradient(180deg, #fde047, #f59e0b)" : "rgba(255,255,255,.08)",
              boxShadow: "inset 0 0 0 1px rgba(253,224,71,.6)", color: showPoints ? "#111827" : "#fde047",
            }}>
            <span className="text-[15px] leading-none">★</span>
            <span className="mt-0.5 text-[9px] font-black uppercase leading-none tracking-wider">pts</span>
          </button>
          {!bar && (
            <button onClick={onClose} aria-label="Close" className="kib-press grid h-[44px] w-[36px] shrink-0 place-items-center text-[18px] font-black text-white" style={{ borderRadius: 4, background: "rgba(255,255,255,.08)" }}>✕</button>
          )}
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

      {bar && (
        <div className="absolute inset-x-0 bottom-0 z-40" data-star-pass-bar>
          <div className="mx-auto w-full max-w-md">{bar(onClose)}</div>
        </div>
      )}
      {preview != null && cardAt(preview) && (
        <SignatureContext.Provider value={signatureOf(career)}>
          <RewardPreview card={cardAt(preview)!} level={preview} reached={preview <= st.stars}
            claimed={isClaimed(career, preview)} claimable={claimable.has(preview) && !!onCareer}
            onClaim={() => { setPreview(null); setReveal(preview); }} onClose={() => setPreview(null)} />
        </SignatureContext.Provider>
      )}
      {locker && <LockerSheet career={career} catalogue={catalogue} onCareer={onCareer} onClose={() => setLocker(false)} />}
      {reveal != null && cardAt(reveal) && (
        // Signature Boots show your own name and number on the reveal too.
        <SignatureContext.Provider value={signatureOf(career)}>
          <RewardReveal card={cardAt(reveal)!} level={reveal}
            onLater={() => { onCareer?.(claimLevel(career, reveal, cardAt(reveal), st.stars)); setReveal(null); }}
            onUse={() => { onCareer?.(equipCard(claimLevel(career, reveal, cardAt(reveal), st.stars), cardAt(reveal)!)); setReveal(null); }} />
        </SignatureContext.Provider>
      )}
    </div>,
    document.body,
  );
}

function RewardStop({ level, y, card, reached, next, claimable, claimed, onClaim, onOpen }: {
  level: number; y: number; card: CatalogueItem | undefined; reached: boolean; next: boolean;
  claimable: boolean; claimed: boolean; onClaim: () => void; onOpen: () => void;
}) {
  const tier = rewardTier(level);
  const great = tier === "great";
  const top = level === MAX_LEVEL;
  const theme = themeFor(level);
  const art = card?.art;
  const plinthW = top ? 240 : great ? PLINTH_GREAT : PLINTH_MEDIUM;
  // The road shows stills only: live 3D is for the tap-to-preview (it lagged here).
  const scene = art?.scene;
  const plinth = top ? `${ART}/crown-100.webp` : `${ART}/plinth-${theme.key}-${tier}.webp`;
  const box = art?.image ?? `${ART}/box-${tier}.webp`;
  const boxW = great ? 92 : 70;
  // A scene picture is wider than its podium (room for a ball in flight): size
  // it so the podium itself matches the plain ones, then shrink the whole
  // picture if it is too tall for the box.
  const slotH = stopHeight(level);
  const aspect = scene ? art?.sceneAspect ?? 0.7 : top ? 392 / 442 : great ? 322 / 556 : 217 / 468;
  let w = scene ? plinthW / (art?.sceneFit ?? 1) : plinthW;
  w *= Math.min(1, slotH / (w * aspect), MAX_W / w);
  const lit = reached || next;
  return (
    <>
      {/* A faint line from the rail out to the podium, so each one reads as its level's. */}
      <div className="absolute h-[2px] translate-y-1/2" style={{
        left: RAIL_X + 8, width: 150, bottom: y,
        background: `linear-gradient(90deg, ${reached ? "#fde047" : theme.accent}, transparent)`, opacity: lit ? 0.85 : 0.4,
      }} />
      <div className="absolute flex items-end justify-center" style={{
        left: RAIL_X + 22, right: 8, bottom: y, height: slotH, transform: "translateY(50%)",
        filter: lit ? undefined : "saturate(.85) brightness(.85)",
      }}>
        <div className="relative shrink-0" style={{ width: w }} data-reward-stop={level}>
          {/* The glow round a reached podium, or the next one, in this stretch's colour (gold when there's something to claim). */}
          {lit && (
            <div className={`absolute inset-x-[10%] bottom-[4%] top-[35%] ${next || claimable ? "animate-pulse" : ""}`} style={{ background: `radial-gradient(closest-side, ${claimable ? "#fde047" : theme.accent}88, transparent)`, filter: "blur(12px)" }} />
          )}
          {/* Tap it to see it big and spin it. */}
          <button type="button" onClick={onOpen} aria-label={card ? `See ${card.name}` : `Level ${level}`} data-reward-open={level} className="kib-press relative block w-full">
            <img src={scene ?? plinth} alt={card?.name ?? ""} className="relative block w-full" draggable={false} />
            {!top && !scene && (
              <img src={box} alt="" draggable={false} className={`absolute left-1/2 -translate-x-1/2 ${next || claimable ? "animate-bounce" : ""}`}
                style={{ width: boxW, bottom: great ? "52%" : "46%", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.55))", animationDuration: "1.6s" }} />
            )}
          </button>
          {claimed && !top && (
            <span className="pointer-events-none absolute grid h-6 w-6 place-items-center text-[13px] font-black text-gray-950" style={{ right: "6%", top: "8%", borderRadius: 4, background: "#4ade80", boxShadow: "0 0 10px rgba(74,222,128,.8)" }}>✓</span>
          )}
          {/* On the road but not made yet (a celebration or run-up still needs its animation). */}
          {card?.comingSoon && !claimed && !top && (
            <span data-soon={level} className="pointer-events-none absolute bottom-[2%] left-1/2 z-[6] -translate-x-1/2 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white" style={{
              borderRadius: 3, background: "rgba(15,23,42,.85)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)",
            }}>Soon</span>
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

/** What owning a card does, in a line (the tap-to-preview). */
function whatItDoes(card: CatalogueItem): string {
  const g = card.grant;
  if (g.kind === "penaltyRunup") return "A penalty run-up. Pick it in the Locker and you use it on every penalty you take.";
  if (g.kind === "freeKickRunup") return "A free-kick run-up. Pick it in the Locker and you use it on every free kick you take.";
  if (g.kind === "collectible") return `Yours to keep in the Locker, as your ${SLOT_LABEL[g.slot].toLowerCase()}.`;
  const slot = ACCESSORIES.find((a) => a.id === g.id)?.slot;
  if (slot === "celebration") return "A goal celebration. Pick it in the Locker and you do it when you score.";
  if (slot === "boots") return "Boots. Pick them in the Locker and your player wears them in every match.";
  return "Kit. Pick it in the Locker and your player wears it in every match.";
}

/**
 * TAP A REWARD TO SEE IT (Mikey, 28 Oct 2026: "tap it and see a zoomed-in
 * version that you can spin, and it tells you what it does"). The reward's 3D
 * model on its podium, big, that you drag round; then what it does and how to
 * get it. One 3D canvas at a time, and only while this is open.
 */
function RewardPreview({ card, level, reached, claimed, claimable, onClaim, onClose }: {
  card: CatalogueItem; level: number; reached: boolean; claimed: boolean; claimable: boolean;
  onClaim: () => void; onClose: () => void;
}) {
  const vw = typeof window === "undefined" ? 390 : window.innerWidth;
  const w = Math.min(360, vw - 32);
  const h = Math.round(w * 1.08);
  const a = card.art;
  const live = a.live ?? a.spin;
  const k = a.live ? Math.min(w / a.live.w, h / a.live.h) : 1;
  const cfg = live ? (a.live ? { ...a.live, w: Math.round(a.live.w * k), h: Math.round(a.live.h * k) } : { ...live, w, h }) : null;
  const theme = themeFor(level);
  return (
    <div data-reward-preview={level} className="fixed inset-0 z-[80] flex flex-col items-center overflow-y-auto bg-[#05080f]/95 px-4 pb-8 pt-4 text-white" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: theme.accent }}>Level {level}{rewardTier(level) === "great" ? " · Big reward" : ""}</div>
            <div className="mt-1 font-display text-[24px] font-black uppercase leading-none tracking-[0.06em]">{card.name}</div>
          </div>
          <button onClick={onClose} aria-label="Close" data-preview-close className="kib-press grid h-[40px] w-[40px] shrink-0 place-items-center text-[18px] font-black" style={{ borderRadius: 4, background: "rgba(255,255,255,.1)" }}>✕</button>
        </div>
        <div className="relative mt-3 grid place-items-center">
          <div aria-hidden className="pointer-events-none absolute inset-x-[8%] bottom-[6%] top-[30%]" style={{ background: `radial-gradient(closest-side, ${theme.accent}55, transparent)`, filter: "blur(16px)" }} />
          {cfg ? <Podium3D cfg={cfg} /> : <RewardArt card={card} w={w} h={h} live={false} />}
        </div>
        {cfg && <div className="mt-1 text-center text-[11px] font-black uppercase tracking-[0.18em] text-white/70">Drag to spin it</div>}
        <div className="mt-4 space-y-2 text-[14px] font-bold leading-snug">
          <p>{whatItDoes(card)}</p>
          {card.note && <p className="text-white/85">{card.note}</p>}
          {card.comingSoon && <p className="text-amber-300">Coming soon: it can&apos;t be claimed yet.</p>}
        </div>
        <div className="mt-5">
          {claimed ? (
            <div className="text-center text-[14px] font-black uppercase tracking-[0.16em] text-green-400">✓ Claimed</div>
          ) : claimable ? (
            <button onClick={onClaim} data-preview-claim className="kib-press h-[46px] w-full text-[15px] font-black uppercase tracking-[0.18em] text-gray-950" style={{
              borderRadius: 3, background: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "0 0 18px rgba(251,191,36,.6)",
            }}>Claim</button>
          ) : (
            <div className="text-center text-[13px] font-black uppercase tracking-[0.14em] text-white/85">{reached ? "Unlocked" : `🔒 Reach Star level ${level} to unlock`}</div>
          )}
        </div>
      </div>
    </div>
  );
}
