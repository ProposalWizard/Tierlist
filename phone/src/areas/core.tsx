// CORE AREA: title and the tabbed main screen. Owned by the coordinator.
import { useState } from "react";
import { View } from "react-native";
import type { ScreenMap } from "./types";
import { Title } from "../screens/Title";
import { Home } from "../screens/Home";
import { League } from "../screens/League";
import { TabBar, type Tab } from "../ui/TabBar";
import { useCareer, setCareer } from "../game/store";
import { startCareer } from "../game/newCareer";
import { useNav } from "../nav";
import { C } from "../ui/theme";

function TitleScreen() {
  const career = useCareer();
  const nav = useNav();
  return <Title hasSave={!!career}
    onNew={() => { setCareer(startCareer("Your", "Player")); nav.home(); }}
    onContinue={() => nav.home()} />;
}
function Tabs() {
  const career = useCareer();
  const nav = useNav();
  const [tab, setTab] = useState<Tab>("home");
  if (!career) return null;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1 }}>{tab === "home" ? <Home career={career} onQuit={() => nav.replace("title")} /> : <League career={career} />}</View>
      <TabBar tab={tab} onTab={setTab} onPlay={() => nav.go("match")} />
    </View>
  );
}
export const coreScreens: ScreenMap = { title: TitleScreen, tabs: Tabs };
