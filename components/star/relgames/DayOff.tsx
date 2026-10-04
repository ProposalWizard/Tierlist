"use client";

/**
 * DAY OFF — your own happiness. Pick how to spend it; dearer days lift you
 * more. No way to fail. Costs scale with your weekly wage so the choice is
 * the same at every level of the game.
 */
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { GameShell, ResultPanel, type GameResult } from "./Shell";

export function dayOffOptions(career: Pick<CareerState, "contract" | "ownedItems">) {
  const wage = Math.max(1, career.contract?.wage ?? 0);
  const hasGarden = (career.ownedItems ?? []).some((i) => i.category === "property");
  return [
    { id: "home", icon: hasGarden ? "🏡" : "🛋️", name: hasGarden ? "Chill in the garden" : "Put your feet up", gain: hasGarden ? 7 : 5, cost: 0 },
    { id: "golf", icon: "⛳", name: "A round of golf", gain: 9, cost: Math.round(wage * 0.2) },
    { id: "trip", icon: "✈️", name: "A weekend away", gain: 14, cost: Math.round(wage * 0.6) },
  ];
}

export default function DayOff({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = career.happiness;
  const [result, setResult] = useState<GameResult | null>(null);
  const opts = dayOffOptions(career);
  return (
    <GameShell title="Day off" who="You" current={current} tone="#c084fc" onBack={result ? undefined : onCancel}>
      {!result && (
        <div className="space-y-2">
          <div className="text-[14px] font-bold">How do you want to spend it? Happier players get more energy back when they rest.</div>
          {opts.map((o) => {
            const short = o.cost > career.money;
            return (
              <button key={o.id} disabled={short} data-dayoff={o.id}
                onClick={() => setResult({ won: true, gain: Math.min(o.gain, 100 - current), cost: o.cost, line: `${o.name}. Just what you needed.` })}
                className="kib-press flex w-full items-center gap-3 bg-purple-500/20 px-3 py-3 text-left ring-1 ring-purple-300/60 disabled:opacity-40" style={{ borderRadius: 4 }}>
                <span className="text-[28px] leading-none">{o.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-black">{o.name}</span>
                  <span className="block text-[12px] font-bold">{o.cost ? `★${o.cost.toLocaleString("en-GB")}` : "Free"}{short ? " · not enough money" : ""}</span>
                </span>
                <span className="text-[15px] font-black text-purple-200">+{o.gain}</span>
              </button>
            );
          })}
        </div>
      )}
      {result && <ResultPanel result={result} who="Happiness" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}
