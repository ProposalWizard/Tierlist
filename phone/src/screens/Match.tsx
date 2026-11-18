/**
 * THE MATCH ON THE PHONE. The whole match runs in the driver
 * (src/match/driver.ts: the website's match flow, same lib/star calls in the
 * same order); this screen only draws it and hands it your touches.
 *
 * Smoothness: the pitch is recorded as a Skia picture each frame and handed
 * to the canvas through a shared value, so React does not re-render per
 * frame. React re-renders only when something in the words changes (the
 * driver's uiVersion). The match steps in the website's 60-a-second frames
 * whatever the phone's refresh rate.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Canvas, Picture, createPicture } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { kitsFor } from "@/lib/star/kits";
import { nudgeFromDrag, RUNUP } from "@/lib/star/penaltyRunup";
import type { CareerState, Fixture } from "@/lib/star/types";
import { MatchDriver, FRAME_DT } from "../match/driver";
import { matchSetupFor } from "../match/setup";
import { drawPitch, camFor } from "../match/drawPitch";
import { drawContact, contactBallBox } from "../match/drawContact";
import { fromScreen, screenPull, grabMetres, type Cam } from "../match/view";
import { tapToContact } from "../match/contactBall";
import { MatchHud } from "./MatchHud";
import { MatchFeed, MatchPause } from "./MatchFeed";
import { C } from "../ui/theme";

const BALL_GRAB_FRACTION = 0.18;
const CAPTAIN_GRAB_FRACTION = 0.09;
const BANNER_MS = 1200;

export function Match({ career, fixture, onFullTime }: { career: CareerState; fixture: Fixture; onFullTime: (d: MatchDriver) => void }) {
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  const [, setUi] = useState(0);
  const dRef = useRef<MatchDriver | null>(null);
  const camRef = useRef<Cam | null>(null);
  const empty = useMemo(() => createPicture(() => {}), []);
  const pitchPic = useSharedValue(empty);
  const contactPic = useSharedValue(empty);
  const kits = useMemo(() => fixture.home
    ? kitsFor(career.player.club, fixture.opponent, career.clubKits?.[career.player.club], career.clubKits?.[fixture.opponent])
    : kitsFor(fixture.opponent, career.player.club, career.clubKits?.[fixture.opponent], career.clubKits?.[career.player.club]),
  [career, fixture]);

  // The driver is made once the pitch's shape is known (the camera frames each chance for it, as the website does).
  if (size && !dRef.current) {
    const d = new MatchDriver(matchSetupFor(career, fixture), { hw: size.H / size.W });
    d.start();
    dRef.current = d;
  }

  useEffect(() => {
    if (!size) return;
    let raf = 0, last = 0, acc = 0, lastUi = -1, finished = false;
    const loop = (t: number) => {
      const d = dRef.current!;
      if (!last) last = t;
      acc += Math.min(0.25, (t - last) / 1000);
      last = t;
      while (acc >= FRAME_DT) { d.tick(); acc -= FRAME_DT; }
      const { W, H } = size;
      if (d.phase !== "feed" && d.phase !== "done") {
        camRef.current = camFor(d, W, H);
        pitchPic.value = drawPitch(d, kits, W, H);
        if (d.phase === "contact") contactPic.value = drawContact(d, W, H);
      }
      if (d.uiVersion !== lastUi) { lastUi = d.uiVersion; setUi(lastUi); }
      if (d.done && !finished) { finished = true; onFullTime(d); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size, kits, onFullTime, pitchPic, contactPic]);

  // ── Touches on the pitch ──
  const pan = useMemo(() => {
    let start = { x: 0, y: 0 }, nudgeBase = 0, laneBase = 0, laneX = 0;
    const pull = (drag: { x: number; y: number }, ball: { x: number; y: number }) => (camRef.current ? screenPull(camRef.current, drag, ball) : 0);
    return Gesture.Pan().runOnJS(true).minDistance(0)
      .onBegin((e) => {
        const d = dRef.current, cam = camRef.current;
        if (!d || !cam) return;
        start = { x: e.x, y: e.y };
        const p = fromScreen(cam, e.x, e.y);
        if (d.phase === "tdDribble") {
          if (d.tdReady) { d.tdTap(p); return; }
          laneBase = d.td?.laneTarget ?? 0; laneX = p.x;
          return;
        }
        if (d.phase === "runup") { nudgeBase = d.runup?.nudgeM ?? 0; return; }
        d.pointerDown(p, grabMetres(cam, BALL_GRAB_FRACTION), grabMetres(cam, CAPTAIN_GRAB_FRACTION));
      })
      .onUpdate((e) => {
        const d = dRef.current, cam = camRef.current;
        if (!d || !cam) return;
        if (d.phase === "tdDribble") { d.tdSteer(laneBase + (fromScreen(cam, e.x, e.y).x - laneX)); return; }
        if (d.phase === "runup") {
          const along = d.facing === "right" ? e.y - start.y : d.facing === "left" ? start.y - e.y : e.x - start.x;
          const m = nudgeFromDrag(along, cam.W, cam.vp.x2 - cam.vp.x1);
          d.nudgeRunup(Math.max(-RUNUP.nudgeMaxM, Math.min(RUNUP.nudgeMaxM, nudgeBase + m)));
          return;
        }
        d.pointerMove(fromScreen(cam, e.x, e.y), pull);
      })
      .onFinalize((e) => {
        const d = dRef.current, cam = camRef.current;
        if (!d || !cam) return;
        const dx = e.x - start.x, dy = e.y - start.y;
        if (d.phase === "tdDribble") {
          if (Math.hypot(dx, dy) < 10) d.tdTap(fromScreen(cam, e.x, e.y));
          else if (Math.abs(e.velocityX) > 1.6 * cam.W) d.tdBurst(e.velocityX > 0 ? 1 : -1);
          return;
        }
        if (d.phase === "flight") {
          const f = d.facing;
          d.curveSwipe(f === "right" ? dy : f === "left" ? -dy : dx, f === "up" ? dy : dx);
          return;
        }
        const wasAim = d.phase === "aim";
        d.pointerUp(pull);
        if (wasAim && d.phase !== "aim") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      });
  }, []);

  // ── A tap on the strike screen's ball ──
  const tap = useMemo(() => Gesture.Tap().runOnJS(true).maxDuration(10000).onBegin((e) => {
    const d = dRef.current;
    if (!d || !size || d.phase !== "contact") return;
    const bb = contactBallBox(d, size.W, size.H);
    const c = tapToContact(e.x - bb.x, e.y - bb.y, bb.r);
    if (!c) return;
    d.tapContact(c.cx, c.cy);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }), [size]);

  const d = dRef.current;
  const banner = d?.banner && d.now - d.banner.at < BANNER_MS ? d.banner : null;
  const motion = d && d.phase === "contact" ? d.strikeMotion() : "still";
  const lastGoal = d?.goalEvents[d.goalEvents.length - 1];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {d && <MatchHud d={d} />}
      <View style={{ flex: 1 }} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!size && width > 0 && height > 0) setSize({ W: width, H: height }); }}>
        {d && size && d.phase === "feed" && <MatchFeed d={d} />}
        {d && size && d.phase !== "feed" && (
          <GestureDetector gesture={pan}>
            <View style={{ flex: 1 }}>
              <Canvas style={{ width: size.W, height: size.H }}><Picture picture={pitchPic} /></Canvas>
              {d.lead && d.lead.lead.skippable && (
                <Text pointerEvents="none" style={{ position: "absolute", top: 10, right: 12, color: C.text, fontWeight: "800", opacity: 0.8 }}>Tap to skip ›</Text>
              )}
              <View pointerEvents="none" style={{ position: "absolute", left: 10, right: 10, bottom: 12 }}>
                {d.feed.slice(-2).map((l, i) => (
                  <Text key={i} style={{ color: C.text, fontWeight: "800", fontSize: 14, textShadowColor: "#000", textShadowRadius: 4 }}>{l}</Text>
                ))}
              </View>
              {d.phase === "tdDribble" && d.tdReady && (
                <View pointerEvents="none" style={{ position: "absolute", top: "40%", left: 20, right: 20, backgroundColor: "rgba(10,16,14,0.9)", borderRadius: 14, padding: 14, borderWidth: 2, borderColor: C.gold }}>
                  <Text style={{ color: C.text, fontWeight: "900", textAlign: "center", fontSize: 16 }}>Tap to start the run. Drag to steer, tap a team-mate to pass.</Text>
                </View>
              )}
            </View>
          </GestureDetector>
        )}
        {d && size && d.phase === "contact" && (
          <GestureDetector gesture={tap}>
            <View style={{ position: "absolute", left: 0, top: 0, width: size.W, height: size.H }}>
              <Canvas style={{ width: size.W, height: size.H }}><Picture picture={contactPic} /></Canvas>
              <View pointerEvents="none" style={{ position: "absolute", top: 14, left: 0, right: 0, alignItems: "center" }}>
                <Text style={{ color: "rgba(255,255,255,0.9)", fontWeight: "900", fontSize: 13, letterSpacing: 1 }}>WHERE DO YOU</Text>
                <Text style={{ color: C.text, fontWeight: "900", fontStyle: "italic", fontSize: 38 }}>{motion === "float" ? "HEAD IT?" : motion === "bounce" ? "VOLLEY IT?" : "STRIKE IT?"}</Text>
                {d.contactTimedOut && <Text style={{ color: "#fca5a5", fontWeight: "900", fontSize: 22, marginTop: 6 }}>TOO SLOW</Text>}
              </View>
            </View>
          </GestureDetector>
        )}
        {banner && (
          banner.text === "GOAL" && lastGoal ? (
            <View pointerEvents="none" style={{ position: "absolute", top: 12, left: 16, right: 16, backgroundColor: "#0b1220", borderRadius: 12, borderWidth: 2, borderColor: C.gold, padding: 12, alignItems: "center" }}>
              <Text style={{ color: C.gold, fontWeight: "900", fontSize: 30 }}>GOAL!</Text>
              <Text style={{ color: C.text, fontWeight: "900", fontSize: 18 }}>
                {d!.setup.fixture.home !== false ? `${d!.userScore} - ${d!.oppScore}` : `${d!.oppScore} - ${d!.userScore}`}
              </Text>
              <Text style={{ color: C.text, fontWeight: "700" }}>⚽ {lastGoal.scorer}{lastGoal.assist ? `  ·  🎯 ${lastGoal.assist}` : ""}</Text>
            </View>
          ) : (
            <View pointerEvents="none" style={{ position: "absolute", top: "30%", left: 0, right: 0, alignItems: "center" }}>
              <Text style={{ backgroundColor: "rgba(0,0,0,0.7)", color: C.text, fontWeight: "900", fontSize: 30, paddingHorizontal: 18, paddingVertical: 6, borderRadius: 6, overflow: "hidden" }}>{banner.text}</Text>
            </View>
          )
        )}
        {d && <MatchPause d={d} />}
      </View>
    </SafeAreaView>
  );
}
