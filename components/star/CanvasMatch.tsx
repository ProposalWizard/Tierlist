"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  buildWeightedScenario, launch, stepBall, stepKeeper, stepFollower,
  OUTCOME_TEXT, clamp,
  type Scenario, type Ball, type Outcome, type KickSkills, type ScenarioKind,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import {
  commentaryBuildup, commentaryStrike, commentaryReceived, commentaryReceiverShot, commentaryResult,
} from "@/lib/star/matchCommentary";
import {
  primeMatchSound, setMatchSoundMuted, playKick, playNet, playPost, playSave, playWhistle, playCrowdSwell,
} from "@/lib/star/matchSound";
import { finaliseMatch } from "@/lib/star/matchStats";
import type { CareerState, MatchStats, Fixture } from "@/lib/star/types";
import ContactBall from "./ContactBall";
import PostMatch from "./PostMatch";

type Phase = "aim" | "contact" | "flight" | "result" | "postmatch";

// A match is this many playable chances before it wraps to full time.
const SESSION_LENGTH = 6;

interface Props {
  skills?: KickSkills;
  keeperStrength?: number;
  position?: string;
  teamRelationship?: number;
  career?: CareerState | null;
  seed?: number;
  // Career-match mode: when a fixture + onComplete are supplied, this runs a real
  // match — it tallies the scoreline, simulates the opponent between chances, and
  // hands finaliseMatch()'s MatchStats back to the career flow instead of showing
  // its own post-match summary. Without them it's the standalone sandbox.
  fixture?: Fixture;
  oppStrength?: number;
  onComplete?: (stats: MatchStats) => void;
}

// Only the fields finaliseMatch reads — lets the standalone sandbox produce a
// summary via the same canonical scorer without a real career loaded (all cash
// figures come out 0 rather than fabricated).
const FALLBACK_CAREER = {
  contract: { wage: 0, goalBonus: 0, assistBonus: 0 },
  relationships: { sponsors: 0 },
} as unknown as CareerState;

// --- Knowitball match identity: "night match under floodlights" ---
// Deep cool pitch greens + floodlight wash, near-black glass chrome, gold accent.
const C = {
  pitchA: "#149046",
  pitchB: "#0e763a",
  line: "rgba(255,253,245,0.55)",
  lineFaint: "rgba(255,253,245,0.22)",
  you: "#10b981",
  youRim: "#065f46",
  mate: "#8b5cf6",
  mateRim: "#4c1d95",
  opp: "#dc2626",
  oppRim: "#7f1d1d",
  gk: "#fbbf24",
  gkRim: "#92400e",
  gold: "#fbbf24",
  goldSoft: "#fde68a",
};

// What the situation is, shown to the player so it reads clearly before they aim.
const SCENARIO_LABEL: Record<ScenarioKind, { verb: string; hint: string }> = {
  one_on_one: { verb: "1-ON-1!", hint: "Clean through on goal — pick your finish." },
  tight_angle: { verb: "TIGHT ANGLE!", hint: "Acute angle — the keeper's covering the near post." },
  long_range: { verb: "SHOOT!", hint: "Long way out — give it some pace." },
  volley: { verb: "VOLLEY!", hint: "Meet it first time — drag back to strike." },
  header: { verb: "HEADER!", hint: "Get up and meet the cross." },
  cutback: { verb: "CUTBACK!", hint: "Square it back for the run — aim the purple circle." },
  byline_cross: { verb: "CROSS IT!", hint: "Whip one in for the run — aim the purple circle." },
  through_ball: { verb: "THROUGH BALL!", hint: "Split the defense — aim the purple circle." },
  midfield_pass: { verb: "PASS!", hint: "Keep it simple — find your teammate." },
};

interface Particle {
  x: number; y: number;       // pitch units
  vx: number; vy: number;     // pitch units/sec
  rot: number; vrot: number;
  life: number; maxLife: number;
  size: number;               // pitch units
  color: string;
}

// Draws the pitch, entities and ball to a canvas. Physics runs in an rAF loop.
export default function CanvasMatch({ skills = { power: 55, technique: 55 }, keeperStrength = 62, position = "ST", teamRelationship = 60, career = null, seed = 12345, fixture, oppStrength, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const careerRef = useRef(career);
  careerRef.current = career;

  // Career-match mode is active when the career flow passes a fixture + callback.
  const matchMode = !!(fixture && onComplete);
  const matchModeRef = useRef(matchMode);
  matchModeRef.current = matchMode;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const oppStrengthRef = useRef(oppStrength ?? 65);
  oppStrengthRef.current = oppStrength ?? 65;
  const fixtureOpponent = fixture?.opponent ?? "The opposition";
  const fixtureOpponentRef = useRef(fixtureOpponent);
  fixtureOpponentRef.current = fixtureOpponent;

  // --- Session / scoreline tracking ---
  const attemptsRef = useRef(0);
  const tallyRef = useRef({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
  const userScoreRef = useRef(0);
  const oppScoreRef = useRef(0);
  const [score, setScore] = useState({ user: 0, opp: 0 });
  const [finalStats, setFinalStats] = useState<MatchStats | null>(null);

  // --- Sound: muted by default until primed by the first user gesture ---
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("star-match-muted");
      if (saved === "1") { setMuted(true); setMatchSoundMuted(true); }
    } catch { /* ignore */ }
  }, []);
  const toggleMuted = () => {
    setMuted((m) => {
      const next = !m;
      setMatchSoundMuted(next);
      try { localStorage.setItem("star-match-muted", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const strengthRef = useRef(keeperStrength);
  strengthRef.current = keeperStrength;
  const positionRef = useRef(position);
  positionRef.current = position;
  const teamRef = useRef(teamRelationship);
  teamRef.current = teamRelationship;

  const scenarioRef = useRef<Scenario>(buildWeightedScenario(mulberry32(seed), position, keeperStrength, teamRelationship));
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
  const [stats, setStats] = useState({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
  const [feed, setFeed] = useState<string[]>([]);
  const pushLine = useCallback((line: string) => {
    setFeed((f) => [...f, line].slice(-4));
  }, []);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // --- Cosmetic FX state (never touches physics) ---
  const reducedMotionRef = useRef(false);
  const trailRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ t: 0, dur: 1, mag: 0 });   // camera nudge
  const flashRef = useRef({ t: 0, dur: 1 });            // goal flash
  const seamRef = useRef(0);                            // ball roll angle

  // Respect prefers-reduced-motion: no shake, no confetti, only a faint brief flash.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const on = (e: MediaQueryListEvent) => { reducedMotionRef.current = e.matches; };
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

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

  // --- Announce the very first scenario ---
  useEffect(() => {
    pushLine(commentaryBuildup(scenarioRef.current.kind, rngRef.current));
    playWhistle(); // no-op until the first user gesture primes audio — harmless
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const uy = H / 100;
    const heightScale = H * 0.018; // px per metre of ball height

    // Camera nudge — a decaying oscillation, big events only. Never under reduced motion.
    let ox = 0, oy = 0;
    const sh = shakeRef.current;
    if (sh.t > 0 && !reducedMotionRef.current) {
      const k = sh.t / sh.dur;
      const m = sh.mag * unit * k;
      ox = Math.sin(sh.t * 73) * m;
      oy = Math.cos(sh.t * 57) * m * 0.7;
    }
    ctx.save();
    ctx.translate(ox, oy);

    // --- Pitch: mowing stripes toward the goal ---
    const bands = 11;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 === 0 ? C.pitchA : C.pitchB;
      ctx.fillRect(-unit * 2, (i / bands) * H, W + unit * 4, (H / bands) + 1);
    }
    // PLUG-IN (optional asset): a subtle 256px grass-noise tile can be drawn here at ~8% alpha
    // via ctx.createPattern(img, "repeat") for extra texture. See notes in the PR/commit.

    // Floodlight wash from the goal end...
    const flood = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    flood.addColorStop(0, "rgba(255,255,235,0.10)");
    flood.addColorStop(1, "rgba(255,255,235,0)");
    ctx.fillStyle = flood;
    ctx.fillRect(-unit * 2, 0, W + unit * 4, H * 0.5);
    // ...and a vignette so the edges fall away.
    const vig = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.3, W / 2, H * 0.42, Math.max(W, H) * 0.78);
    vig.addColorStop(0, "rgba(1,14,8,0)");
    vig.addColorStop(1, "rgba(1,14,8,0.34)");
    ctx.fillStyle = vig;
    ctx.fillRect(-unit * 2, -unit * 2, W + unit * 4, H + unit * 4);

    // --- Markings ---
    ctx.lineWidth = Math.max(1, unit * 0.35);
    ctx.strokeStyle = C.line;
    // Penalty box + six-yard box
    ctx.strokeRect(toPx(30, 0).px, 0, toPx(70, 0).px - toPx(30, 0).px, toPx(0, 18).py);
    ctx.strokeRect(toPx(42, 0).px, 0, toPx(58, 0).px - toPx(42, 0).px, toPx(0, 7).py);
    // Penalty spot + the D
    {
      const spot = toPx(50, 11);
      ctx.beginPath();
      ctx.arc(spot.px, spot.py, unit * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = C.line;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(spot.px, spot.py, unit * 9.15, uy * 9.15, 0, 0.87, Math.PI - 0.87);
      ctx.stroke();
    }
    // Corner arcs
    ctx.beginPath(); ctx.ellipse(0, 0, unit * 2.5, uy * 2.5, 0, 0, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(W, 0, unit * 2.5, uy * 2.5, 0, Math.PI / 2, Math.PI); ctx.stroke();
    // Halfway line + centre circle hint
    ctx.strokeStyle = C.lineFaint;
    ctx.beginPath();
    ctx.moveTo(0, toPx(0, 66).py); ctx.lineTo(W, toPx(0, 66).py); ctx.stroke();
    {
      const cc = toPx(50, 66);
      ctx.beginPath();
      ctx.ellipse(cc.px, cc.py, unit * 9.15, uy * 9.15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- Goal: frame + net ---
    const g1 = toPx(sc.goal.x1, 0).px, g2 = toPx(sc.goal.x2, 0).px;
    const netH = H * 0.033;
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(g1, 0, g2 - g1, netH);
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1;
    for (let x = g1 + unit * 1.1; x < g2; x += unit * 1.1) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, netH); ctx.stroke();
    }
    for (let i = 1; i <= 2; i++) {
      const y = (netH * i) / 3;
      ctx.beginPath(); ctx.moveTo(g1, y); ctx.lineTo(g2, y); ctx.stroke();
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, unit * 0.55);
    ctx.beginPath();
    ctx.moveTo(g1, netH + unit * 0.4); ctx.lineTo(g1, 0); ctx.lineTo(g2, 0); ctx.lineTo(g2, netH + unit * 0.4);
    ctx.stroke();

    // Pass reception zone — where a cutback/cross/through-ball/pass needs to land
    if (sc.passTarget) {
      const { px, py } = toPx(sc.passTarget.x, sc.passTarget.y);
      ctx.setLineDash([unit * 0.8, unit * 0.6]);
      ctx.lineWidth = Math.max(1.5, unit * 0.35);
      ctx.strokeStyle = "rgba(167,139,250,0.85)";
      ctx.beginPath();
      ctx.arc(px, py, unit * 2.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // --- Stylised "puck" players: drop shadow, rim, top-light ---
    const puck = (x: number, y: number, r: number, fill: string, rim: string, label?: string, labelColor = "#fff") => {
      const { px, py } = toPx(x, y);
      ctx.beginPath();
      ctx.ellipse(px, py + r * 0.55, r * 0.95, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, r * 0.18);
      ctx.strokeStyle = rim;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px - r * 0.28, py - r * 0.3, r * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fill();
      if (label) {
        ctx.fillStyle = labelColor;
        ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, px, py + r * 0.05);
      }
    };

    const R = unit * 2.2;

    // Highlight the receiver while they control a pass they've just won
    const rb = ballRef.current;
    if (rb && rb.receiverControlT > 0 && sc.passTarget) {
      const { px, py } = toPx(sc.passTarget.x, sc.passTarget.y);
      ctx.beginPath();
      ctx.arc(px, py, R * 1.7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(167,139,250,0.4)";
      ctx.fill();
    }

    // Rebound poacher — lurks, brightens when it commits to a loose ball
    {
      const f = sc.follower;
      puck(f.x, f.y, R * 0.9, f.active ? "#7c3aed" : "rgba(139,92,246,0.45)", C.mateRim);
    }

    // Teammates — decorative crossers, or the runner a pass is aimed at
    for (const t of sc.teammates) puck(t.x, t.y, R * 0.9, C.mate, C.mateRim);

    // Defenders + you
    for (const d of sc.defenders) puck(d.x, d.y, R, C.opp, C.oppRim);
    puck(sc.player.x, sc.player.y, R, C.you, C.youRim, "YOU");

    // Keeper — body stretches into the dive it commits to
    {
      const kk = sc.keeper;
      const { px, py } = toPx(kk.x, kk.y);
      const diveN = clamp(Math.abs(kk.dive) / 10, 0, 1);
      const sign = kk.dive === 0 ? 0 : Math.sign(kk.dive);
      const rx = R * (1.15 + diveN * 1.9);
      const ry = R * (1.15 - diveN * 0.3);
      const cx = px + sign * rx * 0.35;
      ctx.beginPath();
      ctx.ellipse(cx, py + ry * 0.55, rx * 0.95, ry * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.fill();
      if (kk.flash > 0) {
        ctx.beginPath();
        ctx.ellipse(cx, py, rx * 1.28, ry * 1.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(250,204,21,0.35)";
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(cx, py, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.gk;
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, R * 0.18);
      ctx.strokeStyle = C.gkRim;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - rx * 0.25, py - ry * 0.3, ry * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fill();
      ctx.fillStyle = "#111827";
      ctx.font = `bold ${Math.round(R * 0.85)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GK", px, py);
    }

    // --- Ball trail (fades along the flight; curl makes it sing) ---
    const trail = trailRef.current;
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const k = (i + 1) / trail.length;
      const { px, py } = toPx(t.x, t.y);
      ctx.beginPath();
      ctx.arc(px, py - t.z * heightScale, unit * 0.85 * (0.3 + 0.5 * k), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.06 + 0.24 * k})`;
      ctx.fill();
    }

    // --- Ball (shadow at ground, seam patches roll with spin) ---
    const drawBall = (x: number, y: number, z: number) => {
      const { px, py } = toPx(x, y);
      ctx.beginPath();
      ctx.ellipse(px, py, unit * 0.9, unit * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      const by = py - z * heightScale;
      const br = unit * 0.9 * (1 + z / 14);
      ctx.beginPath();
      ctx.arc(px, by, br, 0, Math.PI * 2);
      ctx.fillStyle = "#fefefe";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();
      // rolling seam patches
      const a = seamRef.current;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, by, br * 0.92, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * br * 0.45, by + Math.sin(a) * br * 0.45, br * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15,23,42,0.16)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px - Math.cos(a) * br * 0.5, by - Math.sin(a) * br * 0.5, br * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15,23,42,0.12)";
      ctx.fill();
      ctx.restore();
    };

    const ball = ballRef.current;
    if (ball) drawBall(ball.pos.x, ball.pos.y, ball.z);
    else if (phaseRef.current === "aim") drawBall(sc.ball.x, sc.ball.y, 0);

    // --- Aim slingshot overlay (brand gold) ---
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
      ctx.strokeStyle = "rgba(251,191,36,0.95)";
      ctx.lineWidth = Math.max(2, unit * 0.5);
      ctx.setLineDash([unit * 1.5, unit]);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
      ctx.setLineDash([]);
      // arrowhead
      const ang = Math.atan2(b.py - a.py, b.px - a.px);
      ctx.fillStyle = C.goldSoft;
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.px - Math.cos(ang - 0.4) * unit * 1, b.py - Math.sin(ang - 0.4) * unit * 1);
      ctx.lineTo(b.px - Math.cos(ang + 0.4) * unit * 1, b.py - Math.sin(ang + 0.4) * unit * 1);
      ctx.closePath();
      ctx.fill();

      // power meter (left)
      const meterX = unit * 2, meterTop = H * 0.15, meterH = H * 0.7, meterW = unit * 2.5;
      ctx.fillStyle = "rgba(2,6,23,0.55)";
      ctx.fillRect(meterX, meterTop, meterW, meterH);
      const fillH = meterH * power;
      const grad = ctx.createLinearGradient(0, meterTop + meterH, 0, meterTop);
      grad.addColorStop(0, "#22c55e"); grad.addColorStop(0.6, "#eab308"); grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = grad;
      ctx.fillRect(meterX, meterTop + meterH - fillH, meterW, fillH);
      ctx.strokeStyle = "rgba(251,191,36,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(meterX, meterTop, meterW, meterH);
      ctx.fillStyle = C.goldSoft;
      ctx.font = `bold ${Math.round(unit * 2.2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(power * 100)}%`, meterX + meterW / 2, meterTop - unit);
    }

    // --- Confetti (brand colours, goal only) ---
    for (const p of particlesRef.current) {
      const { px, py } = toPx(p.x, p.y);
      const s = p.size * unit;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // end camera nudge

    // --- Goal flash (screen-space, not shaken; faint + brief under reduced motion) ---
    const fl = flashRef.current;
    if (fl.t > 0) {
      const k = fl.t / fl.dur;
      const maxA = reducedMotionRef.current ? 0.14 : 0.32;
      const gm = toPx(50, 2);
      const fg = ctx.createRadialGradient(gm.px, gm.py, 0, gm.px, gm.py, W * 0.75);
      fg.addColorStop(0, `rgba(253,230,138,${maxA * k})`);
      fg.addColorStop(1, "rgba(253,230,138,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
    }
  }, [toPx]);

  // --- Cosmetic FX helpers ---
  const nudge = (dur: number, mag: number) => {
    if (reducedMotionRef.current) return;
    shakeRef.current = { t: dur, dur, mag };
  };

  const spawnGoalFx = () => {
    if (reducedMotionRef.current) {
      flashRef.current = { t: 0.25, dur: 0.25 };
      return;
    }
    flashRef.current = { t: 0.55, dur: 0.55 };
    nudge(0.4, 1.3);
    const b = ballRef.current;
    const origin = b ? { x: b.pos.x, y: Math.max(b.pos.y, 1.5) } : { x: 50, y: 2 };
    const rng = rngRef.current;
    const colors = [C.gold, C.goldSoft, "#34d399", "#ffffff", C.you];
    for (let i = 0; i < 46; i++) {
      const life = 0.8 + rng() * 0.6;
      particlesRef.current.push({
        x: origin.x + (rng() - 0.5) * 6,
        y: origin.y + (rng() - 0.5) * 2,
        vx: (rng() - 0.5) * 46,
        vy: -(8 + rng() * 34),
        rot: rng() * Math.PI * 2,
        vrot: (rng() - 0.5) * 10,
        life, maxLife: life,
        size: 0.5 + rng() * 0.7,
        color: colors[Math.floor(rng() * colors.length)],
      });
    }
  };

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
        // Surface mid-flight moments (pass reception / the teammate's own shot) once.
        const ev = ballRef.current?.event;
        const receiver = scenarioRef.current.receiver;
        if (ev && receiver) {
          if (ev === "received") pushLine(commentaryReceived(receiver.roleLabel, rngRef.current));
          else if (ev === "receiverShot") { pushLine(commentaryReceiverShot(receiver.roleLabel, rngRef.current)); playKick(); }
        }
        if (ballRef.current) ballRef.current.event = null;
      }

      // Cosmetic FX advance (pausing the rAF pauses everything together)
      if (shakeRef.current.t > 0) shakeRef.current.t = Math.max(0, shakeRef.current.t - dt);
      if (flashRef.current.t > 0) flashRef.current.t = Math.max(0, flashRef.current.t - dt);
      for (const p of particlesRef.current) {
        p.vy += 70 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.life -= dt;
      }
      if (particlesRef.current.length) particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      const b = ballRef.current;
      if (phaseRef.current === "flight" && b && !b.resting) {
        seamRef.current += (b.spin * 0.3 + Math.hypot(b.vel.x, b.vel.y) * 0.06) * dt;
        trailRef.current.push({ x: b.pos.x, y: b.pos.y, z: b.z });
        if (trailRef.current.length > 16) trailRef.current.shift();
      } else if (trailRef.current.length) {
        trailRef.current.shift(); // let it dissolve after the play resolves
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
    const sc = scenarioRef.current;
    const isChain = sc.receiver != null;
    const isSimplePass = sc.passTarget != null && !isChain;
    const receiverReached = sc.receiverDone;
    const kind = OUTCOME_TEXT[res].kind;

    // The tally lives in a ref so it's authoritative the instant this chance
    // resolves — the rAF loop calls a stale resolveOutcome closure, so reading it
    // back off React state would risk under-counting the final chance. State is
    // just a mirror for the HUD.
    const t = tallyRef.current;
    if (isChain) {
      t.chances += 1;
      if (receiverReached && kind === "goal") t.assists += 1;
    } else if (isSimplePass) {
      t.passes += 1;
      if (kind === "pass") t.passesCompleted += 1;
    } else {
      t.shots += 1;
      if (kind === "goal") t.goals += 1;
    }
    setStats({ ...t });

    // Your team scores whenever the ball ends up in the net — your own finish or a
    // teammate you set up (same rule the old DOM match used: goal || assist).
    if (kind === "goal") {
      userScoreRef.current += 1;
      setScore({ user: userScoreRef.current, opp: oppScoreRef.current });
    }

    // Celebration / impact FX + sound, matched to what the physics produced.
    if (kind === "goal") {
      spawnGoalFx();
      playNet();
      playCrowdSwell("cheer");
    } else if (res === "post") {
      nudge(0.28, 0.9);
      playPost();
      playCrowdSwell("groan");
    } else if (res === "saved" || res === "tipped") {
      nudge(0.18, 0.5);
      playSave();
      playCrowdSwell("groan");
    } else if (res === "caught" || res === "blocked") {
      nudge(0.18, 0.5);
      playSave();
    }

    pushLine(commentaryResult(res, rngRef.current, { chain: isChain, receiverReached, roleLabel: sc.receiver?.roleLabel, isPass: isSimplePass }));

    // After a short beat: either the next chance, or full-time once the match's played out.
    attemptsRef.current += 1;
    if (attemptsRef.current >= SESSION_LENGTH) {
      // One canonical scorer for both modes — the real finaliseMatch. Career mode
      // hands the result back to the career flow; the sandbox shows PostMatch itself.
      const careerForStats = careerRef.current ?? FALLBACK_CAREER;
      const t = tallyRef.current;
      const stats = finaliseMatch(
        attemptsRef.current, t.goals, t.assists, t.passesCompleted,
        90, userScoreRef.current, oppScoreRef.current, careerForStats,
      );
      window.setTimeout(() => {
        if (matchModeRef.current && onCompleteRef.current) {
          onCompleteRef.current(stats);
        } else {
          setFinalStats(stats);
          setPhase("postmatch");
        }
      }, 1800);
    } else {
      window.setTimeout(() => nextScenario(), 1800);
    }
  };

  const nextScenario = () => {
    seedRef.current += 1;
    rngRef.current = mulberry32(seedRef.current);

    // Career mode: the opponent can nick a goal in the gap between your chances.
    if (matchModeRef.current) {
      const oppGoalChance = 0.07 + (oppStrengthRef.current - 65) / 500;
      if (rngRef.current() < oppGoalChance) {
        oppScoreRef.current += 1;
        setScore({ user: userScoreRef.current, opp: oppScoreRef.current });
        pushLine(`⚽ ${fixtureOpponentRef.current} score against the run of play!`);
        playCrowdSwell("groan");
      }
    }

    scenarioRef.current = buildWeightedScenario(rngRef.current, positionRef.current, strengthRef.current, teamRef.current);
    ballRef.current = null;
    setAim(null);
    setOutcome(null);
    dragRef.current = null;
    draggingRef.current = false;
    trailRef.current = [];
    particlesRef.current = [];
    shakeRef.current.t = 0;
    flashRef.current.t = 0;
    setPhase("aim");
    pushLine(commentaryBuildup(scenarioRef.current.kind, rngRef.current));
    playWhistle();
  };

  const restartSession = () => {
    attemptsRef.current = 0;
    tallyRef.current = { shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 };
    userScoreRef.current = 0;
    oppScoreRef.current = 0;
    setScore({ user: 0, opp: 0 });
    setStats({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
    setFinalStats(null);
    setFeed([]);
    nextScenario();
  };

  // --- Pointer (slingshot) ---
  const onPointerDown = (e: React.PointerEvent) => {
    primeMatchSound();
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
    pushLine(commentaryStrike(scenarioRef.current.kind, rngRef.current));
    playKick();
  };

  const outMeta = outcome ? OUTCOME_TEXT[outcome] : null;
  const scenarioLabel = SCENARIO_LABEL[scenarioRef.current.kind];

  // Match-mode scoreboard (user's club vs opponent, mapped to home/away)
  const homeTeam = matchMode ? (fixture!.home ? career?.player.club ?? "You" : fixture!.opponent) : "";
  const awayTeam = matchMode ? (fixture!.home ? fixture!.opponent : career?.player.club ?? "You") : "";
  const homeScore = matchMode ? (fixture!.home ? score.user : score.opp) : 0;
  const awayScore = matchMode ? (fixture!.home ? score.opp : score.user) : 0;

  const statCell = (label: string, value: string, valueClass: string) => (
    <div className="px-1.5 py-1 text-center">
      <div className="text-[8px] uppercase tracking-widest text-gray-500 font-bold leading-none">{label}</div>
      <div className={`text-xs font-black tabular-nums leading-tight ${valueClass}`}>{value}</div>
    </div>
  );

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Local keyframes; disabled wholesale under prefers-reduced-motion */}
      <style>{`
        @keyframes kibPop { 0% { transform: scale(0.55); opacity: 0; } 60% { transform: scale(1.07); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes kibLive { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .kib-pop { animation: kibPop 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.35) both; }
        .kib-live { animation: kibLive 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .kib-pop, .kib-live { animation: none; }
        }
      `}</style>

      {/* Live match scoreboard (career mode only) */}
      {matchMode && (
        <div className="mb-2 flex items-center justify-between gap-1">
          <div className="flex-1 bg-red-600 border border-red-500 rounded-l-lg px-2 py-1.5 text-white font-black text-xs truncate">
            {homeTeam.slice(0, 8).toUpperCase()}
          </div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow tabular-nums">{homeScore}</div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow tabular-nums">{awayScore}</div>
          <div className="flex-1 bg-amber-500 border border-amber-400 rounded-r-lg px-2 py-1.5 text-white font-black text-xs truncate text-right">
            {awayTeam.slice(0, 8).toUpperCase()}
          </div>
        </div>
      )}

      {/* Scoreboard plate */}
      <div className="mb-2 rounded-lg overflow-hidden border border-emerald-800/70 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 shadow-lg">
        <div className="flex items-stretch">
          {/* PLUG-IN (optional asset): swap this monogram for /public/star/knowitball-badge.png */}
          <div className="px-2.5 flex items-center bg-gradient-to-b from-amber-400 to-amber-500 text-gray-950 text-[11px] font-black tracking-tight">
            KB
          </div>
          <div className="px-2.5 flex items-center border-r border-white/5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/90">
            {matchMode ? `Wk ${fixture!.week}` : "Match Lab"}
          </div>
          <div className="flex-1 grid grid-cols-4 divide-x divide-white/5">
            {statCell("Shots", `${stats.shots}`, "text-white")}
            {statCell("Goals", `${stats.goals}`, "text-amber-300")}
            {statCell("Passes", `${stats.passesCompleted}/${stats.passes}`, "text-violet-300")}
            {statCell("Assists", `${stats.assists}/${stats.chances}`, "text-emerald-300")}
          </div>
          <button
            onClick={toggleMuted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="px-2.5 flex items-center border-l border-white/5 text-gray-400 hover:text-amber-300 transition"
          >
            {muted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
                <path d="m17 9 6 6M23 9l-6 6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-800/80 shadow-2xl shadow-emerald-950/60"
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
            <div className="kib-pop bg-gray-950/80 border-2 border-amber-400/90 rounded-lg px-6 py-3 text-center shadow-xl">
              <div className="text-2xl font-black text-amber-300 tracking-widest drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{scenarioLabel.verb}</div>
              <div className="text-[10px] text-amber-100/80 mt-0.5">Drag back from the ball to aim &amp; power</div>
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
            <div className={`kib-pop text-4xl font-black tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] px-6 py-3 rounded-xl ${
              outMeta.kind === "goal"
                ? "text-amber-300 bg-gray-950/70 ring-2 ring-amber-400/70 shadow-[0_0_40px_rgba(251,191,36,0.35)]"
                : outMeta.kind === "pass"
                ? "text-violet-300 bg-gray-950/60 ring-1 ring-violet-400/50"
                : outMeta.kind === "neutral"
                ? "text-yellow-200 bg-gray-950/60"
                : "text-red-400 bg-gray-950/60 ring-1 ring-red-500/40"
            }`}>
              {outMeta.text}
            </div>
          </div>
        )}
      </div>

      {/* Live commentary ticker */}
      <div className="mt-2 rounded-lg border border-gray-800 bg-gray-950/85 px-3 py-2 min-h-[3.8rem]">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="kib-live inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-[8px] font-black tracking-[0.22em] text-gray-500 uppercase">Live Commentary</span>
        </div>
        <div className="space-y-0.5">
          {feed.length === 0 && <div className="text-[11px] text-gray-600 italic">Kick-off…</div>}
          {feed.map((line, i) => (
            <div
              key={i}
              className={`text-[11px] leading-snug pl-2 border-l-2 ${
                i === feed.length - 1 ? "text-white font-bold border-emerald-500/80" : "text-gray-600 border-transparent"
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div className="mt-2 bg-gray-900/70 border border-gray-800 rounded-lg px-3 py-2 text-[10px] text-gray-400 text-center">
        {matchMode && (
          <span className="text-emerald-300 font-black mr-1">
            Chance {Math.min(SESSION_LENGTH, stats.shots + stats.passes + stats.chances + 1)}/{SESSION_LENGTH} ·
          </span>
        )}
        <span className="text-amber-300">💡</span> {scenarioLabel.hint}
      </div>

      {/* Session complete — reuse the real post-match screen for the summary */}
      {phase === "postmatch" && finalStats && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <PostMatch
            stats={finalStats}
            homeTeam={careerRef.current?.player.club ?? "You"}
            awayTeam="Training Session"
            onContinue={restartSession}
          />
        </div>
      )}
    </div>
  );
}
