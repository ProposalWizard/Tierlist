"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FirstPersonDribble from "@/components/star/FirstPersonDribble";
import FirstPersonRoam from "@/components/star/FirstPersonRoam";

/**
 * Standalone sandbox for the two first-person dribbling modes — admin-only,
 * not linked in nav, matching the `/star-match-dev` / `/star-scenario-dev`
 * pattern. Neither mode is wired into a real career or touches
 * `lib/star/dribble.ts` beyond READING it unmodified (the open-run mode).
 *
 * The sliders exist specifically because there was no way to visually
 * verify either mode this session (no Supabase credentials, no live
 * browser) — feel (horizon height, telegraph/swipe readability, flick
 * threshold, bob intensity) has to be tuned live once this reaches the
 * real app.
 */
export default function StarDribbleDevPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setState("denied"); return; }
      try {
        const res = await fetch("/api/profile/admin-check");
        const d = res.ok ? await res.json() : { isAdmin: false };
        setState(d.isAdmin ? "ok" : "denied");
      } catch {
        setState("denied");
      }
    });
  }, []);

  const [mode, setMode] = useState<"duel" | "roam">("duel");

  const [pace, setPace] = useState(60);
  const [oppStrength, setOppStrength] = useState(55);
  const [count, setCount] = useState(3);
  const [assist, setAssist] = useState(true);
  const [useFixedSeed, setUseFixedSeed] = useState(false);
  const [seed, setSeed] = useState(1);

  if (state === "loading") {
    return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-sm">Loading…</div>;
  }
  if (state === "denied") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center text-center px-4">
        <div>
          <div className="text-lg font-black mb-1">Admin only</div>
          <div className="text-sm text-gray-400">This is a development sandbox.</div>
        </div>
      </div>
    );
  }

  // Remounts the active mode's component whenever a slider changes, so a
  // fresh run always reflects the current settings.
  const runKey = `${mode}-${pace}-${oppStrength}-${count}-${assist}-${useFixedSeed ? seed : "random"}`;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-3 py-4 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col items-center gap-3">
          <div className="flex rounded-lg bg-white/10 p-1">
            <button
              onClick={() => setMode("duel")}
              className={`px-4 py-1.5 rounded-md text-sm font-bold ${mode === "duel" ? "bg-emerald-500 text-emerald-950" : "text-white/70"}`}
            >
              One-on-one duels
            </button>
            <button
              onClick={() => setMode("roam")}
              className={`px-4 py-1.5 rounded-md text-sm font-bold ${mode === "roam" ? "bg-sky-500 text-sky-950" : "text-white/70"}`}
            >
              Open run (classic dribble)
            </button>
          </div>

          {mode === "duel" ? (
            <FirstPersonDribble
              key={runKey}
              pace={pace}
              oppStrength={oppStrength}
              defenders={count}
              assist={assist}
              seed={useFixedSeed ? seed : undefined}
            />
          ) : (
            <FirstPersonRoam
              key={runKey}
              pace={pace}
              oppStrength={oppStrength}
              chasers={count}
              seed={useFixedSeed ? seed : undefined}
            />
          )}
        </div>

        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="text-lg font-black">Tuning</div>
          <p className="text-xs text-white/50">
            Changing any of these starts a fresh run.
          </p>

          <Slider label="Pace" value={pace} onChange={setPace} />
          <Slider label="Opponent strength" value={oppStrength} onChange={setOppStrength} />

          <div>
            <div className="text-xs font-bold text-white/70 mb-1">
              {mode === "duel" ? "Defenders" : "Chasers"}
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-bold ${
                    count === n ? "bg-emerald-500 text-emerald-950" : "bg-white/10 text-white/70"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {mode === "duel" && (
            <label className="flex items-center justify-between text-xs font-bold text-white/70">
              Open-side assist glow
              <input type="checkbox" checked={assist} onChange={e => setAssist(e.target.checked)} />
            </label>
          )}

          <label className="flex items-center justify-between text-xs font-bold text-white/70">
            Fixed seed (replay the same run)
            <input type="checkbox" checked={useFixedSeed} onChange={e => setUseFixedSeed(e.target.checked)} />
          </label>
          {useFixedSeed && (
            <input
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value) || 1)}
              className="w-full rounded-lg bg-white/10 px-2 py-1 text-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-white/70 mb-1">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
