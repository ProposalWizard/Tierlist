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
import { coreScreens } from "./core";
import { getCareer } from "../game/store";
import { askTour } from "../ui/tour";
import { HELP_TOURS } from "@/lib/star/tours";
import { TitleMenu } from "../screens/career/TitleMenu";
import { WithPops } from "../screens/career/Moments";
import { Signing3D } from "../screens/career/Signing3D";
import { POSITION_NAMES } from "@/lib/star/teamsheet";
import { listSlots } from "../world/slots";
import { makeManager } from "@/lib/star/manager";
import type { TransferOffer } from "@/lib/star/transfers";

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
      // page.tsx: the move is signed across the desk first (TransferSigning), then handleSigningDone.
      onSigned: (_c, offer, n) => { n.replace("transfer-signing", { offer }); },
      onStay: (_c, n) => { const s = flow.stayPut(); n.replace(s.screen, s.params); },
    });
  }, []);
  void nav;
  return <Transfers />;
}
/** The move signed across the desk (TransferSigning: the 3D office, Signing3D.tsx; the drawn signing, Signing.tsx, if the 3D cannot start), then into the next season. */
function TransferSigningStep({ params }: { params?: Record<string, unknown> }) {
  const nav = useNav();
  const career = getCareer();
  const offer = params?.offer as TransferOffer | undefined;
  if (!career || !offer) return null;
  const done = () => { const s = flow.signTransfer(offer); nav.replace(s.screen, s.params); };
  return (
    <Signing3D career={career} club={offer.club} managerName={makeManager(career, offer.club, career.season + 1).name} onDone={done} number={null} kind="transfer"
      terms={{ wage: offer.wage, seasonsRemaining: offer.seasons, goalBonus: offer.goalBonus, assistBonus: offer.assistBonus, appearanceFee: offer.clauses?.appearanceFee, loyaltyBonus: offer.clauses?.loyaltyBonus,
        position: (POSITION_NAMES as Record<string, string>)[career.player.position] ?? career.player.position }} />
  );
}
/**
 * The title screen with the website's full menu (TitleMenu: Load game, Hall
 * of Fame, Tutorial, Settings, Credits). Registered here, after core, so it
 * takes the "title" name; core's Title stays as it was.
 */
/** A brand-new install opens on "Who are you?" (page.tsx phase "profile-setup"); its "‹ Main menu" comes back here. Once per launch. */
let firstLaunchSeen = false;
function TitleWithMenu() {
  const nav = useNav();
  useEffect(() => {
    if (firstLaunchSeen) return;
    firstLaunchSeen = true;
    if (!getCareer() && listSlots().every((s) => s.empty)) nav.go("career-new");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const open = () => { const s = flow.resumeStep(); if (s.screen === "tabs") nav.home(); else nav.replace(s.screen, s.params); };
  return (
    <TitleMenu
      onContinue={open}
      onNew={() => nav.go("career-new")}
      onHall={() => nav.go("hall-of-fame")}
      // With a save: the title closes and the coach replays his tour on Home (page.tsx handleTitleTutorial).
      onTutorial={() => {
        if (!getCareer()) { nav.go("career-new"); return; }
        const s = flow.resumeStep();
        open();
        if (s.screen === "tabs") askTour(HELP_TOURS.home);
      }}
      onSettings={() => nav.go("career-settings")}
    />
  );
}
/** Home with the pop-ups over it (achievements, the star rating going up). */
function TabsWithPops(props: { params?: Record<string, unknown> }) {
  const Tabs = coreScreens.tabs;
  return <WithPops><Tabs {...props} /></WithPops>;
}

export const glueScreens: ScreenMap = { "transfer-signing": TransferSigningStep, media: MediaAfterMatch, "cup-draw": CupDrawStep, "season-transfer": SeasonTransfer, title: TitleWithMenu, tabs: TabsWithPops };
