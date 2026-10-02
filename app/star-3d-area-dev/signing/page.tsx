"use client";

/**
 * SIGNING SCENE — 3D PROTOTYPE (v0.24, Harry P2-7..P2-13, P2-49/50).
 *
 * "Make it an actual conversation … sitting across from him, like a FIFA
 * career mode." "The contract should be facing him … the camera over their
 * shoulder. And then it zooms out to this when you tap to sign and shows the
 * player actually signing it."
 *
 * Every picture is a Blender render (tools/blender-signing/signing.py), made
 * once per skin tone, so the page only swaps pictures: no 3D runs in the
 * browser. Not wired into a career: the contract's terms are a fixed sample.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { SIGNING_LINES, SIGNING_SKINS, signingShot, type SigningSkin } from "@/lib/star/signing3d";

const INK = "#f8fafc";

type Stage = "talk" | "contract" | "zoom" | "signed";

export default function Signing3dPage() {
  const [skin, setSkin] = useState<SigningSkin>("medium");
  const [line, setLine] = useState(0);
  const [stage, setStage] = useState<Stage>("talk");
  const [typed, setTyped] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [pen, setPen] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  // Load every picture for this skin up front, so no beat waits on the network.
  useEffect(() => {
    for (const b of ["talk", "reply", "contract", "signing", "signed"] as const) {
      const im = new Image(); im.src = signingShot(b, skin);
    }
  }, [skin]);

  const current = SIGNING_LINES[line];
  // The words type out (no voice).
  useEffect(() => {
    if (stage !== "talk") return;
    setTyped(0);
    let n = 0;
    const id = window.setInterval(() => { n += 2; setTyped(n); if (n >= current.text.length) window.clearInterval(id); }, 28);
    return () => window.clearInterval(id);
  }, [line, stage, current.text.length]);

  const restart = useCallback(() => {
    clearTimers(); setLine(0); setStage("talk"); setZoomed(false); setPen(false);
  }, []);
  useEffect(() => () => clearTimers(), []);

  const advance = () => {
    if (stage !== "talk") return;
    if (typed < current.text.length) { setTyped(current.text.length); return; }
    if (line + 1 < SIGNING_LINES.length) setLine(line + 1);
    else setStage("contract");
  };

  const sign = () => {
    if (stage !== "contract") return;
    setStage("zoom"); setZoomed(false);
    // next frame: start the pull-back from the paper to the wide desk
    later(() => setZoomed(true), 40);
    later(() => setPen(true), 950);
    later(() => setStage("signed"), 1900);
  };

  const shot = stage === "talk" ? current.shot : stage === "contract" ? "contract" : stage === "zoom" ? "signing" : "signed";

  return (
    <main style={{ minHeight: "100vh", background: "#07090f", color: INK, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px 8px" }}>
          <Link href="/star-3d-area-dev" aria-label="Back" style={{ color: INK, textDecoration: "none", fontSize: 22, width: 28 }}>‹</Link>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1, color: "#fbbf24" }}>SIGNING FOR ENFIELD TOWN</div>
          <button onClick={restart} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, padding: "6px 10px", background: "rgba(255,255,255,.1)", color: INK, border: "none", borderRadius: 2 }}>↺ Replay</button>
        </header>

        <div style={{ display: "flex", gap: 6, padding: "0 12px 10px", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#94a3b8", marginRight: 2 }}>Your player</span>
          {SIGNING_SKINS.map((s) => (
            <button
              key={s.id}
              data-skin={s.id}
              onClick={() => setSkin(s.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 9px", fontSize: 12, fontWeight: 700, borderRadius: 2, border: "none", background: s.id === skin ? INK : "rgba(255,255,255,.08)", color: s.id === skin ? "#07090f" : INK }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 6, background: s.dot, boxShadow: "0 0 0 1px rgba(0,0,0,.3)" }} />{s.label}
            </button>
          ))}
        </div>

        {/* THE SCENE */}
        <div
          data-stage={stage}
          onClick={advance}
          style={{ position: "relative", aspectRatio: "4 / 5", overflow: "hidden", background: "#000", cursor: stage === "talk" ? "pointer" : "default", userSelect: "none" }}
        >
          {(["talk", "reply", "contract"] as const).map((b) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={b} src={signingShot(b, skin)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: shot === b ? 1 : 0, transition: "opacity 260ms ease" }} />
          ))}
          {/* the wide desk: starts zoomed in on the paper and pulls back */}
          {(["signing", "signed"] as const).map((b) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={b}
              src={signingShot(b, skin)}
              alt=""
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
                opacity: (b === "signing" && stage === "zoom") || (b === "signed" && stage === "signed") ? 1 : 0,
                transformOrigin: "48% 53%",
                transform: stage === "zoom" && !zoomed ? "scale(3.2)" : "scale(1)",
                transition: stage === "zoom" ? "transform 900ms cubic-bezier(.2,.7,.2,1), opacity 220ms ease" : "opacity 300ms ease",
              }}
            />
          ))}

          {/* the letterbox bars, like a cutscene */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 18, background: "#000" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 18, background: "#000" }} />

          {stage === "talk" && (
            <div data-line={line} style={{ position: "absolute", left: 12, right: 12, bottom: 30, padding: "10px 12px", background: "rgba(5,7,12,.82)", borderLeft: `3px solid ${current.who === "boss" ? "#fbbf24" : "#60a5fa"}` }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: current.who === "boss" ? "#fbbf24" : "#60a5fa" }}>
                {current.who === "boss" ? "O. BIANCHI · MANAGER" : "YOU"}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, marginTop: 3, minHeight: 44 }}>{current.text.slice(0, typed)}</div>
              <div style={{ position: "absolute", right: 10, bottom: 6, fontSize: 11, color: "#94a3b8" }}>{line + 1}/{SIGNING_LINES.length} · tap ›</div>
            </div>
          )}

          {stage === "signed" && (
            <div style={{ position: "absolute", left: 0, right: 0, top: "16%", textAlign: "center" }}>
              <span style={{ display: "inline-block", padding: "8px 18px", fontSize: 30, fontWeight: 900, letterSpacing: 3, color: "#fde047", border: "3px solid #fde047", transform: "rotate(-8deg)", background: "rgba(0,0,0,.45)", animation: "stampIn 380ms cubic-bezier(.2,1.6,.4,1) both" }}>SIGNED</span>
            </div>
          )}
          {stage === "zoom" && pen && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#e2e8f0", textShadow: "0 1px 3px #000" }}>✍︎ signing…</div>
          )}
        </div>

        <div style={{ padding: 12 }}>
          {stage === "contract" && (
            <button data-sign onClick={sign} style={{ width: "100%", padding: "15px 0", fontSize: 17, fontWeight: 900, letterSpacing: 1, color: "#1a1206", background: "linear-gradient(180deg,#fde047,#f59e0b)", border: "none", borderRadius: 3, boxShadow: "0 6px 18px rgba(245,158,11,.35)" }}>
              TAP TO SIGN
            </button>
          )}
          {stage === "signed" && (
            <button onClick={restart} style={{ width: "100%", padding: "14px 0", fontSize: 16, fontWeight: 900, color: "#07090f", background: INK, border: "none", borderRadius: 3 }}>Continue (replays here)</button>
          )}
          {stage === "talk" && <div style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>Tap the picture for the next line</div>}
        </div>
      </div>
      <style>{`@keyframes stampIn { from { transform: rotate(-8deg) scale(2.2); opacity: 0 } to { transform: rotate(-8deg) scale(1); opacity: 1 } }`}</style>
      <PageGuide page="/star-3d-area-dev/signing" />
    </main>
  );
}
