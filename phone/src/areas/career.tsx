// CAREER AREA: a new career, the trial and signing, match day, post-match,
// Stats, Training, the international call-up, contracts, the season's end
// and Settings. The rules between screens are in game/flow.ts.
import type { Skills } from "@/lib/star/types";
import type { ScreenMap } from "./types";
import { SCREENS } from "./registry";
import { useCareer, setCareer } from "../game/store";
import { resetSession } from "../game/session";
import * as flow from "../game/flow";
import { useNav } from "../nav";
import { NewCareer } from "../screens/career/NewCareer";
import { TrialScreen, ManagerTalkScreen, OffersScreen, SignedScreen } from "../screens/career/Trial";
import { PostMatchScreen } from "../screens/career/PostMatch";
import { StatsScreen } from "../screens/career/Stats";
import { TrainingScreen, LevelSelectScreen, DrillScreen } from "../screens/career/Training";
import { FinalSeasonScreen, RetirementScreen } from "../screens/career/SeasonEnd";
import { GoldenBallNight, SeasonAwardsNight } from "../screens/career/Ceremonies";
import { PreMatchScreen } from "../screens/career/PreMatch";
import { WatchedScreen, CallUpScreen, ContractRenewalScreen, SettingsScreen, PlaceholderScreen } from "../screens/career/Misc";
import { YouthScreen, FreeAgentScreen, LoanBriefScreen } from "../screens/career/Youth";
import { DeadlineDayScreen, KnockoutRoundupScreen, PlayOffRoundupScreen, TournamentTableScreen } from "../screens/career/Roundups";
import { WageTalkScreen, RelegationMoveScreen } from "../screens/career/Moves";
import { FarewellInviteScreen, FarewellSheetsScreen, FarewellWalkoutScreen, FarewellResultScreen, LegacyScreen, HallOfFameScreen } from "../screens/career/Farewell";
import { PressScreen, DilemmaScreen, SeasonReelScreen, HelpScreen, WithPops } from "../screens/career/Moments";
import { RelationsScreen, RelGameScreen, AdvertShootScreen } from "../screens/career/Relations";
import { brandsOf } from "@/lib/star/sponsorDeals";
import type { Roundup } from "@/lib/star/knockoutView";
import type { TransferOffer } from "@/lib/star/transfers";
import type { PressQuestion } from "@/lib/star/media";
import type { Dilemma } from "@/lib/star/dilemmas";
import type { HelpScreen as HelpName } from "@/lib/star/tours";

// The flow only takes another area's screen once it is registered.
flow.setScreenCheck((name) => !!SCREENS[name]);

/**
 * Open a step from the flow. "tabs" is Home. By default the step REPLACES the
 * current screen (a flow moves on, Back never returns to a spent step);
 * `push` opens it on top (Stats, Training…).
 */
export function useGo() {
  const nav = useNav();
  return (s: flow.Step, push = false) => {
    if (s.screen === "tabs") { nav.home(); return; }
    const name = SCREENS[s.screen] ? s.screen : "career-placeholder";
    const params = SCREENS[s.screen] ? s.params : { what: s.screen };
    if (push) nav.go(name, params); else nav.replace(name, params);
  };
}

function withCareer(render: (c: NonNullable<ReturnType<typeof useCareer>>, go: ReturnType<typeof useGo>, nav: ReturnType<typeof useNav>, params?: Record<string, unknown>) => React.ReactNode) {
  return function CareerScreen({ params }: { params?: Record<string, unknown> }) {
    const career = useCareer();
    const go = useGo();
    const nav = useNav();
    if (!career) return null;
    return <WithPops>{render(career, go, nav, params)}</WithPops>;
  };
}

function NewCareerScreen() {
  const nav = useNav();
  const go = useGo();
  return <NewCareer onBack={() => nav.back()} onDone={(p) => go(flow.beginCareer(p))} />;
}

/** Open a career where it was left (the title's Continue): after switching saves. */
function openResumed(nav: ReturnType<typeof useNav>) {
  const s = flow.resumeStep();
  if (s.screen === "tabs") nav.home(); else nav.replace(s.screen, s.params);
}

export const careerScreens: ScreenMap = {
  "career-new": NewCareerScreen,
  "career-trial": withCareer((c, go) => <TrialScreen career={c} go={go} />),
  "career-manager-talk": withCareer((c, go) => <ManagerTalkScreen career={c} go={go} />),
  "career-offers": withCareer((c, go) => <OffersScreen career={c} go={go} />),
  "career-signed": withCareer((c, go) => <SignedScreen career={c} go={go} />),
  "career-prematch": withCareer((c, go, nav) => <PreMatchScreen career={c} go={go} onBack={() => nav.back()} />),
  "post-match": withCareer((c, go) => <PostMatchScreen career={c} go={go} />),
  "career-watched": withCareer((c, go) => <WatchedScreen career={c} go={go} />),
  "career-stats": withCareer((c, go, nav) => <StatsScreen career={c} onBack={() => nav.back()} onRenew={() => go({ screen: "career-contract-renewal" }, true)} />),
  "career-training": withCareer((c, go, nav) => <TrainingScreen career={c} go={go} onBack={() => nav.back()} />),
  "career-training-levels": withCareer((c, go, nav, p) => <LevelSelectScreen career={c} skill={p?.skill as keyof Skills} go={go} onBack={() => nav.back()} />),
  "career-drill": withCareer((c, go, nav, p) => <DrillScreen career={c} skill={p?.skill as keyof Skills} level={Number(p?.level ?? 1)} go={(s) => { if (s.screen === "career-training") nav.back(); else go(s); }} />),
  "career-callup": withCareer((_c, go) => <CallUpScreen go={go} />),
  "career-contract-renewal": withCareer((c, go) => <ContractRenewalScreen career={c} go={go} />),
  "career-golden-ball": withCareer((c, go) => <GoldenBallNight career={c} go={go} />),
  "career-season-awards": withCareer((c, go) => <SeasonAwardsNight career={c} go={go} />),
  "career-final-season": withCareer((c, go) => <FinalSeasonScreen career={c} go={go} />),
  "career-retirement": withCareer((c, go) => <RetirementScreen career={c} go={go} />),
  "career-settings": withCareer((_c, _go, nav) => (
    <SettingsScreen onBack={() => nav.back()} onMainMenu={() => nav.replace("title")} onHelp={() => nav.go("career-help")} onOpenSave={() => openResumed(nav)}
      onFaceEditor={() => nav.go("face-editor")} onFakeFaceEditor={() => nav.go("fake-face-editor")}
      onNewCareer={() => { setCareer(null); resetSession(); nav.replace("career-new"); }} />
  )),
  // ── Not in the first team ──
  "career-youth": withCareer((c, go, nav) => <YouthScreen career={c} go={go} onLeague={() => nav.home()} onSettings={() => nav.go("career-settings")} />),
  "career-free-agent": withCareer((c, go, nav) => <FreeAgentScreen career={c} go={go} onSettings={() => nav.go("career-settings")} />),
  "career-loan-brief": withCareer((c, go, _nav, p) => (
    <LoanBriefScreen career={c} intro={!!p?.intro} onContinue={() => { flow.loanBriefSeen(c); go(p?.intro ? flow.HOME : { screen: "career-prematch" }); }} />
  )),
  "career-wage-talk": withCareer((c, go) => <WageTalkScreen career={c} go={go} />),
  // ── Between matches (the names continueAfterMatch asks for) ──
  "deadline-day": withCareer((c, go) => <DeadlineDayScreen career={c} onContinue={() => go(flow.deadlineDayDone())} />),
  "knockout-roundup": withCareer((_c, go, _nav, p) => p?.ko
    ? <KnockoutRoundupScreen ko={p.ko as Roundup} onContinue={() => go(flow.continueAfterMatch())} />
    : <PlaceholderScreen what="" go={go} />),
  "playoff-roundup": withCareer((c, go) => <PlayOffRoundupScreen career={c} onContinue={() => go(flow.continueAfterMatch(true))} />),
  "intl-tournament-table": withCareer((c, go) => <TournamentTableScreen career={c} onContinue={() => go(flow.HOME)} />),
  // ── The season's end ──
  "relegation-move": withCareer((c, go, _nav, p) => <RelegationMoveScreen career={c} offers={(p?.offers as TransferOffer[] | undefined) ?? flow.relegationOffers(c)} go={go} />),
  "career-season-reel": withCareer((c, go) => <SeasonReelScreen career={c} go={go} />),
  "career-farewell-invite": withCareer((c, go) => <FarewellInviteScreen career={c} go={go} />),
  "career-farewell-sheets": withCareer((c, go, _nav) => <FarewellSheetsScreen career={c} go={go} onBack={() => go({ screen: "career-farewell-invite" })} />),
  "career-farewell-walkout": withCareer((c, go) => <FarewellWalkoutScreen career={c} go={go} />),
  "career-farewell-result": withCareer((c, go) => <FarewellResultScreen career={c} go={go} />),
  "career-legacy": withCareer((c, _go, nav) => (
    <LegacyScreen career={c} onHall={() => nav.go("hall-of-fame")} onMenu={() => nav.replace("title")}
      onNewCareer={() => { setCareer(null); resetSession(); nav.replace("career-new"); }} />
  )),
  "hall-of-fame": function Hall() { const nav = useNav(); return <HallOfFameScreen onBack={() => nav.back()} />; },
  // ── Moments ──
  "career-press": withCareer((_c, go, _nav, p) => {
    const q = (p?.question as PressQuestion | undefined) ?? flow.pressQuestion();
    return q ? <PressScreen question={q} go={go} /> : <PlaceholderScreen what="" go={go} />;
  }),
  "career-dilemma": withCareer((c, go, _nav, p) => {
    const d = (p?.dilemma as Dilemma | undefined) ?? flow.dilemmaFor(c);
    return d ? <DilemmaScreen dilemma={d} go={go} /> : <PlaceholderScreen what="" go={go} />;
  }),
  "career-relations": withCareer((c, go, nav) => <RelationsScreen career={c} go={go} onBack={() => nav.back()} />),
  relations: withCareer((c, go, nav) => <RelationsScreen career={c} go={go} onBack={() => nav.back()} />),
  "career-relationship-game": withCareer((c, go, nav, p) => (
    <RelGameScreen career={c} kind={(p?.kind as flow.RelKind) ?? "boss"} onBack={() => nav.back()}
      go={(s) => { if (s.screen === "career-relations") nav.back(); else go(s); }} />
  )),
  "advert-shoot": withCareer((c, go, nav, p) => {
    const deal = brandsOf(c).deals.find((d) => d.id === p?.dealId);
    if (!deal) return <PlaceholderScreen what="" go={go} />;
    return <AdvertShootScreen deal={deal} onCancel={() => nav.back()} go={(s) => { if (s.screen === "sponsors") nav.back(); else go(s); }} />;
  }),
  "career-help": function Help({ params }) { const nav = useNav(); return <HelpScreen screen={params?.topic as HelpName | undefined} onBack={() => nav.back()} />; },
  settings: withCareer((_c, _go, nav) => (
    <SettingsScreen onBack={() => nav.back()} onMainMenu={() => nav.replace("title")} onHelp={() => nav.go("career-help")} onOpenSave={() => openResumed(nav)}
      onFaceEditor={() => nav.go("face-editor")} onFakeFaceEditor={() => nav.go("fake-face-editor")}
      onNewCareer={() => { setCareer(null); resetSession(); nav.replace("career-new"); }} />
  )),
  "career-placeholder": function Placeholder({ params }) {
    const go = useGo();
    return <PlaceholderScreen what={String(params?.what ?? "")} go={go} />;
  },
};
