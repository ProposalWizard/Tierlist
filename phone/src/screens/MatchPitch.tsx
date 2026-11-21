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
import { View, Text, Image, type ViewStyle } from "react-native";
import { Canvas, Picture, createPicture, Skia } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { keeperKit, type MatchKits } from "@/lib/star/kits";
import { nudgeFromDrag, RUNUP } from "@/lib/star/penaltyRunup";
import { MatchDriver, FRAME_DT } from "../match/driver";
import { drawPitch, camFor } from "../match/drawPitch";
import { drawContact, contactBallBox, setContactBallImage } from "../match/drawContact";
import { fromScreen, toScreen, screenPull, grabMetres, type Cam } from "../match/view";
import { tapToContact } from "../match/contactBall";
import { matchSounds } from "../match/sound";
import { matchFeel } from "../match/feel";
import { isAirKind } from "@/lib/star/airDrawings";
import { airTapOn } from "@/lib/star/airTap";
import { setSkia } from "../match/skiaApi";
import { setFigureFonts } from "../match/figures";
import { phoneFontFor } from "../draw/useDrawing";
import { loadSpriteSheet } from "../match/spriteAssets";
import { warmSpriteKits } from "../match/sprites";
import { installWebStorage } from "../match/webStorage";
import { C } from "../ui/theme";
import { ICON } from "../ui/look";
import { Caption } from "./MatchLook";

setSkia(Skia);
// The takers' names over their heads are drawn with the phone's own fonts.
setFigureFonts(phoneFontFor);
// The strike screen's ball: the club's own photo (public/star/ball.webp), decoded once.
let ballLoading: Promise<void> | null = null;
function loadContactBall() {
  ballLoading ??= (async () => {
    try {
      const uri = Image.resolveAssetSource(ICON.ball)?.uri;
      if (!uri) return;
      setContactBallImage(Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri)));
    } catch { ballLoading = null; }
  })();
}
// The lib's localStorage (picture memory, cards seen) on the phone's storage, before the first chance.
installWebStorage();

/** The build-up's own line over the picture when it asks for one (CanvasMatch stepLeadIn → leadCap), else null. */
function leadCaption(d: MatchDriver): string | null {
  const L = d.lead;
  return L && L.lead.captionShown && L.t < L.lead.durS ? L.lead.captionAt?.(L.t) ?? null : null;
}

/** A new story career's first match (CanvasMatch coachFirstChance's career half). */
function firstStoryMatch(d: MatchDriver): boolean {
  const c = d.setup.career;
  return !!c?.unlocks?.story && (c.careerStats?.appearances ?? 0) === 0;
}
/** CanvasMatch data-first-chance-coach's words. */
function coachText(d: MatchDriver): string {
  const aim = d.phase === "aim";
  if (isAirKind(d.sc.kind) && airTapOn()) {
    return aim ? (d.sc.kind === "header" ? "A header! Watch him go up for the cross" : "A volley! Watch him meet the ball")
      : "Tap the ball before the ring runs out. Its left side sends it right";
  }
  return aim ? "Drag back from the ball to aim and control your power, then let go" : "Tap the part of the ball you want to kick";
}
/** The coach card: dark glass with a yellow ring, low on the pitch while you aim, mid-left on the strike screen. */
function CoachCard({ text, aim }: { text: string; aim: boolean }) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", zIndex: 40, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
      backgroundColor: "rgba(5,8,15,0.82)", boxShadow: "inset 0px 0px 0px 2px #fde047, 0px 8px 20px -8px rgba(0,0,0,0.9)" } as ViewStyle,
      aim ? { left: 12, right: 12, bottom: 64 } : { left: 12, right: 56, top: "40%" }]}>
      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", lineHeight: 17, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

const BALL_GRAB_FRACTION = 0.18;
const CAPTAIN_GRAB_FRACTION = 0.09;

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
  /** Every drawn frame, with the camera it was drawn with (the website's EngineFrame observer). */
  onFrame?: (d: MatchDriver, cam: Cam) => void;
  /** The match stands still (the observer's `hold`): no more frames stepped, the last picture stays. */
  frozen?: boolean;
  /** Coach the first chance (CanvasMatch coachFirstChance): the website's Kickabout (its stand-in career is new to the story). */
  coachFirst?: boolean;
}

/** ContactBall's words and POWER bar over the strike screen (plain views: they hold still for the whole screen). */
function StrikeWords({ d, motion }: { d: MatchDriver; motion: string }) {
  const pct = Math.round((d.aim?.power ?? 0) * 100);
  const glow = pct < 40 ? "#22c55e" : pct < 75 ? "#eab308" : "#ef4444";
  const shadow = { textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 };
  return (
    <>
      {/* The header (WHERE DO YOU, the brushed-steel title, the air hint, the draining bar) is drawn per frame: drawContact.ts. */}
      <View pointerEvents="none" style={{ position: "absolute", right: 10, top: 0, bottom: 0, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1.4, marginBottom: 6, ...shadow }}>POWER</Text>
        <View style={{ height: 112, width: 12, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden", justifyContent: "flex-end" }}>
          <View style={{ height: `${pct}%`, borderRadius: 6, backgroundImage: "linear-gradient(0deg, #22c55e, #eab308, #ef4444)", boxShadow: `0px 0px 8px ${glow}99` } as ViewStyle} />
        </View>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", marginTop: 6, ...shadow }}>{pct}%</Text>
      </View>
      {d.contactTimedOut && (
        <View pointerEvents="none" style={{ position: "absolute", top: "34%", left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 12, overflow: "hidden", paddingHorizontal: 16, paddingVertical: 8, color: "#fca5a5", fontSize: 30, fontWeight: "900", fontStyle: "italic", letterSpacing: 2 }}>
            {motion === "float" || motion === "bounce" ? "TOO LATE!" : "TOO SLOW!"}
          </Text>
        </View>
      )}
    </>
  );
}

export function MatchPitch({ make, kits, onDone, onUi, overlay, banners = true, height, onFrame, frozen = false, coachFirst = false }: PitchProps) {
  // CanvasMatch's chance counter for its coach lines: +1 each time the aim comes up.
  const coachRef = useRef({ chances: 0, phase: "" });
  const capSideRef = useRef<"top" | "bottom">("top");
  const onFrameRef = useRef(onFrame); onFrameRef.current = onFrame;
  const frozenRef = useRef(frozen); frozenRef.current = frozen;
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  const [, setUi] = useState(0);
  const [, setBannerTick] = useState(0);
  const dRef = useRef<MatchDriver | null>(null);
  const camRef = useRef<Cam | null>(null);
  const empty = useMemo(() => createPicture(() => {}), []);
  const pitchPic = useSharedValue(empty);
  const contactPic = useSharedValue(empty);
  const onDoneRef = useRef(onDone); onDoneRef.current = onDone;
  const onUiRef = useRef(onUi); onUiRef.current = onUi;

  // The players' sprite sheet: decoded once, then coloured once per kit in the match (before kick-off, never mid-frame).
  useEffect(() => {
    let live = true;
    loadContactBall();
    void loadSpriteSheet().then((ok) => {
      if (!ok || !live) return;
      // CanvasMatch warmSpriteKits: both sides, their keeper and ours (a shootout's).
      const sk = (k: { shirt: string; trim: string }) => ({ shirt: k.shirt, shorts: k.trim, socks: k.shirt });
      warmSpriteKits([sk(kits.home), sk(kits.away), sk(kits.keeper), sk(keeperKit(kits.home.shirt, kits.keeper.shirt)), sk(keeperKit(kits.away.shirt, kits.keeper.shirt))]);
    });
    return () => { live = false; };
  }, [kits]);

  if (size && !dRef.current) {
    const d = make(size.H / size.W);
    d.start();
    dRef.current = d;
  }

  useEffect(() => {
    if (!size) return;
    let raf = 0, last = 0, acc = 0, lastUi = -1, finished = false;
    let shownBanner: unknown = null, shownCap: string | null = null;
    const sounds = matchSounds();
    const feel = matchFeel();
    const loop = (t: number) => {
      const d = dRef.current!;
      if (!last) last = t;
      const frameS = (t - last) / 1000;
      last = t;
      if (frozenRef.current) { acc = 0; raf = requestAnimationFrame(loop); return; }
      // Match feel: the picture holds at the contact (the wind-up, then the hit-stop); nothing is stepped meanwhile.
      if (feel.tick(Math.min(0.05, Math.max(0, frameS)))) acc = 0;
      else acc += Math.min(0.25, frameS);
      let steps = 0;
      while (acc >= FRAME_DT) { d.tick(); acc -= FRAME_DT; steps++; }
      feel.follow(d, steps * FRAME_DT);
      sounds.follow(d);
      { const cr = coachRef.current; if (d.phase === "aim" && cr.phase !== "aim") cr.chances += 1; cr.phase = d.phase; }
      // A waiting pop-up comes up, or the last one goes (MikeyPopup's timers): redraw the words.
      const shown = d.bannerNow();
      const cap = leadCaption(d);
      const { W, H } = size;
      // CanvasMatch bannerSideNow: the half the ball is not in; near the middle a caption already up stays put.
      let side = capSideRef.current;
      if (shown && camRef.current && d.phase !== "feed" && d.phase !== "done") {
        const fy = toScreen(camRef.current, d.ball ? d.ball.pos : d.sc.ball).Y / H;
        if (!(shown === shownBanner && fy > 0.4 && fy < 0.6)) side = fy < 0.5 ? "bottom" : "top";
      }
      if (shown !== shownBanner || cap !== shownCap || side !== capSideRef.current) { shownBanner = shown; shownCap = cap; capSideRef.current = side; setBannerTick((v) => v + 1); }
      if (d.phase !== "feed" && d.phase !== "done") {
        camRef.current = camFor(d, W, H);
        pitchPic.value = drawPitch(d, kits, W, H, feel.offset(camRef.current));
        onFrameRef.current?.(d, camRef.current);
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
        // The buzz comes at the contact, scaled by the strike (match/feel.ts), as on the website.
        d.pointerUp(pull);
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
  }), [size]);

  const d = dRef.current;
  const banner = banners && d ? d.bannerNow() : null;
  const motion = d && d.phase === "contact" ? d.strikeMotion() : "still";

  return (
    <View style={height ? { height } : { flex: 1 }} onLayout={(e) => {
      // Follow every change of the box: the career match's scoreboard appears above the
      // pitch only once the driver exists, which shrinks this box after its first layout.
      // Holding the first size drew the strike screen taller than the frame (its ball cut off).
      const { width, height: h } = e.nativeEvent.layout;
      if (!(width > 0 && h > 0) || (size && Math.abs(size.W - width) < 0.5 && Math.abs(size.H - h) < 0.5)) return;
      if (dRef.current) dRef.current.hw = h / width;
      setSize({ W: width, H: h });
    }}>
      {d && size && d.phase !== "feed" && (
        <GestureDetector gesture={pan}>
          <View style={{ flex: 1 }}>
            <Canvas style={{ width: size.W, height: size.H }}><Picture picture={pitchPic} /></Canvas>
            {d.lead && d.lead.lead.skippable && (
              // CanvasMatch data-buildup: bottom centre, the lead-in's own line ("On the break") or "Build-up".
              <View pointerEvents="none" style={{ position: "absolute", bottom: 8, left: 0, right: 0, alignItems: "center" }}>
                <View style={{ borderRadius: 99, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900" }}>{leadCaption(d) ?? "Build-up"} · tap to skip</Text>
                </View>
              </View>
            )}
          </View>
        </GestureDetector>
      )}
      {d && size && d.phase === "contact" && (
        <GestureDetector gesture={tap}>
          <View style={{ position: "absolute", left: 0, top: 0, width: size.W, height: size.H }}>
            <Canvas style={{ width: size.W, height: size.H }}><Picture picture={contactPic} /></Canvas>
            <StrikeWords d={d} motion={motion} />
          </View>
        </GestureDetector>
      )}
      {d && d.phase === "runup" && d.runup?.nudge && (
        // CanvasMatch: the run-up says what it is while it is live, on the empty grass under the arc.
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "64%", zIndex: 20, alignItems: "center" }}>
          <Text numberOfLines={1} style={{ borderRadius: 99, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 4, color: "#fff", fontSize: 11, fontWeight: "900" }}>↔ Drag sideways to change your aim</Text>
        </View>
      )}
      {banner && banner.text !== "GOAL" && (
        // Mikey's pop-ups: every word but a goal is a TV caption (MikeyPopup.tsx Caption), in the half
        // of the pitch the ball is NOT in (14% or 74% down), so it never sits on the ball.
        <View pointerEvents="none" style={{ position: "absolute", top: capSideRef.current === "bottom" ? "74%" : "14%", left: 0, right: 0, alignItems: "center" }}>
          <Caption text={banner.text} id={banner} ms={banner.ms} />
        </View>
      )}
      {d && size && (d.phase === "aim" || d.phase === "contact") && !d.lead && (coachFirst || firstStoryMatch(d)) && coachRef.current.chances <= 1 && (
        <CoachCard text={coachText(d)} aim={d.phase === "aim"} />
      )}
      {d && size && overlay?.(d, size)}
    </View>
  );
}
