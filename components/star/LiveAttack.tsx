"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  newLiveAttack, ballFlightAt, isReady, hasMissed, stepLiveAttack,
  fieldPositionsAt, strikeLiveAttack, powerFromPull,
  DELIVERY_KINDS, DELIVERY_LABEL, type DeliveryKind, type LiveAttackState,
} from "@/lib/star/liveAttack";
import {
  launch, stepBall, stepKeeper, stepReactions, OUTCOME_TEXT,
  type Ball, type Outcome, type KickSkills,
} from "@/lib/star/canvasEngine";
import {
  renderScenario, pitchFromPx, pxFromPitch, VIEW_ASPECT,
  type ScenarioRenderPlayer,
} from "@/lib/star/scenarioRender";
import { mulberry32 } from "@/lib/star/season";
import ContactBall from "./ContactBall";

/**
 * THE MOVING ATTACKING-SITUATION SANDBOX — THE COMPONENT.
 *
 * See lib/star/liveAttack.ts's own header for the full brief. Structural
 * template: FirstPersonDribble.tsx's canvas+rAF+pointer shape, but the
 * rendering and coordinate math come from scenarioRender.ts/ScenarioEditor.tsx
 * instead (renderScenario + pitchFromPx/pxFromPitch) — this is a top-down
 * scenario, not a first-person one, and reusing that gives it the exact
 * real-match look for free.
 *
 * Deliberately a plain top-down render, not a reskin of CanvasMatch.tsx's
 * full art (kits, keeper dive animation, spinning ball, camera shake) —
 * this is a mechanic prototype ("test it before making it in the real
 * game"), and rebuilding that whole rendering pipeline a second time here
 * would be real risk (or real duplication) for no gain until the buildup
 * timing and moving-aim feel are validated. The finish itself is not a
 * simplification: launch()/stepBall()/stepKeeper() are the exact same
 * real-match physics every other chance in the game resolves through.
 */

type Phase = "buildup" | "contact" | "flight" | "result";

const CANVAS_H = 900;
const CANVAS_W = Math.round(CANVAS_H * VIEW_ASPECT);
const DT_CAP = 0.05;
const FLIGHT_SUBSTEP = 1 / 120;
/** A genuine drag, not a thumb resting on the glass — in pitch metres, since
 *  this reads the gesture through pitchFromPx like every other pitch-space
 *  drag in the codebase (ScenarioEditor, the captain's order). */
const MIN_PULL_M = 0.6;

export interface LiveAttackProps {
  skills?: KickSkills;
  keeperStrength?: number;
  teamRelationship?: number;
  vision?: number;
  /** A fixed seed replays the exact same situation every attempt (tuning).
   *  Omit for a fresh random one each time. */
  seed?: number;
  /** Fixed delivery kind; omit to pick randomly each attempt. */
  kind?: DeliveryKind;
  onComplete?: (result: { outcome: Outcome | "missed" }) => void;
}

export default function LiveAttack({
  skills = { power: 55, technique: 55 },
  keeperStrength = 62,
  teamRelationship = 60,
  vision = 55,
  seed,
  kind,
  onComplete,
}: LiveAttackProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  const stateRef = useRef<LiveAttackState | null>(null);
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(() => Math.random());
  const contactAimRef = useRef<{ dir: { x: number; y: number }; power: number } | null>(null);

  const phaseRef = useRef<Phase>("buildup");
  const [phase, setPhaseState] = useState<Phase>("buildup");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const [deliveryKind, setDeliveryKind] = useState<DeliveryKind>(kind ?? "ground");
  const [resultText, setResultText] = useState("");

  const draggingRef = useRef(false);
  const dragFromRef = useRef<{ x: number; y: number } | null>(null);
  const dragToRef = useRef<{ x: number; y: number } | null>(null);

  const newRng = useCallback(() => (
    seed !== undefined ? mulberry32(seed) : mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)
  ), [seed]);

  const reset = useCallback(() => {
    const rng = newRng();
    rngRef.current = rng;
    const k = kind ?? DELIVERY_KINDS[Math.floor(rng() * DELIVERY_KINDS.length)];
    setDeliveryKind(k);
    stateRef.current = newLiveAttack(k, rng, keeperStrength, teamRelationship, vision);
    ballRef.current = null;
    contactAimRef.current = null;
    draggingRef.current = false;
    dragFromRef.current = null;
    dragToRef.current = null;
    setResultText("");
    setPhase("buildup");
  }, [newRng, kind, keeperStrength, teamRelationship, vision]);

  useEffect(() => { reset(); }, [reset]);

  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.png";
    ballImgRef.current = img;
  }, []);

  // ── Canvas sizing — same fixed real-match aspect ratio as the scenario
  // editor, scaled by devicePixelRatio for a crisp line. ──
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(CANVAS_W * dpr);
    c.height = Math.round(CANVAS_H * dpr);
  }, []);

  const facing = () => stateRef.current?.scenario.facing ?? "up";
  const vp = () => stateRef.current?.scenario.viewport ?? { x1: 0, x2: 68, y1: 0, y2: 105 };

  const canvasPointFromEvent = (e: { clientX: number; clientY: number }) => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { px: ((e.clientX - r.left) / r.width) * c.width, py: ((e.clientY - r.top) / r.height) * c.height };
  };
  const pitchFromEvent = (e: { clientX: number; clientY: number }) => {
    const c = canvasRef.current;
    const p = canvasPointFromEvent(e);
    if (!c || !p) return null;
    return pitchFromPx(p.px, p.py, c.width, c.height, vp(), facing());
  };

  // ── Pointer input — a drag is only accepted once the build-up says the
  // ball is genuinely reachable (isReady), same principle as every other
  // gesture in the game being gated by phase. ──
  const onPointerDown = (e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s || phaseRef.current !== "buildup" || !isReady(s)) return;
    const p = pitchFromEvent(e);
    if (!p) return;
    draggingRef.current = true;
    dragFromRef.current = p;
    dragToRef.current = p;
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const p = pitchFromEvent(e);
    if (p) dragToRef.current = p;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const s = stateRef.current;
    const from = dragFromRef.current, to = dragToRef.current;
    dragFromRef.current = null;
    dragToRef.current = null;
    if (!s || !from || !to || phaseRef.current !== "buildup") return;
    // The window can close mid-drag — a release after it has is a miss, the
    // same as never having dragged at all.
    if (!isReady(s)) return;
    const pull = Math.hypot(to.x - from.x, to.y - from.y);
    if (pull < MIN_PULL_M) return;
    const power = powerFromPull(pull, skills.power);
    // Locks the scenario's ball to exactly where it was at THIS instant —
    // see strikeLiveAttack's own note on why that's safe.
    const strikePoint = strikeLiveAttack(s, s.t);
    const dir = { x: strikePoint.x - to.x, y: strikePoint.y - to.y };
    contactAimRef.current = { dir, power };
    setPhase("contact");
  };

  const handleContact = (contact: { cx: number; cy: number }) => {
    const s = stateRef.current, aim = contactAimRef.current;
    if (!s || !aim) return;
    ballRef.current = launch(s.scenario, aim.dir, aim.power, contact, skills, rngRef.current);
    setPhase("flight");
  };

  // ── The loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    let last = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(DT_CAP, (now - last) / 1000);
      last = now;
      const s = stateRef.current;

      if (phaseRef.current === "buildup" && s) {
        stepLiveAttack(s, dt);
        if (hasMissed(s)) {
          setResultText("Gone — you never got there in time.");
          setPhase("result");
          onComplete?.({ outcome: "missed" });
        }
      } else if (phaseRef.current === "flight" && s && ballRef.current) {
        let remaining = dt;
        let outcome: Outcome | null = null;
        while (remaining > 1e-6 && !outcome) {
          const h = Math.min(FLIGHT_SUBSTEP, remaining);
          remaining -= h;
          stepKeeper(s.scenario, h);
          stepReactions(s.scenario, ballRef.current, h, rngRef.current);
          outcome = stepBall(ballRef.current, s.scenario, rngRef.current, h);
        }
        if (outcome) {
          setResultText(OUTCOME_TEXT[outcome].text);
          setPhase("result");
          onComplete?.({ outcome });
        }
      }
      draw();
    };

    const draw = () => {
      const c = canvasRef.current, s = stateRef.current;
      if (!c || !s) return;
      const sc = s.scenario;
      const ballPos = phaseRef.current === "buildup"
        ? ballFlightAt(s, s.t)
        : (ballRef.current?.pos ?? sc.ball);
      const positions = fieldPositionsAt(s);
      const players: ScenarioRenderPlayer[] = [
        { x: sc.player.x, y: sc.player.y, side: "you" },
        ...positions.runners.map(p => ({ x: p.x, y: p.y, side: "teammate" as const })),
        ...sc.teammates.map(p => ({ x: p.x, y: p.y, side: "teammate" as const })),
        ...positions.defenders.map(p => ({ x: p.x, y: p.y, side: "opponent" as const })),
        { x: sc.keeper.x, y: sc.keeper.y, side: "opponent" as const },
      ];
      renderScenario(c, {
        viewport: sc.viewport,
        facing: sc.facing ?? "up",
        players,
        ball: ballPos,
        ballImage: ballImgRef.current,
      });

      if (phaseRef.current === "buildup" && draggingRef.current && dragFromRef.current && dragToRef.current) {
        const ctx = c.getContext("2d");
        if (ctx) {
          const a = pxFromPitch(dragToRef.current.x, dragToRef.current.y, c.width, c.height, sc.viewport, sc.facing ?? "up");
          const b = pxFromPitch(ballPos.x, ballPos.y, c.width, c.height, sc.viewport, sc.facing ?? "up");
          ctx.save();
          ctx.strokeStyle = "rgba(250,204,21,0.9)";
          ctx.lineWidth = Math.max(2, c.width * 0.012);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(a.px, a.py);
          ctx.lineTo(b.px, b.py);
          ctx.stroke();
          ctx.restore();
        }
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skills.power, skills.technique, onComplete]);

  const ready = phase === "buildup" && !!stateRef.current && isReady(stateRef.current);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[10px] font-black tracking-widest uppercase">
            Live Attacking Situation
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight">{DELIVERY_LABEL[deliveryKind]}</h1>
        </div>

        <div
          className="relative w-full overflow-hidden rounded-xl border border-white/15 touch-none select-none"
          style={{ aspectRatio: "5 / 8" }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          {phase === "buildup" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex flex-col items-center gap-1 px-4">
              <p className={`rounded-lg px-3 py-1 text-center text-[10px] font-bold transition-colors ${
                ready ? "bg-emerald-500/85 text-emerald-950" : "bg-black/55 text-white/70"
              }`}>
                {ready ? "Drag from the ball to aim and strike it" : "Wait for it…"}
              </p>
            </div>
          )}

          {phase === "contact" && contactAimRef.current && (
            <ContactBall power={contactAimRef.current.power} onContact={handleContact} />
          )}

          {phase === "result" && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/60">
              <div className="text-center px-4">
                <div className="text-2xl font-black text-amber-300">{resultText}</div>
                <button
                  onClick={reset}
                  className="mt-4 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-black text-emerald-950 active:scale-95"
                >
                  Go Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
