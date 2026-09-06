"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import FirstPersonDribble from "@/components/star/FirstPersonDribble";

/**
 * Standalone sandbox for the first-person dribbling mode — admin-only, not
 * linked in nav, matching the `/star-match-dev` / `/star-scenario-dev`
 * pattern. Nothing here is wired into a real career; it reads the real
 * match engine only for the final shot (see FirstPersonDribble.tsx), never
 * the other way around.
 *
 * The sliders exist specifically because there was no way to visually
 * verify this feature this session (no Supabase credentials, no live
 * browser) — feel (horizon height, telegraph readability, flick threshold,
 * bob intensity) has to be tuned live once this reaches the real app.
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

  const [pace, setPace] = useState(60);
  const [oppStrength, setOppStrength] = useState(55);
  const [keeperStrength, setKeeperStrength] = useState(55);
  const [defenders, setDefenders] = useState(3);
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-3 py-4 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex justify-center">
          <FirstPersonDribble
            pace={pace}
            oppStrength={oppStrength}
            keeperStrength={keeperStrength}
            defenders={defenders}
            assist={assist}
            seed={useFixedSeed ? seed : undefined}
          />
        </div>

        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="text-lg font-black">Tuning</div>
          <p className="text-xs text-white/50">
            Changing any of these starts a fresh run.
          </p>

          <Slider label="Pace" value={pace} onChange={setPace} />
          <Slider label="Opponent strength" value={oppStrength} onChange={setOppStrength} />
          <Slider label="Keeper strength" value={keeperStrength} onChange={setKeeperStrength} />

          <div>
            <div className="text-xs font-bold text-white/70 mb-1">Defenders</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setDefenders(n)}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-bold ${
                    defenders === n ? "bg-emerald-500 text-emerald-950" : "bg-white/10 text-white/70"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between text-xs font-bold text-white/70">
            Open-side assist glow
            <input type="checkbox" checked={assist} onChange={e => setAssist(e.target.checked)} />
          </label>

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
