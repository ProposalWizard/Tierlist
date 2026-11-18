/**
 * TALKING TERMS — the phone port of components/star/NegotiationScreen.tsx.
 * The haggle itself is the game's own (lib/star/negotiation.ts:
 * startNegotiation, makeOffer, moodToFace); this only draws it: the other
 * side's face and mood, your number and theirs, the log, your offer with − / +
 * (the same money steps) or typed, Accept, Walk away, and the final-offer
 * "take it or leave it".
 *
 * Used by the transfer window (terms with a club, a weekly wage) and by
 * Sponsors ("More money" on an offer).
 */
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { niceMoneyStep, formatMoneyPrecise } from "@/lib/star/money";
import { startNegotiation, makeOffer, moodToFace, type NegotiationMode, type NegotiationState, type CounterpartMood } from "@/lib/star/negotiation";
import { Press } from "../../ui/Press";
import { C } from "../../ui/theme";
import { Btn, rgba, clubGlow } from "../../world/ui";

const money = (n: number) => formatMoneyPrecise(n);
const MOOD_LABEL: Record<CounterpartMood, string> = { happy: "Feeling good about this", neutral: "Getting down to business", angry: "Losing patience" };
const MOOD_FACE: Record<CounterpartMood, string> = { happy: "😊", neutral: "😐", angry: "😠" };
const MOOD_COLOUR: Record<CounterpartMood, string> = { happy: "#34d399", neutral: "#64748b", angry: "#ef4444" };

function logColour(line: string): string {
  if (/deal|close enough|split the difference/i.test(line)) return "#6ee7b7";
  if (/walk|out of time/i.test(line)) return "#fca5a5";
  if (/^you /i.test(line)) return "#7dd3fc";
  return "#fcd34d";
}

export interface NegotiationProps {
  mode: NegotiationMode;
  playerName: string;
  marketValue: number;
  counterpartLabel?: string;
  initialState?: NegotiationState;
  /** Step away to check other clubs, keeping these talks as they stand (the boardroom's sale list). */
  onStepAway?: (state: NegotiationState) => void;
  /** Done: the agreed number, or null (walked away / no deal). */
  onDone: (finalPrice: number | null) => void;
  kicker?: string;
  valueLabel?: string;
  /** Show their offer (not the market value) as the headline number. */
  valueIsTheirOffer?: boolean;
  note?: string;
}

export function Negotiation({ mode, playerName, marketValue, counterpartLabel, initialState, onStepAway, onDone, kicker, valueLabel, note, valueIsTheirOffer }: NegotiationProps) {
  const inset = useSafeAreaInsets();
  const [state, setState] = useState<NegotiationState>(() => initialState ?? startNegotiation(marketValue, mode, Math.random));
  const [amount, setAmount] = useState(() => (initialState ? state.yourPosition : state.theirPosition));
  const [typed, setTyped] = useState<string | null>(null);
  const asked = state.round > 0 || !!initialState;
  const mood = moodToFace(state);
  const finished = state.status !== "negotiating";
  const glow = counterpartLabel ? clubGlow(counterpartLabel) : "#3b82f6";
  const nudge = (dir: 1 | -1) => { setTyped(null); setAmount((a) => Math.max(1, a + dir * niceMoneyStep(dir < 0 ? a - 1 : a))); };
  const propose = (value: number) => {
    if (finished || !(value >= 1)) return;
    const next = makeOffer(state, Math.max(1, Math.round(value)), Math.random);
    setTyped(null);
    setState(next);
    setAmount(next.yourPosition);
  };
  const counterpartName = counterpartLabel ?? (mode === "buying" ? "Their Agent" : "Interested Buyer");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: inset.top + 16, paddingBottom: inset.bottom + 30, gap: 12 }}>
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: "#7dd3fc", fontWeight: "900", fontSize: 11, letterSpacing: 3 }}>{(kicker ?? (mode === "buying" ? "Negotiating a Signing" : "Negotiating a Sale")).toUpperCase()}</Text>
        <Text style={{ color: C.text, fontWeight: "900", fontSize: 22, textAlign: "center", marginTop: 4 }}>{playerName.toUpperCase()}</Text>
        <Text style={{ color: C.dim, fontWeight: "700", marginTop: 2 }}>{valueLabel ?? "Estimated value"}: <Text style={{ color: C.gold }}>★{money(valueIsTheirOffer ? state.theirPosition : marketValue)}</Text></Text>
        {note ? <Text style={{ color: C.text, fontWeight: "700", fontSize: 12, marginTop: 2 }}>{note}</Text> : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.panel, borderRadius: 16, padding: 12, borderWidth: 2, borderColor: rgba(MOOD_COLOUR[mood], 0.8) }}>
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: rgba(glow.startsWith("#") ? glow : "#3b82f6", 0.35), alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 34 }}>{MOOD_FACE[mood]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{mode === "buying" ? "THEIR AGENT" : "INTERESTED BUYER"}</Text>
          <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 16 }}>{counterpartName}</Text>
          <Text style={{ color: MOOD_COLOUR[mood], fontWeight: "800", fontSize: 12 }}>{MOOD_LABEL[mood]}</Text>
        </View>
      </View>

      <View style={{ backgroundColor: C.panel, borderRadius: 16, padding: 10, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(14,116,144,0.25)", borderRadius: 12, padding: 10 }}>
          <Text style={{ fontSize: 20 }}>🤝</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#7dd3fc", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{mode === "buying" ? "YOU'RE OFFERING" : "YOU'RE ASKING"}</Text>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 19 }}>{asked ? `★${money(state.yourPosition)}` : "Nothing yet"}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(180,83,9,0.25)", borderRadius: 12, padding: 10 }}>
          <Text style={{ fontSize: 20 }}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fcd34d", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{mode === "buying" ? "THEIR ASKING PRICE" : "THEIR OFFER"}</Text>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 19 }}>★{money(state.theirPosition)}</Text>
          </View>
          <Text style={{ color: C.dim, fontWeight: "800", fontSize: 11 }}>Round {state.round + (finished ? 0 : 1)}</Text>
        </View>
      </View>

      <View style={{ backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 12, padding: 10, gap: 3 }}>
        {state.log.slice(-6).map((line, i) => <Text key={i} style={{ color: logColour(line), fontWeight: "700", fontSize: 12 }}>{line}</Text>)}
      </View>

      {!finished && state.finalOffer && (
        <>
          <View style={{ backgroundColor: "rgba(127,29,29,0.45)", borderRadius: 14, padding: 12, alignItems: "center" }}>
            <Text style={{ color: "#fca5a5", fontWeight: "900", fontSize: 11, letterSpacing: 2 }}>FINAL OFFER</Text>
            <Text style={{ color: C.text, fontWeight: "900" }}>Take ★{money(state.theirPosition)} or leave it</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn style={{ flex: 1 }} label="📄 Accept" onPress={() => propose(state.theirPosition)} />
            <Btn style={{ flex: 1 }} tone="red" label="🚪 Walk away" onPress={() => onDone(null)} />
          </View>
        </>
      )}

      {!finished && !state.finalOffer && (
        <>
          <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>YOUR OFFER</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: C.panel2, borderRadius: 12, paddingHorizontal: 12 }}>
              <Text style={{ color: C.gold, fontWeight: "900", fontSize: 16 }}>★</Text>
              <TextInput
                value={typed ?? amount.toLocaleString("en-GB")}
                keyboardType="number-pad"
                selectTextOnFocus
                onChangeText={(t) => {
                  const digits = t.replace(/[^0-9]/g, "").replace(/^0+/, "");
                  setTyped(digits ? Number(digits).toLocaleString("en-GB") : "");
                  setAmount(digits ? Number(digits) : 0);
                }}
                onBlur={() => { setTyped(null); setAmount((a) => Math.max(1, a)); }}
                style={{ flex: 1, color: C.text, fontWeight: "800", fontSize: 17, paddingVertical: 10, marginLeft: 4 }}
              />
            </View>
            <Press onPress={() => nudge(-1)} style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.text, fontSize: 24, fontWeight: "900" }}>−</Text></Press>
            <Press onPress={() => nudge(1)} style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.text, fontSize: 24, fontWeight: "900" }}>+</Text></Press>
          </View>
          <Text style={{ color: C.dim, fontSize: 11, fontWeight: "700", textAlign: "right" }}>± ★{niceMoneyStep(amount).toLocaleString("en-GB")} per press</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Btn style={{ flex: 1 }} tone="green" label={mode === "buying" ? "🤝 Make offer" : "🤝 Set asking price"} onPress={() => propose(amount)} />
            <Btn style={{ flex: 1 }} label="📄 Accept offer" onPress={() => propose(state.theirPosition)} />
          </View>
          <Btn tone="red" label="🚪 Walk away" onPress={() => onDone(null)} />
          {onStepAway ? <Btn tone="plain" label="Step Away (check other interested clubs)" onPress={() => onStepAway(state)} /> : null}
        </>
      )}

      {finished && (
        <>
          <View style={{ borderRadius: 14, padding: 16, alignItems: "center", backgroundColor: state.status === "accepted" ? "rgba(6,95,70,0.5)" : "rgba(127,29,29,0.45)" }}>
            <Text style={{ color: state.status === "accepted" ? "#6ee7b7" : "#fca5a5", fontWeight: "900", fontSize: 16, textAlign: "center" }}>
              {state.status === "accepted" ? `🤝 Deal agreed — ★${money(state.finalPrice ?? 0)}`
                : state.status === "rejected" ? "🚪 No deal — talks broke down"
                : mode === "buying" ? "🚪 They walked away, angry" : "🚪 The buyer walked away, angry"}
            </Text>
          </View>
          <Btn tone={state.status === "accepted" ? "green" : "plain"} label="Continue" onPress={() => onDone(state.status === "accepted" ? (state.finalPrice ?? null) : null)} />
        </>
      )}
    </ScrollView>
  );
}
