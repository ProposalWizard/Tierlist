/**
 * THE STAR PASS — the phone port of components/star/StarRatingSheet.tsx.
 * Your star level (1-100) and title, how far to the next, the gate holding
 * you (if one is), where your Star Points came from, then the road: every
 * reward level, claimable the moment you reach it ("Use it" or "Later"),
 * claimed, or still ahead. Claiming is the game's own starPassClaim
 * (claimLevel, equipCard).
 *
 * The layout is the one built into the game (rewardCatalogue
 * DEFAULT_PASS_LEVELS): the website also fetches an admin-edited layout from
 * its server; the phone app works offline and uses the built-in one.
 * Placeholder: reward pictures (an icon per kind until the art is on the phone).
 */
import { useMemo, useState } from "react";
import { FlatList, Modal, Text, View } from "react-native";
import { starStatus, starTitle, MAX_LEVEL } from "@/lib/star/starPoints";
import { rewardLevelsOf, rewardTier } from "@/lib/star/starPassRewards";
import { findCard, fullCatalogue, DEFAULT_PASS_LEVELS, type CatalogueItem, type RewardCategory } from "@/lib/star/rewardCatalogue";
import { claimableLevels, claimLevel, equipCard, isClaimed } from "@/lib/star/starPassClaim";
import { useCareer, setCareer, getCareer } from "../../game/store";
import { useNav } from "../../nav";
import { C } from "../../ui/theme";
import { ScreenFrame, Btn, Meter, rgba } from "../../world/ui";

const ICON: Record<RewardCategory, string> = {
  "penalty-runup": "🥅", "freekick-runup": "🎯", celebration: "🙌", wearable: "🧢", boots: "👟", ball: "⚽", vehicle: "🚗",
  watch: "⌚", home: "🏠", outfit: "👕", cabinet: "🏆", other: "🎁",
};
const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");

export function StarPassScreen() {
  const career = useCareer();
  const nav = useNav();
  const catalogue = useMemo(() => fullCatalogue(), []);
  const levels = DEFAULT_PASS_LEVELS;
  const [reveal, setReveal] = useState<number | null>(null);
  if (!career) return null;
  const st = starStatus(career);
  const cardAt = (n: number) => findCard(levels[n], catalogue);
  const stops = rewardLevelsOf(levels);
  const claimable = new Set(claimableLevels(career, levels, st.stars));
  const nextReward = stops.find((n) => n > st.stars);
  const rows: [string, number][] = [
    ["Matches", st.points.match], ["Trophies", st.points.trophies], ["Awards", st.points.awards],
    ["Milestones", st.points.milestones], ["Fame", st.points.status], ...(st.carry > 0 ? [["Carried", st.carry] as [string, number]] : []),
  ];
  const road = [...stops].reverse();
  const shown = reveal !== null ? cardAt(reveal) : undefined;

  return (
    <ScreenFrame title="Star Pass" kicker={starTitle(st.stars)} onBack={() => nav.back()} scroll={false}>
      <FlatList
        data={road}
        keyExtractor={(n) => String(n)}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 6 }}>
            <View style={{ backgroundColor: C.panel, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: rgba("#fbbf24", 0.5) }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ color: C.gold, fontWeight: "900", fontSize: 44, fontStyle: "italic" }}>★{st.stars}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: C.text, fontWeight: "900" }}>{fmt(st.total)} Star Points</Text>
                  {st.stars < MAX_LEVEL && !st.gate ? <Meter value={st.toNext * 100} color={C.gold} /> : null}
                  {st.spToNext > 0 && !st.gate ? <Text style={{ color: C.dim, fontWeight: "700", fontSize: 11 }}>{fmt(st.spToNext)} to ★{st.stars + 1}</Text> : null}
                  {st.gate ? <Text style={{ color: C.text, fontWeight: "900", fontSize: 12 }}>🔒 {st.gate.need}</Text> : null}
                  {nextReward ? <Text style={{ color: C.dim, fontWeight: "700", fontSize: 11 }}>Next reward at ★{nextReward}</Text> : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {rows.map(([k, v]) => (
                  <View key={k} style={{ backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: C.dim, fontSize: 9, fontWeight: "900" }}>{k.toUpperCase()}</Text>
                    <Text style={{ color: C.text, fontWeight: "900" }}>{fmt(v)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        }
        renderItem={({ item: n }) => {
          const card = cardAt(n);
          if (!card) return null;
          const claimed = isClaimed(career, n);
          const canClaim = claimable.has(n);
          const reached = n <= st.stars;
          const great = rewardTier(n) === "great";
          return (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.panel, borderRadius: 16, padding: 10, borderWidth: 1.5, borderColor: canClaim ? C.gold : great ? rgba("#a855f7", 0.6) : C.line, opacity: reached || canClaim ? 1 : 0.7 }}>
              <View style={{ width: 44, alignItems: "center" }}>
                <Text style={{ color: reached ? C.gold : C.dim, fontWeight: "900", fontSize: 16 }}>★{n}</Text>
              </View>
              <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: great ? rgba("#a855f7", 0.3) : "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 26 }}>{ICON[card.category] ?? "🎁"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900" }}>{card.name}</Text>
                {card.note ? <Text numberOfLines={2} style={{ color: C.dim, fontSize: 11, fontWeight: "700" }}>{card.note}</Text> : null}
              </View>
              {card.comingSoon ? <Text style={{ color: C.dim, fontWeight: "900", fontSize: 11 }}>Soon</Text>
                : claimed ? <Text style={{ color: C.green, fontWeight: "900", fontSize: 11 }}>✓ Yours</Text>
                : canClaim ? <Btn label="Claim" onPress={() => setReveal(n)} style={{ paddingVertical: 8 }} />
                : <Text style={{ color: C.dim, fontSize: 16 }}>🔒</Text>}
            </View>
          );
        }}
      />
      <Modal visible={reveal !== null && !!shown} transparent animationType="fade" onRequestClose={() => setReveal(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          {shown && reveal !== null && <Reveal card={shown} level={reveal}
            onLater={() => { const c = getCareer(); if (c) setCareer(claimLevel(c, reveal, shown, starStatus(c).stars)); setReveal(null); }}
            onUse={() => { const c = getCareer(); if (c) setCareer(equipCard(claimLevel(c, reveal, shown, starStatus(c).stars), shown)); setReveal(null); }} />}
        </View>
      </Modal>
    </ScreenFrame>
  );
}

function Reveal({ card, level, onLater, onUse }: { card: CatalogueItem; level: number; onLater: () => void; onUse: () => void }) {
  return (
    <View style={{ width: "100%", backgroundColor: C.panel, borderRadius: 22, padding: 20, alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: C.gold }}>
      <Text style={{ color: C.gold, fontWeight: "900", letterSpacing: 2, fontSize: 11 }}>★{level} REWARD</Text>
      <Text style={{ fontSize: 80 }}>{ICON[card.category] ?? "🎁"}</Text>
      <Text style={{ color: C.text, fontWeight: "900", fontSize: 22, textAlign: "center" }}>{card.name}</Text>
      {card.note ? <Text style={{ color: C.dim, fontWeight: "700", textAlign: "center" }}>{card.note}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: 6 }}>
        <Btn style={{ flex: 1 }} tone="plain" label="Later" onPress={onLater} />
        <Btn style={{ flex: 1 }} tone="green" label="Use it" onPress={onUse} />
      </View>
    </View>
  );
}
