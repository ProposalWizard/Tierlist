// CORE AREA: title and the tabbed main screen. Owned by the coordinator.
// (The career area routes NEW GAME / CONTINUE into its own screens, and the
// Home buttons and the Play button through its flow: game/flow.ts.)
// The tabs screen is Home or League with the website's bottom bar under it
// (ui/look/BottomBar: League, Training, Home, Phone, PLAY). Open it on the
// League with params { tab: "league" }.
import { useEffect, useState } from "react";
import { View, type ViewStyle } from "react-native";
import type { ScreenMap } from "./types";
import { Title } from "../screens/Title";
import { Home } from "../screens/Home";
import { League } from "../screens/League";
import type { Tab } from "../ui/TabBar";
import { BottomBar } from "../ui/look/BottomBar";
import { useCareer } from "../game/store";
import { resumeStep } from "../game/flow";
import { useNav } from "../nav";
import { C } from "../ui/theme";

function TitleScreen() {
  const career = useCareer();
  const nav = useNav();
  return <Title hasSave={!!career}
    onNew={() => nav.go("career-new")}
    onContinue={() => { const s = resumeStep(); if (s.screen === "tabs") nav.home(); else nav.replace(s.screen, s.params); }} />;
}
function Tabs({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  const nav = useNav();
  const asked = params?.tab === "league" ? "league" : "home";
  const [tab, setTab] = useState<Tab>(asked);
  useEffect(() => { setTab(asked); }, [asked, params]);
  if (!career) return null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1 }}>{tab === "home" ? <Home career={career} onQuit={() => nav.replace("title")} onLeague={() => setTab("league")} /> : <League career={career} />}</View>
      {/* the website's bar is see-through over the foot of the page (the pitch): a dark grass colour under it here */}
      <View style={{ backgroundImage: "linear-gradient(180deg, #1c3e06, #0e2a08)" } as ViewStyle}>
        <BottomBar active={tab} plain={tab === "league"} on={{ league: () => setTab("league"), home: () => setTab("home") }} />
      </View>
    </View>
  );
}
export const coreScreens: ScreenMap = { title: TitleScreen, tabs: Tabs };
