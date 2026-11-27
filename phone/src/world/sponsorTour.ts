/**
 * Does the agent's sponsor pointer (Phone -> Messages -> the offer) show on this visit to the Phone?
 * Only while an offer is still waiting, and only once. Bug (Mikey, 27 Nov 2026): the Phone is built
 * again every time you come back to it, with the same params ({ tour: "sponsor" }), so after you
 * accepted the offer the pointer came back for ever, pointing at an empty Messages. The website plays
 * it once, as a one-off asked tour (page.tsx goBeat -> setHelpTour).
 */
import type { CareerState } from "@/lib/star/types";
import { hasSeen } from "@/lib/star/unlocks";
import { brandsOf } from "@/lib/star/sponsorDeals";

export const SPONSOR_TOUR_KEY = "tour-sponsor";

export function sponsorTourDue(career: CareerState | null | undefined, param: unknown): boolean {
  if (param !== "sponsor" || !career) return false;
  if (hasSeen(career, SPONSOR_TOUR_KEY)) return false;
  return brandsOf(career).offers.length > 0;
}
