// The live shootout's strip over the pitch (the website's LiveShootout.tsx ShootoutStrip): both rows of kicks, the score, who is next.
import { View, Text } from "react-native";
import { INITIAL_KICKS_PER_SIDE, type ShootoutSide } from "@/lib/star/shootout";
import { shortClub } from "@/lib/star/media/grammar";
import type { MatchKits } from "@/lib/star/kits";
import type { MatchDriver } from "../match/driver";
import { PopIn } from "./career/lookBits";

export function MatchShootout({ d, kits }: { d: MatchDriver; kits: MatchKits }) {
  const so = d.shootout;
  if (!so) return null;
  const st = so.state;
  const round = Math.max(1, Math.ceil((st.kicks.length + 1) / 2));
  const sudden = round > INITIAL_KICKS_PER_SIDE && !st.over;
  const winner = st.over ? (st.winner === "home" ? so.homeClub : so.awayClub) : null;
  const colour = (s: ShootoutSide) => (s === "home" ? kits.home.shirt : kits.away.shirt);
  const row = (s: ShootoutSide) => {
    const ks = st.kicks.filter((k) => k.side === s);
    const slots = Math.max(INITIAL_KICKS_PER_SIDE, ks.length);
    return Array.from({ length: slots }, (_, i) => ks[i]);
  };
  const side = (s: ShootoutSide, name: string, right: boolean) => (
    <View style={{ flex: 1, alignItems: right ? "flex-end" : "flex-start" }}>
      <Text numberOfLines={1} style={{ color: colour(s), fontSize: 10, lineHeight: 15, fontWeight: "900" }}>{shortClub(name)}</Text>
      <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
        {row(s).map((k, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center", borderWidth: k ? 0 : 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: !k ? "transparent" : k.scored ? "#10b981" : "#dc2626" }}>
            {k && <Text style={{ color: "#fff", fontSize: 8, lineHeight: 10, fontWeight: "900" }}>{k.scored ? "✓" : "✗"}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 6, right: 6, bottom: 6, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(3,7,18,0.8)", paddingHorizontal: 10, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 15 }}>
        <Text style={{ color: "#fcd34d", fontSize: 9, lineHeight: 14, fontWeight: "900", letterSpacing: 1.62 }}>{st.over ? "PENALTIES — FINAL" : sudden ? "SUDDEN DEATH" : "PENALTY SHOOTOUT"}</Text>
        {so.upNext && <Text numberOfLines={1} style={{ flexShrink: 1, color: "rgba(255,255,255,0.85)", fontSize: 10, lineHeight: 15, fontWeight: "700" }}>Next: <Text style={{ color: colour(so.upNext.side), fontWeight: "900" }}>{so.upNext.name}</Text></Text>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
        {side("home", so.homeClub, false)}
        <Text style={{ color: "#fde68a", fontSize: 18, lineHeight: 28, fontWeight: "900" }}>{st.homeScore}–{st.awayScore}</Text>
        {side("away", so.awayClub, true)}
      </View>
      {so.final && winner && (
        <PopIn>
          <Text style={{ marginTop: 4, textAlign: "center", color: "#6ee7b7", fontSize: 12, lineHeight: 16, fontWeight: "900", letterSpacing: 0.3 }}>
            {shortClub(winner).toUpperCase()} WIN {Math.max(st.homeScore, st.awayScore)}–{Math.min(st.homeScore, st.awayScore)} ON PENALTIES
          </Text>
        </PopIn>
      )}
    </View>
  );
}
