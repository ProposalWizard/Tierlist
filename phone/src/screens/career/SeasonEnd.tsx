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
    <Frame kicker={`Season ${stats.season}`} title="Season Awards"
      footer={<Btn label="Continue" onPress={() => go(flow.continueAfterRollover())} />}>
      {/* SeasonAwardsScreen.tsx: trophy tiles two across (cup, competition, the winner's badge),
          then each award as its own card with the winner's head, badge and big number. */}
      <Label>Trophies</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {trophies.map((t) => (
          <View key={t.competition} style={{ width: "48.5%", borderRadius: 12, padding: 10, gap: 6, backgroundImage: "linear-gradient(180deg, rgba(30,58,95,0.85), rgba(10,22,40,0.9))", borderWidth: 1, borderColor: t.isYou ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.14)" } as ViewStyle}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <TrophyImage name={t.competition} height={22} fallback="🏆" />
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
      {stats.teamOfSeason.length > 0 && (
        <Card>
          <Label>Team of the Season</Label>
          {stats.teamOfSeason.map((m, i) => <Row key={i} k={`${m.label ?? m.role} · ${m.name}`} v={shortClub(m.club)} color={m.isYou ? C.green : C.text} />)}
        </Card>
      )}
      {(career.lastSeasonRecords?.length ?? 0) > 0 && (
        <Card tone={C.gold}>
          <Label>Your records broken</Label>
          {career.lastSeasonRecords!.map((r) => <Row key={r.label + r.unlocked} k={`🏆 ${r.label}`} v="" sub={r.unlocked} />)}
        </Card>
      )}
      {career.lastWorld && <Btn kind="plain" label="🌍 Every league and cup" onPress={() => nav.go("season-review")} />}
    </Frame>
  );
}
