"use client";
/**
 * THE ACTIVITY HOST — Events v2 part 2b: a reply in a talk opens a real game
 * mode, and its result (won, lost, abandoned, a score) picks the next line.
 *
 * Every mode here is the REAL match engine (one-engine skill, RUL-ENG-002,
 * FACT-ENG-002): EngineFeature with training's own strike picture
 * (TrainingMinigame's buildStrike), a `scene` that takes the keeper off, and
 * this file's own scoring from onBallStep / onChanceResolved. No loop of its
 * own, no physics of its own. The dusk is a picture laid over the pitch
 * (pointer-events off): it changes nothing about the ball.
 *
 *  - strike-drill  "Den's hundred": 10 balls from 12 m (or 20 m), rolled in
 *                  from your left, no keeper. A ball counts when it crosses
 *                  the line low (under 1 m) in a corner (the outer 2 m).
 *                  Den counts in tens. Score 0-10, shown as 0-100.
 *  - crossbar      5 shots from 16 m at the bar; his 5 are rolled and shown.
 *  - feed-drill    You roll ten passes through the cones; a good pass gives
 *                  the kid a better chance, and his shot is rolled.
 *
 * Stop is a real result (abandoned), with its own line in the talk.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Scenario } from "@/lib/star/canvasEngine";
import type { LifeActivity } from "@/lib/star/life/types";
import { arcCtx, type ActivityResult, type BeatLive } from "@/lib/star/life/arcs";
import { holds } from "@/lib/star/life/cond";
import { fillLine } from "@/lib/star/life/text";
import { personInfo } from "@/lib/star/life/people";
import { mulberry32 } from "@/lib/star/season";
import { CX, GOAL_H, PITCH_W, POST_L, POST_R } from "@/lib/star/pitch";
import { FRAME_TOP_FOR_GOAL } from "@/lib/star/goalFrame";
import { gateCrossing, gateQuality, type TechniqueDrillConfig } from "@/lib/star/trainingDrills";
import { EngineFeature } from "../EnginePlay";
import { buildStrike, DRILL_SCENE, type StrikeSetup } from "../TrainingMinigame";
import type { ChanceResolved } from "../CanvasMatch";
import "./decision.css";

/** A ball counts as "low in the corner": under this height, within this of a post. */
export const CORNER_LOW = 1.0;
export const CORNER_WIDTH = 2.0;

export function cornerHit(x: number, z: number): boolean {
  return x > POST_L && x < POST_R && z <= CORNER_LOW && (x <= POST_L + CORNER_WIDTH || x >= POST_R - CORNER_WIDTH);
}
export function barHit(x: number, z: number): boolean {
  return x > POST_L - 0.15 && x < POST_R + 0.15 && Math.abs(z - GOAL_H) < 0.28;
}

const DEFAULT_CALLS = ["\"Ten.\"", "\"Twenty.\"", "\"That's thirty.\"", "\"Forty.\"", "\"Fifty.\"", "\"Sixty.\"", "\"Seventy.\"", "\"Eighty.\"", "\"Ninety.\"", "\"And a hundred.\""];

interface Shot { hit: boolean; x: number | null; z: number | null }

export default function ActivityHost({ career, live, activity, callerLines, onDone, allowDice, onDice }: {
  career: CareerState;
  live: BeatLive;
  activity: LifeActivity;
  /** The caller's lines (Den counting); from the arc book. */
  callerLines?: string[];
  onDone: (r: ActivityResult) => void;
  /** Test page: a button that rolls the result instead (what a device that cannot run the mode gets). */
  allowDice?: boolean;
  onDice?: () => void;
}) {
  const ctx = useMemo(() => arcCtx(career, live.arc, live), [career, live]);
  const fill = (s: string) => fillLine(s, career, live.cast, ctx);
  const mode = activity.mode;
  const n = activity.dials.balls ?? activity.dials.shots ?? 10;
  const fromWord = typeof activity.dials.from === "object" ? (holds(activity.dials.from.if, ctx) ? activity.dials.from.then : activity.dials.from.else) : activity.dials.from ?? (mode === "crossbar" ? "16m" : "12m");
  const dist = Number.parseFloat(fromWord) || 12;
  const caller = activity.caller?.slot ? personInfo(career, live.cast[activity.caller.slot] ?? "") : null;
  const opp = activity.dials.opponent ? personInfo(career, live.cast[activity.dials.opponent.slot] || live.cast[activity.dials.opponent.else ?? ""] || "mgr") : null;
  const shooter = activity.dials.shooter ? personInfo(career, live.cast[activity.dials.shooter.slot] ?? "") : null;
  const calls = callerLines?.length ? callerLines : DEFAULT_CALLS;
  const best = activity.showBest ? Number(ctx.v2?.arc?.v[activity.showBest.replace(/^arc\./, "")] ?? 0) : 0;
  const seed0 = career.season * 977 + career.week * 31 + live.round;

  // His goes at the bar, rolled once at the start and shown as you go.
  const oppShots = useMemo(() => {
    const r = mulberry32(seed0 + 5);
    return Array.from({ length: n }, () => r() < 0.32);
  }, [seed0, n]);

  // Your club's kit and your own look: the match reads them from the career and a fixture (home).
  const kitFixture = useMemo(() => ({ week: career.week, opponent: (career.league?.find((t) => t.name !== career.player.club)?.name) ?? "Training", home: true, played: false }), [career.week, career.league, career.player.club]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const setupRef = useRef<StrikeSetup | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossRef = useRef<{ x: number; z: number } | null>(null);
  const gateRef = useRef<{ x: number; z: number } | null>(null);
  const barRef = useRef(false);
  const ball = shots.length;
  const score = shots.filter((s) => s.hit).length;

  const openOn = useCallback((): Scenario => {
    const rng = mulberry32(seed0 * 7 + ball * 13);
    let setup: StrikeSetup;
    if (mode === "feed-drill") {
      setup = buildStrike("technique", 1, ball, rng);
      setup.scenario.viewport = { ...setup.viewport };
    } else {
      setup = buildStrike("power", 1, ball, rng, { trainingLevel: 1, power: career.skills.power });
      const sc = setup.scenario;
      // Rolled in from your left: it sits a little to the left of the D, a bit different each time.
      const off = mode === "crossbar" ? (rng() - 0.5) * 2 : -3.2 + rng() * 3.4;
      sc.ball = { x: CX + off, y: dist };
      sc.player = { x: sc.ball.x - 0.4, y: dist + 0.8 };
      sc.defenders = [];
      // A close camera on the goal (the woodwork challenge's frame): you see the corners you aim at.
      const h = Math.max(22, dist + 10);
      const w = h * (5 / 8);
      const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, (sc.ball.x + CX) / 2));
      sc.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
    }
    setupRef.current = setup;
    prevRef.current = null; crossRef.current = null; gateRef.current = null; barRef.current = false;
    return setup.scenario;
  }, [seed0, ball, mode, dist, career.skills.power]);

  const markers = useMemo(() => {
    if (mode !== "feed-drill") return undefined;
    const s = buildStrike("technique", 1, ball, mulberry32(seed0 * 7 + ball * 13));
    return s.gate ? [{ x: s.gate.left.x, y: s.gate.left.y }, { x: s.gate.right.x, y: s.gate.right.y }] : undefined;
  }, [mode, ball, seed0]);

  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    const prev = prevRef.current;
    const setup = setupRef.current;
    if (prev) {
      if (mode === "feed-drill") {
        if (setup?.gate && !gateRef.current) { const c = gateCrossing(prev, b, setup.gate.centre.y); if (c) gateRef.current = c; }
      } else if (!crossRef.current) {
        const c = gateCrossing(prev, b, 0);
        if (c) crossRef.current = c;
      }
      if (mode === "crossbar" && !barRef.current && b.y < 0.6 && b.y > -0.3 && barHit(b.x, b.z)) barRef.current = true;
    }
    prevRef.current = { ...b };
  }, [mode]);

  const finish = useCallback((list: Shot[], abandoned: boolean) => {
    const sc = list.filter((s) => s.hit).length;
    const oppScore = mode === "crossbar" ? oppShots.slice(0, list.length).filter(Boolean).length : undefined;
    setOver(true);
    onDone({ score: sc, tens: sc * 10, won: mode === "crossbar" ? sc > (oppScore ?? 0) : sc >= Math.ceil(n / 2), abandoned, oppScore });
  }, [mode, oppShots, n, onDone]);

  const onChanceResolved = useCallback((_info: ChanceResolved) => {
    let shot: Shot;
    let text: string;
    let good: boolean;
    if (mode === "feed-drill") {
      const setup = setupRef.current;
      const q = setup?.gateCfg && setup.gate ? gateQuality(gateRef.current, setup.gateCfg as TechniqueDrillConfig, setup.gate.centre.x) : 0;
      const kid = mulberry32(seed0 * 3 + ball * 17)() < 0.25 + 0.5 * q;
      shot = { hit: kid, x: null, z: null };
      good = kid;
      text = `${q >= 0.45 ? "Good ball" : "Poor ball"} · ${kid ? "he scores" : "he misses"}`;
    } else if (mode === "crossbar") {
      shot = { hit: barRef.current, x: crossRef.current?.x ?? null, z: crossRef.current?.z ?? null };
      good = shot.hit;
      text = shot.hit ? "CROSSBAR!" : "MISSED THE BAR";
    } else {
      const c = crossRef.current;
      const hit = !!c && cornerHit(c.x, c.z);
      shot = { hit, x: c?.x ?? null, z: c?.z ?? null };
      good = hit;
      text = hit ? "IN THE CORNER" : !c ? "WIDE" : c.x <= POST_L || c.x >= POST_R ? "WIDE" : c.z > GOAL_H ? "OVER" : c.z > CORNER_LOW ? "TOO HIGH" : "TOO CENTRAL";
    }
    const list = [...shots, shot];
    setShots(list);
    setFlash({ text, good });
    if (mode === "strike-drill") setSaid(fill(calls[Math.min(calls.length - 1, list.length - 1)] ?? ""));
    window.setTimeout(() => setFlash(null), 900);
    if (list.length >= n) window.setTimeout(() => finish(list, false), 1100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, shots, n, seed0, ball, finish, calls]);

  const title = fill(activity.name);
  const sub = mode === "crossbar" ? `${dist} m · hit the bar · ${opp?.short ?? "him"} next` : mode === "feed-drill" ? `Through the cones · ${shooter?.short ?? "he"} shoots` : `${dist} m · low in the corners · no keeper`;
  const done = Math.min(ball, n);
  const big = mode === "strike-drill" ? score * 10 : score;
  const bigSub = mode === "strike-drill" ? `out of ${done * 10} so far` : mode === "crossbar" ? `${opp?.short ?? "His"} ${oppShots.slice(0, done).filter(Boolean).length}` : `${shooter?.short ?? "His"} corners`;

  return (
    <div className="dd" data-activity={mode} style={{ background: "#06110c", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Head: stop, the name, the balls */}
      <div style={{ padding: "8px 12px 7px", background: "linear-gradient(180deg,#0b1a14,#06110c)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          {activity.canAbandon && !over ? (
            <button type="button" className="dd-ghost" style={{ height: 34, padding: "0 12px", fontSize: 12, borderRadius: 999 }} onClick={() => finish(shots, true)} data-stop>✕ Stop</button>
          ) : <span />}
          <div style={{ textAlign: "right" }}>
            <div className="dd-anton" style={{ fontSize: 21, lineHeight: 1, letterSpacing: ".02em", textTransform: "uppercase" }}>{title}</div>
            <div className="dd-kick" style={{ color: "#f5b942", marginTop: 4, letterSpacing: ".14em" }}>{sub}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 7, justifyContent: "center" }} data-balls>
          {Array.from({ length: n }, (_, i) => {
            const s = shots[i];
            const cur = i === ball && !over;
            const bg = s ? (s.hit ? "#22c55e" : "#ef4444") : "rgba(255,255,255,.08)";
            return (
              <div key={i} style={{ width: 26, height: 26, borderRadius: 99, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 900, color: s ? "#fff" : cur ? "#f5b942" : "rgba(255,255,255,.4)", background: bg, boxShadow: cur ? "0 0 0 2px #f5b942, 0 0 12px rgba(245,185,66,.6)" : "inset 0 0 0 1px rgba(255,255,255,.18)" }}>
                {s ? (s.hit ? "✓" : "✕") : mode === "strike-drill" ? (i + 1) * 10 : i + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* The real engine, under a dusk light */}
      <div style={{ position: "relative" }}>
        {!over && (
          <EngineFeature
            key={ball}
            openOn={openOn}
            onBallStep={onBallStep}
            onChanceResolved={onChanceResolved}
            skills={{ power: career.skills.power, technique: career.skills.technique }}
            keeperStrength={0}
            seed={seed0 * 7 + ball * 13}
            markers={markers}
            scene={mode === "feed-drill" ? DRILL_SCENE.technique : { ...DRILL_SCENE.power, keeper: false, ownFrame: true }}
            career={career}
            fixture={kitFixture}
          />
        )}
        {activity.dials.light?.startsWith("dusk") && (
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(70% 38% at 60% 0%, rgba(255,214,140,.16), rgba(0,0,0,0) 70%), linear-gradient(180deg, rgba(4,10,22,.42), rgba(4,10,22,.18) 45%, rgba(4,10,22,.5))", mixBlendMode: "multiply" }} />
        )}
        {/* Score and where they went */}
        <div aria-hidden style={{ position: "absolute", left: 12, top: "22%", pointerEvents: "none", textShadow: "0 2px 10px rgba(0,0,0,.8)" }} data-score={big}>
          <div className="dd-anton" style={{ fontSize: 62, lineHeight: 0.9 }}>{big}</div>
          <div className="dd-kick" style={{ color: "rgba(255,255,255,.8)", fontSize: 9 }}>{bigSub}{best > 0 ? ` · best ${best}` : ""}</div>
        </div>
        {mode !== "feed-drill" && shots.length > 0 && (
          <div aria-hidden className="dd-glass" style={{ position: "absolute", right: 10, top: "22%", padding: "6px 8px", pointerEvents: "none", borderRadius: 10 }}>
            <div className="dd-kick" style={{ fontSize: 8, color: "rgba(255,255,255,.7)" }}>Where they went</div>
            <svg width="104" height="42" viewBox="0 0 104 42" style={{ display: "block", marginTop: 3 }}>
              <rect x="2" y="2" width="100" height="36" fill="none" stroke="#fff" strokeWidth="2" />
              <rect x="2" y={2 + 36 * (1 - CORNER_LOW / GOAL_H)} width={100 * CORNER_WIDTH / (POST_R - POST_L)} height={36 * CORNER_LOW / GOAL_H} fill="rgba(34,197,94,.22)" />
              <rect x={102 - 100 * CORNER_WIDTH / (POST_R - POST_L)} y={2 + 36 * (1 - CORNER_LOW / GOAL_H)} width={100 * CORNER_WIDTH / (POST_R - POST_L)} height={36 * CORNER_LOW / GOAL_H} fill="rgba(34,197,94,.22)" />
              {shots.map((s, i) => s.x === null || s.z === null ? null : (
                <circle key={i} cx={Math.max(0, Math.min(104, 2 + ((s.x - POST_L) / (POST_R - POST_L)) * 100))} cy={Math.max(0, Math.min(42, 38 - (s.z / GOAL_H) * 36))} r="3.4" fill={s.hit ? "#22c55e" : "#ef4444"} />
              ))}
            </svg>
          </div>
        )}
        {flash && <div className="pointer-events-none absolute inset-x-0 z-30 text-center dd-anton" style={{ top: "34%", fontSize: 26, color: flash.good ? "#86efac" : "#fca5a5", textShadow: "0 2px 8px #000" }}>{flash.text}</div>}
        {said && caller && (
          <div className="pointer-events-none absolute inset-x-0 z-30 text-center" style={{ bottom: 92, padding: "0 18px", textShadow: "0 2px 6px #000" }} data-caller>
            <div className="dd-kick" style={{ color: "#f5b942" }}>{caller.short}</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{said}</div>
          </div>
        )}

        {/* Foot: which ball, what it costs (over the empty grass at the bottom) */}
      <div className="dd-glass" style={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 31, pointerEvents: "none", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", borderRadius: 12 }}>
        <div>
          <div className="dd-kick" style={{ color: "rgba(255,255,255,.65)", fontSize: 9 }}>Ball {Math.min(ball + 1, n)} of {n}{mode === "strike-drill" ? " · each one counts as ten" : ""}</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{activity.intro ? fill(activity.intro) : mode === "crossbar" ? `Five shots each, and ${opp?.short ?? "he"} goes after you.` : "Roll it through the cones onto his right foot."}</div>
        </div>
        {activity.cost?.energy ? <div style={{ textAlign: "right" }}><div className="dd-kick" style={{ fontSize: 8, color: "rgba(255,255,255,.6)" }}>Energy</div><div style={{ color: "#ff8a80", fontWeight: 900, fontSize: 18 }}>{activity.cost.energy}</div></div> : null}
      </div>
      {allowDice && !over && <button type="button" className="dd-ghost" style={{ position: "absolute", right: 12, top: "40%", height: 30, padding: "0 10px", fontSize: 10.5, borderRadius: 999, zIndex: 31 }} onClick={onDice} data-dice>🎲 Roll it</button>}
      </div>
    </div>
  );
}
