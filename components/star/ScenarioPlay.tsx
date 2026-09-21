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

import { useCallback, useEffect, useState } from "react";
import CanvasMatch from "./CanvasMatch";
import type { Scenario } from "@/lib/star/canvasEngine";

export default function ScenarioPlay({ title, build, onClose, onNext, onBin }: {
  /** What is being played, shown in the bar so it is never ambiguous which
   *  picture you are looking at once the figures start moving. */
  title: string;
  /** Rebuilds the scenario from scratch. Called for every chance, so this
   *  must be pure — handing back one shared object would let the engine
   *  mutate the gallery's own picture as you play it. */
  build: () => Scenario;
  onClose: () => void;
  /** Move to the next chance WITHOUT leaving. Absent, the button is not
   *  shown — the gallery has no "next" to go to in the same sense that
   *  Infinite Highlights does. */
  onNext?: () => void;
  /** Throw this one away as not worth fixing. Same action as the Bin button
   *  on the page behind, offered here because this is where you find out. */
  onBin?: () => void;
}) {
  const openOn = useCallback(() => build(), [build]);

  /**
   * CanvasMatch takes its FIRST scenario at ref creation, so handing it a new
   * `openOn` does not move the picture already on screen — it would only
   * take effect on the chance after this one. Remounting is what makes Next
   * land on the next chance immediately, and it also clears whatever the
   * last one left on the canvas.
   */
  const [nonce, setNonce] = useState(0);
  useEffect(() => { setNonce((n) => n + 1); }, [build]);

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
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            Practice — nothing saved or counted
          </span>
          {onBin && (
            <button
              onClick={onBin}
              title="Not worth fixing — never show this again, and record it in the repo"
              style={{
                background: "rgba(239,68,68,0.16)", color: "#fca5a5", fontWeight: 700,
                border: "1px solid rgba(239,68,68,0.45)", borderRadius: 10,
                padding: "8px 14px", cursor: "pointer",
              }}
            >
              No-go
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              style={{
                background: "rgba(56,189,248,0.18)", color: "#e0f2fe", fontWeight: 800,
                border: "1px solid rgba(56,189,248,0.5)", borderRadius: 10,
                padding: "8px 18px", cursor: "pointer",
              }}
            >
              Next →
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, width: "100%", overflow: "auto", display: "flex", justifyContent: "center" }}>
        <CanvasMatch key={nonce} openOn={openOn} />
      </div>
    </div>
  );
}
