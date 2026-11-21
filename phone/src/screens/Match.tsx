/**
 * THE MATCH ON THE PHONE. The whole match runs in the driver
 * (src/match/driver.ts: the website's match flow, same lib/star calls in the
 * same order); the pitch, its touches and the strike screen are
 * screens/MatchPitch.tsx (shared with the trial and the drills). This screen
 * adds the career match's own parts: the scoreboard, the commentary between
 * chances, the goal plate, half time.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { goalInView, acceptsCaptainOrders, orderableRunners } from "@/lib/star/canvasEngine";
import { minuteLabel } from "@/lib/star/addedTime";
import { mechanicOpen } from "@/lib/star/mechanics";
import { barCap } from "@/lib/star/legs";
import { shortClub } from "@/lib/star/media/grammar";
import { SafeAreaView } from "react-native-safe-area-context";
import { kitsFor, type MatchKits } from "@/lib/star/kits";
import type { CareerState, Fixture } from "@/lib/star/types";
import { MatchDriver } from "../match/driver";
import { matchSetupFor, type MatchSetup } from "../match/setup";
import { MatchPitch } from "./MatchPitch";
import { MatchHud } from "./MatchHud";
import { MatchFeed, MatchPause } from "./MatchFeed";
import { MatchShootout } from "./MatchShootout";
import { keepGoalClip } from "../match/goalClip/store";
import { getCareer } from "../game/store";
import { C } from "../ui/theme";
import { setMusicScene, clearMusicScene, playTurningPoint, refreshMusic } from "../match/music";
import { isTurningPoint } from "@/lib/star/gameMusic";
import { usePrefs } from "../game/prefs";
import { PitchPage, GoalBoard, StaminaBox } from "./MatchLook";

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

  // Game music (CanvasMatch's music effects): the score, the clock, a knockout and a
  // dribble pick the bed; a goal of yours from behind plays the turning point once.
  const prefs = usePrefs();
  const setupRef = useRef(setup);
  setupRef.current = setup;
  useEffect(() => { refreshMusic(); }, [prefs.gameMusic, prefs.sound]);
  useEffect(() => {
    let score = { us: 0, them: 0 };
    const id = setInterval(() => {
      const d = hudDriver;
      if (!d || d.setup !== setupRef.current) return;
      if (isTurningPoint(score.us, score.them, d.userScore)) playTurningPoint();
      score = { us: d.userScore, them: d.oppScore };
      setMusicScene("match", d.done
        ? { kind: "full-time", us: d.userScore, them: d.oppScore }
        : { kind: "match", state: { us: d.userScore, them: d.oppScore, minute: d.matchMinute, duration: d.MATCH_DURATION, knockout: d.knockoutTie, dribbling: d.phase === "tdDribble" } }, 10);
    }, 250);
    return () => { clearInterval(id); clearMusicScene("match"); };
  }, []);

  // The stamina bar's fill, moved on the UI thread every frame (no React work).
  const stamina = useSharedValue(1);
  const onFrame = useCallback((d: MatchDriver) => {
    const legs = d.playOn?.stick?.legs;
    stamina.value = legs ? legs.stamina.v : 1;
  }, [stamina]);

  const scoreWas = useRef<{ at: unknown; score: [number, number]; last: [number, number] }>({ at: null, score: [0, 0], last: [0, 0] });
  const overlay = useCallback((d: MatchDriver) => {
    const banner = d.bannerNow();
    const lastGoal = d.goalEvents[d.goalEvents.length - 1];
    const home = d.setup.fixture.home !== false;
    // The score before a goal's pop-up (its number rolls from this): kept while no GOAL is up, pinned to the pop-up when one comes.
    {
      const now: [number, number] = home ? [d.userScore, d.oppScore] : [d.oppScore, d.userScore];
      const sw = scoreWas.current;
      if (banner && banner.text === "GOAL") { if (sw.at !== banner) scoreWas.current = { at: banner, score: sw.last, last: now }; else sw.last = now; }
      else scoreWas.current = { at: null, score: now, last: now };
    }
    const us = shortClub(d.setup.career.player.club), them = shortClub(d.setup.fixture.opponent);
    // CanvasMatch B14: the stamina box, on a run or on a chance with the goal in view that takes captain's orders.
    const legs = d.playOn?.stick?.legs;
    const showStamina = mechanicOpen(d.setup.career, "sprint") && !d.lead && d.phase !== "feed" && d.phase !== "done"
      && (!!legs || ((d.phase === "aim" || d.phase === "result") && goalInView(d.sc.kind) && acceptsCaptainOrders(d.sc.kind)));
    return (
      <>
        {d.phase === "feed" && <View style={StyleSheet.absoluteFill}><MatchFeed d={d} kits={kits} /></View>}
        {/* No commentary written on the pitch: the website shows none over your chance in a real match
            (CanvasMatch: the overlay strip is the sandbox's only); the lines are in the feed. */}
        {showStamina && <StaminaBox fill={stamina} cap={legs ? legs.cap : barCap(d.liveEnergyAt(d.matchMinute))} label={legs ? (legs.sprinting ? "SPRINT" : "RUN") : undefined} />}
        {/* Added time on the pitch (CanvasMatch): a chance in added time says so. */}
        {d.inAddedTime && (d.phase === "aim" || d.phase === "contact" || d.phase === "flight" || d.phase === "result") && (
          <View pointerEvents="none" style={{ position: "absolute", left: 8, top: 8, zIndex: 30, borderRadius: 6, backgroundColor: "#fbbf24", paddingHorizontal: 6, paddingVertical: 2, boxShadow: "0px 6px 12px rgba(0,0,0,0.35)" } as ViewStyle}>
            <Text numberOfLines={1} style={{ color: "#030712", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] }}>⏱ {minuteLabel(d.matchMinute, d.ADDED, d.MATCH_DURATION)}&apos;</Text>
          </View>
        )}
        {/* The top-down dribble's words (CanvasMatch data-td-dribble): the duel note, the green start pill and its how-to, the moves strip. */}
        {d.phase === "tdDribble" && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {d.tdNote && !d.tdReady && (
              <View style={{ position: "absolute", left: 12, right: 12, top: "16%", alignItems: "center" }}>
                <Text style={{ backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 4, fontSize: 15, fontWeight: "900", letterSpacing: 0.4, textAlign: "center", textTransform: "uppercase",
                  color: d.tdNote.tone === "good" ? "#6ee7b7" : d.tdNote.tone === "bad" ? "#fca5a5" : "#fff", boxShadow: "inset 0px 0px 0px 1.5px rgba(255,255,255,0.9)" } as never}>{d.tdNote.text}</Text>
              </View>
            )}
            {d.tdReady ? (
              <View style={{ position: "absolute", left: 24, right: 24, top: "10%", alignItems: "center", gap: 6 }}>
                <Text numberOfLines={1} style={{ backgroundColor: "#10b981", paddingHorizontal: 24, paddingVertical: 12, fontSize: 16, fontWeight: "900", letterSpacing: 1.6, color: "#022c22", boxShadow: "inset 0px 0px 0px 1.5px rgba(255,255,255,0.92)" } as never}>TAP TO START</Text>
                <Text style={{ backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, lineHeight: 16, fontWeight: "700", color: "#fff", textAlign: "center" }}>
                  {d.td?.duels
                    ? (d.skillMovesOpen
                      ? "He backs off and shows you one way. Sell him a step-over or a dropped shoulder, then go the other way — or flick past him the moment he plants."
                      : "He backs off and shows you one way. Drop a shoulder, then go the other way — or flick past him the moment he plants.")
                    : "Drag to steer. Flick to burst past him."}
                </Text>
              </View>
            ) : (
              <View style={{ position: "absolute", left: 8, right: 8, bottom: 8 }}>
                <Text style={{ backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, lineHeight: 16, fontWeight: "700", color: "#fff", textAlign: "center" }}>
                  {d.td?.duels
                    ? (d.skillMovesOpen ? "Tap a side: drop the shoulder. Swipe down: step-over. Flick: knock it past as he plants." : "Tap a side: drop the shoulder. Flick: knock it past as he plants.")
                    : "Drag to steer. Flick to burst past him. Tap a team-mate to pass."}
                </Text>
              </View>
            )}
          </View>
        )}
        {/* Mikey's pop-up for a goal: the scoreboard, low on the pitch, with the scorer and the assist. */}
        {banner && banner.text === "GOAL" && lastGoal && (
          <View pointerEvents="none" style={{ position: "absolute", top: "70%", left: 0, right: 0 }}>
            <GoalBoard
              home={{ name: home ? us : them, shirt: kits.home.shirt, trim: kits.home.trim }}
              away={{ name: home ? them : us, shirt: kits.away.shirt, trim: kits.away.trim }}
              score={home ? [d.userScore, d.oppScore] : [d.oppScore, d.userScore]}
              from={scoreWas.current.at === banner ? scoreWas.current.score : undefined} id={banner} ms={banner.ms}
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
        <CaptainSlot />
      </SafeAreaView>
    </PitchPage>
  );
}

// The scoreboard above the pitch follows the driver (re-rendered on its uiVersion).

let hudDriver: MatchDriver | null = null;
let hudVersion = 0;
const hudSubs = new Set<() => void>();
function setHud(d: MatchDriver) { hudDriver = d; hudVersion++; hudSubs.forEach((f) => f()); }
/** The armband's line under the pitch (CanvasMatch): what the captain can order, then what has been ordered. */
function CaptainSlot() {
  useSyncExternalStore((f) => { hudSubs.add(f); return () => hudSubs.delete(f); }, () => hudVersion);
  const d = hudDriver;
  if (!d || !d.isCaptain || d.phase !== "aim" || !acceptsCaptainOrders(d.sc.kind)) return null;
  const sc = d.sc;
  const runs = orderableRunners(sc).filter((r) => r.commandedTo).length + (sc.follower.commandedTo ? 1 : 0);
  const relay = !!sc.relayTo || !!sc.relayToFollower;
  const relayName = sc.relayTo?.who?.shortName ?? (sc.relayToFollower ? sc.follower.who?.shortName : undefined) ?? "your man";
  return (
    <View style={{ marginHorizontal: 12, marginTop: -2, marginBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.1)", paddingHorizontal: 12, paddingVertical: 6 }}>
      <Text numberOfLines={2} style={{ textAlign: "center", fontSize: 10, lineHeight: 14, color: "rgba(253,230,138,0.9)" }}>
        <Text style={{ fontWeight: "900", color: "#fcd34d" }}>© CAPTAIN</Text>
        {!runs && !relay ? " · tap a team-mate to have it laid off to him, drag to send him on a run" : null}
        {relay ? <> · lay-off to <Text style={{ fontWeight: "900" }}>{relayName}</Text></> : null}
        {runs ? ` · ${runs} run${runs > 1 ? "s" : ""} called` : null}
      </Text>
    </View>
  );
}
function HudSlot({ kits }: { kits: MatchKits }) {
  useSyncExternalStore((f) => { hudSubs.add(f); return () => hudSubs.delete(f); }, () => hudVersion);
  return hudDriver ? <MatchHud d={hudDriver} kits={kits} /> : null;
}
