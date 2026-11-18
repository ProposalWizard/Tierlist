import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View, BackHandler } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavProvider, useNav } from "./src/nav";
import { SCREENS } from "./src/areas/registry";
import { C } from "./src/ui/theme";

function Router() {
  const { stack, back } = useNav();
  // the phone's back button closes the top screen, as in every other app
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { if (stack.length > 1) { back(); return true; } return false; });
    return () => sub.remove();
  }, [stack, back]);
  const top = stack[stack.length - 1];
  const Screen = SCREENS[top.name] ?? SCREENS.title;
  return <View style={{ flex: 1, backgroundColor: C.bg }}><Screen key={stack.length + top.name} params={top.params} /></View>;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <NavProvider initial={{ name: "title" }}><Router /></NavProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
