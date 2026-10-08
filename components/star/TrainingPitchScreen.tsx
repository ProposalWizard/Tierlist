"use client";

/**
 * THE TRAINING PITCH — placeholder (8 Oct 2026). Walking through the gate of
 * the training pitch in the 3D garden opens phase "training-3d"
 * (app/star-dev/page.tsx). The 3D training game itself is being built
 * separately; it mounts in page.tsx where the comment "mount Training3D
 * here" is, in place of this screen. Back returns you to the pitch's gate.
 */
export default function TrainingPitchScreen({ onBack }: { onBack: () => void }) {
  return (
    <div
      data-training3d-placeholder
      style={{
        position: "fixed", inset: 0, zIndex: 80, display: "grid", placeItems: "center", padding: 16,
        background: "radial-gradient(120% 70% at 50% 0%, #2f7a3a 0%, #123d1c 55%, #08160c 100%)", color: "#f7f1e8",
      }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: 14, textAlign: "center", maxWidth: 320 }}>
        <span aria-hidden style={{ fontSize: 56 }}>⚽</span>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Training pitch</div>
        <div style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}>3D training is coming soon.</div>
        <button
          onClick={onBack}
          style={{ height: 46, padding: "0 22px", borderRadius: 14, border: "none", background: "#facc15", color: "#111", fontWeight: 900, fontSize: 16, cursor: "pointer" }}
        >
          &#8249; Back to the garden
        </button>
      </div>
    </div>
  );
}
