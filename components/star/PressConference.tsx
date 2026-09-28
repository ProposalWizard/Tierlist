"use client";
import { useState } from "react";
import type { PressQuestion, PressOption } from "@/lib/star/media";
import { FloatText, PressButton, Shine } from "./ui";
import { Screen, Kicker } from "./ui/Screen";

/**
 * A dilemma with a cause. It only exists because of something that just
 * happened, and it is the one place in the career where the player gets to have
 * a personality.
 *
 * Wave 2 reskin (28 Sep 2026): the press room — camera flashes either side,
 * the question dropping in, answers rising one after another, and your pick
 * floating its boss/team/fans changes up off the card. Same three answers,
 * same numbers.
 */
export default function PressConference({ question, onAnswer }: {
  question: PressQuestion;
  onAnswer: (option: PressOption) => void;
}) {
  const [chosen, setChosen] = useState<PressOption | null>(null);

  return (
    <Screen glow="#0ea5e9" className="max-w-sm px-3 py-6">
      <div className="relative w-full">
        {/* The photographers. */}
        <div className="kit-camera-flash pointer-events-none absolute -left-1 top-0 text-xl">📸</div>
        <div className="kit-camera-flash pointer-events-none absolute -right-1 top-6 text-xl" style={{ animationDelay: "1.2s" }}>📸</div>

        <div className="text-center">
          <Kicker color="#7dd3fc">{question.headline}</Kicker>
          <h1 className="kit-drop-in mt-3 text-xl font-black leading-tight" style={{ textShadow: "0 2px 8px rgba(0,0,0,.6)" }}>{question.question}</h1>
          <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
            {["🎙️", "🎙️", "🎙️"].map((m, i) => <span key={i} className="kit-rise text-lg" style={{ animationDelay: `${300 + i * 90}ms` }}>{m}</span>)}
          </div>
        </div>

        {!chosen && (
          <div className="mt-4 space-y-2">
            {question.options.map((o, i) => (
              <button
                key={o.label}
                onClick={() => setChosen(o)}
                className="kit-card kit-rise kib-press w-full p-3 text-left"
                style={{ animationDelay: `${450 + i * 110}ms` }}
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
            <div className="kit-card kit-slam relative overflow-hidden p-4">
              <Shine trigger={1} />
              <div className="text-sm font-black text-white">&ldquo;{chosen.label.replace(/[“”]/g, "")}&rdquo;</div>
              <p className="mt-2 text-xs text-gray-200">{chosen.outcome}</p>
              <div className="relative mt-2 flex gap-2 text-[10px] font-bold">
                <Delta label="Boss" n={chosen.boss} float />
                <Delta label="Team" n={chosen.team} float />
                <Delta label="Fans" n={chosen.fans} float />
              </div>
            </div>
            <PressButton
              variant="primary"
              pulse
              onClick={() => onAnswer(chosen)}
              className="mt-4 w-full py-3"
            >
              Continue
            </PressButton>
          </div>
        )}
      </div>
    </Screen>
  );
}

function Delta({ label, n, float = false }: { label: string; n: number; float?: boolean }) {
  if (n === 0) return <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/85">{label} —</span>;
  return (
    <span className={`relative rounded-full px-2 py-0.5 ${n > 0 ? "bg-emerald-500/25 text-emerald-200" : "bg-red-500/25 text-red-200"}`}>
      {label} {n > 0 ? "+" : ""}{n}
      {float && <FloatText trigger={1} text={`${n > 0 ? "+" : ""}${n}`} color={n > 0 ? "#34d399" : "#f87171"} className="left-1/2 -top-2" size={12} />}
    </span>
  );
}
