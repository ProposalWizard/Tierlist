import { Immersive } from "./src/immersive";
import { useEffect } from "react";
import { View, BackHandler } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavProvider, useNav } from "./src/nav";
import { SCREENS } from "./src/areas/registry";
import { C } from "./src/ui/theme";
import { ToonYouSync } from "./src/three/youSync";
import { useLookFonts } from "./src/ui/look/fonts";
import { OverlayHost } from "./src/ui/overlayHost";
import { CoachHost } from "./src/screens/career/Coach";

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
  // the look's fonts (Anton, Cinzel): a moment at start, never more than 1.5 s
  const fonts = useLookFonts();
  if (!fonts) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Immersive />
        <ToonYouSync />
        <NavProvider initial={{ name: "title" }}><Router /><CoachHost /><OverlayHost /></NavProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
