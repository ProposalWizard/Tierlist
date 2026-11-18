import { ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import { Bar } from "../ui/Bar";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";

const SKILLS: [keyof CareerState["skills"], string][] = [
  ["pace", "Pace"], ["power", "Power"], ["technique", "Technique"], ["vision", "Vision"], ["freeKick", "Free kicks"],
];

/** Home: who you are, your club, your skills and contract. All read from the real career. */
export function Home({ career, onQuit }: { career: CareerState; onQuit: () => void }) {
  const p = career.player;
  const sk = career.skills as unknown as Record<string, number>;
  const air = sk.aerial ?? sk.aerialAcrobatics;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12 }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>{`${p.firstName} ${p.lastName}`.toUpperCase()}</Text>
        <View style={{ backgroundColor: C.panel2, borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
          <Text style={{ color: C.text, fontWeight: "800" }}>AGE {p.age}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ backgroundColor: C.panel, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.green, fontSize: 12, fontWeight: "800", letterSpacing: 2 }}>YOUR CLUB</Text>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: "900", marginTop: 4 }}>{career.contract.club}</Text>
          <Text style={{ color: C.dim, marginTop: 2 }}>{p.position} · {p.nationality} · Season {career.season}</Text>
        </View>
        <View style={{ backgroundColor: C.panel, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.gold, fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 12 }}>SKILLS</Text>
          {SKILLS.map(([k, l]) => <Bar key={k} label={l} value={sk[k] ?? 0} />)}
          {typeof air === "number" && <Bar label="Aerial" value={air} />}
        </View>
        <View style={{ backgroundColor: C.panel, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.gold, fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 8 }}>CONTRACT</Text>
          <Row k="Wage" v={`★ ${career.contract.wage}`} />
          <Row k="Goal bonus" v={`★ ${career.contract.goalBonus}`} />
          <Row k="Seasons left" v={String(career.contract.seasonsRemaining)} />
        </View>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={{ backgroundColor: C.panel, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ color: C.dim }}>Scroll test card {i + 1}: the rest of Home arrives in step 3.</Text>
          </View>
        ))}
        <Press onPress={onQuit} style={{ backgroundColor: C.panel2, borderRadius: R.card, paddingVertical: 14, alignItems: "center", marginBottom: 30 }}>
          <Text style={{ color: C.text, fontWeight: "800" }}>Main menu</Text>
        </Press>
      </ScrollView>
    </SafeAreaView>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: C.dim, fontSize: 15 }}>{k}</Text>
      <Text style={{ color: C.text, fontSize: 15, fontWeight: "800" }}>{v}</Text>
    </View>
  );
}
