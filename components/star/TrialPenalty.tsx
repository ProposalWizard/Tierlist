"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepBallInNet,
  clamp, type Ball, type Outcome, type Scenario,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import {
  CX, POST_L, POST_R, NET_DEPTH, PEN_SPOT_Y, SIX_L, SIX_R, SIX_DEPTH,
  BOX_L, BOX_R, BOX_DEPTH, BALL_R,
} from "@/lib/star/pitch";
import ContactBall from "./ContactBall";

/**
 * THE TRIAL.
 *
 * The first thing a career does, before it has a dashboard or a fixture list:
 * one penalty, taken again and again until it goes in. You cannot fail it —
 * you can only not have passed it yet — which is the point. It is a scene
 * rather than a test.
 *
 * ── Why this is not CanvasMatch ──
 *
 * CanvasMatch runs ninety minutes: a hidden match either side of every chance,
 * commentary, a scoreline, substitutions, a post-match summary. None of that
 * exists here and all of it would have to be suppressed. What IS shared is the
 * part that matters — the physics. The scenario, the strike and the keeper all
 * come from the same engine the real game uses (`buildScenario("penalty")`,
 * `launch`, `stepBall`, `stepKeeper`), so this penalty behaves exactly like a
 * penalty in a match. Only the picture is its own, and a penalty's picture is
 * a goal, a keeper and a ball.
 */

type Phase = "aim" | "contact" | "flight" | "missed";

/** The slice of pitch this scene shows: the box, and a little air around it. */
const VIEW = { x1: BOX_L - 2, x2: BOX_R + 2, y1: -NET_DEPTH - 1.5, y2: PEN_SPOT_Y + 5 };
/** Same dead-zone rule the real game uses — a press that slips is not a shot. */
const MIN_PULL = 0.04;
/** How far you must pull for full power, as a fraction of the canvas height. */
const FULL_POWER_PULL = 0.16;

export default function TrialPenalty({ onScored }: { onScored: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scRef = useRef<Scenario | null>(null);
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(mulberry32(Date.now() & 0xffff));
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const phaseRef = useRef<Phase>("aim");
  const rafRef = useRef<number | null>(null);
  const outcomeRef = useRef<Outcome | null>(null);
  const doneRef = useRef(false);
  /**
   * Has this attempt already been acted on?
   *
   * Without it the block below re-fires on EVERY frame once the settle timer
   * passes — a single miss would count a dozen attempts and schedule a dozen
   * resets. Cleared by `reset`, so the next penalty can resolve normally.
   */
  const resolvedRef = useRef(false);
  /** The real ball photo (public/star/ball.png) — see CanvasMatch.tsx. */
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.png";
    ballImgRef.current = img;
  }, []);

  const [phase, setPhaseState] = useState<Phase>("aim");
  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [missText, setMissText] = useState("");

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  /** A fresh penalty. Called at the start and after every one that stays out. */
  const reset = useCallback(() => {
    const rng = rngRef.current;
    // Keeper strength kept modest: this is a trial, and it has to end.
    const sc = buildScenario("penalty", rng, 52, 60, 55);
    // The engine expects a scenario to have been initialised before it is
    // stepped — cheaper to call it than to depend on that staying true.
    initDefenders(sc, rng);
    scRef.current = sc;
    ballRef.current = null;
    outcomeRef.current = null;
    resolvedRef.current = false;
    dragRef.current = null;
    draggingRef.current = false;
    setAim(null);
    setPhase("aim");
  }, []);

  useEffect(() => { reset(); }, [reset]);

  // ── Pointer → pitch ────────────────────────────────────────────────────────
  const pitchFromPointer = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return { x: CX, y: PEN_SPOT_Y };
    const r = c.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    return {
      x: VIEW.x1 + fx * (VIEW.x2 - VIEW.x1),
      y: VIEW.y1 + fy * (VIEW.y2 - VIEW.y1),
    };
  };

  /** Pull length as a fraction of the canvas height, so power reads the same
   *  however the scene is scaled. */
  const screenPull = (drag: { x: number; y: number }, ball: { x: number; y: number }) => {
    const H = VIEW.y2 - VIEW.y1, W = VIEW.x2 - VIEW.x1;
    const aspect = W / H;
    return Math.hypot(((drag.x - ball.x) / W) * aspect, (drag.y - ball.y) / H);
  };
  const powerFrom = (drag: { x: number; y: number }, ball: { x: number; y: number }) =>
    clamp(screenPull(drag, ball) / FULL_POWER_PULL, 0, 1);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim") return;
    draggingRef.current = true;
    dragRef.current = pitchFromPointer(e);
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    dragRef.current = pitchFromPointer(e);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    const sc = scRef.current;
    dragRef.current = null;
    if (!d || !sc) return;
    if (screenPull(d, sc.ball) < MIN_PULL) return;
    const power = powerFrom(d, sc.ball);
    if (power < 0.05) return;
    setAim({ dir: { x: sc.ball.x - d.x, y: sc.ball.y - d.y }, power });
    setPhase("contact");
  };

  /** Where on the ball — hands straight to the same `launch` a match uses. */
  const handleContact = (contact: { cx: number; cy: number }) => {
    const sc = scRef.current;
    if (!sc || !aim) return;
    ballRef.current = launch(sc, aim.dir, aim.power, contact, { power: 62, technique: 62 }, rngRef.current);
    setAim(null);
    setPhase("flight");
  };

  // ── The loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let last = performance.now();
    let settle = 0;

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sc = scRef.current;
      if (!sc) return;

      if (phaseRef.current === "flight" && ballRef.current) {
        const ball = ballRef.current;
        if (ball.inNet) {
          stepBallInNet(ball, dt);
        } else if (!outcomeRef.current) {
          stepKeeper(sc, dt);
          const res = stepBall(ball, sc, rngRef.current, dt);
          if (res) {
            outcomeRef.current = res;
            settle = 0;
          }
        }
        if (outcomeRef.current) {
          settle += dt;
          // A beat to watch it, then either on with the story or go again.
          if (settle > 1.1 && !resolvedRef.current && !doneRef.current) {
            resolvedRef.current = true;
            const res = outcomeRef.current;
            // Reported directly: "it can't rebound off of the keeper or the
            // post, and then one of your teammates score — you have to be
            // the one to score." A save or a post that comes back out is
            // exactly what the two D-side team-mates are there for in a real
            // match (see buildPenalty) — but here that would let the trial
            // end on a goal you didn't score. `receiverShot` is only ever
            // set when the ball reaches a team-mate and HE strikes it
            // (launchReceiverShot), never for your own original hit, so it
            // is the one reliable signal for "somebody else put this away" —
            // a clean team-mate finish reports as "goal" the same as yours
            // would, so the outcome tag alone can't tell them apart.
            const yours = !sc.receiverShot;
            if ((res === "goal" || res === "rebound") && yours) {
              doneRef.current = true;
              onScored();
            } else {
              setAttempts(a => a + 1);
              const teammateScored = (res === "goal" || res === "rebound") && !yours;
              setMissText(teammateScored ? "A team-mate gets there first — it has to be you." : (MISS_LINE[res] ?? "Again."));
              setPhase("missed");
              window.setTimeout(() => { setMissText(""); reset(); }, 1100);
            }
          }
        }
      }

      draw();
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScored, reset]);

  // ── The picture ────────────────────────────────────────────────────────────
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
    const W = cssW, H = cssH;

    const sx = W / (VIEW.x2 - VIEW.x1), sy = H / (VIEW.y2 - VIEW.y1);
    const px = (x: number) => (x - VIEW.x1) * sx;
    const py = (y: number) => (y - VIEW.y1) * sy;
    const unit = Math.min(sx, sy);

    // Grass, with mown bands so the depth reads.
    ctx.fillStyle = "#1f7a3a";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) continue;
      ctx.fillStyle = "rgba(255,255,255,0.028)";
      ctx.fillRect(0, (H / 10) * i, W, H / 10);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1.5, unit * 0.09);

    // Goal line, six-yard box, penalty area.
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath(); ctx.moveTo(px(x1), py(y1)); ctx.lineTo(px(x2), py(y2)); ctx.stroke();
    };
    line(VIEW.x1, 0, VIEW.x2, 0);
    ctx.strokeRect(px(SIX_L), py(0), (SIX_R - SIX_L) * sx, SIX_DEPTH * sy);
    ctx.strokeRect(px(BOX_L), py(0), (BOX_R - BOX_L) * sx, BOX_DEPTH * sy);

    // The D.
    ctx.beginPath();
    ctx.arc(px(CX), py(PEN_SPOT_Y), 9.15 * unit, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();

    // Penalty spot.
    ctx.beginPath();
    ctx.arc(px(CX), py(PEN_SPOT_Y), Math.max(2, unit * 0.16), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fill();

    // ── The goal, drawn as a frame with a net behind it ──
    const gL = px(POST_L), gR = px(POST_R), gY = py(0), gBack = py(-NET_DEPTH);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(gL, gBack, gR - gL, gY - gBack);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) {
      const x = gL + ((gR - gL) / 12) * i;
      ctx.beginPath(); ctx.moveTo(x, gBack); ctx.lineTo(x, gY); ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const y = gBack + ((gY - gBack) / 4) * i;
      ctx.beginPath(); ctx.moveTo(gL, y); ctx.lineTo(gR, y); ctx.stroke();
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2.5, unit * 0.16);
    ctx.beginPath();
    ctx.moveTo(gL, gY); ctx.lineTo(gL, gBack); ctx.lineTo(gR, gBack); ctx.lineTo(gR, gY);
    ctx.stroke();

    // ── The keeper ──
    const k = sc.keeper;
    const kx = px(k.x), ky = py(k.y);
    const kr = unit * 0.62;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(kx, ky + kr * 0.2, kr * 1.1, kr * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.roundRect?.(kx - kr * 0.8, ky - kr * 1.5, kr * 1.6, kr * 1.4, kr * 0.3);
    if (!ctx.roundRect) ctx.rect(kx - kr * 0.8, ky - kr * 1.5, kr * 1.6, kr * 1.4);
    ctx.fill();
    // Arms out, wider the further he has dived.
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = Math.max(2, kr * 0.34);
    ctx.lineCap = "round";
    const reach = kr * (1.1 + Math.abs(k.dive ?? 0) * 0.9);
    ctx.beginPath();
    ctx.moveTo(kx - kr * 0.7, ky - kr * 1.1); ctx.lineTo(kx - reach, ky - kr * 1.5);
    ctx.moveTo(kx + kr * 0.7, ky - kr * 1.1); ctx.lineTo(kx + reach, ky - kr * 1.5);
    ctx.stroke();
    ctx.fillStyle = "#f2c9a0";
    ctx.beginPath(); ctx.arc(kx, ky - kr * 1.75, kr * 0.32, 0, Math.PI * 2); ctx.fill();

    // ── The ball ──
    const b = ballRef.current;
    const bx = b ? px(b.pos.x) : px(sc.ball.x);
    const by = b ? py(b.pos.y) : py(sc.ball.y);
    const lift = b ? Math.max(0, b.z) : 0;
    // Height reads as size plus a shadow that stays on the grass.
    const br = Math.max(3, unit * (BALL_R * 2.6) * (1 + lift * 0.16));
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(bx, by, br * 0.95, br * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    const drawnY = by - lift * sy * 0.55;
    const ballImg = ballImgRef.current;
    if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
      ctx.drawImage(ballImg, bx - br, drawnY - br, br * 2, br * 2);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(bx, drawnY, br, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = Math.max(1, br * 0.16);
      ctx.stroke();
    }

    // ── The aim arrow ──
    if (phaseRef.current === "aim" && draggingRef.current && dragRef.current) {
      const d = dragRef.current;
      const power = powerFrom(d, sc.ball);
      const dx = sc.ball.x - d.x, dy = sc.ball.y - d.y;
      const len = Math.hypot(dx, dy) || 1;
      const shown = power * (VIEW.y2 - VIEW.y1) * 0.30;
      const ex = px(sc.ball.x + (dx / len) * shown);
      const ey = py(sc.ball.y + (dy / len) * shown);
      const ang = Math.atan2(ey - py(sc.ball.y), ex - px(sc.ball.x));
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const nx = -uy, ny = ux;
      const total = Math.hypot(ex - px(sc.ball.x), ey - py(sc.ball.y)) || 1;
      const headLen = clamp(W * 0.045, W * 0.02, total * 0.45);
      const headHalf = W * 0.022;
      const hbx = ex - ux * headLen, hby = ey - uy * headLen;

      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = W * 0.014;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px(sc.ball.x), py(sc.ball.y)); ctx.lineTo(hbx, hby); ctx.stroke();
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(hbx + nx * headHalf, hby + ny * headHalf);
      ctx.lineTo(hbx - nx * headHalf, hby - ny * headHalf);
      ctx.closePath();
      ctx.fillStyle = "#f97316";
      ctx.fill();

      // Power, as a number by the ball.
      ctx.fillStyle = "#fde68a";
      ctx.font = `bold ${Math.round(W * 0.05)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(power * 100)}%`, px(sc.ball.x), py(sc.ball.y) + W * 0.10);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-black tracking-widest uppercase">
            The Trial
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight">Score to earn your contract</h1>
          <p className="mt-1 text-xs text-white/60">
            Drag back from the ball to aim and set power, then pick your spot on the ball.
          </p>
        </div>

        <div
          ref={wrapRef}
          className="relative w-full overflow-hidden rounded-xl border border-white/15"
          style={{ aspectRatio: "3 / 4" }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          {phase === "contact" && aim && (
            <ContactBall power={aim.power} onContact={handleContact} />
          )}

          {phase === "missed" && missText && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/55">
              <div className="text-center">
                <div className="text-2xl font-black text-amber-300">{missText}</div>
                <div className="mt-1 text-sm font-bold text-white/75">Go again.</div>
              </div>
            </div>
          )}
        </div>

        {attempts > 0 && (
          <div className="mt-3 text-center text-[11px] font-bold text-white/45">
            {attempts} {attempts === 1 ? "attempt" : "attempts"} — take as many as you need.
          </div>
        )}
      </div>
    </div>
  );
}

/** What to say when it stays out. Never a failure — only a "not yet". */
const MISS_LINE: Partial<Record<Outcome, string>> = {
  saved: "Saved!",
  tipped: "Tipped away!",
  caught: "Caught!",
  wide: "Wide!",
  over: "Over the bar!",
  post: "Off the post!",
  short: "Not enough on it.",
  blocked: "Blocked!",
  tackled: "Blocked!",
  offside: "Retake.",
};
