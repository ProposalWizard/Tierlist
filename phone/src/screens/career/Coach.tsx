/**
 * THE COACH, ON EVERY SCREEN (page.tsx's `tour`: one pointer tour at a time, in
 * order, pointing at the real screen; lib/star/tours.ts has the words).
 *
 * One host, mounted once beside the screens (App.tsx), picks the tour that is
 * due for the screen on top:
 *   Home       welcome · league opens · first game · "your manager wants a word" ·
 *              the phone step (swipe to the Shop) · "your phone is open"
 *   Training   the story's training day (Power, then Technique, then the finger on
 *              Home) · the Training tour · "one more drill" · league opens
 *   Levels     "tap level 1"
 *   Relations  what the bars are, then the boss meeting
 *   Stats, Shop, Phone   their own tour the first time you open them
 * and anything asked for by name: the "?" button and the title's Tutorial replay
 * the screen's tour on the live screen (askTour), a story beat's pointer too.
 *
 * `useHomeFlow` is the same order for the other things that wait on Home
 * (page.tsx:5352-5480): unlock pop-up → energy toast → tour → the manager's
 * set-piece word → story beat → "New in your game".
 */
import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { CareerState, Fixture } from "@/lib/star/types";
import {
  welcomeTour, LEAGUE_TOUR, FIRST_GAME_TOUR, shopTour, HELP_TOURS, TRAINING_TOUR, LEVEL_TOUR, ONE_MORE_DRILL_TOUR, bossTour,
  BOSS_MEETING_TOUR, relationsTour, PHONE_TOUR, trainingDayTour, type HelpScreen, type TourStep,
} from "@/lib/star/tours";
import { isOpen, hasSeen, markSeen, drillMessageDue, gameFirst, managerTalkDue, nextStep, phoneShortfall, phoneStepLine, pendingAnnouncements, type Feature } from "@/lib/star/unlocks";
import { isStory, storyBeat, trainingDayOn, trainingDayLeft, TRAINING_DAY, type Beat } from "@/lib/star/story";
import { mechanicGuideDue, type Mechanic } from "@/lib/star/mechanics";
import { setPieceTalkDue, type SetPieceTalk } from "@/lib/star/setPieceTalk";
import { canAct } from "@/lib/star/week";
import { starsNow } from "@/lib/star/starPoints";
import { nextFixtureFor } from "@/lib/star/competitions";
import { fixtureTimestamp, divisionOf } from "@/lib/star/calendar";
import { periodDue } from "@/lib/star/intl/career";
import { useCareer, getCareer, setCareer } from "../../game/store";
import { useSession, type Session } from "../../game/session";
import * as flow from "../../game/flow";
import { useNav } from "../../nav";
import { SCREENS } from "../../areas/registry";
import { PointerTour, useAskedTour, askTour } from "../../ui/tour";
import { useMainBarActions } from "../../ui/look/BottomBar";

// ── Which tab of the tabs screen is showing (Home says so; the League does not) ──
let homeShown = false;
const homeSubs = new Set<() => void>();
/** Home calls this while it is the page on screen. */
export function useHomeIsShown() {
  useEffect(() => {
    homeShown = true; homeSubs.forEach((f) => f());
    return () => { homeShown = false; homeSubs.forEach((f) => f()); };
  }, []);
}
function useHomeShown(): boolean {
  return useSyncExternalStore((f) => { homeSubs.add(f); return () => homeSubs.delete(f); }, () => homeShown, () => homeShown);
}

/** HomeHub's daysToNext. */
export function daysToNext(career: CareerState, next: Fixture): number {
  const div = divisionOf(career);
  const ts = (f: Fixture) => fixtureTimestamp(career.player.startYear, career.season, f.week, f.kind, div);
  const played = career.fixtures.filter((f) => f.played);
  const nextTs = ts(next);
  const lastTs = played.length ? Math.max(...played.map(ts).filter((t) => t <= nextTs)) : nextTs - 5 * 86400000;
  const today = Number.isFinite(lastTs) ? lastTs + 86400000 : nextTs - 5 * 86400000;
  return Math.max(0, Math.round((nextTs - today) / 86400000));
}

export type Where = "home" | "training" | "levels" | "relations" | "stats" | "shop" | "phone" | "match" | null;
const WHERE: Record<string, Where> = {
  "career-training": "training", "career-training-levels": "levels", "career-relations": "relations", relations: "relations",
  "career-stats": "stats", shop: "shop", phone: "phone", match: "match",
};
/** The "?" tour of a screen by its name in the app. */
export function helpFor(screen: string | undefined): HelpScreen {
  const w = screen ? WHERE[screen] : null;
  if (w === "levels") return "training";
  if (w && w !== "home" && w !== "match") return w;
  if (screen === "sponsors") return "sponsors";
  if (screen === "career-settings" || screen === "settings") return "settings";
  return "home";
}

type Tour = { key: string; steps: TourStep[]; skippable?: boolean; onDone: () => void };
const seen = (...keys: string[]) => () => {
  const c = getCareer();
  if (c) setCareer(keys.reduce((acc, k) => markSeen(acc, k), c));
};

/** Nothing else is on screen (page.tsx `quiet`). */
function quietNow(career: CareerState, session: Session, pops: number, onHome: boolean): boolean {
  if (pops > 0 || session.news[0] || session.potmWin) return false;
  if (onHome && pendingAnnouncements(career).length > 0) return false;
  return true;
}
/** The rest days' energy toast is showing (page.tsx `energyToast`). */
function energyToastNow(session: Session, quiet: boolean, onHome: boolean): boolean {
  return onHome && quiet && (session.energyBack ?? 0) > 0;
}

/** The tour due on this screen, or null (page.tsx:5384-5444). */
export function tourDue(career: CareerState, where: Where, quiet: boolean, energyToast: boolean): Tour | null {
  // A new career's first match: the energy and Low/Medium/High, the play style and the
  // speed, once (page.tsx matchTourOn, forced: no skip).
  if (where === "match") {
    return isStory(career) && (career.careerStats?.appearances ?? 0) === 0 && !hasSeen(career, "match-tour")
      ? { key: "match-tour", steps: MATCH_TOUR, onDone: seen("match-tour") } : null;
  }
  if (!career.unlocks || !quiet || energyToast || !where) return null;
  const onHome = where === "home", onTraining = where === "training", onRelations = where === "relations";
  const next = nextFixtureFor(career);
  const played1 = career.fixtures.some((f) => f.played);
  const step = nextStep(career);
  if (onHome && periodDue(career) !== null) return null; // the call-up opens by itself
  if (onHome && !hasSeen(career, "tutorial") && (!isStory(career) || hasSeen(career, "beat-boots"))) {
    return { key: "welcome", steps: welcomeTour(gameFirst(career), next ? daysToNext(career, next) : 0, isStory(career)), skippable: !gameFirst(career), onDone: seen("tutorial", "help-home", "play-tip") };
  }
  // The story's training day: the pointer walks you through Power, then Technique.
  if (onTraining && trainingDayOn(career)) {
    const left = trainingDayLeft(career);
    return { key: `day-${left[0]}`, steps: [{ ...trainingDayTour(left[0], left.length, TRAINING_DAY.length)[0], text: "" }], onDone: seen("help-training") };
  }
  // Both drills done: the finger on Home, where the club shop's offer waits.
  if (onTraining && isStory(career) && hasSeen(career, "beat-training") && trainingDayLeft(career).length === 0 && !hasSeen(career, "beat-candeal")) {
    return { key: "day-done", steps: [{ target: "home", text: "", press: true }], onDone: () => {} };
  }
  if (where === "levels" && !hasSeen(career, "level-tut")) {
    return { key: "level-tut", steps: isStory(career) ? [{ ...LEVEL_TOUR[0], text: "" }] : LEVEL_TOUR, onDone: seen("level-tut") };
  }
  if (onTraining && !hasSeen(career, "help-training")) return { key: "training", steps: TRAINING_TOUR, onDone: seen("help-training") };
  if (onTraining && !gameFirst(career) && career.unlocks.drills === 1 && !hasSeen(career, "drill1-msg")) return { key: "one-more", steps: ONE_MORE_DRILL_TOUR, onDone: seen("drill1-msg") };
  if ((onTraining || onHome) && drillMessageDue(career)) return { key: "league-open", steps: onTraining ? LEAGUE_TOUR : LEAGUE_TOUR.slice(1), onDone: seen("drills-msg") };
  if (onHome && hasSeen(career, "league-intro") && !hasSeen(career, "play-tip") && !played1 && isOpen(career, "play")) {
    return { key: "first-game", steps: FIRST_GAME_TOUR, onDone: seen("play-tip") };
  }
  // After the first game: "Your manager wants a word. Tap Phone".
  if (onHome && step?.id === "boss-meeting" && (isOpen(career, "relations") || managerTalkDue(career)) && !hasSeen(career, "boss-prompt")) {
    return { key: "boss", steps: bossTour(gameFirst(career)), onDone: seen("boss-prompt") };
  }
  // Relations, the first time: its bars, then the boss meeting.
  const bossNow = step?.id === "boss-meeting" && canAct(career);
  if (onRelations && !hasSeen(career, "help-relations")) {
    return { key: "relations", steps: bossNow ? [...HELP_TOURS.relations, ...BOSS_MEETING] : relationsTour(gameFirst(career) && step?.id === "first-two-sessions"), onDone: seen("help-relations", ...(bossNow ? ["boss-tour"] : [])) };
  }
  if (onRelations && bossNow && !hasSeen(career, "boss-tour")) return { key: "boss-meeting", steps: BOSS_MEETING, onDone: seen("boss-tour") };
  // The boss met: the Shop, and the phone in it. Short of money, the tour says
  // what the phone costs and how much more you need (no tap).
  if (onHome && step?.id === "buy-phone" && isOpen(career, "shop")) {
    const canBuy = phoneShortfall(career) === 0;
    const steps = shopTour(phoneStepLine(career), canBuy);
    if (canBuy && !hasSeen(career, "shop-intro")) return { key: "shop", steps, onDone: seen("shop-intro") };
    if (!canBuy && !hasSeen(career, "shop-intro") && !hasSeen(career, "phone-short")) return { key: "shop-short", steps, onDone: seen("phone-short") };
  }
  if (onHome && isOpen(career, "phone") && career.achievements.includes("buy-phone") && !hasSeen(career, "phone-tour")) {
    return { key: "phone-open", steps: PHONE_TOUR, onDone: seen("phone-tour") };
  }
  // Every other screen's own tour, the first time.
  if (where === "stats" && isOpen(career, "stats") && !hasSeen(career, "help-stats")) return { key: "first-stats", steps: HELP_TOURS.stats, onDone: seen("help-stats") };
  if (where === "shop" && isOpen(career, "shop") && !hasSeen(career, "help-shop")) return { key: "first-shop", steps: HELP_TOURS.shop, onDone: seen("help-shop") };
  if (where === "phone" && !hasSeen(career, "help-phone")) return { key: "first-phone", steps: HELP_TOURS.phone, onDone: seen("help-phone") };
  return null;
}
const MATCH_TOUR: TourStep[] = [
  { target: "match-energy", text: "Your ENERGY. Pick Low, Medium or High. High: the ball comes to you more, but energy drops fast" },
  { target: "match-playstyle", text: "How you play: more attacking or more defensive" },
  { target: "match-speed", text: "Tap here to speed the match up" },
];
/** The website finds the boss's game by its button's label; the phone names it "rel-boss". */
const BOSS_MEETING: TourStep[] = BOSS_MEETING_TOUR.map((s) => ({ ...s, target: "rel-boss" }));

function useWhere(): Where {
  const nav = useNav();
  const home = useHomeShown();
  const top = nav.stack[nav.stack.length - 1];
  if (!top) return null;
  if (top.name === "tabs") return home ? "home" : null;
  return WHERE[top.name] ?? null;
}

/** Everything waiting on Home, one at a time, in the website's order. */
export interface HomeFlow {
  /** Features that just opened: the "Unlocked" pop-up. */
  announce: Feature[];
  energyToast: number | null;
  /** A tour is on screen (or one is asked for). */
  tour: boolean;
  setPiece: SetPieceTalk | null;
  beat: Beat | null;
  mech: Mechanic | null;
}
export function useHomeFlow(career: CareerState): HomeFlow {
  const session = useSession();
  const pops = flow.usePops().length;
  const asked = useAskedTour();
  const intlDue = periodDue(career) !== null;
  const busy = pops > 0 || !!session.news[0] || !!session.potmWin;
  const pending = career.unlocks ? pendingAnnouncements(career) : [];
  const announce = !busy && !intlDue ? pending : [];
  const quiet = !busy && pending.length === 0;
  const toast = !asked && !intlDue && energyToastNow(session, quiet, true) ? session.energyBack ?? null : null;
  const tour = !!asked || !!tourDue(career, "home", quiet, toast !== null);
  const calm = quiet && !intlDue && toast === null;
  const next = nextFixtureFor(career);
  const beat = calm && !tour ? storyBeat(career, starsNow(career)) : null;
  const setPiece = calm && !tour && !beat && next?.kind !== "international" ? setPieceTalkDue(career) : null;
  const mech = calm && !tour && !beat && !setPiece ? mechanicGuideDue(career) : null;
  return { announce, energyToast: toast, tour, setPiece, beat, mech };
}

/** Mounted once, over every screen: draws the tour that is due. */
export function CoachHost() {
  const career = useCareer();
  const session = useSession();
  const pops = flow.usePops().length;
  const asked = useAskedTour();
  const where = useWhere();
  const nav = useNav();
  const bar = useMainBarActions();
  // The first match's pointer waits a moment, until the match screen is drawn (page.tsx matchTourReady, 1500 ms).
  const [matchReady, setMatchReady] = useState(false);
  useEffect(() => {
    if (where !== "match") { setMatchReady(false); return; }
    const t = setTimeout(() => setMatchReady(true), 1500);
    return () => clearTimeout(t);
  }, [where]);
  if (!career) return null;
  if (where === "match" && !matchReady && !asked) return null;
  const quiet = quietNow(career, session, pops, where === "home");
  const due = asked ? null : tourDue(career, where, quiet, energyToastNow(session, quiet, where === "home"));
  const tour: (Tour & { chain?: boolean }) | null = asked
    ? { key: `ask-${asked.steps.map((s) => s.target).join()}`, steps: asked.steps, chain: asked.chain, onDone: () => { askTour(null); asked.onDone?.(); } }
    : due;
  if (!tour) return null;
  // What a "press" step's tap does, for the things that carry no handler of their own.
  const press: Record<string, () => void> = {
    "nav-play": bar.play, "nav-training": bar.training, "nav-phone": bar.phone, "nav-league": bar.league, home: bar.home,
    rating: () => { if (SCREENS["star-pass"]) nav.go("star-pass"); },
    "can-use-basic": () => flow.useCan("basic"),
  };
  return <PointerTour key={tour.key} steps={tour.steps} skippable={tour.skippable} chain={tour.chain} press={press} onDone={tour.onDone} />;
}

/**
 * The "?" on any screen and the title's Tutorial (page.tsx `setHelpTour(HELP_TOURS[screen])`):
 * this "screen" closes itself at once and the tour plays on the screen underneath.
 */
export function HelpReplay({ topic }: { topic?: HelpScreen }) {
  const nav = useNav();
  useLayoutEffect(() => {
    const under = nav.stack[nav.stack.length - 2];
    const which = topic ?? helpFor(under?.name);
    nav.back();
    askTour(HELP_TOURS[which] ?? HELP_TOURS.home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
