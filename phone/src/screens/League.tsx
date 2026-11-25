import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import { followedClubs, followedFixtures, toggleFollowedClub, setLiveScoreWeek } from "@/lib/star/matchDayPrefs";
import { nextFixtureFor } from "@/lib/star/competitions";
import { LEAGUE_SCREEN_TOUR } from "@/lib/star/tours";
import { recordLeagueVisit } from "@/lib/star/unlocks";
import { shortClub } from "@/lib/star/media/grammar";
import { WorldPane } from "./world/WorldPane";
import { Backdrop } from "../ui/look";
import { GameTop } from "../world/chrome";
import { useScreenHelp } from "../world/help";
import { ClubBadge } from "../world/ui";
import { getCareer, setCareer } from "../game/store";
import { installWebStorage } from "../match/webStorage";
import { Press } from "../ui/Press";

/**
 * THE LEAGUE PAGE (the website's MatchWeek.tsx since 22 Oct 2026): one page,
 * every league, cup and international competition from one picker
 * (screens/world/WorldPane.tsx), opening on your own league's table.
 * Beside the title: the 🔔 live-score bell (tick clubs whose goals pop up
 * during your match) and the "?" that replays the League's pointer tour.
 */
export function League({ career }: { career: CareerState }) {
  const [bell, setBell] = useState(false);
  const [ticks, setTicks] = useState<string[]>(() => { installWebStorage(); return followedClubs(); });
  const next = nextFixtureFor(career);
  // Tell the live-score pop-ups which week is coming, as the website does.
  useEffect(() => { if (next) setLiveScoreWeek(career.season, next.week); }, [career.season, next?.week]); // eslint-disable-line react-hooks/exhaustive-deps
  const rung = ticks.length > 0 || followedFixtures().some((f) => f.season === career.season);
  const help = useScreenHelp("league", career, {
    seenKey: "league-intro", first: LEAGUE_SCREEN_TOUR,
    onFirstDone: () => { const c = getCareer(); if (c) setCareer(recordLeagueVisit(c)); },
  });
  return (
    <View style={{ flex: 1, backgroundColor: "#0b1a2e" }}>
      <Backdrop kind="stadium" />
      <GameTop career={career} help={null} under="#05070d" />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 8, paddingBottom: 8 }}>
        <Text style={{ color: "#fff", fontSize: 15, lineHeight: 22, fontWeight: "900", letterSpacing: 0.4 }}>LEAGUE</Text>
        <Square onPress={() => setBell(true)}>
          <Text style={{ fontSize: 13, lineHeight: 16 }}>🔔</Text>
          {rung ? <View style={{ position: "absolute", right: -4, top: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" }} /> : null}
        </Square>
        <Square onPress={help.open}><Text style={{ color: "#fcd34d", fontWeight: "900", fontSize: 14, lineHeight: 17 }}>?</Text></Square>
      </View>
      <WorldPane career={career} />
      {bell ? <AlertsSheet career={career} ticks={ticks} onTick={(c) => setTicks(toggleFollowedClub(c))} onClose={() => setBell(false)} /> : null}
      {help.node}
    </View>
  );
}

/** The website's 22 px grey square beside the title (bell, ?). */
function Square({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Press onPress={onPress} hitSlop={9} style={{ width: 22, height: 22, borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundColor: "#4b5563" }}>
      {children}
    </Press>
  );
}

/** The bell: tick a club to see its goals pop up during your match. Two columns of crests, no sentences. */
function AlertsSheet({ career, ticks, onTick, onClose }: { career: CareerState; ticks: string[]; onTick: (club: string) => void; onClose: () => void }) {
  const inset = useSafeAreaInsets();
  const vp = useWindowDimensions();
  const clubs = career.league.map((t) => t.name).filter((n) => n !== career.player.club).sort();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: "#07110c", boxShadow: "inset 0px 2px 0px rgba(255,255,255,0.3)", paddingBottom: Math.max(10, inset.bottom) } as ViewStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.2)" }}>
            <Text style={{ fontSize: 20, lineHeight: 24 }}>🔔</Text>
            <Text style={{ flex: 1, color: "#fff", fontSize: 18, lineHeight: 27, fontWeight: "900", letterSpacing: 0.45 }}>LIVE SCORES</Text>
            <Text style={{ color: "#fcd34d", fontSize: 16, lineHeight: 24, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{ticks.length}</Text>
            <Press onPress={onClose} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>✕</Text>
            </Press>
          </View>
          <ScrollView style={{ maxHeight: vp.height * 0.62 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", backgroundColor: "rgba(0,0,0,0.4)", padding: 1, gap: 1 } as ViewStyle}>
            {clubs.map((club) => {
              const on = ticks.includes(club);
              return (
                <Press key={club} onPress={() => onTick(club)} style={{ width: (vp.width - 3) / 2, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: on ? "#fbbf24" : "#0c1a12" }}>
                  <ClubBadge club={club} size={22} />
                  <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: on ? "#030712" : "#fff", fontSize: 14, lineHeight: 14, fontWeight: "900", textTransform: "uppercase" }}>{shortClub(club)}</Text>
                  {/* an unticked bell is greyed: opacity .35 and no colour (the website's opacity-35 grayscale) */}
                  <View style={on ? null : ({ opacity: 0.35, filter: [{ grayscale: 1 }] } as ViewStyle)}><Text style={{ fontSize: 15, lineHeight: 22.5 }}>🔔</Text></View>
                </Press>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
