/**
 * JOINS THE CAREER FLOW TO THE WORLD SCREENS (coordinator).
 * The career flow asks for "media", "cup-draw" and "season-transfer"; the world
 * area's screens are "feed", "cup-draw" and "transfers". After each one the
 * flow decides what comes next (continueAfterMatch / signTransfer / stayPut).
 */
import { useEffect } from "react";
import type { ScreenMap } from "./types";
import { worldScreens } from "./world";
import { useNav } from "../nav";
import * as flow from "../game/flow";
import { setTransferHandlers } from "../world/transferHandlers";

const Feed = worldScreens.feed;
const Draw = worldScreens["cup-draw"];
const Transfers = worldScreens.transfers;

/** After the match: the feed's reactions, then on through the flow. */
function MediaAfterMatch({ params }: { params?: Record<string, unknown> }) {
  const nav = useNav();
  const next = () => { const s = flow.continueAfterMatch(); nav.replace(s.screen, s.params); };
  return <Feed params={{ ...params, moment: !!params?.afterMatch, onContinue: params?.afterMatch ? next : undefined }} />;
}
/** The draw: Continue goes on through the flow (skipping the draw this time). */
function CupDrawStep({ params }: { params?: Record<string, unknown> }) {
  const nav = useNav();
  const onContinue = () => { const s = flow.continueAfterMatch(true); nav.replace(s.screen, s.params); };
  return <Draw params={{ ...params, onContinue }} />;
}
/** The summer window: signing or staying rolls the season over through the flow. */
function SeasonTransfer() {
  const nav = useNav();
  useEffect(() => {
    setTransferHandlers({
      onSigned: (_c, offer, n) => { const s = flow.signTransfer(offer); n.replace(s.screen, s.params); },
      onStay: (_c, n) => { const s = flow.stayPut(); n.replace(s.screen, s.params); },
    });
  }, []);
  void nav;
  return <Transfers />;
}
export const glueScreens: ScreenMap = { media: MediaAfterMatch, "cup-draw": CupDrawStep, "season-transfer": SeasonTransfer };
