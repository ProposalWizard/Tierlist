// The commentary screen between chances (the website's "feed" phase, MatchCommentary.tsx in the
// packed app's look): every line a bar in its team's kit, the minute in a black chip, the minute
// and speed plate, the playstyle icons, the yellow "Get out there" bar and the energy panel with
// the three lightning badges.
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { View, Text, ScrollView, Image, Pressable, Animated, Easing, type ViewStyle } from "react-native";
import { labelInk } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { ClubBadge } from "../draw/ClubBadge";
import type { EnergyMode } from "@/lib/star/energy";
import type { Playstyle } from "@/lib/star/types";
import type { MatchKits } from "@/lib/star/kits";
import type { LogLine } from "@/lib/star/matchLog";
import { minuteLabel } from "@/lib/star/addedTime";
import { liveWeekFor, goalsForFollowed, scoresAt, type LiveGoal, type LiveScoreRow } from "@/lib/star/liveScores";
import { followedTeams, toggleFollowedTeam, setLiveScoreWeek } from "@/lib/star/matchDayPrefs";
import { MIN_ENERGY_TO_START } from "@/lib/star/selection";
import type { MatchDriver } from "../match/driver";
import { Press } from "../ui/Press";
import { FONT } from "../ui/look";
import { EnergyIcon, kitRow } from "./MatchLook";

// MatchCommentary's three playstyles, in its order, with PlaystyleIcon's glow colours and pictures.
const PLAYSTYLES: Playstyle[] = ["defensive", "balanced", "attacking"];
const PLAYSTYLE_GLOW: Record<Playstyle, string> = { defensive: "56,189,248", balanced: "226,232,240", attacking: "244,114,182" };
/* eslint-disable @typescript-eslint/no-require-imports */
const PLAYSTYLE_PIC: Record<Playstyle, number> = {
  defensive: require("../../assets/look/match/playstyle-defensive.webp"),
  balanced: require("../../assets/look/match/playstyle-balanced.webp"),
  attacking: require("../../assets/look/match/playstyle-attacking.webp"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** In the pitch look the feed's grays are deep greens (pitchLook.css: gray-950/900/800/700). */
const G950 = "rgb(12,71,38)", G900 = "rgb(16,82,47)", G800 = "rgb(21,95,56)", G700 = "rgb(29,107,65)";
/** Each line its own panel: a soft gloss down it and a hard seam at its foot (.kib-line). */
const LINE_GLOSS = {
  backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.16) 100%)",
  boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.16), inset 0px -1px 0px rgba(0,0,0,0.4)",
} as ViewStyle;

function FeedLine({ l, d, kits }: { l: LogLine; d: MatchDriver; kits: MatchKits }) {
  const shown = l.minute !== undefined ? minuteLabel(l.minute, d.ADDED, d.MATCH_DURATION) : "";
  const home = d.setup.fixture.home !== false;
  const userKit = home ? kits.home : kits.away, oppKit = home ? kits.away : kits.home;
  const chip = (
    <View style={{ minWidth: 24, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 2, paddingVertical: 2, alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900" }}>{shown}</Text>
    </View>
  );
  if (l.tone === "period") {
    return (
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(21,95,56,0.8)", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.1)" }, LINE_GLOSS]}>
        {l.minute !== undefined && <Text style={{ minWidth: 24, color: "#fff", fontSize: 10, fontWeight: "900" }}>{shown}</Text>}
        <Text style={{ flex: 1, textAlign: "center", color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>{l.text.toUpperCase()}</Text>
        {l.minute !== undefined && <View style={{ width: 24 }} />}
      </View>
    );
  }
  if (l.tone === "elsewhere") {
    return (
      <View style={[{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 12, paddingRight: 64, paddingVertical: 6, backgroundColor: "rgba(8,47,73,0.9)" }, LINE_GLOSS]}>
        {chip}
        <Text style={{ flex: 1, color: "#e0f2fe", fontSize: 11, fontWeight: "700", lineHeight: 15 }}>{l.text}</Text>
      </View>
    );
  }
  const kit = l.tone === "goal" || l.tone === "you" || l.tone === "chance" ? userKit
    : l.tone === "assist" ? (l.isOpponent ? oppKit : userKit)
      : l.tone === "oppGoal" ? oppKit
        : l.tone === "play" && l.isOpponent !== undefined ? (l.isOpponent ? oppKit : userKit)
          : null;
  const row = kit ? kitRow(kit.shirt) : { backgroundColor: "transparent", color: "#fff" };
  const weight = l.tone === "goal" || l.tone === "oppGoal" ? "900" : kit ? "700" : "400";
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingLeft: l.tone === "assist" ? 32 : 12, paddingRight: 64, paddingVertical: 6, backgroundColor: row.backgroundColor }, LINE_GLOSS]}>
      {chip}
      <Text style={{ flex: 1, color: row.color, fontSize: 12, fontWeight: weight, lineHeight: 16 }}>{l.text}</Text>
    </View>
  );
}

// components/star/KickOffCard.tsx: you look out of the players' tunnel onto a floodlit pitch; "THE TEAMS
// WALK OUT / KICK OFF" in the dark top, both crests over name bars in their shirts in the dark bottom.
// The floodlights breathe and the words rise in, as on the website.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const KICKOFF_BG = require("../../assets/look/match/kickoff-bg.webp") as number;
function KickOffCard({ d, kits }: { d: MatchDriver; kits: MatchKits }) {
  const lights = useRef(new Animated.Value(0.55)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const glint = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(lights, { toValue: 0.95, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(lights, { toValue: 0.55, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const b = Animated.timing(rise, { toValue: 1, duration: 550, easing: Easing.out(Easing.ease), useNativeDriver: true });
    const g = Animated.loop(Animated.sequence([Animated.delay(600), Animated.timing(glint, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.delay(1100)]));
    a.start(); b.start(); g.start();
    return () => { a.stop(); b.stop(); g.stop(); };
  }, [lights, rise, glint]);
  const home = d.setup.fixture.home !== false;
  const us = d.setup.career.player.club, them = d.setup.fixture.opponent;
  const sides: [string, { shirt: string; trim: string }][] = [[home ? us : them, kits.home], [home ? them : us, kits.away]];
  const up = { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] };
  const shadow = { textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 };
  const side = ([club, kit]: [string, { shirt: string; trim: string }]) => (
    <View key={club} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 4 }}>
      <ClubBadge club={club} kit={kit as never} size={40} shadow />
      <View style={{ alignSelf: "stretch", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 2, backgroundColor: kit.shirt,
        boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.3), inset 0px -2px 0px ${kit.trim}, 0px 6px 14px -6px rgba(0,0,0,0.9)` } as ViewStyle}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ textAlign: "center", color: labelInk(kit.shirt), fontSize: 12, lineHeight: 13, fontWeight: "900" }}>{shortClub(club).toUpperCase()}</Text>
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1, minHeight: 230, marginVertical: 8, marginHorizontal: 12, overflow: "hidden",
      backgroundImage: "linear-gradient(180deg, #0a1020 0%, #0b1a14 55%, #05070d 100%)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.14), 0px 10px 24px -12px rgba(0,0,0,0.9)" } as ViewStyle}>
      <Image source={KICKOFF_BG} resizeMode="cover" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }} />
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "18%", height: "40%", opacity: lights,
        backgroundImage: "radial-gradient(45% 55% at 50% 45%, rgba(255,236,190,0.22), transparent 70%)" } as never} />
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
        backgroundImage: "linear-gradient(180deg, rgba(3,6,12,0.75) 0%, rgba(3,6,12,0) 26%, rgba(3,6,12,0) 52%, rgba(3,6,12,0.85) 100%)" } as ViewStyle} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between", padding: 12 }}>
        <Animated.View style={[{ alignItems: "center" }, up]}>
          <Text numberOfLines={1} style={{ color: "rgba(253,230,138,0.9)", fontSize: 9, fontWeight: "900", letterSpacing: 2.9, ...shadow }}>THE TEAMS WALK OUT</Text>
          <View style={{ overflow: "hidden", marginTop: 4, paddingHorizontal: 4 }}>
            <Text numberOfLines={1} style={{ color: "#fff", fontSize: 22, lineHeight: 26, fontWeight: "900", fontStyle: "italic", letterSpacing: 2.6, ...shadow }}>KICK OFF</Text>
            <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, width: 46, opacity: 0.45,
              backgroundImage: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.75) 50%, transparent 100%)",
              transform: [{ translateX: glint.interpolate({ inputRange: [0, 1], outputRange: [-60, 200] }) }] } as never} />
          </View>
        </Animated.View>
        <Animated.View style={[{ alignSelf: "stretch", flexDirection: "row", alignItems: "flex-end", gap: 8 }, up]}>
          {side(sides[0])}
          <Text style={{ paddingBottom: 8, color: "#fff", fontSize: 18, lineHeight: 18, fontWeight: "900", fontStyle: "italic", ...shadow }}>v</Text>
          {side(sides[1])}
        </Animated.View>
      </View>
    </View>
  );
}

// ── Other scores during your match (CanvasMatch item 35, lib/star/liveScores.ts) ──
// The rest of the division's games are played at kick-off off their own seed (the very scores the
// table records at full time). The Scores button shows every game as it stands; a goal for a club
// you have belled slides in over the commentary as the clock passes it, one card at a time.

interface LiveState { week: { fixtures: { home: string; away: string }[]; goals: LiveGoal[] }; shown: number; pop: (LiveGoal & { id: number; at: number }) | null; ids: number }
const liveOf = new WeakMap<MatchDriver, LiveState>();
function liveFor(d: MatchDriver): LiveState {
  let L = liveOf.get(d);
  if (!L) {
    let week: LiveState["week"] = { fixtures: [], goals: [] };
    try {
      // The farewell is the only game being played: no other scores (CanvasMatch).
      if (d.setup.career && d.setup.fixture && !d.setup.farewell && !d.feature) {
        setLiveScoreWeek(d.setup.career.season, d.setup.fixture.week);
        week = liveWeekFor(d.setup.career, d.setup.fixture);
      }
    } catch { /* no other games to show */ }
    L = { week, shown: 0, pop: null, ids: 0 };
    liveOf.set(d, L);
  }
  return L;
}
/** CanvasMatch's effect on the minute: goals now due; only a belled club's, only one from the last 3 minutes. */
function liveStep(d: MatchDriver, L: LiveState) {
  const goals = L.week.goals;
  if (L.shown >= goals.length) return;
  const due: LiveGoal[] = [];
  while (L.shown < goals.length && goals[L.shown].minute <= d.matchMinute) due.push(goals[L.shown++]);
  let mine: LiveGoal[] = [];
  try { mine = goalsForFollowed(due, followedTeams()); } catch { /* no storage: nobody belled */ }
  const latest = mine.filter((g) => d.matchMinute - g.minute <= 3).pop();
  if (latest) L.pop = { ...latest, id: ++L.ids, at: Date.now() };
}
export const LIVE_POP_MS = 4000;

/** LiveScorePop.tsx: the card over the commentary; closes itself after 4 s or with the ×. */
function LiveScorePop({ pop, onClose }: { pop: LiveGoal & { id: number; at: number }; onClose: () => void }) {
  const drop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    drop.setValue(0);
    Animated.timing(drop, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    const t = setTimeout(onClose, Math.max(0, LIVE_POP_MS - (Date.now() - pop.at)));
    return () => clearTimeout(t);
  }, [pop.id, pop.at, onClose, drop]);
  const name = (club: string, scored: boolean, right?: boolean) => (
    <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, textAlign: right ? "right" : "left", fontSize: 11, fontWeight: scored ? "900" : "700", color: scored ? "#fff" : "rgba(255,255,255,0.8)" }}>{shortClub(club)}</Text>
  );
  return (
    <Animated.View style={{ position: "absolute", left: 8, right: 64, top: 8, zIndex: 30, opacity: drop, transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderLeftWidth: 4, borderLeftColor: "#ef4444", backgroundColor: "rgba(12,71,38,0.95)", paddingVertical: 4, paddingLeft: 6, paddingRight: 4, boxShadow: "0px 12px 20px rgba(0,0,0,0.4)" } as ViewStyle}>
        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900", fontVariant: ["tabular-nums"] }}>⚽ {pop.minute}&apos;</Text>
        <ClubBadge club={pop.home} size={14} />
        {name(pop.home, pop.scoredBy === "home")}
        <Text style={{ borderRadius: 4, overflow: "hidden", backgroundColor: "#fff", paddingHorizontal: 4, color: "#030712", fontSize: 11, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{pop.hs}-{pop.as}</Text>
        {name(pop.away, pop.scoredBy === "away", true)}
        <ClubBadge club={pop.away} size={14} />
        <Pressable onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" hitSlop={10} style={{ marginLeft: 2, width: 20, height: 20, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" }}>
          <Text style={{ color: "#fff", fontSize: 11, lineHeight: 13, fontWeight: "900" }}>×</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/** LiveScoresPanel.tsx: every game in the division right now; the bell on a club asks for its goals. */
function LiveScoresPanel({ rows, minute, followed, onToggleFollow, onClose }: { rows: LiveScoreRow[]; minute: string; followed: readonly string[]; onToggleFollow: (club: string) => void; onClose: () => void }) {
  const bell = (club: string) => {
    const on = followed.includes(club);
    return (
      <Pressable onPress={() => onToggleFollow(club)} accessibilityLabel={`${on ? "Stop" : "Get"} goal alerts for ${club}`} accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={6}
        style={{ width: 20, height: 20, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#fbbf24" : "rgba(255,255,255,0.1)" }}>
        <Text style={{ fontSize: 10, lineHeight: 13, opacity: on ? 1 : 0.6 }}>🔔</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ position: "absolute", left: 8, right: 8, top: 8, bottom: 8, zIndex: 40, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(12,71,38,0.95)", boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.5)" } as ViewStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 8 }}>
        <Text style={{ borderRadius: 4, overflow: "hidden", backgroundColor: "#dc2626", paddingHorizontal: 4, color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }}>LIVE</Text>
        <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.1 }}>SCORES · {minute}&apos;</Text>
        <Pressable onPress={onClose} accessibilityLabel="Close live scores" accessibilityRole="button" hitSlop={8} style={{ width: 24, height: 24, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" }}>
          <Text style={{ color: "#fff", fontSize: 14, lineHeight: 16, fontWeight: "900" }}>×</Text>
        </Pressable>
      </View>
      <Text style={{ paddingHorizontal: 12, paddingTop: 6, color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700" }}>Tap 🔔 to get a club&apos;s goals during your match.</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6 }}>
        {rows.map((r) => (
          <View key={`${r.home}-${r.away}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.05)", paddingVertical: 6 }}>
            {bell(r.home)}
            <ClubBadge club={r.home} size={16} />
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 12, fontWeight: "700" }}>{shortClub(r.home)}</Text>
            <Text style={{ borderRadius: 4, overflow: "hidden", backgroundColor: "#fff", paddingHorizontal: 6, color: "#030712", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{r.hs}-{r.as}</Text>
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, textAlign: "right", color: "#fff", fontSize: 12, fontWeight: "700" }}>{shortClub(r.away)}</Text>
            <ClubBadge club={r.away} size={16} />
            {bell(r.away)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function MatchFeed({ d, kits }: { d: MatchDriver; kits: MatchKits }) {
  const live = useMemo(() => liveFor(d), [d]);
  const [scoresOpen, setScoresOpen] = useState(false);
  const [following, setFollowing] = useState<string[]>(() => { try { return followedTeams(); } catch { return []; } });
  const [, setPopTick] = useState(0);
  liveStep(d, live);
  const pop = live.pop && Date.now() - live.pop.at < LIVE_POP_MS ? live.pop : null;
  const closePop = useRef(() => { live.pop = null; setPopTick((v) => v + 1); }).current;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const lines = d.log.slice(-40);
  // The tap that opened this screen (KICK OFF, a chance ending) must not also skip the commentary.
  const shownAt = useRef(Date.now());
  const energy = Math.round(d.liveEnergyAt(d.matchMinute));
  const modes: EnergyMode[] = ["low", "medium", "high"];
  const minute = minuteLabel(d.matchMinute, d.ADDED, d.MATCH_DURATION);
  const p = d.pause;
  return (
    <View style={{ flex: 1, backgroundColor: G950 }}>
      <ScrollView ref={scroll} style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        // The bottom stack grows (coming on, half time): stay on the latest line, clear of the playstyle buttons.
        onLayout={() => scroll.current?.scrollToEnd({ animated: false })}>
        {/* A tap on the commentary empties the queue in one go (MatchCommentary onSkip). */}
        <Pressable onPress={() => { if (Date.now() - shownAt.current > 450) d.skipFeed(); }} disabled={!d.canSkipFeed} style={{ flexGrow: 1 }}>
          {/* While the kick-off card shows, its "KICK OFF" replaces the feed's own kick-off row (MatchCommentary: lines ≤ 1). */}
          {d.log.length <= 1
            ? <KickOffCard d={d} kits={kits} />
            : lines.map((l) => <FeedLine key={l.id} l={l} d={d} kits={kits} />)}
          <View style={{ height: 52 }} />
        </Pressable>
      </ScrollView>
      {/* The minute and the speed on one plate, floating over the feed's corner (tap: faster). */}
      <Press onPress={() => d.cycleSpeed()} style={{ position: "absolute", right: 8, top: 8, width: 56, alignItems: "center", paddingVertical: 4, paddingHorizontal: 2, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(16,82,47,0.85)", boxShadow: "0px 2px 6px rgba(0,0,0,0.35)" } as ViewStyle}>
        {/* One line whatever the minute: "90+10'" shrinks to fit the plate. */}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ alignSelf: "stretch", textAlign: "center", color: minute.includes("+") ? "#fcd34d" : "#fff", fontFamily: FONT.display, fontSize: minute.includes("+") ? (minute.length > 4 ? 12 : 14) : 17, lineHeight: 20 }}>{minute}&apos;</Text>
        {/* 1, 2, 4, 8: one to four arrows (MatchCommentary). */}
        <Text numberOfLines={1} style={{ marginTop: 1, color: d.speed > 1 ? "#fcd34d" : "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: "900" }}>{"▶".repeat(d.speed === 8 ? 4 : d.speed === 4 ? 3 : d.speed)}</Text>
      </Press>
      {/* Every other score in the division, right now (MatchCommentary: under the clock). */}
      {live.week.fixtures.length > 0 && (
        <Press onPress={() => setScoresOpen(true)} style={{ position: "absolute", right: 8, top: 50, width: 56, alignItems: "center", justifyContent: "center", paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(16,82,47,0.85)", boxShadow: "0px 2px 6px rgba(0,0,0,0.35)" } as ViewStyle}>
          <Text numberOfLines={1} style={{ color: "#fff", fontSize: 10, lineHeight: 11, fontWeight: "900" }}>SCORES</Text>
        </Press>
      )}
      {pop && !scoresOpen && <LiveScorePop pop={pop} onClose={closePop} />}
      <View>
        {/* The playstyle buttons in their own strip under the last feed line (the packed app): floating, they hid "+5 MINUTES ADDED". The chosen one full size with a glow ring. */}
        <View style={{ alignSelf: "flex-end", paddingRight: 8, paddingVertical: 2, flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
          {PLAYSTYLES.map((ps) => {
            const on = d.playstyle === ps, px = on ? 42 : 32;
            return (
              <Press key={ps} onPress={() => d.setPlaystyle(ps)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: px, height: px, borderRadius: px / 2, opacity: on ? 1 : 0.55,
                  boxShadow: on ? `0px 0px 0px 2px rgba(${PLAYSTYLE_GLOW[ps]},0.85), 0px 0px 12px 2px rgba(${PLAYSTYLE_GLOW[ps]},0.55)` : "0px 2px 3px rgba(0,0,0,0.55)" } as ViewStyle}>
                  <Image source={PLAYSTYLE_PIC[ps]} style={{ width: px, height: px, borderRadius: px / 2 }} />
                </View>
              </Press>
            );
          })}
        </View>
        {/* Waiting on you: coming on, half time (MatchCommentary's amber bar). */}
        {p && (
          <View style={{ borderTopWidth: 1, borderColor: "rgba(251,191,36,0.4)", backgroundColor: "rgba(69,26,3,0.4)", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }}>
            {p.label ? <Text style={{ textAlign: "center", color: "#fde68a", fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>{p.label.toUpperCase()}</Text> : null}
            {p.halfTime && !d.setup.farewell ? <Text style={{ textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "800", marginTop: 2 }}>Energy {energy}%</Text> : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: p.label ? 10 : 0 }}>
              {/* Half time only: drink a Basic KIB can (+65) before the second half. */}
              {p.halfTime && !d.setup.farewell && (
                <Press onPress={() => d.drinkHalfTimeKib()} disabled={d.kibCansLeft() <= 0 || d.energy >= 100}
                  style={{ flexBasis: "33%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: d.kibCansLeft() <= 0 || d.energy >= 100 ? "#374151" : "#f97316" }}>
                  <Text style={{ color: d.kibCansLeft() <= 0 ? "#fff" : "#030712", fontWeight: "900", fontSize: 10, letterSpacing: 0.4 }}>USE CAN</Text>
                  <Text style={{ color: d.kibCansLeft() <= 0 ? "#fff" : "#030712", fontWeight: "900", fontSize: 14 }}>×{d.kibCansLeft()}</Text>
                </Press>
              )}
              <Pressable onPress={() => d.continuePause()} accessibilityRole="button"
                style={({ pressed }) => ({ flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center", backgroundColor: pressed ? "#fcd34d" : "#fbbf24", boxShadow: "0px 0px 16px rgba(251,191,36,0.55)" } as ViewStyle)}>
                <Text style={{ color: "#030712", fontSize: 14, fontWeight: "900", letterSpacing: 2.2 }}>{p.cta.replace(/\s*→\s*$/, "").toUpperCase()}</Text>
              </Pressable>
            </View>
          </View>
        )}
        {/* Your energy, and the three modes (the farewell has none). */}
        {!d.setup.farewell && (
          <View style={{ borderTopWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: G900, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 }}>ENERGY</Text>
              <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: G700, overflow: "hidden" }}>
                <View style={{ width: `${Math.max(0, Math.min(100, energy))}%`, height: "100%", borderRadius: 6, backgroundColor: energy >= MIN_ENERGY_TO_START ? "#10b981" : energy >= 30 ? "#fbbf24" : "#ef4444" }} />
              </View>
              <Text style={{ width: 32, textAlign: "right", color: "#fff", fontSize: 14, fontWeight: "900" }}>{energy}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {modes.map((m) => {
                const on = d.energyMode === m;
                const ring = m === "low" ? "rgba(34,197,94,0.7)" : m === "high" ? "rgba(239,68,68,0.7)" : "rgba(251,191,36,0.7)";
                return (
                  <Press key={m} onPress={() => d.setEnergyMode(m)}
                    style={{ flex: 1, alignItems: "center", borderRadius: 8, paddingVertical: 2, backgroundColor: on ? "rgba(255,255,255,0.08)" : G800, borderWidth: 2, borderColor: on ? ring : "transparent" }}>
                    <EnergyIcon mode={m} active={on} size={46} />
                    <Text style={{ marginTop: -2, paddingBottom: 2, color: on ? "#fff" : "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "900", letterSpacing: 1 }}>{m === "low" ? "LOW" : m === "high" ? "HIGH" : "MEDIUM"}</Text>
                  </Press>
                );
              })}
            </View>
          </View>
        )}
      </View>
      {scoresOpen && (
        <LiveScoresPanel rows={scoresAt(live.week.fixtures, live.week.goals, d.matchMinute)} minute={minute} followed={following}
          onToggleFollow={(club) => setFollowing(toggleFollowedTeam(club))} onClose={() => setScoresOpen(false)} />
      )}
    </View>
  );
}

/** Half time, full time, coming on: the one button the match waits for — in the feed's own bar (above); off the feed, over the pitch. */
export function MatchPause({ d }: { d: MatchDriver }) {
  const p = d.pause;
  if (!p || d.phase === "feed") return null;
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 24 }}>
      {p.label ? <Text style={{ color: "#fde68a", fontSize: 13, fontWeight: "900", letterSpacing: 2, marginBottom: 12 }}>{p.label.toUpperCase()}</Text> : null}
      <Pressable onPress={() => d.continuePause()} accessibilityRole="button"
        style={({ pressed }) => ({ alignSelf: "stretch", borderRadius: 8, paddingVertical: 12, alignItems: "center", backgroundColor: pressed ? "#fcd34d" : "#fbbf24", boxShadow: "0px 0px 16px rgba(251,191,36,0.55)" } as ViewStyle)}>
        <Text style={{ color: "#030712", fontSize: 15, fontWeight: "900", letterSpacing: 2.2 }}>{p.cta.replace(/\s*→\s*$/, "").toUpperCase()}</Text>
      </Pressable>
    </View>
  );
}
