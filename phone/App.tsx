import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { CareerState } from "@/lib/star/types";
import { Title } from "./src/screens/Title";
import { Home } from "./src/screens/Home";
import { loadCareer, saveCareer } from "./src/game/save";
import { startCareer } from "./src/game/newCareer";

export default function App() {
  const [career, setCareer] = useState<CareerState | null>(() => loadCareer());
  const [screen, setScreen] = useState<"title" | "home">("title");
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {screen === "title" || !career
          ? <Title hasSave={!!career}
              onNew={() => { const c = startCareer("Your", "Player"); saveCareer(c); setCareer(c); setScreen("home"); }}
              onContinue={() => setScreen("home")} />
          : <Home career={career} onQuit={() => setScreen("title")} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
