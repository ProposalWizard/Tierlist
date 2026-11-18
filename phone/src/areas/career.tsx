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
import { GoldenBallScreen, SeasonAwardsScreen, FinalSeasonScreen, RetirementScreen } from "../screens/career/SeasonEnd";
import { PreMatchScreen, WatchedScreen, CallUpScreen, ContractRenewalScreen, SettingsScreen, PlaceholderScreen } from "../screens/career/Misc";

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
    return <>{render(career, go, nav, params)}</>;
  };
}

function NewCareerScreen() {
  const nav = useNav();
  const go = useGo();
  return <NewCareer onBack={() => nav.back()} onDone={(p) => go(flow.beginCareer(p))} />;
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
  "career-golden-ball": withCareer((c, go) => <GoldenBallScreen career={c} go={go} />),
  "career-season-awards": withCareer((c, go) => <SeasonAwardsScreen career={c} go={go} />),
  "career-final-season": withCareer((c, go) => <FinalSeasonScreen career={c} go={go} />),
  "career-retirement": withCareer((c, go) => <RetirementScreen career={c} go={go} />),
  "career-settings": withCareer((_c, _go, nav) => (
    <SettingsScreen onBack={() => nav.back()} onMainMenu={() => nav.replace("title")}
      onNewCareer={() => { setCareer(null); resetSession(); nav.replace("career-new"); }} />
  )),
  "career-placeholder": function Placeholder({ params }) {
    const go = useGo();
    return <PlaceholderScreen what={String(params?.what ?? "")} go={go} />;
  },
};
