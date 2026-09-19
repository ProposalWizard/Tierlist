"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepBallInNet,
  settleBall, stepBallPastBar, clamp,
  type Ball, type Outcome, type Scenario,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { GOAL_H, NET_DEPTH, BOX_DEPTH, PEN_SPOT_Y, BALL_R } from "@/lib/star/pitch";

/**
 * BICYCLE KICK TRIAL — a completely standalone, throwaway physics/animation
 * sandbox. Not part of any real career, not linked from anywhere in the real
 * game's navigation — reachable only by typing /star-bicycle-dev directly,
 * the exact same spirit as /star-match-dev (a full fork of the match engine
 * for trying gameplay physics without touching real careers).
 *
 * ── What's reused vs. what's new ──
 *
 * The RESOLUTION is the real thing, not a fake system: `buildScenario`,
 * `launch`, `stepKeeper`, `stepBall`, `settleBall`, `stepBallPastBar` are the
 * exact same exported functions TrialPenalty.tsx already reuses for the
 * game's opening penalty — this file follows that same precedent rather than
 * inventing a second physics engine. A charge is converted into the same
 * `power` (0-1) fraction `launch()` already turns into real velocity/spin —
 * only HOW that fraction is produced (a hold duration here, a drag distance
 * in the real game) is new, because there's no sensible "pull back from the
 * ball" gesture for a player who is already upside down in the air.
 *
 * The SCENE is new: a side-on elevation (distance-to-goal across the screen,
 * height up the screen) rather than the game's usual behind-the-ball camera,
 * because that's the only view that actually reads as "a bicycle kick" — see
 * the honesty note at the bottom of this file for what a side-on camera
 * necessarily can't show.
 */

type Phase = "ready" | "charging" | "flight" | "result";

// Where the kick is taken from — "around the edge of the penalty box", per
// the brief. BOX_DEPTH is 16.5m; a couple of metres inside that.
const KICK_Y = BOX_DEPTH - 2;

// How long a full charge takes. Capped, per the brief ("within a sensible
// cap") — holding forever should not buy more power than this.
const CHARGE_CAP_MS = 850;
// A tap this short never counts as a real charge at all — same idea as the
// real game's MIN_PULL floor (a gesture has to have been a gesture).
const MIN_CHARGE_MS = 60;
// How far a horizontal drag during the charge can lean the strike, in
// degrees either side of dead-ahead. See "Direction control" below.
const MAX_LEAN_DEG = 22;
const LEAN_PX_FOR_MAX = 90;

const MISS_LINE: Partial<Record<Outcome, string>> = {
  saved: "Saved!", tipped: "Tipped away!", caught: "Caught!",
  wide: "Wide!", over: "Over the bar!", post: "Off the post!",
  short: "Didn't have the legs.", blocked: "Blocked!", tackled: "Blocked!",
  offside: "Offside.",
};

export default function BicycleKickTrial() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scRef = useRef<Scenario | null>(null);
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(mulberry32(Date.now() & 0xffff));
  const phaseRef = useRef<Phase>("ready");
  const rafRef = useRef<number | null>(null);
  const outcomeRef = useRef<Outcome | null>(null);
  const resolvedRef = useRef(false);
  const ballImgRef = useRef<HTMLImageElement | null>(null);

  // ── Charge state ──
  const chargeStartRef = useRef<number | null>(null);
  const pointerStartXRef = useRef(0);
  const leanRef = useRef(0); // -1..1, current lean while charging
  const [chargePct, setChargePct] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("ready");
  const [attempts, setAttempts] = useState(0);
  const [resultText, setResultText] = useState("");

  // Adjustable sliders — this is an iteration sandbox, not a fixed demo.
  const [power, setPower] = useState(72);
  const [technique, setTechnique] = useState(68);
  const [keeperStrength, setKeeperStrength] = useState(58);

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.png";
    ballImgRef.current = img;
  }, []);

  const reset = useCallback(() => {
    const rng = rngRef.current;
    const sc = buildScenario("penalty", rng, clamp(keeperStrength, 0, 100), 60, 55);
    initDefenders(sc, rng);
    // Move the spot back to the edge of the box — a bicycle kick is not
    // struck from twelve yards. Keeper/goal geometry from buildScenario is
    // otherwise left exactly as it built it.
    sc.ball = { x: sc.ball.x, y: KICK_Y };
    scRef.current = sc;
    ballRef.current = null;
    outcomeRef.current = null;
    resolvedRef.current = false;
    chargeStartRef.current = null;
    leanRef.current = 0;
    setChargePct(0);
    setPhase("ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keeperStrength]);

  useEffect(() => { reset(); }, [reset]);

  // ── Direction control: choice (b), a small left/right lean during the
  // charge ──
  //
  // A full free-aim drag (the real game's normal aim gesture) doesn't make
  // physical sense here: the player is inverted and mid-air, and "pull back
  // from the ball" has no natural equivalent when the ball is up by your own
  // raised feet, not sitting on the ground in front of you. A fixed "always
  // dead centre" strike was the other extreme, but it made the hold-and-
  // release gesture do nothing but a timer, which felt inert once actually
  // tried. Splitting the difference: holding still charges power on a
  // straight-ahead strike, but a small horizontal drag during the same hold
  // leans the strike left or right, capped at a modest angle a real
  // overhead strike could plausibly still reach. One continuous press-down/
  // drag/press-up gesture, not a second interaction layered on top.
  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "ready") return;
    chargeStartRef.current = performance.now();
    pointerStartXRef.current = e.clientX;
    leanRef.current = 0;
    setPhase("charging");
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current !== "charging") return;
    const dx = e.clientX - pointerStartXRef.current;
    leanRef.current = clamp(dx / LEAN_PX_FOR_MAX, -1, 1);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (phaseRef.current !== "charging") return;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const start = chargeStartRef.current;
    chargeStartRef.current = null;
    const held = start ? performance.now() - start : 0;
    if (held < MIN_CHARGE_MS) { setPhase("ready"); return; }
    strike(clamp(held / CHARGE_CAP_MS, 0, 1), leanRef.current);
  };

  /**
   * ── Charge-to-power mapping ──
   *
   * `pct` (0-1, from held-ms / CHARGE_CAP_MS) is fed straight in as the same
   * `power` argument the real game's drag-distance-derived power already is
   * — launch() itself is untouched, so the velocity/height/spin curve a
   * bicycle kick produces at a given power is byte-identical to what a
   * normal shot at that power produces. Only the SOURCE of the 0-1 fraction
   * differs (hold time vs. pull distance); the power→physics mapping this
   * game already establishes is reused exactly, not reinvented.
   */
  const strike = (pct: number, lean: number) => {
    const sc = scRef.current;
    if (!sc) return;
    const angle = lean * MAX_LEAN_DEG * (Math.PI / 180);
    // Dead-ahead is "toward the goal", i.e. decreasing y. Leaning rotates
    // that a little either way in x.
    const dir = { x: Math.sin(angle), y: -Math.cos(angle) };
    // Struck low and slightly to the side the strike leans — a real
    // overhead volley is hit underneath to get it up and over, so contact
    // stays anchored near the bottom of the ball (cy close to 1) with only
    // a small cx nudge tied to the same lean the direction itself used.
    const contact = { cx: clamp(lean * 0.35, -1, 1), cy: 0.88 };
    ballRef.current = launch(sc, dir, Math.max(0.12, pct), contact, { power, technique }, rngRef.current);
    setChargePct(0);
    setPhase("flight");
  };

  // ── The loop — identical shape to TrialPenalty's own, same reason: real
  // physics need real substeps, not one coarse step per frame. ──
  useEffect(() => {
    let last = performance.now();
    let settle = 0;

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sc = scRef.current;

      if (phaseRef.current === "charging" && chargeStartRef.current) {
        setChargePct(clamp((now - chargeStartRef.current) / CHARGE_CAP_MS, 0, 1));
      }

      if (sc && phaseRef.current === "flight" && ballRef.current) {
        const ball = ballRef.current;
        if (ball.inNet) {
          stepBallInNet(ball, dt);
        } else if (!outcomeRef.current) {
          const steps = 3;
          for (let i = 0; i < steps; i++) {
            const h = dt / steps;
            stepKeeper(sc, h);
            const res = stepBall(ball, sc, rngRef.current, h);
            if (res) {
              outcomeRef.current = res;
              settle = 0;
              if (!ball.overBar) ball.settling = true;
              break;
            }
          }
        } else {
          if (ball.settling) settleBall(ball, dt, sc);
          if (ball.overBar) stepBallPastBar(ball, dt);
        }
        if (outcomeRef.current) {
          settle += dt;
          if (settle > 1.1 && !resolvedRef.current) {
            resolvedRef.current = true;
            const res = outcomeRef.current;
            const scored = res === "goal" || res === "rebound";
            setAttempts(a => a + 1);
            setResultText(scored ? "GOAL!" : (MISS_LINE[res] ?? "Not this time."));
            setPhase("result");
            window.setTimeout(() => { setResultText(""); reset(); }, 1400);
          }
        }
      }

      draw();
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);

  // ── The picture — a side elevation ──
  //
  // Screen X = distance from the goal line (behind the player on the left,
  // through the goal on the right). Screen Y = height above the turf
  // (ball.z / the player's own jump height), NOT the pitch's lateral (x)
  // axis. See the honesty note at the very bottom of this file for exactly
  // what that means the camera can't show.
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

    // Camera window: from a couple of metres behind the kick spot, to just
    // past the back of the net.
    const Y_FAR = KICK_Y + 4;      // behind the player, left edge
    const Y_NEAR = -NET_DEPTH - 1; // back of the net, right edge
    const groundY = H * 0.82;
    const pxScale = W / (Y_FAR - Y_NEAR);
    const heightScale = pxScale; // metric, so height reads at the same scale as distance
    const sx = (y: number) => W - (y - Y_NEAR) * pxScale;
    const sy = (z: number) => groundY - z * heightScale;

    // Sky + pitch.
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, "#0b2447");
    skyGrad.addColorStop(1, "#1d4e6b");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, groundY);
    ctx.fillStyle = "#1f9006";
    ctx.fillRect(0, groundY, W, H - groundY);
    // Faint turf stripes, purely decorative.
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i < 10; i++) {
      const x0 = (i / 10) * W;
      if (i % 2 === 0) ctx.fillRect(x0, groundY, W / 10, H - groundY);
    }
    // Goal-line marking.
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = Math.max(1.5, heightScale * 0.03);
    ctx.beginPath(); ctx.moveTo(sx(0), groundY); ctx.lineTo(sx(0), H); ctx.stroke();
    // Penalty spot + box edge, for scale.
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.arc(sx(PEN_SPOT_Y), groundY, Math.max(1.5, heightScale * 0.05), 0, Math.PI * 2); ctx.fill();

    // ── Goal, in profile: near post + bar + a simple net wedge behind it.
    // Post-to-post width isn't a thing a side view can show — see the
    // honesty note — so this is deliberately a generic side-on goal
    // silhouette, not a literal projection of POST_L/POST_R. ──
    {
      const gx = sx(0), gTop = sy(GOAL_H), gBase = groundY;
      const backX = sx(-NET_DEPTH);
      ctx.fillStyle = "rgba(10,20,14,0.55)";
      ctx.beginPath();
      ctx.moveTo(gx, gBase); ctx.lineTo(gx, gTop); ctx.lineTo(backX, gTop); ctx.lineTo(backX, gBase);
      ctx.closePath(); ctx.fill();
      // Net mesh.
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      const cols = 8;
      for (let i = 0; i <= cols; i++) {
        const f = i / cols;
        ctx.beginPath();
        ctx.moveTo(gx + (backX - gx) * f, gTop);
        ctx.lineTo(gx + (backX - gx) * f, gBase);
        ctx.stroke();
      }
      const rows = 5;
      for (let j = 0; j <= rows; j++) {
        const f = j / rows;
        ctx.beginPath();
        ctx.moveTo(gx, gTop + (gBase - gTop) * f);
        ctx.lineTo(backX, gTop + (gBase - gTop) * f);
        ctx.stroke();
      }
      // Post + crossbar.
      ctx.strokeStyle = "#f6faf7";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2.5, heightScale * 0.05);
      ctx.beginPath(); ctx.moveTo(gx, gBase); ctx.lineTo(gx, gTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(backX, gBase); ctx.lineTo(backX, gTop); ctx.stroke();
      ctx.lineWidth = Math.max(2.5, heightScale * 0.06);
      ctx.beginPath(); ctx.moveTo(gx - heightScale * 0.05, gTop); ctx.lineTo(backX, gTop); ctx.stroke();
      ctx.lineCap = "butt";
    }

    // ── The keeper, a simple standing/reacting figure on the line ──
    //
    // A side elevation can't show a genuine left/right dive (that motion is
    // along the axis pointing INTO the screen from here) — so he's drawn
    // reacting with a plausible crouch/lean-forward + arm reach that reads
    // as "going for it" without pretending to show which corner. See the
    // honesty note.
    {
      const kk = sc.keeper;
      const reaching = clamp(Math.abs(kk.dive) / 1.6, 0, 1) + (kk.saveLunge ?? 0);
      const kx = sx(0) - heightScale * 0.12;
      const groundBase = groundY;
      const KR = heightScale * 0.9;
      drawSimpleFigure(ctx, kx, groundBase, KR, {
        crouch: 0.15 + reaching * 0.35,
        armReach: reaching,
        shirt: "#fbbf24", rim: "#92400e", shorts: "#92400e",
      });
    }

    // ── The ball ──
    const b = ballRef.current;
    const ballY = b ? b.pos.y : sc.ball.y;
    const ballZ = b ? Math.max(0, b.z) : 1.15 + Math.sin(chargeIdleT()) * 0.05;
    const bx = sx(ballY);
    const by = sy(ballZ);
    const brad = Math.max(4, heightScale * BALL_R * 1.9);
    const ballImg = ballImgRef.current;
    ctx.beginPath();
    ctx.ellipse(bx, sy(0), brad * 1.1, brad * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
      ctx.drawImage(ballImg, bx - brad, by - brad, brad * 2, brad * 2);
    } else {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(bx, by, brad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.stroke();
    }

    // ── The player, inverted mid-bicycle-kick ──
    if (phaseRef.current !== "flight" && phaseRef.current !== "result") {
      const px2 = sx(KICK_Y);
      const jumpZ = 1.15; // hip height at the apex of the jump — a real overhead-kick height
      const py2 = sy(jumpZ);
      const chargeT = phaseRef.current === "charging" ? chargePct : 0;
      drawBicycleFigure(ctx, px2, py2, heightScale, chargeT, leanRef.current);
    } else if (b) {
      // Follow-through: keep drawing him mid-fall for a beat after the
      // strike, roughly where he was, rather than popping out of frame the
      // instant the ball leaves his boot.
      const px2 = sx(KICK_Y);
      const fallT = clamp(settleSince() / 0.6, 0, 1);
      const py2 = sy(1.15 - fallT * 1.05);
      drawBicycleFigure(ctx, px2, py2, heightScale, 1, leanRef.current, fallT);
    }

    // ── Charge meter ──
    if (phaseRef.current === "charging") {
      const meterX = W * 0.06, meterTop = H * 0.12, meterH = H * 0.5, meterW = W * 0.05;
      ctx.fillStyle = "rgba(2,6,23,0.55)";
      ctx.fillRect(meterX, meterTop, meterW, meterH);
      const fillH = meterH * chargePct;
      const grad = ctx.createLinearGradient(0, meterTop + meterH, 0, meterTop);
      grad.addColorStop(0, "#22c55e"); grad.addColorStop(0.6, "#eab308"); grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = grad;
      ctx.fillRect(meterX, meterTop + meterH - fillH, meterW, fillH);
      ctx.strokeStyle = "rgba(251,191,36,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(meterX, meterTop, meterW, meterH);
      ctx.fillStyle = "#fde68a";
      ctx.font = `bold ${Math.round(W * 0.045)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(chargePct * 100)}%`, meterX + meterW / 2, meterTop - W * 0.02);
    }

    if (phaseRef.current === "result" && resultText) {
      ctx.fillStyle = resultText === "GOAL!" ? "#4ade80" : "#f87171";
      ctx.font = `900 ${Math.round(W * 0.09)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 4;
      ctx.strokeText(resultText, W / 2, H * 0.3);
      ctx.fillText(resultText, W / 2, H * 0.3);
    }
  };

  // Small helpers kept local since they only serve `draw`.
  const idleClockRef = useRef(performance.now());
  const chargeIdleT = () => (performance.now() - idleClockRef.current) / 250;
  const resultStartRef = useRef(0);
  useEffect(() => {
    if (phase === "flight") resultStartRef.current = performance.now();
  }, [phase]);
  const settleSince = () => (performance.now() - resultStartRef.current) / 1000;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-fuchsia-300 text-[10px] font-black tracking-widest uppercase">
            Sandbox — not part of any real career
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight">Bicycle Kick Trial</h1>
          <p className="mt-1 text-xs text-white/60">
            Hold to charge the strike, drag left/right while holding to lean it, release to strike.
          </p>
        </div>

        <div
          ref={wrapRef}
          className="relative w-full overflow-hidden rounded-xl border border-white/15"
          style={{ aspectRatio: "4 / 3" }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {phase === "ready" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
              <p className="rounded-lg bg-black/55 px-3 py-1.5 text-center text-[11px] font-bold text-white/85">
                Press and hold on the pitch to wind up the overhead kick.
              </p>
            </div>
          )}
        </div>

        {attempts > 0 && (
          <div className="mt-3 text-center text-[11px] font-bold text-white/45">
            {attempts} {attempts === 1 ? "attempt" : "attempts"} this session.
          </div>
        )}

        <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/50">Sandbox dials</div>
          {[
            { label: "Power", val: power, set: setPower },
            { label: "Technique", val: technique, set: setTechnique },
            { label: "Keeper Strength", val: keeperStrength, set: setKeeperStrength },
          ].map(row => (
            <div key={row.label}>
              <div className="flex justify-between text-[11px] font-bold text-white/70">
                <span>{row.label}</span><span>{row.val}</span>
              </div>
              <input
                type="range" min={0} max={100} value={row.val}
                onChange={e => row.set(Number(e.target.value))}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A flat, simple stick-and-blocks figure, matching this game's own house
 * style (CanvasMatch.tsx's footballer(), GardenScreen.tsx's Figure/BenchBody
 * — plain shapes, no photorealism). `groundY` is where his feet would be if
 * he were standing; he's drawn crouched/reaching from there, never inverted
 * — this is the keeper, not the trialist.
 */
function drawSimpleFigure(
  ctx: CanvasRenderingContext2D, x: number, groundY: number, r: number,
  opts: { crouch: number; armReach: number; shirt: string; rim: string; shorts: string },
) {
  const SKIN = "#c68642";
  const bodyY = groundY - r * (0.9 - opts.crouch * 0.25);
  ctx.save();
  ctx.translate(x, bodyY);
  ctx.lineCap = "round";
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  // Legs.
  ctx.beginPath();
  ctx.moveTo(-r * 0.14, r * 0.1); ctx.lineTo(-r * 0.18, r * 0.1 + r * (0.7 - opts.crouch * 0.3));
  ctx.moveTo(r * 0.14, r * 0.1); ctx.lineTo(r * 0.18, r * 0.1 + r * (0.7 - opts.crouch * 0.3));
  ctx.stroke();
  // Shorts + shirt.
  ctx.fillStyle = opts.shorts;
  ctx.beginPath(); ctx.roundRect?.(-r * 0.24, r * 0.02, r * 0.48, r * 0.24, r * 0.08);
  ctx.fill();
  ctx.fillStyle = opts.shirt;
  ctx.beginPath(); ctx.roundRect?.(-r * 0.28, -r * 0.42, r * 0.56, r * 0.46, r * 0.12);
  ctx.fill();
  ctx.strokeStyle = opts.rim; ctx.lineWidth = Math.max(1, r * 0.06); ctx.stroke();
  // Arms — reaching up/out with the save.
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = Math.max(1.3, r * 0.14);
  const reach = r * (0.4 + opts.armReach * 0.6);
  const armY = -r * 0.2 - opts.armReach * r * 0.5;
  ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.2); ctx.lineTo(-reach, armY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.2); ctx.lineTo(reach, armY); ctx.stroke();
  // Head.
  ctx.beginPath(); ctx.arc(0, -r * 0.5, r * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = SKIN; ctx.fill();
  ctx.restore();
}

/**
 * The inverted bicycle-kick figure — drawn from scratch, no equivalent
 * exists anywhere else in this codebase. Deliberately NOT the normal
 * standing figure rotated 180 degrees, which would just look wrong: a real
 * overhead kick has a distinct arched, banana-shaped body — shoulders and
 * head dropping toward the ground, hips as the highest point, legs
 * scissoring overhead — not a rigid inverted plank.
 *
 * `chargeT` (0-1) is the charge-up: the striking leg (the one nearer the
 * ball, on the lean side) draws back tighter as it climbs, then — this is
 * the one piece of animation specifically asked for — whips through and
 * extends fully at the moment of the strike. `lean` (-1..1) leans the whole
 * pose a little the same way the strike itself will go. `follow` (0-1),
 * only set once the ball is already away, eases the figure from "just
 * struck" back down toward the ground as he falls out of the picture.
 */
function drawBicycleFigure(
  ctx: CanvasRenderingContext2D, hipX: number, hipY: number, scale: number,
  chargeT: number, lean: number, follow = 0,
) {
  const SKIN = "#c68642";
  const SHIRT = "#e11d48";
  const RIM = "#7f1d1d";
  const SHORTS = "#111827";
  const r = scale * 0.62;

  ctx.save();
  ctx.translate(hipX, hipY);
  // A small overall lean toward the strike side, plus the whole figure
  // rotating a touch further backward as the strike follows through.
  ctx.rotate(lean * 0.15 + follow * 0.5);
  ctx.lineCap = "round";

  // Shadow on the grass, well below — he's genuinely airborne.
  // (Drawn in world space by the caller's own ground ellipse elsewhere is
  // overkill for a prototype; skipped here deliberately.)

  // ── Torso, arched: head/shoulders low, hips (the origin) highest ──
  // An arc rather than a straight bar is what actually reads as "arched
  // body", not a rotated rectangle.
  const archBend = 0.55; // how banana-shaped the torso is
  ctx.strokeStyle = SHIRT;
  ctx.lineWidth = r * 0.42;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-r * 0.55, r * 0.35, -r * 1.05, r * (0.15 + archBend * 0.5));
  ctx.stroke();
  ctx.strokeStyle = RIM;
  ctx.lineWidth = r * 0.06;
  ctx.stroke();

  // ── Head, low and tucked, near the ground end of the torso arc ──
  const headX = -r * 1.15, headY = r * (0.28 + archBend * 0.5);
  ctx.beginPath();
  ctx.arc(headX, headY, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();

  // ── Arms, thrown out wide for balance — the classic "starfish" a real
  // overhead kick throws its arms into as the legs come through. ──
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, r * 0.25);
  ctx.lineTo(-r * 1.15, r * 0.75 - follow * r * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.85, r * 0.15);
  ctx.lineTo(-r * 1.35, -r * 0.15 + follow * r * 0.2);
  ctx.stroke();

  // ── Legs — the whole point of the animation ──
  //
  // The non-kicking leg stays up and slightly bent throughout, roughly
  // overhead, giving the pose its silhouette. The kicking leg is what
  // actually moves: during the charge it draws back tight (knee bent hard,
  // heel toward the glutes — a real charge-up for an overhead strike), and
  // at release/strike it's fully extended, whipping through where the ball
  // is. `chargeT` interpolates the bend; `follow` carries the leg on past
  // full extension into a settling arc once the ball has already gone.
  const kickSide = lean >= 0 ? 1 : -1;

  // Support leg (up and back, roughly fixed).
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = r * 0.19;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.05);
  ctx.lineTo(-kickSide * r * 0.15, -r * 0.55);
  ctx.lineTo(-kickSide * r * 0.05, -r * 0.95);
  ctx.stroke();

  // Kicking leg: hip -> knee -> foot, with the knee bend easing from tight
  // (charging) to straight (struck).
  const bend = 1 - clamp(chargeT + follow, 0, 1); // 1 = fully cocked, 0 = fully extended
  const hipKX = 0, hipKY = 0;
  const kneeX = kickSide * r * (0.25 + bend * 0.15);
  const kneeY = -r * (0.35 - bend * 0.1);
  const extend = 0.35 + (1 - bend) * 0.85; // how far the shin reaches out
  const footX = kickSide * r * (0.25 + extend * 0.9);
  const footY = -r * (0.6 + (1 - bend) * 0.55);
  ctx.lineWidth = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(hipKX, hipKY);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(footX, footY);
  ctx.stroke();
  // Boot.
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(footX, footY, r * 0.14, r * 0.09, Math.atan2(footY - kneeY, footX - kneeX), 0, Math.PI * 2);
  ctx.fill();

  // ── Shorts, at the hip (the pose's origin/highest point) ──
  ctx.fillStyle = SHORTS;
  ctx.beginPath();
  ctx.roundRect?.(-r * 0.3, -r * 0.16, r * 0.6, r * 0.3, r * 0.1);
  ctx.fill();

  ctx.restore();
}

/**
 * ── Honesty note (no live browser to check any of this against) ──
 *
 * 1. The camera is a genuine side elevation: screen-X is distance to goal,
 *    screen-Y is height. That reads as "a bicycle kick" far better than the
 *    game's usual behind-the-ball camera would, but it has a real cost —
 *    the pitch's LATERAL axis (ball.pos.x, which is exactly what decides
 *    left-post/right-post/wide-left/wide-right in the real engine) has no
 *    axis left to draw on. The goal is drawn as a generic side-on
 *    silhouette rather than a true projection of POST_L/POST_R, the keeper's
 *    real left/right dive can't be shown as motion (only a generic
 *    reach/crouch), and a "wide" miss looks the same on screen as a
 *    struck-just-over one. The RESOLUTION (goal/saved/post/wide/over) is
 *    the real physics and is trustworthy; the PICTURE of exactly where it
 *    went is a deliberate simplification for this pose. If a side-by-side
 *    two-camera view (side elevation for the wind-up, cut to the normal
 *    behind-the-ball camera for the strike itself) turns out to read
 *    better once actually seen, that's the natural next iteration.
 * 2. The inverted-figure geometry (arch amount, head/hip/foot offsets) was
 *    hand-picked from imagining the pose, not measured against a reference
 *    photo or rendered and inspected — this sandboxed session has no way to
 *    take a screenshot of its own canvas output. It may well need real
 *    tuning once actually looked at (the arch might read as too subtle or
 *    too extreme, the kicking leg's cocked position might not read as
 *    "wound up" at a small on-screen size, etc.) — exactly the kind of
 *    thing this sandbox exists to let someone iterate on quickly.
 * 3. `launch()`'s vertical-speed model assumes contact happens essentially
 *    at ground level (`ball.z = 0.08` on strike, regardless of pose) — true
 *    for every other shot in this game, and left alone here rather than
 *    invented a second contact-height model, since the pose itself is
 *    already a deliberate visual-only layer on top of an ordinary strike.
 *    A real overhead kick contacts the ball well above the ground; this
 *    sandbox does not attempt to model that as a physics difference, only
 *    as a difference in how it looks.
 */
