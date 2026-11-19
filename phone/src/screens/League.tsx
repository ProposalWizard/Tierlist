import { Text, View } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { WorldPane } from "./world/WorldPane";
import { Backdrop, PageTitle } from "../ui/look";
import { GameTop } from "../world/chrome";
import { useNav } from "../nav";
import { SCREENS } from "../areas/registry";
import { Press } from "../ui/Press";

/**
 * THE LEAGUE PAGE (the website's MatchWeek.tsx since 22 Oct 2026): one page,
 * every league, cup and international competition from one picker
 * (screens/world/WorldPane.tsx), opening on your own league's table.
 * Fixtures & results and Squad live in the phone's apps, as on the website.
 * The look: the blurred stadium behind, the game's top bar, "LEAGUE" in
 * Anton with its ? chip, glass rows (glassLook.css).
 */
export function League({ career }: { career: CareerState }) {
  const nav = useNav();
  return (
    <View style={{ flex: 1, backgroundColor: "#0b1a2e" }}>
      <Backdrop kind="stadium" />
      <GameTop career={career} help="league" />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 8, paddingBottom: 6 }}>
        <PageTitle size={20}>League</PageTitle>
        {SCREENS["career-help"] ? <Chip onPress={() => nav.go("career-help", { topic: "league" })}>?</Chip> : null}
      </View>
      <WorldPane career={career} />
    </View>
  );
}

function Chip({ children, onPress }: { children: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={{ width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.26)" }}>
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>{children}</Text>
    </Press>
  );
}
