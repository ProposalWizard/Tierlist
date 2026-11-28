"use client";

/**
 * The eye button (Harry, 28 Nov 2026: "add a toggle for first person"): every
 * walk-around 3D place (the house, the garden, the 3D shop, the casino, the
 * world kit's lounge, garden and gym) switches between third person (behind
 * him) and first person (his eyes). Gold when you are in his eyes. The choice
 * is remembered per device (lib/star/three3d/viewCam.ts loadViewMode); each
 * scene eases between the two (0.4 s).
 *
 * Round, in the 3D places' dark glass (BackPill3D / Shop3D `pill`), top right
 * under the top bar, clear of the notch. Hover / long-press says what it does.
 */
import type React from "react";
import { useState } from "react";
import { loadViewMode, saveViewMode, type ViewMode } from "@/lib/star/three3d/viewCam";

const GOLD = "#facc15";

export default function ViewToggle3D({ onChange, style }: { onChange: (m: ViewMode) => void; style?: React.CSSProperties }) {
  const [mode, setMode] = useState<ViewMode>(() => (typeof window === "undefined" ? "third" : loadViewMode()));
  const on = mode === "first";
  const label = on ? "First person (tap for third person)" : "Third person (tap for first person)";
  const flip = () => {
    const next: ViewMode = on ? "third" : "first";
    saveViewMode(next);
    setMode(next);
    onChange(next);
  };
  return (
    <button
      onClick={flip}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      aria-pressed={on}
      title={label}
      data-view3d={mode}
      style={{
        position: "absolute", top: "calc(max(12px, env(safe-area-inset-top)) + 46px)", right: 12, zIndex: 6,
        width: 40, height: 40, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer", padding: 0,
        background: on ? "rgba(250,204,21,0.92)" : "rgba(18,13,10,0.62)", border: `1px solid ${on ? GOLD : "rgba(255,230,200,0.14)"}`,
        color: on ? "#111" : "#f7f1e8", backdropFilter: "blur(6px)", WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3.2" fill={on ? "currentColor" : "none"} />
      </svg>
    </button>
  );
}
