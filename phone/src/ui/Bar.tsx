import { View, Text } from "react-native";
import { C } from "./theme";
/** A skill or progress bar: label, number and a filled bar out of 100. */
export function Bar({ label, value, color = C.green }: { label: string; value: number; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ color: C.dim, fontWeight: "700", fontSize: 13, letterSpacing: 1 }}>{label.toUpperCase()}</Text>
        <Text style={{ color: C.text, fontWeight: "800", fontSize: 14 }}>{Math.round(value)}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <View style={{ width: `${v}%`, height: "100%", backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}
