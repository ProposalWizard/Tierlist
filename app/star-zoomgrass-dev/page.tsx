"use client";

/**
 * PROTOTYPE (show-options, 9 Oct 2026): zoom to the play. One chance, built
 * from ?kind=&seed=, played in the real match through EnginePlay, with the
 * camera zoom set by ?zoom=off|z1|z2 (lib/star/matchView.ts). Reads the
 * camera through window.__zg. Not linked anywhere.
 */
import { useEffect, useState } from "react";
import EnginePlay from "@/components/star/EnginePlay";
import { buildScenario, type ScenarioKind } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { setMatchViewOverride, setPlayZoomOverride, type PlayZoom } from "@/lib/star/matchView";

export default function ZoomGrassDev() {
  const [q, setQ] = useState<{ kind: ScenarioKind; seed: number; zoom: PlayZoom } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const zoom = (p.get("zoom") as PlayZoom) || "off";
    setMatchViewOverride("new");
    setPlayZoomOverride(zoom);
    setQ({ kind: (p.get("kind") as ScenarioKind) || "one_on_one", seed: Number(p.get("seed") || 1), zoom });
  }, []);
  if (!q) return null;
  return (
    <div style={{ background: "#0b1220", minHeight: "100vh" }}>
      <EnginePlay seed={q.seed} openOn={() => buildScenario(q.kind, mulberry32(q.seed * 7919 + 11))} />
    </div>
  );
}
