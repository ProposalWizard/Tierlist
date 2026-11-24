/**
 * THE 3D PHONE, IN YOUR HAND (the website's components/star/HousePhone.tsx, RUL-UI-008).
 *
 * Your house and the phone in your hand, as one screen, so the house never loads twice:
 *   - `up` (the Phone tab): an eye-opening (0.6 s) onto your hand holding the phone, your house
 *     behind it from your own eyes, held and dimmed. The REAL phone (screens/world/Phone.tsx, the
 *     same apps) is on the glass: ordinary views, laid onto the picture of the hand with a flat
 *     turn and scale, so each tap goes to the button under the finger.
 *       HOME (the phone's own, on its home screen) → the Home screen;
 *       BACK (on its home screen)                   → put it away: the hand lowers, the camera
 *                                                     eases out of your eyes into the house.
 *   - not `up`: the house as always, plus a "📱 Phone" pill: the camera goes into your eyes and the
 *     phone comes up (0.6 s).
 * A tap during any move skips to its end. The phone is usable at once: nothing waits for the 3D.
 * The house loads behind the phone once it has been up 2.5 s, in idle time (a picture of a blurred
 * room until then), or at once on BACK. While the phone is up the house is HELD: one frame drawn,
 * then no loop at all (HomeController.hold), so the phone costs nothing extra to run.
 *
 * What differs from the website, on purpose:
 *   - the website bends the phone onto the glass with a CSS matrix3d (a full perspective). The
 *     phone's views take a turn and a scale only (RN's hit-testing on Android follows a 2D matrix,
 *     not a bent one), so the glass is the best flat fit to the four corners (about 12 points out
 *     at the worst corner) and the phone's own edge-lit frame covers the rest.
 *   - the house behind is dimmed (a dark layer), not blurred (no cheap blur on the GL view).
 * Kickabout brings the glass flat to your face while it is open, as the website's.
 * Only where `phone3dCan()`; everywhere else (3D off, Low tier, the first visit's tour) the flat phone opens.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { HomeController } from "@/lib/star/home3d/scene";
import { QUAD, SCREEN, STAGE } from "@/lib/star/phone3dGlass";
import { quality3dTier } from "@/lib/star/three3d/quality";
import { hasSeen, isOpen } from "@/lib/star/unlocks";
import { useCareer } from "../../game/store";
import { useNav } from "../../nav";
import { partOff } from "../../safety";
import { SCREENS } from "../../areas/registry";
import { PhoneScreen } from "./Phone";
import { HouseView } from "./House3D";

/* eslint-disable @typescript-eslint/no-require-imports */
const HAND = require("../../../assets/phone3d/hand.webp");
const ROOM = require("../../../assets/phone3d/room-blur.webp");
/* eslint-enable @typescript-eslint/no-require-imports */

/** How long each move takes (ms; the website's T). Opening 0.6 s. */
const T = { open: 600, lower: 300, pull: 700, pullIn: 300, raise: 300 };
/** The phone up this long (ms) before the house behind it starts loading. */
const HOUSE_AFTER = 2500;

/** When the phone was last up and left for another screen (Sponsors, Settings…): coming back puts it straight in your hand. */
let leftUpAt = 0;

/** Can this phone show the 3D phone? The 3D not switched off by the crash guard, not the Low 3D tier, the first-visit tour seen. */
export function phone3dCan(career: Parameters<typeof hasSeen>[0]): boolean {
  if (partOff("3d") || !SCREENS.house) return false;
  if (quality3dTier() === "low") return false;
  return hasSeen(career, "help-phone");
}

/**
 * The glass's flat fit to the four corners (QUAD): a scale on each side and a turn, put at the corners' centre.
 * Pure; the numbers are in the plan notes.
 */
export function glassFit(): { rot: number; sx: number; sy: number; tx: number; ty: number; worst: number } {
  const [tl, tr, br, bl] = QUAD;
  const top = [tr[0] - tl[0], tr[1] - tl[1]], bot = [br[0] - bl[0], br[1] - bl[1]];
  const left = [bl[0] - tl[0], bl[1] - tl[1]], right = [br[0] - tr[0], br[1] - tr[1]];
  const u = [(top[0] + bot[0]) / 2 / SCREEN.w, (top[1] + bot[1]) / 2 / SCREEN.w];
  const v = [(left[0] + right[0]) / 2 / SCREEN.h, (left[1] + right[1]) / 2 / SCREEN.h];
  const rot = Math.atan2(u[1], u[0]);
  const sx = Math.hypot(u[0], u[1]);
  const sy = v[0] * -Math.sin(rot) + v[1] * Math.cos(rot);
  const c = [(tl[0] + tr[0] + br[0] + bl[0]) / 4, (tl[1] + tr[1] + br[1] + bl[1]) / 4];
  // where the box's own centre must go so its centre lands on the corners' centre: p = T + R S p0
  const p0 = [SCREEN.w / 2, SCREEN.h / 2];
  const sp = [p0[0] * sx, p0[1] * sy];
  const rp = [sp[0] * Math.cos(rot) - sp[1] * Math.sin(rot), sp[0] * Math.sin(rot) + sp[1] * Math.cos(rot)];
  const tx = c[0] - rp[0], ty = c[1] - rp[1];
  // how far each corner lands from where the picture's glass has it
  const map = (x: number, y: number) => { const a = x * sx, b = y * sy; return [tx + a * Math.cos(rot) - b * Math.sin(rot), ty + a * Math.sin(rot) + b * Math.cos(rot)]; };
  const got = [map(0, 0), map(SCREEN.w, 0), map(SCREEN.w, SCREEN.h), map(0, SCREEN.h)];
  const worst = Math.max(...got.map((g, i) => Math.hypot(g[0] - QUAD[i][0], g[1] - QUAD[i][1])));
  return { rot, sx, sy, tx, ty, worst };
}
const FIT = glassFit();

type Scene = "opening" | "phone" | "putting-away" | "away" | "taking-out" | "raising";

export interface HousePhoneProps {
  /** The phone is in your hand when the screen opens (the Phone tab); false: you are in the house. */
  up: boolean;
  /** Where the house's Back goes and what it is called: the Garden when you came through its door. */
  from?: "garden" | "phone" | "home";
}

export function HousePhone({ up: upAtStart, from = "home" }: HousePhoneProps) {
  const career = useCareer();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [up, setUp] = useState(upAtStart);
  const [scene, setScene] = useState<Scene>(() => (!upAtStart ? "away" : Date.now() - leftUpAt < 60000 ? "phone" : "opening"));
  const [houseOn, setHouseOn] = useState(!upAtStart);
  const [houseReady, setHouseReady] = useState(false);
  const [flat, setFlat] = useState(false);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const ctrl = useRef<HomeController | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const upRef = useRef(up);
  upRef.current = up;
  const homed = useRef(false);
  /** Whether the house was started in his eyes (decided when it first loads, kept). */
  const povStart = useRef<boolean | null>(null);

  const clear = () => { for (const t of timers.current) clearTimeout(t); timers.current = []; };
  const after = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => {
    clear();
    // left for another screen with the phone up: back in your hand when you return
    if (upRef.current && !homed.current) leftUpAt = Date.now();
  }, []);

  // the hand and the eyes
  const lift = useSharedValue(scene === "opening" ? -1 : 0);
  const eye = useSharedValue(scene === "opening" ? 1 : 0);
  const glare = useSharedValue(scene === "opening" ? 0.45 : 0);
  useEffect(() => {
    if (scene !== "opening") return;
    lift.value = withTiming(0, { duration: T.open, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
    eye.value = withTiming(0, { duration: T.open, easing: Easing.out(Easing.quad) });
    glare.value = withTiming(0, { duration: T.open });
    const t = setTimeout(() => setScene((s) => (s === "opening" ? "phone" : s)), T.open);
    return () => clearTimeout(t);
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  // The house behind the phone loads once the phone has been up a while, in idle time: a quick look at the phone and
  // back Home never pays for building the house. BACK loads it at once.
  useEffect(() => {
    if (houseOn || scene !== "phone") return;
    let id: number | null = null;
    const w = globalThis as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const t = setTimeout(() => {
      if (w.requestIdleCallback) id = w.requestIdleCallback(() => setHouseOn(true), { timeout: 1500 });
      else setHouseOn(true);
    }, HOUSE_AFTER);
    return () => { clearTimeout(t); if (id !== null) w.cancelIdleCallback?.(id); };
  }, [houseOn, scene]);

  const onReady = useCallback((c: HomeController) => {
    ctrl.current = c;
    if (sceneRef.current !== "away") { c.setPov(1); c.hold(true); }
    else if (povStart.current) { c.setPov(null); c.hold(false); } // it opened in his eyes but the phone was put away before it was ready
    setHouseReady(true);
  }, []);
  const onGone = useCallback(() => { ctrl.current = null; setHouseReady(false); }, []);

  /** BACK on the phone: the hand lowers, then the camera eases out of your eyes. */
  const lowerAndPull = useCallback(() => {
    clear();
    setFlat(false);
    setHouseOn(true);
    setScene("putting-away");
    lift.value = withTiming(1, { duration: T.lower, easing: Easing.bezier(0.45, 0, 0.2, 1) });
    after(T.lower, () => {
      const c = ctrl.current;
      if (!c) { setScene("away"); return; }
      if (c.easePov) c.easePov(null, T.pull, () => setScene((s) => (s === "putting-away" ? "away" : s)));
      else { c.setPov(null); c.hold(false); setScene("away"); }
      after(T.pull + 400, () => setScene((s) => (s === "putting-away" ? "away" : s)));
    });
  }, [lift]);

  /** The Phone pill in the house: into your eyes, then the phone comes up. */
  const intoEyes = useCallback(() => {
    clear();
    const c = ctrl.current;
    lift.value = 1;
    if (!c || !c.easePov) { c?.setPov(1); c?.hold(true); lift.value = 0; setScene("phone"); return; }
    setScene("taking-out");
    c.easePov(1, T.pullIn, () => { if (upRef.current) c.hold(true); });
    after(T.pullIn, () => { setScene((s) => (s === "taking-out" ? "raising" : s)); lift.value = withTiming(0, { duration: T.raise, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }); });
    after(T.pullIn + T.raise, () => setScene((s) => (s === "raising" ? "phone" : s)));
  }, [lift]);

  const prevUp = useRef(upAtStart);
  useEffect(() => {
    if (prevUp.current === up) return;
    prevUp.current = up;
    if (up) intoEyes(); else lowerAndPull();
  }, [up, intoEyes, lowerAndPull]);

  /** A tap during a move: straight to its end. */
  const skip = () => {
    clear();
    const c = ctrl.current;
    if (upRef.current) { if (c) { c.setPov(1); c.hold(true); } lift.value = 0; eye.value = 0; glare.value = 0; setScene("phone"); }
    else { if (c) { c.setPov(null); c.hold(false); } setScene("away"); }
  };

  const showPhone = scene === "opening" || scene === "phone" || scene === "putting-away" || scene === "raising";
  const moving = scene === "opening" || scene === "putting-away" || scene === "taking-out" || scene === "raising";

  const fit = box ? Math.min(box.w / STAGE.w, box.h / STAGE.h) : 1;
  const heldStyle = useAnimatedStyle(() => {
    const l = lift.value;
    return { transform: [
      { translateX: l > 0 ? l * 0.12 * STAGE.w : 0 },
      { translateY: l < 0 ? -l * 0.28 * STAGE.h : l * 0.95 * STAGE.h },
      { rotate: `${l < 0 ? l * 4 : l * 14}deg` },
    ] };
  });
  const eyeStyle = useAnimatedStyle(() => ({ opacity: eye.value }));
  const glareStyle = useAnimatedStyle(() => ({ opacity: glare.value }));
  void interpolate;

  const glassStyle = useMemo(() => flat
    ? { transform: [{ translateX: (STAGE.w - SCREEN.w) / 2 }, { translateY: (STAGE.h - SCREEN.h) / 2 }], borderRadius: 28 }
    : { transform: [{ translateX: FIT.tx }, { translateY: FIT.ty }, { rotate: `${FIT.rot}rad` }, { scaleX: FIT.sx }, { scaleY: FIT.sy }], borderRadius: SCREEN.radius },
  [flat]);

  if (houseOn && povStart.current === null) povStart.current = up;
  if (Platform.OS === "web") (globalThis as unknown as { __phone3d?: unknown }).__phone3d = { scene, up, houseReady, flat };
  if (!career) return null;
  const phoneOpen = isOpen(career, "phone");
  const backLabel = from === "garden" ? "Garden" : "Home";

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!box || box.w !== width || box.h !== height) setBox({ w: width, h: height }); }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#1a1612" }]}>
        {houseOn && (
          <HouseView career={career} pov={povStart.current ?? false} chrome={scene === "away"} backLabel={backLabel}
            onBack={() => nav.back()} onDoor={() => { if (from === "garden") nav.back(); else nav.replace("garden", { arrive: "house" }); }}
            onReady={onReady} onGone={onGone} />
        )}
      </View>
      {showPhone && box && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* the room while the house is still loading: a blurred picture, gone once the real house is behind */}
          {!houseReady && <Image source={ROOM} resizeMode="cover" style={StyleSheet.absoluteFill} pointerEvents="none" />}
          {houseReady && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(26,22,18,0.42)" }]} />}
          <View style={{ position: "absolute", left: (box.w - STAGE.w) / 2, bottom: 0, width: STAGE.w, height: STAGE.h, transformOrigin: "50% 100%", transform: [{ scale: fit }] }}>
            <Animated.View style={[StyleSheet.absoluteFill, heldStyle]}>
              {/* the hand and its phone (390 x 844) */}
              <Image source={HAND} resizeMode="stretch" style={{ position: "absolute", left: 0, top: 0, width: STAGE.w, height: STAGE.h, opacity: flat ? 0 : 1 }} pointerEvents="none" />
              <View style={[{ position: "absolute", left: 0, top: 0, width: SCREEN.w, height: SCREEN.h, overflow: "hidden", backgroundColor: "#000", transformOrigin: "0 0" }, glassStyle]}
                pointerEvents={scene === "phone" ? "auto" : "none"}>
                <PhoneScreen glass={{
                  onClose: () => setUp(false),
                  onPhoneHome: () => { homed.current = true; nav.home(); },
                  onHouse: () => { setUp(false); },
                  onApp: (id) => setFlat(id === "kickabout"),
                }} />
              </View>
            </Animated.View>
          </View>
          {scene === "opening" && (
            <>
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff3e0" }, glareStyle]} />
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#0d0504" }, eyeStyle]} />
            </>
          )}
        </View>
      )}
      {moving && <Pressable style={[StyleSheet.absoluteFill, { zIndex: 90 }]} onPressIn={skip} />}
      {scene === "away" && phoneOpen && houseReady && (
        <Pressable onPress={() => setUp(true)} style={{ position: "absolute", right: 12, top: Math.max(12, insets.top) + 48, height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", backgroundColor: "rgba(10,8,6,0.72)", alignItems: "center", justifyContent: "center", zIndex: 81 }}>
          <Text style={{ color: "#f7f1e8", fontWeight: "900", fontSize: 14 }}>📱 Phone</Text>
        </Pressable>
      )}
    </View>
  );
}

/** The nav screen "phone": the phone in your hand (3D) where the phone can, else the flat phone as before. */
export function PhoneRoute({ params }: { params?: Record<string, unknown> }) {
  const career = useCareer();
  if (!career) return null;
  if (!params?.tour && phone3dCan(career)) return <HousePhone up />;
  return <PhoneScreen params={params} />;
}

/** The nav screen "house": your house (from the Garden's door, or the phone's "Your house" app). */
export function HouseRoute({ params }: { params?: Record<string, unknown> }) {
  const from = params?.from === "garden" ? "garden" : params?.from === "phone" ? "phone" : "home";
  return <HousePhone up={false} from={from} />;
}
