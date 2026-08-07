"use client";
import { useState } from "react";
import type { PressQuestion, PressOption } from "@/lib/star/media";

/**
 * A dilemma with a cause. It only exists because of something that just
 * happened, and it is the one place in the career where the player gets to have
 * a personality.
 */
export default function PressConference({ question, onAnswer }: {
  question: PressQuestion;
  onAnswer: (option: PressOption) => void;
}) {
  const [chosen, setChosen] = useState<PressOption | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white px-3 py-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="text-center">
          <div className="inline-block rounded-full border border-sky-400/40 bg-sky-500/15 px-4 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-sky-200">
            {question.headline}
          </div>
          <h1 className="mt-3 text-xl font-black leading-tight">{question.question}</h1>
        </div>

        {!chosen && (
          <div className="mt-5 space-y-2">
            {question.options.map((o) => (
              <button
                key={o.label}
                onClick={() => setChosen(o)}
                className="w-full rounded-xl border border-gray-700 bg-gray-800 p-3 text-left transition hover:bg-gray-700 active:scale-[0.99]"
              >
                <div className="text-sm font-black text-white">{o.label}</div>
                <div className="mt-1 flex gap-2 text-[10px] font-bold">
                  <Delta label="Boss" n={o.boss} />
                  <Delta label="Team" n={o.team} />
                  <Delta label="Fans" n={o.fans} />
                </div>
              </button>
            ))}
          </div>
        )}

        {chosen && (
          <div className="mt-5">
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <div className="text-sm font-black text-white">&ldquo;{chosen.label.replace(/[“”]/g, "")}&rdquo;</div>
              <p className="mt-2 text-xs text-gray-200">{chosen.outcome}</p>
            </div>
            <button
              onClick={() => onAnswer(chosen)}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-black text-white transition hover:bg-emerald-500"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Delta({ label, n }: { label: string; n: number }) {
  if (n === 0) return <span className="rounded-full bg-white/10 px-2 py-0.5 text-gray-300">{label} —</span>;
  return (
    <span className={`rounded-full px-2 py-0.5 ${n > 0 ? "bg-emerald-500/25 text-emerald-200" : "bg-red-500/25 text-red-200"}`}>
      {label} {n > 0 ? "+" : ""}{n}
    </span>
  );
}
