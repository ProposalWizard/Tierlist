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
 * - while a place is mounted, a JavaScript error (a frame, a callback out of the scene, a timer, a promise) never reaches the
 *   app's global handler: ./crashNet.ts writes it to storage, fails the place over to its plain version and switches the Live 3D
 *   scenes off; the scene's `onEvent` is handed to the screen after the frame, not inside it. A view that is gone makes every
 *   GL call a no-op (neutralizeGl).
 *
 * The screen puts its own buttons and cards in `children`; they sit above the
 * touch layer, so a tap on a button is the button's.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Dimensions, PixelRatio, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TIER_PROFILES, quality3dSetting, quality3dTier, type Quality3d } from "@/lib/star/three3d/quality";
import { useRiskyPart, markStep, clearTrail, notePulse } from "../safety";
import { Press } from "../ui/Press";
import { setupPhone3d } from "./assets";
import { glCounts } from "./gl";
import { placeOpened, settleHeadshots, glViewAlive, waitNoGlView } from "./glBusy";
import { neutralizeGl, registerPlace, type PlaceNet } from "./crashNet";
import { startWalkScene, type WalkController, type WalkHost, type WalkStart } from "./walkHost";
import { LeaveGate, registerWalkGate } from "./walkLeave";

/** The longest the scene may take to start before the plain card takes over. */
export const WALK_LOAD_LIMIT_MS = 45000;
const GOLD = "#facc15";
/**
 * After the screen before it has gone, how long a place waits (with its plain loading cover up) before it makes its GL view (26 Nov 2026).
 * The signing closed the app at "mounted (view being made)" straight after the trial's screens went; whatever those left behind (images,
 * the match's JavaScript objects, a GL being let go) gets this moment to settle. A guess at the cause, a cheap and safe cure either way.
 */
export const GL_SETTLE_MS = 800;
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

export interface WalkNumbers { fps: number; calls: number; triangles: number; tier: string; pixelRatio: number; loaded: number; /** KIB RIDE: the garden's walk / horse / car */ mode?: string }

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
  /** Put the speed readout at the top left (a screen with its own bar at the bottom). */
  speedTop?: boolean;
  /** A short tap on the picture. Default: the place's own `tap` (walk there), else its `pick`. The 3D shop picks first, then walks. */
  onTap?: (c: C, x: number, y: number) => void;
  /** Hide the stick (a card is open over it): a finger there looks round instead. */
  hideStick?: boolean;
  /** Words under the spinner while the place loads ("Opening the shop…"). */
  loading?: { title: string; sub?: string };
  /** A second way out on the plain card, when the 3D could not start ("Open the normal shop"). */
  fallback?: { label: string; onPress: () => void };
  /** Draw only: no touch layer and no stick, so every touch goes to what is over the picture (the 3D phone's house behind the glass). */
  inert?: boolean;
  /**
   * For a picture that is only a layer over something that works without it (the Crossbar Challenge's 3D pitch over the
   * engine's own): when the 3D cannot start (or the crash guard has it off), show nothing and say why here, instead of the plain card.
   */
  onFail?: (why: string) => void;
  /** How long the place may take to start before the plain card (or `onFail`) takes over; default WALK_LOAD_LIMIT_MS. The nights use the website's 20 s. */
  loadLimitMs?: number;
  /** The tier this place opens at, in place of `walkTier` (the match view never opens above Medium). A second start after the GL was lost is always Low. */
  tierFor?: (attempt: number) => Quality3d;
  /** Buttons and cards over the picture. */
  children?: ReactNode;
}

export function Walk3D<D, CB, C extends WalkController>(p: Walk3DProps<D, CB, C>) {
  const allowed = useRiskyPart("3d", { settleMs: 10000 });
  // crash breadcrumbs (../safety.ts): the last step this place reached survives a native crash and is shown in Settings next launch
  const place = p.name ?? "3D place";
  const marked = useRef(false);
  if (allowed && !marked.current) { marked.current = true; markStep(place, "mounted (waiting for the screen before to go quiet)"); }
  const viewMarked = useRef(false);
  const [failed, setFailed] = useState<string | null>(null);
  // The GL view is made only once the screen before has gone and gone quiet (see GL_SETTLE_MS); until then the loading cover shows.
  const [viewOk, setViewOk] = useState(false);
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
  // the crash net (./crashNet.ts): this place counts as mounted from its first draw to its close
  const net = useRef<PlaceNet | null>(null);
  const unmounted = useRef(false);
  // Skip / Back during the load wait for the start, then the scene is disposed, THEN the screen goes (./walkLeave.ts)
  const [leaving, setLeaving] = useState(false);
  const gate = useRef<LeaveGate | null>(null);
  if (!gate.current) {
    gate.current = new LeaveGate({
      dispose: () => { const l = live.current; if (l) letGo(l); },
      after: (fn) => { requestAnimationFrame(() => requestAnimationFrame(() => { markStep(place, "left (scene let go first)"); fn(); })); },
      leaving: (on) => { markStep(place, on ? "leave asked while starting: waiting for the start" : "leaving"); setLeaving(on); },
      timer: (fn, ms) => { const t = setTimeout(fn, ms); return () => clearTimeout(t); },
    });
  }
  useEffect(() => registerWalkGate(gate.current!), []);

  const tier = useMemo(() => (attempt > 0 ? "low" : p.tierFor ? p.tierFor(attempt) : walkTier(attempt)), [attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const dpr = PixelRatio.get() || 1;
  const pr = Math.min(dpr, TIER_PROFILES[tier].movePixelRatio);
  const k = pr / dpr;

  // While this place is open the headshot maker makes nothing (./glBusy.ts), and the view waits for the screen before it and for the headshot GL.
  useEffect(() => {
    if (!allowed) return;
    const closed = placeOpened();
    let live2 = true;
    const frame2 = () => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    (async () => {
      await frame2();
      await settleHeadshots();
      await waitNoGlView(); // no other GL view (the title's or Home's player, let go a moment ago) is still being torn down
      await new Promise<void>((res) => setTimeout(res, GL_SETTLE_MS));
      if (!live2 || gate.current?.wantsLeave) return; // left before the view was made: no view is made
      markStep(place, "view allowed (screen before has gone quiet)");
      setViewOk(true);
    })();
    return () => { live2 = false; closed(); };
  }, [allowed, place]);

  // This place's GL view counts as alive from the moment it is allowed until its scene is let go (./glBusy.ts)
  useEffect(() => { if (!viewOk) return; return glViewAlive(); }, [viewOk]);

  // The crash net: while this place is mounted, a JavaScript error fails it over to its plain version (./crashNet.ts).
  useEffect(() => {
    if (!allowed) return;
    unmounted.current = false;
    const n = registerPlace(place, (why) => setFailed((f) => f ?? why));
    net.current = n;
    return () => { unmounted.current = true; n.unregister(); if (net.current === n) net.current = null; };
  }, [allowed, place]);

  /** Let the scene go, then make every later GL call a no-op (a late timer or frame of the scene must not reach the native side). */
  const letGo = (l: NonNullable<typeof live.current>) => {
    l.dead = true;
    try { l.host?.dispose(); } catch (e) { console.warn("[walk 3D] dispose", e); }
    l.host = null;
    if (l.gl) neutralizeGl(l.gl);
    try { cur.current.onController?.(null); } catch (e) { console.warn("[walk 3D] onController", e); }
  };

  // Each GL view's own scene goes when the view is made again or the screen closes.
  useEffect(() => () => {
    const l = live.current;
    clearTrail(place); // a clean close (or a restart) is not a crash
    if (!l) return;
    letGo(l);
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // A plain card means the scene is let go now (not when the screen closes).
  useEffect(() => {
    if (!failed) return;
    clearTrail(place); // a failure the app caught is not a crash (its error is kept apart: Settings → "Last error")
    const l = live.current;
    if (l) letGo(l);
    gate.current?.settled(); // the view is gone with the plain card: nothing left to wait for
  }, [failed]); // eslint-disable-line react-hooks/exhaustive-deps

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
    gate.current?.starting();
    setAttempt((n) => { if (n >= 1) { setFailed("The phone took the 3D away"); return n; } return n + 1; });
  }, []);

  const onContext = useCallback((gl: ExpoWebGLRenderingContext) => {
    // the view was closed (or let go after a failure) before the phone gave it a GL: nothing to start, and the GL is left alone
    if (!size || unmounted.current) { neutralizeGl(gl); gate.current?.settled(); return; }
    // Skip / Back was tapped before the phone gave the view its GL: nothing is started on it; the leave goes on once the context is let go
    if (gate.current?.wantsLeave) { neutralizeGl(gl); gate.current.settled(); return; }
    const me = { dead: false, host: null as WalkHost<C> | null, gl: gl as unknown as WebGL2RenderingContext, tier, pr };
    live.current = me;
    markStep(place, `gl context created (attempt ${attempt}, ${tier}, ${size.w}x${size.h})`);
    const api: WalkApi = { restart: () => { if (!me.dead) restartOnce(); }, fail: (why) => { if (!me.dead) { console.warn("[walk 3D] failed:", why); setFailed(why); } }, dead: () => me.dead };
    // every scene callback goes through the net: `onEvent` is noted (a step: "event stamp") and handed on after the frame
    const wrap = <T,>(cb: T): T => (net.current ? net.current.wrapCallbacks(cb, () => me.dead || unmounted.current) : cb);
    const limit = setTimeout(() => { if (!me.host && !me.dead) { console.warn("[walk 3D] took too long; plain card instead"); setFailed("It took too long to load"); } }, cur.current.loadLimitMs ?? WALK_LOAD_LIMIT_MS);
    (async () => {
      try {
        setupPhone3d();
        const q = cur.current;
        const start = q.load();
        const host = await startWalkScene<D, CB, C>({
          start, data: q.data, callbacks: wrap(q.callbacks(api)), gl: me.gl, width: size.w, height: size.h, pixelRatio: pr, quality: tier,
          onStep: (t) => { if (!me.dead) markStep(place, t); },
          onFrame: () => { if (!me.dead) notePulse(place); },
          onFrameError: (e) => {
            if (me.dead) return;
            console.warn("[walk 3D] a frame failed; plain card instead:", e);
            // written to storage, the switch turned off and this place failed over (./crashNet.ts); without the net, the plain card as before
            if (!net.current?.onFrameError(e)) setFailed("A frame failed: " + (e instanceof Error ? e.message : String(e)));
          },
        });
        clearTimeout(limit);
        if (me.dead) { host.dispose(); neutralizeGl(me.gl); gate.current?.settled(); return; }
        me.host = host;
        // Skip / Back was tapped while the scene was starting: it is up now, so it is disposed here (never handed to the screen) and the leave goes on
        if (gate.current?.wantsLeave) { gate.current.settled(); return; }
        if (AppState.currentState !== "active") host.pause();
        // the scene's own calls that move it along (shots, the signing) are steps too: "setShot(shake)", "sign()"
        traceCalls(host.controller, place, () => me.dead);
        cur.current.onController?.(host.controller);
        gate.current?.settled();
        setReady(true);
        // first frame handed to the screen; the trail then stays until the place closes cleanly, or has run 10 s after its LAST step
        const poll = setInterval(() => {
          if (me.dead) { clearInterval(poll); return; }
          try { if (glCounts(me.gl).frames > 0) { markStep(place, "first frame"); clearInterval(poll); } } catch { clearInterval(poll); }
        }, 200);
        cur.current.onReady?.();
      } catch (e) {
        clearTimeout(limit);
        console.warn("[walk 3D] could not start:", e);
        if (!me.dead) setFailed(e instanceof Error ? e.message : String(e));
        gate.current?.settled();
      }
    })();
  }, [size, tier, pr, restartOnce, place, attempt]);

  // The speed readout: frames handed to the screen a second, draw calls, triangles.
  useEffect(() => {
    if (!p.showSpeed || !ready) { setSpeed(null); return; }
    let f0 = 0, d0 = 0, r0 = 0, t0 = Date.now();
    const id = setInterval(() => {
      const l = live.current;
      if (!l?.host || !l.gl) return;
      const now = Date.now(), { frames, draws, tris } = glCounts(l.gl);
      const fps = f0 ? ((frames - f0) * 1000) / Math.max(1, now - t0) : 0;
      // draw calls a frame as the GL counted them (every pass: shadows, the picture, the finishing pass); a scene's own count can be the last pass alone
      const perFrame = f0 && frames > f0 ? Math.round((draws - d0) / (frames - f0)) : 0;
      const triPerFrame = f0 && frames > f0 ? Math.round((tris - r0) / (frames - f0)) : 0;
      f0 = frames; d0 = draws; r0 = tris; t0 = now;
      lastFps.current = fps;
      const st = l.host.controller.stats?.();
      setSpeed({ fps, calls: perFrame || (st?.calls ?? 0), triangles: (st?.triangles ?? 0) >= 1000 ? st!.triangles : triPerFrame, tier: String(st?.quality ?? l.tier), pixelRatio: l.pr, loaded: Number(st?.loaded ?? 0), mode: st?.mode ? String(st.mode) : undefined });
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
      const onRing = !cur.current.hideStick && Math.hypot(x - c.x, y - c.y) <= RING / 2 + 22;
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
        // a scene's own tap may throw (the shop's, on a tap exactly under his feet): never let that close the app
        try {
          if (cur.current.onTap) cur.current.onTap(c, x, y);
          else if (c.tap) c.tap(x, y); else c.pick?.(x, y);
        } catch (err) { console.warn("[walk 3D] a tap failed:", err); }
      }
    }
  };

  // the last step before the phone's own GL is made: a close after this one and before "gl context created" is inside the native GL view
  if (size && viewOk && !viewMarked.current && !failed && allowed) { viewMarked.current = true; gate.current?.starting(); markStep(place, `GLView being made (${size.w}x${size.h})`); }

  const failWhy = failed ?? (!allowed ? "The 3D is switched off" : null);
  const onFailNow = p.onFail;
  useEffect(() => { if (failWhy && onFailNow) onFailNow(failWhy); }, [failWhy]); // eslint-disable-line react-hooks/exhaustive-deps
  if (failWhy && onFailNow) return null;
  if (failed || !allowed) return <PlainCard what={p.name ?? "3D"} why={failed} onBack={p.onBack} cover={p.cover} fallback={p.fallback} />;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: p.cover ?? "#0d1420", overflow: "hidden" }]} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height }); }}>
      {size && viewOk && (
        <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
          <GLView key={`${attempt}`} msaaSamples={0} onContextCreate={onContext} pointerEvents="none"
            style={{ position: "absolute", width: size.w * k, height: size.h * k, left: (size.w - size.w * k) / 2, top: (size.h - size.h * k) / 2, transform: [{ scale: 1 / k }] }} />
        </View>
      )}
      {/* the touch layer: under the buttons and cards, over the picture */}
      {!p.inert && <View collapsable={false} style={StyleSheet.absoluteFill} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={(e) => onEnd(e, false)} onTouchCancel={(e) => onEnd(e, true)} />}
      {ready && !p.hideStick && !p.inert && <Stick ref={stick} bottom={Math.max(28, insets.bottom + 16)} />}
      {speed && (
        <View pointerEvents="none" style={{ position: "absolute", left: 6, ...(p.speedTop ? { top: 4 } : { bottom: Math.max(4, insets.bottom + 2) }), backgroundColor: "rgba(0,0,0,0.62)", paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5 }}>
          <Text style={{ color: "#d1fae5", fontSize: 10, lineHeight: 12.5, fontWeight: "700", fontFamily: "monospace" }}>
            {`${speed.fps.toFixed(0)} fps  ${speed.calls} draws  ${speed.triangles < 1000 ? "?" : (speed.triangles / 1000).toFixed(0) + "k"} tris\npx ${speed.pixelRatio.toFixed(2)}  ${speed.tier}${speed.mode ? `\nmode ${speed.mode === "horse" ? "ride" : speed.mode === "car" ? "drive" : "walk"}` : ""}`}
          </Text>
        </View>
      )}
      {!ready && !p.inert && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: p.cover ?? "#0d1420", alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
          <ActivityIndicator color={GOLD} size="large" />
          {p.loading ? (
            <View style={{ marginTop: 14, alignItems: "center" }}>
              <Text style={{ color: "#f7f1e8", fontWeight: "900", fontSize: 17 }}>{p.loading.title}</Text>
              {p.loading.sub ? <Text style={{ color: "#c9bba8", fontWeight: "700", fontSize: 13, marginTop: 6 }}>{p.loading.sub}</Text> : null}
            </View>
          ) : null}
        </View>
      )}
      {/* the screen's own buttons and cards: above the loading cover, so Back is there while it loads */}
      {p.children}
      {leaving && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }]}>
          <ActivityIndicator color={GOLD} />
          <Text style={{ marginTop: 10, color: "#f7f1e8", fontWeight: "900", fontSize: 15 }}>Leaving…</Text>
        </View>
      )}
    </View>
  );
}

/** The calls on a scene's controller that move a scene along are written as steps ("setShot(shake)", "sign()", "skip()"): the trail follows the whole scene. */
const TRACED = ["setShot", "sign", "skip", "setYou"] as const;
function traceCalls(c: unknown, place: string, dead: () => boolean) {
  const o = c as Record<string, unknown> | null;
  if (!o) return;
  for (const k of TRACED) {
    const f = o[k];
    if (typeof f !== "function") continue;
    try {
      o[k] = (...a: unknown[]) => {
        if (!dead()) markStep(place, `${k}(${a.map((x) => (typeof x === "object" ? "…" : String(x))).join(",")})`);
        return (f as (...x: unknown[]) => unknown).apply(o, a);
      };
    } catch { /* a read-only controller: no step for this call */ }
  }
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

function PlainCard({ what, why, onBack, cover, fallback }: { what: string; why: string | null; onBack: () => void; cover?: string; fallback?: { label: string; onPress: () => void } }) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: cover ?? "#0d1420", alignItems: "center", justifyContent: "center", padding: 24 }]}>
      <View style={{ backgroundColor: "rgba(14,12,10,0.86)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(250,204,21,0.25)", padding: 18, alignItems: "center", gap: 10, maxWidth: 320 }}>
        <Text style={{ fontSize: 30 }}>🛠️</Text>
        <Text style={{ color: "#f7f1e8", fontSize: 17, fontWeight: "900" }}>3D could not start</Text>
        <Text style={{ color: "rgba(247,241,232,0.7)", fontSize: 12, fontWeight: "600", textAlign: "center" }}>{`${what} needs the phone's 3D.${why ? `\n${why}` : ""}`}</Text>
        {fallback && (
          <Press onPress={fallback.onPress} style={{ height: 40, paddingHorizontal: 22, borderRadius: 12, backgroundColor: GOLD, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#111", fontWeight: "900", fontSize: 15 }}>{fallback.label}</Text>
          </Press>
        )}
        <Press onPress={onBack} style={{ height: 40, paddingHorizontal: 22, borderRadius: 12, backgroundColor: fallback ? "rgba(255,255,255,0.1)" : GOLD, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: fallback ? "#f7f1e8" : "#111", fontWeight: "900", fontSize: 15 }}>Back</Text>
        </Press>
      </View>
    </View>
  );
}
