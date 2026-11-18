// CORE AREA: title and the tabbed main screen. Owned by the coordinator.
// (The career area routes NEW GAME / CONTINUE into its own screens, and the
// Home buttons and the Play button through its flow: game/flow.ts.)
import { useState } from "react";
import { View } from "react-native";
import type { ScreenMap } from "./types";
import { Title } from "../screens/Title";
import { Home } from "../screens/Home";
import { League } from "../screens/League";
import { TabBar, type Tab } from "../ui/TabBar";
import { useCareer } from "../game/store";
import { resumeStep, seasonOver, endSeason } from "../game/flow";
import { useNav } from "../nav";
import { C } from "../ui/theme";

function TitleScreen() {
  const career = useCareer();
  const nav = useNav();
  return <Title hasSave={!!career}
    onNew={() => nav.go("career-new")}
    onContinue={() => { const s = resumeStep(); if (s.screen === "tabs") nav.home(); else nav.replace(s.screen, s.params); }} />;
}
function Tabs() {
  const career = useCareer();
  const nav = useNav();
  const [tab, setTab] = useState<Tab>("home");
  if (!career) return null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1 }}>{tab === "home" ? <Home career={career} onQuit={() => nav.replace("title")} onLeague={() => setTab("league")} /> : <League career={career} />}</View>
      <TabBar tab={tab} onTab={setTab} onPlay={() => (seasonOver(career) ? nav.go(endSeason().screen) : nav.go("career-prematch"))} />
    </View>
  );
}
export const coreScreens: ScreenMap = { title: TitleScreen, tabs: Tabs };
