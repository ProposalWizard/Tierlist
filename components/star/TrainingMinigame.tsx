"use client";
import { useEffect, useRef, useState } from "react";
import type { Skills } from "@/lib/star/types";

interface Props {
  skill: keyof Skills;
  onComplete: (xpGained: number) => void;
}

const SKILL_TITLES: Record<keyof Skills, string> = {
  pace: "Sprint Reaction",
  power: "Power Timing",
  technique: "Curl Control",
  vision: "Spot the Runner",
  freeKick: "Set-Piece Target",
};

// -------------------------------------------------------------------------
// Shared helpers
// -------------------------------------------------------------------------

// XP mapping: 3 base + up to 36 from average per-rep quality (0..1).
// Perfect session ~= 39 XP (page converts to +stat via Math.floor(xp/5)).
function qualitiesToXp(qualities: number[], reps: number): number {
  if (qualities.length === 0) return 3;
  const avg = qualities.reduce((a, b) => a + b, 0) / reps;
  return Math.max(3, Math.min(40, Math.round(3 + avg * 36)));
}

// Collects per-rep quality scores, projects XP, and fires onFinish once.
function useDrillScore(reps: number, onFinish: (xp: number) => void) {
  const [qualities, setQualities] = useState<number[]>([]);
  const finishedRef = useRef(false);

  const push = (q: number) =>
    setQualities((prev) => (prev.length >= reps ? prev : [...prev, q]));

  useEffect(() => {
    if (qualities.length === reps && !finishedRef.current) {
      finishedRef.current = true;
      const xp = qualitiesToXp(qualities, reps);
      const t = setTimeout(() => onFinish(xp), 850);
      return () => clearTimeout(t);
    }
  }, [qualities, reps, onFinish]);

  const projected = qualitiesToXp(qualities, Math.max(1, qualities.length));
  return { rep: qualities.length, push, projected };
}

// A value that sweeps 0..100 back and forth while `active`, at `speed` units/sec.
function useSweep(active: boolean, speed: number) {
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      posRef.current += dirRef.current * speed * dt;
      if (posRef.current >= 100) {
        posRef.current = 100;
        dirRef.current = -1;
      } else if (posRef.current <= 0) {
        posRef.current = 0;
        dirRef.current = 1;
      }
      setPos(posRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, speed]);
  return pos;
}

function Shell({
  title,
  instruction,
  rep,
  reps,
  xp,
  children,
}: {
  title: string;
  instruction: string;
  rep: number;
  reps: number;
  xp: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-600">
            {Array.from({ length: reps }).map((_, i) => (
              <span key={i} className={`text-sm ${i < rep ? "opacity-100" : "opacity-25"}`}>
                ⚽
              </span>
            ))}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-emerald-300 uppercase tracking-wide">{title}</div>
            <div className="text-xs text-emerald-400 font-bold">Proj. +{xp} XP</div>
          </div>
        </div>
        {children}
        <div className="mt-3 bg-gray-800/90 border border-gray-600 rounded-lg px-3 py-2">
          <div className="text-xs font-bold text-gray-200 text-center">{instruction}</div>
        </div>
      </div>
    </div>
  );
}

function Flash({ text, good }: { text: string; good: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <div
        className={`text-3xl font-black ${
          good ? "text-emerald-300" : "text-red-400"
        } drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]`}
      >
        {text}
      </div>
    </div>
  );
}

const PITCH_BG = "radial-gradient(circle at 50% 35%, #16a34a 0%, #15803d 45%, #14532d 100%)";

// -------------------------------------------------------------------------
// 1. PACE — Sprint Reaction (reaction-time test)
// -------------------------------------------------------------------------
function PaceDrill({ onFinish }: { onFinish: (xp: number) => void }) {
  const REPS = 4;
  const { rep, push, projected } = useDrillScore(REPS, onFinish);
  const [phase, setPhase] = useState<"wait" | "go" | "result">("wait");
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const goTimeRef = useRef(0);

  // Schedule the green light after a random delay each rep.
  useEffect(() => {
    if (phase !== "wait") return;
    const delay = 900 + Math.random() * 2000;
    const t = setTimeout(() => {
      goTimeRef.current = performance.now();
      setPhase("go");
    }, delay);
    return () => clearTimeout(t);
  }, [phase, rep]);

  // After showing a result, advance to the next rep.
  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(() => {
      setFlash(null);
      if (rep < REPS) setPhase("wait");
    }, 950);
    return () => clearTimeout(t);
  }, [phase, rep]);

  const tap = () => {
    if (phase === "wait") {
      // False start.
      setFlash({ text: "TOO SOON ⚠", good: false });
      push(0);
      setPhase("result");
    } else if (phase === "go") {
      const ms = Math.round(performance.now() - goTimeRef.current);
      const q = Math.max(0.05, Math.min(1, (560 - ms) / 400));
      setFlash({ text: `${ms} ms`, good: ms < 320 });
      push(q);
      setPhase("result");
    }
  };

  const lit = phase === "go";
  return (
    <Shell
      title="Sprint Reaction"
      instruction="Wait for GREEN, then tap as fast as you can. Tap early = false start."
      rep={rep}
      reps={REPS}
      xp={projected}
    >
      <div
        onPointerDown={tap}
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-700 shadow-2xl select-none cursor-pointer flex items-center justify-center"
        style={{ background: PITCH_BG }}
      >
        <div
          className={`w-40 h-40 rounded-full border-4 flex items-center justify-center transition-colors duration-75 ${
            lit
              ? "bg-emerald-400 border-emerald-200 shadow-[0_0_60px_rgba(52,211,153,0.9)]"
              : phase === "wait"
              ? "bg-red-600 border-red-300"
              : "bg-gray-700 border-gray-500"
          }`}
        >
          <span className="text-2xl font-black text-white drop-shadow">
            {lit ? "GO!" : phase === "wait" ? "WAIT" : "—"}
          </span>
        </div>
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------------------
// 2. POWER — Power Timing (stop the sweeping meter in the sweet zone)
// -------------------------------------------------------------------------
function PowerDrill({ onFinish }: { onFinish: (xp: number) => void }) {
  const REPS = 4;
  const { rep, push, projected } = useDrillScore(REPS, onFinish);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [locked, setLocked] = useState<number | null>(null);

  const speed = 90 + rep * 40;
  const zoneHalf = Math.max(6, 20 - rep * 3);
  const pos = useSweep(!busy, speed);
  const shown = busy && locked !== null ? locked : pos;

  const tap = () => {
    if (busy) return;
    const offset = Math.abs(pos - 50);
    const q = Math.max(0, 1 - offset / 38);
    const good = offset <= zoneHalf;
    setLocked(pos);
    setBusy(true);
    setFlash({ text: good ? "POWER!" : "WEAK", good });
    push(q);
    setTimeout(() => {
      setFlash(null);
      setLocked(null);
      setBusy(false);
    }, 900);
  };

  return (
    <Shell
      title="Power Timing"
      instruction="Tap to stop the marker inside the bright zone. Dead-centre = max power."
      rep={rep}
      reps={REPS}
      xp={projected}
    >
      <div
        onPointerDown={tap}
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-700 shadow-2xl select-none cursor-pointer flex flex-col items-center justify-center gap-6"
        style={{ background: PITCH_BG }}
      >
        <div className="text-5xl">🥅</div>
        <div className="relative w-[82%] h-10 rounded-full bg-gray-900/70 border-2 border-gray-600 overflow-hidden">
          {/* sweet zone */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-400/40 border-x-2 border-emerald-300"
            style={{ left: `${50 - zoneHalf}%`, width: `${zoneHalf * 2}%` }}
          />
          {/* marker */}
          <div
            className="absolute top-[-3px] bottom-[-3px] w-1.5 bg-yellow-300 shadow-[0_0_10px_rgba(253,224,71,0.9)]"
            style={{ left: `calc(${shown}% - 3px)` }}
          />
        </div>
        <div className="text-xs font-black text-emerald-200/80">SWEET ZONE</div>
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------------------
// 3. TECHNIQUE — Curl Control (thread the ball through a moving gap)
// -------------------------------------------------------------------------
function TechniqueDrill({ onFinish }: { onFinish: (xp: number) => void }) {
  const REPS = 4;
  const { rep, push, projected } = useDrillScore(REPS, onFinish);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [locked, setLocked] = useState<number | null>(null);

  const speed = 70 + rep * 32;
  const gapHalf = Math.max(7, 16 - rep * 2.5);
  const raw = useSweep(!busy, speed);
  const gapCenter = 18 + (busy && locked !== null ? locked : raw) * 0.64; // 18..82

  const tap = () => {
    if (busy) return;
    const center = 18 + raw * 0.64;
    const offset = Math.abs(center - 50); // ball launches from x=50
    const q = Math.max(0, 1 - offset / 34);
    const good = offset <= gapHalf;
    setLocked(raw);
    setBusy(true);
    setFlash({ text: good ? "THREADED!" : "BLOCKED", good });
    push(q);
    setTimeout(() => {
      setFlash(null);
      setLocked(null);
      setBusy(false);
    }, 900);
  };

  return (
    <Shell
      title="Curl Control"
      instruction="Tap to curl the ball up through the gap between the defenders."
      rep={rep}
      reps={REPS}
      xp={projected}
    >
      <div
        onPointerDown={tap}
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-700 shadow-2xl select-none cursor-pointer"
        style={{ background: PITCH_BG }}
      >
        {/* defender wall with a gap at ~22% height */}
        <div className="absolute left-0 right-0" style={{ top: "22%", height: "9%" }}>
          <div
            className="absolute top-0 bottom-0 bg-gray-800 border-y-2 border-gray-500 rounded-r-md"
            style={{ left: 0, width: `${Math.max(0, gapCenter - gapHalf)}%` }}
          />
          <div
            className="absolute top-0 bottom-0 bg-gray-800 border-y-2 border-gray-500 rounded-l-md"
            style={{ left: `${gapCenter + gapHalf}%`, right: 0 }}
          />
          {/* gap glow */}
          <div
            className="absolute top-0 bottom-0 border-x-2 border-emerald-300/70"
            style={{ left: `${gapCenter - gapHalf}%`, width: `${gapHalf * 2}%` }}
          />
        </div>

        {/* ball rising from the bottom centre */}
        <div
          className="absolute w-5 h-5 rounded-full bg-white border-2 border-black -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: "50%", top: busy ? "10%" : "85%" }}
        />
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------------------
// 4. VISION — Spot the Runner (remember which teammate was in space)
// -------------------------------------------------------------------------
type Runners = { dots: { x: number; y: number }[]; open: number };

function makeRunners(): Runners {
  const n = 4 + Math.floor(Math.random() * 3); // 4..6
  const dots: { x: number; y: number }[] = [];
  let guard = 0;
  while (dots.length < n && guard < 500) {
    guard++;
    const x = 16 + Math.random() * 68;
    const y = 20 + Math.random() * 60;
    if (dots.every((d) => Math.hypot(d.x - x, d.y - y) > 24)) dots.push({ x, y });
  }
  return { dots, open: Math.floor(Math.random() * dots.length) };
}

function VisionDrill({ onFinish }: { onFinish: (xp: number) => void }) {
  const REPS = 5;
  const { rep, push, projected } = useDrillScore(REPS, onFinish);
  const [cfg, setCfg] = useState<Runners>(() => makeRunners());
  const [phase, setPhase] = useState<"reveal" | "recall" | "flash">("reveal");
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const recallStartRef = useRef(0);

  // Reveal window, then hide the highlight and defenders.
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => {
      recallStartRef.current = performance.now();
      setPhase("recall");
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, rep]);

  // After a pick, advance to the next round (unless finished).
  useEffect(() => {
    if (phase !== "flash") return;
    const t = setTimeout(() => {
      setFlash(null);
      if (rep < REPS) {
        setCfg(makeRunners());
        setPhase("reveal");
      }
    }, 950);
    return () => clearTimeout(t);
  }, [phase, rep]);

  const pick = (i: number) => {
    if (phase !== "recall") return;
    const ms = performance.now() - recallStartRef.current;
    const correct = i === cfg.open;
    const q = correct ? Math.max(0.35, Math.min(1, (2000 - ms) / 1700)) : 0;
    setFlash({ text: correct ? "GREAT BALL!" : "OFFSIDE", good: correct });
    push(q);
    setPhase("flash");
  };

  return (
    <Shell
      title="Spot the Runner"
      instruction="One teammate is in space (green). Remember them, then pick them after they blend in."
      rep={rep}
      reps={REPS}
      xp={projected}
    >
      <div
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-700 shadow-2xl select-none"
        style={{ background: PITCH_BG }}
      >
        {cfg.dots.map((d, i) => {
          const isOpen = i === cfg.open;
          const revealing = phase === "reveal";
          return (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${d.x}%`, top: `${d.y}%` }}>
              {/* defender marker near occupied runners during reveal */}
              {revealing && !isOpen && (
                <div className="absolute w-4 h-4 rounded-full bg-red-500 border border-red-200" style={{ left: 12, top: -12 }} />
              )}
              <button
                onPointerDown={() => pick(i)}
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-black transition-colors ${
                  revealing && isOpen
                    ? "bg-emerald-400 border-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.95)] text-emerald-950"
                    : "bg-sky-500 border-sky-200 text-white"
                } ${phase === "recall" ? "cursor-pointer active:scale-95" : "cursor-default"}`}
              >
                {revealing && isOpen ? "★" : ""}
              </button>
            </div>
          );
        })}

        {phase === "recall" && (
          <div className="absolute top-2 left-2 right-2 text-center text-xs font-black text-yellow-200 drop-shadow">
            Who was open?
          </div>
        )}
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------------------
// 5. FREEKICK — Set-Piece Target (time the aim, beat the keeper, hit the target)
// -------------------------------------------------------------------------
type FKConfig = { targetX: number; keeperX: number; tol: number };

function makeFK(rep: number): FKConfig {
  const tol = Math.max(8, 18 - rep * 3);
  let targetX = 50;
  let keeperX = 50;
  let guard = 0;
  do {
    targetX = 18 + Math.random() * 64;
    keeperX = 18 + Math.random() * 64;
    guard++;
  } while (Math.abs(targetX - keeperX) < 18 && guard < 60);
  return { targetX, keeperX, tol };
}

function FreeKickDrill({ onFinish }: { onFinish: (xp: number) => void }) {
  const REPS = 4;
  const { rep, push, projected } = useDrillScore(REPS, onFinish);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [cfg, setCfg] = useState<FKConfig>(() => makeFK(0));
  const [locked, setLocked] = useState<number | null>(null);

  const speed = 80 + rep * 32;
  const raw = useSweep(!busy, speed);
  const aimX = 8 + (busy && locked !== null ? locked : raw) * 0.84; // 8..92
  const keeperHalf = 7;

  const tap = () => {
    if (busy) return;
    const aim = 8 + raw * 0.84;
    const saved = Math.abs(aim - cfg.keeperX) <= keeperHalf;
    const offset = Math.abs(aim - cfg.targetX);
    let q = 0;
    let text = "SAVED!";
    let good = false;
    if (!saved) {
      q = Math.max(0, 1 - offset / 30);
      good = offset <= cfg.tol;
      text = good ? "TOP BINS!" : q > 0.3 ? "ON TARGET" : "WIDE";
    }
    setLocked(raw);
    setBusy(true);
    setFlash({ text, good });
    push(q);
    setTimeout(() => {
      setFlash(null);
      setLocked(null);
      setCfg(makeFK(Math.min(REPS - 1, rep + 1)));
      setBusy(false);
    }, 950);
  };

  return (
    <Shell
      title="Set-Piece Target"
      instruction="Tap when the aim lines up with the ★ target — avoid the keeper's dive."
      rep={rep}
      reps={REPS}
      xp={projected}
    >
      <div
        onPointerDown={tap}
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-700 shadow-2xl select-none cursor-pointer"
        style={{ background: PITCH_BG }}
      >
        {/* goal frame */}
        <div className="absolute left-[6%] right-[6%] top-[8%] h-[26%] border-4 border-white/90 rounded-sm bg-white/5">
          {/* keeper */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-14 rounded-md bg-yellow-400 border-2 border-yellow-200 flex items-center justify-center text-lg"
            style={{ left: `${((cfg.keeperX - 8) / 84) * 100}%` }}
          >
            🧤
          </div>
          {/* target */}
          <div
            className="absolute top-2 -translate-x-1/2 text-yellow-300 text-2xl drop-shadow-[0_0_6px_rgba(0,0,0,0.7)]"
            style={{ left: `${((cfg.targetX - 8) / 84) * 100}%` }}
          >
            ★
          </div>
        </div>

        {/* wall */}
        <div className="absolute left-[30%] right-[30%] top-[52%] h-8 flex justify-around">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-4 h-8 rounded-t bg-gray-800 border border-gray-500" />
          ))}
        </div>

        {/* moving aim line */}
        <div
          className="absolute top-[8%] h-[46%] w-0.5 bg-red-400/80"
          style={{ left: `${aimX}%` }}
        >
          <div className="absolute -top-1 -left-[7px] text-red-300 text-sm">✛</div>
        </div>

        {/* ball travels to the aim point */}
        <div
          className="absolute w-5 h-5 rounded-full bg-white border-2 border-black -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-out"
          style={{ left: busy ? `${aimX}%` : "50%", top: busy ? "20%" : "82%" }}
        />
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// -------------------------------------------------------------------------
// Completion summary
// -------------------------------------------------------------------------
function CompleteScreen({ title, xp }: { title: string; xp: number }) {
  const rating =
    xp >= 32 ? "World Class" : xp >= 22 ? "Great Session" : xp >= 12 ? "Solid Work" : "Keep Grinding";
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col items-center justify-center py-3 px-3">
      <div className="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-xl p-6 text-center shadow-2xl">
        <div className="text-4xl mb-2">🏆</div>
        <div className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">Session Complete</div>
        <div className="text-lg font-black text-white mt-1">{title}</div>
        <div className="mt-4 text-5xl font-black text-emerald-400">+{xp}</div>
        <div className="text-xs font-bold text-emerald-300 uppercase tracking-wide">XP Earned</div>
        <div className="mt-3 inline-block bg-emerald-500/20 border border-emerald-400 rounded-lg px-4 py-1.5 text-sm font-black text-emerald-200">
          {rating}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Router
// -------------------------------------------------------------------------
export default function TrainingMinigame({ skill, onComplete }: Props) {
  const [result, setResult] = useState<number | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (result !== null && !calledRef.current) {
      calledRef.current = true;
      const t = setTimeout(() => onComplete(result), 1100);
      return () => clearTimeout(t);
    }
  }, [result, onComplete]);

  if (result !== null) {
    return <CompleteScreen title={SKILL_TITLES[skill]} xp={result} />;
  }

  switch (skill) {
    case "pace":
      return <PaceDrill onFinish={setResult} />;
    case "power":
      return <PowerDrill onFinish={setResult} />;
    case "technique":
      return <TechniqueDrill onFinish={setResult} />;
    case "vision":
      return <VisionDrill onFinish={setResult} />;
    case "freeKick":
      return <FreeKickDrill onFinish={setResult} />;
    default:
      return <PaceDrill onFinish={setResult} />;
  }
}
