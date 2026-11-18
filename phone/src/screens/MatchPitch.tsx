/**
 * THE PITCH, ITS TOUCHES AND THE STRIKE SCREEN — shared by the career match
 * (screens/Match.tsx) and every feature on the match (screens/MatchFeature.tsx:
 * the trial's stages and the training drills), the way the website's
 * CanvasMatch is mounted by both the career and EnginePlay/EngineFeature.
 *
 * Smoothness: the pitch is recorded as a Skia picture each frame and handed
 * to the canvas through a shared value, so React does not re-render per
 * frame. React re-renders only when the driver's uiVersion changes. The
 * match steps in the website's 60-a-second frames whatever the phone's
 * refresh rate.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text } from "react-native";
import { Canvas, Picture, createPicture } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { MatchKits } from "@/lib/star/kits";
import { nudgeFromDrag, RUNUP } from "@/lib/star/penaltyRunup";
import { MatchDriver, FRAME_DT } from "../match/driver";
import { drawPitch, camFor } from "../match/drawPitch";
import { drawContact, contactBallBox } from "../match/drawContact";
import { fromScreen, screenPull, grabMetres, type Cam } from "../match/view";
import { tapToContact } from "../match/contactBall";
import { matchSounds } from "../match/sound";
import { C } from "../ui/theme";

const BALL_GRAB_FRACTION = 0.18;
const CAPTAIN_GRAB_FRACTION = 0.09;
export const BANNER_MS = 1200;

export interface PitchProps {
  /** Made once the pitch's shape is known (the camera frames each chance for it). */
  make: (hw: number) => MatchDriver;
  kits: MatchKits;
  /** Called once when the driver says it is done (full time). */
  onDone?: (d: MatchDriver) => void;
  /** Every React-visible change (the driver's uiVersion). */
  onUi?: (d: MatchDriver) => void;
  /** Drawn over the pitch (words, cards), given the driver. */
  overlay?: (d: MatchDriver, size: { W: number; H: number }) => ReactNode;
  /** The match's GOAL banner etc. (CanvasMatch scene.banners). Default on. */
  banners?: boolean;
  /** Fixed height in px (a feature's box); absent: fill the parent. */
  height?: number;
}

export function MatchPitch({ make, kits, onDone, onUi, overlay, banners = true, height }: PitchProps) {
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  const [, setUi] = useState(0);
  const dRef = useRef<MatchDriver | null>(null);
  const camRef = useRef<Cam | null>(null);
  const empty = useMemo(() => createPicture(() => {}), []);
  const pitchPic = useSharedValue(empty);
  const contactPic = useSharedValue(empty);
  const onDoneRef = useRef(onDone); onDoneRef.current = onDone;
  const onUiRef = useRef(onUi); onUiRef.current = onUi;

  if (size && !dRef.current) {
    const d = make(size.H / size.W);
    d.start();
    dRef.current = d;
  }

  useEffect(() => {
    if (!size) return;
    let raf = 0, last = 0, acc = 0, lastUi = -1, finished = false;
    const sounds = matchSounds();
    const loop = (t: number) => {
      const d = dRef.current!;
      if (!last) last = t;
      acc += Math.min(0.25, (t - last) / 1000);
      last = t;
      while (acc >= FRAME_DT) { d.tick(); acc -= FRAME_DT; }
      sounds.follow(d);
      const { W, H } = size;
      if (d.phase !== "feed" && d.phase !== "done") {
        camRef.current = camFor(d, W, H);
        pitchPic.value = drawPitch(d, kits, W, H);
        if (d.phase === "contact") contactPic.value = drawContact(d, W, H);
      }
      if (d.uiVersion !== lastUi) { lastUi = d.uiVersion; setUi(lastUi); onUiRef.current?.(d); }
      if (d.done && !finished) { finished = true; onDoneRef.current?.(d); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); sounds.stop(); };
  }, [size, kits, pitchPic, contactPic]);

  // ── Touches on the pitch ──
  const pan = useMemo(() => {
    let start = { x: 0, y: 0 }, nudgeBase = 0, laneBase = 0, laneX = 0;
    const pull = (drag: { x: number; y: number }, ball: { x: number; y: number }) => (camRef.current ? screenPull(camRef.current, drag, ball) : 0);
    return Gesture.Pan().runOnJS(true).minDistance(0)
      .onBegin((e) => {
        const d = dRef.current, cam = camRef.current;
        if (!d || !cam || d.held) return;
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
        if (!d || !cam || d.held) return;
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
        if (!d || !cam || d.held) return;
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
    if (!d || !size || d.phase !== "contact" || d.held) return;
    const bb = contactBallBox(d, size.W, size.H);
    const c = tapToContact(e.x - bb.x, e.y - bb.y, bb.r);
    if (!c) return;
    d.tapContact(c.cx, c.cy);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }), [size]);

  const d = dRef.current;
  const banner = banners && d?.banner && d.now - d.banner.at < BANNER_MS ? d.banner : null;
  const motion = d && d.phase === "contact" ? d.strikeMotion() : "still";

  return (
    <View style={height ? { height } : { flex: 1 }} onLayout={(e) => { const { width, height: h } = e.nativeEvent.layout; if (!size && width > 0 && h > 0) setSize({ W: width, H: h }); }}>
      {d && size && d.phase !== "feed" && (
        <GestureDetector gesture={pan}>
          <View style={{ flex: 1 }}>
            <Canvas style={{ width: size.W, height: size.H }}><Picture picture={pitchPic} /></Canvas>
            {d.lead && d.lead.lead.skippable && (
              <Text pointerEvents="none" style={{ position: "absolute", top: 10, right: 12, color: C.text, fontWeight: "800", opacity: 0.8 }}>Tap to skip ›</Text>
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
      {banner && banner.text !== "GOAL" && (
        <View pointerEvents="none" style={{ position: "absolute", top: "30%", left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ backgroundColor: "rgba(0,0,0,0.7)", color: C.text, fontWeight: "900", fontSize: 30, paddingHorizontal: 18, paddingVertical: 6, borderRadius: 6, overflow: "hidden" }}>{banner.text}</Text>
        </View>
      )}
      {d && size && overlay?.(d, size)}
    </View>
  );
}
