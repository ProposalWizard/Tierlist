"use client";
import type { Skills } from "@/lib/star/types";

/**
 * The how-it-works card shown before level 1 of each training game (Mikey,
 * 25 Sep 2026: "a very short, small tutorial or pop-up… doesn't have to be
 * many words, just something that tells you how it works"). A small drawing,
 * three short lines, the star rule, one button.
 */

const INTRO: Record<keyof Skills, { title: string; steps: string[] }> = {
  power: {
    title: "Long Range",
    steps: ["Drag back from the ball to aim and set power", "Pick where you strike the ball", "Score past the blockers and the keeper"],
  },
  technique: {
    title: "Through the Gate",
    steps: ["Drag back from the ball to aim and set power", "Strike it off-centre to bend it", "Get it between the two cones"],
  },
  freeKick: {
    title: "Over the Wall",
    steps: ["Drag back from the ball to aim and set power", "Lift it over the wall or bend it round", "Score past the keeper"],
  },
  pace: {
    title: "The Gauntlet",
    steps: ["Drag or tap left and right to move", "Wait for each man to commit", "Flick the other way to burst past, and reach the line"],
  },
  vision: {
    title: "Read the Run",
    steps: ["Watch the countdown: 3, 2, 1, GO", "Find the free team-mate who is onside", "Tap him before the bar runs out"],
  },
};

const G = "#34d399";   // you / good
const R = "#ef4444";   // opponents
const W = "#ffffff";

function Figure({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g>
      <circle cx={x} cy={y - 9} r={4} fill="#f1c7a0" />
      <rect x={x - 5} y={y - 5} width={10} height={10} rx={3} fill={c} />
    </g>
  );
}

function Picture({ skill }: { skill: keyof Skills }) {
  const ball = (x: number, y: number) => <circle cx={x} cy={y} r={4} fill={W} stroke="#0f172a" strokeWidth={1.2} />;
  const goal = <rect x={70} y={8} width={60} height={12} fill="none" stroke={W} strokeWidth={2} />;
  const arrow = (x1: number, y1: number, x2: number, y2: number, curve = 0) => (
    <path d={`M${x1} ${y1} Q ${(x1 + x2) / 2 + curve} ${(y1 + y2) / 2} ${x2} ${y2}`} fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="5 4" strokeLinecap="round" />
  );
  return (
    <svg viewBox="0 0 200 120" className="w-full" aria-hidden>
      <rect x={0} y={0} width={200} height={120} rx={10} fill="#166534" />
      {skill === "power" && (<>
        {goal}
        <Figure x={100} y={28} c="#facc15" />
        <Figure x={85} y={62} c={R} /><Figure x={118} y={70} c={R} />
        {arrow(100, 104, 122, 16, 0)}
        {ball(100, 104)}
      </>)}
      {skill === "technique" && (<>
        <path d="M78 34 l6 -10 l6 10 z" fill="#f97316" /><path d="M118 34 l6 -10 l6 10 z" fill="#f97316" />
        {arrow(70, 104, 104, 28, -40)}
        {ball(70, 104)}
      </>)}
      {skill === "freeKick" && (<>
        {goal}
        <Figure x={82} y={60} c={R} /><Figure x={94} y={60} c={R} /><Figure x={106} y={60} c={R} />
        <Figure x={100} y={28} c="#facc15" />
        {arrow(96, 106, 122, 16, 50)}
        {ball(96, 106)}
      </>)}
      {skill === "pace" && (<>
        <line x1={20} y1={14} x2={180} y2={14} stroke={G} strokeWidth={3} />
        <Figure x={78} y={48} c={R} /><Figure x={128} y={60} c={R} />
        <Figure x={100} y={104} c={G} />
        <path d="M100 90 L 70 70 L 104 30" fill="none" stroke="#fbbf24" strokeWidth={2.5} strokeDasharray="5 4" strokeLinecap="round" />
      </>)}
      {skill === "vision" && (<>
        <line x1={10} y1={46} x2={190} y2={46} stroke="#facc15" strokeWidth={2} strokeDasharray="6 4" />
        <Figure x={50} y={36} c={G} />
        <Figure x={60} y={62} c={R} /><Figure x={150} y={60} c={R} /><Figure x={170} y={88} c={R} />
        <Figure x={70} y={70} c={G} />
        <Figure x={110} y={84} c={G} />
        <circle cx={110} cy={80} r={12} fill="none" stroke="#fbbf24" strokeWidth={2.5} />
        {ball(100, 112)}
      </>)}
    </svg>
  );
}

export default function TrainingIntro({ skill, onStart }: { skill: keyof Skills; onStart: () => void }) {
  const it = INTRO[skill];
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 text-white flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm rounded-2xl border border-gray-600 bg-gray-800 p-5 shadow-2xl">
        <div className="text-[11px] font-black uppercase tracking-widest text-emerald-300">Level 1 · How it works</div>
        <div className="mt-1 text-2xl font-black text-white">{it.title}</div>
        <div className="mt-3 overflow-hidden rounded-xl">
          <Picture skill={skill} />
        </div>
        <ol className="mt-4 space-y-2">
          {it.steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-400 text-xs font-black text-emerald-950">{i + 1}</span>
              <span className="text-sm font-bold text-white">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-900/70 px-3 py-2 text-xs font-black">
          <span className="text-white">3 tries</span>
          <span className="text-amber-300">1st ★★★</span>
          <span className="text-amber-300">2nd ★★</span>
          <span className="text-amber-300">3rd ★</span>
        </div>
        <button
          onClick={onStart}
          className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-base font-black text-emerald-950 active:scale-[0.98]"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
