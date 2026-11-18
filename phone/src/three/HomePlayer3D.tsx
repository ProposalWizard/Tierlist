/**
 * YOUR 3D PLAYER ON HOME AND THE TITLE SCREEN (the website's
 * components/star/ToonHomePlayer.tsx, on the phone's graphics chip).
 *
 * The same man (./homeScene.ts): head, build, skin, hair (Settings → Your
 * look), club kit and number, the relaxed idle with its keepy-uppies; on Home
 * drag to turn him, and he drifts back to his quarter turn.
 *
 * Light on purpose (on the website this player redrawing 30 times a second
 * for as long as Home was open was a measured cause of lag):
 * - drawn by the phone's graphics chip (expo-gl), at most 2 pixels per point
 *   (the GL view is made smaller and scaled up, so a 3x phone draws 2.25x
 *   fewer pixels), at most 30 frames a second;
 * - only while it is on screen and the app is in front (the phone's screens
 *   close when covered; the loop stops when the app goes to the background);
 * - and only for IDLE_MS after the screen opens or after a touch: then the
 *   loop stops and the last frame stays on screen (nothing is drawn at all
 *   until he is touched again or Home opens again);
 * - he is built once and kept (./homeScene.ts), so going back to Home does not
 *   load or unpack anything again.
 * Until he is drawn: the picture of him from the last visit (kept on this
 * phone), else a soft grey shape. If 3D can't start, `fallback` (the drawn
 * figure) stays, as on the website.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppState, Image, PanResponder, PixelRatio, View } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { Skia } from "@shopify/react-native-skia";
import { Directory, File, Paths } from "expo-file-system";
import type { CareerState } from "@/lib/star/types";
import { toonYou, subscribeToonYou } from "@/lib/star/style3d/toon/bodies";
import { setupPhone3d } from "./assets";
import type { HomeScene } from "./homeScene";

/** The loop stops this long after the screen opens or after the last touch (the last frame stays). */
export const IDLE_MS = 6000;
/** At most this many pixels per point (the website: Math.min(2, devicePixelRatio)). */
export const MAX_PIXEL_RATIO = 2;
/** At most 30 frames a second, as the website. */
const FRAME_MS = 33;

/** What the last frames cost on this phone (JavaScript ms per frame, frames drawn, draw calls): a meter can read it. */
export const home3dStats = { frames: 0, jsMs: [] as number[], calls: 0, triangles: 0, buildMs: 0, firstMs: 0 };

export function HomePlayer3D({ career, width, height, where, kitShirt, kitTrim, fallback }: {
  career: CareerState; width: number; height: number; where: "home" | "title"; kitShirt: string; kitTrim: string; fallback: ReactNode;
}) {
  const you = useSyncExternalStore(subscribeToonYou, toonYou, toonYou);
  const num = career.squadNumber ?? 9;
  const sig = [where, width, height, kitShirt, kitTrim, num, you.head, you.body, you.skin, you.hair, you.name ?? ""].join("|");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [snap, setSnap] = useState<string | null>(() => readSnap(where, sig));
  useEffect(() => { setSnap(readSnap(where, sig)); setReady(false); setFailed(false); }, [where, sig]);

  const turn = useRef({ yaw: where === "title" ? -0.35 : 0.32, drag: false, from: 0 });
  const loop = useRef<{ wake: () => void } | null>(null);
  const dpr = PixelRatio.get() || 1;
  const pr = Math.min(MAX_PIXEL_RATIO, dpr);
  // the GL view is laid out smaller and scaled up: its own pixels are (width × pr) × (height × pr)
  const k = pr / dpr;
  const glW = width * k, glH = height * k;

  const pan = useMemo(() => PanResponder.create({
    // only a sideways drag turns him: an up-and-down one still scrolls Home
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => where === "home" && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { turn.current.drag = true; turn.current.from = turn.current.yaw; loop.current?.wake(); },
    onPanResponderMove: (_e, g) => { turn.current.yaw = turn.current.from + g.dx * 0.02; loop.current?.wake(); },
    onPanResponderRelease: () => { turn.current.drag = false; loop.current?.wake(); },
    onPanResponderTerminate: () => { turn.current.drag = false; loop.current?.wake(); },
  }), [where]);

  const onContext = (gl: ExpoWebGLRenderingContext) => {
    const mine = sig;
    let dead = false, raf = 0, last = 0, scene: HomeScene | null = null;
    let cleanup = () => {};
    let awakeUntil = Date.now() + IDLE_MS;
    let active = AppState.currentState === "active";
    const t0 = Date.now();
    const sub = AppState.addEventListener("change", (s) => {
      active = s === "active";
      if (active) wake(); else { cancelAnimationFrame(raf); raf = 0; }
    });
    const frame = (now: number) => {
      raf = 0;
      if (dead || !scene || !active) return;
      const tr = turn.current;
      const settled = tr.drag || Math.abs(tr.yaw - scene.restYaw) < 0.003;
      // asleep: the last frame stays on screen and nothing more is drawn
      if (Date.now() > awakeUntil && settled) return;
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      if (!tr.drag && where === "home") tr.yaw += (scene.restYaw - tr.yaw) * 0.04; // drifts back to his pose
      scene.drawAt((Date.now() - t0) / 1000, tr.yaw);
      const inf = scene.info();
      home3dStats.frames++;
      home3dStats.calls = inf.calls; home3dStats.triangles = inf.triangles;
      home3dStats.jsMs.push(inf.jsMs);
      if (home3dStats.jsMs.length > 120) home3dStats.jsMs.shift();
    };
    const wake = () => {
      awakeUntil = Date.now() + IDLE_MS;
      if (!raf && !dead && scene && active) raf = requestAnimationFrame(frame);
    };
    loop.current = { wake };
    (async () => {
      try {
        setupPhone3d();
        const THREE = await import("three");
        const { prepareGl, sceneCanvas } = await import("./gl");
        const { buildHomeScene } = await import("./homeScene");
        if (dead) return;
        prepareGl(gl);
        const b0 = Date.now();
        const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas(gl) as never, context: gl as never, antialias: false, alpha: true, powerPreference: "low-power" });
        renderer.setPixelRatio(1);
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight, false);
        const s = await buildHomeScene(renderer, { where, width, height, kitShirt, kitTrim, num, you });
        if (dead) { s.dispose(); renderer.dispose(); return; }
        home3dStats.buildMs = Date.now() - b0;
        scene = s;
        if (where === "title") turn.current.yaw = s.restYaw;
        // the first picture: drawn now, kept for the next visit's wait when the kept one is missing or out of date
        const f0 = Date.now();
        s.drawAt(0, turn.current.yaw);
        home3dStats.firstMs = Date.now() - f0;
        if (readSnap(where, sig) === null) keepSnap(where, sig, gl);
        setReady(true);
        cleanup = () => { s.dispose(); renderer.dispose(); };
        wake();
      } catch (e) {
        console.warn("3D home player", e);
        if (!dead) setFailed(true);
      }
    })();
    stops.current.set(mine, () => { dead = true; cancelAnimationFrame(raf); sub.remove(); if (loop.current?.wake === wake) loop.current = null; cleanup(); });
  };
  // each GL view's loop stops with it (a new look makes a new view; leaving the screen stops all)
  const stops = useRef(new Map<string, () => void>());
  useEffect(() => () => { stops.current.get(sig)?.(); stops.current.delete(sig); }, [sig]);

  return (
    <View style={{ width, height }} {...pan.panHandlers} onTouchStart={() => loop.current?.wake()}>
      {failed ? fallback : (
        <View style={{ position: "absolute", left: 0, top: 0, width, height, overflow: "hidden" }} pointerEvents="none">
          <GLView key={sig} msaaSamples={0} onContextCreate={onContext}
            style={{ position: "absolute", width: glW, height: glH, left: (width - glW) / 2, top: (height - glH) / 2, transform: [{ scale: 1 / k }] }} />
        </View>
      )}
      {!ready && !failed && (snap
        ? <Image source={{ uri: snap }} style={{ position: "absolute", left: 0, top: 0, width, height }} fadeDuration={0} />
        : <WaitShape width={width} height={height} />)}
    </View>
  );
}

/** The wait with no kept picture: a soft grey player shape where he will stand (the website's, on a 100 × 200 grid). */
function WaitShape({ width, height }: { width: number; height: number }) {
  const u = Math.min(width / 100, height / 200);
  const x0 = (width - 100 * u) / 2, y0 = height - 200 * u;
  const grey = "rgba(255,255,255,0.13)";
  const box = (x: number, y: number, w: number, h: number, r = 0) => ({ position: "absolute" as const, left: x0 + x * u, top: y0 + y * u, width: w * u, height: h * u, borderRadius: r * u, backgroundColor: grey });
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height }}>
      <View style={box(39, 15, 22, 22, 11)} />
      <View style={box(30, 41, 40, 59, 8)} />
      <View style={box(44, 98, 10, 90, 2)} />
    </View>
  );
}

// ── The kept picture (one per place, with what he looked like when it was taken) ──

const snapKey = (where: string) => "kib-toon-snap-" + where;
function readSnap(where: string, sig: string): string | null {
  try {
    const v = JSON.parse(globalThis.localStorage?.getItem(snapKey(where)) ?? "null") as { sig?: string; uri?: string } | null;
    if (!v || v.sig !== sig || typeof v.uri !== "string") return null;
    return new File(v.uri).exists ? v.uri : null;
  } catch { return null; }
}
/** Read the frame just drawn (before it goes to the screen) and keep it as a picture file. */
function keepSnap(where: string, sig: string, gl: WebGL2RenderingContext) {
  try {
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const raw = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const row = w * 4, data = new Uint8Array(raw.length);
    for (let y = 0; y < h; y++) data.set(raw.subarray(y * row, y * row + row), (h - 1 - y) * row);
    const img = Skia.Image.MakeImage({ width: w, height: h, colorType: 4, alphaType: 2 } as never, Skia.Data.fromBytes(data), row);
    const png = img?.encodeToBytes();
    if (!png) return;
    const dir = new Directory(Paths.cache, "kib-home3d");
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const f = new File(dir, `${where}-${Date.now().toString(36)}.png`);
    f.create({ overwrite: true });
    void f.write(png).then(() => {
      try {
        const old = JSON.parse(globalThis.localStorage?.getItem(snapKey(where)) ?? "null") as { uri?: string } | null;
        globalThis.localStorage?.setItem(snapKey(where), JSON.stringify({ sig, uri: f.uri }));
        if (old?.uri && old.uri !== f.uri) { try { new File(old.uri).delete(); } catch { /* gone already */ } }
      } catch { /* no storage: the grey shape next time */ }
    });
  } catch { /* no picture: the grey shape next time */ }
}
