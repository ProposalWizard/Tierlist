/**
 * THE MATCH ON THE PHONE. The whole match runs in the driver
 * (src/match/driver.ts: the website's match flow, same lib/star calls in the
 * same order); the pitch, its touches and the strike screen are
 * screens/MatchPitch.tsx (shared with the trial and the drills). This screen
 * adds the career match's own parts: the scoreboard, the commentary between
 * chances, the goal plate, half time.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { goalInView, acceptsCaptainOrders } from "@/lib/star/canvasEngine";
import { mechanicOpen } from "@/lib/star/mechanics";
import { barCap } from "@/lib/star/legs";
import { shortClub } from "@/lib/star/media/grammar";
import { SafeAreaView } from "react-native-safe-area-context";
import { kitsFor, type MatchKits } from "@/lib/star/kits";
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
import { PitchPage, GoalBoard, LiveCommentary, StaminaBox } from "./MatchLook";

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

  // The stamina bar's fill, moved on the UI thread every frame (no React work).
  const stamina = useSharedValue(1);
  const onFrame = useCallback((d: MatchDriver) => {
    const legs = d.playOn?.stick?.legs;
    stamina.value = legs ? legs.stamina.v : 1;
  }, [stamina]);

  const overlay = useCallback((d: MatchDriver) => {
    const banner = d.banner && d.now - d.banner.at < BANNER_MS ? d.banner : null;
    const lastGoal = d.goalEvents[d.goalEvents.length - 1];
    const home = d.setup.fixture.home !== false;
    const us = shortClub(d.setup.career.player.club), them = shortClub(d.setup.fixture.opponent);
    // CanvasMatch B14: the stamina box, on a run or on a chance with the goal in view that takes captain's orders.
    const legs = d.playOn?.stick?.legs;
    const showStamina = mechanicOpen(d.setup.career, "sprint") && !d.lead && d.phase !== "feed" && d.phase !== "done"
      && (!!legs || ((d.phase === "aim" || d.phase === "result") && goalInView(d.sc.kind) && acceptsCaptainOrders(d.sc.kind)));
    return (
      <>
        {d.phase === "feed" && <View style={StyleSheet.absoluteFill}><MatchFeed d={d} kits={kits} /></View>}
        {d.phase !== "feed" && d.feed.length > 0 && (
          <View pointerEvents="none" style={{ position: "absolute", left: 8, right: 8, bottom: showStamina ? 66 : 8 }}>
            <LiveCommentary lines={d.feed.slice(-2)} />
          </View>
        )}
        {showStamina && <StaminaBox fill={stamina} cap={legs ? legs.cap : barCap(d.liveEnergyAt(d.matchMinute))} label={legs ? (legs.sprinting ? "SPRINT" : "RUN") : undefined} />}
        {d.phase === "tdDribble" && d.tdReady && (
          <View pointerEvents="none" style={{ position: "absolute", top: "40%", left: 20, right: 20, backgroundColor: "rgba(10,16,14,0.9)", borderRadius: 14, padding: 14, borderWidth: 2, borderColor: C.gold }}>
            <Text style={{ color: C.text, fontWeight: "900", textAlign: "center", fontSize: 16 }}>Tap to start the run. Drag to steer, tap a team-mate to pass.</Text>
          </View>
        )}
        {/* Mikey's pop-up for a goal: the scoreboard, low on the pitch, with the scorer and the assist. */}
        {banner && banner.text === "GOAL" && lastGoal && (
          <View pointerEvents="none" style={{ position: "absolute", top: "70%", left: 0, right: 0 }}>
            <GoalBoard
              home={{ name: home ? us : them, shirt: kits.home.shirt, trim: kits.home.trim }}
              away={{ name: home ? them : us, shirt: kits.away.shirt, trim: kits.away.trim }}
              score={home ? [d.userScore, d.oppScore] : [d.oppScore, d.userScore]}
              scorer={lastGoal.scorer} assist={lastGoal.assist ?? undefined} />
          </View>
        )}
        {d.shootout && <View pointerEvents="box-none" style={StyleSheet.absoluteFill}><MatchShootout d={d} kits={kits} /></View>}
        <MatchPause d={d} />
      </>
    );
  }, [kits, stamina]);

  return (
    <PitchPage>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <HudSlot kits={kits} />
        {/* The pitch in its frame (CanvasMatch: border-2 emerald-800/80, square corners in the pitch scope). */}
        <View style={{ flex: 1, marginHorizontal: 12, marginBottom: 8, borderWidth: 2, borderColor: "rgba(6,95,70,0.8)", borderRadius: 2, overflow: "hidden", backgroundColor: "#22920b", boxShadow: "0px 18px 40px -12px rgba(2,44,34,0.6)" } as ViewStyle}>
          <MatchPitch make={make} kits={kits} onDone={onFullTime} overlay={overlay} frozen={frozen} onFrame={onFrame}
            onUi={watch ? (d) => { setHud(d); watch(d); } : setHud} />
        </View>
      </SafeAreaView>
    </PitchPage>
  );
}

// The scoreboard above the pitch follows the driver (re-rendered on its uiVersion).

let hudDriver: MatchDriver | null = null;
let hudVersion = 0;
const hudSubs = new Set<() => void>();
function setHud(d: MatchDriver) { hudDriver = d; hudVersion++; hudSubs.forEach((f) => f()); }
function HudSlot({ kits }: { kits: MatchKits }) {
  useSyncExternalStore((f) => { hudSubs.add(f); return () => hudSubs.delete(f); }, () => hudVersion);
  return hudDriver ? <MatchHud d={hudDriver} kits={kits} /> : null;
}
