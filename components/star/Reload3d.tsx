"use client";

/**
 * "Tap to reload 3D" (Harry, 27 Nov 2026: "sometimes the 3D just toggles off, it breaks, and then I can't
 * get back into it"). Every 3D place that falls back (the drawn garden, the classic casino, an error card)
 * shows this, so the 3D is never off for good: the tap throws the old WebGL context away and builds the
 * place again on a fresh one (three3d/perf.ts dropSharedRenderer).
 */
export function reload3d(rebuild: () => void) {
  void import("@/lib/star/three3d/perf").then((m) => { m.dropSharedRenderer(); rebuild(); }).catch(() => rebuild());
}

export default function Reload3dPill({ onReload, floating = true }: { onReload: () => void; floating?: boolean }) {
  return (
    <button
      type="button"
      data-reload-3d
      onClick={() => reload3d(onReload)}
      style={{
        ...(floating ? { position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "max(18px, env(safe-area-inset-bottom))", zIndex: 120 } : { marginTop: 14 }),
        height: 40, padding: "0 18px", borderRadius: 999, border: "none", background: "#facc15", color: "#111",
        fontWeight: 900, fontSize: 14, boxShadow: "0 6px 20px rgba(0,0,0,.35)", cursor: "pointer",
      }}
    >
      ↻ Tap to reload 3D
    </button>
  );
}
