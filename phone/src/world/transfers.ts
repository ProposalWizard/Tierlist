/**
 * THE SUMMER WINDOW for your own player, the phone's port of page.tsx's
 * season-transfer / transfer-request-talk phases. Who wants you is the game's
 * own lib/star/transferInterest.ts; this file only adds the two hand-offs
 * the CAREER area owns (signing and the season rollover).
 *
 * HAND-OFF (for the CAREER area): the window ends the season. Call
 * setTransferHandlers({ onSigned, onStay }) from world/transferHandlers.ts once (e.g. in areas/career.tsx)
 * to run the signing scene and advanceSeason exactly as page.tsx does
 * (handleSigningDone / handleStayPut → rollOverSeason). Until then the
 * defaults below apply the move (acceptOffer + clearAfterWindow + the
 * transfer posts) but do NOT roll the season over.
 */
import type { CareerState } from "@/lib/star/types";
import { windowInterest, withRecall, withAgreedWage, markWalkedAway, type WindowInterest } from "@/lib/star/transferInterest";
import { loanRecallOffer } from "@/lib/star/youth";
import { wageFloorFor } from "@/lib/star/signingTalk";
import { clearAfterWindow } from "@/lib/star/transferRequest";
import { acceptOffer, type TransferOffer } from "@/lib/star/transfers";
import { generateForCareer } from "@/lib/star/media/feed";
import { divisionOf } from "@/lib/star/calendar";

/** Every club interested in you this summer (page.tsx: withRecall(windowInterest(…), loanRecallOffer(…))). */
export function summerInterest(career: CareerState): WindowInterest {
  // Leo's "bug fixes" update reads the browser's storage; on the phone it is off (the website's default).
  return withRecall(windowInterest(career, "summer", { step3Promoted: false }), loanRecallOffer(career), career);
}

/**
 * The talks ended (NegotiationScreen onDone in page.tsx). A weekly wage → the
 * agreed offer (never under the club's wage floor); null → the club walked
 * away and is off the list until next summer.
 */
export function afterTalks(career: CareerState, offer: TransferOffer, finalWeekly: number | null): { career: CareerState; agreed: TransferOffer | null } {
  const division = offer.division ?? divisionOf(career);
  if (finalWeekly === null) return { career: markWalkedAway(career, "summer", offer.club), agreed: null };
  const weekly = Math.max(wageFloorFor(offer.club, division), Math.round(finalWeekly));
  return { career, agreed: withAgreedWage(offer, weekly) };
}

/** The move itself (page.tsx handleSigningDone, without the rollover): new club, new deal, the transfer posts. */
export function applySigning(career: CareerState, offer: TransferOffer): CareerState {
  const moved = clearAfterWindow(acceptOffer(career, offer));
  moved.media = generateForCareer(moved, { kind: "transfer", from: career.player.club, to: offer.club, fee: offer.transferFee ?? offer.signingFee }, "transfer");
  return moved;
}
