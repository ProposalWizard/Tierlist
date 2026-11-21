/**
 * THE "?" ON A WORLD SCREEN (page.tsx `helpTour` / `firstHelp`): the coach's
 * pointer tour over the real screen (ui/tour.tsx), not a separate page.
 * It also plays by itself the first time you open the screen (a career with
 * the first-steps chain: `help-<screen>` in career.unlocks.seen), as on the
 * website.
 *
 *   const help = useScreenHelp("league", career);
 *   <Chip onPress={help.open}>?</Chip> … {help.node}
 */
import { useState, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import { HELP_TOURS, type HelpScreen, type TourStep } from "@/lib/star/tours";
import { hasSeen, markSeen } from "@/lib/star/unlocks";
import { getCareer, setCareer } from "../game/store";
import { PointerTour } from "../ui/tour";

/** Mark tour keys seen on the career (page.tsx `seen(...)`). */
export function markSeenKeys(...keys: string[]) {
  const c = getCareer();
  if (c) setCareer(keys.reduce((acc, k) => markSeen(acc, k), c));
}

export function useScreenHelp(screen: HelpScreen, career: CareerState | null, opts?: {
  /** The seen key of the first visit (default `help-<screen>`). */
  seenKey?: string;
  /** The first visit's own steps (default: the "?" steps). */
  first?: TourStep[];
  /** After the first-visit tour (e.g. the League's first-visit record). */
  onFirstDone?: () => void;
  /** No first-visit tour here (another tour owns the first visit). */
  noFirst?: boolean;
  press?: Record<string, () => void>;
}): { open: () => void; node: ReactNode; showing: boolean } {
  const [asked, setAsked] = useState<TourStep[] | null>(null);
  const key = opts?.seenKey ?? `help-${screen}`;
  const firstDue = !opts?.noFirst && !!career?.unlocks && !hasSeen(career, key);
  const node = asked
    ? <PointerTour key={`help-${screen}`} steps={asked} press={opts?.press} onDone={() => setAsked(null)} />
    : firstDue
      ? <PointerTour key={`first-${screen}`} steps={opts?.first ?? HELP_TOURS[screen]} press={opts?.press} onDone={() => { markSeenKeys(key); opts?.onFirstDone?.(); }} />
      : null;
  return { open: () => setAsked(HELP_TOURS[screen]), node, showing: !!node };
}
