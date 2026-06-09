"use client";
import { useState } from "react";
import { FORMATIONS } from "./formations";
import type { DraftSettings } from "@/app/draft/page";

interface Props {
  onStart: (settings: DraftSettings) => void;
}

export default function DraftSetup({ onStart }: Props) {
  const [formation, setFormation] = useState("4-3-3");
  const [eraStart, setEraStart] = useState(2007);
  const [eraEnd, setEraEnd] = useState(2026);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-lg w-full">
        <h1 className="text-4xl font-bold text-center mb-2">
          Premier League Draft
        </h1>
        <p className="text-gray-400 text-center mb-10">
          Build your dream XI from random club rosters across FIFA history
        </p>

        {/* Formation */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Formation
          </label>
          <div className="grid grid-cols-4 gap-2">
            {FORMATIONS.map((f) => (
              <button
                key={f.name}
                onClick={() => setFormation(f.name)}
                className={`py-3 px-2 rounded-lg text-sm font-bold transition ${
                  formation === f.name
                    ? "bg-green-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Era Range */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Era Range
          </label>
          <div className="flex items-center gap-3">
            <select
              value={eraStart}
              onChange={(e) => setEraStart(Number(e.target.value))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-sm"
            >
              {Array.from({ length: 20 }, (_, i) => 2007 + i).map((y) => (
                <option key={y} value={y}>
                  {y >= 2024 ? `FC ${String(y % 100).padStart(2, "0")}` : `FIFA ${String(y % 100).padStart(2, "0")}`} ({y})
                </option>
              ))}
            </select>
            <span className="text-gray-500 font-bold">to</span>
            <select
              value={eraEnd}
              onChange={(e) => setEraEnd(Number(e.target.value))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-sm"
            >
              {Array.from({ length: 20 }, (_, i) => 2007 + i).map((y) => (
                <option key={y} value={y}>
                  {y >= 2024 ? `FC ${String(y % 100).padStart(2, "0")}` : `FIFA ${String(y % 100).padStart(2, "0")}`} ({y})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Formation Preview */}
        <div className="mb-8">
          <div className="relative w-full aspect-[3/4] bg-green-900/30 rounded-xl border border-green-800/50 overflow-hidden">
            {/* Pitch lines */}
            <div className="absolute inset-x-[10%] top-[5%] bottom-[5%] border border-green-700/40 rounded" />
            <div className="absolute inset-x-[10%] top-[5%] h-[18%] border-b border-green-700/40" />
            <div className="absolute inset-x-[10%] bottom-[5%] h-[18%] border-t border-green-700/40" />
            <div className="absolute left-1/2 top-[5%] bottom-[5%] w-px bg-green-700/40" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-green-700/40" />

            {/* Players */}
            {FORMATIONS.find((f) => f.name === formation)?.slots.map(
              (slot, i) => (
                <div
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-500 flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    {slot.label}
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={() => onStart({ formation, eraStart, eraEnd })}
          className="w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl text-lg font-bold transition"
        >
          Start Draft
        </button>
      </div>
    </div>
  );
}
