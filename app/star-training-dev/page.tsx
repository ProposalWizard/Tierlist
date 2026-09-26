"use client";

/**
 * TRAINING LEVELS, ALL OF THEM — a dev screen for playing any level of any
 * training game straight away (Mikey, 25 Sep 2026: "very simply go into
 * vision for example and click on level thirteen… and I can go in and out
 * very easily").
 *
 * Every level plays through the same TrainingMinigame a career uses, so what
 * you see here is the level a player gets. Nothing is saved: no career is
 * touched, no stars are banked.
 */

import { useState } from "react";
import TrainingMinigame from "@/components/star/TrainingMinigame";
import PageGuide from "@/components/admin/PageGuide";
import type { Skills } from "@/lib/star/types";
import { TRAINING_LEVELS, levelDifficulty } from "@/lib/star/trainingLevels";
import { powerDrill, techniqueDrill, freeKickDrill, paceDrill, visionDrill } from "@/lib/star/trainingDrills";

const SKILLS: { key: keyof Skills; label: string }[] = [
  { key: "power", label: "Power" },
  { key: "technique", label: "Technique" },
  { key: "freeKick", label: "Free Kick" },
  { key: "pace", label: "Pace" },
  { key: "vision", label: "Vision" },
];

/** One short line saying what a level asks for — the numbers that change. */
function levelLine(skill: keyof Skills, level: number): string {
  const d = levelDifficulty(level);
  if (skill === "power") { const c = powerDrill(d, 0); return `${c.distance.toFixed(0)}m · ${c.blockers} in way`; }
  if (skill === "technique") { const c = techniqueDrill(d, 0); return `${c.gateDistance.toFixed(0)}m · ${c.gateWidth.toFixed(1)}m gap`; }
  if (skill === "freeKick") { const c = freeKickDrill(d, 0); return `${c.distance.toFixed(0)}m · wall ${c.wall}`; }
  if (skill === "pace") { const c = paceDrill(d, 0); return `${c.chasers} men · ${c.oppStrength.toFixed(0)} spd`; }
  const c = visionDrill(d, 0);
  return `${c.options} options · ${c.window.toFixed(1)}s`;
}

const SKILL_VALUES = [40, 70, 100];

export default function TrainingDev() {
  const [skill, setSkill] = useState<keyof Skills>("power");
  const [level, setLevel] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const [lastStars, setLastStars] = useState<Record<string, number>>({});
  // The player's own skills: they decide how hard you can hit it and how
  // much it bends, so a level plays differently at 40 and at 100.
  const [you, setYou] = useState(40);

  if (level !== null) {
    const go = (n: number) => { setLevel(Math.max(1, Math.min(TRAINING_LEVELS, n))); setRun(r => r + 1); };
    return (
      <>
        <div className="flex items-center justify-between gap-2 bg-gray-950 px-3 py-2">
          <button
            onClick={() => setLevel(null)}
            className="min-h-[40px] rounded-full border border-gray-500 bg-gray-800 px-4 py-1.5 text-sm font-black text-white"
          >
            ‹ All levels
          </button>
          <span className="text-xs font-black text-white">{SKILLS.find(s => s.key === skill)?.label} · skills {you}</span>
          <div className="flex items-center rounded-full border border-gray-500 bg-gray-800">
            <button onClick={() => go(level - 1)} disabled={level <= 1} className="min-h-[40px] min-w-[40px] px-3 py-1.5 text-sm font-black text-white disabled:opacity-40" aria-label="Previous level">◀</button>
            <span className="text-sm font-black text-amber-300 tabular-nums">L{level}</span>
            <button onClick={() => go(level + 1)} disabled={level >= TRAINING_LEVELS} className="min-h-[40px] min-w-[40px] px-3 py-1.5 text-sm font-black text-white disabled:opacity-40" aria-label="Next level">▶</button>
          </div>
        </div>
        <TrainingMinigame
          key={`${skill}-${level}-${run}`}
          skill={skill}
          trainingLevel={level}
          skills={{ pace: you, power: you, technique: you, vision: you, freeKick: you }}
          onComplete={(stars) => {
            setLastStars(s => ({ ...s, [`${skill}-${level}`]: stars }));
            setLevel(null);
          }}
        />
        <PageGuide page="/star-training-dev" />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 px-4 py-4 text-white">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-xl font-black">Training Levels</h1>

        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {SKILLS.map(s => (
            <button
              key={s.key}
              onClick={() => setSkill(s.key)}
              className={`min-h-[40px] rounded-lg px-1 py-2 text-[11px] font-black ${
                skill === s.key ? "bg-emerald-400 text-emerald-950" : "border border-gray-600 bg-gray-800 text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-black text-white">Your skills</span>
          {SKILL_VALUES.map(v => (
            <button
              key={v}
              onClick={() => setYou(v)}
              className={`min-h-[40px] min-w-[48px] rounded-full px-3 py-1 text-sm font-black ${
                you === v ? "bg-amber-300 text-gray-950" : "border border-gray-600 bg-gray-800 text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: TRAINING_LEVELS }, (_, i) => i + 1).map(n => {
            const played = lastStars[`${skill}-${n}`];
            return (
              <button
                key={n}
                onClick={() => { setLevel(n); setRun(r => r + 1); }}
                className="rounded-lg border border-gray-600 bg-gray-800 px-2 py-2 text-left active:scale-95"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-black text-white">{n}</span>
                  {played !== undefined && (
                    <span className="text-[11px] tracking-tight">
                      {[0, 1, 2].map(k => <span key={k} className={k < played ? "text-amber-300" : "text-white/25"}>★</span>)}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] font-bold text-white">{levelLine(skill, n)}</div>
              </button>
            );
          })}
        </div>
      </div>
      <PageGuide page="/star-training-dev" />
    </div>
  );
}
