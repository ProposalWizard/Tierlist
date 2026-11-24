/**
 * WALK3D: THE SCREEN AROUND ANY WALK-AROUND 3D PLACE (the garden now; the 3D
 * shop, your house and the training pitch next).
 *
 * The website's places (components/star/Garden3D.tsx, Shop3D.tsx, Home3D.tsx …)
 * are a canvas, a stick, a drag to look round, a tap to walk, and a few
 * buttons on top. This is the phone's one version of all of that:
 *
 * - the scene runs on the phone's GL view (expo-gl) through ./walkHost.ts, at
 *   a pixel count chosen once per phone from the 3D quality tier (the view is
 *   laid out smaller and scaled up, as Home's player is);
 * - touch: a finger on the ring at the lower left is the stick (setStick);
 *   anywhere else a drag looks round (orbit), a short tap walks there (tap, else
 *   pick), two fingers zoom (the scene's own pinch, fed the pointers);
 * - it draws only while it is on screen and the app is in front: the frames
 *   stop when the app goes to the background and when the screen closes (the
 *   scene is let go, its GL with it);
 * - a start that throws, takes over 45 s, or a GL the phone took away shows a
 *   plain card ("3D could not start", Back) and never closes the app; the
 *   crash guard (../safety.ts, part "3d") marks the start so a crash while
 *   starting switches the 3D off for the next launch.
 *
 * The screen puts its own buttons and cards in `children`; they sit above the
 * touch layer, so a tap on a button is the button's.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Dimensions, PixelRatio, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TIER_PROFILES, quality3dSetting, quality3dTier, type Quality3d } from "@/lib/star/three3d/quality";
import { useRiskyPart } from "../safety";
import { Press } from "../ui/Press";
import { setupPhone3d } from "./assets";
import { glCounts } from "./gl";
import { startWalkScene, type WalkController, type WalkHost, type WalkStart } from "./walkHost";

/** The longest the scene may take to start before the plain card takes over. */
export const WALK_LOAD_LIMIT_MS = 45000;
const GOLD = "#facc15";
/** The stick: the ring's radius and where it sits (the website's Stick: 132 across, 22 from the left). */
const R = 52, RING = 132, RING_LEFT = 22;

/**
 * The tier a place opens at on this phone: the player's own pick, else the website's Auto
 * (an Android phone: Medium), one step lower on a small screen (under 1000 pixels across:
 * a 2018 phone), and Low after the GL was taken away once.
 */
export function walkTier(attempt: number): Quality3d {
  if (attempt > 0) return "low";
  const t = quality3dTier();
  const win = Dimensions.get("window");
  const px = (PixelRatio.get() || 1) * Math.min(win.width, win.height);
  if (quality3dSetting() === "auto" && px < 1000) return t === "high" ? "medium" : "low";
  return t;
}

/** What a screen can ask of the host it sits in. */
export interface WalkApi {
  /** Start the place again (the phone took the GL away: once, at Low; then the plain card). */
  restart(): void;
  /** Show the plain card now. */
  fail(why: string): void;
  /** True once the screen has closed (callbacks from the scene after that are ignored). */
  dead(): boolean;
}

export interface WalkNumbers { fps: number; calls: number; triangles: number; tier: string; pixelRatio: number; loaded: number }

export interface Walk3DProps<D, CB, C extends WalkController> {
  /** Loads the place's start function (a plain require inside, so the 3D code is read only now). */
  load: () => WalkStart<D, CB, C>;
  data: D;
  /** The callbacks the place wants; made once per start. */
  callbacks: (api: WalkApi) => CB;
  /** Back, from the plain card. */
  onBack: () => void;
  /** The controller, once the place is up (null when it closes): for buttons that act on it. */
  onController?: (c: C | null) => void;
  /** The place is on screen and moving. */
  onReady?: () => void;
  /** Cover colour while it loads, and what to call it ("the garden"). */
  cover?: string;
  name?: string;
  /** Settings → "Show 3D speed". */
  showSpeed?: boolean;
  /** Buttons and cards over the picture. */
  children?: ReactNode;
}

export function Walk3D<D, CB, C extends WalkController>(p: Walk3DProps<D, CB, C>) {
  const allowed = useRiskyPart("3d", { settleMs: 10000 });
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [speed, setSpeed] = useState<WalkNumbers | null>(null);
  const insets = useSafeAreaInsets();
  const cur = useRef(p);
  cur.current = p;
  const live = useRef<{ dead: boolean; host: WalkHost<C> | null; gl: WebGL2RenderingContext | null; tier: Quality3d; pr: number } | null>(null);
  const stick = useRef<StickHandle>(null);
  const touches = useRef(new Map<number, { kind: "stick" | "look"; x: number; y: number; x0: number; y0: number; t0: number; moved: number }>());
  const lastFps = useRef(0);

  const tier = useMemo(() => walkTier(attempt), [attempt]);
  const dpr = PixelRatio.get() || 1;
  const pr = Math.min(dpr, TIER_PROFILES[tier].movePixelRatio);
  const k = pr / dpr;

  // Each GL view's own scene goes when the view is made again or the screen closes.
  useEffect(() => () => {
    const l = live.current;
    if (!l) return;
    l.dead = true;
    l.host?.dispose();
    l.host = null;
    cur.current.onController?.(null);
  }, [attempt]);

  // A plain card means the scene is let go now (not when the screen closes).
  useEffect(() => {
    if (!failed) return;
    const l = live.current;
    if (!l) return;
    l.dead = true;
    l.host?.dispose();
    l.host = null;
    cur.current.onController?.(null);
  }, [failed]);

  // Frames stop in the background and go on in front.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      const h = live.current?.host;
      if (!h) return;
      if (s === "active") {
        h.resume();
        if (h.glLost()) { console.warn("[walk 3D] the GL was taken away while in the background"); restartOnce(); }
      } else h.pause();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restartOnce = useCallback(() => {
    setReady(false);
    setAttempt((n) => { if (n >= 1) { setFailed("The phone took the 3D away"); return n; } return n + 1; });
  }, []);

  const onContext = useCallback((gl: ExpoWebGLRenderingContext) => {
    if (!size) return;
    const me = { dead: false, host: null as WalkHost<C> | null, gl: gl as unknown as WebGL2RenderingContext, tier, pr };
    live.current = me;
    const api: WalkApi = { restart: () => { if (!me.dead) restartOnce(); }, fail: (why) => { if (!me.dead) { console.warn("[walk 3D] failed:", why); setFailed(why); } }, dead: () => me.dead };
    const limit = setTimeout(() => { if (!me.host && !me.dead) { console.warn("[walk 3D] took too long; plain card instead"); setFailed("It took too long to load"); } }, WALK_LOAD_LIMIT_MS);
    (async () => {
      try {
        setupPhone3d();
        const q = cur.current;
        const start = q.load();
        const host = await startWalkScene<D, CB, C>({
          start, data: q.data, callbacks: q.callbacks(api), gl: me.gl, width: size.w, height: size.h, pixelRatio: pr, quality: tier,
        });
        clearTimeout(limit);
        if (me.dead) { host.dispose(); return; }
        me.host = host;
        if (AppState.currentState !== "active") host.pause();
        cur.current.onController?.(host.controller);
        setReady(true);
        cur.current.onReady?.();
      } catch (e) {
        clearTimeout(limit);
        console.warn("[walk 3D] could not start:", e);
        if (!me.dead) setFailed(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [size, tier, pr, restartOnce]);

  // The speed readout: frames handed to the screen a second, draw calls, triangles.
  useEffect(() => {
    if (!p.showSpeed || !ready) { setSpeed(null); return; }
    let f0 = 0, t0 = Date.now();
    const id = setInterval(() => {
      const l = live.current;
      if (!l?.host || !l.gl) return;
      const now = Date.now(), frames = glCounts(l.gl).frames;
      const fps = f0 ? ((frames - f0) * 1000) / Math.max(1, now - t0) : 0;
      f0 = frames; t0 = now;
      lastFps.current = fps;
      const st = l.host.controller.stats?.();
      setSpeed({ fps, calls: st?.calls ?? 0, triangles: st?.triangles ?? 0, tier: String(st?.quality ?? l.tier), pixelRatio: l.pr, loaded: Number(st?.loaded ?? 0) });
    }, 1000);
    return () => clearInterval(id);
  }, [p.showSpeed, ready]);

  // ── touches ──
  /** When the touch happened (the event's own time, so a busy moment between the events does not turn a tap into a press). */
  const stamp = (e: GestureResponderEvent) => { const n = e.nativeEvent as { timestamp?: number; timeStamp?: number }; return Number(n.timestamp ?? n.timeStamp) || Date.now(); };
  const ringCentre = () => ({ x: RING_LEFT + RING / 2, y: (size?.h ?? 0) - Math.max(28, insets.bottom + 16) - RING / 2 });
  const pt = (t: { locationX?: number; locationY?: number; pageX?: number; pageY?: number }) => ({ x: t.locationX ?? t.pageX ?? 0, y: t.locationY ?? t.pageY ?? 0 });
  const onStart = (e: GestureResponderEvent) => {
    const host = live.current?.host;
    for (const t of e.nativeEvent.changedTouches) {
      const { x, y } = pt(t as never);
      const c = ringCentre();
      const onRing = Math.hypot(x - c.x, y - c.y) <= RING / 2 + 22;
      const hasStick = Array.from(touches.current.values()).some((v) => v.kind === "stick");
      const kind = onRing && !hasStick ? "stick" : "look";
      touches.current.set(t.identifier as number, { kind, x, y, x0: x, y0: y, t0: stamp(e), moved: 0 });
      if (kind === "stick") moveStick(x, y);
      else host?.pointer("pointerdown", t.identifier as number, x, y);
    }
  };
  const moveStick = (x: number, y: number) => {
    const c = ringCentre();
    let dx = x - c.x, dy = y - c.y;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    stick.current?.set(dx, dy);
    live.current?.host?.controller.setStick(dx / R, -dy / R);
  };
  const onMove = (e: GestureResponderEvent) => {
    const host = live.current?.host;
    for (const t of e.nativeEvent.changedTouches) {
      const v = touches.current.get(t.identifier as number);
      if (!v) continue;
      const { x, y } = pt(t as never);
      if (v.kind === "stick") { moveStick(x, y); v.x = x; v.y = y; continue; }
      host?.pointer("pointermove", t.identifier as number, x, y);
      v.moved += Math.abs(x - v.x) + Math.abs(y - v.y);
      // two fingers are down: the scene's zoom owns them, a look-round must not turn too
      if (host && host.pinching()) { v.moved += 99; } else host?.controller.orbit(x - v.x, y - v.y);
      v.x = x; v.y = y;
    }
  };
  const onEnd = (e: GestureResponderEvent, cancelled: boolean) => {
    const host = live.current?.host;
    for (const t of e.nativeEvent.changedTouches) {
      const v = touches.current.get(t.identifier as number);
      if (!v) continue;
      touches.current.delete(t.identifier as number);
      const { x, y } = pt(t as never);
      if (v.kind === "stick") { stick.current?.set(0, 0); host?.controller.setStick(0, 0); continue; }
      host?.pointer(cancelled ? "pointercancel" : "pointerup", t.identifier as number, x, y);
      // a tap, not a drag of the view: walk there (the place's tap), else its pick
      if (!cancelled && host && v.moved < 10 && stamp(e) - v.t0 < 800) {
        const c = host.controller;
        if (c.tap) c.tap(x, y); else c.pick?.(x, y);
      }
    }
  };

  if (failed || !allowed) return <PlainCard what={p.name ?? "3D"} why={failed} onBack={p.onBack} cover={p.cover} />;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.cover ?? "#0d1420", overflow: "hidden" }]} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height }); }}>
      {size && (
        <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
          <GLView key={`${attempt}`} msaaSamples={0} onContextCreate={onContext}
            style={{ position: "absolute", width: size.w * k, height: size.h * k, left: (size.w - size.w * k) / 2, top: (size.h - size.h * k) / 2, transform: [{ scale: 1 / k }] }} />
        </View>
      )}
      {/* the touch layer: under the buttons and cards, over the picture */}
      <View collapsable={false} style={StyleSheet.absoluteFill} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={(e) => onEnd(e, false)} onTouchCancel={(e) => onEnd(e, true)} />
      {ready && <Stick ref={stick} bottom={Math.max(28, insets.bottom + 16)} />}
      {p.children}
      {speed && (
        <View pointerEvents="none" style={{ position: "absolute", left: 6, bottom: Math.max(4, insets.bottom + 2), backgroundColor: "rgba(0,0,0,0.62)", paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5 }}>
          <Text style={{ color: "#d1fae5", fontSize: 10, lineHeight: 12.5, fontWeight: "700", fontFamily: "monospace" }}>
            {`${speed.fps.toFixed(0)} fps  ${speed.calls} draws  ${(speed.triangles / 1000).toFixed(0)}k tris\npx ${speed.pixelRatio.toFixed(2)}  ${speed.tier}`}
          </Text>
        </View>
      )}
      {!ready && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: p.cover ?? "#0d1420", alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
          <ActivityIndicator color={GOLD} size="large" />
        </View>
      )}
    </View>
  );
}

// ── the stick ───────────────────────────────────────────────────────────────

interface StickHandle { set(dx: number, dy: number): void }
const Stick = forwardRef<StickHandle, { bottom: number }>(function Stick({ bottom }, ref) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  useImperativeHandle(ref, () => ({ set: (dx, dy) => setKnob({ x: dx, y: dy }) }), []);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: RING_LEFT, bottom, width: RING, height: RING, borderRadius: RING / 2, backgroundColor: "rgba(255,240,220,0.08)", borderWidth: 2, borderColor: "rgba(255,230,200,0.25)" }}>
      <View style={{ position: "absolute", left: RING / 2 - 28 - 2, top: RING / 2 - 28 - 2, width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,248,236,0.9)", transform: [{ translateX: knob.x }, { translateY: knob.y }] }} />
    </View>
  );
});

// ── the plain card ──────────────────────────────────────────────────────────

function PlainCard({ what, why, onBack, cover }: { what: string; why: string | null; onBack: () => void; cover?: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: cover ?? "#0d1420", alignItems: "center", justifyContent: "center", padding: 24 }]}>
      <View style={{ backgroundColor: "rgba(14,12,10,0.86)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(250,204,21,0.25)", padding: 18, alignItems: "center", gap: 10, maxWidth: 320 }}>
        <Text style={{ fontSize: 30 }}>🛠️</Text>
        <Text style={{ color: "#f7f1e8", fontSize: 17, fontWeight: "900" }}>3D could not start</Text>
        <Text style={{ color: "rgba(247,241,232,0.7)", fontSize: 12, fontWeight: "600", textAlign: "center" }}>{`${what} needs the phone's 3D.${why ? `\n${why}` : ""}`}</Text>
        <Press onPress={onBack} style={{ height: 40, paddingHorizontal: 22, borderRadius: 12, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>Back</Text>
        </Press>
      </View>
    </View>
  );
}
