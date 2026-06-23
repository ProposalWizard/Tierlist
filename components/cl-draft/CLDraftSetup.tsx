"use client";
import { useState } from "react";
import { FORMATIONS, type Formation } from "@/components/draft/formations";

export interface CLDraftSettings {
  formation: string;
  eraStart: number;
  eraEnd: number;
}

interface Props {
  onStart: (settings: CLDraftSettings) => void;
}

export default function CLDraftSetup({ onStart }: Props) {
  const [formation, setFormation] = useState("4-3-3");
  const [eraStart, setEraStart] = useState(2007);
  const [eraEnd, setEraEnd] = useState(2026);

  const years = Array.from({ length: 20 }, (_, i) => 2007 + i);
  const selectedFormation = FORMATIONS.find(f => f.name === formation) ?? FORMATIONS[1];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Champions League Draft</h1>
          <p className="text-gray-400 text-lg">Draft players from Champions League squads across history</p>
          <p className="text-yellow-400 text-sm mt-2">TEST MODE — Admin Only</p>
        </div>

        {/* Formation picker */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Formation</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {FORMATIONS.map((f: Formation) => (
              <button
                key={f.name}
                onClick={() => setFormation(f.name)}
                className={`px-3 py-2 rounded text-sm font-mono transition-colors ${
                  formation === f.name ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>

          {/* Mini pitch preview */}
          <div className="mt-4 relative w-full max-w-xs mx-auto aspect-[3/4] bg-green-900/30 rounded-lg border border-green-700/40 overflow-hidden">
            <div className="absolute inset-0">
              {selectedFormation.slots.map((slot, i) => (
                <div
                  key={i}
                  className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-[10px] font-bold"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  {slot.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Era range */}
        <div>
          <h2 className="text-lg font-semibold mb-3">CL Era Range</h2>
          <p className="text-gray-400 text-sm mb-3">Which Champions League seasons to include in the draft pool</p>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">From</label>
              <select
                value={eraStart}
                onChange={e => {
                  const v = Number(e.target.value);
                  setEraStart(v);
                  if (v > eraEnd) setEraEnd(v);
                }}
                className="bg-gray-700 rounded px-3 py-2 text-white"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                ))}
              </select>
            </div>
            <span className="text-gray-500 mt-5">—</span>
            <div>
              <label className="text-sm text-gray-400 block mb-1">To</label>
              <select
                value={eraEnd}
                onChange={e => setEraEnd(Number(e.target.value))}
                className="bg-gray-700 rounded px-3 py-2 text-white"
              >
                {years.filter(y => y >= eraStart).map(y => (
                  <option key={y} value={y}>{y - 1}/{String(y % 100).padStart(2, "0")}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 space-y-2">
          <h3 className="font-semibold text-white">How it works</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Spin for a random Champions League team from a random CL season</li>
            <li>Pick one player from that squad to add to your team</li>
            <li>Build a full XI + 3 subs (14 picks total)</li>
            <li>Play 5 Champions League campaigns — objective: win the UCL</li>
            <li>Watch matches unfold minute-by-minute</li>
          </ul>
        </div>

        <button
          onClick={() => onStart({ formation, eraStart, eraEnd })}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-xl font-bold transition-colors"
        >
          Start Draft
        </button>
      </div>
    </div>
  );
}
