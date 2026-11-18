import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";

export function Title({ hasSave, onNew, onContinue }: { hasSave: boolean; onNew: () => void; onContinue: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: "space-between" }}>
      <View style={{ marginTop: 60, alignItems: "center" }}>
        <Text style={{ color: C.text, fontSize: 46, fontWeight: "900", fontStyle: "italic", letterSpacing: -1 }}>KNOWITBALL</Text>
        <Text style={{ color: C.gold, fontSize: 14, fontWeight: "800", letterSpacing: 4, marginTop: 6 }}>ROAD TO THE GOLDEN BALL</Text>
      </View>
      <View style={{ gap: 12, marginBottom: 30 }}>
        <Press onPress={onNew} style={{ backgroundColor: C.green, borderRadius: R.card, paddingVertical: 18, alignItems: "center" }}>
          <Text style={{ color: "#05261a", fontSize: 22, fontWeight: "900" }}>NEW GAME</Text>
        </Press>
        <Press disabled={!hasSave} onPress={onContinue} style={{ backgroundColor: C.panel2, borderRadius: R.card, paddingVertical: 18, alignItems: "center", borderWidth: 1, borderColor: C.line }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>CONTINUE</Text>
        </Press>
        <Text style={{ color: C.dim, textAlign: "center", fontSize: 12, marginTop: 6 }}>Phone-built test version · step 1</Text>
      </View>
    </SafeAreaView>
  );
}
