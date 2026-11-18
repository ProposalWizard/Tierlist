import { useMemo, useState } from "react";
import { FlatList, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState, LeagueTeam } from "@/lib/star/types";
import { sortLeague } from "@/lib/star/season";
import { shortClub } from "@/lib/star/media/grammar";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";

/** League: the table and your fixtures, both from the real career (lib/star/season.ts sorts the table). */
export function League({ career }: { career: CareerState }) {
  const [tab, setTab] = useState<"table" | "fixtures">("table");
  const rows = useMemo(() => sortLeague(career.league as LeagueTeam[]), [career.league]);
  const mine = career.contract.club;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: "900", textAlign: "center", marginTop: 8 }}>LEAGUE</Text>
      <View style={{ flexDirection: "row", margin: 14, backgroundColor: C.panel, borderRadius: R.pill, padding: 4 }}>
        {(["table", "fixtures"] as const).map((t) => (
          <Press key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9, borderRadius: R.pill, alignItems: "center", backgroundColor: tab === t ? C.panel2 : "transparent" }}>
            <Text style={{ color: tab === t ? C.text : C.dim, fontWeight: "800", letterSpacing: 1 }}>{t.toUpperCase()}</Text>
          </Press>
        ))}
      </View>
      {tab === "table" ? (
        <FlatList data={rows} keyExtractor={(r) => r.name} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
          ListHeaderComponent={<TRow cells={["#", "CLUB", "P", "W", "D", "L", "GD", "PTS"]} head />}
          renderItem={({ item, index }) => (
            <TRow you={item.name === mine} cells={[String(index + 1), shortClub(item.name), String(item.played), String(item.won), String(item.drawn), String(item.lost), String(item.goalsFor - item.goalsAgainst), String(item.points)]} />
          )} />
      ) : (
        <FlatList data={career.fixtures} keyExtractor={(f, i) => `${f.week}-${f.opponent}-${i}`} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.panel, borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <Text style={{ color: C.dim, width: 54, fontWeight: "700" }}>Wk {item.week}</Text>
              <Text style={{ color: C.text, flex: 1, fontWeight: "800" }}>{item.home ? "v " : "@ "}{shortClub(item.opponent)}</Text>
              <Text style={{ color: item.played ? C.text : C.dim, fontWeight: "900" }}>{item.played ? `${item.homeScore}–${item.awayScore}` : "—"}</Text>
            </View>
          )} />
      )}
    </SafeAreaView>
  );
}
function TRow({ cells, head, you }: { cells: string[]; head?: boolean; you?: boolean }) {
  const w = [28, 0, 30, 30, 30, 30, 38, 40];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: head ? 8 : 11, paddingHorizontal: 8, borderRadius: 10,
      backgroundColor: you ? "rgba(52,211,153,0.16)" : head ? "transparent" : C.panel, marginBottom: head ? 2 : 4 }}>
      {cells.map((c, i) => (
        <Text key={i} numberOfLines={1} style={{ width: w[i] || undefined, flex: w[i] ? undefined : 1, textAlign: i === 1 ? "left" : "center",
          color: head ? C.dim : you ? C.green : C.text, fontWeight: head ? "800" : i === 7 ? "900" : "700", fontSize: head ? 11 : 14 }}>{c}</Text>
      ))}
    </View>
  );
}
