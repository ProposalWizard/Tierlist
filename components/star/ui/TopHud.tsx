"use client";
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
export type HudScreen = "home" | "stats" | "training" | "shop" | "style" | "relations" | "league" | "other" | "casino" | "settings";

/**
 * WHICH BAR SITS ON THE LEFT, PER SCREEN (Harry, P13: "when you go to
 * relationship, one of them swaps out for … happiness; or if you go to style
 * it'll swap out for reputation … so you always have the relevant bars for
 * whatever you're looking at"). Energy is the right-hand cell on EVERY screen,
 * so it is not listed. Add a screen here to give it its own.
 */
export type HudLeft = "star" | "happiness" | "reputation";
export const HUD_SPEC: Record<HudScreen, HudLeft> = {
  home: "star", stats: "star", training: "star", shop: "star", league: "star", other: "star", casino: "star", settings: "star",
  relations: "happiness",
  style: "reputation",
};

export default function TopHud({ career, screen, onCareer, className = "" }: {
  career: CareerState;
  screen: HudScreen;
  /** Kept for callers: the can left the HUD in v0.24 (it lives on Home). */
  onUseCan?: (id: (typeof KIB_CANS)[number]["id"]) => void;
  /** Kept for callers: the can left the HUD in v0.24. */
  onOpenCans?: () => void;
  /** Saves a Star Pass claim / Locker change. Without it the Star Pass is look-only. */
  onCareer?: (c: CareerState) => void;
  className?: string;
}) {
  const [starPass, setStarPass] = useState(false);
  return (
    // Room on top for the icons that rise above the bars.
    <div data-hud={screen} className={`sk-top relative z-10 shrink-0 px-2 pb-2 pt-2.5 ${className}`} style={{ background: "var(--sk-top-bg)", boxShadow: "0 4px 10px -4px rgba(0,0,0,.4)" }}>
      {starPass && <StarRatingSheet career={career} onCareer={onCareer} onClose={() => setStarPass(false)} />}
      {/* One block, rating | energy, on the light grey: no frame (P4, P7). */}
      <div data-hud-block className="relative grid grid-cols-2">
        {HUD_SPEC[screen] === "happiness" ? <HappinessCell career={career} /> : HUD_SPEC[screen] === "reputation" ? <ReputationCell career={career} /> : <RatingCell career={career} onOpen={() => setStarPass(true)} claimable={!!onCareer} />}
        <EnergyCell career={career} />
        {/* The divider between the two cells. */}
        <span aria-hidden className="pointer-events-none absolute bottom-[7px] left-1/2 top-[7px] w-px" style={{ background: "rgba(31,42,53,.14)" }} />
      </div>
    </div>
  );
}

const CELL_H = "h-[36px]";
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
  const h = Math.max(0, Math.min(100, Math.round(career.happiness)));
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
function EnergyCell({ career }: { career: CareerState }) {
  const e = Math.max(0, Math.min(100, Math.round(career.energy)));
  return (
    <TopMeter tour="energy" label={`Energy ${e}`} className={CELL_H} icon={<HudIcon name="energy" />} value={e} colors={levelColors(e)} />
  );
}
