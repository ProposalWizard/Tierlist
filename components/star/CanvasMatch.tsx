"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  buildShootingScenario, launch, stepBall, stepKeeper, stepFollower,
  OUTCOME_TEXT, clamp,
  type Scenario, type Ball, type Outcome, type KickSkills,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import ContactBall from "./ContactBall";

type Phase = "aim" | "contact" | "flight" | "result";

interface Props {
  skills?: KickSkills;
  keeperStrength?: number;
  seed?: number;
}

// Draws the pitch, entities and ball to a canvas. Physics runs in an rAF loop.
export default function CanvasMatch({ skills = { power: 55, technique: 55 }, keeperStrength = 62, seed = 12345 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const strengthRef = useRef(keeperStrength);
  strengthRef.current = keeperStrength;

  const scenarioRef = useRef<Scenario>(buildShootingScenario(mulberry32(seed), keeperStrength));
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(mulberry32(seed));
  const seedRef = useRef(seed);

  const phaseRef = useRef<Phase>("aim");
  const [phase, setPhaseState] = useState<Phase>("aim");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [stats, setStats] = useState({ shots: 0, goals: 0 });

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // --- Canvas sizing (device-pixel-ratio aware) ---
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // --- Coordinate helpers (pitch <-> canvas pixels) ---
  const toPx = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current!;
    return { px: (x / 100) * canvas.width, py: (y / 100) * canvas.height };
  }, []);

  const pitchFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  };

  // --- Render one frame ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const sc = scenarioRef.current;
    const unit = W / 100;
    const heightScale = H * 0.018; // px per metre of ball height

    // Pitch stripes
    const bands = 11;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#16a34a" : "#15803d";
      ctx.fillRect(0, (i / bands) * H, W, (H / bands) + 1);
    }

    ctx.lineWidth = Math.max(1, unit * 0.4);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    // Penalty box (top)
    ctx.strokeRect(toPx(30, 0).px, 0, toPx(70, 0).px - toPx(30, 0).px, toPx(0, 18).py);
    // Six-yard box
    ctx.strokeRect(toPx(42, 0).px, 0, toPx(58, 0).px - toPx(42, 0).px, toPx(0, 7).py);
    // Halfway hint
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(0, toPx(0, 66).py); ctx.lineTo(W, toPx(0, 66).py); ctx.stroke();

    // Goal frame
    const g1 = toPx(sc.goal.x1, 0).px, g2 = toPx(sc.goal.x2, 0).px;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(g1, 0, g2 - g1, H * 0.035);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, unit * 0.5);
    ctx.beginPath();
    ctx.moveTo(g1, H * 0.035); ctx.lineTo(g1, 0); ctx.lineTo(g2, 0); ctx.lineTo(g2, H * 0.035);
    ctx.stroke();

    const dot = (x: number, y: number, r: number, fill: string, label?: string) => {
      const { px, py } = toPx(x, y);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.stroke();
      if (label) {
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, px, py);
      }
    };

    const R = unit * 2.2;

    // Rebound poacher — lurks, brightens when it commits to a loose ball
    {
      const f = sc.follower;
      const { px, py } = toPx(f.x, f.y);
      ctx.beginPath();
      ctx.arc(px, py, R * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = f.active ? "#3b82f6" : "rgba(59,130,246,0.5)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.stroke();
    }

    // Defenders + striker
    for (const d of sc.defenders) dot(d.x, d.y, R, "#dc2626");
    dot(sc.player.x, sc.player.y, R, "#10b981", "YOU");

    // Keeper — body stretches into the dive it commits to
    {
      const kk = sc.keeper;
      const { px, py } = toPx(kk.x, kk.y);
      const diveN = clamp(Math.abs(kk.dive) / 10, 0, 1);
      const sign = kk.dive === 0 ? 0 : Math.sign(kk.dive);
      const rx = R * (1.15 + diveN * 1.9);
      const ry = R * (1.15 - diveN * 0.3);
      const cx = px + sign * rx * 0.35;
      if (kk.flash > 0) {
        ctx.beginPath();
        ctx.ellipse(cx, py, rx * 1.28, ry * 1.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(250,204,21,0.35)";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(cx, py, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#facc15";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.font = `bold ${Math.round(R * 0.9)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GK", px, py);
    }

    // Ball (with height shadow)
    const ball = ballRef.current;
    if (ball) {
      const { px, py } = toPx(ball.pos.x, ball.pos.y);
      // shadow at ground
      ctx.beginPath();
      ctx.ellipse(px, py, unit * 0.9, unit * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      // ball lifted by height
      const by = py - ball.z * heightScale;
      const br = unit * 0.9 * (1 + ball.z / 14);
      ctx.beginPath();
      ctx.arc(px, by, br, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#111";
      ctx.stroke();
    } else if (phaseRef.current === "aim") {
      // resting ball at the spot
      const { px, py } = toPx(sc.ball.x, sc.ball.y);
      ctx.beginPath();
      ctx.arc(px, py, unit * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#111";
      ctx.stroke();
    }

    // Aim slingshot overlay
    if (phaseRef.current === "aim" && draggingRef.current && dragRef.current) {
      const d = dragRef.current;
      const dist = Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y);
      const power = clamp(dist / 35, 0, 1);
      const dx = sc.ball.x - d.x, dy = sc.ball.y - d.y;
      const len = Math.hypot(dx, dy) || 1;
      const lineLen = power * 10;
      const ex = sc.ball.x + (dx / len) * lineLen;
      const ey = sc.ball.y + (dy / len) * lineLen;
      const a = toPx(sc.ball.x, sc.ball.y);
      const b = toPx(ex, ey);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(2, unit * 0.5);
      ctx.setLineDash([unit * 1.5, unit]);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
      ctx.setLineDash([]);
      // arrowhead
      const ang = Math.atan2(b.py - a.py, b.px - a.px);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.px - Math.cos(ang - 0.4) * unit * 1, b.py - Math.sin(ang - 0.4) * unit * 1);
      ctx.lineTo(b.px - Math.cos(ang + 0.4) * unit * 1, b.py - Math.sin(ang + 0.4) * unit * 1);
      ctx.closePath();
      ctx.fill();

      // power meter (left)
      const meterX = unit * 2, meterTop = H * 0.15, meterH = H * 0.7, meterW = unit * 2.5;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(meterX, meterTop, meterW, meterH);
      const fillH = meterH * power;
      const grad = ctx.createLinearGradient(0, meterTop + meterH, 0, meterTop);
      grad.addColorStop(0, "#22c55e"); grad.addColorStop(0.6, "#eab308"); grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = grad;
      ctx.fillRect(meterX, meterTop + meterH - fillH, meterW, fillH);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.round(unit * 2.2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(power * 100)}%`, meterX + meterW / 2, meterTop - unit);
    }
  }, [toPx]);

  // --- Main animation loop ---
  useEffect(() => {
    const loop = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      let dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      dt = Math.min(dt, 0.05); // clamp big frame gaps

      if (phaseRef.current === "flight" && ballRef.current) {
        // Substep for stable physics
        const steps = 3;
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          stepKeeper(scenarioRef.current, h);
          stepFollower(scenarioRef.current, ballRef.current, rngRef.current, h);
          const res = stepBall(ballRef.current, scenarioRef.current, rngRef.current, h);
          if (res) { resolveOutcome(res); break; }
        }
      }
      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveOutcome = (res: Outcome) => {
    setOutcome(res);
    setPhase("result");
    setStats((s) => ({ shots: s.shots + 1, goals: s.goals + (OUTCOME_TEXT[res].kind === "goal" ? 1 : 0) }));
    // Safety: if the ball never resolves for some reason, this still fires next scenario.
    window.setTimeout(() => nextScenario(), 1800);
  };

  const nextScenario = () => {
    seedRef.current += 1;
    rngRef.current = mulberry32(seedRef.current);
    scenarioRef.current = buildShootingScenario(rngRef.current, strengthRef.current);
    ballRef.current = null;
    setAim(null);
    setOutcome(null);
    dragRef.current = null;
    draggingRef.current = false;
    setPhase("aim");
  };

  // --- Pointer (slingshot) ---
  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim") return;
    const p = pitchFromPointer(e.clientX, e.clientY);
    const b = scenarioRef.current.ball;
    if (Math.hypot(p.x - b.x, p.y - b.y) > 16) return;
    draggingRef.current = true;
    dragRef.current = p;
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    dragRef.current = pitchFromPointer(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const b = scenarioRef.current.ball;
    const power = clamp(Math.hypot(d.x - b.x, d.y - b.y) / 35, 0, 1);
    if (power < 0.12) return; // too weak — stay in aim
    const dir = { x: b.x - d.x, y: b.y - d.y };
    setAim({ dir, power });
    setPhase("contact");
  };

  // --- Contact chosen -> launch ---
  const handleContact = (contact: { cx: number; cy: number }) => {
    if (!aim) return;
    ballRef.current = launch(scenarioRef.current, aim.dir, aim.power, contact, skills, rngRef.current);
    setPhase("flight");
  };

  const outMeta = outcome ? OUTCOME_TEXT[outcome] : null;

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* HUD */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs font-black text-white/80">Shots: {stats.shots}</div>
        <div className="text-xs font-black text-emerald-400">Goals: {stats.goals}</div>
      </div>

      <div
        ref={wrapRef}
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-800 shadow-2xl"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`absolute inset-0 w-full h-full ${phase === "aim" ? "cursor-grab" : "cursor-default"}`}
        />

        {/* Aim prompt */}
        {phase === "aim" && !draggingRef.current && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="bg-black/70 border-2 border-yellow-400 rounded-lg px-6 py-3 text-center">
              <div className="text-2xl font-black text-yellow-300 tracking-widest">SHOOT!</div>
              <div className="text-[10px] text-yellow-200 mt-0.5">Drag back from the ball to aim &amp; power</div>
            </div>
          </div>
        )}

        {/* Contact overlay */}
        {phase === "contact" && aim && (
          <ContactBall
            power={aim.power}
            onContact={handleContact}
            onCancel={() => { setAim(null); setPhase("aim"); }}
          />
        )}

        {/* Outcome */}
        {phase === "result" && outMeta && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`text-4xl font-black tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] px-5 py-3 rounded-lg bg-black/50 ${
              outMeta.kind === "goal" ? "text-emerald-300" : outMeta.kind === "neutral" ? "text-yellow-200" : "text-red-400"
            }`}>
              {outMeta.text}
            </div>
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="mt-2 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-[10px] text-gray-300 text-center">
        <span className="text-yellow-300">💡</span> Drag back from the ball for power &amp; direction, then strike:
        bottom = lofted &amp; far, top = driven low, sides = curl.
      </div>
    </div>
  );
}
