import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import { WorldPane } from "./world/WorldPane";
import { C } from "../ui/theme";

/**
 * THE LEAGUE PAGE (the website's MatchWeek.tsx since 22 Oct 2026): one page,
 * every league, cup and international competition from one picker
 * (screens/world/WorldPane.tsx), opening on your own league's table.
 * Fixtures & results and Squad live in the phone's apps, as on the website.
 */
export function League({ career }: { career: CareerState }) {
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingVertical: 8 }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: 1 }}>LEAGUE</Text>
      </View>
      <WorldPane career={career} />
    </SafeAreaView>
  );
}
