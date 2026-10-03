"use client";

/**
 * THE SIGNING, LIVE 3D — the screen around the three.js scene.
 *
 * Full screen, no black bars: the 3D fills the phone, and the words, the
 * TAP TO SIGN button, the SIGNED stamp and Skip sit on top of it. Used by the
 * 3D Test Area (/star-3d-area-dev/signing, with sample terms and a picker for
 * the look) and by the career's signing when Settings → "3D signing scene
 * (beta)" is on (TrialReward.tsx).
 *
 * three.js is only fetched when this mounts (signing3dScene.ts imports it).
 */
import { useEffect, useRef, useState } from "react";
import type { SigningContract, SigningManager, SigningSceneHandle, SigningYou } from "@/lib/star/signing3dScene";
import type { SigningLine } from "@/lib/star/signing3d";
import { SIGNATURE_D } from "./TrialReward";

const INK = "#f8fafc";

/** Why the 3D can't run here, or null if it can. three.js (r163 on) needs
 *  WebGL 2; an old phone, a locked-down browser or a lost GPU has none. */
export function signing3dBlocker(): string | null {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return "this browser has no WebGL 2 (three.js needs it)";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  } catch (e) {
    return `WebGL 2 check threw: ${(e as Error)?.message ?? e}`;
  }
}

/** Say out loud why the 3D signing fell back to the drawn one. */
function report3dFailure(reason: string, err?: unknown) {
  console.warn(`[3D signing] not playing — ${reason}. Showing the drawn signing instead.`, err ?? "");
  (window as unknown as { __sign3dFail?: string }).__sign3dFail = reason;
}

/** The longest the office may take to load before the drawn signing takes over. */
const LOAD_LIMIT_MS = 30000;

type Stage = "loading" | "talk" | "contract" | "signing" | "done" | "failed";

export interface SigningScene3DProps {
  you: SigningYou;
  manager: SigningManager;
  contract: SigningContract;
  lines: SigningLine[];
  /** The title at the top ("Signing for Enfield Town"). */
  title: string;
  /** Pressed at the end (Continue) — or Skip, any time. */
  onDone: () => void;
  /** Words on the Continue button. */
  doneLabel?: string;
  /** Extra controls on the top bar (the test area's picker button). */
  topRight?: React.ReactNode;
  /** Something to open the 3D failing with (the drawn signing). */
  onFail?: () => void;
  /** A key that, when it changes, plays the scene from the start again. */
  replayKey?: number;
}

export default function SigningScene3D(props: SigningScene3DProps) {
  const { you, manager, contract, lines, title, onDone, doneLabel = "Continue", topRight, onFail, replayKey = 0 } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const handle = useRef<SigningSceneHandle | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState(0);
  const [stamp, setStamp] = useState(false);
  const youRef = useRef(you);
  youRef.current = you;

  // Build the scene once (and again on a replay).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let disposed = false;
    setStage("loading"); setLine(0); setStamp(false);
    (window as unknown as { __sign3dFail?: string }).__sign3dFail = undefined;
    const fail = (reason: string, err?: unknown) => {
      if (disposed) return;
      report3dFailure(reason, err);
      setStage("failed");
    };
    const blocker = signing3dBlocker();
    if (blocker) { fail(blocker); return () => { disposed = true; }; }
    // Never sit on "Walking into the office…" for good (a stalled download).
    const slow = window.setTimeout(() => { if (!handle.current) fail(`still loading after ${LOAD_LIMIT_MS / 1000} s`); }, LOAD_LIMIT_MS);
    // A phone that runs out of GPU memory drops the context: the picture
    // freezes black. Fall back rather than leave a dead screen.
    const onLost = (e: Event) => { e.preventDefault(); fail("the phone dropped the 3D (WebGL context lost)"); };
    el.addEventListener("webglcontextlost", onLost, true);
    (async () => {
      try {
        const { createSigningScene } = await import("@/lib/star/signing3dScene");
        const h = await createSigningScene(el, {
          you: youRef.current, manager, contract, signaturePath: SIGNATURE_D,
          onEvent: (e) => {
            if (e === "stamp") { setStamp(true); window.setTimeout(() => setStamp(false), 1500); }
            if (e === "done") setStage("done");
          },
        });
        if (disposed) { h.dispose(); return; }
        window.clearTimeout(slow);
        handle.current = h;
        (window as unknown as { __sign3d?: SigningSceneHandle; __sign3dReady?: boolean }).__sign3d = h;
        (window as unknown as { __sign3dReady?: boolean }).__sign3dReady = true;
        h.setShot(lines[0]?.shot ?? "talk");
        setStage("talk");
      } catch (err) {
        window.clearTimeout(slow);
        fail(`it threw while building: ${(err as Error)?.message ?? err}`, err);
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(slow);
      el.removeEventListener("webglcontextlost", onLost, true);
      handle.current?.dispose();
      handle.current = null;
      (window as unknown as { __sign3dReady?: boolean }).__sign3dReady = false;
    };
    // The look changes through setYou below, not a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  // A new look (the test area's picker, or a face arriving): rebuild you only.
  const youKey = JSON.stringify({ ...you, face: you.face ? (you.face.canvas as HTMLCanvasElement).width + ":" + you.face.chinY : null });
  const firstYou = useRef(true);
  useEffect(() => {
    if (firstYou.current) { firstYou.current = false; return; }
    handle.current?.setYou(you);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youKey]);

  const current = lines[line];
  // The words type out (no voice).
  useEffect(() => {
    if (stage !== "talk" || !current) return;
    setTyped(0);
    let n = 0;
    const id = window.setInterval(() => { n += 2; setTyped(n); if (n >= current.text.length) window.clearInterval(id); }, 28);
    return () => window.clearInterval(id);
  }, [line, stage, current]);

  const advance = () => {
    if (stage !== "talk" || !current) return;
    if (typed < current.text.length) { setTyped(current.text.length); return; }
    if (line + 1 < lines.length) {
      setLine(line + 1);
      handle.current?.setShot(lines[line + 1].shot);
    } else {
      setStage("contract");
      handle.current?.setShot("contract");
    }
  };
  const sign = () => {
    if (stage !== "contract") return;
    setStage("signing");
    handle.current?.sign();
  };
  const skip = () => {
    if (stage === "done") { onDone(); return; }
    onDone();
  };
  const tapScene = () => {
    if (stage === "talk") advance();
    else if (stage === "signing") { handle.current?.skip(); setStage("done"); }
  };

  useEffect(() => { if (stage === "failed") onFail?.(); }, [stage, onFail]);

  const speaker = current?.who === "boss" ? contract.managerName.toUpperCase() + " · MANAGER" : "YOU";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#120c08", color: INK, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", overflow: "hidden", touchAction: "manipulation" }}>
      <div ref={wrap} data-stage={stage} onClick={tapScene} style={{ position: "absolute", inset: 0, cursor: stage === "talk" ? "pointer" : "default", userSelect: "none" }} />

      {/* Top bar: title, Skip, extras. A soft shade so the words read over any shot. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, padding: "max(10px, env(safe-area-inset-top)) 12px 26px", background: "linear-gradient(180deg, rgba(0,0,0,.6), rgba(0,0,0,0))", display: "flex", alignItems: "center", gap: 8, pointerEvents: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.4, color: "#fbbf24", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flex: 1, textShadow: "0 1px 3px #000" }}>{title}</div>
        <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
          {topRight}
          {stage !== "done" && (
            <button onClick={skip} style={{ minHeight: 36, padding: "0 12px", fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: INK, background: "rgba(0,0,0,.45)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 999 }}>Skip</button>
          )}
        </div>
      </div>

      {stage === "loading" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#e2e8f0", pointerEvents: "none" }}>Walking into the office…</div>
      )}
      {stage === "failed" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>The 3D scene could not start on this phone.</div>
          <button onClick={onDone} style={{ padding: "12px 22px", fontSize: 15, fontWeight: 900, color: "#07090f", background: INK, border: "none", borderRadius: 10 }}>{doneLabel}</button>
        </div>
      )}

      {/* The words. */}
      {stage === "talk" && current && (
        <div data-line={line} onClick={advance} style={{ position: "absolute", left: 12, right: 12, bottom: "max(22px, env(safe-area-inset-bottom))", padding: "12px 14px 22px", background: "rgba(5,7,12,.84)", borderLeft: `3px solid ${current.who === "boss" ? "#fbbf24" : "#60a5fa"}`, borderRadius: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: current.who === "boss" ? "#fbbf24" : "#60a5fa" }}>{speaker}</div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginTop: 4, minHeight: 46 }}>{current.text.slice(0, typed)}</div>
          <div style={{ position: "absolute", right: 12, bottom: 6, fontSize: 11, color: "#94a3b8" }}>{line + 1}/{lines.length} · tap ›</div>
        </div>
      )}

      {stage === "contract" && (
        <div style={{ position: "absolute", left: 12, right: 12, bottom: "max(22px, env(safe-area-inset-bottom))" }}>
          <button data-sign onClick={sign} style={{ width: "100%", padding: "16px 0", fontSize: 18, fontWeight: 900, letterSpacing: 1.5, color: "#1a1206", background: "linear-gradient(180deg,#fde047,#f59e0b)", border: "none", borderRadius: 12, boxShadow: "0 6px 22px rgba(245,158,11,.45)" }}>
            TAP TO SIGN
          </button>
        </div>
      )}

      {stamp && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "15%", textAlign: "center", pointerEvents: "none" }}>
          <span style={{ display: "inline-block", padding: "8px 18px", fontSize: 32, fontWeight: 900, letterSpacing: 3, color: "#fde047", border: "3px solid #fde047", transform: "rotate(-8deg)", background: "rgba(0,0,0,.45)", animation: "stampIn 380ms cubic-bezier(.2,1.6,.4,1) both" }}>SIGNED</span>
        </div>
      )}

      {stage === "done" && (
        <div style={{ position: "absolute", left: 12, right: 12, bottom: "max(22px, env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center", marginBottom: 10, textShadow: "0 2px 6px #000" }}>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 2, color: "#fbbf24" }}>WELCOME TO</div>
            <div style={{ fontSize: 26, fontWeight: 900, textTransform: "uppercase" }}>{contract.club}</div>
          </div>
          <button onClick={onDone} style={{ width: "100%", padding: "15px 0", fontSize: 16, fontWeight: 900, color: "#07090f", background: INK, border: "none", borderRadius: 12 }}>{doneLabel}</button>
        </div>
      )}
      <style>{`@keyframes stampIn { from { transform: rotate(-8deg) scale(2.2); opacity: 0 } to { transform: rotate(-8deg) scale(1); opacity: 1 } }`}</style>
    </div>
  );
}
