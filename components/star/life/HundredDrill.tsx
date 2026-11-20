"use client";
/**
 * DEN'S HUNDRED v3 — the kit man's drill as a little game under one shed light
 * (Harry, 20 Nov 2026: "the worst thing of the kit man is the drill, I think
 * it's a chance to be creative, also make sure it's the main engine").
 *
 * Ten balls in six rounds (lib/star/life/drill.ts): Call it, The bar, Old
 * tricks (the tyre, the bucket), Den in goal, Lights out, Double or nowt.
 *
 * THE ENGINE: every ball is EngineFeature → the real CanvasMatch (one-engine
 * skill, RUL-ENG-002). The ball, the drag, the strike screen, the flight and
 * Den in goal (the match's own keeper, with the engine's own strength and
 * reach numbers) are the match's. This file only builds each ball's picture
 * from the engine's own builder (drillScene.ts), watches the ball (onBallStep,
 * read-only), judges it (drill.ts judge) and dresses the screen: the shed
 * light, the round cards, Den's words, the tyre and bucket (decoration markers
 * the engine never reads). No loop of its own, no physics of its own.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Scenario } from "@/lib/star/canvasEngine";
import type { ActivityResult } from "@/lib/star/life/arcs";
import { mulberry32 } from "@/lib/star/season";
import { CX, GOAL_H, POST_L, POST_R } from "@/lib/star/pitch";
import { denAfter, feedsFor, judge, pointsOf, ROUNDS, shoutOf, TARGET_LOW, TARGET_WIDTH, type BallEnd, type Feed } from "@/lib/star/life/drill";
import { closeFrame, hundredMarkers, hundredScenario } from "@/lib/star/life/drillScene";
import { EngineFeature } from "../EnginePlay";
import type { ChanceResolved } from "../CanvasMatch";
import { speak, stopVoice } from "@/lib/star/life/voice";
import "./decision.css";

interface Shot { hit: boolean; x: number | null; z: number | null; end: BallEnd }
type Phase = "round" | "call" | "play" | "react";
type Light = "on" | "flicker" | "out";

const WORD: Record<BallEnd, string> = { hit: "IN", saved: "SAVED", post: "OFF THE POST", wide: "WIDE", over: "OVER", high: "TOO HIGH", central: "TOO CENTRAL", wrong: "WRONG CORNER", "under-bar": "UNDER THE BAR", "missed-it": "MISSED IT" };
const HIT_WORD: Record<string, string> = { call: "THAT CORNER", bar: "CROSSBAR!", tyre: "THROUGH IT!", bucket: "BUCKET'S OVER", keeper: "PAST HIM", dark: "IN THE DARK", double: "TWENTY!" };

export default function HundredDrill({ career, title, seed0, extraDist, calls, callerName, canAbandon, energy, best, onDone, allowDice, onDice, fill }: {
  career: CareerState;
  title: string;
  seed0: number;
  /** A further-out night moves every ball back. */
  extraDist: number;
  /** Den's counts, from the arc book ("Ten." … "And a hundred."), voiced. */
  calls: string[];
  callerName: string;
  canAbandon?: boolean;
  energy?: number;
  best: number;
  onDone: (r: ActivityResult) => void;
  allowDice?: boolean;
  onDice?: () => void;
  fill: (s: string) => string;
}) {
  const feeds: Feed[] = useMemo(() => feedsFor(extraDist, seed0), [extraDist, seed0]);
  const n = feeds.length;
  const careerSeen = useMemo(() => ({ ...career, careerStats: { ...career.careerStats, appearances: Math.max(1, career.careerStats?.appearances ?? 0) } }), [career]);
  const kitFixture = useMemo(() => ({ week: career.week, opponent: (career.league?.find((t) => t.name !== career.player.club)?.name) ?? "Training", home: true, played: false }), [career.week, career.league, career.player.club]);

  const [shots, setShots] = useState<Shot[]>([]);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState<Phase>("round");
  const [light, setLight] = useState<Light>("on");
  const [shout, setShout] = useState<string | null>(null);
  // The dots and the score show a result at once; `shots` (which moves to the next ball) waits for Den.
  const [shotsShown, setShotsShown] = useState<Shot[]>([]);
  // One result a ball: the engine serves the same picture again after a result, so anything after it is ignored.
  const doneRef = useRef(-1);
  const ball = shots.length;
  const feed = feeds[Math.min(ball, n - 1)];
  const round = ROUNDS.find((r) => r.id === feed.round)!;
  const roundNo = ROUNDS.indexOf(round) + 1;

  // The beats between balls: a round's card (its first ball), Den's call, then you play.
  useEffect(() => {
    if (over) return;
    if (phase === "round") {
      speak("b3-thursdays.t-sorry.say0.q1", ball === 0 ? "Go and stand on the D." : "");
      const t = window.setTimeout(() => setPhase("call"), ball === 0 ? 2400 : 1900);
      return () => window.clearTimeout(t);
    }
    if (phase === "call") {
      if (feed.voice) speak(feed.voice, feed.call); else stopVoice();
      const t = window.setTimeout(() => setPhase("play"), 1100);
      return () => window.clearTimeout(t);
    }
    if (phase === "play" && feed.dark) {
      // The groundsman's timer: a flicker, then dark; Den shouts the corner.
      const sh = shoutOf(feed);
      setLight("flicker");
      const t1 = window.setTimeout(() => {
        setLight("out");
        if (sh) { setShout(sh.text); if (sh.voice) speak(sh.voice, sh.text); }
      }, ball > 0 && feeds[ball - 1]?.dark ? 250 : 900);
      return () => window.clearTimeout(t1);
    }
    if (phase === "play") setLight("on");
  }, [phase, ball, feed, feeds, over]);

  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossRef = useRef<{ x: number; z: number } | null>(null);
  const barRef = useRef(false);

  const openOn = useCallback((): Scenario => {
    prevRef.current = null; crossRef.current = null; barRef.current = false;
    return hundredScenario(feed, mulberry32(seed0 * 7 + ball * 13));
  }, [seed0, ball, feed]);

  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    const prev = prevRef.current;
    if (prev) {
      if (!crossRef.current && prev.y > 0 && b.y <= 0) {
        const t = prev.y / (prev.y - b.y);
        crossRef.current = { x: prev.x + (b.x - prev.x) * t, z: prev.z + (b.z - prev.z) * t };
      }
      if (!barRef.current && b.y < 0.6 && b.y > -0.3 && b.x > POST_L - 0.15 && b.x < POST_R + 0.15 && Math.abs(b.z - GOAL_H) < 0.28) barRef.current = true;
    }
    prevRef.current = { ...b };
  }, []);

  const finish = useCallback((list: Shot[], abandoned: boolean) => {
    const sc = list.filter((s) => s.hit).length;
    setOver(true);
    stopVoice();
    onDone({ score: sc, tens: pointsOf(list.map((x) => x.hit), feeds), won: sc >= Math.ceil(n / 2), abandoned });
  }, [feeds, n, onDone]);

  const onChanceResolved = useCallback((info: ChanceResolved) => {
    if (doneRef.current >= ball) return;
    doneRef.current = ball;
    const c = crossRef.current;
    const end = judge(feed, { cross: c, bar: barRef.current, outcome: info.outcome });
    const hit = end === "hit";
    let streak = 0;
    for (let k = shots.length - 1; k >= 0 && shots[k].hit; k--) streak++;
    const after = denAfter(end, streak, ball, feeds);
    if (hit) {
      // Den counts in tens (his voiced lines): the new total, then what he thinks of it.
      const total = pointsOf([...shots.map((x) => x.hit), true], feeds);
      const idx = Math.max(0, Math.min(calls.length - 1, Math.round(total / 10) - 1));
      const count = fill(calls[idx] ?? "");
      setSaid((feed.double ? after : `${count} ${after}`).replace(/["“”]/g, ""));
      speak("b1-the-offer.play.caller", count);
    } else { setSaid(fill(after).replace(/"/g, "")); stopVoice(); }
    const list = [...shots, { hit, x: c?.x ?? null, z: c?.z ?? null, end }];
    setShout(null);
    setLight("on");
    setFlash({ text: hit ? (HIT_WORD[feed.target.kind === "tyre" || feed.target.kind === "bucket" ? feed.target.kind : feed.round] ?? "IN") : WORD[end], good: hit });
    setPhase("react");
    window.setTimeout(() => setFlash(null), 1300);
    if (list.length >= n) window.setTimeout(() => finish(list, false), 2100);
    else window.setTimeout(() => {
      setSaid(null);
      setPhase(feeds[list.length].round !== feed.round ? "round" : "call");
      setShots(list);
    }, 1750);
    // Keep this ball's shot on screen (the dots) at once; the next ball mounts after Den has spoken.
    setShotsShown(list);
  }, [feed, feeds, shots, ball, calls, fill, n, finish]);

  const big = pointsOf(shotsShown.map((x) => x.hit), feeds);

  // Where the goal and the ball sit on the screen, for the light (the close camera's own sums).
  const boxRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(0.5);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setAspect(r.width / r.height); };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [ball]);
  const vp = closeFrame(CX + feed.x, feed.dist);
  const toPct = (x: number, y: number) => {
    const w = vp.x2 - vp.x1;
    return { left: ((x - vp.x1) / w) * 100, top: ((y - vp.y1) / w) * aspect * 100 };
  };
  const ballAt = toPct(CX + feed.x, feed.dist);
  const goalAt = toPct(CX, -0.6);
  const dark = light === "out";
  // The pool: over the goal and the ball, soft at the edge. Fixed shares of the box (the goal sits at
  // the top, you in the lower fifth on every ball).
  const poolX = 50, poolY = 40;
  const lampMask = `radial-gradient(ellipse 60% 56% at ${poolX}% ${poolY}%, transparent 0, transparent 24%, #000 90%)`;
  // In the dark: a glint low in the middle where the ball and you stand (the close camera always puts
  // you in the lower fifth), and a faint goal mouth at the top. Fixed shares of the box: the engine's
  // tilted camera does not map pitch metres to the screen in a straight line.
  const darkMask = `radial-gradient(ellipse 30% 9% at 45% 80%, rgba(0,0,0,.45) 0, rgba(0,0,0,.6) 40%, #000 100%), radial-gradient(ellipse 50% 10% at 50% 9%, rgba(0,0,0,.7) 0, #000 100%)`;

  const target = feed.target;
  // Where the target sits on the screen (the test driver aims at it; nothing in the game reads it).
  const aimX = target.kind === "corner" || target.kind === "half" ? (target.side === "L" ? POST_L + 0.7 : POST_R - 0.7)
    : target.kind === "tyre" || target.kind === "bucket" ? target.x : target.kind === "past" ? (feed.x >= 0 ? POST_R - 0.7 : POST_L + 0.7) : CX;
  const aimAt = toPct(aimX, 0);
  const markers = useMemo(() => (feed.dark && !shout ? undefined : hundredMarkers(feed)), [feed, shout]);
  const prompt = feed.dark ? (shout ? `${shout.replace(/[.!]/g, "").toUpperCase()} CORNER, LOW` : "WAIT FOR HIS SHOUT")
    : target.kind === "corner" ? `${target.side === "L" ? "LEFT" : "RIGHT"} CORNER, LOW`
    : target.kind === "bar" ? "HIT THE CROSSBAR"
    : target.kind === "tyre" ? "THROUGH THE TYRE"
    : target.kind === "bucket" ? "KNOCK THE BUCKET"
    : feed.double ? "BEAT DEN · TWENTY OR TEN OFF" : "BEAT DEN";

  return (
    <div className="dd" data-activity="strike-drill" data-round={feed.round} data-ball={ball} data-aim={feed.dark && !shout ? "" : `${aimAt.left.toFixed(1)},${aimAt.top.toFixed(1)}`} data-ballpct={`${ballAt.left.toFixed(1)},${ballAt.top.toFixed(1)}`} data-phase={phase} data-light={light} style={{ background: "#040a08", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Head: stop, the name, the ten balls in their six rounds */}
      <div style={{ padding: "8px 12px 7px", background: "linear-gradient(180deg,#0a1511,#040a08)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {canAbandon && !over && <button type="button" className="dd-ghost" style={{ height: 34, padding: "0 12px", fontSize: 12, borderRadius: 999 }} onClick={() => finish(shotsShown, true)} data-stop>✕ Stop</button>}
            {allowDice && !over && <button type="button" className="dd-ghost" style={{ height: 34, padding: "0 10px", fontSize: 11, borderRadius: 999 }} onClick={onDice} data-dice>🎲 Roll</button>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="dd-anton" style={{ fontSize: 21, lineHeight: 1 }}>{title}</div>
            <div className="dd-kick" style={{ color: "#f5b942", marginTop: 4, letterSpacing: ".14em" }}>Round {roundNo} of 6 · {round.name}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 7, justifyContent: "center" }} data-balls>
          {feeds.map((f, i) => {
            const s = shotsShown[i];
            const cur = i === ball && !over && !s;
            const gap = i > 0 && feeds[i - 1].round !== f.round;
            const bg = s ? (s.hit ? "#22c55e" : "#ef4444") : "rgba(255,255,255,.08)";
            return (
              <div key={i} style={{ marginLeft: gap ? 7 : 0, width: 25, height: 25, borderRadius: 99, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 900, color: s ? "#fff" : cur ? "#f5b942" : "rgba(255,255,255,.4)", background: bg, boxShadow: cur ? "0 0 0 2px #f5b942, 0 0 12px rgba(245,185,66,.6)" : "inset 0 0 0 1px rgba(255,255,255,.18)" }}>
                {s ? (s.hit ? "✓" : "✕") : f.double ? "×2" : i + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* The real engine, under one shed light */}
      <div ref={boxRef} style={{ position: "relative", overflow: "hidden" }}>
        {!over && phase !== "play" && <div className="absolute inset-0 z-[29]" style={{ background: phase === "react" ? "transparent" : "rgba(2,6,10,.55)" }} aria-hidden data-between />}
        {!over && (
          <EngineFeature
            key={ball}
            openOn={openOn}
            onBallStep={onBallStep}
            onChanceResolved={onChanceResolved}
            skills={{ power: career.skills.power, technique: career.skills.technique }}
            keeperStrength={feed.keeper?.strength ?? 0}
            seed={seed0 * 7 + ball * 13}
            markers={markers}
            scene={{ teammates: false, banners: false, ownFrame: true, keeper: !!feed.keeper, night: true }}
            career={ball > 0 ? careerSeen : career}
            fixture={kitFixture}
          />
        )}
        {/* The shed light: the night everywhere, one warm pool over the goal and the ball. Look only. */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 24, background: "rgba(3,8,18,.40)" }} />
        <div aria-hidden data-lamp={`${poolX.toFixed(0)},${poolY.toFixed(0)}`} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 24, background: "rgba(1,3,8,.86)", WebkitMaskImage: lampMask, maskImage: lampMask }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 24, background: `radial-gradient(ellipse 70% 40% at ${poolX}% ${poolY}%, rgba(255,214,140,.13), rgba(255,214,140,0) 70%)` }} />
        {/* Lights out: dark everywhere but a glint on the ball and the goal mouth; a flicker as it goes. */}
        <div aria-hidden data-dark style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 25, background: "rgba(0,1,3,.95)",
          WebkitMaskImage: darkMask, maskImage: darkMask, WebkitMaskComposite: "source-in", maskComposite: "intersect",
          opacity: dark ? 1 : light === "flicker" ? 0.6 : 0,
          animation: light === "flicker" ? "hd-flicker .9s steps(6) 1" : undefined, transition: dark ? "opacity .08s" : "opacity .4s",
        }} />
        <style>{`@keyframes hd-flicker{0%{opacity:0}20%{opacity:.9}35%{opacity:.1}55%{opacity:.95}70%{opacity:.3}100%{opacity:.85}}`}</style>

        {/* Den, when he is not in goal: by the bag at the edge of the light, feeding you (a picture; look only). */}
        {!feed.keeper && !over && !dark && <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/star/life/kitman/cut-den.webp" alt="" aria-hidden data-feeder style={{ position: "absolute", right: "1%", top: "55%", height: "19%", zIndex: 26, pointerEvents: "none", filter: "brightness(.62) saturate(.8) drop-shadow(-18px 10px 10px rgba(0,0,0,.7))" }} />
          <div aria-hidden style={{ position: "absolute", right: "17%", top: "71%", width: 34, height: 20, borderRadius: "40% 40% 30% 30%", background: "radial-gradient(circle at 40% 35%, #3b3f4a, #15171c)", zIndex: 26, pointerEvents: "none", boxShadow: "0 6px 8px rgba(0,0,0,.6)" }} />
        </>}
        {/* Den in goal: his name over the goal */}
        {feed.keeper && !over && <div aria-hidden className="pointer-events-none absolute z-30 dd-kick" style={{ left: `${goalAt.left}%`, top: `calc(${goalAt.top}% - 46px)`, transform: "translateX(-50%)", color: "#f5b942", textShadow: "0 2px 6px #000" }}>{callerName} in goal</div>}

        {/* Score */}
        <div aria-hidden style={{ position: "absolute", left: 12, top: "24%", pointerEvents: "none", zIndex: 30, textShadow: "0 2px 10px rgba(0,0,0,.8)" }} data-score={big}>
          <div className="dd-anton" style={{ fontSize: 58, lineHeight: 0.9 }}>{big}</div>
          <div className="dd-kick" style={{ color: "rgba(255,255,255,.8)", fontSize: 9 }}>of 100{best > 0 ? ` · best ${best}` : ""}</div>
        </div>

        {/* The target card: this ball's target on the goal, and where the last ones went */}
        <div aria-hidden className="dd-glass" style={{ position: "absolute", right: 10, top: "24%", padding: "6px 8px", pointerEvents: "none", borderRadius: 10, zIndex: 30, opacity: phase === "round" || phase === "call" ? 0 : 1, transition: "opacity .25s" }} data-target={target.kind}>
          <div className="dd-kick" style={{ fontSize: 8, color: "rgba(255,255,255,.75)" }}>Aim here</div>
          <svg width="112" height="46" viewBox="0 0 112 46" style={{ display: "block", marginTop: 3 }}>
            {(() => {
              const gx = (x: number) => 4 + ((x - POST_L) / (POST_R - POST_L)) * 104;
              const gz = (z: number) => 42 - (z / GOAL_H) * 38;
              const g = "#22c55e";
              const showSide = feed.dark ? (shout ? (target as { side?: string }).side : null) : (target as { side?: string }).side;
              return (
                <>
                  <rect x="4" y="4" width="104" height="38" fill="rgba(255,255,255,.04)" stroke={target.kind === "bar" ? "#facc15" : "#fff"} strokeWidth="2" />
                  {target.kind === "bar" && <rect x="2" y="1" width="108" height="6" fill="#facc15" />}
                  {target.kind === "corner" && showSide && <rect x={showSide === "L" ? 4 : gx(POST_R - TARGET_WIDTH)} y={gz(TARGET_LOW)} width={gx(POST_L + TARGET_WIDTH) - 4} height={gz(0) - gz(TARGET_LOW)} fill="rgba(34,197,94,.45)" stroke={g} />}
                  {target.kind === "corner" && !showSide && <text x="56" y="28" textAnchor="middle" fontSize="10" fontWeight="900" fill="#f5b942">?</text>}
                  {target.kind === "tyre" && <circle cx={gx(target.x)} cy={gz(target.z)} r={(target.r / GOAL_H) * 38} fill="rgba(34,197,94,.35)" stroke="#111" strokeWidth="3" />}
                  {target.kind === "bucket" && <rect x={gx(target.x - target.w)} y={gz(0.7)} width={gx(target.x + target.w) - gx(target.x - target.w)} height={gz(0) - gz(0.7)} fill="rgba(220,38,38,.55)" stroke="#f87171" />}
                  {target.kind === "past" && <><rect x="4" y="4" width="104" height="38" fill="rgba(34,197,94,.18)" /><circle cx="56" cy="18" r="5" fill="#cbd5e1" /><rect x="50" y="23" width="12" height="17" rx="3" fill="#cbd5e1" /></>}
                  {shotsShown.map((s, i) => s.x === null || s.z === null ? null : (
                    <circle key={i} cx={Math.max(0, Math.min(112, gx(s.x)))} cy={Math.max(0, Math.min(46, gz(s.z)))} r="3.2" fill={s.hit ? "#22c55e" : "#ef4444"} stroke="#000" strokeWidth=".6" />
                  ))}
                </>
              );
            })()}
          </svg>
          <div className="dd-kick" style={{ fontSize: 8, color: "#fff", marginTop: 3, maxWidth: 112 }}>{prompt}</div>
        </div>

        {flash && <div className="pointer-events-none absolute inset-x-0 z-30 text-center dd-anton" style={{ top: "38%", fontSize: 30, color: flash.good ? "#86efac" : "#fca5a5", textShadow: "0 2px 8px #000" }} data-flash>{flash.text}</div>}

        {/* A round's card: its name and Den's line */}
        {phase === "round" && !over && (
          <div className="pointer-events-none absolute inset-x-0 z-30 text-center" style={{ top: "30%", padding: "0 22px" }} data-round-card={feed.round}>
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.7)" }}>Round {roundNo} of 6 · {feeds.filter((f) => f.round === feed.round).length === 1 ? "one ball" : `${feeds.filter((f) => f.round === feed.round).length} balls`}</div>
            <div className="dd-anton" style={{ fontSize: 46, lineHeight: 1.02, color: feed.round === "double" ? "#f5c542" : "#fff", textShadow: "0 3px 12px #000" }}>{round.name}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12, textShadow: "0 2px 6px #000" }}><span className="dd-kick" style={{ color: "#f5b942", display: "block" }}>{callerName}</span>{ball === 0 ? "Go and stand on the D. " : ""}{round.line}</div>
          </div>
        )}
        {/* Den's call, before each ball */}
        {phase === "call" && !over && (
          <div className="pointer-events-none absolute inset-x-0 z-30 text-center" style={{ top: "34%", padding: "0 20px" }} data-call={ball}>
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.7)" }}>Ball {ball + 1} of {n}{feed.double ? " · twenty, or ten off" : ""}</div>
            <div className="dd-anton" style={{ fontSize: 40, lineHeight: 1.05, color: feed.double ? "#f5c542" : "#fff", textShadow: "0 3px 12px #000" }}>{feed.call}</div>
          </div>
        )}
        {/* In the dark: his shout */}
        {shout && phase === "play" && (
          <div className="pointer-events-none absolute inset-x-0 z-30 text-center" style={{ top: "40%" }} data-shout>
            <div className="dd-kick" style={{ color: "#f5b942" }}>{callerName}, somewhere in the dark</div>
            <div className="dd-anton" style={{ fontSize: 54, color: "#fde68a", textShadow: "0 0 18px rgba(253,230,138,.5), 0 3px 10px #000" }}>{shout.replace(/[.]/g, "!").toUpperCase()}</div>
          </div>
        )}
        {said && (
          <div className="pointer-events-none absolute inset-x-0 z-30 text-center" style={{ bottom: 92, padding: "0 18px", textShadow: "0 2px 6px #000" }} data-caller>
            <div className="dd-kick" style={{ color: "#f5b942" }}>{callerName}</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>&ldquo;{said}&rdquo;</div>
          </div>
        )}

        {/* Foot: this ball and what it is worth */}
        <div className="dd-glass" style={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 31, pointerEvents: "none", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", borderRadius: 12 }}>
          <div>
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.65)", fontSize: 9 }}>Ball {Math.min(ball + 1, n)} of {n} · {feed.double ? "twenty, or ten off" : "ten if you get it"}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{feed.label} · {feed.dist} m{feed.keeper ? ` · ${callerName} in goal` : ""}{feed.dark ? " · lights out" : ""}</div>
          </div>
          {energy ? <div style={{ textAlign: "right" }}><div className="dd-kick" style={{ fontSize: 8, color: "rgba(255,255,255,.6)" }}>Energy</div><div style={{ color: "#ff8a80", fontWeight: 900, fontSize: 18 }}>{energy}</div></div> : null}
        </div>
      </div>
    </div>
  );
}
