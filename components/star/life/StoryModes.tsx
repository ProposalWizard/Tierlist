"use client";
/**
 * FOUR GAMES THE STORIES WERE WAITING FOR (story world plan part 5a, D1-D4),
 * opened by the activity host (ActivityHost.tsx) when a talk's reply plays one.
 * Each hands back the same result as every other mode: {score, tens, won, abandoned}.
 *
 *  - penalties    "Miss it" (ten-minutes). One penalty on the REAL match engine:
 *                 EngineFeature with the match's own penalty picture (the trial
 *                 shootout's way: buildScenario "penalty", the spot, no wall), a
 *                 real keeper, your run-up. You aim it; missing on purpose is your
 *                 own aim. No loop or physics here (one-engine skill, RUL-ENG-002).
 *  - gym          "The board" (the-gym-board). The gym's plank or bench press
 *                 (lib/star/gym/games.ts) against his record (lib/star/life/gymBoard.ts).
 *  - two-touch    "Bet you can't do fifty" (keep-ups). Keep-ups in 3D on the 3D
 *                 engine (Play3D + lib/star/play3d/keepUps.ts; the 3D exception, RUL-3D-001).
 *  - pace-sprint  "Fastest in the squad" (the-race). Forty metres on your legs
 *                 (lib/star/life/sprint.ts on lib/star/legs.ts).
 *
 * The gym and the sprint are not football: plain page elements moved each frame,
 * no canvas, no ball.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import { buildScenario, initDefenders, type Scenario } from "@/lib/star/canvasEngine";
import type { LifeActivity } from "@/lib/star/life/types";
import type { ActivityResult, BeatLive } from "@/lib/star/life/arcs";
import { personInfo } from "@/lib/star/life/people";
import { mulberry32 } from "@/lib/star/season";
import { CX, PEN_SPOT_Y } from "@/lib/star/pitch";
import { clearForShootout } from "@/lib/star/penaltyTaking";
import { careerPenaltyRunup } from "@/lib/star/runupStyles";
import { startGame, stepGame, resultOf, BENCH, HOW_TO, type GameState } from "@/lib/star/gym/games";
import { PLANK } from "@/lib/star/gym/games2";
import { BOARD_RECORD, beatsBoard, boardLevel, boardLiftFor, boardWords, type BoardLift } from "@/lib/star/life/gymBoard";
import { sprintStart, sprintStep, sprintResult, type SprintSetup, type SprintState } from "@/lib/star/life/sprint";
import { keepUpsDrill, type KeepUpsState } from "@/lib/star/play3d/keepUps";
import { EngineFeature } from "../EnginePlay";
import type { ChanceResolved } from "../CanvasMatch";
import Play3D from "../Play3D";
import "./decision.css";

export type ModeProps = {
  career: CareerState;
  live: BeatLive;
  activity: LifeActivity;
  onDone: (r: ActivityResult) => void;
  allowDice?: boolean;
  onDice?: () => void;
  fill: (s: string) => string;
};

/** The modes this file plays. */
export const STORY_MODES = ["penalties", "gym", "two-touch", "pace-sprint"] as const;
export const isStoryMode = (m: string): boolean => (STORY_MODES as readonly string[]).includes(m);

export default function StoryMode(p: ModeProps) {
  switch (p.activity.mode) {
    case "penalties": return <PenaltyMode {...p} />;
    case "gym": return <GymBoardMode {...p} />;
    case "two-touch": return <KeepUpsMode {...p} />;
    case "pace-sprint": return <SprintMode {...p} />;
    default: return null;
  }
}

// ── shared pieces ──────────────────────────────────────────────────────────

const seedOf = (c: CareerState, live: BeatLive) => c.season * 977 + c.week * 31 + live.round;

function Head({ title, sub, canStop, onStop, allowDice, onDice, children }: { title: string; sub: string; canStop: boolean; onStop: () => void; allowDice?: boolean; onDice?: () => void; children?: ReactNode }) {
  return (
    <div style={{ padding: "8px 12px 7px", background: "linear-gradient(180deg,#0b1a14,#06110c)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {canStop && <button type="button" className="dd-ghost" style={{ height: 34, padding: "0 12px", fontSize: 12, borderRadius: 999 }} onClick={onStop} data-stop>✕ Stop</button>}
          {allowDice && canStop && <button type="button" className="dd-ghost" style={{ height: 34, padding: "0 10px", fontSize: 11, borderRadius: 999 }} onClick={onDice} data-dice>🎲 Roll</button>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="dd-anton" style={{ fontSize: 21, lineHeight: 1, letterSpacing: ".02em", textTransform: "uppercase" }}>{title}</div>
          <div className="dd-kick" style={{ color: "#f5b942", marginTop: 4, letterSpacing: ".14em" }}>{sub}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Foot({ text, energy }: { text: string; energy?: number }) {
  return (
    <div className="dd-glass" style={{ margin: "0 12px 12px", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", borderRadius: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{text}</div>
      {energy ? <div style={{ textAlign: "right" }}><div className="dd-kick" style={{ fontSize: 8, color: "rgba(255,255,255,.6)" }}>Energy</div><div style={{ color: "#ff8a80", fontWeight: 900, fontSize: 18 }}>{energy}</div></div> : null}
    </div>
  );
}

/** The end of a game: the big word, the numbers, and Continue (the talk carries on). */
function ResultCard({ good, big, lines, onContinue }: { good: boolean; big: string; lines: string[]; onContinue: () => void }) {
  return (
    <div className="dd-fade-in" data-mode-result={good ? "won" : "lost"} style={{ margin: "14px 12px", padding: "18px 16px", borderRadius: 16, background: good ? "linear-gradient(180deg,rgba(34,197,94,.22),rgba(6,17,12,.9))" : "linear-gradient(180deg,rgba(239,68,68,.2),rgba(6,17,12,.9))", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)", textAlign: "center" }}>
      <div className="dd-anton" style={{ fontSize: 34, lineHeight: 1, color: good ? "#86efac" : "#fca5a5", textTransform: "uppercase" }}>{big}</div>
      {lines.map((l, i) => <div key={i} style={{ marginTop: i ? 4 : 10, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.88)" }}>{l}</div>)}
      <button type="button" className="dd-main" onClick={onContinue} data-continue style={{ marginTop: 16, width: "100%", height: 46, borderRadius: 12, fontWeight: 900, fontSize: 15 }}>Continue</button>
    </div>
  );
}

/** One thumb: press and hold anywhere on this pad (or Space on a computer). */
function useHold(active: boolean) {
  const held = useRef(false);
  useEffect(() => {
    if (!active) { held.current = false; return; }
    const down = (e: KeyboardEvent) => { if (e.code === "Space") { held.current = true; e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") held.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [active]);
  const pad = {
    onPointerDown: (e: React.PointerEvent) => { held.current = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); },
    onPointerUp: () => { held.current = false; },
    onPointerCancel: () => { held.current = false; },
    onPointerLeave: () => { held.current = false; },
  };
  return { held, pad };
}

/** A frame clock: calls `tick(dt)` every animation frame while `on`. */
function useFrames(on: boolean, tick: (dt: number) => void) {
  const ref = useRef(tick);
  ref.current = tick;
  useEffect(() => {
    if (!on) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
}

// ── D1: penalties (the real match engine) ──────────────────────────────────

/** A typical keeper (the match's default: 62). */
const PEN_KEEPER = 62;

function PenaltyMode({ career, live, activity, onDone, allowDice, onDice, fill }: ModeProps) {
  const n = activity.dials.shots ?? activity.dials.balls ?? 1;
  const seed0 = seedOf(career, live);
  const keeper = activity.dials.keeper !== false;
  const careerSeen = useMemo(() => ({ ...career, careerStats: { ...career.careerStats, appearances: Math.max(1, career.careerStats?.appearances ?? 0) } }), [career]);
  const kitFixture = useMemo(() => ({ week: career.week, opponent: (career.league?.find((t) => t.name !== career.player.club)?.name) ?? "Visitors", home: true, played: false }), [career.week, career.league, career.player.club]);
  const [kicks, setKicks] = useState<{ scored: boolean; how: string }[]>([]);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [over, setOver] = useState<null | { score: number }>(null);
  const kick = kicks.length;

  const openOn = useCallback((): Scenario => {
    const rng = mulberry32(seed0 * 7 + kick * 13);
    const sc = buildScenario("penalty", rng, PEN_KEEPER, 60, 55);
    initDefenders(sc, rng);
    sc.ball = { x: CX, y: PEN_SPOT_Y };
    clearForShootout(sc);
    return sc;
  }, [seed0, kick]);

  const onChanceResolved = useCallback((info: ChanceResolved) => {
    if (over) return;
    const scored = (info.outcome === "goal" || info.outcome === "rebound") && !info.teammateShot;
    const saved = info.outcome === "saved" || info.outcome === "tipped" || info.outcome === "caught";
    const how = scored ? "SCORED" : saved ? "SAVED" : info.outcome === "post" ? "OFF THE POST" : info.ball && info.ball.z > 2.44 ? "OVER THE BAR" : "WIDE";
    const list = [...kicks, { scored, how }];
    setKicks(list);
    setFlash({ text: how, good: scored });
    window.setTimeout(() => setFlash(null), 1100);
    if (list.length >= n) window.setTimeout(() => setOver({ score: list.filter((k) => k.scored).length }), 1300);
  }, [over, kicks, n]);

  const finish = (abandoned: boolean) => {
    const score = kicks.filter((k) => k.scored).length;
    onDone({ score, tens: score * 10, won: !abandoned && score >= Math.ceil(n / 2), abandoned });
  };

  return (
    <div className="dd" data-activity="penalties" style={{ background: "#06110c", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Head title={fill(activity.name)} sub={`${n === 1 ? "One penalty" : `${n} penalties`} · ${keeper ? "a keeper" : "an empty goal"}`} canStop={activity.canAbandon && !over && kick === 0} onStop={() => finish(true)} allowDice={allowDice} onDice={onDice}>
        {/* the story's line, slim under the title (a card at the bottom would sit off a phone's screen, under the pitch) */}
        {!over && <div data-pen-intro style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.85)", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>{activity.intro ? fill(activity.intro) : "Drag back from the ball, let go, and pick your corner."}</span>
          {activity.cost?.energy ? <span style={{ color: "#ff8a80", fontWeight: 900, whiteSpace: "nowrap" }}>Energy {activity.cost.energy}</span> : null}
        </div>}
      </Head>
      {!over ? (
        <div style={{ position: "relative" }}>
          <EngineFeature
            key={kick}
            openOn={openOn}
            onChanceResolved={onChanceResolved}
            skills={{ power: career.skills.power, technique: career.skills.technique }}
            setPieceSkill={career.skills.freeKick}
            keeperStrength={PEN_KEEPER}
            seed={seed0 * 7 + kick * 13}
            scene={{ teammates: false, keeper }}
            penaltyRunup={careerPenaltyRunup(career)}
            career={kick > 0 ? careerSeen : career}
            fixture={kitFixture}
          />
          {flash && <div className="pointer-events-none absolute inset-x-0 z-30 text-center dd-anton" data-pen-flash style={{ top: "34%", fontSize: 30, color: flash.good ? "#86efac" : "#fca5a5", textShadow: "0 2px 8px #000" }}>{flash.text}</div>}
        </div>
      ) : (
        <ResultCard good={over.score > 0} big={kicks.map((k) => k.how).join(" · ")} lines={[n === 1 ? (over.score ? "It's in." : "It didn't go in.") : `${over.score} of ${n} in.`]} onContinue={() => finish(false)} />
      )}
    </div>
  );
}

// ── D2: the gym board ──────────────────────────────────────────────────────

function GymBoardMode({ career, live, activity, onDone, allowDice, onDice, fill }: ModeProps) {
  const lift: BoardLift = boardLiftFor(live.lastReply?.id);
  const rec = BOARD_RECORD[lift];
  const holder = activity.caller?.slot ? personInfo(career, live.cast[activity.caller.slot] ?? "") : null;
  const his = holder?.short ?? "Him";
  const seed0 = seedOf(career, live);
  const [count, setCount] = useState(3);
  const [g, setG] = useState<GameState>(() => startGame(lift, boardLevel(career.skills.power), seed0));
  const gRef = useRef(g);
  const [ended, setEnded] = useState(false);
  const { held, pad } = useHold(!ended);
  // 3, 2, 1, then the set starts
  useEffect(() => {
    if (count <= 0) return;
    const t = window.setTimeout(() => setCount((c) => c - 1), 700);
    return () => window.clearTimeout(t);
  }, [count]);
  useFrames(count <= 0 && !ended, (dt) => {
    const s = stepGame(gRef.current, dt, held.current);
    gRef.current = s;
    setG(s);
    if ((s as { done: boolean }).done) setEnded(true);
  });
  const beat = ended && beatsBoard(lift, g);
  const finish = (abandoned: boolean) => onDone({ score: !abandoned && beatsBoard(lift, gRef.current) ? 1 : 0, tens: 0, won: !abandoned && beatsBoard(lift, gRef.current), abandoned });

  // the meter: the plank's shake (low is calm, high is breaking), the bench's bar height
  const plank = g.kind === "plank" ? g : null;
  const bench = g.kind === "bench" ? g : null;
  const marker = plank ? Math.min(1, plank.shake) : bench ? bench.bar : 0;
  const cue = count > 0 ? `${count}` : plank ? (held.current ? "BRACE" : "BREATHE") : bench ? (bench.phase === "down" ? "LOWER IT SLOWLY" : "PUSH") : "";
  const big = plank ? `${Math.floor(plank.braced)} s` : bench ? `${bench.reps}/${BENCH.reps}` : "";
  const clock = plank ? Math.max(0, PLANK.secs - plank.t) : bench ? Math.max(0, BENCH.maxSecs - bench.t) : 0;
  const bad = plank ? plank.strikes : bench ? bench.strikes : 0;

  return (
    <div className="dd" data-activity="gym" style={{ background: "#0a0d12", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Head title={fill(activity.name)} sub={`${lift === "plank" ? "Plank" : "Bench press"} · beat ${rec.words}`} canStop={activity.canAbandon && !ended} onStop={() => finish(true)} allowDice={allowDice} onDice={onDice} />
      {/* The whiteboard */}
      <div data-board style={{ margin: "10px 12px 0", padding: "10px 12px", borderRadius: 8, background: "#f4f4ef", color: "#1e293b", boxShadow: "0 6px 18px rgba(0,0,0,.4)", fontFamily: "'Comic Sans MS','Marker Felt',cursive" }}>
        <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: ".12em", color: "#b91c1c" }}>CLUB RECORDS</div>
        {(["BENCH", "SQUAT", "ROW", "PLANK"] as const).map((row) => {
          const mine = row.toLowerCase() === lift;
          const name = mine && beat ? "YOU" : his.toUpperCase();
          const val = row === "BENCH" ? BOARD_RECORD.bench.words : row === "PLANK" ? BOARD_RECORD.plank.words : row === "SQUAT" ? "140 kg" : "9 min 41";
          return (
            <div key={row} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginTop: 3, fontWeight: mine ? 900 : 600, color: mine ? "#1d4ed8" : "#334155", background: mine ? "rgba(250,204,21,.25)" : "none", borderRadius: 4, padding: "0 4px" }}>
              <span>{row}</span><span>{mine && beat ? boardWords(g) : val}</span><span>{name}</span>
            </div>
          );
        })}
      </div>
      {!ended ? (
        <div {...pad} data-hold-pad style={{ flex: 1, minHeight: 420, margin: 12, borderRadius: 16, background: "radial-gradient(80% 60% at 50% 30%, #1b2433, #0b0f16)", position: "relative", touchAction: "none", userSelect: "none", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
          <div style={{ position: "absolute", top: 14, left: 16 }}>
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.6)", fontSize: 9 }}>{lift === "plank" ? "Braced" : "Reps"}</div>
            <div className="dd-anton" style={{ fontSize: 54, lineHeight: 0.9 }} data-gym-big>{big}</div>
            {bench && <div className="dd-kick" style={{ color: "#86efac", fontSize: 10, marginTop: 4 }}>{bench.clean} lowered slowly</div>}
          </div>
          <div style={{ position: "absolute", top: 14, right: 16, textAlign: "right" }}>
            <div className="dd-kick" style={{ color: "rgba(255,255,255,.6)", fontSize: 9 }}>Time</div>
            <div className="dd-anton" style={{ fontSize: 28 }}>{clock.toFixed(0)} s</div>
            <div style={{ marginTop: 4, display: "flex", gap: 4, justifyContent: "flex-end" }}>{Array.from({ length: plank ? PLANK.strikesOut : BENCH.strikesOut }, (_, i) => <span key={i} style={{ width: 10, height: 10, borderRadius: 9, background: i < bad ? "#ef4444" : "rgba(255,255,255,.15)" }} />)}</div>
          </div>
          {/* The meter, upright in the middle */}
          <div style={{ position: "absolute", left: "50%", top: 120, bottom: 110, width: 46, transform: "translateX(-50%)", borderRadius: 12, background: "rgba(255,255,255,.07)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.15)", overflow: "hidden" }}>
            {plank && <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "30%", background: "rgba(239,68,68,.35)" }} />}
            {bench && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "10%", background: "rgba(239,68,68,.35)" }} />}
            <div data-gym-marker style={{ position: "absolute", left: -2, right: -2, height: 12, borderRadius: 6, bottom: `calc(${(marker * 100).toFixed(1)}% - 6px)`, background: plank && marker > 0.7 ? "#ef4444" : "#facc15", boxShadow: "0 0 12px rgba(250,204,21,.7)" }} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, textAlign: "center" }}>
            <div className="dd-anton" style={{ fontSize: count > 0 ? 64 : 26, color: "#f5b942" }}>{cue}</div>
          </div>
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,.7)" }}>{HOW_TO[lift]} {rec.need}.</div>
        </div>
      ) : (
        <ResultCard good={beat} big={beat ? "On the board" : "Not this time"} lines={[`You: ${boardWords(g)}.`, `${his}: ${rec.words}.`, resultOf(g).headline]} onContinue={() => finish(false)} />
      )}
      {!ended && <Foot text={activity.intro ? fill(activity.intro) : "One go at his record."} energy={activity.cost?.energy} />}
    </div>
  );
}

// ── D3: keep-ups (the 3D engine) ───────────────────────────────────────────

function KeepUpsMode({ career, live, activity, onDone }: ModeProps) {
  const opp = activity.dials.opponent ? personInfo(career, live.cast[activity.dials.opponent.slot] ?? "") : null;
  const kidName = opp?.short ?? "She";
  const target = activity.dials.target ?? 50;
  const stateRef = useRef<KeepUpsState | null>(null);
  const drill = useMemo(() => keepUpsDrill({ kidName, target, onState: (s) => { stateRef.current = s; } }), [kidName, target]);
  const seed = seedOf(career, live) * 7 + 3;
  return (
    <div data-activity="two-touch" style={{ minHeight: "100%" }}>
      <Play3D career={career} drill={drill} seed={seed}
        onExit={() => { const s = stateRef.current; onDone({ score: s?.count ?? 0, tens: 0, won: false, abandoned: true, oppScore: s?.kid }); }}
        onFinish={(r) => { const s = stateRef.current; onDone({ score: s?.count ?? 0, tens: 0, won: r.won, abandoned: false, oppScore: s?.kid }); }} />
    </div>
  );
}

// ── D4: the sprint race ────────────────────────────────────────────────────

function SprintMode({ career, live, activity, onDone, allowDice, onDice, fill }: ModeProps) {
  const opp = activity.dials.opponent ? personInfo(career, live.cast[activity.dials.opponent.slot] ?? "") : null;
  const his = opp?.short ?? "Him";
  const metres = activity.dials.metres ?? 40;
  const setup = useMemo<SprintSetup>(() => ({
    metres, seed: seedOf(career, live),
    you: { pace: career.skills.pace, energy: career.energy ?? 100 },
    him: { pace: opp?.player?.pace ?? opp?.player?.overall ?? 65, physical: opp?.player?.physical ?? undefined },
  }), [metres, career, live, opp?.player?.pace, opp?.player?.overall, opp?.player?.physical]);
  const [s, setS] = useState<SprintState>(() => sprintStart(setup));
  const sRef = useRef(s);
  const done = s.phase === "done";
  const { held, pad } = useHold(!done);
  useFrames(!done, (dt) => {
    const n = sprintStep(sRef.current, dt, held.current, setup);
    sRef.current = n;
    setS(n);
  });
  const r = sprintResult(s);
  const finish = (abandoned: boolean) => onDone({ score: !abandoned && r.won ? 1 : 0, tens: 0, won: !abandoned && r.won, abandoned, oppScore: undefined });
  const since = s.t - s.goAt;
  const word = s.flash.what === "false-start" && s.flash.age < 1.4 ? "FALSE START" : s.phase === "marks" ? "ON YOUR MARKS" : s.phase === "set" ? "SET" : s.phase === "race" && since < 0.8 ? "GO!" : "";
  const bar = s.you.legs.stamina.v, cap = s.you.legs.cap;
  const lane = (who: "you" | "him") => {
    const rr = s[who];
    const pct = (rr.d / metres) * 100;
    return (
      <div style={{ position: "relative", flex: 1, borderLeft: "2px solid rgba(255,255,255,.55)", borderRight: who === "him" ? "2px solid rgba(255,255,255,.55)" : undefined }}>
        <div data-runner={who} style={{ position: "absolute", left: "50%", bottom: `calc(${pct.toFixed(2)}% * 0.86 + 4%)`, transform: "translate(-50%, 50%)", textAlign: "center" }}>
          <div style={{ width: 30, height: 30, borderRadius: 99, margin: "0 auto", background: who === "you" ? "#facc15" : "#60a5fa", boxShadow: `0 0 0 3px rgba(0,0,0,.35), 0 0 16px ${who === "you" ? "rgba(250,204,21,.7)" : "rgba(96,165,250,.6)"}`, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900, color: "#111" }}>{who === "you" ? "YOU" : his.slice(0, 3).toUpperCase()}</div>
          {rr.time !== null && <div className="dd-kick" style={{ marginTop: 4, fontSize: 10, color: "#fff", textShadow: "0 1px 3px #000" }}>{rr.time.toFixed(2)} s</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="dd" data-activity="pace-sprint" style={{ background: "#06110c", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Head title={fill(activity.name)} sub={`${metres} m · you v ${his}`} canStop={activity.canAbandon && !done} onStop={() => finish(true)} allowDice={allowDice} onDice={onDice} />
      {!done ? (
        <div {...pad} data-hold-pad style={{ position: "relative", margin: 12, height: 470, borderRadius: 14, overflow: "hidden", touchAction: "none", userSelect: "none", background: "repeating-linear-gradient(180deg,#2f7a3b 0 47px,#2a7035 47px 94px)" }}>
          {/* metre marks every ten, the finish at the top, the start at the bottom */}
          {Array.from({ length: Math.floor(metres / 10) + 1 }, (_, i) => i * 10).map((m) => (
            <div key={m} style={{ position: "absolute", left: 0, right: 0, bottom: `${(m / metres) * 86 + 4}%`, borderTop: m === metres ? "6px dashed #fff" : m === 0 ? "3px solid #fff" : "1px solid rgba(255,255,255,.35)" }}>
              <span className="dd-kick" style={m === metres ? { position: "absolute", right: 10, top: -18, fontSize: 9, color: "#fff" } : { position: "absolute", left: 6, top: -16, fontSize: 9, color: "rgba(255,255,255,.75)" }}>{m === metres ? "FINISH" : `${m} m`}</span>
            </div>
          ))}
          <div style={{ position: "absolute", left: "22%", right: "22%", top: 0, bottom: 0, display: "flex" }}>
            {lane("you")}
            {lane("him")}
          </div>
          {word && <div className="dd-anton" data-sprint-word style={{ position: "absolute", left: 0, right: 0, top: "38%", textAlign: "center", fontSize: word === "GO!" ? 64 : 34, color: word === "FALSE START" ? "#fca5a5" : word === "GO!" ? "#86efac" : "#fff", textShadow: "0 3px 12px rgba(0,0,0,.7)" }}>{word}</div>}
          {/* your bar: the sprint left in you, never past your energy */}
          <div style={{ position: "absolute", left: 10, top: 10, width: 120 }}>
            <div className="dd-kick" style={{ fontSize: 8, color: "rgba(255,255,255,.8)" }}>Sprint left</div>
            <div style={{ position: "relative", height: 8, borderRadius: 6, background: "rgba(0,0,0,.4)", marginTop: 3, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: `${cap * 100}%`, right: 0, top: 0, bottom: 0, background: "repeating-linear-gradient(45deg,rgba(255,255,255,.1) 0 4px,transparent 4px 8px)" }} />
              <div data-stamina style={{ width: `${bar * 100}%`, height: "100%", background: s.you.legs.stamina.tired ? "#ef4444" : bar < 0.3 ? "#f59e0b" : "#86efac" }} />
            </div>
          </div>
          <div style={{ position: "absolute", right: 10, top: 62, textAlign: "right" }}>
            <div className="dd-anton" style={{ fontSize: 26, color: "#fff", textShadow: "0 2px 6px #000" }}>{s.phase === "race" ? Math.max(0, since).toFixed(2) : "0.00"}</div>
          </div>
          <div style={{ position: "absolute", left: 10, right: 10, bottom: 8, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#fff", textShadow: "0 1px 4px #000" }}>
            {s.you.went === null ? "Press on GO. Before it is a false start." : "Hold to sprint. Let go to run."}
          </div>
        </div>
      ) : (
        <ResultCard good={r.won} big={r.won ? "You won" : `${his} won`} lines={[
          `You: ${r.yourTime !== null ? `${r.yourTime.toFixed(2)} s` : "didn't finish"} · ${his}: ${r.hisTime !== null ? `${r.hisTime.toFixed(2)} s` : "didn't finish"}`,
          r.reaction !== null ? `Your start: ${r.reaction.toFixed(2)} s after GO${r.falseStarts ? ` · ${r.falseStarts} false start${r.falseStarts === 1 ? "" : "s"}` : ""}` : "",
        ].filter(Boolean)} onContinue={() => finish(false)} />
      )}
      {!done && <Foot text={activity.intro ? fill(activity.intro) : "Forty metres."} energy={activity.cost?.energy} />}
    </div>
  );
}
