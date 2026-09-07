"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CanvasMatchTest from "@/components/star/CanvasMatchTest";
import { shotTuning, SCENARIO_KINDS, type ScenarioKind } from "@/lib/star/canvasEngineTest";
import { loadCareer } from "@/lib/star/storage";
import type { CareerState } from "@/lib/star/types";

const POSITIONS = ["ST", "CAM", "LW", "RW", "CM", "CDM", "LM", "RM", "LB", "RB", "CB", "GK"];

const SCENARIO_LABELS: Record<ScenarioKind, string> = {
  one_on_one: "One-on-One", tight_angle: "Tight Angle", long_range: "Long Range",
  volley: "Volley", header: "Header", cutback: "Cutback", byline_cross: "Byline Cross",
  through_ball: "Through Ball", midfield_pass: "Midfield Pass", penalty: "Penalty",
  free_kick: "Free Kick", corner: "Corner", buildup: "Buildup",
};

// Standalone sandbox for the Canvas match engine. Admin-only; not linked in nav.
//
// Renders CanvasMatchTest, a full fork of the real CanvasMatch component that
// runs on canvasEngineTest.ts / hiddenMatchTest.ts instead of the production
// engine — not just an admin-gated view of the same code. A physics change
// made here (loft, power, curl, keeper reflexes, anything) cannot reach a
// real career at /star-dev by accident; it has to be deliberately ported to
// the production files once it's been tried out and settled on.
export default function StarMatchDevPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [power, setPower] = useState(55);
  const [technique, setTechnique] = useState(55);
  const [keeperStrength, setKeeperStrength] = useState(62);
  const [position, setPosition] = useState("ST");
  const [careerPosition, setCareerPosition] = useState<string | null>(null);
  const [teamRelationship, setTeamRelationship] = useState(60);
  const [careerTeam, setCareerTeam] = useState<number | null>(null);
  const [career, setCareer] = useState<CareerState | null>(null);
  // Mirrors shotTuning (a mutable module singleton canvasEngineTest.ts reads
  // on every kick) purely for the slider's own display — the write on drag
  // goes straight into shotTuning itself, not through props or a re-render.
  const [vzPowerFloor, setVzPowerFloor] = useState(shotTuning.vzPowerFloor);
  const [vzPowerWeight, setVzPowerWeight] = useState(shotTuning.vzPowerWeight);
  const [vzScale, setVzScale] = useState(shotTuning.vzScale);
  /**
   * Pin every chance to one kind instead of letting the match pick.
   *
   * Reported directly: "I have never taken a penalty in this game" — real,
   * because penalty duty has to be earned (setPieces.ts), not a bug, but
   * there was no way to just look at one without playing dozens of matches
   * hoping duty and the dice lined up on the same chance. Null is "random",
   * the sandbox's original behaviour.
   */
  const [forcedKind, setForcedKind] = useState<ScenarioKind | null>(null);
  // Simulates having curve boots equipped — there's no shop/career grind on
  // this sandbox, so a toggle stands in for actually owning the boot. See
  // canvasEngineTest.ts's ported applyCurveSwipe/curveDirFromSwipe.
  const [canCurve, setCanCurve] = useState(false);

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
      // Pre-fill the sliders from this account's own real career, if this
      // browser has one cached for it — see storage.ts's scoping note on
      // why that has to be per-account rather than a flat, shared key.
      const loaded = loadCareer(user.id);
      if (loaded) {
        setCareer(loaded);
        setCareerPosition(loaded.player.position);
        setPosition(loaded.player.position);
        setCareerTeam(loaded.relationships.team);
        setTeamRelationship(loaded.relationships.team);
      }
    });
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
    <div
      className="min-h-screen bg-gray-950 text-white py-4 px-3"
      style={{ backgroundImage: "radial-gradient(70% 45% at 50% 0%, rgba(16,185,129,0.16), transparent 70%)" }}
    >
      <div className="max-w-sm mx-auto">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] font-black tracking-widest uppercase">
            Knowitball · Match Lab
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight">Shooting Test</h1>
        </div>

        <CanvasMatchTest
          // Remounts on a kind change so the very first chance shown is
          // already the picked one, not just every chance after it.
          key={forcedKind ?? "random"}
          skills={{ power, technique }}
          keeperStrength={keeperStrength}
          position={position}
          teamRelationship={teamRelationship}
          career={career}
          seed={2024}
          forcedKind={forcedKind}
          canCurve={canCurve}
        />

        {/* Scenario picker — every chance becomes exactly this kind, bypassing
            duty and the hidden match's own zone requests. */}
        <div className="mt-4 bg-gray-900/60 border border-gray-700 rounded-lg p-3 space-y-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Scenario</div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setForcedKind(null)}
              className={`rounded-lg px-2 py-1.5 text-[11px] font-black uppercase transition ${
                forcedKind === null
                  ? "bg-emerald-500 text-emerald-950"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
            >
              Random
            </button>
            {SCENARIO_KINDS.map((kind) => (
              <button
                key={kind}
                onClick={() => setForcedKind(kind)}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-black uppercase transition ${
                  forcedKind === kind
                    ? "bg-emerald-500 text-emerald-950"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
              >
                {SCENARIO_LABELS[kind]}
              </button>
            ))}
          </div>
          {forcedKind && (
            <div className="text-[10px] text-gray-500 text-center">
              Every chance is a {SCENARIO_LABELS[forcedKind].toLowerCase()} — duty and the match's own requests are bypassed.
            </div>
          )}
        </div>

        {/* Curve boots — no shop here, so a toggle stands in for owning one. */}
        <div className="mt-4 bg-gray-900/60 border border-gray-700 rounded-lg p-3 space-y-2">
          <label className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Curve boots</div>
              <div className="text-[10px] text-gray-500">Once struck, drag on the shot to bend/lift/dip it.</div>
            </div>
            <input
              type="checkbox"
              checked={canCurve}
              onChange={(e) => setCanCurve(e.target.checked)}
              className="w-5 h-5 accent-sky-500"
            />
          </label>
        </div>

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

        {/* Physics tuning — writes straight into canvasEngineTest.ts's shotTuning
            singleton, so it takes effect on the very next kick, not next reload. */}
        <div className="mt-4 bg-gray-900/60 border border-gray-700 rounded-lg p-3 space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">
            Physics Tuning — height vs. power
          </div>
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white mb-1">
              <span>Height at 0% power</span>
              <span className="text-cyan-400">{Math.round(vzPowerFloor * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={Math.round(vzPowerFloor * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setVzPowerFloor(v);
                shotTuning.vzPowerFloor = v;
              }}
              className="w-full"
            />
            <div className="text-[10px] text-gray-500 mt-0.5">
              How much of full height a bottom-of-the-ball strike still gets with barely any power behind it.
            </div>
          </label>
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white mb-1">
              <span>Extra height from full power</span>
              <span className="text-cyan-400">+{Math.round(vzPowerWeight * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={Math.round(vzPowerWeight * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setVzPowerWeight(v);
                shotTuning.vzPowerWeight = v;
              }}
              className="w-full"
            />
            <div className="text-[10px] text-gray-500 mt-0.5">
              How much taller full power hits on top of that floor. Forward pace is untouched by either slider — that already scales with power.
            </div>
          </label>
          <label className="block">
            <div className="flex justify-between text-xs font-bold text-white mb-1">
              <span>Overall lift</span>
              <span className="text-cyan-400">{Math.round(vzScale * 100)}%</span>
            </div>
            <input
              type="range" min={40} max={140} value={Math.round(vzScale * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setVzScale(v);
                shotTuning.vzScale = v;
              }}
              className="w-full"
            />
            <div className="text-[10px] text-gray-500 mt-0.5">
              Scales every height above. Height is now linear across the ball — top of the
              ball is the flattest drive, the very bottom is the highest, and halfway up
              is genuinely halfway. The cost measured at 100%: from a one-on-one at 70%
              power, a mid-ball strike clears the bar 19% of the time (was 0%), and a
              very-bottom strike 74% (unchanged — that is the power-decoupling, not the
              curve). Pull this down if it floats too much.
            </div>
          </label>
          {Math.abs(vzPowerFloor + vzPowerWeight - 1) > 0.001 && (
            <div className="text-[10px] text-amber-400">
              Floor + extra = {Math.round((vzPowerFloor + vzPowerWeight) * 100)}% at full power — not 100%. That's fine to experiment with, just know full power won't be the tallest point unless these add to 100.
            </div>
          )}
        </div>

        <div className="mt-3 text-center text-[10px] text-gray-500">
          Each session is a 6-chance mini-match — a post-match summary shows after the last one.
        </div>
      </div>
    </div>
  );
}
