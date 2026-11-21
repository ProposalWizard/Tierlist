/**
 * THE END OF THE SEASON, in page.tsx's order: the Golden Ball night
 * (Ceremonies.tsx), the final-season notice or the final whistle, then (after
 * the rollover) the Season Awards night (Ceremonies.tsx) and this page after
 * it (SeasonAwardsScreen: the individual awards, every trophy handed out, the
 * Team of the Season).
 */
import { useMemo, useState } from "react";
import { View, Text, type ViewStyle } from "react-native";
import { kitsOf } from "@/lib/star/kits";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { PlayerHead } from "../../draw/PlayerHead";
import { TrophyImage } from "./Ceremonies";
import type { CareerState } from "@/lib/star/types";
import { trophyWinners } from "@/lib/star/seasonAwards";
import { careerVerdict, testimonialFor, CAREER_SEASONS } from "@/lib/star/retirement";
import { shortClub } from "@/lib/star/media/grammar";
import { careerOverview } from "@/lib/star/careerOverview";
import { clubGlow } from "../../world/ui";
import * as flow from "../../game/flow";
import { useNav } from "../../nav";
import { Frame, Card, Label, Row, Btn, ClubCrest, money, C } from "./kit";
import { Rays } from "../../ui/look/Patterns";

/** SeasonAwardsScreen.tsx TROPHY_ICON: the mark for a trophy with no picture. */
const TROPHY_ICON: Record<string, string> = { "FA Cup": "🏆", "League Cup": "🏆", "Champions League": "⭐", "Europa League": "🌍", "Community Shield": "🛡️", "Super Cup": "🛡️" };

export function SeasonAwardsScreen({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const nav = useNav();
  const stats = career.lastSeasonAwardStats;
  if (!stats) return <Frame title="Season awards"><Btn label="Continue" onPress={() => go(flow.continueAfterRollover())} /></Frame>;
  // The website's order and words (SeasonAwardsScreen.tsx AWARD_META): trophies first, then the league's awards.
  const awards: [string, string, typeof stats.goldenBoot, string][] = [
    ["👟", "Golden Boot", stats.goldenBoot, "goals"], ["🎯", "Assist King", stats.assistKing, "assists"], ["🧤", "Golden Glove", stats.goldenGlove, "clean sheets"],
    ["🌟", "Player of the Season", stats.playerOfSeason, "votes"], ["💎", "Young Player of the Season", stats.youngPlayerOfSeason, "votes"],
  ];
  const trophies = trophyWinners(career, stats);
  return (
    <Frame bare title="Season Awards">
      {/* SeasonAwardsScreen.tsx's head: light rays, the season in amber, SEASON AWARDS in gold italics. */}
      <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 8, paddingBottom: 6 }}>
        <View pointerEvents="none" style={{ position: "absolute" }}><Rays size={260} color="rgba(253,230,138,0.2)" opacity={0.42} /></View>
        <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900", letterSpacing: 2.6 }}>{`SEASON ${stats.season}`}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 8, color: "#fde68a", fontSize: 30, lineHeight: 32, fontWeight: "900", fontStyle: "italic", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 }}>SEASON AWARDS</Text>
      </View>
      {/* SeasonAwardsScreen.tsx: trophy tiles two across (cup, competition, the winner's badge),
          then each award as its own card with the winner's head, badge and big number. */}
      <Label>Trophies</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {trophies.map((t) => (
          <View key={t.competition} style={{ width: "48.5%", borderRadius: 12, padding: 10, gap: 6, backgroundImage: "linear-gradient(180deg, rgba(30,58,95,0.85), rgba(10,22,40,0.9))", borderWidth: 1, borderColor: t.isYou ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.14)" } as ViewStyle}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TrophyImage name={t.competition} height={22} fallback={TROPHY_ICON[t.competition] ?? "🏆"} />
              <Text numberOfLines={1} style={{ flex: 1, color: "#fcd34d", fontSize: 9.5, fontWeight: "900", letterSpacing: 1.2 }}>{t.competition.toUpperCase()}</Text>
            </View>
            {t.club ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ClubCrest club={t.club} size={18} />
                <Text numberOfLines={1} style={{ flex: 1, color: t.isYou ? C.green : "#fff", fontSize: 13, fontWeight: "900" }}>{shortClub(t.club)}{t.isYou ? " (You)" : ""}</Text>
              </View>
            ) : <Text style={{ color: C.dim, fontSize: 11 }}>Not contested this season</Text>}
          </View>
        ))}
      </View>
      <Label>{`${stats.leagueName} Awards`}</Label>
      {awards.map(([icon, name, w, unit]) => {
        const kit = w ? kitsOf(w.club).home : null;
        return (
          <View key={name} style={{ borderRadius: 14, padding: 12, backgroundImage: w?.isYou ? "linear-gradient(180deg, rgba(6,78,59,0.9), rgba(2,44,34,0.92))" : "linear-gradient(180deg, rgba(30,58,95,0.85), rgba(10,22,40,0.9))", borderWidth: 1, borderColor: w?.isYou ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.14)" } as ViewStyle}>
            <Text style={{ color: "#fcd34d", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }}>{icon} {name.toUpperCase()}</Text>
            {w && kit ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden", backgroundColor: "#0b1220" }}>
                  <PlayerHead id={w.isYou ? "you" : w.name} shirt={kit.shirt} shorts={kit.trim} trim={kit.trim} size={40} skin={w.isYou ? skinToneHex(career.player.skinTone) : undefined} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{w.name}{w.isYou ? " (You)" : ""}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <ClubCrest club={w.club} size={14} />
                    <Text numberOfLines={1} style={{ color: C.dim, fontSize: 11, fontWeight: "700" }}>{shortClub(w.club)}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: "#fcd34d", fontSize: 24, fontWeight: "900", lineHeight: 26 }}>{w.value}</Text>
                  <Text style={{ color: C.dim, fontSize: 9, fontWeight: "900", letterSpacing: 1 }}>{unit.toUpperCase()}</Text>
                </View>
              </View>
            ) : <Text style={{ color: C.dim, marginTop: 6 }}>No qualifying player this season</Text>}
          </View>
        );
      })}
      {stats.teamOfSeason.length > 0 && <TeamOfSeasonPitch career={career} team={stats.teamOfSeason} />}
      {(career.lastSeasonRecords?.length ?? 0) > 0 && (
        <Card tone={C.gold}>
          <Label>Your records broken</Label>
          {career.lastSeasonRecords!.map((r) => <Row key={r.label + r.unlocked} k={`🏆 ${r.label}`} v="" sub={r.unlocked} />)}
        </Card>
      )}
      {career.lastWorld && <Btn kind="plain" label="🌍 Every league and cup" onPress={() => nav.go("season-review")} />}
      {/* at the end of the page, not pinned over the cards (SeasonAwardsScreen.tsx) */}
      <View style={{ marginTop: 8 }}><Btn label="Continue" onPress={() => go(flow.continueAfterRollover())} /></View>
    </Frame>
  );
}

/** The Team of the Season on a pitch, 4-3-3 (SeasonAwardsScreen.tsx TeamOfSeasonPitch): each man's head, his club's crest, his name. */
function TeamOfSeasonPitch({ career, team }: { career: CareerState; team: NonNullable<CareerState["lastSeasonAwardStats"]>["teamOfSeason"] }) {
  const [w, setW] = useState(0);
  const h = Math.round((w * 4) / 3);
  const line = "rgba(255,255,255,0.3)";
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ color: "rgba(252,211,77,0.9)", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 }}>TEAM OF THE SEASON</Text>
        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>4-3-3</Text>
      </View>
      <View onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ height: h || undefined, aspectRatio: h ? undefined : 0.75, borderRadius: 16, overflow: "hidden", backgroundColor: "#1a6d33", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
        {Array.from({ length: 11 }, (_, k) => <View key={k} style={{ position: "absolute", left: 0, right: 0, top: `${k * 9}%`, height: "9%", backgroundColor: k % 2 ? "#1a6d33" : "#1f7a3a" }} />)}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, backgroundColor: line }} />
        <View pointerEvents="none" style={{ position: "absolute", left: "38%", top: "43.5%", width: "24%", height: "13%", borderRadius: 999, borderWidth: 1, borderColor: line }} />
        <View pointerEvents="none" style={{ position: "absolute", left: "24%", top: -1, width: "52%", height: "13%", borderWidth: 1, borderColor: line }} />
        <View pointerEvents="none" style={{ position: "absolute", left: "24%", bottom: -1, width: "52%", height: "13%", borderWidth: 1, borderColor: line }} />
        {w > 0 && team.map((m, i) => {
          const kit = kitsOf(m.club, career.clubKits?.[m.club]).home;
          const bw = w * 0.26;
          return (
            <View key={`${m.role}-${i}`} style={{ position: "absolute", left: m.x * w - bw / 2, top: m.y * h - 26, width: bw, alignItems: "center" }}>
              <View>
                <View style={{ width: 36, height: 36, borderRadius: 18, overflow: "hidden", borderWidth: 2, borderColor: m.isYou ? "#fcd34d" : "rgba(255,255,255,0.8)", backgroundColor: kit.shirt, alignItems: "center", justifyContent: "flex-end" }}>
                  <PlayerHead id={m.isYou ? "you" : m.name} shirt={kit.shirt} shorts={kit.trim} trim={kit.trim} size={32} skin={m.isYou ? skinToneHex(career.player.skinTone) : undefined} />
                </View>
                <View style={{ position: "absolute", right: -3, bottom: -2 }}><ClubCrest club={m.club} size={14} /></View>
              </View>
              <Text numberOfLines={1} style={{ marginTop: 2, color: m.isYou ? "#fcd34d" : "#fff", fontSize: 9, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.95)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{m.isYou ? "YOU" : m.name}</Text>
              <Text numberOfLines={1} style={{ color: "#fff", fontSize: 7, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.95)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{shortClub(m.club)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
