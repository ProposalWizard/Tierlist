"use client";

/**
 * PLAY THIS PICTURE — the Scenario Gallery / Infinite Highlights Play button.
 *
 * Asked for directly: "you have to allow me to play the scenarios in the
 * gallery including the simulated scenarios inside the gallery and also in
 * the infinite highlights."
 *
 * A full-screen overlay hosting the REAL match component. Not a second,
 * simplified engine — the whole point is to feel what a scenario plays like,
 * and an approximation of the aiming, the keeper and the physics would answer
 * a different question from the one being asked.
 *
 * It runs in CanvasMatch's own standalone sandbox mode: no `fixture`, no
 * `onComplete`, so nothing is tallied, nothing is credited to a career, and a
 * goal here is not a goal anywhere. `openOn` is handed a FACTORY that rebuilds
 * the picture from scratch each time, so playing it out and going again puts
 * you back on the same scenario instead of a random one.
 */

import { useCallback } from "react";
import CanvasMatch from "./CanvasMatch";
import type { Scenario } from "@/lib/star/canvasEngine";

export default function ScenarioPlay({ title, build, onClose }: {
  /** What is being played, shown in the bar so it is never ambiguous which
   *  picture you are looking at once the figures start moving. */
  title: string;
  /** Rebuilds the scenario from scratch. Called for every chance, so this
   *  must be pure — handing back one shared object would let the engine
   *  mutate the gallery's own picture as you play it. */
  build: () => Scenario;
  onClose: () => void;
}) {
  const openOn = useCallback(() => build(), [build]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "#05070c",
        display: "flex", flexDirection: "column", alignItems: "center",
      }}
    >
      <div style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 700,
            border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <div style={{ fontWeight: 800, color: "#fff" }}>{title}</div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
          Practice — nothing here is saved or counted
        </div>
      </div>

      <div style={{ flex: 1, width: "100%", overflow: "auto", display: "flex", justifyContent: "center" }}>
        <CanvasMatch openOn={openOn} />
      </div>
    </div>
  );
}
