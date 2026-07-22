"use client";
import { useState } from "react";
import type { Dilemma, DilemmaEffect } from "@/lib/star/dilemmas";

interface Props {
  dilemma: Dilemma;
  onChoose: (effects: DilemmaEffect, narrative?: string) => void;
}

export default function DilemmaModal({ dilemma, onChoose }: Props) {
  const [chosen, setChosen] = useState<number | null>(null);

  const handle = (i: number) => {
    setChosen(i);
    setTimeout(() => {
      onChoose(dilemma.choices[i].effects, dilemma.choices[i].narrative);
    }, 1200);
  };

  const categoryColor = {
    team: "bg-blue-600",
    manager: "bg-yellow-600",
    media: "bg-purple-600",
    sponsor: "bg-pink-600",
    partner: "bg-red-600",
    financial: "bg-emerald-600",
    training: "bg-orange-600",
    fan: "bg-indigo-600",
    agent: "bg-slate-600",
    lifestyle: "bg-teal-600",
    charity: "bg-rose-600",
  }[dilemma.category];

  const chosenChoice = chosen !== null ? dilemma.choices[chosen] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex items-center justify-center py-4 px-3">
      <div className="w-full max-w-sm">
        <div className={`${categoryColor} text-white text-center py-2 rounded-t-2xl border-2 border-b-0 border-black/40 font-black text-xs tracking-widest uppercase`}>
          {dilemma.category}
        </div>
        <div className="bg-gray-700 border-2 border-t-0 border-b-0 border-black/40 p-4">
          <div className="text-lg font-black text-white text-center mb-2">{dilemma.title}</div>
          <div className="text-sm text-gray-200 text-center leading-snug">{dilemma.text}</div>
        </div>

        {!chosenChoice && (
          <div className="bg-gray-800 border-2 border-t-0 border-black/40 rounded-b-2xl p-3 space-y-2">
            {dilemma.choices.map((c, i) => (
              <button
                key={i}
                onClick={() => handle(i)}
                className="w-full bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg py-3 px-3 text-left transition active:scale-[0.98]"
              >
                <div className="font-black text-white text-sm">{c.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                  {formatEffects(c.effects)}
                </div>
              </button>
            ))}
          </div>
        )}

        {chosenChoice && (
          <div className="bg-emerald-800 border-2 border-t-0 border-black/40 rounded-b-2xl p-4 text-center">
            <div className="text-xs uppercase font-black text-emerald-300 tracking-widest mb-1">Choice made</div>
            <div className="text-sm font-black text-white">{chosenChoice.label}</div>
            {chosenChoice.narrative && (
              <div className="mt-2 text-xs text-emerald-100 italic">{chosenChoice.narrative}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatEffects(effects: DilemmaEffect): React.ReactElement[] {
  const entries: React.ReactElement[] = [];
  const labels: Record<string, string> = {
    energy: "Energy", money: "★", happiness: "Happy", matchFitness: "Fit",
    boss: "Boss", team: "Team", fans: "Fans", sponsors: "Sponsors", fame: "Fame",
    pace: "Pace", power: "Power", technique: "Tech", vision: "Vision", freeKick: "FK",
  };
  Object.entries(effects).forEach(([k, v]) => {
    if (typeof v !== "number" || v === 0) return;
    const positive = v > 0;
    entries.push(
      <span key={k} className={positive ? "text-emerald-400" : "text-red-400"}>
        {labels[k] ?? k} {positive ? "+" : ""}{v}
      </span>
    );
  });
  return entries;
}
