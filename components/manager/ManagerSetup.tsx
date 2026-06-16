"use client";
import { useState } from "react";
import Link from "next/link";
import { FORMATIONS } from "@/components/draft/formations";

interface Props {
  onStart: (formation: string) => void;
}

export default function ManagerSetup({ onStart }: Props) {
  const [formation, setFormation] = useState("4-3-3");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950">
      {/* Subtle nav */}
      <div className="border-b border-gray-900/50 backdrop-blur-sm sticky top-0 z-10 bg-black/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">← knowitball</Link>
          <Link href="/draft" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">draft mode →</Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Beta · Manager Mode</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            The Chairman
          </h1>
          <p className="text-gray-500 text-sm mt-3 max-w-md mx-auto">
            £500M to build your squad. 38 matches to prove yourself.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 rounded-2xl border border-gray-800/50 p-5 mb-6">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">How it works</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex gap-3">
              <span className="text-amber-400 font-black">1</span>
              <div className="text-gray-300">Build your XI + 3 subs in the <span className="text-white font-semibold">Transfer Market</span> using a £500M budget.</div>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400 font-black">2</span>
              <div className="text-gray-300">Play through the season — <span className="text-white font-semibold">live match events</span> with goals, fouls, near misses.</div>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400 font-black">3</span>
              <div className="text-gray-300">Make subs at <span className="text-white font-semibold">halftime</span> — fresh legs get a chance bonus.</div>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400 font-black">4</span>
              <div className="text-gray-300">Mid-season <span className="text-white font-semibold">transfer window</span> — buy and sell to reshape the squad.</div>
            </div>
          </div>
        </div>

        {/* Formation picker */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800/50 p-5 mb-6">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">Formation</h3>
          <div className="grid grid-cols-4 gap-2">
            {FORMATIONS.map(f => (
              <button
                key={f.name}
                onClick={() => setFormation(f.name)}
                className={`py-3 rounded-lg text-sm font-bold transition-all border-2 ${
                  formation === f.name
                    ? "border-amber-500 bg-amber-500/10 text-amber-300 scale-105"
                    : "border-gray-800 bg-gray-950 text-gray-500 hover:border-gray-700"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={() => onStart(formation)}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black py-4 rounded-xl text-base tracking-wide transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99]"
        >
          Start Career →
        </button>

        <p className="text-center text-[10px] text-gray-700 mt-4">
          A separate experiment from <Link href="/draft" className="underline">Draft Mode</Link> — your draft progress is safe.
        </p>
      </div>
    </div>
  );
}
