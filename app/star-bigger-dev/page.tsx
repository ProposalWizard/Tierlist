"use client";

/**
 * TEST PAGE (Harry, 12 Oct 2026): the 2D Style A players, keeper and ball 30%
 * bigger, played in the real match through EnginePlay. The real game is not
 * changed; this page alone sets the size (setFigureGrowOverride). Buttons switch
 * size and chance kind. ?kind=&seed=&size=1|1.15|1.3|1.45 also work.
 */
import { useEffect, useState } from "react";
import EnginePlay from "@/components/star/EnginePlay";
import { buildScenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { setMatchViewOverride, setFigureGrowOverride } from "@/lib/star/matchView";

const SIZES = [1, 1.15, 1.3, 1.45];
const KINDS: ScenarioKind[] = ["one_on_one", "corner", "cutback", "through_ball", "tight_angle", "long_range"];

export default function BiggerPlayersDev() {
  const [q, setQ] = useState<{ kind: ScenarioKind; seed: number; size: number } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setMatchViewOverride("new");
    setQ({
      kind: (p.get("kind") as ScenarioKind) || "one_on_one",
      seed: Number(p.get("seed") || 3),
      size: Number(p.get("size") || 1.3),
    });
    return () => { setFigureGrowOverride(null); setMatchViewOverride(null); };
  }, []);
  if (!q) return null;
  setFigureGrowOverride(q.size);
  const btn = (on: boolean) => ({
    padding: "6px 10px", borderRadius: 999, fontWeight: 700, fontSize: 13,
    background: on ? "#22c55e" : "#1f2937", color: on ? "#052e16" : "#fff", border: "none",
  });
  return (
    <div style={{ background: "#0b1220", minHeight: "100vh", color: "#fff", padding: "10px 12px" }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Bigger players (test only)</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {SIZES.map((s) => (
          <button key={s} style={btn(q.size === s)} onClick={() => setQ({ ...q, size: s })}>
            {s === 1 ? "Today" : `+${Math.round((s - 1) * 100)}%`}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {KINDS.map((k) => (
          <button key={k} style={btn(q.kind === k)} onClick={() => setQ({ ...q, kind: k, seed: q.seed + 1 })}>
            {k.replace("_", " ")}
          </button>
        ))}
      </div>
      <EnginePlay
        key={`${q.kind}-${q.seed}-${q.size}`}
        seed={q.seed}
        openOn={() => buildScenario(q.kind, mulberry32(q.seed * 7919 + 11))}
      />
    </div>
  );
}
