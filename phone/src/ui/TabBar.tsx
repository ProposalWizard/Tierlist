import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Press } from "./Press";
import { C } from "./theme";
export type Tab = "home" | "league";
const TABS: { id: Tab; label: string; icon: string }[] = [{ id: "league", label: "League", icon: "🏆" }, { id: "home", label: "Home", icon: "🏠" }];
/** The bottom bar: solid colour (no blur), each tab reacts on touch. */
export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: "row", backgroundColor: "#0f1a16", borderTopWidth: 1, borderTopColor: C.line, paddingBottom: Math.max(inset.bottom, 8), paddingTop: 8 }}>
      {TABS.map((t) => (
        <Press key={t.id} onPress={() => onTab(t.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}>
          <Text style={{ fontSize: 22 }}>{t.icon}</Text>
          <Text style={{ color: tab === t.id ? C.text : C.dim, fontWeight: "800", fontSize: 13, marginTop: 2 }}>{t.label}</Text>
        </Press>
      ))}
    </View>
  );
}
