import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { CareerState } from "@/lib/star/types";
import { Title } from "./src/screens/Title";
import { Home } from "./src/screens/Home";
import { League } from "./src/screens/League";
import { Match } from "./src/screens/Match";
import { TabBar, type Tab } from "./src/ui/TabBar";
import { View } from "react-native";
import { loadCareer, saveCareer } from "./src/game/save";
import { startCareer } from "./src/game/newCareer";

export default function App() {
  const [career, setCareer] = useState<CareerState | null>(() => loadCareer());
  const [screen, setScreen] = useState<"title" | "home" | "match">("title");
  const [tab, setTab] = useState<Tab>("home");
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {screen === "title" || !career
          ? <Title hasSave={!!career}
              onNew={() => { const c = startCareer("Your", "Player"); saveCareer(c); setCareer(c); setScreen("home"); }}
              onContinue={() => setScreen("home")} />
          : screen === "match"
            ? <Match skills={{ power: career.skills.power, technique: career.skills.technique, vision: career.skills.vision }} onDone={() => setScreen("home")} />
          : <View style={{ flex: 1, backgroundColor: "#0b100e" }}>
              <View style={{ flex: 1 }}>{tab === "home" ? <Home career={career} onQuit={() => setScreen("title")} /> : <League career={career} />}</View>
              <TabBar tab={tab} onTab={setTab} onPlay={() => setScreen("match")} />
            </View>}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
