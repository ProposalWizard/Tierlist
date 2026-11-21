/**
 * THE WEBSITE'S SEGMENT TABS (WorldPane / LeagueScreen's TABLE · RESULTS ·
 * GOALS · ASSISTS · HISTORY): a dark glass track, the words in small spaced
 * capitals, the chosen one on a lighter glass pane with an emerald line
 * under it.
 *   <CapsTabs value={tab} onChange={setTab} tabs={[["table","Table"], …]} />
 *
 * And the shop's text tabs (Shop.tsx: Cans  Drip  Gadgets …, Anton, the
 * chosen one white with a bar under it, the rest grey), scrolling sideways:
 *   <AntonTabs value={cat} onChange={setCat} tabs={[…]} />
 */
import { ScrollView, Text, View, type ViewStyle } from "react-native";
import { Press } from "../Press";
import { FONT } from "./fonts";

export function CapsTabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (t: T) => void; tabs: readonly (readonly [T, string])[] }) {
  return (
    <View style={{
      flexDirection: "row", padding: 4, gap: 2, borderRadius: 14,
      backgroundImage: "linear-gradient(180deg, rgba(10,22,40,0.62), rgba(10,22,40,0.74))",
      boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1px rgba(255,255,255,0.18)",
    } as ViewStyle}>
      {tabs.map(([k, label]) => {
        const on = value === k;
        return (
          <Press key={k} onPress={() => onChange(k)} style={[{ flex: 1, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
            on && ({ backgroundColor: "rgba(255,255,255,0.2)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.3), inset 0px 0px 0px 1px rgba(255,255,255,0.22)" } as ViewStyle)]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: on ? "#fff" : "rgba(255,255,255,0.62)", fontWeight: "900", fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", paddingHorizontal: 2 }}>{label}</Text>
            {on && <View style={{ position: "absolute", bottom: 2, width: 26, height: 3, borderRadius: 2, backgroundColor: "#34d399" }} />}
          </Press>
        );
      })}
    </View>
  );
}

export function AntonTabs<T extends string>({ value, onChange, tabs, size = 17, lead = 12 }: { value: T; onChange: (t: T) => void; tabs: readonly (readonly [T, string])[]; size?: number; lead?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingLeft: lead, paddingRight: 12, gap: 16, alignItems: "flex-end" }}>
      {tabs.map(([k, label]) => {
        const on = value === k;
        return (
          <Press key={k} onPress={() => onChange(k)} style={{ alignItems: "center", paddingBottom: 7 }}>
            <Text style={{ color: on ? "#fff" : "rgba(255,255,255,0.55)", fontFamily: FONT.display, fontSize: size, lineHeight: Math.round(size * 1.3), letterSpacing: 0.3, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }}>{label}</Text>
            <View style={{ position: "absolute", bottom: 0, height: 3, width: 22, borderRadius: 2, backgroundColor: on ? "#fff" : "transparent" }} />
          </Press>
        );
      })}
    </ScrollView>
  );
}
