"use client";

/**
 * "‹ Back" on every 3D drill and 3D training screen (Harry, 9 Oct 2026:
 * "please add a back button on every 3D drill"). The 3D shop's "‹ Shop" pill
 * (Shop3D.tsx `pill`), top-left, clear of the notch. It always shows; a tap
 * leaves straight away: the drill ends, nothing is credited, nothing is asked.
 */
import type React from "react";

/** The 3D shop's pill (Shop3D.tsx `pill`), copied so a drill doesn't pull in the shop's code. */
const pill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 36, padding: "0 12px", borderRadius: 999,
  background: "rgba(18,13,10,0.62)", border: "1px solid rgba(255,230,200,0.14)", color: "#f7f1e8",
  fontSize: 13, fontWeight: 800, textDecoration: "none", backdropFilter: "blur(6px)",
};

export default function BackPill3D({ onBack, label = "Back" }: { onBack: () => void; label?: string }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, zIndex: 95, padding: "max(12px, env(safe-area-inset-top)) 12px 0 max(12px, env(safe-area-inset-left))", pointerEvents: "none" }}>
      <button onClick={onBack} aria-label={label} data-back3d style={{ ...pill, pointerEvents: "auto", cursor: "pointer", gap: 4, paddingLeft: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>&#8249;</span>{label}
      </button>
    </div>
  );
}
