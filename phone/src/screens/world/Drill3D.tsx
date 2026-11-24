/**
 * A FULLY 3D DRILL (the website's components/star/Play3D.tsx on the phone): Two Touch, Free Roam, Headers & Volleys, Wembley
 * and Pace Sprint, any drill in lib/star/play3d/drills.ts of kind "play3d".
 *
 * 3D games are the one-engine rule's exception (Harry, 8 Oct 2026): they run the shared 3D engine in lib/star/play3d, never the
 * 2D match. This screen only: builds the drill's World from the career (../../three/trainingData.ts), draws it with the website's own
 * scene (lib/star/play3d/scene.ts, in look H's stadium) through ../../three/Walk3D.tsx, feeds it your thumbs, and shows the score.
 *
 * Controls, the website's phone scheme (lib/star/play3d/controlScheme.ts: always "touch" here; the keys and mouse are for a computer):
 *   a stick appears under the left thumb (left half; push further, run faster); the right half is the action: a swipe kicks
 *   (direction aims, length is power), a tap is the touch / pass; two fingers on the right peek round, then spring back.
 *   Two Touch (session.stick "corner"): no stick under the thumb; the whole screen is the touch / swipe and a small nudge stick sits in the
 *   bottom-left corner only; a tap near the ball is always a touch.
 *   Call for it (Free Roam): a CALL button on the right edge; the answer shows as a tick or a cross over you and the team-mate.
 * The camera is never turned by the stick; the stick is read against the way the camera looks right now.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { stickToPitch, PEEK_MAX } from "@/lib/star/three3d/practiceCam";
import { motionLook } from "@/lib/star/motionLook";
import type { DrillDef, DrillSession, DrillTrain } from "@/lib/star/play3d/drills";
import type { Play3DController } from "@/lib/star/play3d/scene";
import { Press } from "../../ui/Press";
import { Walk3D } from "../../three/Walk3D";
import { loadDrillStart } from "../../three/trainingScene";
import { castFrom, drillLook, drillSceneData, drillSession, realMatchHeightFor } from "../../three/trainingData";
import { GameShell, ResultPanel, type GameResult } from "../MatchRelGames";

/** A swipe is longer than the 2D game's drag-back: this share of it counts (full power is about twice the 2D drag). */
export const SWIPE_SCALE = 0.5;
/** A press shorter than this (ms) and moving less than TAP_PX is a tap. */
const TAP_MS = 220;
const TAP_PX = 12;
/** Two Touch's corner nudge stick: its size against the floating stick, where it sits (points from the left and the bottom of the picture). */
export const CORNER_STICK = { scale: 0.6, left: 54, bottom: 92, opacity: 0.4 };
/** A tap this close (points) to the ball is always the touch, never the corner stick. */
export const BALL_GUARD_PX = 70;
/** How long a call's tick or cross stays up (world seconds). */
const CALL_SHOW = 1.8;
const STICK_R = 56;
const TONE = "#38bdf8";

export interface Drill3DResult extends GameResult { drill: string; /** Pace Sprint: the level and stars for the career to bank. */ train?: DrillTrain }

type Mark = { id: string; name: string; x: number; y: number; off: boolean; aim: boolean };
type CallUi = { cd: number; ans?: { ok: boolean; why: string; you?: { x: number; y: number }; mate?: { x: number; y: number; off: boolean } } };

export function Drill3D({ career, drill, seed, mode, options, showSpeed, onExit, onFinish }: {
  career: CareerState;
  drill: DrillDef;
  seed: number;
  mode?: string;
  options?: Record<string, string>;
  showSpeed?: boolean;
  onExit: () => void;
  onFinish: (r: Drill3DResult) => void;
}) {
  const team = career.relationships.team;
  const win = useWindowDimensions();
  // one visit: the cast, the drill's World and the picture's people
  const built = useMemo(() => {
    const cast = castFrom(career, seed);
    const session: DrillSession = drillSession(career, drill, seed, cast, mode, options);
    session.world.newFeel = motionLook() === "mocap"; // the new walk / jog / run / sprint feel (the website's Settings → Look → Motion, Mocap)
    const look = drillLook(career, session, cast, seed);
    return { cast, session, look };
  }, [drill, seed, mode, options]); // eslint-disable-line react-hooks/exhaustive-deps
  const { session } = built;
  const w = session.world;

  const [hud, setHud] = useState(() => session.hud());
  const [marks, setMarks] = useState<Mark[]>([]);
  const [callUi, setCallUi] = useState<CallUi>({ cd: 0 });
  /** Your sprint bar (Free Roam, new feel): null while it isn't in use. */
  const [stam, setStam] = useState<{ v: number; tired: boolean } | null>(null);
  const [result, setResult] = useState<Drill3DResult | null>(null);
  const [three, setThree] = useState<"loading" | "ready">("loading");
  const ctrl = useRef<(Play3DController & { dispose(): void }) | null>(null);
  const box = useRef({ w: win.width - 24, h: 400 });
  const hudSig = useRef(""), marksSig = useRef(""), callSig = useRef(""), stamSig = useRef("");

  // ── input: the stick (screen units, length 0–1), turned into pitch directions every frame ──
  const stickVec = useRef({ x: 0, y: 0, sprint: false });
  const lastSig = useRef("");
  const applyInput = () => {
    const s = stickVec.current;
    const sx = s.x, sy = s.y, sprint = s.sprint;
    // the chase camera (Wembley) turns with you, so there the direction is fixed when the stick changes
    const sig = `${sx.toFixed(3)},${sy.toFixed(3)}`;
    if (session.camera === "chase" && sig === lastSig.current) { w.input = { ...w.input, sprint }; return; }
    lastSig.current = sig;
    const h = ctrl.current?.heading() ?? -Math.PI / 2;
    w.input = { move: Math.hypot(sx, sy) > 0.01 ? stickToPitch(h, sx, sy) : { x: 0, y: 0 }, sprint };
  };

  const mateMarks = (): Mark[] => {
    const c = ctrl.current, you = w.you();
    if (!c || !you || !you.active) return [];
    return w.players.filter((p) => p.active && !p.human && !p.keeper && p.team === you.team).flatMap((p) => {
      const s = c.screen(p.id);
      return s ? [{ id: p.id, name: p.name, x: s.x, y: s.y, off: s.off, aim: w.aimMate === p.id }] : [];
    }).filter((m) => m.off || m.aim);
  };
  const callView = (): CallUi => {
    const c = ctrl.current, a = w.call;
    const cd = w.callReady();
    if (!c || !a || w.t - a.at > CALL_SHOW) return { cd };
    const you = c.screen(w.you()?.id ?? "");
    const mate = a.mate ? c.screen(a.mate) : null;
    return { cd, ans: { ok: a.ok, why: a.why, you: you && !you.off ? you : undefined, mate: mate ?? undefined } };
  };

  /** Called by the scene on every frame (through the adapter in ../../three/trainingScene.ts): input, then the HUD ten times a second. */
  const acc = useRef(0);
  const frame = useRef<(dt: number) => void>(() => undefined);
  frame.current = (dt: number) => {
    applyInput();
    acc.current += dt;
    if (acc.current > 0.1) {
      acc.current = 0;
      // each piece only re-renders the screen when it changed
      const h = session.hud(); const hs = JSON.stringify(h);
      if (hs !== hudSig.current) { hudSig.current = hs; setHud(h); }
      const m = mateMarks(); const ms = JSON.stringify(m.map((x) => [x.id, Math.round(x.x), Math.round(x.y), x.off, x.aim]));
      if (ms !== marksSig.current) { marksSig.current = ms; setMarks(m); }
      if (session.call) { const c = callView(); const cs = JSON.stringify([c.cd.toFixed(1), c.ans && [c.ans.ok, c.ans.why, c.ans.you && Math.round(c.ans.you.x), c.ans.mate && Math.round(c.ans.mate.x)]]); if (cs !== callSig.current) { callSig.current = cs; setCallUi(c); } }
      const sw = session.world;
      const st = sw.newFeel && sw.rules.stamina && (sw.stamina.v < 0.995 || sw.stamina.tired) ? { v: sw.stamina.v, tired: sw.stamina.tired } : null;
      const ss = st ? `${st.v.toFixed(2)}${st.tired}` : "";
      if (ss !== stamSig.current) { stamSig.current = ss; setStam(st); }
    }
    if (session.done()) setResult((r) => r ?? { ...session.result(team, Math.random()), drill: drill.id });
  };
  // the look check's hook (the web build only, as the Garden's `__garden3d`): the live drill, and a way to end it as if it were done
  if (Platform.OS === "web") (globalThis as unknown as Record<string, unknown>).__drill3d = { session, ctrlRef: ctrl, finishNow: () => setResult((r) => r ?? { ...session.result(team, 0.5), drill: drill.id }) };
  const sceneData = useMemo(() => drillSceneData(career, session, built.look, (dt) => frame.current(dt)), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (result) ctrl.current?.setActive(false); }, [result]);

  // ── thumbs ──
  type Tch = { id: number; x0: number; y0: number; t0: number; r?: number; corner?: boolean };
  const stick = useRef<Tch | null>(null);
  const aim = useRef<Tch | null>(null);
  const peekT = useRef<{ ids: number[]; x0: number } | null>(null);
  const [knob, setKnob] = useState<{ x0: number; y0: number; x: number; y: number; r: number } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const toWorld = (sx: number, sy: number) => stickToPitch(ctrl.current?.heading() ?? -Math.PI / 2, sx, sy);
  /** Two Touch: the stick only lives in the corner (CORNER_STICK). */
  const cornerStick = session.stick === "corner";
  const cornerR = STICK_R * CORNER_STICK.scale;
  const cornerAt = () => ({ x: CORNER_STICK.left, y: box.current.h - CORNER_STICK.bottom });
  /** A tap near the ball (points in the picture): always the touch. */
  const nearBall = (x: number, y: number) => { const b = ctrl.current?.ballScreen(); return !!b && Math.hypot(b.x - x, b.y - y) < BALL_GUARD_PX; };
  /** A team-mate drawn under a tap, else null: a tap on him passes to him. */
  const mateAt = (x: number, y: number): string | null => {
    const id = ctrl.current?.pick(x, y) ?? null;
    const p = w.get(id), you = w.you();
    return p && you && p !== you && !p.keeper && p.team === you.team ? p.id : null;
  };
  const swipeLen = () => realMatchHeightFor(win.width);
  const stamp = (e: GestureResponderEvent) => { const n = e.nativeEvent as { timestamp?: number; timeStamp?: number }; return Number(n.timestamp ?? n.timeStamp) || Date.now(); };
  const pt = (t: { locationX?: number; locationY?: number; pageX?: number; pageY?: number }) => ({ x: t.locationX ?? t.pageX ?? 0, y: t.locationY ?? t.pageY ?? 0 });

  const onDown = (id: number, x: number, y: number, t: number) => {
    if (cornerStick) {
      // the corner nudge stick: only a press on it (and never one near the ball); everything else is the action
      const c = cornerAt();
      if (!stick.current && Math.hypot(x - c.x, y - c.y) < cornerR + 22 && !nearBall(x, y)) {
        stick.current = { id, x0: c.x, y0: c.y, t0: t, r: cornerR, corner: true }; setKnob({ x0: c.x, y0: c.y, x, y, r: cornerR });
        return;
      }
    } else if (x < box.current.w * 0.5 && !stick.current) { stick.current = { id, x0: x, y0: y, t0: t, r: STICK_R }; setKnob({ x0: x, y0: y, x, y, r: STICK_R }); return; }
    if (x >= box.current.w * 0.5 && aim.current && !peekT.current && Math.hypot(x - aim.current.x0, y - aim.current.y0) < 120) {
      // a second finger on the right: peek round (the first finger's swipe is called off)
      peekT.current = { ids: [aim.current.id, id], x0: (x + aim.current.x0) / 2 };
      aim.current = null; setDrag(null);
      return;
    }
    if (!aim.current && !peekT.current) { aim.current = { id, x0: x, y0: y, t0: t }; setDrag({ x0: x, y0: y, x, y }); }
  };
  const onMove = (id: number, x: number, y: number) => {
    if (stick.current?.id === id) {
      const R = stick.current.r ?? STICK_R;
      const dx = x - stick.current.x0, dy = y - stick.current.y0, d = Math.hypot(dx, dy);
      const k = Math.min(1, d / R);
      stickVec.current = d > 1 ? { x: (dx / d) * k, y: (dy / d) * k, sprint: d > R * 0.92 } : { x: 0, y: 0, sprint: false };
      setKnob({ x0: stick.current.x0, y0: stick.current.y0, x, y, r: R });
    } else if (peekT.current?.ids.includes(id)) {
      ctrl.current?.peek(Math.max(-PEEK_MAX, Math.min(PEEK_MAX, -(x - peekT.current.x0) * 0.006)));
    } else if (aim.current?.id === id) setDrag((d) => d && { ...d, x, y });
  };
  const onUp = (id: number, x: number, y: number, t: number) => {
    if (stick.current?.id === id) {
      const s = stick.current;
      stick.current = null; stickVec.current = { x: 0, y: 0, sprint: false }; setKnob(null);
      // a quick tap on the corner stick is still a touch (Two Touch); on a team-mate on the left, a pass to him
      if (s.corner) { if (Math.hypot(x - s.x0, y - s.y0) < (s.r ?? STICK_R) * 0.6 && t - s.t0 < TAP_MS) w.act({ kind: "tap" }); return; }
      if (Math.hypot(x - s.x0, y - s.y0) < TAP_PX && t - s.t0 < TAP_MS) { const to = mateAt(x, y); if (to) w.act({ kind: "tap", to }); }
      return;
    }
    if (peekT.current?.ids.includes(id)) { peekT.current = null; ctrl.current?.peek(0); return; }
    if (aim.current?.id === id) {
      const a = aim.current;
      aim.current = null; setDrag(null);
      const dx = x - a.x0, dy = y - a.y0;
      if (Math.hypot(dx, dy) < 14) { w.act({ kind: "tap", to: mateAt(x, y) ?? undefined }); return; }
      // a swipe: the ball goes the way the thumb went; its length is the power
      const pull = (Math.hypot(dx, dy) / swipeLen()) * SWIPE_SCALE;
      w.act({ kind: "shoot", dir: toWorld(dx, dy), pull });
    }
  };
  const down = (e: GestureResponderEvent) => { for (const t of e.nativeEvent.changedTouches) { const p = pt(t as never); onDown(t.identifier as number, p.x, p.y, stamp(e)); } };
  const move = (e: GestureResponderEvent) => { for (const t of e.nativeEvent.changedTouches) { const p = pt(t as never); onMove(t.identifier as number, p.x, p.y); } };
  const up = (e: GestureResponderEvent) => { for (const t of e.nativeEvent.changedTouches) { const p = pt(t as never); onUp(t.identifier as number, p.x, p.y, stamp(e)); } };

  const h = Math.max(360, Math.min(realMatchHeightFor(win.width), 640, win.height - 310));
  box.current = { w: win.width - 24, h };
  const mins = hud.timeLeft !== undefined ? `${Math.floor(hud.timeLeft / 60)}:${String(Math.floor(hud.timeLeft % 60)).padStart(2, "0")}` : null;
  const hint = session.hints ? session.hints.touch : session.hint;
  const ready = three === "ready" && !result;
  const tone = (t?: string) => (t === "good" ? "#4ade80" : t === "bad" ? "#f87171" : "#fde047");
  const dragOn = drag && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 14;

  return (
    <GameShell title={drill.name} who="Team" current={team} tone={TONE} onBack={onExit}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontSize: 34, lineHeight: 36, fontWeight: "900" }}>{hud.big}</Text>
          <Text numberOfLines={1} style={{ color: "#bae6fd", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }}>{hud.small}</Text>
        </View>
        {mins ? <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>{mins}</Text> : null}
      </View>
      <View style={{ height: h, borderRadius: 4, overflow: "hidden", backgroundColor: "#0b0f14" }}>
        <Walk3D
          inert
          load={loadDrillStart}
          data={sceneData}
          callbacks={() => ({})}
          name="this drill"
          showSpeed={showSpeed}
          onBack={onExit}
          onController={(c) => { ctrl.current = c as never; if (c) setThree("ready"); else ctrl.current = null; }}
        >
          {/* the pad: a finger on the left is the stick, on the right the action; the overlays below never take a touch */}
          <View collapsable={false} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
            onTouchStart={down} onTouchMove={move} onTouchEnd={up} onTouchCancel={up} />
          {three === "loading" && (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700" }}>Loading the training pitch…</Text>
            </View>
          )}
          {cornerStick && !knob && ready && (
            // the corner nudge stick at rest: small and faint, always in the same place
            <View pointerEvents="none" style={{ position: "absolute", left: CORNER_STICK.left - cornerR, top: h - CORNER_STICK.bottom - cornerR, width: cornerR * 2, height: cornerR * 2, borderRadius: cornerR, backgroundColor: "rgba(0,0,0,0.18)", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", opacity: CORNER_STICK.opacity }}>
              <View style={{ position: "absolute", left: cornerR * 0.68, top: cornerR * 0.68, width: cornerR * 0.64, height: cornerR * 0.64, borderRadius: cornerR, backgroundColor: "rgba(255,255,255,0.8)" }} />
            </View>
          )}
          {knob && (
            <View pointerEvents="none" style={{ position: "absolute", left: knob.x0 - knob.r, top: knob.y0 - knob.r, width: knob.r * 2, height: knob.r * 2, borderRadius: knob.r, backgroundColor: "rgba(0,0,0,0.18)", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)", opacity: knob.r < STICK_R ? 0.7 : 1 }}>
              <View style={{ position: "absolute", width: knob.r * 0.64, height: knob.r * 0.64, borderRadius: knob.r, backgroundColor: "rgba(255,255,255,0.8)",
                left: knob.r * 0.68 + Math.max(-knob.r, Math.min(knob.r, knob.x - knob.x0)), top: knob.r * 0.68 + Math.max(-knob.r, Math.min(knob.r, knob.y - knob.y0)) }} />
            </View>
          )}
          {stam && (
            // the sprint bar: small, by the stick, only while it isn't full
            <View pointerEvents="none" style={knob ? { position: "absolute", left: knob.x0 - 30, top: knob.y0 - STICK_R - 16 } : { position: "absolute", left: 14, bottom: 84 }}>
              <View style={{ width: 60, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" }}>
                <View style={{ height: "100%", width: `${Math.round(stam.v * 100)}%`, borderRadius: 3, backgroundColor: stam.tired ? "#f87171" : stam.v < 0.3 ? "#fbbf24" : "#4ade80" }} />
              </View>
            </View>
          )}
          {dragOn && drag && <AimLine d={drag} />}
          {hud.flash && !hud.banner ? <Text pointerEvents="none" style={{ position: "absolute", left: 8, right: 8, top: "8%", textAlign: "center", color: "#fff", fontSize: 20, fontWeight: "900", textTransform: "uppercase", textShadowColor: "#000", textShadowRadius: 8 }}>{hud.flash}</Text> : null}
          {hud.pop ? (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "38%", alignItems: "center" }}>
              <Text style={{ overflow: "hidden", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 3, backgroundColor: "rgba(0,0,0,0.55)", color: tone(hud.pop.tone === "ok" ? undefined : hud.pop.tone), fontSize: 17, fontWeight: "900", textTransform: "uppercase" }}>{hud.pop.text}</Text>
            </View>
          ) : null}
          {hud.banner ? <Text pointerEvents="none" style={{ position: "absolute", left: 8, right: 8, top: "24%", textAlign: "center", color: tone(hud.banner.tone === "info" ? undefined : hud.banner.tone), fontSize: 44, lineHeight: 46, fontWeight: "900", textTransform: "uppercase", textShadowColor: "#000", textShadowRadius: 12, textShadowOffset: { width: 0, height: 3 } }}>{hud.banner.text}</Text> : null}
          {hud.note ? <Text pointerEvents="none" style={{ position: "absolute", left: 8, right: 8, top: 8, textAlign: "center", color: "#fde68a", fontSize: 13, fontWeight: "900", textTransform: "uppercase", textShadowColor: "#000", textShadowRadius: 4 }}>{hud.note}</Text> : null}
          {hud.roster?.length ? (
            <View pointerEvents="none" style={{ position: "absolute", left: 8, top: 60, gap: 2 }}>
              {hud.roster.map((r) => (
                <Text key={r.name} style={{ alignSelf: "flex-start", overflow: "hidden", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.55)", fontSize: 11, fontWeight: "900", color: r.state === "out" ? "#f87171" : r.state === "safe" ? "#4ade80" : "#fff", borderWidth: r.you ? 1 : 0, borderColor: "#7dd3fc" }}>
                  {r.state === "safe" ? "✓" : r.state === "out" ? "✗" : "•"} {r.name}
                </Text>
              ))}
            </View>
          ) : null}
          {ready && marks.map((m) => (
            <View key={m.id} pointerEvents="none" style={{ position: "absolute", left: m.x - 80, width: 160, alignItems: "center", top: (m.off ? m.y : m.y - 34) - 10 }}>
              <Text numberOfLines={1} style={{ overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, fontSize: 11, fontWeight: "900", textTransform: "uppercase",
                backgroundColor: m.aim ? "#fff" : "rgba(0,0,0,0.6)", color: m.aim ? "#0f172a" : "#fff" }}>
                {m.off ? (m.x < 40 ? "◀ " : m.x > box.current.w - 40 ? "" : m.y < 40 ? "▲ " : "▼ ") : ""}{m.aim ? "Pass · " : ""}{m.name}{m.off && m.x > box.current.w - 40 ? " ▶" : ""}
              </Text>
            </View>
          ))}
          {session.call && ready && callUi.ans && (
            <>
              {callUi.ans.you && (
                <View pointerEvents="none" style={{ position: "absolute", left: callUi.ans.you.x - 60, width: 120, alignItems: "center", top: callUi.ans.you.y - 76 }}>
                  <Text style={{ overflow: "hidden", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#fff", color: "#0f172a", fontSize: 14, fontWeight: "900", textTransform: "uppercase" }}>
                    Here! <Text style={{ color: callUi.ans.ok ? "#16a34a" : "#dc2626" }}>{callUi.ans.ok ? "✓" : "✗"}</Text>
                  </Text>
                </View>
              )}
              {callUi.ans.mate ? (
                <View pointerEvents="none" style={{ position: "absolute", left: Math.max(60, Math.min(box.current.w - 60, callUi.ans.mate.x)) - 90, width: 180, alignItems: "center", top: (callUi.ans.mate.off ? callUi.ans.mate.y : callUi.ans.mate.y - 58) - 10 }}>
                  <Text style={{ overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: callUi.ans.ok ? "#16a34a" : "#dc2626", color: "#fff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>{callUi.ans.ok ? "✓" : "✗"} {callUi.ans.why}</Text>
                </View>
              ) : (
                <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "18%", alignItems: "center" }}>
                  <Text style={{ overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "#dc2626", color: "#fff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>✗ {callUi.ans.why}</Text>
                </View>
              )}
            </>
          )}
          {cornerStick && !knob && !drag && ready && (
            <>
              <Text pointerEvents="none" style={{ position: "absolute", left: 12, top: h - CORNER_STICK.bottom - cornerR - 22, overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>Nudge</Text>
              <Text pointerEvents="none" style={{ position: "absolute", right: 12, bottom: 76, overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>Tap · Swipe anywhere</Text>
            </>
          )}
          {session.hints && !cornerStick && !knob && !drag && ready && (
            <>
              <Text pointerEvents="none" style={{ position: "absolute", left: 12, bottom: 76, overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>◉ Move</Text>
              <Text pointerEvents="none" style={{ position: "absolute", right: 12, bottom: 76, overflow: "hidden", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.35)", color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: "700", textTransform: "uppercase" }}>Tap · Swipe ➚</Text>
            </>
          )}
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center", textShadowColor: "#000", textShadowRadius: 4 }}>{hint}</Text>
          </View>
          {session.call && ready && (
            // Call for it: top-right, above the edge markers; its own button (a press on it never starts a swipe)
            <Press onPress={() => { w.act({ kind: "call" }); setCallUi(callView()); }}
              style={{ position: "absolute", right: 8, top: "15%", width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.6)", backgroundColor: callUi.cd > 0 ? "rgba(0,0,0,0.35)" : "rgba(14,165,233,0.75)" }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", textAlign: "center", textTransform: "uppercase", lineHeight: 14 }}>{`📣\nCall`}</Text>
              {callUi.cd > 0 ? <Text style={{ position: "absolute", bottom: 2, color: "#fff", fontSize: 9, fontWeight: "900" }}>{callUi.cd.toFixed(1)}</Text> : null}
            </Press>
          )}
          {result && (
            <View style={{ position: "absolute", left: 8, right: 8, bottom: 8 }}>
              <ResultPanel result={result} who="Team" current={team} onContinue={() => onFinish(result)} />
            </View>
          )}
        </Walk3D>
      </View>
      {!!session.buttons?.length && !result && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {session.buttons.map((b) => (
            <Press key={b.label} onPress={() => (b.onPress ? b.onPress() : b.action && w.act(b.action))}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 4, alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>{b.label}</Text>
            </Press>
          ))}
        </View>
      )}
    </GameShell>
  );
}

/** The swipe so far: a line from where the thumb went down to where it is, and a dot at the end. */
function AimLine({ d }: { d: { x0: number; y0: number; x: number; y: number } }) {
  const dx = d.x - d.x0, dy = d.y - d.y0, len = Math.hypot(dx, dy);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      <View style={{ position: "absolute", left: (d.x0 + d.x) / 2 - len / 2, top: (d.y0 + d.y) / 2 - 3, width: len, height: 6, borderRadius: 3, backgroundColor: "#fb923c", transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }} />
      <View style={{ position: "absolute", left: d.x - 9, top: d.y - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.7)" }} />
    </View>
  );
}
