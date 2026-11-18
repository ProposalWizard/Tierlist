// The commentary screen between chances (the website's "feed" phase): the lines as the clock reaches them, energy and speed.
import { useRef, type ComponentRef } from "react";
import { View, Text, ScrollView } from "react-native";
import type { EnergyMode } from "@/lib/star/energy";
import { minuteLabel } from "@/lib/star/addedTime";
import type { MatchDriver } from "../match/driver";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";

const TONE_COLOR: Record<string, string> = { goal: C.gold, oppGoal: C.red, period: C.green, you: "#93c5fd", assist: C.dim };

export function MatchFeed({ d }: { d: MatchDriver }) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const lines = d.log.slice(-40);
  const energy = Math.round(d.liveEnergyAt(d.matchMinute));
  const modes: EnergyMode[] = ["low", "medium", "high"];
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 6 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {lines.map((l, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8 }}>
            <Text style={{ color: C.dim, width: 40, fontWeight: "800", textAlign: "right" }}>{l.minute !== undefined ? `${minuteLabel(l.minute, d.ADDED, d.MATCH_DURATION)}'` : ""}</Text>
            <Text style={{ flex: 1, color: TONE_COLOR[l.tone] ?? C.text, fontWeight: l.tone === "goal" || l.tone === "period" ? "900" : "600", fontSize: 15 }}>{l.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ padding: 12, gap: 10, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.panel }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: C.text, fontWeight: "900", width: 70 }}>ENERGY</Text>
          <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: C.panel2, overflow: "hidden" }}>
            <View style={{ width: `${energy}%`, height: "100%", backgroundColor: energy > 50 ? C.green : energy > 25 ? C.gold : C.red }} />
          </View>
          <Text style={{ color: C.text, fontWeight: "800", width: 40, textAlign: "right" }}>{energy}%</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {modes.map((m) => (
            <Press key={m} onPress={() => d.setEnergyMode(m)} style={{ flex: 1, paddingVertical: 9, borderRadius: R.pill, backgroundColor: d.energyMode === m ? C.green : C.panel2 }}>
              <Text style={{ textAlign: "center", fontWeight: "900", color: d.energyMode === m ? "#05261a" : C.text }}>{m === "low" ? "Low" : m === "medium" ? "Medium" : "High"}</Text>
            </Press>
          ))}
          <Press onPress={() => d.setSpeed(d.speed >= 4 ? 1 : d.speed * 2)} style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: R.pill, backgroundColor: C.panel2 }}>
            <Text style={{ fontWeight: "900", color: C.gold }}>{d.speed}x</Text>
          </Press>
        </View>
      </View>
    </View>
  );
}

/** Half time, full time, coming on: the one button the match waits for. */
export function MatchPause({ d }: { d: MatchDriver }) {
  const p = d.pause;
  if (!p) return null;
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)" }}>
      {p.label ? <Text style={{ color: C.text, fontSize: 22, fontWeight: "900", marginBottom: 14 }}>{p.label}</Text> : null}
      <Press onPress={() => d.continuePause()} style={{ backgroundColor: C.green, borderRadius: R.card, paddingVertical: 16, paddingHorizontal: 34 }}>
        <Text style={{ color: "#05261a", fontWeight: "900", fontSize: 18 }}>{p.cta}</Text>
      </Press>
    </View>
  );
}
