"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LiveAttack from "@/components/star/LiveAttack";
import { DELIVERY_KINDS, DELIVERY_LABEL, type DeliveryKind } from "@/lib/star/liveAttack";

/**
 * Standalone sandbox for the moving attacking-situation mechanic — admin
 * only, not linked in nav, matching the `/star-dribble-dev` /
 * `/star-scenario-dev` pattern. Not wired into a real career or match.
 *
 * The sliders exist for the same reason they do on every other sandbox
 * here: no way to visually verify feel this session (no Supabase
 * credentials, no live browser) — the ready-window timing, delivery
 * speeds, and aim-drag feel need tuning live once this reaches a real
 * device.
 */
export default function StarAttackDevPage() {
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

  const [kindMode, setKindMode] = useState<"random" | DeliveryKind>("random");
  const [power, setPower] = useState(55);
  const [technique, setTechnique] = useState(55);
  const [keeperStrength, setKeeperStrength] = useState(62);
  const [teamRelationship, setTeamRelationship] = useState(60);
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

  const runKey = `${kindMode}-${power}-${technique}-${keeperStrength}-${teamRelationship}-${useFixedSeed ? seed : "random"}`;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-3 py-4 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col items-center gap-3">
          <LiveAttack
            key={runKey}
            skills={{ power, technique }}
            keeperStrength={keeperStrength}
            teamRelationship={teamRelationship}
            kind={kindMode === "random" ? undefined : kindMode}
            seed={useFixedSeed ? seed : undefined}
          />
        </div>

        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="text-lg font-black">Tuning</div>
          <p className="text-xs text-white/50">
            Changing any of these starts a fresh situation.
          </p>

          <div>
            <div className="text-xs font-bold text-white/70 mb-1">Delivery</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setKindMode("random")}
                className={`col-span-2 rounded-lg py-1.5 text-sm font-bold ${
                  kindMode === "random" ? "bg-sky-500 text-sky-950" : "bg-white/10 text-white/70"
                }`}
              >
                Random
              </button>
              {DELIVERY_KINDS.map(k => (
                <button
                  key={k}
                  onClick={() => setKindMode(k)}
                  className={`rounded-lg py-1.5 text-xs font-bold ${
                    kindMode === k ? "bg-emerald-500 text-emerald-950" : "bg-white/10 text-white/70"
                  }`}
                >
                  {DELIVERY_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <Slider label="Power" value={power} onChange={setPower} />
          <Slider label="Technique" value={technique} onChange={setTechnique} />
          <Slider label="Keeper strength" value={keeperStrength} onChange={setKeeperStrength} />
          <Slider label="Team relationship" value={teamRelationship} onChange={setTeamRelationship} />

          <label className="flex items-center justify-between text-xs font-bold text-white/70">
            Fixed seed (replay the same situation)
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
