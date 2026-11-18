/**
 * THE MATCH ON THE PHONE. The whole match runs in the driver
 * (src/match/driver.ts: the website's match flow, same lib/star calls in the
 * same order); the pitch, its touches and the strike screen are
 * screens/MatchPitch.tsx (shared with the trial and the drills). This screen
 * adds the career match's own parts: the scoreboard, the commentary between
 * chances, the goal plate, half time.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { kitsFor } from "@/lib/star/kits";
import type { CareerState, Fixture } from "@/lib/star/types";
import { MatchDriver } from "../match/driver";
import { matchSetupFor, type MatchSetup } from "../match/setup";
import { MatchPitch, BANNER_MS } from "./MatchPitch";
import { MatchHud } from "./MatchHud";
import { MatchFeed, MatchPause } from "./MatchFeed";
import { MatchShootout } from "./MatchShootout";
import { keepGoalClip } from "../match/goalClip/store";
import { getCareer } from "../game/store";
import { C } from "../ui/theme";

export function Match({ career, fixture, onFullTime, setupFor, recordGoals = true, watch, frozen = false }: {
  career: CareerState; fixture: Fixture; onFullTime: (d: MatchDriver) => void;
  /** A match page.tsx mounts with its own props (the farewell): its setup instead of matchSetupFor. */
  setupFor?: () => MatchSetup;
  /** Goal videos (page.tsx hands CanvasMatch onGoalClip on the career match only). */
  recordGoals?: boolean;
  /** Told of every change the screen sees (the farewell watches for the minute you come off). */
  watch?: (d: MatchDriver) => void;
  /** Hold the pitch still (something full-screen plays over it: the standing ovation). */
  frozen?: boolean;
}) {
  // The match's career: your own, or for an international the national-team swap (setup.ts).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setup = useMemo(() => (setupFor ? setupFor() : matchSetupFor(career, fixture)), [career, fixture]);
  const kits = useMemo(() => {
    const c = setup.career;
    return fixture.home
      ? kitsFor(c.player.club, fixture.opponent, c.clubKits?.[c.player.club], c.clubKits?.[fixture.opponent])
      : kitsFor(fixture.opponent, c.player.club, c.clubKits?.[fixture.opponent], c.clubKits?.[c.player.club]);
  }, [setup, fixture]);
  const make = useCallback((hw: number) => {
    const d = new MatchDriver(setup, { hw });
    // Goal videos (CanvasMatch onGoalClip → page.tsx handleGoalClip): every goal recorded as played, kept on the phone.
    if (recordGoals) d.clipSink = { kits, onClip: (t) => keepGoalClip(t, getCareer()) };
    setHud(d);
    return d;
  }, [setup, kits, recordGoals]);

  const overlay = useCallback((d: MatchDriver) => {
    const banner = d.banner && d.now - d.banner.at < BANNER_MS ? d.banner : null;
    const lastGoal = d.goalEvents[d.goalEvents.length - 1];
    return (
      <>
        {d.phase === "feed" && <View style={StyleSheet.absoluteFill}><MatchFeed d={d} /></View>}
        {d.phase !== "feed" && (
          <View pointerEvents="none" style={{ position: "absolute", left: 10, right: 10, bottom: 12 }}>
            {d.feed.slice(-2).map((l, i) => (
              <Text key={i} style={{ color: C.text, fontWeight: "800", fontSize: 14, textShadowColor: "#000", textShadowRadius: 4 }}>{l}</Text>
            ))}
          </View>
        )}
        {d.phase === "tdDribble" && d.tdReady && (
          <View pointerEvents="none" style={{ position: "absolute", top: "40%", left: 20, right: 20, backgroundColor: "rgba(10,16,14,0.9)", borderRadius: 14, padding: 14, borderWidth: 2, borderColor: C.gold }}>
            <Text style={{ color: C.text, fontWeight: "900", textAlign: "center", fontSize: 16 }}>Tap to start the run. Drag to steer, tap a team-mate to pass.</Text>
          </View>
        )}
        {banner && banner.text === "GOAL" && lastGoal && (
          <View pointerEvents="none" style={{ position: "absolute", top: 12, left: 16, right: 16, backgroundColor: "#0b1220", borderRadius: 12, borderWidth: 2, borderColor: C.gold, padding: 12, alignItems: "center" }}>
            <Text style={{ color: C.gold, fontWeight: "900", fontSize: 30 }}>GOAL!</Text>
            <Text style={{ color: C.text, fontWeight: "900", fontSize: 18 }}>
              {d.setup.fixture.home !== false ? `${d.userScore} - ${d.oppScore}` : `${d.oppScore} - ${d.userScore}`}
            </Text>
            <Text style={{ color: C.text, fontWeight: "700" }}>⚽ {lastGoal.scorer}{lastGoal.assist ? `  ·  🎯 ${lastGoal.assist}` : ""}</Text>
          </View>
        )}
        {d.shootout && <View pointerEvents="box-none" style={StyleSheet.absoluteFill}><MatchShootout d={d} kits={kits} /></View>}
        <MatchPause d={d} />
      </>
    );
  }, [kits]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <HudSlot />
      <MatchPitch make={make} kits={kits} onDone={onFullTime} overlay={overlay} frozen={frozen}
        onUi={watch ? (d) => { setHud(d); watch(d); } : setHud} />
    </SafeAreaView>
  );
}

// The scoreboard above the pitch follows the driver (re-rendered on its uiVersion).

let hudDriver: MatchDriver | null = null;
let hudVersion = 0;
const hudSubs = new Set<() => void>();
function setHud(d: MatchDriver) { hudDriver = d; hudVersion++; hudSubs.forEach((f) => f()); }
function HudSlot() {
  useSyncExternalStore((f) => { hudSubs.add(f); return () => hudSubs.delete(f); }, () => hudVersion);
  return hudDriver ? <MatchHud d={hudDriver} /> : null;
}
