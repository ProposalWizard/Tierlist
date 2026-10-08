"use client";

/**
 * CROSSBAR CHALLENGE, IN 3D — the first game on the 3D training pitch
 * (Harry, 8 Oct 2026: "full 3D training area … actually utilising the 3D
 * model in 3D games … starting game can be crossbar challenge — you vs one
 * teammate").
 *
 * You and one real team-mate, five shots each from the edge of the box at an
 * empty goal. Only the crossbar scores (a post scores nothing). Level or
 * better wins. Rules: lib/star/training3d/crossbar.ts.
 *
 * ONE ENGINE (.claude/skills/one-engine): YOUR shot is the real match —
 * EngineFeature's ball, drag, contact screen and flight. You aim on the
 * engine's own pitch; as the ball is struck the 3D pitch fades in over it and
 * draws the engine's ball, step by step (onBallStep), from behind you. The
 * engine keeps running underneath and decides the result.
 * HIS shot is a cut-scene: rolled from his rating when the challenge starts
 * and shown along a scripted path. You watch it; you don't play it.
 *
 * The 3D scene is lib/star/training3d/scene.ts (the 3D shop and garden's own
 * people, in a training kit).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { PITCH_W } from "@/lib/star/pitch";
import { FRAME_TOP_FOR_GOAL } from "@/lib/star/goalFrame";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { kitsOf } from "@/lib/star/kits";
import { realMatchHeight } from "@/lib/star/engineProfile";
import { skinToneHex, resolveHairStyle, hairColourHex } from "@/lib/star/playerIdentity";
import { fitFace } from "@/lib/star/faceFit";
import type { FacePic } from "@/lib/star/people3d";
import {
  CROSSBAR_SHOTS, CROSSBAR_SPOT, touchingBar, touchingPost, rollMateShots, crossbarReward, crossbarWinner,
  type MateShot,
} from "@/lib/star/training3d/crossbar";
import { KICK_DELAY_S, type TrainingController } from "@/lib/star/training3d/scene";
import { EngineFeature, useRealMatchWidth } from "./EnginePlay";
import { buildStrike, DRILL_SCENE } from "./TrainingMinigame";
import type { ChanceResolved } from "./CanvasMatch";
import { GameShell, ResultPanel, type GameResult } from "./relgames/Shell";

export interface Training3DResult extends GameResult {
  you: number;
  him: number;
  mate: string;
}

type Step = "you-aim" | "you-flight" | "you-after" | "mate" | "mate-after" | "done";

const SKINS = ["#8d5524", "#c68642", "#e0ac69", "#5c3a1e", "#f1c27d"];
const HAIRS = ["#1b120c", "#2b1b10", "#4a2e1c", "#0f0b08"];

/** A photo, fitted for the 3D head (null if it can't be read). Gives up after 3 s. */
async function faceFrom(url: string | undefined): Promise<{ face: FacePic; skin: string } | null> {
  if (!url || typeof createImageBitmap !== "function") return null;
  const job = fetch(url, { mode: "cors" })
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => (b ? createImageBitmap(b, { resizeHeight: 320, resizeQuality: "medium" }) : null))
    .then((bmp) => {
      if (!bmp) return null;
      const fit = fitFace(bmp, 320, url);
      bmp.close();
      return fit ? { face: { canvas: fit.canvas, chinX: fit.chinX, chinY: fit.chinY, faceH: fit.faceH }, skin: fit.skin } : null;
    })
    .catch(() => null);
  return Promise.race([job, new Promise<null>((res) => setTimeout(() => res(null), 3000))]);
}

export default function Training3D({ career, onExit, onFinish }: {
  career: CareerState;
  onExit: () => void;
  onFinish: (result: Training3DResult) => void;
}) {
  const team = career.relationships.team;
  const seed = career.season * 7919 + career.week * 131;

  // His name, face and five shots: fixed when the challenge starts.
  const mate = useMemo(() => {
    const rng = mulberry32(seed);
    const pool = (career.squad ?? []).filter((p) => p.position !== "GK");
    const p = pool.length ? pool[Math.floor(rng() * pool.length)] : null;
    const id = p?.id ?? "mate";
    return {
      name: p ? p.name.split(" ").slice(-1)[0] : "Team-mate",
      face: p?.imageUrl ?? fakeFaceFor(id),
      overall: p?.overall ?? 65,
      shots: rollMateShots(p?.overall, rng),
      skin: SKINS[Math.floor(rng() * SKINS.length)],
      hair: HAIRS[Math.floor(rng() * HAIRS.length)],
    };
  }, [seed, career.squad]);

  const [round, setRound] = useState(0);
  const [step, setStep] = useState<Step>("you-aim");
  const [yourScore, setYourScore] = useState(0);
  const [hisScore, setHisScore] = useState(0);
  const [marks, setMarks] = useState<{ you: (boolean | null)[]; him: (boolean | null)[] }>({ you: [], him: [] });
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [result, setResult] = useState<Training3DResult | null>(null);
  const [three, setThree] = useState<"loading" | "ready" | "off">("loading");

  const holder = useRef<HTMLDivElement>(null);
  const ctrl = useRef<TrainingController | null>(null);
  const stepRef = useRef<Step>("you-aim");
  stepRef.current = step;
  const barRef = useRef(false);
  const postRef = useRef(false);
  const timers = useRef<number[]>([]);
  const later = (f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)); };
  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); }, []);

  // ── The 3D pitch ──
  useEffect(() => {
    let dead = false;
    const el = holder.current;
    if (!el) return;
    (async () => {
      try {
        const fitted = await faceFrom(mate.face);
        if (dead) return;
        const { createTrainingScene } = await import("@/lib/star/training3d/scene");
        const kit = kitsOf(career.player.club).home;
        const c = await createTrainingScene(el, {
          // a training top: the club's colour, with the trim for the shorts
          kit: { shirt: kit.shirt, trim: kit.trim },
          you: {
            skin: skinToneHex(career.player.skinTone),
            hair: hairColourHex(career.player.hairColour),
            hairStyle: resolveHairStyle(career.player.hairStyle),
          },
          mate: { skin: fitted?.skin ?? mate.skin, hair: mate.hair, hairStyle: "short", face: fitted?.face ?? null },
        });
        if (dead) { c.dispose(); return; }
        ctrl.current = c;
        c.setShooter("you");
        c.setActive(stepRef.current !== "you-aim");
        setThree("ready");
      } catch (e) {
        console.error("3D training pitch failed to load", e);
        if (!dead) setThree("off");
      }
    })();
    return () => { dead = true; ctrl.current?.dispose(); ctrl.current = null; };
    // built once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While you aim, the engine's own pitch is on screen and the 3D rests.
  useEffect(() => { ctrl.current?.setActive(step !== "you-aim" && step !== "done"); }, [step]);

  const showFlash = (text: string, good: boolean, ms = 1300) => { setFlash({ text, good }); later(() => setFlash(null), ms); };

  const finish = useCallback((you: number, him: number) => {
    const r = crossbarReward(you, him, team, Math.random());
    const w = crossbarWinner(you, him);
    const line = w === "level" ? `Level at ${you}-${him} with ${mate.name}. Honours even.` : w === "you" ? `You beat ${mate.name} ${you}-${him}.` : `${mate.name} beat you ${him}-${you}.`;
    setResult({ ...r, line, you, him, mate: mate.name });
    setStep("done");
  }, [team, mate.name]);

  // ── His turn (the cut-scene) ──
  const hisTurn = useCallback((r: number, you: number, him: number) => {
    setStep("mate");
    const shot: MateShot = mate.shots[r];
    const c = ctrl.current;
    const after = () => {
      const total = him + (shot.hit ? 1 : 0);
      setHisScore(total);
      setMarks((m) => ({ ...m, him: [...m.him, shot.hit] }));
      setStep("mate-after");
      if (shot.hit) { c?.play("mate", "celebrate"); showFlash(`${mate.name.toUpperCase()} HITS THE BAR!`, false); }
      else c?.play("mate", "frustrated");
      if (!shot.hit) showFlash(shot.miss === "post" ? "Off the post — doesn't count" : shot.miss === "under" ? "Under it — into the net" : shot.miss === "over" ? "Over the bar" : "Wide", true);
      later(() => {
        c?.play("mate", "watch");
        if (r + 1 >= CROSSBAR_SHOTS) finish(you, total);
        else { c?.resetBall(); c?.setShooter("you"); c?.setCamera("behind"); setRound(r + 1); setStep("you-aim"); }
      }, 2100);
    };
    if (!c) { later(after, 600); return; }
    c.setShooter("mate");
    c.play("you", "watch");
    c.playMateShot(shot, after);
  }, [mate, finish]);

  // ── Your turn (the real engine) ──
  const openOn = useCallback((): Scenario => {
    const setup = buildStrike("power", 1, round, mulberry32(seed + round * 17), { trainingLevel: 1, power: career.skills.power });
    const sc = setup.scenario;
    sc.ball = { x: CROSSBAR_SPOT.x, y: CROSSBAR_SPOT.y };
    sc.player = { x: CROSSBAR_SPOT.x, y: CROSSBAR_SPOT.y + 0.8 };
    sc.defenders = [];
    // the woodwork challenge's close camera on the goal
    const h = Math.max(22, sc.ball.y + 10);
    const w = h * (5 / 8);
    const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, sc.ball.x));
    sc.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
    barRef.current = false;
    postRef.current = false;
    return sc;
  }, [round, seed, career.skills.power]);

  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    if (stepRef.current === "you-aim") {
      // struck: the 3D pitch takes over the picture
      stepRef.current = "you-flight";
      setStep("you-flight");
      ctrl.current?.resetBall();
      ctrl.current?.play("you", "kick");
      // the 3D kick has a run-up: cut to the goal just after his foot meets the ball
      later(() => ctrl.current?.setCamera("goal"), ((ctrl.current?.kickDelayS ?? KICK_DELAY_S) + 0.2) * 1000);
    }
    ctrl.current?.feedEngineBall(b);
    if (!barRef.current && touchingBar(b)) barRef.current = true;
    if (!postRef.current && touchingPost(b)) postRef.current = true;
  }, []);

  const onChanceResolved = useCallback((_info: ChanceResolved) => {
    if (stepRef.current === "you-after") return;
    const hit = barRef.current;
    const total = yourScore + (hit ? 1 : 0);
    stepRef.current = "you-after";
    setStep("you-after");
    // the 3D ball runs behind the engine's (the run-up): say it as it gets there
    const lag = (ctrl.current?.kickDelayS ?? KICK_DELAY_S) * 1000;
    later(() => {
      setYourScore(total);
      setMarks((m) => ({ ...m, you: [...m.you, hit] }));
      if (hit) { ctrl.current?.play("you", "celebrate"); showFlash("CROSSBAR!", true); }
      else { ctrl.current?.play("you", "frustrated"); showFlash(postRef.current ? "Off the post — doesn't count" : "Missed the bar", false); }
    }, lag + 250);
    later(() => { ctrl.current?.play("you", "watch"); hisTurn(round, total, hisScore); }, lag + 2700);
  }, [yourScore, hisScore, round, hisTurn]);

  const w = useRealMatchWidth();
  const [vw, setVw] = useState(0);
  useEffect(() => { setVw(window.innerWidth); }, []);
  const show3d = three === "ready" && step !== "you-aim" && step !== "done";
  const engineOn = step === "you-aim" || step === "you-flight" || step === "you-after";

  return (
    <GameShell title="Crossbar challenge" who="Team" current={team} tone="#38bdf8" onBack={round === 0 && step === "you-aim" && !result ? onExit : undefined}>
      <div className="mb-2 text-[14px] font-bold">Hit the crossbar. Five shots each. A post doesn&apos;t count.</div>
      <div className="mb-2 grid grid-cols-2 gap-1 text-center" data-crossbar-score>
        <Strip name="You" score={yourScore} marks={marks.you} active={engineOn && !result} />
        <Strip name={mate.name} face={mate.face} score={hisScore} marks={marks.him} active={(step === "mate" || step === "mate-after") && !result} />
      </div>
      <div className="mb-1 text-center text-[12px] font-black uppercase tracking-wide text-sky-200">
        {result ? "Full time" : `Round ${Math.min(round + 1, CROSSBAR_SHOTS)} of ${CROSSBAR_SHOTS} · ${engineOn ? "your shot" : `${mate.name}'s shot`}`}
      </div>
      <div className="relative" data-training3d-step={step}>
        {engineOn && !result ? (
          <EngineFeature
            key={round}
            openOn={openOn}
            onChanceResolved={onChanceResolved}
            onBallStep={onBallStep}
            skills={{ power: career.skills.power, technique: career.skills.technique }}
            keeperStrength={0}
            seed={seed + round}
            scene={{ ...DRILL_SCENE.power, keeper: false, ownFrame: true }}
          />
        ) : (
          <div style={{ width: w, maxWidth: "100%", height: vw ? realMatchHeight(vw) : 560, margin: "0 auto" }} />
        )}
        {/* The 3D pitch: over the engine's from the strike on; never takes a tap. */}
        <div
          ref={holder}
          data-training3d={three}
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden transition-opacity duration-300"
          style={{ opacity: show3d ? 1 : 0, borderRadius: 4 }}
        />
        {three === "loading" && step !== "you-aim" && <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center text-[13px] font-bold text-white/80">Loading the training pitch…</div>}
        {flash && (
          <div className="pointer-events-none absolute inset-x-0 top-[22%] z-50 px-2 text-center text-[24px] font-black uppercase leading-tight" style={{ color: flash.good ? "#fde047" : "#fff", textShadow: "0 2px 8px #000" }}>
            {flash.text}
          </div>
        )}
      </div>
      {three === "off" && <div className="mt-1 text-center text-[12px] font-bold text-amber-200">This phone can&apos;t show the 3D pitch — the game still plays.</div>}
      {result && <ResultPanel result={result} who="Team" current={team} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}

function Strip({ name, score, marks, face, active }: { name: string; score: number; marks: (boolean | null)[]; face?: string; active: boolean }) {
  return (
    <div className={`px-2 py-1.5 ${active ? "bg-sky-500/25 ring-1 ring-sky-300" : "bg-white/10"}`} style={{ borderRadius: 4 }}>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {face ? <img src={face} alt="" className="h-[28px] w-[28px] rounded-full object-cover object-top" /> : <div className="grid h-[28px] w-[28px] place-items-center text-[18px]">⭐</div>}
        <div className="min-w-0 flex-1 truncate text-left text-[12px] font-black uppercase">{name}</div>
        <div className="text-[22px] font-black leading-none">{score}</div>
      </div>
      <div className="mt-1 flex justify-center gap-1">
        {Array.from({ length: CROSSBAR_SHOTS }, (_, i) => {
          const m = marks[i];
          return <span key={i} className="h-[10px] w-[10px] rounded-full" style={{ background: m === undefined ? "rgba(255,255,255,0.18)" : m ? "#fde047" : "#ef4444" }} />;
        })}
      </div>
    </div>
  );
}
