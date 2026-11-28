"use client";
/**
 * DEN'S HUNDRED v3 — the kit man's drill as a little game under one shed light
 * (Harry, 20 Nov 2026: "the worst thing of the kit man is the drill, I think
 * it's a chance to be creative, also make sure it's the main engine").
 *
 * v4: ten different balls (lib/star/life/drill.ts HUNDRED_ROUNDS): off his
 * throw (a volley), his lob (a header), his cut-back (first time), on the
 * bounce (inside a post), over the dummy (a chip), the skip, the crossbar, Den
 * in goal twice, double or nowt. Den stands on the pitch, painted by the
 * match's own figure painter at the match's own size (drillScene feederSpot +
 * the "man" marker), so he and you are one scale. A round of one ball shows
 * its call on its card (no separate call beat): 60-90 s a night.
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
import { challenge, denAfter, HUNDRED_ROUNDS, judge, pointsOf, promptOf, shoutOf, SKIP_H, TARGET_LOW, TARGET_WIDTH, type BallEnd, type ReactionLines, type RoundSpec } from "@/lib/star/life/drill";
import { closeFrame, hundredMarkers, hundredScenario, seedFor } from "@/lib/star/life/drillScene";
import { EngineFeature } from "../EnginePlay";
import type { ChanceResolved } from "../CanvasMatch";
import { speak, stopVoice } from "@/lib/star/life/voice";
import "./decision.css";

interface Shot { hit: boolean; x: number | null; z: number | null; end: BallEnd }
type Phase = "round" | "call" | "play" | "react";
type Light = "on" | "flicker" | "out";

const WORD: Record<BallEnd, string> = { hit: "IN", saved: "SAVED", post: "OFF THE POST", wide: "WIDE", over: "OVER", high: "TOO HIGH", central: "TOO CENTRAL", wrong: "WRONG CORNER", "under-bar": "UNDER THE BAR", "missed-it": "MISSED IT", "in-net": "NET, NOT SKIP", blocked: "BLOCKED" };
const HIT_WORD: Record<string, string> = { "call-it": "THAT CORNER", crossbar: "CROSSBAR!", tyre: "THROUGH IT!", bucket: "BUCKET'S OVER", keeper: "PAST HIM", "lights-out": "IN THE DARK", double: "TWENTY!", corners: "IN THE CORNER", far: "FROM TWENTY YARDS", volley: "VOLLEYED IN", header: "HEADED IN", cutback: "FIRST TIME!", "half-volley": "INSIDE THE POST", chip: "OVER HIM!", skip: "IN THE SKIP!" };

export default function HundredDrill({ career, title, seed0, extraDist, calls, callerName, callerAge, keeperName, rounds: specs, lines, face, canAbandon, energy, best, onDone, allowDice, onDice, fill }: {
  career: CareerState;
  title: string;
  seed0: number;
  /** A further-out night moves every ball back. */
  extraDist: number;
  /** Den's counts, from the arc book ("Ten." … "And a hundred."), voiced. */
  calls: string[];
  callerName: string;
  /** His age ({age} in a line). */
  callerAge?: number;
  /** Who goes in goal for a keeper round ({name}); default: him. */
  keeperName?: string;
  /** The story's rounds (the round library, drill.ts); default: Den's hundred. */
  rounds?: RoundSpec[];
  /** The story's own reaction lines (drill.ts ReactionLines). */
  lines?: ReactionLines;
  /** His still, as a small chip beside his words (on the pitch he is the match's own figure). */
  face?: string | null;
  canAbandon?: boolean;
  energy?: number;
  best: number;
  onDone: (r: ActivityResult) => void;
  allowDice?: boolean;
  onDice?: () => void;
  fill: (s: string) => string;
}) {
  const plan = useMemo(() => challenge(specs?.length ? specs : HUNDRED_ROUNDS, extraDist, seed0), [specs, extraDist, seed0]);
  const feeds = plan.feeds;
  // {name}: the person in goal; {age}: his age.
  const say = useCallback((t: string) => t.replace(/\{name\}/g, keeperName ?? callerName).replace(/\{age\}/g, callerAge ? String(callerAge) : "Not bad"), [keeperName, callerName, callerAge]);
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
  const round = plan.rounds[feed.roundNo];
  const roundNo = feed.roundNo + 1;
  const nRounds = plan.rounds.length;
  // A round of one ball: its card carries his call, and play follows the card (no call beat).
  const ballsInRound = feeds.filter((f) => f.roundNo === feed.roundNo).length;
  const soloRound = ballsInRound === 1;

  // The beats between balls: a round's card (its first ball), Den's call, then you play.
  useEffect(() => {
    if (over) return;
    if (phase === "round") {
      setLight("on");
      speak("b3-thursdays.t-sorry.say0.q1", ball === 0 ? "Go and stand on the D." : "");
      const t = window.setTimeout(() => setPhase(soloRound ? "play" : "call"), ball === 0 ? 2600 : soloRound ? 2100 : 1900);
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
      const already = ball > 0 && !!feeds[ball - 1]?.dark;
      if (!already) setLight("flicker");
      const t1 = window.setTimeout(() => {
        setLight("out");
        if (sh) { setShout(sh.text); if (sh.voice) speak(sh.voice, sh.text); }
      }, already ? 200 : 900);
      return () => window.clearTimeout(t1);
    }
    if (phase === "play") setLight("on");
    // (the dark holds through "call" and "react" inside its round)
  }, [phase, ball, feed, feeds, over, soloRound]);

  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossRef = useRef<{ x: number; z: number } | null>(null);
  const barRef = useRef(false);
  // The skip: where the ball first came down through its sides' height.
  const landRef = useRef<{ x: number; y: number } | null>(null);
  // The match's own seed for this ball (the cut-back takes a seed whose strike screen rolls it).
  const ballSeed = useMemo(() => seedFor(feed, seed0 * 7 + ball * 13), [feed, seed0, ball]);

  const openOn = useCallback((): Scenario => {
    prevRef.current = null; crossRef.current = null; barRef.current = false; landRef.current = null;
    return hundredScenario(feed, mulberry32(ballSeed));
  }, [ballSeed, feed]);

  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    const prev = prevRef.current;
    if (prev) {
      if (!crossRef.current && prev.y > 0 && b.y <= 0) {
        const t = prev.y / (prev.y - b.y);
        crossRef.current = { x: prev.x + (b.x - prev.x) * t, z: prev.z + (b.z - prev.z) * t };
      }
      if (!landRef.current && prev.z > SKIP_H && b.z <= SKIP_H) {
        const t = (prev.z - SKIP_H) / (prev.z - b.z);
        landRef.current = { x: prev.x + (b.x - prev.x) * t, y: prev.y + (b.y - prev.y) * t };
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
    const end = judge(feed, { cross: c, bar: barRef.current, outcome: info.outcome, land: landRef.current });
    const hit = end === "hit";
    let streak = 0;
    for (let k = shots.length - 1; k >= 0 && shots[k].hit; k--) streak++;
    const after = say(fill(denAfter(end, streak, ball, feeds, lines)));
    if (hit) {
      // Den counts in tens (his voiced lines): the new total, then what he thinks of it.
      const total = pointsOf([...shots.map((x) => x.hit), true], feeds);
      const idx = Math.max(0, Math.min(calls.length - 1, Math.round(total / 10) - 1));
      const count = fill(calls[idx] ?? "");
      setSaid((feed.double ? after : `${count} ${after}`).replace(/["“”]/g, ""));
      speak("b1-the-offer.play.caller", count);
    } else { setSaid(after.replace(/["“”]/g, "")); stopVoice(); }
    const list = [...shots, { hit, x: c?.x ?? null, z: c?.z ?? null, end }];
    setShout(null);
    setFlash({ text: hit ? (HIT_WORD[feed.target.kind === "tyre" || feed.target.kind === "bucket" ? feed.target.kind : feed.round] ?? "IN") : WORD[end], good: hit });
    if (!hit && feed.target.kind === "skip" && landRef.current) {
      // How far off the skip it came down: the miss you can see.
      const off = Math.hypot(Math.max(0, Math.abs(landRef.current.x - feed.target.x) - feed.target.w), Math.max(0, Math.abs(landRef.current.y - feed.target.y) - feed.target.l));
      if (off > 0) setFlash({ text: `${off.toFixed(1)} M OFF THE SKIP`, good: false });
    }
    setPhase("react");
    window.setTimeout(() => setFlash(null), 1300);
    if (list.length >= n) window.setTimeout(() => finish(list, false), 2100);
    else window.setTimeout(() => {
      setSaid(null);
      setPhase(feeds[list.length].roundNo !== feed.roundNo ? "round" : "call");
      setShots(list);
    }, 1750);
    // Keep this ball's shot on screen (the dots) at once; the next ball mounts after Den has spoken.
    setShotsShown(list);
  }, [feed, feeds, shots, ball, calls, fill, n, finish, say, lines]);

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
  // The same frame the scenario carries (hundredScenario): the ball, the goal, Den and the skip.
  const vp = useMemo(() => hundredScenario(feed, mulberry32(ballSeed)).viewport ?? closeFrame(CX + feed.x, feed.dist), [feed, ballSeed]);
  // A volley or a header is the match's own air ball: its strike screen opens by itself 0.8 s after
  // the chance is served (lib/star/airTap.ts), so its engine is mounted only once you play — never
  // under the round card, where its ring would run out unseen. Until then the box keeps its height.
  const airBall = feed.engine === "volley" || feed.engine === "header";
  const engineOn = !over && (!airBall || phase === "play" || phase === "react");
  const lastH = useRef(0);
  useEffect(() => {
    const el = boxRef.current;
    if (el && engineOn) { const h = el.getBoundingClientRect().height; if (h > 120) lastH.current = h; }
  });
  const toPct = (x: number, y: number) => {
    const w = vp.x2 - vp.x1;
    return { left: ((x - vp.x1) / w) * 100, top: ((y - vp.y1) / w) * aspect * 100 };
  };
  const ballAt = toPct(CX + feed.x, feed.dist);
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
  // eslint-disable-next-line @next/next/no-img-element
  const chip = (size: number) => (face ? <img src={face} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: 999, objectFit: "cover", boxShadow: "0 0 0 2px rgba(245,185,66,.7)" }} /> : null);
  // Where the target sits on the screen (the test driver aims at it; nothing in the game reads it).
  const aimX = target.kind === "corner" || target.kind === "half" ? (target.side === "L" ? POST_L + 0.7 : POST_R - 0.7)
    : target.kind === "tyre" || target.kind === "bucket" || target.kind === "skip" ? target.x
    : target.kind === "past" || target.kind === "net" || target.kind === "either" ? (feed.x >= 0 ? POST_R - 0.7 : POST_L + 0.7) : CX;
  const aimAt = toPct(aimX, target.kind === "skip" ? target.y : 0);
  const markers = useMemo(() => (feed.dark && !shout ? undefined : hundredMarkers(feed, callerName !== "He" ? callerName : undefined)), [feed, shout, callerName]);
  // Whoever is actually in goal is named ("BEAT DEN" used to say Den whoever was in goal).
  const inGoal = keeperName ?? callerName;
  const prompt = promptOf(feed, inGoal, shout);

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
            <div className="dd-kick" style={{ color: "#f5b942", marginTop: 4, letterSpacing: ".14em" }}>Round {roundNo} of {nRounds} · {say(round.name)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 7, justifyContent: "center" }} data-balls>
          {feeds.map((f, i) => {
            const s = shotsShown[i];
            const cur = i === ball && !over && !s;
            const gap = i > 0 && feeds[i - 1].roundNo !== f.roundNo;
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
      <div ref={boxRef} style={{ position: "relative", overflow: "hidden", minHeight: engineOn || over ? undefined : (lastH.current || "calc(100dvh - 92px)"), background: engineOn ? undefined : "radial-gradient(ellipse 80% 60% at 50% 40%, #12301f, #050b08)" }}>
        {!over && phase !== "play" && <div className="absolute inset-0 z-[29]" style={{ background: phase === "react" ? "transparent" : "rgba(2,6,10,.55)" }} aria-hidden data-between />}
        {engineOn && (
          <EngineFeature
            key={ball}
            openOn={openOn}
            onBallStep={onBallStep}
            onChanceResolved={onChanceResolved}
            skills={{ power: career.skills.power, technique: career.skills.technique }}
            keeperStrength={feed.keeper?.strength ?? 0}
            seed={ballSeed}
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

        {/* Den in goal: his name over the goal */}
        {/* Who is in goal: a tag at the top of the pitch, over the net, never on the keeper himself. */}
        {feed.keeper && !over && <div aria-hidden className="pointer-events-none absolute z-30 dd-kick" style={{ left: "50%", top: 6, transform: "translateX(-50%)", color: "#f5b942", background: "rgba(0,0,0,.55)", padding: "3px 9px", borderRadius: 999 }} data-in-goal>{inGoal} in goal</div>}

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
                  {target.kind === "net" && <rect x="4" y="4" width="104" height="38" fill="rgba(34,197,94,.32)" />}
                  {target.kind === "either" && <><rect x="4" y="4" width={gx(POST_L + TARGET_WIDTH) - 4} height="38" fill="rgba(34,197,94,.42)" stroke={g} /><rect x={gx(POST_R - TARGET_WIDTH)} y="4" width={108 - gx(POST_R - TARGET_WIDTH)} height="38" fill="rgba(34,197,94,.42)" stroke={g} /></>}
                  {target.kind === "skip" && <><rect x={gx(target.x - target.w)} y="30" width={gx(target.x + target.w) - gx(target.x - target.w)} height="12" fill="#eab308" stroke="#fde68a" /><path d={`M${gx(target.x)} 8 Q ${gx(target.x) - 14} 0 ${gx(target.x)} 28`} fill="none" stroke="#86efac" strokeWidth="1.6" strokeDasharray="3 2" /></>}
                  {feed.dummy && <><circle cx="56" cy="27" r="4" fill="#94a3b8" /><rect x="51" y="31" width="10" height="11" rx="2" fill="#94a3b8" /></>}
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
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.7)" }}>{soloRound ? `Ball ${ball + 1} of ${n}${feed.double ? " · twenty, or ten off" : ""}` : `Round ${roundNo} of ${nRounds} · ${ballsInRound} balls`}</div>
            <div className="dd-anton" style={{ fontSize: 46, lineHeight: 1.02, color: feed.round === "double" ? "#f5c542" : "#fff", textShadow: "0 3px 12px #000" }}>{say(round.name)}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12, textShadow: "0 2px 6px #000" }}><span className="dd-kick" style={{ color: "#f5b942", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>{chip(26)}{callerName}</span>{ball === 0 && !specs?.length ? "Go and stand on the D. " : ""}{say(fill(round.line))}</div>
          </div>
        )}
        {/* Den's call, before each ball */}
        {phase === "call" && !over && (
          <div className="pointer-events-none absolute inset-x-0 z-30 text-center" style={{ top: "34%", padding: "0 20px" }} data-call={ball}>
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.7)" }}>Ball {ball + 1} of {n}{feed.double ? " · twenty, or ten off" : ""}</div>
            <div className="dd-anton" style={{ fontSize: 40, lineHeight: 1.05, color: feed.double ? "#f5c542" : "#fff", textShadow: "0 3px 12px #000" }}>{say(fill(feed.call))}</div>
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
            <div className="dd-kick" style={{ color: "#f5b942", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 3 }}>{chip(24)}{callerName}</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>&ldquo;{said}&rdquo;</div>
          </div>
        )}

        {/* Foot: this ball and what it is worth */}
        <div className="dd-glass" style={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 31, pointerEvents: "none", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", borderRadius: 12 }}>
          <div>
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.65)", fontSize: 9 }}>Ball {Math.min(ball + 1, n)} of {n} · {feed.double ? "twenty, or ten off" : "ten if you get it"}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{say(feed.label)} · {feed.dist} m{feed.keeper ? ` · ${keeperName ?? callerName} in goal` : ""}{feed.dark ? " · lights out" : ""}</div>
          </div>
          {energy ? <div style={{ textAlign: "right" }}><div className="dd-kick" style={{ fontSize: 8, color: "rgba(255,255,255,.6)" }}>Energy</div><div style={{ color: "#ff8a80", fontWeight: 900, fontSize: 18 }}>{energy}</div></div> : null}
        </div>
      </div>
    </div>
  );
}
