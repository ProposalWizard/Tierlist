// The scoreboard and the stats row above the pitch, like the website's match (team names, score, minute; goals, assists, pass %, rating).
import { View, Text } from "react-native";
import { shortClub } from "@/lib/star/media/grammar";
import { minuteLabel } from "@/lib/star/addedTime";
import type { MatchDriver } from "../match/driver";
import { C } from "../ui/theme";

export function MatchHud({ d }: { d: MatchDriver }) {
  const home = d.setup.fixture.home !== false;
  const us = shortClub(d.setup.career.player.club), them = shortClub(d.setup.fixture.opponent);
  const t = d.tally;
  const passPct = t.passes > 0 ? Math.round((t.passesCompleted / t.passes) * 100) : 0;
  const rating = d.ratingSoFar();
  const cell = (label: string, value: string) => (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: C.text, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: C.gold, fontSize: 14, fontWeight: "900" }}>{value}</Text>
    </View>
  );
  return (
    <View style={{ backgroundColor: C.panel, borderBottomWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: "900", fontSize: 15, textAlign: "right" }}>{home ? us : them}</Text>
        <View style={{ marginHorizontal: 10, backgroundColor: "#000", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 3 }}>
          <Text style={{ color: C.text, fontWeight: "900", fontSize: 20 }}>{home ? d.userScore : d.oppScore} - {home ? d.oppScore : d.userScore}</Text>
        </View>
        <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: "900", fontSize: 15 }}>{home ? them : us}</Text>
      </View>
      <Text style={{ color: C.green, textAlign: "center", fontWeight: "900", fontSize: 12 }}>{minuteLabel(d.matchMinute, d.ADDED, d.MATCH_DURATION)}'</Text>
      <View style={{ flexDirection: "row", paddingVertical: 6 }}>
        {cell("GOALS", String(t.goals))}
        {cell("ASSISTS", String(t.assists))}
        {cell("PASS %", t.passes > 0 ? `${passPct}%` : "–")}
        {cell("RATING", rating.toFixed(1))}
      </View>
    </View>
  );
}
