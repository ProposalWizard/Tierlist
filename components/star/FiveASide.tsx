"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  initDefenders, launch, stepBall, stepKeeper, stepReactions, settleBall,
  stepBallInNet, stepBallPastBar, dragForFullPower, setOffsideRuleEnabled,
  type Ball, type Outcome, type Scenario,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { kitsOf } from "@/lib/star/kits";
import { loadFaceStyle } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle } from "@/lib/star/fakeFaceStyle";
import { createFaceImageCache } from "@/lib/star/faceImageCache";
import { FIVE_A_SIDE, type MatchRules } from "@/lib/star/fiveASide/rules";
import { buildPassage, type FiveCast } from "@/lib/star/fiveASide/passage";
import { leftPitch } from "@/lib/star/fiveASide/geometry";
import {
  newFiveMatch, applyOutcome, oppAttack, type FiveMatchState,
} from "@/lib/star/fiveASide/match";
import { passageQuality, summarise, type FiveASideSummary } from "@/lib/star/fiveASide/score";
import {
  projectionFor, drawPitch, drawGoal, drawFigure, drawBall, drawAim,
} from "@/lib/star/fiveASide/render";
import ContactBall from "./ContactBall";

/**
 * A REAL SMALL-SIDED MATCH, PLAYED ON THE LIVE ENGINE.
 *
 * You and three team-mates plus a keeper, against four and a keeper, on a
 * pitch that fits entirely inside one camera frame. Every kick you take goes
 * through the same `launch` / `stepBall` / `stepKeeper` the Saturday match
 * uses, with the same drag-to-aim.
 *
 * ── What is this component's, and what is not ──
 *
 * Almost nothing here is a decision. The shape of the game is `rules.ts`, the
 * picture the engine plays is `passage.ts`, the score and the clock are
 * `match.ts`, and what a touch was worth is `score.ts` — all pure, all tested
 * without a browser. This file is the loop, the thumb, and the paint.
 *
 * That split is deliberate and is what makes the piece reusable: the opening
 * trial, a free agent's replayed trial, and eventually a training drill all
 * want this match, and none of them want a different one.
 */

/** Matches the live match's own aim feel exactly. A dead-zone so a tap is not
 *  a shot, and a full-power drag computed from the striker's own power the
 *  same way `CanvasMatch` computes it — `TrialPenalty` once had stale copies
 *  of both and quietly felt different from the game it was the opening of. */
const MIN_PULL = 0.008;

type Phase = "ready" | "aim" | "contact" | "flight" | "result" | "opp" | "done";

export interface FiveASideProps {
  /** 0-1. Sets how good the opposition are — see rules/score. */
  difficulty: number;
  /** 0-100, your own keeper, for their attacks. */
  keeperStrength?: number;
  /** Your power and technique, fed straight to the engine's striking model. */
  skills?: { power: number; technique: number };
  seed: number;
  cast?: FiveCast;
  yourKit?: { shirt: string; trim: string };
  theirKit?: { shirt: string; trim: string };
  rules?: MatchRules;
  /** Mounted inside something else (the trial) rather than as its own page. */
  embedded?: boolean;
  onComplete: (summary: FiveASideSummary, state: FiveMatchState) => void;
  /** Called at every passage end so the trial can save mid-match — see the
   *  resume rules in trial.ts. */
  onProgress?: (state: FiveMatchState) => void;
  /** Resume rather than kick off. */
  resumeFrom?: FiveMatchState | null;
}

export default function FiveASide({
  difficulty, keeperStrength = 60, skills = { power: 55, technique: 55 },
  seed, cast, yourKit, theirKit, rules = FIVE_A_SIDE, embedded,
  onComplete, onProgress, resumeFrom,
}: FiveASideProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matchRef = useRef<FiveMatchState>(resumeFrom ?? newFiveMatch(seed, rules));
  const scRef = useRef<Scenario | null>(null);
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(mulberry32(seed));
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const aimRef = useRef<{ dir: { x: number; y: number }; power: number } | null>(null);
  const phaseRef = useRef<Phase>("ready");
  const rafRef = useRef<number | null>(null);
  const settleRef = useRef(0);
  const doneRef = useRef(false);

  const faces = useRef(createFaceImageCache());
  const faceStyle = useRef(loadFaceStyle());
  const fakeFaceStyle = useRef(loadFakeFaceStyle());

  const [, forceRender] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("ready");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  // A kit is a shirt and a trim; the shorts take the trim, which is what
  // `kitsOf` already means by the pair and keeps a look one object.
  const kit = (k: { shirt: string; trim: string }) => ({ shirt: k.shirt, trim: k.trim, shorts: k.trim });
  const mine = kit(yourKit ?? { shirt: "#f8fafc", trim: "#0f172a" });
  const theirs = kit(theirKit ?? { shirt: "#1e3a8a", trim: "#e2e8f0" });

  /**
   * A five-a-side has no offside, and the engine's law is ON by default — a
   * test proved it genuinely returns "offside" on these passages otherwise.
   * Restored on unmount because it is module-level state shared with every
   * real match; `CanvasMatch` re-sets it from the rule book on its own mount
   * anyway, so this is belt and braces rather than the only guard.
   */
  useEffect(() => {
    if (!rules.offside) setOffsideRuleEnabled(false);
    return () => { setOffsideRuleEnabled(true); };
  }, [rules.offside]);

  /** Build the picture for the touch that is about to happen. */
  const loadPassage = useCallback(() => {
    const m = matchRef.current;
    const sc = buildPassage(m.world, {
      cast,
      keeperStrength: Math.min(99, 40 + difficulty * 45),
      teamRelationship: 55,
      rng: rngRef.current,
    });
    sc.goal = { ...rules.goal };
    sc.crossbar = rules.crossbar;
    sc.viewport = { ...rules.view };
    initDefenders(sc, rngRef.current);
    scRef.current = sc;
    ballRef.current = null;
    aimRef.current = null;
    setPhase("aim");
  }, [cast, difficulty, rules]);

  useEffect(() => {
    loadPassage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── The thumb ──────────────────────────────────────────────────────────
  const pointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim") return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    dragRef.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const pointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim" || !dragRef.current) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const now = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    const dx = dragRef.current.x - now.x, dy = dragRef.current.y - now.y;
    const pull = Math.hypot(dx, dy);
    if (pull < MIN_PULL) { aimRef.current = null; forceRender(n => n + 1); return; }
    const full = dragForFullPower(skills.power);
    aimRef.current = { dir: { x: dx, y: dy }, power: Math.min(1, pull / full) };
    forceRender(n => n + 1);
  };

  const pointerUp = () => {
    if (phaseRef.current !== "aim") return;
    const aim = aimRef.current;
    dragRef.current = null;
    if (!aim) { forceRender(n => n + 1); return; }
    // You have chosen a direction and a weight; the contact screen decides
    // WHERE on the ball you hit it, exactly as a real match does.
    setPhase("contact");
  };

  /** The contact screen has closed — strike it. */
  const strike = useCallback((contact: { cx: number; cy: number }) => {
    const sc = scRef.current, aim = aimRef.current;
    if (!sc || !aim) { setPhase("aim"); return; }
    // The drag is in screen fractions; the engine wants pitch metres, and the
    // frame is the same shape on both axes, so one scale does both.
    const vp = sc.viewport;
    const w = vp.x2 - vp.x1, h = vp.y2 - vp.y1;
    const dir = { x: aim.dir.x * w, y: aim.dir.y * h };
    ballRef.current = launch(sc, dir, aim.power, contact, skills, rngRef.current);
    settleRef.current = 0;
    setPhase("flight");
  }, [skills]);

  /** Fold a finished touch into the match, then decide what happens next. */
  const resolve = useCallback((outcome: Outcome | "out") => {
    const sc = scRef.current, ball = ballRef.current;
    if (!sc || !ball) return;

    const crossX = outcome === "goal" || outcome === "wide" || outcome === "over" || outcome === "post"
      ? ball.pos.x : null;
    const quality = passageQuality(outcome, sc, crossX, rules);
    // A goal a team-mate scored off your pass is an assist, and the engine's
    // own `receiverShot` is the only reliable signal for "somebody else put
    // this away" — a clean team-mate finish reports as "goal" just like yours.
    const assist = outcome === "goal" && !!sc.receiverShot;

    const next = applyOutcome(matchRef.current, outcome, sc, ball, quality, { assist });
    matchRef.current = next;
    // Saved at every passage end, which is what makes closing the app safe.
    onProgress?.(next);

    if (next.over) {
      if (!doneRef.current) {
        doneRef.current = true;
        setPhase("done");
        onComplete(summarise(next, difficulty), next);
      }
      return;
    }
    if (next.possession === "them") { setPhase("opp"); return; }
    loadPassage();
  }, [difficulty, loadPassage, onComplete, onProgress, rules]);

  /** Their turn. A beat, then the ball is yours again. */
  useEffect(() => {
    if (phase !== "opp") return;
    const t = window.setTimeout(() => {
      const next = oppAttack(matchRef.current, difficulty, keeperStrength);
      matchRef.current = next;
      onProgress?.(next);
      if (next.over) {
        if (!doneRef.current) {
          doneRef.current = true;
          setPhase("done");
          onComplete(summarise(next, difficulty), next);
        }
        return;
      }
      loadPassage();
    }, 900);
    return () => window.clearTimeout(t);
  }, [phase, difficulty, keeperStrength, loadPassage, onComplete, onProgress]);

  // ── The loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let last = performance.now();
    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sc = scRef.current;
      if (!sc) return;

      if (phaseRef.current === "aim") {
        stepKeeper(sc, dt);
      } else if (phaseRef.current === "flight") {
        const ball = ballRef.current;
        if (ball) {
          // Three substeps, the same split a real match uses — one coarse
          // step per frame is measurably worse right at the boundary checks
          // (over the bar, in the net, off the post) that decide outcomes.
          let res: Outcome | null = null;
          for (let i = 0; i < 3 && !res; i++) {
            const h = dt / 3;
            stepKeeper(sc, h);
            stepReactions(sc, ball, h, rngRef.current);
            res = stepBall(ball, sc, rngRef.current, h);
          }
          // Our own touchline, which is inside the engine's frame — the
          // engine only calls "out" at the frame edge, a metre further on.
          if (!res && leftPitch(ball.pos)) res = "out" as Outcome;
          if (res) {
            setPhase("result");
            settleRef.current = 0;
            window.setTimeout(() => resolve(res as Outcome | "out"), 900);
          }
        }
      } else if (phaseRef.current === "result") {
        // Keep the ball moving after the outcome is decided, so a goal is SEEN
        // going in rather than announced and frozen.
        const ball = ballRef.current;
        if (ball) {
          if (ball.inNet) stepBallInNet(ball, dt);
          else if (ball.overBar) stepBallPastBar(ball, dt);
          else settleBall(ball, dt);
          if (!sc.keeper.done) stepKeeper(sc, dt);
        }
      }
      draw();
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolve]);

  // ── The picture ────────────────────────────────────────────────────────
  const draw = () => {
    const c = canvasRef.current, wrap = wrapRef.current, sc = scRef.current;
    if (!c || !wrap || !sc) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = wrap.clientWidth, cssH = wrap.clientHeight;
    if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const p = projectionFor(rules, cssW, cssH);
    drawPitch(ctx, rules, p);
    drawGoal(ctx, rules, p, rules.pitch.y1);
    drawGoal(ctx, rules, p, rules.pitch.y2);

    const m = matchRef.current;
    const face = (id?: string) => (id ? faces.current.get(id) : undefined);

    // Them first, then you — so your own figures draw over theirs where they
    // overlap, and you can always see yourself.
    for (const d of sc.defenders) {
      drawFigure(ctx, p, d, {
        ...theirs, label: d.who?.shortName, face: face(d.who?.face),
      }, faceStyle.current, fakeFaceStyle.current);
    }
    drawFigure(ctx, p, { x: sc.keeper.x, y: sc.keeper.y }, {
      shirt: "#fbbf24", shorts: "#92400e", trim: "#92400e",
      label: sc.keeper.who?.shortName, face: face(sc.keeper.who?.face),
    }, faceStyle.current, fakeFaceStyle.current);

    drawFigure(ctx, p, m.world.yourKeeper, {
      shirt: "#34d399", shorts: "#065f46", trim: "#065f46",
    }, faceStyle.current, fakeFaceStyle.current);
    for (const r of sc.secondaryRunners) {
      drawFigure(ctx, p, r.pos, {
        ...mine, label: r.who?.shortName, face: face(r.who?.face),
      }, faceStyle.current, fakeFaceStyle.current);
    }
    drawFigure(ctx, p, { x: sc.follower.x, y: sc.follower.y }, {
      ...mine, label: sc.follower.who?.shortName, face: face(sc.follower.who?.face),
    }, faceStyle.current, fakeFaceStyle.current);
    drawFigure(ctx, p, sc.player, { ...mine, star: true }, faceStyle.current, fakeFaceStyle.current);

    const ball = ballRef.current;
    drawBall(ctx, p, ball ? ball.pos : sc.ball, ball ? ball.z : 0);

    if (phaseRef.current === "aim" && aimRef.current) {
      drawAim(ctx, p, sc.ball, aimRef.current.dir, aimRef.current.power);
    }
  };

  const m = matchRef.current;
  const shell = (
    <div className="relative w-full">
      {/* Scoreboard and clock */}
      <div className="mb-1 flex items-center justify-between rounded-lg bg-black/60 px-3 py-1.5 text-white">
        <span className="text-[11px] font-black uppercase tracking-widest">You</span>
        <span className="text-base font-black tabular-nums">{m.score[0]} – {m.score[1]}</span>
        <span className="text-[11px] font-black uppercase tracking-widest">Them</span>
        <span className="ml-3 text-[11px] font-bold tabular-nums text-white/70">
          {Math.floor(m.minute)}&apos;
        </span>
      </div>

      <div
        ref={wrapRef}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        className="relative aspect-[5/8] w-full touch-none overflow-hidden rounded-xl bg-black"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {phase === "opp" && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
            <span className="rounded-full bg-black/70 px-4 py-2 text-sm font-black text-white">
              They break…
            </span>
          </div>
        )}
        {phase === "aim" && !aimRef.current && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
            <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold text-white/85">
              Drag back from the ball to aim
            </span>
          </div>
        )}
      </div>

      {/* The last few things that happened. Short on purpose — three minutes
          a half is a caption, not a commentary feed. */}
      <div className="mt-1 min-h-[2.2rem] rounded-lg bg-black/40 px-3 py-1 text-[11px] font-bold text-white/85">
        {m.log.slice(-2).map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {phase === "contact" && (
        <ContactBall power={aimRef.current?.power ?? 0.5} onContact={strike} />
      )}
    </div>
  );

  if (embedded) return shell;
  return (
    <div className="mx-auto w-full max-w-md px-3 py-4">
      <h2 className="mb-2 text-center text-lg font-black uppercase tracking-widest text-white">
        Five-a-side
      </h2>
      {shell}
    </div>
  );
}
