"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CanvasMatch from "@/components/star/CanvasMatch";
import { loadCareer } from "@/lib/star/storage";

const POSITIONS = ["ST", "CAM", "LW", "RW", "CM", "CDM", "LM", "RM", "LB", "RB", "CB", "GK"];

// Standalone sandbox for the Canvas match engine. Admin-only; not linked in nav.
// Kept separate from /star-dev so the working career mode is untouched while the
// engine is developed.
export default function StarMatchDevPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [power, setPower] = useState(55);
  const [technique, setTechnique] = useState(55);
  const [keeperStrength, setKeeperStrength] = useState(62);
  const [position, setPosition] = useState("ST");
  const [careerPosition, setCareerPosition] = useState<string | null>(null);
  const [teamRelationship, setTeamRelationship] = useState(60);
  const [careerTeam, setCareerTeam] = useState<number | null>(null);

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
    const career = loadCareer();
    if (career) {
      setCareerPosition(career.player.position);
      setPosition(career.player.position);
      setCareerTeam(career.relationships.team);
      setTeamRelationship(career.relationships.team);
    }
  }, []);

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
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white py-4 px-3">
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-400/40 text-yellow-300 text-[10px] font-black tracking-widest uppercase">
            Match Engine Sandbox
          </div>
          <h1 className="mt-2 text-xl font-black">Shooting Test</h1>
        </div>

        <CanvasMatch
          skills={{ power, technique }}
          keeperStrength={keeperStrength}
          position={position}
          teamRelationship={teamRelationship}
          seed={2024}
        />

        {/* Skill sliders so I can feel how attributes change the shot */}
        <div className="mt-4 bg-gray-900/60 border border-gray-700 rounded-lg p-3 space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Test Skills</div>
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white mb-1">
              <span>Power</span><span className="text-emerald-400">{power}</span>
            </div>
            <input type="range" min={20} max={100} value={power} onChange={(e) => setPower(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white mb-1">
              <span>Technique</span><span className="text-emerald-400">{technique}</span>
            </div>
            <input type="range" min={20} max={100} value={technique} onChange={(e) => setTechnique(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white mb-1">
              <span>Keeper Strength</span><span className="text-yellow-400">{keeperStrength}</span>
            </div>
            <input type="range" min={20} max={100} value={keeperStrength} onChange={(e) => setKeeperStrength(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white mb-1">
              <span>Position{careerPosition ? ` (career: ${careerPosition})` : ""}</span>
            </div>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full bg-gray-800 text-white text-sm font-bold rounded-lg px-2 py-1.5 border border-gray-700"
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white mb-1">
              <span>Team Relationship{careerTeam !== null ? ` (career: ${careerTeam})` : ""}</span>
              <span className="text-amber-400">{teamRelationship}</span>
            </div>
            <input
              type="range" min={0} max={100} value={teamRelationship}
              onChange={(e) => setTeamRelationship(Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
