/**
 * Who finishes the summer window (see world/transfers.ts). The CAREER area
 * replaces these with setTransferHandlers() to show the signing and roll the
 * season over (page.tsx handleSigningDone / handleStayPut → rollOverSeason).
 * Kept apart from transfers.ts so the headless check can load that one
 * without the phone's storage.
 */
import type { CareerState } from "@/lib/star/types";
import type { TransferOffer } from "@/lib/star/transfers";
import { clearAfterWindow } from "@/lib/star/transferRequest";
import { setCareer } from "../game/store";
import { applySigning } from "./transfers";

/** What the screens hand the handlers to move on with (nav from useNav()). */
export interface TransferNav { home: () => void; replace: (name: string, params?: Record<string, unknown>) => void }

export interface TransferHandlers {
  /** A deal is agreed: sign it. The CAREER area shows the signing and rolls the season over. */
  onSigned: (career: CareerState, offer: TransferOffer, nav: TransferNav) => void;
  /** Stay at your club: the window closes (and the season rolls over). */
  onStay: (career: CareerState, nav: TransferNav) => void;
}
let handlers: TransferHandlers = {
  onSigned: (career, offer, nav) => { setCareer(applySigning(career, offer)); nav.home(); },
  onStay: (career, nav) => { setCareer(clearAfterWindow(career)); nav.home(); },
};
export function setTransferHandlers(h: Partial<TransferHandlers>) { handlers = { ...handlers, ...h }; }
export function transferHandlers(): TransferHandlers { return handlers; }
