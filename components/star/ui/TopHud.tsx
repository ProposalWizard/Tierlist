"use client";
import { happinessOf } from "@/lib/star/relationships";
import { useEffect, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { KIB_CANS } from "@/lib/star/shopData";
import { starStatus } from "@/lib/star/starPoints";
import { hasSeen } from "@/lib/star/unlocks";
import StarRatingSheet from "../StarRatingSheet";
import { usePassLayout } from "@/lib/star/starPassStore";
import { claimableLevels } from "@/lib/star/starPassClaim";
import { levelColors } from "./StatBar";
import { TopMeter, HudIcon, FillStar } from "./TopMeter";
import { fameOf } from "@/lib/star/fame";
import { formatWallet, MONEY_SIGN } from "@/lib/star/money";

/**
 * THE TOP HUD (Harry, 1 Oct 2026, P80/P81/P86: "your energy never leaves").
 * Modelled on New Star Soccer's Star Rating | Energy strip, in our own flat,
 * square look — no floating pills.
 *
 *   <TopHud career={career} screen="home" onUseCan={use} onOpenCans={() => setPhase("shop-kib")} />
 *
 * ONE block, the same on every screen: star rating on the left, energy on
 * the right. Harry: "the star rating and the energy need to be more
 * encapsulated … put the money next to the name and the age next to the name
 * at the very top bar", then "the pills at the top aren't uniform across
 * every page". So money and age live in the top bar (ui/GameBar.tsx), and
 * nothing here changes with the screen. `screen` only labels the block.
 *
 * v0.24 (Harry, 2 Oct 2026, P1-9/P1-10/P1-11/P1-14/P1-23/P1-35/P1-37-39):
 *  - every bar is SQUARE with a white edge, and the block's frame is white;
 *  - no can and no FULL/USE/BUY on ANY page — the energy bar runs to the end
 *    of its cell (the cans live at the bottom of Home now);
 *  - each bar's icon stands on top of it, 3D, the same on every bar
 *    (ui/TopMeter.tsx): the Blender bolt / Earth / smiley from
 *    public/icons3d/, and for the star rating a star that fills with your way
 *    through the level.
 *
 * v0.25 (Harry and Mikey, 2 Oct 2026, review of v0.24, P2-P10):
 *  - no white outline anywhere, and no number on a bar ("doesn't need the
 *    hundred in there");
 *  - the whole always-there top area (this and ui/GameBar.tsx) is one light
 *    grey that blends in, no outline, after New Star Soccer's home screen:
 *    calm, flat 2D bars, nothing "code designed" (the --sk-top-* tokens and
 *    `.sk-top` rules in ui/flat.css 4);
 *  - the 3D icons stay on the bars;
 *  - the star bar fills within the level, and a level-up fills it to the
 *    end, empties it and fills it again (P2: "it will never really be full").
 */
export type HudScreen = "home" | "stats" | "training" | "shop" | "style" | "relations" | "league" | "other" | "casino" | "settings" | "phone" | "sponsors" | "investments";

/**
 * THE TWO BARS, PER SCREEN (Harry, P13, 1 Oct 2026: "you always have the
 * relevant bars for whatever you're looking at"; widened to BOTH bars on
 * 19 Nov 2026, RUL-UI-009: "we need to do this for every page (have the
 * relevant stats as the top 2 bars)"). Left cell, right cell. Add a screen
 * here to give it its own pair. "none" on both hides the block.
 */
export type HudCell = "star" | "energy" | "happiness" | "reputation" | "fame" | "money" | "none";
export const HUD_SPEC: Record<HudScreen, [HudCell, HudCell]> = {
  home: ["star", "energy"], stats: ["star", "energy"], training: ["star", "energy"],
  league: ["star", "energy"], other: ["star", "energy"],
  shop: ["fame", "money"],
  style: ["reputation", "fame"],
  relations: ["happiness", "reputation"],
  sponsors: ["fame", "money"],
  phone: ["star", "money"],
  investments: ["money", "reputation"],
  casino: ["money", "happiness"],
  settings: ["none", "none"],
};
/** Kept for anything that still reads only the left bar. */
export type HudLeft = "star" | "happiness" | "reputation";

export default function TopHud({ career, screen, onCareer, onStarPass, passBar, pick, className = "" }: {
  career: CareerState;
  screen: HudScreen;
  /** Kept for callers: the can left the HUD in v0.24 (it lives on Home). */
  onUseCan?: (id: (typeof KIB_CANS)[number]["id"]) => void;
  /** Kept for callers: the can left the HUD in v0.24. */
  onOpenCans?: () => void;
  /** Saves a Star Pass claim / Locker change. Without it the Star Pass is look-only. */
  onCareer?: (c: CareerState) => void;
  /** Told when the Star Pass opens and shuts, so nothing pops up over it. */
  onStarPass?: (open: boolean) => void;
  /** The game's bottom bar, drawn inside the Star Pass (StarRatingSheet `bar`). */
  passBar?: (close: () => void) => React.ReactNode;
  /** The shop's selected item: Fame shows what it adds, Money what it costs (RUL-UI-009). */
  pick?: { price: number; fameGain: number };
  className?: string;
}) {
  const [starPass, setStarPassRaw] = useState(false);
  if (HUD_SPEC[screen].every((c) => c === "none")) return null;
  const setStarPass = (open: boolean) => { setStarPassRaw(open); onStarPass?.(open); };
  return (
    // Room on top for the icons that rise above the bars.
    <div data-hud={screen} className={`sk-top relative z-10 shrink-0 px-2 pb-2 pt-2.5 ${className}`} style={{ background: "var(--sk-top-bg)", boxShadow: "0 4px 10px -4px rgba(0,0,0,.4)" }}>
      {starPass && <StarRatingSheet career={career} onCareer={onCareer} bar={passBar} onClose={() => setStarPass(false)} />}
      {/* One block, rating | energy, on the light grey: no frame (P4, P7). */}
      <div data-hud-block className="relative grid grid-cols-2">
        {HUD_SPEC[screen].map((cell, i) => <Cell key={i} cell={cell} career={career} pick={pick} onOpen={() => setStarPass(true)} claimable={!!onCareer} />)}
        {/* The divider between the two cells. */}
        <span aria-hidden className="pointer-events-none absolute bottom-[7px] left-1/2 top-[7px] w-px" style={{ background: "rgba(31,42,53,.14)" }} />
      </div>
    </div>
  );
}

const CELL_H = "h-[36px]";

function Cell({ cell, career, pick, onOpen, claimable }: { cell: HudCell; career: CareerState; pick?: { price: number; fameGain: number }; onOpen: () => void; claimable: boolean }) {
  switch (cell) {
    case "star": return <RatingCell career={career} onOpen={onOpen} claimable={claimable} />;
    case "energy": return <EnergyCell career={career} />;
    case "happiness": return <HappinessCell career={career} />;
    case "reputation": return <ReputationCell career={career} />;
    case "fame": return <FameCell career={career} gain={pick?.fameGain} />;
    case "money": return <MoneyCell career={career} price={pick?.price} />;
    default: return <span />;
  }
}

/** Fame, 0-100 (fame.ts fameOf). In the shop, a lighter piece shows what the picked item would add. */
function FameCell({ career, gain }: { career: CareerState; gain?: number }) {
  const f = fameOf(career);
  const add = Math.max(0, Math.min(100 - f, gain ?? 0));
  return (
    <span className="relative block">
      <TopMeter tour="fame" label={`Fame ${f}`} className={CELL_H} icon={<HudIcon name="fame" />} value={Math.max(3, f)} colors={["#a855f7", "#e9b6ff"]} />
      {add > 0 && <span aria-hidden data-fame-gain className="pointer-events-none absolute top-1/2 h-[16px] -translate-y-1/2 rounded-sm" style={{ left: `calc(30px + (100% - 38px) * ${f / 100})`, width: `calc((100% - 38px) * ${add / 100})`, background: "rgba(240,220,255,.65)" }} />}
    </span>
  );
}

/** Money with the 3D dollar bill (RUL-UI-009). Fills to a year's wages; in the
 *  shop it fills to what you have and stripes the picked item's cost. */
function MoneyCell({ career, price }: { career: CareerState; price?: number }) {
  const m = Math.max(0, career.money);
  const year = Math.max(1, (career.contract?.wage ?? 0) * 52);
  const fill = price !== undefined ? 100 : Math.min(100, (m / year) * 100);
  const cost = price !== undefined && m > 0 ? Math.min(100, (price / m) * 100) : 0;
  return (
    <span className="relative block">
      <TopMeter tour="money" label={`Money ${formatWallet(m)}`} className={CELL_H} icon={<HudIcon name="cash" />} value={Math.max(3, fill)} colors={["#16a34a", "#86efac"]}>
        <span className="rounded-md bg-black/55 px-1.5 text-[11px] font-black text-white">{MONEY_SIGN}{formatWallet(m)}</span>
      </TopMeter>
      {cost > 0 && <span aria-hidden data-money-cost className="pointer-events-none absolute top-1/2 h-[16px] -translate-y-1/2" style={{ right: 8, width: `calc((100% - 38px) * ${cost / 100})`, background: "repeating-linear-gradient(135deg,rgba(0,0,0,.42) 0 5px,rgba(0,0,0,.12) 5px 10px)" }} />}
    </span>
  );
}
const GOLD: [string, string] = ["#f59e0b", "#fde047"];

function RatingCell({ career, onOpen, claimable }: { career: CareerState; onOpen: () => void; claimable: boolean }) {
  const star = starStatus(career);
  // A red dot while a Star Pass reward is waiting to be claimed.
  const { layout } = usePassLayout();
  const waiting = claimable && claimableLevels(career, layout.levels, star.stars).length > 0;
  // The Star Pass stays locked until the tutorial is done (Harry, P15).
  const open = hasSeen(career, "tutorial");
  // The bar and the star show the same thing: your way through this level.
  const pct = Math.max(0, Math.min(100, star.toNext * 100));
  const { shownPct, shownLevel, duration } = useLevelFill(star.stars, pct);
  return (
    <button onClick={open ? onOpen : undefined} data-tour="rating" aria-label={open ? `Star Pass, star rating ${star.stars}` : `Star rating ${star.stars}`} className={`kib-press relative block min-w-0 text-left ${CELL_H}`}>
      <TopMeter
        className="h-full"
        icon={<FillStar fraction={shownPct / 100} duration={duration}>{shownLevel}</FillStar>}
        value={Math.max(3, shownPct)}
        duration={duration}
        colors={GOLD}
        after={star.gate ? <span className="shrink-0 text-[10px] font-black leading-none">🔒</span> : undefined}
      />
      {/* A round, glossy "!" badge (Harry, 2 Oct 2026: the flat red square
          looked out of place next to the 3D icons). Same place, same meaning. */}
      {waiting && open && (
        <span
          data-claim-dot
          aria-label="Star Pass reward waiting"
          className="absolute left-[34px] -top-[6px] z-20 grid h-[15px] w-[15px] animate-pulse place-items-center rounded-full text-[10px] font-black leading-none text-white"
          style={{
            background: "radial-gradient(circle at 35% 30%, #fca5a5 0%, #ef4444 45%, #b91c1c 100%)",
            boxShadow: "0 0 0 1.5px #fff, 0 0 8px rgba(239,68,68,.9), inset 0 -1px 2px rgba(0,0,0,.35)",
            textShadow: "0 1px 1px rgba(0,0,0,.4)",
          }}
        >!</span>
      )}
    </button>
  );
}

/** How long each part of a level-up takes on the star bar, in ms. */
const LEVEL_FILL_MS = 1100;
const LEVEL_HOLD_MS = 350;

/**
 * The star bar's way through the level, with a level-up shown as one (P2:
 * "it will never really be full"): when the level goes up, the bar fills to
 * the end with the old level on the star, empties in one jump as the new
 * level appears, then fills again to where you now are. A level going down
 * (a slump) just moves.
 */
export function useLevelFill(level: number, pct: number): { shownPct: number; shownLevel: number; duration: number | undefined } {
  const [shown, setShown] = useState({ pct, level, duration: undefined as number | undefined });
  const prev = useRef(level);
  useEffect(() => {
    const from = prev.current;
    prev.current = level;
    if (level <= from) { setShown({ pct, level, duration: undefined }); return; }
    setShown({ pct: 100, level: from, duration: LEVEL_FILL_MS });
    const t1 = window.setTimeout(() => setShown({ pct: 0, level, duration: 0 }), LEVEL_FILL_MS + LEVEL_HOLD_MS);
    const t2 = window.setTimeout(() => setShown({ pct, level, duration: LEVEL_FILL_MS }), LEVEL_FILL_MS + LEVEL_HOLD_MS + 90);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [level, pct]);
  return { shownPct: shown.pct, shownLevel: shown.level, duration: shown.duration };
}

/** Relations: how happy you are, in place of the star rating (P13). */
function HappinessCell({ career }: { career: CareerState }) {
  const h = happinessOf(career);
  return (
    <TopMeter tour="happiness" label={`Happiness ${h}`} className={CELL_H} icon={<HudIcon name="happiness" />} value={Math.max(3, h)} colors={levelColors(h)} />
  );
}

/** Style: your reputation, in place of the star rating (P13). The world bar (P1-38). */
function ReputationCell({ career }: { career: CareerState }) {
  const r = Math.max(0, Math.min(100, Math.round(career.reputation)));
  return (
    <TopMeter tour="reputation" label={`Reputation ${r}`} className={CELL_H} icon={<HudIcon name="world" />} value={Math.max(3, r)} colors={["#0ea5e9", "#38bdf8"]} />
  );
}

/** Energy, on every screen: the bar runs to the end of its cell (P1-14), no number (P5). */
/** Sent by EnergyBackToast: the energy bar shows the rest days' gain filling in. */
export const ENERGY_BACK_EVENT = "kib-energy-back";

function EnergyCell({ career }: { career: CareerState }) {
  const e = Math.max(0, Math.min(100, Math.round(career.energy)));
  // Mikey's phone test (17 Nov 2026): "+47 energy ... I would prefer it if that
  // actually showed on the energy bar going up from where it was at the end of
  // the game." When the toast shows, the bar drops back by the amount at once
  // and then fills up to today's energy.
  const [from, setFrom] = useState<number | null>(null);
  const [dur, setDur] = useState(0);
  useEffect(() => {
    const on = (ev: Event) => {
      const amount = Number((ev as CustomEvent).detail) || 0;
      if (amount <= 0) return;
      setDur(0);
      setFrom(Math.max(0, e - amount));
      window.setTimeout(() => { setDur(1400); setFrom(null); }, 120);
    };
    window.addEventListener(ENERGY_BACK_EVENT, on);
    return () => window.removeEventListener(ENERGY_BACK_EVENT, on);
  }, [e]);
  const shown = from ?? e;
  return (
    <TopMeter tour="energy" label={`Energy ${e}`} className={CELL_H} icon={<HudIcon name="energy" />} value={shown} duration={dur || undefined} colors={levelColors(shown)} />
  );
}
