// The commentary screen between chances (the website's "feed" phase): the lines as the clock reaches them, energy and speed.
import { useRef, type ComponentRef } from "react";
import { View, Text, ScrollView } from "react-native";
import type { EnergyMode } from "@/lib/star/energy";
import type { Playstyle } from "@/lib/star/types";
import { minuteLabel } from "@/lib/star/addedTime";
import type { MatchDriver } from "../match/driver";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";

// MatchCommentary's three playstyles, in its order, with PlaystyleIcon's glow colours.
const PLAYSTYLES: Playstyle[] = ["defensive", "balanced", "attacking"];
const PLAYSTYLE_GLOW: Record<Playstyle, string> = { defensive: "56,189,248", balanced: "226,232,240", attacking: "244,114,182" };
const PLAYSTYLE_ICON: Record<Playstyle, string> = { defensive: "🛡️", balanced: "⚖️", attacking: "⚔️" };
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
      {/* The playstyle buttons, floating just above the energy panel (MatchCommentary's): the chosen one full size with a glow ring. */}
      <View style={{ position: "absolute", right: 8, bottom: 112, flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
        {PLAYSTYLES.map((ps) => {
          const on = d.playstyle === ps, px = on ? 42 : 32;
          return (
            <Press key={ps} onPress={() => d.setPlaystyle(ps)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: px, height: px, borderRadius: px / 2, alignItems: "center", justifyContent: "center", opacity: on ? 1 : 0.55, backgroundColor: "#0b1220", borderWidth: on ? 2 : 0, borderColor: `rgba(${PLAYSTYLE_GLOW[ps]},0.85)` }}>
                <Text style={{ fontSize: on ? 20 : 15 }}>{PLAYSTYLE_ICON[ps]}</Text>
              </View>
            </Press>
          );
        })}
      </View>
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
      {p.halfTime && <Text style={{ color: C.text, fontWeight: "800", marginBottom: 10 }}>Energy {Math.round(d.liveEnergyAt(d.matchMinute))}%</Text>}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {/* Half time only: drink a Basic KIB can (+65) before the second half (MatchCommentary's "Use can"). */}
        {p.halfTime && (
          <Press onPress={() => d.drinkHalfTimeKib()} disabled={d.kibCansLeft() <= 0 || d.energy >= 100}
            style={{ backgroundColor: d.kibCansLeft() <= 0 || d.energy >= 100 ? "#374151" : "#f97316", borderRadius: R.card, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: d.kibCansLeft() <= 0 ? "#fff" : "#030712", fontWeight: "900", fontSize: 11 }}>USE CAN</Text>
            <Text style={{ color: d.kibCansLeft() <= 0 ? "#fff" : "#030712", fontWeight: "900", fontSize: 15 }}>×{d.kibCansLeft()}</Text>
          </Press>
        )}
        <Press onPress={() => d.continuePause()} style={{ backgroundColor: C.green, borderRadius: R.card, paddingVertical: 16, paddingHorizontal: 34 }}>
          <Text style={{ color: "#05261a", fontWeight: "900", fontSize: 18 }}>{p.cta}</Text>
        </Press>
      </View>
    </View>
  );
}
