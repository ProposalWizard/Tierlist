import { automatic3dAllowed } from "../game/prefs";
/**
 * THE FAREWELL WALK-OUT AND THE STANDING OVATION (the website's
 * components/star/Farewell.tsx GuardOfHonour and StandingOvation, and the
 * farewell-walkout phase of app/star-dev/page.tsx).
 *
 * - Guard of honour: both teams in two lines, clapping; you walk out between
 *   them. The website's own scene (lib/star/farewell3d.ts), run on the
 *   phone's graphics chip (./farewellScenes.ts). "Kick off ›" any time.
 * - Standing ovation (off at 85'): the camera circles you, the ground
 *   stands, team-mates and rivals stop you for a hug or a dap-up, the
 *   substitute hugs you on the line (lib/star/ovation3d.ts, the greetings from
 *   public/star/ovation3d/greetings.glb, Settings → Look "Ovation greetings",
 *   lib/star/ovationMoves.ts). It plays over the match, as on the website.
 * Each runs only while it is on screen (the scene's own frame loop, capped by
 * the 3D quality tier; it ends when the screen closes). If 3D can't start, or
 * takes over 20 seconds to load, the drawn version plays instead, as on the
 * website.
 */
import { TopSpace } from "../ui/safe";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text, Image, PixelRatio, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withDelay, Easing } from "react-native-reanimated";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import type { CareerState } from "@/lib/star/types";
import { RIVALS_KITS, YOU_ID, type FarewellSides } from "@/lib/star/farewell";
import { kitsOf, type Kit } from "@/lib/star/kits";
import { shortNameOf } from "@/lib/star/realSquad";
import { fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { wornAccessories } from "@/lib/star/signing3d";
import type { SigningYou } from "@/lib/star/signing3dScene";
import { ovationPlan, greetingCaption, type OvationPlan, type OvationPerson, type OvationStop } from "@/lib/star/ovation";
import { GUARD } from "@/lib/star/guardOfHonour";
import { TIER_PROFILES, quality3dTier } from "@/lib/star/three3d/quality";
import { packedPicture } from "../data/packed";
import { absoluteUrl } from "../draw/offscreen";
import { playCheer } from "../match/sound";
import { Press } from "../ui/Press";
import { setupPhone3d } from "./assets";

/**
 * The 3D scenes' code, loaded the first time a farewell plays. A plain `require`
 * on purpose: `await import()` was cut into a separate file by the bundler and
 * the farewell died with "Requiring unknown module" when that file was not
 * there. This way the code is always inside the app's one bundle, and still
 * only runs when the farewell starts. If it throws, the drawn version plays.
 */
function loadScenes(): typeof import("./farewellScenes") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./farewellScenes") as typeof import("./farewellScenes");
}

const GOLD = "#fbbf24";
/** The longest the 3D may take to load before the drawn version takes over (the website's). */
const LOAD_LIMIT_MS = 20000;

function hostKit(career: CareerState, host: string): Kit {
  return kitsOf(host, career.clubKits?.[host]).home;
}

/** Your look for the 3D people (Farewell.tsx useYouLook; photo faces are off: the drawn head). */
function youLook(career: CareerState, kit: Kit): SigningYou {
  return {
    skin: skinToneHex(career.player.skinTone),
    face: null,
    accessories: wornAccessories(career.equippedAccessories),
    kit,
    number: career.squadNumber ?? null,
    hairStyle: resolveHairStyle(career.player.hairStyle),
    hair: hairColourHex(career.player.hairColour),
  };
}

function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ── The 3D view: a GL view the website's scene draws into ───────────────────

interface SceneHandle { dispose(): void }

/**
 * A full-screen GL view at the 3D quality tier's pixels per point (the view is
 * laid out smaller and scaled up), handed to `start` once; the scene is let
 * go when the view closes. `onFail` after an error or LOAD_LIMIT_MS.
 */
function Scene3D({ start, onFail, waiting }: { start: (gl: WebGL2RenderingContext) => Promise<SceneHandle>; onFail: () => void; waiting: string }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const cb = useRef({ start, onFail });
  cb.current = { start, onFail };
  const handle = useRef<SceneHandle | null>(null);
  const dead = useRef(false);
  useEffect(() => () => { dead.current = true; handle.current?.dispose(); handle.current = null; }, []);
  const dpr = PixelRatio.get() || 1;
  const pr = Math.min(TIER_PROFILES[quality3dTier()].maxPixelRatio, dpr);
  const k = pr / dpr;
  const onContext = (gl: ExpoWebGLRenderingContext) => {
    const limit = setTimeout(() => { if (!handle.current && !dead.current) { console.warn("[farewell 3D] took too long; drawn instead"); cb.current.onFail(); } }, LOAD_LIMIT_MS);
    // anything thrown while starting (not only a failed promise) goes to the drawn version
    let going: Promise<SceneHandle>;
    try { setupPhone3d(); going = cb.current.start(gl as unknown as WebGL2RenderingContext); }
    catch (e) { going = Promise.reject(e); }
    going.then((h) => {
      clearTimeout(limit);
      if (dead.current) { h.dispose(); return; }
      handle.current = h;
      setReady(true);
    }, (e) => {
      clearTimeout(limit);
      console.warn("[farewell 3D] failed; drawn instead:", e);
      if (!dead.current) cb.current.onFail();
    });
  };
  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!size) setSize({ w: width, h: height }); }}>
      {size && (
        <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
          <GLView msaaSamples={0} onContextCreate={onContext}
            style={{ position: "absolute", width: size.w * k, height: size.h * k, left: (size.w - size.w * k) / 2, top: (size.h - size.h * k) / 2, transform: [{ scale: 1 / k }] }} />
        </View>
      )}
      {!ready && <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none"><Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 }}>{waiting.toUpperCase()}</Text></View>}
    </View>
  );
}

/** A fault while DRAWING the 3D view (not only while loading it) shows the drawn version too. */
class Safe3D extends Component<{ onFail: () => void; children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch(e: unknown) { console.warn("[farewell 3D] could not draw; drawn instead:", e); this.props.onFail(); }
  render() { return this.state.bad ? null : this.props.children; }
}

// ── The guard of honour (page.tsx farewell-walkout) ─────────────────────────

export function GuardOfHonour({ career, sides, onDone }: { career: CareerState; sides: FarewellSides; onDone: () => void }) {
  const [mode, setMode] = useState<"3d" | "drawn">(!automatic3dAllowed() ? "drawn" : "3d");
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; doneRef.current(); } };
  useEffect(() => { playCheer(); }, []);
  const kit = hostKit(career, sides.host);
  const start = useMemo(() => async (gl: WebGL2RenderingContext) => {
    const { startGuardOfHonour } = loadScenes();
    return startGuardOfHonour(gl, {
      you: youLook(career, kit), ours: kit, rivals: RIVALS_KITS.home,
      seed: (career.player.startYear ?? 0) * 31 + career.season,
      onDone: () => finish(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: "#0a1426", overflow: "hidden" }}>
      {mode === "3d"
        ? <Safe3D onFail={() => setMode("drawn")}><Scene3D start={start} onFail={() => setMode("drawn")} waiting="Walking out…" /></Safe3D>
        : <GuardDrawn career={career} sides={sides} kit={kit} onDone={finish} />}
      <Heading kicker="The farewell" title="Guard of honour" />
      <View pointerEvents="none" style={{ position: "absolute", top: 120, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ backgroundColor: "rgba(17,24,39,.8)", color: RIVALS_KITS.home.trim, fontSize: 11, fontWeight: "900", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, textTransform: "uppercase" }}>{sides.rivals.name}</Text>
        <Text style={{ backgroundColor: rgba(kit.shirt, 0.85), color: "#fff", fontSize: 11, fontWeight: "900", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, textTransform: "uppercase", textShadowColor: "#000", textShadowRadius: 2 }}>{sides.ours.name}</Text>
      </View>
      <GoldButton label="Kick off ›" onPress={finish} />
    </View>
  );
}

function Heading({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, alignItems: "center", backgroundColor: "rgba(0,0,0,0.28)" }}>
      <TopSpace min={48} />
      <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900", letterSpacing: 3.3, textTransform: "uppercase" }}>{kicker}</Text>
      <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900", textTransform: "uppercase", textShadowColor: "rgba(0,0,0,.8)", textShadowRadius: 6 }}>{title}</Text>
      {sub ? <Text style={{ color: "rgba(255,255,255,.9)", fontSize: 12, fontWeight: "700", marginTop: 2, marginBottom: 6 }}>{sub}</Text> : <View style={{ height: 8 }} />}
    </View>
  );
}

function GoldButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={{ position: "absolute", right: 16, bottom: 28, backgroundColor: "#f59e0b", borderRadius: 2, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 2, borderTopColor: "#fde047" }}>
      <Text style={{ color: "#030712", fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>{label}</Text>
    </Press>
  );
}

// ── The standing ovation (plays over the farewell match) ────────────────────

/** Who stops you on the way off: two team-mates, two rivals, the substitute (Farewell.tsx ovationPlanFor). */
export function ovationPlanFor(sides: FarewellSides): OvationPlan {
  const name = (n: string) => shortNameOf(n);
  const xi = new Set(sides.ours.lineup.xi.filter((id): id is string => !!id && id !== YOU_ID));
  const mates: OvationPerson[] = sides.ours.players
    .filter((p) => xi.has(p.id))
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 2)
    .map((p) => ({ id: p.id, name: p.shortName || name(p.name), team: "ours" }));
  const rivalXI = new Set(sides.rivals.lineup.xi.filter((id): id is string => !!id));
  const rivals: OvationPerson[] = sides.rivals.who
    .filter((r) => rivalXI.has(r.id))
    .sort((a, b) => Number(!!b.ballonDor) - Number(!!a.ballonDor) || (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 2)
    .map((r) => ({ id: r.id, name: name(r.name), team: "rivals" }));
  const subId = (sides.ours.lineup.bench ?? []).find((id) => id && id !== YOU_ID && !mates.some((m) => m.id === id));
  const subP = subId ? sides.ours.players.find((p) => p.id === subId) : undefined;
  const sub: OvationPerson | null = subP ? { id: subP.id, name: subP.shortName || name(subP.name), team: "ours" } : null;
  return ovationPlan(mates, rivals, sub);
}

export function StandingOvation({ career, sides, minute, onDone }: { career: CareerState; sides: FarewellSides; minute: number; onDone: () => void }) {
  const [mode, setMode] = useState<"3d" | "drawn">(!automatic3dAllowed() ? "drawn" : "3d");
  const plan = useMemo(() => ovationPlanFor(sides), [sides]);
  const [caption, setCaption] = useState<string | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = useRef(false);
  const finish = () => { if (!finished.current) { finished.current = true; doneRef.current(); } };
  useEffect(() => { playCheer(); }, []);
  const kit = hostKit(career, sides.host);
  const onStop = (s: OvationStop | null) => setCaption(s ? greetingCaption(s) : null);
  const stopRef = useRef(onStop);
  stopRef.current = onStop;
  const start = useMemo(() => async (gl: WebGL2RenderingContext) => {
    const { startOvation } = loadScenes();
    return startOvation(gl, {
      you: youLook(career, kit), ours: kit, rivals: RIVALS_KITS.home, plan,
      seed: (career.player.startYear ?? 0) * 37 + career.season,
      onDone: () => finish(),
      onStop: (s) => stopRef.current(s),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a1426", overflow: "hidden", zIndex: 60, elevation: 60 }]}>
      {mode === "3d"
        ? <Safe3D onFail={() => setMode("drawn")}><Scene3D start={start} onFail={() => setMode("drawn")} waiting="The ground rises…" /></Safe3D>
        : <OvationDrawn career={career} sides={sides} kit={kit} plan={plan} onStop={onStop} onDone={finish} />}
      <Heading kicker={`${minute}' · You come off`} title="Standing ovation" sub={`${career.player.firstName} ${career.player.lastName}`} />
      {caption && (
        <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: 86, alignItems: "center" }}>
          <Text style={{ backgroundColor: "rgba(10,20,38,.82)", color: "#fff", fontSize: 13, fontWeight: "900", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 2, borderWidth: 1, borderColor: "rgba(251,191,36,.55)" }}>{caption}</Text>
        </View>
      )}
      <GoldButton label="Skip ›" onPress={finish} />
    </View>
  );
}

// ── The drawn versions (a phone that can't run 3D) ──────────────────────────

interface Chip { id: string; name: string; face?: string; badge?: string; you?: boolean }

function oursChips(career: CareerState, sides: FarewellSides): Chip[] {
  return sides.ours.lineup.xi.filter((id): id is string => !!id).map((id) => {
    if (id === YOU_ID) return { id, name: "You", face: career.player.portrait ?? DEFAULT_FAKE_FACE, you: true };
    const p = sides.ours.players.find((x) => x.id === id);
    return { id, name: p ? (p.shortName || shortNameOf(p.name)) : "—", face: p?.imageUrl };
  });
}
function rivalChips(sides: FarewellSides): Chip[] {
  return sides.rivals.lineup.xi.filter((id): id is string => !!id).map((id) => {
    const r = sides.rivals.who.find((x) => x.id === id);
    return { id, name: r ? shortNameOf(r.name) : "—", face: r?.face, badge: r?.ballonDor ? "🏅" : undefined };
  });
}
const pictureUri = (url: string) => packedPicture(url) ?? absoluteUrl(url);

/** Farewell.tsx FaceChip: his face in a ring of his kit, his name under it. */
function FaceChip({ chip, kit, size = 42 }: { chip: Chip; kit: Kit; size?: number }) {
  const fallback = fakeFaceFor(chip.id);
  const [src, setSrc] = useState(chip.face || fallback);
  return (
    <View style={{ alignItems: "center", width: size + 12 }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: kit.shirt, borderWidth: 2, borderColor: chip.you ? GOLD : kit.trim }}>
        <Image source={{ uri: pictureUri(src) }} style={{ width: "100%", height: "100%" }} resizeMode="cover" onError={() => { if (src !== fallback) setSrc(fallback); }} />
        {chip.badge && <Text style={{ position: "absolute", right: 0, bottom: 0, fontSize: 13 }}>{chip.badge}</Text>}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ marginTop: 2, width: size + 22, textAlign: "center", fontSize: 9.5, fontWeight: "900", textTransform: "uppercase", color: chip.you ? "#fde68a" : "rgba(255,255,255,.9)" }}>{chip.name}</Text>
    </View>
  );
}

function Clap({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => { v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 225, easing: Easing.inOut(Easing.quad) }), -1, true)); }, [v, delay]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.3 * v.value }, { rotate: `${-6 + 14 * v.value}deg` }] }));
  return <Animated.Text style={[{ fontSize: 20 }, st]}>👏</Animated.Text>;
}

function Pitch({ children }: { children: ReactNode }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={{ flex: 45, backgroundColor: "#0a1426" }} />
      <View style={{ flex: 30, backgroundColor: "#12391f" }} />
      <View style={{ flex: 25, backgroundColor: "#1d5c2f" }} />
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </View>
  );
}

/** Farewell.tsx GuardDrawn: two lines of faces clapping, you coming down the middle. */
function GuardDrawn({ career, sides, kit, onDone }: { career: CareerState; sides: FarewellSides; kit: Kit; onDone: () => void }) {
  const ours = oursChips(career, sides).filter((c) => !c.you).slice(0, 6);
  const rivals = rivalChips(sides).slice(0, 6);
  const me: Chip = { id: YOU_ID, name: career.player.lastName, face: career.player.portrait ?? DEFAULT_FAKE_FACE, you: true };
  useEffect(() => {
    const t = setTimeout(onDone, 6500);
    return () => clearTimeout(t);
  }, [onDone]);
  const walk = useSharedValue(0);
  useEffect(() => { walk.value = withDelay(300, withTiming(1, { duration: Math.round((GUARD.walkTo - GUARD.walkFrom) * 700), easing: Easing.inOut(Easing.quad) })); }, [walk]);
  const walkSt = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.2 + walk.value * 5.3),
    transform: [{ translateY: -220 + walk.value * 340 }, { scale: 0.7 + 0.45 * walk.value }],
  }));
  const line = (chips: Chip[], k: Kit, right: boolean) => (
    <View style={{ justifyContent: "center", gap: 12 }}>
      {chips.map((c, i) => (
        <View key={c.id} style={{ flexDirection: right ? "row-reverse" : "row", alignItems: "center", gap: 4 }}>
          <FaceChip chip={c} kit={k} size={40} />
          <Clap delay={((i * 130) % 500)} />
        </View>
      ))}
    </View>
  );
  return (
    <Pitch>
      <View style={{ position: "absolute", top: 150, bottom: 90, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" }}>
        {line(rivals, RIVALS_KITS.home, false)}
        {line(ours, kit, true)}
      </View>
      <View pointerEvents="none" style={{ position: "absolute", top: "50%", left: 0, right: 0, alignItems: "center" }}>
        <Animated.View style={walkSt}><FaceChip chip={me} kit={kit} size={56} /></Animated.View>
      </View>
    </Pitch>
  );
}

/** Farewell.tsx OvationDrawn: you in the middle, each well-wisher in turn, the stands clapping. */
function OvationDrawn({ career, sides, kit, plan, onStop, onDone }: {
  career: CareerState; sides: FarewellSides; kit: Kit; plan: OvationPlan; onStop: (s: OvationStop | null) => void; onDone: () => void;
}) {
  const [i, setI] = useState(-1);
  const stops = plan.stops;
  const cb = useRef({ onStop, onDone });
  cb.current = { onStop, onDone };
  useEffect(() => {
    const timers = stops.map((_, k) => setTimeout(() => { setI(k); cb.current.onStop(stops[k]); }, 900 + k * 1500));
    timers.push(setTimeout(() => cb.current.onDone(), 900 + stops.length * 1500 + 1300));
    return () => timers.forEach((t) => clearTimeout(t));
  }, [stops]);
  const me: Chip = { id: YOU_ID, name: career.player.lastName, face: career.player.portrait ?? DEFAULT_FAKE_FACE, you: true };
  const s = i >= 0 ? stops[i] : null;
  const other: Chip | null = s ? {
    id: s.who.id, name: s.who.name,
    face: s.who.team === "rivals" ? sides.rivals.who.find((r) => r.id === s.who.id)?.face : sides.ours.players.find((p) => p.id === s.who.id)?.imageUrl,
  } : null;
  const icon = s ? (s.kind === "hug" ? "🫂" : s.kind === "dap" ? "🤜🤛" : "🤝") : "👏";
  return (
    <Pitch>
      <View pointerEvents="none" style={{ position: "absolute", top: 150, left: 0, right: 0, alignItems: "center" }}>
        {[0, 1, 2].map((r) => (
          <View key={r} style={{ flexDirection: "row" }}>{Array.from({ length: 9 }, (_, c) => <Clap key={c} delay={((r * 9 + c) * 70) % 400} />)}</View>
        ))}
      </View>
      <View style={{ position: "absolute", top: "45%", left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <FaceChip chip={me} kit={kit} size={64} />
        <Text style={{ fontSize: 34 }}>{icon}</Text>
        <View style={{ width: 76 }}>{other && <FaceChip key={other.id} chip={other} kit={s?.who.team === "rivals" ? RIVALS_KITS.home : kit} size={64} />}</View>
      </View>
    </Pitch>
  );
}
